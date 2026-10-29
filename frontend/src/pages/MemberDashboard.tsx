import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import { getEffectiveStatus } from '../utils/membership'
import HourlyCrowdChart from '../components/HourlyCrowdChart'
import { CardSkeleton } from '../components/Skeleton'
import { viewInvoice, printInvoice, downloadInvoice } from '../utils/invoice'
import type { InvoiceResponse } from '../types'
import MemberStoreTab from '../components/member/MemberStoreTab'
import { toast, getErrorMessage } from '../store/toastStore'
import { usePersistedTab } from '../hooks/usePersistedTab'
import { usePlans, useMyBranches, useAttendanceSummary, useMyMemberships, useMyPayments, useMyAttendance, qk, NO_BRANCHES, } from '../api/queries'
import { queryClient } from '../api/queryClient'
import RefreshButton from '../components/RefreshButton'

const PAGE_SIZE = 5
type Tab = 'OVERVIEW' | 'STORE'
const TAB_KEYS: Tab[] = ['OVERVIEW', 'STORE']

export default function MemberDashboard() {
  const user = useAuthStore((s) => s.user)
  const [activeTab, setActiveTab] = usePersistedTab<Tab>('member', TAB_KEYS, 'OVERVIEW')

  const { data: plans = [], isLoading: plansLoading } = usePlans()
  const { data: branches = NO_BRANCHES } = useMyBranches(user?.userId)
  const [selectedBranch, setSelectedBranch] = useState('')
  const { data: summary = [] } = useAttendanceSummary(selectedBranch)

  const [paymentPage, setPaymentPage] = useState(0)
  const [attendancePage, setAttendancePage] = useState(0)

  const membershipsQuery = useMyMemberships(user?.userId)
  const paymentsQuery = useMyPayments(user?.userId, paymentPage, PAGE_SIZE)
  const attendanceQuery = useMyAttendance(user?.userId, attendancePage, PAGE_SIZE)

  const memberships = membershipsQuery.data ?? []
  const membershipLoading = membershipsQuery.isLoading
  const payments = paymentsQuery.data?.content ?? []
  const paymentsLoading = paymentsQuery.isLoading
  const paymentTotalPages = paymentsQuery.data?.totalPages ?? 1
  const paymentTotalElements = paymentsQuery.data?.totalElements ?? 0
  const attendance = attendanceQuery.data?.content ?? []
  const attendanceLoading = attendanceQuery.isLoading
  const attendanceTotalPages = attendanceQuery.data?.totalPages ?? 1
  const attendanceTotalElements = attendanceQuery.data?.totalElements ?? 0

  const loadPayments = (p: number) => setPaymentPage(p)
  const loadAttendance = (p: number) => setAttendancePage(p)

  const refreshing = membershipsQuery.isFetching || paymentsQuery.isFetching || attendanceQuery.isFetching
  function refreshAll() {
    if (user) queryClient.invalidateQueries({ queryKey: qk.my(user.userId) })
  }

  async function handleInvoiceAction(paymentId: string, action: 'view' | 'print' | 'download') {
    try {
      const { data } = await api.get<InvoiceResponse>(`/api/payments/${paymentId}/invoice`)
      if (action === 'view') await viewInvoice(data)
      else if (action === 'print') await printInvoice(data)
      else await downloadInvoice(data)
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to load invoice'))
    }
  }

  useEffect(() => {
    if (!selectedBranch && branches.length > 0) setSelectedBranch(branches[0].id)
  }, [branches, selectedBranch])

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
        {activeTab === 'OVERVIEW' && (
          <RefreshButton onClick={refreshAll} spinning={refreshing} label="Refresh status" />
        )}
      </div>

      <div className="mt-6 overflow-x-auto overflow-y-hidden scrollbar-hide border-b border-gray-200">
        <div className="flex min-w-max gap-1">
          {(['OVERVIEW', 'STORE'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`-mb-px flex-shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm ${
                activeTab === tab ? 'border-brand text-brand font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {tab === 'OVERVIEW' ? 'Overview' : 'Store'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'OVERVIEW' && (
        <div className="mt-6">

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
            {membershipLoading ? (
              <div className="mt-3 space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-40 animate-pulse rounded bg-gray-200" />
              </div>
            ) : activeMembership ? (
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
              {plansLoading ? (
                <>
                  <CardSkeleton />
                  <CardSkeleton />
                  <CardSkeleton />
                </>
              ) : (
                <>
                  {plans.map((p) => (
                    <div key={p.id} className="rounded-md border border-gray-200 p-4 text-center">
                      <p className="font-medium">{p.name}</p>
                      <p className="mt-1 text-2xl font-semibold">₹{p.price}</p>
                      <p className="mt-1 text-xs text-gray-400">{p.durationMonths} month{p.durationMonths > 1 ? 's' : ''}</p>
                    </div>
                  ))}
                  {plans.length === 0 && <p className="text-sm text-gray-400">No plans published yet.</p>}
                </>
              )}
            </div>
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
            <div className="mt-4">
              <HourlyCrowdChart data={summary} />
            </div>
            {branches.length === 0 && <p className="mt-2 text-xs text-gray-400">No branch assigned yet.</p>}
          </div>

          <div className="mt-8 rounded-lg border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-medium">Your attendance log</h2>
                <p className="mt-1 text-xs text-gray-500">Second scan of the day at the same branch records check-out.</p>
              </div>
              <RefreshButton onClick={() => attendanceQuery.refetch()} spinning={attendanceQuery.isFetching} />
            </div>
            {attendanceLoading ? (
              <div className="mt-4 space-y-3">
                <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
              </div>
            ) : (
            <ul className="mt-4 divide-y divide-gray-100 text-sm">
              {attendance.map((a) => (
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
            )}
            {!attendanceLoading && attendance.length > 0 && (
              <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                <span>Page {attendancePage + 1} of {attendanceTotalPages} ({attendanceTotalElements} total)</span>
                <div className="space-x-2">
                  <button disabled={attendancePage === 0} onClick={() => loadAttendance(attendancePage - 1)}
                    className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
                  <button disabled={attendancePage + 1 >= attendanceTotalPages} onClick={() => loadAttendance(attendancePage + 1)}
                    className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 rounded-lg border border-gray-200 p-6">
            <h2 className="font-medium">Your payment history</h2>
            {paymentsLoading ? (
              <div className="mt-4 space-y-3">
                <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
              </div>
            ) : (
            <ul className="mt-4 divide-y divide-gray-100 text-sm">
              {payments.map((p) => (
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
            )}
            {!paymentsLoading && payments.length > 0 && (
              <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                <span>Page {paymentPage + 1} of {paymentTotalPages} ({paymentTotalElements} total)</span>
                <div className="space-x-2">
                  <button disabled={paymentPage === 0} onClick={() => loadPayments(paymentPage - 1)}
                    className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
                  <button disabled={paymentPage + 1 >= paymentTotalPages} onClick={() => loadPayments(paymentPage + 1)}
                    className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'STORE' && (
        <div className="mt-6">
          <MemberStoreTab memberId={user.userId} />
        </div>
      )}
    </div>
  )
}