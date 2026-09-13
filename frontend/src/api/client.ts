import axios from 'axios'
import { useAuthStore } from '../store/authStore'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080',
})

// Attach the JWT to every outgoing request automatically
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().user?.token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// If the token is rejected, log the user out so they're sent back to /login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
    }

    // A 403 on an authenticated request means the JWT is still cryptographically valid
    // but its embedded role no longer matches what the backend enforces - the most
    // likely cause is the Owner changing this person's role after the token was issued
    // (see RoleChangeService). 401 handling above won't catch this since the token
    // itself hasn't expired. Rather than leaving the person on a dashboard full of
    // silent "Failed to load..." errors that don't explain why, force a full logout and
    // reload straight to login with a reason the UI can surface clearly. A full page
    // navigation (not react-router) is deliberate here - this runs outside the component
    // tree, and a hard reload guarantees no stale dashboard state lingers.
    if (err.response?.status === 403 && useAuthStore.getState().user) {
      useAuthStore.getState().logout()
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?reason=access-changed'
      }
    }

    return Promise.reject(err)
  }
)