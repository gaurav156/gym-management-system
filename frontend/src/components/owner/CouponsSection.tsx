import { FormEvent, useEffect, useState } from 'react'
import { api } from '../../api/client'
import Spinner from '../Spinner'
import type { Coupon, DiscountType } from '../../types'

const emptyForm = {
  code: '', description: '', discountType: 'PERCENTAGE' as DiscountType, discountValue: '',
  startsAt: '', endsAt: '', firstTimeBuyersOnly: false, maxRedemptions: '',
}

export default function CouponsSection() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function loadCoupons() {
    setLoading(true)
    api.get<Coupon[]>('/api/coupons/manage').then((res) => setCoupons(res.data)).finally(() => setLoading(false))
  }

  useEffect(() => { loadCoupons() }, [])

  async function createCoupon(e: FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!form.code.trim()) { setFormError('Enter a code.'); return }
    if (!form.discountValue || Number.isNaN(Number(form.discountValue))) {
      setFormError('Enter a valid discount value.')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/api/coupons/manage', {
        code: form.code.trim(),
        description: form.description || null,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        firstTimeBuyersOnly: form.firstTimeBuyersOnly,
        maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
      })
      setForm(emptyForm)
      setCreating(false)
      loadCoupons()
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to create coupon')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(c: Coupon) {
    await api.put(`/api/coupons/manage/${c.id}`, { active: !c.active })
    loadCoupons()
  }

  return (
    <div className="rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium">Coupons</h2>
          <p className="mt-1 text-xs text-gray-500">Applied at checkout on the front desk.</p>
        </div>
        <button onClick={() => { setCreating((v) => !v); setFormError('') }}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark">
          {creating ? 'Cancel' : 'Add coupon'}
        </button>
      </div>

      {creating && (
        <form onSubmit={createCoupon} className="mt-4 space-y-3 rounded-md border border-gray-200 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input placeholder="Code (e.g. WELCOME10)" required value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm uppercase" />
            <input placeholder="Description (optional)" value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={form.discountType}
              onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as DiscountType }))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="PERCENTAGE">Percentage off</option>
              <option value="FIXED">Fixed amount off</option>
            </select>
            <input type="number" min={0} step="0.01" required
              placeholder={form.discountType === 'PERCENTAGE' ? 'e.g. 10 (%)' : 'e.g. 200 (₹)'}
              value={form.discountValue}
              onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-gray-500">Valid from</label>
              <input type="datetime-local" value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Valid until</label>
              <input type="datetime-local" value={form.endsAt}
                onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <input type="number" min={1} placeholder="Max redemptions (optional)" value={form.maxRedemptions}
              onChange={(e) => setForm((f) => ({ ...f, maxRedemptions: e.target.value }))}
              className="w-56 rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input type="checkbox" checked={form.firstTimeBuyersOnly}
                onChange={(e) => setForm((f) => ({ ...f, firstTimeBuyersOnly: e.target.checked }))} />
              First-time buyers only
            </label>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <button disabled={submitting}
            className="flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70">
            {submitting && <Spinner className="h-4 w-4" />}
            {submitting ? 'Creating...' : 'Create coupon'}
          </button>
        </form>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="pb-2 pr-4">Code</th>
              <th className="pb-2 pr-4">Discount</th>
              <th className="pb-2 pr-4">Window</th>
              <th className="pb-2 pr-4">Redeemed</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!loading && coupons.map((c) => (
              <tr key={c.id}>
                <td className="py-2 pr-4 font-medium">
                  {c.code}
                  {c.firstTimeBuyersOnly && <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">New members</span>}
                </td>
                <td className="py-2 pr-4">{c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `₹${c.discountValue}`}</td>
                <td className="py-2 pr-4 text-gray-500 text-xs">
                  {c.startsAt ? new Date(c.startsAt).toLocaleDateString() : 'Any time'} –{' '}
                  {c.endsAt ? new Date(c.endsAt).toLocaleDateString() : 'No end'}
                </td>
                <td className="py-2 pr-4 text-gray-500">{c.timesRedeemed}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}</td>
                <td className="py-2 pr-4">
                  <span className={c.currentlyValid ? 'text-green-700' : 'text-gray-400'}>
                    {c.currentlyValid ? 'Valid' : c.active ? 'Not in window' : 'Inactive'}
                  </span>
                </td>
                <td className="py-2">
                  <button onClick={() => toggleActive(c)} className="text-xs text-brand hover:underline">
                    {c.active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && coupons.length === 0 && <p className="py-4 text-sm text-gray-400">No coupons yet - add one above.</p>}
      </div>
    </div>
  )
}