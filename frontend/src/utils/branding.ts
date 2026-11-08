import { useEffect, useState } from 'react'

const env = import.meta.env
const clean = (v?: string) => (v ?? '').trim()

export const DEFAULT_LOGO = '/logo.svg'
const FALLBACK_FONT = 'ui-sans-serif, system-ui, sans-serif'

// Everything gym-specific comes from env vars; every value is optional.
export const branding = {
  logoUrl: clean(env.VITE_GYM_LOGO_URL),              // '' -> bundled default icon
  heroOuterUrl: clean(env.VITE_HERO_LOGO_OUTER_URL),  // both hero URLs needed, else plate rings
  heroInnerUrl: clean(env.VITE_HERO_LOGO_INNER_URL),
  nameFont: clean(env.VITE_GYM_NAME_FONT),            // e.g. Bevan
  nameFontUrl: clean(env.VITE_GYM_NAME_FONT_URL),     // Google Fonts CSS URL, or a .woff2/.ttf URL
}

// Call once at startup (main.tsx): exposes the name font as a CSS variable and loads it.
export function applyBranding() {
  const root = document.documentElement
  const family = branding.nameFont ? `'${branding.nameFont}', ${FALLBACK_FONT}` : FALLBACK_FONT
  root.style.setProperty('--gym-name-font', family)

  const url = branding.nameFontUrl
  if (!url || !branding.nameFont) return
  if (/fonts\.googleapis\.com|\.css(\?|$)/i.test(url)) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    document.head.appendChild(link)
  } else {
    // Direct font file (woff2/ttf/otf) from your bucket
    new FontFace(branding.nameFont, `url(${url})`).load()
      .then((f) => document.fonts.add(f))
      .catch(() => { /* falls back to the system font */ })
  }
}

function canLoad(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = src
  })
}

export type AssetStatus = 'none' | 'loading' | 'ok' | 'failed'

// 'none' = no URLs configured; 'ok' only if EVERY url loads as an image.
export function useAssetsStatus(urls: string[]): AssetStatus {
  const key = urls.join('|')
  const [status, setStatus] = useState<AssetStatus>(urls.length ? 'loading' : 'none')

  useEffect(() => {
    if (!urls.length) { setStatus('none'); return }
    let cancelled = false
    setStatus('loading')
    Promise.all(urls.map(canLoad)).then((r) => {
      if (!cancelled) setStatus(r.every(Boolean) ? 'ok' : 'failed')
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return status
}