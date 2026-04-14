import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/spinner'
import { useSiteStore } from '@/store'
import { MaintenanceLog } from '@/types'
import api from '@/lib/api'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, getDay } from 'date-fns'

export default function CalendarPage() {
  const navigate = useNavigate()
  const { selectedSiteId } = useSiteStore()
  const [logs, setLogs] = useState<MaintenanceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = {
        limit: 200,
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

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const firstDayOffset = getDay(startOfMonth(currentMonth))

  const logsForDay = (day: Date) =>
    logs.filter((l) => isSameDay(new Date(l.startedAt), day))

  const selectedLogs = selectedDay ? logsForDay(selectedDay) : []

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Maintenance schedule overview"
        breadcrumbs={[{ label: 'Calendar' }]}
      />

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Calendar Grid */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {format(currentMonth, 'MMMM yyyy')}
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCurrentMonth(new Date())}>
                    Today
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <PageLoader /> : (
                <>
                  {/* Day headers */}
                  <div className="grid grid-cols-7 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                      <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
                    ))}
                  </div>
                  {/* Day cells */}
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: firstDayOffset }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {days.map((day) => {
                      const dayLogs = logsForDay(day)
                      const isSelected = selectedDay && isSameDay(day, selectedDay)
                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => setSelectedDay(isSameDay(day, selectedDay ?? new Date(0)) ? null : day)}
                          className={`
                            relative flex flex-col items-center rounded-lg p-1.5 min-h-[52px] text-xs transition-colors
                            ${isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/60'}
                            ${isToday(day) && !isSelected ? 'border border-primary text-primary font-bold' : ''}
                          `}
                        >
                          <span className="font-medium">{format(day, 'd')}</span>
                          {dayLogs.length > 0 && (
                            <span className={`mt-0.5 text-[10px] rounded-full px-1.5 font-semibold
                              ${isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
                              {dayLogs.length}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Day detail */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                {selectedDay ? format(selectedDay, 'EEEE, dd MMM yyyy') : 'Select a day'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedDay ? (
                <p className="text-sm text-muted-foreground">Click on a day to see its work orders</p>
              ) : selectedLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No work orders on this day</p>
              ) : (
                <div className="space-y-3">
                  {selectedLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-lg border p-3 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/assets/${log.asset.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{log.asset.name}</p>
                        <Badge variant={log.type === 'PREVENTIVE' ? 'secondary' : 'warning'} >
                          {log.type === 'PREVENTIVE' ? 'PM' : 'CM'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{log.technician.fullName}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(log.startedAt), 'HH:mm')}</p>
                      <Badge variant={log.status === 'COMPLETED' ? 'success' : 'warning'} className="mt-2">
                        {log.status === 'COMPLETED' ? 'Completed' : 'In Progress'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
