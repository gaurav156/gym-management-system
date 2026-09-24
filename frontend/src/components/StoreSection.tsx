import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Product, ProductOrder, PageResponse } from '../types'

const PAGE_SIZE = 6

// Read-only for the member today - no self-checkout, matching the spec's "Owner/Manager
// records the purchase manually on the front desk" scope. Shows what's available and pick-
// up branches, plus their own past orders, the same split MemberDashboard already uses
// for membership plans (browse) vs payment history (past activity).
export default function StoreSection({ memberId }: { memberId: string }) {
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(true)

  const [orders, setOrders] = useState<ProductOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [orderPage, setOrderPage] = useState(0)
  const [orderTotalPages, setOrderTotalPages] = useState(1)
  const [orderTotalElements, setOrderTotalElements] = useState(0)

  useEffect(() => {
    api.get<PageResponse<Product>>('/api/products', { params: { size: 12 } })
      .then((res) => setProducts(res.data.content))
      .finally(() => setProductsLoading(false))
  }, [])

  function loadOrders(page = 0) {
    setOrdersLoading(true)
    api.get<PageResponse<ProductOrder>>('/api/product-orders/mine', { params: { memberId, page, size: PAGE_SIZE } })
      .then((res) => {
        setOrders(res.data.content)
        setOrderTotalPages(res.data.totalPages)
        setOrderTotalElements(res.data.totalElements)
        setOrderPage(res.data.page)
      }).finally(() => setOrdersLoading(false))
  }

  useEffect(() => { loadOrders(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mt-8 rounded-lg border border-gray-200 p-6">
      <h2 className="font-medium">Store</h2>
      <p className="mt-1 text-xs text-gray-500">
        Available at the front desk - show this to staff at any branch to purchase.
      </p>

      {productsLoading ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-md bg-gray-200" />)}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="rounded-md border border-gray-200 p-4">
              {p.imageUrls[0] && <img src={p.imageUrls[0]} alt={p.name} className="h-24 w-full rounded object-cover" />}
              <p className="mt-2 font-medium">{p.name}</p>
              <p className="text-sm">
                {p.discountActive ? (
                  <><span className="text-gray-400 line-through">₹{p.price}</span>{' '}
                    <span className="font-medium text-green-700">₹{p.discountPrice}</span></>
                ) : `₹${p.price}`}
              </p>
              <p className="mt-1 text-xs text-gray-400">{p.outOfStock ? 'Out of stock' : `${p.stockQuantity} available`}</p>
            </div>
          ))}
          {products.length === 0 && <p className="text-sm text-gray-400">No products available right now.</p>}
        </div>
      )}

      <h3 className="mt-6 text-sm font-medium text-gray-700">Your purchases</h3>
      {ordersLoading ? (
        <div className="mt-3 space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100 text-sm">
          {orders.map((o) => (
            <li key={o.id} className="py-2">
              <div className="flex justify-between">
                <span>{o.items.map((it) => `${it.productName} ×${it.quantity}`).join(', ')}</span>
                <span className="text-gray-500">₹{o.totalAmount}</span>
              </div>
              <div className="mt-0.5 text-xs text-gray-400">
                {o.branchName} · {new Date(o.createdAt).toLocaleDateString()} ·{' '}
                <span className={o.status === 'CANCELLED' ? 'text-red-500' : ''}>{o.status}</span>
              </div>
            </li>
          ))}
          {orders.length === 0 && <li className="py-2 text-gray-400">No purchases yet.</li>}
        </ul>
      )}
      {!ordersLoading && orderTotalElements > 0 && (
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
  )
}