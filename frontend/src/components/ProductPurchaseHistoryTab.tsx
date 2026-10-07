import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { viewProductInvoice, printProductInvoice, downloadProductInvoice } from '../utils/productInvoice'
import RowActionsMenu from './RowActionsMenu'
import Spinner from './Spinner'
import { EyeIcon, PrinterIcon, DownloadIcon, MailIcon, WhatsAppIcon, BanIcon } from './icons/ActionIcons'
import type { ProductOrder, ProductOrderInvoice, PageResponse } from '../types'
import { useScrollLock } from '../hooks/useScrollLock'

const PAGE_SIZE = 5
const PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'CHEQUE', 'BANK_TRANSFER']

interface Props {
  personId: string
}

// Shared between MembersTab's and StaffTab's detail modals - same View/Print/Download/
// Send-email/Send-WhatsApp/Cancel actions PaymentsTab and StoreTab already offer.
// personId works for a Member OR a staff person (Trainer/Manager/Owner) - see
// ProductOrderController.memberHistory.
export default function ProductPurchaseHistoryTab({ personId }: Props) {
  const [orders, setOrders] = useState<ProductOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [error, setError] = useState('')
  const [sendMessage, setSendMessage] = useState('')

  const [cancelTarget, setCancelTarget] = useState<ProductOrder | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundMode, setRefundMode] = useState('CASH')
  const [refundNote, setRefundNote] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

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

  async function handleSendAction(orderId: string, channel: 'email' | 'whatsapp') {
    setError(''); setSendMessage('')
    try {
      const { data } = await api.post<{ message: string }>(`/api/product-orders/${orderId}/send-${channel}`)
      setSendMessage(data.message)
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to send via ${channel}`)
    }
  }

  function openCancelDialog(order: ProductOrder) {
    setCancelTarget(order); setRefundAmount(String(order.totalAmount)); setRefundMode('CASH'); setRefundNote(''); setCancelError('')
  }

  async function submitCancel() {
    if (!cancelTarget) return
    setCancelError('')
    if (!refundAmount || Number.isNaN(Number(refundAmount)) || Number(refundAmount) <= 0) {
      setCancelError('Enter a valid refund amount.')
      return
    }
    setCancelling(true)
    try {
      await api.post(`/api/product-orders/${cancelTarget.id}/cancel`, {
        refundAmount: Number(refundAmount), refundMode, refundNote: refundNote || null,
      })
      setCancelTarget(null)
      load(page)
    } catch (err: any) {
      setCancelError(err.response?.data?.error || 'Failed to cancel order')
    } finally {
      setCancelling(false)
    }
  }

  useScrollLock(!!cancelTarget)

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
                    { label: 'Send Email', icon: <MailIcon />, onClick: () => handleSendAction(o.id, 'email') },
                    { label: 'Send WhatsApp', icon: <WhatsAppIcon />, onClick: () => handleSendAction(o.id, 'whatsapp') },
                    ...(o.status !== 'CANCELLED'
                      ? [{ label: 'Cancel & refund', icon: <BanIcon />, onClick: () => openCancelDialog(o), danger: true }]
                      : []),
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

      {cancelTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">Cancel order {cancelTarget.invoiceNumber}</h3>
            <p className="mt-2 text-sm text-gray-600">
              Stock will be restored for every item. Record the cash refund given.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-gray-500">Refund amount</label>
                <input type="number" min={0} step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Refund mode</label>
                <select value={refundMode} onChange={(e) => setRefundMode(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Note (optional)</label>
                <textarea value={refundNote} onChange={(e) => setRefundNote(e.target.value)} rows={2}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              {cancelError && <p className="text-sm text-red-600">{cancelError}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button disabled={cancelling} onClick={() => setCancelTarget(null)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">Cancel</button>
              <button disabled={cancelling} onClick={submitCancel}
                className="flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70">
                {cancelling && <Spinner className="h-3.5 w-3.5" />}
                {cancelling ? 'Working...' : 'Confirm cancel & refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}