import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import type { Membership, Plan, Branch } from '../types'

export default function MemberDashboard() {
  const user = useAuthStore((s) => s.user)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user) return
    api.get<Membership[]>('/api/memberships/mine', { params: { memberId: user.userId } })
      .then((res) => setMemberships(res.data))
    // Public branch list to discover plans across locations
    api.get<Branch[]>('/api/branches').then((res) => {
      setBranches(res.data)
      if (res.data.length > 0) {
        api.get<Plan[]>('/api/plans', { params: { branchId: res.data[0].id } }).then((r) => setPlans(r.data))
      }
    })
  }, [user])

  async function purchase(planId: string) {
    if (!user) return
    setMessage('')
    try {
      await api.post('/api/memberships/purchase', { planId }, { params: { memberId: user.userId } })
      setMessage('Membership purchased! (Payment recorded as cash at the front desk for now.)')
      const res = await api.get<Membership[]>('/api/memberships/mine', { params: { memberId: user.userId } })
      setMemberships(res.data)
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Purchase failed')
    }
  }

  const activeMembership = memberships.find((m) => m.status === 'ACTIVE')

  if (!user) return null

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-6 text-center">
          <h2 className="font-medium">Your check-in code</h2>
          <p className="mt-1 text-xs text-gray-500">Scan this at the gym, or use your 4-digit PIN at reception.</p>
          <div className="mt-4 flex justify-center">
            <QRCodeSVG value={user.userId} size={160} />
          </div>
          <p className="mt-3 text-xs text-gray-400">
            (PIN is shown at the reception desk on first visit for security - not displayed here.)
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 p-6">
          <h2 className="font-medium">Membership status</h2>
          {activeMembership ? (
            <div className="mt-3 text-sm">
              <p className="font-medium text-green-700">Active - {activeMembership.planName}</p>
              <p className="mt-1 text-gray-500">Valid until {activeMembership.endDate}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-red-600">No active membership - purchase a plan to get gym access.</p>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 p-6">
        <h2 className="font-medium">Available plans</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {plans.map((p) => (
            <div key={p.id} className="rounded-md border border-gray-200 p-4 text-center">
              <p className="font-medium">{p.name}</p>
              <p className="mt-1 text-2xl font-semibold">₹{p.price}</p>
              <button onClick={() => purchase(p.id)}
                className="mt-3 w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark">
                Purchase
              </button>
            </div>
          ))}
          {plans.length === 0 && <p className="text-sm text-gray-400">No plans published yet.</p>}
        </div>
        {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
      </div>
    </div>
  )
}
