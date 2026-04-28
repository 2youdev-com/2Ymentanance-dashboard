// src/components/assistant/AiChatPanel.tsx
//
// Slide-in chat panel rendered inside Layout.
// Features:
//   1. Per-user conversation isolation via useChatStore keyed by userId.
//   2. Conversation history sent to backend for context-aware responses.
//   3. Context (current page) passed to backend.
//   4. Rich markdown rendering: code blocks, lists, bold, headings.
//   5. Data table for structured tool results.

import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { Bot, Send, Trash2, Loader2, AlertCircle, ChevronDown } from 'lucide-react'
import { useAuthStore, useChatStore, uuid, type ChatMessage } from '@/store'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

// ─── Markdown-like renderer ───────────────────────────────────────────────────

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
        <pre
          key={i}
          className="my-2 overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs text-green-300 font-mono leading-relaxed"
        >
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
        <ul key={i} className="my-1 ml-4 space-y-0.5 list-disc">
          {items.map((item, j) => (
            <li key={j} className="text-sm leading-relaxed">
              {inlineFormat(item)}
            </li>
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
        <ol key={i} className="my-1 ml-4 space-y-0.5 list-decimal">
          {items.map((item, j) => (
            <li key={j} className="text-sm leading-relaxed">
              {inlineFormat(item)}
            </li>
          ))}
        </ol>
      )

      continue
    }

    if (line.startsWith('## ')) {
      nodes.push(
        <p key={i} className="mt-3 mb-1 text-sm font-bold text-foreground">
          {line.slice(3)}
        </p>
      )
      i++
      continue
    }

    if (line.trim() === '') {
      nodes.push(<div key={i} className="h-1.5" />)
      i++
      continue
    }

    nodes.push(
      <p key={i} className="text-sm leading-relaxed">
        {inlineFormat(line)}
      </p>
    )

    i++
  }

  return nodes
}

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)

  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="rounded bg-muted px-1 py-0.5 text-xs font-mono text-foreground"
        >
          {part.slice(1, -1)}
        </code>
      )
    }

    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }

    return part
  })
}

// ─── Data table ───────────────────────────────────────────────────────────────

