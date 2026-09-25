import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import ProductDetailModal from '../ProductDetailModal'
import ProductImage from '../ProductImage'
import { viewProductInvoice, printProductInvoice, downloadProductInvoice } from '../../utils/productInvoice'
import type { Product, ProductOrder, ProductCategory, Branch, ProductOrderInvoice, PageResponse } from '../../types'

const PRODUCT_PAGE_SIZE = 9
const SHOW_ALL_SIZE = 500
const ORDER_PAGE_SIZE = 5

export default function MemberStoreTab({ memberId }: { memberId: string }) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')

  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [categoryFilter, setCategoryFilter] = useState('')

  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productSearch, setProductSearch] = useState('')
  const [productPage, setProductPage] = useState(0)
  const [productTotalPages, setProductTotalPages] = useState(1)
  const [showAll, setShowAll] = useState(false)

  const [viewingProduct, setViewingProduct] = useState<Product | null>(null)
  const [cartMessage, setCartMessage] = useState('')

  const [orders, setOrders] = useState<ProductOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [orderPage, setOrderPage] = useState(0)
  const [orderTotalPages, setOrderTotalPages] = useState(1)
  const [orderTotalElements, setOrderTotalElements] = useState(0)
  const [invoiceError, setInvoiceError] = useState('')

  useEffect(() => {
    api.get<Branch[]>('/api/branches/mine', { params: { userId: memberId } }).then((res) => {
      setBranches(res.data)
      if (res.data.length > 0) setSelectedBranch(res.data[0].id)
    })
    api.get<ProductCategory[]>('/api/product-categories').then((res) => setCategories(res.data))
    loadOrders(0)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function loadProducts(page = 0, all = showAll) {
    if (!selectedBranch) return
    setProductsLoading(true)
    api.get<PageResponse<Product>>('/api/products', {
      params: {
        branchId: selectedBranch,
        search: productSearch || undefined,
        categoryId: categoryFilter || undefined,
        page: all ? 0 : page,
        size: all ? SHOW_ALL_SIZE : PRODUCT_PAGE_SIZE,
      },
    }).then((res) => {
      setProducts(res.data.content)
      setProductTotalPages(res.data.totalPages)
      setProductPage(res.data.page)
    }).finally(() => setProductsLoading(false))
  }

  useEffect(() => {
    if (!selectedBranch) return
    loadProducts(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch])

  useEffect(() => {
    if (!selectedBranch) return
    const handle = setTimeout(() => loadProducts(0), 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSearch, categoryFilter, showAll])

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

  function lowStockLabel(p: Product): string | null {
    if (p.outOfStock) return 'Out of stock'
    if (p.stockQuantity != null && p.stockQuantity < 5) return `Only ${p.stockQuantity} left`
    return null
  }

  async function handleInvoiceAction(orderId: string, action: 'view' | 'print' | 'download') {
    setInvoiceError('')
    try {
      const { data } = await api.get<ProductOrderInvoice>(`/api/product-orders/${orderId}/invoice`)
      if (action === 'view') await viewProductInvoice(data)
      else if (action === 'print') await printProductInvoice(data)
      else await downloadProductInvoice(data)
    } catch (err: any) {
      setInvoiceError(err.response?.data?.error || 'Failed to load invoice')
    }
  }

  return (
    <div>
      <div className="rounded-lg border border-gray-200 p-6">
        <h2 className="font-medium">Store</h2>
        <p className="mt-1 text-xs text-gray-500">Browse what's available for pickup at your selected branch, then purchase at the front desk.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {branches.length > 1 && (
            <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input placeholder="Search products..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
            className="min-w-[180px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <button onClick={() => setShowAll((v) => !v)}
            className={`rounded-md border px-3 py-2 text-sm ${showAll ? 'border-brand bg-brand/10 text-brand' : 'border-gray-300 text-gray-600'}`}>
            {showAll ? 'Show paginated' : 'Show all'}
          </button>
        </div>

        {branches.length === 0 && <p className="mt-2 text-xs text-gray-400">No branch assigned yet.</p>}
        {cartMessage && <p className="mt-3 text-sm text-gray-600">{cartMessage}</p>}

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
                  {stockNote && <p className={`mt-1 text-xs ${p.outOfStock ? 'text-red-600' : 'text-amber-600'}`}>{stockNote}</p>}
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setViewingProduct(p)}
                      className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                      View details
                    </button>
                    <button disabled={!!p.outOfStock}
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

        {!showAll && productTotalPages > 1 && (
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
        {invoiceError && <p className="mt-2 text-sm text-red-600">{invoiceError}</p>}
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
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-400">
                  <span>{o.branchName} · {new Date(o.createdAt).toLocaleDateString()} ·{' '}
                    <span className={o.status === 'CANCELLED' ? 'text-red-500' : ''}>{o.status}</span></span>
                  <button onClick={() => handleInvoiceAction(o.id, 'view')} className="text-brand hover:underline">View</button>
                  <button onClick={() => handleInvoiceAction(o.id, 'print')} className="text-brand hover:underline">Print</button>
                  <button onClick={() => handleInvoiceAction(o.id, 'download')} className="text-brand hover:underline">Download</button>
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

      {viewingProduct && <ProductDetailModal product={viewingProduct} onClose={() => setViewingProduct(null)} isStaffView={false} />}
    </div>
  )
}