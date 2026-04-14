import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SeverityBadge } from '@/components/ui/status-badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/spinner'
import { useSiteStore } from '@/store'
import { MaintenanceLog, Pagination } from '@/types'
import api from '@/lib/api'
import { format, formatDistanceToNow } from 'date-fns'

export default function WorkOrdersPage() {
  const navigate = useNavigate()
  const { selectedSiteId } = useSiteStore()
  const [logs, setLogs] = useState<MaintenanceLog[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (selectedSiteId) params.siteId = selectedSiteId
      if (typeFilter !== 'all') params.type = typeFilter
      const res = await api.get('/maintenance', { params })
      let data: MaintenanceLog[] = res.data.data ?? []
      if (statusFilter !== 'all')
        data = data.filter((l) => l.status === statusFilter)
      setLogs(data)
      setPagination(res.data.pagination)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedSiteId, typeFilter, statusFilter, page])

  useEffect(() => { setPage(1) }, [selectedSiteId, typeFilter, statusFilter])
  useEffect(() => { fetchLogs() }, [fetchLogs])

  const inProgress = logs.filter((l) => l.status !== 'COMPLETED').length
  const completed = logs.filter((l) => l.status === 'COMPLETED').length

  return (
    <div>
      <PageHeader
        title="Work Orders"
        description={pagination ? `${pagination.total} total work orders` : 'All maintenance work orders'}
        breadcrumbs={[{ label: 'Work Orders' }]}
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
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="PREVENTIVE">Preventive</SelectItem>
              <SelectItem value="CORRECTIVE">Corrective</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
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
              <div className="py-16 text-center text-sm text-muted-foreground">No work orders found</div>
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
                      <tr
                        key={log.id}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => navigate(`/assets/${log.asset.id}`)}
                      >
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
