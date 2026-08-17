import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import type { AuthUser } from '../types'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const { data } = await api.post<AuthUser>('/api/auth/login', { email, password })
      setUser(data)
      const path = data.role === 'OWNER' ? '/owner'
        : data.role === 'MANAGER' ? '/manager'
        : data.role === 'TRAINER' ? '/profile'
        : '/member'
      navigate(path)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed')
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="w-full rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">
          Log in
        </button>
      </form>
    </div>
  )
}