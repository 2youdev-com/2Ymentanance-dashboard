import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Map, Bell, Package, Wrench, ShieldCheck,
  ClipboardList, Calendar, Clock, AlertTriangle, Users, QrCode,
  FileText, LogOut, Building2,
} from 'lucide-react'
import { useAuthStore, useSiteStore } from '@/store'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import api from '@/lib/api'
import { disconnectSocket } from '@/hooks/useSocket'

const navGroups = [
  {
    label: 'Overview',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/map', icon: Map, label: 'Site Map' },
      { to: '/notifications', icon: Bell, label: 'Notifications' },
    ],
  },
  {
    label: 'Assets',
    items: [
      { to: '/assets', icon: Package, label: 'Asset Registry' },
      { to: '/maintenance', icon: Wrench, label: 'Maintenance Log' },
      { to: '/quality', icon: ShieldCheck, label: 'Quality Assurance' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/work-orders', icon: ClipboardList, label: 'Work Orders' },
      { to: '/calendar', icon: Calendar, label: 'Calendar' },
      { to: '/schedules', icon: Clock, label: 'Schedules' },
      { to: '/reports', icon: AlertTriangle, label: 'Problem Reports' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/users', icon: Users, label: 'User Management', adminOnly: true },
      { to: '/qr-codes', icon: QrCode, label: 'QR Codes', adminOnly: true },
      { to: '/audit-logs', icon: FileText, label: 'Audit Logs', adminOnly: true },
    ],
  },
]

export function Sidebar() {
  const { user, clearAuth } = useAuthStore()
  const { selectedSiteId, setSelectedSite } = useSiteStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // token may already be expired — proceed anyway
    }
    disconnectSocket()
    clearAuth()
    navigate('/login')
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card overflow-y-auto">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6 flex-shrink-0">
        <Building2 className="h-6 w-6 text-primary" />
        <div>
          <p className="text-sm font-bold">2Ymentanance</p>
          <p className="text-xs text-muted-foreground">Asset Maintenance</p>
        </div>
      </div>

      {/* Site selector */}
      <div className="border-b p-4 flex-shrink-0">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Site</p>
        <Select value={selectedSiteId || 'all'} onValueChange={(v) => setSelectedSite(v === 'all' ? null : v)}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sites</SelectItem>
            {user?.sites.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-4">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(
            (item: { to: string; icon: React.ComponentType<{ className?: string }>; label: string; adminOnly?: boolean }) =>
              !item.adminOnly || user?.role === 'ADMIN'
          )
          if (visibleItems.length === 0) return null
          return (
            <div key={group.label}>
              <p className="px-3 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="border-t p-4 flex-shrink-0">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {user?.fullName.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.fullName}</p>
            <p className="text-xs text-muted-foreground">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  )
}
