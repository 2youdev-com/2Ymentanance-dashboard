import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@/types'

// ─── Auth ─────────────────────────────────────────────────────────────────────

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

// ─── Site ─────────────────────────────────────────────────────────────────────

interface SiteState {
  selectedSiteId: string | null
  setSelectedSite: (id: string | null) => void
}

export const useSiteStore = create<SiteState>((set) => ({
  selectedSiteId: null,
  setSelectedSite: (id) => set({ selectedSiteId: id }),
}))

// ─── Activity ─────────────────────────────────────────────────────────────────

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

// Safe UUID — crypto.randomUUID() not available in all older browsers
function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback: RFC4122 v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

const MAX_MESSAGES_PER_USER = 100
//
// FIX: Conversations are stored keyed by userId so switching users
// never leaks another user's chat history.
// On clearAuth (logout) the entire map is wiped.

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  data?: unknown
  toolName?: string
  timestamp: number
  error?: boolean
}

interface ChatState {
  /** Map of userId → message array */
  conversationsByUser: Record<string, ChatMessage[]>
  isOpen: boolean

  // Getters
  getMessages: (userId: string) => ChatMessage[]

  // Mutations
  addMessage: (userId: string, msg: ChatMessage) => void
  updateLastMessage: (userId: string, patch: Partial<ChatMessage>) => void
  clearConversation: (userId: string) => void
  clearAllConversations: () => void
  setOpen: (open: boolean) => void
  toggleOpen: () => void
}

export { uuid }

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversationsByUser: {},
      isOpen: false,

      getMessages: (userId) => get().conversationsByUser[userId] ?? [],

      addMessage: (userId, msg) =>
        set((state) => {
          const existing = state.conversationsByUser[userId] ?? []
          // Keep only the last MAX-1 messages then append the new one
          const trimmed =
            existing.length >= MAX_MESSAGES_PER_USER
              ? existing.slice(existing.length - (MAX_MESSAGES_PER_USER - 1))
              : existing
          return {
            conversationsByUser: {
              ...state.conversationsByUser,
              [userId]: [...trimmed, msg],
            },
          }
        }),

      updateLastMessage: (userId, patch) =>
        set((state) => {
          const msgs = [...(state.conversationsByUser[userId] ?? [])]
          if (msgs.length === 0) return state
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], ...patch }
          return {
            conversationsByUser: {
              ...state.conversationsByUser,
              [userId]: msgs,
            },
          }
        }),

      clearConversation: (userId) =>
        set((state) => ({
          conversationsByUser: {
            ...state.conversationsByUser,
            [userId]: [],
          },
        })),

      clearAllConversations: () => set({ conversationsByUser: {} }),

      setOpen: (open) => set({ isOpen: open }),
      toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
    }),
    {
      name: 'loc_chat',
      // Only persist conversationsByUser — isOpen always starts closed
      partialize: (s) => ({ conversationsByUser: s.conversationsByUser }),
    }
  )
)