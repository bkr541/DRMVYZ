import { useEffect } from 'react'
import { setReviewNotesScene } from './reviewNotesSceneStore'

/** Mounted by the visualizer (development only): tells the app-level review notes which preset is on stage. Renders nothing. */
export function ReviewNotesScene({ engine, presetId, presetName, getContext }: { engine: string; presetId: string | null; presetName: string; getContext: () => Record<string, unknown> }) {
  useEffect(() => {
    if (!presetId) { setReviewNotesScene(null); return }
    setReviewNotesScene({ engine, presetId, presetName, getContext })
    return () => setReviewNotesScene(null)
  }, [engine, presetId, presetName, getContext])
  return null
}
