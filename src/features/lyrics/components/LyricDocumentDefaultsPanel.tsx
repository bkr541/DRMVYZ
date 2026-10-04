import { DreamVizTextInput } from '../../../components/vyzualz/react/controls/DreamVizTextInput'

interface Props {
  draftTitle: string
  draftArtist: string
  globalOffsetMs: number
  onUpdateTitle: (value: string) => void
  onUpdateArtist: (value: string) => void
  onUpdateGlobalOffset: (value: number) => void
}

/** Document identity and timing fields, hosted in the Document tab of the right inspector. */
export function LyricDocumentDefaultsPanel({
  draftTitle,
  draftArtist,
  globalOffsetMs,
  onUpdateTitle,
  onUpdateArtist,
  onUpdateGlobalOffset,
}: Props) {
  return (
    <section className="lmv-document-info" aria-label="Document Info">
      <div className="lmv-inspector-grid">
        <label className="lmv-inspector-field" htmlFor="lyric-document-title">
          <span>Title</span>
          <DreamVizTextInput
            id="lyric-document-title"
            className="lmv-input"
            placeholder="Song Title"
            value={draftTitle}
            onChange={event => onUpdateTitle(event.target.value)}
          />
        </label>
        <label className="lmv-inspector-field" htmlFor="lyric-document-artist">
          <span>Artist</span>
          <DreamVizTextInput
            id="lyric-document-artist"
            className="lmv-input"
            placeholder="Artist Name"
            value={draftArtist}
            onChange={event => onUpdateArtist(event.target.value)}
          />
        </label>
        <label className="lmv-inspector-field" htmlFor="lyric-global-offset">
          <span>Global offset (ms)</span>
          <input
            id="lyric-global-offset"
            className="lmv-num"
            type="number"
            step={1}
            value={globalOffsetMs}
            onChange={event => onUpdateGlobalOffset(Number.isFinite(Number(event.target.value)) ? Math.round(Number(event.target.value)) : 0)}
          />
        </label>
        <p className="lmv-inspector-hint">Applied at render time. Canonical cue and word timestamps remain integer milliseconds.</p>
      </div>
    </section>
  )
}
