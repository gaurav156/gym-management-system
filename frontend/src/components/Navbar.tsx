import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getDashboardPath } from '../utils/navigation'
import ConfirmDialog from './ConfirmDialog'
import { useConfirm } from '../hooks/useConfirm'

const GYM_NAME = import.meta.env.VITE_GYM_NAME || 'FitZone Gym'
const GYM_LOGO_URL = import.meta.env.VITE_GYM_LOGO_URL || '/logo.svg'

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-6 w-6">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-6 w-6">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  )
}

function LogOutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  )
}

function LogInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l-5-5 5-5M15 12H3" />
    </svg>
  )
}

export default function Navbar() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const { confirm, dialogProps } = useConfirm()

  // Tracks whether the page has been scrolled past the top, purely to swap in a subtle
  // shadow/translucent-blur treatment once content is passing underneath the docked bar -
  // a flat top border looks fine at scrollY=0 but reads as "stuck to the page" once
  // there's content sliding under it. Threshold of a few px (not 0) avoids the shadow
  // flickering on/off from the tiny overscroll bounce some browsers report.
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 4)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Locks background scroll while the mobile drawer is open, so the page underneath
  // can't be dragged around behind the overlay on touch devices.
  useEffect(() => {
    if (!menuOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [menuOpen])

  const dashboardPath = user ? getDashboardPath(user.role) : '/member'

  function closeMenu() {
    setMenuOpen(false)
  }

  function handleLogout() {
    confirm({
      title: 'Log out',
      message: 'Are you sure you want to log out?',
      confirmLabel: 'Log out',
      danger: true,
      onConfirm: () => {
        logout()
        closeMenu()
        navigate('/')
      },
    })
  }

  return (
    // IMPORTANT: the mobile drawer below is a SIBLING of <nav>, not a child of it.
    // <nav> uses backdrop-blur-md, and backdrop-filter (like transform) makes an
    // element the containing block for any position:fixed descendant - so a
    // `fixed inset-0` drawer nested inside a blurred <nav> gets sized against the
    // ~70px-tall nav bar instead of the viewport, which is what made it render
    // squashed/behind other content. Keeping it outside <nav> avoids that entirely.
    <>
      <nav
        className={`sticky top-0 z-50 border-b bg-white/90 backdrop-blur-md transition-shadow duration-200 ${
          scrolled ? 'border-gray-200 shadow-sm' : 'border-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex min-w-0 items-center gap-2 text-xl font-semibold text-brand">
            <img src={GYM_LOGO_URL} alt="" className="h-7 w-7 flex-shrink-0" />
            <span className="truncate">{GYM_NAME}</span>
          </Link>

          {/* Desktop nav - hidden on narrow screens to avoid overflow with a long gym name */}
          <div className="hidden flex-shrink-0 items-center gap-4 text-sm sm:flex">
            {user ? (
              <>
                <Link to={dashboardPath} className="text-gray-700 hover:text-brand">Dashboard</Link>
                {(user.role === 'MEMBER' || user.role === 'TRAINER' || user.role === 'OWNER' || user.role === 'MANAGER') && (
                  <Link to="/profile" className="text-gray-700 hover:text-brand">Profile</Link>
                )}
                <span className="text-gray-400">{user.name}</span>
                <button
                  onClick={handleLogout}
                  className="rounded-md bg-gray-100 px-3 py-1.5 text-gray-700 hover:bg-gray-200"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-700 hover:text-brand">Log in</Link>
                <Link to="/register" className="rounded-md bg-brand px-3 py-1.5 text-white hover:bg-brand-dark">
                  Join now
                </Link>
              </>
            )}
          </div>

          {/* Hamburger - only on narrow screens */}
          <button onClick={() => setMenuOpen(true)} aria-label="Open menu"
            className="flex-shrink-0 rounded-md p-1.5 text-gray-700 hover:bg-gray-100 sm:hidden">
            <MenuIcon />
          </button>
        </div>
      </nav>

      {/* Slide-in mobile menu - deliberately outside <nav>, see comment above */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] sm:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={closeMenu} />
          <div className="absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-white p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <img src={GYM_LOGO_URL} alt="" className="h-6 w-6 flex-shrink-0" />
                <span className="truncate font-semibold text-brand">{GYM_NAME}</span>
              </div>
              <button onClick={closeMenu} aria-label="Close menu" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100">
                <CloseIcon />
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-1 text-sm">
              {user ? (
                <>
                  <p className="mb-2 truncate px-2 text-xs text-gray-400">{user.name}</p>
                  <Link to={dashboardPath} onClick={closeMenu}
                    className="flex items-center gap-3 rounded-md px-2 py-2.5 text-gray-700 hover:bg-gray-100">
                    <DashboardIcon /> Dashboard
                  </Link>
                  {(user.role === 'MEMBER' || user.role === 'TRAINER' || user.role === 'OWNER' || user.role === 'MANAGER') && (
                    <Link to="/profile" onClick={closeMenu}
                      className="flex items-center gap-3 rounded-md px-2 py-2.5 text-gray-700 hover:bg-gray-100">
                      <UserIcon /> Profile
                    </Link>
                  )}
                  <button onClick={handleLogout}
                    className="mt-2 flex items-center gap-3 rounded-md px-2 py-2.5 text-left text-gray-700 hover:bg-gray-100">
                    <LogOutIcon /> Log out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={closeMenu}
                    className="flex items-center gap-3 rounded-md px-2 py-2.5 text-gray-700 hover:bg-gray-100">
                    <LogInIcon /> Log in
                  </Link>
                  <Link to="/register" onClick={closeMenu}
                    className="mt-2 rounded-md bg-brand px-3 py-2.5 text-center font-medium text-white hover:bg-brand-dark">
                    Join now
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog {...dialogProps} />
    </>
  )
}