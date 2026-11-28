import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { icons } from '../icons'

type Toast = { id: number; message: ReactNode; tone: 'done' | 'error' }

type ToastApi = {
  /** A short confirmation with the button's verb ("Suspended Leo Martin.", "Priya Nair is now an Editor."). */
  done: (message: ReactNode) => void
  /** Something failed: what, and what to do. Stays until dismissed. */
  error: (message: ReactNode) => void
}

const ToastContext = createContext<ToastApi | null>(null)

/** Toasts for the admin (AdminShell provides them): `const toast = useToast(); toast.done('Saved.')`. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast must be used inside <AdminShell>.')
  return api
}

/**
 * Holds the toasts and shows them: dark, short, with the sun tick; bottom right on desktop, above the
 * dock on phones. Announced politely to screen readers. A done toast leaves after 4 seconds.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const next = useRef(1)
  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), [])
  const add = useCallback((message: ReactNode, tone: Toast['tone']) => {
    const id = next.current++
    setToasts((all) => [...all.slice(-2), { id, message, tone }])
  }, [])
  const api = useRef<ToastApi>({ done: (m) => add(m, 'done'), error: (m) => add(m, 'error') })
  return (
    <ToastContext.Provider value={api.current}>
      {children}
      <div className="ja-toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    if (toast.tone !== 'done') return
    const timer = setTimeout(onDismiss, 4000)
    return () => clearTimeout(timer)
  }, [toast.tone, onDismiss])
  return (
    <div className="ja-toast" data-tone={toast.tone}>
      <span className="ja-toast-mark" aria-hidden="true">
        {toast.tone === 'done' ? <icons.check /> : '!'}
      </span>
      <span>{toast.message}</span>
      {toast.tone === 'error' && (
        <button type="button" className="ja-toast-close" aria-label="Dismiss" onClick={onDismiss}>
          <icons.close />
        </button>
      )}
    </div>
  )
}