function DataTable({ data }: { data: any }) {
  if (!Array.isArray(data) || data.length === 0) return null

  const keys = Object.keys(data[0] || {}).filter((k) => !['id'].includes(k))

  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-xs">
        <thead className="bg-muted/60">
          <tr>
            {keys.map((k) => (
              <th
                key={k}
                className="whitespace-nowrap px-3 py-2 text-left font-semibold text-muted-foreground capitalize"
              >
                {k.replace(/([A-Z])/g, ' $1').trim()}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-border">
          {(data as Record<string, unknown>[]).map((row, i) => (
            <tr key={i} className="hover:bg-muted/30 transition-colors">
              {keys.map((k) => (
                <td key={k} className="whitespace-nowrap px-3 py-2 text-muted-foreground">
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
  if (val === null || val === undefined) return '—'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'

  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
    return new Date(val).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  return String(val)
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  const isError = msg.error

  return (
    <div className={cn('flex w-full gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {!isUser && (
        <div className="mt-0.5 flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}

      <div
        className={cn(
          'max-w-[82%] rounded-2xl px-3.5 py-2.5',
          isUser
            ? 'rounded-tr-sm bg-primary text-primary-foreground'
            : isError
              ? 'rounded-tl-sm bg-destructive/10 border border-destructive/20 text-destructive'
              : 'rounded-tl-sm bg-muted text-foreground'
        )}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
            {msg.content}
          </p>
        ) : isError ? (
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p className="text-sm">{msg.content}</p>
          </div>
        ) : (
          <div className="space-y-0.5 break-words">
            {renderContent(msg.content)}
            {msg.data && <DataTable data={msg.data as any} />}
          </div>
        )}

        <p
          className={cn(
            'mt-1 text-right text-[10px] leading-none',
            isUser ? 'text-primary-foreground/60' : 'text-muted-foreground/70'
          )}
        >
          {new Date(msg.timestamp).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-1">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
        <Bot className="h-4 w-4 text-primary" />
      </div>

      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-3.5 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Quick suggestions ────────────────────────────────────────────────────────

const QUICK_SUGGESTIONS = [
  'Show the last 10 maintenance records',
  'Show open problem reports',
  'Show assets that need maintenance',
]

// ─── Main Chat Panel ──────────────────────────────────────────────────────────

export function AiChatPanel() {
  const { isOpen, setOpen, getMessages, addMessage, updateLastMessage, clearConversation } =
    useChatStore()
  const { user } = useAuthStore()
  const location = useLocation()

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const userId = user?.id ?? '__guest__'
  const messages = getMessages(userId)

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'instant',
    })
  }, [])

  useEffect(() => {
    if (isOpen) {
      scrollToBottom(false)
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen, scrollToBottom])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  const handleScroll = () => {
    const el = scrollContainerRef.current
    if (!el) return

    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120)
  }

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()

    if (!text || loading) return

    setInput('')

    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    const userMsg: ChatMessage = {
      id: uuid(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    addMessage(userId, userMsg)
    setLoading(true)

    const placeholderMsg: ChatMessage = {
      id: uuid(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }

    addMessage(userId, placeholderMsg)

    // Build conversation history to send.
    const currentMessages = getMessages(userId)

    const history = currentMessages
      .filter((m) => m.content && !m.error)
      .slice(-21, -1)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }))

    try {
      const res = await api.post('/assistant/chat', {
        message: text,
        context: { page: location.pathname },
        history,
      })

      const { message: msg, data, toolName } = res.data

      updateLastMessage(userId, {
        content: msg,
        data,
        toolName,
      })
    } catch (err: any) {
      const errText = err?.response?.data?.error ?? 'Something went wrong. Please try again.'

      updateLastMessage(userId, {
        content: errText,
        error: true,
      })
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

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
  }

  const handleClear = () => {
    if (window.confirm('Clear this conversation?')) {
      clearConversation(userId)
    }
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={cn(
          'fixed bottom-0 right-0 z-20 flex flex-col',
          'w-full sm:w-[420px] h-[600px] sm:h-[640px] sm:bottom-6 sm:right-24',
          'rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-2xl',
          'transition-all duration-300 ease-in-out',
          isOpen
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : 'translate-y-4 opacity-0 pointer-events-none'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-2xl border-b border-border bg-card px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>

            <div>
              <p className="text-sm font-semibold leading-none">AI Assistant</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {user?.fullName ?? 'Guest'} · {user?.role ?? ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                title="Clear conversation"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="relative flex-1 overflow-y-auto px-3 py-4 space-y-3"
        >
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center px-6">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-7 w-7 text-primary" />
              </div>

              <p className="text-sm font-semibold text-foreground">How can I help you?</p>

              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Ask me about maintenance records, problem reports, asset status, or site summaries.
              </p>

              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {QUICK_SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) =>
            msg.role === 'assistant' && msg.content === '' ? (
              <TypingIndicator key={msg.id} />
            ) : (
              <MessageBubble key={msg.id} msg={msg} />
            )
          )}

          <div ref={messagesEndRef} />
        </div>

        {showScrollBtn && (
          <button
            onClick={() => scrollToBottom()}
            className="absolute bottom-20 right-4 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background shadow-md text-muted-foreground hover:bg-muted transition-colors"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}

        {/* Input */}
        <div className="flex-shrink-0 border-t border-border bg-card px-3 py-3 rounded-b-2xl">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything…"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50 leading-relaxed max-h-[140px] overflow-y-auto"
              style={{ height: 'auto' }}
            />

            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className={cn(
                'mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all',
                input.trim() && !loading
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>

          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/60">
            Enter to send · Shift+Enter for a new line
          </p>
        </div>
      </div>
    </>
  )
}