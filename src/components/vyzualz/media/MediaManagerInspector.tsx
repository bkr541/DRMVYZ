import { AppIcon } from '../../shared/icons/AppIcon'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useShallow } from 'zustand/react/shallow'
import { Collapsible, NumberInputRow, SelectRow, TextInputRow, ToggleRow } from '../react/ReactControlRows'
import { IconChipButton } from '../react/controls/IconChipButton'
import { DreamVizTextInput } from '../react/controls/DreamVizTextInput'
import { Badge } from '../react/controls/Badge'
import { DrawerNotice } from '../shared/DrawerNotice'
import { Dropdown } from '../../shared/Dropdown/Dropdown'
import { useMediaStore } from '../../../stores/mediaStore'
import { findCollectionByName, formatTagTyping, normalizeCollectionName, normalizeTag } from '../../../lib/mediaOrganization'
import { RailWindowHeader } from '../layout/RailWindowHeader'
import { RailTabs, type RailTabOption } from '../layout/RailTabs'
import type { UploadedMedia } from '../../../stores/mediaStore'
import { useAudioStore } from '../../../stores/audioStore'
import type { SavedAudioTrack } from '../../../stores/audioStore'
import { MediaDeleteConfirmDialog } from './MediaDeleteConfirmDialog'
import { notify } from '../../../stores/notificationStore'
import { MediaEditPanel } from './MediaEditPanel'
import { selectMediaEditCanSave, selectMediaEditDirty, useMediaEditStore } from '../../../stores/mediaEditStore'
import { mediaEditUnsupportedReason } from '../../../features/media/edit/mediaEditRender'
import { suggestEditedTitle, validateMediaName } from '../../../features/media/edit/mediaEditOutput'
import type { SaveAsInput } from './SaveAsPopover'
import {
  MEDIA_ROLE_LABELS,
  MUSICAL_KEYS,
  VISUAL_MEDIA_ROLES,
  type MediaRole,
} from '../../../lib/mediaRoles'
import type { OscillatorFontAsset } from '../react/ReactTypes'
import { useReactStore } from '../../../stores/reactStore'

/**
 * What the Info tab hands the page header: the header's centre group owns the buttons, the tab owns the
 * draft they act on. `null` (or a missing action) leaves the button disabled.
 */
export interface MediaHeaderActions {
  onSave: () => void
  saving: boolean
  /** False while there is nothing to save (the key is shown disabled). */
  canSave: boolean
  /** Throws away unsaved changes. `null` for types that have nothing to revert. */
  onRevert: (() => void) | null
  canRevert: boolean
  /** The Save As popover's contents and behaviour. `null` for types that cannot be copied (the key is not offered). */
  saveAs: MediaSaveAs | null
  onDelete: (() => void) | null
  deleting: boolean
}

export interface MediaSaveAs {
  /** Why Save As cannot be used right now (the key is disabled and shows this); null when it can be. */
  unavailable: string | null
  /** The new item starts as a copy of these. */
  initial: SaveAsInput
  validateName: (name: string) => string | null
  busy: boolean
  error: string | null
  clearError: () => void
  /** Resolves true when the copy was saved, and the popover then closes. */
  submit: (input: SaveAsInput) => Promise<boolean>
}

type HeaderActionsSink = (actions: MediaHeaderActions | null) => void

