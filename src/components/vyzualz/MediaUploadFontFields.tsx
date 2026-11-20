import { DreamVizTextInput } from './react/controls/DreamVizTextInput'
import { FONT_PREVIEW_SAMPLE, fontPreviewFamily, formatFontBytes, type FontQueueEntry } from './mediaUploadFonts'

/** The right-hand side of the media upload dialog while fonts are queued: details that belong to a font instead of the media fields. */
export function FontUploadFields({
  entry,
  previewText,
  previewReady,
  onNameChange,
  onPreviewTextChange,
  tagsField,
  collectionsField,
}: {
  entry: FontQueueEntry
  previewText: string
  previewReady: boolean
  onNameChange: (name: string) => void
  onPreviewTextChange: (text: string) => void
  tagsField: React.ReactNode
  collectionsField: React.ReactNode
}) {
  const details = entry.details
  const hasName = Boolean(entry.name.trim())
  const item = (label: string, value: string) => (
    <div className="mum-addinfo-item">
      <div className="mum-addinfo-label">{label}</div>
      <DreamVizTextInput className="mum-addinfo-input" value={value} readOnly aria-label={label} title={value} />
    </div>
  )
  return (
    <>
      <div className="mum-upload-grid mum-upload-grid--identity">
        <div className="mum-field">
          <label className="mum-field-label" htmlFor="mum-font-type">TYPE</label>
          <DreamVizTextInput id="mum-font-type" className="mum-input" value="Font" readOnly />
        </div>
        <div className="mum-field">
          <label className="mum-field-label" htmlFor="mum-font-name">FONT NAME<span className="mum-req">*</span></label>
          <DreamVizTextInput
            id="mum-font-name"
            className={`mum-input${hasName ? '' : ' mum-input--error'}`}
            placeholder={details?.name ?? 'e.g. Headline Display'}
            maxLength={160}
            value={entry.name}
            aria-invalid={!hasName || undefined}
            onChange={event => onNameChange(event.target.value)}
          />
          {!hasName && <div className="mum-field-error">A font name is required.</div>}
        </div>
        {collectionsField}
      </div>

      <div className="mum-upload-grid mum-font-preview-grid">
        <div className="mum-field mum-font-specimen">
          <div className="mum-field-label">PREVIEW</div>
          <div
            className="mum-font-preview"
            data-testid="mum-font-preview"
            style={previewReady ? { fontFamily: `"${fontPreviewFamily(entry.id)}", sans-serif` } : undefined}
            aria-live="polite"
          >
            {entry.fileError ? 'This file cannot be previewed.' : (previewText.trim() || FONT_PREVIEW_SAMPLE)}
          </div>
        </div>
        <div className="mum-field">
          <label className="mum-field-label" htmlFor="mum-font-preview-text">PREVIEW TEXT</label>
          <DreamVizTextInput
            id="mum-font-preview-text"
            className="mum-input"
            placeholder="Type your own preview text…"
            maxLength={120}
            value={previewText}
            onChange={event => onPreviewTextChange(event.target.value)}
          />
        </div>
        {tagsField}
      </div>

      {entry.fileError && <div className="mum-field-error" role="alert">{entry.fileError}</div>}

      <div className="mum-field">
        <div className="mum-font-details-heading">
          <div className="mum-field-label">FONT DETAILS</div>
          <div className="mum-font-note">Uploaded fonts are saved to your Font Library and become the active text font.</div>
        </div>
        <div className="mum-upload-grid mum-upload-metadata mum-font-details">
          {item('FAMILY', details?.fontFamilyName ?? '—')}
          {item('STYLE', details?.styleName ?? '—')}
          {item('FORMAT', details ? `${details.format} (${details.mimeType})` : '—')}
          {item('FILE SIZE', details ? formatFontBytes(details.fileSize) : formatFontBytes(entry.file.size))}
          {item('GLYPHS', details ? details.glyphCount.toLocaleString('en-US') : '—')}
          {item('FILE NAME', entry.file.name)}
        </div>
      </div>
    </>
  )
}
