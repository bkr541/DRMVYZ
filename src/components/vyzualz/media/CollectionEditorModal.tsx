import { AppIcon } from '../../shared/icons/AppIcon'
import { DreamVizTextInput } from '../react/controls/DreamVizTextInput'
import { IconChipButton } from '../react/controls/IconChipButton'
import { useEffect, useState } from 'react'
import { useMediaStore } from '../../../stores/mediaStore'
import type { MediaCollection } from '../../../stores/mediaStore'
import { DialogTitleIcon } from '../../shared/DialogTitleIcon'
import { useNotifyCurrentPage } from '../../../stores/notificationStore'

export function CollectionEditorModal({ collection, onClose }: { collection?: MediaCollection; onClose: () => void }) {
  const createCollection = useMediaStore(state => state.createCollection)
  const updateCollection = useMediaStore(state => state.updateCollection)
  const loadError = useMediaStore(state => state.loadError)
  const clearLoadError = useMediaStore(state => state.clearLoadError)
  const notifyPage = useNotifyCurrentPage()
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

  const save = async (name: string, description: string) => {
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
    if (!succeeded) return
    const savedName = name.trim()
    notifyPage(collection
      ? { tone: 'success', title: 'Collection updated', message: `"${savedName}" was updated.` }
      : { tone: 'success', title: 'Collection created', message: `"${savedName}" was added to your collections.` })
    onClose()
  }

  return (
    <CollectionEditorView
      collection={collection}
      saving={saving}
      error={validationError ?? loadError}
      onClose={onClose}
      onSave={save}
    />
  )
}

/** The editor modal's markup and field state. Layout Lab mounts it with placeholder state instead of the media store. */
export function CollectionEditorView({ collection, saving, error, onClose, onSave }: {
  collection?: Pick<MediaCollection, 'name' | 'description'>
  saving: boolean
  error: string | null
  onClose: () => void
  onSave: (name: string, description: string) => void
}) {
  const [name, setName] = useState(collection?.name ?? '')
  const [description, setDescription] = useState(collection?.description ?? '')
  const save = () => onSave(name, description)

  return (
    <div className="mum-backdrop" role="presentation">
      <div className="mmv-editor-modal" role="dialog" aria-modal="true" aria-labelledby="collection-editor-title">
        <div className="mmv-editor-header">
          <div>
            <h2 id="collection-editor-title"><DialogTitleIcon name="folder" />{collection ? 'Edit Collection' : 'New Collection'}</h2>
          </div>
          <button type="button" className="mpm-close" onClick={onClose} disabled={saving} aria-label="Close collection editor"><AppIcon kind="close" size={14} /></button>
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
          {error && <div className="mmv-editor-error" role="alert">{error}</div>}
        </div>
        <div className="mmv-editor-footer">
          <IconChipButton onClick={onClose} disabled={saving}>Cancel</IconChipButton>
          <IconChipButton tone="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : collection ? 'Save Changes' : 'Create Collection'}</IconChipButton>
        </div>
      </div>
    </div>
  )
}
