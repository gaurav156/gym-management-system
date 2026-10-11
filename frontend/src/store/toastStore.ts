import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
  title?: string
  duration: number // ms; 0 = stays until closed
}

interface ToastOptions { title?: string; duration?: number }

interface ToastState {
  toasts: ToastItem[]
  show: (type: ToastType, message: string, opts?: ToastOptions) => string
  dismiss: (id: string) => void
  clear: () => void
}

const MAX_TOASTS = 4
const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 4000, info: 4500, warning: 6000, error: 7000,
}

let counter = 0

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (type, message, opts) => {
    // Same message already on screen (e.g. a failing request retried) - don't stack duplicates.
    const existing = get().toasts.find((t) => t.type === type && t.message === message)
    if (existing) return existing.id

    const id = `toast-${++counter}`
    const item: ToastItem = { id, type, message, title: opts?.title, duration: opts?.duration ?? DEFAULT_DURATION[type] }
    set((s) => ({ toasts: [...s.toasts, item].slice(-MAX_TOASTS) }))
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}))

// Usable anywhere (components, utils, axios interceptors): toast.error('...')
export const toast = {
  success: (m: string, o?: ToastOptions) => useToastStore.getState().show('success', m, o),
  error: (m: string, o?: ToastOptions) => useToastStore.getState().show('error', m, o),
  warning: (m: string, o?: ToastOptions) => useToastStore.getState().show('warning', m, o),
  info: (m: string, o?: ToastOptions) => useToastStore.getState().show('info', m, o),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
}

// Pulls the readable message out of this backend's error shapes:
//  - { error: "..." }                      (GlobalExceptionHandler, IllegalArgumentException)
//  - { field: "message", ... }             (bean validation failures)
export function getErrorMessage(err: any, fallback = 'Something went wrong'): string {
  if (!err?.response) {
    return err?.request
      ? 'Network error - please check your connection and try again.'
      : (err?.message || fallback)
  }
  const data = err.response.data
  if (typeof data?.error === 'string') return data.error
  if (data && typeof data === 'object') {
    const values = Object.values(data).filter((v) => typeof v === 'string') as string[]
    if (values.length) return values.join('. ')
  }
  return fallback
}