import { FormEvent, useEffect, useState } from 'react'
import { api } from '../../api/client'
import Spinner from '../Spinner'
import ConfirmDialog from '../ConfirmDialog'
import { useConfirm } from '../../hooks/useConfirm'
import type { Coupon, DiscountType } from '../../types'

interface CouponFormState {
  code: string
  description: string
  discountType: DiscountType
  discountValue: string
  maxDiscountAmount: string
  startsAt: string
  endsAt: string
  firstTimeBuyersOnly: boolean
  maxRedemptions: string
}

const emptyForm: CouponFormState = {
  code: '', description: '', discountType: 'PERCENTAGE', discountValue: '', maxDiscountAmount: '',
  startsAt: '', endsAt: '', firstTimeBuyersOnly: false, maxRedemptions: '',
}

function toFormState(c: Coupon): CouponFormState {
  return {
    code: c.code,
    description: c.description ?? '',
    discountType: c.discountType,
    discountValue: String(c.discountValue),
    maxDiscountAmount: c.maxDiscountAmount != null ? String(c.maxDiscountAmount) : '',
    startsAt: c.startsAt ? c.startsAt.slice(0, 16) : '',
    endsAt: c.endsAt ? c.endsAt.slice(0, 16) : '',
    firstTimeBuyersOnly: c.firstTimeBuyersOnly,
    maxRedemptions: c.maxRedemptions != null ? String(c.maxRedemptions) : '',
  }
}

