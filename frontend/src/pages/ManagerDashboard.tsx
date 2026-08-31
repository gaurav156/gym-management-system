import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import AttendanceTab from '../components/manager/AttendanceTab'
import PaymentsTab from '../components/manager/PaymentsTab'
import MembersTab from '../components/manager/MembersTab'
import TrainersTab from '../components/manager/TrainersTab'
import type { Branch, LastCheckinEntry } from '../types'

type Tab = 'ATTENDANCE' | 'PAYMENTS' | 'MEMBERS' | 'TRAINERS'

export default function ManagerDashboard() {
  const user = useAuthStore((s) => s.user)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [branchLoadError, setBranchLoadError] = useState('')
  const [allBranches, setAllBranches] = useState<Branch[]>([])
  const [lastCheckins, setLastCheckins] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<Tab>('ATTENDANCE')

  useEffect(() => {
    if (!user) return
    // Owner has implicit access to every branch (no branch_assignments row of their own);
    // a Manager only sees branches they're actually assigned to.
    const request = user.role === 'OWNER'
      ? api.get<Branch[]>('/api/branches')
      : api.get<Branch[]>('/api/branches/mine', { params: { userId: user.userId } })

    request
      .then((res) => {
        setBranches(res.data)
        if (res.data.length > 0) setSelectedBranch(res.data[0].id)
      })
      .catch((err) => {
        setBranchLoadError(err.response?.data?.error || 'Failed to load branches - check the backend logs.')
      })
  }, [user])

  // Owner needs the full branch list to offer as checkboxes when editing someone's
  // assignments - a Manager only ever has their own assigned branches in `branches`.
  useEffect(() => {
    if (user?.role === 'OWNER') {
      setAllBranches(branches)
    } else {
      api.get<Branch[]>('/api/branches').then((res) => setAllBranches(res.data)).catch(() => {})
    }
  }, [user, branches])

  function loadLastCheckins() {
    if (!selectedBranch) return
    api.get<LastCheckinEntry[]>(`/api/attendance/last-checkin/${selectedBranch}`).then((res) => {
      const map: Record<string, string> = {}
      res.data.forEach((e) => { map[e.personId] = e.lastCheckIn })
      setLastCheckins(map)
    })
  }

  useEffect(() => {
    loadLastCheckins()
  }, [selectedBranch])

  const TABS: { key: Tab; label: string }[] = [
    { key: 'ATTENDANCE', label: 'Attendance' },
    { key: 'PAYMENTS', label: 'Payments' },
    { key: 'MEMBERS', label: 'Members' },
    { key: 'TRAINERS', label: 'Trainers' },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">
        {user?.role === 'OWNER' ? 'Branch operations (Owner view)' : 'Manager dashboard'}
      </h1>
      {branchLoadError && <p className="mt-2 text-sm text-red-600">{branchLoadError}</p>}

      {branches.length > 1 && (
        <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}
          className="mt-4 rounded-md border border-gray-300 px-3 py-2 text-sm">
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}

      <div className="mt-6 overflow-x-auto border-b border-gray-200">
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

      <div className="mt-6">
        {activeTab === 'ATTENDANCE' && (
          <AttendanceTab selectedBranch={selectedBranch} onCheckinSuccess={loadLastCheckins} />
        )}
        {activeTab === 'PAYMENTS' && (
          <PaymentsTab selectedBranch={selectedBranch} />
        )}
        {activeTab === 'MEMBERS' && (
          <MembersTab selectedBranch={selectedBranch} allBranches={allBranches} lastCheckins={lastCheckins} />
        )}
        {activeTab === 'TRAINERS' && (
          <TrainersTab selectedBranch={selectedBranch} allBranches={allBranches} lastCheckins={lastCheckins} user={user} />
        )}
      </div>
    </div>
  )
}