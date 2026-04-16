import { useEffect, useState, useCallback } from 'react'
import { Bell, CheckCheck, Wrench, AlertTriangle, Package, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/spinner'
import { useSiteStore } from '@/store'
import api from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

const typeIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  MAINTENANCE_STARTED: Wrench,
  MAINTENANCE_COMPLETED: CheckCheck,
  PROBLEM_REPORTED: AlertTriangle,
  REGISTRATION: Package,
}

const typeLabel: Record<string, { label: string; color: string; bg: string }> = {
  MAINTENANCE_STARTED: { label: 'Maintenance Started', color: 'text-blue-600', bg: 'bg-blue-50' },
  MAINTENANCE_COMPLETED: { label: 'Maintenance Completed', color: 'text-green-600', bg: 'bg-green-50' },
  PROBLEM_REPORTED: { label: 'Problem Reported', color: 'text-red-600', bg: 'bg-red-50' },
  REGISTRATION: { label: 'Asset Registered', color: 'text-purple-600', bg: 'bg-purple-50' },
}

const READ_STORAGE_KEY = 'notifications-read-ids'

export default function NotificationsPage() {
  const { selectedSiteId } = useSiteStore()
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(READ_STORAGE_KEY)
      if (!saved) return new Set()
      const parsed = JSON.parse(saved)
      return new Set(Array.isArray(parsed) ? parsed : [])
    } catch {
      return new Set()
    }
  })

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

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  useEffect(() => {
    try {
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...readIds]))
    } catch (err) {
      console.error('Failed to save read notifications:', err)
    }
  }, [readIds])

  const markAllRead = () => {
    setReadIds((prev) => new Set([...prev, ...events.map((e) => e.id)]))
  }

  const markRead = (id: string) => {
    setReadIds((prev) => new Set([...prev, id]))
  }

  const filtered = filter === 'all' ? events : events.filter((e) => e.type === filter)
  const unreadCount = events.filter((e) => !readIds.has(e.id)).length

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
        breadcrumbs={[{ label: 'Notifications' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchEvents}>
              <RefreshCw className="mr-1 h-4 w-4" />
              Refresh
            </Button>

            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllRead}>
                <CheckCheck className="mr-1 h-4 w-4" />
                Mark all read
              </Button>
            )}
          </div>
        }
      />

      <div className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All notifications</SelectItem>
              <SelectItem value="PROBLEM_REPORTED">Problem Reports</SelectItem>
              <SelectItem value="MAINTENANCE_STARTED">Maintenance Started</SelectItem>
              <SelectItem value="MAINTENANCE_COMPLETED">Maintenance Completed</SelectItem>
              <SelectItem value="REGISTRATION">Asset Registration</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-sm text-muted-foreground">
            {filtered.length} notifications
          </span>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <PageLoader />
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Bell className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No notifications found</p>
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map((event) => {
                  const meta = typeLabel[event.type] ?? {
                    label: event.type,
                    color: 'text-gray-600',
                    bg: 'bg-gray-50',
                  }

                  const Icon = typeIcon[event.type] ?? Bell
                  const isUnread = !readIds.has(event.id)

                  return (
                    <div
                      key={event.id}
                      className={`flex cursor-pointer items-start gap-4 px-6 py-4 transition-colors hover:bg-muted/30 ${
                        isUnread ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => markRead(event.id)}
                    >
                      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${meta.bg}`}>
                        <Icon className={`h-4 w-4 ${meta.color}`} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center gap-2">
                          <span className={`text-xs font-semibold ${meta.color}`}>
                            {meta.label}
                          </span>
                          {isUnread && (
                            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                          )}
                        </div>

                        <p className="truncate text-sm font-medium">{event.assetName}</p>

                        <p className="text-xs text-muted-foreground">
                          {event.details} · {event.technicianName} · {event.siteName}
                        </p>
                      </div>

                      <time className="flex-shrink-0 text-xs text-muted-foreground">
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