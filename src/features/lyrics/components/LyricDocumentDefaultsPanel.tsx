import { DreamVizTextInput } from '../../../components/vyzualz/react/controls/DreamVizTextInput'

interface Props {
  draftTitle: string
  draftArtist: string
  globalOffsetMs: number
  onUpdateTitle: (value: string) => void
  onUpdateArtist: (value: string) => void
  onUpdateGlobalOffset: (value: number) => void
}

/** Document identity/timing fields that remain in the center workspace. */
export function LyricDocumentDefaultsPanel({
  draftTitle,
  draftArtist,
  globalOffsetMs,
  onUpdateTitle,
  onUpdateArtist,
  onUpdateGlobalOffset,
}: Props) {
  return (
    <section className="lmv-document-defaults-window" aria-label="Document Info">
      <div className="lmv-rail-title">
        <span>Document Info</span>
      </div>
      <div className="lmv-workflow-content lmv-workflow-content--timeline-editor">
        <div className="lmv-grid2">
          <div className="lmv-field">
            <label className="lmv-field-label" htmlFor="lyric-document-title">Title</label>
            <DreamVizTextInput
              id="lyric-document-title"
              className="lmv-input"
              placeholder="Song Title"
              value={draftTitle}
              onChange={event => onUpdateTitle(event.target.value)}
            />
          </div>
          <div className="lmv-field">
            <label className="lmv-field-label" htmlFor="lyric-document-artist">Artist</label>
            <DreamVizTextInput
              id="lyric-document-artist"
              className="lmv-input"
              placeholder="Artist Name"
              value={draftArtist}
              onChange={event => onUpdateArtist(event.target.value)}
            />
          </div>
        </div>
        <div className="lmv-field lmv-field--short">
          <label className="lmv-field-label" htmlFor="lyric-global-offset">Global offset (ms)</label>
          <input
            id="lyric-global-offset"
            className="lmv-num"
            type="number"
            step={1}
            value={globalOffsetMs}
            onChange={event => onUpdateGlobalOffset(Number.isFinite(Number(event.target.value)) ? Math.round(Number(event.target.value)) : 0)}
          />
          <span className="lmv-field-hint">Applied at render time. Canonical cue and word timestamps remain integer milliseconds.</span>
        </div>
      </div>
    </section>
  )
}
