import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore, useActivityStore, useSiteStore } from '@/store'

let socket: Socket | null = null

export const useSocket = () => {
  const { token } = useAuthStore()
  const { selectedSiteId } = useSiteStore()
  const { addEvent } = useActivityStore()
  const prevSiteRef = useRef<string | null>(null)

  useEffect(() => {
    if (!token) return

    if (!socket) {
      socket = io('/', { auth: { token }, transports: ['websocket'] })
    }

    socket.on('activity', (event) => {
      addEvent({
        id: `live-${Date.now()}`,
        ...event,
        timestamp: new Date(event.timestamp).toISOString(),
      })
    })

    return () => {
      socket?.off('activity')
    }
  }, [token, addEvent])

  useEffect(() => {
    if (!socket) return
    if (prevSiteRef.current) socket.emit('leave:site', prevSiteRef.current)
    if (selectedSiteId) socket.emit('join:site', selectedSiteId)
    prevSiteRef.current = selectedSiteId
  }, [selectedSiteId])
}

export const disconnectSocket = () => {
  socket?.disconnect()
  socket = null
}
