import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SeverityBadge } from '@/components/ui/status-badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/spinner'
import { useSiteStore } from '@/store'
import { ProblemReport, Pagination } from '@/types'
import api from '@/lib/api'
import { format } from 'date-fns'

export default function ReportsPage() {
  const navigate = useNavigate()
  const { selectedSiteId } = useSiteStore()
  const [reports, setReports] = useState<ProblemReport[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [resolvedFilter, setResolvedFilter] = useState('false')
  const [page, setPage] = useState(1)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (selectedSiteId) params.siteId = selectedSiteId
      if (severityFilter !== 'all') params.severity = severityFilter
      if (resolvedFilter !== 'all') params.resolved = resolvedFilter

      const res = await api.get('/reports', { params })
      setReports(res.data.data)
      setPagination(res.data.pagination)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedSiteId, severityFilter, resolvedFilter, page])

  useEffect(() => { setPage(1) }, [selectedSiteId, severityFilter, resolvedFilter])
  useEffect(() => { fetchReports() }, [fetchReports])

  const handleResolve = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await api.patch(`/reports/${id}/resolve`)
      fetchReports()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div>
      <PageHeader
        title="Problem Reports"
        description={pagination ? `${pagination.total} reports` : 'All problem reports'}
        breadcrumbs={[{ label: 'Problem Reports' }]}
      />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reports</SelectItem>
              <SelectItem value="false">Open only</SelectItem>
              <SelectItem value="true">Resolved only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card overflow-hidden">
          {loading ? <PageLoader /> : reports.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No reports found</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Asset</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Severity</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Technician</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reports.map((report) => (
                  <tr
                    key={report.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => report.log && navigate(`/assets/${report.log.asset.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{report.log?.asset.name}</p>
                      <p className="text-xs text-muted-foreground">{report.log?.asset.site.name}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {report.category.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={report.severity} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{report.log?.technician.fullName}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {format(new Date(report.submittedAt), 'dd MMM yyyy, HH:mm')}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={report.resolved ? 'success' : 'danger'}>
                        {report.resolved ? 'Resolved' : 'Open'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {!report.resolved && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={(e) => handleResolve(report.id, e)}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Resolve
                        </Button>
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
