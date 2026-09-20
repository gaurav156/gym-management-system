import { ChangeEvent } from 'react'
import { api } from '../api/client'

export type ImagePurpose = 'PHOTO' | 'SIGNATURE'

// Raw picked file limit - it gets downscaled before upload, so this can be generous
// (phone cameras easily produce 5-8MB originals). The server enforces 2MB on what arrives.
export const MAX_SOURCE_BYTES = 10_000_000

// Avatars don't need more than ~640px; signatures keep PNG so transparency survives.
const TARGETS: Record<ImagePurpose, { maxDim: number; type: 'image/jpeg' | 'image/png' }> = {
  PHOTO: { maxDim: 640, type: 'image/jpeg' },
  SIGNATURE: { maxDim: 600, type: 'image/png' },
}

async function downscale(file: File, purpose: ImagePurpose): Promise<Blob> {
  const { maxDim, type } = TARGETS[purpose]
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')!
    if (type === 'image/jpeg') {
      ctx.fillStyle = '#fff' // JPEG has no alpha - avoid black backgrounds from transparent PNGs
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85))
    return blob ?? file
  } catch {
    return file // unsupported for resizing - let the server decide
  }
}

// Uploads to the backend and resolves to the public URL to store in form state.
export async function uploadImage(file: File, purpose: ImagePurpose = 'PHOTO'): Promise<string> {
  const blob = await downscale(file, purpose)
  const form = new FormData()
  form.append('file', blob, purpose === 'PHOTO' ? 'photo.jpg' : 'signature.png')
  const { data } = await api.post<{ url: string }>('/api/files/images', form, { params: { purpose } })
  return data.url
}

// onError lets each caller report into whichever component's own message state it's
// operating in, rather than this shared helper guessing or reaching into unrelated state.
export async function handleEditPhotoChange(
  e: ChangeEvent<HTMLInputElement>,
  onLoaded: (url: string) => void,
  onError: (msg: string) => void,
  purpose: ImagePurpose = 'PHOTO'
) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  if (file.size > MAX_SOURCE_BYTES) {
    onError('Photo is too large - please use one under ~10MB.')
    return
  }
  try {
    onLoaded(await uploadImage(file, purpose))
  } catch (err: any) {
    onError(err.response?.data?.error || 'Failed to upload image')
  }
}