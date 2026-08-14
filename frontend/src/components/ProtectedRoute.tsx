import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import type { Role } from '../types'

interface Props {
  allowedRoles: Role[]
}

export default function ProtectedRoute({ allowedRoles }: Props) {
  const user = useAuthStore((s) => s.user)

  if (!user) return <Navigate to="/login" replace />
  if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />

  return <Outlet />
}
