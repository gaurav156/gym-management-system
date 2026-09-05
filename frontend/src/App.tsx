import { Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import OwnerDashboard from './pages/OwnerDashboard'
import ManagerDashboard from './pages/ManagerDashboard'
import MemberDashboard from './pages/MemberDashboard'
import TrainerDashboard from './pages/TrainerDashboard'
import ProfileRouter from './pages/ProfileRouter'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute allowedRoles={['OWNER']} />}>
          <Route path="/owner" element={<OwnerDashboard />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['OWNER', 'MANAGER']} />}>
          <Route path="/manager" element={<ManagerDashboard />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['MEMBER']} />}>
          <Route path="/member" element={<MemberDashboard />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['TRAINER']} />}>
          <Route path="/trainer" element={<TrainerDashboard />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['MEMBER', 'TRAINER', 'OWNER', 'MANAGER']} />}>
          <Route path="/profile" element={<ProfileRouter />} />
        </Route>
      </Routes>
    </div>
  )
}