import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import Spinner from '../Spinner'
import type { Branch, FinanceGranularity, FinanceReportResponse } from '../../types'

interface Props {
  branches: Branch[]
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function currentYearOptions(): number[] {
  const current = new Date().getFullYear()
  return Array.from({ length: 6 }, (_, i) => current - i)
}

export default function FinanceReportSection({ branches }: Props) {
  const today = new Date()

  const [granularity, setGranularity] = useState<FinanceGranularity>('MONTHLY')
  const [branchId, setBranchId] = useState('') // '' = all branches
  const [date, setDate] = useState(today.toISOString().slice(0, 10))
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [quarter, setQuarter] = useState(Math.floor(today.getMonth() / 3) + 1)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [report, setReport] = useState<FinanceReportResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  const yearOptions = currentYearOptions()

  function buildParams(): Record<string, string | number> {
    const params: Record<string, string | number> = { granularity }
    if (branchId) params.branchId = branchId
    if (granularity === 'DAILY') params.date = date
    if (granularity === 'MONTHLY') { params.year = year; params.month = month }
    if (granularity === 'QUARTERLY') { params.year = year; params.quarter = quarter }
    if (granularity === 'YEARLY') params.year = year
    if (granularity === 'CUSTOM') { params.fromDate = fromDate; params.toDate = toDate }
    return params
  }

  function validateCustomRange(): boolean {
    if (granularity === 'CUSTOM' && (!fromDate || !toDate)) {
      setError('Select both a from and to date.')
      return false
    }
    return true
  }

  async function generateReport() {
    setError('')
    if (!validateCustomRange()) return
    setLoading(true)
    try {
      const { data } = await api.get<FinanceReportResponse>('/api/finance/report', { params: buildParams() })
      setReport(data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  async function downloadExcel() {
    setError('')
    if (!validateCustomRange()) return
    setDownloading(true)
    try {
      const res = await api.get('/api/finance/report/export', { params: buildParams(), responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `income-profit-${granularity.toLowerCase()}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to download report')
    } finally {
      setDownloading(false)
    }
  }

  // Load a sensible default (this month, all branches) as soon as the section mounts.
  useEffect(() => { generateReport() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-lg border border-gray-200 p-6">
      <h2 className="font-medium">Income &amp; Profit</h2>
      <p className="mt-1 text-xs text-gray-500">
        Membership and store income minus logged expenses, for the period and branch you pick.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500">Period</label>
          <select value={granularity} onChange={(e) => setGranularity(e.target.value as FinanceGranularity)}
            className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="DAILY">Daily</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="YEARLY">Yearly</option>
            <option value="CUSTOM">Custom range</option>
          </select>
        </div>

        {granularity === 'DAILY' && (
          <div>
            <label className="block text-xs text-gray-500">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
        )}

        {granularity === 'MONTHLY' && (
          <>
            <div>
              <label className="block text-xs text-gray-500">Month</label>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm">
                {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Year</label>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm">
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </>
        )}

        {granularity === 'QUARTERLY' && (
          <>
            <div>
              <label className="block text-xs text-gray-500">Quarter</label>
              <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value={1}>Q1 (Jan - Mar)</option>
                <option value={2}>Q2 (Apr - Jun)</option>
                <option value={3}>Q3 (Jul - Sep)</option>
                <option value={4}>Q4 (Oct - Dec)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Year</label>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm">
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </>
        )}

        {granularity === 'YEARLY' && (
          <div>
            <label className="block text-xs text-gray-500">Year</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm">
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {granularity === 'CUSTOM' && (
          <>
            <div>
              <label className="block text-xs text-gray-500">From</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500">To</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </>
        )}

        <div>
          <label className="block text-xs text-gray-500">Branch</label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">All branches</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        <button onClick={generateReport} disabled={loading}
          className="flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70">
          {loading && <Spinner className="h-4 w-4" />}
          {loading ? 'Loading...' : 'Generate report'}
        </button>

        <button onClick={downloadExcel} disabled={downloading}
          className="flex items-center justify-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70">
          {downloading && <Spinner className="h-4 w-4" />}
          {downloading ? 'Preparing...' : 'Download Excel'}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {report && (
        <>
          <p className="mt-4 text-xs text-gray-500">
            {report.fromDate} to {report.toDate} · {report.branchName ?? 'All branches'}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-md border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Membership income</p>
              <p className="mt-1 text-lg font-semibold">₹{report.totalMembershipIncome.toFixed(2)}</p>
            </div>
            <div className="rounded-md border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Store income</p>
              <p className="mt-1 text-lg font-semibold">₹{report.totalProductIncome.toFixed(2)}</p>
            </div>
            <div className="rounded-md border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Total expenses</p>
              <p className="mt-1 text-lg font-semibold text-red-600">₹{report.totalExpense.toFixed(2)}</p>
            </div>
            <div className="rounded-md border border-gray-200 p-4">
              <p className="text-xs text-gray-500">Profit</p>
              <p className={`mt-1 text-lg font-semibold ${report.totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                ₹{report.totalProfit.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="pb-2 pr-4">Period</th>
                  <th className="pb-2 pr-4">Membership</th>
                  <th className="pb-2 pr-4">Store</th>
                  <th className="pb-2 pr-4">Total income</th>
                  <th className="pb-2 pr-4">Expenses</th>
                  <th className="pb-2">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.breakdown.map((row) => (
                  <tr key={row.label}>
                    <td className="py-2 pr-4">{row.label}</td>
                    <td className="py-2 pr-4 text-gray-500">₹{row.membershipIncome.toFixed(2)}</td>
                    <td className="py-2 pr-4 text-gray-500">₹{row.productIncome.toFixed(2)}</td>
                    <td className="py-2 pr-4">₹{row.totalIncome.toFixed(2)}</td>
                    <td className="py-2 pr-4 text-red-600">₹{row.totalExpense.toFixed(2)}</td>
                    <td className={`py-2 ${row.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>₹{row.profit.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.breakdown.length === 0 && (
              <p className="py-4 text-sm text-gray-400">No income or expenses in this period.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}