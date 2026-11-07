import { useCallback, useState } from 'react'
import { TAB_STORAGE_PREFIX } from './usePersistedTab'

// Like useState<string | null>, but survives a reload (sessionStorage). Uses the same key
// prefix as usePersistedTab, so authStore.logout() already clears it.
export function usePersistedState(key: string, initial: string | null = null) {
  const storageKey = TAB_STORAGE_PREFIX + key

  const [value, setValue] = useState<string | null>(() => {
    try { return sessionStorage.getItem(storageKey) ?? initial } catch { return initial }
  })

  const set = useCallback((next: string | null) => {
    setValue(next)
    try {
      if (next === null) sessionStorage.removeItem(storageKey)
      else sessionStorage.setItem(storageKey, next)
    } catch { /* storage unavailable - modal still works, just won't survive a reload */ }
  }, [storageKey])

  return [value, set] as const
}