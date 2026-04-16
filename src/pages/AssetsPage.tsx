import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, Plus, Upload, X, Loader2, AlertCircle, Download } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/spinner'
import { useSiteStore } from '@/store'
import { Asset, Pagination, Site } from '@/types'
import api from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

const ASSET_TYPES = [
  'CHILLER', 'AHU', 'ELEVATOR', 'ELECTRICAL_PANEL', 'GENERATOR',
  'FIRE_PUMP', 'FCU', 'UPS', 'PRECISION_COOLING', 'COOLING_TOWER',
  'AUTO_TRANSFER_SWITCH', 'FIRE_SUPPRESSION', 'POWER_DISTRIBUTION', 'OTHER',
]
const formatType = (t: string) => t.replace(/_/g, ' ')

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

interface AssetForm {
  qrUuid: string; type: string; name: string; model: string
  serialNumber: string; assetNumber: string; building: string
  floor: string; zone: string; status: string; remarks: string
  lastPreventiveDate: string; lastCorrectiveDate: string; siteId: string
}

const EMPTY_FORM: AssetForm = {
  qrUuid: '', type: 'CHILLER', name: '', model: '', serialNumber: '',
  assetNumber: '', building: '', floor: '', zone: '', status: 'OPERATIONAL',
  remarks: '', lastPreventiveDate: '', lastCorrectiveDate: '', siteId: '',
}

