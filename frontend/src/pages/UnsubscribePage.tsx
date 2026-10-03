import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import Spinner from '../components/Spinner'

interface Preference { email: string; subscribed: boolean }

// Landing page for the link at the bottom of every promotional email. Changes are only made on
// an explicit button click (a POST), so mail scanners that prefetch the link can't unsubscribe anyone.
export default function UnsubscribePage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [pref, setPref] = useState<Preference | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) { setError('This link is invalid.'); return }
    api.get<Preference>('/api/public/marketing/preference', { params: { token } })
      .then((res) => setPref(res.data))
      .catch((err) => setError(err.response?.data?.error || 'This link is invalid.'))
  }, [token])

  async function change(action: 'unsubscribe' | 'resubscribe') {
    setBusy(true); setError('')
    try {
      const { data } = await api.post<Preference>(`/api/public/marketing/${action}`, null, { params: { token } })
      setPref(data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong - please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Email preferences</h1>

      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {pref && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-600">Promotional emails for <span className="font-medium text-gray-900">{pref.email}</span></p>
          {pref.subscribed ? (
            <>
              <p className="mt-3 text-sm text-gray-500">
                You're currently receiving offers and updates. Important announcements about your gym (like timing changes) will still reach you.
              </p>
              <button onClick={() => change('unsubscribe')} disabled={busy}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-70">
                {busy && <Spinner />}
                Unsubscribe from promotions
              </button>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm font-medium text-green-700">You've been unsubscribed.</p>
              <p className="mt-1 text-sm text-gray-500">You won't receive promotional messages any more. Important announcements will still reach you.</p>
              <button onClick={() => change('resubscribe')} disabled={busy}
                className="mt-5 text-sm text-brand hover:underline disabled:opacity-70">
                Changed your mind? Resubscribe
              </button>
            </>
          )}
        </div>
      )}

      <p className="mt-6 text-xs text-gray-400">
        You can also change this any time from your <Link to="/profile" className="text-brand hover:underline">profile</Link>.
      </p>
    </div>
  )
}