import { useEffect, useRef, useState } from 'react'
import { useToastStore, type ToastItem, type ToastType } from '../store/toastStore'

// Full literal class names so Tailwind keeps them.
const STYLES: Record<ToastType, { box: string; icon: string; bar: string }> = {
  success: { box: 'border-green-200 bg-green-50 text-green-900', icon: 'text-green-600', bar: 'bg-green-500' },
  error:   { box: 'border-red-200 bg-red-50 text-red-900',       icon: 'text-red-600',   bar: 'bg-red-500' },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: 'text-amber-600', bar: 'bg-amber-500' },
  info:    { box: 'border-blue-200 bg-blue-50 text-blue-900',    icon: 'text-blue-600',  bar: 'bg-blue-500' },
}

function TypeIcon({ type }: { type: ToastType }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...common} aria-hidden="true">
      {type === 'success' && (<><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.8" /></>)}
      {type === 'error' && (<><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></>)}
      {type === 'warning' && (<><path d="M12 3.5l9.5 16.5h-19L12 3.5z" /><path d="M12 10v4M12 17.2v.1" /></>)}
      {type === 'info' && (<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.8v.1" /></>)}
    </svg>
  )
}

function Toast({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss)
  const [paused, setPaused] = useState(false)
  const remaining = useRef(item.duration)
  const startedAt = useRef(0)
  const s = STYLES[item.type]

  // Auto-dismiss, pausing while hovered/focused so people can finish reading.
  useEffect(() => {
    if (item.duration === 0 || paused) return
    startedAt.current = Date.now()
    const handle = setTimeout(() => dismiss(item.id), remaining.current)
    return () => {
      clearTimeout(handle)
      remaining.current -= Date.now() - startedAt.current
    }
  }, [paused, item.id, item.duration, dismiss])

  return (
    <div
      role={item.type === 'error' || item.type === 'warning' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`animate-toast-in pointer-events-auto relative overflow-hidden rounded-lg border shadow-lg ${s.box}`}
    >
      <div className="flex items-start gap-3 p-3 pr-2">
        <span className={`mt-0.5 flex-shrink-0 ${s.icon}`}><TypeIcon type={item.type} /></span>
        <div className="min-w-0 flex-1 text-sm">
          {item.title && <p className="font-semibold">{item.title}</p>}
          <p className="break-words">{item.message}</p>
        </div>
        <button
          type="button"
          onClick={() => dismiss(item.id)}
          aria-label="Close notification"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md opacity-60 hover:bg-black/5 hover:opacity-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {item.duration > 0 && (
        <div className="h-0.5 w-full bg-black/5">
          <div
            className={`h-full origin-left ${s.bar} animate-toast-progress`}
            style={{ animationDuration: `${item.duration}ms`, animationPlayState: paused ? 'paused' : 'running' }}
          />
        </div>
      )}
    </div>
  )
}

// Mobile: full-width stack pinned to the top (below the notch via safe-area inset).
// sm and up: fixed 24rem column in the top-right corner. z-[90] sits above modals (z-70).
export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex flex-col gap-2 p-3 sm:left-auto sm:right-0 sm:w-96 sm:p-4"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      {toasts.map((t) => <Toast key={t.id} item={t} />)}
    </div>
  )
}