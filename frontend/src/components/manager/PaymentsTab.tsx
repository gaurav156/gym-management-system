import { FormEvent, useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { Plan, Payment, MemberSummary } from '../../types'

const PAGE_SIZE = 10
const PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'CHEQUE', 'BANK_TRANSFER']

interface Props {
  selectedBranch: string
}

export default function PaymentsTab({ selectedBranch }: Props) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [members, setMembers] = useState<MemberSummary[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [paymentPage, setPaymentPage] = useState(1)

  const [purchaseMemberId, setPurchaseMemberId] = useState('')
  const [purchasePlanId, setPurchasePlanId] = useState('')
  const [purchaseMode, setPurchaseMode] = useState('CASH')
  const [purchaseStartDate, setPurchaseStartDate] = useState('')
  const [purchaseMessage, setPurchaseMessage] = useState('')

  useEffect(() => {
    api.get<Plan[]>('/api/plans').then((res) => setPlans(res.data))
  }, [])

  function loadPayments() {
    if (!selectedBranch) return
    api.get<Payment[]>(`/api/payments/branch/${selectedBranch}`).then((res) => setPayments(res.data))
  }

  useEffect(() => {
    if (!selectedBranch) return
    api.get<MemberSummary[]>('/api/members', { params: { branchId: selectedBranch } }).then((res) => setMembers(res.data))
    loadPayments()
    setPaymentPage(1)
  }, [selectedBranch])

  async function recordPurchase(e: FormEvent) {
    e.preventDefault()
    setPurchaseMessage('')
    if (!purchaseMemberId || !purchasePlanId) {
      setPurchaseMessage('Select a member and a plan.')
      return
    }
    if (!selectedBranch) {
      setPurchaseMessage('No branch selected.')
      return
    }
    try {
      const { data } = await api.post(
        '/api/memberships/purchase',
        {
          planId: purchasePlanId,
          mode: purchaseMode,
          branchId: selectedBranch,
          startDate: purchaseStartDate || null,
        },
        { params: { memberId: purchaseMemberId } }
      )
      setPurchaseMessage(`Recorded - valid until ${data.endDate}.`)
      setPurchaseMemberId(''); setPurchasePlanId(''); setPurchaseStartDate('')
      loadPayments()
    } catch (err: any) {
      setPurchaseMessage(err.response?.data?.error || 'Failed to record purchase')
    }
  }

  const paymentTotalPages = Math.max(1, Math.ceil(payments.length / PAGE_SIZE))
  const pagedPayments = payments.slice((paymentPage - 1) * PAGE_SIZE, paymentPage * PAGE_SIZE)

  return (
    <div>
      <div className="grid gap-8 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-6">
          <h2 className="font-medium">Record a membership purchase</h2>
          <p className="mt-1 text-xs text-gray-500">Cash collected at the front desk - members can't self-purchase.</p>
          <form onSubmit={recordPurchase} className="mt-4 space-y-3">
            <select required value={purchaseMemberId} onChange={(e) => setPurchaseMemberId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select member</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.email}) - PIN {m.checkinPin ?? '—'}</option>
              ))}
            </select>
            <select required value={purchasePlanId} onChange={(e) => setPurchasePlanId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select plan</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} - ₹{p.price}</option>)}
            </select>
            <select required value={purchaseMode} onChange={(e) => setPurchaseMode(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
            </select>
            <div>
              <label className="text-xs text-gray-500">Start date (only used if member has no active plan)</label>
              <input type="date" value={purchaseStartDate} onChange={(e) => setPurchaseStartDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
              Record purchase
            </button>
            {purchaseMessage && <p className="text-sm text-gray-700">{purchaseMessage}</p>}
          </form>
        </div>

        <div className="rounded-lg border border-gray-200 p-6">
          <h2 className="font-medium">Membership plans</h2>
          <p className="mt-1 text-xs text-gray-500">Chain-wide - managed by the Owner. Shown here for reference.</p>
          <ul className="mt-4 divide-y divide-gray-100 text-sm">
            {plans.map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <span>{p.name}</span>
                <span className="text-gray-500">₹{p.price}</span>
              </li>
            ))}
            {plans.length === 0 && <li className="py-2 text-gray-400">No plans published yet.</li>}
          </ul>
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 p-6">
        <h2 className="font-medium">Payment history</h2>
        <p className="mt-1 text-xs text-gray-500">All cash collected at this branch, most recent first.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Member</th>
                <th className="pb-2 pr-4">Plan</th>
                <th className="pb-2 pr-4">Amount</th>
                <th className="pb-2 pr-4">Mode</th>
                <th className="pb-2">Recorded by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagedPayments.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-4 text-gray-500">{new Date(p.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-4">{p.memberName}</td>
                  <td className="py-2 pr-4">{p.planName ?? '—'}</td>
                  <td className="py-2 pr-4">₹{p.amount}</td>
                  <td className="py-2 pr-4">{p.mode}</td>
                  <td className="py-2">{p.recordedByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {payments.length === 0 && <p className="py-4 text-sm text-gray-400">No payments recorded yet.</p>}
          {payments.length > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>Page {paymentPage} of {paymentTotalPages} ({payments.length} total)</span>
              <div className="space-x-2">
                <button disabled={paymentPage === 1} onClick={() => setPaymentPage((p) => p - 1)}
                  className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
                <button disabled={paymentPage === paymentTotalPages} onClick={() => setPaymentPage((p) => p + 1)}
                  className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}