import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Collapsible, NumberInputRow, SelectRow, TextInputRow, ToggleRow } from '../react/ReactControlRows'
import { IconChipButton } from '../react/controls/IconChipButton'
import { DreamVizTextInput } from '../react/controls/DreamVizTextInput'
import { Badge } from '../react/controls/Badge'
import { NoticeCard } from '../react/controls/NoticeCard'
import { Dropdown } from '../../shared/Dropdown/Dropdown'
import { useMediaStore } from '../../../stores/mediaStore'
import type { UploadedMedia } from '../../../stores/mediaStore'
import { useAudioStore } from '../../../stores/audioStore'
import type { SavedAudioTrack } from '../../../stores/audioStore'
import {
  MEDIA_ROLE_LABELS,
  MUSICAL_KEYS,
  VISUAL_MEDIA_ROLES,
  type MediaRole,
} from '../../../lib/mediaRoles'

// ── Visual media editor ──────────────────────────────────────────────────────

function VisualMediaInspector({ media }: { media: UploadedMedia }) {
  const { saveMediaEdits, collections, createCollection } = useMediaStore(useShallow(state => ({
    saveMediaEdits: state.saveMediaEdits,
    collections: state.collections,
    createCollection: state.createCollection,
  })))

  // Additional Info fields only make sense for certain media types: FPS and
  // Loopable describe video playback, so images and SVGs never show them.
  // Has Alpha describes a raster/video transparency channel, which doesn't
  // apply to vector SVGs. BPM/Key/Energy describe audio and never applied to
  // any visual media type in the first place — saved tracks get their own
  // Track Details editor (see AudioTrackInspector below) instead.
  const isVideo = media.type === 'video'
  const isSvg = media.mediaRole === 'svg'

  const [role, setRole] = useState<MediaRole>(media.mediaRole)
  const [title, setTitle] = useState(media.title ?? '')
  const [description, setDescription] = useState(media.description ?? '')
  const [tags, setTags] = useState<string[]>(media.tags)
  const [tagInput, setTagInput] = useState('')
  const [collectionIds, setCollectionIds] = useState<string[]>(media.collectionIds)
  const [collInput, setCollInput] = useState('')
  const [fps, setFps] = useState<string>(media.metadata.fps != null ? String(media.metadata.fps) : '')
  const [loopable, setLoopable] = useState(media.metadata.loopable ?? false)
  const [hasAlpha, setHasAlpha] = useState(media.metadata.hasAlpha ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRole(media.mediaRole)
    setTitle(media.title ?? '')
    setDescription(media.description ?? '')
    setTags(media.tags)
    setTagInput('')
    setCollectionIds(media.collectionIds)
    setCollInput('')
    setFps(media.metadata.fps != null ? String(media.metadata.fps) : '')
    setLoopable(media.metadata.loopable ?? false)
    setHasAlpha(media.metadata.hasAlpha ?? false)
    setError(null)
  }, [media.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const addTag = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && !tags.includes(trimmed)) setTags([...tags, trimmed])
    setTagInput('')
  }
  const removeTag = (tag: string) => setTags(tags.filter(candidate => candidate !== tag))

  const filteredCollections = collections.filter(c =>
    c.name.toLowerCase().includes(collInput.toLowerCase()) && !collectionIds.includes(c.id))
  const collectionDropdownOptions = collInput.trim()
    ? filteredCollections.length > 0
      ? filteredCollections.map(c => ({ value: c.id, label: c.name }))
      : [{ value: '__create__', label: `+ Create "${collInput.trim()}"` }]
    : []
  const addCollection = (id: string) => { setCollectionIds([...collectionIds, id]); setCollInput('') }
  const removeCollectionId = (id: string) => setCollectionIds(collectionIds.filter(candidate => candidate !== id))
  const handleCollectionChange = async (value: string) => {
    if (value !== '__create__') { addCollection(value); return }
    const newId = await createCollection(collInput.trim())
    if (newId) addCollection(newId)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const parsedFps = fps.trim() ? Number(fps) : undefined
    const saved = await saveMediaEdits(media.id, {
      role,
      title: title.trim(),
      description: description.trim(),
      tags,
      collectionIds,
      metadata: {
        ...media.metadata,
        fps: parsedFps,
        loopable,
        hasAlpha,
      },
    })
    setSaving(false)
    if (!saved) setError('Could not save changes. Try again.')
  }

  return (
    <div className="mmi-body">
      <Collapsible label="Details" defaultOpen>
        <SelectRow
          id="mmi-role"
          label="Media Role"
          value={role}
          options={VISUAL_MEDIA_ROLES.map(r => ({ value: r, label: MEDIA_ROLE_LABELS[r] }))}
          onChange={value => setRole(value as MediaRole)}
        />
        <TextInputRow
          id="mmi-title"
          label="Title"
          value={title}
          maxLength={160}
          placeholder={media.name}
          onChange={setTitle}
        />
        <div className="rv-ctrl-row">
          <span className="rv-ctrl-label-cluster">
            <label className="rv-ctrl-label" htmlFor="mmi-description">Description</label>
          </span>
          <textarea
            id="mmi-description"
            className="dv-text-input mmi-textarea"
            rows={3}
            placeholder="Describe this media…"
            value={description}
            onChange={event => setDescription(event.target.value)}
          />
        </div>
      </Collapsible>

      <Collapsible label="Tags &amp; Collections" defaultOpen>
        <div className="rv-ctrl-row">
          <span className="rv-ctrl-label-cluster">
            <label className="rv-ctrl-label" htmlFor="mmi-tags">Tags</label>
          </span>
          <div className="mmi-chip-field">
            {tags.map(tag => <Badge key={tag} label={tag} tone="#4ac7db" onRemove={() => removeTag(tag)} removeLabel="Remove tag" />)}
            <DreamVizTextInput
              id="mmi-tags"
              className="mmi-chip-input"
              placeholder="Type to add tags…"
              value={tagInput}
              onChange={event => setTagInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTag(tagInput) }
              }}
              onBlur={() => { if (tagInput.trim()) addTag(tagInput) }}
            />
          </div>
        </div>
        <div className="rv-ctrl-row">
          <span className="rv-ctrl-label-cluster">
            <label className="rv-ctrl-label" htmlFor="mmi-collections">Collections</label>
          </span>
          <div className="mmi-chip-field">
            {collectionIds.map(id => (
              <Badge key={id} label={collections.find(c => c.id === id)?.name ?? id} tone="#b84fc9" onRemove={() => removeCollectionId(id)} removeLabel="Remove collection" />
            ))}
          </div>
          <Dropdown
            id="mmi-collections"
            searchable
            searchValue={collInput}
            onSearchChange={setCollInput}
            value={null}
            options={collectionDropdownOptions}
            onChange={value => { void handleCollectionChange(value) }}
            placeholder="Type to search or create…"
            ariaLabel="Collections"
            menuLabel="Collections"
            size="compact"
            showDescriptions={false}
          />
        </div>
      </Collapsible>

      <Collapsible label="Additional Info" defaultOpen={false}>
        {isVideo && (
          <div className="rv-ctrl-row"><span className="rv-ctrl-label-cluster"><span className="rv-ctrl-label">Duration</span></span><span className="mmi-readonly">{media.metadata.duration != null ? `${media.metadata.duration.toFixed(2)}s` : '—'}</span></div>
        )}
        <div className="rv-ctrl-row"><span className="rv-ctrl-label-cluster"><span className="rv-ctrl-label">Resolution</span></span><span className="mmi-readonly">{media.metadata.width && media.metadata.height ? `${media.metadata.width} × ${media.metadata.height}` : '—'}</span></div>
        {isVideo && (
          <NumberInputRow id="mmi-fps" label="FPS" value={fps === '' ? '' : Number(fps)} min={1} max={240} step={1} placeholder="e.g. 30" onChange={value => setFps(String(value))} onEmpty={() => setFps('')} />
        )}
        {isVideo && (
          <ToggleRow id="mmi-loopable" label="Loopable" value={loopable} onChange={setLoopable} />
        )}
        {!isSvg && (
          <ToggleRow id="mmi-alpha" label="Has Alpha" value={hasAlpha} onChange={setHasAlpha} />
        )}
      </Collapsible>

      {error && <NoticeCard tone="error" role="alert" title="Save failed">{error}</NoticeCard>}

      <div className="mmi-actions">
        <IconChipButton tone="primary" onClick={() => { void handleSave() }} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </IconChipButton>
      </div>
    </div>
  )
}

