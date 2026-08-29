import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { handleEditPhotoChange } from '../../utils/photo'
import type { Branch, TrainerSummary, AttendanceLogEntry, AuthUser } from '../../types'

const PAGE_SIZE = 10
const MODAL_PAGE_SIZE = 5

interface Props {
  selectedBranch: string
  allBranches: Branch[]
  lastCheckins: Record<string, string>
  user: AuthUser | null
}

export default function TrainersTab({ selectedBranch, allBranches, lastCheckins, user }: Props) {
  const [trainers, setTrainers] = useState<TrainerSummary[]>([])
  const [showAllTrainers, setShowAllTrainers] = useState(false)
  const [trainerPage, setTrainerPage] = useState(1)

  const [detailTrainerId, setDetailTrainerId] = useState<string | null>(null)
  const [trainerModalTab, setTrainerModalTab] = useState<'INFO' | 'ATTENDANCE' | 'BRANCHES'>('INFO')
  const [trainerModalMessage, setTrainerModalMessage] = useState('')

  const [editingTrainerInfo, setEditingTrainerInfo] = useState(false)
  const [trainerEditName, setTrainerEditName] = useState('')
  const [trainerEditPhone, setTrainerEditPhone] = useState('')
  const [trainerEditAddress, setTrainerEditAddress] = useState('')
  const [trainerEditPhoto, setTrainerEditPhoto] = useState<string | null>(null)

  const [editingTrainerDates, setEditingTrainerDates] = useState(false)
  const [joiningDateInput, setJoiningDateInput] = useState('')
  const [leftDateInput, setLeftDateInput] = useState('')

  const [detailTrainerBranches, setDetailTrainerBranches] = useState<Branch[]>([])
  const [editingTrainerBranches, setEditingTrainerBranches] = useState(false)
  const [trainerBranchEditIds, setTrainerBranchEditIds] = useState<string[]>([])

  const [detailTrainerAttendance, setDetailTrainerAttendance] = useState<AttendanceLogEntry[]>([])
  const [trainerModalPage, setTrainerModalPage] = useState(1)

  function loadTrainers() {
    if (!selectedBranch) return
    api.get<TrainerSummary[]>('/api/trainers', { params: { branchId: selectedBranch } }).then((res) => setTrainers(res.data))
  }

  useEffect(() => { loadTrainers() }, [selectedBranch])

  useEffect(() => {
    setTrainerPage(1)
  }, [showAllTrainers, selectedBranch])

  function loadDetailTrainerBranches(trainerId: string) {
    api.get<Branch[]>('/api/branches/mine', { params: { userId: trainerId } }).then((res) => setDetailTrainerBranches(res.data))
  }

  useEffect(() => {
    setTrainerModalMessage('')
    setEditingTrainerInfo(false)
    setEditingTrainerBranches(false)
    setEditingTrainerDates(false)
    if (detailTrainerId) {
      loadDetailTrainerBranches(detailTrainerId)
      setTrainerModalTab('INFO')
      setTrainerModalPage(1)
      api.get<AttendanceLogEntry[]>(`/api/attendance/history/${detailTrainerId}`).then((res) => setDetailTrainerAttendance(res.data))
    }
  }, [detailTrainerId])

  useEffect(() => {
    setTrainerModalMessage('')
  }, [trainerModalTab])

  function startEditTrainerInfo(t: TrainerSummary) {
    setEditingTrainerInfo(true)
    setTrainerEditName(t.name)
    setTrainerEditPhone(t.phone ?? '')
    setTrainerEditAddress(t.address ?? '')
    setTrainerEditPhoto(t.photo)
    setTrainerModalMessage('')
  }

  async function saveTrainerInfo(trainerId: string) {
    try {
      await api.put(`/api/trainers/${trainerId}`, {
        name: trainerEditName, phone: trainerEditPhone, address: trainerEditAddress, photo: trainerEditPhoto ?? '',
      })
      setEditingTrainerInfo(false)
      loadTrainers()
    } catch (err: any) {
      setTrainerModalMessage(err.response?.data?.error || 'Failed to update trainer info')
    }
  }

  function startEditTrainerDates(t: TrainerSummary) {
    setEditingTrainerDates(true)
    setJoiningDateInput(t.joiningDate ?? '')
    setLeftDateInput(t.leftDate ?? '')
    setTrainerModalMessage('')
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
      setTrainerModalMessage(err.response?.data?.error || 'Failed to update trainer dates')
    }
  }

  async function clearLeftDate(trainerId: string, joiningDate: string | null) {
    try {
      await api.put(`/api/trainers/${trainerId}/dates`, { joiningDate, leftDate: null })
      loadTrainers()
    } catch (err: any) {
      setTrainerModalMessage(err.response?.data?.error || 'Failed to clear left date')
    }
  }

  async function saveTrainerBranches(trainerId: string) {
    if (trainerBranchEditIds.length === 0) {
      setTrainerModalMessage('Select at least one branch.')
      return
    }
    try {
      await api.put(`/api/branches/assignments/${trainerId}`, { branchIds: trainerBranchEditIds })
      setEditingTrainerBranches(false)
      loadDetailTrainerBranches(trainerId)
      loadTrainers()
    } catch (err: any) {
      setTrainerModalMessage(err.response?.data?.error || 'Failed to update branch assignments')
    }
  }

  const visibleTrainers = trainers.filter((t) => showAllTrainers || !t.leftDate)
  const trainerTotalPages = Math.max(1, Math.ceil(visibleTrainers.length / PAGE_SIZE))
  const pagedTrainers = visibleTrainers.slice((trainerPage - 1) * PAGE_SIZE, trainerPage * PAGE_SIZE)

  const detailTrainer = trainers.find((t) => t.id === detailTrainerId) ?? null
  const trainerModalTotalPages = Math.max(1, Math.ceil(detailTrainerAttendance.length / MODAL_PAGE_SIZE))
  const pagedTrainerAttendance = detailTrainerAttendance.slice((trainerModalPage - 1) * MODAL_PAGE_SIZE, trainerModalPage * MODAL_PAGE_SIZE)

  return (
    <div>
      <div className="rounded-lg border border-gray-200 p-6">
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
              {(['INFO', 'ATTENDANCE', 'BRANCHES'] as const).map((tab) => (
                <button key={tab} onClick={() => setTrainerModalTab(tab)}
                  className={`-mb-px border-b-2 px-3 py-2 ${
                    trainerModalTab === tab ? 'border-brand text-brand font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                  {tab === 'INFO' ? 'Info' : tab === 'ATTENDANCE' ? 'Attendance' : 'Branches'}
                </button>
              ))}
            </div>

            {trainerModalMessage && <p className="mt-3 text-sm text-red-600">{trainerModalMessage}</p>}

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
                          onChange={(e) => handleEditPhotoChange(e, setTrainerEditPhoto, setTrainerModalMessage)} className="text-xs" />
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
                  <div className="space-y-3 rounded-md border border-gray-200 p-3">
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
                <p className="mb-2 text-xs text-gray-500">Second scan of the day at the same branch records check-out.</p>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                      <th className="pb-2 pr-4">Check-in</th>
                      <th className="pb-2 pr-4">Check-out</th>
                      <th className="pb-2 pr-4">Method</th>
                      <th className="pb-2">Branch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pagedTrainerAttendance.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2 pr-4 text-gray-500">{new Date(a.checkInTime).toLocaleString()}</td>
                        <td className="py-2 pr-4 text-gray-500">{a.checkOutTime ? new Date(a.checkOutTime).toLocaleString() : '—'}</td>
                        <td className="py-2 pr-4">{a.method}</td>
                        <td className="py-2 text-gray-500">{a.branchName}</td>
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

            {trainerModalTab === 'BRANCHES' && (
              <div className="mt-4 text-sm">
                {editingTrainerBranches ? (
                  <div className="space-y-3">
                    <div className="rounded-md border border-gray-300 p-2">
                      {allBranches.map((b) => (
                        <label key={b.id} className="flex items-center gap-2 py-1">
                          <input type="checkbox" checked={trainerBranchEditIds.includes(b.id)}
                            onChange={() => setTrainerBranchEditIds((ids) =>
                              ids.includes(b.id) ? ids.filter((x) => x !== b.id) : [...ids, b.id])} />
                          {b.name}
                        </label>
                      ))}
                    </div>
                    <div className="space-x-2">
                      <button onClick={() => saveTrainerBranches(detailTrainer.id)}
                        className="text-xs text-green-700 hover:underline">Save</button>
                      <button onClick={() => setEditingTrainerBranches(false)}
                        className="text-xs text-gray-500 hover:underline">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <ul className="space-y-1">
                      {detailTrainerBranches.map((b) => <li key={b.id}>{b.name}</li>)}
                      {detailTrainerBranches.length === 0 && <li className="text-gray-400">No branches assigned.</li>}
                    </ul>
                    <button onClick={() => { setEditingTrainerBranches(true); setTrainerBranchEditIds(detailTrainerBranches.map((b) => b.id)) }}
                      className="mt-3 text-xs text-gray-600 hover:underline">
                      Edit branches
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}