import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { getEffectiveStatus } from '../utils/membership'
import type { Membership, Plan, Payment } from '../types'

export default function MemberDashboard() {
  const user = useAuthStore((s) => s.user)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [message, setMessage] = useState('')
  const [loadError, setLoadError] = useState('')

  function loadMembershipData() {
    if (!user) return
    api.get<Membership[]>('/api/memberships/mine', { params: { memberId: user.userId } })
      .then((res) => setMemberships(res.data))
      .catch((err) => setLoadError(err.response?.data?.error || 'Failed to load your memberships'))

    api.get<Payment[]>('/api/payments/mine', { params: { memberId: user.userId } })
      .then((res) => setPayments(res.data))
      .catch((err) => setLoadError(err.response?.data?.error || 'Failed to load your payment history'))
  }

  useEffect(() => {
    if (!user) return
    loadMembershipData()

    // Purchases are recorded from the manager's screen, not this page - if a member
    // leaves this tab open, refetch when they come back to it so status doesn't go stale.
    function onFocus() { loadMembershipData() }
    window.addEventListener('focus', onFocus)

    // Plans are chain-wide now, not tied to the member's branch(es) - a single call covers it.
    api.get<Plan[]>('/api/plans')
      .then((res) => setPlans(res.data))
      .catch((err) => setLoadError(err.response?.data?.error || 'Failed to load plans'))

    return () => window.removeEventListener('focus', onFocus)
  }, [user])

  const activeMembership = memberships.find((m) => getEffectiveStatus(m) === 'ACTIVE')
  const pausedMembership = memberships.find((m) => getEffectiveStatus(m) === 'PAUSED')
  const upcomingMembership = memberships
    .filter((m) => getEffectiveStatus(m) === 'SCHEDULED')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]

  if (!user) return null

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
        <button onClick={loadMembershipData}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200">
          Refresh status
        </button>
      </div>
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
              <p className="font-medium text-green-700">Active</p>
              <p className="mt-1 text-gray-500">Valid until {activeMembership.endDate}</p>
              {upcomingMembership && (
                <p className="mt-1 text-xs text-gray-400">Next plan starts {upcomingMembership.startDate}</p>
              )}
            </div>
          ) : pausedMembership ? (
            <div className="mt-3 text-sm">
              <p className="font-medium text-amber-600">Paused</p>
              <p className="mt-1 text-gray-500">Visit the front desk to resume - your remaining time is preserved.</p>
            </div>
          ) : upcomingMembership ? (
            <div className="mt-3 text-sm">
              <p className="font-medium text-blue-600">Plan purchased - not yet active</p>
              <p className="mt-1 text-gray-500">Starts {upcomingMembership.startDate}. No gym access until then.</p>
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