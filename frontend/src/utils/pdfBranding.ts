import type jsPDF from 'jspdf'
import { branding, DEFAULT_LOGO } from './branding'

const FONT_FILE_URL = (import.meta.env.VITE_GYM_NAME_FONT_FILE_URL || '').trim()

export async function fetchAsDataUrl(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`Failed to fetch ${url}`)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function svgUrlToPngDataUrl(url: string, size = 240): Promise<string> {
  const res = await fetch(url)
  const svgBlob = new Blob([await res.text()], { type: 'image/svg+xml' })
  const svgUrl = URL.createObjectURL(svgBlob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = svgUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = size; canvas.height = size
    canvas.getContext('2d')!.drawImage(img, 0, 0, size, size)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

export function dataUrlFormat(dataUrl: string): 'PNG' | 'JPEG' {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
}

let logoCache: string | null | undefined

// Configured logo, or the bundled default - so invoices are never logo-less.
export async function getLogoDataUrl(): Promise<string | null> {
  if (logoCache !== undefined) return logoCache
  const url = branding.logoUrl || DEFAULT_LOGO
  try {
    logoCache = url.toLowerCase().split('?')[0].endsWith('.svg')
      ? await svgUrlToPngDataUrl(url)
      : await fetchAsDataUrl(url)
  } catch {
    logoCache = null // invoice still renders without a logo
  }
  return logoCache
}

let fontCache: string | null | undefined // base64 of the TTF; null = unavailable

async function getFontBase64(): Promise<string | null> {
  if (!FONT_FILE_URL) return null
  if (fontCache !== undefined) return fontCache
  try {
    const dataUrl = await fetchAsDataUrl(FONT_FILE_URL, { mode: 'cors' })
    fontCache = dataUrl.split(',')[1] ?? null
  } catch {
    fontCache = null
  }
  return fontCache
}

// Registers the gym's name font on THIS document (jsPDF fonts are per-instance) and returns
// what to pass to doc.setFont(). Falls back to Helvetica Bold if no TTF is configured/loadable.
export async function registerNameFont(doc: jsPDF): Promise<{ family: string; style: 'normal' | 'bold' }> {
  const base64 = await getFontBase64()
  if (!base64) return { family: 'helvetica', style: 'bold' }
  try {
    doc.addFileToVFS('GymNameFont.ttf', base64)
    doc.addFont('GymNameFont.ttf', 'GymNameFont', 'normal')
    return { family: 'GymNameFont', style: 'normal' } // single-weight display fonts: no fake bold
  } catch {
    return { family: 'helvetica', style: 'bold' }
  }
}