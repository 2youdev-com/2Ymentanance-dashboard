import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/spinner'
import { useSiteStore } from '@/store'
import { Asset, Pagination } from '@/types'
import api from '@/lib/api'
import { formatDistanceToNow, addDays, isPast, isWithinInterval } from 'date-fns'

type ScheduleStatus = 'overdue' | 'due-soon' | 'ok'

function getScheduleStatus(lastDate?: string): ScheduleStatus {
  if (!lastDate) return 'overdue'
  const next = addDays(new Date(lastDate), 30)
  if (isPast(next)) return 'overdue'
  if (isWithinInterval(next, { start: new Date(), end: addDays(new Date(), 7) })) return 'due-soon'
  return 'ok'
}

export default function SchedulesPage() {
  const navigate = useNavigate()
  const { selectedSiteId } = useSiteStore()
  const [assets, setAssets] = useState<Asset[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [scheduleFilter, setScheduleFilter] = useState('all')
  const [page, setPage] = useState(1)

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

  useEffect(() => { setPage(1) }, [selectedSiteId, scheduleFilter])
  useEffect(() => { fetchAssets() }, [fetchAssets])

  const filtered = scheduleFilter === 'all'
    ? assets
    : assets.filter((a) => getScheduleStatus(a.lastPreventiveDate) === scheduleFilter)

  const overdue = assets.filter((a) => getScheduleStatus(a.lastPreventiveDate) === 'overdue').length
  const dueSoon = assets.filter((a) => getScheduleStatus(a.lastPreventiveDate) === 'due-soon').length
  const onTrack = assets.filter((a) => getScheduleStatus(a.lastPreventiveDate) === 'ok').length

  return (
    <div>
      <PageHeader
        title="Schedules"
        description="Preventive maintenance schedule tracker"
        breadcrumbs={[{ label: 'Schedules' }]}
      />

      <div className="p-6 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Overdue', value: overdue, color: 'text-red-600', bg: 'bg-red-50', icon: AlertCircle },
            { label: 'Due This Week', value: dueSoon, color: 'text-yellow-600', bg: 'bg-yellow-50', icon: Clock },
            { label: 'On Track', value: onTrack, color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2 },
          ].map(({ label, value, color, bg, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
                  </div>
                  <div className={`rounded-xl p-2.5 ${bg}`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter */}
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

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? <PageLoader /> : filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">No assets found</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {['Asset', 'Type', 'Location', 'Last PM', 'Next Due', 'Schedule Status'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((asset) => {
                    const status = getScheduleStatus(asset.lastPreventiveDate)
                    const nextDue = asset.lastPreventiveDate ? addDays(new Date(asset.lastPreventiveDate), 30) : null
                    return (
                      <tr
                        key={asset.id}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => navigate(`/assets/${asset.id}`)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium">{asset.name}</p>
                          <p className="text-xs text-muted-foreground">{asset.assetNumber}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{asset.type.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {[asset.building, asset.floor].filter(Boolean).join(' · ') || asset.site.name}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {asset.lastPreventiveDate
                            ? formatDistanceToNow(new Date(asset.lastPreventiveDate), { addSuffix: true })
                            : 'Never'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {nextDue
                            ? formatDistanceToNow(nextDue, { addSuffix: true })
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {status === 'overdue' && <Badge variant="danger">Overdue</Badge>}
                          {status === 'due-soon' && <Badge variant="warning">Due Soon</Badge>}
                          {status === 'ok' && <Badge variant="success">On Track</Badge>}
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
