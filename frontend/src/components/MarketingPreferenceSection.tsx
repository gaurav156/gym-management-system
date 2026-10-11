import { useState } from 'react'
import { api } from '../api/client'
import { toast, getErrorMessage } from '../store/toastStore'

export default function MarketingPreferenceSection({ initial }: { initial: boolean }) {
  const [consent, setConsent] = useState(initial)
  const [saving, setSaving] = useState(false)

  async function toggle(next: boolean) {
    setSaving(true);
    try {
      await api.put('/api/profile/me/marketing-consent', { consent: next })
      setConsent(next)
      toast.success(next ? 'You will now receive offers and updates.' : 'You have unsubscribed from promotions.')
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to update preference'))
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
    </div>
  )
}