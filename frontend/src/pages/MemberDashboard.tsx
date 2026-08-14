import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import type { Membership, Plan, Branch, Payment } from '../types'

export default function MemberDashboard() {
  const user = useAuthStore((s) => s.user)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [message, setMessage] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!user) return

    api.get<Membership[]>('/api/memberships/mine', { params: { memberId: user.userId } })
      .then((res) => setMemberships(res.data))
      .catch((err) => setLoadError(err.response?.data?.error || 'Failed to load your memberships'))

    api.get<Payment[]>('/api/payments/mine', { params: { memberId: user.userId } })
      .then((res) => setPayments(res.data))
      .catch((err) => setLoadError(err.response?.data?.error || 'Failed to load your payment history'))

    // Use the member's own branch assignment(s) - not an arbitrary/first branch overall -
    // so plans shown here always match where this member actually signed up.
    api.get<Branch[]>('/api/branches/mine', { params: { userId: user.userId } })
      .then(async (res) => {
        setBranches(res.data)
        if (res.data.length === 0) return
        const perBranch = await Promise.all(
          res.data.map((b) => api.get<Plan[]>('/api/plans', { params: { branchId: b.id } }))
        )
        setPlans(perBranch.flatMap((r) => r.data))
      })
      .catch((err) => setLoadError(err.response?.data?.error || 'Failed to load plans for your branch'))
  }, [user])

  const activeMembership = memberships.find((m) => m.status === 'ACTIVE')

  if (!user) return null

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
      {loadError && <p className="mt-2 text-sm text-red-600">{loadError}</p>}

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
        <p className="mt-1 text-xs text-gray-500">
          Memberships are activated at the front desk against cash payment - show your QR code or tell the manager your PIN.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {plans.map((p) => (
            <div key={p.id} className="rounded-md border border-gray-200 p-4 text-center">
              <p className="font-medium">{p.name}</p>
              <p className="mt-1 text-2xl font-semibold">₹{p.price}</p>
              <p className="mt-1 text-xs text-gray-400">{p.durationMonths} month{p.durationMonths > 1 ? 's' : ''}</p>
            </div>
          ))}
          {plans.length === 0 && <p className="text-sm text-gray-400">No plans published yet.</p>}
        </div>
        {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 p-6">
        <h2 className="font-medium">Your payment history</h2>
        <ul className="mt-4 divide-y divide-gray-100 text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex justify-between py-2">
              <span>{p.planName ?? 'Payment'} - {new Date(p.createdAt).toLocaleDateString()}</span>
              <span className="text-gray-500">₹{p.amount} ({p.mode})</span>
            </li>
          ))}
          {payments.length === 0 && <li className="py-2 text-gray-400">No payments recorded yet.</li>}
        </ul>
      </div>
    </div>
  )
}