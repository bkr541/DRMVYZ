import { DreamVizTextInput } from '../react/controls/DreamVizTextInput'
import { useEffect, useState } from 'react'
import { useMediaStore } from '../../../stores/mediaStore'
import type { MediaCollection } from '../../../stores/mediaStore'

export function CollectionEditorModal({ collection, onClose }: { collection?: MediaCollection; onClose: () => void }) {
  const createCollection = useMediaStore(state => state.createCollection)
  const updateCollection = useMediaStore(state => state.updateCollection)
  const loadError = useMediaStore(state => state.loadError)
  const clearLoadError = useMediaStore(state => state.clearLoadError)
  const [name, setName] = useState(collection?.name ?? '')
  const [description, setDescription] = useState(collection?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    clearLoadError()
  }, [clearLoadError])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const save = async () => {
    if (!name.trim()) {
      setValidationError('Collection name is required.')
      return
    }
    setSaving(true)
    clearLoadError()
    setValidationError(null)
    const succeeded = collection
      ? await updateCollection(collection.id, name, description)
      : Boolean(await createCollection(name, description))
    setSaving(false)
    if (succeeded) onClose()
  }

  return (
    <div className="mum-backdrop" role="presentation">
      <div className="mmv-editor-modal" role="dialog" aria-modal="true" aria-labelledby="collection-editor-title">
        <div className="mmv-editor-header">
          <div>
            <h2 id="collection-editor-title">{collection ? 'Edit Collection' : 'New Collection'}</h2>
            <p>Organize visual assets without moving or duplicating files.</p>
          </div>
          <button type="button" className="mpm-close" onClick={onClose} disabled={saving} aria-label="Close collection editor">×</button>
        </div>
        <div className="mmv-editor-body">
          <label className="mum-field">
            <span className="mum-field-label">NAME <span className="mum-req">*</span></span>
            <DreamVizTextInput className="mum-input" value={name} onChange={event => setName(event.target.value)} maxLength={120} autoFocus />
          </label>
          <label className="mum-field">
            <span className="mum-field-label">DESCRIPTION</span>
            <textarea className="mum-textarea" rows={3} value={description} onChange={event => setDescription(event.target.value)} maxLength={500} />
          </label>
          {(validationError || loadError) && <div className="mmv-editor-error" role="alert">{validationError ?? loadError}</div>}
        </div>
        <div className="mmv-editor-footer">
          <button type="button" className="mum-cancel-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="mum-upload-btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : collection ? 'Save Changes' : 'Create Collection'}</button>
        </div>
      </div>
    </div>
  )
}
