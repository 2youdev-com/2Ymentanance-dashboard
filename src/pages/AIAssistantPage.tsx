// src/pages/AIAssistantPage.tsx
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Bot, Send, Trash2, Loader2, AlertCircle, ChevronDown,
  Sparkles, Clock, AlertTriangle, Package, Wrench,
  Plus, MessageSquare, X,
} from 'lucide-react'
import { useAuthStore } from '@/store'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  data?: unknown
  toolName?: string
  createdAt?: string
  error?: boolean
  // local-only (typing indicator)
  typing?: boolean
}

interface ChatSession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  _count?: { messages: number }
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderContent(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      nodes.push(
        <pre key={i} className="my-2 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-xs text-green-300 font-mono leading-relaxed">
          <code>{codeLines.join('\n')}</code>
        </pre>
      )
      i++
      continue
    }

    if (/^[•\-\*]\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[•\-\*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[•\-\*]\s/, ''))
        i++
      }
      nodes.push(
        <ul key={i} className="my-1.5 ml-5 space-y-1 list-disc">
          {items.map((item, j) => (
            <li key={j} className="text-sm leading-relaxed">{inlineFormat(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''))
        i++
      }
      nodes.push(
        <ol key={i} className="my-1.5 ml-5 space-y-1 list-decimal">
          {items.map((item, j) => (
            <li key={j} className="text-sm leading-relaxed">{inlineFormat(item)}</li>
          ))}
        </ol>
      )
      continue
    }

    if (line.startsWith('## ')) {
      nodes.push(<p key={i} className="mt-4 mb-1 text-base font-bold">{line.slice(3)}</p>)
      i++
      continue
    }

    if (line.trim() === '') {
      nodes.push(<div key={i} className="h-2" />)
      i++
      continue
    }

    nodes.push(<p key={i} className="text-sm leading-relaxed">{inlineFormat(line)}</p>)
    i++
  }

  return nodes
}

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="rounded bg-muted px-1 py-0.5 text-xs font-mono">{part.slice(1, -1)}</code>
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{part.slice(2, -2)}</strong>
    return part
  })
}

// ─── Data table ───────────────────────────────────────────────────────────────

