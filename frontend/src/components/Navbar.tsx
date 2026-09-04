import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const GYM_NAME = import.meta.env.VITE_GYM_NAME || 'FitZone Gym'

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

  const dashboardPath =
    user?.role === 'OWNER' ? '/owner'
    : user?.role === 'MANAGER' ? '/manager'
    : user?.role === 'TRAINER' ? '/trainer'
    : '/member'

  function closeMenu() {
    setMenuOpen(false)
  }

  function handleLogout() {
    logout()
    closeMenu()
    navigate('/')
  }

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex min-w-0 items-center gap-2 text-xl font-semibold text-brand">
          <img src="/logo.svg" alt="" className="h-7 w-7 flex-shrink-0" />
          <span className="truncate">{GYM_NAME}</span>
        </Link>

        {/* Desktop nav - hidden on narrow screens to avoid overflow with a long gym name */}
        <div className="hidden flex-shrink-0 items-center gap-4 text-sm sm:flex">
          {user ? (
            <>
              <Link to={dashboardPath} className="text-gray-700 hover:text-brand">Dashboard</Link>
              {(user.role === 'MEMBER' || user.role === 'TRAINER') && (
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

      {/* Slide-in mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={closeMenu} />
          <div className="absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-white p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <img src="/logo.svg" alt="" className="h-6 w-6 flex-shrink-0" />
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
                  {(user.role === 'MEMBER' || user.role === 'TRAINER') && (
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
    </nav>
  )
}