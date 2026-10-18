import { DreamVizTextInput } from './react/controls/DreamVizTextInput'
import { FONT_PREVIEW_SAMPLE, fontPreviewFamily, formatFontBytes, type FontQueueEntry } from './mediaUploadFonts'

/** The right-hand side of the media upload dialog while fonts are queued: details that belong to a font instead of the media fields. */
export function FontUploadFields({
  entry,
  previewText,
  previewReady,
  onNameChange,
  onPreviewTextChange,
  tagsAndCollections,
}: {
  entry: FontQueueEntry
  previewText: string
  previewReady: boolean
  onNameChange: (name: string) => void
  onPreviewTextChange: (text: string) => void
  /** The dialog's shared tags + collections fields, so fonts are filed exactly like media. */
  tagsAndCollections: React.ReactNode
}) {
  const details = entry.details
  const item = (label: string, value: string, span2 = false) => (
    <div className={span2 ? 'mum-addinfo-item mum-addinfo-item--span2' : 'mum-addinfo-item'}>
      <div className="mum-addinfo-label">{label}</div>
      <DreamVizTextInput className="mum-addinfo-input" value={value} readOnly aria-label={label} title={value} />
    </div>
  )
  return (
    <>
      <div className="mum-field">
        <label className="mum-field-label">TYPE</label>
        <div className="mum-audio-role-badge">Aa Font</div>
      </div>

      <div className="mum-field">
        <label className="mum-field-label" htmlFor="mum-font-name">FONT NAME<span className="mum-req">*</span></label>
        <DreamVizTextInput
          id="mum-font-name"
          className={`mum-input${entry.name.trim() ? '' : ' mum-input--error'}`}
          placeholder={details?.name ?? 'e.g. Headline Display'}
          maxLength={160}
          value={entry.name}
          onChange={event => onNameChange(event.target.value)}
        />
        {!entry.name.trim() && <div className="mum-field-error">A font name is required.</div>}
      </div>

      <div className="mum-field">
        <label className="mum-field-label" htmlFor="mum-font-preview-text">PREVIEW</label>
        <div
          className="mum-font-preview"
          data-testid="mum-font-preview"
          style={previewReady ? { fontFamily: `"${fontPreviewFamily(entry.id)}", sans-serif` } : undefined}
          aria-live="polite"
        >
          {entry.fileError ? 'This file cannot be previewed.' : (previewText.trim() || FONT_PREVIEW_SAMPLE)}
        </div>
        <DreamVizTextInput
          id="mum-font-preview-text"
          className="mum-input mum-input--sm"
          placeholder="Type your own preview text…"
          maxLength={120}
          value={previewText}
          onChange={event => onPreviewTextChange(event.target.value)}
        />
      </div>

      {entry.fileError && <div className="mum-field-error" role="alert">{entry.fileError}</div>}

      {tagsAndCollections}

      <div className="mum-field">
        <label className="mum-field-label">FONT DETAILS</label>
        <div className="mum-addinfo-grid">
          {item('FAMILY', details?.fontFamilyName ?? '—')}
          {item('STYLE', details?.styleName ?? '—')}
          {item('FORMAT', details ? `${details.format} (${details.mimeType})` : '—')}
          {item('FILE SIZE', details ? formatFontBytes(details.fileSize) : formatFontBytes(entry.file.size))}
          {item('GLYPHS', details ? details.glyphCount.toLocaleString('en-US') : '—')}
          {item('FILE NAME', entry.file.name, true)}
        </div>
      </div>

      <div className="mum-font-note">
        Uploaded fonts are saved to your Font Library and become the active text font.
      </div>
    </>
  )
}
