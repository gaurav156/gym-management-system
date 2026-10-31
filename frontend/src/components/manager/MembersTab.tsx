import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { getEffectiveStatus, statusColorClass, statusLabel, type EffectiveStatus } from '../../utils/membership'
import PhotoUploadButton from '../PhotoUploadButton'
import type { Branch, MembershipAdmin, MemberSummary, InvoiceResponse, AuthUser, Gender } from '../../types'
import { viewInvoice, printInvoice, downloadInvoice } from '../../utils/invoice'
import ConfirmDialog from '../ConfirmDialog'
import { TableSkeleton } from '../Skeleton'
import { useConfirm } from '../../hooks/useConfirm'
import RoleChangeOtpDialog, { type RoleChangeOtpTarget } from '../RoleChangeOtpDialog'
import Avatar from '../Avatar'
import RowActionsMenu from '../RowActionsMenu'
import ActionButton from '../ActionButton'
import { EyeIcon, PrinterIcon, DownloadIcon, MailIcon, WhatsAppIcon, PencilIcon, TrashIcon, BanIcon, CalendarIcon, PauseIcon, PlayIcon, CoinIcon, MapPinIcon } from '../icons/ActionIcons'
import ProductPurchaseHistoryTab from '../ProductPurchaseHistoryTab'
import PersonalDetailsFields from '../PersonalDetailsFields'
import IdProofField from '../IdProofField'
import { genderLabel, formatDobWithAge } from '../../utils/person'
import { useScrollLock } from '../../hooks/useScrollLock'
import { toast, getErrorMessage } from '../../store/toastStore'
import EditActions from '../EditActions'
import { useMembers, invalidatePeople, invalidateMembershipData, usePersonPayments, usePersonAttendance, usePersonMemberships, useMyBranches, useRoleHistory, qk, NO_BRANCHES } from '../../api/queries'
import RefreshButton from '../RefreshButton'
import { queryClient } from '../../api/queryClient'

const NO_MEMBERSHIPS: MembershipAdmin[] = []
const NO_MEMBERS: MemberSummary[] = []
const PAGE_SIZE = 10
const MODAL_PAGE_SIZE = 5

interface Props {
  selectedBranch: string
  allBranches: Branch[]
  lastCheckins: Record<string, string>
  user: AuthUser | null
}