// ── Audio track editor ───────────────────────────────────────────────────────

function AudioTrackInspector({ track }: { track: SavedAudioTrack }) {
  const updateSavedTrackMetadata = useAudioStore(state => state.updateSavedTrackMetadata)

  const [title, setTitle] = useState(track.title)
  const [artist, setArtist] = useState(track.artist ?? '')
  const [genre, setGenre] = useState(track.genre ?? '')
  const [bpm, setBpm] = useState(track.bpm != null ? String(track.bpm) : '')
  const [musicalKey, setMusicalKey] = useState(track.musicalKey ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTitle(track.title)
    setArtist(track.artist ?? '')
    setGenre(track.genre ?? '')
    setBpm(track.bpm != null ? String(track.bpm) : '')
    setMusicalKey(track.musicalKey ?? '')
    setError(null)
  }, [track.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) { setError('Title is required.'); return }
    const parsedBpm = bpm.trim() ? Number(bpm) : null
    if (parsedBpm !== null && (!Number.isFinite(parsedBpm) || parsedBpm <= 0)) { setError('BPM must be a positive number.'); return }
    setSaving(true)
    setError(null)
    const saved = await updateSavedTrackMetadata(track.id, {
      title: trimmedTitle,
      artist: artist.trim() || null,
      genre: genre.trim() || null,
      bpm: parsedBpm,
      musicalKey: musicalKey.trim() || null,
    })
    setSaving(false)
    if (!saved) setError('Could not save changes. Try again.')
  }

  return (
    <div className="mmi-body">
      <Collapsible label="Track Details" defaultOpen>
        <TextInputRow id="mmi-track-title" label="Title" value={title} maxLength={160} onChange={setTitle} />
        <TextInputRow id="mmi-track-artist" label="Artist" value={artist} maxLength={160} placeholder="Unknown artist" onChange={setArtist} />
        <TextInputRow id="mmi-track-genre" label="Genre" value={genre} maxLength={120} placeholder="e.g. Electronic" onChange={setGenre} />
        <NumberInputRow id="mmi-track-bpm" label="BPM" value={bpm === '' ? '' : Number(bpm)} min={1} max={999} step={0.1} placeholder="e.g. 128" onChange={value => setBpm(String(value))} onEmpty={() => setBpm('')} />
        <SelectRow id="mmi-track-key" label="Musical Key" value={musicalKey} options={[{ value: '', label: 'Unknown' }, ...MUSICAL_KEYS.map(k => ({ value: k, label: k }))]} onChange={setMusicalKey} />
      </Collapsible>

      {error && <NoticeCard tone="error" role="alert" title="Save failed">{error}</NoticeCard>}

      <div className="mmi-actions">
        <IconChipButton tone="primary" onClick={() => { void handleSave() }} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </IconChipButton>
      </div>
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function MediaManagerInspector({
  media,
  track,
}: {
  media: UploadedMedia | null
  track: SavedAudioTrack | null
}) {
  if (media) return <VisualMediaInspector key={media.id} media={media} />
  if (track) return <AudioTrackInspector key={track.id} track={track} />
  return (
    <div className="mmi-empty">
      <p>Select media from the library to view and edit its details.</p>
    </div>
  )
}
