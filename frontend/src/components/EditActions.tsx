import Spinner from './Spinner'

interface Props {
  onSave: () => void
  onCancel: () => void
  saving?: boolean
  saveLabel?: string
  size?: 'sm' | 'md'
  className?: string
}

export default function EditActions({ onSave, onCancel, saving = false, saveLabel = 'Save', size = 'md', className = '' }: Props) {
  const sz = size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm'
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button type="button" onClick={onSave} disabled={saving}
        className={`inline-flex items-center justify-center gap-1.5 rounded-md bg-brand font-medium text-white shadow-sm hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70 ${sz}`}>
        {saving && <Spinner className="h-3.5 w-3.5" />}
        {saving ? 'Saving...' : saveLabel}
      </button>
      <button type="button" onClick={onCancel} disabled={saving}
        className={`rounded-md border border-gray-400 bg-white font-medium text-gray-700 shadow-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 ${sz}`}>
        Cancel
      </button>
    </div>
  )
}