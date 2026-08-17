import { FormEvent, useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { getEffectiveStatus, statusColorClass, statusLabel, type EffectiveStatus } from '../utils/membership'
import type { Branch, Plan, Payment, MembershipAdmin, TrainerSummary, TodayAttendanceEntry, LastCheckinEntry, AttendanceLogEntry } from '../types'

interface HourlyCount { hour: number; count: number }
interface MemberSummary { id: string; name: string; email: string; phone: string | null; photo: string | null; checkinPin: string | null }

const PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'CHEQUE', 'BANK_TRANSFER']

export default function ManagerDashboard() {
  const user = useAuthStore((s) => s.user)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [plans, setPlans] = useState<Plan[]>([])
  const [summary, setSummary] = useState<HourlyCount[]>([])
  const [members, setMembers] = useState<MemberSummary[]>([])
  const [trainers, setTrainers] = useState<TrainerSummary[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [memberships, setMemberships] = useState<MembershipAdmin[]>([])
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendanceEntry[]>([])
  const [lastCheckins, setLastCheckins] = useState<Record<string, string>>({})
  const [attendanceTab, setAttendanceTab] = useState<'MEMBERS' | 'TRAINERS'>('MEMBERS')

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

  const [memberSearch, setMemberSearch] = useState('')
  const [memberStatusFilter, setMemberStatusFilter] = useState<'ALL' | EffectiveStatus | 'NONE'>('ALL')
  const [memberSort, setMemberSort] = useState<'NAME' | 'STATUS'>('NAME')

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

  function loadTodayAttendance() {
    if (!selectedBranch) return
    api.get<TodayAttendanceEntry[]>(`/api/attendance/today/${selectedBranch}`).then((res) => setTodayAttendance(res.data))
  }

  useEffect(() => {
    if (!selectedBranch) return
    api.get<Plan[]>('/api/plans', { params: { branchId: selectedBranch } }).then((res) => setPlans(res.data))
    api.get<HourlyCount[]>(`/api/attendance/summary/${selectedBranch}`).then((res) => setSummary(res.data))
    api.get<MemberSummary[]>('/api/members', { params: { branchId: selectedBranch } }).then((res) => setMembers(res.data))
    api.get<TrainerSummary[]>('/api/trainers', { params: { branchId: selectedBranch } }).then((res) => setTrainers(res.data))
    api.get<LastCheckinEntry[]>(`/api/attendance/last-checkin/${selectedBranch}`).then((res) => {
      const map: Record<string, string> = {}
      res.data.forEach((e) => { map[e.personId] = e.lastCheckIn })
      setLastCheckins(map)
    })
    loadPayments()
    loadMemberships()
    loadTodayAttendance()
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
      loadTodayAttendance()
      api.get<LastCheckinEntry[]>(`/api/attendance/last-checkin/${selectedBranch}`).then((res) => {
        const map: Record<string, string> = {}
        res.data.forEach((e) => { map[e.personId] = e.lastCheckIn })
        setLastCheckins(map)
      })
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

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')

  function startEdit(m: MembershipAdmin) {
    setEditingId(m.id)
    setEditStartDate(m.startDate)
    setEditEndDate(m.endDate)
    setMembershipActionMessage('')
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(id: string) {
    if (editEndDate < editStartDate) {
      setMembershipActionMessage('End date cannot be before start date.')
      return
    }
    setMembershipActionMessage('')
    try {
      await api.put(`/api/memberships/${id}`, { startDate: editStartDate, endDate: editEndDate })
      setEditingId(null)
      loadMemberships()
    } catch (err: any) {
      setMembershipActionMessage(err.response?.data?.error || 'Failed to update')
    }
  }

  const maxCount = Math.max(1, ...summary.map((s) => s.count))
  const PAGE_SIZE = 10

  const [memberPage, setMemberPage] = useState(1)
  const [paymentPage, setPaymentPage] = useState(1)
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null)
  const [modalShowExpired, setModalShowExpired] = useState(false)
  const [modalPage, setModalPage] = useState(1)
  const [modalTab, setModalTab] = useState<'INFO' | 'MEMBERSHIPS' | 'PAYMENTS' | 'ATTENDANCE'>('INFO')
  const [detailPayments, setDetailPayments] = useState<Payment[]>([])
  const [detailAttendance, setDetailAttendance] = useState<AttendanceLogEntry[]>([])
  const MODAL_PAGE_SIZE = 5

  useEffect(() => {
    setModalPage(1)
  }, [detailMemberId, modalShowExpired])

  useEffect(() => {
    if (!detailMemberId) return
    setModalTab('INFO')
    api.get<Payment[]>(`/api/payments/member/${detailMemberId}`).then((res) => setDetailPayments(res.data))
    api.get<AttendanceLogEntry[]>(`/api/attendance/history/${detailMemberId}`).then((res) => setDetailAttendance(res.data))
  }, [detailMemberId])

  useEffect(() => {
    setMemberPage(1)
  }, [memberSearch, memberStatusFilter, memberSort, selectedBranch])

  useEffect(() => {
    setPaymentPage(1)
  }, [selectedBranch])

  // One row per member (not per membership) - a member with several plans (active +
  // scheduled next, or expired history) is summarized by their single most relevant
  // status here; the full breakdown with per-plan actions lives in the details modal.
  type MemberRow = { member: MemberSummary; status: EffectiveStatus | 'NONE' }

  const memberRows: MemberRow[] = members.map((mem): MemberRow => {
    const relevant = memberships
      .filter((ms) => ms.memberId === mem.id)
      .map((ms) => getEffectiveStatus(ms))
    const status: EffectiveStatus | 'NONE' =
      relevant.includes('ACTIVE') ? 'ACTIVE' :
      relevant.includes('SCHEDULED') ? 'SCHEDULED' :
      relevant.includes('PAUSED') ? 'PAUSED' : 'NONE'
    return { member: mem, status }
  })

  const filteredMemberRows = memberRows
    .filter(({ member }) =>
      member.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      member.email.toLowerCase().includes(memberSearch.toLowerCase()))
    .filter(({ status }) => memberStatusFilter === 'ALL' || status === memberStatusFilter)
    .sort((a, b) => memberSort === 'NAME'
      ? a.member.name.localeCompare(b.member.name)
      : a.status.localeCompare(b.status))

  const memberTotalPages = Math.max(1, Math.ceil(filteredMemberRows.length / PAGE_SIZE))
  const pagedMemberRows = filteredMemberRows.slice((memberPage - 1) * PAGE_SIZE, memberPage * PAGE_SIZE)

  const detailMember = members.find((m) => m.id === detailMemberId) ?? null
  const detailMemberships = memberships
    .filter((ms) => ms.memberId === detailMemberId)
    .filter((ms) => {
      const effective = getEffectiveStatus(ms)
      return modalShowExpired || (effective !== 'EXPIRED' && effective !== 'CANCELLED')
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
  const modalTotalPages = Math.max(1, Math.ceil(detailMemberships.length / MODAL_PAGE_SIZE))
  const pagedDetailMemberships = detailMemberships.slice((modalPage - 1) * MODAL_PAGE_SIZE, modalPage * MODAL_PAGE_SIZE)

  const paymentTotalPages = Math.max(1, Math.ceil(payments.length / PAGE_SIZE))
  const pagedPayments = payments.slice((paymentPage - 1) * PAGE_SIZE, paymentPage * PAGE_SIZE)

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
              {pagedPayments.map((p) => (
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
          {payments.length > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>Page {paymentPage} of {paymentTotalPages} ({payments.length} total)</span>
              <div className="space-x-2">
                <button disabled={paymentPage === 1} onClick={() => setPaymentPage((p) => p - 1)}
                  className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
                <button disabled={paymentPage === paymentTotalPages} onClick={() => setPaymentPage((p) => p + 1)}
                  className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 p-6">
        <h2 className="font-medium">Members</h2>
        <p className="mt-1 text-xs text-gray-500">Click a member to view all their plans and take action.</p>
        {membershipActionMessage && <p className="mt-2 text-sm text-red-600">{membershipActionMessage}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          <input placeholder="Search name or email..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)}
            className="flex-1 min-w-[180px] rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <select value={memberStatusFilter} onChange={(e) => setMemberStatusFilter(e.target.value as any)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="PAUSED">Paused</option>
            <option value="NONE">No plan</option>
          </select>
          <select value={memberSort} onChange={(e) => setMemberSort(e.target.value as any)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="NAME">Sort: Name</option>
            <option value="STATUS">Sort: Status</option>
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="pb-2 pr-4">Member</th>
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">PIN</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Last visit</th>
                <th className="pb-2">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagedMemberRows.map(({ member, status }) => (
                <tr key={member.id}>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      {member.photo ? (
                        <img src={member.photo} alt="" className="h-6 w-6 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] text-gray-500">
                          {member.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      {member.name}
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-gray-500">{member.email}</td>
                  <td className="py-2 pr-4 text-gray-500">{member.checkinPin ?? '—'}</td>
                  <td className="py-2 pr-4">
                    <span className={status === 'NONE' ? 'text-gray-400' : statusColorClass(status)}>
                      {status === 'NONE' ? 'No plan' : statusLabel(status)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-500">
                    {lastCheckins[member.id] ? new Date(lastCheckins[member.id]).toLocaleString() : 'Never'}
                  </td>
                  <td className="py-2">
                    <button onClick={() => { setDetailMemberId(member.id); setModalShowExpired(false) }}
                      className="text-xs text-brand hover:underline">
                      View details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMemberRows.length === 0 && <p className="py-4 text-sm text-gray-400">No members match.</p>}
          {filteredMemberRows.length > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>Page {memberPage} of {memberTotalPages} ({filteredMemberRows.length} total)</span>
              <div className="space-x-2">
                <button disabled={memberPage === 1} onClick={() => setMemberPage((p) => p - 1)}
                  className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
                <button disabled={memberPage === memberTotalPages} onClick={() => setMemberPage((p) => p + 1)}
                  className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {detailMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => { setDetailMemberId(null); cancelEdit() }}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {detailMember.photo ? (
                  <img src={detailMember.photo} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-lg text-gray-500">
                    {detailMember.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div>
                  <h3 className="text-lg font-medium">{detailMember.name}</h3>
                  <p className="text-xs text-gray-500">{detailMember.email} · PIN {detailMember.checkinPin ?? '—'}</p>
                </div>
              </div>
              <button onClick={() => { setDetailMemberId(null); cancelEdit() }}
                className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="mt-4 flex gap-1 border-b border-gray-200 text-sm">
              {(['INFO', 'MEMBERSHIPS', 'PAYMENTS', 'ATTENDANCE'] as const).map((tab) => (
                <button key={tab} onClick={() => setModalTab(tab)}
                  className={`-mb-px border-b-2 px-3 py-2 ${
                    modalTab === tab ? 'border-brand text-brand font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                  {tab === 'INFO' ? 'Info' : tab === 'MEMBERSHIPS' ? 'Membership plans' : tab === 'PAYMENTS' ? 'Payment history' : 'Attendance'}
                </button>
              ))}
            </div>

            {membershipActionMessage && <p className="mt-3 text-sm text-red-600">{membershipActionMessage}</p>}

            {modalTab === 'INFO' && (
              <div className="mt-4 space-y-2 text-sm">
                <p><span className="text-gray-500">Name:</span> {detailMember.name}</p>
                <p><span className="text-gray-500">Email:</span> {detailMember.email}</p>
                <p><span className="text-gray-500">Phone:</span> {detailMember.phone ?? '—'}</p>
                <p><span className="text-gray-500">Check-in PIN:</span> {detailMember.checkinPin ?? '—'}</p>
                <p><span className="text-gray-500">Last visit:</span> {
                  lastCheckins[detailMember.id] ? new Date(lastCheckins[detailMember.id]).toLocaleString() : 'Never'
                }</p>
              </div>
            )}

            {modalTab === 'MEMBERSHIPS' && (
              <>
                <label className="mt-4 flex items-center gap-1.5 text-xs text-gray-500">
                  <input type="checkbox" checked={modalShowExpired} onChange={(e) => setModalShowExpired(e.target.checked)} />
                  Show expired / cancelled
                </label>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[560px] table-fixed text-left text-sm">
                    <colgroup>
                      <col className="w-[22%]" />
                      <col className="w-[20%]" />
                      <col className="w-[20%]" />
                      <col className="w-[16%]" />
                      <col className="w-[22%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500">
                        <th className="pb-2 pr-4">Plan</th>
                        <th className="pb-2 pr-4">Start</th>
                        <th className="pb-2 pr-4">End</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pagedDetailMemberships.map((m) => {
                        const effective = getEffectiveStatus(m)
                        const isEditing = editingId === m.id
                        return (
                          <tr key={m.id}>
                            <td className="truncate py-2 pr-4">{m.planName}</td>
                            {isEditing ? (
                              <>
                                <td className="py-2 pr-4">
                                  <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)}
                                    className="w-full min-w-0 rounded-md border border-gray-300 px-2 py-1 text-xs" />
                                </td>
                                <td className="py-2 pr-4">
                                  <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)}
                                    className="w-full min-w-0 rounded-md border border-gray-300 px-2 py-1 text-xs" />
                                </td>
                                <td className="truncate py-2 pr-4 text-xs text-gray-400">Updates on save</td>
                                <td className="py-2 space-x-2 whitespace-nowrap">
                                  <button onClick={() => saveEdit(m.id)} className="text-xs text-green-700 hover:underline">
                                    Save
                                  </button>
                                  <button onClick={cancelEdit} className="text-xs text-gray-500 hover:underline">
                                    Cancel
                                  </button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="truncate py-2 pr-4 text-gray-500">{m.startDate}</td>
                                <td className="truncate py-2 pr-4 text-gray-500">{m.endDate}</td>
                                <td className="truncate py-2 pr-4">
                                  <span className={statusColorClass(effective)}>{statusLabel(effective)}</span>
                                </td>
                                <td className="py-2 space-x-2 whitespace-nowrap">
                                  {effective === 'ACTIVE' && (
                                    <button onClick={() => pauseMembership(m.id)} className="text-xs text-amber-600 hover:underline">
                                      Pause
                                    </button>
                                  )}
                                  {effective === 'PAUSED' && (
                                    <button onClick={() => resumeMembership(m.id)} className="text-xs text-green-700 hover:underline">
                                      Resume
                                    </button>
                                  )}
                                  {(effective === 'ACTIVE' || effective === 'PAUSED' || effective === 'SCHEDULED') && (
                                    <button onClick={() => cancelMembership(m.id)} className="text-xs text-red-600 hover:underline">
                                      Cancel
                                    </button>
                                  )}
                                  <button onClick={() => startEdit(m)} className="text-xs text-gray-600 hover:underline">
                                    Edit dates
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {detailMemberships.length === 0 && <p className="py-4 text-sm text-gray-400">No memberships to show.</p>}
                  {detailMemberships.length > 0 && (
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                      <span>Page {modalPage} of {modalTotalPages} ({detailMemberships.length} total)</span>
                      <div className="space-x-2">
                        <button disabled={modalPage === 1} onClick={() => setModalPage((p) => p - 1)}
                          className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
                        <button disabled={modalPage === modalTotalPages} onClick={() => setModalPage((p) => p + 1)}
                          className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {modalTab === 'PAYMENTS' && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                      <th className="pb-2 pr-4">Date</th>
                      <th className="pb-2 pr-4">Plan</th>
                      <th className="pb-2 pr-4">Amount</th>
                      <th className="pb-2 pr-4">Mode</th>
                      <th className="pb-2">Recorded by</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detailPayments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 pr-4 text-gray-500">{new Date(p.createdAt).toLocaleString()}</td>
                        <td className="py-2 pr-4">{p.planName ?? '—'}</td>
                        <td className="py-2 pr-4">₹{p.amount}</td>
                        <td className="py-2 pr-4">{p.mode}</td>
                        <td className="py-2">{p.recordedByName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {detailPayments.length === 0 && <p className="py-4 text-sm text-gray-400">No payments recorded yet.</p>}
              </div>
            )}

            {modalTab === 'ATTENDANCE' && (
              <div className="mt-4 overflow-x-auto">
                <p className="mb-2 text-xs text-gray-500">Check-out isn't tracked yet - only check-in times are logged.</p>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                      <th className="pb-2 pr-4">Check-in</th>
                      <th className="pb-2 pr-4">Check-out</th>
                      <th className="pb-2">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detailAttendance.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2 pr-4 text-gray-500">{new Date(a.checkInTime).toLocaleString()}</td>
                        <td className="py-2 pr-4 text-gray-500">{a.checkOutTime ? new Date(a.checkOutTime).toLocaleString() : '—'}</td>
                        <td className="py-2">{a.method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {detailAttendance.length === 0 && <p className="py-4 text-sm text-gray-400">No visits logged yet.</p>}
              </div>
            )}
          </div>
        </div>
      )}

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

      <div className="mt-8 rounded-lg border border-gray-200 p-6">
        <h2 className="font-medium">Trainers</h2>
        <p className="mt-1 text-xs text-gray-500">Created by the Owner - visible here for reference and PIN lookup.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">Phone</th>
                <th className="pb-2 pr-4">PIN</th>
                <th className="pb-2">Last visit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {trainers.map((t) => (
                <tr key={t.id}>
                  <td className="py-2 pr-4">{t.name}</td>
                  <td className="py-2 pr-4 text-gray-500">{t.email}</td>
                  <td className="py-2 pr-4 text-gray-500">{t.phone ?? '—'}</td>
                  <td className="py-2 pr-4 text-gray-500">{t.checkinPin ?? '—'}</td>
                  <td className="py-2 text-gray-500">
                    {lastCheckins[t.id] ? new Date(lastCheckins[t.id]).toLocaleString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {trainers.length === 0 && <p className="py-4 text-sm text-gray-400">No trainers assigned to this branch yet.</p>}
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 p-6">
        <h2 className="font-medium">Today's attendance</h2>
        <div className="mt-3 flex gap-1 border-b border-gray-200 text-sm">
          {(['MEMBERS', 'TRAINERS'] as const).map((tab) => (
            <button key={tab} onClick={() => setAttendanceTab(tab)}
              className={`-mb-px border-b-2 px-3 py-2 ${
                attendanceTab === tab ? 'border-brand text-brand font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {tab === 'MEMBERS' ? 'Members' : 'Trainers'}
            </button>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Check-in</th>
                <th className="pb-2">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {todayAttendance
                .filter((a) => (attendanceTab === 'MEMBERS' ? a.role === 'MEMBER' : a.role === 'TRAINER'))
                .map((a, i) => (
                  <tr key={`${a.personId}-${i}`}>
                    <td className="py-2 pr-4">{a.personName}</td>
                    <td className="py-2 pr-4 text-gray-500">{new Date(a.checkInTime).toLocaleTimeString()}</td>
                    <td className="py-2">{a.method}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {todayAttendance.filter((a) => (attendanceTab === 'MEMBERS' ? a.role === 'MEMBER' : a.role === 'TRAINER')).length === 0 && (
            <p className="py-4 text-sm text-gray-400">No check-ins yet today.</p>
          )}
        </div>
      </div>
    </div>
  )
}