// ── Import Modal ──────────────────────────────────────────────────────────────
function ImportModal({ onClose, onSuccess, siteId }: {
  onClose: () => void
  onSuccess: () => void
  siteId: string | null
}) {
  const [sites, setSites] = useState<Site[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ created: number; failed: number; errors: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get('/sites').then(r => setSites(r.data.data)).catch(() => {})
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

  // Download template as CSV
  const downloadTemplate = () => {
    const headers = [
      'name', 'type', 'model', 'serialNumber', 'assetNumber',
      'building', 'floor', 'zone', 'status', 'remarks',
      'lastPreventiveDate', 'lastCorrectiveDate', 'siteId',
    ]
    const exampleRow = [
      'Chiller Unit 1', 'CHILLER', 'Trane RTAC 400', 'SN-001', 'AST-001',
      'Tower A', 'Floor 3', 'Zone B', 'OPERATIONAL', '',
      '2024-01-15', '', siteId || (sites[0]?.id ?? ''),
    ]
    const typeNote = `# Valid types: ${ASSET_TYPES.join(' | ')}`
    const statusNote = '# Valid statuses: OPERATIONAL | NEEDS_MAINTENANCE | OUT_OF_SERVICE'
    const csv = [typeNote, statusNote, headers.join(','), exampleRow.join(',')].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'assets-import-template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async () => {
    if (!file) return
    setImporting(true)
    setError(null)
    setResult(null)
    try {
      // Parse CSV client-side and POST each row
      const text = await file.text()
      const lines = text.split('\n').filter(l => l && !l.startsWith('#'))
      const [headerLine, ...rows] = lines
      const headers = headerLine.split(',').map(h => h.trim())

      let created = 0; let failed = 0; const errors: string[] = []

      for (let i = 0; i < rows.length; i++) {
        const vals = rows[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const row: Record<string, string> = {}
        headers.forEach((h, idx) => { row[h] = vals[idx] ?? '' })

        if (!row.name || !row.type || !row.siteId) {
          errors.push(`Row ${i + 2}: missing name, type, or siteId`)
          failed++; continue
        }

        try {
          await api.post('/assets', {
            qrUuid: generateUUID(),
            name: row.name, type: row.type, model: row.model || 'N/A',
            serialNumber: row.serialNumber || `SN-${Date.now()}-${i}`,
            assetNumber: row.assetNumber || `AST-${Date.now()}-${i}`,
            building: row.building || undefined, floor: row.floor || undefined,
            zone: row.zone || undefined, status: row.status || 'OPERATIONAL',
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
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-base">Bulk Import Assets</h2>
              <p className="text-xs text-muted-foreground">Upload a filled CSV template to create assets at once.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Download Template */}
        <button
          onClick={downloadTemplate}
          className="mb-4 w-full flex items-center gap-3 rounded-lg border border-dashed p-3 hover:bg-muted/40 transition-colors text-left"
        >
          <Download className="h-5 w-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">Download Template</p>
            <p className="text-xs text-muted-foreground">Pre-configured .csv with headers and example row</p>
          </div>
        </button>

        {/* Drop zone */}
        {!result && (
          <div
            className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            {file ? (
              <p className="text-sm font-medium text-primary">{file.name}</p>
            ) : (
              <>
                <p className="text-sm"><span className="text-primary font-medium">Browse</span> or drag and drop</p>
                <p className="text-xs text-muted-foreground mt-1">CSV or Excel — max 5 MB, 100 rows</p>
              </>
            )}
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Result */}
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
                  <p key={i} className="text-xs text-destructive">{e}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
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

// ── New Asset Modal ───────────────────────────────────────────────────────────
function NewAssetModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [sites, setSites] = useState<Site[]>([])
  const [form, setForm] = useState<AssetForm>({ ...EMPTY_FORM, qrUuid: generateUUID() })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get('/sites').then(r => {
      setSites(r.data.data)
      if (r.data.data.length > 0) setForm(f => ({ ...f, siteId: r.data.data[0].id }))
    }).catch(() => {})
  }, [])

  const set = (k: keyof AssetForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.siteId) { setError('Please select a site.'); return }

    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v) })
      if (photo) fd.append('photo', photo)
      await api.post('/assets', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.response?.data?.message ?? 'Failed to create asset.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl border bg-card shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
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
            {/* Asset Name */}
            <div className="col-span-2 space-y-1">
              <label className="text-sm font-medium">Asset Name <span className="text-destructive">*</span></label>
              <Input value={form.name} onChange={set('name')} required placeholder="e.g. Chiller Unit #1" />
            </div>

            {/* Type */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Type <span className="text-destructive">*</span></label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map(t => <SelectItem key={t} value={t}>{formatType(t)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Status</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPERATIONAL">Operational</SelectItem>
                  <SelectItem value="NEEDS_MAINTENANCE">Needs Maintenance</SelectItem>
                  <SelectItem value="OUT_OF_SERVICE">Out of Service</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Model */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Model <span className="text-destructive">*</span></label>
              <Input value={form.model} onChange={set('model')} required placeholder="e.g. Trane RTAC 400" />
            </div>

            {/* Serial Number */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Serial Number <span className="text-destructive">*</span></label>
              <Input value={form.serialNumber} onChange={set('serialNumber')} required placeholder="e.g. SN-2022-001" />
            </div>

            {/* Asset Number */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Asset Number <span className="text-destructive">*</span></label>
              <Input value={form.assetNumber} onChange={set('assetNumber')} required placeholder="e.g. AST-TW-001" />
            </div>

            {/* Site */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Site <span className="text-destructive">*</span></label>
              <Select value={form.siteId} onValueChange={v => setForm(f => ({ ...f, siteId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                <SelectContent>
                  {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Building */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Building</label>
              <Input value={form.building} onChange={set('building')} placeholder="e.g. Tower A" />
            </div>

            {/* Floor */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Floor</label>
              <Input value={form.floor} onChange={set('floor')} placeholder="e.g. Floor 3" />
            </div>

            {/* Zone */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Zone</label>
              <Input value={form.zone} onChange={set('zone')} placeholder="e.g. Server Room A" />
            </div>

            {/* Last PM */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Last Preventive Date</label>
              <Input type="date" value={form.lastPreventiveDate} onChange={set('lastPreventiveDate')} />
            </div>

            {/* Last CM */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Last Corrective Date</label>
              <Input type="date" value={form.lastCorrectiveDate} onChange={set('lastCorrectiveDate')} />
            </div>

            {/* Remarks */}
            <div className="col-span-2 space-y-1">
              <label className="text-sm font-medium">Remarks</label>
              <Input value={form.remarks} onChange={set('remarks')} placeholder="Optional notes..." />
            </div>

            {/* Photo */}
            <div className="col-span-2 space-y-1">
              <label className="text-sm font-medium">Asset Photo</label>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => photoRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1" /> {photo ? 'Change Photo' : 'Upload Photo'}
                </Button>
                {photo && <span className="text-xs text-muted-foreground">{photo.name}</span>}
                <input ref={photoRef} type="file" accept="image/*" className="hidden"
                  onChange={e => setPhoto(e.target.files?.[0] ?? null)} />
              </div>
            </div>

            {/* QR UUID (readonly) */}
            <div className="col-span-2 space-y-1">
              <label className="text-sm font-medium text-muted-foreground">QR UUID (auto-generated)</label>
              <div className="flex gap-2">
                <Input value={form.qrUuid} readOnly className="text-xs text-muted-foreground font-mono" />
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setForm(f => ({ ...f, qrUuid: generateUUID() }))}>
                  Regenerate
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
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

// ═══════════════════════════════════════════════════════════════════════════════

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

  useEffect(() => { setPage(1) }, [selectedSiteId, search, typeFilter, statusFilter])
  useEffect(() => { fetchAssets() }, [fetchAssets])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setSearch(searchInput) }

  return (
    <div>
      {showNewAsset && (
        <NewAssetModal onClose={() => setShowNewAsset(false)} onSuccess={fetchAssets} />
      )}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onSuccess={fetchAssets}
          siteId={selectedSiteId}
        />
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
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-64">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, serial, or asset number…"
                className="pl-9"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" size="icon">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </form>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Asset type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {ASSET_TYPES.map((t) => <SelectItem key={t} value={t}>{formatType(t)}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="OPERATIONAL">Operational</SelectItem>
              <SelectItem value="NEEDS_MAINTENANCE">Needs Maintenance</SelectItem>
              <SelectItem value="OUT_OF_SERVICE">Out of Service</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card overflow-hidden">
          {loading ? <PageLoader /> : assets.length === 0 ? (
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
                {assets.map((asset) => (
                  <tr key={asset.id} className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => navigate(`/assets/${asset.id}`)}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{asset.name}</p>
                      <p className="text-xs text-muted-foreground">{asset.assetNumber} · {asset.serialNumber}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatType(asset.type)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[asset.building, asset.floor, asset.zone].filter(Boolean).join(' · ')}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={asset.status} /></td>
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

        {/* Pagination */}
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
              <span>Page {page} of {pagination.pages}</span>
              <Button variant="outline" size="sm" disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

