import { FormEvent, useEffect, useState } from 'react'
import { api } from '../../api/client'
import PhotoUploadButton from '../PhotoUploadButton'
import Spinner from '../Spinner'
import ConfirmDialog from '../ConfirmDialog'
import { useConfirm } from '../../hooks/useConfirm'
import { TableSkeleton } from '../Skeleton'
import type { Expense, ExpenseCategory, PageResponse, AuthUser } from '../../types'

const PAGE_SIZE = 10

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'SALARY', label: 'Staff salary' },
  { value: 'UTILITY', label: 'Utility bill' },
  { value: 'RENT', label: 'Rent' },
  { value: 'EQUIPMENT', label: 'Equipment purchase' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'OTHER', label: 'Other' },
]

function categoryLabel(cat: string): string {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? cat
}

interface Props {
  selectedBranch: string
  user: AuthUser | null
}

export default function ExpensesTab({ selectedBranch, user }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [expensesLoading, setExpensesLoading] = useState(true)
  const [expensePage, setExpensePage] = useState(0)
  const [expenseTotalPages, setExpenseTotalPages] = useState(1)
  const [expenseTotalElements, setExpenseTotalElements] = useState(0)

  const [category, setCategory] = useState<ExpenseCategory>('OTHER')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [remark, setRemark] = useState('')
  const [billUrl, setBillUrl] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [formMessage, setFormMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { confirm, dialogProps } = useConfirm()

  function loadExpenses(page = 0) {
    if (!selectedBranch) return
    setExpensesLoading(true)
    api.get<PageResponse<Expense>>(`/api/expenses/branch/${selectedBranch}`, {
      params: { page, size: PAGE_SIZE },
    }).then((res) => {
      setExpenses(res.data.content)
      setExpenseTotalPages(res.data.totalPages)
      setExpenseTotalElements(res.data.totalElements)
      setExpensePage(res.data.page)
    }).finally(() => setExpensesLoading(false))
  }

  useEffect(() => {
    loadExpenses(0)
  }, [selectedBranch])

  function resetForm() {
    setCategory('OTHER'); setAmount(''); setExpenseDate(new Date().toISOString().slice(0, 10))
    setRemark(''); setBillUrl(null)
  }

  async function recordExpense(e: FormEvent) {
    e.preventDefault()
    setFormError(''); setFormMessage('')
    if (!selectedBranch) {
      setFormError('No branch selected.')
      return
    }
    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      setFormError('Enter a valid amount.')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/api/expenses', {
        branchId: selectedBranch,
        category,
        amount: Number(amount),
        expenseDate,
        remark: remark || null,
        billUrl: billUrl || null,
      })
      setFormMessage('Expense recorded.')
      resetForm()
      loadExpenses(0)
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to record expense')
    } finally {
      setSubmitting(false)
    }
  }

  function deleteExpense(id: string) {
    confirm({
      title: 'Delete expense',
      message: 'Permanently delete this expense record? This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        await api.delete(`/api/expenses/${id}`)
        loadExpenses(expensePage)
      },
    })
  }

  return (
    <div>
      <div className="grid gap-8 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-6">
          <h2 className="font-medium">Record an expense</h2>
          <p className="mt-1 text-xs text-gray-500">Logged against this branch - visible to the Owner and to Managers assigned here.</p>
          <form onSubmit={recordExpense} className="mt-4 space-y-3">
            <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <input type="number" min={0} step="0.01" required placeholder="Amount" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <div>
              <label className="text-xs text-gray-500">Date of expense</label>
              <input type="date" required value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <textarea placeholder="Remark / note (optional)" value={remark} onChange={(e) => setRemark(e.target.value)} rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />

            <div>
              <label className="text-xs text-gray-500">Bill / invoice (optional)</label>
              <div className="mt-1 flex items-center gap-2">
                <PhotoUploadButton onLoaded={setBillUrl} onError={setFormError} label={billUrl ? 'Replace file' : 'Upload file'}
                  size="sm" purpose="BILL" accept="image/*,application/pdf" />
                {billUrl && (
                  <>
                    <a href={billUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">View</a>
                    <button type="button" onClick={() => setBillUrl(null)} className="text-xs text-red-600 hover:underline">Remove</button>
                  </>
                )}
              </div>
            </div>

            <button disabled={submitting}
              className="flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70">
              {submitting && <Spinner className="h-4 w-4" />}
              {submitting ? 'Recording...' : 'Record expense'}
            </button>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            {formMessage && <p className="text-sm text-green-700">{formMessage}</p>}
          </form>
        </div>

        <div className="rounded-lg border border-gray-200 p-6">
          <h2 className="font-medium">About expenses</h2>
          <p className="mt-2 text-sm text-gray-500">
            Expenses are branch-specific — only the Owner and Managers assigned to this
            branch can see them. Attach a bill or invoice (image or PDF) for your own
            records; it's available to view any time from the list below.
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 p-6">
        <h2 className="font-medium">Expense history</h2>
        <p className="mt-1 text-xs text-gray-500">Most recent expense date first.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Category</th>
                <th className="pb-2 pr-4">Amount</th>
                <th className="pb-2 pr-4">Remark</th>
                <th className="pb-2 pr-4">Recorded by</th>
                <th className="pb-2 pr-4">Bill</th>
                {user?.role === 'OWNER' && <th className="pb-2">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expensesLoading ? (
                <TableSkeleton rows={6} columns={user?.role === 'OWNER' ? 7 : 6} />
              ) : expenses.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 pr-4 text-gray-500">{e.expenseDate}</td>
                  <td className="py-2 pr-4">{categoryLabel(e.category)}</td>
                  <td className="py-2 pr-4">₹{e.amount}</td>
                  <td className="max-w-[200px] truncate py-2 pr-4 text-gray-500" title={e.remark ?? ''}>{e.remark ?? '—'}</td>
                  <td className="py-2 pr-4 text-gray-500">{e.recordedByName}</td>
                  <td className="py-2 pr-4">
                    {e.billUrl ? (
                      <a href={e.billUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">View</a>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  {user?.role === 'OWNER' && (
                    <td className="py-2">
                      <button onClick={() => deleteExpense(e.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!expensesLoading && expenses.length === 0 && <p className="py-4 text-sm text-gray-400">No expenses recorded yet.</p>}
          {expenseTotalElements > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>Page {expensePage + 1} of {expenseTotalPages} ({expenseTotalElements} total)</span>
              <div className="space-x-2">
                <button disabled={expensePage === 0} onClick={() => loadExpenses(expensePage - 1)}
                  className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
                <button disabled={expensePage + 1 >= expenseTotalPages} onClick={() => loadExpenses(expensePage + 1)}
                  className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}