import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { OtpChannel } from '../types'

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('')
  const [channel, setChannel] = useState<OtpChannel>('EMAIL')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(''); setMessage('')
    try {
      const { data } = await api.post('/api/auth/password-reset/request-otp', { identifier, channel })
      setMessage(data.message)
      setSubmitted(true)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send code')
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <p className="mt-1 text-sm text-gray-600">We'll send a one-time code to verify it's you.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Send code via</label>
          <div className="mt-1 flex gap-2 text-sm">
            <button type="button" onClick={() => setChannel('EMAIL')}
              className={`rounded-md border px-3 py-1.5 ${channel === 'EMAIL' ? 'border-brand bg-brand/10 text-brand' : 'border-gray-300 text-gray-600'}`}>
              Email
            </button>
            <button type="button" disabled title="Coming soon"
              className="cursor-not-allowed rounded-md border border-gray-200 px-3 py-1.5 text-gray-400">
              SMS (soon)
            </button>
            <button type="button" disabled title="Coming soon"
              className="cursor-not-allowed rounded-md border border-gray-200 px-3 py-1.5 text-gray-400">
              WhatsApp (soon)
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {channel === 'EMAIL' ? 'Email address' : 'Phone number'}
          </label>
          <input required value={identifier} onChange={(e) => setIdentifier(e.target.value)}
            type={channel === 'EMAIL' ? 'email' : 'tel'}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}

        <button type="submit" className="w-full rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">
          Send code
        </button>
      </form>

      {submitted && (
        <button onClick={() => navigate('/reset-password', { state: { identifier, channel } })}
          className="mt-4 w-full rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
          I have my code →
        </button>
      )}

      <p className="mt-6 text-center text-sm text-gray-500">
        Remembered it? <Link to="/login" className="text-brand hover:underline">Log in</Link>
      </p>
    </div>
  )
}