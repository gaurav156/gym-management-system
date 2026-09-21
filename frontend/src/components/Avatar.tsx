import { useEffect, useRef, useState } from 'react'

interface Props {
  src?: string | null
  name: string
  // Size + text size are passed in so one component serves the 24px table avatar through
  // the 96px profile avatar, e.g. className="h-6 w-6" textClassName="text-[10px]".
  className?: string
  textClassName?: string
}

type Status = 'loading' | 'loaded' | 'error'

function AvatarInner({ src, name, className = 'h-8 w-8', textClassName = 'text-sm' }: Props) {
  const [status, setStatus] = useState<Status>(src ? 'loading' : 'error')
  const imgRef = useRef<HTMLImageElement>(null)

  // A cached image can finish loading before React attaches onLoad, which would leave it
  // stuck invisible - so check the element's own state once after mount.
  useEffect(() => {
    const img = imgRef.current
    if (img?.complete) setStatus(img.naturalWidth > 0 ? 'loaded' : 'error')
  }, [])

  const initial = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'

  return (
    <span
      role="img"
      aria-label={name}
      className={`relative inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 font-medium text-gray-500 ${className} ${textClassName}`}
    >
      {/* Shown while loading and whenever the image is missing or broken. */}
      {status !== 'loaded' && <span aria-hidden="true">{initial}</span>}
      {src && status !== 'error' && (
        <img
          ref={imgRef}
          src={src}
          alt=""
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
            status === 'loaded' ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </span>
  )
}

// Keyed by src so a changed URL (e.g. a freshly uploaded photo) remounts the inner
// component and starts from the "loading" state again instead of keeping a stale "error".
export default function Avatar(props: Props) {
  return <AvatarInner key={props.src ?? ''} {...props} />
}