import { Fragment, ReactNode } from 'react'

const INLINE_PATTERN = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|\[[^\]]+\]\([^)]+\))/g

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

// Groups consecutive "- " lines into one <ul>; everything else is a paragraph with
// inline formatting applied. Deliberately not full Markdown - just enough for an
// attractive product blurb without a library or raw-HTML injection risk.
export function renderRichText(text: string): ReactNode {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let bulletBuffer: string[] = []

  function flushBullets(key: string) {
    if (bulletBuffer.length === 0) return
    blocks.push(
      <ul key={key} className="list-disc space-y-0.5 pl-5">
        {bulletBuffer.map((item, i) => <li key={i}>{renderInline(item, `${key}-li-${i}`)}</li>)}
      </ul>
    )
    bulletBuffer = []
  }

  lines.forEach((line, i) => {
    const trimmed = line.trimStart()
    if (trimmed.startsWith('- ')) { bulletBuffer.push(trimmed.slice(2)); return }
    flushBullets(`bullets-${i}`)
    blocks.push(trimmed.length === 0
      ? <div key={`sp-${i}`} className="h-2" />
      : <p key={`p-${i}`}>{renderInline(line, `p-${i}`)}</p>)
  })
  flushBullets('bullets-end')

  return <div className="space-y-1">{blocks}</div>
}