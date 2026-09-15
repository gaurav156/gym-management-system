import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// React Router swaps route content in place without resetting scroll position - so
// navigating from partway down a long page (e.g. the landing page) to another route
// leaves the new page scrolled to that same offset instead of starting at the top.
// This renders nothing; it just watches the pathname and scrolls to top whenever it
// changes.
//
// Deliberately keyed on `pathname` only, not the full location (which also includes
// `hash`) - in-page anchor links like the footer's "#about" change the hash but not the
// pathname, and those should keep the browser's native scroll-to-section behavior
// rather than being yanked back to the top.
export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}