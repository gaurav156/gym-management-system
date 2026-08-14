import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import type { AuthUser, Branch } from '../types'

export default function RegisterPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [branchId, setBranchId] = useState('')
  const [error, setError] = useState('')
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()

  useEffect(() => {
    // Public branch list endpoint - swap for a dedicated /api/public/branches if you'd
    // rather not expose the owner-only /api/branches list; kept simple for the MVP.
    api.get<Branch[]>('/api/public/branches').then((res) => setBranches(res.data)).catch(() => {})
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const { data } = await api.post<AuthUser>('/api/auth/register', {
        name, email, phone, password, branchId,
      })
      setUser(data)
      navigate('/member')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed')
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">Become a member</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Full name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Preferred branch</label>
          <select required value={branchId} onChange={(e) => setBranchId(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none">
            <option value="">Select a branch</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="w-full rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">
          Create account
        </button>
      </form>
    </div>
  )
}
