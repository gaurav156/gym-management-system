import { api } from '../api/client'
import { openViewer } from '../store/viewerStore'

// ID proofs aren't publicly linkable, so the file is fetched with the auth header and opened
// from a blob URL. Throws an Error with a readable message on failure.
export async function openIdProof(userId: string) {
  try {
    const res = await api.get<Blob>(`/api/id-proofs/${userId}`, { responseType: 'blob' })
    openViewer({ title: 'ID proof', blob: res.data })   // no filename: no Download link for identity documents
  } catch (err: any) {
    let message = 'Failed to load ID proof'
    try {
      const body = JSON.parse(await (err.response.data as Blob).text())
      if (body.error) message = body.error
    } catch { /* keep the default message */ }
    throw new Error(message)
  }
}