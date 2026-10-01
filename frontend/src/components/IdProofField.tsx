import { useState } from 'react'
import PhotoUploadButton from './PhotoUploadButton'
import { openIdProof } from '../utils/idProof'

interface Props {
  personId: string
  uploaded: boolean            // already stored on the server
  pendingKey: string | null    // uploaded just now, not saved yet
  canChange: boolean
  onUploaded: (key: string) => void
  onError: (msg: string) => void
  compact?: boolean
}

export default function IdProofField({ personId, uploaded, pendingKey, canChange, onUploaded, onError, compact }: Props) {
  const [opening, setOpening] = useState(false)

  async function view() {
    setOpening(true)
    try { await openIdProof(personId) } catch (err: any) { onError(err.message) } finally { setOpening(false) }
  }

  const status = pendingKey ? 'New file selected - save to submit' : uploaded ? 'Submitted' : 'Not submitted'

  return (
    <div>
      <label className={compact ? 'text-xs text-gray-500' : 'block text-sm font-medium text-gray-700'}>ID proof</label>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <span className={`text-sm ${uploaded || pendingKey ? 'text-gray-700' : 'text-gray-400'}`}>{status}</span>
        {uploaded && !pendingKey && (
          <button type="button" onClick={view} disabled={opening} className="text-xs text-brand hover:underline disabled:opacity-60">
            {opening ? 'Opening...' : 'View'}
          </button>
        )}
        {canChange && (
          <PhotoUploadButton onLoaded={onUploaded} onError={onError} size="sm" purpose="ID_PROOF"
            accept="image/*,application/pdf" label={uploaded || pendingKey ? 'Replace file' : 'Upload ID proof'} />
        )}
      </div>
    </div>
  )
}