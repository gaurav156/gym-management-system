import { FormEvent, useState } from 'react'
import { api } from '../api/client'
import Spinner from './Spinner'

// Shared by ProfilePage and StaffProfilePage - the change-password form and behavior are
// identical for every role, so this lives outside either page rather than being
// duplicated. Self-contained: manages its own fields/messages and resets itself on
// success, so the parent page doesn't need to know anything about its internal state.
export default function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expanded, setExpanded] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(''); setMessage('')

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.')
      return
    }

    setSubmitting(true)
    try {
      const { data } = await api.put('/api/profile/me/password', { currentPassword, newPassword })
      setMessage(data.message)
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-6 rounded-md border border-gray-200 p-4">
      <button type="button" onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between text-left text-sm font-medium text-gray-700">
        Change password
        <span className="text-xs text-gray-400">{expanded ? 'Hide' : 'Show'}</span>
      </button>

      {expanded && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500">Current password</label>
            <input type="password" required disabled={submitting} value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none disabled:bg-gray-50" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">New password</label>
            <input type="password" required minLength={6} disabled={submitting} value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none disabled:bg-gray-50" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Confirm new password</label>
            <input type="password" required minLength={6} disabled={submitting} value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none disabled:bg-gray-50" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-700">{message}</p>}

          <button type="submit" disabled={submitting}
            className="flex items-center justify-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-70">
            {submitting && <Spinner />}
            {submitting ? 'Changing...' : 'Change password'}
          </button>
        </form>
      )}
    </div>
  )
}