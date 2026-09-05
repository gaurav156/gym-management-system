import { FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import Spinner from '../components/Spinner'
import type { OtpChannel } from '../types'

export default function ResetPasswordPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const navState = location.state as { identifier?: string; channel?: OtpChannel } | null

  const [identifier, setIdentifier] = useState(navState?.identifier ?? '')
  const [channel] = useState<OtpChannel>(navState?.channel ?? 'EMAIL')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [resetting, setResetting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (resetting) return
    setError(''); setMessage('')
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setResetting(true)
    try {
      const { data } = await api.post('/api/auth/password-reset/confirm', {
        identifier, channel, otp, newPassword,
      })
      setMessage(data.message)
      setTimeout(() => navigate('/login'), 1500)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password')
      setResetting(false)
    }
    // Deliberately not resetting `resetting` in a finally block on the success path -
    // the button should stay in its loading/disabled state through the short delay
    // before navigate() fires, rather than flickering back to enabled right before
    // the redirect.
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">Enter your code</h1>
      <p className="mt-1 text-sm text-gray-600">
        Check your {channel === 'EMAIL' ? 'email' : 'phone'} for the 6-digit code.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {channel === 'EMAIL' ? 'Email address' : 'Phone number'}
          </label>
          <input required disabled={resetting} type={channel === 'EMAIL' ? 'email' : 'tel'} value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none disabled:bg-gray-50" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">6-digit code</label>
          <input required disabled={resetting} maxLength={6} value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 tracking-widest focus:border-brand focus:outline-none disabled:bg-gray-50" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">New password</label>
          <input required disabled={resetting} type="password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none disabled:bg-gray-50" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Confirm new password</label>
          <input required disabled={resetting} type="password" minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none disabled:bg-gray-50" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}

        <button type="submit" disabled={resetting}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70">
          {resetting && <Spinner />}
          {resetting ? 'Resetting password...' : 'Reset password'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Didn't get a code? <Link to="/forgot-password" className="text-brand hover:underline">Send again</Link>
      </p>
    </div>
  )
}