import { FormEvent, useEffect, useState } from 'react'
import { api } from '../../api/client'
import Spinner from '../Spinner'
import ConfirmDialog from '../ConfirmDialog'
import { useConfirm } from '../../hooks/useConfirm'
import type { ProductCategory } from '../../types'

export default function ProductCategoriesSection() {
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { confirm, dialogProps } = useConfirm()

  function load() {
    setLoading(true)
    api.get<ProductCategory[]>('/api/product-categories').then((res) => setCategories(res.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function createCategory(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Enter a category name.'); return }
    setSubmitting(true)
    try {
      await api.post('/api/product-categories', { name: name.trim() })
      setName('')
      load()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create category')
    } finally {
      setSubmitting(false)
    }
  }

  function deleteCategory(c: ProductCategory) {
    confirm({
      title: 'Delete category',
      message: `Delete "${c.name}"? Products stay in the catalog - they're just no longer filed under this category.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        await api.delete(`/api/product-categories/${c.id}`)
        load()
      },
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 p-6">
      <h2 className="font-medium">Product categories</h2>
      <p className="mt-1 text-xs text-gray-500">
        e.g. Proteins, Gainers, Pre/Post Workout, Ayurveda, Fit Foods, Vitamin Supplements, Fat Loss, Fitness Accessories, Apparel.
      </p>
      <form onSubmit={createCategory} className="mt-4 flex gap-2">
        <input placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <button disabled={submitting}
          className="flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70">
          {submitting && <Spinner className="h-4 w-4" />}
          {submitting ? 'Adding...' : 'Add'}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {!loading && categories.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700">
            {c.name} <span className="text-gray-400">({c.productCount})</span>
            <button onClick={() => deleteCategory(c)} className="text-red-500 hover:text-red-700">✕</button>
          </span>
        ))}
        {!loading && categories.length === 0 && <p className="text-sm text-gray-400">No categories yet - add one above.</p>}
      </div>
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}