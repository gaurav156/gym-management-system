import { FormEvent, useEffect, useState } from 'react'
import { api } from '../../api/client'
import PhotoUploadButton from '../PhotoUploadButton'
import ProductDetailModal from '../ProductDetailModal'
import DescriptionEditor from './DescriptionEditor'
import Spinner from '../Spinner'
import ConfirmDialog from '../ConfirmDialog'
import { useConfirm } from '../../hooks/useConfirm'
import { TableSkeleton } from '../Skeleton'
import type { Product, ProductCategory, Branch, PageResponse } from '../../types'

const PAGE_SIZE = 10

interface BranchStockInput { branchId: string; stockQuantity: string }
interface Props { branches: Branch[] }

const emptyForm = { name: '', description: '', price: '', discountPrice: '', discountStartsAt: '', discountEndsAt: '' }

export default function ProductCatalogSection({ branches }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [categories, setCategories] = useState<ProductCategory[]>([])

  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formImages, setFormImages] = useState<string[]>([])
  const [formCategoryIds, setFormCategoryIds] = useState<string[]>([])
  const [formStocks, setFormStocks] = useState<BranchStockInput[]>([])
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editImages, setEditImages] = useState<string[]>([])
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([])
  const [editStocks, setEditStocks] = useState<BranchStockInput[]>([])
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const [viewingProduct, setViewingProduct] = useState<Product | null>(null)
  const [listMessage, setListMessage] = useState('')

  const { confirm, dialogProps } = useConfirm()

  function loadProducts(p = 0, s = search, cat = categoryFilter) {
    setLoading(true)
    api.get<PageResponse<Product>>('/api/products/manage', {
      params: { search: s || undefined, categoryId: cat || undefined, page: p, size: PAGE_SIZE },
    }).then((res) => {
      setProducts(res.data.content)
      setTotalPages(res.data.totalPages)
      setTotalElements(res.data.totalElements)
      setPage(res.data.page)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { loadProducts(0) }, [])
  useEffect(() => { api.get<ProductCategory[]>('/api/product-categories').then((res) => setCategories(res.data)) }, [])

  useEffect(() => {
    const handle = setTimeout(() => loadProducts(0, search, categoryFilter), 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter])

  function blankStocks(): BranchStockInput[] {
    return branches.map((b) => ({ branchId: b.id, stockQuantity: '' }))
  }

  function openCreate() {
    setCreating((v) => !v)
    setFormError('')
    if (formStocks.length === 0) setFormStocks(blankStocks())
  }

  async function createProduct(e: FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!form.price || Number.isNaN(Number(form.price))) { setFormError('Enter a valid price.'); return }
    const branchStocks = formStocks
      .filter((s) => s.stockQuantity !== '')
      .map((s) => ({ branchId: s.branchId, stockQuantity: Number(s.stockQuantity) }))
    if (branchStocks.length === 0) { setFormError('Enter stock for at least one branch.'); return }
    if (branchStocks.some((s) => Number.isNaN(s.stockQuantity) || s.stockQuantity < 0)) {
      setFormError('Stock quantities must be valid non-negative numbers.')
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
        imageUrls: formImages,
        branchStocks,
        categoryIds: formCategoryIds,
      })
      setForm(emptyForm); setFormImages([]); setFormCategoryIds([]); setFormStocks(blankStocks())
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
    })
    setEditImages(p.imageUrls)
    setEditCategoryIds(p.categories.map((c) => c.id))
    setEditStocks(branches.map((b) => {
      const existing = p.branchStocks.find((s) => s.branchId === b.id)
      return { branchId: b.id, stockQuantity: existing ? String(existing.stockQuantity) : '' }
    }))
    setEditError('')
  }

  async function saveEdit(id: string) {
    setEditError('')
    if (!editForm.price || Number.isNaN(Number(editForm.price))) { setEditError('Enter a valid price.'); return }
    setSavingEdit(true)
    try {
      await api.put(`/api/products/manage/${id}`, {
        name: editForm.name,
        description: editForm.description || null,
        price: Number(editForm.price),
        discountPrice: editForm.discountPrice ? Number(editForm.discountPrice) : null,
        discountStartsAt: editForm.discountStartsAt || null,
        discountEndsAt: editForm.discountEndsAt || null,
        imageUrls: editImages,
        categoryIds: editCategoryIds,
      })
      const branchStocks = editStocks
        .filter((s) => s.stockQuantity !== '')
        .map((s) => ({ branchId: s.branchId, stockQuantity: Number(s.stockQuantity) }))
      if (branchStocks.length > 0) {
        await api.put(`/api/products/manage/${id}/stock`, { branchStocks })
      }
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
      onConfirm: async () => { await api.put(`/api/products/manage/${p.id}`, { active: !p.active }); loadProducts(page) },
    })
  }

  function deleteProduct(p: Product) {
    setListMessage('')
    confirm({
      title: 'Delete product',
      message: `Permanently delete "${p.name}"? This only works if it's never been ordered - otherwise deactivate it instead. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/api/products/manage/${p.id}`)
          loadProducts(page)
        } catch (err: any) {
          setListMessage(err.response?.data?.error || 'Failed to delete product')
        }
      },
    })
  }

  function toggleCategory(list: string[], set: (v: string[]) => void, id: string) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  function StockTable({ stocks, onChange }: { stocks: BranchStockInput[]; onChange: (v: BranchStockInput[]) => void }) {
    return (
      <div className="rounded-md border border-gray-300 p-2 text-sm">
        <p className="mb-1 text-xs text-gray-500">Stock per branch</p>
        {branches.map((b) => {
          const row = stocks.find((s) => s.branchId === b.id) ?? { branchId: b.id, stockQuantity: '' }
          return (
            <div key={b.id} className="flex items-center justify-between gap-2 py-1">
              <span className="min-w-0 flex-1 truncate">{b.name}</span>
              <input type="number" min={0} placeholder="0" value={row.stockQuantity}
                onChange={(e) => onChange(stocks.map((s) => s.branchId === b.id ? { ...s, stockQuantity: e.target.value } : s))}
                className="w-20 flex-shrink-0 rounded-md border border-gray-300 px-2 py-1 text-xs" />
            </div>
          )
        })}
        {branches.length === 0 && <p className="text-xs text-gray-400">Add a branch first.</p>}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium">Product catalog</h2>
          <p className="mt-1 text-xs text-gray-500">Chain-wide - stock is tracked separately per branch.</p>
        </div>
        <button onClick={openCreate} className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark">
          {creating ? 'Cancel' : 'Add product'}
        </button>
      </div>

      {creating && (
        <form onSubmit={createProduct} className="mt-4 space-y-3 rounded-md border border-gray-200 p-4">
          <input placeholder="Product name" required value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />

          <DescriptionEditor value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} />

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

          <StockTable stocks={formStocks} onChange={setFormStocks} />

          <div>
            <p className="mb-1 text-xs text-gray-500">Categories</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <label key={c.id} className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                  formCategoryIds.includes(c.id) ? 'border-brand bg-brand/10 text-brand' : 'border-gray-300 text-gray-600'
                }`}>
                  <input type="checkbox" className="hidden" checked={formCategoryIds.includes(c.id)}
                    onChange={() => toggleCategory(formCategoryIds, setFormCategoryIds, c.id)} />
                  {c.name}
                </label>
              ))}
              {categories.length === 0 && <p className="text-xs text-gray-400">No categories yet.</p>}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">Images</label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {formImages.map((url, i) => (
                <div key={url} className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50">
                  <img src={url} alt="" className="max-h-full max-w-full object-contain" />
                  <button type="button" onClick={() => setFormImages((imgs) => imgs.filter((_, idx) => idx !== i))}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white">✕</button>
                </div>
              ))}
              <PhotoUploadButton onLoaded={(url) => setFormImages((imgs) => [...imgs, url])} onError={setFormError}
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

      <div className="mt-4 flex flex-wrap gap-2">
        <input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="min-w-[180px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {listMessage && <p className="mt-3 text-sm text-red-600">{listMessage}</p>}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="pb-2 pr-4">Product</th>
              <th className="pb-2 pr-4">Price</th>
              <th className="pb-2 pr-4">Stock (total)</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <TableSkeleton rows={5} columns={5} />
            ) : products.map((p) => {
              const isEditing = editingId === p.id
              const totalStock = p.branchStocks.reduce((sum, s) => sum + s.stockQuantity, 0)
              return (
                <tr key={p.id}>
                  {isEditing ? (
                    <td colSpan={5} className="py-3">
                      <div className="space-y-3 rounded-md border border-gray-200 p-3">
                        <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Name" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                        <DescriptionEditor value={editForm.description} onChange={(v) => setEditForm((f) => ({ ...f, description: v }))} rows={3} />
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
                        <StockTable stocks={editStocks} onChange={setEditStocks} />
                        <div>
                          <p className="mb-1 text-xs text-gray-500">Categories</p>
                          <div className="flex flex-wrap gap-2">
                            {categories.map((c) => (
                              <label key={c.id} className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                                editCategoryIds.includes(c.id) ? 'border-brand bg-brand/10 text-brand' : 'border-gray-300 text-gray-600'
                              }`}>
                                <input type="checkbox" className="hidden" checked={editCategoryIds.includes(c.id)}
                                  onChange={() => toggleCategory(editCategoryIds, setEditCategoryIds, c.id)} />
                                {c.name}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {editImages.map((url, i) => (
                            <div key={url} className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50">
                              <img src={url} alt="" className="max-h-full max-w-full object-contain" />
                              <button type="button" onClick={() => setEditImages((imgs) => imgs.filter((_, idx) => idx !== i))}
                                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white">✕</button>
                            </div>
                          ))}
                          <PhotoUploadButton onLoaded={(url) => setEditImages((imgs) => [...imgs, url])} onError={setEditError}
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
                          {p.imageUrls[0] && (
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-gray-50">
                              <img src={p.imageUrls[0]} alt="" className="max-h-full max-w-full object-contain" />
                            </div>
                          )}
                          <span className={p.active ? '' : 'text-gray-400'}>{p.name}</span>
                          {p.imageUrls.length > 1 && <span className="text-[10px] text-gray-400">+{p.imageUrls.length - 1}</span>}
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        {p.discountActive ? (
                          <span><span className="text-gray-400 line-through">₹{p.price}</span>{' '}
                            <span className="font-medium text-green-700">₹{p.discountPrice}</span></span>
                        ) : <span>₹{p.price}</span>}
                      </td>
                      <td className="py-2 pr-4" title={p.branchStocks.map((s) => `${s.branchName}: ${s.stockQuantity}`).join(', ')}>
                        {totalStock}
                      </td>
                      <td className="py-2 pr-4">
                        <span className={p.active ? 'text-green-700' : 'text-gray-400'}>{p.active ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td className="py-2 space-x-2 whitespace-nowrap">
                        <button onClick={() => setViewingProduct(p)} className="text-xs text-gray-600 hover:underline">View</button>
                        <button onClick={() => startEdit(p)} className="text-xs text-gray-600 hover:underline">Edit</button>
                        <button onClick={() => toggleActive(p)} className="text-xs text-brand hover:underline">
                          {p.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                        <button onClick={() => deleteProduct(p)} className="text-xs text-red-600 hover:underline">Delete</button>
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

      {viewingProduct && (
        <ProductDetailModal product={viewingProduct} onClose={() => setViewingProduct(null)} isStaffView />
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}