import { FormEvent, useEffect, useState } from 'react'
import { api } from '../../api/client'
import QrScanner from '../QrScanner'
import HourlyCrowdChart from '../HourlyCrowdChart'
import type { HourlyCount, TodayAttendanceEntry } from '../../types'

const PAGE_SIZE = 10
const SCAN_RETRY_COOLDOWN_MS = 2000

interface Props {
  selectedBranch: string
  onCheckinSuccess: () => void
}

export default function AttendanceTab({ selectedBranch, onCheckinSuccess }: Props) {
  const [checkinPin, setCheckinPin] = useState('')
  const [summary, setSummary] = useState<HourlyCount[]>([])
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendanceEntry[]>([])
  const [attendanceTab, setAttendanceTab] = useState<'MEMBERS' | 'STAFF'>('MEMBERS')
  const [todayAttendancePage, setTodayAttendancePage] = useState(1)

  const [checkinMode, setCheckinMode] = useState<'PIN' | 'QR'>('PIN')
  const [scanActive, setScanActive] = useState(false)
  const [scanLocked, setScanLocked] = useState(false)

  // Shared by both PIN and QR check-in, so the same "✅ Welcome, ..." / "❌ No active
  // membership - access denied" styling and copy shows regardless of which method was
  // used - staff shouldn't have to learn two different result formats.
  const [resultOk, setResultOk] = useState(true)
  const [resultMessage, setResultMessage] = useState('')
  const [cameraError, setCameraError] = useState('')

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

  // Leaving the branch, or switching away from the QR tab, should always release the
  // camera and clear any stale result rather than leaving it running against a branch
  // that's no longer selected.
  useEffect(() => {
    setScanActive(false)
    setResultMessage('')
    setCameraError('')
  }, [selectedBranch, checkinMode])

  async function kioskCheckin(e: FormEvent) {
    e.preventDefault()
    setResultMessage('')
    try {
      const { data } = await api.post('/api/attendance/checkin', {
        pin: checkinPin, branchId: selectedBranch, method: 'PIN',
      })
      setResultOk(true)
      setResultMessage(data.message)
      setCheckinPin('')
      loadTodayAttendance()
      loadSummary()
      onCheckinSuccess()
    } catch (err: any) {
      setResultOk(false)
      setResultMessage(err.response?.data?.error || 'Check-in failed')
    }
  }

  // Called for every decoded QR frame while scanning is active. On success, the camera
  // is closed immediately (setScanActive(false)) - there's no reason to keep it open
  // once that person is checked in/out, and it stops the same badge re-triggering if
  // it's still sitting in frame. On failure, the camera stays open so staff can retry
  // (e.g. re-position the code) without restarting the scanner, but scanLocked still
  // gates a short cooldown so a failing scan can't spam requests every 100ms.
  async function handleQrScan(decodedText: string) {
    if (scanLocked) return
    setScanLocked(true)
    setResultMessage('Checking...')
    try {
      const { data } = await api.post('/api/attendance/checkin', {
        qrToken: decodedText, branchId: selectedBranch, method: 'QR',
      })
      setResultOk(true)
      setResultMessage(data.message)
      setScanActive(false)
      loadTodayAttendance()
      loadSummary()
      onCheckinSuccess()
    } catch (err: any) {
      setResultOk(false)
      setResultMessage(err.response?.data?.error || 'Check-in failed')
      setTimeout(() => setScanLocked(false), SCAN_RETRY_COOLDOWN_MS)
      return
    }
    setScanLocked(false)
  }

  function startScanning() {
    setCameraError('')
    setResultMessage('')
    setScanActive(true)
  }

  const filteredTodayAttendance = todayAttendance.filter((a) => (attendanceTab === 'MEMBERS' ? a.role === 'MEMBER' : a.role !== 'MEMBER'))
  const todayAttendanceTotalPages = Math.max(1, Math.ceil(filteredTodayAttendance.length / PAGE_SIZE))
  const pagedTodayAttendance = filteredTodayAttendance.slice((todayAttendancePage - 1) * PAGE_SIZE, todayAttendancePage * PAGE_SIZE)

  return (
    <div>
      <div className="grid gap-8 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Reception check-in</h2>
            <div className="flex overflow-hidden rounded-md border border-gray-300 text-xs">
              <button
                onClick={() => setCheckinMode('PIN')}
                className={`px-3 py-1.5 ${checkinMode === 'PIN' ? 'bg-brand text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                PIN
              </button>
              <button
                onClick={() => setCheckinMode('QR')}
                className={`px-3 py-1.5 ${checkinMode === 'QR' ? 'bg-brand text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Scan QR
              </button>
            </div>
          </div>

          {checkinMode === 'PIN' ? (
            <>
              <p className="mt-1 text-xs text-gray-500">Enter the 4-digit PIN to log a visit - works for members and staff alike.</p>
              <form onSubmit={kioskCheckin} className="mt-4 flex gap-2">
                <input placeholder="1234" maxLength={4} required value={checkinPin}
                  onChange={(e) => setCheckinPin(e.target.value.replace(/\D/g, ''))}
                  className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm tracking-widest" />
                <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
                  Check in
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="mt-1 text-xs text-gray-500">Scan the QR code from anyone's dashboard - members, trainers, managers, or the owner.</p>

              {!selectedBranch ? (
                <p className="mt-4 text-sm text-gray-400">Select a branch first.</p>
              ) : !scanActive ? (
                <button onClick={startScanning}
                  className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
                  {resultMessage ? 'Scan next' : 'Start scanning'}
                </button>
              ) : (
                <div className="mt-4">
                  <QrScanner active={scanActive} onScan={handleQrScan} onCameraError={setCameraError} />
                  <button onClick={() => setScanActive(false)}
                    className="mt-3 w-full rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                    Stop scanning
                  </button>
                </div>
              )}

              {cameraError && <p className="mt-3 text-sm text-red-600">{cameraError}</p>}
            </>
          )}

          {resultMessage && (
            <p className={`mt-3 text-sm font-medium ${resultOk ? 'text-green-700' : 'text-red-600'}`}>
              {resultOk ? '✅ ' : '❌ '}{resultMessage}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 p-6">
          <h2 className="font-medium">Today's crowd by hour</h2>
          <div className="mt-4">
            <HourlyCrowdChart data={summary} />
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 p-6">
        <h2 className="font-medium">Today's attendance</h2>
        <div className="mt-3 overflow-x-auto overflow-y-hidden scrollbar-hide border-b border-gray-200">
          <div className="flex min-w-max gap-1">
            {(['MEMBERS', 'STAFF'] as const).map((tab) => (
              <button key={tab} onClick={() => setAttendanceTab(tab)}
                className={`-mb-px flex-shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
                  attendanceTab === tab ? 'border-brand text-brand font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {tab === 'MEMBERS' ? 'Members' : 'Staff'}
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
                    <td className="py-2 pr-4">{a.personName} <span className="text-xs text-gray-400">({a.role})</span></td>
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