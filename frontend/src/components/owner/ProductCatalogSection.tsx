import { FormEvent, useEffect, useState } from 'react'
import { api } from '../../api/client'
import PhotoUploadButton from '../PhotoUploadButton'
import Spinner from '../Spinner'
import ConfirmDialog from '../ConfirmDialog'
import { useConfirm } from '../../hooks/useConfirm'
import { TableSkeleton } from '../Skeleton'
import type { Product, PageResponse } from '../../types'

const PAGE_SIZE = 10

const emptyForm = {
  name: '', description: '', price: '', discountPrice: '',
  discountStartsAt: '', discountEndsAt: '', stockQuantity: '',
}

// Mirrors OwnerDashboard's existing "Membership plans" card, but as its own section since
// products carry a lot more per-item state (images, discount window, stock) than a plan
// does - a full-width table with an edit-in-place row makes more sense here than the
// compact list+inline-form OwnerDashboard uses for plans/branches.
export default function ProductCatalogSection() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')

  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formImages, setFormImages] = useState<string[]>([])
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editImages, setEditImages] = useState<string[]>([])
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const { confirm, dialogProps } = useConfirm()

  function loadProducts(p = 0, s = search) {
    setLoading(true)
    api.get<PageResponse<Product>>('/api/products/manage', {
      params: { search: s || undefined, page: p, size: PAGE_SIZE },
    }).then((res) => {
      setProducts(res.data.content)
      setTotalPages(res.data.totalPages)
      setTotalElements(res.data.totalElements)
      setPage(res.data.page)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { loadProducts(0) }, [])

  useEffect(() => {
    const handle = setTimeout(() => loadProducts(0, search), 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  async function createProduct(e: FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!form.price || Number.isNaN(Number(form.price))) {
      setFormError('Enter a valid price.')
      return
    }
    if (!form.stockQuantity || Number.isNaN(Number(form.stockQuantity))) {
      setFormError('Enter a valid stock quantity.')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/api/products/manage', {
        name: form.name,
        description: form.description || null,
        price: Number(form.price),
        discountPrice: form.discountPrice ? Number(form.discountPrice) : null,
        discountStartsAt: form.discountStartsAt || null,
        discountEndsAt: form.discountEndsAt || null,
        stockQuantity: Number(form.stockQuantity),
        imageUrls: formImages,
      })
      setForm(emptyForm)
      setFormImages([])
      setCreating(false)
      loadProducts(0)
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to create product')
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(p: Product) {
    setEditingId(p.id)
    setEditForm({
      name: p.name,
      description: p.description ?? '',
      price: String(p.price),
      discountPrice: p.discountPrice != null ? String(p.discountPrice) : '',
      discountStartsAt: p.discountStartsAt ? p.discountStartsAt.slice(0, 16) : '',
      discountEndsAt: p.discountEndsAt ? p.discountEndsAt.slice(0, 16) : '',
      stockQuantity: String(p.stockQuantity),
    })
    setEditImages(p.imageUrls)
    setEditError('')
  }

  async function saveEdit(id: string) {
    setEditError('')
    if (!editForm.price || Number.isNaN(Number(editForm.price))) {
      setEditError('Enter a valid price.')
      return
    }
    setSavingEdit(true)
    try {
      await api.put(`/api/products/manage/${id}`, {
        name: editForm.name,
        description: editForm.description || null,
        price: Number(editForm.price),
        discountPrice: editForm.discountPrice ? Number(editForm.discountPrice) : null,
        discountStartsAt: editForm.discountStartsAt || null,
        discountEndsAt: editForm.discountEndsAt || null,
        stockQuantity: Number(editForm.stockQuantity),
        imageUrls: editImages,
      })
      setEditingId(null)
      loadProducts(page)
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Failed to update product')
    } finally {
      setSavingEdit(false)
    }
  }

  function toggleActive(p: Product) {
    const action = p.active ? 'deactivate' : 'reactivate'
    confirm({
      title: p.active ? 'Deactivate product' : 'Reactivate product',
      message: p.active
        ? `Deactivate "${p.name}"? It will no longer appear in the member catalog or be purchasable.`
        : `Reactivate "${p.name}"? It will appear in the catalog again.`,
      confirmLabel: action === 'deactivate' ? 'Deactivate' : 'Reactivate',
      danger: action === 'deactivate',
      onConfirm: async () => {
        await api.put(`/api/products/manage/${p.id}`, { active: !p.active })
        loadProducts(page)
      },
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium">Product catalog</h2>
          <p className="mt-1 text-xs text-gray-500">Chain-wide - sold and picked up at any branch.</p>
        </div>
        <button onClick={() => { setCreating((v) => !v); setFormError('') }}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark">
          {creating ? 'Cancel' : 'Add product'}
        </button>
      </div>

      {creating && (
        <form onSubmit={createProduct} className="mt-4 space-y-3 rounded-md border border-gray-200 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input placeholder="Product name" required value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input type="number" min={0} placeholder="Stock quantity" required value={form.stockQuantity}
              onChange={(e) => setForm((f) => ({ ...f, stockQuantity: e.target.value }))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <textarea placeholder="Description" value={form.description} rows={2}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <div className="grid gap-3 sm:grid-cols-2">
            <input type="number" min={0} step="0.01" placeholder="Price" required value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <input type="number" min={0} step="0.01" placeholder="Discount price (optional)" value={form.discountPrice}
              onChange={(e) => setForm((f) => ({ ...f, discountPrice: e.target.value }))}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-gray-500">Discount starts</label>
              <input type="datetime-local" value={form.discountStartsAt}
                onChange={(e) => setForm((f) => ({ ...f, discountStartsAt: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Discount ends</label>
              <input type="datetime-local" value={form.discountEndsAt}
                onChange={(e) => setForm((f) => ({ ...f, discountEndsAt: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Images</label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {formImages.map((url, i) => (
                <div key={url} className="relative">
                  <img src={url} alt="" className="h-16 w-16 rounded object-cover" />
                  <button type="button" onClick={() => setFormImages((imgs) => imgs.filter((_, idx) => idx !== i))}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white">✕</button>
                </div>
              ))}
              <PhotoUploadButton
                onLoaded={(url) => setFormImages((imgs) => [...imgs, url])}
                onError={setFormError}
                label="Add image" size="sm" purpose="PRODUCT" />
            </div>
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <button disabled={submitting}
            className="flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70">
            {submitting && <Spinner className="h-4 w-4" />}
            {submitting ? 'Creating...' : 'Create product'}
          </button>
        </form>
      )}

      <input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)}
        className="mt-4 w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm" />

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="pb-2 pr-4">Product</th>
              <th className="pb-2 pr-4">Price</th>
              <th className="pb-2 pr-4">Stock</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <TableSkeleton rows={5} columns={5} />
            ) : products.map((p) => {
              const isEditing = editingId === p.id
              return (
                <tr key={p.id}>
                  {isEditing ? (
                    <td colSpan={5} className="py-3">
                      <div className="space-y-3 rounded-md border border-gray-200 p-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                            placeholder="Name" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                          <input type="number" min={0} value={editForm.stockQuantity}
                            onChange={(e) => setEditForm((f) => ({ ...f, stockQuantity: e.target.value }))}
                            placeholder="Stock" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                        </div>
                        <textarea value={editForm.description} rows={2}
                          onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                          placeholder="Description" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input type="number" min={0} step="0.01" value={editForm.price}
                            onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                            placeholder="Price" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                          <input type="number" min={0} step="0.01" value={editForm.discountPrice}
                            onChange={(e) => setEditForm((f) => ({ ...f, discountPrice: e.target.value }))}
                            placeholder="Discount price" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <input type="datetime-local" value={editForm.discountStartsAt}
                            onChange={(e) => setEditForm((f) => ({ ...f, discountStartsAt: e.target.value }))}
                            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                          <input type="datetime-local" value={editForm.discountEndsAt}
                            onChange={(e) => setEditForm((f) => ({ ...f, discountEndsAt: e.target.value }))}
                            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {editImages.map((url, i) => (
                            <div key={url} className="relative">
                              <img src={url} alt="" className="h-14 w-14 rounded object-cover" />
                              <button type="button" onClick={() => setEditImages((imgs) => imgs.filter((_, idx) => idx !== i))}
                                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white">✕</button>
                            </div>
                          ))}
                          <PhotoUploadButton
                            onLoaded={(url) => setEditImages((imgs) => [...imgs, url])}
                            onError={setEditError}
                            label="Add image" size="sm" purpose="PRODUCT" />
                        </div>
                        {editError && <p className="text-sm text-red-600">{editError}</p>}
                        <div className="space-x-2">
                          <button onClick={() => saveEdit(p.id)} disabled={savingEdit}
                            className="inline-flex items-center gap-1.5 text-xs text-green-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60">
                            {savingEdit && <Spinner className="h-3 w-3" />}
                            {savingEdit ? 'Saving...' : 'Save'}
                          </button>
                          <button onClick={() => setEditingId(null)} disabled={savingEdit}
                            className="text-xs text-gray-500 hover:underline disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
                        </div>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          {p.imageUrls[0] && <img src={p.imageUrls[0]} alt="" className="h-8 w-8 rounded object-cover" />}
                          <span className={p.active ? '' : 'text-gray-400'}>{p.name}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        {p.discountActive ? (
                          <span>
                            <span className="text-gray-400 line-through">₹{p.price}</span>{' '}
                            <span className="font-medium text-green-700">₹{p.discountPrice}</span>
                          </span>
                        ) : (
                          <span>₹{p.price}</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {p.outOfStock
                          ? <span className="text-red-600">Out of stock</span>
                          : <span>{p.stockQuantity}</span>}
                      </td>
                      <td className="py-2 pr-4">
                        <span className={p.active ? 'text-green-700' : 'text-gray-400'}>
                          {p.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-2 space-x-2 whitespace-nowrap">
                        <button onClick={() => startEdit(p)} className="text-xs text-gray-600 hover:underline">Edit</button>
                        <button onClick={() => toggleActive(p)} className="text-xs text-brand hover:underline">
                          {p.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        {!loading && products.length === 0 && <p className="py-4 text-sm text-gray-400">No products yet - add one above.</p>}
        {totalElements > 0 && (
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>Page {page + 1} of {totalPages} ({totalElements} total)</span>
            <div className="space-x-2">
              <button disabled={page === 0} onClick={() => loadProducts(page - 1)}
                className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
              <button disabled={page + 1 >= totalPages} onClick={() => loadProducts(page + 1)}
                className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}