export function TagsCollectionsGroup({
  tags,
  onTagsChange,
  collectionIds,
  onCollectionIdsChange,
  idPrefix = 'mmi',
  disabled = false,
}: {
  tags: string[]
  onTagsChange: (tags: string[]) => void
  collectionIds: string[]
  onCollectionIdsChange: (collectionIds: string[]) => void
  idPrefix?: string
  disabled?: boolean
}) {
  const { collections, createCollection } = useMediaStore(useShallow(state => ({
    collections: state.collections,
    createCollection: state.createCollection,
  })))
  const [tagInput, setTagInput] = useState('')
  const [collInput, setCollInput] = useState('')

  const addTag = (value: string) => {
    const tag = normalizeTag(value)
    if (tag && !tags.includes(tag)) onTagsChange([...tags, tag])
    setTagInput('')
  }
  const filteredCollections = collections.filter(collection =>
    collection.name.toLowerCase().includes(collInput.toLowerCase()) && !collectionIds.includes(collection.id))
  // "Create" is offered unless a collection with that exact name (ignoring case) already exists, selected or not.
  const collectionDropdownOptions = collInput.trim()
    ? [
        ...filteredCollections.map(collection => ({ value: collection.id, label: collection.name })),
        ...(findCollectionByName(collections, collInput) ? [] : [{ value: '__create__', label: `+ Create "${normalizeCollectionName(collInput)}"` }]),
      ]
    : []
  const addCollection = (id: string) => {
    onCollectionIdsChange([...collectionIds, id])
    setCollInput('')
  }
  const handleCollectionChange = async (value: string) => {
    if (value !== '__create__') { addCollection(value); return }
    const newId = await createCollection(normalizeCollectionName(collInput))
    if (newId) addCollection(newId)
  }

  return (
    <Collapsible label="Tags &amp; Collections" defaultOpen>
      <div className="rv-ctrl-row">
        <span className="rv-ctrl-label-cluster">
          <label className="rv-ctrl-label" htmlFor={`${idPrefix}-tags`}>Tags</label>
        </span>
        <DreamVizTextInput
          id={`${idPrefix}-tags`}
          className="mmi-chip-input"
          disabled={disabled}
          placeholder="Type to add tags…"
          value={tagInput}
          onChange={event => setTagInput(formatTagTyping(event.target.value))}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTag(tagInput) }
          }}
          onBlur={() => { if (tagInput.trim()) addTag(tagInput) }}
        />
        {tags.length > 0 && (
          <div className="mmi-chip-field">
            {tags.map(tag => <Badge key={tag} label={tag} tone="#4ac7db" onRemove={disabled ? undefined : () => onTagsChange(tags.filter(candidate => candidate !== tag))} removeLabel="Remove tag" />)}
          </div>
        )}
      </div>
      <div className="rv-ctrl-row">
        <span className="rv-ctrl-label-cluster">
          <label className="rv-ctrl-label" htmlFor={`${idPrefix}-collections`}>Collections</label>
        </span>
        <Dropdown
          id={`${idPrefix}-collections`}
          disabled={disabled}
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
        {collectionIds.length > 0 && (
          <div className="mmi-chip-field">
            {collectionIds.map(id => (
              <Badge key={id} label={collections.find(collection => collection.id === id)?.name ?? id} tone="#b84fc9" onRemove={disabled ? undefined : () => onCollectionIdsChange(collectionIds.filter(candidate => candidate !== id))} removeLabel="Remove collection" />
            ))}
          </div>
        )}
      </div>
    </Collapsible>
  )
}

