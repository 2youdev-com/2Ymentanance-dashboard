import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Plus,
  X,
  Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/spinner'
import { useSiteStore } from '@/store'
import { Asset, Pagination, Site } from '@/types'
import api from '@/lib/api'
import {
  formatDistanceToNow,
  addDays,
  isPast,
  isWithinInterval,
  format,
} from 'date-fns'

type ScheduleStatus = 'overdue' | 'due-soon' | 'ok'

function getScheduleStatus(lastDate?: string): ScheduleStatus {
  if (!lastDate) return 'overdue'
  const next = addDays(new Date(lastDate), 30)
  if (isPast(next)) return 'overdue'
  if (
    isWithinInterval(next, {
      start: new Date(),
      end: addDays(new Date(), 7),
    })
  ) {
    return 'due-soon'
  }
  return 'ok'
}

function AddScheduleModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [nextPmDate, setNextPmDate] = useState(
    format(addDays(new Date(), 30), 'yyyy-MM-dd')
  )
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get('/sites')
      .then((r) => setSites(r.data.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedSiteId) {
      setAssets([])
      return
    }

    api
      .get('/assets', { params: { siteId: selectedSiteId, limit: 200 } })
      .then((r) => setAssets(r.data.data ?? []))
      .catch(() => {})
  }, [selectedSiteId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedAssetId) {
      setError('Please select an asset.')
      return
    }

    setSaving(true)
    try {
      await api.patch(`/assets/${selectedAssetId}`, {
        lastPreventiveDate: nextPmDate,
        ...(notes && { remarks: notes }),
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to set schedule.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Add PM Schedule</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Site <span className="text-destructive">*</span>
            </label>
            <Select
              value={selectedSiteId}
              onValueChange={(v) => {
                setSelectedSiteId(v)
                setSelectedAssetId('')
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select site first" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">
              Asset <span className="text-destructive">*</span>
            </label>
            <Select
              value={selectedAssetId}
              onValueChange={setSelectedAssetId}
              disabled={!selectedSiteId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={selectedSiteId ? 'Select asset' : 'Select site first'}
                />
              </SelectTrigger>
              <SelectContent>
                {assets.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} — {a.assetNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">
              Schedule PM Date <span className="text-destructive">*</span>
            </label>
            <Input
              type="date"
              value={nextPmDate}
              onChange={(e) => setNextPmDate(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Next PM will be calculated 30 days from this date
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Annual inspection, replace filters..."
            />
          </div>

          <div className="flex justify-end gap-2 border-t pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Schedule
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SchedulesPage() {
  const navigate = useNavigate()
  const { selectedSiteId } = useSiteStore()

  const [assets, setAssets] = useState<Asset[]>([])
  const [allAssets, setAllAssets] = useState<Asset[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [scheduleFilter, setScheduleFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)

  const fetchAssets = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (selectedSiteId) params.siteId = selectedSiteId

      const res = await api.get('/assets', { params })
      setAssets(res.data.data ?? [])
      setPagination(res.data.pagination)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedSiteId, page])

  const fetchAllAssetsForStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const collected: Asset[] = []
      let currentPage = 1
      let totalPages = 1

      do {
        const params: Record<string, string | number> = {
          page: currentPage,
          limit: 200,
        }
        if (selectedSiteId) params.siteId = selectedSiteId

        const res = await api.get('/assets', { params })
        const pageData = res.data.data ?? []
        const pagePagination = res.data.pagination

        collected.push(...pageData)

        totalPages = pagePagination?.pages ?? 1
        currentPage += 1
      } while (currentPage <= totalPages)

      setAllAssets(collected)
    } catch (err) {
      console.error(err)
      setAllAssets([])
    } finally {
      setStatsLoading(false)
    }
  }, [selectedSiteId])

  useEffect(() => {
    setPage(1)
  }, [selectedSiteId, scheduleFilter])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  useEffect(() => {
    fetchAllAssetsForStats()
  }, [fetchAllAssetsForStats])

  const filtered =
    scheduleFilter === 'all'
      ? assets
      : assets.filter(
          (a) => getScheduleStatus(a.lastPreventiveDate) === scheduleFilter
        )

  const overdue = allAssets.filter(
    (a) => getScheduleStatus(a.lastPreventiveDate) === 'overdue'
  ).length

  const dueSoon = allAssets.filter(
    (a) => getScheduleStatus(a.lastPreventiveDate) === 'due-soon'
  ).length

  const onTrack = allAssets.filter(
    (a) => getScheduleStatus(a.lastPreventiveDate) === 'ok'
  ).length

  return (
    <div>
      {showAddModal && (
        <AddScheduleModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            fetchAssets()
            fetchAllAssetsForStats()
          }}
        />
      )}

      <PageHeader
        title="Schedules"
        description="Preventive maintenance schedule tracker"
        breadcrumbs={[{ label: 'Schedules' }]}
        actions={
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add Schedule
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: 'Overdue',
              value: overdue,
              color: 'text-red-600',
              bg: 'bg-red-50',
              icon: AlertCircle,
            },
            {
              label: 'Due This Week',
              value: dueSoon,
              color: 'text-yellow-600',
              bg: 'bg-yellow-50',
              icon: Clock,
            },
            {
              label: 'On Track',
              value: onTrack,
              color: 'text-green-600',
              bg: 'bg-green-50',
              icon: CheckCircle2,
            },
          ].map(({ label, value, color, bg, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className={`mt-1 text-2xl font-bold ${color}`}>
                      {statsLoading ? '...' : value}
                    </p>
                  </div>
                  <div className={`rounded-xl p-2.5 ${bg}`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-3">
          <Select value={scheduleFilter} onValueChange={setScheduleFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Schedule status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assets</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="due-soon">Due This Week</SelectItem>
              <SelectItem value="ok">On Track</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <PageLoader />
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No assets found
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {[
                      'Asset',
                      'Type',
                      'Location',
                      'Last PM',
                      'Next Due',
                      'Schedule Status',
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left font-medium text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((asset) => {
                    const status = getScheduleStatus(asset.lastPreventiveDate)
                    const nextDue = asset.lastPreventiveDate
                      ? addDays(new Date(asset.lastPreventiveDate), 30)
                      : null

                    return (
                      <tr
                        key={asset.id}
                        className="cursor-pointer transition-colors hover:bg-muted/30"
                        onClick={() => navigate(`/assets/${asset.id}`)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium">{asset.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {asset.assetNumber}
                          </p>
                        </td>

                        <td className="px-4 py-3 text-muted-foreground">
                          {asset.type.replace(/_/g, ' ')}
                        </td>

                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {[asset.building, asset.floor].filter(Boolean).join(' · ') ||
                            asset.site.name}
                        </td>

                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {asset.lastPreventiveDate
                            ? formatDistanceToNow(new Date(asset.lastPreventiveDate), {
                                addSuffix: true,
                              })
                            : 'Never'}
                        </td>

                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {nextDue
                            ? formatDistanceToNow(nextDue, { addSuffix: true })
                            : '—'}
                        </td>

                        <td className="px-4 py-3">
                          {status === 'overdue' && (
                            <Badge variant="danger">Overdue</Badge>
                          )}
                          {status === 'due-soon' && (
                            <Badge variant="warning">Due Soon</Badge>
                          )}
                          {status === 'ok' && (
                            <Badge variant="success">On Track</Badge>
                          )}
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
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total}
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <span>
                Page {page} of {pagination.pages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={page === pagination.pages}
                onClick={() => setPage((p) => p + 1)}
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