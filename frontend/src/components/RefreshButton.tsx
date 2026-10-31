import { useEffect, useRef, useState } from 'react'

// animate-spin does one full turn per second, so 2000ms ends on whole turns instead of
// stopping mid-rotation. Raise or lower it in multiples of 1000.
const MIN_SPIN_MS = 2000

interface Props {
  onClick: () => void
  spinning: boolean          // real loading state from the query (isFetching)
  label?: string
  minSpinMs?: number
}

export default function RefreshButton({ onClick, spinning, label = 'Refresh', minSpinMs = MIN_SPIN_MS }: Props) {
  const [showSpin, setShowSpin] = useState(false)
  const startedAt = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearTimer() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
  }

  // Stop spinning once the minimum time since the animation started has passed.
  function scheduleStop() {
    clearTimer()
    const remaining = Math.max(0, minSpinMs - (Date.now() - startedAt.current))
    timer.current = setTimeout(() => { setShowSpin(false); timer.current = null }, remaining)
  }

  function start() {
    clearTimer()
    startedAt.current = Date.now()
    setShowSpin(true)
  }

  // Follows the real loading state: keeps spinning while loading, and once loading ends
  // keeps going until the minimum time is up.
  useEffect(() => {
    if (spinning) {
      clearTimer()
      if (!showSpin) { startedAt.current = Date.now(); setShowSpin(true) }
    } else if (showSpin) {
      scheduleStop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning])

  useEffect(() => clearTimer, [])

  function handleClick() {
    if (showSpin) return
    start()
    scheduleStop()   // covers clicks that trigger no request (data was still fresh)
    onClick()        // if a request starts, the effect above takes over and extends the spin
  }

  return (
    <button type="button" onClick={handleClick} disabled={showSpin} aria-label={label} title={label} aria-busy={showSpin}
      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
        className={`h-4 w-4 ${showSpin ? 'animate-spin' : ''}`}>
        <path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 3v6h-6" />
      </svg>
    </button>
  )
}