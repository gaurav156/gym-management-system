import { FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import Spinner from '../components/Spinner'
import Turnstile from '../components/Turnstile'
import type { AuthUser, Branch } from '../types'

const RESEND_COOLDOWN_SECONDS = 60

export default function RegisterPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [branchId, setBranchId] = useState('')
  const [otp, setOtp] = useState('')

  const [step, setStep] = useState<'FORM' | 'OTP'>('FORM')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sendingOtp, setSendingOtp] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaKey, setCaptchaKey] = useState(0)

  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    api.get<Branch[]>('/api/public/branches').then((res) => setBranches(res.data)).catch(() => {})
  }, [])

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

  function onAuthError(err: any) {
    const needsCaptcha = err.response?.data?.captchaRequired
    setError(err.response?.data?.error || 'Something went wrong')
    if (needsCaptcha) setCaptchaRequired(true)
    if (captchaRequired || needsCaptcha) {
      setCaptchaToken('')
      setCaptchaKey((k) => k + 1)
    }
  }

  async function requestOtp(e: FormEvent) {
    e.preventDefault()
    if (sendingOtp) return
    setError(''); setMessage(''); setSendingOtp(true)
    try {
      const { data } = await api.post('/api/auth/register/request-otp', {
        email, captchaToken: captchaRequired ? captchaToken : undefined,
      })
      setMessage(data.message)
      setStep('OTP')
      startCooldown()
    } catch (err: any) {
      onAuthError(err)
    } finally {
      setSendingOtp(false)
    }
  }

  async function resendOtp() {
    if (sendingOtp || resendCooldown > 0) return
    setError(''); setMessage(''); setSendingOtp(true)
    try {
      const { data } = await api.post('/api/auth/register/request-otp', {
        email, captchaToken: captchaRequired ? captchaToken : undefined,
      })
      setMessage(data.message)
      setOtp('')
      startCooldown()
    } catch (err: any) {
      onAuthError(err)
    } finally {
      setSendingOtp(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(''); setSubmitting(true)
    try {
      const { data } = await api.post<AuthUser>('/api/auth/register', {
        name, email, phone, password, branchId, otp,
        captchaToken: captchaRequired ? captchaToken : undefined,
      })
      setUser(data)
      navigate('/member')
    } catch (err: any) {
      onAuthError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">Become a member</h1>

      {step === 'FORM' && (
        <form onSubmit={requestOtp} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Full name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Preferred branch</label>
            <select required value={branchId} onChange={(e) => setBranchId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none">
              <option value="">Select a branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {captchaRequired && (
            <Turnstile key={captchaKey} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken('')} />
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={sendingOtp || (captchaRequired && !captchaToken)}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60">
            {sendingOtp && <Spinner />}
            {sendingOtp ? 'Sending code...' : 'Send verification code'}
          </button>
        </form>
      )}

      {step === 'OTP' && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {message && <p className="text-sm text-green-700">{message}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700">6-digit code</label>
            <input required disabled={submitting} maxLength={6} value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 tracking-widest focus:border-brand focus:outline-none disabled:bg-gray-50" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60">
            {submitting && <Spinner />}
            {submitting ? 'Creating account...' : 'Create account'}
          </button>

          <div className="flex items-center justify-between text-xs">
            <button type="button" disabled={sendingOtp || resendCooldown > 0} onClick={resendOtp}
              className="text-brand hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline">
              {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
            </button>
            <button type="button" onClick={() => { setStep('FORM'); setOtp(''); setError(''); setMessage('') }}
              className="text-gray-500 hover:underline">
              Edit details
            </button>
          </div>
        </form>
      )}
    </div>
  )
}