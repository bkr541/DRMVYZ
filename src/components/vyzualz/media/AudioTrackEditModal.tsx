import { AppIcon } from '../../shared/icons/AppIcon'
import { DreamVizTextInput } from '../react/controls/DreamVizTextInput'
import { IconChipButton } from '../react/controls/IconChipButton'
import { useEffect, useState } from 'react'
import { MUSICAL_KEYS } from '../../../lib/mediaRoles'
import { useAudioStore } from '../../../stores/audioStore'
import type { SavedAudioTrack } from '../../../stores/audioStore'
import { DropdownSelect } from '../../shared/Dropdown/Dropdown'
import { DialogTitleIcon } from '../../shared/DialogTitleIcon'

export function AudioTrackEditModal({ track, onClose }: { track: SavedAudioTrack; onClose: () => void }) {
  const updateSavedTrackMetadata = useAudioStore(state => state.updateSavedTrackMetadata)
  const loadError = useAudioStore(state => state.loadError)
  const clearError = useAudioStore(state => state.clearError)
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

  const save = async (fields: { title: string; artist: string; genre: string; bpm: string; musicalKey: string }) => {
    const trimmedTitle = fields.title.trim()
    if (!trimmedTitle) {
      setValidationError('Title is required.')
      return
    }
    const parsedBpm = fields.bpm.trim() ? Number(fields.bpm) : null
    if (parsedBpm !== null && (!Number.isFinite(parsedBpm) || parsedBpm <= 0)) {
      setValidationError('BPM must be a positive number.')
      return
    }

    setSaving(true)
    clearError()
    setValidationError(null)
    const saved = await updateSavedTrackMetadata(track.id, {
      title: trimmedTitle,
      artist: fields.artist.trim() || null,
      genre: fields.genre.trim() || null,
      bpm: parsedBpm,
      musicalKey: fields.musicalKey.trim() || null,
    })
    setSaving(false)
    if (saved) onClose()
  }

  return <AudioTrackEditView track={track} saving={saving} error={validationError ?? loadError} onClose={onClose} onSave={save} />
}

/** The editor modal's markup and field state. Layout Lab mounts it with placeholder state instead of the audio store. */
export function AudioTrackEditView({ track, saving, error, onClose, onSave }: {
  track: Pick<SavedAudioTrack, 'title' | 'artist' | 'genre' | 'bpm' | 'musicalKey'>
  saving: boolean
  error: string | null
  onClose: () => void
  onSave: (fields: { title: string; artist: string; genre: string; bpm: string; musicalKey: string }) => void
}) {
  const [title, setTitle] = useState(track.title)
  const [artist, setArtist] = useState(track.artist ?? '')
  const [genre, setGenre] = useState(track.genre ?? '')
  const [bpm, setBpm] = useState(track.bpm?.toString() ?? '')
  const [musicalKey, setMusicalKey] = useState(track.musicalKey ?? '')
  const hasCustomMusicalKey = Boolean(track.musicalKey && !MUSICAL_KEYS.includes(track.musicalKey as (typeof MUSICAL_KEYS)[number]))
  const save = () => onSave({ title, artist, genre, bpm, musicalKey })

  return (
    <div className="mum-backdrop" role="presentation">
      <div className="mmv-editor-modal" role="dialog" aria-modal="true" aria-labelledby="audio-editor-title">
        <div className="mmv-editor-header">
          <div>
            <h2 id="audio-editor-title"><DialogTitleIcon name="edit" />Edit Audio Metadata</h2>
          </div>
          <button type="button" className="mpm-close" onClick={onClose} disabled={saving} aria-label="Close audio editor"><AppIcon kind="close" size={14} /></button>
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
          {error && <div className="mmv-editor-error" role="alert">{error}</div>}
        </div>
        <div className="mmv-editor-footer">
          <IconChipButton onClick={onClose} disabled={saving}>Cancel</IconChipButton>
          <IconChipButton tone="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</IconChipButton>
        </div>
      </div>
    </div>
  )
}
