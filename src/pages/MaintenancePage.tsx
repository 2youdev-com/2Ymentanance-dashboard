import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { SeverityBadge } from '@/components/ui/status-badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/spinner'
import { useSiteStore } from '@/store'
import { MaintenanceLog, Pagination } from '@/types'
import api from '@/lib/api'
import { format } from 'date-fns'

export default function MaintenancePage() {
  const navigate = useNavigate()
  const { selectedSiteId } = useSiteStore()
  const [logs, setLogs] = useState<MaintenanceLog[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (selectedSiteId) params.siteId = selectedSiteId
      if (typeFilter !== 'all') params.type = typeFilter
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo

      const res = await api.get('/maintenance', { params })
      setLogs(res.data.data)
      setPagination(res.data.pagination)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedSiteId, typeFilter, dateFrom, dateTo, page])

  useEffect(() => { setPage(1) }, [selectedSiteId, typeFilter, dateFrom, dateTo])
  useEffect(() => { fetchLogs() }, [fetchLogs])

  return (
    <div>
      <PageHeader
        title="Maintenance Log"
        description={pagination ? `${pagination.total} records` : 'All maintenance activities'}
        breadcrumbs={[{ label: 'Maintenance Log' }]}
      />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
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

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">From</span>
            <Input type="date" className="w-36 h-10" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <span className="text-sm text-muted-foreground">To</span>
            <Input type="date" className="w-36 h-10" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo('') }}>Clear</Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card overflow-hidden">
          {loading ? <PageLoader /> : logs.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No maintenance records found</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Asset</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Technician</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
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
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {format(new Date(log.startedAt), 'dd MMM yyyy, HH:mm')}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={log.status === 'COMPLETED' ? 'success' : 'warning'}>
                        {log.status === 'COMPLETED' ? 'Completed' : 'In Progress'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {log.problemReport ? (
                        <SeverityBadge severity={log.problemReport.severity} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
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
