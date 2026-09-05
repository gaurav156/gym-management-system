import { useAuthStore } from '../store/authStore'
import ProfilePage from './ProfilePage'
import StaffProfilePage from './StaffProfilePage'

export default function ProfileRouter() {
  const user = useAuthStore((s) => s.user)

  if (!user) return null // ProtectedRoute already guarantees a user by the time this renders

  return user.role === 'OWNER' || user.role === 'MANAGER'
    ? <StaffProfilePage />
    : <ProfilePage />
}