import { create } from 'zustand'

export interface ViewerDoc {
  title: string
  blob: Blob            // PDF or image; type decides how it's shown
  filename?: string     // when set, a Download link is offered
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