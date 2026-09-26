import { useRef } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  rows?: number
}

export default function DescriptionEditor({ value, onChange, rows = 4 }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Every formatting action goes through this: capture scrollTop before mutating the
  // value, then after React re-renders (next frame), restore the caret AND the scroll
  // position. Without the scrollTop restore, focus()/setSelectionRange() on a textarea
  // whose value just grew snaps the view to the bottom - the browser's default
  // scroll-into-view-on-focus fires against a DOM that hasn't painted the new text yet.
  function apply(next: string, caretStart: number, caretEnd: number) {
    const el = ref.current
    const scrollTop = el?.scrollTop ?? 0
    onChange(next)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus({ preventScroll: true })
      el.setSelectionRange(caretStart, caretEnd)
      el.scrollTop = scrollTop
    })
  }

  function wrap(marker: string, placeholder = 'text') {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart, end = el.selectionEnd
    const selected = value.slice(start, end) || placeholder
    const next = value.slice(0, start) + marker + selected + marker + value.slice(end)
    apply(next, start + marker.length, start + marker.length + selected.length)
  }

  function link() {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart, end = el.selectionEnd
    const selected = value.slice(start, end) || 'link text'
    const next = value.slice(0, start) + '[' + selected + '](https://)' + value.slice(end)
    apply(next, start + 1, start + 1 + selected.length)
  }

  function currentLineStart(pos: number) {
    return value.lastIndexOf('\n', pos - 1) + 1
  }

  function prefixLine(prefix: string) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const lineStart = currentLineStart(start)
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    apply(next, start + prefix.length, start + prefix.length)
  }

  function heading(level: 1 | 2) {
    prefixLine(level === 1 ? '# ' : '## ')
  }

  function bulletLine() {
    prefixLine('- ')
  }

  function orderedLine() {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const lineStart = currentLineStart(start)

    // Continue the sequence from the previous line's number, if it has one; otherwise
    // start at 1. This is just a convenience for the button - typing any number by hand
    // always renders exactly as typed (see richText.tsx), so nothing breaks if you edit
    // the digits afterward.
    let nextNumber = 1
    if (lineStart > 0) {
      const prevLineStart = value.lastIndexOf('\n', lineStart - 2) + 1
      const prevLine = value.slice(prevLineStart, lineStart - 1).trim()
      const m = /^(\d+)\.\s/.exec(prevLine)
      if (m) nextNumber = parseInt(m[1], 10) + 1
    }

    const prefix = `${nextNumber}. `
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    apply(next, start + prefix.length, start + prefix.length)
  }

  function tabIndent() {
    prefixLine('\t')
  }

  function insertHr() {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const before = value.slice(0, start)
    const needsNewline = before.length > 0 && !before.endsWith('\n')
    const insertion = (needsNewline ? '\n' : '') + '---\n'
    const next = value.slice(0, start) + insertion + value.slice(start)
    apply(next, start + insertion.length, start + insertion.length)
  }

  function justifyBlock() {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart, end = el.selectionEnd
    const selected = value.slice(start, end) || 'Justified paragraph text goes here.'
    const open = ':::justify\n'
    const next = value.slice(0, start) + open + selected + '\n:::' + value.slice(end)
    apply(next, start + open.length, start + open.length + selected.length)
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap gap-1">
        <button type="button" onClick={() => wrap('*')} title="Bold" className="rounded border border-gray-300 px-2 py-1 text-xs font-bold hover:bg-gray-50">B</button>
        <button type="button" onClick={() => wrap('_')} title="Italic" className="rounded border border-gray-300 px-2 py-1 text-xs italic hover:bg-gray-50">I</button>
        <button type="button" onClick={() => wrap('~')} title="Underline" className="rounded border border-gray-300 px-2 py-1 text-xs underline hover:bg-gray-50">U</button>
        <span className="mx-0.5 w-px bg-gray-200" />
        <button type="button" onClick={() => heading(1)} title="Heading" className="rounded border border-gray-300 px-2 py-1 text-xs font-semibold hover:bg-gray-50">H1</button>
        <button type="button" onClick={() => heading(2)} title="Subheading" className="rounded border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-50">H2</button>
        <span className="mx-0.5 w-px bg-gray-200" />
        <button type="button" onClick={bulletLine} title="Bullet list" className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">• List</button>
        <button type="button" onClick={orderedLine} title="Numbered list (bold applies to the text after the number, not the number itself)" className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">1. List</button>
        <button type="button" onClick={tabIndent} title="Indent" className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">⇥ Indent</button>
        <button type="button" onClick={justifyBlock} title="Justify paragraph" className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">Justify</button>
        <button type="button" onClick={insertHr} title="Horizontal line" className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">―</button>
        <button type="button" onClick={link} title="Link" className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">Link</button>
      </div>
      <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
        placeholder="Description - *bold*, _italic_, ~underline~, [text](https://...), # heading, ## subheading, '- ' bullets, '1. ' numbered, '---' line, tab to indent"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
    </div>
  )
}