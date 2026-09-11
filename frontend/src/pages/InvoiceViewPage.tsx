import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { InvoiceResponse } from '../types'
import { viewInvoice, printInvoice, downloadInvoice } from '../utils/invoice'

// Landing page for the link inside an emailed invoice - fetches by paymentId (guarded
// server-side the same way as the dashboards: a MEMBER can only ever load their own).
export default function InvoiceViewPage() {
  const { paymentId } = useParams<{ paymentId: string }>()
  const [invoice, setInvoice] = useState<InvoiceResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!paymentId) return
    api.get<InvoiceResponse>(`/api/payments/${paymentId}/invoice`)
      .then((res) => setInvoice(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load invoice'))
  }, [paymentId])

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (!invoice) return null

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-lg border border-gray-200 p-6">
        <h1 className="text-lg font-semibold">Invoice {invoice.invoiceNumber}</h1>
        <p className="mt-1 text-sm text-gray-500">{invoice.branchName}</p>
        <dl className="mt-4 space-y-2 text-sm">
          {invoice.planName && (
            <div className="flex justify-between"><dt className="text-gray-500">Plan</dt><dd>{invoice.planName}</dd></div>
          )}
          {invoice.membershipStartDate && invoice.membershipEndDate && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Period</dt>
              <dd>{invoice.membershipStartDate} to {invoice.membershipEndDate}</dd>
            </div>
          )}
          <div className="flex justify-between"><dt className="text-gray-500">Amount</dt><dd>₹{invoice.amount}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">Mode</dt><dd>{invoice.mode.replace('_', ' ')}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">Date</dt><dd>{new Date(invoice.invoiceDate).toLocaleDateString()}</dd></div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <button onClick={() => viewInvoice(invoice)} className="text-brand hover:underline">View</button>
          <button onClick={() => printInvoice(invoice)} className="text-brand hover:underline">Print</button>
          <button onClick={() => downloadInvoice(invoice)} className="text-brand hover:underline">Download</button>
        </div>
      </div>
    </div>
  )
}