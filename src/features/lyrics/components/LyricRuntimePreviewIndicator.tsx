import {
  selectIsRuntimeLyricPreviewActive,
  useLyricsStore,
} from '../../../stores/lyricsStore'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'

/**
 * Shown over the performance views while a lyric version is being previewed.
 * Makes it explicit that the audience-facing runtime is on a temporary
 * version, and ends the preview so the persisted Active version resumes.
 */
export function LyricRuntimePreviewIndicator() {
  const active = useLyricsStore(selectIsRuntimeLyricPreviewActive)
  const title = useLyricsStore(state => state.runtimeLyricPreview?.document.title ?? null)
  const endPreview = useLyricsStore(state => state.endRuntimeLyricPreview)
  if (!active) return null

  return (
    <div className="lmv-runtime-preview-indicator" role="status" aria-live="polite">
      <span className="lmv-runtime-preview-indicator__text">
        Previewing lyrics{title ? `: ${title}` : ''} <em>(not Active)</em>
      </span>
      <IconChipButton onClick={endPreview} title="Stop previewing and return to the Active lyric version">
        End Preview
      </IconChipButton>
    </div>
  )
}
