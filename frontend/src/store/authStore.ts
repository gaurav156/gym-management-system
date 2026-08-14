import { create } from 'zustand'
import type { AuthUser } from '../types'

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
    set({ user })
  },
  logout: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ user: null })
  },
}))
