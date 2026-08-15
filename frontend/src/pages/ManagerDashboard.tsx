import { FormEvent, useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import type { Branch, Plan, Payment, MembershipAdmin } from '../types'

interface HourlyCount { hour: number; count: number }
interface MemberSummary { id: string; name: string; email: string; checkinPin: string | null }

const PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'CHEQUE', 'BANK_TRANSFER']

export default function ManagerDashboard() {
  const user = useAuthStore((s) => s.user)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [plans, setPlans] = useState<Plan[]>([])
  const [summary, setSummary] = useState<HourlyCount[]>([])
  const [members, setMembers] = useState<MemberSummary[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [memberships, setMemberships] = useState<MembershipAdmin[]>([])

  const [planName, setPlanName] = useState('')
  const [planMonths, setPlanMonths] = useState(1)
  const [planPrice, setPlanPrice] = useState('')

  const [checkinPin, setCheckinPin] = useState('')
  const [checkinMessage, setCheckinMessage] = useState('')
  const [planError, setPlanError] = useState('')
  const [branchLoadError, setBranchLoadError] = useState('')

  const [purchaseMemberId, setPurchaseMemberId] = useState('')
  const [purchasePlanId, setPurchasePlanId] = useState('')
  const [purchaseMode, setPurchaseMode] = useState('CASH')
  const [purchaseStartDate, setPurchaseStartDate] = useState('')
  const [purchaseMessage, setPurchaseMessage] = useState('')
  const [membershipActionMessage, setMembershipActionMessage] = useState('')

  useEffect(() => {
    if (!user) return
    // Owner has implicit access to every branch (no branch_assignments row of their own);
    // a Manager only sees branches they're actually assigned to.
    const request = user.role === 'OWNER'
      ? api.get<Branch[]>('/api/branches')
      : api.get<Branch[]>('/api/branches/mine', { params: { userId: user.userId } })

    request
      .then((res) => {
        setBranches(res.data)
        if (res.data.length > 0) setSelectedBranch(res.data[0].id)
      })
      .catch((err) => {
        setBranchLoadError(err.response?.data?.error || 'Failed to load branches - check the backend logs.')
      })
  }, [user])

  function loadPayments() {
    if (!selectedBranch) return
    api.get<Payment[]>(`/api/payments/branch/${selectedBranch}`).then((res) => setPayments(res.data))
  }

  function loadMemberships() {
    if (!selectedBranch) return
    api.get<MembershipAdmin[]>(`/api/memberships/branch/${selectedBranch}`).then((res) => setMemberships(res.data))
  }

  useEffect(() => {
    if (!selectedBranch) return
    api.get<Plan[]>('/api/plans', { params: { branchId: selectedBranch } }).then((res) => setPlans(res.data))
    api.get<HourlyCount[]>(`/api/attendance/summary/${selectedBranch}`).then((res) => setSummary(res.data))
    api.get<MemberSummary[]>('/api/members', { params: { branchId: selectedBranch } }).then((res) => setMembers(res.data))
    loadPayments()
    loadMemberships()
  }, [selectedBranch])

  async function createPlan(e: FormEvent) {
    e.preventDefault()
    setPlanError('')

    if (!selectedBranch) {
      setPlanError('No branch is selected yet - make sure your manager account is assigned to a branch.')
      return
    }
    if (!planPrice || Number.isNaN(Number(planPrice))) {
      setPlanError('Enter a valid price.')
      return
    }

    try {
      await api.post('/api/plans/manage', {
        branchId: selectedBranch, name: planName, durationMonths: planMonths, price: Number(planPrice),
      })
      setPlanName(''); setPlanPrice('')
      const res = await api.get<Plan[]>('/api/plans', { params: { branchId: selectedBranch } })
      setPlans(res.data)
    } catch (err: any) {
      setPlanError(err.response?.data?.error || JSON.stringify(err.response?.data) || 'Failed to create plan')
    }
  }

  async function kioskCheckin(e: FormEvent) {
    e.preventDefault()
    setCheckinMessage('')
    try {
      const { data } = await api.post('/api/attendance/checkin', {
        pin: checkinPin, branchId: selectedBranch, method: 'PIN',
      })
      setCheckinMessage(data.message)
      setCheckinPin('')
    } catch (err: any) {
      setCheckinMessage(err.response?.data?.error || 'Check-in failed')
    }
  }

  async function recordPurchase(e: FormEvent) {
    e.preventDefault()
    setPurchaseMessage('')
    if (!purchaseMemberId || !purchasePlanId) {
      setPurchaseMessage('Select a member and a plan.')
      return
    }
    try {
      const { data } = await api.post(
        '/api/memberships/purchase',
        {
          planId: purchasePlanId,
          mode: purchaseMode,
          startDate: purchaseStartDate || null,
        },
        { params: { memberId: purchaseMemberId } }
      )
      setPurchaseMessage(`Recorded - valid until ${data.endDate}.`)
      setPurchaseMemberId(''); setPurchasePlanId(''); setPurchaseStartDate('')
      loadPayments()
      loadMemberships()
    } catch (err: any) {
      setPurchaseMessage(err.response?.data?.error || 'Failed to record purchase')
    }
  }

  async function cancelMembership(id: string) {
    if (!confirm('Cancel this membership? The member will lose gym access immediately.')) return
    setMembershipActionMessage('')
    try {
      await api.post(`/api/memberships/${id}/cancel`)
      loadMemberships()
    } catch (err: any) {
      setMembershipActionMessage(err.response?.data?.error || 'Failed to cancel')
    }
  }

  async function pauseMembership(id: string) {
    setMembershipActionMessage('')
    try {
      await api.post(`/api/memberships/${id}/pause`)
      loadMemberships()
    } catch (err: any) {
      setMembershipActionMessage(err.response?.data?.error || 'Failed to pause')
    }
  }

  async function resumeMembership(id: string) {
    setMembershipActionMessage('')
    try {
      await api.post(`/api/memberships/${id}/resume`)
      loadMemberships()
    } catch (err: any) {
      setMembershipActionMessage(err.response?.data?.error || 'Failed to resume')
    }
  }

  async function editMembership(id: string, currentEndDate: string) {
    const newEndDate = prompt('New end date (YYYY-MM-DD):', currentEndDate)
    if (!newEndDate) return
    setMembershipActionMessage('')
    try {
      await api.put(`/api/memberships/${id}`, { endDate: newEndDate })
      loadMemberships()
    } catch (err: any) {
      setMembershipActionMessage(err.response?.data?.error || 'Failed to update')
    }
  }

  const maxCount = Math.max(1, ...summary.map((s) => s.count))

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">
        {user?.role === 'OWNER' ? 'Branch operations (Owner view)' : 'Manager dashboard'}
      </h1>
      {branchLoadError && <p className="mt-2 text-sm text-red-600">{branchLoadError}</p>}

      {branches.length > 1 && (
        <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}
          className="mt-4 rounded-md border border-gray-300 px-3 py-2 text-sm">
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-6">
          <h2 className="font-medium">Reception check-in (PIN)</h2>
          <p className="mt-1 text-xs text-gray-500">Enter the member's 4-digit PIN to log their visit.</p>
          <form onSubmit={kioskCheckin} className="mt-4 flex gap-2">
            <input placeholder="1234" maxLength={4} required value={checkinPin}
              onChange={(e) => setCheckinPin(e.target.value.replace(/\D/g, ''))}
              className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm tracking-widest" />
            <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
              Check in
            </button>
          </form>
          {checkinMessage && <p className="mt-3 text-sm text-gray-700">{checkinMessage}</p>}
        </div>

        <div className="rounded-lg border border-gray-200 p-6">
          <h2 className="font-medium">Record a membership purchase</h2>
          <p className="mt-1 text-xs text-gray-500">Cash collected at the front desk - members can't self-purchase.</p>
          <form onSubmit={recordPurchase} className="mt-4 space-y-3">
            <select required value={purchaseMemberId} onChange={(e) => setPurchaseMemberId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select member</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.email}) - PIN {m.checkinPin ?? '—'}</option>
              ))}
            </select>
            <select required value={purchasePlanId} onChange={(e) => setPurchasePlanId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select plan</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} - ₹{p.price}</option>)}
            </select>
            <select required value={purchaseMode} onChange={(e) => setPurchaseMode(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
            </select>
            <div>
              <label className="text-xs text-gray-500">Start date (only used if member has no active plan)</label>
              <input type="date" value={purchaseStartDate} onChange={(e) => setPurchaseStartDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
              Record purchase
            </button>
            {purchaseMessage && <p className="text-sm text-gray-700">{purchaseMessage}</p>}
          </form>
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 p-6">
        <h2 className="font-medium">Payment history</h2>
        <p className="mt-1 text-xs text-gray-500">All cash collected at this branch, most recent first.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Member</th>
                <th className="pb-2 pr-4">Plan</th>
                <th className="pb-2 pr-4">Amount</th>
                <th className="pb-2 pr-4">Mode</th>
                <th className="pb-2">Recorded by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-4 text-gray-500">{new Date(p.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-4">{p.memberName}</td>
                  <td className="py-2 pr-4">{p.planName ?? '—'}</td>
                  <td className="py-2 pr-4">₹{p.amount}</td>
                  <td className="py-2 pr-4">{p.mode}</td>
                  <td className="py-2">{p.recordedByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {payments.length === 0 && <p className="py-4 text-sm text-gray-400">No payments recorded yet.</p>}
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 p-6">
        <h2 className="font-medium">Manage memberships</h2>
        <p className="mt-1 text-xs text-gray-500">Pause, resume, cancel, or correct a member's dates.</p>
        {membershipActionMessage && <p className="mt-2 text-sm text-red-600">{membershipActionMessage}</p>}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="pb-2 pr-4">Member</th>
                <th className="pb-2 pr-4">Plan</th>
                <th className="pb-2 pr-4">Start</th>
                <th className="pb-2 pr-4">End</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {memberships.map((m) => (
                <tr key={m.id}>
                  <td className="py-2 pr-4">{m.memberName}</td>
                  <td className="py-2 pr-4">{m.planName}</td>
                  <td className="py-2 pr-4 text-gray-500">{m.startDate}</td>
                  <td className="py-2 pr-4 text-gray-500">{m.endDate}</td>
                  <td className="py-2 pr-4">
                    <span className={
                      m.status === 'ACTIVE' ? 'text-green-700' :
                      m.status === 'PAUSED' ? 'text-amber-600' :
                      'text-gray-400'
                    }>{m.status}</span>
                  </td>
                  <td className="py-2 space-x-2 whitespace-nowrap">
                    {m.status === 'ACTIVE' && (
                      <button onClick={() => pauseMembership(m.id)} className="text-xs text-amber-600 hover:underline">
                        Pause
                      </button>
                    )}
                    {m.status === 'PAUSED' && (
                      <button onClick={() => resumeMembership(m.id)} className="text-xs text-green-700 hover:underline">
                        Resume
                      </button>
                    )}
                    {(m.status === 'ACTIVE' || m.status === 'PAUSED') && (
                      <button onClick={() => cancelMembership(m.id)} className="text-xs text-red-600 hover:underline">
                        Cancel
                      </button>
                    )}
                    <button onClick={() => editMembership(m.id, m.endDate)} className="text-xs text-gray-600 hover:underline">
                      Edit end date
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {memberships.length === 0 && <p className="py-4 text-sm text-gray-400">No memberships recorded yet.</p>}
        </div>
      </div>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-6">
          <h2 className="font-medium">Add a membership plan</h2>
          <form onSubmit={createPlan} className="mt-4 space-y-3">
            <input placeholder="Plan name (e.g. 3 Month)" required value={planName} onChange={(e) => setPlanName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input type="number" min={1} placeholder="Duration (months)" required value={planMonths}
              onChange={(e) => setPlanMonths(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input type="number" min={0} placeholder="Price" required value={planPrice}
              onChange={(e) => setPlanPrice(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
              Add plan
            </button>
            {planError && <p className="text-sm text-red-600">{planError}</p>}
          </form>
          <ul className="mt-4 divide-y divide-gray-100 text-sm">
            {plans.map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <span>{p.name}</span>
                <span className="text-gray-500">₹{p.price}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-gray-200 p-6">
          <h2 className="font-medium">Today's crowd by hour</h2>
          <div className="mt-4 flex h-40 items-end gap-1">
            {Array.from({ length: 24 }, (_, hour) => {
              const entry = summary.find((s) => s.hour === hour)
              const count = entry?.count ?? 0
              return (
                <div key={hour} className="flex flex-1 flex-col items-center justify-end">
                  <div
                    className="w-full rounded-t bg-brand/70"
                    style={{ height: `${(count / maxCount) * 100}%`, minHeight: count > 0 ? '4px' : '0' }}
                    title={`${count} check-ins`}
                  />
                  {hour % 4 === 0 && <span className="mt-1 text-[10px] text-gray-400">{hour}h</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}