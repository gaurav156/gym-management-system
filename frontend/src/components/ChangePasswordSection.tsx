import { FormEvent, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import Spinner from './Spinner'
import { toast, getErrorMessage } from '../store/toastStore'
import PasswordInput from './PasswordInput'

const RESEND_COOLDOWN_SECONDS = 60

// Two-step flow now: (1) current + new password -> emails a 6-digit code to the
// account's own email; (2) that code -> actually changes the password. Splitting into
// two API calls (rather than one endpoint that emails-then-blocks) keeps this a plain
// request/response cycle the frontend can render as two simple steps, and matches how
// ForgotPasswordPage/ResetPasswordPage are already split.
export default function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')

  const [step, setStep] = useState<'FORM' | 'OTP'>('FORM')
  const [sendingOtp, setSendingOtp] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current) }
  }, [])

  function startCooldown() {
    setResendCooldown(RESEND_COOLDOWN_SECONDS)
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
    cooldownTimerRef.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  function resetAll() {
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setOtp('')
    setStep('FORM')
    setResendCooldown(0)
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
  }

  async function requestOtp(e: FormEvent) {
    e.preventDefault()
    if (sendingOtp) return

    if (newPassword !== confirmPassword) {
      toast.warning('New passwords do not match.')
      return
    }
    if (newPassword === currentPassword) {
      toast.warning('New password must be different from your current password.')
      return
    }

    setSendingOtp(true)
    try {
      const { data } = await api.post('/api/profile/me/password/request-otp', { currentPassword })
      toast.success(data.message)
      setStep('OTP')
      startCooldown()
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to send verification code'))
    } finally {
      setSendingOtp(false)
    }
  }

  async function resendOtp() {
    if (sendingOtp || resendCooldown > 0) return
    setSendingOtp(true)
    try {
      const { data } = await api.post('/api/profile/me/password/request-otp', { currentPassword })
      toast.success(data.message)
      setOtp('')
      startCooldown()
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to resend verification code'))
    } finally {
      setSendingOtp(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    try {
      const { data } = await api.put('/api/profile/me/password', { currentPassword, newPassword, otp })
      toast.success(data.message)
      resetAll()
      setExpanded(false)
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to change password'))
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

      {expanded && step === 'FORM' && (
        <form onSubmit={requestOtp} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500">Current password</label>
            <PasswordInput required disabled={sendingOtp} value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              wrapperClassName="mt-1"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none disabled:bg-gray-50" />  
          </div>
          <div>
            <label className="block text-xs text-gray-500">New password</label>
            <PasswordInput required minLength={6} disabled={sendingOtp} value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              wrapperClassName="mt-1"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none disabled:bg-gray-50" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Confirm new password</label>
            <PasswordInput required minLength={6} disabled={sendingOtp} value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              wrapperClassName="mt-1"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none disabled:bg-gray-50" />
          </div>

          <button type="submit" disabled={sendingOtp}
            className="flex items-center justify-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-70">
            {sendingOtp && <Spinner />}
            {sendingOtp ? 'Sending code...' : 'Send verification code'}
          </button>
        </form>
      )}

      {expanded && step === 'OTP' && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">

          <div>
            <label className="block text-xs text-gray-500">6-digit code</label>
            <input required disabled={submitting} maxLength={6} value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm tracking-widest focus:border-brand focus:outline-none disabled:bg-gray-50" />
          </div>

          <div className="flex items-center gap-4">
            <button type="submit" disabled={submitting}
              className="flex items-center justify-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-70">
              {submitting && <Spinner />}
              {submitting ? 'Changing...' : 'Change password'}
            </button>
            <button type="button" disabled={sendingOtp || resendCooldown > 0} onClick={resendOtp}
              className="text-xs text-brand hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline">
              {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
            </button>
            <button type="button" onClick={resetAll} className="text-xs text-gray-500 hover:underline">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}