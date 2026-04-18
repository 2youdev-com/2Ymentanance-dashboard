import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Plus,
  Upload,
  X,
  Loader2,
  AlertCircle,
  Download,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/spinner'
import { useSiteStore } from '@/store'
import { Asset, Pagination, Site } from '@/types'
import api from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'
import { StatusBadge } from '@/components/ui/status-badge'

const ASSET_TYPES = [
  'CHILLER',
  'AHU',
  'ELEVATOR',
  'ELECTRICAL_PANEL',
  'GENERATOR',
  'FIRE_PUMP',
  'FCU',
  'UPS',
  'PRECISION_COOLING',
  'COOLING_TOWER',
  'AUTO_TRANSFER_SWITCH',
  'FIRE_SUPPRESSION',
  'POWER_DISTRIBUTION',
  'OTHER',
]

const formatType = (t: string) => t.replace(/_/g, ' ')

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

type SiteStructure = {
  buildings: string[]
  floors: Record<string, string[]>
  zones: Record<string, string[]>
}

function generateFloors(count: number) {
  return [
    'Basement 2',
    'Basement 1',
    'Ground Floor',
    ...Array.from({ length: count }, (_, i) => `Floor ${i + 1}`),
    'Rooftop',
  ]
}

function generateBuildingFloors(buildings: string[], floorCount = 15) {
  return buildings.reduce<Record<string, string[]>>((acc, building) => {
    acc[building] = generateFloors(floorCount)
    return acc
  }, {})
}

function generateZonesForFloors(floorCount = 15) {
  const zones: Record<string, string[]> = {
    'Basement 2': ['Pump Room', 'Storage', 'Electrical Room'],
    'Basement 1': ['Generator Room', 'Mechanical Room', 'Electrical Room'],
    'Ground Floor': ['Lobby', 'Reception', 'Security', 'Retail Area'],
    Rooftop: ['Mechanical Area', 'Cooling Tower Area', 'Service Area'],
    __default__: ['Zone A', 'Zone B', 'Zone C', 'MEP Core', 'Service Area'],
  }

  for (let i = 1; i <= floorCount; i++) {
    zones[`Floor ${i}`] = [
      'Zone A',
      'Zone B',
      'Zone C',
      'MEP Core',
      'Electrical Room',
      'Mechanical Room',
    ]
  }

  return zones
}

function createSiteStructure(buildings: string[], floorCount = 15): SiteStructure {
  return {
    buildings,
    floors: generateBuildingFloors(buildings, floorCount),
    zones: generateZonesForFloors(floorCount),
  }
}

const SITE_STRUCTURE: Record<string, SiteStructure> = {
  'Bank Tower': createSiteStructure(['Bank Tower'], 15),
  'NRR IT Hub': createSiteStructure(['NRR IT Hub'], 15),
  'Default Site': createSiteStructure(['Main Building'], 15),
}

function getSiteStructure(siteName: string) {
  const key = Object.keys(SITE_STRUCTURE).find(
    k =>
      siteName?.toLowerCase().includes(k.toLowerCase()) ||
      k.toLowerCase().includes(siteName?.toLowerCase())
  )

  return key ? SITE_STRUCTURE[key] : SITE_STRUCTURE['Default Site']
}

function getZones(structure: ReturnType<typeof getSiteStructure>, floor: string): string[] {
  if (!structure) return []
  return structure.zones[floor] ?? structure.zones['__default__'] ?? []
}

