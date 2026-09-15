import { Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import PublicOnlyRoute from './components/PublicOnlyRoute'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import OwnerDashboard from './pages/OwnerDashboard'
import ManagerDashboard from './pages/ManagerDashboard'
import MemberDashboard from './pages/MemberDashboard'
import TrainerDashboard from './pages/TrainerDashboard'
import ProfileRouter from './pages/ProfileRouter'
import InvoiceViewPage from './pages/InvoiceViewPage'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Public regardless of auth state - linked from the landing page footer */}
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

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

        <Route element={<ProtectedRoute allowedRoles={['MEMBER', 'OWNER', 'MANAGER']} />}>
          <Route path="/invoice/:paymentId" element={<InvoiceViewPage />} />
        </Route>
      </Routes>
    </div>
  )
}