import { useRef } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  rows?: number
}

export default function DescriptionEditor({ value, onChange, rows = 4 }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function wrap(marker: string, placeholder = 'text') {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart, end = el.selectionEnd
    const selected = value.slice(start, end) || placeholder
    const next = value.slice(0, start) + marker + selected + marker + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + marker.length, start + marker.length + selected.length) })
  }

  function link() {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart, end = el.selectionEnd
    const selected = value.slice(start, end) || 'link text'
    const next = value.slice(0, start) + '[' + selected + '](https://)' + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + 1, start + 1 + selected.length) })
  }

  function bulletLine() {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const next = value.slice(0, lineStart) + '- ' + value.slice(lineStart)
    onChange(next)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + 2, start + 2) })
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap gap-1">
        <button type="button" onClick={() => wrap('*')} className="rounded border border-gray-300 px-2 py-1 text-xs font-bold hover:bg-gray-50">B</button>
        <button type="button" onClick={() => wrap('_')} className="rounded border border-gray-300 px-2 py-1 text-xs italic hover:bg-gray-50">I</button>
        <button type="button" onClick={() => wrap('~')} className="rounded border border-gray-300 px-2 py-1 text-xs underline hover:bg-gray-50">U</button>
        <button type="button" onClick={bulletLine} className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">• List</button>
        <button type="button" onClick={link} className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">Link</button>
      </div>
      <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
        placeholder="Description - *bold*, _italic_, ~underline~, [text](https://...), lines starting with '- ' for bullets"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
    </div>
  )
}