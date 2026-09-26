import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { ProductOrderInvoice } from '../types'
import { viewProductInvoice, printProductInvoice, downloadProductInvoice } from '../utils/productInvoice'

// Landing page for the link inside an emailed product-order invoice - mirrors InvoiceViewPage.
export default function ProductInvoiceViewPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const [invoice, setInvoice] = useState<ProductOrderInvoice | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!orderId) return
    api.get<ProductOrderInvoice>(`/api/product-orders/${orderId}/invoice`)
      .then((res) => setInvoice(res.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load invoice'))
  }, [orderId])

  if (error) {
    return <div className="mx-auto max-w-md px-4 py-16 text-center"><p className="text-sm text-red-600">{error}</p></div>
  }
  if (!invoice) return null

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-lg border border-gray-200 p-6">
        <h1 className="text-lg font-semibold">Order {invoice.invoiceNumber}</h1>
        <p className="mt-1 text-sm text-gray-500">{invoice.branchName}</p>
        <ul className="mt-4 space-y-1 text-sm">
          {invoice.items.map((it) => (
            <li key={it.productId} className="flex justify-between"><span>{it.productName} ×{it.quantity}</span><span>₹{it.lineTotal}</span></li>
          ))}
        </ul>
        {invoice.status === 'CANCELLED' && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            Cancelled - refunded ₹{invoice.refundAmount} via {invoice.refundMode?.replace('_', ' ')}
            {invoice.refundNote && <> · {invoice.refundNote}</>}
          </div>
        )}
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-gray-500">Total</dt><dd>₹{invoice.totalAmount}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">Mode</dt><dd>{invoice.mode.replace('_', ' ')}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">Date</dt><dd>{new Date(invoice.invoiceDate).toLocaleDateString()}</dd></div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <button onClick={() => viewProductInvoice(invoice)} className="text-brand hover:underline">View</button>
          <button onClick={() => printProductInvoice(invoice)} className="text-brand hover:underline">Print</button>
          <button onClick={() => downloadProductInvoice(invoice)} className="text-brand hover:underline">Download</button>
        </div>
      </div>
    </div>
  )
}