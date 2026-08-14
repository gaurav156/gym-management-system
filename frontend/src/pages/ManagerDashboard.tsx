import { FormEvent, useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import type { Branch, Plan } from '../types'

interface HourlyCount { hour: number; count: number }

export default function ManagerDashboard() {
  const user = useAuthStore((s) => s.user)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [plans, setPlans] = useState<Plan[]>([])
  const [summary, setSummary] = useState<HourlyCount[]>([])
  const [branchLoadError, setBranchLoadError] = useState('')

  const [planName, setPlanName] = useState('')
  const [planMonths, setPlanMonths] = useState(1)
  const [planPrice, setPlanPrice] = useState('')
  const [planError, setPlanError] = useState('')

  const [checkinPin, setCheckinPin] = useState('')
  const [checkinMessage, setCheckinMessage] = useState('')

  useEffect(() => {
    if (!user) return
    api.get<Branch[]>('/api/branches/mine', { params: { userId: user.userId } })
      .then((res) => {
        setBranches(res.data)
        if (res.data.length > 0) setSelectedBranch(res.data[0].id)
      }).catch((err) => {
        setBranchLoadError(err.response?.data?.error || 'Failed to load your branches - check the backend logs.')
      })
  }, [user])

  useEffect(() => {
    if (!selectedBranch) return
    api.get<Plan[]>('/api/plans', { params: { branchId: selectedBranch } }).then((res) => setPlans(res.data))
    api.get<HourlyCount[]>(`/api/attendance/summary/${selectedBranch}`).then((res) => setSummary(res.data))
  }, [selectedBranch])

async function createPlan(e: FormEvent) {
     e.preventDefault()
     setPlanError('')

     if (!selectedBranch) {
       setPlanError('No branch is selected yet - make sure your manager account is assigned to a branch.')
       return
     }
     if (!planPrice || Number.isNaN(Number(planPrice))) {
       setPlanError('Enter a valid price.')
       return
     }

     try {
       await api.post('/api/plans/manage', {
         branchId: selectedBranch, name: planName, durationMonths: planMonths, price: Number(planPrice),
       })
       setPlanName(''); setPlanPrice('')
       const res = await api.get<Plan[]>('/api/plans', { params: { branchId: selectedBranch } })
       setPlans(res.data)
     } catch (err: any) {
       setPlanError(err.response?.data?.error || JSON.stringify(err.response?.data) || 'Failed to create plan')
     }
   }

  async function kioskCheckin(e: FormEvent) {
    e.preventDefault()
    setCheckinMessage('')
    try {
      const { data } = await api.post('/api/attendance/checkin', {
        pin: checkinPin, branchId: selectedBranch, method: 'PIN',
      })
      setCheckinMessage(data.message)
      setCheckinPin('')
    } catch (err: any) {
      setCheckinMessage(err.response?.data?.error || 'Check-in failed')
    }
  }

  const maxCount = Math.max(1, ...summary.map((s) => s.count))

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Manager dashboard</h1>
      {branchLoadError && <p className="mt-2 text-sm text-red-600">{branchLoadError}</p>}

      {branches.length > 1 && (
        <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}
          className="mt-4 rounded-md border border-gray-300 px-3 py-2 text-sm">
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
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
          <h2 className="font-medium">Add a membership plan</h2>
          <form onSubmit={createPlan} className="mt-4 space-y-3">
            <input placeholder="Plan name (e.g. 3 Month)" required value={planName} onChange={(e) => setPlanName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input type="number" min={1} placeholder="Duration (months)" required value={planMonths}
              onChange={(e) => setPlanMonths(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input type="number" min={0} placeholder="Price" required value={planPrice}
              onChange={(e) => setPlanPrice(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
              Add plan
            </button>
            {planError && <p className="text-sm text-red-600">{planError}</p>}
          </form>
          <ul className="mt-4 divide-y divide-gray-100 text-sm">
            {plans.map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <span>{p.name}</span>
                <span className="text-gray-500">₹{p.price}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 p-6">
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
  )
}
