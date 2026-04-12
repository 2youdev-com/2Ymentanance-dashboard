import { useEffect, useState, useCallback } from 'react'
import { Package, Wrench, CheckCircle, AlertTriangle, Clock, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/spinner'
import { useSiteStore, useActivityStore } from '@/store'
import { DashboardStats, ActivityEvent } from '@/types'
import api from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

const activityTypeLabel: Record<string, { label: string; color: string }> = {
  MAINTENANCE_STARTED: { label: 'Maintenance started', color: 'bg-blue-100 text-blue-800' },
  MAINTENANCE_COMPLETED: { label: 'Maintenance completed', color: 'bg-green-100 text-green-800' },
  PROBLEM_REPORTED: { label: 'Problem reported', color: 'bg-red-100 text-red-800' },
  REGISTRATION: { label: 'Asset registered', color: 'bg-purple-100 text-purple-800' },
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const { selectedSiteId } = useSiteStore()
  const { events, setEvents } = useActivityStore()

  const fetchData = useCallback(async () => {
    try {
      const params = selectedSiteId ? { siteId: selectedSiteId } : {}
      const [statsRes, activityRes] = await Promise.all([
        api.get('/dashboard/kpi', { params }),
        api.get('/activity', { params }),
      ])
      setStats(statsRes.data.data)
      setEvents(activityRes.data.data)
      setLastRefresh(new Date())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedSiteId, setEvents])

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [fetchData])

  // Poll every 30 seconds — NFR-B-07
  useEffect(() => {
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) return <PageLoader />

  const kpis = [
    {
      title: 'Total Assets',
      value: stats?.totalAssets ?? 0,
      icon: Package,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      desc: 'Registered in system',
    },
    {
      title: 'Needs Maintenance',
      value: stats?.needsMaintenance ?? 0,
      icon: Wrench,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      desc: 'Require attention',
    },
    {
      title: 'Completed This Week',
      value: stats?.completedThisWeek ?? 0,
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
      desc: 'Maintenance visits',
    },
    {
      title: 'Open Reports',
      value: stats?.openReports ?? 0,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      desc: 'Unresolved problems',
    },
  ]

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Real-time overview of all assets and maintenance operations"
        actions={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}</span>
            <button onClick={fetchData} className="ml-1 hover:text-foreground transition-colors">
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map(({ title, value, icon: Icon, color, bg, desc }) => (
            <Card key={title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <p className="mt-1 text-3xl font-bold">{value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <div className={`rounded-xl p-3 ${bg}`}>
                    <Icon className={`h-6 w-6 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Activity Feed */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Live Activity Feed</CardTitle>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-muted-foreground">Live</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {events.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No recent activity
              </div>
            ) : (
              <div className="divide-y">
                {events.map((event: ActivityEvent) => {
                  const meta = activityTypeLabel[event.type] ?? { label: event.type, color: 'bg-gray-100 text-gray-800' }
                  return (
                    <div key={event.id} className="flex items-start gap-4 px-6 py-3 hover:bg-muted/30 transition-colors">
                      <div className="mt-0.5 flex-shrink-0">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{event.assetName}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.details} · {event.technicianName} · {event.siteName}
                        </p>
                      </div>
                      <time className="flex-shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                      </time>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
