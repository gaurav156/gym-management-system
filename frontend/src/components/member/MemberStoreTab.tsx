import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import ProductDetailModal from '../ProductDetailModal'
import ProductImage from '../ProductImage'
import type { Product, ProductOrder, PageResponse } from '../../types'

const PRODUCT_PAGE_SIZE = 9
const ORDER_PAGE_SIZE = 5

export default function MemberStoreTab({ memberId }: { memberId: string }) {
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productSearch, setProductSearch] = useState('')
  const [productPage, setProductPage] = useState(0)
  const [productTotalPages, setProductTotalPages] = useState(1)

  const [viewingProduct, setViewingProduct] = useState<Product | null>(null)
  const [cartMessage, setCartMessage] = useState('')

  const [orders, setOrders] = useState<ProductOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [orderPage, setOrderPage] = useState(0)
  const [orderTotalPages, setOrderTotalPages] = useState(1)
  const [orderTotalElements, setOrderTotalElements] = useState(0)

  function loadProducts(page = 0, search = productSearch) {
    setProductsLoading(true)
    api.get<PageResponse<Product>>('/api/products', {
      params: { search: search || undefined, page, size: PRODUCT_PAGE_SIZE },
    }).then((res) => {
      setProducts(res.data.content)
      setProductTotalPages(res.data.totalPages)
      setProductPage(res.data.page)
    }).finally(() => setProductsLoading(false))
  }

  function loadOrders(page = 0) {
    setOrdersLoading(true)
    api.get<PageResponse<ProductOrder>>('/api/product-orders/mine', { params: { memberId, page, size: ORDER_PAGE_SIZE } })
      .then((res) => {
        setOrders(res.data.content)
        setOrderTotalPages(res.data.totalPages)
        setOrderTotalElements(res.data.totalElements)
        setOrderPage(res.data.page)
      }).finally(() => setOrdersLoading(false))
  }

  useEffect(() => { loadProducts(0); loadOrders(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handle = setTimeout(() => loadProducts(0, productSearch), 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSearch])

  function lowStockLabel(p: Product): string | null {
    if (p.outOfStock) return 'Out of stock'
    return p.stockQuantity < 5 ? `Only ${p.stockQuantity} left` : null
  }

  return (
    <div>
      <div className="rounded-lg border border-gray-200 p-6">
        <h2 className="font-medium">Store</h2>
        <p className="mt-1 text-xs text-gray-500">
          Browse what's available, then purchase at the front desk of any branch.
        </p>

        <input placeholder="Search products..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
          className="mt-4 w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm" />

        {cartMessage && <p className="mt-3 text-sm text-gray-600">{cartMessage}</p>}

        {/* grid-cols-1 explicit, same fix as StoreTab - without a base column count the
            grid falls back to implicit auto-sizing, which is what stretched cards past
            the phone's viewport width instead of stacking one per row. */}
        {productsLoading ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-56 animate-pulse rounded-md bg-gray-200" />)}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {products.map((p) => {
              const stockNote = lowStockLabel(p)
              return (
                <div key={p.id} className="flex min-w-0 flex-col rounded-md border border-gray-200 p-4">
                  <ProductImage src={p.imageUrls[0]} alt={p.name} className="aspect-square w-full rounded" />
                  <p className="mt-2 truncate font-medium">{p.name}</p>
                  <p className="text-sm">
                    {p.discountActive ? (
                      <><span className="text-gray-400 line-through">₹{p.price}</span>{' '}
                        <span className="font-medium text-green-700">₹{p.discountPrice}</span></>
                    ) : `₹${p.price}`}
                  </p>
                  {stockNote && (
                    <p className={`mt-1 text-xs ${p.outOfStock ? 'text-red-600' : 'text-amber-600'}`}>{stockNote}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setViewingProduct(p)}
                      className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                      View details
                    </button>
                    <button
                      disabled={p.outOfStock}
                      onClick={() => setCartMessage('Online checkout is coming soon - for now, purchase this at the front desk of any branch.')}
                      className="flex-1 rounded-md bg-brand px-2 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50">
                      Add to cart
                    </button>
                  </div>
                </div>
              )
            })}
            {products.length === 0 && <p className="text-sm text-gray-400 sm:col-span-3">No products match your search.</p>}
          </div>
        )}

        {productTotalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
            <span>Page {productPage + 1} of {productTotalPages}</span>
            <div className="space-x-2">
              <button disabled={productPage === 0} onClick={() => loadProducts(productPage - 1)}
                className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Prev</button>
              <button disabled={productPage + 1 >= productTotalPages} onClick={() => loadProducts(productPage + 1)}
                className="rounded border border-gray-300 px-2 py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 p-6">
        <h2 className="font-medium">Your purchases</h2>
        {ordersLoading ? (
          <div className="mt-3 space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {orders.map((o) => (
              <li key={o.id} className="py-2">
                <div className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{o.items.map((it) => `${it.productName} ×${it.quantity}`).join(', ')}</span>
                  <span className="flex-shrink-0 text-gray-500">₹{o.totalAmount}</span>
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

      {viewingProduct && (
        <ProductDetailModal product={viewingProduct} onClose={() => setViewingProduct(null)} isStaffView={false} />
      )}
    </div>
  )
}