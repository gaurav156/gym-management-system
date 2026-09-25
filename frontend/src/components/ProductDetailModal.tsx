import { PointerEvent, useRef, useState } from 'react'
import ProductImage from './ProductImage'

interface Props {
  product: {
    name: string
    description: string | null
    price: number
    discountPrice: number | null
    discountActive: boolean
    stockQuantity: number
    outOfStock: boolean
    active: boolean
    imageUrls: string[]
  }
  onClose: () => void
  isStaffView: boolean
}

function ChevronIcon({ direction, className = 'h-5 w-5' }: { direction: 'left' | 'right'; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  )
}

const SWIPE_THRESHOLD_PX = 50

export default function ProductDetailModal({ product, onClose, isStaffView }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const images = product.imageUrls
  const dragStartX = useRef<number | null>(null)

  function go(delta: number) {
    if (images.length === 0) return
    setActiveIndex((i) => (i + delta + images.length) % images.length)
  }

  // Pointer Events cover mouse drag and touch swipe with one handler set. touch-pan-y on
  // the image box lets vertical scroll of the modal's middle section keep working while
  // horizontal drags are captured here instead of triggering the browser's own panning.
  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (images.length < 2) return
    dragStartX.current = e.clientX
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (dragStartX.current === null) return
    const delta = e.clientX - dragStartX.current
    dragStartX.current = null
    if (delta > SWIPE_THRESHOLD_PX) go(-1)
    else if (delta < -SWIPE_THRESHOLD_PX) go(1)
  }

  function stockLine(): string | null {
    if (product.outOfStock) return 'Out of stock'
    if (isStaffView) return `${product.stockQuantity} in stock`
    return product.stockQuantity < 5 ? `Only ${product.stockQuantity} left` : null
  }
  const stock = stockLine()

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose} role="dialog" aria-modal="true">
      {/* flex-col + max-h caps the whole dialog; header/footer are flex-shrink-0 (docked),
          only the middle section scrolls - fixes the "scrollbar looks off with a long
          description" issue by never letting the title or stock line move. */}
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold">{product.name}</h3>
            <p className="mt-0.5">
              {product.discountActive ? (
                <>
                  <span className="text-sm text-gray-400 line-through">₹{product.price}</span>{' '}
                  <span className="text-base font-semibold text-green-700">₹{product.discountPrice}</span>
                </>
              ) : (
                <span className="text-base font-semibold">₹{product.price}</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="flex-shrink-0 text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div
            className="relative flex aspect-square w-full touch-pan-y select-none items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          >
            <ProductImage src={images[activeIndex]} alt={product.name} className="h-full w-full" />

            {images.length > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Previous image"
                  className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow hover:bg-white">
                  <ChevronIcon direction="left" />
                </button>
                <button type="button" onClick={() => go(1)} aria-label="Next image"
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow hover:bg-white">
                  <ChevronIcon direction="right" />
                </button>
                <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {images.map((_, i) => (
                    <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === activeIndex ? 'bg-brand' : 'bg-white/70'}`} />
                  ))}
                </div>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {images.map((url, i) => (
                <button key={url} type="button" onClick={() => setActiveIndex(i)}
                  className={`h-14 w-14 flex-shrink-0 overflow-hidden rounded border-2 ${
                    i === activeIndex ? 'border-brand' : 'border-transparent'
                  }`}>
                  <ProductImage src={url} alt="" className="h-full w-full" />
                </button>
              ))}
            </div>
          )}

          {product.description && (
            <p className="mt-4 whitespace-pre-line text-sm text-gray-600">{product.description}</p>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center justify-between border-t border-gray-100 px-6 py-3 text-sm">
          {stock ? (
            <span className={product.outOfStock ? 'text-red-600' : 'text-amber-600'}>{stock}</span>
          ) : <span />}
          {isStaffView && !product.active && (
            <span className="text-xs text-gray-400">Inactive - hidden from the member catalog</span>
          )}
        </div>
      </div>
    </div>
  )
}