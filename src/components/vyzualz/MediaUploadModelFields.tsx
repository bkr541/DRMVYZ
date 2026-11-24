import { useState } from 'react'
import { AppIcon } from '../shared/icons/AppIcon'
import { DreamVizTextInput } from './react/controls/DreamVizTextInput'
import { formatModelBytes, type ModelQueueEntry } from './mediaUploadModels'

function ModelUploadPreview({ entry }: { entry: ModelQueueEntry }) {
  const [imageStatus, setImageStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const loading = !entry.fileError && (!entry.inspection || (entry.thumbnailUrl !== null && imageStatus === 'loading'))
  const showImage = entry.thumbnailUrl !== null && imageStatus === 'ready'

  return (
    <div className="mum-field mum-model-preview">
      <div className="mum-field-label">PREVIEW</div>
      <div className="mum-model-preview-frame" role="group" aria-label="Model preview" aria-busy={loading}>
        {entry.thumbnailUrl && (
          <img
            className="mum-model-thumb"
            src={entry.thumbnailUrl}
            alt={`Preview of ${entry.name || entry.file.name}`}
            hidden={!showImage}
            onLoad={() => setImageStatus('ready')}
            onError={() => setImageStatus('failed')}
          />
        )}
        {!loading && !showImage && (
          <div className="mum-model-preview-placeholder mum-font-note">
            <AppIcon kind="layers" size={20} />
            Preview unavailable
          </div>
        )}
      </div>
    </div>
  )
}

/** Fields for the active 3D model in the media upload queue. */
export function ModelUploadFields({ entry, onNameChange, onDescriptionChange, tagsAndCollections }: {
  entry: ModelQueueEntry
  onNameChange: (name: string) => void
  onDescriptionChange: (description: string) => void
  /** The dialog's shared tags + collections fields, so models are filed exactly like media. */
  tagsAndCollections: React.ReactNode
}) {
  const stats = entry.inspection?.stats
  const hasName = Boolean(entry.name.trim())
  const item = (label: string, value: string) => (
    <div className="mum-addinfo-item">
      <div className="mum-addinfo-label">{label}</div>
      <DreamVizTextInput className="mum-addinfo-input" value={value} readOnly aria-label={label} title={value} />
    </div>
  )
  const size = stats ? stats.bounds.max.map((n, i) => (n - stats.bounds.min[i]!).toFixed(2)).join(' × ') : '—'
  return (
    <>
      <div className="mum-model-summary">
        <div className="mum-field mum-model-form">
          <div className="mum-upload-grid mum-model-identity">
            <div className="mum-field">
              <label className="mum-field-label" htmlFor="mum-model-type">TYPE</label>
              <DreamVizTextInput id="mum-model-type" className="mum-input" value="3D Model" readOnly />
            </div>
            <div className="mum-field">
              <label className="mum-field-label" htmlFor="mum-model-name">MODEL NAME<span className="mum-req">*</span></label>
              <DreamVizTextInput
                id="mum-model-name"
                className={`mum-input${hasName ? '' : ' mum-input--error'}`}
                placeholder="e.g. Diamond logo"
                maxLength={200}
                value={entry.name}
                aria-invalid={!hasName || undefined}
                onChange={event => onNameChange(event.target.value)}
              />
              {!hasName && <div className="mum-field-error">A model name is required.</div>}
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
          </div>
          {tagsAndCollections}
          <div className="mum-field">
            <div className="mum-field-label">MODEL DETAILS</div>
            <div className="mum-upload-grid mum-upload-metadata mum-model-details">
              {item('TRIANGLES', stats ? stats.triangles.toLocaleString('en-US') : '—')}
              {item('VERTICES', stats ? stats.vertices.toLocaleString('en-US') : '—')}
              {item('MESHES', stats ? String(stats.meshes) : '—')}
              {item('MATERIALS', stats?.materialCount ? String(stats.materialCount) : '—')}
              {item('FILE SIZE', formatModelBytes(entry.file.size))}
              {item('SOURCE FORMAT', entry.file.name.split('.').pop()?.toUpperCase() ?? '—')}
              {item('EST. SOURCE GPU', stats?.imported?.gpuBytesEstimate ? formatModelBytes(stats.imported.gpuBytesEstimate) : '—')}
              {item('RECOMMENDED QUALITY', stats ? (stats.triangles > 40000 || (stats.imported?.maxImageSide ?? 0) > 4096 ? 'Auto / Performance' : 'Auto') : '—')}
              {item('TEXTURES', stats?.imported ? (stats.imported.imageCount ? `${stats.imported.imageCount} · up to ${stats.imported.maxImageSide} px` : 'None') : '—')}
              {item('DIMENSIONS', size)}
              {item('FILE NAME', entry.file.name)}
            </div>
          </div>
        </div>
        <ModelUploadPreview key={entry.id} entry={entry} />
      </div>

      {entry.fileError && <div className="mum-field-error" role="alert">{entry.fileError}</div>}
      {entry.inspection?.warnings.map(warning => <div key={warning} className="mum-font-note">{warning}</div>)}
    </>
  )
}
