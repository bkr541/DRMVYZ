import { useState, useRef, useEffect, useCallback, useId } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { mediaMutationKey, useMediaStore } from '../../stores/mediaStore'
import type { MediaCollection, UploadedMedia, UploadWorkflowPhase } from '../../stores/mediaStore'
import {
  VISUAL_MEDIA_ROLES,
  MEDIA_ROLE_LABELS,
  MEDIA_ROLE_ICONS,
  ENERGY_LABELS,
  MUSICAL_KEYS,
  suggestMediaRole,
  roleImpliesAlpha,
  isAudioFile,
  isSvgFilename,
} from '../../lib/mediaRoles'
import type { MediaRole, MediaEnergy } from '../../lib/mediaRoles'
import { analyzeAudioFile } from '../../utils/analyzeAudioFile'
import { useAudioStore } from '../../stores/audioStore'
import type { SavedAudioTrack } from '../../stores/audioStore'
import { analyzeSvgCapabilities } from './react/renderers/svgCapabilityAnalysis'
import { Dropdown, DropdownSelect } from '../shared/Dropdown/Dropdown'

// ── Local display metadata ────────────────────────────────────────────────────
// Separate from store queue — purely for thumbnail/dims display in modal file list

interface EntryDisplay {
  thumbnailUrl: string | null
  width?: number
  height?: number
  duration?: number
  isAudio?: boolean
  status: 'ready' | 'uploading' | 'done' | 'error'
  phase?: UploadWorkflowPhase
  errorMsg?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function grabVideoThumb(url: string): Promise<string | null> {
  return new Promise(resolve => {
    const v = document.createElement('video')
    v.muted = true; v.playsInline = true
    v.preload = 'metadata'; v.crossOrigin = 'anonymous'
    v.src = url; v.currentTime = 0.5
    const draw = () => {
      try {
        const c = document.createElement('canvas')
        c.width = 80; c.height = 45
        c.getContext('2d')?.drawImage(v, 0, 0, 80, 45)
        resolve(c.toDataURL('image/jpeg', 0.7))
      } catch { resolve(null) }
    }
    v.onseeked = draw; v.onerror = () => resolve(null)
    v.onloadeddata = () => { if (v.readyState >= 2) draw() }
  })
}

function getImgDims(url: string): Promise<{ w: number; h: number } | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function getVidDuration(url: string): Promise<number> {
  return new Promise(resolve => {
    const v = document.createElement('video')
    v.preload = 'metadata'; v.crossOrigin = 'anonymous'
    v.onloadedmetadata = () => resolve(v.duration || 0)
    v.onerror = () => resolve(0)
    v.src = url
  })
}

function fmtSize(bytes: number): string {
  if (bytes < 1024)            return `${bytes} B`
  if (bytes < 1024 * 1024)     return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function fmtDur(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function getFilenameWithoutExt(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

const AUDIO_ACCEPT = [
  'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/aiff', 'audio/x-aiff',
  'audio/flac', 'audio/ogg', 'audio/mp4', 'audio/x-m4a',
  '.mp3', '.wav', '.aif', '.aiff', '.m4a', '.ogg', '.flac',
].join(',')

const ACCEPT = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/quicktime', 'video/webm',
  'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/aiff', 'audio/x-aiff',
  'audio/flac', 'audio/ogg', 'audio/mp4', 'audio/x-m4a',
  '.mp4', '.mov', '.webm', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.mp3', '.wav', '.aif', '.aiff', '.m4a', '.ogg', '.flac',
].join(',')

const MAX_FILE_LABEL = '5 GB'

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status, phase, errorMsg }: { status: EntryDisplay['status']; phase?: UploadWorkflowPhase; errorMsg?: string }) {
  const phaseLabel: Partial<Record<UploadWorkflowPhase, string>> = {
    preparing: 'Preparing…',
    uploading_original: 'Uploading original…',
    preparing_derivative: 'Preparing derivative…',
    saving_record: 'Saving record…',
    applying_organization: 'Applying organization…',
    finalizing: 'Finalizing…',
    cleanup_pending: 'Cleanup pending',
    cancelled: 'Cancelled',
  }
  if (status === 'uploading') return <span className="mum-badge mum-badge--uploading">{phaseLabel[phase ?? 'preparing'] ?? 'Uploading…'}</span>
  if (status === 'done')      return <span className="mum-badge mum-badge--done">Done</span>
  if (status === 'error')     return <span className="mum-badge mum-badge--error" title={errorMsg}>Error</span>
  return <span className="mum-badge mum-badge--ready">Ready</span>
}

function TagChips({ tags, onRemove }: { tags: string[]; onRemove: (t: string) => void }) {
  return (
    <>
      {tags.map(t => (
        <span key={t} className="mum-chip">
          {t}
          <button className="mum-chip-x" onClick={() => onRemove(t)} aria-label={`Remove tag ${t}`}>×</button>
        </span>
      ))}
    </>
  )
}

function CollectionChips({ ids, collections, onRemove }: {
  ids: string[]; collections: MediaCollection[]; onRemove: (id: string) => void
}) {
  return (
    <>
      {ids.map(id => {
        const name = collections.find(c => c.id === id)?.name ?? id
        return (
          <span key={id} className="mum-chip mum-chip--coll">
            {name}
            <button className="mum-chip-x" onClick={() => onRemove(id)} aria-label={`Remove collection ${name}`}>×</button>
          </span>
        )
      })}
    </>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface MediaUploadModalProps {
  onClose: () => void
  editItem?: UploadedMedia
  audioOnly?: boolean
  onAudioUploaded?: (tracks: SavedAudioTrack[]) => void
  /** Keep files preloaded by Media Manager drag-and-drop instead of clearing them on mount. */
  preserveQueuedFiles?: boolean
}

export function MediaUploadModal({
  onClose, editItem, audioOnly = false, onAudioUploaded, preserveQueuedFiles = false,
}: MediaUploadModalProps) {
  const isEdit = !!editItem

  const {
    uploadQueue,
    addFilesToUploadQueue,
    removeUploadQueueItem,
    clearUploadQueue,
    uploadDraft,
    setUploadDraftRole,
    setUploadDraftTitle,
    setUploadDraftDescription,
    setUploadDraftTags,
    setUploadDraftCollections,
    setUploadDraftMetadata,
    replaceUploadDraftMetadata,
    setUploadDraftAudioArtist,
    setUploadDraftAudioGenre,
    setUploadDraftAudioBpm,
    setUploadDraftAudioMusicalKey,
    resetUploadDraft,
    uploadQueuedMedia,
    saveMediaEdits,
    collections,
    createCollection,
    loadCollections,
    loadError,
    clearLoadError,
    items,
    mutationStates,
    retryMediaMutation,
    reapplyMediaMutation,
    clearMediaMutation,
  } = useMediaStore(useShallow(state => ({
    uploadQueue: state.uploadQueue,
    addFilesToUploadQueue: state.addFilesToUploadQueue,
    removeUploadQueueItem: state.removeUploadQueueItem,
    clearUploadQueue: state.clearUploadQueue,
    uploadDraft: state.uploadDraft,
    setUploadDraftRole: state.setUploadDraftRole,
    setUploadDraftTitle: state.setUploadDraftTitle,
    setUploadDraftDescription: state.setUploadDraftDescription,
    setUploadDraftTags: state.setUploadDraftTags,
    setUploadDraftCollections: state.setUploadDraftCollections,
    setUploadDraftMetadata: state.setUploadDraftMetadata,
    replaceUploadDraftMetadata: state.replaceUploadDraftMetadata,
    setUploadDraftAudioArtist: state.setUploadDraftAudioArtist,
    setUploadDraftAudioGenre: state.setUploadDraftAudioGenre,
    setUploadDraftAudioBpm: state.setUploadDraftAudioBpm,
    setUploadDraftAudioMusicalKey: state.setUploadDraftAudioMusicalKey,
    resetUploadDraft: state.resetUploadDraft,
    uploadQueuedMedia: state.uploadQueuedMedia,
    saveMediaEdits: state.saveMediaEdits,
    collections: state.collections,
    createCollection: state.createCollection,
    loadCollections: state.loadCollections,
    loadError: state.loadError,
    clearLoadError: state.clearLoadError,
    items: state.items,
    mutationStates: state.mutationStates,
    retryMediaMutation: state.retryMediaMutation,
    reapplyMediaMutation: state.reapplyMediaMutation,
    clearMediaMutation: state.clearMediaMutation,
  })))

  const editMutation = editItem ? mutationStates[mediaMutationKey(editItem.id, 'edit')] : undefined
  const canonicalEditItem = editItem ? items.find(item => item.id === editItem.id) ?? editItem : undefined

  // Local display metadata keyed by tempId — only for thumbnail/dims in file list
  const [displayMeta, setDisplayMeta] = useState<Map<string, EntryDisplay>>(new Map())
  // Detected BPM from background analysis (pre-fills the field when available)
  const [analyzingAudio, setAnalyzingAudio] = useState(false)

  const [tagInput,  setTagInput]  = useState('')
  const [collInput, setCollInput] = useState('')
  const [dragOver,  setDragOver]  = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [uploadAnother, setUploadAnother] = useState(false)
  const [bpmError,  setBpmError]  = useState('')
  const [batchError, setBatchError] = useState<string | null>(null)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [rasterSvgWarning, setRasterSvgWarning] = useState<{ file: File } | null>(null)

  const fileInputId = useId()
  const dropRef = useRef<HTMLDivElement>(null)
  const uploadAbortRef = useRef<AbortController | null>(null)

  useEffect(() => () => uploadAbortRef.current?.abort(), [])

  // Whether the current queue is all audio files
  const isAudioQueue = uploadQueue.length > 0 && uploadQueue.every(q => q.isAudio)
  // Whether every queued file is an SVG (hides ADDITIONAL INFO which doesn't apply to vector glyphs)
  const isSvgQueue   = !isEdit && uploadQueue.length > 0 && uploadQueue.every(q => q.suggestedRole === 'svg')

  useEffect(() => {
    clearLoadError()
    loadCollections()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset queue and draft on every fresh open so prior upload values don't persist
  useEffect(() => {
    if (!isEdit) {
      if (!preserveQueuedFiles) clearUploadQueue()
      resetUploadDraft()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Files dropped on the manager are queued before this modal mounts. Hydrate
  // their display metadata without rebuilding or duplicating the upload queue.
  useEffect(() => {
    if (isEdit || !preserveQueuedFiles || uploadQueue.length === 0) return
    let cancelled = false
    void Promise.all(uploadQueue.map(async (item): Promise<readonly [string, EntryDisplay]> => {
      if (item.isAudio) {
        const audio = new Audio()
        const duration = await new Promise<number>(resolve => {
          audio.onloadedmetadata = () => resolve(audio.duration || 0)
          audio.onerror = () => resolve(0)
          audio.src = item.previewUrl
        })
        return [item.tempId, { thumbnailUrl: null, isAudio: true, duration, status: 'ready' }] as const
      }
      const isVideo = item.file.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(item.file.name)
      if (isVideo) {
        const [thumbnailUrl, duration] = await Promise.all([
          grabVideoThumb(item.previewUrl),
          getVidDuration(item.previewUrl),
        ])
        return [item.tempId, { thumbnailUrl, duration, status: 'ready' }] as const
      }
      const dimensions = await getImgDims(item.previewUrl)
      return [item.tempId, {
        thumbnailUrl: item.previewUrl,
        width: dimensions?.w,
        height: dimensions?.h,
        status: 'ready',
      }] as const
    })).then(entries => {
      if (!cancelled) setDisplayMeta(new Map(entries))
    })
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill draft from editItem when in edit mode
  useEffect(() => {
    if (!editItem) return
    setUploadDraftRole(editItem.mediaRole)
    setUploadDraftTitle(editItem.title ?? '')
    setUploadDraftDescription(editItem.description ?? '')
    setUploadDraftTags([...editItem.tags])
    setUploadDraftCollections([...editItem.collectionIds])
    replaceUploadDraftMetadata(editItem.metadata)
    return () => { resetUploadDraft() }
  }, [editItem?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape (unless busy)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !uploading && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, uploading, saving])

  // Auto-suggest role when first file is added
  useEffect(() => {
    if (uploadQueue.length === 1) {
      const q = uploadQueue[0]
      if (q.isAudio) {
        setUploadDraftRole('audio_track')
        // Default title to filename without extension
        if (!uploadDraft.title) setUploadDraftTitle(getFilenameWithoutExt(q.file.name))
        // Background BPM detection
        setAnalyzingAudio(true)
        analyzeAudioFile(q.file)
          .then(result => {
            if (result.bpm !== null && !uploadDraft.audioBpm) {
              setUploadDraftAudioBpm(String(result.bpm))
            }
          })
          .catch(() => { /* non-fatal */ })
          .finally(() => setAnalyzingAudio(false))
      } else {
        const role = q.suggestedRole
        setUploadDraftRole(role)
        setUploadDraftMetadata({ hasAlpha: roleImpliesAlpha(role) })
      }
    }
  }, [uploadQueue.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRoleChange = (role: MediaRole) => {
    setUploadDraftRole(role)
    setUploadDraftMetadata({ hasAlpha: roleImpliesAlpha(role) })
  }

  const addFiles = useCallback(async (files: File[]) => {
    const valid = audioOnly
      ? files.filter(file => isAudioFile(file))
      : files.filter(f =>
          f.type.startsWith('image/') || f.type.startsWith('video/') || f.type.startsWith('audio/') ||
          /\.(png|jpe?g|gif|webp|svg|mp4|mov|webm|mp3|wav|aiff?|m4a|ogg|flac)$/i.test(f.name)
        )
    if (!valid.length) {
      setSelectionError('No supported files were selected.')
      return
    }
    const kinds = new Set(valid.map(file => isAudioFile(file) ? 'audio' : 'visual'))
    const queuedKind = uploadQueue[0] ? (uploadQueue[0].isAudio ? 'audio' : 'visual') : null
    if (kinds.size > 1 || (queuedKind && !kinds.has(queuedKind))) {
      setSelectionError('Upload audio and visual files in separate batches so each receives the correct metadata.')
      return
    }
    setSelectionError(null)

    // Screen SVG files for raster-only content before queuing
    const safeFiles: File[] = []
    for (const f of valid) {
      const isSvg = f.type === 'image/svg+xml' || isSvgFilename(f.name)
      if (isSvg) {
        try {
          const rawSvg = await f.text()
          const analysis = analyzeSvgCapabilities(rawSvg)
          if (analysis.isValidSvg && !analysis.hasVectorGeometry &&
              (analysis.hasEmbeddedRaster || analysis.hasExternalRaster)) {
            // Raster-only SVG: pause and show warning for this file
            setRasterSvgWarning({ file: f })
            // Queue the files already cleared as safe
            if (safeFiles.length > 0) {
              const prevLen2 = uploadQueue.length
              addFilesToUploadQueue(safeFiles)
              const newMeta2 = new Map<string, EntryDisplay>()
              await Promise.all(safeFiles.map(async (sf, i) => {
                const q = useMediaStore.getState().uploadQueue
                const item = q[prevLen2 + i]
                if (!item) return
                const dims = await getImgDims(item.previewUrl)
                newMeta2.set(item.tempId, { thumbnailUrl: item.previewUrl, width: dims?.w, height: dims?.h, status: 'ready' })
              }))
              setDisplayMeta(prev => {
                const next = new Map(prev)
                newMeta2.forEach((v, k) => next.set(k, v))
                return next
              })
            }
            return
          }
        } catch {
          // Can't read file — proceed with upload as-is
        }
      }
      safeFiles.push(f)
    }

    // No raster SVGs found — proceed with all valid files (safeFiles === valid at this point)
    const filesToQueue = safeFiles

    // Add to store queue first to get tempIds
    const prevLen = uploadQueue.length
    addFilesToUploadQueue(filesToQueue)

    // Build display metadata async
    const newMeta = new Map<string, EntryDisplay>()
    await Promise.all(filesToQueue.map(async (file, i) => {
      const queue = useMediaStore.getState().uploadQueue
      const item = queue[prevLen + i]
      if (!item) return

      const objUrl  = item.previewUrl
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.name)
      const isAudio = item.isAudio

      if (isAudio) {
        // Audio: show a waveform placeholder, duration via Audio element
        const audio = new Audio()
        const dur = await new Promise<number>(res => {
          audio.onloadedmetadata = () => res(audio.duration || 0)
          audio.onerror = () => res(0)
          audio.src = objUrl
        })
        newMeta.set(item.tempId, { thumbnailUrl: null, isAudio: true, duration: dur, status: 'ready' })
      } else if (isVideo) {
        const [thumb, duration] = await Promise.all([grabVideoThumb(objUrl), getVidDuration(objUrl)])
        newMeta.set(item.tempId, { thumbnailUrl: thumb, duration, status: 'ready' })
      } else {
        const dims = await getImgDims(objUrl)
        newMeta.set(item.tempId, {
          thumbnailUrl: objUrl,
          width: dims?.w, height: dims?.h,
          status: 'ready',
        })
      }
    }))

    setDisplayMeta(prev => {
      const next = new Map(prev)
      newMeta.forEach((v, k) => next.set(k, v))
      return next
    })
  }, [audioOnly, uploadQueue.length, addFilesToUploadQueue]) // eslint-disable-line react-hooks/exhaustive-deps

  const removeEntry = (tempId: string) => {
    removeUploadQueueItem(tempId)
    setDisplayMeta(prev => {
      const next = new Map(prev)
      next.delete(tempId)
      return next
    })
  }

  const clearAll = () => {
    clearUploadQueue()
    setDisplayMeta(new Map())
  }

  // Tags
  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
    if (tag && !uploadDraft.tags.includes(tag)) setUploadDraftTags([...uploadDraft.tags, tag])
    setTagInput('')
  }
  const removeTag = (t: string) => setUploadDraftTags(uploadDraft.tags.filter(x => x !== t))

  const handleTagKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); if (tagInput.trim()) addTag(tagInput) }
    if (e.key === 'Backspace' && !tagInput && uploadDraft.tags.length) {
      setUploadDraftTags(uploadDraft.tags.slice(0, -1))
    }
  }

  // Collections
  const filteredColls = collections.filter(c =>
    c.name.toLowerCase().includes(collInput.toLowerCase()) && !uploadDraft.collectionIds.includes(c.id)
  )
  const addCollection = (id: string) => {
    setUploadDraftCollections([...uploadDraft.collectionIds, id])
    setCollInput('')
  }
  const removeCollection = (id: string) =>
    setUploadDraftCollections(uploadDraft.collectionIds.filter(x => x !== id))

  const collectionDropdownOptions = collInput.trim()
    ? filteredColls.length > 0
      ? filteredColls.map(collection => ({ value: collection.id, label: collection.name }))
      : [{ value: '__create_collection__', label: `+ Create "${collInput.trim()}"` }]
    : []

  const handleCollectionDropdownChange = async (value: string) => {
    if (value !== '__create_collection__') {
      addCollection(value)
      return
    }
    const newId = await createCollection(collInput.trim())
    if (newId) addCollection(newId)
  }

  // BPM validation
  const handleBpmChange = (v: string) => {
    setUploadDraftAudioBpm(v)
    if (v && (isNaN(parseFloat(v)) || parseFloat(v) <= 0)) {
      setBpmError('BPM must be a positive number')
    } else {
      setBpmError('')
    }
  }

  // Upload
  const handleUpload = async () => {
    if (!uploadQueue.length || bpmError) return
    const controller = new AbortController()
    uploadAbortRef.current = controller
    setUploading(true)
    clearLoadError()
    setBatchError(null)
    setProgress({ completed: 0, total: uploadQueue.length })
    setDisplayMeta(prev => {
      const next = new Map(prev)
      next.forEach((value, key) => next.set(key, { ...value, status: 'ready', errorMsg: undefined }))
      return next
    })

    const beforeIds = new Set(useAudioStore.getState().savedTracks.map(track => track.dbId))
    try {
      const result = await uploadQueuedMedia({
        signal: controller.signal,
        onProgress: event => {
          setProgress({ completed: event.completed, total: event.total })
          setDisplayMeta(prev => {
            const next = new Map(prev)
            const current = next.get(event.tempId)
            if (current) next.set(event.tempId, { ...current, status: event.status, phase: event.phase, errorMsg: event.error })
            return next
          })
        },
      })
      const uploadedTracks = useAudioStore.getState().savedTracks.filter(track => !beforeIds.has(track.dbId))
      if (uploadedTracks.length > 0) onAudioUploaded?.(uploadedTracks)

      if (result.failures.length > 0) {
        setBatchError(result.succeeded > 0
          ? `${result.succeeded} file${result.succeeded === 1 ? '' : 's'} uploaded. ${result.failures.length} failed and can be retried.`
          : result.failures[0].error)
        return
      }

      if (uploadAnother) {
        setDisplayMeta(new Map())
        setProgress({ completed: 0, total: 0 })
        resetUploadDraft()
      } else {
        onClose()
      }
    } catch (error) {
      setBatchError(error instanceof Error ? error.message : 'The upload workflow stopped unexpectedly. Retry the remaining queued files.')
    } finally {
      uploadAbortRef.current = null
      setUploading(false)
    }
  }

  // Save edits (edit mode only)
  const handleSave = async () => {
    if (!editItem) return
    setSaving(true)
    clearLoadError()
    try {
      const saved = await saveMediaEdits(editItem.id, {
        role:          uploadDraft.role,
        title:         uploadDraft.title,
        description:   uploadDraft.description,
        tags:          uploadDraft.tags,
        collectionIds: uploadDraft.collectionIds,
        metadata:      uploadDraft.metadata,
      })
      if (saved) onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleRetryEdit = async () => {
    if (!editItem) return
    setSaving(true)
    try {
      const saved = await retryMediaMutation(editItem.id, 'edit')
      if (saved) onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleReapplyEdit = async () => {
    if (!editItem) return
    setSaving(true)
    try {
      const saved = await reapplyMediaMutation(editItem.id, 'edit')
      if (saved) onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleUseServerVersion = () => {
    if (!editItem || !canonicalEditItem) return
    setUploadDraftRole(canonicalEditItem.mediaRole)
    setUploadDraftTitle(canonicalEditItem.title ?? '')
    setUploadDraftDescription(canonicalEditItem.description ?? '')
    setUploadDraftTags([...canonicalEditItem.tags])
    setUploadDraftCollections([...canonicalEditItem.collectionIds])
    replaceUploadDraftMetadata(canonicalEditItem.metadata)
    clearMediaMutation(editItem.id, 'edit')
  }

  // Drag-drop
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  // Computed display info from first queue item
  const firstQueueItem = uploadQueue[0]
  const firstMeta      = firstQueueItem ? displayMeta.get(firstQueueItem.tempId) : undefined
  const detectedRes    = firstMeta?.width && firstMeta?.height ? `${firstMeta.width} × ${firstMeta.height}` : undefined
  const detectedDur    = firstMeta?.duration !== undefined ? firstMeta.duration.toFixed(2) : undefined

  const busy      = uploading || saving || editMutation?.status === 'pending'
  const canUpload = uploadQueue.length > 0 && !busy && !bpmError
  const canSave   = !busy

  // ── Additional Info item renderer ──────────────────────────────────────
  const adItem = (label: React.ReactNode, content: React.ReactNode, spanTwo = false) => (
    <div className={spanTwo ? 'mum-addinfo-item mum-addinfo-item--span2' : 'mum-addinfo-item'}>
      <div className="mum-addinfo-label">{label}</div>
      {content}
    </div>
  )
  const durContent    = <input className="mum-addinfo-input" type="number" min="0" step="0.01" placeholder="—" value={detectedDur ?? (uploadDraft.metadata.duration ?? '')} readOnly={detectedDur !== undefined} onChange={e => { if (detectedDur === undefined) setUploadDraftMetadata({ duration: parseFloat(e.target.value) || undefined }) }} />
  const resContent    = <input className="mum-addinfo-input" placeholder="—" value={detectedRes ?? (uploadDraft.metadata.width && uploadDraft.metadata.height ? `${uploadDraft.metadata.width} × ${uploadDraft.metadata.height}` : '')} readOnly />
  const fpsContent    = <input className="mum-addinfo-input" type="number" min="1" max="240" placeholder="e.g. 30" value={uploadDraft.metadata.fps ?? ''} onChange={e => setUploadDraftMetadata({ fps: parseFloat(e.target.value) || undefined })} />
  const bpmContent    = <input className="mum-addinfo-input" type="number" min="20" max="300" placeholder="e.g. 128" value={uploadDraft.metadata.bpm ?? ''} onChange={e => setUploadDraftMetadata({ bpm: parseFloat(e.target.value) || undefined })} />
  const loopContent   = <label className="mum-toggle"><input type="checkbox" checked={uploadDraft.metadata.loopable ?? false} onChange={e => setUploadDraftMetadata({ loopable: e.target.checked })} /><span className="mum-toggle-track"><span className="mum-toggle-thumb" /></span></label>
  const alphaContent  = <label className="mum-toggle"><input type="checkbox" checked={uploadDraft.metadata.hasAlpha ?? false} onChange={e => setUploadDraftMetadata({ hasAlpha: e.target.checked })} /><span className="mum-toggle-track"><span className="mum-toggle-thumb" /></span></label>
  const keyContent    = <div className="mum-select-wrap mum-select-wrap--sm"><DropdownSelect className="mum-select" value={uploadDraft.metadata.key ?? ''} onChange={e => setUploadDraftMetadata({ key: e.target.value || undefined })}><option value="">—</option>{MUSICAL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}</DropdownSelect></div>
  const energyContent = <div className="mum-select-wrap mum-select-wrap--sm"><DropdownSelect className="mum-select" value={uploadDraft.metadata.energy ?? ''} onChange={e => setUploadDraftMetadata({ energy: (e.target.value as MediaEnergy) || undefined })}><option value="">—</option>{(Object.keys(ENERGY_LABELS) as MediaEnergy[]).map(k => <option key={k} value={k}>{ENERGY_LABELS[k]}</option>)}</DropdownSelect></div>

  // ── Raster SVG warning handler ──────────────────────────────────────────────
  const handleRasterSvgContinue = useCallback(async () => {
    if (!rasterSvgWarning) return
    const { file } = rasterSvgWarning
    setRasterSvgWarning(null)
    const prevLen = uploadQueue.length
    addFilesToUploadQueue([file])
    const queue = useMediaStore.getState().uploadQueue
    const item  = queue[prevLen]
    if (item) {
      const dims = await getImgDims(item.previewUrl)
      setDisplayMeta(prev => new Map(prev).set(item.tempId, {
        thumbnailUrl: item.previewUrl,
        width: dims?.w, height: dims?.h,
        status: 'ready',
      }))
    }
  }, [rasterSvgWarning, uploadQueue.length, addFilesToUploadQueue])

  return (
    <>
    {/* ── Raster SVG warning dialog ─────────────────────────────────── */}
    {rasterSvgWarning && (
      <div className="mum-backdrop" style={{ zIndex: 1100 }} onClick={e => e.stopPropagation()}>
        <div className="mum-modal" role="alertdialog" aria-modal="true" style={{ maxWidth: 420, padding: '24px 28px' }}>
          <div className="mum-title" style={{ marginBottom: 8 }}>SVG Contains Only a Raster Image</div>
          <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 16, opacity: 0.85 }}>
            <strong>{rasterSvgWarning.file.name}</strong> wraps an embedded raster image rather than
            vector paths. It can still be uploaded and rendered as Original Artwork, but cannot
            be used as a Reactive Path glyph.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="mum-upload-btn"
              onClick={handleRasterSvgContinue}
            >
              Continue Upload
            </button>
            <button
              type="button"
              className="mum-upload-btn mum-upload-btn--secondary"
              onClick={() => setRasterSvgWarning(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}

    <div
      className="mum-backdrop"
      onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}
    >
      <div className="mum-modal" role="dialog" aria-modal="true" aria-label="Media Upload">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="mum-header">
          <div>
            <div className="mum-title">
              {isEdit ? 'EDIT MEDIA' : (audioOnly || isAudioQueue) ? 'AUDIO UPLOAD' : 'MEDIA UPLOAD'}
            </div>
            <div className="mum-subtitle">
              {isEdit
                ? 'Update metadata for this media item.'
                : isAudioQueue
                  ? 'Upload audio tracks to your library.'
                  : 'Upload media and organize with roles, tags, and collections.'}
            </div>
          </div>
          <button className="mum-close" onClick={() => { if (!busy) onClose() }} aria-label="Close">×</button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className="mum-body">

          {/* Left: drop zone + file list (hidden in edit mode) */}
          {!isEdit && <div className="mum-left">
            <div
              ref={dropRef}
              className={`mum-dropzone${dragOver ? ' mum-dropzone--over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <svg className="mum-cloud-icon" viewBox="-4 -8 72 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M48 32a8 8 0 0 0-8-8h-1.28A18 18 0 1 0 14 32" stroke="#19bff2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M32 38V20M26 26l6-6 6 6" stroke="#19bff2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div className="mum-drop-label">Drag &amp; drop media here</div>
              <div className="mum-drop-or">or</div>
              <label htmlFor={fileInputId} className="mum-browse-btn">Browse Files</label>
              <input
                id={fileInputId}
                type="file"
                accept={audioOnly ? AUDIO_ACCEPT : ACCEPT}
                multiple
                style={{ display: 'none' }}
                onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }}
              />
              {!audioOnly && <div className="mum-drop-hint">Supports: MP4, MOV, WEBM, PNG, JPG, GIF, WEBP, SVG</div>}
              <div className="mum-drop-hint">Audio: MP3, WAV, AIFF, M4A, OGG, FLAC</div>
              <div className="mum-drop-hint">Max file size: {MAX_FILE_LABEL}</div>
            </div>

            {/* File list */}
            {uploadQueue.length > 0 && (
              <div className="mum-filelist">
                <div className="mum-filelist-header">
                  <span>{uploadQueue.length} file{uploadQueue.length !== 1 ? 's' : ''} selected</span>
                  <button className="mum-filelist-clear" onClick={clearAll} disabled={uploading}>Clear</button>
                </div>
                <div className="mum-filelist-items">
                  {uploadQueue.map(q => {
                    const dm = displayMeta.get(q.tempId)
                    return (
                      <div key={q.tempId} className="mum-file-row">
                        <div className="mum-file-thumb">
                          {dm?.isAudio ? (
                            <div className="mum-file-thumb-audio">♪</div>
                          ) : dm?.thumbnailUrl ? (
                            <img src={dm.thumbnailUrl} alt="" />
                          ) : (
                            <div className="mum-file-thumb-placeholder" />
                          )}
                        </div>
                        <div className="mum-file-info">
                          <div className="mum-file-name">{q.file.name}</div>
                          <div className="mum-file-meta">
                            {fmtSize(q.file.size)}
                            {(dm?.width && dm?.height) ? ` · ${dm.width}×${dm.height}` : ''}
                            {dm?.duration !== undefined ? ` · ${fmtDur(dm.duration)}` : ''}
                          </div>
                          {dm?.status === 'error' && dm.errorMsg && (
                            <div className="mum-file-error" role="alert">{dm.errorMsg}</div>
                          )}
                        </div>
                        <StatusBadge status={dm?.status ?? 'ready'} phase={dm?.phase} errorMsg={dm?.errorMsg} />
                        <button
                          className="mum-file-remove"
                          onClick={() => removeEntry(q.tempId)}
                          disabled={uploading}
                          aria-label="Remove file"
                        >×</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>}

          {/* Right: metadata form */}
          <div className="mum-right">

            {/* ── Audio queue: locked role badge + Track Details ─── */}
            {isAudioQueue && !isEdit ? (
              <>
                {/* Locked role indicator */}
                <div className="mum-field">
                  <label className="mum-field-label">MEDIA ROLE</label>
                  <div className="mum-audio-role-badge">♪ Audio Track</div>
                </div>

                {/* Track title */}
                <div className="mum-field">
                  <label className="mum-field-label">TRACK TITLE <span className="mum-opt">(OPTIONAL)</span></label>
                  <input
                    className="mum-input"
                    placeholder={uploadQueue[0] ? getFilenameWithoutExt(uploadQueue[0].file.name) : 'e.g. My Track'}
                    maxLength={120}
                    value={uploadDraft.title}
                    onChange={e => setUploadDraftTitle(e.target.value)}
                  />
                </div>

                {/* Track Details group */}
                <div className="mum-field">
                  <label className="mum-field-label">
                    TRACK DETAILS
                    {analyzingAudio && <span className="mum-analyzing"> — Analyzing…</span>}
                  </label>
                  <div className="mum-track-details">
                    <div className="mum-track-detail-field">
                      <label className="mum-track-detail-label">ARTIST <span className="mum-opt">(OPTIONAL)</span></label>
                      <input
                        className="mum-input mum-input--sm"
                        placeholder="e.g. Artist Name"
                        value={uploadDraft.audioArtist}
                        onChange={e => setUploadDraftAudioArtist(e.target.value)}
                      />
                    </div>
                    <div className="mum-track-detail-field">
                      <label className="mum-track-detail-label">GENRE <span className="mum-opt">(OPTIONAL)</span></label>
                      <input
                        className="mum-input mum-input--sm"
                        placeholder="e.g. Electronic"
                        value={uploadDraft.audioGenre}
                        onChange={e => setUploadDraftAudioGenre(e.target.value)}
                      />
                    </div>
                    <div className="mum-track-detail-field">
                      <label className="mum-track-detail-label">BPM <span className="mum-opt">(OPTIONAL)</span></label>
                      <div className="mum-track-detail-control">
                        <input
                          className={`mum-input mum-input--sm${bpmError ? ' mum-input--error' : ''}`}
                          type="number"
                          min="1"
                          max="999"
                          step="0.1"
                          placeholder={analyzingAudio ? 'Detecting…' : 'e.g. 128'}
                          value={uploadDraft.audioBpm}
                          onChange={e => handleBpmChange(e.target.value)}
                        />
                        {bpmError && <div className="mum-field-error">{bpmError}</div>}
                      </div>
                    </div>
                    <div className="mum-track-detail-field">
                      <label className="mum-track-detail-label">KEY <span className="mum-opt">(OPTIONAL)</span></label>
                      <div className="mum-select-wrap mum-track-detail-control">
                        <DropdownSelect
                          className="mum-select"
                          value={uploadDraft.audioMusicalKey}
                          onChange={e => setUploadDraftAudioMusicalKey(e.target.value)}
                        >
                          <option value="">—</option>
                          {MUSICAL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                        </DropdownSelect>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* ── Visual media fields (existing) ─────────────── */}

                {/* Media Role */}
                <div className="mum-field">
                  <label className="mum-field-label">MEDIA ROLE<span className="mum-req">*</span></label>
                  <div className="mum-select-wrap">
                    <DropdownSelect
                      className="mum-select"
                      value={uploadDraft.role}
                      onChange={e => handleRoleChange(e.target.value as MediaRole)}
                    >
                      {VISUAL_MEDIA_ROLES.map(r => (
                        <option key={r} value={r}>
                          {MEDIA_ROLE_ICONS[r]}  {MEDIA_ROLE_LABELS[r]}
                        </option>
                      ))}
                    </DropdownSelect>
                  </div>
                  <div className="mum-field-hint">Role affects placement and visual behavior. You can change it later in the Clip Inspector.</div>
                </div>

                {/* Title */}
                <div className="mum-field">
                  <label className="mum-field-label">TITLE <span className="mum-opt">(OPTIONAL)</span></label>
                  <input
                    className="mum-input"
                    placeholder="e.g. Portal Loop Alpha"
                    maxLength={160}
                    value={uploadDraft.title}
                    onChange={e => setUploadDraftTitle(e.target.value)}
                  />
                </div>

                {/* Description */}
                <div className="mum-field">
                  <label className="mum-field-label">DESCRIPTION <span className="mum-opt">(OPTIONAL)</span></label>
                  <textarea
                    className="mum-textarea"
                    rows={3}
                    placeholder="Describe this media…"
                    value={uploadDraft.description}
                    onChange={e => setUploadDraftDescription(e.target.value)}
                  />
                </div>

                {/* Tags + Collections (side-by-side in edit mode) */}
                <div className={isEdit ? 'mum-fields-row' : 'mum-fields-col'}>
                  <div className="mum-field">
                    <label className="mum-field-label">TAGS</label>
                    <div className="mum-field-hint">Add or create tags to describe this media.</div>
                    <div className="mum-chip-input">
                      <TagChips tags={uploadDraft.tags} onRemove={removeTag} />
                      <input
                        className="mum-chip-text"
                        placeholder="Type to add tags…"
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={handleTagKey}
                        onBlur={() => { if (tagInput.trim()) addTag(tagInput) }}
                      />
                      <svg className="mum-chip-caret" viewBox="0 0 10 6" fill="currentColor">
                        <path d="M0 0l5 6 5-6z"/>
                      </svg>
                    </div>
                  </div>

                  <div className="mum-field">
                    <label className="mum-field-label">COLLECTIONS</label>
                    <div className="mum-field-hint">Add this media to one or more collections.</div>
                    <div className="mum-collection-dropdown-field">
                      <CollectionChips
                        ids={uploadDraft.collectionIds}
                        collections={collections}
                        onRemove={removeCollection}
                      />
                      <Dropdown
                        id="media-collections"
                        searchable
                        searchValue={collInput}
                        onSearchChange={setCollInput}
                        value={null}
                        options={collectionDropdownOptions}
                        onChange={value => { void handleCollectionDropdownChange(value) }}
                        placeholder="Type to search or create…"
                        ariaLabel="Collections"
                        menuLabel="Collections"
                        size="compact"
                        maxMenuHeight={260}
                        showDescriptions={false}
                        className="mum-collections-dropdown"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Info — hidden for SVG-only queues (duration/fps/energy don't apply to vector glyphs) */}
                {!isSvgQueue && (
                  <div className="mum-field">
                    <label className="mum-field-label">ADDITIONAL INFO</label>
                    {!isEdit ? (
                      <div className="mum-addinfo-grid">
                        {adItem('DURATION (SEC)', durContent)}
                        {adItem('RESOLUTION', resContent)}
                        {adItem(<>FPS <span className="mum-opt">(OPTIONAL)</span></>, fpsContent)}
                        {adItem('LOOPABLE', loopContent)}
                        {adItem('HAS ALPHA', alphaContent)}
                        {adItem(<>BPM <span className="mum-opt">(OPTIONAL)</span></>, bpmContent)}
                        {adItem(<>KEY <span className="mum-opt">(OPTIONAL)</span></>, keyContent)}
                        {adItem('ENERGY', energyContent)}
                      </div>
                    ) : (
                      <div className="mum-addinfo-grid mum-addinfo-grid--edit">
                        {adItem('DURATION (SEC)', durContent, true)}
                        {adItem('RESOLUTION', resContent, true)}
                        {adItem(<>FPS <span className="mum-opt">(OPTIONAL)</span></>, fpsContent, true)}
                        {adItem(<>BPM <span className="mum-opt">(OPTIONAL)</span></>, bpmContent, true)}
                        {adItem('HAS ALPHA', alphaContent)}
                        {adItem(<>KEY <span className="mum-opt">(OPTIONAL)</span></>, keyContent)}
                        {adItem('LOOPABLE', loopContent)}
                        {adItem('ENERGY', energyContent)}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

          </div>{/* /mum-right */}
        </div>{/* /mum-body */}

        {isEdit && editMutation?.status === 'conflict' && (
          <div className="mum-conflict-panel" role="alert">
            <div className="mum-conflict-copy">
              <strong>Newer media changes are available.</strong>
              <span>{editMutation.message} Your attempted values are still in this form.</span>
            </div>
            <div className="mum-conflict-actions">
              <button type="button" className="mum-cancel-btn" disabled={saving} onClick={handleUseServerVersion}>Use Server Version</button>
              <button type="button" className="mum-upload-btn" disabled={saving} onClick={handleReapplyEdit}>{saving ? 'Reapplying…' : 'Reapply My Changes'}</button>
            </div>
          </div>
        )}
        {isEdit && editMutation?.status === 'failed' && (
          <div className="mum-conflict-panel mum-conflict-panel--error" role="alert">
            <div className="mum-conflict-copy">
              <strong>Media changes were not saved.</strong>
              <span>{editMutation.message}</span>
            </div>
            <div className="mum-conflict-actions">
              <button type="button" className="mum-upload-btn" disabled={saving} onClick={handleRetryEdit}>{saving ? 'Retrying…' : 'Retry Save'}</button>
            </div>
          </div>
        )}
        {(selectionError || batchError || (isEdit && loadError)) && (
          <div className="mum-batch-error" role="alert">{selectionError ?? batchError ?? loadError}</div>
        )}
        {uploading && progress.total > 0 && (
          <div className="mum-progress" aria-label={`Uploaded ${progress.completed} of ${progress.total} files`}>
            <div className="mum-progress-bar" style={{ width: `${Math.round((progress.completed / progress.total) * 100)}%` }} />
            <span>{progress.completed} / {progress.total}</span>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className={`mum-footer${isEdit ? ' mum-footer--edit' : ''}`}>
          <button
            className="mum-cancel-btn"
            onClick={() => {
              if (uploading) uploadAbortRef.current?.abort()
              else if (!busy) onClose()
            }}
          >
            {uploading ? 'Cancel Upload' : 'Cancel'}
          </button>
          {!isEdit && (
            <label className="mum-upload-another">
              <input
                type="checkbox"
                checked={uploadAnother}
                onChange={e => setUploadAnother(e.target.checked)}
              />
              Upload another
            </label>
          )}
          {isEdit ? (
            <button
              className="mum-upload-btn"
              disabled={!canSave}
              onClick={handleSave}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          ) : (
            <button
              className="mum-upload-btn"
              disabled={!canUpload}
              onClick={handleUpload}
            >
              {uploading
                ? `Uploading ${progress.completed}/${progress.total}…`
                : isAudioQueue
                  ? `Upload ${uploadQueue.length > 0 ? uploadQueue.length + ' ' : ''}Track${uploadQueue.length !== 1 ? 's' : ''}`
                  : `Upload ${uploadQueue.length > 0 ? uploadQueue.length + ' ' : ''}Media`}
            </button>
          )}
        </div>

      </div>
    </div>
    </>
  )
}
