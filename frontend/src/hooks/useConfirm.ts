import { useState, useCallback } from 'react'

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => Promise<void> | void
}

// Centralizes the open/loading state a ConfirmDialog needs, so callers don't each
// reinvent "which item is pending confirmation" + "is the confirm action in flight".
export function useConfirm() {
  const [pending, setPending] = useState<ConfirmOptions | null>(null)
  const [loading, setLoading] = useState(false)

  const confirm = useCallback((options: ConfirmOptions) => setPending(options), [])
  const cancel = useCallback(() => { if (!loading) setPending(null) }, [loading])

  async function handleConfirm() {
    if (!pending) return
    setLoading(true)
    try {
      await pending.onConfirm()
      setPending(null)
    } finally {
      setLoading(false)
    }
  }

  return {
    confirm,
    dialogProps: pending
      ? {
          open: true,
          title: pending.title,
          message: pending.message,
          confirmLabel: pending.confirmLabel,
          danger: pending.danger,
          loading,
          onConfirm: handleConfirm,
          onCancel: cancel,
        }
      : { open: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {} },
  }
}