function DataTable({ data }: { data: unknown }) {
  if (!Array.isArray(data) || data.length === 0) return null
  const rows = data as Record<string, unknown>[]
  const keys = Object.keys(rows[0] || {}).filter((k) => k !== 'id')
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-border">
      <table className="min-w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            {keys.map((k) => (
              <th key={k} className="whitespace-nowrap px-4 py-2.5 text-left font-semibold text-muted-foreground capitalize">
                {k.replace(/([A-Z])/g, ' $1').trim()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-muted/30 transition-colors">
              {keys.map((k) => (
                <td key={k} className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                  {formatCell(row[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatCell(val: unknown): string {
  if (val == null) return '—'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val))
    return new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  return String(val)
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  const isError = Boolean(msg.error)
  const content = String(msg.content ?? '')

  return (
    <div className={cn('flex w-full gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {!isUser && (
        <div className="mt-1 flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className={cn(
        'max-w-[78%] rounded-2xl px-4 py-3 shadow-sm',
        isUser
          ? 'rounded-tr-sm bg-primary text-primary-foreground'
          : isError
            ? 'rounded-tl-sm bg-destructive/10 border border-destructive/20 text-destructive'
            : 'rounded-tl-sm bg-card border border-border text-foreground'
      )}>
        {isUser ? (
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{content}</p>
        ) : isError ? (
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p className="text-sm">{content}</p>
          </div>
        ) : (
          <div className="space-y-0.5 break-words min-w-0">
            {renderContent(content)}
            {msg.data ? <DataTable data={msg.data} /> : null}
          </div>
        )}
        <p className={cn('mt-1.5 text-right text-[10px]', isUser ? 'text-primary-foreground/60' : 'text-muted-foreground/60')}>
          {msg.createdAt
            ? new Date(msg.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
            : new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="flex gap-1 rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  )
}

// ─── Suggestions ──────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { icon: Clock, label: 'Show the last 10 maintenance records' },
  { icon: AlertTriangle, label: 'Show open problem reports' },
  { icon: Package, label: 'Show assets that need maintenance' },
  { icon: Sparkles, label: 'Show critical and high severity problems' },
  { icon: Wrench, label: 'Show technicians work history' },
  { icon: Bot, label: 'What can you help me with?' },
]

// ─── Sessions Sidebar ─────────────────────────────────────────────────────────

function SessionsSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onDelete,
  loading,
}: {
  sessions: ChatSession[]
  activeSessionId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  loading: boolean
}) {
  return (
    <div className="flex flex-col w-64 flex-shrink-0 border-r border-border bg-muted/30 h-full">
      <div className="p-3 border-b border-border">
        <button
          onClick={onCreate}
          disabled={loading}
          className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border bg-background px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-6 px-4">
            No conversations yet. Start a new chat!
          </p>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            className={cn(
              'group flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors',
              activeSessionId === s.id
                ? 'bg-primary/10 text-foreground'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            )}
            onClick={() => onSelect(s.id)}
          >
            <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="flex-1 text-xs truncate">{s.title}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(s.id) }}
              className="opacity-0 group-hover:opacity-100 flex-shrink-0 rounded p-0.5 hover:bg-destructive/10 hover:text-destructive transition-all"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AiAssistantPage() {
  const { user } = useAuthStore()

  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  // Load sessions on mount
  useEffect(() => {
    loadSessions()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length])

  const loadSessions = async () => {
    setSessionsLoading(true)
    try {
      const res = await api.get('/assistant/sessions')
      setSessions(res.data.data)
    } catch (e) {
      console.error('Failed to load sessions', e)
    } finally {
      setSessionsLoading(false)
    }
  }

  const loadMessages = async (sessionId: string) => {
    try {
      const res = await api.get(`/assistant/sessions/${sessionId}/messages`)
      setMessages(res.data.data)
    } catch (e) {
      console.error('Failed to load messages', e)
    }
  }

  const handleSelectSession = async (id: string) => {
    setActiveSessionId(id)
    setMessages([])
    await loadMessages(id)
    setTimeout(() => scrollToBottom(false), 100)
  }

  const handleCreateSession = async () => {
    setLoading(true)
    try {
      const res = await api.post('/assistant/sessions')
      const newSession: ChatSession = res.data.data
      setSessions((prev) => [newSession, ...prev])
      setActiveSessionId(newSession.id)
      setMessages([])
    } catch (e) {
      console.error('Failed to create session', e)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSession = async (id: string) => {
    if (!window.confirm('Delete this conversation?')) return
    try {
      await api.delete(`/assistant/sessions/${id}`)
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (activeSessionId === id) {
        setActiveSessionId(null)
        setMessages([])
      }
    } catch (e) {
      console.error('Failed to delete session', e)
    }
  }

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || loading) return

    // If no active session, create one first
    let sessionId = activeSessionId
    if (!sessionId) {
      try {
        const res = await api.post('/assistant/sessions')
        const newSession: ChatSession = res.data.data
        setSessions((prev) => [newSession, ...prev])
        setActiveSessionId(newSession.id)
        sessionId = newSession.id
      } catch (e) {
        console.error('Failed to create session', e)
        return
      }
    }

    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: msg,
    }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    // Add typing indicator
    const typingId = crypto.randomUUID()
    setMessages((prev) => [...prev, { id: typingId, role: 'assistant', content: '', typing: true }])

    try {
      const res = await api.post(`/assistant/sessions/${sessionId}/chat`, {
        message: msg,
        context: { page: '/assistant' },
      })

      // Replace typing indicator with real response
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.data.message,
        data: res.data.data,
        toolName: res.data.toolName,
      }
      setMessages((prev) => prev.filter((m) => m.id !== typingId).concat(assistantMsg))

      // Update session title if it was "New Chat"
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, title: s.title === 'New Chat' ? msg.slice(0, 60) : s.title, updatedAt: new Date().toISOString() }
            : s
        ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      )
    } catch (err: any) {
      setMessages((prev) =>
        prev.filter((m) => m.id !== typingId).concat({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: err?.response?.data?.error ?? 'Something went wrong. Please try again.',
          error: true,
        })
      )
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
  }

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 100)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden relative">
      <PageHeader
        title="AI Assistant"
        description="Ask about assets, maintenance, and reports"
        breadcrumbs={[{ label: 'AI Assistant' }]}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <SessionsSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={handleSelectSession}
          onCreate={handleCreateSession}
          onDelete={handleDeleteSession}
          loading={sessionsLoading}
        />

        {/* Chat area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="relative flex-1 overflow-y-auto px-6 py-6 space-y-4"
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">How can I help you today?</h2>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm text-center">
                  Ask me about maintenance records, assets, open reports, or site summaries.
                </p>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                  {SUGGESTIONS.map(({ icon: Icon, label }) => (
                    <button
                      key={label}
                      onClick={() => sendMessage(label)}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-left text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shadow-sm"
                    >
                      <Icon className="h-4 w-4 flex-shrink-0 text-primary" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) =>
                  msg.typing ? (
                    <TypingIndicator key={msg.id} />
                  ) : (
                    <MessageBubble key={msg.id} msg={msg} />
                  )
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {showScrollBtn && (
            <button
              onClick={() => scrollToBottom()}
              className="absolute bottom-28 right-8 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background shadow-md text-muted-foreground hover:bg-muted transition-colors"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}

          <div className="flex-shrink-0 border-t border-border bg-card px-6 py-4">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-end gap-3 rounded-2xl border border-border bg-background px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 transition-all">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about your assets and maintenance…"
                  rows={1}
                  disabled={loading}
                  autoFocus
                  className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground outline-none disabled:opacity-50 leading-relaxed max-h-[160px] overflow-y-auto"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className={cn(
                    'mb-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-all',
                    input.trim() && !loading
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground/60">
                Enter to send · Shift+Enter for a new line
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}