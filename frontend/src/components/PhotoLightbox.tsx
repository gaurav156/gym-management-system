import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useScrollLock } from '../hooks/useScrollLock'

interface Props { src: string; name: string; onClose: () => void }

export default function PhotoLightbox({ src, name, onClose }: Props) {
  useScrollLock()

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
      role="dialog" aria-modal="true" aria-label={`${name}'s photo`}>
      <div className="flex max-h-full w-full max-w-3xl flex-col items-center">
        <div className="mb-3 flex w-full items-center justify-between gap-3 text-white">
          <span className="truncate font-medium">{name}</span>
          <div className="flex flex-shrink-0 items-center gap-4 text-sm">
            <a href={src} target="_blank" rel="noopener noreferrer" className="underline">Open original</a>
            <button type="button" onClick={onClose} aria-label="Close" className="text-xl leading-none hover:text-gray-300">✕</button>
          </div>
        </div>
        <img src={src} alt={name} className="max-h-[80vh] max-w-full rounded-lg bg-white object-contain shadow-xl" />
      </div>
    </div>,
    document.body
  )
}