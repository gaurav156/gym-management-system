import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { getEffectiveStatus } from '../utils/membership'
import type { Membership, Plan, Payment, Branch, AttendanceLogEntry } from '../types'
import { viewInvoice, printInvoice, downloadInvoice } from '../utils/invoice'
import type { InvoiceResponse } from '../types'

interface HourlyCount { hour: number; count: number }

const PAGE_SIZE = 5

export default function MemberDashboard() {
  const user = useAuthStore((s) => s.user)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [summary, setSummary] = useState<HourlyCount[]>([])
  const [attendance, setAttendance] = useState<AttendanceLogEntry[]>([])
  const [message, setMessage] = useState('')
  const [loadError, setLoadError] = useState('')

  const [paymentPage, setPaymentPage] = useState(1)
  const [attendancePage, setAttendancePage] = useState(1)

  function loadMembershipData() {
    if (!user) return
    api.get<Membership[]>('/api/memberships/mine', { params: { memberId: user.userId } })
      .then((res) => setMemberships(res.data))
      .catch((err) => setLoadError(err.response?.data?.error || 'Failed to load your memberships'))

    api.get<Payment[]>('/api/payments/mine', { params: { memberId: user.userId } })
      .then((res) => setPayments(res.data))
      .catch((err) => setLoadError(err.response?.data?.error || 'Failed to load your payment history'))

    api.get<AttendanceLogEntry[]>('/api/attendance/mine')
      .then((res) => setAttendance(res.data))
      .catch((err) => setLoadError(err.response?.data?.error || 'Failed to load your attendance log'))
  }

  async function handleInvoiceAction(paymentId: string, action: 'view' | 'print' | 'download') {
    try {
      const { data } = await api.get<InvoiceResponse>(`/api/payments/${paymentId}/invoice`)
      if (action === 'view') viewInvoice(data)
      else if (action === 'print') printInvoice(data)
      else downloadInvoice(data)
    } catch (err: any) {
      setLoadError(err.response?.data?.error || 'Failed to load invoice')
    }
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

    api.get<Branch[]>('/api/branches/mine', { params: { userId: user.userId } })
      .then((res) => {
        setBranches(res.data)
        if (res.data.length > 0) setSelectedBranch(res.data[0].id)
      })
      .catch((err) => setLoadError(err.response?.data?.error || 'Failed to load your branches'))

    return () => window.removeEventListener('focus', onFocus)
  }, [user])

  useEffect(() => {
    if (!selectedBranch) return
    api.get<HourlyCount[]>(`/api/attendance/summary/${selectedBranch}`).then((res) => setSummary(res.data))
  }, [selectedBranch])

  useEffect(() => {
    setPaymentPage(1)
  }, [payments.length])

  useEffect(() => {
    setAttendancePage(1)
  }, [attendance.length])

  const activeMembership = memberships.find((m) => getEffectiveStatus(m) === 'ACTIVE')
  const pausedMembership = memberships.find((m) => getEffectiveStatus(m) === 'PAUSED')
  const upcomingMembership = memberships
    .filter((m) => getEffectiveStatus(m) === 'SCHEDULED')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]

  const maxCount = Math.max(1, ...summary.map((s) => s.count))
  const paymentTotalPages = Math.max(1, Math.ceil(payments.length / PAGE_SIZE))
  const pagedPayments = payments.slice((paymentPage - 1) * PAGE_SIZE, paymentPage * PAGE_SIZE)
  const attendanceTotalPages = Math.max(1, Math.ceil(attendance.length / PAGE_SIZE))
  const pagedAttendance = attendance.slice((attendancePage - 1) * PAGE_SIZE, attendancePage * PAGE_SIZE)

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
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Today's crowd by hour</h2>
          {branches.length > 1 && (
            <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs">
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
        <div className="mt-4 flex h-32 items-end gap-1">
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
        {branches.length === 0 && <p className="mt-2 text-xs text-gray-400">No branch assigned yet.</p>}
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 p-6">
        <h2 className="font-medium">Your attendance log</h2>
        <p className="mt-1 text-xs text-gray-500">Second scan of the day at the same branch records check-out.</p>
        <ul className="mt-4 divide-y divide-gray-100 text-sm">
          {pagedAttendance.map((a) => (
            <li key={a.id} className="py-2">
              <div className="flex items-center justify-between">
                <span>Check-in: {new Date(a.checkInTime).toLocaleString()}</span>
                <span className="text-right text-gray-500">
                  {a.branchName}
                  <span className="ml-2 text-xs text-gray-400">{a.method}</span>
                </span>
              </div>
              <div className="mt-0.5 text-xs text-gray-400">
                {a.checkOutTime
                  ? `Check-out: ${new Date(a.checkOutTime).toLocaleString()}`
                  : 'Not checked out yet'}
              </div>
            </li>
          ))}
          {attendance.length === 0 && <li className="py-2 text-gray-400">No visits logged yet.</li>}
        </ul>
        {attendance.length > 0 && (
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>Page {attendancePage} of {attendanceTotalPages} ({attendance.length} total)</span>
            <div className="space-x-2">
              <button disabled={attendancePage === 1} onClick={() => setAttendancePage((p) => p - 1)}
                className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
              <button disabled={attendancePage === attendanceTotalPages} onClick={() => setAttendancePage((p) => p + 1)}
                className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 p-6">
        <h2 className="font-medium">Your payment history</h2>
        <ul className="mt-4 divide-y divide-gray-100 text-sm">
          {pagedPayments.map((p) => (
            <li key={p.id} className="py-2">
              <div className="flex justify-between">
                <span>{p.planName ?? 'Payment'} - {new Date(p.createdAt).toLocaleDateString()}</span>
                <span className="text-gray-500">₹{p.amount} ({p.mode})</span>
              </div>
              <div className="mt-1 space-x-2 text-xs">
                <button onClick={() => handleInvoiceAction(p.id, 'view')} className="text-brand hover:underline">View</button>
                <button onClick={() => handleInvoiceAction(p.id, 'print')} className="text-brand hover:underline">Print</button>
                <button onClick={() => handleInvoiceAction(p.id, 'download')} className="text-brand hover:underline">Download</button>
              </div>
            </li>
          ))}
          {payments.length === 0 && <li className="py-2 text-gray-400">No payments recorded yet.</li>}
        </ul>
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
  )
}