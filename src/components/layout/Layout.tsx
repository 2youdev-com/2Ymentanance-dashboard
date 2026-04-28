import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuthStore, useChatStore } from '@/store'
import { useSocket } from '@/hooks/useSocket'
import { AiFloatingButton } from '@/components/assistant/AiFloatingButton'
import { AiChatPanel } from '@/components/assistant/AiChatPanel'

export function Layout() {
  const { token } = useAuthStore()
  useSocket()

  if (!token) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* AI Assistant — floating button + slide-in panel */}
      <AiFloatingButton />
      <AiChatPanel />
    </div>
  )
}