function ImportModal({
  onClose,
  onSuccess,
  siteId,
}: {
  onClose: () => void
  onSuccess: () => void
  siteId: string | null
}) {
  const [sites, setSites] = useState<Site[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    created: number
    failed: number
    errors: string[]
  } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api
      .get('/sites')
      .then(r => setSites(r.data.data))
      .catch(() => {})
  }, [])

  const handleFile = (f: File) => {
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.xls') && !f.name.endsWith('.csv')) {
      setError('Only Excel (.xlsx, .xls) or CSV files are accepted.')
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('File size must be under 5 MB.')
      return
    }
    setError(null)
    setFile(f)
  }

  const downloadTemplate = () => {
    const headers = [
      'name',
      'type',
      'model',
      'serialNumber',
      'assetNumber',
      'building',
      'floor',
      'zone',
      'status',
      'remarks',
      'lastPreventiveDate',
      'lastCorrectiveDate',
      'siteId',
    ]
    const exampleRow = [
      'Chiller Unit 1',
      'CHILLER',
      'Trane RTAC 400',
      'SN-001',
      'AST-001',
      'Bank Tower',
      'Floor 1',
      'Zone A',
      'OPERATIONAL',
      '',
      '2024-01-15',
      '',
      siteId || (sites[0]?.id ?? ''),
    ]
    const typeNote = `# Valid types: ${ASSET_TYPES.join(' | ')}`
    const statusNote = '# Valid statuses: OPERATIONAL | NEEDS_MAINTENANCE | OUT_OF_SERVICE'
    const csv = [typeNote, statusNote, headers.join(','), exampleRow.join(',')].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'assets-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
    setError(null)
    setResult(null)

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l && !l.startsWith('#'))
      const [headerLine, ...rows] = lines
      const headers = headerLine.split(',').map(h => h.trim())

      let created = 0
      let failed = 0
      const errors: string[] = []

      for (let i = 0; i < rows.length; i++) {
        const vals = rows[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const row: Record<string, string> = {}

        headers.forEach((h, idx) => {
          row[h] = vals[idx] ?? ''
        })

        if (!row.name || !row.type || !row.siteId) {
          errors.push(`Row ${i + 2}: missing name, type, or siteId`)
          failed++
          continue
        }

        try {
          await api.post('/assets', {
            qrUuid: generateUUID(),
            name: row.name,
            type: row.type,
            model: row.model || 'N/A',
            serialNumber: row.serialNumber || `SN-${Date.now()}-${i}`,
            assetNumber: row.assetNumber || `AST-${Date.now()}-${i}`,
            building: row.building || undefined,
            floor: row.floor || undefined,
            zone: row.zone || undefined,
            status: row.status || 'OPERATIONAL',
            remarks: row.remarks || undefined,
            lastPreventiveDate: row.lastPreventiveDate || undefined,
            lastCorrectiveDate: row.lastCorrectiveDate || undefined,
            siteId: row.siteId,
          })
          created++
        } catch (e: any) {
          errors.push(`Row ${i + 2} (${row.name}): ${e?.response?.data?.error ?? 'failed'}`)
          failed++
        }
      }

      setResult({ created, failed, errors })
      if (created > 0) onSuccess()
    } catch {
      setError('Could not read file. Please use the provided template.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border bg-card shadow-xl p-6 mx-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-base">Bulk Import Assets</h2>
              <p className="text-xs text-muted-foreground">
                Upload a filled CSV template to create assets at once.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <button
          onClick={downloadTemplate}
          className="mb-4 w-full flex items-center gap-3 rounded-lg border border-dashed p-3 hover:bg-muted/40 transition-colors text-left"
        >
          <Download className="h-5 w-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">Download Template</p>
            <p className="text-xs text-muted-foreground">
              Pre-configured .csv with headers and example row
            </p>
          </div>
        </button>

        {!result && (
          <div
            className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault()
              setDragOver(false)
              const f = e.dataTransfer.files[0]
              if (f) handleFile(f)
            }}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            {file ? (
              <p className="text-sm font-medium text-primary">{file.name}</p>
            ) : (
              <>
                <p className="text-sm">
                  <span className="text-primary font-medium">Browse</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  CSV or Excel — max 5 MB, 100 rows
                </p>
              </>
            )}

            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
          </div>
        )}

        {result && (
          <div className="mt-2 rounded-lg border p-4 space-y-2">
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{result.created}</p>
                <p className="text-xs text-muted-foreground">Created</p>
              </div>
              {result.failed > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="max-h-24 overflow-y-auto space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-destructive">
                    {e}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={!file || importing}>
              {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import Assets
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

interface AssetForm {
  qrUuid: string
  type: string
  name: string
  model: string
  serialNumber: string
  assetNumber: string
  building: string
  floor: string
  zone: string
  status: string
  remarks: string
  lastPreventiveDate: string
  lastCorrectiveDate: string
  siteId: string
}

const EMPTY_FORM: AssetForm = {
  qrUuid: '',
  type: 'CHILLER',
  name: '',
  model: '',
  serialNumber: '',
  assetNumber: '',
  building: '',
  floor: '',
  zone: '',
  status: 'OPERATIONAL',
  remarks: '',
  lastPreventiveDate: '',
  lastCorrectiveDate: '',
  siteId: '',
}

function buildDuplicateAssetMessage(form: AssetForm, rawMessage?: string) {
  if (rawMessage && rawMessage !== 'Record already exists') return rawMessage

  const duplicates = [
    form.assetNumber ? `Asset Number "${form.assetNumber}"` : null,
    form.serialNumber ? `Serial Number "${form.serialNumber}"` : null,
    form.qrUuid ? `QR UUID "${form.qrUuid}"` : null,
  ].filter(Boolean)

  if (duplicates.length === 0) {
    return 'An asset with the same data already exists.'
  }

  return `One of these values already exists: ${duplicates.join(', ')}.`
}

function NewAssetModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [sites, setSites] = useState<Site[]>([])
  const [form, setForm] = useState<AssetForm>({ ...EMPTY_FORM, qrUuid: generateUUID() })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api
      .get('/sites')
      .then(r => setSites(r.data.data))
      .catch(() => {})
  }, [])

  const selectedSiteName = sites.find(s => s.id === form.siteId)?.name ?? ''
  const structure = getSiteStructure(selectedSiteName)
  const buildings = form.siteId ? structure?.buildings ?? [] : []
  const floors = form.siteId && form.building ? structure?.floors[form.building] ?? [] : []
  const zones = form.siteId && form.floor ? getZones(structure, form.floor) : []

  const handleSiteChange = (siteId: string) => {
    setForm(f => ({
      ...f,
      siteId,
      building: '',
      floor: '',
      zone: '',
    }))
  }

  const handleBuildingChange = (building: string) => {
    setForm(f => ({
      ...f,
      building,
      floor: '',
      zone: '',
    }))
  }

  const handleFloorChange = (floor: string) => {
    setForm(f => ({
      ...f,
      floor,
      zone: '',
    }))
  }

  const set = (k: keyof AssetForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.siteId) {
      setError('Please select a site.')
      return
    }

    if (!form.building) {
      setError('Please select a building.')
      return
    }

    if (!form.floor) {
      setError('Please select a floor.')
      return
    }

    if (!form.zone) {
      setError('Please select a zone.')
      return
    }

    setSaving(true)
    try {
      // Upload photo directly to Cloudinary (bypasses Vercel 4.5 MB body limit)
      let photoUrl: string | undefined
      if (photo) {
        const signRes = await api.post('/upload/sign', {
          folder: 'loc/asset-photos',
          resource_type: 'image',
        })
        const { cloud_name, api_key, timestamp, signature, folder } = signRes.data.data

        const cloudForm = new FormData()
        cloudForm.append('file', photo)
        cloudForm.append('api_key', api_key)
        cloudForm.append('timestamp', String(timestamp))
        cloudForm.append('signature', signature)
        cloudForm.append('folder', folder)

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
          { method: 'POST', body: cloudForm }
        )
        const uploadData = await uploadRes.json()
        photoUrl = uploadData.secure_url
      }

      await api.post('/assets', {
        ...Object.fromEntries(Object.entries(form).filter(([, v]) => v)),
        ...(photoUrl ? { photoUrl } : {}),
      })

      onSuccess()
      onClose()
    } catch (err: any) {
      const apiMessage = err?.response?.data?.error ?? err?.response?.data?.message
      setError(buildDuplicateAssetMessage(form, apiMessage))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl border bg-card shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-6 py-4 sticky top-0 bg-card z-10">
          <h2 className="font-semibold text-base">New Asset</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <label className="text-sm font-medium">
                Asset Name <span className="text-destructive">*</span>
              </label>
              <Input value={form.name} onChange={set('name')} required placeholder="e.g. Chiller Unit #1" />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Type <span className="text-destructive">*</span>
              </label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map(t => (
                    <SelectItem key={t} value={t}>
                      {formatType(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Status</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPERATIONAL">Operational</SelectItem>
                  <SelectItem value="NEEDS_MAINTENANCE">Needs Maintenance</SelectItem>
                  <SelectItem value="OUT_OF_SERVICE">Out of Service</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Model <span className="text-destructive">*</span>
              </label>
              <Input value={form.model} onChange={set('model')} required placeholder="e.g. Trane RTAC 400" />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Serial Number <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.serialNumber}
                onChange={set('serialNumber')}
                required
                placeholder="e.g. SN-2022-001"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Asset Number <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.assetNumber}
                onChange={set('assetNumber')}
                required
                placeholder="e.g. AST-TW-001"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Site <span className="text-destructive">*</span>
              </label>
              <Select value={form.siteId} onValueChange={handleSiteChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Location
                </p>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Building</label>
                    <Select
                      value={form.building}
                      onValueChange={handleBuildingChange}
                      disabled={!form.siteId || buildings.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select building" />
                      </SelectTrigger>
                      <SelectContent>
                        {buildings.map(building => (
                          <SelectItem key={building} value={building}>
                            {building}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">Floor</label>
                    <Select
                      value={form.floor}
                      onValueChange={handleFloorChange}
                      disabled={!form.building || floors.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select floor" />
                      </SelectTrigger>
                      <SelectContent>
                        {floors.map(floor => (
                          <SelectItem key={floor} value={floor}>
                            {floor}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">Zone</label>
                    <Select
                      value={form.zone}
                      onValueChange={v => setForm(f => ({ ...f, zone: v }))}
                      disabled={!form.floor || zones.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select zone" />
                      </SelectTrigger>
                      <SelectContent>
                        {zones.map(zone => (
                          <SelectItem key={zone} value={zone}>
                            {zone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Last Preventive Date</label>
              <Input type="date" value={form.lastPreventiveDate} onChange={set('lastPreventiveDate')} />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Last Corrective Date</label>
              <Input type="date" value={form.lastCorrectiveDate} onChange={set('lastCorrectiveDate')} />
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-sm font-medium">Remarks</label>
              <Input value={form.remarks} onChange={set('remarks')} placeholder="Optional notes..." />
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-sm font-medium">Asset Photo</label>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => photoRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1" /> {photo ? 'Change Photo' : 'Upload Photo'}
                </Button>
                {photo && <span className="text-xs text-muted-foreground">{photo.name}</span>}
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => setPhoto(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-sm font-medium text-muted-foreground">QR UUID (auto-generated)</label>
              <div className="flex gap-2">
                <Input value={form.qrUuid} readOnly className="text-xs text-muted-foreground font-mono" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm(f => ({ ...f, qrUuid: generateUUID() }))}
                >
                  Regenerate
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Asset
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AssetsPage() {
  const navigate = useNavigate()
  const { selectedSiteId } = useSiteStore()

  const [assets, setAssets] = useState<Asset[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [showNewAsset, setShowNewAsset] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const fetchAssets = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 20 }

      if (selectedSiteId) params.siteId = selectedSiteId
      if (search) params.search = search
      if (typeFilter !== 'all') params.type = typeFilter
      if (statusFilter !== 'all') params.status = statusFilter

      const res = await api.get('/assets', { params })
      setAssets(res.data.data)
      setPagination(res.data.pagination)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedSiteId, search, typeFilter, statusFilter, page])

  useEffect(() => {
    setPage(1)
  }, [selectedSiteId, search, typeFilter, statusFilter])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  return (
    <div>
      {showNewAsset && <NewAssetModal onClose={() => setShowNewAsset(false)} onSuccess={fetchAssets} />}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onSuccess={fetchAssets} siteId={selectedSiteId} />
      )}

      <PageHeader
        title="Asset Registry"
        description={pagination ? `${pagination.total} assets registered` : 'Browse all assets'}
        breadcrumbs={[{ label: 'Assets' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
              <Upload className="h-4 w-4 mr-1" /> Import
            </Button>
            <Button size="sm" onClick={() => setShowNewAsset(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Asset
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-3">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-64">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, serial, or asset number…"
                className="pl-9"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" size="icon">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </form>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Asset type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {ASSET_TYPES.map(t => (
                <SelectItem key={t} value={t}>
                  {formatType(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="OPERATIONAL">Operational</SelectItem>
              <SelectItem value="NEEDS_MAINTENANCE">Needs Maintenance</SelectItem>
              <SelectItem value="OUT_OF_SERVICE">Out of Service</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          {loading ? (
            <PageLoader />
          ) : assets.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No assets found</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Asset</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Last PM</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Site</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {assets.map(asset => (
                  <tr
                    key={asset.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => navigate(`/assets/${asset.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{asset.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {asset.assetNumber} · {asset.serialNumber}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatType(asset.type)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {[asset.building, asset.floor, asset.zone].filter(Boolean).join(' · ')}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={asset.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {asset.lastPreventiveDate
                        ? formatDistanceToNow(new Date(asset.lastPreventiveDate), { addSuffix: true })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{asset.site.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </span>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <span>
                Page {page} of {pagination.pages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={page === pagination.pages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
