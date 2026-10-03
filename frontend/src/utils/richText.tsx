import { Fragment, ReactNode } from 'react'

const INLINE_PATTERN = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|\[[^\]]+\]\([^)]+\))/g

const ALIGN_OPEN = /^:::(left|center|right|justify)$/
// Full literal class names (not built dynamically) so Tailwind keeps them.
const ALIGN_CLASS: Record<string, string> = {
  left: 'text-left', center: 'text-center', right: 'text-right', justify: 'text-justify',
}

function isSafeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim())
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(INLINE_PATTERN)
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`
    if (!part) return null
    if (part.startsWith('*') && part.endsWith('*') && part.length > 1) return <strong key={key}>{part.slice(1, -1)}</strong>
    if (part.startsWith('_') && part.endsWith('_') && part.length > 1) return <em key={key}>{part.slice(1, -1)}</em>
    if (part.startsWith('~') && part.endsWith('~') && part.length > 1) return <span key={key} className="underline">{part.slice(1, -1)}</span>
    const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
    if (linkMatch) {
      const [, label, url] = linkMatch
      if (isSafeUrl(url)) {
        return <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="text-brand underline hover:no-underline">{label}</a>
      }
      return <Fragment key={key}>{label}</Fragment>
    }
    return <Fragment key={key}>{part}</Fragment>
  })
}

interface OrderedItem { number: string; content: string }

const ORDERED_PATTERN = /^(\d+)\.\s+(.*)$/

// Small block-level syntax, deliberately not full Markdown:
//   # Text / ## Text     -> heading / subheading
//   - Text               -> bullet list item
//   12. Text             -> numbered list item - the number is shown AS TYPED, never
//                           auto-renumbered by the browser
//   ---                  -> horizontal rule (must be the only thing on the line)
//   \tText                -> indented paragraph
//   :::left|center|right|justify ... :::
//                        -> alignment block; everything inside (headings, lists, text) is aligned
//
// Every accumulator below is a plain array/string/boolean that's never null - a nullable local
// captured across a forEach closure collapses to `never` in TS's control-flow analysis.
export function renderRichText(text: string): ReactNode {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []

  let bulletBuffer: string[] = []
  let orderedBuffer: OrderedItem[] = []
  let alignBuffer: string[] = []
  let alignKind = 'left'
  let inAlign = false

  function flushBullets(key: string) {
    if (bulletBuffer.length === 0) return
    blocks.push(
      <ul key={key} className="list-disc space-y-0.5 pl-5">
        {bulletBuffer.map((item, i) => <li key={i}>{renderInline(item, `${key}-li-${i}`)}</li>)}
      </ul>
    )
    bulletBuffer = []
  }

  function flushOrdered(key: string) {
    if (orderedBuffer.length === 0) return
    blocks.push(
      <div key={key} className="space-y-0.5">
        {orderedBuffer.map((item, i) => (
          <div key={i} className="flex gap-2">
            <span className="flex-shrink-0 tabular-nums text-gray-500">{item.number}.</span>
            <span>{renderInline(item.content, `${key}-li-${i}`)}</span>
          </div>
        ))}
      </div>
    )
    orderedBuffer = []
  }

  function flushAlign(key: string) {
    if (alignBuffer.length === 0) return
    blocks.push(
      <div key={key} className={ALIGN_CLASS[alignKind] ?? ''}>
        {renderRichText(alignBuffer.join('\n'))}
      </div>
    )
    alignBuffer = []
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim()

    if (inAlign) {
      if (trimmed === ':::') {
        flushAlign(`align-${i}`)
        inAlign = false
      } else {
        alignBuffer.push(line)
      }
      return
    }
    const alignMatch = ALIGN_OPEN.exec(trimmed)
    if (alignMatch) {
      flushBullets(`b-${i}`); flushOrdered(`o-${i}`)
      alignKind = alignMatch[1]
      inAlign = true
      return
    }

    if (trimmed === '---') {
      flushBullets(`b-${i}`); flushOrdered(`o-${i}`)
      blocks.push(<hr key={`hr-${i}`} className="my-2 border-gray-200" />)
      return
    }

    if (trimmed.startsWith('- ')) {
      flushOrdered(`o-${i}`)
      bulletBuffer.push(trimmed.slice(2))
      return
    }
    const orderedMatch = ORDERED_PATTERN.exec(trimmed)
    if (orderedMatch) {
      flushBullets(`b-${i}`)
      orderedBuffer.push({ number: orderedMatch[1], content: orderedMatch[2] })
      return
    }

    flushBullets(`b-${i}`); flushOrdered(`o-${i}`)

    if (trimmed.startsWith('## ')) {
      blocks.push(<h4 key={`h2-${i}`} className="text-sm font-semibold text-gray-800">{renderInline(trimmed.slice(3), `h2-${i}`)}</h4>)
      return
    }
    if (trimmed.startsWith('# ')) {
      blocks.push(<h3 key={`h1-${i}`} className="text-base font-semibold text-gray-900">{renderInline(trimmed.slice(2), `h1-${i}`)}</h3>)
      return
    }

    const indented = line.startsWith('\t')
    const content = indented ? line.slice(1) : line

    blocks.push(content.trim().length === 0
      ? <div key={`sp-${i}`} className="h-2" />
      : <p key={`p-${i}`} className={indented ? 'pl-6' : undefined}>{renderInline(content, `p-${i}`)}</p>)
  })

  flushBullets('bullets-end')
  flushOrdered('ordered-end')
  if (inAlign) flushAlign('align-end')

  return <div className="space-y-1">{blocks}</div>
}