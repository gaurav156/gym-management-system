import { ReactNode } from 'react'
import EditActions from './EditActions'
import { useScrollLock } from '../hooks/useScrollLock'

interface Props {
  title: string
  onClose: () => void
  onSave: () => void
  saving?: boolean
  wide?: boolean
  children: ReactNode
}

export default function EditModal({ title, onClose, onSave, saving = false, wide = false, children }: Props) {
  useScrollLock()
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-lg bg-white shadow-xl ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="min-w-0 break-words text-base font-semibold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close"
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 disabled:opacity-50">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        <div className="flex flex-shrink-0 justify-end border-t border-gray-200 bg-gray-50 px-5 py-3">
          <EditActions onSave={onSave} onCancel={onClose} saving={saving} />
        </div>
      </div>
    </div>
  )
}