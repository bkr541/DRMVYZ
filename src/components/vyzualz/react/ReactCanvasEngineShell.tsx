import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { useReactStore } from '../../../stores/reactStore'
import { Collapsible, CtrlSection, SelectRow, SliderRow, ToggleRow } from './ReactControlRows'
import type { CanvasFitMode, CanvasMediaItem, CanvasMediaItemType } from './ReactTypes'

const CANVAS_DESCRIPTION = 'Upload your own media and turn it into audio-reactive visuals.'
const CANVAS_MEDIA_COPY = 'Videos, images, and SVGs uploaded here stay scoped to CANVAS.'
const CANVAS_ACCEPT = [
  'video/mp4', 'video/webm', 'video/quicktime',
  'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml',
  '.mp4', '.webm', '.mov', '.png', '.jpg', '.jpeg', '.webp', '.svg',
].join(',')

const CANVAS_HELPER_LINES = [
  'Upload media for CANVAS',
  'These files are used only inside the CANVAS engine.',
  'Select a file below to make it the active CANVAS visual.',
]

const TYPE_LABELS: Record<CanvasMediaItemType, string> = {
  video: 'Video',
  image: 'Image',
  svg:   'SVG',
}

function CanvasMediaTokens() {
  return (
    <div className="rv-canvas-media-tokens" aria-label="Supported CANVAS media types">
      <span>Video</span>
      <span>Images</span>
      <span>SVGs</span>
    </div>
  )
}

function getCanvasMediaType(file: File): CanvasMediaItemType | null {
  const name = file.name.toLowerCase()
  const mime = file.type.toLowerCase()

  if (mime === 'image/svg+xml' || name.endsWith('.svg')) return 'svg'
  if (
    mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/webp' ||
    name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp')
  ) return 'image'
  if (
    mime === 'video/mp4' || mime === 'video/webm' || mime === 'video/quicktime' || mime === 'video/x-quicktime' ||
    name.endsWith('.mp4') || name.endsWith('.webm') || name.endsWith('.mov')
  ) return 'video'

  return null
}

