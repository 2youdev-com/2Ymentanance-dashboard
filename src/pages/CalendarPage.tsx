import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Activity,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/spinner'
import { useSiteStore } from '@/store'
import { MaintenanceLog } from '@/types'
import api from '@/lib/api'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  startOfWeek,
  endOfWeek,
  isSameMonth,
} from 'date-fns'

export default function CalendarPage() {
  const navigate = useNavigate()
  const { selectedSiteId } = useSiteStore()

  const [logs, setLogs] = useState<MaintenanceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = {
        limit: 300,
        dateFrom: format(startOfMonth(currentMonth), 'yyyy-MM-dd'),
        dateTo: format(endOfMonth(currentMonth), 'yyyy-MM-dd'),
      }

      if (selectedSiteId) params.siteId = selectedSiteId

      const res = await api.get('/maintenance', { params })
      setLogs(res.data.data ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedSiteId, currentMonth])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const logsForDay = useCallback(
    (day: Date) => logs.filter((l) => isSameDay(new Date(l.startedAt), day)),
    [logs]
  )

  const selectedLogs = selectedDay ? logsForDay(selectedDay) : []

  const preventiveCount = logs.filter((l) => l.type === 'PREVENTIVE').length
  const correctiveCount = logs.filter((l) => l.type === 'CORRECTIVE').length
  const completedCount = logs.filter((l) => l.status === 'COMPLETED').length
  const inProgressCount = logs.filter((l) => l.status !== 'COMPLETED').length
  const completionRate =
    logs.length > 0 ? Math.round((completedCount / logs.length) * 100) : 0

  const summaryCards = [
    {
      title: 'Total This Month',
      value: logs.length,
      sub: `${completedCount} completed`,
      icon: Activity,
      valueClass: 'text-blue-600',
      cardClass: 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100',
      iconWrap: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Preventive',
      value: preventiveCount,
      sub: 'Planned maintenance',
      icon: CalendarIcon,
      valueClass: 'text-indigo-600',
      cardClass: 'bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-100',
      iconWrap: 'bg-indigo-100 text-indigo-600',
    },
    {
      title: 'Corrective',
      value: correctiveCount,
      sub: 'Issue-based work',
      icon: AlertTriangle,
      valueClass: 'text-orange-600',
      cardClass: 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100',
      iconWrap: 'bg-orange-100 text-orange-600',
    },
    {
      title: 'Completion Rate',
      value: `${completionRate}%`,
      sub: `${inProgressCount} still in progress`,
      icon: CheckCircle2,
      valueClass: 'text-emerald-600',
      cardClass: 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100',
      iconWrap: 'bg-emerald-100 text-emerald-600',
    },
  ]

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Maintenance schedule overview"
        breadcrumbs={[{ label: 'Calendar' }]}
      />

      <div className="space-y-5 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((item) => {
            const Icon = item.icon
            return (
              <Card
                key={item.title}
                className={`border shadow-sm ${item.cardClass}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        {item.title}
                      </p>
                      <p className={`mt-2 text-3xl font-bold ${item.valueClass}`}>
                        {item.value}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.sub}
                      </p>
                    </div>

                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.iconWrap}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_0.9fr]">
          <Card className="overflow-hidden border shadow-sm">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-white pb-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold tracking-tight">
                    {format(currentMonth, 'MMMM yyyy')}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Overview of scheduled maintenance for the month
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl px-4"
                    onClick={() => {
                      setCurrentMonth(new Date())
                      setSelectedDay(new Date())
                    }}
                  >
                    Today
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 md:p-5">
              {loading ? (
                <PageLoader />
              ) : (
                <>
                  <div className="mb-3 grid grid-cols-7 gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div
                        key={day}
                        className="py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {calendarDays.map((day) => {
                      const dayLogs = logsForDay(day)
                      const selected = !!selectedDay && isSameDay(day, selectedDay)
                      const today = isToday(day)
                      const currentMonthDay = isSameMonth(day, currentMonth)

                      const preventive = dayLogs.filter(
                        (l) => l.type === 'PREVENTIVE'
                      ).length
                      const corrective = dayLogs.filter(
                        (l) => l.type === 'CORRECTIVE'
                      ).length

                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => setSelectedDay(day)}
                          className={[
                            'group relative min-h-[96px] rounded-2xl border p-2 text-left transition-all duration-200',
                            currentMonthDay
                              ? 'bg-white'
                              : 'bg-muted/25 text-muted-foreground/60',
                            selected
                              ? 'border-primary ring-2 ring-primary/20 bg-blue-50 shadow-sm'
                              : today
                              ? 'border-primary/40 ring-1 ring-primary/20 hover:border-primary/60 hover:bg-primary/5'
                              : 'border-border/60 hover:border-border hover:bg-muted/35',
                          ].join(' ')}
                        >
                          <div className="flex items-start justify-between">
                            <span
                              className={[
                                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
                                selected
                                  ? 'bg-primary text-white'
                                  : today
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-foreground',
                              ].join(' ')}
                            >
                              {format(day, 'd')}
                            </span>

                            {dayLogs.length > 0 && (
                              <span
                                className={[
                                  'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                  selected
                                    ? 'bg-white text-slate-700 border border-slate-200'
                                    : 'bg-slate-100 text-slate-700',
                                ].join(' ')}
                              >
                                {dayLogs.length}
                              </span>
                            )}
                          </div>

                          <div className="mt-3 space-y-1">
                            {preventive > 0 && (
                              <div
                                className={[
                                  'rounded-full px-2 py-1 text-[10px] font-semibold leading-none',
                                  'bg-indigo-100 text-indigo-700',
                                  selected ? 'ring-1 ring-indigo-200' : '',
                                ].join(' ')}
                              >
                                {preventive} preventive
                              </div>
                            )}

                            {corrective > 0 && (
                              <div
                                className={[
                                  'rounded-full px-2 py-1 text-[10px] font-semibold leading-none',
                                  'bg-orange-100 text-orange-700',
                                  selected ? 'ring-1 ring-orange-200' : '',
                                ].join(' ')}
                              >
                                {corrective} corrective
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-500" />
                        Preventive
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" />
                        Corrective
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Click a day to view work orders
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border shadow-sm">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-white pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    {selectedDay
                      ? format(selectedDay, 'EEEE, dd MMM yyyy')
                      : 'Select a day'}
                  </CardTitle>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedDay
                      ? `${selectedLogs.length} work order${
                          selectedLogs.length !== 1 ? 's' : ''
                        } found`
                      : 'Choose any date from the calendar'}
                  </p>
                </div>

                {selectedDay && (
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px]">
                    {format(selectedDay, 'd MMM')}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="max-h-[680px] overflow-y-auto p-4">
              {!selectedDay ? (
                <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                  <CalendarIcon className="h-10 w-10 text-muted-foreground/25" />
                  <div>
                    <p className="text-sm font-medium">No day selected</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Click on any calendar date to see its maintenance work
                    </p>
                  </div>
                </div>
              ) : selectedLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                  <Wrench className="h-10 w-10 text-muted-foreground/20" />
                  <div>
                    <p className="text-sm font-medium">No work orders on this day</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Try another date or switch to another month
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedLogs.map((log) => {
                    const isCompleted = log.status === 'COMPLETED'
                    const isPreventive = log.type === 'PREVENTIVE'

                    return (
                      <div
                        key={log.id}
                        onClick={() => navigate(`/assets/${log.asset.id}`)}
                        className="group cursor-pointer rounded-2xl border bg-white p-4 transition-all hover:border-primary/30 hover:bg-slate-50 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold leading-tight transition-colors group-hover:text-primary">
                              {log.asset.name}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {log.asset.type.replace(/_/g, ' ')}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <Badge
                              variant={isPreventive ? 'secondary' : 'warning'}
                              className="rounded-full px-2.5 py-1 text-[10px]"
                            >
                              {isPreventive ? 'PM' : 'CM'}
                            </Badge>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Wrench className="h-3.5 w-3.5" />
                            <span>{log.technician.fullName}</span>
                          </div>

                          <div className="flex items-center justify-end gap-2">
                            <Clock3 className="h-3.5 w-3.5" />
                            <span className="font-mono">
                              {format(new Date(log.startedAt), 'HH:mm')}
                            </span>
                          </div>
                        </div>

                        {log.problemReport && (
                          <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                            <div className="flex items-center gap-1.5 font-medium">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span>
                                {log.problemReport.category.replace(/_/g, ' ')} ·{' '}
                                {log.problemReport.severity}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="mt-4 flex items-center justify-between">
                          <Badge
                            variant={isCompleted ? 'success' : 'warning'}
                            className="rounded-full px-2.5 py-1 text-[10px]"
                          >
                            {isCompleted ? 'Completed' : 'In Progress'}
                          </Badge>

                          <span className="text-[11px] text-muted-foreground">
                            Open asset details
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}