import { useEffect, useState, useCallback } from 'react'
import { FileText, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/spinner'
import { useSiteStore } from '@/store'
import api from '@/lib/api'
import { format, formatDistanceToNow } from 'date-fns'

const typeColor: Record<string, string> = {
  MAINTENANCE_STARTED:   'bg-blue-100 text-blue-800',
  MAINTENANCE_COMPLETED: 'bg-green-100 text-green-800',
  PROBLEM_REPORTED:      'bg-red-100 text-red-800',
  REGISTRATION:          'bg-purple-100 text-purple-800',
}
const typeLabel: Record<string, string> = {
  MAINTENANCE_STARTED:   'Maintenance Started',
  MAINTENANCE_COMPLETED: 'Maintenance Completed',
  PROBLEM_REPORTED:      'Problem Reported',
  REGISTRATION:          'Asset Registered',
}

export default function AuditLogsPage() {
  const { selectedSiteId } = useSiteStore()
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 30

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (selectedSiteId) params.siteId = selectedSiteId
      const res = await api.get('/activity', { params })
      setEvents(res.data.data ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedSiteId])

  useEffect(() => { setPage(1) }, [selectedSiteId, typeFilter])
  useEffect(() => { fetchEvents() }, [fetchEvents])

  const filtered = typeFilter === 'all' ? events : events.filter((e) => e.type === typeFilter)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description={`${filtered.length} total log entries`}
        breadcrumbs={[{ label: 'Audit Logs' }]}
        actions={
          <Button variant="outline" size="sm" onClick={fetchEvents}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        {/* Filter */}
        <div className="flex gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="PROBLEM_REPORTED">Problem Reported</SelectItem>
              <SelectItem value="MAINTENANCE_STARTED">Maintenance Started</SelectItem>
              <SelectItem value="MAINTENANCE_COMPLETED">Maintenance Completed</SelectItem>
              <SelectItem value="REGISTRATION">Asset Registration</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? <PageLoader /> : paged.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <FileText className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No audit logs found</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {['Timestamp', 'Action', 'Asset', 'Technician', 'Site', 'Details'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y font-mono">
                  {paged.map((event) => (
                    <tr key={event.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        <p>{format(new Date(event.timestamp), 'dd MMM yyyy')}</p>
                        <p className="text-[10px]">{format(new Date(event.timestamp), 'HH:mm:ss')}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium font-sans ${typeColor[event.type] ?? 'bg-gray-100 text-gray-800'}`}>
                          {typeLabel[event.type] ?? event.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans">
                        <p className="text-sm font-medium">{event.assetName}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-sans">{event.technicianName}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-sans">{event.siteName}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-sans max-w-48 truncate">{event.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
