import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import HourlyCrowdChart from '../components/HourlyCrowdChart'
import MemberStoreTab from '../components/member/MemberStoreTab'
import type { HourlyCount } from '../types'
import { usePersistedTab } from '../hooks/usePersistedTab'
import { useMyBranches, useMyAttendance, NO_BRANCHES } from '../api/queries'
import RefreshButton from '../components/RefreshButton'

const PAGE_SIZE = 5

type Tab = 'OVERVIEW' | 'STORE'
const TAB_KEYS: Tab[] = ['OVERVIEW', 'STORE']

export default function TrainerDashboard() {
  const user = useAuthStore((s) => s.user)
  const [activeTab, setActiveTab] = usePersistedTab<Tab>('trainer', TAB_KEYS, 'OVERVIEW')

  const { data: branches = NO_BRANCHES } = useMyBranches(user?.userId)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [summary, setSummary] = useState<HourlyCount[]>([])

  const [attendancePage, setAttendancePage] = useState(0)
  const attendanceQuery = useMyAttendance(user?.userId, attendancePage, PAGE_SIZE)
  const attendance = attendanceQuery.data?.content ?? []
  const attendanceLoading = attendanceQuery.isLoading
  const attendanceTotalPages = attendanceQuery.data?.totalPages ?? 1
  const attendanceTotalElements = attendanceQuery.data?.totalElements ?? 0
  const loadAttendance = (p: number) => setAttendancePage(p)

  useEffect(() => {
    if (!selectedBranch && branches.length > 0) setSelectedBranch(branches[0].id)
  }, [branches, selectedBranch])

  useEffect(() => {
    if (!selectedBranch) return
    api.get<HourlyCount[]>(`/api/attendance/summary/${selectedBranch}`).then((res) => setSummary(res.data))
  }, [selectedBranch])

  if (!user) return null

  const TABS: { key: Tab; label: string }[] = [
    { key: 'OVERVIEW', label: 'Overview' },
    { key: 'STORE', label: 'Store' },
  ]

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>

      <div className="mt-6 overflow-x-auto overflow-y-hidden scrollbar-hide border-b border-gray-200">
        <div className="flex min-w-max gap-1">
          {TABS.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`-mb-px flex-shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm ${
                activeTab === tab.key ? 'border-brand text-brand font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'OVERVIEW' && (
        <div className="mt-6">
          <div className="rounded-lg border border-gray-200 p-6 text-center">
            <h2 className="font-medium">Your check-in code</h2>
            <p className="mt-1 text-xs text-gray-500">Scan this at the gym, or use your 4-digit PIN at reception.</p>
            <div className="mt-4 flex justify-center">
              <QRCodeSVG value={user.userId} size={160} />
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