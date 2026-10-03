import { useRef, useState } from 'react'
import PhotoUploadButton from '../PhotoUploadButton'
import { renderRichText } from '../../utils/richText'

type Align = 'left' | 'center' | 'right' | 'justify'
const ALIGN_OPEN = /^:::(left|center|right|justify)$/

interface Props {
  value: string
  onChange: (v: string) => void
  rows?: number
  // Live preview under the editor. Product descriptions use it; the broadcast Designer turns it
  // off because its preview is rendered by the server (the exact email).
  showPreview?: boolean
  // Broadcast Designer only:
  enableButtons?: boolean
  enableImages?: boolean
  accent?: string
  onError?: (msg: string) => void
}

function AlignIcon({ kind }: { kind: Align }) {
  const d = kind === 'left' ? 'M3 6h18M3 10h12M3 14h18M3 18h12'
    : kind === 'center' ? 'M3 6h18M6 10h12M3 14h18M6 18h12'
    : kind === 'right' ? 'M3 6h18M9 10h12M3 14h18M9 18h12'
    : 'M3 6h18M3 10h18M3 14h18M3 18h18'
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4">
      <path d={d} />
    </svg>
  )
}

// If the given line range sits inside an alignment block, returns that block's fence lines.
function enclosingAlign(lines: string[], a: number, b: number): { open: number; close: number } | null {
  for (let i = a - 1; i >= 0; i--) {
    const t = lines[i].trim()
    if (t === ':::') return null
    if (ALIGN_OPEN.test(t)) {
      for (let j = b + 1; j < lines.length; j++) {
        const u = lines[j].trim()
        if (u === ':::') return { open: i, close: j }
        if (ALIGN_OPEN.test(u)) return null
      }
      return null
    }
  }
  return null
}

const HEX = /^#[0-9a-fA-F]{6}$/

