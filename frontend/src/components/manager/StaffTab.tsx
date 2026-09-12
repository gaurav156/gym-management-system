import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import PhotoUploadButton from '../PhotoUploadButton'
import type { Branch, StaffSummary, AttendanceLogEntry, AuthUser } from '../../types'

const PAGE_SIZE = 10
const MODAL_PAGE_SIZE = 5

interface Props {
  selectedBranch: string
  allBranches: Branch[]
  lastCheckins: Record<string, string>
  user: AuthUser | null
}

function roleLabel(role: string): string {
  return role === 'OWNER' ? 'Owner' : role === 'MANAGER' ? 'Manager' : 'Trainer'
}

// Fixed display order for role-based sorting - alphabetical ("Manager" < "Owner" 
// "Trainer") wouldn't read naturally, so this sorts by seniority instead.
const ROLE_SORT_ORDER: Record<string, number> = { OWNER: 0, MANAGER: 1, TRAINER: 2 }

export default function StaffTab({ selectedBranch, allBranches, lastCheckins, user }: Props) {
  const [staff, setStaff] = useState<StaffSummary[]>([])
  const [showAllTrainers, setShowAllTrainers] = useState(false)
  const [staffPage, setStaffPage] = useState(1)
  const [staffRoleFilter, setStaffRoleFilter] = useState<'ALL' | 'OWNER' | 'MANAGER' | 'TRAINER'>('ALL')
  const [staffSort, setStaffSort] = useState<'NAME' | 'ROLE'>('NAME')

  const [detailStaffId, setDetailStaffId] = useState<string | null>(null)
  const [staffModalTab, setStaffModalTab] = useState<'INFO' | 'ATTENDANCE' | 'BRANCHES'>('INFO')
  const [staffModalMessage, setStaffModalMessage] = useState('')

  const [editingStaffInfo, setEditingStaffInfo] = useState(false)
  const [staffEditName, setStaffEditName] = useState('')
  const [staffEditPhone, setStaffEditPhone] = useState('')
  const [staffEditAddress, setStaffEditAddress] = useState('')
  const [staffEditPhoto, setStaffEditPhoto] = useState<string | null>(null)

  const [editingTrainerDates, setEditingTrainerDates] = useState(false)
  const [joiningDateInput, setJoiningDateInput] = useState('')
  const [leftDateInput, setLeftDateInput] = useState('')

  const [detailStaffBranches, setDetailStaffBranches] = useState<Branch[]>([])
  const [editingStaffBranches, setEditingStaffBranches] = useState(false)
  const [staffBranchEditIds, setStaffBranchEditIds] = useState<string[]>([])

  const [detailStaffAttendance, setDetailStaffAttendance] = useState<AttendanceLogEntry[]>([])
  const [staffModalPage, setStaffModalPage] = useState(1)

  function loadStaff() {
    if (!selectedBranch) return
    api.get<StaffSummary[]>('/api/staff', { params: { branchId: selectedBranch } }).then((res) => setStaff(res.data))
  }

  useEffect(() => { loadStaff() }, [selectedBranch])

  useEffect(() => {
    setStaffPage(1)
  }, [showAllTrainers, selectedBranch, staffRoleFilter, staffSort])

  function loadDetailStaffBranches(staffId: string) {
    api.get<Branch[]>('/api/branches/mine', { params: { userId: staffId } }).then((res) => setDetailStaffBranches(res.data))
  }

  useEffect(() => {
    setStaffModalMessage('')
    setEditingStaffInfo(false)
    setEditingStaffBranches(false)
    setEditingTrainerDates(false)
    if (detailStaffId) {
      const s = staff.find((x) => x.id === detailStaffId)
      setStaffModalTab('INFO')
      setStaffModalPage(1)
      api.get<AttendanceLogEntry[]>(`/api/attendance/history/${detailStaffId}`).then((res) => setDetailStaffAttendance(res.data))
      if (s?.role !== 'OWNER') {
        loadDetailStaffBranches(detailStaffId)
      } else {
        setDetailStaffBranches([])
      }
    }
  }, [detailStaffId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setStaffModalMessage('')
  }, [staffModalTab])

  function startEditStaffInfo(s: StaffSummary) {
    setEditingStaffInfo(true)
    setStaffEditName(s.name)
    setStaffEditPhone(s.phone ?? '')
    setStaffEditAddress(s.address ?? '')
    setStaffEditPhoto(s.photo)
    setStaffModalMessage('')
  }

  // Endpoint depends on role - Manager edits go through /api/managers/{id} (Owner-only
  // on the backend), Trainer edits keep using /api/trainers/{id} (Owner or Manager).
  async function saveStaffInfo(s: StaffSummary) {
    const endpoint = s.role === 'MANAGER' ? `/api/managers/${s.id}` : `/api/trainers/${s.id}`
    try {
      await api.put(endpoint, {
        name: staffEditName, phone: staffEditPhone, address: staffEditAddress, photo: staffEditPhoto ?? '',
      })
      setEditingStaffInfo(false)
      loadStaff()
    } catch (err: any) {
      setStaffModalMessage(err.response?.data?.error || 'Failed to update staff info')
    }
  }

  function startEditTrainerDates(t: StaffSummary) {
    setEditingTrainerDates(true)
    setJoiningDateInput(t.joiningDate ?? '')
    setLeftDateInput(t.leftDate ?? '')
    setStaffModalMessage('')
  }

  async function saveTrainerDates(trainerId: string) {
    try {
      await api.put(`/api/trainers/${trainerId}/dates`, {
        joiningDate: joiningDateInput || null,
        leftDate: leftDateInput || null,
      })
      setEditingTrainerDates(false)
      loadStaff()
    } catch (err: any) {
      setStaffModalMessage(err.response?.data?.error || 'Failed to update trainer dates')
    }
  }

  async function clearLeftDate(trainerId: string, joiningDate: string | null) {
    try {
      await api.put(`/api/trainers/${trainerId}/dates`, { joiningDate, leftDate: null })
      loadStaff()
    } catch (err: any) {
      setStaffModalMessage(err.response?.data?.error || 'Failed to clear left date')
    }
  }

  async function saveStaffBranches(staffId: string) {
    if (staffBranchEditIds.length === 0) {
      setStaffModalMessage('Select at least one branch.')
      return
    }
    try {
      await api.put(`/api/branches/assignments/${staffId}`, { branchIds: staffBranchEditIds })
      setEditingStaffBranches(false)
      loadDetailStaffBranches(staffId)
      loadStaff()
    } catch (err: any) {
      setStaffModalMessage(err.response?.data?.error || 'Failed to update branch assignments')
    }
  }

  // Deletion already goes through the existing Owner-only /api/owner/users/{id} endpoint
  // for any non-Owner account - works for Manager and Trainer alike.
  async function deleteStaff(staffId: string, name: string) {
    if (!confirm(
      `Permanently delete ${name}'s account? This removes their attendance log and cannot be undone.`
    )) return
    try {
      await api.delete(`/api/owner/users/${staffId}`)
      setDetailStaffId(null)
      loadStaff()
    } catch (err: any) {
      setStaffModalMessage(err.response?.data?.error || 'Failed to delete account')
    }
  }

  const visibleStaff = staff
    .filter((s) => s.role !== 'TRAINER' || showAllTrainers || !s.leftDate)
    .filter((s) => staffRoleFilter === 'ALL' || s.role === staffRoleFilter)
    .sort((a, b) => staffSort === 'NAME'
      ? a.name.localeCompare(b.name)
      : (ROLE_SORT_ORDER[a.role] - ROLE_SORT_ORDER[b.role]) || a.name.localeCompare(b.name))

  const staffTotalPages = Math.max(1, Math.ceil(visibleStaff.length / PAGE_SIZE))
  const pagedStaff = visibleStaff.slice((staffPage - 1) * PAGE_SIZE, staffPage * PAGE_SIZE)

  const detailStaff = staff.find((s) => s.id === detailStaffId) ?? null
  const staffModalTotalPages = Math.max(1, Math.ceil(detailStaffAttendance.length / MODAL_PAGE_SIZE))
  const pagedStaffAttendance = detailStaffAttendance.slice((staffModalPage - 1) * MODAL_PAGE_SIZE, staffModalPage * MODAL_PAGE_SIZE)

  // Edit-info is available for Trainer (Owner or Manager) and Manager (Owner only).
  const canEditInfo = detailStaff && detailStaff.role !== 'OWNER' &&
    (detailStaff.role === 'TRAINER' || user?.role === 'OWNER')

  // Delete is Owner-only, and never for the Owner's own account.
  const canDelete = detailStaff && detailStaff.role !== 'OWNER' && user?.role === 'OWNER'

  return (
    <div>
      <div className="rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Staff</h2>
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <input type="checkbox" checked={showAllTrainers} onChange={(e) => setShowAllTrainers(e.target.checked)} />
            Show all trainers (including left)
          </label>
        </div>
        <p className="mt-1 text-xs text-gray-500">Owner, Managers, and Trainers for this branch - all can check in/out.</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <select value={staffRoleFilter} onChange={(e) => setStaffRoleFilter(e.target.value as any)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="ALL">All roles</option>
            <option value="OWNER">Owner</option>
            <option value="MANAGER">Manager</option>
            <option value="TRAINER">Trainer</option>
          </select>
          <select value={staffSort} onChange={(e) => setStaffSort(e.target.value as any)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="NAME">Sort: Name</option>
            <option value="ROLE">Sort: Role</option>
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Role</th>
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">Phone</th>
                <th className="pb-2 pr-4">PIN</th>
                <th className="pb-2 pr-4">Last visit</th>
                <th className="pb-2">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagedStaff.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      {s.photo ? (
                        <img src={s.photo} alt="" className="h-6 w-6 flex-shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] text-gray-500">
                          {s.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      {s.name}
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-gray-500">{roleLabel(s.role)}</td>
                  <td className="py-2 pr-4 text-gray-500">{s.email}</td>
                  <td className="py-2 pr-4 text-gray-500">{s.phone ?? '—'}</td>
                  <td className="py-2 pr-4 text-gray-500">{s.checkinPin ?? '—'}</td>
                  <td className="py-2 pr-4 text-gray-500">
                    {lastCheckins[s.id] ? new Date(lastCheckins[s.id]).toLocaleString() : 'Never'}
                  </td>
                  <td className="py-2">
                    <button onClick={() => setDetailStaffId(s.id)} className="text-xs text-brand hover:underline">
                      View/Edit details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleStaff.length === 0 && (
            <p className="py-4 text-sm text-gray-400">
              {staff.length === 0 ? 'No staff assigned to this branch yet.' : 'No staff match the current filters.'}
            </p>
          )}
          {visibleStaff.length > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>Page {staffPage} of {staffTotalPages} ({visibleStaff.length} total)</span>
              <div className="space-x-2">
                <button disabled={staffPage === 1} onClick={() => setStaffPage((p) => p - 1)}
                  className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
                <button disabled={staffPage === staffTotalPages} onClick={() => setStaffPage((p) => p + 1)}
                  className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {detailStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetailStaffId(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {detailStaff.photo ? (
                  <img src={detailStaff.photo} alt="" className="h-12 w-12 flex-shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-lg text-gray-500">
                    {detailStaff.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div>
                  <h3 className="text-lg font-medium">{detailStaff.name}</h3>
                  <p className="text-xs text-gray-500">
                    {roleLabel(detailStaff.role)} · {detailStaff.email} · PIN {detailStaff.checkinPin ?? '—'}
                  </p>
                </div>
              </div>
              <button onClick={() => setDetailStaffId(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="mt-4 overflow-x-auto overflow-y-hidden scrollbar-hide border-b border-gray-200">
              <div className="flex min-w-max gap-1">
                {(['INFO', 'ATTENDANCE', 'BRANCHES'] as const).map((tab) => (
                  <button key={tab} onClick={() => setStaffModalTab(tab)}
                    className={`-mb-px flex-shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
                      staffModalTab === tab ? 'border-brand text-brand font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}>
                    {tab === 'INFO' ? 'Info' : tab === 'ATTENDANCE' ? 'Attendance' : 'Branches'}
                  </button>
                ))}
              </div>
            </div>

            {staffModalMessage && <p className="mt-3 text-sm text-red-600">{staffModalMessage}</p>}

            {staffModalTab === 'INFO' && (
              <div className="mt-4 space-y-2 text-sm">
                {editingStaffInfo ? (
                  <div className="space-y-3 rounded-md border border-gray-200 p-3">
                    <div className="flex items-center gap-3">
                      {staffEditPhoto ? (
                        <img src={staffEditPhoto} alt="" className="h-14 w-14 flex-shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-lg text-gray-500">
                          {staffEditName.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="flex flex-col items-start gap-1.5">
                        <PhotoUploadButton onLoaded={setStaffEditPhoto} onError={setStaffModalMessage} label="Change photo" size="sm" />
                        {staffEditPhoto && (
                          <button type="button" onClick={() => setStaffEditPhoto(null)}
                            className="text-xs text-red-600 hover:underline">Remove photo</button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Name</label>
                      <input value={staffEditName} onChange={(e) => setStaffEditName(e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Phone</label>
                      <input value={staffEditPhone} onChange={(e) => setStaffEditPhone(e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Address</label>
                      <textarea value={staffEditAddress} onChange={(e) => setStaffEditAddress(e.target.value)} rows={2}
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm" />
                    </div>
                    <div className="space-x-2">
                      <button onClick={() => saveStaffInfo(detailStaff)}
                        className="text-xs text-green-700 hover:underline">Save</button>
                      <button onClick={() => setEditingStaffInfo(false)}
                        className="text-xs text-gray-500 hover:underline">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p><span className="text-gray-500">Role:</span> {roleLabel(detailStaff.role)}</p>
                    <p><span className="text-gray-500">Name:</span> {detailStaff.name}</p>
                    <p><span className="text-gray-500">Email:</span> {detailStaff.email}</p>
                    <p><span className="text-gray-500">Phone:</span> {detailStaff.phone ?? '—'}</p>
                    <p><span className="text-gray-500">Address:</span> {detailStaff.address ?? '—'}</p>
                    <p><span className="text-gray-500">Check-in PIN:</span> {detailStaff.checkinPin ?? '—'}</p>
                    <p><span className="text-gray-500">Last visit:</span> {
                      lastCheckins[detailStaff.id] ? new Date(lastCheckins[detailStaff.id]).toLocaleString() : 'Never'
                    }</p>
                    {canEditInfo && (
                      <button onClick={() => startEditStaffInfo(detailStaff)}
                        className="text-xs text-gray-600 hover:underline">Edit info</button>
                    )}
                    {canDelete && (
                      <button onClick={() => deleteStaff(detailStaff.id, detailStaff.name)}
                        className="ml-3 text-xs text-red-600 hover:underline">
                        Delete account
                      </button>
                    )}
                    {detailStaff.role === 'OWNER' && user?.role === 'OWNER' && (
                      <p className="text-xs text-gray-400">Owner info is edited from the Profile page.</p>
                    )}
                  </>
                )}

                {detailStaff.role === 'TRAINER' && (
                  <>
                    <hr />
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
                          <button onClick={() => saveTrainerDates(detailStaff.id)}
                            className="text-xs text-green-700 hover:underline">Save</button>
                          <button onClick={() => setEditingTrainerDates(false)}
                            className="text-xs text-gray-500 hover:underline">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p><span className="text-gray-500">Joining date:</span> {detailStaff.joiningDate ?? '—'}</p>
                        <p><span className="text-gray-500">Left date:</span> {detailStaff.leftDate ?? '—'}</p>
                        {user?.role === 'OWNER' && (
                          <div className="space-x-2">
                            <button onClick={() => startEditTrainerDates(detailStaff)}
                              className="text-xs text-gray-600 hover:underline">Edit dates</button>
                            {detailStaff.leftDate && (
                              <button onClick={() => clearLeftDate(detailStaff.id, detailStaff.joiningDate)}
                                className="text-xs text-brand hover:underline">Clear left date</button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {staffModalTab === 'ATTENDANCE' && (
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
                    {pagedStaffAttendance.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2 pr-4 text-gray-500">{new Date(a.checkInTime).toLocaleString()}</td>
                        <td className="py-2 pr-4 text-gray-500">{a.checkOutTime ? new Date(a.checkOutTime).toLocaleString() : '—'}</td>
                        <td className="py-2 pr-4">{a.method}</td>
                        <td className="py-2 text-gray-500">{a.branchName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {detailStaffAttendance.length === 0 && <p className="py-4 text-sm text-gray-400">No visits logged yet.</p>}
                {detailStaffAttendance.length > 0 && (
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <span>Page {staffModalPage} of {staffModalTotalPages} ({detailStaffAttendance.length} total)</span>
                    <div className="space-x-2">
                      <button disabled={staffModalPage === 1} onClick={() => setStaffModalPage((p) => p - 1)}
                        className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
                      <button disabled={staffModalPage === staffModalTotalPages} onClick={() => setStaffModalPage((p) => p + 1)}
                        className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {staffModalTab === 'BRANCHES' && (
              <div className="mt-4 text-sm">
                {detailStaff.role === 'OWNER' ? (
                  <p className="text-gray-500">Owner has implicit access to every branch.</p>
                ) : editingStaffBranches ? (
                  <div className="space-y-3">
                    <div className="rounded-md border border-gray-300 p-2">
                      {allBranches.map((b) => (
                        <label key={b.id} className="flex items-center gap-2 py-1">
                          <input type="checkbox" checked={staffBranchEditIds.includes(b.id)}
                            onChange={() => setStaffBranchEditIds((ids) =>
                              ids.includes(b.id) ? ids.filter((x) => x !== b.id) : [...ids, b.id])} />
                          {b.name}
                        </label>
                      ))}
                    </div>
                    <div className="space-x-2">
                      <button onClick={() => saveStaffBranches(detailStaff.id)}
                        className="text-xs text-green-700 hover:underline">Save</button>
                      <button onClick={() => setEditingStaffBranches(false)}
                        className="text-xs text-gray-500 hover:underline">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <ul className="space-y-1">
                      {detailStaffBranches.map((b) => <li key={b.id}>{b.name}</li>)}
                      {detailStaffBranches.length === 0 && <li className="text-gray-400">No branches assigned.</li>}
                    </ul>
                    {user?.role === 'OWNER' && (
                      <button onClick={() => { setEditingStaffBranches(true); setStaffBranchEditIds(detailStaffBranches.map((b) => b.id)) }}
                        className="mt-3 text-xs text-gray-600 hover:underline">
                        Edit branches
                      </button>
                    )}
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