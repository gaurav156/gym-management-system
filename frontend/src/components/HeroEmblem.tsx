import { useEffect, useState } from 'react'

const INNER_SRC = import.meta.env.VITE_GYM_LOGO_INNER
const OUTER_SRC = import.meta.env.VITE_GYM_LOGO_OUTER

type Status = 'loading' | 'logo' | 'fallback'

// Resolves true only if the image actually loads as an image.
function canLoad(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = src
  })
}

// Decorative hero emblem. The outer ring (with the circular text) rotates slowly while the
// inner mark stays fixed. If EITHER file is missing it falls back to the original
// weight-plate rings, so the hero never shows a broken image or a half-built logo.
export default function HeroEmblem() {
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    let cancelled = false
    Promise.all([canLoad(OUTER_SRC), canLoad(INNER_SRC)]).then(([outerOk, innerOk]) => {
      if (!cancelled) setStatus(outerOk && innerOk ? 'logo' : 'fallback')
    })
    return () => { cancelled = true }
  }, [])

  // Nothing while checking (it's decorative), so there's no flash of the fallback first.
  if (status === 'loading') return null

  return (
    <div aria-hidden="true"
      className="pointer-events-none absolute -right-24 top-1/2 hidden -translate-y-1/2 sm:block">
      {status === 'logo' ? (
        <div className="relative h-[420px] w-[420px]">
          <img src={OUTER_SRC} alt="" className="animate-slow-spin h-full w-full" />
          {/* 65.5% of the outer size, centred - scales with the container */}
          <img src={INNER_SRC} alt=""
            className="absolute left-1/2 top-1/2 h-[65.5%] w-[65.5%] -translate-x-1/2 -translate-y-1/2" />
        </div>
      ) : (
        <>
          <div className="animate-slow-spin h-[420px] w-[420px] rounded-full border-[18px] border-white/[0.06]" />
          <div className="absolute inset-16 rounded-full border-[14px] border-brand/20" />
          <div className="absolute inset-32 rounded-full border-[10px] border-white/[0.08]" />
        </>
      )}
    </div>
  )
}