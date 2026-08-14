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
    return Promise.reject(err)
  }
)
