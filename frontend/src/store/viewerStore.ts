import { create } from 'zustand'

export interface ViewerDoc {
  title: string
  blob?: Blob           // generated/authenticated documents (invoices, ID proofs)
  url?: string          // publicly hosted files (expense bills)
  filename?: string     // Download link; only offered for blobs
}

interface ViewerState {
  doc: ViewerDoc | null
  open: (doc: ViewerDoc) => void
  close: () => void
}

export const useViewerStore = create<ViewerState>((set) => ({
  doc: null,
  open: (doc) => set({ doc }),
  close: () => set({ doc: null }),
}))

// Usable anywhere (utils, components): openViewer({ ... })
export const openViewer = (doc: ViewerDoc) => useViewerStore.getState().open(doc)