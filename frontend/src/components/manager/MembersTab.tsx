import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { api } from '../../api/client'
import { getEffectiveStatus, statusColorClass, statusLabel, type EffectiveStatus } from '../../utils/membership'
import { handleEditPhotoChange } from '../../utils/photo'
import type { Branch, MembershipAdmin, Payment, AttendanceLogEntry, MemberSummary } from '../../types'

const PAGE_SIZE = 10
const MODAL_PAGE_SIZE = 5

interface Props {
  selectedBranch: string
  allBranches: Branch[]
  lastCheckins: Record<string, string>
}

export default function MembersTab({ selectedBranch, allBranches, lastCheckins }: Props) {
  const [members, setMembers] = useState<MemberSummary[]>([])
  const [memberships, setMemberships] = useState<MembershipAdmin[]>([])

  const [memberSearch, setMemberSearch] = useState('')
  const [memberStatusFilter, setMemberStatusFilter] = useState<'ALL' | EffectiveStatus | 'NONE'>('ALL')
  const [memberSort, setMemberSort] = useState<'NAME' | 'STATUS'>('NAME')
  const [memberPage, setMemberPage] = useState(1)

  const [detailMemberId, setDetailMemberId] = useState<string | null>(null)
  const [modalTab, setModalTab] = useState<'INFO' | 'MEMBERSHIPS' | 'PAYMENTS' | 'ATTENDANCE' | 'BRANCHES'>('INFO')
  const [modalShowExpired, setModalShowExpired] = useState(false)
  const [modalPage, setModalPage] = useState(1)
  const [memberModalMessage, setMemberModalMessage] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')

  const [editingMemberInfo, setEditingMemberInfo] = useState(false)
  const [memberEditName, setMemberEditName] = useState('')
  const [memberEditPhone, setMemberEditPhone] = useState('')
  const [memberEditAddress, setMemberEditAddress] = useState('')
  const [memberEditPhoto, setMemberEditPhoto] = useState<string | null>(null)

  const [detailMemberBranches, setDetailMemberBranches] = useState<Branch[]>([])
  const [editingMemberBranches, setEditingMemberBranches] = useState(false)
  const [memberBranchEditIds, setMemberBranchEditIds] = useState<string[]>([])

  const [detailPayments, setDetailPayments] = useState<Payment[]>([])
  const [detailAttendance, setDetailAttendance] = useState<AttendanceLogEntry[]>([])
  const [detailMembershipsFetched, setDetailMembershipsFetched] = useState<MembershipAdmin[]>([])
  const [detailPaymentsPage, setDetailPaymentsPage] = useState(1)
  const [detailAttendancePage, setDetailAttendancePage] = useState(1)

  function loadMembers() {
    if (!selectedBranch) return
    api.get<MemberSummary[]>('/api/members', { params: { branchId: selectedBranch } }).then((res) => setMembers(res.data))
  }

  function loadMemberships() {
    if (!selectedBranch) return
    api.get<MembershipAdmin[]>(`/api/memberships/branch/${selectedBranch}`).then((res) => setMemberships(res.data))
  }

  useEffect(() => {
    loadMembers()
    loadMemberships()
  }, [selectedBranch])

  useEffect(() => {
    setMemberPage(1)
  }, [memberSearch, memberStatusFilter, memberSort, selectedBranch])

  function loadDetailMemberBranches(memberId: string) {
    api.get<Branch[]>('/api/branches/mine', { params: { userId: memberId } }).then((res) => setDetailMemberBranches(res.data))
  }

  useEffect(() => {
    setModalPage(1)
  }, [detailMemberId, modalShowExpired])

  useEffect(() => {
    setMemberModalMessage('')
    if (!detailMemberId) return
    setModalTab('INFO')
    setDetailPaymentsPage(1)
    setDetailAttendancePage(1)
    setEditingMemberInfo(false)
    setEditingMemberBranches(false)
    api.get<Payment[]>(`/api/payments/member/${detailMemberId}`).then((res) => setDetailPayments(res.data))
    api.get<AttendanceLogEntry[]>(`/api/attendance/history/${detailMemberId}`).then((res) => setDetailAttendance(res.data))
    api.get<MembershipAdmin[]>(`/api/memberships/member/${detailMemberId}`).then((res) => setDetailMembershipsFetched(res.data))
    loadDetailMemberBranches(detailMemberId)
  }, [detailMemberId])

  useEffect(() => {
    setMemberModalMessage('')
  }, [modalTab])

  // Refreshes both the branch-scoped table and the currently-open member modal's own
  // fetch - the modal derives from its own fetch (not the branch list), so an action
  // taken inside it needs its own explicit refresh too.
  function refreshMembershipViews() {
    loadMemberships()
    if (detailMemberId) {
      api.get<MembershipAdmin[]>(`/api/memberships/member/${detailMemberId}`).then((res) => setDetailMembershipsFetched(res.data))
    }
  }

  function startEdit(m: MembershipAdmin) {
    setEditingId(m.id)
    setEditStartDate(m.startDate)
    setEditEndDate(m.endDate)
    setMemberModalMessage('')
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(id: string) {
    if (editEndDate < editStartDate) {
      setMemberModalMessage('End date cannot be before start date.')
      return
    }
    setMemberModalMessage('')
    try {
      await api.put(`/api/memberships/${id}`, { startDate: editStartDate, endDate: editEndDate })
      setEditingId(null)
      refreshMembershipViews()
    } catch (err: any) {
      setMemberModalMessage(err.response?.data?.error || 'Failed to update')
    }
  }

  async function cancelMembership(id: string) {
    if (!confirm('Cancel this membership? The member will lose gym access immediately.')) return
    setMemberModalMessage('')
    try {
      await api.post(`/api/memberships/${id}/cancel`)
      refreshMembershipViews()
    } catch (err: any) {
      setMemberModalMessage(err.response?.data?.error || 'Failed to cancel')
    }
  }

  async function pauseMembership(id: string) {
    setMemberModalMessage('')
    try {
      await api.post(`/api/memberships/${id}/pause`)
      refreshMembershipViews()
    } catch (err: any) {
      setMemberModalMessage(err.response?.data?.error || 'Failed to pause')
    }
  }

  async function resumeMembership(id: string) {
    setMemberModalMessage('')
    try {
      await api.post(`/api/memberships/${id}/resume`)
      refreshMembershipViews()
    } catch (err: any) {
      setMemberModalMessage(err.response?.data?.error || 'Failed to resume')
    }
  }

  function startEditMemberInfo(m: MemberSummary) {
    setEditingMemberInfo(true)
    setMemberEditName(m.name)
    setMemberEditPhone(m.phone ?? '')
    setMemberEditAddress(m.address ?? '')
    setMemberEditPhoto(m.photo)
    setMemberModalMessage('')
  }

  async function saveMemberInfo(memberId: string) {
    try {
      await api.put(`/api/members/${memberId}`, {
        name: memberEditName, phone: memberEditPhone, address: memberEditAddress, photo: memberEditPhoto ?? '',
      })
      setEditingMemberInfo(false)
      loadMembers()
    } catch (err: any) {
      setMemberModalMessage(err.response?.data?.error || 'Failed to update member info')
    }
  }

  async function saveMemberBranches(memberId: string) {
    if (memberBranchEditIds.length === 0) {
      setMemberModalMessage('Select at least one branch.')
      return
    }
    try {
      await api.put(`/api/branches/assignments/${memberId}`, { branchIds: memberBranchEditIds })
      setEditingMemberBranches(false)
      loadDetailMemberBranches(memberId)
      loadMembers()
    } catch (err: any) {
      setMemberModalMessage(err.response?.data?.error || 'Failed to update branch assignments')
    }
  }

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
  const detailMemberships = detailMembershipsFetched
    .filter((ms) => {
      const effective = getEffectiveStatus(ms)
      return modalShowExpired || (effective !== 'EXPIRED' && effective !== 'CANCELLED')
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
  const modalTotalPages = Math.max(1, Math.ceil(detailMemberships.length / MODAL_PAGE_SIZE))
  const pagedDetailMemberships = detailMemberships.slice((modalPage - 1) * MODAL_PAGE_SIZE, modalPage * MODAL_PAGE_SIZE)

  const detailPaymentsTotalPages = Math.max(1, Math.ceil(detailPayments.length / MODAL_PAGE_SIZE))
  const pagedDetailPayments = detailPayments.slice((detailPaymentsPage - 1) * MODAL_PAGE_SIZE, detailPaymentsPage * MODAL_PAGE_SIZE)

  const detailAttendanceTotalPages = Math.max(1, Math.ceil(detailAttendance.length / MODAL_PAGE_SIZE))
  const pagedDetailAttendance = detailAttendance.slice((detailAttendancePage - 1) * MODAL_PAGE_SIZE, detailAttendancePage * MODAL_PAGE_SIZE)

  return (
    <div>
      <div className="rounded-lg border border-gray-200 p-6">
        <h2 className="font-medium">Members</h2>
        <p className="mt-1 text-xs text-gray-500">Click a member to view all their plans and take action.</p>

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

            <div className="mt-4 overflow-x-auto overflow-y-hidden scrollbar-hide border-b border-gray-200">
              <div className="flex min-w-max gap-1">
                {(['INFO', 'MEMBERSHIPS', 'PAYMENTS', 'ATTENDANCE', 'BRANCHES'] as const).map((tab) => (
                  <button key={tab} onClick={() => setModalTab(tab)}
                    className={`-mb-px flex-shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
                      modalTab === tab ? 'border-brand text-brand font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}>
                    {tab === 'INFO' ? 'Info' : tab === 'MEMBERSHIPS' ? 'Membership plans' : tab === 'PAYMENTS' ? 'Payment history' : tab === 'ATTENDANCE' ? 'Attendance' : 'Branches'}
                  </button>
                ))}
              </div>
            </div>

            {memberModalMessage && <p className="mt-3 text-sm text-red-600">{memberModalMessage}</p>}

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
                          onChange={(e) => handleEditPhotoChange(e, setMemberEditPhoto, setMemberModalMessage)} className="text-xs" />
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
                    {pagedDetailAttendance.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2 pr-4 text-gray-500">{new Date(a.checkInTime).toLocaleString()}</td>
                        <td className="py-2 pr-4 text-gray-500">{a.checkOutTime ? new Date(a.checkOutTime).toLocaleString() : '—'}</td>
                        <td className="py-2 pr-4">{a.method}</td>
                        <td className="py-2 text-gray-500">{a.branchName}</td>
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

            {modalTab === 'BRANCHES' && (
              <div className="mt-4 text-sm">
                {editingMemberBranches ? (
                  <div className="space-y-3">
                    <div className="rounded-md border border-gray-300 p-2">
                      {allBranches.map((b) => (
                        <label key={b.id} className="flex items-center gap-2 py-1">
                          <input type="checkbox" checked={memberBranchEditIds.includes(b.id)}
                            onChange={() => setMemberBranchEditIds((ids) =>
                              ids.includes(b.id) ? ids.filter((x) => x !== b.id) : [...ids, b.id])} />
                          {b.name}
                        </label>
                      ))}
                    </div>
                    <div className="space-x-2">
                      <button onClick={() => saveMemberBranches(detailMember.id)}
                        className="text-xs text-green-700 hover:underline">Save</button>
                      <button onClick={() => setEditingMemberBranches(false)}
                        className="text-xs text-gray-500 hover:underline">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <ul className="space-y-1">
                      {detailMemberBranches.map((b) => <li key={b.id}>{b.name}</li>)}
                      {detailMemberBranches.length === 0 && <li className="text-gray-400">No branches assigned.</li>}
                    </ul>
                    <button onClick={() => { setEditingMemberBranches(true); setMemberBranchEditIds(detailMemberBranches.map((b) => b.id)) }}
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