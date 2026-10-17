import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { isScrollLockActive } from '../hooks/useScrollLock'
import { useToastStore } from '../store/toastStore'

// Deliberately keyed on `pathname` only, not the full location (which also includes
// `hash`) - in-page anchor links like the footer's "#about" change the hash but not the
// pathname, and those should keep native scroll-to-section behavior.
export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)

    // A page change means no modal from the previous page can still be open. If nothing in
    // the app holds a scroll lock, clear any stray lock left on <html>/<body>.
    if (!isScrollLockActive()) {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
      document.body.style.position = ''
    }

    // Drop toasts left over from the previous page, but keep ones raised moments ago -
    // e.g. "Password updated" is shown right before navigating to /login.
    useToastStore.getState().clearStale(1500)
  }, [pathname])

  return null
}