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

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const hadUser = !!useAuthStore.getState().user

    // 401 = no valid, unexpired JWT at all on this request - almost always because the
    // token simply expired while the person was away (see SecurityConfig's
    // authenticationEntryPoint). This is a routine "please log back in", not anything
    // about the account itself changing.
    if (err.response?.status === 401 && hadUser) {
      useAuthStore.getState().logout()
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?reason=session-expired'
      }
    }

    // 403 = the JWT is still cryptographically valid and unexpired, but its embedded
    // role no longer matches what the backend enforces - the most likely cause is the
    // Owner changing this person's role after the token was issued (see
    // RoleChangeService). Distinct from 401 above precisely because the token hasn't
    // expired; this really is an access change, not a stale session.
    if (err.response?.status === 403 && hadUser) {
      useAuthStore.getState().logout()
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?reason=access-changed'
      }
    }

    return Promise.reject(err)
  }
)