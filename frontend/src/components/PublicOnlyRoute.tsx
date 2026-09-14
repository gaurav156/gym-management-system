import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getDashboardPath } from '../utils/navigation'

// Inverse of ProtectedRoute - for pages that only make sense to a signed-out visitor
// (login, register). An already-authenticated person landing here (e.g. via a bookmark,
// back button, or typing the URL) gets bounced straight to their own dashboard instead
// of being shown a login form for an account they're already in.
export default function PublicOnlyRoute() {
  const user = useAuthStore((s) => s.user)

  if (user) return <Navigate to={getDashboardPath(user.role)} replace />

  return <Outlet />
}