import { useCallback, useState } from 'react'

export const TAB_STORAGE_PREFIX = 'gym-app-tab:'

// Drop-in replacement for useState for a page's active tab. The value survives a reload and
// is validated against `allowed`, so a stale/invalid stored value just falls back to `fallback`.
export function usePersistedTab<T extends string>(pageKey: string, allowed: readonly T[], fallback: T) {
  const storageKey = TAB_STORAGE_PREFIX + pageKey

  const [tab, setTabState] = useState<T>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey)
      return saved && (allowed as readonly string[]).includes(saved) ? (saved as T) : fallback
    } catch {
      return fallback
    }
  })

  const setTab = useCallback((next: T) => {
    setTabState(next)
    try { sessionStorage.setItem(storageKey, next) } catch { /* storage unavailable - tab still works */ }
  }, [storageKey])

  return [tab, setTab] as const
}