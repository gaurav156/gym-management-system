import { FormEvent, useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { HourlyCount, TodayAttendanceEntry } from '../../types'

const PAGE_SIZE = 10

interface Props {
  selectedBranch: string
  onCheckinSuccess: () => void
}

export default function AttendanceTab({ selectedBranch, onCheckinSuccess }: Props) {
  const [checkinPin, setCheckinPin] = useState('')
  const [checkinMessage, setCheckinMessage] = useState('')
  const [summary, setSummary] = useState<HourlyCount[]>([])
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendanceEntry[]>([])
  const [attendanceTab, setAttendanceTab] = useState<'MEMBERS' | 'TRAINERS'>('MEMBERS')
  const [todayAttendancePage, setTodayAttendancePage] = useState(1)

  function loadSummary() {
    if (!selectedBranch) return
    api.get<HourlyCount[]>(`/api/attendance/summary/${selectedBranch}`).then((res) => setSummary(res.data))
  }

  function loadTodayAttendance() {
    if (!selectedBranch) return
    api.get<TodayAttendanceEntry[]>(`/api/attendance/today/${selectedBranch}`).then((res) => setTodayAttendance(res.data))
  }

  useEffect(() => {
    loadSummary()
    loadTodayAttendance()
  }, [selectedBranch])

  useEffect(() => {
    setTodayAttendancePage(1)
  }, [attendanceTab, selectedBranch])

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
      onCheckinSuccess()
    } catch (err: any) {
      setCheckinMessage(err.response?.data?.error || 'Check-in failed')
    }
  }

  const maxCount = Math.max(1, ...summary.map((s) => s.count))
  const filteredTodayAttendance = todayAttendance.filter((a) => (attendanceTab === 'MEMBERS' ? a.role === 'MEMBER' : a.role === 'TRAINER'))
  const todayAttendanceTotalPages = Math.max(1, Math.ceil(filteredTodayAttendance.length / PAGE_SIZE))
  const pagedTodayAttendance = filteredTodayAttendance.slice((todayAttendancePage - 1) * PAGE_SIZE, todayAttendancePage * PAGE_SIZE)

  return (
    <div>
      <div className="grid gap-8 sm:grid-cols-2">
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
        <h2 className="font-medium">Today's attendance</h2>
        <div className="mt-3 overflow-x-auto overflow-y-hidden scrollbar-hide border-b border-gray-200">
          <div className="flex min-w-max gap-1">
            {(['MEMBERS', 'TRAINERS'] as const).map((tab) => (
              <button key={tab} onClick={() => setAttendanceTab(tab)}
                className={`-mb-px flex-shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
                  attendanceTab === tab ? 'border-brand text-brand font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {tab === 'MEMBERS' ? 'Members' : 'Trainers'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Check-in</th>
                <th className="pb-2 pr-4">Check-out</th>
                <th className="pb-2">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagedTodayAttendance.map((a, i) => (
                  <tr key={`${a.personId}-${i}`}>
                    <td className="py-2 pr-4">{a.personName}</td>
                    <td className="py-2 pr-4 text-gray-500">{new Date(a.checkInTime).toLocaleTimeString()}</td>
                    <td className="py-2 pr-4 text-gray-500">{a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString() : '—'}</td>
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