export default function DescriptionEditor({
  value, onChange, rows = 4, showPreview = true, enableButtons = false, enableImages = false, accent, onError,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const [btnOpen, setBtnOpen] = useState(false)
  const [btnLabel, setBtnLabel] = useState('')
  const [btnUrl, setBtnUrl] = useState('')
  const [btnBg, setBtnBg] = useState(accent && HEX.test(accent) ? accent : '#e11d48')
  const [btnText, setBtnText] = useState('#ffffff')
  const [btnError, setBtnError] = useState('')
  const [imageWidth, setImageWidth] = useState('')

  // Every formatting action goes through this: capture scrollTop before mutating the
  // value, then after React re-renders (next frame), restore the caret AND the scroll
  // position. Without the scrollTop restore, focus()/setSelectionRange() on a textarea
  // whose value just grew snaps the view to the bottom.
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

    // Continue the sequence from the previous line's number, if it has one; otherwise start at 1.
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

  // Aligns whole LINES (the current line, or every line the selection touches) by wrapping them
  // in a ":::kind ... :::" block. Works on text, headings, lists, images and buttons alike.
  // Clicking the same alignment again removes it; a different one changes it (never nests).
  function alignBlock(kind: Align) {
    const el = ref.current
    if (!el) return
    const s = el.selectionStart
    const e = el.selectionEnd
    const lines = value.split('\n')
    const lineOf = (pos: number) => value.slice(0, pos).split('\n').length - 1
    const a = lineOf(s)
    const b = lineOf(e > s && value[e - 1] === '\n' ? e - 1 : e)

    let delta = 0
    const enclosing = enclosingAlign(lines, a, b)
    if (enclosing) {
      const current = lines[enclosing.open].trim().slice(3)
      if (current === kind) {
        const removed = lines[enclosing.open].length + 1
        lines.splice(enclosing.close, 1)
        lines.splice(enclosing.open, 1)
        delta = -removed
      } else {
        const before = lines[enclosing.open].length
        lines[enclosing.open] = ':::' + kind
        delta = lines[enclosing.open].length - before
      }
    } else {
      lines.splice(b + 1, 0, ':::')
      lines.splice(a, 0, ':::' + kind)
      delta = (':::' + kind).length + 1
    }
    const next = lines.join('\n')
    apply(next, Math.max(0, s + delta), Math.max(0, e + delta))
  }

  // Puts `text` on its own line at the caret. Consecutive inserts land on consecutive lines, which
  // is what makes two @button lines sit side by side.
  function insertLine(text: string) {
    const el = ref.current
    const start = el ? el.selectionStart : value.length
    const end = el ? el.selectionEnd : value.length
    const before = value.slice(0, start)
    const after = value.slice(end)
    const lead = before.length > 0 && !before.endsWith('\n') ? '\n' : ''
    const insertion = lead + text + '\n'
    const caret = before.length + insertion.length
    apply(before + insertion + after, caret, caret)
  }

  function insertButton() {
    setBtnError('')
    const label = btnLabel.replace(/\|/g, '/').trim()
    const url = btnUrl.trim()
    if (!label) { setBtnError('Enter the button text.'); return }
    if (!/^(https?:\/\/|mailto:|tel:).+/i.test(url)) { setBtnError('The link must start with https://, mailto: or tel:'); return }
    insertLine(`@button ${label} | ${url} | ${btnBg} | ${btnText}`)
    setBtnLabel(''); setBtnUrl('')
  }

  function insertImage(url: string, filename: string) {
    const alt = filename.replace(/\.[^.]+$/, '').replace(/[\[\]()|]/g, ' ').trim()
    insertLine(`![${alt}${imageWidth ? `|${imageWidth}` : ''}](${url})`)
  }

  const tool = 'rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50'

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-1">
        <button type="button" onClick={() => wrap('*')} title="Bold" className={`${tool} font-bold`}>B</button>
        <button type="button" onClick={() => wrap('_')} title="Italic" className={`${tool} italic`}>I</button>
        <button type="button" onClick={() => wrap('~')} title="Underline" className={`${tool} underline`}>U</button>
        <span className="mx-0.5 w-px self-stretch bg-gray-200" />
        <button type="button" onClick={() => heading(1)} title="Heading" className={`${tool} font-semibold`}>H1</button>
        <button type="button" onClick={() => heading(2)} title="Subheading" className={`${tool} font-medium`}>H2</button>
        <span className="mx-0.5 w-px self-stretch bg-gray-200" />
        <button type="button" onClick={bulletLine} title="Bullet list" className={tool}>• List</button>
        <button type="button" onClick={orderedLine} title="Numbered list (bold applies to the text after the number, not the number itself)" className={tool}>1. List</button>
        <button type="button" onClick={tabIndent} title="Indent" className={tool}>⇥ Indent</button>
        <span className="mx-0.5 w-px self-stretch bg-gray-200" />
        {(['left', 'center', 'right', 'justify'] as Align[]).map((k) => (
          <button key={k} type="button" onClick={() => alignBlock(k)}
            title={`Align ${k} (applies to the current line, or every selected line - click again to remove)`}
            className={`${tool} flex items-center`}>
            <AlignIcon kind={k} />
          </button>
        ))}
        <span className="mx-0.5 w-px self-stretch bg-gray-200" />
        <button type="button" onClick={insertHr} title="Horizontal line" className={tool}>―</button>
        <button type="button" onClick={link} title="Link" className={tool}>Link</button>
        {enableButtons && (
          <button type="button" onClick={() => setBtnOpen((o) => !o)} title="Add a button"
            className={`${tool} ${btnOpen ? 'border-brand text-brand' : ''}`}>+ Button</button>
        )}
        {enableImages && (
          <>
            <select value={imageWidth} onChange={(e) => setImageWidth(e.target.value)} title="Width of the next image"
              className="rounded border border-gray-300 px-1 py-1 text-xs">
              <option value="">Full width</option>
              <option value="480">Large</option>
              <option value="320">Medium</option>
              <option value="200">Small</option>
            </select>
            <PhotoUploadButton purpose="BROADCAST_IMAGE" size="sm" label="Add image"
              onLoaded={insertImage} onError={(m) => onError?.(m)} />
          </>
        )}
      </div>

      {enableButtons && btnOpen && (
        <div className="mb-2 space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input placeholder="Button text" maxLength={60} value={btnLabel} onChange={(e) => setBtnLabel(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
            <input placeholder="Link https://..." maxLength={500} value={btnUrl} onChange={(e) => setBtnUrl(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
            <label className="flex items-center gap-1.5">Background
              <input type="color" value={btnBg} onChange={(e) => setBtnBg(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5" />
            </label>
            <label className="flex items-center gap-1.5">Text
              <input type="color" value={btnText} onChange={(e) => setBtnText(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5" />
            </label>
            <span style={{ backgroundColor: btnBg, color: btnText }} className="rounded-lg px-5 py-2 text-sm font-semibold">
              {btnLabel || 'Button'}
            </span>
            <button type="button" onClick={insertButton}
              className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-900">Insert button</button>
          </div>
          <p className="text-[11px] text-gray-400">
            Add several in a row to put them side by side - leave a blank line between two to stack them. Use the align
            buttons to left / centre / right them.
          </p>
          {btnError && <p className="text-xs text-red-600">{btnError}</p>}
        </div>
      )}

      <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
        placeholder="Description - *bold*, _italic_, ~underline~, [text](https://...), # heading, ## subheading, '- ' bullets, '1. ' numbered, '---' line, tab to indent, :::center ... ::: to align"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />

      {showPreview && (
        <div className="mt-1">
          <button type="button" onClick={() => setPreviewOpen((o) => !o)} className="text-xs text-brand hover:underline">
            {previewOpen ? 'Hide preview' : 'Show preview'}
          </button>
          {previewOpen && (
            <div className="mt-1 rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-600">
              {value.trim() ? renderRichText(value) : <p className="text-gray-400">Nothing to preview yet.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}