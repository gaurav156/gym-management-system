import { FormEvent, useEffect, useState } from 'react'
import { toast, getErrorMessage } from '../store/toastStore'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/authStore'
import Turnstile from '../components/Turnstile'
import type { AuthUser } from '../types'
import PasswordInput from '../components/PasswordInput'
import Spinner from '../components/Spinner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaKey, setCaptchaKey] = useState(0) // bump to force a fresh widget/token
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [submitting, setSubmitting] = useState(false)

  // Set by the api client's response interceptor. These are mutually exclusive: a
  // simply-expired token comes back as 401 ("session-expired"); a still-valid token
  // whose role no longer has access comes back as 403 ("access-changed") - see
  // api/client.ts and SecurityConfig for how the two are told apart.
  const reason = searchParams.get('reason')

  // Set by the api client's response interceptor (see api/client.ts). The param is removed
  // afterwards so a page refresh doesn't show the toast again.
  useEffect(() => {
    if (!reason) return
    if (reason === 'session-expired') {
      toast.info('Your session has expired - please log in again.', { title: 'Session expired' })
    } else if (reason === 'access-changed') {
      toast.warning('Your account access has changed - please log in again to continue.', { title: 'Access changed' })
    }
    setSearchParams({}, { replace: true })
  }, [reason, setSearchParams])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const { data } = await api.post<AuthUser>('/api/auth/login', {
        email, password, rememberMe, captchaToken: captchaRequired ? captchaToken : undefined,
      })
      setUser(data)
      const path = data.role === 'OWNER' ? '/owner'
        : data.role === 'MANAGER' ? '/manager'
        : data.role === 'TRAINER' ? '/trainer'
        : '/member'
      navigate(path)
      // Deliberately not re-enabling on success - the button stays in its loading state
      // until the redirect, same approach as ResetPasswordPage.
    } catch (err: any) {
      const needsCaptcha = err.response?.data?.captchaRequired
      toast.error(getErrorMessage(err, 'Login failed'))
      if (needsCaptcha) setCaptchaRequired(true)
      // A Turnstile token is single-use regardless of outcome - force a fresh widget for
      // the next attempt whenever one was in play for this submission.
      if (captchaRequired || needsCaptcha) {
        setCaptchaToken('')
        setCaptchaKey((k) => k + 1)
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email" disabled={submitting} required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <PasswordInput
            disabled={submitting} required value={password} onChange={(e) => setPassword(e.target.value)}
            wrapperClassName="mt-1"
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
          />
          <div className="mt-1 text-right">
            <Link to="/forgot-password" className="text-xs text-brand hover:underline">Forgot password?</Link>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
          Remember me for 30 days
        </label>

        {captchaRequired && (
          <Turnstile key={captchaKey} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken('')} />
        )}

        <button type="submit" disabled={submitting || (captchaRequired && !captchaToken)}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70">
          {submitting && <Spinner />}
          {submitting ? 'Logging in...' : 'Log in'}
        </button>
      </form>
    </div>
  )
}