function createCanvasMediaId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `canvas-media-${crypto.randomUUID()}`
  }
  return `canvas-media-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function makeCanvasMediaItem(file: File): CanvasMediaItem | null {
  const type = getCanvasMediaType(file)
  if (!type) return null

  return {
    id: createCanvasMediaId(),
    name: file.name,
    type,
    objectUrl: URL.createObjectURL(file),
    mimeType: file.type || undefined,
    fileSize: file.size,
    createdAt: new Date().toISOString(),
  }
}

function formatBytes(bytes?: number): string {
  if (!Number.isFinite(bytes) || !bytes) return 'Local file'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function CanvasUploadControl({ compact = false }: { compact?: boolean }) {
  const addCanvasMediaItems = useReactStore(s => s.addCanvasMediaItems)
  const selectCanvasMediaItem = useReactStore(s => s.selectCanvasMediaItem)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleFiles = (files: File[]) => {
    if (files.length === 0) return

    const accepted: CanvasMediaItem[] = []
    const rejected: string[] = []

    files.forEach(file => {
      const item = makeCanvasMediaItem(file)
      if (item) accepted.push(item)
      else rejected.push(file.name)
    })

    if (accepted.length > 0) {
      addCanvasMediaItems(accepted)
      selectCanvasMediaItem(accepted[0].id)
    }

    setUploadError(rejected.length > 0
      ? `Unsupported CANVAS media: ${rejected.slice(0, 3).join(', ')}${rejected.length > 3 ? '…' : ''}`
      : null)
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(Array.from(event.currentTarget.files ?? []))
    event.currentTarget.value = ''
  }

  return (
    <div className={`rv-canvas-upload-flow${compact ? ' rv-canvas-upload-flow--compact' : ''}`}>
      <div className="rv-canvas-upload-copy">
        {CANVAS_HELPER_LINES.map(line => <span key={line}>{line}</span>)}
      </div>
      <label className="rv-canvas-upload-target">
        <input
          ref={inputRef}
          type="file"
          accept={CANVAS_ACCEPT}
          multiple
          onChange={handleChange}
        />
        <span className="rv-canvas-upload-target__title">Choose CANVAS media</span>
        <span className="rv-canvas-upload-target__meta">MP4, WebM, MOV, PNG, JPG, WebP, SVG</span>
      </label>
      {uploadError && <div className="rv-canvas-upload-error">{uploadError}</div>}
    </div>
  )
}

function CanvasActivePreview() {
  const activeCanvasMediaId = useReactStore(s => s.activeCanvasMediaId)
  const mediaItems = useReactStore(s => s.canvasMediaItems)
  const activeItem = useMemo(
    () => mediaItems.find(item => item.id === activeCanvasMediaId) ?? null,
    [activeCanvasMediaId, mediaItems],
  )

  if (!activeItem) {
    return (
      <div className="rv-canvas-active-preview rv-canvas-active-preview--empty">
        <div className="rv-canvas-active-preview__eyebrow">Active CANVAS Visual</div>
        <div className="rv-canvas-active-preview__title">No media selected</div>
        <div className="rv-canvas-active-preview__copy">Upload media below, then choose a file from the CANVAS library.</div>
      </div>
    )
  }

  return (
    <div className="rv-canvas-active-preview">
      <div className="rv-canvas-active-preview__header">
        <span>Active CANVAS Visual</span>
        <strong>{TYPE_LABELS[activeItem.type]}</strong>
      </div>
      <div className={`rv-canvas-active-preview__frame rv-canvas-active-preview__frame--${activeItem.type}`}>
        {activeItem.type === 'video' ? (
          <video src={activeItem.objectUrl} muted playsInline controls preload="metadata" />
        ) : (
          <img src={activeItem.objectUrl} alt="" />
        )}
      </div>
      <div className="rv-canvas-active-preview__name" title={activeItem.name}>{activeItem.name}</div>
    </div>
  )
}

function CanvasMediaLibrary({ compact = false }: { compact?: boolean }) {
  const mediaItems = useReactStore(s => s.canvasMediaItems)
  const activeCanvasMediaId = useReactStore(s => s.activeCanvasMediaId)
  const selectCanvasMediaItem = useReactStore(s => s.selectCanvasMediaItem)
  const removeCanvasMediaItem = useReactStore(s => s.removeCanvasMediaItem)

  const handleRemove = (item: CanvasMediaItem) => {
    removeCanvasMediaItem(item.id)
  }

  if (mediaItems.length === 0) {
    return (
      <div className={`rv-canvas-empty-state${compact ? ' rv-canvas-empty-state--compact' : ''}`}>
        <strong>No CANVAS media uploaded yet.</strong>
        <span>Imported files will appear here and stay scoped to the CANVAS engine.</span>
      </div>
    )
  }

  return (
    <div className={`rv-canvas-library${compact ? ' rv-canvas-library--compact' : ''}`}>
      {mediaItems.map(item => {
        const active = item.id === activeCanvasMediaId
        return (
          <div key={item.id} className={`rv-canvas-media-card${active ? ' rv-canvas-media-card--active' : ''}`}>
            <button
              type="button"
              className="rv-canvas-media-card__select"
              onClick={() => selectCanvasMediaItem(item.id)}
              aria-pressed={active}
            >
              <span className={`rv-canvas-media-card__thumb rv-canvas-media-card__thumb--${item.type}`}>
                {item.type === 'video' ? (
                  <span className="rv-canvas-media-card__video-mark">▶</span>
                ) : (
                  <img src={item.objectUrl} alt="" />
                )}
              </span>
              <span className="rv-canvas-media-card__body">
                <span className="rv-canvas-media-card__name" title={item.name}>{item.name}</span>
                <span className="rv-canvas-media-card__meta">
                  <span>{TYPE_LABELS[item.type]}</span>
                  <span>{formatBytes(item.fileSize)}</span>
                </span>
              </span>
              {active && <span className="rv-canvas-media-card__active">Active</span>}
            </button>
            <button
              type="button"
              className="rv-canvas-media-card__remove"
              onClick={() => handleRemove(item)}
              aria-label={`Remove ${item.name} from CANVAS media`}
            >
              Remove
            </button>
          </div>
        )
      })}
    </div>
  )
}

const CANVAS_FIT_LABELS: Record<CanvasFitMode, string> = {
  contain: 'Contain',
  cover:   'Cover',
  stretch: 'Stretch',
}

function canvasObjectFit(fitMode: CanvasFitMode): CSSProperties['objectFit'] {
  if (fitMode === 'stretch') return 'fill'
  return fitMode
}

function makeCanvasMediaStyle(settings: ReturnType<typeof useReactStore.getState>['canvasEngineSettings']): CSSProperties {
  return {
    objectFit: canvasObjectFit(settings.fitMode),
    opacity: settings.opacity,
    transform: `translate(${settings.positionX}%, ${settings.positionY}%) rotate(${settings.rotation}deg) scale(${settings.scale})`,
  }
}

function playCanvasVideo(video: HTMLVideoElement | null) {
  if (!video) return
  const playPromise = video.play()
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => undefined)
  }
}

export function CanvasEngineSurface({
  isPlaying,
  isPaused,
}: {
  isPlaying: boolean
  isPaused: boolean
}) {
  const settings = useReactStore(s => s.canvasEngineSettings)
  const activeCanvasMediaId = useReactStore(s => s.activeCanvasMediaId)
  const mediaItems = useReactStore(s => s.canvasMediaItems)
  const restartRevision = useReactStore(s => s.canvasVideoRestartRevision)
  const restartCanvasVideo = useReactStore(s => s.restartCanvasVideo)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const activeItem = useMemo(
    () => mediaItems.find(item => item.id === activeCanvasMediaId) ?? null,
    [activeCanvasMediaId, mediaItems],
  )
  const mediaStyle = useMemo(() => makeCanvasMediaStyle(settings), [settings])
  const activeVideo = activeItem?.type === 'video'

  useEffect(() => {
    const video = videoRef.current
    if (!video || !activeVideo) return

    video.muted = true
    video.loop = settings.loopVideo
    video.playsInline = true

    if (isPlaying && !isPaused) playCanvasVideo(video)
    else video.pause()
  }, [activeVideo, activeItem?.id, isPaused, isPlaying, settings.loopVideo])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !activeVideo) return

    video.currentTime = 0
    if (isPlaying && !isPaused) playCanvasVideo(video)
  }, [activeVideo, activeItem?.id, isPaused, isPlaying, restartRevision])

  useEffect(() => () => {
    videoRef.current?.pause()
  }, [])

  if (!activeItem) {
    return (
      <div className="rv-canvas-engine-surface rv-canvas-engine-surface--empty" role="region" aria-label="CANVAS engine media surface">
        <div className="rv-canvas-live-empty-card">
          <div className="rv-canvas-engine-eyebrow">CANVAS Uploaded Media</div>
          <h2 className="rv-canvas-live-empty-title">No active CANVAS media selected</h2>
          <p className="rv-canvas-engine-desc">
            Upload a video, image, or SVG in the CANVAS engine panel, then select it to make it the main React View visual.
          </p>
          <CanvasMediaTokens />
          <CanvasUploadControl />
        </div>
      </div>
    )
  }

  return (
    <div className="rv-canvas-engine-surface" role="region" aria-label="CANVAS engine media surface">
      <div className="rv-canvas-live-output" data-fit-mode={settings.fitMode}>
        <div className="rv-canvas-live-grid" aria-hidden="true" />
        <div className="rv-canvas-live-media-shell">
          {activeVideo ? (
            <video
              key={activeItem.id}
              ref={videoRef}
              src={activeItem.objectUrl}
              className="rv-canvas-live-media"
              style={mediaStyle}
              muted
              playsInline
              loop={settings.loopVideo}
              preload="auto"
            />
          ) : (
            <img
              key={activeItem.id}
              src={activeItem.objectUrl}
              alt=""
              className="rv-canvas-live-media"
              style={mediaStyle}
              draggable={false}
            />
          )}
        </div>
        <div className="rv-canvas-live-badge">
          <span>CANVAS uploaded media</span>
          <strong title={activeItem.name}>{activeItem.name}</strong>
          <em>{TYPE_LABELS[activeItem.type]} · {CANVAS_FIT_LABELS[settings.fitMode]}</em>
        </div>
        {activeVideo && (
          <div className="rv-canvas-live-video-strip" aria-label="CANVAS video playback status">
            <span>{isPlaying && !isPaused ? 'Audio-linked playback' : 'Waiting for React transport'}</span>
            <strong>{settings.loopVideo ? 'Loop on' : 'Loop off'}</strong>
            <button type="button" onClick={restartCanvasVideo}>Restart clip</button>
            <em>Muted</em>
          </div>
        )}
      </div>
    </div>
  )
}

export function CanvasEnginePanel() {
  const settings = useReactStore(s => s.canvasEngineSettings)
  const mediaCount = useReactStore(s => s.canvasMediaItems.length)
  return (
    <>
      <CtrlSection label="CANVAS" />
      <div className="rv-canvas-engine-panel">
        <div className="rv-canvas-panel-title">Media Visuals</div>
        <div className="rv-canvas-panel-copy">{CANVAS_MEDIA_COPY}</div>
        <CanvasMediaTokens />
        <CanvasUploadControl compact />
        <CanvasMediaLibrary compact />
        <div className="rv-canvas-panel-status">
          <span>Loaded media</span>
          <strong>{mediaCount}</strong>
        </div>
        <div className="rv-canvas-panel-status">
          <span>Upload scope</span>
          <strong>{settings.uploadEnabled ? 'CANVAS only' : 'Disabled'}</strong>
        </div>
      </div>
    </>
  )
}

export function CanvasEngineFxPlaceholder() {
  const settings = useReactStore(s => s.canvasEngineSettings)
  const setCanvasEngineSettings = useReactStore(s => s.setCanvasEngineSettings)
  const restartCanvasVideo = useReactStore(s => s.restartCanvasVideo)
  const activeCanvasMediaId = useReactStore(s => s.activeCanvasMediaId)
  const activeItem = useReactStore(s => s.canvasMediaItems.find(item => item.id === activeCanvasMediaId) ?? null)
  const hasActiveVideo = activeItem?.type === 'video'

  const setSettings = (patch: Partial<typeof settings>) => {
    setCanvasEngineSettings(patch)
  }

  return (
    <div className="rv-ctrl-group">
      <Collapsible label="CANVAS Media" defaultOpen>
        <div className="rv-canvas-panel-copy">{CANVAS_MEDIA_COPY}</div>
        <ToggleRow
          label="Auto Select"
          value={settings.autoSelectEnabled}
          onChange={() => undefined}
          disabled
          title="CANVAS Auto Select arrives in a later preset/audio intelligence patch."
          description={activeItem ? `Manual media override: ${activeItem.name}` : 'Upload media first. Audio Intelligence media selection is not enabled yet.'}
        />
        <CanvasUploadControl compact />
      </Collapsible>

      <Collapsible label="Display" defaultOpen>
        <SelectRow
          label="Fit Mode"
          value={settings.fitMode}
          onChange={value => setSettings({ fitMode: value as CanvasFitMode })}
          options={[
            { value: 'contain', label: 'Contain' },
            { value: 'cover', label: 'Cover' },
            { value: 'stretch', label: 'Stretch' },
          ]}
        />
        <SliderRow
          label="Scale"
          value={settings.scale}
          onChange={value => setSettings({ scale: value })}
          min={0.1}
          max={4}
          step={0.01}
          color="#61d6aa"
        />
        <SliderRow
          label="Position X"
          value={settings.positionX}
          onChange={value => setSettings({ positionX: value })}
          min={-100}
          max={100}
          step={1}
          color="#4ac7db"
        />
        <SliderRow
          label="Position Y"
          value={settings.positionY}
          onChange={value => setSettings({ positionY: value })}
          min={-100}
          max={100}
          step={1}
          color="#4ac7db"
        />
        <SliderRow
          label="Rotation"
          value={settings.rotation}
          onChange={value => setSettings({ rotation: value })}
          min={-180}
          max={180}
          step={1}
          color="#d8b95a"
        />
        <SliderRow
          label="Opacity"
          value={settings.opacity}
          onChange={value => setSettings({ opacity: value })}
          min={0}
          max={1}
          step={0.01}
          color="#b84fc9"
        />
      </Collapsible>

      <Collapsible label="Video Playback" defaultOpen>
        <ToggleRow
          label="Loop Video"
          value={settings.loopVideo}
          onChange={value => setSettings({ loopVideo: value })}
          description={hasActiveVideo ? 'Video playback follows the React audio transport and stays muted by default.' : 'Loop applies when the active CANVAS visual is a video.'}
        />
        <button
          type="button"
          className="rv-reset-btn rv-canvas-restart-btn"
          onClick={restartCanvasVideo}
          disabled={!hasActiveVideo}
        >
          Restart Clip
        </button>
        <div className="rv-canvas-engine-note">
          {hasActiveVideo
            ? 'Video audio is muted so uploaded clips do not compete with the loaded track.'
            : 'Images and SVGs use the same fit, scale, position, rotation, and opacity controls.'}
        </div>
      </Collapsible>
    </div>
  )
}