/** Publishes the header actions while the component is mounted. Handlers are read through a ref so publishing never loops. */
function useHeaderActions(
  publish: HeaderActionsSink | undefined,
  handlers: {
    save: () => void
    remove: (() => void) | null
    revert?: (() => void) | null
    saveAs?: { validateName: (name: string) => string | null; clearError: () => void; submit: (input: SaveAsInput) => Promise<boolean> } | null
  },
  state: {
    saving: boolean
    deleting: boolean
    canSave?: boolean
    canRevert?: boolean
    saveAs?: { unavailable: string | null; initial: SaveAsInput; busy: boolean; error: string | null } | null
  },
) {
  const latest = useRef(handlers)
  latest.current = handlers
  const hasDelete = handlers.remove !== null
  const hasRevert = !!handlers.revert
  const saveAsState = state.saveAs ?? null
  const saveAsKey = saveAsState ? JSON.stringify([saveAsState.unavailable, saveAsState.initial, saveAsState.busy, saveAsState.error]) : null
  useEffect(() => {
    publish?.({
      onSave: () => latest.current.save(),
      saving: state.saving,
      canSave: state.canSave ?? true,
      onRevert: hasRevert ? () => latest.current.revert?.() : null,
      canRevert: state.canRevert ?? false,
      saveAs: saveAsState ? {
        ...saveAsState,
        validateName: name => latest.current.saveAs?.validateName(name) ?? null,
        clearError: () => latest.current.saveAs?.clearError(),
        submit: input => latest.current.saveAs?.submit(input) ?? Promise.resolve(false),
      } : null,
      onDelete: hasDelete ? () => latest.current.remove?.() : null,
      deleting: state.deleting,
    })
    // `saveAsState` is rebuilt every render; its contents are what matter, so `saveAsKey` stands in for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publish, state.saving, state.deleting, state.canSave, state.canRevert, hasDelete, hasRevert, saveAsKey])
  useEffect(() => () => publish?.(null), [publish])
}

// ── Visual media editor ──────────────────────────────────────────────────────

function VisualMediaInspector({ media, onMediaCreated, onHeaderActions }: { media: UploadedMedia; onMediaCreated?: (mediaId: string) => void; onHeaderActions?: HeaderActionsSink }) {
  const { saveMediaEdits, removeItem } = useMediaStore(useShallow(state => ({
    saveMediaEdits: state.saveMediaEdits,
    removeItem: state.removeItem,
  })))
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
  const [collectionIds, setCollectionIds] = useState<string[]>(media.collectionIds)
  const [fps, setFps] = useState<string>(media.metadata.fps != null ? String(media.metadata.fps) : '')
  const [loopable, setLoopable] = useState(media.metadata.loopable ?? false)
  const [hasAlpha, setHasAlpha] = useState(media.metadata.hasAlpha ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetDraft = () => {
    setRole(media.mediaRole)
    setTitle(media.title ?? '')
    setDescription(media.description ?? '')
    setTags(media.tags)
    setCollectionIds(media.collectionIds)
    setFps(media.metadata.fps != null ? String(media.metadata.fps) : '')
    setLoopable(media.metadata.loopable ?? false)
    setHasAlpha(media.metadata.hasAlpha ?? false)
    setError(null)
  }
  useEffect(() => {
    resetDraft()
    setConfirmingDelete(false)
    setDeleting(false)
  }, [media.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // The toolbar's Save and Revert cover both halves of this item: the details drafted here and the image or video edits made in the Edit tab.
  const edit = useMediaEditStore(useShallow(state => ({
    active: state.mediaId === media.id,
    dirty: state.mediaId === media.id && selectMediaEditDirty(state),
    canSave: state.mediaId === media.id && selectMediaEditCanSave(state),
    busy: state.busy,
    error: state.error,
  })))
  const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((value, index) => value === b[index])
  const detailsDirty = useMemo(() => (
    role !== media.mediaRole || title !== (media.title ?? '') || description !== (media.description ?? '') || !sameList(tags, media.tags) || !sameList(collectionIds, media.collectionIds)
    || fps !== (media.metadata.fps != null ? String(media.metadata.fps) : '') || loopable !== (media.metadata.loopable ?? false) || hasAlpha !== (media.metadata.hasAlpha ?? false)
  ), [role, title, description, tags, collectionIds, fps, loopable, hasAlpha, media])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const parsedFps = fps.trim() ? Number(fps) : undefined
    // Saved image or video edits change the item's own measurements, so build on its latest record rather than the one this render started from.
    const latest = useMediaStore.getState?.().items.find(item => item.id === media.id) ?? media
    const saved = await saveMediaEdits(media.id, {
      role,
      title: title.trim(),
      description: description.trim(),
      tags,
      collectionIds,
      metadata: {
        ...latest.metadata,
        fps: parsedFps,
        loopable,
        hasAlpha,
      },
    })
    setSaving(false)
    if (!saved) { setError('Could not save changes. Try again.'); return }
    notify('media-manager', { tone: 'success', title: 'Media saved', message: `Changes to "${title.trim() || media.title || media.name}" were saved.` })
  }

  const handleConfirmDelete = async () => {
    setDeleting(true)
    const deleted = await removeItem(media.id)
    setDeleting(false)
    setConfirmingDelete(false)
    if (deleted) notify('media-manager', { tone: 'success', title: 'Media deleted', message: `"${media.title ?? media.name}" was deleted from your media library.` })
    else setError('Could not delete this media item. Try again.')
  }

  const saveEverything = async () => {
    const session = useMediaEditStore.getState()
    if (session.mediaId === media.id && selectMediaEditCanSave(session)) {
      const outcome = await session.save()
      if (!outcome.ok) return
      notify('media-manager', { tone: 'success', title: 'Media saved', message: `Your edits to "${media.title ?? media.name}" were saved.` })
    }
    if (detailsDirty) await handleSave()
  }
  const revertEverything = () => {
    const session = useMediaEditStore.getState()
    if (session.mediaId === media.id && session.busy === 'idle' && selectMediaEditDirty(session)) session.discard()
    resetDraft()
  }
  const unsupported = mediaEditUnsupportedReason(media)
  const copyUnavailable = unsupported ?? (edit.canSave ? null : 'Make an edit in the Edit tab first. Save As saves the edited result as a new item.')
  const working = saving || edit.busy !== 'idle'
  useHeaderActions(
    onHeaderActions,
    {
      save: () => { void saveEverything() }, remove: () => setConfirmingDelete(true), revert: revertEverything,
      saveAs: {
        validateName: name => { const checked = validateMediaName(name); return checked.ok ? null : checked.error },
        clearError: () => useMediaEditStore.getState().clearError(),
        submit: async input => {
          const outcome = await useMediaEditStore.getState().saveAs(input.name, { tags: input.tags, collectionIds: input.collectionIds })
          if (!outcome.ok) return false
          onMediaCreated?.(outcome.mediaId)
          notify('media-manager', { tone: 'success', title: 'Copy saved', message: `Your edited copy "${input.name.trim()}" was added to your media library.` })
          return true
        },
      },
    },
    {
      saving: working, deleting, canSave: !working && (edit.canSave || detailsDirty), canRevert: !working && (edit.dirty || detailsDirty),
      saveAs: {
        unavailable: copyUnavailable,
        initial: { name: suggestEditedTitle(title.trim() || media.title || media.name.replace(/\.[A-Za-z0-9]{1,8}$/, '')), tags, collectionIds },
        busy: edit.busy === 'saving-as', error: edit.error,
      },
    },
  )

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

      <TagsCollectionsGroup
        key={media.id}
        tags={tags}
        onTagsChange={setTags}
        collectionIds={collectionIds}
        onCollectionIdsChange={setCollectionIds}
      />

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

      {error && <DrawerNotice tone="error" role="alert" title="Save failed">{error}</DrawerNotice>}

      {confirmingDelete && (
        <MediaDeleteConfirmDialog
          count={1}
          busy={deleting}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => { void handleConfirmDelete() }}
        />
      )}
    </div>
  )
}

// ── Audio track editor ───────────────────────────────────────────────────────

function AudioTrackInspector({ track, onHeaderActions }: { track: SavedAudioTrack; onHeaderActions?: HeaderActionsSink }) {
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
    if (!saved) { setError('Could not save changes. Try again.'); return }
    notify('media-manager', { tone: 'success', title: 'Track saved', message: `Changes to "${trimmedTitle}" were saved.` })
  }

  useHeaderActions(onHeaderActions, { save: () => { void handleSave() }, remove: null }, { saving, deleting: false })

  return (
    <div className="mmi-body">
      <Collapsible label="Track Details" defaultOpen>
        <TextInputRow id="mmi-track-title" label="Title" value={title} maxLength={160} onChange={setTitle} />
        <TextInputRow id="mmi-track-artist" label="Artist" value={artist} maxLength={160} placeholder="Unknown artist" onChange={setArtist} />
        <TextInputRow id="mmi-track-genre" label="Genre" value={genre} maxLength={120} placeholder="e.g. Electronic" onChange={setGenre} />
        <NumberInputRow id="mmi-track-bpm" label="BPM" value={bpm === '' ? '' : Number(bpm)} min={1} max={999} step={0.1} placeholder="e.g. 128" onChange={value => setBpm(String(value))} onEmpty={() => setBpm('')} />
        <SelectRow id="mmi-track-key" label="Musical Key" value={musicalKey} options={[{ value: '', label: 'Unknown' }, ...MUSICAL_KEYS.map(k => ({ value: k, label: k }))]} onChange={setMusicalKey} />
      </Collapsible>

      {error && <DrawerNotice tone="error" role="alert" title="Save failed">{error}</DrawerNotice>}
    </div>
  )
}

// ── Uploaded font information ────────────────────────────────────────────────

function formatFontFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Unknown'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatFontDate(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date)
}

