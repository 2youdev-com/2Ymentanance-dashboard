import { useEffect, useState, useCallback } from 'react'
import { ShieldCheck, ChevronLeft, ChevronRight, CheckCircle, XCircle, MinusCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/spinner'
import { useSiteStore } from '@/store'
import { MaintenanceLog, Pagination } from '@/types'
import api from '@/lib/api'
import { format } from 'date-fns'

export default function QualityAssurancePage() {
  const { selectedSiteId } = useSiteStore()
  const [logs, setLogs] = useState<MaintenanceLog[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (selectedSiteId) params.siteId = selectedSiteId
      if (typeFilter !== 'all') params.type = typeFilter
      const res = await api.get('/maintenance', { params })
      setLogs(res.data.data ?? [])
      setPagination(res.data.pagination)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedSiteId, typeFilter, page])

  useEffect(() => { setPage(1) }, [selectedSiteId, typeFilter])
  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Compute QA stats
  const totalChecks = logs.reduce((acc, l) => acc + (l._count?.checklistItems ?? 0), 0)
  const passRate = logs.length > 0
    ? Math.round(logs.filter((l) => !l.problemReport).length / logs.length * 100)
    : 0

  return (
    <div>
      <PageHeader
        title="Quality Assurance"
        description="Checklist results and compliance overview"
        breadcrumbs={[{ label: 'Quality Assurance' }]}
      />

      <div className="p-6 space-y-6">
        {/* KPI summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: 'Total Inspections', value: pagination?.total ?? 0, icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Pass Rate', value: `${passRate}%`, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Total Checklist Items', value: totalChecks, icon: MinusCircle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="mt-1 text-3xl font-bold">{value}</p>
                  </div>
                  <div className={`rounded-xl p-3 ${bg}`}>
                    <Icon className={`h-6 w-6 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-3">
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
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? <PageLoader /> : logs.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">No records found</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {['Asset', 'Type', 'Technician', 'Date', 'Checklist Items', 'Result'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{log.asset.name}</p>
                        <p className="text-xs text-muted-foreground">{log.asset.site.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={log.type === 'PREVENTIVE' ? 'secondary' : 'warning'}>
                          {log.type === 'PREVENTIVE' ? 'Preventive' : 'Corrective'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{log.technician.fullName}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {format(new Date(log.startedAt), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3 text-center font-medium">
                        {log._count?.checklistItems ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        {log.problemReport ? (
                          <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                            <XCircle className="h-4 w-4" /> Issues Found
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                            <CheckCircle className="h-4 w-4" /> Passed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

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
