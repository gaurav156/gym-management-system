import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import AttendanceTab from '../components/manager/AttendanceTab'
import PaymentsTab from '../components/manager/PaymentsTab'
import ExpensesTab from '../components/manager/ExpensesTab'
import MembersTab from '../components/manager/MembersTab'
import StaffTab from '../components/manager/StaffTab'
import StoreTab from '../components/manager/StoreTab'
import { usePersistedTab, TAB_STORAGE_PREFIX } from '../hooks/usePersistedTab'
import { useAccessibleBranches, useLastCheckins } from '../api/queries'

type Tab = 'ATTENDANCE' | 'PAYMENTS' | 'STORE' | 'EXPENSES' | 'MEMBERS' | 'STAFF'
const TAB_KEYS: Tab[] = ['ATTENDANCE', 'PAYMENTS', 'STORE', 'EXPENSES', 'MEMBERS', 'STAFF']
const BRANCH_STORAGE_KEY = TAB_STORAGE_PREFIX + 'manager-branch'

function readSavedBranch(): string | null {
  try { return sessionStorage.getItem(BRANCH_STORAGE_KEY) } catch { return null }
}

export default function ManagerDashboard() {
  const user = useAuthStore((s) => s.user)
  const { branches } = useAccessibleBranches(user?.role, user?.userId)
  const [selectedBranch, setSelectedBranch] = useState('')
  const allBranches = user?.role === 'OWNER' ? branches : []
  const { data: lastCheckinList } = useLastCheckins(selectedBranch)
  const lastCheckins = useMemo(() => {
    const map: Record<string, string> = {}
    lastCheckinList?.forEach((e) => { map[e.personId] = e.lastCheckIn })
    return map
  }, [lastCheckinList])
  const [activeTab, setActiveTab] = usePersistedTab<Tab>('manager', TAB_KEYS, 'ATTENDANCE')

  function selectBranch(id: string) {
    setSelectedBranch(id)
    try { sessionStorage.setItem(BRANCH_STORAGE_KEY, id) } catch { /* ignore */ }
  }

  useEffect(() => {
    if (selectedBranch || branches.length === 0) return
    const saved = readSavedBranch()
    const restored = branches.find((b) => b.id === saved)
    setSelectedBranch((restored ?? branches.find((b) => b.active) ?? branches[0]).id)
  }, [branches, selectedBranch])

  const TABS: { key: Tab; label: string }[] = [
    { key: 'ATTENDANCE', label: 'Attendance' },
    { key: 'PAYMENTS', label: 'Payments' },
    { key: 'STORE', label: 'Store' },
    { key: 'EXPENSES', label: 'Expenses' },
    { key: 'MEMBERS', label: 'Members' },
    { key: 'STAFF', label: 'Staff' },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">
        {user?.role === 'OWNER' ? 'Branch operations (Owner view)' : 'Manager dashboard'}
      </h1>

      {branches.length > 1 && (
        <select value={selectedBranch} onChange={(e) => selectBranch(e.target.value)}
          className="mt-4 rounded-md border border-gray-300 px-3 py-2 text-sm">
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}{b.active ? '' : ' (inactive)'}</option>)}
        </select>
      )}

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

      <div className="mt-6">
        {activeTab === 'ATTENDANCE' && (
          <AttendanceTab selectedBranch={selectedBranch} />
        )}
        {activeTab === 'PAYMENTS' && (
          <PaymentsTab selectedBranch={selectedBranch} />
        )}
        {activeTab === 'MEMBERS' && (
          <MembersTab selectedBranch={selectedBranch} allBranches={allBranches} lastCheckins={lastCheckins} user={user} />
        )}
        {activeTab === 'EXPENSES' && (
          <ExpensesTab selectedBranch={selectedBranch} user={user} />
        )}        
        {activeTab === 'STAFF' && (
          <StaffTab selectedBranch={selectedBranch} allBranches={allBranches} lastCheckins={lastCheckins} user={user} />
        )}
        {activeTab === 'STORE' && (
          <StoreTab selectedBranch={selectedBranch} />
        )}
      </div>
    </div>
  )
}