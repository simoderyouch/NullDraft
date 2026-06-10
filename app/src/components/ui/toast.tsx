import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Info, X, Loader2 } from 'lucide-react'

type ToastVariant = 'success' | 'error' | 'info' | 'loading'

interface ToastItem {
  id: string
  title: string
  description?: string
  variant: ToastVariant
  duration: number
}

interface ToastOptions {
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Safe no-op fallback so calls never crash outside the provider.
    return { toast: () => '', dismiss: () => {} }
  }
  return ctx
}

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
  loading: Loader2,
}

const ACCENT = {
  success: 'text-green-400',
  error: 'text-red-400',
  info: 'text-blue-400',
  loading: 'text-primary',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((opts: ToastOptions) => {
    const id = Math.random().toString(36).slice(2)
    const item: ToastItem = {
      id,
      title: opts.title,
      description: opts.description,
      variant: opts.variant || 'info',
      duration: opts.duration ?? (opts.variant === 'loading' ? 0 : 4000),
    }
    setToasts((prev) => [...prev, item])
    if (item.duration > 0) {
      setTimeout(() => dismiss(id), item.duration)
    }
    return id
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = ICONS[t.variant]
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 40, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="glass-dark pointer-events-auto rounded-xl p-3.5 flex items-start gap-3 shadow-soft"
              >
                <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${ACCENT[t.variant]} ${t.variant === 'loading' ? 'animate-spin' : ''}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{t.title}</p>
                  {t.description && <p className="text-xs text-white/70 mt-0.5 break-words">{t.description}</p>}
                </div>
                <button onClick={() => dismiss(t.id)} className="text-white/40 hover:text-white transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
