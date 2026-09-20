import { FormEvent, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import Spinner from './Spinner'

const RESEND_COOLDOWN_SECONDS = 60

export interface RoleChangeOtpTarget {
  id: string
  name: string
  newRole: string
  // Only sent when demoting an Owner - where the demoted person should be assigned.
  branchIds?: string[]
}

interface Props {
  target: RoleChangeOtpTarget | null
  onClose: () => void
  onDone: () => void
}

function roleLabel(role: string): string {
  return role === 'OWNER' ? 'Owner' : role === 'MANAGER' ? 'Manager' : role === 'TRAINER' ? 'Trainer' : 'Member'
}

// Two-step confirmation for role changes that cross the Owner boundary. Promotion to Owner:
// the code is emailed to the acting Owner. Demotion of an Owner: it's emailed to the
// primary Owner address (OWNER_EMAIL). The backend picks the recipient from the target's
// current role and enforces the OTP - this is just the UI for it.
export default function RoleChangeOtpDialog({ target, onClose, onDone }: Props) {
  const [step, setStep] = useState<'INTRO' | 'OTP'>('INTRO')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopCooldown() {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
  }

  // Fresh state every time the dialog opens for someone.
  useEffect(() => {
    setStep('INTRO'); setOtp(''); setError(''); setMessage(''); setResendCooldown(0)
    stopCooldown()
  }, [target?.id, target?.newRole])

  useEffect(() => stopCooldown, [])

  function startCooldown() {
    setResendCooldown(RESEND_COOLDOWN_SECONDS)
    stopCooldown()
    cooldownTimerRef.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) { stopCooldown(); return 0 }
        return s - 1
      })
    }, 1000)
  }

  if (!target) return null

  const isPromotion = target.newRole === 'OWNER'
  const busy = sending || submitting

  async function sendCode() {
    if (!target || sending || resendCooldown > 0) return
    setError(''); setMessage(''); setSending(true)
    try {
      const { data } = await api.post<{ message: string }>(`/api/owner/users/${target.id}/role/request-otp`)
      setMessage(data.message)
      setOtp('')
      setStep('OTP')
      startCooldown()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send verification code')
    } finally {
      setSending(false)
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault()
    if (!target || submitting) return
    setError(''); setSubmitting(true)
    try {
      await api.put(`/api/owner/users/${target.id}/role`, {
        newRole: target.newRole, otp, branchIds: target.branchIds,
      })
      onDone()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change role')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      onClick={() => !busy && onClose()} role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-gray-900">
          {isPromotion ? `Make ${target.name} an Owner` : `Change ${target.name}'s role to ${roleLabel(target.newRole)}`}
        </h3>
        {isPromotion ? (
          <p className="mt-2 text-sm text-gray-600">
            Owners have full access to every branch, all accounts, and all payments. Confirm with a
            code we'll email to <em>you</em>.
          </p>
        ) : (
          <p className="mt-2 text-sm text-gray-600">
            This removes {target.name}'s Owner access. Confirm with a code we'll email to the
            <em> primary Owner's address</em> (the OWNER_EMAIL set on the server).
          </p>
        )}

        {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {step === 'INTRO' ? (
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" disabled={busy} onClick={onClose}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">
              Cancel
            </button>
            <button type="button" disabled={busy} onClick={sendCode}
              className="flex items-center gap-2 rounded-md bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-70">
              {sending && <Spinner className="h-3.5 w-3.5" />}
              {sending ? 'Sending...' : 'Send verification code'}
            </button>
          </div>
        ) : (
          <form onSubmit={confirm} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs text-gray-500">6-digit code</label>
              <input required disabled={submitting} maxLength={6} value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm tracking-widest focus:border-brand focus:outline-none disabled:bg-gray-50" />
            </div>
            <div className="flex items-center justify-between">
              <button type="button" disabled={sending || resendCooldown > 0} onClick={sendCode}
                className="text-xs text-brand hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline">
                {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
              </button>
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={onClose}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                  Cancel
                </button>
                <button type="submit" disabled={submitting || otp.length !== 6}
                  className="flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70">
                  {submitting && <Spinner className="h-3.5 w-3.5" />}
                  {submitting ? 'Working...' : isPromotion ? 'Make Owner' : 'Change role'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}