export default function CouponsSection() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<CouponFormState>(emptyForm)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<CouponFormState>(emptyForm)
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const [listMessage, setListMessage] = useState('')
  const { confirm, dialogProps } = useConfirm()

  function loadCoupons() {
    setLoading(true)
    api.get<Coupon[]>('/api/coupons/manage').then((res) => setCoupons(res.data)).finally(() => setLoading(false))
  }

  useEffect(() => { loadCoupons() }, [])

  function validateForm(f: CouponFormState, setError: (m: string) => void): boolean {
    if (!f.code.trim()) { setError('Enter a code.'); return false }
    if (!f.discountValue || Number.isNaN(Number(f.discountValue))) { setError('Enter a valid discount value.'); return false }
    if (f.maxDiscountAmount && Number.isNaN(Number(f.maxDiscountAmount))) { setError('Enter a valid max discount amount.'); return false }
    return true
  }

  async function createCoupon(e: FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!validateForm(form, setFormError)) return
    setSubmitting(true)
    try {
      await api.post('/api/coupons/manage', {
        code: form.code.trim(),
        description: form.description || null,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxDiscountAmount: form.discountType === 'PERCENTAGE' && form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
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

  function startEdit(c: Coupon) {
    setEditingId(c.id)
    setEditForm(toFormState(c))
    setEditError('')
  }

  async function saveEdit(id: string) {
    setEditError('')
    if (!validateForm(editForm, setEditError)) return
    setSavingEdit(true)
    try {
      await api.put(`/api/coupons/manage/${id}`, {
        code: editForm.code.trim(),
        description: editForm.description || null,
        discountType: editForm.discountType,
        discountValue: Number(editForm.discountValue),
        maxDiscountAmount: editForm.discountType === 'PERCENTAGE' && editForm.maxDiscountAmount ? Number(editForm.maxDiscountAmount) : null,
        startsAt: editForm.startsAt || null,
        endsAt: editForm.endsAt || null,
        firstTimeBuyersOnly: editForm.firstTimeBuyersOnly,
        maxRedemptions: editForm.maxRedemptions ? Number(editForm.maxRedemptions) : null,
      })
      setEditingId(null)
      loadCoupons()
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Failed to update coupon')
    } finally {
      setSavingEdit(false)
    }
  }

  async function toggleActive(c: Coupon) {
    await api.put(`/api/coupons/manage/${c.id}`, { active: !c.active })
    loadCoupons()
  }

  function deleteCoupon(c: Coupon) {
    setListMessage('')
    confirm({
      title: 'Delete coupon',
      message: `Permanently delete "${c.code}"? This only works if it's never been redeemed - otherwise deactivate it instead. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/api/coupons/manage/${c.id}`)
          loadCoupons()
        } catch (err: any) {
          setListMessage(err.response?.data?.error || 'Failed to delete coupon')
        }
      },
    })
  }

  function DiscountFields({ f, onChange }: { f: CouponFormState; onChange: (next: CouponFormState) => void }) {
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={f.discountType}
            onChange={(e) => onChange({ ...f, discountType: e.target.value as DiscountType, maxDiscountAmount: e.target.value === 'FIXED' ? '' : f.maxDiscountAmount })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="PERCENTAGE">Percentage off</option>
            <option value="FIXED">Fixed amount off</option>
          </select>
          <input type="number" min={0} step="0.01" required
            placeholder={f.discountType === 'PERCENTAGE' ? 'e.g. 10 (%)' : 'e.g. 200 (₹)'}
            value={f.discountValue}
            onChange={(e) => onChange({ ...f, discountValue: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        {f.discountType === 'PERCENTAGE' && (
          <div>
            <label className="text-xs text-gray-500">Max amount off (optional - caps the discount, e.g. ₹500)</label>
            <input type="number" min={0} step="0.01" placeholder="No cap" value={f.maxDiscountAmount}
              onChange={(e) => onChange({ ...f, maxDiscountAmount: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
        )}
      </>
    )
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

          <DiscountFields f={form} onChange={setForm} />

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

          {/* flex-wrap + min-w-0 fixed the mobile overflow: a fixed w-56 on the number
              input plus gap-4 plus the label's own width exceeded a narrow phone viewport,
              and a non-wrapping flex row just pushes the overflow out of the card instead
              of stacking. Both children now shrink/wrap instead. */}
          <div className="flex flex-wrap items-center gap-3">
            <input type="number" min={1} placeholder="Max redemptions (optional)" value={form.maxRedemptions}
              onChange={(e) => setForm((f) => ({ ...f, maxRedemptions: e.target.value }))}
              className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm sm:max-w-[14rem]" />
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

      {listMessage && <p className="mt-3 text-sm text-red-600">{listMessage}</p>}

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
            {!loading && coupons.map((c) => {
              const isEditing = editingId === c.id
              return isEditing ? (
                <tr key={c.id}>
                  <td colSpan={6} className="py-3">
                    <div className="space-y-3 rounded-md border border-gray-200 p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input value={editForm.code} onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                          placeholder="Code" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm uppercase" />
                        <input value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                          placeholder="Description" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                      </div>
                      <DiscountFields f={editForm} onChange={setEditForm} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input type="datetime-local" value={editForm.startsAt}
                          onChange={(e) => setEditForm((f) => ({ ...f, startsAt: e.target.value }))}
                          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                        <input type="datetime-local" value={editForm.endsAt}
                          onChange={(e) => setEditForm((f) => ({ ...f, endsAt: e.target.value }))}
                          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <input type="number" min={1} placeholder="Max redemptions (optional)" value={editForm.maxRedemptions}
                          onChange={(e) => setEditForm((f) => ({ ...f, maxRedemptions: e.target.value }))}
                          className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm sm:max-w-[14rem]" />
                        <label className="flex items-center gap-1.5 text-xs text-gray-600">
                          <input type="checkbox" checked={editForm.firstTimeBuyersOnly}
                            onChange={(e) => setEditForm((f) => ({ ...f, firstTimeBuyersOnly: e.target.checked }))} />
                          First-time buyers only
                        </label>
                      </div>
                      {editError && <p className="text-sm text-red-600">{editError}</p>}
                      <div className="space-x-2">
                        <button onClick={() => saveEdit(c.id)} disabled={savingEdit}
                          className="inline-flex items-center gap-1.5 text-xs text-green-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60">
                          {savingEdit && <Spinner className="h-3 w-3" />}
                          {savingEdit ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={() => setEditingId(null)} disabled={savingEdit}
                          className="text-xs text-gray-500 hover:underline disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={c.id}>
                  <td className="py-2 pr-4 font-medium">
                    {c.code}
                    {c.firstTimeBuyersOnly && <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">New members</span>}
                  </td>
                  <td className="py-2 pr-4">
                    {c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `₹${c.discountValue}`}
                    {c.discountType === 'PERCENTAGE' && c.maxDiscountAmount != null && (
                      <span className="ml-1 text-xs text-gray-400">(up to ₹{c.maxDiscountAmount})</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-xs text-gray-500">
                    {c.startsAt ? new Date(c.startsAt).toLocaleString() : 'Any time'} –{' '}
                    {c.endsAt ? new Date(c.endsAt).toLocaleString() : 'No end'}
                  </td>
                  <td className="py-2 pr-4 text-gray-500">{c.timesRedeemed}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}</td>
                  <td className="py-2 pr-4">
                    <span className={c.currentlyValid ? 'text-green-700' : 'text-gray-400'}>
                      {c.currentlyValid ? 'Valid' : c.active ? 'Not in window' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-2 space-x-2 whitespace-nowrap">
                    <button onClick={() => startEdit(c)} className="text-xs text-gray-600 hover:underline">Edit</button>
                    <button onClick={() => toggleActive(c)} className="text-xs text-brand hover:underline">
                      {c.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                    <button onClick={() => deleteCoupon(c)} className="text-xs text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!loading && coupons.length === 0 && <p className="py-4 text-sm text-gray-400">No coupons yet - add one above.</p>}
      </div>
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}