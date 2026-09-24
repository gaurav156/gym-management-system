import { FormEvent, useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import ConfirmDialog from '../ConfirmDialog'
import { useConfirm } from '../../hooks/useConfirm'
import Spinner from '../Spinner'
import { TableSkeleton } from '../Skeleton'
import type { Product, ProductOrder, MemberSummary, PageResponse } from '../../types'

const PAGE_SIZE = 10
const MEMBER_SEARCH_SIZE = 20
const PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'CHEQUE', 'BANK_TRANSFER']

interface CartLine { product: Product; quantity: number }

interface Props {
  selectedBranch: string
}

// Front-desk purchase flow: pick a member, add products to a cart, optionally apply a
// coupon, pick a payment mode, and record the sale - mirrors PaymentsTab's
// member-search-dropdown + purchase-form pattern, extended for a multi-item cart.
export default function StoreTab({ selectedBranch }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])

  const [members, setMembers] = useState<MemberSummary[]>([])
  const [selectedMember, setSelectedMember] = useState<MemberSummary | null>(null)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false)
  const memberDropdownRef = useRef<HTMLDivElement>(null)

  const [mode, setMode] = useState('CASH')
  const [couponCode, setCouponCode] = useState('')
  const [couponStatus, setCouponStatus] = useState<{ valid: boolean; message: string } | null>(null)
  const [checkingCoupon, setCheckingCoupon] = useState(false)

  const [purchaseMessage, setPurchaseMessage] = useState('')
  const [purchasing, setPurchasing] = useState(false)

  const [orders, setOrders] = useState<ProductOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [orderPage, setOrderPage] = useState(0)
  const [orderTotalPages, setOrderTotalPages] = useState(1)
  const [orderTotalElements, setOrderTotalElements] = useState(0)

  const [cancelTarget, setCancelTarget] = useState<ProductOrder | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundMode, setRefundMode] = useState('CASH')
  const [refundNote, setRefundNote] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  const { confirm, dialogProps } = useConfirm()

  function loadProducts(search = productSearch) {
    api.get<PageResponse<Product>>('/api/products', { params: { search: search || undefined, size: 50 } })
      .then((res) => setProducts(res.data.content))
  }

  function loadMemberOptions(search: string) {
    if (!selectedBranch) return
    api.get<PageResponse<MemberSummary>>('/api/members', {
      params: { branchId: selectedBranch, search: search || undefined, page: 0, size: MEMBER_SEARCH_SIZE },
    }).then((res) => setMembers(res.data.content))
  }

  function loadOrders(page = 0) {
    if (!selectedBranch) return
    setOrdersLoading(true)
    api.get<PageResponse<ProductOrder>>(`/api/product-orders/branch/${selectedBranch}`, { params: { page, size: PAGE_SIZE } })
      .then((res) => {
        setOrders(res.data.content)
        setOrderTotalPages(res.data.totalPages)
        setOrderTotalElements(res.data.totalElements)
        setOrderPage(res.data.page)
      }).finally(() => setOrdersLoading(false))
  }

  useEffect(() => { loadProducts() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handle = setTimeout(() => loadProducts(productSearch), 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSearch])

  useEffect(() => {
    if (!selectedBranch) return
    loadMemberOptions('')
    loadOrders(0)
  }, [selectedBranch]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!memberDropdownOpen) return
    const handle = setTimeout(() => loadMemberOptions(memberSearchQuery), 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberSearchQuery, memberDropdownOpen])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(e.target as Node)) {
        setMemberDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function addToCart(product: Product) {
    setCart((lines) => {
      const existing = lines.find((l) => l.product.id === product.id)
      if (existing) {
        if (existing.quantity >= product.stockQuantity) return lines
        return lines.map((l) => l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l)
      }
      return [...lines, { product, quantity: 1 }]
    })
  }

  function updateQuantity(productId: string, quantity: number) {
    setCart((lines) => lines
      .map((l) => l.product.id === productId ? { ...l, quantity: Math.max(1, Math.min(quantity, l.product.stockQuantity)) } : l)
      .filter((l) => l.quantity > 0))
  }

  function removeFromCart(productId: string) {
    setCart((lines) => lines.filter((l) => l.product.id !== productId))
  }

  const subtotal = cart.reduce((sum, l) => sum + l.product.effectivePrice * l.quantity, 0)

  async function checkCoupon() {
    setCouponStatus(null)
    if (!couponCode.trim() || !selectedMember) return
    setCheckingCoupon(true)
    try {
      const { data } = await api.post<{ valid: boolean; message: string }>('/api/coupons/validate', {
        code: couponCode.trim(), memberId: selectedMember.id,
      })
      setCouponStatus(data)
    } catch (err: any) {
      setCouponStatus({ valid: false, message: err.response?.data?.error || 'Failed to check coupon' })
    } finally {
      setCheckingCoupon(false)
    }
  }

  function resetCart() {
    setCart([]); setSelectedMember(null); setCouponCode(''); setCouponStatus(null); setMode('CASH')
  }

  async function recordPurchase(e: FormEvent) {
    e.preventDefault()
    setPurchaseMessage('')
    if (!selectedMember) { setPurchaseMessage('Select a member.'); return }
    if (cart.length === 0) { setPurchaseMessage('Add at least one product to the cart.'); return }
    if (!selectedBranch) { setPurchaseMessage('No branch selected.'); return }

    setPurchasing(true)
    try {
      const { data } = await api.post<ProductOrder>(
        '/api/product-orders/purchase',
        {
          branchId: selectedBranch,
          mode,
          couponCode: couponStatus?.valid ? couponCode.trim() : null,
          items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        },
        { params: { memberId: selectedMember.id } }
      )
      setPurchaseMessage(`Recorded - invoice ${data.invoiceNumber}, total ₹${data.totalAmount}.`)
      resetCart()
      loadProducts()
      loadOrders(0)
    } catch (err: any) {
      setPurchaseMessage(err.response?.data?.error || 'Failed to record purchase')
    } finally {
      setPurchasing(false)
    }
  }

  function openCancelDialog(order: ProductOrder) {
    setCancelTarget(order)
    setRefundAmount(String(order.totalAmount))
    setRefundMode('CASH')
    setRefundNote('')
    setCancelError('')
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
      loadOrders(orderPage)
      loadProducts()
    } catch (err: any) {
      setCancelError(err.response?.data?.error || 'Failed to cancel order')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div>
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="rounded-lg border border-gray-200 p-6 lg:col-span-3">
          <h2 className="font-medium">Products</h2>
          <input placeholder="Search products..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
            className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {products.map((p) => (
              <button key={p.id} type="button" disabled={p.outOfStock} onClick={() => addToCart(p)}
                className="flex items-center gap-3 rounded-md border border-gray-200 p-3 text-left disabled:cursor-not-allowed disabled:opacity-50 hover:border-brand">
                {p.imageUrls[0] && <img src={p.imageUrls[0]} alt="" className="h-12 w-12 flex-shrink-0 rounded object-cover" />}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    {p.discountActive ? (
                      <><span className="line-through">₹{p.price}</span> <span className="text-green-700">₹{p.discountPrice}</span></>
                    ) : `₹${p.price}`}
                  </p>
                  <p className="text-xs text-gray-400">{p.outOfStock ? 'Out of stock' : `${p.stockQuantity} in stock`}</p>
                </div>
              </button>
            ))}
            {products.length === 0 && <p className="text-sm text-gray-400">No products found.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 p-6 lg:col-span-2">
          <h2 className="font-medium">Cart &amp; checkout</h2>

          <div className="relative mt-3" ref={memberDropdownRef}>
            <input
              type="text"
              required={!selectedMember}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search member by name or email..."
              value={memberDropdownOpen ? memberSearchQuery : selectedMember?.name ?? ''}
              onFocus={() => { setMemberDropdownOpen(true); setMemberSearchQuery(''); loadMemberOptions('') }}
              onChange={(e) => setMemberSearchQuery(e.target.value)}
            />
            {memberDropdownOpen && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-gray-300 bg-white shadow-lg">
                {members.map((m) => (
                  <button key={m.id} type="button"
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 ${m.id === selectedMember?.id ? 'bg-blue-100 font-medium' : ''}`}
                    onClick={() => { setSelectedMember(m); setMemberDropdownOpen(false); setMemberSearchQuery(''); setCouponStatus(null) }}>
                    <div>{m.name}</div>
                    <div className="text-xs text-gray-500">{m.email}</div>
                  </button>
                ))}
                {members.length === 0 && <div className="px-3 py-2 text-sm text-gray-500">No members found</div>}
              </div>
            )}
          </div>

          <ul className="mt-4 divide-y divide-gray-100 text-sm">
            {cart.map((l) => (
              <li key={l.product.id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <p className="truncate">{l.product.name}</p>
                  <p className="text-xs text-gray-500">₹{l.product.effectivePrice} each</p>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min={1} max={l.product.stockQuantity} value={l.quantity}
                    onChange={(e) => updateQuantity(l.product.id, Number(e.target.value))}
                    className="w-14 rounded-md border border-gray-300 px-2 py-1 text-xs" />
                  <button onClick={() => removeFromCart(l.product.id)} className="text-xs text-red-600 hover:underline">Remove</button>
                </div>
              </li>
            ))}
            {cart.length === 0 && <li className="py-2 text-gray-400">Cart is empty - click a product to add it.</li>}
          </ul>

          {cart.length > 0 && (
            <form onSubmit={recordPurchase} className="mt-4 space-y-3 border-t border-gray-100 pt-4">
              <div className="flex gap-2">
                <input placeholder="Coupon code" value={couponCode}
                  onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponStatus(null) }}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm uppercase" />
                <button type="button" disabled={checkingCoupon || !couponCode.trim() || !selectedMember} onClick={checkCoupon}
                  className="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
                  {checkingCoupon ? 'Checking...' : 'Apply'}
                </button>
              </div>
              {couponStatus && (
                <p className={`text-xs ${couponStatus.valid ? 'text-green-700' : 'text-red-600'}`}>{couponStatus.message}</p>
              )}

              <select required value={mode} onChange={(e) => setMode(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>

              <p className="text-right text-sm font-medium">Subtotal: ₹{subtotal.toFixed(2)}</p>

              <button disabled={purchasing}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70">
                {purchasing && <Spinner className="h-4 w-4" />}
                {purchasing ? 'Recording...' : 'Record purchase'}
              </button>
            </form>
          )}
          {purchaseMessage && <p className="mt-3 text-sm text-gray-700">{purchaseMessage}</p>}
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 p-6">
        <h2 className="font-medium">Product order history</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="pb-2 pr-4">Invoice</th>
                <th className="pb-2 pr-4">Member</th>
                <th className="pb-2 pr-4">Items</th>
                <th className="pb-2 pr-4">Total</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ordersLoading ? (
                <TableSkeleton rows={6} columns={6} />
              ) : orders.map((o) => (
                <tr key={o.id}>
                  <td className="py-2 pr-4 text-gray-500">{o.invoiceNumber}</td>
                  <td className="py-2 pr-4">{o.memberName}</td>
                  <td className="py-2 pr-4 text-xs text-gray-500">
                    {o.items.map((it) => `${it.productName} ×${it.quantity}`).join(', ')}
                  </td>
                  <td className="py-2 pr-4">
                    ₹{o.totalAmount}
                    {o.discountAmount > 0 && <span className="ml-1 text-xs text-green-700">(-₹{o.discountAmount})</span>}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={
                      o.status === 'CANCELLED' ? 'text-red-600'
                        : o.status === 'COMPLETED' ? 'text-green-700'
                        : 'text-blue-600'
                    }>
                      {o.status === 'CANCELLED' ? `Cancelled (refunded ₹${o.refundAmount})` : o.status}
                    </span>
                  </td>
                  <td className="py-2">
                    {o.status !== 'CANCELLED' && (
                      <button onClick={() => openCancelDialog(o)} className="text-xs text-red-600 hover:underline">
                        Cancel &amp; refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!ordersLoading && orders.length === 0 && <p className="py-4 text-sm text-gray-400">No product orders recorded yet.</p>}
          {orderTotalElements > 0 && (
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>Page {orderPage + 1} of {orderTotalPages} ({orderTotalElements} total)</span>
              <div className="space-x-2">
                <button disabled={orderPage === 0} onClick={() => loadOrders(orderPage - 1)}
                  className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
                <button disabled={orderPage + 1 >= orderTotalPages} onClick={() => loadOrders(orderPage + 1)}
                  className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {cancelTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
          onClick={() => !cancelling && setCancelTarget(null)}>
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900">Cancel order {cancelTarget.invoiceNumber}</h3>
            <p className="mt-2 text-sm text-gray-600">
              Stock will be restored for every item. Record the cash refund given to {cancelTarget.memberName}.
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

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}