import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, ChevronLeft, ChevronRight, Plus, X, Loader2, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { SeverityBadge } from '@/components/ui/status-badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/spinner'
import { useSiteStore, useAuthStore } from '@/store'
import { MaintenanceLog, Pagination, Asset } from '@/types'
import api from '@/lib/api'
import { format, formatDistanceToNow } from 'date-fns'

type TechnicianOption = {
  id: string
  fullName: string
  role: 'TECHNICIAN' | 'ADMIN' | 'VIEWER'
}

// ── New Work Order Modal ──────────────────────────────────────────────────────
function NewWorkOrderModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { selectedSiteId } = useSiteStore()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'

  const [assets, setAssets] = useState<Asset[]>([])
  const [assetSearch, setAssetSearch] = useState('')
  const [assetPage, setAssetPage] = useState(1)
  const [assetTotal, setAssetTotal] = useState(0)
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([])
  const [loadingTechnicians, setLoadingTechnicians] = useState(false)

  const [assetId, setAssetId] = useState('')
  const [type, setType] = useState<'PREVENTIVE' | 'CORRECTIVE'>('PREVENTIVE')
  const [technicianId, setTechnicianId] = useState(user?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const selectedAsset = assets.find(a => a.id === assetId)
  const selectedTechnician =
    technicians.find(technician => technician.id === technicianId) ??
    (user ? { id: user.id, fullName: user.fullName, role: user.role } : undefined)

  const fetchAssets = useCallback(async (search: string, page: number) => {
    setLoadingAssets(true)
    try {
      const params: Record<string, string | number> = { page, limit: 10 }
      if (selectedSiteId) params.siteId = selectedSiteId
      if (search) params.search = search
      const res = await api.get('/assets', { params })
      setAssets(res.data.data ?? [])
      setAssetTotal(res.data.pagination?.total ?? 0)
    } catch { setAssets([]) }
    finally { setLoadingAssets(false) }
  }, [selectedSiteId])

  useEffect(() => { fetchAssets(assetSearch, assetPage) }, [fetchAssets, assetSearch, assetPage])

  useEffect(() => {
    setTechnicianId(user?.id ?? '')
  }, [user?.id])

  useEffect(() => {
    if (!isAdmin) return

    const fetchTechnicians = async () => {
      setLoadingTechnicians(true)
      try {
        const res = await api.get('/users')
        const nextTechnicians = (res.data.data ?? [])
          .filter((candidate: any) => {
            const matchesSite =
              !selectedSiteId ||
              (candidate.sites ?? []).some((siteEntry: any) => {
                const site = siteEntry.site ?? siteEntry
                return site?.id === selectedSiteId
              })

            return matchesSite && (candidate.role === 'TECHNICIAN' || candidate.role === 'ADMIN')
          })
          .map((candidate: any) => ({
            id: candidate.id,
            fullName: candidate.fullName,
            role: candidate.role,
          }))

        setTechnicians(nextTechnicians)
      } catch {
        setTechnicians([])
      } finally {
        setLoadingTechnicians(false)
      }
    }

    fetchTechnicians()
  }, [isAdmin, selectedSiteId])

  useEffect(() => {
    if (!isAdmin) return
    if (technicians.length === 0) {
      setTechnicianId('')
      return
    }

    if (!technicians.some(technician => technician.id === technicianId)) {
      setTechnicianId(technicians[0].id)
    }
  }, [isAdmin, technicianId, technicians])

  const handleSearchChange = (v: string) => {
    setAssetSearch(v); setAssetPage(1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!assetId) { setError('Please select an asset.'); return }
    if (!technicianId) { setError('Please select a technician.'); return }
    setSaving(true)
    try {
      await api.post('/maintenance', { assetId, type, technicianId })
      setSuccess(true)
      onSuccess()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to create work order.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border bg-card shadow-xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-base">Add Work Order</h2>
              <p className="text-xs text-muted-foreground">Create a maintenance job and assign it to a technician</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mx-auto">
              <ClipboardList className="h-7 w-7 text-green-600" />
            </div>
            <p className="font-semibold text-lg">Work Order Created!</p>
            <p className="text-sm text-muted-foreground">
              {type === 'PREVENTIVE' ? 'Preventive' : 'Corrective'} maintenance created for <strong>{selectedAsset?.name}</strong>
              {selectedTechnician ? <> and assigned to <strong>{selectedTechnician.fullName}</strong></> : null}.
            </p>
            <Button onClick={onClose} className="mt-2">Close</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
              </div>
            )}

            {/* Maintenance type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Maintenance Type <span className="text-destructive">*</span></label>
              <div className="grid grid-cols-2 gap-3">
                {(['PREVENTIVE', 'CORRECTIVE'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`rounded-lg border-2 p-4 text-left transition-all ${
                      type === t
                        ? t === 'PREVENTIVE'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                          : 'border-orange-500 bg-orange-50 dark:bg-orange-950/30'
                        : 'border-border hover:border-muted-foreground/40'
                    }`}
                  >
                    <p className={`font-semibold text-sm ${
                      type === t
                        ? t === 'PREVENTIVE' ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'
                        : 'text-foreground'
                    }`}>
                      {t === 'PREVENTIVE' ? 'Preventive' : 'Corrective'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t === 'PREVENTIVE' ? 'Scheduled inspection & maintenance' : 'Unplanned repair or fix'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Asset search & selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Asset <span className="text-destructive">*</span></label>

              <Input
                placeholder="Search assets by name or number…"
                value={assetSearch}
                onChange={e => handleSearchChange(e.target.value)}
              />

              {/* Selected asset display */}
              {assetId && selectedAsset && (
                <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{selectedAsset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedAsset.type.replace(/_/g, ' ')} · {selectedAsset.assetNumber}
                      {selectedAsset.floor ? ` · ${selectedAsset.floor}` : ''}
                    </p>
                  </div>
                  <button type="button" onClick={() => setAssetId('')} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Asset list */}
              {!assetId && (
                <div className="rounded-lg border max-h-52 overflow-y-auto">
                  {loadingAssets ? (
                    <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading assets…
                    </div>
                  ) : assets.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">No assets found</div>
                  ) : (
                    <>
                      {assets.map(asset => (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => setAssetId(asset.id)}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors text-left border-b last:border-b-0"
                        >
                          <div>
                            <p className="text-sm font-medium">{asset.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {asset.type.replace(/_/g, ' ')} · {asset.assetNumber}
                              {asset.floor ? ` · ${asset.floor}` : ''}
                              {asset.site?.name ? ` · ${asset.site.name}` : ''}
                            </p>
                          </div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            asset.status === 'OPERATIONAL' ? 'bg-green-100 text-green-700' :
                            asset.status === 'NEEDS_MAINTENANCE' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {asset.status === 'OPERATIONAL' ? 'OK' :
                             asset.status === 'NEEDS_MAINTENANCE' ? 'Needs PM' : 'OOS'}
                          </span>
                        </button>
                      ))}
                      {/* Pagination */}
                      {assetTotal > 10 && (
                        <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
                          <span>{assetTotal} assets total</span>
                          <div className="flex items-center gap-2">
                            <button type="button" disabled={assetPage === 1}
                              onClick={() => setAssetPage(p => p - 1)}
                              className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-muted transition-colors">‹</button>
                            <span className="px-2 py-1 min-w-24 text-center">Page {assetPage} of {Math.ceil(assetTotal / 10)}</span>
                            <button type="button" disabled={assetPage * 10 >= assetTotal}
                              onClick={() => setAssetPage(p => p + 1)}
                              className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-muted transition-colors">›</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Technician info */}
            {isAdmin ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Assigned Technician <span className="text-destructive">*</span></label>
                <Select value={technicianId} onValueChange={setTechnicianId}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingTechnicians ? 'Loading technicians...' : 'Select technician'} />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map(technician => (
                      <SelectItem key={technician.id} value={technician.id}>
                        {technician.fullName} ({technician.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!loadingTechnicians && technicians.length === 0 && (
                  <p className="text-xs text-destructive">No technicians are available for the selected site.</p>
                )}
              </div>
            ) : (
            <div className="rounded-lg bg-muted/30 px-4 py-3 text-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Assigned Technician</p>
                <p className="font-medium">{user?.fullName ?? '—'}</p>
              </div>
              <Badge variant="secondary" className="text-xs">{user?.role}</Badge>
            </div>
            )}

            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving || !assetId || !technicianId}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Work Order
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════

export default function WorkOrdersPage() {
  const navigate = useNavigate()
  const { selectedSiteId } = useSiteStore()
  const [logs, setLogs] = useState<MaintenanceLog[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [showNewOrder, setShowNewOrder] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (selectedSiteId) params.siteId = selectedSiteId
      if (typeFilter !== 'all') params.type = typeFilter
      const res = await api.get('/maintenance', { params })
      let data: MaintenanceLog[] = res.data.data ?? []
      if (statusFilter !== 'all') data = data.filter((l) => l.status === statusFilter)
      setLogs(data)
      setPagination(res.data.pagination)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [selectedSiteId, typeFilter, statusFilter, page])

  useEffect(() => { setPage(1) }, [selectedSiteId, typeFilter, statusFilter])
  useEffect(() => { fetchLogs() }, [fetchLogs])

  const inProgress = logs.filter((l) => l.status !== 'COMPLETED').length
  const completed = logs.filter((l) => l.status === 'COMPLETED').length

  return (
    <div>
      {showNewOrder && (
        <NewWorkOrderModal
          onClose={() => setShowNewOrder(false)}
          onSuccess={() => { fetchLogs() }}
        />
      )}

      <PageHeader
        title="Work Orders"
        description={pagination ? `${pagination.total} total work orders` : 'All maintenance work orders'}
        breadcrumbs={[{ label: 'Work Orders' }]}
        actions={
          <Button size="sm" onClick={() => setShowNewOrder(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Work Order
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total', value: pagination?.total ?? 0, color: 'text-foreground' },
            { label: 'In Progress', value: inProgress, color: 'text-yellow-600' },
            { label: 'Completed', value: completed, color: 'text-green-600' },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="PREVENTIVE">Preventive</SelectItem>
              <SelectItem value="CORRECTIVE">Corrective</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? <PageLoader /> : logs.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">No work orders found</p>
                <Button variant="outline" size="sm" onClick={() => setShowNewOrder(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add First Work Order
                </Button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {['Asset', 'Type', 'Technician', 'Started', 'Duration', 'Status', 'Priority'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => {
                    const duration = log.completedAt
                      ? Math.round((new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 60000)
                      : null
                    return (
                      <tr key={log.id} className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => navigate(`/assets/${log.asset.id}`)}>
                        <td className="px-4 py-3">
                          <p className="font-medium">{log.asset.name}</p>
                          <p className="text-xs text-muted-foreground">{log.asset.type.replace(/_/g, ' ')} · {log.asset.site.name}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={log.type === 'PREVENTIVE' ? 'secondary' : 'warning'}>
                            {log.type === 'PREVENTIVE' ? 'Preventive' : 'Corrective'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{log.technician.fullName}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {format(new Date(log.startedAt), 'dd MMM yyyy, HH:mm')}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {duration != null ? `${duration} min` : formatDistanceToNow(new Date(log.startedAt), { addSuffix: false }) + ' ago'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={log.status === 'COMPLETED' ? 'success' : 'warning'}>
                            {log.status === 'COMPLETED' ? 'Completed' : 'In Progress'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {log.problemReport
                            ? <SeverityBadge severity={log.problemReport.severity} />
                            : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

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
              <span className="min-w-24 text-center">Page {page} of {pagination.pages}</span>
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
