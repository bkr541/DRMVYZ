import { DreamVizTextInput } from '../react/controls/DreamVizTextInput'
import { useEffect, useState } from 'react'
import { MUSICAL_KEYS } from '../../../lib/mediaRoles'
import { useAudioStore } from '../../../stores/audioStore'
import type { SavedAudioTrack } from '../../../stores/audioStore'
import { DropdownSelect } from '../../shared/Dropdown/Dropdown'

export function AudioTrackEditModal({ track, onClose }: { track: SavedAudioTrack; onClose: () => void }) {
  const updateSavedTrackMetadata = useAudioStore(state => state.updateSavedTrackMetadata)
  const loadError = useAudioStore(state => state.loadError)
  const clearError = useAudioStore(state => state.clearError)
  const [title, setTitle] = useState(track.title)
  const [artist, setArtist] = useState(track.artist ?? '')
  const [genre, setGenre] = useState(track.genre ?? '')
  const [bpm, setBpm] = useState(track.bpm?.toString() ?? '')
  const [musicalKey, setMusicalKey] = useState(track.musicalKey ?? '')
  const hasCustomMusicalKey = Boolean(track.musicalKey && !MUSICAL_KEYS.includes(track.musicalKey as (typeof MUSICAL_KEYS)[number]))
  const [saving, setSaving] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    clearError()
  }, [clearError])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const save = async () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setValidationError('Title is required.')
      return
    }
    const parsedBpm = bpm.trim() ? Number(bpm) : null
    if (parsedBpm !== null && (!Number.isFinite(parsedBpm) || parsedBpm <= 0)) {
      setValidationError('BPM must be a positive number.')
      return
    }

    setSaving(true)
    clearError()
    setValidationError(null)
    const saved = await updateSavedTrackMetadata(track.id, {
      title: trimmedTitle,
      artist: artist.trim() || null,
      genre: genre.trim() || null,
      bpm: parsedBpm,
      musicalKey: musicalKey.trim() || null,
    })
    setSaving(false)
    if (saved) onClose()
  }

  return (
    <div className="mum-backdrop" role="presentation">
      <div className="mmv-editor-modal" role="dialog" aria-modal="true" aria-labelledby="audio-editor-title">
        <div className="mmv-editor-header">
          <div>
            <h2 id="audio-editor-title">Edit Audio Metadata</h2>
            <p>{track.fileName}</p>
          </div>
          <button type="button" className="mpm-close" onClick={onClose} disabled={saving} aria-label="Close audio editor">×</button>
        </div>
        <div className="mmv-editor-body">
          <label className="mum-field">
            <span className="mum-field-label">TITLE <span className="mum-req">*</span></span>
            <DreamVizTextInput className="mum-input" value={title} onChange={event => setTitle(event.target.value)} maxLength={160} />
          </label>
          <div className="mmv-editor-grid">
            <label className="mum-field">
              <span className="mum-field-label">ARTIST</span>
              <DreamVizTextInput className="mum-input" value={artist} onChange={event => setArtist(event.target.value)} maxLength={160} />
            </label>
            <label className="mum-field">
              <span className="mum-field-label">GENRE</span>
              <DreamVizTextInput className="mum-input" value={genre} onChange={event => setGenre(event.target.value)} maxLength={120} />
            </label>
            <label className="mum-field">
              <span className="mum-field-label">BPM</span>
              <input className="mum-input" type="number" min="1" step="0.01" value={bpm} onChange={event => setBpm(event.target.value)} />
            </label>
            <label className="mum-field">
              <span className="mum-field-label">MUSICAL KEY</span>
              <DropdownSelect className="mum-select" value={musicalKey} onChange={event => setMusicalKey(event.target.value)}>
                <option value="">Unknown</option>
                {hasCustomMusicalKey && <option value={track.musicalKey!}>{track.musicalKey} (existing)</option>}
                {MUSICAL_KEYS.map(key => <option key={key} value={key}>{key}</option>)}
              </DropdownSelect>
            </label>
          </div>
          {(validationError || loadError) && <div className="mmv-editor-error" role="alert">{validationError ?? loadError}</div>}
        </div>
        <div className="mmv-editor-footer">
          <button type="button" className="mum-cancel-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="mum-upload-btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}
