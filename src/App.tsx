import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import AssetsPage from '@/pages/AssetsPage'
import AssetDetailPage from '@/pages/AssetDetailPage'
import MaintenancePage from '@/pages/MaintenancePage'
import ReportsPage from '@/pages/ReportsPage'
import MapPage from '@/pages/MapPage'
import UsersPage from '@/pages/UsersPage'
import NotificationsPage from '@/pages/NotificationsPage'
import QualityAssurancePage from '@/pages/QualityAssurancePage'
import WorkOrdersPage from '@/pages/WorkOrdersPage'
import CalendarPage from '@/pages/CalendarPage'
import SchedulesPage from '@/pages/SchedulesPage'
import AuditLogsPage from '@/pages/AuditLogsPage'
import QRCodesPage from '@/pages/QRCodesPage'
import { useAuthStore } from '@/store'

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="assets/:id" element={<AssetDetailPage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="quality" element={<QualityAssurancePage />} />
          <Route path="work-orders" element={<WorkOrdersPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="schedules" element={<SchedulesPage />} />
          <Route path="users" element={<RequireAdmin><UsersPage /></RequireAdmin>} />
          <Route path="qr-codes" element={<RequireAdmin><QRCodesPage /></RequireAdmin>} />
          <Route path="audit-logs" element={<RequireAdmin><AuditLogsPage /></RequireAdmin>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
