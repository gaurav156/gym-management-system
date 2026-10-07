import { useEffect } from 'react'

let lockCount = 0
let previousOverflow = ''

// Locks background page scroll while `active` is true. Reference-counted so nested modals
// (e.g. a ConfirmDialog over a details modal) only release the lock when the LAST one closes.
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return
    if (lockCount === 0) {
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    lockCount++
    return () => {
      lockCount--
      if (lockCount === 0) document.body.style.overflow = previousOverflow
    }
  }, [active])
}