export default function MembersTab({ selectedBranch, allBranches, lastCheckins, user }: Props) {


  const [memberSearchInput, setMemberSearchInput] = useState('') // what's in the box
  const [memberSearch, setMemberSearch] = useState('')           // what was last sent to the server
  const [memberStatusFilter, setMemberStatusFilter] = useState<'ALL' | EffectiveStatus | 'NONE'>('ALL')
  const [memberSort, setMemberSort] = useState<'NAME' | 'STATUS'>('NAME')
  const [memberPage, setMemberPage] = useState(0) // 0-indexed
  const membersQuery = useMembers({
    branchId: selectedBranch, search: memberSearch, status: memberStatusFilter,
    sort: memberSort, page: memberPage, size: PAGE_SIZE,
  })
  const members = membersQuery.data?.content ?? NO_MEMBERS
  const memberTotalPages = membersQuery.data?.totalPages ?? 1
  const memberTotalElements = membersQuery.data?.totalElements ?? 0
  const membersLoading = membersQuery.isLoading

  const [detailMemberId, setDetailMemberId] = useState<string | null>(null)
  const [modalTab, setModalTab] = useState<'INFO' | 'MEMBERSHIPS' | 'PAYMENTS' | 'STORE' | 'ATTENDANCE' | 'BRANCHES'>('INFO')
  const [modalShowExpired, setModalShowExpired] = useState(false)
  const [modalPage, setModalPage] = useState(1)

  // Change Role + its history - Owner-only, so a Member can be promoted to Trainer/Manager.
  const [selectedNewRole, setSelectedNewRole] = useState('')
  const [changingRole, setChangingRole] = useState(false)
  const [promotionTarget, setPromotionTarget] = useState<RoleChangeOtpTarget | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')

  const [editingMemberInfo, setEditingMemberInfo] = useState(false)
  const [memberEditName, setMemberEditName] = useState('')
  const [memberEditPhone, setMemberEditPhone] = useState('')
  const [memberEditAddress, setMemberEditAddress] = useState('')
  const [memberEditPhoto, setMemberEditPhoto] = useState<string | null>(null)
  const [memberEditGender, setMemberEditGender] = useState<Gender | ''>('')
  const [memberEditDob, setMemberEditDob] = useState('')
  const [memberEditIdProof, setMemberEditIdProof] = useState<string | null>(null)

  const [editingMemberBranches, setEditingMemberBranches] = useState(false)
  const [memberBranchEditIds, setMemberBranchEditIds] = useState<string[]>([])

  const [detailPaymentsPage, setDetailPaymentsPage] = useState(0)
  const [detailAttendancePage, setDetailAttendancePage] = useState(0)

  const { confirm, dialogProps } = useConfirm()
  const [savingMemberInfo, setSavingMemberInfo] = useState(false)
  const [savingMemberBranches, setSavingMemberBranches] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  const [payTarget, setPayTarget] = useState<MembershipAdmin | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMode, setPayMode] = useState('CASH')
  const [paying, setPaying] = useState(false)

  const paymentsQ = usePersonPayments(detailMemberId ?? undefined, detailPaymentsPage, MODAL_PAGE_SIZE, modalTab === 'PAYMENTS')
  const detailPayments = paymentsQ.data?.content ?? []
  const detailPaymentsTotalPages = paymentsQ.data?.totalPages ?? 1
  const detailPaymentsTotalElements = paymentsQ.data?.totalElements ?? 0

  const attendanceQ = usePersonAttendance(detailMemberId ?? undefined, detailAttendancePage, MODAL_PAGE_SIZE, modalTab === 'ATTENDANCE')
  const detailAttendance = attendanceQ.data?.content ?? []
  const detailAttendanceTotalPages = attendanceQ.data?.totalPages ?? 1
  const detailAttendanceTotalElements = attendanceQ.data?.totalElements ?? 0

  const membershipsQ = usePersonMemberships(detailMemberId ?? undefined, modalTab === 'MEMBERSHIPS')
  const detailMembershipsFetched = membershipsQ.data ?? NO_MEMBERSHIPS

  const { data: detailMemberBranches = NO_BRANCHES } =
    useMyBranches(modalTab === 'BRANCHES' ? detailMemberId ?? undefined : undefined)

  const { data: roleHistory = [] } = useRoleHistory(detailMemberId ?? undefined, user?.role === 'OWNER')

  const detailFetching = paymentsQ.isFetching || attendanceQ.isFetching || membershipsQ.isFetching
  function refreshDetail() {
    [qk.payments, qk.attendance, qk.members, qk.productOrders]
      .forEach((k) => queryClient.invalidateQueries({ queryKey: k }))
  }

  // One place that opens the modal, so tab and page state reset in the same render
  // (otherwise the previously open tab would fire a request for the new person first).
  function openDetail(id: string) {
    setDetailMemberId(id); setModalShowExpired(false)
    setModalTab('INFO'); setDetailPaymentsPage(0); setDetailAttendancePage(0)
  }

  // Mutations call this. It refreshes the lists and optionally jumps to a page.
  function loadMembers(page?: number) {
    if (page !== undefined && page !== memberPage) setMemberPage(page)
    invalidatePeople()
  }

  useEffect(() => {
    setMemberSearchInput(''); setMemberSearch('')
    setMemberStatusFilter('ALL'); setMemberSort('NAME'); setMemberPage(0)
  }, [selectedBranch])

  useEffect(() => {
    const handle = setTimeout(() => { setMemberSearch(memberSearchInput); setMemberPage(0) }, 300)
    return () => clearTimeout(handle)
  }, [memberSearchInput])

  function handleStatusFilterChange(value: typeof memberStatusFilter) {
    setMemberStatusFilter(value); setMemberPage(0)
  }
  function handleSortChange(value: typeof memberSort) {
    setMemberSort(value); setMemberPage(0)
  }

  useEffect(() => {
    setModalPage(1)
  }, [detailMemberId, modalShowExpired])

  useEffect(() => {
    if (!detailMemberId) return
    setEditingMemberInfo(false)
    setEditingMemberBranches(false)
    setSelectedNewRole('')
  }, [detailMemberId])

  // Refreshes the table, the open modal's membership list, and payments - all share these key prefixes.
  function refreshMembershipViews() {
    invalidateMembershipData()
  }

  function openPayDialog(m: MembershipAdmin) {
    setPayTarget(m); setPayAmount(String(m.balanceDue)); setPayMode('CASH')
  }

  async function submitPayment() {
    if (!payTarget || !selectedBranch) return
    if (!payAmount || Number.isNaN(Number(payAmount)) || Number(payAmount) <= 0) {
      toast.warning('Enter a valid amount.'); return
    }
    setPaying(true)
    try {
      await api.post(`/api/memberships/${payTarget.id}/record-payment`, {
        amount: Number(payAmount), mode: payMode, branchId: selectedBranch,
      })
      toast.success('Payment recorded.');
      setPayTarget(null)
      refreshMembershipViews()
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to record payment'))
    } finally {
      setPaying(false)
    }
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

  async function handlePaymentSendAction(paymentId: string, channel: 'email' | 'whatsapp') {
    try {
      const { data } = await api.post<{ message: string }>(`/api/payments/${paymentId}/send-${channel}`)
      toast.success(data.message)
    } catch (err: any) {
      toast.error(getErrorMessage(err, `Failed to send via ${channel}`))
    }
  }

  function startEdit(m: MembershipAdmin) {
    setEditingId(m.id)
    setEditStartDate(m.startDate)
    setEditEndDate(m.endDate)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(id: string) {
    if (editEndDate < editStartDate) {
      toast.warning('End date cannot be before start date.')
      return
    }
    setSavingEdit(true)
    try {
      await api.put(`/api/memberships/${id}`, { startDate: editStartDate, endDate: editEndDate })
      toast.success('Membership dates updated.')
      setEditingId(null)
      refreshMembershipViews()
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to update'))
    } finally {
      setSavingEdit(false)
    }
  }

  function cancelMembership(id: string) {
    confirm({
      title: 'Cancel membership',
      message: 'Cancel this membership? The member will lose gym access immediately.',
      confirmLabel: 'Cancel membership',
      danger: true,
      onConfirm: async () => {
        await api.post(`/api/memberships/${id}/cancel`)
        toast.success('Membership cancelled.')
        refreshMembershipViews()
      },
    })
  }

  async function pauseMembership(id: string) {
    try {
      await api.post(`/api/memberships/${id}/pause`)
      toast.success('Membership paused.')
      refreshMembershipViews()
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to pause'))
    }
  }

  async function resumeMembership(id: string) {
    try {
      await api.post(`/api/memberships/${id}/resume`)
      toast.success('Membership resumed.')
      refreshMembershipViews()
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to resume'))
    }
  }

  function startEditMemberInfo(m: MemberSummary) {
    setEditingMemberInfo(true)
    setMemberEditName(m.name)
    setMemberEditPhone(m.phone ?? '')
    setMemberEditAddress(m.address ?? '')
    setMemberEditPhoto(m.photo)
    setMemberEditGender(m.gender ?? '')
    setMemberEditDob(m.dateOfBirth ?? '')
    setMemberEditIdProof(null)
  }

  async function saveMemberInfo(memberId: string) {
    setSavingMemberInfo(true)
    try {
      await api.put(`/api/members/${memberId}`, {
        name: memberEditName, phone: memberEditPhone, address: memberEditAddress, photo: memberEditPhoto ?? '',
        gender: memberEditGender || undefined,
        dateOfBirth: memberEditDob || undefined,
        idProof: memberEditIdProof ?? undefined,
      })
      toast.success('Member details updated.')
      setEditingMemberInfo(false)
      loadMembers()
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to update member info'))
    } finally {
      setSavingMemberInfo(false)
    }
  }

  function deleteMember(memberId: string, name: string) {
    confirm({
      title: 'Delete member account',
      message: `Permanently delete ${name}'s account? This removes their membership history, payment records, and attendance log, and cannot be undone.`,
      confirmLabel: 'Delete account',
      danger: true,
      onConfirm: async () => {
        await api.delete(`/api/owner/users/${memberId}`)
        toast.success('Account deleted.')
        setDetailMemberId(null)
        loadMembers(0)
      },
    })
  }

  // Owner-only. Promoting a Member to Trainer/Manager moves them out of the Members
  // list entirely, so the modal closes and the branch-scoped lists refresh.
  function changeMemberRole(member: MemberSummary) {
    if (!selectedNewRole) { 
      toast.warning('Select a role to change to.'); 
      return 
    }

    if (selectedNewRole === 'OWNER') {
      setPromotionTarget({ id: member.id, name: member.name, newRole: 'OWNER' })
      return
    }

    confirm({
      title: 'Change role',
      message: `Change ${member.name}'s role from Member to ${selectedNewRole === 'TRAINER' ? 'Trainer' : 'Manager'}? ` +
      `This takes effect immediately for new logins, but anyone already signed in keeps ` +
      `their current access until their session expires or they log in again.`,
      confirmLabel: 'Change role',
      onConfirm: async () => {
        setChangingRole(true)
        try {
          await api.put(`/api/owner/users/${member.id}/role`, { newRole: selectedNewRole })
          toast.success('Role changed.')
          setDetailMemberId(null)
          loadMembers(0)
        } finally {
          setChangingRole(false)
        }
      },
    })
  }

  async function saveMemberBranches(memberId: string) {
    if (memberBranchEditIds.length === 0) {
      toast.warning('Select at least one branch.')
      return
    }
    setSavingMemberBranches(true)
    try {
      await api.put(`/api/branches/assignments/${memberId}`, { branchIds: memberBranchEditIds })
      toast.success('Branches updated.')
      setEditingMemberBranches(false)
      queryClient.invalidateQueries({ queryKey: qk.branches })
      loadMembers()
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to update branch assignments'))
    } finally {
      setSavingMemberBranches(false)
    }
  }

  const memberRows = members.map((member) => ({ member, status: member.membershipStatus }))

  const detailMember = members.find((m) => m.id === detailMemberId) ?? null
  const detailMemberships = detailMembershipsFetched
    .filter((ms) => {
      const effective = getEffectiveStatus(ms)
      return modalShowExpired || (effective !== 'EXPIRED' && effective !== 'CANCELLED')
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
  const modalTotalPages = Math.max(1, Math.ceil(detailMemberships.length / MODAL_PAGE_SIZE))
  const pagedDetailMemberships = detailMemberships.slice((modalPage - 1) * MODAL_PAGE_SIZE, modalPage * MODAL_PAGE_SIZE)

  useScrollLock(!!detailMember || !!payTarget)

  return (
    <div>
      <div className="rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">Members</h2>
            <p className="mt-1 text-xs text-gray-500">Click a member to view all their plans and take action.</p>
          </div>
          <RefreshButton onClick={() => membersQuery.refetch()} spinning={membersQuery.isFetching} />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <input placeholder="Search name or email..." value={memberSearchInput} onChange={(e) => setMemberSearchInput(e.target.value)}
            className="flex-1 min-w-[180px] rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <select value={memberStatusFilter} onChange={(e) => handleStatusFilterChange(e.target.value as any)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="PAUSED">Paused</option>
            <option value="NONE">No plan</option>
          </select>
          <select value={memberSort} onChange={(e) => handleSortChange(e.target.value as any)}
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
              {membersLoading ? (
                <TableSkeleton rows={6} columns={6} />
              ) : (
                memberRows.map(({ member, status }) => (
                  <tr key={member.id}>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <Avatar src={member.photo} name={member.name} className="h-6 w-6" textClassName="text-[10px]" />
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
                      <button onClick={() => openDetail(member.id)} className="text-xs text-brand hover:underline">
                        View/Edit details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!membersLoading && members.length === 0 && <p className="py-4 text-sm text-gray-400">No members match.</p>}
        {memberTotalElements > 0 && (
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>Page {memberPage + 1} of {memberTotalPages} ({memberTotalElements} total)</span>
            <div className="space-x-2">
              <button disabled={memberPage === 0} onClick={() => setMemberPage((p) => p - 1)}
                className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
              <button disabled={memberPage + 1 >= memberTotalPages} onClick={() => setMemberPage((p) => p + 1)}
                className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {detailMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl lg:max-w-4xl">

            {/* Fixed part: photo, name, email, PIN, close button and tabs */}
            <div className="flex-shrink-0 px-6 pt-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar src={detailMember.photo} name={detailMember.name} className="h-12 w-12" textClassName="text-lg" />
                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-medium">{detailMember.name}</h3>
                    <p className="break-words text-xs text-gray-500">{detailMember.email} · PIN {detailMember.checkinPin ?? '—'}</p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <RefreshButton onClick={refreshDetail} spinning={detailFetching} />
                  <button onClick={() => { setDetailMemberId(null); cancelEdit() }}
                    className="text-gray-400 hover:text-gray-600" aria-label="Close">✕</button>
                </div>  
              </div>

              <div className="mt-4 overflow-x-auto overflow-y-hidden scrollbar-hide border-b border-gray-200">
                <div className="flex min-w-max gap-1">
                  {(['INFO', 'MEMBERSHIPS', 'PAYMENTS', 'STORE', 'ATTENDANCE', 'BRANCHES'] as const).map((tab) => (
                    <button key={tab} onClick={() => setModalTab(tab)}
                      className={`-mb-px flex-shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
                        modalTab === tab ? 'border-brand text-brand font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}>
                      {tab === 'INFO' ? 'Info' : tab === 'MEMBERSHIPS' ? 'Membership plans' : tab === 'PAYMENTS' ? 'Payment history'
                        : tab === 'STORE' ? 'Product purchases' : tab === 'ATTENDANCE' ? 'Attendance' : 'Branches'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Scrollable part: everything that depends on the selected tab */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
              {modalTab === 'INFO' && (
                <div className="mt-4 space-y-2 text-sm">
                  {editingMemberInfo ? (
                    <div className="space-y-3 rounded-md border border-gray-200 p-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={memberEditPhoto} name={memberEditName} className="h-14 w-14" textClassName="text-lg" />
                        <div className="flex flex-col items-start gap-1.5">
                          <PhotoUploadButton onLoaded={setMemberEditPhoto} label="Change photo" size="sm" />
                          {memberEditPhoto && (
                            <button type="button" onClick={() => setMemberEditPhoto(null)}
                              className="text-xs text-red-600 hover:underline">Remove photo</button>
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
                      <PersonalDetailsFields compact gender={memberEditGender} dateOfBirth={memberEditDob}
                        onGenderChange={setMemberEditGender} onDateOfBirthChange={setMemberEditDob} />
                      <IdProofField compact personId={detailMember.id} uploaded={detailMember.idProofUploaded}
                        pendingKey={memberEditIdProof} canChange onUploaded={setMemberEditIdProof} onError={toast.error} />
                      <div className="space-x-2">
                        <EditActions size="sm" onSave={() => saveMemberInfo(detailMember.id)} onCancel={() => setEditingMemberInfo(false)} saving={savingMemberInfo} />
                      </div>

                    </div>
                  ) : (
                    <>
                      <p><span className="text-gray-500">Name:</span> {detailMember.name}</p>
                      <p><span className="text-gray-500">Email:</span> {detailMember.email}</p>
                      <p><span className="text-gray-500">Phone:</span> {detailMember.phone ?? '—'}</p>
                      <p><span className="text-gray-500">Address:</span> {detailMember.address ?? '—'}</p>
                      <p><span className="text-gray-500">Gender:</span> {genderLabel(detailMember.gender)}</p>
                      <p><span className="text-gray-500">Date of birth:</span> {formatDobWithAge(detailMember.dateOfBirth)}</p>
                      <IdProofField compact personId={detailMember.id} uploaded={detailMember.idProofUploaded}
                        pendingKey={null} canChange={false} onUploaded={() => {}} onError={toast.error} />
                      <p><span className="text-gray-500">Check-in PIN:</span> {detailMember.checkinPin ?? '—'}</p>
                      <p><span className="text-gray-500">Enrollment date:</span> {detailMember.enrollmentDate ?? 'Not enrolled yet'}</p>
                      <p><span className="text-gray-500">Last visit:</span> {
                        lastCheckins[detailMember.id] ? new Date(lastCheckins[detailMember.id]).toLocaleString() : 'Never'
                      }</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <ActionButton icon={<PencilIcon />} onClick={() => startEditMemberInfo(detailMember)}>Edit info</ActionButton>
                        {user?.role === 'OWNER' && (
                          <ActionButton variant="danger" icon={<TrashIcon />} onClick={() => deleteMember(detailMember.id, detailMember.name)}>
                            Delete account
                          </ActionButton>
                        )}
                      </div>
                      {user?.role === 'OWNER' && (
                        <>
                          <hr />
                          <div className="rounded-md border border-gray-200 p-3">
                            <p className="text-xs font-medium text-gray-700">Change role</p>
                            <p className="mt-1 text-xs text-gray-500">
                              Promotes this Member to staff or Owner. Today becomes their joining date as
                              Trainer/Manager; their membership history stays intact either way.
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <select value={selectedNewRole} onChange={(e) => setSelectedNewRole(e.target.value)}
                                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                                <option value="">Select new role...</option>
                                <option value="TRAINER">Trainer</option>
                                <option value="MANAGER">Manager</option>
                                <option value="OWNER">Owner</option>
                              </select>
                              <button onClick={() => changeMemberRole(detailMember)} disabled={!selectedNewRole || changingRole}
                                className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60">
                                {changingRole ? 'Changing...' : 'Change role'}
                              </button>
                            </div>
                          </div>

                          {roleHistory.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-gray-700">Past roles</p>
                              <ul className="mt-1 space-y-1 text-xs text-gray-500">
                                {roleHistory.map((h, i) => (
                                  <li key={i}>
                                    {h.previousRole} → {h.newRole} by {h.changedByName} on{' '}
                                    {new Date(h.changedAt).toLocaleDateString()}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}  
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
                    <table className="w-full min-w-[720px] table-fixed text-left text-sm">
                      <colgroup>
                        <col className="w-[16%]" />
                        <col className="w-[15%]" />
                        <col className="w-[15%]" />
                        <col className="w-[15%]" />
                        <col className="w-[39%]" />
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
                                  <td className="py-2">
                                    <EditActions size="sm" onSave={() => saveEdit(m.id)} onCancel={cancelEdit} saving={savingEdit} />
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="truncate py-2 pr-4 text-gray-500">{m.startDate}</td>
                                  <td className="truncate py-2 pr-4 text-gray-500">{m.endDate}</td>
                                  <td className="py-2 pr-4 align-top">
                                    <span className={statusColorClass(effective)}>{statusLabel(effective)}</span>
                                    {m.paymentStatus === 'PARTIAL' && (
                                      <span className="mt-1 block w-fit rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                        Partially paid - ₹{m.balanceDue} due{m.balanceDueDate ? ` by ${m.balanceDueDate}` : ''}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 align-top">
                                    <div className="flex flex-wrap gap-1.5">
                                      {effective === 'ACTIVE' && (
                                        <ActionButton variant="warning" icon={<PauseIcon />} onClick={() => pauseMembership(m.id)}>Pause</ActionButton>
                                      )}
                                      {effective === 'PAUSED' && (
                                        <ActionButton variant="success" icon={<PlayIcon />} onClick={() => resumeMembership(m.id)}>Resume</ActionButton>
                                      )}
                                      {(effective === 'ACTIVE' || effective === 'PAUSED' || effective === 'SCHEDULED') && (
                                        <ActionButton variant="danger" icon={<BanIcon />} onClick={() => cancelMembership(m.id)}>Cancel</ActionButton>
                                      )}
                                      <ActionButton icon={<CalendarIcon />} onClick={() => startEdit(m)}>Edit dates</ActionButton>
                                      {m.paymentStatus === 'PARTIAL' && (
                                        <ActionButton variant="success" icon={<CoinIcon />} onClick={() => openPayDialog(m)}>Record payment</ActionButton>
                                      )}
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {!membershipsQ.isLoading && detailMemberships.length === 0 && <p className="py-4 text-sm text-gray-400">No memberships to show.</p>}
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
                </>
              )}

              {modalTab === 'PAYMENTS' && (
                <div className="mt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-gray-500">
                          <th className="pb-2 pr-4">Date</th>
                          <th className="pb-2 pr-4">Plan</th>
                          <th className="pb-2 pr-4">Amount</th>
                          <th className="pb-2 pr-4">Mode</th>
                          <th className="pb-2 pr-4">Recorded by</th>
                          <th className="pb-2">Invoice</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detailPayments.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2 pr-4 text-gray-500">{new Date(p.createdAt).toLocaleString()}</td>
                            <td className="py-2 pr-4">{p.planName ?? '—'}</td>
                            <td className="py-2 pr-4">₹{p.amount}</td>
                            <td className="py-2 pr-4">{p.mode}</td>
                            <td className="py-2 pr-4">{p.recordedByName}</td>
                            <td className="py-2">
                              <RowActionsMenu actions={[
                                { label: 'View', icon: <EyeIcon />, onClick: () => handleInvoiceAction(p.id, 'view') },
                                { label: 'Print', icon: <PrinterIcon />, onClick: () => handleInvoiceAction(p.id, 'print') },
                                { label: 'Download', icon: <DownloadIcon />, onClick: () => handleInvoiceAction(p.id, 'download') },
                                { label: 'Send Email', icon: <MailIcon />, onClick: () => handlePaymentSendAction(p.id, 'email')},
                                { label: 'Send WhatsApp', icon: <WhatsAppIcon />, onClick: () => handlePaymentSendAction(p.id, 'whatsapp') },
                              ]} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!paymentsQ.isLoading && detailPayments.length === 0 && <p className="py-4 text-sm text-gray-400">No payments recorded yet.</p>}
                  {detailPaymentsTotalElements > 0 && (
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                      <span>Page {detailPaymentsPage + 1} of {detailPaymentsTotalPages} ({detailPaymentsTotalElements} total)</span>
                      <div className="space-x-2">
                        <button disabled={detailPaymentsPage === 0} onClick={() => setDetailPaymentsPage((p) => p - 1)}
                          className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
                        <button disabled={detailPaymentsPage + 1 >= detailPaymentsTotalPages} onClick={() => setDetailPaymentsPage((p) => p + 1)}
                          className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {modalTab === 'STORE' && detailMember && (
                <ProductPurchaseHistoryTab personId={detailMember.id} />
              )}

              {modalTab === 'ATTENDANCE' && (
                <div className="mt-4">
                  <div className="overflow-x-auto">
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
                        {detailAttendance.map((a) => (
                          <tr key={a.id}>
                            <td className="py-2 pr-4 text-gray-500">{new Date(a.checkInTime).toLocaleString()}</td>
                            <td className="py-2 pr-4 text-gray-500">{a.checkOutTime ? new Date(a.checkOutTime).toLocaleString() : '—'}</td>
                            <td className="py-2 pr-4">{a.method}</td>
                            <td className="py-2 text-gray-500">{a.branchName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!attendanceQ.isLoading && detailAttendance.length === 0 && <p className="py-4 text-sm text-gray-400">No visits logged yet.</p>}
                  {detailAttendanceTotalElements > 0 && (
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                      <span>Page {detailAttendancePage + 1} of {detailAttendanceTotalPages} ({detailAttendanceTotalElements} total)</span>
                      <div className="space-x-2">
                        <button disabled={detailAttendancePage === 0} onClick={() => setDetailAttendancePage((p) => p - 1)}
                          className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
                        <button disabled={detailAttendancePage + 1 >= detailAttendanceTotalPages} onClick={() => setDetailAttendancePage((p) => p + 1)}
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
                        <EditActions size="sm" onSave={() => saveMemberBranches(detailMember.id)} onCancel={() => setEditingMemberBranches(false)} saving={savingMemberBranches} />
                      </div>

                    </div>
                  ) : (
                    <>
                      <ul className="space-y-1">
                        {detailMemberBranches.map((b) => <li key={b.id}>{b.name}</li>)}
                        {detailMemberBranches.length === 0 && <li className="text-gray-400">No branches assigned.</li>}
                      </ul>
                      {user?.role === 'OWNER' && (
                        <ActionButton className="mt-3" icon={<MapPinIcon />}
                          onClick={() => { setEditingMemberBranches(true); setMemberBranchEditIds(detailMemberBranches.map((b) => b.id)) }}>
                          Edit branches
                        </ActionButton>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
      <RoleChangeOtpDialog
        target={promotionTarget}
        onClose={() => setPromotionTarget(null)}
        onDone={() => {
          setPromotionTarget(null)
          setDetailMemberId(null)
          loadMembers(0)
        }}
      />
      {payTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">Record payment</h3>
            <p className="mt-1 text-sm text-gray-600">Balance due: ₹{payTarget.balanceDue}</p>
            <div className="mt-3 space-y-3">
              <input type="number" min={0} step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <select value={payMode} onChange={(e) => setPayMode(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                {['CASH', 'UPI', 'CARD', 'CHEQUE', 'BANK_TRANSFER'].map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button disabled={paying} onClick={() => setPayTarget(null)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button disabled={paying} onClick={submitPayment}
                className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-70">
                {paying ? 'Recording...' : 'Record payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}