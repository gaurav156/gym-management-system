import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Branch, PersonSummary } from '../types'

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
  const [branchName, setBranchName] = useState('')
  const [branchAddress, setBranchAddress] = useState('')

  const [managerName, setManagerName] = useState('')
  const [managerEmail, setManagerEmail] = useState('')
  const [managerPassword, setManagerPassword] = useState('')
  const [managerBranchIds, setManagerBranchIds] = useState<string[]>([])
  const [managerMessage, setManagerMessage] = useState('')

  const [trainerName, setTrainerName] = useState('')
  const [trainerEmail, setTrainerEmail] = useState('')
  const [trainerPassword, setTrainerPassword] = useState('')
  const [trainerBranchIds, setTrainerBranchIds] = useState<string[]>([])
  const [trainerMessage, setTrainerMessage] = useState('')

  const [assignRole, setAssignRole] = useState<'MEMBER' | 'TRAINER' | 'MANAGER'>('MEMBER')
  const [assignPeople, setAssignPeople] = useState<PersonSummary[]>([])
  const [assignPersonId, setAssignPersonId] = useState('')
  const [assignBranchIds, setAssignBranchIds] = useState<string[]>([])
  const [assignMessage, setAssignMessage] = useState('')

  function loadBranches() {
    api.get<Branch[]>('/api/branches').then((res) => setBranches(res.data))
  }

  useEffect(() => { loadBranches() }, [])

  async function createBranch(e: FormEvent) {
    e.preventDefault()
    await api.post('/api/branches', { name: branchName, address: branchAddress })
    setBranchName(''); setBranchAddress('')
    loadBranches()
  }

  async function createManager(e: FormEvent) {
    e.preventDefault()
    setManagerMessage('')
    if (managerBranchIds.length === 0) {
      setManagerMessage('Select at least one branch.')
      return
    }
    try {
      await api.post('/api/auth/owner/create-manager', {
        name: managerName, email: managerEmail, password: managerPassword, branchIds: managerBranchIds,
      })
      setManagerMessage(`Manager account created for ${managerName}`)
      setManagerName(''); setManagerEmail(''); setManagerPassword(''); setManagerBranchIds([])
    } catch (err: any) {
      setManagerMessage(err.response?.data?.error || 'Failed to create manager')
    }
  }

  async function createTrainer(e: FormEvent) {
    e.preventDefault()
    setTrainerMessage('')
    if (trainerBranchIds.length === 0) {
      setTrainerMessage('Select at least one branch.')
      return
    }
    try {
      await api.post('/api/auth/owner/create-trainer', {
        name: trainerName, email: trainerEmail, password: trainerPassword, branchIds: trainerBranchIds,
      })
      setTrainerMessage(`Trainer account created for ${trainerName}`)
      setTrainerName(''); setTrainerEmail(''); setTrainerPassword(''); setTrainerBranchIds([])
    } catch (err: any) {
      setTrainerMessage(err.response?.data?.error || 'Failed to create trainer')
    }
  }

  useEffect(() => {
    setAssignPersonId('')
    setAssignBranchIds([])
    setAssignMessage('')
    api.get<PersonSummary[]>('/api/branches/people', { params: { role: assignRole } })
      .then((res) => setAssignPeople(res.data))
  }, [assignRole])

  function selectAssignPerson(personId: string) {
    setAssignPersonId(personId)
    setAssignMessage('')
    if (!personId) {
      setAssignBranchIds([])
      return
    }
    api.get<Branch[]>('/api/branches/mine', { params: { userId: personId } })
      .then((res) => setAssignBranchIds(res.data.map((b) => b.id)))
  }

  async function saveAssignments(e: FormEvent) {
    e.preventDefault()
    setAssignMessage('')
    if (!assignPersonId) {
      setAssignMessage('Select a person first.')
      return
    }
    if (assignBranchIds.length === 0) {
      setAssignMessage('Select at least one branch.')
      return
    }
    try {
      await api.put(`/api/branches/assignments/${assignPersonId}`, { branchIds: assignBranchIds })
      setAssignMessage('Branch assignments updated.')
    } catch (err: any) {
      setAssignMessage(err.response?.data?.error || 'Failed to update branch assignments')
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Owner dashboard</h1>
      <p className="mt-1 text-sm text-gray-600">Manage branches, manager, and trainer accounts across your gym chain.</p>
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
            <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
              Add branch
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-gray-200 p-6">
          <h2 className="font-medium">Create a manager account</h2>
          <form onSubmit={createManager} className="mt-4 space-y-3">
            <input placeholder="Full name" required value={managerName} onChange={(e) => setManagerName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Email" type="email" required value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Temporary password" type="password" required minLength={6} value={managerPassword}
              onChange={(e) => setManagerPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <BranchCheckboxes branches={branches} selected={managerBranchIds} onChange={setManagerBranchIds} />
            <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
              Create manager
            </button>
            {managerMessage && <p className="text-sm text-gray-600">{managerMessage}</p>}
          </form>
        </div>

        <div className="rounded-lg border border-gray-200 p-6">
          <h2 className="font-medium">Create a trainer account</h2>
          <form onSubmit={createTrainer} className="mt-4 space-y-3">
            <input placeholder="Full name" required value={trainerName} onChange={(e) => setTrainerName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Email" type="email" required value={trainerEmail} onChange={(e) => setTrainerEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Temporary password" type="password" required minLength={6} value={trainerPassword}
              onChange={(e) => setTrainerPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <BranchCheckboxes branches={branches} selected={trainerBranchIds} onChange={setTrainerBranchIds} />
            <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
              Create trainer
            </button>
            {trainerMessage && <p className="text-sm text-gray-600">{trainerMessage}</p>}
          </form>
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 p-6">
        <h2 className="font-medium">Branch assignments</h2>
        <p className="mt-1 text-xs text-gray-500">
          Move or add branches for any Member, Trainer, or Manager. Since membership plans are
          chain-wide, a member keeps full access at every branch they're assigned to.
        </p>
        <form onSubmit={saveAssignments} className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <select value={assignRole} onChange={(e) => setAssignRole(e.target.value as any)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="MEMBER">Member</option>
              <option value="TRAINER">Trainer</option>
              <option value="MANAGER">Manager</option>
            </select>
            <select value={assignPersonId} onChange={(e) => selectAssignPerson(e.target.value)}
              className="flex-1 min-w-[200px] rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select a person</option>
              {assignPeople.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.email})</option>)}
            </select>
          </div>
          {assignPersonId && (
            <BranchCheckboxes branches={branches} selected={assignBranchIds} onChange={setAssignBranchIds} />
          )}
          <button disabled={!assignPersonId} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-40">
            Save branch assignments
          </button>
          {assignMessage && <p className="text-sm text-gray-600">{assignMessage}</p>}
        </form>
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 p-6">
        <h2 className="font-medium">All branches</h2>
        <ul className="mt-3 divide-y divide-gray-100 text-sm">
          {branches.map((b) => (
            <li key={b.id} className="flex justify-between py-2">
              <span>{b.name}</span>
              <span className="text-gray-500">{b.address}</span>
            </li>
          ))}
          {branches.length === 0 && <li className="py-2 text-gray-400">No branches yet - add one above.</li>}
        </ul>
      </div>
    </div>
  )
}