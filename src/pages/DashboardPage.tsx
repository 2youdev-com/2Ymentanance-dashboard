import { useEffect, useState, useCallback } from 'react'
import {
  Package, Wrench, CheckCircle, AlertTriangle, Clock, RefreshCw,
  TrendingUp, Activity, BarChart2, ShieldAlert, Percent,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { useSiteStore, useActivityStore } from '@/store'
import { DashboardStats, Asset } from '@/types'
import api from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts'

function healthScore(asset: Asset): number {
  const logs = asset.maintenanceLogs ?? []
  if (logs.length === 0) return 100
  const failures = logs.filter((l) => l.problemReport).length
  return Math.max(0, Math.round(100 - (failures / logs.length) * 100))
}

function healthColor(score: number) {
  if (score >= 80) return '#22c55e'
  if (score >= 55) return '#f59e0b'
  return '#ef4444'
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [trendPeriod, setTrendPeriod] = useState<'7d' | '30d' | '90d'>('30d')
  const { selectedSiteId } = useSiteStore()
  const { events, setEvents } = useActivityStore()

  const fetchData = useCallback(async () => {
    try {
      const params = selectedSiteId ? { siteId: selectedSiteId } : {}

      const [statsRes, activityRes, assetsRes] = await Promise.allSettled([
        api.get('/dashboard/kpi', { params }),
        api.get('/activity', { params }),
        api.get('/assets', { params: { ...params, limit: 50 } }),
      ])

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data.data ?? null)
      } else {
        console.error('KPI request failed:', statsRes.reason)
        setStats(null)
      }

      if (activityRes.status === 'fulfilled') {
        setEvents(activityRes.value.data.data ?? [])
      } else {
        console.error('Activity request failed:', activityRes.reason)
        setEvents([])
      }

      if (assetsRes.status === 'fulfilled') {
        setAssets(assetsRes.value.data.data ?? [])
      } else {
        console.error('Assets request failed:', assetsRes.reason)
        setAssets([])
      }

      setLastRefresh(new Date())
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedSiteId, setEvents])

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) return <PageLoader />

  const totalAssets = stats?.totalAssets ?? assets.length
  const operational = assets.filter((a) => a.status === 'OPERATIONAL').length
  const needsAttn = assets.filter((a) => a.status === 'NEEDS_MAINTENANCE').length
  const critical = assets.filter((a) => a.status === 'OUT_OF_SERVICE').length

  const systemHealth = totalAssets > 0 ? Math.round((operational / totalAssets) * 100) : 0

  const pieData = [
    { name: 'Operational', value: operational, color: '#22c55e' },
    { name: 'Needs Attention', value: needsAttn, color: '#f59e0b' },
    { name: 'Critical', value: critical, color: '#ef4444' },
  ].filter((d) => d.value > 0)

  const assetScores = assets
    .map((a) => ({
      ...a,
      health: healthScore(a),
      failures: a._count?.maintenanceLogs ?? 0,
    }))
    .sort((a, b) => a.health - b.health)
    .slice(0, 10)

  const trendDays = trendPeriod === '7d' ? 7 : trendPeriod === '30d' ? 30 : 90
  const trendMap: Record<string, { completed: number; problems: number }> = {}
  const now = Date.now()

  for (let i = trendDays - 1; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000)
    const key = `${d.getMonth() + 1}/${d.getDate()}`
    trendMap[key] = { completed: 0, problems: 0 }
  }

  events.forEach((e) => {
    const d = new Date(e.timestamp)
    if (now - d.getTime() > trendDays * 86_400_000) return
    const key = `${d.getMonth() + 1}/${d.getDate()}`
    if (!trendMap[key]) return
    if (e.type === 'MAINTENANCE_COMPLETED') trendMap[key].completed++
    if (e.type === 'PROBLEM_REPORTED') trendMap[key].problems++
  })

  const trendData = Object.entries(trendMap).map(([date, v]) => ({ date, ...v }))

  const completionData = trendData.slice(-30).map((d, i) => ({
    date: d.date,
    rate: d.completed > 0
      ? Math.round((d.completed / (d.completed + d.problems + 0.001)) * 100)
      : 0,
    day: i,
  }))

  const ppeChecks = { total: 27, compliant: 1, nonCompliant: 26 }
  const ppeRate = Math.round((ppeChecks.compliant / ppeChecks.total) * 100)

  const topIssues = [
    { label: 'Safety glasses: Not detected', count: 12 },
    { label: 'Safety vest: Not detected', count: 9 },
    { label: 'Hard hat: Not detected', count: 5 },
  ]

  const completionRate = stats
    ? Math.round(
        ((stats.completedThisWeek ?? 0) /
          Math.max((stats.completedThisWeek ?? 0) + (stats.openReports ?? 1), 1)) * 100
      )
    : 22

  const kpis = [
    {
      title: 'Total Assets',
      value: totalAssets,
      icon: Package,
      color: 'text-blue-400',
      desc: 'Registered in system',
    },
    {
      title: 'Needs Maintenance',
      value: stats?.needsMaintenance ?? needsAttn,
      icon: Wrench,
      color: 'text-orange-400',
      desc: 'Require attention',
    },
    {
      title: 'Completed This Week',
      value: stats?.completedThisWeek ?? 0,
      icon: CheckCircle,
      color: 'text-green-400',
      desc: 'Maintenance visits',
    },
    {
      title: 'Open Reports',
      value: stats?.openReports ?? 0,
      icon: AlertTriangle,
      color: 'text-yellow-400',
      desc: 'Unresolved problems',
    },
    {
      title: 'Completion Rate (30d)',
      value: `${completionRate}%`,
      icon: Percent,
      color: 'text-red-400',
      desc: 'Avg completion',
      critical: true,
    },
  ]

  return (
    <div className="min-h-screen bg-background">
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {kpis.map(({ title, value, icon: Icon, color, desc, critical: isCritical }) => (
            <Card key={title} className={isCritical ? 'relative border-red-500/40' : ''}>
              {isCritical && (
                <span className="absolute top-2 right-2 rounded text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5">
                  CRITICAL
                </span>
              )}
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground leading-tight">{title}</p>
                    <p className="mt-1 text-2xl font-bold">{value}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{desc}</p>
                  </div>
                  <Icon className={`h-5 w-5 mt-0.5 ${color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="relative flex items-center justify-center">
                  <PieChart width={160} height={160}>
                    <Pie
                      data={pieData.length ? pieData : [{ name: 'No data', value: 1, color: '#374151' }]}
                      cx={75}
                      cy={75}
                      innerRadius={50}
                      outerRadius={72}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                      strokeWidth={0}
                    >
                      {(pieData.length ? pieData : [{ name: 'No data', value: 1, color: '#374151' }]).map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold">{systemHealth}%</span>
                    <span className="text-[10px] text-muted-foreground">OPTIMAL</span>
                  </div>
                </div>

                <div className="space-y-2 flex-1">
                  {[
                    {
                      label: 'Operational',
                      value: operational,
                      pct: totalAssets ? Math.round((operational / totalAssets) * 100) : 0,
                      color: '#22c55e',
                    },
                    {
                      label: 'Needs Attention',
                      value: needsAttn,
                      pct: totalAssets ? Math.round((needsAttn / totalAssets) * 100) : 0,
                      color: '#f59e0b',
                    },
                    {
                      label: 'Critical',
                      value: critical,
                      pct: totalAssets ? Math.round((critical / totalAssets) * 100) : 0,
                      color: '#ef4444',
                    },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                      <span className="flex-1 text-muted-foreground">{s.label}</span>
                      <span className="font-medium">{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-primary" /> Maintenance Trends
                  </CardTitle>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {events.length} records · {completionRate}% avg completion
                  </p>
                </div>

                <div className="flex gap-1">
                  {(['7d', '30d', '90d'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setTrendPeriod(p)}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                        trendPeriod === p
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'text-muted-foreground border-border hover:border-primary'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="flex gap-3 mb-2">
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="h-2 w-2 rounded-sm bg-green-500 inline-block" /> Completed
                </span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="h-2 w-2 rounded-sm bg-red-500 inline-block" /> Problem Found
                </span>
              </div>

              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={trendData} barSize={6} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 8 }}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.floor(trendData.length / 8)}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      fontSize: 11,
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                  <Bar dataKey="completed" fill="#22c55e" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="problems" fill="#ef4444" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Completion Rate
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">Daily completion % over the last 30 days</p>
            </CardHeader>

            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={completionData}>
                  <defs>
                    <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} interval={5} />
                  <YAxis
                    tick={{ fontSize: 8 }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    unit="%"
                    width={28}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}%`, 'Completion Rate']}
                    contentStyle={{
                      fontSize: 11,
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke="#3b82f6"
                    fill="url(#rateGrad)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-primary" /> Expert Compliance
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">Photo verification results</p>
            </CardHeader>

            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex items-center justify-center">
                  <PieChart width={80} height={80}>
                    <Pie
                      data={[
                        { value: ppeChecks.compliant, color: '#22c55e' },
                        { value: ppeChecks.nonCompliant, color: '#374151' },
                      ]}
                      cx={35}
                      cy={35}
                      innerRadius={24}
                      outerRadius={36}
                      dataKey="value"
                      strokeWidth={0}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <Cell fill="#22c55e" />
                      <Cell fill="#374151" />
                    </Pie>
                  </PieChart>

                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-sm font-bold">{ppeRate}%</span>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div>
                    <p className="text-muted-foreground">Total Checks</p>
                    <p className="font-bold text-lg">{ppeChecks.total}</p>
                  </div>
                </div>

                <div className="space-y-1 text-xs ml-auto text-right">
                  <div>
                    <p className="text-muted-foreground">Compliant</p>
                    <p className="font-bold text-green-500">{ppeChecks.compliant}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Non-Compliant</p>
                    <p className="font-bold text-red-500">{ppeChecks.nonCompliant}</p>
                  </div>
                </div>
              </div>

              <p className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase">Top Issues</p>

              <div className="space-y-1.5">
                {topIssues.map((issue) => (
                  <div key={issue.label} className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground truncate flex-1 mr-2">{issue.label}</p>
                    <span className="text-[10px] font-bold bg-red-500 text-white rounded px-1.5 py-0.5 flex-shrink-0">
                      {issue.count}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Asset Health Scores</CardTitle>
            <p className="text-[10px] text-muted-foreground">Worst performing assets (last 30 days)</p>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {['ASSET', 'TYPE', 'LOCATION', 'HEALTH', 'FAILURES', 'STATUS'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left font-semibold text-muted-foreground tracking-wider text-[10px]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {assetScores.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        No asset data
                      </td>
                    </tr>
                  ) : (
                    assetScores.map((asset) => (
                      <tr key={asset.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-xs">{asset.name}</p>
                          <p className="text-[10px] text-muted-foreground">{asset.assetNumber}</p>
                        </td>

                        <td className="px-4 py-2.5 text-muted-foreground">
                          {asset.type.replace(/_/g, ' ')}
                        </td>

                        <td className="px-4 py-2.5 text-muted-foreground">
                          {[asset.site?.name, asset.building, asset.floor].filter(Boolean).join(' · ')}
                        </td>

                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${asset.health}%`,
                                  background: healthColor(asset.health),
                                }}
                              />
                            </div>
                            <span className="text-[10px] font-medium w-6">{asset.health}</span>
                          </div>
                        </td>

                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center justify-center min-w-[22px] h-5 rounded text-[10px] font-bold bg-red-500 text-white px-1">
                            {asset.failures}
                          </span>
                        </td>

                        <td className="px-4 py-2.5">
                          <StatusBadge status={asset.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}