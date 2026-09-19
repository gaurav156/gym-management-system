import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import Spinner from '../components/Spinner'
import { CardSkeleton } from '../components/Skeleton'
import type { Branch, Plan } from '../types'

type AccountRole = 'MEMBER' | 'TRAINER' | 'MANAGER'

const ACCOUNT_ROLES: { value: AccountRole; label: string }[] = [
  { value: 'MEMBER', label: 'Member' },
  { value: 'TRAINER', label: 'Trainer' },
  { value: 'MANAGER', label: 'Manager' },
]

function BranchCheckboxes({ branches, selected, onChange }: {
  branches: Branch[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }
  return (
    <div className="rounded-md border border-gray-300 p-2 text-sm">
      <p className="mb-1 text-xs text-gray-500">Assign to branch(es)</p>
      {branches.map((b) => (
        <label key={b.id} className="flex items-center gap-2 py-1">
          <input type="checkbox" checked={selected.includes(b.id)} onChange={() => toggle(b.id)} />
          {b.name}
        </label>
      ))}
      {branches.length === 0 && <p className="text-xs text-gray-400">Add a branch first.</p>}
    </div>
  )
}

export default function OwnerDashboard() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchesLoading, setBranchesLoading] = useState(true)
  const [creatingBranch, setCreatingBranch] = useState(false)
  const [branchName, setBranchName] = useState('')
  const [branchAddress, setBranchAddress] = useState('')
  const [branchPhone, setBranchPhone] = useState('')

  const [editingBranchId, setEditingBranchId] = useState<string | null>(null)
  const [editBranchName, setEditBranchName] = useState('')
  const [editBranchAddress, setEditBranchAddress] = useState('')
  const [editBranchPhone, setEditBranchPhone] = useState('')
  const [branchEditMessage, setBranchEditMessage] = useState('')
  const [savingBranchEdit, setSavingBranchEdit] = useState(false)

  const [accountRole, setAccountRole] = useState<AccountRole>('MEMBER')
  const [accountName, setAccountName] = useState('')
  const [accountEmail, setAccountEmail] = useState('')
  const [accountPhone, setAccountPhone] = useState('')
  const [accountPassword, setAccountPassword] = useState('')
  const [accountBranchIds, setAccountBranchIds] = useState<string[]>([])
  const [accountMessage, setAccountMessage] = useState('')
  const [creatingAccount, setCreatingAccount] = useState(false)

  const [plans, setPlans] = useState<Plan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [planName, setPlanName] = useState('')
  const [planMonths, setPlanMonths] = useState(1)
  const [planPrice, setPlanPrice] = useState('')
  const [planError, setPlanError] = useState('')
  const [creatingPlan, setCreatingPlan] = useState(false)

  function loadBranches() {
    setBranchesLoading(true)
    api.get<Branch[]>('/api/branches').then((res) => setBranches(res.data)).finally(() => setBranchesLoading(false))
  }

  useEffect(() => { loadBranches() }, [])

  async function createBranch(e: FormEvent) {
    e.preventDefault()
    setCreatingBranch(true)
    try {
      await api.post('/api/branches', { name: branchName, address: branchAddress, phone: branchPhone || null })
      setBranchName(''); setBranchAddress(''); setBranchPhone('')
      loadBranches()
    } finally {
      setCreatingBranch(false)
    }
  }

  function startEditBranch(b: Branch) {
    setEditingBranchId(b.id)
    setEditBranchName(b.name)
    setEditBranchAddress(b.address)
    setEditBranchPhone(b.phone ?? '')
    setBranchEditMessage('')
  }

  function cancelEditBranch() {
    setEditingBranchId(null)
  }

  async function saveEditBranch(id: string) {
    setBranchEditMessage('')
    setSavingBranchEdit(true)
    try {
      await api.put(`/api/branches/${id}`, {
        name: editBranchName,
        address: editBranchAddress,
        phone: editBranchPhone || null,
      })
      setEditingBranchId(null)
      loadBranches()
    } catch (err: any) {
      setBranchEditMessage(err.response?.data?.error || 'Failed to update branch')
    } finally {
      setSavingBranchEdit(false)
    }
  }

  async function createAccount(e: FormEvent) {
    e.preventDefault()
    setAccountMessage('')
    if (accountBranchIds.length === 0) {
      setAccountMessage('Select at least one branch.')
      return
    }
    setCreatingAccount(true)
    try {
      const { data } = await api.post<{ checkinPin: string }>('/api/auth/owner/create-account', {
        role: accountRole,
        name: accountName,
        email: accountEmail,
        phone: accountPhone || null,
        password: accountPassword,
        branchIds: accountBranchIds,
      })
      const label = ACCOUNT_ROLES.find((r) => r.value === accountRole)?.label ?? accountRole
      setAccountMessage(`${label} account created for ${accountName} - check-in PIN ${data.checkinPin}`)
      setAccountName(''); setAccountEmail(''); setAccountPhone(''); setAccountPassword(''); setAccountBranchIds([])
    } catch (err: any) {
      setAccountMessage(err.response?.data?.error || 'Failed to create account')
    } finally {
      setCreatingAccount(false)
    }
  }

  function loadPlans() {
    setPlansLoading(true)
    api.get<Plan[]>('/api/plans').then((res) => setPlans(res.data)).finally(() => setPlansLoading(false))
  }

  useEffect(() => { loadPlans() }, [])

  async function createPlan(e: FormEvent) {
    e.preventDefault()
    setPlanError('')
    if (!planPrice || Number.isNaN(Number(planPrice))) {
      setPlanError('Enter a valid price.')
      return
    }
    setCreatingPlan(true)
    try {
      await api.post('/api/plans/manage', {
        name: planName, durationMonths: planMonths, price: Number(planPrice),
      })
      setPlanName(''); setPlanPrice('')
      loadPlans()
    } catch (err: any) {
      setPlanError(err.response?.data?.error || 'Failed to create plan')
    } finally {
      setCreatingPlan(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Owner dashboard</h1>
      <p className="mt-1 text-sm text-gray-600">Manage branches, accounts, and plans across your gym chain.</p>
      <Link to="/manager" className="mt-3 inline-block text-sm font-medium text-brand hover:text-brand-dark">
        Go to branch operations (check-in, plans, purchases, attendance, crowd report) →
      </Link>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-6">
          <h2 className="font-medium">Create a branch</h2>
          <form onSubmit={createBranch} className="mt-4 space-y-3">
            <input placeholder="Branch name" required value={branchName} onChange={(e) => setBranchName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Address" value={branchAddress} onChange={(e) => setBranchAddress(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Phone" value={branchPhone} onChange={(e) => setBranchPhone(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <button disabled={creatingBranch}
              className="flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70">
              {creatingBranch && <Spinner className="h-4 w-4" />}
              {creatingBranch ? 'Adding...' : 'Add branch'}
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-gray-200 p-6">
          <h2 className="font-medium">Create an account</h2>
          <p className="mt-1 text-xs text-gray-500">
            Owner accounts can't be created directly - create the account, then promote it from
            the Staff or Members tab (requires email verification).
          </p>
          <form onSubmit={createAccount} className="mt-4 space-y-3">
            <select value={accountRole} onChange={(e) => setAccountRole(e.target.value as AccountRole)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              {ACCOUNT_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <input placeholder="Full name" required value={accountName} onChange={(e) => setAccountName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Email" type="email" required value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Phone (optional)" value={accountPhone} onChange={(e) => setAccountPhone(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Temporary password" type="password" required minLength={6} value={accountPassword}
              onChange={(e) => setAccountPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <BranchCheckboxes branches={branches} selected={accountBranchIds} onChange={setAccountBranchIds} />
            <button disabled={creatingAccount}
              className="flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70">
              {creatingAccount && <Spinner className="h-4 w-4" />}
              {creatingAccount ? 'Creating...' : 'Create account'}
            </button>
            {accountMessage && <p className="text-sm text-gray-600">{accountMessage}</p>}
          </form>
        </div>

        <div className="rounded-lg border border-gray-200 p-6">
          <h2 className="font-medium">Membership plans</h2>
          <p className="mt-1 text-xs text-gray-500">Chain-wide - the same plans apply at every branch.</p>
          <form onSubmit={createPlan} className="mt-4 space-y-3">
            <input placeholder="Plan name (e.g. 3 Month)" required value={planName} onChange={(e) => setPlanName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input type="number" min={1} placeholder="Duration (months)" required value={planMonths}
              onChange={(e) => setPlanMonths(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input type="number" min={0} placeholder="Price" required value={planPrice}
              onChange={(e) => setPlanPrice(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <button disabled={creatingPlan}
              className="flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70">
              {creatingPlan && <Spinner className="h-4 w-4" />}
              {creatingPlan ? 'Adding...' : 'Add plan'}
            </button>
          </form>
          {planError && <p className="text-sm text-red-600">{planError}</p>}
          {plansLoading ? (
            <div className="mt-4 space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-gray-100 text-sm">
              {plans.map((p) => (
                <li key={p.id} className="flex justify-between py-2">
                  <span>{p.name} <span className="text-xs text-gray-400">({p.durationMonths} month{p.durationMonths > 1 ? 's' : ''})</span></span>
                  <span className="text-gray-500">₹{p.price}</span>
                </li>
              ))}
              {plans.length === 0 && <li className="py-2 text-gray-400">No plans yet - add one above.</li>}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 p-6">
        <h2 className="font-medium">All branches</h2>
        {branchEditMessage && <p className="mt-2 text-sm text-red-600">{branchEditMessage}</p>}
        {branchesLoading ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : (
        <ul className="mt-3 divide-y divide-gray-100 text-sm">
          {branches.map((b) => (
            <li key={b.id} className="py-2">
              {editingBranchId === b.id ? (
                <div className="space-y-2">
                  <input value={editBranchName} onChange={(e) => setEditBranchName(e.target.value)}
                    placeholder="Branch name"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
                  <input value={editBranchAddress} onChange={(e) => setEditBranchAddress(e.target.value)}
                    placeholder="Address"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
                  <input value={editBranchPhone} onChange={(e) => setEditBranchPhone(e.target.value)}
                    placeholder="Phone"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
                  <div className="space-x-2">
                    <button onClick={() => saveEditBranch(b.id)} disabled={savingBranchEdit}
                      className="inline-flex items-center gap-1.5 text-xs text-green-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60">
                      {savingBranchEdit && <Spinner className="h-3 w-3" />}
                      {savingBranchEdit ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={cancelEditBranch} disabled={savingBranchEdit}
                      className="text-xs text-gray-500 hover:underline disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p>{b.name}</p>
                    <p className="text-xs text-gray-500">{b.address}</p>
                    <p className="text-xs text-gray-400">{b.phone || 'No phone on file'}</p>
                  </div>
                  <button onClick={() => startEditBranch(b)} className="text-xs text-gray-600 hover:underline">
                    Edit
                  </button>
                </div>
              )}
            </li>
          ))}
          {branches.length === 0 && <li className="py-2 text-gray-400">No branches yet - add one above.</li>}
        </ul>
        )}
      </div>
    </div>
  )
}