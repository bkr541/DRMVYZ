import { NumberInputRow, TextInputRow } from '../../../components/vyzualz/react/ReactControlRows'

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
        <TextInputRow
          id="lyric-document-title"
          label="Title"
          placeholder="Song Title"
          maxLength={200}
          value={draftTitle}
          onChange={onUpdateTitle}
        />
        <TextInputRow
          id="lyric-document-artist"
          label="Artist"
          placeholder="Artist Name"
          maxLength={200}
          value={draftArtist}
          onChange={onUpdateArtist}
        />
        <NumberInputRow
          id="lyric-global-offset"
          label="Global offset (ms)"
          step={1}
          value={globalOffsetMs}
          onChange={value => onUpdateGlobalOffset(Math.round(value))}
          onEmpty={() => onUpdateGlobalOffset(0)}
        />
        <p className="lmv-inspector-hint">Applied at render time. Canonical cue and word timestamps remain integer milliseconds.</p>
      </div>
    </section>
  )
}
