import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import type { Branch, AttendanceLogEntry } from '../types'

interface HourlyCount { hour: number; count: number }

const PAGE_SIZE = 5

export default function TrainerDashboard() {
  const user = useAuthStore((s) => s.user)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [summary, setSummary] = useState<HourlyCount[]>([])
  const [attendance, setAttendance] = useState<AttendanceLogEntry[]>([])
  const [loadError, setLoadError] = useState('')
  const [attendancePage, setAttendancePage] = useState(1)

  function loadAttendance() {
    api.get<AttendanceLogEntry[]>('/api/attendance/mine')
      .then((res) => setAttendance(res.data))
      .catch((err) => setLoadError(err.response?.data?.error || 'Failed to load your attendance log'))
  }

  useEffect(() => {
    if (!user) return
    loadAttendance()

    // Attendance is logged from the reception kiosk, not this page - refetch on return
    // to the tab so a check-in doesn't look missing just because this stayed open.
    function onFocus() { loadAttendance() }
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

  useEffect(() => {
    setAttendancePage(1)
  }, [attendance.length])

  const maxCount = Math.max(1, ...summary.map((s) => s.count))
  const attendanceTotalPages = Math.max(1, Math.ceil(attendance.length / PAGE_SIZE))
  const pagedAttendance = attendance.slice((attendancePage - 1) * PAGE_SIZE, attendancePage * PAGE_SIZE)

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
        <p className="mt-1 text-xs text-gray-500">Check-out isn't tracked yet - only check-in times are logged.</p>
        <ul className="mt-4 divide-y divide-gray-100 text-sm">
          {pagedAttendance.map((a) => (
            <li key={a.id} className="flex justify-between py-2">
              <span>{new Date(a.checkInTime).toLocaleString()}</span>
              <span className="text-gray-500">{a.method}</span>
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
    </div>
  )
}