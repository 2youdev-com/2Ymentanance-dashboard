// src/components/assistant/AiFloatingButton.tsx
//
// The floating AI button that appears on every page (inside Layout).
// Clicking it toggles the chat panel open/closed.

import { Bot, X } from 'lucide-react'
import { useChatStore } from '@/store'
import { cn } from '@/lib/utils'

export function AiFloatingButton() {
  const { isOpen, toggleOpen } = useChatStore()

  return (
    <button
      onClick={toggleOpen}
      aria-label={isOpen ? 'Close AI assistant' : 'Open AI assistant'}
      className={cn(
        // Position — sits above any scrollbar, doesn't cover sidebar
        'fixed bottom-6 right-6 z-30',
        // Size & shape
        'flex h-14 w-14 items-center justify-center rounded-full shadow-lg',
        // Smooth transition between open/closed states
        'transition-all duration-200 ease-in-out',
        // Colors
        isOpen
          ? 'bg-muted text-muted-foreground hover:bg-muted/80 border border-border'
          : 'bg-primary text-primary-foreground hover:bg-primary/90',
        // Subtle pop on hover
        'hover:scale-105 active:scale-95',
      )}
    >
      {isOpen ? (
        <X className="h-5 w-5" />
      ) : (
        <Bot className="h-6 w-6" />
      )}
    </button>
  )
}