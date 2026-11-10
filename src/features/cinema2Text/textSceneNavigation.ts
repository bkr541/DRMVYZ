import { create } from 'zustand'

export interface TextSceneEditSession {
  owner: symbol
  isDirty(): boolean
  save(): boolean
  discard(): void
}
interface TextSceneNavigationState {
  session: TextSceneEditSession | null
  pending: (() => void) | null
  error: string | null
  register(session: TextSceneEditSession): () => void
  cancel(): void
  discardAndProceed(): void
  saveAndProceed(): void
}

/** Transient navigation decisions only; drafts and account/library data stay with their owners. */
export const useTextSceneNavigation = create<TextSceneNavigationState>((set, get) => {
  const proceed = (action: () => void) => {
    const pending = get().pending
    action()
    // Clear the old guard before replaying navigation, which may itself use a guarded store action.
    set({ session: null, pending: null, error: null })
    pending?.()
  }
  return {
    session: null, pending: null, error: null,
    register(session) {
      set({ session, pending: null, error: null })
      return () => {
        if (get().session?.owner === session.owner) set({ session: null, pending: null, error: null })
      }
    },
    cancel() { set({ pending: null, error: null }) },
    discardAndProceed() {
      const session = get().session
      if (session) proceed(() => session.discard())
    },
    saveAndProceed() {
      const session = get().session
      if (!session) return
      try {
        if (session.save()) proceed(() => {})
      } catch (cause) {
        set({ error: cause instanceof Error ? cause.message : 'The text scene could not be saved.' })
      }
    },
  }
})

/** Returning true means navigation is waiting for the canonical unsaved-changes dialog. */
export function blockTextSceneNavigation(action: () => void): boolean {
  const state = useTextSceneNavigation.getState()
  if (state.pending) return true
  if (!state.session?.isDirty()) return false
  useTextSceneNavigation.setState({ pending: action, error: null })
  return true
}
export function requestTextSceneNavigation(action: () => void): void {
  if (!blockTextSceneNavigation(action)) action()
}
