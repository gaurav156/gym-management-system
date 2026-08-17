import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function Navbar() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const dashboardPath =
    user?.role === 'OWNER' ? '/owner'
    : user?.role === 'MANAGER' ? '/manager'
    : user?.role === 'TRAINER' ? '/profile'
    : '/member'

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/" className="text-xl font-semibold text-brand">FitZone Gym</Link>
        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <Link to={dashboardPath} className="text-gray-700 hover:text-brand">Dashboard</Link>
              {user.role === 'MEMBER' && (
                <Link to="/profile" className="text-gray-700 hover:text-brand">Profile</Link>
              )}
              <span className="text-gray-400">{user.name}</span>
              <button
                onClick={() => { logout(); navigate('/') }}
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
      </div>
    </nav>
  )
}