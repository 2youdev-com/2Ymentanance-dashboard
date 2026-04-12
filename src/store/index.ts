import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@/types'

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    { name: 'loc_auth' }
  )
)

interface SiteState {
  selectedSiteId: string | null
  setSelectedSite: (id: string | null) => void
}

export const useSiteStore = create<SiteState>((set) => ({
  selectedSiteId: null,
  setSelectedSite: (id) => set({ selectedSiteId: id }),
}))

// Fixed: added assetId to match ActivityEvent type
interface ActivityState {
  events: {
    id: string
    type: string
    assetId: string
    assetName: string
    siteName: string
    technicianName: string
    timestamp: string
    details: string
  }[]
  addEvent: (event: ActivityState['events'][0]) => void
  setEvents: (events: ActivityState['events']) => void
}

export const useActivityStore = create<ActivityState>((set) => ({
  events: [],
  addEvent: (event) =>
    set((state) => ({ events: [event, ...state.events].slice(0, 20) })),
  setEvents: (events) => set({ events }),
}))