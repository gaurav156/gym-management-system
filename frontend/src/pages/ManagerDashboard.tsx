import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { getEffectiveStatus, statusColorClass, statusLabel, type EffectiveStatus } from '../utils/membership'
import type { Branch, Plan, Payment, MembershipAdmin, TrainerSummary, TodayAttendanceEntry, LastCheckinEntry, AttendanceLogEntry } from '../types'

interface HourlyCount { hour: number; count: number }
interface MemberSummary { id: string; name: string; email: string; phone: string | null; photo: string | null; address: string | null; checkinPin: string | null; enrollmentDate: string | null }

const PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'CHEQUE', 'BANK_TRANSFER']
const MAX_PHOTO_BYTES = 1_500_000 // ~1.5MB - base64 in a DB column, keep it modest

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
  const [detailTrainerId, setDetailTrainerId] = useState<string | null>(null)
  const [showAllTrainers, setShowAllTrainers] = useState(false)
  const [trainerModalTab, setTrainerModalTab] = useState<'INFO' | 'ATTENDANCE'>('INFO')
  const [editingTrainerDates, setEditingTrainerDates] = useState(false)
  const [joiningDateInput, setJoiningDateInput] = useState('')
  const [leftDateInput, setLeftDateInput] = useState('')
  const [detailTrainerAttendance, setDetailTrainerAttendance] = useState<AttendanceLogEntry[]>([])
  const [trainerModalPage, setTrainerModalPage] = useState(1)

  const detailTrainer = trainers.find((t) => t.id === detailTrainerId) ?? null

  useEffect(() => {
    if (!detailTrainerId) return
    setTrainerModalTab('INFO')
    setEditingTrainerDates(false)
    setTrainerModalPage(1)
    api.get<AttendanceLogEntry[]>(`/api/attendance/history/${detailTrainerId}`).then((res) => setDetailTrainerAttendance(res.data))
  }, [detailTrainerId])

  const trainerModalTotalPages = Math.max(1, Math.ceil(detailTrainerAttendance.length / 5))
  const pagedTrainerAttendance = detailTrainerAttendance.slice((trainerModalPage - 1) * 5, trainerModalPage * 5)

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

  function loadMembers() {
    if (!selectedBranch) return
    api.get<MemberSummary[]>('/api/members', { params: { branchId: selectedBranch } }).then((res) => setMembers(res.data))
  }

  function loadTrainers() {
    if (!selectedBranch) return
    api.get<TrainerSummary[]>('/api/trainers', { params: { branchId: selectedBranch } }).then((res) => setTrainers(res.data))
  }

  useEffect(() => {
    api.get<Plan[]>('/api/plans').then((res) => setPlans(res.data))
  }, [])

  useEffect(() => {
    if (!selectedBranch) return
    api.get<HourlyCount[]>(`/api/attendance/summary/${selectedBranch}`).then((res) => setSummary(res.data))
    loadMembers()
    loadTrainers()
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

    if (!planPrice || Number.isNaN(Number(planPrice))) {
      setPlanError('Enter a valid price.')
      return
    }

    try {
      await api.post('/api/plans/manage', {
        name: planName, durationMonths: planMonths, price: Number(planPrice),
      })
      setPlanName(''); setPlanPrice('')
      const res = await api.get<Plan[]>('/api/plans')
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
    if (!selectedBranch) {
      setPurchaseMessage('No branch selected.')
      return
    }
    try {
      const { data } = await api.post(
        '/api/memberships/purchase',
        {
          planId: purchasePlanId,
          mode: purchaseMode,
          branchId: selectedBranch,
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

  function startEditTrainerDates(t: TrainerSummary) {
    setEditingTrainerDates(true)
    setJoiningDateInput(t.joiningDate ?? '')
    setLeftDateInput(t.leftDate ?? '')
    setMembershipActionMessage('')
  }

  async function saveTrainerDates(trainerId: string) {
    try {
      await api.put(`/api/trainers/${trainerId}/dates`, {
        joiningDate: joiningDateInput || null,
        leftDate: leftDateInput || null,
      })
      setEditingTrainerDates(false)
      loadTrainers()
    } catch (err: any) {
      setMembershipActionMessage(err.response?.data?.error || 'Failed to update trainer dates')
    }
  }

  function startEditMemberInfo(m: MemberSummary) {
    setEditingMemberInfo(true)
    setMemberEditName(m.name)
    setMemberEditPhone(m.phone ?? '')
    setMemberEditAddress(m.address ?? '')
    setMemberEditPhoto(m.photo)
    setMembershipActionMessage('')
  }

  async function saveMemberInfo(memberId: string) {
    try {
      await api.put(`/api/members/${memberId}`, {
        name: memberEditName, phone: memberEditPhone, address: memberEditAddress, photo: memberEditPhoto ?? '',
      })
      setEditingMemberInfo(false)
      loadMembers()
    } catch (err: any) {
      setMembershipActionMessage(err.response?.data?.error || 'Failed to update member info')
    }
  }

  function startEditTrainerInfo(t: TrainerSummary) {
    setEditingTrainerInfo(true)
    setTrainerEditName(t.name)
    setTrainerEditPhone(t.phone ?? '')
    setTrainerEditAddress(t.address ?? '')
    setTrainerEditPhoto(t.photo)
    setMembershipActionMessage('')
  }

  async function saveTrainerInfo(trainerId: string) {
    try {
      await api.put(`/api/trainers/${trainerId}`, {
        name: trainerEditName, phone: trainerEditPhone, address: trainerEditAddress, photo: trainerEditPhoto ?? '',
      })
      setEditingTrainerInfo(false)
      loadTrainers()
    } catch (err: any) {
      setMembershipActionMessage(err.response?.data?.error || 'Failed to update trainer info')
    }
  }

  async function clearLeftDate(trainerId: string, joiningDate: string | null) {
    try {
      await api.put(`/api/trainers/${trainerId}/dates`, { joiningDate, leftDate: null })
      loadTrainers()
    } catch (err: any) {
      setMembershipActionMessage(err.response?.data?.error || 'Failed to clear left date')
    }
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
  const [detailPaymentsPage, setDetailPaymentsPage] = useState(1)
  const [detailAttendancePage, setDetailAttendancePage] = useState(1)
  const [trainerPage, setTrainerPage] = useState(1)
  const [todayAttendancePage, setTodayAttendancePage] = useState(1)
  const MODAL_PAGE_SIZE = 5

  const [editingMemberInfo, setEditingMemberInfo] = useState(false)
  const [memberEditName, setMemberEditName] = useState('')
  const [memberEditPhone, setMemberEditPhone] = useState('')
  const [memberEditAddress, setMemberEditAddress] = useState('')
  const [memberEditPhoto, setMemberEditPhoto] = useState<string | null>(null)

  const [editingTrainerInfo, setEditingTrainerInfo] = useState(false)
  const [trainerEditName, setTrainerEditName] = useState('')
  const [trainerEditPhone, setTrainerEditPhone] = useState('')
  const [trainerEditAddress, setTrainerEditAddress] = useState('')
  const [trainerEditPhoto, setTrainerEditPhoto] = useState<string | null>(null)

  function handleEditPhotoChange(e: ChangeEvent<HTMLInputElement>, onLoaded: (dataUrl: string) => void) {
    const file = e.target.files?.[0]
    const inputEl = e.target
    if (!file) return
    if (file.size > MAX_PHOTO_BYTES) {
      setMembershipActionMessage('Photo is too large - please use one under ~1.5MB.')
      inputEl.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => onLoaded(reader.result as string)
    reader.readAsDataURL(file)
    inputEl.value = ''
  }

  useEffect(() => {
    setModalPage(1)
  }, [detailMemberId, modalShowExpired])

  useEffect(() => {
    if (!detailMemberId) return
    setModalTab('INFO')
    setDetailPaymentsPage(1)
    setDetailAttendancePage(1)
    setEditingMemberInfo(false)
    api.get<Payment[]>(`/api/payments/member/${detailMemberId}`).then((res) => setDetailPayments(res.data))
    api.get<AttendanceLogEntry[]>(`/api/attendance/history/${detailMemberId}`).then((res) => setDetailAttendance(res.data))
  }, [detailMemberId])

  useEffect(() => {
    setEditingTrainerInfo(false)
  }, [detailTrainerId])

  useEffect(() => {
    setMemberPage(1)
  }, [memberSearch, memberStatusFilter, memberSort, selectedBranch])

  useEffect(() => {
    setPaymentPage(1)
  }, [selectedBranch])

  useEffect(() => {
    setTrainerPage(1)
  }, [showAllTrainers, selectedBranch])

  useEffect(() => {
    setTodayAttendancePage(1)
  }, [attendanceTab, selectedBranch])

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

  const detailPaymentsTotalPages = Math.max(1, Math.ceil(detailPayments.length / MODAL_PAGE_SIZE))
  const pagedDetailPayments = detailPayments.slice((detailPaymentsPage - 1) * MODAL_PAGE_SIZE, detailPaymentsPage * MODAL_PAGE_SIZE)

  const detailAttendanceTotalPages = Math.max(1, Math.ceil(detailAttendance.length / MODAL_PAGE_SIZE))
  const pagedDetailAttendance = detailAttendance.slice((detailAttendancePage - 1) * MODAL_PAGE_SIZE, detailAttendancePage * MODAL_PAGE_SIZE)

  const visibleTrainers = trainers.filter((t) => showAllTrainers || !t.leftDate)
  const trainerTotalPages = Math.max(1, Math.ceil(visibleTrainers.length / PAGE_SIZE))
  const pagedTrainers = visibleTrainers.slice((trainerPage - 1) * PAGE_SIZE, trainerPage * PAGE_SIZE)

  const filteredTodayAttendance = todayAttendance.filter((a) => (attendanceTab === 'MEMBERS' ? a.role === 'MEMBER' : a.role === 'TRAINER'))
  const todayAttendanceTotalPages = Math.max(1, Math.ceil(filteredTodayAttendance.length / PAGE_SIZE))
  const pagedTodayAttendance = filteredTodayAttendance.slice((todayAttendancePage - 1) * PAGE_SIZE, todayAttendancePage * PAGE_SIZE)

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
                      View/Edit details
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
                {editingMemberInfo ? (
                  <div className="space-y-3 rounded-md border border-gray-200 p-3">
                    <div className="flex items-center gap-3">
                      {memberEditPhoto ? (
                        <img src={memberEditPhoto} alt="" className="h-14 w-14 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200 text-lg text-gray-500">
                          {memberEditName.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div>
                        <input type="file" accept="image/*"
                          onChange={(e) => handleEditPhotoChange(e, setMemberEditPhoto)} className="text-xs" />
                        {memberEditPhoto && (
                          <button type="button" onClick={() => setMemberEditPhoto(null)}
                            className="block text-xs text-red-600 hover:underline">Remove photo</button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Name</label>
                      <input value={memberEditName} onChange={(e) => setMemberEditName(e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Phone</label>
                      <input value={memberEditPhone} onChange={(e) => setMemberEditPhone(e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Address</label>
                      <textarea value={memberEditAddress} onChange={(e) => setMemberEditAddress(e.target.value)} rows={2}
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm" />
                    </div>
                    <div className="space-x-2">
                      <button onClick={() => saveMemberInfo(detailMember.id)}
                        className="text-xs text-green-700 hover:underline">Save</button>
                      <button onClick={() => setEditingMemberInfo(false)}
                        className="text-xs text-gray-500 hover:underline">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p><span className="text-gray-500">Name:</span> {detailMember.name}</p>
                    <p><span className="text-gray-500">Email:</span> {detailMember.email}</p>
                    <p><span className="text-gray-500">Phone:</span> {detailMember.phone ?? '—'}</p>
                    <p><span className="text-gray-500">Address:</span> {detailMember.address ?? '—'}</p>
                    <p><span className="text-gray-500">Check-in PIN:</span> {detailMember.checkinPin ?? '—'}</p>
                    <p><span className="text-gray-500">Enrollment date:</span> {detailMember.enrollmentDate ?? 'Not enrolled yet'}</p>
                    <p><span className="text-gray-500">Last visit:</span> {
                      lastCheckins[detailMember.id] ? new Date(lastCheckins[detailMember.id]).toLocaleString() : 'Never'
                    }</p>
                    <button onClick={() => startEditMemberInfo(detailMember)}
                      className="text-xs text-gray-600 hover:underline">Edit info</button>
                  </>
                )}
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
                    {pagedDetailPayments.map((p) => (
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
                {detailPayments.length > 0 && (
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <span>Page {detailPaymentsPage} of {detailPaymentsTotalPages} ({detailPayments.length} total)</span>
                    <div className="space-x-2">
                      <button disabled={detailPaymentsPage === 1} onClick={() => setDetailPaymentsPage((p) => p - 1)}
                        className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
                      <button disabled={detailPaymentsPage === detailPaymentsTotalPages} onClick={() => setDetailPaymentsPage((p) => p + 1)}
                        className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
                    </div>
                  </div>
                )}
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
                    {pagedDetailAttendance.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2 pr-4 text-gray-500">{new Date(a.checkInTime).toLocaleString()}</td>
                        <td className="py-2 pr-4 text-gray-500">{a.checkOutTime ? new Date(a.checkOutTime).toLocaleString() : '—'}</td>
                        <td className="py-2">{a.method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {detailAttendance.length === 0 && <p className="py-4 text-sm text-gray-400">No visits logged yet.</p>}
                {detailAttendance.length > 0 && (
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <span>Page {detailAttendancePage} of {detailAttendanceTotalPages} ({detailAttendance.length} total)</span>
                    <div className="space-x-2">
                      <button disabled={detailAttendancePage === 1} onClick={() => setDetailAttendancePage((p) => p - 1)}
                        className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
                      <button disabled={detailAttendancePage === detailAttendanceTotalPages} onClick={() => setDetailAttendancePage((p) => p + 1)}
                        className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-6">
          <h2 className="font-medium">Membership plans</h2>
          <p className="mt-1 text-xs text-gray-500">Chain-wide - the same plans apply at every branch.</p>
          {user?.role === 'OWNER' ? (
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
          ) : (
            <p className="mt-3 text-xs text-gray-400">Only the Owner can add or change plans.</p>
          )}
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
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Trainers</h2>
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <input type="checkbox" checked={showAllTrainers} onChange={(e) => setShowAllTrainers(e.target.checked)} />
            Show all (including left)
          </label>
        </div>
        <p className="mt-1 text-xs text-gray-500">Created by the Owner - visible here for reference and PIN lookup.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">Phone</th>
                <th className="pb-2 pr-4">PIN</th>
                <th className="pb-2 pr-4">Last visit</th>
                <th className="pb-2">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagedTrainers.map((t) => (
                <tr key={t.id}>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      {t.photo ? (
                        <img src={t.photo} alt="" className="h-6 w-6 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] text-gray-500">
                          {t.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      {t.name}
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-gray-500">{t.email}</td>
                  <td className="py-2 pr-4 text-gray-500">{t.phone ?? '—'}</td>
                  <td className="py-2 pr-4 text-gray-500">{t.checkinPin ?? '—'}</td>
                  <td className="py-2 pr-4 text-gray-500">
                    {lastCheckins[t.id] ? new Date(lastCheckins[t.id]).toLocaleString() : 'Never'}
                  </td>
                  <td className="py-2">
                    <button onClick={() => setDetailTrainerId(t.id)} className="text-xs text-brand hover:underline">
                      View/Edit details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleTrainers.length === 0 && (
            <p className="py-4 text-sm text-gray-400">
              {trainers.length === 0 ? 'No trainers assigned to this branch yet.' : 'No active trainers - check "Show all" to see trainers who have left.'}
            </p>
          )}
          {visibleTrainers.length > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>Page {trainerPage} of {trainerTotalPages} ({visibleTrainers.length} total)</span>
              <div className="space-x-2">
                <button disabled={trainerPage === 1} onClick={() => setTrainerPage((p) => p - 1)}
                  className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
                <button disabled={trainerPage === trainerTotalPages} onClick={() => setTrainerPage((p) => p + 1)}
                  className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {detailTrainer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetailTrainerId(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {detailTrainer.photo ? (
                  <img src={detailTrainer.photo} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-lg text-gray-500">
                    {detailTrainer.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div>
                  <h3 className="text-lg font-medium">{detailTrainer.name}</h3>
                  <p className="text-xs text-gray-500">{detailTrainer.email} · PIN {detailTrainer.checkinPin ?? '—'}</p>
                </div>
              </div>
              <button onClick={() => setDetailTrainerId(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="mt-4 flex gap-1 border-b border-gray-200 text-sm">
              {(['INFO', 'ATTENDANCE'] as const).map((tab) => (
                <button key={tab} onClick={() => setTrainerModalTab(tab)}
                  className={`-mb-px border-b-2 px-3 py-2 ${
                    trainerModalTab === tab ? 'border-brand text-brand font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                  {tab === 'INFO' ? 'Info' : 'Attendance'}
                </button>
              ))}
            </div>

            {membershipActionMessage && <p className="mt-3 text-sm text-red-600">{membershipActionMessage}</p>}

            {trainerModalTab === 'INFO' && (
              <div className="mt-4 space-y-2 text-sm">
                {editingTrainerInfo ? (
                  <div className="space-y-3 rounded-md border border-gray-200 p-3">
                    <div className="flex items-center gap-3">
                      {trainerEditPhoto ? (
                        <img src={trainerEditPhoto} alt="" className="h-14 w-14 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200 text-lg text-gray-500">
                          {trainerEditName.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div>
                        <input type="file" accept="image/*"
                          onChange={(e) => handleEditPhotoChange(e, setTrainerEditPhoto)} className="text-xs" />
                        {trainerEditPhoto && (
                          <button type="button" onClick={() => setTrainerEditPhoto(null)}
                            className="block text-xs text-red-600 hover:underline">Remove photo</button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Name</label>
                      <input value={trainerEditName} onChange={(e) => setTrainerEditName(e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Phone</label>
                      <input value={trainerEditPhone} onChange={(e) => setTrainerEditPhone(e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Address</label>
                      <textarea value={trainerEditAddress} onChange={(e) => setTrainerEditAddress(e.target.value)} rows={2}
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm" />
                    </div>
                    <div className="space-x-2">
                      <button onClick={() => saveTrainerInfo(detailTrainer.id)}
                        className="text-xs text-green-700 hover:underline">Save</button>
                      <button onClick={() => setEditingTrainerInfo(false)}
                        className="text-xs text-gray-500 hover:underline">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p><span className="text-gray-500">Name:</span> {detailTrainer.name}</p>
                    <p><span className="text-gray-500">Email:</span> {detailTrainer.email}</p>
                    <p><span className="text-gray-500">Phone:</span> {detailTrainer.phone ?? '—'}</p>
                    <p><span className="text-gray-500">Address:</span> {detailTrainer.address ?? '—'}</p>
                    <p><span className="text-gray-500">Check-in PIN:</span> {detailTrainer.checkinPin ?? '—'}</p>
                    <p><span className="text-gray-500">Last visit:</span> {
                      lastCheckins[detailTrainer.id] ? new Date(lastCheckins[detailTrainer.id]).toLocaleString() : 'Never'
                    }</p>
                    <button onClick={() => startEditTrainerInfo(detailTrainer)}
                      className="text-xs text-gray-600 hover:underline">Edit info</button>
                  </>
                )}

                {editingTrainerDates ? (
                  <div className="space-y-2 rounded-md border border-gray-200 p-3">
                    <div>
                      <label className="text-xs text-gray-500">Joining date</label>
                      <input type="date" value={joiningDateInput} onChange={(e) => setJoiningDateInput(e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Left date (leave blank if still active)</label>
                      <input type="date" value={leftDateInput} onChange={(e) => setLeftDateInput(e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm" />
                    </div>
                    <div className="space-x-2">
                      <button onClick={() => saveTrainerDates(detailTrainer.id)}
                        className="text-xs text-green-700 hover:underline">Save</button>
                      <button onClick={() => setEditingTrainerDates(false)}
                        className="text-xs text-gray-500 hover:underline">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p><span className="text-gray-500">Joining date:</span> {detailTrainer.joiningDate ?? '—'}</p>
                    <p><span className="text-gray-500">Left date:</span> {detailTrainer.leftDate ?? '—'}</p>
                    {user?.role === 'OWNER' && (
                      <div className="space-x-2">
                        <button onClick={() => startEditTrainerDates(detailTrainer)}
                          className="text-xs text-gray-600 hover:underline">Edit dates</button>
                        {detailTrainer.leftDate && (
                          <button onClick={() => clearLeftDate(detailTrainer.id, detailTrainer.joiningDate)}
                            className="text-xs text-brand hover:underline">Clear left date</button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {trainerModalTab === 'ATTENDANCE' && (
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
                    {pagedTrainerAttendance.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2 pr-4 text-gray-500">{new Date(a.checkInTime).toLocaleString()}</td>
                        <td className="py-2 pr-4 text-gray-500">{a.checkOutTime ? new Date(a.checkOutTime).toLocaleString() : '—'}</td>
                        <td className="py-2">{a.method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {detailTrainerAttendance.length === 0 && <p className="py-4 text-sm text-gray-400">No visits logged yet.</p>}
                {detailTrainerAttendance.length > 0 && (
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <span>Page {trainerModalPage} of {trainerModalTotalPages} ({detailTrainerAttendance.length} total)</span>
                    <div className="space-x-2">
                      <button disabled={trainerModalPage === 1} onClick={() => setTrainerModalPage((p) => p - 1)}
                        className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
                      <button disabled={trainerModalPage === trainerModalTotalPages} onClick={() => setTrainerModalPage((p) => p + 1)}
                        className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
              {pagedTodayAttendance.map((a, i) => (
                  <tr key={`${a.personId}-${i}`}>
                    <td className="py-2 pr-4">{a.personName}</td>
                    <td className="py-2 pr-4 text-gray-500">{new Date(a.checkInTime).toLocaleTimeString()}</td>
                    <td className="py-2">{a.method}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {filteredTodayAttendance.length === 0 && (
            <p className="py-4 text-sm text-gray-400">No check-ins yet today.</p>
          )}
          {filteredTodayAttendance.length > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>Page {todayAttendancePage} of {todayAttendanceTotalPages} ({filteredTodayAttendance.length} total)</span>
              <div className="space-x-2">
                <button disabled={todayAttendancePage === 1} onClick={() => setTodayAttendancePage((p) => p - 1)}
                  className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
                <button disabled={todayAttendancePage === todayAttendanceTotalPages} onClick={() => setTodayAttendancePage((p) => p + 1)}
                  className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}