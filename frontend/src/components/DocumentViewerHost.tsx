import { useEffect, useState } from 'react'
import { useViewerStore } from '../store/viewerStore'
import { useScrollLock } from '../hooks/useScrollLock'

// PDFs can't be previewed inside an iframe on phones/tablets, so they get buttons instead.
const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

export default function DocumentViewerHost() {
  const doc = useViewerStore((s) => s.doc)
  const close = useViewerStore((s) => s.close)
  const [url, setUrl] = useState<string | null>(null)

  useScrollLock(!!doc)

  // One object URL per opened document, revoked as soon as it's closed.
  useEffect(() => {
    if (!doc) { setUrl(null); return }
    const u = URL.createObjectURL(doc.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [doc])

  useEffect(() => {
    if (!doc) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [doc, close])

  if (!doc || !url) return null

  const isPdf = doc.blob.type === 'application/pdf'
  const linkClass = 'text-brand hover:underline'

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
      role="dialog" aria-modal="true" aria-label={doc.title}>
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <h3 className="min-w-0 truncate text-sm font-semibold text-gray-900">{doc.title}</h3>
          <div className="flex flex-shrink-0 items-center gap-3 text-xs">
            <a href={url} target="_blank" rel="noopener noreferrer" className={linkClass}>Open in new tab</a>
            {doc.filename && <a href={url} download={doc.filename} className={linkClass}>Download</a>}
            <button type="button" onClick={close} aria-label="Close" className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-gray-100">
          {!isPdf ? (
            <div className="flex items-center justify-center p-3">
              <img src={url} alt={doc.title} className="max-h-[75vh] max-w-full object-contain" />
            </div>
          ) : isMobile() ? (
            <div className="p-8 text-center text-sm text-gray-600">
              <p>PDFs can't be previewed inside the page on this device.</p>
              <div className="mt-4 flex justify-center gap-3">
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">Open PDF</a>
                {doc.filename && (
                  <a href={url} download={doc.filename}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Download</a>
                )}
              </div>
            </div>
          ) : (
            <iframe title={doc.title} src={url} className="h-[75vh] w-full border-0 bg-white" />
          )}
        </div>
      </div>
    </div>
  )
}