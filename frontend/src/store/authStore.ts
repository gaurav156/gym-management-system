import { create } from 'zustand'
import type { AuthUser } from '../types'
import { TAB_STORAGE_PREFIX } from '../hooks/usePersistedTab'
import { queryClient } from '../api/queryClient'

interface AuthState {
  user: AuthUser | null
  setUser: (user: AuthUser) => void
  logout: () => void
}

const STORAGE_KEY = 'gym-app-auth'

function loadFromStorage(): AuthUser | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : null
}

export const useAuthStore = create<AuthState>((set) => ({
  user: loadFromStorage(),
  setUser: (user) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    queryClient.clear()
    set({ user })
  },
  logout: () => {
    localStorage.removeItem(STORAGE_KEY)
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(TAB_STORAGE_PREFIX))
      .forEach((k) => sessionStorage.removeItem(k))
    queryClient.clear()  
    set({ user: null })
  },
}))
