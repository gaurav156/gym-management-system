import type { Branch } from '../types'

export interface BranchMap { embedSrc: string; directionsUrl: string }

const EMBED_URL = /^https:\/\/www\.google\.[a-z.]+\/maps\/embed/i

// Short links (maps.app.goo.gl) can't be embedded or resolved in the browser, so for those the
// link is used for "Get directions" and the embed falls back to an address search. A long URL
// (coordinates or place name) or an embed URL gives a pin-accurate embedded map.
export function resolveBranchMap(branch: Branch | null, gymName: string): BranchMap {
  const query = branch ? `${gymName} ${branch.name}, ${branch.address ?? ''}` : gymName
  const enc = encodeURIComponent(query)
  const fallback: BranchMap = {
    embedSrc: `https://www.google.com/maps?q=${enc}&output=embed`,
    directionsUrl: `https://www.google.com/maps/search/?api=1&query=${enc}`,
  }
  const url = branch?.mapUrl?.trim()
  if (!url) return fallback

  if (EMBED_URL.test(url)) return { embedSrc: url, directionsUrl: fallback.directionsUrl }

  const embed = (q: string) => `https://www.google.com/maps?q=${q}&output=embed`
  let embedSrc = fallback.embedSrc

  const pin = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(url)
  const queryParam = /[?&](?:q|query)=([^&]+)/.exec(url)
  const center = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(url)
  const place = /\/maps\/place\/([^/@?]+)/.exec(url)

  if (pin) embedSrc = embed(`${pin[1]},${pin[2]}`)
  else if (queryParam) embedSrc = embed(queryParam[1])
  else if (center) embedSrc = embed(`${center[1]},${center[2]}`)
  else if (place) {
    try { embedSrc = embed(encodeURIComponent(decodeURIComponent(place[1].replace(/\+/g, ' ')))) } catch { /* keep fallback */ }
  }
  return { embedSrc, directionsUrl: url }
}