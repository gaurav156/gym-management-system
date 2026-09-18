import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import HourlyCrowdChart from '../components/HourlyCrowdChart'
import type { Branch, AttendanceLogEntry, HourlyCount, PageResponse } from '../types'

const PAGE_SIZE = 5

export default function TrainerDashboard() {
  const user = useAuthStore((s) => s.user)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [summary, setSummary] = useState<HourlyCount[]>([])
  const [loadError, setLoadError] = useState('')

  const [attendance, setAttendance] = useState<AttendanceLogEntry[]>([])
  const [attendanceLoading, setAttendanceLoading] = useState(true)
  const [attendancePage, setAttendancePage] = useState(0)
  const [attendanceTotalPages, setAttendanceTotalPages] = useState(1)
  const [attendanceTotalElements, setAttendanceTotalElements] = useState(0)

  function loadAttendance(page = 0) {
    setAttendanceLoading(true)
    api.get<PageResponse<AttendanceLogEntry>>('/api/attendance/mine', { params: { page, size: PAGE_SIZE } })
      .then((res) => {
        setAttendance(res.data.content)
        setAttendanceTotalPages(res.data.totalPages)
        setAttendanceTotalElements(res.data.totalElements)
        setAttendancePage(res.data.page)
      })
      .catch((err) => setLoadError(err.response?.data?.error || 'Failed to load your attendance log'))
      .finally(() => setAttendanceLoading(false))
  }

  useEffect(() => {
    if (!user) return
    loadAttendance(0)

    // Attendance is logged from the reception kiosk, not this page - refetch on return
    // to the tab so a check-in doesn't look missing just because this stayed open.
    function onFocus() { loadAttendance(0) }
    window.addEventListener('focus', onFocus)

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

  if (!user) return null

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
      {loadError && <p className="mt-2 text-sm text-red-600">{loadError}</p>}

      <div className="mt-8 rounded-lg border border-gray-200 p-6 text-center">
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
        <h2 className="font-medium">Your attendance log</h2>
        <p className="mt-1 text-xs text-gray-500">Second scan of the day at the same branch records check-out.</p>
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
  )
}