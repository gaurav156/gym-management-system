import { useEffect, useRef, useState } from 'react'

type Status = 'loading' | 'loaded' | 'error'

// Simple "broken image" glyph - shown when a URL is missing or fails to load, so a dead
// link reads as "no image available" rather than a blank box or a broken-image browser icon.
function ImagePlaceholderIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  )
}

interface Props {
  src?: string | null
  alt: string
  className?: string       // sizing/shape on the outer box, e.g. "h-12 w-12 rounded"
  imgClassName?: string    // defaults to object-contain; override for object-cover cases
  draggable?: boolean      // false by default - prevents ghost-drag fighting the swipe handler in the modal
}

function ProductImageInner({ src, alt, className = '', imgClassName = 'object-contain', draggable = false }: Props) {
  const [status, setStatus] = useState<Status>(src ? 'loading' : 'error')
  const imgRef = useRef<HTMLImageElement>(null)

  // Same cached-image fix as Avatar.tsx - a cached src can finish loading before React
  // attaches onLoad, which would otherwise leave the skeleton stuck showing forever.
  useEffect(() => {
    const img = imgRef.current
    if (img?.complete) setStatus(img.naturalWidth > 0 ? 'loaded' : 'error')
  }, [])

  return (
    <div className={`relative flex flex-shrink-0 items-center justify-center overflow-hidden bg-gray-50 ${className}`}>
      {status === 'loading' && <div className="absolute inset-0 animate-pulse bg-gray-100" />}
      {status === 'error' && (
        <div className="flex flex-col items-center gap-1 text-gray-300">
          <ImagePlaceholderIcon />
          <span className="text-[10px] text-gray-400">No image</span>
        </div>
      )}
      {src && status !== 'error' && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={draggable}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className={`max-h-full max-w-full transition-opacity duration-200 ${imgClassName} ${
            status === 'loaded' ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  )
}

// Keyed by src, same reasoning as Avatar - a changed URL remounts and restarts from "loading"
// instead of keeping a stale "error" from the previous image.
export default function ProductImage(props: Props) {
  return <ProductImageInner key={props.src ?? ''} {...props} />
}