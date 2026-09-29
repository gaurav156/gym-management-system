import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { viewProductInvoice, printProductInvoice, downloadProductInvoice } from '../utils/productInvoice'
import RowActionsMenu from './RowActionsMenu'
import { EyeIcon, PrinterIcon, DownloadIcon, MailIcon } from './icons/ActionIcons'
import type { ProductOrder, ProductOrderInvoice, PageResponse } from '../types'

const PAGE_SIZE = 5

interface Props {
  personId: string
}

// Shared between MembersTab's and StaffTab's detail modals - same View/Print/Download/
// Send-email actions PaymentsTab already offers for membership payments, now for product
// orders too. personId works for a Member OR a staff person (Trainer/Manager/Owner) -
// see ProductOrderController.memberHistory.
export default function ProductPurchaseHistoryTab({ personId }: Props) {
  const [orders, setOrders] = useState<ProductOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [error, setError] = useState('')
  const [sendMessage, setSendMessage] = useState('')

  function load(p = 0) {
    setLoading(true)
    api.get<PageResponse<ProductOrder>>(`/api/product-orders/member/${personId}`, { params: { page: p, size: PAGE_SIZE } })
      .then((res) => {
        setOrders(res.data.content)
        setTotalPages(res.data.totalPages)
        setTotalElements(res.data.totalElements)
        setPage(res.data.page)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(0) }, [personId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleInvoiceAction(orderId: string, action: 'view' | 'print' | 'download') {
    setError('')
    try {
      const { data } = await api.get<ProductOrderInvoice>(`/api/product-orders/${orderId}/invoice`)
      if (action === 'view') await viewProductInvoice(data)
      else if (action === 'print') await printProductInvoice(data)
      else await downloadProductInvoice(data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load invoice')
    }
  }

  async function handleSendEmail(orderId: string) {
    setError(''); setSendMessage('')
    try {
      const { data } = await api.post<{ message: string }>(`/api/product-orders/${orderId}/send-email`)
      setSendMessage(data.message)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send email')
    }
  }

  return (
    <div className="mt-4">
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="pb-2 pr-4">Invoice</th>
              <th className="pb-2 pr-4">Items</th>
              <th className="pb-2 pr-4">Total</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="py-2 pr-4 text-gray-500">{o.invoiceNumber}</td>
                <td className="py-2 pr-4 text-xs text-gray-500">{o.items.map((it) => `${it.productName} ×${it.quantity}`).join(', ')}</td>
                <td className="py-2 pr-4">
                  ₹{o.totalAmount}
                  {o.discountAmount > 0 && <span className="ml-1 text-xs text-green-700">(-₹{o.discountAmount})</span>}
                </td>
                <td className="py-2 pr-4">
                  <span className={o.status === 'CANCELLED' ? 'text-red-600' : o.status === 'COMPLETED' ? 'text-green-700' : 'text-blue-600'}>
                    {o.status === 'CANCELLED' ? `Cancelled (refunded ₹${o.refundAmount})` : o.status}
                  </span>
                </td>
                <td className="py-2">
                  <RowActionsMenu actions={[
                    { label: 'View', icon: <EyeIcon />, onClick: () => handleInvoiceAction(o.id, 'view') },
                    { label: 'Print', icon: <PrinterIcon />, onClick: () => handleInvoiceAction(o.id, 'print') },
                    { label: 'Download', icon: <DownloadIcon />, onClick: () => handleInvoiceAction(o.id, 'download') },
                    { label: 'Send Email', icon: <MailIcon />, onClick: () => handleSendEmail(o.id) },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && orders.length === 0 && <p className="py-4 text-sm text-gray-400">No product purchases yet.</p>}
      {sendMessage && <p className="mt-2 text-sm text-green-700">{sendMessage}</p>}
      {totalElements > 0 && (
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>Page {page + 1} of {totalPages} ({totalElements} total)</span>
          <div className="space-x-2">
            <button disabled={page === 0} onClick={() => load(page - 1)}
              className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
            <button disabled={page + 1 >= totalPages} onClick={() => load(page + 1)}
              className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}