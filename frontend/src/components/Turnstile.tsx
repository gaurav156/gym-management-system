import { useEffect, useRef } from 'react'
import { isScrollLockActive } from '../hooks/useScrollLock'

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: {
        sitekey: string
        callback: (token: string) => void
        'expired-callback'?: () => void
        'error-callback'?: () => void
      }) => string
      remove: (widgetId: string) => void
    }
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

interface Props {
  onVerify: (token: string) => void
  onExpire?: () => void
}

// Renders a Cloudflare Turnstile widget. The api.js script (loaded in index.html) exposes
// window.turnstile globally - this component just wires a container div to it. Parent
// components should remount this (e.g. via a `key` prop) after a failed/expired
// verification, since a Turnstile token is single-use and the widget needs a fresh
// render to issue a new one.
export default function Turnstile({ onVerify, onExpire }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!containerRef.current || !window.turnstile) return

    // Remember the page's scroll styles so we can undo anything the challenge applies.
    const html = document.documentElement
    const body = document.body
    const saved = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTouchAction: body.style.touchAction,
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: onVerify,
      'expired-callback': onExpire,
    })

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
      }
      // Don't fight an app modal that legitimately locked scroll.
      if (!isScrollLockActive()) {
        html.style.overflow = saved.htmlOverflow
        body.style.overflow = saved.bodyOverflow
        body.style.position = saved.bodyPosition
        body.style.touchAction = saved.bodyTouchAction
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={containerRef} className="mt-2" />
}