import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface RowAction {
  label: string
  icon: React.ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  )
}

const MENU_WIDTH = 176 // w-44
const MENU_MARGIN = 4  // gap between trigger and menu

// Renders the dropdown via a portal to document.body, positioned with `fixed`
// coordinates computed from the trigger button's own rect. This is deliberate: if the
// menu were laid out inline (even with position: absolute) inside a table cell that
// sits in an `overflow-x-auto` wrapper, the browser still counts it toward that
// wrapper's scrollable content box - which is what was inflating the table's
// scrollWidth/scrollHeight and shifting its size/scrollbar whenever a menu near the
// bottom opened. A portal sidesteps that entirely: the menu is a sibling of the table
// in the DOM, so it can never affect the table's own layout or scroll dimensions.
export default function RowActionsMenu({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; openUp: boolean } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Position (and flip up/down) once the menu is open and measurable. Runs before
  // paint so there's no visible jump from an initial wrong-side placement.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return

    function place() {
      const btnRect = buttonRef.current!.getBoundingClientRect()
      const menuHeight = menuRef.current?.offsetHeight ?? actions.length * 36 + 8
      const spaceBelow = window.innerHeight - btnRect.bottom
      const openUp = spaceBelow < menuHeight + MENU_MARGIN && btnRect.top > menuHeight + MENU_MARGIN

      const left = Math.min(
        Math.max(8, btnRect.right - MENU_WIDTH),
        window.innerWidth - MENU_WIDTH - 8
      )
      const top = openUp ? btnRect.top - menuHeight - MENU_MARGIN : btnRect.bottom + MENU_MARGIN

      setCoords({ top, left, openUp })
    }

    place()
    // Closing on scroll/resize (rather than re-tracking) keeps this simple and avoids
    // a stale menu floating away from its trigger while a table scrolls under it.
    function close() { setOpen(false) }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open, actions.length])

  useLayoutEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More options"
        aria-expanded={open}
        className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
      >
        <MoreIcon />
      </button>

      {open && coords && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: MENU_WIDTH }}
          className="z-50 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              disabled={a.disabled}
              onClick={() => { setOpen(false); a.onClick() }}
              role="menuitem"
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 ${
                a.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'
              }`}
            >
              <span className="flex-shrink-0">{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}