function FontInspector({
  font,
  onHeaderActions,
  onFontRenamed,
}: {
  font: OscillatorFontAsset
  onHeaderActions?: HeaderActionsSink
  onFontRenamed?: (font: OscillatorFontAsset) => void
}) {
  const updateOscillatorFontAssetMetadata = useReactStore(state => state.updateOscillatorFontAssetMetadata)
  const [name, setName] = useState(font.name)
  const [tags, setTags] = useState<string[]>(font.tags ?? [])
  const [collectionIds, setCollectionIds] = useState<string[]>(font.collectionIds ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(font.name)
    setTags(font.tags ?? [])
    setCollectionIds(font.collectionIds ?? [])
    setError(null)
  }, [font.id, font.name, font.tags, font.collectionIds])

  const handleSave = async () => {
    const nextName = name.trim()
    if (!nextName) {
      setError('Font name is required.')
      return
    }
    setSaving(true)
    setError(null)
    const saved = await updateOscillatorFontAssetMetadata(font.id, { name: nextName, tags, collectionIds })
    setSaving(false)
    if (!saved) {
      setError('Could not save the font details. Try again.')
      return
    }
    setName(nextName)
    notify('media-manager', { tone: 'success', title: 'Font saved', message: `Changes to "${nextName}" were saved.` })
    onFontRenamed?.({ ...font, name: nextName, tags, collectionIds })
  }

  useHeaderActions(
    onHeaderActions,
    { save: () => { void handleSave() }, remove: null },
    { saving, deleting: false },
  )

  const rows = [
    ['file-name', 'File Name', font.fileName],
  ] as const

  return (
    <div className="mmi-body">
      <Collapsible label="Font Details" defaultOpen>
        <TextInputRow
          id="mmi-font-name"
          label="Name"
          value={name}
          onChange={value => { setName(value); setError(null) }}
          maxLength={160}
        />
        {rows.map(([id, label, value]) => (
          <TextInputRow
            key={id}
            id={`mmi-font-${id}`}
            label={label}
            value={value}
            onChange={() => {}}
            maxLength={512}
            readOnly
          />
        ))}
        <div className="mmi-font-meta-row">
          <TextInputRow
            id="mmi-font-format"
            label="Format"
            value={font.mimeType || 'Unknown'}
            onChange={() => {}}
            readOnly
          />
          <TextInputRow
            id="mmi-font-file-size"
            label="File Size"
            value={formatFontFileSize(font.fileSize)}
            onChange={() => {}}
            readOnly
          />
          <TextInputRow
            id="mmi-font-uploaded"
            label="Uploaded"
            value={formatFontDate(font.createdAt)}
            onChange={() => {}}
            readOnly
          />
        </div>
      </Collapsible>
      <TagsCollectionsGroup
        key={font.id}
        tags={tags}
        onTagsChange={setTags}
        collectionIds={collectionIds}
        onCollectionIdsChange={setCollectionIds}
      />
      {error && <DrawerNotice tone="error" role="alert" title="Save failed">{error}</DrawerNotice>}
      {font.parseError && (
        <DrawerNotice tone="warning" role="status" title="Font parsing warning">{font.parseError}</DrawerNotice>
      )}
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export type MediaInspectorTab = 'info' | 'edit' | 'output'

const MEDIA_INSPECTOR_TABS: RailTabOption<MediaInspectorTab>[] = [
  { id: 'info', label: 'Info' },
  { id: 'edit', label: 'Edit' },
  { id: 'output', label: 'Output' },
]

export function MediaDetailsHeader({ activeTab, onChange }: { activeTab: MediaInspectorTab; onChange(tab: MediaInspectorTab): void }) {
  return <>
    <RailWindowHeader side="right" icon={<AppIcon kind="info" size={15} color="currentColor" aria-hidden="true" />} label="Media Details" />
    <RailTabs tabs={MEDIA_INSPECTOR_TABS} activeTab={activeTab} onChange={onChange}
      ariaLabel="Media Manager inspector tabs" className="rv-main-workspace-tabs" variant="underline" />
  </>
}

export function MediaManagerInspector({
  media,
  track,
  font = null,
  onMediaCreated,
  onCreateModel,
  onFontRenamed,
  onHeaderActions,
}: {
  media: UploadedMedia | null
  track: SavedAudioTrack | null
  font?: OscillatorFontAsset | null
  /** Save As created a new media item; the view selects it. */
  onMediaCreated?: (mediaId: string) => void
  /** The Edit tab's Create 3D Model button: continues into 3D model generation for this image. */
  onCreateModel?: (media: UploadedMedia) => void
  /** A persisted rename updates the selected record used by the stage and inspector. */
  onFontRenamed?: (font: OscillatorFontAsset) => void
  /** Receives Save Changes / Delete Media for the page header while the Info tab is showing. */
  onHeaderActions?: HeaderActionsSink
}) {
  const [activeTab, setActiveTab] = useState<MediaInspectorTab>('info')
  return (
    <>
      <MediaDetailsHeader activeTab={activeTab} onChange={setActiveTab} />
      {/* Output is intentionally empty for now. */}
      {/* The details form stays mounted on the Edit tab, so the toolbar's Save, Save As and Revert always have the whole item to act on. */}
      {media && (
        <div style={{ display: activeTab === 'info' ? 'contents' : 'none' }}>
          <VisualMediaInspector key={media.id} media={media} onMediaCreated={onMediaCreated} onHeaderActions={onHeaderActions} />
        </div>
      )}
      {activeTab === 'edit' && (
        media ? (
          <MediaEditPanel key={media.id} media={media} onCreateModel={onCreateModel} />
        ) : (
          <div className="mmi-empty">
            <p>{track ? 'Audio tracks are edited from the Info tab.' : font ? 'Fonts are viewed from the Info tab.' : 'Select an image or video to edit it.'}</p>
          </div>
        )
      )}
      {activeTab === 'info' && !media && (
        track ? (
          <AudioTrackInspector key={track.id} track={track} onHeaderActions={onHeaderActions} />
        ) : font ? (
          <FontInspector key={font.id} font={font} onHeaderActions={onHeaderActions} onFontRenamed={onFontRenamed} />
        ) : (
          <div className="mmi-empty">
            <p>Select media from the library to view and edit its details.</p>
          </div>
        )
      )}
    </>
  )
}
