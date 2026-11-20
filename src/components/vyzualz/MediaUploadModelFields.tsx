import { DreamVizTextInput } from './react/controls/DreamVizTextInput'
import { formatModelBytes, type ModelQueueEntry } from './mediaUploadModels'

/** The right-hand side of the media upload dialog while 3D models are queued: details that belong to a model instead of the media fields. */
export function ModelUploadFields({ entry, onNameChange, onDescriptionChange, tagsAndCollections }: {
  entry: ModelQueueEntry
  onNameChange: (name: string) => void
  onDescriptionChange: (description: string) => void
  /** The dialog's shared tags + collections fields, so models are filed exactly like media. */
  tagsAndCollections: React.ReactNode
}) {
  const stats = entry.inspection?.stats
  const item = (label: string, value: string, span2 = false) => (
    <div className={span2 ? 'mum-addinfo-item mum-addinfo-item--span2' : 'mum-addinfo-item'}>
      <div className="mum-addinfo-label">{label}</div>
      <DreamVizTextInput className="mum-addinfo-input" value={value} readOnly aria-label={label} title={value} />
    </div>
  )
  const size = stats ? stats.bounds.max.map((n, i) => (n - stats.bounds.min[i]!).toFixed(2)).join(' × ') : '—'
  return (
    <>
      <div className="mum-field">
        <label className="mum-field-label">TYPE</label>
        <div className="mum-audio-role-badge">3D Model</div>
      </div>

      {entry.thumbnailUrl && (
        <div className="mum-field">
          <label className="mum-field-label">PREVIEW</label>
          <img className="mum-model-thumb" src={entry.thumbnailUrl} alt={`Preview of ${entry.name || entry.file.name}`} />
        </div>
      )}

      <div className="mum-field">
        <label className="mum-field-label" htmlFor="mum-model-name">MODEL NAME<span className="mum-req">*</span></label>
        <DreamVizTextInput
          id="mum-model-name"
          className={`mum-input${entry.name.trim() ? '' : ' mum-input--error'}`}
          placeholder="e.g. Diamond logo"
          maxLength={200}
          value={entry.name}
          onChange={event => onNameChange(event.target.value)}
        />
        {!entry.name.trim() && <div className="mum-field-error">A model name is required.</div>}
      </div>

      <div className="mum-field">
        <label className="mum-field-label" htmlFor="mum-model-description">DESCRIPTION</label>
        <DreamVizTextInput
          id="mum-model-description"
          className="mum-input"
          placeholder="Optional"
          maxLength={4000}
          value={entry.description}
          onChange={event => onDescriptionChange(event.target.value)}
        />
      </div>

      {entry.fileError && <div className="mum-field-error" role="alert">{entry.fileError}</div>}
      {entry.inspection?.warnings.map(warning => <div key={warning} className="mum-font-note">{warning}</div>)}

      {tagsAndCollections}

      <div className="mum-field">
        <label className="mum-field-label">MODEL DETAILS</label>
        <div className="mum-addinfo-grid">
          {item('TRIANGLES', stats ? stats.triangles.toLocaleString('en-US') : '—')}
          {item('VERTICES', stats ? stats.vertices.toLocaleString('en-US') : '—')}
          {item('MESHES', stats ? String(stats.meshes) : '—')}
          {item('MATERIALS', stats?.materialCount ? String(stats.materialCount) : '—')}
          {item('FILE SIZE', formatModelBytes(entry.file.size))}
          {item('TEXTURES', stats?.imported ? (stats.imported.imageCount ? `${stats.imported.imageCount} · up to ${stats.imported.maxImageSide} px` : 'None') : '—')}
          {item('DIMENSIONS', size, true)}
          {item('FILE NAME', entry.file.name, true)}
        </div>
      </div>

      <div className="mum-font-note">
        The GLB is stored exactly as you made it in your 3D Models library, with version history, tags and collections.
      </div>
    </>
  )
}
