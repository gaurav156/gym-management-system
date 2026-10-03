import { useState } from 'react'
import { api } from '../api/client'

export default function MarketingPreferenceSection({ initial }: { initial: boolean }) {
  const [consent, setConsent] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function toggle(next: boolean) {
    setSaving(true); setError('')
    try {
      await api.put('/api/profile/me/marketing-consent', { consent: next })
      setConsent(next)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update preference')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-6 rounded-md border border-gray-200 p-4">
      <label className="flex items-start gap-3 text-sm text-gray-700">
        <input type="checkbox" className="mt-0.5" checked={consent} disabled={saving} onChange={(e) => toggle(e.target.checked)} />
        <span>
          Send me offers, promotions and updates
          <span className="mt-0.5 block text-xs text-gray-500">
            Important announcements about your gym (timings, closures) are always sent. You can change this any time.
          </span>
        </span>
      </label>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}