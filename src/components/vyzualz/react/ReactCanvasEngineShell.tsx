import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useReactStore } from '../../../stores/reactStore'
import { useMediaStore, type UploadedMedia } from '../../../stores/mediaStore'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { AudioFeatureBus } from '../../../features/musicIntelligence/AudioFeatureBus'
import { musicIntelligenceEngine } from '../../../features/musicIntelligence/MusicIntelligenceEngine'
import type { FeatureCurve, MusicIntelligenceFrame, TrackIntelligenceAnalysis } from '../../../features/musicIntelligence/types'
import { Collapsible, CtrlSection, NumberInputRow, SelectRow, SliderRow, ToggleRow } from './ReactControlRows'
import { MediaLibraryBrowser } from '../media/MediaLibraryBrowser'
import { CANVAS_MEDIA_LIBRARY_CAPABILITIES } from '../media/mediaLibraryCapabilities'
import {
  CANVAS_PRESET_BY_ID,
  DEFAULT_CANVAS_PRESET_ID,
  DEFAULT_CANVAS_VIDEO_TIMING_SETTINGS,
  type CanvasFitMode,
  type CanvasMediaItem,
  type CanvasMediaItemType,
  type CanvasPresetColorMode,
  type CanvasPresetControlKey,
  type CanvasPresetId,
  type CanvasPresetSettings,
  type CanvasSectionTriggerType,
  type CanvasTriggerOn,
  type CanvasVideoTimingSettings,
  type ReactSectionType,
  type ReactTrackSection,
} from './ReactTypes'

const CANVAS_DESCRIPTION = 'CANVAS renders your saved user media as audio-reactive visuals.'
const CANVAS_MEDIA_COPY = 'Select from your media library.'
const CANVAS_LIBRARY_HELPER_COPY = 'Add media to library with the existing DRMVYZ upload flow, then select it here.'

const TYPE_LABELS: Record<CanvasMediaItemType, string> = {
  video: 'Video',
  image: 'Image',
  svg:   'SVG',
}

const CANVAS_TRIGGER_OPTIONS: Array<{ value: CanvasTriggerOn; label: string }> = [
  { value: 'manualOnly', label: 'Manual Only' },
  { value: 'trackStart', label: 'Track Start' },
  { value: 'sectionChange', label: 'Section Change' },
  { value: 'drop', label: 'Drop' },
  { value: 'every8Bars', label: 'Every 8 Bars' },
  { value: 'every16Bars', label: 'Every 16 Bars' },
]

const CANVAS_SECTION_TRIGGER_OPTIONS: Array<{ value: CanvasSectionTriggerType; label: string }> = [
  { value: 'intro', label: 'Intro' },
  { value: 'build', label: 'Build' },
  { value: 'drop', label: 'Drop' },
  { value: 'breakdown', label: 'Breakdown' },
  { value: 'outro', label: 'Outro' },
]

const CANVAS_TIMING_MAX_SECONDS = 60 * 60 * 6

type CanvasMediaLoadState = { mediaId: string | null; message: string | null }

const EMPTY_CANVAS_MEDIA_LOAD_STATE: CanvasMediaLoadState = { mediaId: null, message: null }

function CanvasMediaTokens() {
  return (
    <div className="rv-canvas-media-tokens" aria-label="Supported CANVAS media types">
      <span>Video</span>
      <span>Images</span>
      <span>SVGs</span>
    </div>
  )
}

function getCanvasLibraryMediaType(media: UploadedMedia): CanvasMediaItemType | null {
  const name = media.name.toLowerCase()
  const mime = (media.mimeType ?? '').toLowerCase()
  if (mime === 'image/svg+xml' || name.endsWith('.svg') || media.mediaRole === 'svg') return 'svg'
  if (
    media.type === 'image' && (
      mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/webp' ||
      name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp')
    )
  ) return 'image'
  if (
    media.type === 'video' && (
      mime === 'video/mp4' || mime === 'video/webm' || mime === 'video/quicktime' || mime === 'video/x-quicktime' ||
      name.endsWith('.mp4') || name.endsWith('.webm') || name.endsWith('.mov')
    )
  ) return 'video'
  return null
}

function getCanvasLibraryDisabledReason(media: UploadedMedia): string | null {
  if (media.uploading) return 'Still syncing to the media library.'
  if (!media.url && !media.proxyUrl) return 'Media URL is unavailable. Refresh or check storage access.'
  if (!getCanvasLibraryMediaType(media)) return 'Unsupported in CANVAS. Use MP4, WebM, MOV, PNG, JPG, WebP, or SVG.'
  return null
}

function getCanvasLibraryUrl(media: UploadedMedia): string {
  return media.proxyUrl || media.url
}

function makeCanvasMediaItemFromLibrary(
  media: UploadedMedia,
  timing?: CanvasVideoTimingSettings,
): CanvasMediaItem | null {
  const type = getCanvasLibraryMediaType(media)
  const objectUrl = getCanvasLibraryUrl(media)
  if (!type || !objectUrl) return null
  return {
    id: media.id,
    name: media.title?.trim() || media.name,
    type,
    objectUrl,
    thumbnailUrl: media.localThumbnailObjectUrl ?? media.thumbnailUrl ?? null,
    mimeType: media.mimeType,
    meta: media.meta,
    source: 'library',
    createdAt: typeof media.metadata.analyzedAt === 'string' ? media.metadata.analyzedAt : new Date(0).toISOString(),
    timing,
  }
}

function useCanvasRuntimeMediaItems(): CanvasMediaItem[] {
  const libraryItems = useMediaStore(s => s.items)
  const legacyItems = useReactStore(s => s.canvasMediaItems)
  const timingById = useReactStore(s => s.canvasMediaTimingById)
  return useMemo(() => {
    const mapped = libraryItems
      .map(item => makeCanvasMediaItemFromLibrary(item, timingById[item.id]))
      .filter((item): item is CanvasMediaItem => item !== null)
    const mappedIds = new Set(mapped.map(item => item.id))
    const legacy = legacyItems
      .filter(item => !mappedIds.has(item.id))
      .map(item => ({
        ...item,
        source: item.source ?? 'legacySession' as const,
        timing: timingById[item.id] ?? item.timing,
      }))
    return [...mapped, ...legacy]
  }, [libraryItems, legacyItems, timingById])
}

function formatBytes(bytes?: number): string {
  if (!Number.isFinite(bytes) || !bytes) return 'Local file'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function CanvasActivePreview() {
  const activeCanvasMediaId = useReactStore(s => s.activeCanvasMediaId)
  const mediaItems = useCanvasRuntimeMediaItems()
  const [previewError, setPreviewError] = useState<CanvasMediaLoadState>(EMPTY_CANVAS_MEDIA_LOAD_STATE)
  const activeItem = useMemo(
    () => mediaItems.find(item => item.id === activeCanvasMediaId) ?? null,
    [activeCanvasMediaId, mediaItems],
  )

  useEffect(() => {
    setPreviewError(EMPTY_CANVAS_MEDIA_LOAD_STATE)
  }, [activeItem?.id])

  if (!activeItem) {
    return (
      <div className="rv-canvas-active-preview rv-canvas-active-preview--empty">
        <div className="rv-canvas-active-preview__eyebrow">Active CANVAS Visual</div>
        <div className="rv-canvas-active-preview__title">No media selected</div>
        <div className="rv-canvas-active-preview__copy">Select from your media library in this SOURCE panel to send it to the center visualizer.</div>
      </div>
    )
  }

  const previewErrorActive = previewError.mediaId === activeItem.id && previewError.message

  return (
    <div className="rv-canvas-active-preview">
      <div className="rv-canvas-active-preview__header">
        <span>Active CANVAS Visual</span>
        <strong>{TYPE_LABELS[activeItem.type]}</strong>
      </div>
      <div className={`rv-canvas-active-preview__frame rv-canvas-active-preview__frame--${activeItem.type}`}>
        {activeItem.type === 'video' ? (
          <video
            src={activeItem.objectUrl}
            muted
            playsInline
            controls
            preload="metadata"
            onCanPlay={() => setPreviewError(EMPTY_CANVAS_MEDIA_LOAD_STATE)}
            onError={() => setPreviewError({ mediaId: activeItem.id, message: 'Preview could not play this video. Try MP4 or WebM for live use.' })}
          />
        ) : (
          <img
            src={activeItem.objectUrl}
            alt=""
            onLoad={() => setPreviewError(EMPTY_CANVAS_MEDIA_LOAD_STATE)}
            onError={() => setPreviewError({ mediaId: activeItem.id, message: 'Preview could not load this image or SVG.' })}
          />
        )}
        {previewErrorActive && <span className="rv-canvas-media-load-warning">{previewError.message}</span>}
      </div>
      <div className="rv-canvas-active-preview__name" title={activeItem.name}>{activeItem.name}</div>
    </div>
  )
}

function CanvasLegacySessionMedia({ compact = false }: { compact?: boolean }) {
  const mediaItems = useReactStore(s => s.canvasMediaItems)
  const activeCanvasMediaId = useReactStore(s => s.activeCanvasMediaId)
  const selectCanvasMediaItem = useReactStore(s => s.selectCanvasMediaItem)
  const removeCanvasMediaItem = useReactStore(s => s.removeCanvasMediaItem)
  const manualMediaOverrideId = useReactStore(s => s.canvasEngineSettings.manualMediaOverrideId)

  if (mediaItems.length === 0) return null

  return (
    <div className={`rv-canvas-library rv-canvas-library--legacy${compact ? ' rv-canvas-library--compact' : ''}`}>
      <div className="rv-canvas-media-lock" role="status">
        <span>Legacy session media from an older CANVAS import is still available for this run. Add new files to the shared media library.</span>
      </div>
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
              {active && <span className="rv-canvas-media-card__active">{item.id === manualMediaOverrideId ? 'Locked' : 'Active'}</span>}
            </button>
            <button
              type="button"
              className="rv-canvas-media-card__remove"
              onClick={() => removeCanvasMediaItem(item.id)}
              aria-label={`Remove ${item.name} from legacy CANVAS session media`}
            >
              Remove
            </button>
          </div>
        )
      })}
    </div>
  )
}

function CanvasMediaLibrary({ compact = false }: { compact?: boolean }) {
  const activeCanvasMediaId = useReactStore(s => s.activeCanvasMediaId)
  const selectCanvasMediaItem = useReactStore(s => s.selectCanvasMediaItem)
  const mediaItems = useCanvasRuntimeMediaItems()
  const manualMediaOverrideId = useReactStore(s => s.canvasEngineSettings.manualMediaOverrideId)
  const clearCanvasMediaOverride = useReactStore(s => s.clearCanvasMediaOverride)
  const manualMediaOverrideActive = Boolean(manualMediaOverrideId && mediaItems.some(item => item.id === manualMediaOverrideId))

  return (
    <div className={`rv-canvas-library-shell${compact ? ' rv-canvas-library-shell--compact' : ''}`}>
      {manualMediaOverrideActive && (
        <div className="rv-canvas-media-lock" role="status">
          <span>Manual media lock: Auto Select will keep your chosen CANVAS visual.</span>
          <button type="button" onClick={clearCanvasMediaOverride}>Clear Media Lock</button>
        </div>
      )}
      <MediaLibraryBrowser
        activeMediaId={activeCanvasMediaId}
        onSelect={id => selectCanvasMediaItem(id)}
        context="canvas"
        title="CANVAS Media Library"
        capabilities={CANVAS_MEDIA_LIBRARY_CAPABILITIES}
        getDisabledReason={getCanvasLibraryDisabledReason}
      />
      <CanvasLegacySessionMedia compact={compact} />
    </div>
  )
}

function canvasObjectFit(fitMode: CanvasFitMode): CSSProperties['objectFit'] {
  if (fitMode === 'stretch') return 'fill'
  return fitMode
}

function makeCanvasMediaStyle(
  settings: ReturnType<typeof useReactStore.getState>['canvasEngineSettings'],
  presetSettings: CanvasPresetSettings,
): CSSProperties {
  return {
    objectFit: canvasObjectFit(settings.fitMode),
    opacity: settings.opacity * presetSettings.sourceVisibility,
    transform: `translate(calc(${settings.positionX}% + var(--canvas-preset-shake-x, 0px)), calc(${settings.positionY}% + var(--canvas-preset-shake-y, 0px))) rotate(calc(${settings.rotation}deg + var(--canvas-preset-rotate, 0deg))) scale(calc(${settings.scale} + var(--canvas-preset-scale-boost, 0)))`,
  }
}

function makeCanvasPresetStyle(settings: CanvasPresetSettings): CSSProperties {
  const rgbPx = settings.rgbSplit * 12
  const trailOffset = settings.trailAmount * 18
  const lumaLift = Math.max(0, 1 - settings.lumaThreshold)
  const lumaAmount = settings.motionAmount * (0.35 + lumaLift * 0.65)
  const stutterAnimation = settings.stutterRate > 0.2
    ? `rv-canvas-frame-stutter ${(1 / Math.max(1, settings.stutterRate)).toFixed(3)}s steps(2, end) infinite`
    : 'none'
  return {
    '--canvas-preset-intensity': settings.intensity.toFixed(3),
    '--canvas-preset-glow': settings.glow.toFixed(3),
    '--canvas-preset-trail': settings.trailAmount.toFixed(3),
    '--canvas-preset-glitch': settings.glitchAmount.toFixed(3),
    '--canvas-preset-glitch-opacity': (settings.glitchAmount * settings.intensity * 0.5).toFixed(3),
    '--canvas-preset-stutter-rate': settings.stutterRate.toFixed(3),
    '--canvas-preset-stutter-duration': `${(1 / Math.max(1, settings.stutterRate)).toFixed(3)}s`,
    '--canvas-preset-luma-threshold': settings.lumaThreshold.toFixed(3),
    '--canvas-preset-luma-opacity': (lumaAmount * 0.5 + settings.glow * 0.16).toFixed(3),
    '--canvas-preset-luma-contrast': (1.02 + lumaLift * settings.motionAmount * 0.35 + settings.glitchAmount * 0.12).toFixed(3),
    '--canvas-preset-rgb-split': settings.rgbSplit.toFixed(3),
    '--canvas-preset-rgb-px': `${rgbPx.toFixed(2)}px`,
    '--canvas-preset-rgb-neg-px': `${(-rgbPx).toFixed(2)}px`,
    '--canvas-preset-trail-offset': `${trailOffset.toFixed(2)}px`,
    '--canvas-preset-trail-neg-offset': `${(-trailOffset).toFixed(2)}px`,
    '--canvas-preset-luma-blur': `${(settings.motionAmount * 5 + settings.trailAmount * 2 + settings.intensity * 0.9).toFixed(2)}px`,
    '--canvas-param-aura-opacity': (settings.glow * (0.18 + settings.intensity * 0.38) + settings.particleDensity * 0.26).toFixed(3),
    '--canvas-param-trail-opacity': (settings.trailAmount * settings.intensity * 0.42).toFixed(3),
    '--canvas-param-glitch-overlay-opacity': (settings.glitchAmount * settings.intensity * 0.42 + settings.rgbSplit * 0.16).toFixed(3),
    '--canvas-param-motion-blur': `${(settings.motionAmount * 3.4 + settings.trailAmount * 1.8).toFixed(2)}px`,
    '--canvas-param-brightness': (1 + settings.glow * 0.1 + settings.bassReactivity * settings.intensity * 0.08).toFixed(3),
    '--canvas-param-contrast': (1 + settings.glitchAmount * 0.15 + lumaLift * settings.motionAmount * 0.2).toFixed(3),
    '--canvas-param-saturate': (1 + settings.glow * 0.16 + settings.rgbSplit * 0.24).toFixed(3),
    '--canvas-param-stutter-animation': stutterAnimation,
    '--canvas-param-glow-px': `${(settings.glow * 34).toFixed(2)}px`,
    '--canvas-param-particle-glow-px': `${(settings.particleDensity * 42).toFixed(2)}px`,
    '--canvas-param-grid-opacity': (0.1 + settings.glow * 0.12 + settings.particleDensity * 0.08).toFixed(3),
    '--canvas-particle-source-visibility': settings.sourceVisibility.toFixed(3),
    '--canvas-particle-glow': settings.glow.toFixed(3),
    '--canvas-particle-density': settings.particleDensity.toFixed(3),
    '--canvas-particle-glow-blur': `${(18 + settings.glow * 28 + settings.particleDensity * 16).toFixed(2)}px`,
    '--canvas-particle-source-brightness': (0.82 + settings.sourceVisibility * 0.34).toFixed(3),
    '--canvas-particle-dissolve': settings.turbulence.toFixed(3),
    '--canvas-particle-dissolve-blur': `${(settings.turbulence * 1.8).toFixed(2)}px`,
  } as CSSProperties & Record<string, string>
}

function canvasPresetClassName(presetId: CanvasPresetId): string {
  return `rv-canvas-preset--${presetId.replace('canvas-', '')}`
}


type CanvasParticleSourceElement = HTMLVideoElement | HTMLImageElement

type CanvasParticlePoint = {
  baseX: number
  baseY: number
  luma: number
  alpha: number
  r: number
  g: number
  b: number
  seed: number
}

const CANVAS_PARTICLE_SAMPLE_WIDTH = 96
const CANVAS_PARTICLE_SAMPLE_HEIGHT = 54
const CANVAS_PARTICLE_MIN_COUNT = 90
const CANVAS_PARTICLE_MAX_COUNT = 980

function clampCanvasRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

function seededCanvasParticleNoise(seed: number): number {
  const value = Math.sin(seed * 128.317 + 19.19) * 43758.5453
  return value - Math.floor(value)
}

function isCanvasParticleSourceReady(source: CanvasParticleSourceElement | null): boolean {
  if (!source) return false
  if (source instanceof HTMLVideoElement) return source.readyState >= 2 && source.videoWidth > 0 && source.videoHeight > 0
  return source.complete && source.naturalWidth > 0 && source.naturalHeight > 0
}

function getCanvasParticleSourceSize(source: CanvasParticleSourceElement): { width: number; height: number } {
  if (source instanceof HTMLVideoElement) return { width: source.videoWidth, height: source.videoHeight }
  return { width: source.naturalWidth, height: source.naturalHeight }
}

function createCanvasParticleFallbackPoints(targetCount: number): CanvasParticlePoint[] {
  const points: CanvasParticlePoint[] = []
  const safeCount = clampCanvasRange(Math.round(targetCount), CANVAS_PARTICLE_MIN_COUNT, CANVAS_PARTICLE_MAX_COUNT)
  for (let index = 0; index < safeCount; index += 1) {
    const seed = index + 1
    const angle = seed * 2.399963
    const radius = Math.sqrt((index + 0.5) / safeCount) * 0.44
    const luma = 0.42 + seededCanvasParticleNoise(seed * 3.7) * 0.58
    points.push({
      baseX: 0.5 + Math.cos(angle) * radius,
      baseY: 0.5 + Math.sin(angle) * radius,
      luma,
      alpha: 0.72,
      r: 100 + Math.round(luma * 116),
      g: 205 + Math.round(luma * 38),
      b: 220 + Math.round(luma * 35),
      seed,
    })
  }
  return points
}

function sampleCanvasParticleSource({
  source,
  settings,
  sampleCanvas,
}: {
  source: CanvasParticleSourceElement | null
  settings: CanvasPresetSettings
  sampleCanvas: HTMLCanvasElement
}): CanvasParticlePoint[] {
  const targetCount = CANVAS_PARTICLE_MIN_COUNT + settings.particleDensity * (CANVAS_PARTICLE_MAX_COUNT - CANVAS_PARTICLE_MIN_COUNT)
  if (!source || !isCanvasParticleSourceReady(source)) return createCanvasParticleFallbackPoints(targetCount)

  const sampleWidth = CANVAS_PARTICLE_SAMPLE_WIDTH
  const sampleHeight = CANVAS_PARTICLE_SAMPLE_HEIGHT
  sampleCanvas.width = sampleWidth
  sampleCanvas.height = sampleHeight
  const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true })
  if (!sampleContext) return createCanvasParticleFallbackPoints(targetCount)

  sampleContext.clearRect(0, 0, sampleWidth, sampleHeight)
  const sourceSize = getCanvasParticleSourceSize(source)
  const sourceAspect = sourceSize.width / Math.max(1, sourceSize.height)
  const sampleAspect = sampleWidth / sampleHeight
  let drawWidth = sampleWidth
  let drawHeight = sampleHeight
  let drawX = 0
  let drawY = 0
  if (sourceAspect > sampleAspect) {
    drawHeight = sampleWidth / sourceAspect
    drawY = (sampleHeight - drawHeight) / 2
  } else {
    drawWidth = sampleHeight * sourceAspect
    drawX = (sampleWidth - drawWidth) / 2
  }

  try {
    sampleContext.drawImage(source, drawX, drawY, drawWidth, drawHeight)
  } catch {
    // Video/image/SVG files imported as object URLs are usually readable here. If a browser
    // blocks pixel access, Particle Aura falls back to a safe procedural point cloud instead.
    return createCanvasParticleFallbackPoints(targetCount)
  }

  let imageData: ImageData
  try {
    imageData = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight)
  } catch {
    // Some SVGs with external references can taint the canvas. Keep the preset alive with
    // the same audio-reactive motion, but without per-pixel source sampling.
    return createCanvasParticleFallbackPoints(targetCount)
  }

  const candidates: CanvasParticlePoint[] = []
  const threshold = 0.08 + settings.turbulence * 0.28
  const stride = settings.particleDensity > 0.72 ? 1 : 2
  for (let y = 0; y < sampleHeight; y += stride) {
    for (let x = 0; x < sampleWidth; x += stride) {
      const index = (y * sampleWidth + x) * 4
      const r = imageData.data[index]
      const g = imageData.data[index + 1]
      const b = imageData.data[index + 2]
      const alpha = imageData.data[index + 3] / 255
      const luma = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255
      const visible = alpha * luma
      if (visible <= threshold) continue
      const seed = (x + 1) * 0.731 + (y + 1) * 1.371 + candidates.length * 0.113
      if (seededCanvasParticleNoise(seed) < settings.turbulence * 0.36) continue
      candidates.push({
        baseX: (x + 0.5) / sampleWidth,
        baseY: (y + 0.5) / sampleHeight,
        luma,
        alpha,
        r,
        g,
        b,
        seed,
      })
    }
  }

  if (candidates.length === 0) return createCanvasParticleFallbackPoints(targetCount)

  const points: CanvasParticlePoint[] = []
  const safeCount = clampCanvasRange(Math.round(targetCount), CANVAS_PARTICLE_MIN_COUNT, CANVAS_PARTICLE_MAX_COUNT)
  for (let index = 0; index < safeCount; index += 1) {
    const pick = Math.floor(seededCanvasParticleNoise(index * 9.17 + candidates.length * 0.27) * candidates.length)
    const candidate = candidates[pick] ?? candidates[index % candidates.length]
    const jitter = 0.002 + settings.turbulence * 0.018
    points.push({
      ...candidate,
      baseX: clampCanvasRange(candidate.baseX + (seededCanvasParticleNoise(index * 2.1) - 0.5) * jitter, 0, 1),
      baseY: clampCanvasRange(candidate.baseY + (seededCanvasParticleNoise(index * 3.4) - 0.5) * jitter, 0, 1),
      seed: candidate.seed + index * 0.019,
    })
  }
  return points
}

function mixCanvasParticleChannel(a: number, b: number, amount: number): number {
  return Math.round(a + (b - a) * clampCanvasRange(amount, 0, 1))
}

function getCanvasParticleColor(
  point: CanvasParticlePoint,
  mode: CanvasPresetColorMode,
  bass: number,
  high: number,
): string {
  if (mode === 'original') {
    return `rgb(${point.r}, ${point.g}, ${point.b})`
  }

  if (mode === 'palette') {
    const mix = clampCanvasRange(point.luma * 0.72 + seededCanvasParticleNoise(point.seed) * 0.28, 0, 1)
    const r = mixCanvasParticleChannel(74, 97, mix)
    const g = mixCanvasParticleChannel(199, 214, mix)
    const b = mixCanvasParticleChannel(219, 170, mix)
    return `rgb(${r}, ${g}, ${b})`
  }

  const energy = clampCanvasRange(bass * 0.65 + high * 0.6, 0, 1)
  const r = mixCanvasParticleChannel(74, 255, high * 0.82)
  const g = mixCanvasParticleChannel(199, 97, bass * 0.45)
  const b = mixCanvasParticleChannel(219, 216, energy)
  return `rgb(${r}, ${g}, ${b})`
}

function CanvasParticleAuraLayer({
  active,
  activeItem,
  sourceRef,
  settings,
  analyser,
  isPlaying,
  isPaused,
}: {
  active: boolean
  activeItem: CanvasMediaItem | null
  sourceRef: { current: CanvasParticleSourceElement | null }
  settings: CanvasPresetSettings
  analyser?: AnalyserNode | null
  isPlaying: boolean
  isPaused: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!active || !activeItem) return
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) return

    const sampleCanvas = document.createElement('canvas')
    const frequencyData = analyser ? new Uint8Array(Math.max(1, analyser.frequencyBinCount)) : null
    let points: CanvasParticlePoint[] = []
    let frameId = 0
    let lastSampleAt = 0
    let previousBass = 0
    let heldBeat = 0
    let lastWidth = 0
    let lastHeight = 0
    let disposed = false

    const rebuildParticles = () => {
      points = sampleCanvasParticleSource({
        source: sourceRef.current,
        settings,
        sampleCanvas,
      })
    }

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
      const width = Math.max(1, Math.round(rect.width * dpr))
      const height = Math.max(1, Math.round(rect.height * dpr))
      if (canvas.width === width && canvas.height === height) return
      canvas.width = width
      canvas.height = height
      lastWidth = rect.width || width / dpr
      lastHeight = rect.height || height / dpr
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, lastWidth, lastHeight)
    }

    const tick = () => {
      if (disposed) return
      resizeCanvas()
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const now = nowMs / 1000
      const sampleInterval = activeItem.type === 'video' && isPlaying && !isPaused ? 180 : 650
      if (points.length === 0 || nowMs - lastSampleAt > sampleInterval) {
        rebuildParticles()
        lastSampleAt = nowMs
      }

      let bass = 0.16 + Math.sin(now * 1.4) * 0.035
      let high = 0.12 + Math.sin(now * 2.7) * 0.025
      let beat = 0
      if (analyser && frequencyData && isPlaying && !isPaused) {
        analyser.getByteFrequencyData(frequencyData)
        bass = averageByteRange(frequencyData, 0, 0.16)
        high = averageByteRange(frequencyData, 0.62, 1)
        const bassDelta = bass - previousBass
        heldBeat = Math.max(0, heldBeat * 0.76, bass > 0.52 && bassDelta > 0.04 ? 1 : 0)
        beat = heldBeat
        previousBass = previousBass * 0.58 + bass * 0.42
      } else {
        beat = Math.max(0, Math.sin(now * 2.2)) * 0.22
        previousBass = bass
      }

      const width = lastWidth || canvas.clientWidth || 1
      const height = lastHeight || canvas.clientHeight || 1
      const fade = 1 - clampCanvasRange(settings.trailAmount, 0, 0.94)
      if (settings.trailAmount <= 0.03) {
        context.clearRect(0, 0, width, height)
      } else {
        context.save()
        context.globalCompositeOperation = 'destination-out'
        context.fillStyle = `rgba(0, 0, 0, ${clampCanvasRange(fade, 0.04, 0.82).toFixed(3)})`
        context.fillRect(0, 0, width, height)
        context.restore()
      }

      context.save()
      context.globalCompositeOperation = 'lighter'
      const centerX = width * 0.5
      const centerY = height * 0.5
      const bassPush = bass * settings.bassReactivity * settings.intensity * Math.min(width, height) * 0.18
      const beatScale = 1 + beat * settings.beatPulse * 0.9
      const glow = settings.glow * (8 + bass * 28 + beat * 20)
      const dissolveScatter = settings.turbulence * Math.min(width, height) * 0.12
      const turbulence = settings.turbulence * (4 + high * 18 + bass * 8)

      points.forEach((point, index) => {
        const dx = point.baseX - 0.5
        const dy = point.baseY - 0.5
        const distance = Math.max(0.08, Math.hypot(dx, dy))
        const normalX = dx / distance
        const normalY = dy / distance
        const noiseA = Math.sin(now * (0.65 + point.luma) + point.seed * 10.1)
        const noiseB = Math.cos(now * (0.78 + point.alpha) + point.seed * 7.7)
        const dissolveNoise = seededCanvasParticleNoise(point.seed + Math.floor(now * 12) * 0.31)
        const sparkle = 0.72 + high * Math.abs(Math.sin(now * 24 + point.seed * 18)) * 0.58
        const x = point.baseX * width + normalX * bassPush + noiseA * turbulence + (dissolveNoise - 0.5) * dissolveScatter
        const y = point.baseY * height + normalY * bassPush + noiseB * turbulence + (seededCanvasParticleNoise(point.seed * 2.3) - 0.5) * dissolveScatter
        const size = Math.max(0.35, settings.particleSize * (0.45 + point.luma * 1.25) * beatScale * (0.9 + high * 0.22))
        const alpha = clampCanvasRange(
          (0.16 + point.luma * 0.78) * point.alpha * settings.intensity * (1 - settings.turbulence * 0.42) * sparkle,
          0,
          0.95,
        )
        if (alpha <= 0.015 || (settings.turbulence > 0.72 && (index % 3) === 0 && dissolveNoise < settings.turbulence - 0.46)) return

        const color = getCanvasParticleColor(point, settings.particleColorMode, bass, high)
        context.beginPath()
        context.fillStyle = color
        context.globalAlpha = alpha
        context.shadowColor = color
        context.shadowBlur = glow * (0.35 + point.luma)
        context.arc(x, y, size, 0, Math.PI * 2)
        context.fill()
      })
      context.restore()

      frameId = window.requestAnimationFrame(tick)
    }

    rebuildParticles()
    tick()
    return () => {
      disposed = true
      window.cancelAnimationFrame(frameId)
      context.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [active, activeItem, activeItem?.id, analyser, isPaused, isPlaying, settings, sourceRef])

  if (!active || !activeItem) return null
  return <canvas ref={canvasRef} className="rv-canvas-particle-aura-layer" aria-hidden="true" />
}

function averageByteRange(data: Uint8Array, startRatio: number, endRatio: number): number {
  if (data.length === 0) return 0
  const start = Math.max(0, Math.min(data.length - 1, Math.floor(data.length * startRatio)))
  const end = Math.max(start + 1, Math.min(data.length, Math.ceil(data.length * endRatio)))
  let sum = 0
  for (let index = start; index < end; index += 1) sum += data[index]
  return sum / ((end - start) * 255)
}

function clampCanvasUnit(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback
}

function sampleCanvasCurveAt(curve: FeatureCurve | undefined, timeSec: number): number {
  if (!curve || curve.length === 0) return 0
  if (timeSec <= curve[0].timeSec) return clampCanvasUnit(curve[0].value)
  const last = curve[curve.length - 1]
  if (timeSec >= last.timeSec) return clampCanvasUnit(last.value)

  let low = 0
  let high = curve.length - 1
  while (high - low > 1) {
    const middle = (low + high) >> 1
    if (curve[middle].timeSec <= timeSec) low = middle
    else high = middle
  }

  const left = curve[low]
  const right = curve[high]
  const span = right.timeSec - left.timeSec
  const progress = span > 0 ? (timeSec - left.timeSec) / span : 0
  return clampCanvasUnit(left.value + (right.value - left.value) * progress)
}

function findCanvasSectionAt<T extends { startSec: number; endSec: number }>(sections: T[], timeSec: number): T | null {
  return sections.find(section => timeSec >= section.startSec && timeSec < section.endSec) ?? null
}

function isCanvasFrameForTrack(frame: MusicIntelligenceFrame, activeAudioTrackId: string | null | undefined): boolean {
  if (!activeAudioTrackId || frame.frameId <= 0) return false
  return frame.trackId === activeAudioTrackId || frame.sourceId === activeAudioTrackId
}

function resolveCanvasAudioTime(getAudioTime?: () => number): number {
  const direct = getAudioTime?.()
  if (typeof direct === 'number' && Number.isFinite(direct) && direct >= 0) return direct
  const frameTime = AudioFeatureBus.getFrame().timeSec
  return typeof frameTime === 'number' && Number.isFinite(frameTime) && frameTime >= 0 ? frameTime : 0
}

type CanvasAutoFeatureSnapshot = {
  hasSmartData: boolean
  presetId: CanvasPresetId
  reason: string
  energy: number
  brightness: number
  rhythm: number
  sectionType: ReactSectionType | null
  mood: string | null
}

function resolveCanvasAutoFeatures({
  frame,
  trackAnalysis,
  trackSections,
  audioTime,
  activeAudioTrackId,
}: {
  frame: MusicIntelligenceFrame
  trackAnalysis: TrackIntelligenceAnalysis | null | undefined
  trackSections: ReactTrackSection[]
  audioTime: number
  activeAudioTrackId?: string | null
}): CanvasAutoFeatureSnapshot {
  const frameMatchesTrack = isCanvasFrameForTrack(frame, activeAudioTrackId)
  const analyzedSection = trackAnalysis ? findCanvasSectionAt(trackAnalysis.sections, audioTime) : null
  const authoredSection = findCanvasSectionAt(trackSections, audioTime)
  const sectionType = (frameMatchesTrack ? frame.section.type : null)
    ?? authoredSection?.type
    ?? analyzedSection?.type
    ?? null
  const sectionIntensity = clampCanvasUnit(
    frameMatchesTrack ? frame.section.intensity : undefined,
    clampCanvasUnit(authoredSection?.intensity, clampCanvasUnit(analyzedSection?.intensity, 0.45)),
  )

  const curveEnergy = Math.max(
    sampleCanvasCurveAt(trackAnalysis?.energyCurves.shortTerm, audioTime),
    sampleCanvasCurveAt(trackAnalysis?.energyCurves.instant, audioTime),
  )
  const curveBass = sampleCanvasCurveAt(trackAnalysis?.energyCurves.bass, audioTime)
  const curveHigh = sampleCanvasCurveAt(trackAnalysis?.energyCurves.high, audioTime)
  const curveFlux = sampleCanvasCurveAt(trackAnalysis?.spectralCurves.flux, audioTime)
  const curveComplexity = sampleCanvasCurveAt(trackAnalysis?.spectralCurves.complexity, audioTime)
  const curveCentroid = sampleCanvasCurveAt(trackAnalysis?.spectralCurves.centroid, audioTime)

  const energy = frameMatchesTrack
    ? Math.max(
        clampCanvasUnit(frame.energy.trackCurve),
        clampCanvasUnit(frame.energy.shortTerm),
        clampCanvasUnit(frame.energy.percentile),
        sectionIntensity,
      )
    : Math.max(curveEnergy, sectionIntensity)
  const brightness = frameMatchesTrack
    ? Math.max(
        clampCanvasUnit(frame.bands.normalizedHigh),
        clampCanvasUnit(frame.bands.normalizedAir),
        clampCanvasUnit(frame.energy.spectralCentroid),
        curveHigh,
        curveCentroid,
      )
    : Math.max(curveHigh, curveCentroid)
  const rhythm = frameMatchesTrack
    ? Math.max(
        clampCanvasUnit(frame.rhythm.transient),
        clampCanvasUnit(frame.rhythm.kickStrength),
        clampCanvasUnit(frame.rhythm.snareStrength),
        clampCanvasUnit(frame.stems.drumEnergy),
        clampCanvasUnit(frame.energy.spectralFlux),
        curveFlux,
      )
    : Math.max(curveFlux, curveBass, curveComplexity)
  const buildConfidence = frameMatchesTrack ? clampCanvasUnit(frame.semantics.buildConfidence) : 0
  const dropConfidence = frameMatchesTrack ? clampCanvasUnit(frame.semantics.dropConfidence) : 0
  const complexity = frameMatchesTrack ? clampCanvasUnit(frame.energy.complexity, curveComplexity) : curveComplexity
  const mood = frameMatchesTrack ? frame.semantics.mood : null
  const hasSmartData = Boolean(
    activeAudioTrackId && (
      frameMatchesTrack ||
      trackAnalysis ||
      authoredSection ||
      analyzedSection
    ),
  )

  if (!hasSmartData) {
    return {
      hasSmartData: false,
      presetId: DEFAULT_CANVAS_PRESET_ID,
      reason: 'Load and analyze a track to enable smarter CANVAS Auto Select.',
      energy,
      brightness,
      rhythm,
      sectionType,
      mood,
    }
  }

  const highEnergySection = sectionType === 'drop' || dropConfidence >= 0.55 || energy >= 0.72
  const buildSection = sectionType === 'build' || sectionType === 'preDrop' || buildConfidence >= 0.56
  const atmosphericSection = sectionType === 'intro' || sectionType === 'breakdown' || sectionType === 'bridge' || sectionType === 'outro'
  const brightSection = brightness >= 0.64 || mood === 'bright' || mood === 'euphoric'
  const rhythmicSection = rhythm >= 0.62 || complexity >= 0.7
  const smoothSection = atmosphericSection || mood === 'atmospheric' || mood === 'emotional' || mood === 'calm' || mood === 'minimal'

  if (highEnergySection) {
    const particleAura = brightSection && brightness >= 0.72 && energy >= 0.78
    const glitchy = !particleAura && (rhythmicSection || mood === 'aggressive' || mood === 'chaotic')
    return {
      hasSmartData,
      presetId: particleAura ? 'canvas-particle-aura' : glitchy ? 'canvas-glitch-pulse' : 'canvas-bass-bloom',
      reason: particleAura ? 'Bright peak-energy section' : glitchy ? 'High-energy rhythmic section' : 'High-energy drop section',
      energy,
      brightness,
      rhythm,
      sectionType,
      mood,
    }
  }

  if (buildSection) {
    return {
      hasSmartData,
      presetId: rhythmicSection ? 'canvas-frame-stutter' : 'canvas-bass-bloom',
      reason: rhythmicSection ? 'Rhythmic build section' : 'Building energy section',
      energy,
      brightness,
      rhythm,
      sectionType,
      mood,
    }
  }

  if (brightSection) {
    return {
      hasSmartData,
      presetId: 'canvas-luma-melt',
      reason: 'Bright high-frequency section',
      energy,
      brightness,
      rhythm,
      sectionType,
      mood,
    }
  }

  if (rhythmicSection) {
    return {
      hasSmartData,
      presetId: 'canvas-frame-stutter',
      reason: 'Beat-heavy rhythmic section',
      energy,
      brightness,
      rhythm,
      sectionType,
      mood,
    }
  }

  if (smoothSection) {
    return {
      hasSmartData,
      presetId: energy <= 0.28 ? 'canvas-clean-playback' : 'canvas-ghost-echo',
      reason: energy <= 0.28 ? 'Smooth low-energy section' : 'Smooth atmospheric section',
      energy,
      brightness,
      rhythm,
      sectionType,
      mood,
    }
  }

  return {
    hasSmartData,
    presetId: energy <= 0.34 ? 'canvas-clean-playback' : 'canvas-ghost-echo',
    reason: energy <= 0.34 ? 'Lower-energy section' : 'Moderate atmospheric section',
    energy,
    brightness,
    rhythm,
    sectionType,
    mood,
  }
}

function pickCanvasAutoMedia(
  mediaItems: CanvasMediaItem[],
  activeCanvasMediaId: string | null,
  features: CanvasAutoFeatureSnapshot,
): string | null {
  if (mediaItems.length === 0) return null
  if (mediaItems.length === 1) return activeCanvasMediaId ?? mediaItems[0].id

  const activeItem = mediaItems.find(item => item.id === activeCanvasMediaId) ?? null
  const video = mediaItems.find(item => item.type === 'video') ?? null
  const still = mediaItems.find(item => item.type === 'image' || item.type === 'svg') ?? null
  const highEnergy = features.sectionType === 'drop' || features.energy >= 0.72 || features.presetId === 'canvas-glitch-pulse' || features.presetId === 'canvas-bass-bloom' || features.presetId === 'canvas-particle-aura'

  if (highEnergy) return video?.id ?? activeItem?.id ?? mediaItems[0].id
  if (features.presetId === 'canvas-ghost-echo' || features.presetId === 'canvas-clean-playback') {
    if (activeItem && activeItem.type !== 'video') return activeItem.id
    return still?.id ?? activeItem?.id ?? mediaItems[0].id
  }
  return activeItem?.id ?? mediaItems[0].id
}

function playCanvasVideo(video: HTMLVideoElement | null) {
  if (!video) return
  const playPromise = video.play()
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => undefined)
  }
}

function clampCanvasTimingSeconds(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

function getCanvasVideoDuration(video: HTMLVideoElement | null): number | null {
  if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return null
  return video.duration
}

function resolveCanvasClipStart(video: HTMLVideoElement | null, timing: CanvasVideoTimingSettings): number {
  const duration = getCanvasVideoDuration(video)
  const maxStart = duration === null ? CANVAS_TIMING_MAX_SECONDS : Math.max(0, duration - 0.05)
  return clampCanvasTimingSeconds(timing.clipStartSec, 0, maxStart)
}

function resolveCanvasClipEnd(video: HTMLVideoElement | null, timing: CanvasVideoTimingSettings, startSec: number): number | null {
  const duration = getCanvasVideoDuration(video)
  if (timing.clipEndSec <= 0) return duration
  const maxEnd = duration === null ? CANVAS_TIMING_MAX_SECONDS : duration
  return clampCanvasTimingSeconds(timing.clipEndSec, Math.min(maxEnd, startSec + 0.05), maxEnd)
}

function seekCanvasVideoToClipStart(
  video: HTMLVideoElement | null,
  timing: CanvasVideoTimingSettings,
  shouldPlay: boolean,
) {
  if (!video) return
  const startSec = resolveCanvasClipStart(video, timing)
  try {
    video.currentTime = startSec
  } catch {
    // Browser may reject seeks before metadata is available. The metadata hook retries safely.
  }
  if (shouldPlay) playCanvasVideo(video)
}

function normalizeCanvasTimingSectionType(sectionType: ReactSectionType | null | undefined): CanvasSectionTriggerType | null {
  if (sectionType === 'intro' || sectionType === 'build' || sectionType === 'drop' || sectionType === 'breakdown' || sectionType === 'outro') {
    return sectionType
  }
  if (sectionType === 'preDrop') return 'build'
  if (sectionType === 'bridge') return 'breakdown'
  return null
}

function resolveCanvasTimingSection({
  frame,
  trackAnalysis,
  trackSections,
  audioTime,
  activeAudioTrackId,
}: {
  frame: MusicIntelligenceFrame
  trackAnalysis: TrackIntelligenceAnalysis | null | undefined
  trackSections: ReactTrackSection[]
  audioTime: number
  activeAudioTrackId?: string | null
}): ReactSectionType | null {
  const frameSection = isCanvasFrameForTrack(frame, activeAudioTrackId) ? frame.section.type : null
  const authoredSection = findCanvasSectionAt(trackSections, audioTime)
  const analyzedSection = trackAnalysis ? findCanvasSectionAt(trackAnalysis.sections, audioTime) : null
  return frameSection ?? authoredSection?.type ?? analyzedSection?.type ?? null
}

function formatCanvasTimingSeconds(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0.0s'
  return `${value.toFixed(value >= 10 ? 1 : 2)}s`
}

function getCanvasMediaLoadErrorMessage(item: CanvasMediaItem): string {
  if (item.type === 'video') {
    return 'This CANVAS video cannot play in the browser. Try an H.264 MP4 or WebM file.'
  }
  if (item.type === 'svg') {
    return 'This CANVAS SVG could not load. Check for external links or unsupported SVG content.'
  }
  return 'This CANVAS image could not load. Try PNG, JPG, or WebP.'
}

export function CanvasEngineSurface({
  isPlaying,
  isPaused,
  analyser,
  trackAnalysis = null,
  trackSections = [],
  getAudioTime,
  activeAudioTrackId = null,
  onCanvasReady,
  onLiveFps,
}: {
  isPlaying: boolean
  isPaused: boolean
  analyser?: AnalyserNode | null
  trackAnalysis?: TrackIntelligenceAnalysis | null
  trackSections?: ReactTrackSection[]
  getAudioTime?: () => number
  activeAudioTrackId?: string | null
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onLiveFps?: (fps: number) => void
}) {
  const settings = useReactStore(s => s.canvasEngineSettings)
  const activeCanvasMediaId = useReactStore(s => s.activeCanvasMediaId)
  const mediaItems = useCanvasRuntimeMediaItems()
  const restartRevision = useReactStore(s => s.canvasVideoRestartRevision)
  const selectedCanvasPresetId = useReactStore(s => s.selectedCanvasPresetId)
  const canvasPresetSettings = useReactStore(s => s.canvasPresetSettings)
  const canvasPresetOverride = useReactStore(s => s.canvasPresetOverride)
  const applyCanvasAutoSelection = useReactStore(s => s.applyCanvasAutoSelection)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const outputRef = useRef<HTMLDivElement | null>(null)
  const outputCaptureCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [mediaLoadError, setMediaLoadError] = useState<CanvasMediaLoadState>(EMPTY_CANVAS_MEDIA_LOAD_STATE)
  const trackAnalysisRef = useRef<TrackIntelligenceAnalysis | null>(trackAnalysis)
  const trackSectionsRef = useRef<ReactTrackSection[]>(trackSections)
  const getAudioTimeRef = useRef<typeof getAudioTime>(getAudioTime)
  const activeItem = useMemo(
    () => mediaItems.find(item => item.id === activeCanvasMediaId) ?? null,
    [activeCanvasMediaId, mediaItems],
  )
  const presetStyle = useMemo(() => makeCanvasPresetStyle(canvasPresetSettings), [canvasPresetSettings])
  const activeVideo = activeItem?.type === 'video'
  const activeTiming = activeItem?.timing ?? DEFAULT_CANVAS_VIDEO_TIMING_SETTINGS
  const selectedPreset = CANVAS_PRESET_BY_ID[selectedCanvasPresetId] ?? CANVAS_PRESET_BY_ID[DEFAULT_CANVAS_PRESET_ID]
  const mediaStyle = useMemo(
    () => makeCanvasMediaStyle(settings, canvasPresetSettings),
    [canvasPresetSettings, selectedPreset.id, settings],
  )
  const particleSourceRef = activeVideo ? videoRef : imageRef

  trackAnalysisRef.current = trackAnalysis
  trackSectionsRef.current = trackSections
  getAudioTimeRef.current = getAudioTime

  useEffect(() => {
    const captureCanvas = outputCaptureCanvasRef.current
    onCanvasReady?.(captureCanvas)
    return () => onCanvasReady?.(null)
  }, [onCanvasReady])

  useEffect(() => {
    const captureCanvas = outputCaptureCanvasRef.current
    if (!captureCanvas) return
    const captureContext = captureCanvas.getContext('2d', { alpha: true })
    if (!captureContext) return

    const sampleCanvas = document.createElement('canvas')
    const frequencyData = analyser ? new Uint8Array(Math.max(1, analyser.frequencyBinCount)) : null
    let frameId = 0
    let previousBass = 0
    let heldBeat = 0
    let points: CanvasParticlePoint[] = []
    let lastParticleSampleAt = 0
    let fpsFrames = 0
    let fpsLastAt = typeof performance !== 'undefined' ? performance.now() : Date.now()

    const drawSource = () => {
      const visibleRect = outputRef.current?.getBoundingClientRect()
      const cssWidth = Math.max(1, Math.round(visibleRect?.width || 1280))
      const cssHeight = Math.max(1, Math.round(visibleRect?.height || 720))
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
      const targetWidth = Math.max(1, Math.round(cssWidth * dpr))
      const targetHeight = Math.max(1, Math.round(cssHeight * dpr))
      if (captureCanvas.width !== targetWidth || captureCanvas.height !== targetHeight) {
        captureCanvas.width = targetWidth
        captureCanvas.height = targetHeight
      }

      captureContext.setTransform(dpr, 0, 0, dpr, 0, 0)
      captureContext.clearRect(0, 0, cssWidth, cssHeight)
      captureContext.fillStyle = '#02070a'
      captureContext.fillRect(0, 0, cssWidth, cssHeight)

      const source = particleSourceRef.current
      if (!activeItem || !source || !isCanvasParticleSourceReady(source)) return

      let bass = 0.14
      let high = 0.1
      let beat = 0
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const now = nowMs / 1000
      if (analyser && frequencyData && isPlaying && !isPaused) {
        analyser.getByteFrequencyData(frequencyData)
        bass = averageByteRange(frequencyData, 0, 0.16)
        high = averageByteRange(frequencyData, 0.62, 1)
        const bassDelta = bass - previousBass
        heldBeat = Math.max(0, heldBeat * 0.78, bass > 0.54 && bassDelta > 0.045 ? 1 : 0)
        beat = heldBeat
        previousBass = previousBass * 0.58 + bass * 0.42
      } else {
        bass = 0.18 + Math.sin(now * 1.3) * 0.04
        high = 0.12 + Math.sin(now * 2.1) * 0.03
        beat = Math.max(0, Math.sin(now * 2.6)) * 0.28
        previousBass = bass
      }

      const sourceSize = getCanvasParticleSourceSize(source)
      const sourceAspect = sourceSize.width / Math.max(1, sourceSize.height)
      const canvasAspect = cssWidth / Math.max(1, cssHeight)
      let drawWidth = cssWidth
      let drawHeight = cssHeight
      if (settings.fitMode === 'contain') {
        if (sourceAspect > canvasAspect) drawHeight = cssWidth / sourceAspect
        else drawWidth = cssHeight * sourceAspect
      } else if (settings.fitMode === 'cover') {
        if (sourceAspect > canvasAspect) drawWidth = cssHeight * sourceAspect
        else drawHeight = cssWidth / sourceAspect
      }

      const liveScale = settings.scale
        + bass * canvasPresetSettings.bassReactivity * canvasPresetSettings.intensity * 0.16
        + beat * canvasPresetSettings.beatPulse * canvasPresetSettings.intensity * 0.045
      const shake = (beat * 9 + high * 4 + 0.8) * canvasPresetSettings.glitchAmount * canvasPresetSettings.intensity
      const motionDriftX = Math.sin(now * (0.9 + canvasPresetSettings.turbulence * 2.6)) * canvasPresetSettings.motionAmount * 9
      const motionDriftY = Math.cos(now * (0.74 + canvasPresetSettings.turbulence * 2.1)) * canvasPresetSettings.motionAmount * 7

      captureContext.save()
      captureContext.globalAlpha = clampCanvasRange(settings.opacity * canvasPresetSettings.sourceVisibility, 0, 1)
      captureContext.translate(
        cssWidth * 0.5 + cssWidth * 0.5 * (settings.positionX / 100) + Math.sin(now * 48) * shake + motionDriftX,
        cssHeight * 0.5 + cssHeight * 0.5 * (settings.positionY / 100) + Math.cos(now * 41) * shake + motionDriftY,
      )
      captureContext.rotate((settings.rotation + shake * 0.16) * Math.PI / 180)
      captureContext.scale(liveScale, liveScale)
      captureContext.filter = `blur(${(canvasPresetSettings.motionAmount * 3.2 + canvasPresetSettings.trailAmount * 1.4).toFixed(2)}px) brightness(${(1.0 + canvasPresetSettings.glow * 0.12 + bass * canvasPresetSettings.bassReactivity * canvasPresetSettings.intensity * 0.34).toFixed(3)}) contrast(${(1.0 + canvasPresetSettings.glitchAmount * 0.16 + (1 - canvasPresetSettings.lumaThreshold) * canvasPresetSettings.motionAmount * 0.28).toFixed(3)}) saturate(${(1.0 + high * canvasPresetSettings.rgbSplit * 0.9 + canvasPresetSettings.glow * 0.14).toFixed(3)})`
      try {
        captureContext.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
      } catch {
        // If a browser blocks a specific source draw, keep the capture canvas alive and blank.
      }
      captureContext.restore()

      if (canvasPresetSettings.particleDensity > 0.02) {
        if (points.length === 0 || nowMs - lastParticleSampleAt > (activeItem.type === 'video' ? 260 : 900)) {
          points = sampleCanvasParticleSource({ source, settings: canvasPresetSettings, sampleCanvas })
          lastParticleSampleAt = nowMs
        }
        captureContext.save()
        captureContext.globalCompositeOperation = 'lighter'
        const bassPush = bass * canvasPresetSettings.bassReactivity * canvasPresetSettings.intensity * Math.min(cssWidth, cssHeight) * 0.18
        const beatScale = 1 + beat * canvasPresetSettings.beatPulse * 0.9
        const turbulence = canvasPresetSettings.turbulence * (4 + high * 18 + bass * 8)
        const dissolveScatter = canvasPresetSettings.turbulence * Math.min(cssWidth, cssHeight) * 0.12
        const glow = canvasPresetSettings.glow * (8 + bass * 28 + beat * 20)
        points.forEach((point, index) => {
          const dx = point.baseX - 0.5
          const dy = point.baseY - 0.5
          const distance = Math.max(0.08, Math.hypot(dx, dy))
          const normalX = dx / distance
          const normalY = dy / distance
          const noiseA = Math.sin(now * (0.65 + point.luma) + point.seed * 10.1)
          const noiseB = Math.cos(now * (0.78 + point.alpha) + point.seed * 7.7)
          const dissolveNoise = seededCanvasParticleNoise(point.seed + Math.floor(now * 12) * 0.31)
          if (canvasPresetSettings.turbulence > 0.72 && (index % 3) === 0 && dissolveNoise < canvasPresetSettings.turbulence - 0.46) return
          const color = getCanvasParticleColor(point, canvasPresetSettings.particleColorMode, bass, high)
          const x = point.baseX * cssWidth + normalX * bassPush + noiseA * turbulence + (dissolveNoise - 0.5) * dissolveScatter
          const y = point.baseY * cssHeight + normalY * bassPush + noiseB * turbulence + (seededCanvasParticleNoise(point.seed * 2.3) - 0.5) * dissolveScatter
          const size = Math.max(0.35, canvasPresetSettings.particleSize * (0.45 + point.luma * 1.25) * beatScale)
          const alpha = clampCanvasRange((0.16 + point.luma * 0.78) * point.alpha * canvasPresetSettings.intensity * (1 - canvasPresetSettings.turbulence * 0.42), 0, 0.95)
          if (alpha <= 0.015) return
          captureContext.beginPath()
          captureContext.fillStyle = color
          captureContext.globalAlpha = alpha
          captureContext.shadowColor = color
          captureContext.shadowBlur = glow * (0.35 + point.luma)
          captureContext.arc(x, y, size, 0, Math.PI * 2)
          captureContext.fill()
        })
        captureContext.restore()
      }
    }

    const tick = () => {
      drawSource()
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
      fpsFrames += 1
      if (nowMs - fpsLastAt >= 1000) {
        onLiveFps?.(Math.round((fpsFrames * 1000) / Math.max(1, nowMs - fpsLastAt)))
        fpsFrames = 0
        fpsLastAt = nowMs
      }
      frameId = window.requestAnimationFrame(tick)
    }

    tick()
    return () => {
      window.cancelAnimationFrame(frameId)
      onLiveFps?.(0)
    }
  }, [activeItem, activeItem?.id, analyser, canvasPresetSettings, isPaused, isPlaying, onLiveFps, particleSourceRef, selectedPreset.id, settings])

  useEffect(() => {
    setMediaLoadError(EMPTY_CANVAS_MEDIA_LOAD_STATE)
  }, [activeItem?.id])

  const activeMediaLoadError = mediaLoadError.mediaId === activeItem?.id ? mediaLoadError.message : null

  useEffect(() => {
    musicIntelligenceEngine.setTrackAnalysis(trackAnalysis ?? null)
  }, [trackAnalysis])

  useEffect(() => {
    if (!analyser) return

    let frameId = 0
    let frequencyData: Uint8Array<ArrayBuffer> | null = null
    let timeDomainData: Uint8Array<ArrayBuffer> | null = null

    const tick = () => {
      const freqSize = Math.max(1, analyser.frequencyBinCount)
      if (!frequencyData || frequencyData.length !== freqSize) {
        frequencyData = new Uint8Array(freqSize) as Uint8Array<ArrayBuffer>
      }
      const timeSize = Math.max(1, analyser.fftSize)
      if (!timeDomainData || timeDomainData.length !== timeSize) {
        timeDomainData = new Uint8Array(timeSize) as Uint8Array<ArrayBuffer>
      }

      analyser.getByteFrequencyData(frequencyData)
      analyser.getByteTimeDomainData(timeDomainData)
      musicIntelligenceEngine.updateFromAudioFrame({
        freqBuf: frequencyData,
        timeBuf: timeDomainData,
        sampleRate: analyser.context.sampleRate,
        audioTime: resolveCanvasAudioTime(getAudioTimeRef.current),
        isPlaying: isPlaying && !isPaused,
      })

      frameId = window.requestAnimationFrame(tick)
    }

    tick()
    return () => window.cancelAnimationFrame(frameId)
  }, [analyser, isPaused, isPlaying])

  useEffect(() => {
    if (!settings.autoSelectEnabled || canvasPresetOverride?.source === 'manual') return

    const intervalId = window.setInterval(() => {
      const frame = AudioFeatureBus.getFrame()
      const audioTime = resolveCanvasAudioTime(getAudioTimeRef.current)
      const features = resolveCanvasAutoFeatures({
        frame,
        trackAnalysis: trackAnalysisRef.current,
        trackSections: trackSectionsRef.current,
        audioTime,
        activeAudioTrackId,
      })

      if (!features.hasSmartData) return

      const mediaId = pickCanvasAutoMedia(mediaItems, activeCanvasMediaId, features)
      const preset = CANVAS_PRESET_BY_ID[features.presetId] ?? CANVAS_PRESET_BY_ID[DEFAULT_CANVAS_PRESET_ID]
      applyCanvasAutoSelection({
        presetId: preset.id,
        mediaId,
        label: `${features.reason}: ${preset.name}`,
      })
    }, 600)

    return () => window.clearInterval(intervalId)
  }, [activeAudioTrackId, activeCanvasMediaId, applyCanvasAutoSelection, canvasPresetOverride?.source, mediaItems, settings.autoSelectEnabled])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !activeVideo) return

    const hasClipEnd = activeTiming.clipEndSec > 0
    video.muted = true
    video.loop = settings.loopVideo && !activeTiming.loopClipRange && !hasClipEnd
    video.playsInline = true

    if (isPlaying && !isPaused && !activeMediaLoadError) playCanvasVideo(video)
    else video.pause()
  }, [activeMediaLoadError, activeTiming, activeTiming.clipEndSec, activeTiming.loopClipRange, activeVideo, activeItem?.id, isPaused, isPlaying, settings.loopVideo])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !activeVideo) return

    seekCanvasVideoToClipStart(video, activeTiming, isPlaying && !isPaused && !activeMediaLoadError)
  }, [activeMediaLoadError, activeTiming, activeTiming.clipStartSec, activeVideo, activeItem?.id, isPaused, isPlaying, restartRevision])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !activeVideo) return

    const handleMetadata = () => {
      seekCanvasVideoToClipStart(video, activeTiming, isPlaying && !isPaused && !activeMediaLoadError)
    }

    video.addEventListener('loadedmetadata', handleMetadata)
    if (video.readyState >= 1) handleMetadata()
    return () => video.removeEventListener('loadedmetadata', handleMetadata)
  }, [activeMediaLoadError, activeTiming, activeTiming.clipStartSec, activeVideo, activeItem?.id, isPaused, isPlaying])

  useEffect(() => {
    if (!activeVideo) return

    let frameId = 0
    const tick = () => {
      const video = videoRef.current
      if (video && video.readyState >= 1) {
        const startSec = resolveCanvasClipStart(video, activeTiming)
        const endSec = resolveCanvasClipEnd(video, activeTiming, startSec)
        const hasClipBoundary = endSec !== null && (activeTiming.clipEndSec > 0 || activeTiming.loopClipRange)

        if (!video.seeking && video.currentTime < startSec - 0.08) {
          seekCanvasVideoToClipStart(video, activeTiming, isPlaying && !isPaused && !activeMediaLoadError)
        }

        if (hasClipBoundary && endSec !== null && video.currentTime >= endSec - 0.035) {
          if (activeTiming.loopClipRange) {
            seekCanvasVideoToClipStart(video, activeTiming, isPlaying && !isPaused && !activeMediaLoadError)
          } else {
            video.pause()
          }
        }
      }

      frameId = window.requestAnimationFrame(tick)
    }

    tick()
    return () => window.cancelAnimationFrame(frameId)
  }, [activeMediaLoadError, activeTiming, activeTiming.clipEndSec, activeTiming.clipStartSec, activeTiming.loopClipRange, activeVideo, isPaused, isPlaying, settings.loopVideo])

  const previousTimingPresetRef = useRef<CanvasPresetId>(selectedCanvasPresetId)
  useEffect(() => {
    const previousPresetId = previousTimingPresetRef.current
    previousTimingPresetRef.current = selectedCanvasPresetId

    if (!activeVideo || previousPresetId === selectedCanvasPresetId) return
    if (!activeTiming.restartOnManualPresetChange || canvasPresetOverride?.source !== 'manual') return
    seekCanvasVideoToClipStart(videoRef.current, activeTiming, isPlaying && !isPaused && !activeMediaLoadError)
  }, [activeMediaLoadError, activeTiming, activeVideo, canvasPresetOverride?.source, isPaused, isPlaying, selectedCanvasPresetId])

  const timingTriggerRef = useRef({
    lastAudioTime: 0,
    lastSectionType: null as CanvasSectionTriggerType | null,
    lastDropSignal: false,
    lastBarIndex: -1,
    wasPlaying: false,
  })

  useEffect(() => {
    if (!activeVideo) {
      timingTriggerRef.current = {
        lastAudioTime: 0,
        lastSectionType: null,
        lastDropSignal: false,
        lastBarIndex: -1,
        wasPlaying: false,
      }
      return
    }

    const runTrigger = () => {
      const shouldPlay = isPlaying && !isPaused && !activeMediaLoadError
      if (!shouldPlay) {
        timingTriggerRef.current.wasPlaying = false
        return
      }

      const frame = AudioFeatureBus.getFrame()
      const audioTime = resolveCanvasAudioTime(getAudioTimeRef.current)
      const frameMatchesTrack = isCanvasFrameForTrack(frame, activeAudioTrackId)
      const sectionType = normalizeCanvasTimingSectionType(resolveCanvasTimingSection({
        frame,
        trackAnalysis: trackAnalysisRef.current,
        trackSections: trackSectionsRef.current,
        audioTime,
        activeAudioTrackId,
      }))
      const selectedSectionMapped = sectionType !== null && activeTiming.sectionTriggerTypes.includes(sectionType)
      const sectionChanged = sectionType !== null && sectionType !== timingTriggerRef.current.lastSectionType
      const dropSignal = sectionType === 'drop' || (frameMatchesTrack && frame.semantics.dropConfidence >= 0.7)
      const droppedNow = dropSignal && !timingTriggerRef.current.lastDropSignal
      const startedAtBeginning = (
        activeTiming.triggerOn === 'trackStart' &&
        audioTime <= 0.35 &&
        (!timingTriggerRef.current.wasPlaying || audioTime < timingTriggerRef.current.lastAudioTime - 0.5)
      )
      const barInterval = activeTiming.triggerOn === 'every8Bars' ? 8 : activeTiming.triggerOn === 'every16Bars' ? 16 : null
      const barHit = Boolean(
        frameMatchesTrack &&
        barInterval &&
        frame.rhythm.downbeatHit &&
        frame.rhythm.barIndex > 0 &&
        frame.rhythm.barIndex !== timingTriggerRef.current.lastBarIndex &&
        frame.rhythm.barIndex % barInterval === 0
      )
      const sectionTrigger = Boolean(
        selectedSectionMapped &&
        sectionChanged &&
        (activeTiming.triggerOn === 'sectionChange' || activeTiming.restartOnSectionChange)
      )
      const dropTrigger = Boolean(droppedNow && (activeTiming.triggerOn === 'drop' || activeTiming.restartOnDrop))

      if (startedAtBeginning || sectionTrigger || dropTrigger || barHit) {
        seekCanvasVideoToClipStart(videoRef.current, activeTiming, true)
      }

      if (sectionType !== null) timingTriggerRef.current.lastSectionType = sectionType
      if (frameMatchesTrack && frame.rhythm.downbeatHit) {
        timingTriggerRef.current.lastBarIndex = frame.rhythm.barIndex
      }
      timingTriggerRef.current.lastDropSignal = dropSignal
      timingTriggerRef.current.lastAudioTime = audioTime
      timingTriggerRef.current.wasPlaying = true
    }

    const intervalId = window.setInterval(runTrigger, 90)
    runTrigger()
    return () => window.clearInterval(intervalId)
  }, [activeAudioTrackId, activeMediaLoadError, activeTiming, activeVideo, isPaused, isPlaying])

  useEffect(() => () => {
    videoRef.current?.pause()
  }, [])

  useEffect(() => {
    const output = outputRef.current
    if (!output) return

    let frameId = 0
    let previousBass = 0
    let heldBeat = 0
    const frequencyData = analyser ? new Uint8Array(Math.max(1, analyser.frequencyBinCount)) : null

    const tick = () => {
      const now = typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000
      let bass = 0.18 + Math.sin(now * 1.3) * 0.04
      let high = 0.12 + Math.sin(now * 2.1) * 0.03
      let beat = 0

      if (analyser && frequencyData && isPlaying && !isPaused) {
        analyser.getByteFrequencyData(frequencyData)
        bass = averageByteRange(frequencyData, 0, 0.16)
        high = averageByteRange(frequencyData, 0.62, 1)
        const bassDelta = bass - previousBass
        heldBeat = Math.max(0, heldBeat * 0.78, bass > 0.54 && bassDelta > 0.045 ? 1 : 0)
        beat = heldBeat
        previousBass = previousBass * 0.58 + bass * 0.42
      } else {
        beat = Math.max(0, Math.sin(now * 2.6)) * 0.28
        previousBass = bass
      }

      const intensity = canvasPresetSettings.intensity
      const glow = canvasPresetSettings.glow
      const glitch = canvasPresetSettings.glitchAmount
      const shakePhase = Math.sin(now * 48)
      const shake = (beat * 9 + high * 4 + 0.8) * glitch * intensity
      const driftX = Math.sin(now * (0.9 + canvasPresetSettings.turbulence * 2.6)) * canvasPresetSettings.motionAmount * 9
      const driftY = Math.cos(now * (0.74 + canvasPresetSettings.turbulence * 2.1)) * canvasPresetSettings.motionAmount * 7
      const bloomScale = bass * canvasPresetSettings.bassReactivity * intensity * 0.16
        + beat * canvasPresetSettings.beatPulse * intensity * 0.045

      output.style.setProperty('--canvas-preset-bass', bass.toFixed(3))
      output.style.setProperty('--canvas-preset-beat', beat.toFixed(3))
      output.style.setProperty('--canvas-preset-high', high.toFixed(3))
      output.style.setProperty('--canvas-preset-scale-boost', bloomScale.toFixed(4))
      output.style.setProperty('--canvas-preset-shake-x', `${(shake * shakePhase + driftX).toFixed(2)}px`)
      output.style.setProperty('--canvas-preset-shake-y', `${(shake * Math.cos(now * 41) + driftY).toFixed(2)}px`)
      output.style.setProperty('--canvas-preset-rotate', `${(shake * 0.16).toFixed(2)}deg`)
      output.style.setProperty('--canvas-preset-live-glow', (glow * (0.28 + bass * 0.85)).toFixed(3))
      output.style.setProperty('--canvas-preset-live-trail', (canvasPresetSettings.trailAmount * (0.35 + bass * 0.65)).toFixed(3))
      output.style.setProperty('--canvas-particle-bass-scale', (1.02 + bass * 0.08).toFixed(4))

      frameId = window.requestAnimationFrame(tick)
    }

    tick()
    return () => window.cancelAnimationFrame(frameId)
  }, [analyser, canvasPresetSettings, isPaused, isPlaying, selectedCanvasPresetId])

  useEffect(() => {
    if (canvasPresetSettings.stutterRate <= 0.2 || !activeVideo || !isPlaying || isPaused || activeMediaLoadError) return
    const cleanupVideo = videoRef.current
    let resumeTimer = 0
    const intervalMs = Math.max(90, Math.round(1000 / Math.max(1, canvasPresetSettings.stutterRate)))
    const holdMs = Math.round(38 + canvasPresetSettings.intensity * 118)
    const intervalId = window.setInterval(() => {
      const video = videoRef.current
      if (!video || video.ended || video.readyState < 2) return
      video.pause()
      if (canvasPresetSettings.glitchAmount > 0.2 && video.currentTime > 0.08) {
        video.currentTime = Math.max(0, video.currentTime - 0.018 * canvasPresetSettings.intensity)
      }
      window.clearTimeout(resumeTimer)
      resumeTimer = window.setTimeout(() => {
        const currentVideo = videoRef.current
        if (isPlaying && !isPaused && !activeMediaLoadError) playCanvasVideo(currentVideo)
      }, holdMs)
    }, intervalMs)

    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(resumeTimer)
      if (isPlaying && !isPaused && !activeMediaLoadError) playCanvasVideo(cleanupVideo)
    }
  }, [activeMediaLoadError, activeVideo, canvasPresetSettings.glitchAmount, canvasPresetSettings.intensity, canvasPresetSettings.stutterRate, isPaused, isPlaying, selectedCanvasPresetId])


  const captureCanvasNode = <canvas ref={outputCaptureCanvasRef} className="rv-canvas-output-capture" aria-hidden="true" />

  if (!activeItem) {
    const hasSelectableMedia = mediaItems.length > 0
    return (
      <div className="rv-canvas-engine-surface rv-canvas-engine-surface--empty" role="region" aria-label="CANVAS engine render surface">
        {captureCanvasNode}
        <div className="rv-canvas-live-empty-card rv-canvas-live-empty-card--render-only">
          <div className="rv-canvas-engine-eyebrow">CANVAS Output</div>
          <h2 className="rv-canvas-live-empty-title">
            {hasSelectableMedia ? 'No source selected' : 'Choose a CANVAS source'}
          </h2>
          <p className="rv-canvas-engine-desc">
            {canvasPresetSettings.particleDensity > 0.02
              ? 'Particle Aura needs an active video, image, or SVG before it can sample pixels.'
              : hasSelectableMedia
                ? 'Select media in the left SOURCE panel to render it here.'
                : 'Select from your media library in the left SOURCE panel, then this stage becomes render-only output.'}
          </p>
          <CanvasMediaTokens />
        </div>
      </div>
    )
  }

  return (
    <div className="rv-canvas-engine-surface" role="region" aria-label="CANVAS engine media surface">
      {captureCanvasNode}
      <div
        ref={outputRef}
        className="rv-canvas-live-output rv-canvas-param-output"
        data-fit-mode={settings.fitMode}
        data-canvas-preset={selectedPreset.id}
        style={presetStyle}
      >
        <div className="rv-canvas-live-grid" aria-hidden="true" />
        <div className="rv-canvas-preset-aura" aria-hidden="true" />
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
              loop={settings.loopVideo && !activeTiming.loopClipRange && activeTiming.clipEndSec <= 0}
              preload="auto"
              onCanPlay={() => setMediaLoadError(EMPTY_CANVAS_MEDIA_LOAD_STATE)}
              onError={() => setMediaLoadError({ mediaId: activeItem.id, message: getCanvasMediaLoadErrorMessage(activeItem) })}
            />
          ) : (
            <img
              key={activeItem.id}
              ref={imageRef}
              src={activeItem.objectUrl}
              alt=""
              className="rv-canvas-live-media"
              style={mediaStyle}
              draggable={false}
              onLoad={() => setMediaLoadError(EMPTY_CANVAS_MEDIA_LOAD_STATE)}
              onError={() => setMediaLoadError({ mediaId: activeItem.id, message: getCanvasMediaLoadErrorMessage(activeItem) })}
            />
          )}
        </div>
        {activeMediaLoadError && (
          <div className="rv-canvas-live-error-card" role="alert">
            <strong>CANVAS media could not load</strong>
            <span>{activeMediaLoadError}</span>
          </div>
        )}
        <CanvasParticleAuraLayer
          active={canvasPresetSettings.particleDensity > 0.02}
          activeItem={activeItem}
          sourceRef={particleSourceRef}
          settings={canvasPresetSettings}
          analyser={analyser}
          isPlaying={isPlaying}
          isPaused={isPaused}
        />
      </div>
    </div>
  )
}


type CanvasPresetSliderControlKey = Exclude<CanvasPresetControlKey, 'particleColorMode'>

const CANVAS_PARTICLE_COLOR_MODE_OPTIONS: Array<{ value: CanvasPresetColorMode; label: string }> = [
  { value: 'original', label: 'Original' },
  { value: 'palette', label: 'Palette' },
  { value: 'audioReactive', label: 'Audio Reactive' },
]

function isCanvasPresetSliderControlKey(control: CanvasPresetControlKey): control is CanvasPresetSliderControlKey {
  return control !== 'particleColorMode'
}

const CANVAS_PRESET_CONTROL_META: Record<CanvasPresetSliderControlKey, {
  label: string
  min: number
  max: number
  step: number
  color: string
  description?: string
}> = {
  sourceVisibility: {
    label: 'Source Visibility',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#61d6aa',
    description: 'Blends the selected media source beneath the live CANVAS treatment.',
  },
  intensity: {
    label: 'Visual Intensity',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#4ac7db',
    description: 'Master amount for the current CANVAS look recipe.',
  },
  bassReactivity: {
    label: 'Bass Reactivity',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#61d6aa',
    description: 'Bass pushes scale, glow, and particle spread.',
  },
  beatPulse: {
    label: 'Beat Pulse',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#4ac7db',
    description: 'Detected beats add pulse, scale, and frame energy.',
  },
  glow: {
    label: 'Glow Amount',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#61d6aa',
  },
  trailAmount: {
    label: 'Trail Amount',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#9ddcff',
  },
  rgbSplit: {
    label: 'RGB Split',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#ff4fd8',
    description: 'Offsets cyan and magenta edges without changing the selected source.',
  },
  glitchAmount: {
    label: 'Glitch Amount',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#ff4fd8',
  },
  stutterRate: {
    label: 'Stutter Rate',
    min: 0,
    max: 12,
    step: 1,
    color: '#d8b95a',
    description: 'Frame holds per second. Set to 0 to disable frame stutter.',
  },
  lumaThreshold: {
    label: 'Luma Threshold',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#d8b95a',
    description: 'Brightness cutoff used by luma smear and melt behavior.',
  },
  motionAmount: {
    label: 'Motion Amount',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#9ddcff',
  },
  turbulence: {
    label: 'Turbulence',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#ff4fd8',
  },
  particleDensity: {
    label: 'Particle Density',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#dffcff',
    description: 'Controls how many points CANVAS emits from the active media. Set to 0 to hide particles.',
  },
  particleSize: {
    label: 'Particle Size',
    min: 0.35,
    max: 8,
    step: 0.05,
    color: '#9ddcff',
  },
}

const CANVAS_REACT_CONTROL_GROUPS: Array<{
  title: string
  controls: CanvasPresetControlKey[]
}> = [
  {
    title: 'Source + Reactivity',
    controls: ['sourceVisibility', 'intensity', 'bassReactivity', 'beatPulse'],
  },
  {
    title: 'FX',
    controls: ['glow', 'trailAmount', 'rgbSplit', 'glitchAmount', 'stutterRate', 'lumaThreshold'],
  },
  {
    title: 'Motion + Particles',
    controls: ['motionAmount', 'turbulence', 'particleDensity', 'particleSize', 'particleColorMode'],
  },
]


function CanvasAutoSelectControl() {
  const engine = useSharedAudio()
  const settings = useReactStore(s => s.canvasEngineSettings)
  const selectedCanvasPresetId = useReactStore(s => s.selectedCanvasPresetId)
  const canvasPresetOverride = useReactStore(s => s.canvasPresetOverride)
  const mediaItems = useCanvasRuntimeMediaItems()
  const mediaCount = mediaItems.length
  const setCanvasAutoSelectEnabled = useReactStore(s => s.setCanvasAutoSelectEnabled)
  const clearCanvasPresetOverride = useReactStore(s => s.clearCanvasPresetOverride)
  const clearCanvasMediaOverride = useReactStore(s => s.clearCanvasMediaOverride)
  const selectedPreset = CANVAS_PRESET_BY_ID[selectedCanvasPresetId] ?? CANVAS_PRESET_BY_ID[DEFAULT_CANVAS_PRESET_ID]
  const hasTrackLoaded = Boolean(engine.currentTrackId)
  const manualOverrideActive = canvasPresetOverride?.source === 'manual'
  const autoSelectionActive = settings.autoSelectEnabled && canvasPresetOverride?.source === 'auto'
  const manualMediaOverrideActive = Boolean(
    settings.manualMediaOverrideId && mediaItems.some(item => item.id === settings.manualMediaOverrideId),
  )
  const autoPreview = useMemo(() => resolveCanvasAutoFeatures({
    frame: AudioFeatureBus.getFrame(),
    trackAnalysis: engine.currentAnalysis,
    trackSections: [],
    audioTime: resolveCanvasAudioTime(engine.getCurrentTime),
    activeAudioTrackId: engine.currentTrackId,
  }), [engine.currentAnalysis, engine.currentTrackId, engine.getCurrentTime, engine.currentAnalysisStatus])
  const hasSmartAutoData = autoPreview.hasSmartData

  const description = mediaCount === 0
    ? 'Select saved media from your library first. Auto Select can choose a preset, but it needs personal media to display.'
    : !hasTrackLoaded
      ? 'Load and analyze a track to enable smarter CANVAS Auto Select.'
      : !hasSmartAutoData
        ? 'Audio Intelligence is missing or still warming up. Auto Select waits safely and the current preset stays live.'
        : manualOverrideActive
          ? 'Auto Select can stay on, but it will not replace the manually selected preset until the override is cleared.'
          : manualMediaOverrideActive
            ? 'Uses Audio Intelligence to choose CANVAS presets while keeping your manually selected media locked.'
            : 'Uses Audio Intelligence sections, energy, brightness, and rhythm to choose CANVAS presets and media.'

  return (
    <div className="rv-canvas-auto-select-block">
      <ToggleRow
        label="Auto Select"
        value={settings.autoSelectEnabled}
        onChange={setCanvasAutoSelectEnabled}
        description={description}
      />
      {manualOverrideActive && (
        <div className="rv-canvas-auto-status rv-canvas-auto-status--override" role="status">
          <span>Manual override: {selectedPreset.name} is selected.</span>
          <button type="button" onClick={clearCanvasPresetOverride}>Clear Override</button>
        </div>
      )}
      {!manualOverrideActive && autoSelectionActive && (
        <div className="rv-canvas-auto-status" role="status">
          <span>Auto Select: {canvasPresetOverride?.label ?? `${selectedPreset.name} is selected`}.</span>
        </div>
      )}
      {!manualOverrideActive && settings.autoSelectEnabled && mediaCount === 0 && (
        <div className="rv-canvas-auto-status rv-canvas-auto-status--helper" role="status">
          <span>Select saved media from your library before Auto Select starts choosing visuals.</span>
        </div>
      )}
      {!manualOverrideActive && settings.autoSelectEnabled && mediaCount > 0 && !hasSmartAutoData && (
        <div className="rv-canvas-auto-status rv-canvas-auto-status--helper" role="status">
          <span>{hasTrackLoaded ? `Audio Intelligence missing. CANVAS will keep ${selectedPreset.name} until analysis data arrives.` : 'Load and analyze a track to enable smarter CANVAS Auto Select.'}</span>
        </div>
      )}
      {!manualOverrideActive && settings.autoSelectEnabled && mediaCount > 0 && hasSmartAutoData && !autoSelectionActive && (
        <div className="rv-canvas-auto-status rv-canvas-auto-status--helper" role="status">
          <span>Auto Select armed. CANVAS is reading {autoPreview.reason.toLowerCase()}.</span>
        </div>
      )}
      {!manualOverrideActive && settings.autoSelectEnabled && manualMediaOverrideActive && (
        <div className="rv-canvas-auto-status rv-canvas-auto-status--override" role="status">
          <span>Manual media lock active. Auto Select will not replace the chosen CANVAS visual.</span>
          <button type="button" onClick={clearCanvasMediaOverride}>Clear Media Lock</button>
        </div>
      )}
    </div>
  )
}

function CanvasTimingControls() {
  const engine = useSharedAudio()
  const settings = useReactStore(s => s.canvasEngineSettings)
  const setCanvasEngineSettings = useReactStore(s => s.setCanvasEngineSettings)
  const setCanvasMediaTiming = useReactStore(s => s.setCanvasMediaTiming)
  const restartCanvasVideo = useReactStore(s => s.restartCanvasVideo)
  const activeCanvasMediaId = useReactStore(s => s.activeCanvasMediaId)
  const mediaItems = useCanvasRuntimeMediaItems()
  const activeItem = useMemo(() => mediaItems.find(item => item.id === activeCanvasMediaId) ?? null, [activeCanvasMediaId, mediaItems])
  const hasActiveVideo = activeItem?.type === 'video'
  const timing = activeItem?.timing ?? DEFAULT_CANVAS_VIDEO_TIMING_SETTINGS
  const detectedSectionLabels = useMemo(() => {
    const labels = new Set<string>()
    const sections = engine.currentAnalysis?.sections ?? []
    sections.forEach(section => {
      const mapped = normalizeCanvasTimingSectionType(section.type)
      const option = CANVAS_SECTION_TRIGGER_OPTIONS.find(entry => entry.value === mapped)
      if (option) labels.add(option.label)
    })
    return Array.from(labels)
  }, [engine.currentAnalysis])

  const setTiming = (patch: Partial<CanvasVideoTimingSettings>) => {
    if (!activeItem || activeItem.type !== 'video') return
    setCanvasMediaTiming(activeItem.id, patch)
  }

  const toggleSectionTrigger = (sectionType: CanvasSectionTriggerType) => {
    if (!hasActiveVideo) return
    const current = timing.sectionTriggerTypes.length > 0
      ? timing.sectionTriggerTypes
      : DEFAULT_CANVAS_VIDEO_TIMING_SETTINGS.sectionTriggerTypes
    const next = current.includes(sectionType)
      ? current.filter(value => value !== sectionType)
      : [...current, sectionType]
    setTiming({ sectionTriggerTypes: next.length > 0 ? next : current })
  }

  const timingDescription = hasActiveVideo
    ? 'These controls affect saved library video playback inside CANVAS. Clip audio stays muted so the loaded track remains in charge.'
    : 'CANVAS timing controls are video-only. Select a saved video to enable clip starts, ranges, loops, and musical triggers.'

  const sectionDescription = detectedSectionLabels.length > 0
    ? `Audio Intelligence sections detected: ${detectedSectionLabels.join(', ')}.`
    : 'Map section-trigger restarts to Audio Intelligence sections after a track has been loaded and analyzed.'

  return (
    <Collapsible label="Video Timing" defaultOpen>
      <div className="rv-canvas-engine-note">{timingDescription}</div>
      <SelectRow
        label="Trigger On"
        value={timing.triggerOn}
        onChange={value => setTiming({ triggerOn: value as CanvasTriggerOn })}
        disabled={!hasActiveVideo}
        options={CANVAS_TRIGGER_OPTIONS}
        description="Choose the musical moment that restarts the active CANVAS video clip."
      />
      <NumberInputRow
        label="Clip Start Time"
        value={timing.clipStartSec}
        onChange={value => setTiming({ clipStartSec: value })}
        min={0}
        max={CANVAS_TIMING_MAX_SECONDS}
        step={0.1}
        unit="sec"
        disabled={!hasActiveVideo}
      />
      <NumberInputRow
        label="Clip End Time"
        value={timing.clipEndSec}
        onChange={value => setTiming({ clipEndSec: value })}
        min={0}
        max={CANVAS_TIMING_MAX_SECONDS}
        step={0.1}
        unit="sec"
        disabled={!hasActiveVideo}
      />
      <div className="rv-canvas-engine-note">
        End time 0 uses the full video. Active range: {formatCanvasTimingSeconds(timing.clipStartSec)} → {timing.clipEndSec > 0 ? formatCanvasTimingSeconds(timing.clipEndSec) : 'video end'}.
      </div>
      <ToggleRow
        label="Loop Clip Range"
        value={timing.loopClipRange}
        onChange={value => setTiming({ loopClipRange: value })}
        disabled={!hasActiveVideo}
        description="Loops from Clip Start Time to Clip End Time, or to video end when end time is 0."
      />
      <ToggleRow
        label="Loop Full Video"
        value={settings.loopVideo}
        onChange={value => setCanvasEngineSettings({ loopVideo: value })}
        disabled={!hasActiveVideo}
        description="Fallback full-video loop when no clip end time is set."
      />
      <ToggleRow
        label="Restart on Drop"
        value={timing.restartOnDrop}
        onChange={value => setTiming({ restartOnDrop: value })}
        disabled={!hasActiveVideo}
        description="Restarts the clip when CANVAS detects a drop section or high-confidence drop moment."
      />
      <ToggleRow
        label="Restart on Section Change"
        value={timing.restartOnSectionChange}
        onChange={value => setTiming({ restartOnSectionChange: value })}
        disabled={!hasActiveVideo}
        description="Restarts when the current Audio Intelligence section changes into one of the mapped section types below."
      />
      <ToggleRow
        label="Restart on Manual Preset Change"
        value={timing.restartOnManualPresetChange}
        onChange={value => setTiming({ restartOnManualPresetChange: value })}
        disabled={!hasActiveVideo}
        description="Restarts the clip when the user manually changes the CANVAS preset."
      />
      <div className="rv-canvas-section-trigger-block" aria-label="CANVAS section trigger mapping">
        <div className="rv-canvas-section-trigger-head">
          <span>Section Trigger Mapping</span>
          <em>{sectionDescription}</em>
        </div>
        <div className="rv-canvas-section-trigger-grid">
          {CANVAS_SECTION_TRIGGER_OPTIONS.map(option => {
            const active = timing.sectionTriggerTypes.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                className={`rv-canvas-section-trigger-chip${active ? ' rv-canvas-section-trigger-chip--active' : ''}`}
                onClick={() => toggleSectionTrigger(option.value)}
                disabled={!hasActiveVideo}
                aria-pressed={active}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>
      <button
        type="button"
        className="rv-reset-btn rv-canvas-restart-btn"
        onClick={restartCanvasVideo}
        disabled={!hasActiveVideo}
      >
        Restart Clip
      </button>
    </Collapsible>
  )
}

function CanvasPresetControls() {
  const selectedCanvasPresetId = useReactStore(s => s.selectedCanvasPresetId)
  const canvasPresetSettings = useReactStore(s => s.canvasPresetSettings)
  const canvasPresetOverride = useReactStore(s => s.canvasPresetOverride)
  const setCanvasPresetSettings = useReactStore(s => s.setCanvasPresetSettings)
  const resetCanvasPresetSettings = useReactStore(s => s.resetCanvasPresetSettings)
  const selectedPreset = CANVAS_PRESET_BY_ID[selectedCanvasPresetId] ?? CANVAS_PRESET_BY_ID[DEFAULT_CANVAS_PRESET_ID]

  const activeCanvasMediaId = useReactStore(s => s.activeCanvasMediaId)
  const mediaItems = useCanvasRuntimeMediaItems()
  const activeItem = useMemo(() => mediaItems.find(item => item.id === activeCanvasMediaId) ?? null, [activeCanvasMediaId, mediaItems])
  const customized = canvasPresetOverride?.source === 'manual' && canvasPresetOverride.label === 'User-adjusted preset'

  const renderControl = (control: CanvasPresetControlKey) => {
    if (control === 'particleColorMode') {
      return (
        <SelectRow
          key={control}
          label="Particle Color Mode"
          value={canvasPresetSettings.particleColorMode}
          onChange={value => setCanvasPresetSettings({ particleColorMode: value as CanvasPresetColorMode })}
          options={CANVAS_PARTICLE_COLOR_MODE_OPTIONS}
          description="Original samples source color, Palette uses the DRMVYZ cyan/emerald palette, and Audio Reactive lets highs and bass recolor the particles."
        />
      )
    }

    if (!isCanvasPresetSliderControlKey(control)) return null
    const meta = CANVAS_PRESET_CONTROL_META[control]
    return (
      <SliderRow
        key={control}
        label={meta.label}
        value={canvasPresetSettings[control]}
        onChange={value => setCanvasPresetSettings({ [control]: value } as Partial<CanvasPresetSettings>)}
        min={meta.min}
        max={meta.max}
        step={meta.step}
        color={meta.color}
        description={meta.description}
      />
    )
  }

  return (
    <Collapsible label="CANVAS React Controls" defaultOpen>
      <div className="rv-ctrl-toggle-line">
        <span className="rv-ctrl-label">{selectedPreset.name}{customized ? ' · Customized' : ''}</span>
        <button type="button" className="rv-reset-btn" onClick={resetCanvasPresetSettings}>Reset Recipe</button>
      </div>
      <div className="rv-ctrl-info">
        Presets now load full CANVAS recipes. These parameters stay live so you can reshape the look without changing media.
      </div>
      {canvasPresetSettings.particleDensity > 0.02 && !activeItem && (
        <div className="rv-canvas-engine-note rv-canvas-engine-note--warning">
          Particles need an active CANVAS library media item before they can sample pixels and emit from the source.
        </div>
      )}
      {CANVAS_REACT_CONTROL_GROUPS.map(group => (
        <Collapsible key={group.title} label={group.title} defaultOpen={group.title !== 'Motion + Particles'}>
          {group.controls.map(renderControl)}
        </Collapsible>
      ))}
      {canvasPresetOverride?.source === 'manual' && (
        <div className="rv-canvas-engine-note">
          {customized ? 'Customized look active.' : 'Manual preset override active.'} Clear it under Auto Select to let CANVAS choose recipes again.
        </div>
      )}
      {canvasPresetOverride?.source === 'auto' && (
        <div className="rv-canvas-engine-note">
          {canvasPresetOverride.label ?? 'Auto-selected preset'}.
        </div>
      )}
    </Collapsible>
  )
}


export function CanvasEnginePanel() {
  const libraryMediaCount = useMediaStore(s => s.items.length)
  const canvasReadyCount = useCanvasRuntimeMediaItems().length
  const selectedCanvasPresetId = useReactStore(s => s.selectedCanvasPresetId)
  const selectedPreset = CANVAS_PRESET_BY_ID[selectedCanvasPresetId] ?? CANVAS_PRESET_BY_ID[DEFAULT_CANVAS_PRESET_ID]
  return (
    <>
      <CtrlSection label="CANVAS" />
      <div className="rv-canvas-engine-panel rv-canvas-source-panel">
        <div className="rv-canvas-panel-title">CANVAS Source</div>
        <div className="rv-canvas-panel-copy">{CANVAS_DESCRIPTION}</div>
        <div className="rv-canvas-panel-copy">{CANVAS_MEDIA_COPY}</div>
        <div className="rv-canvas-engine-note">{CANVAS_LIBRARY_HELPER_COPY}</div>
        <CanvasMediaTokens />
        <CanvasActivePreview />
        <CanvasMediaLibrary compact />
        <div className="rv-canvas-panel-status">
          <span>Saved media</span>
          <strong>{libraryMediaCount}</strong>
        </div>
        <div className="rv-canvas-panel-status">
          <span>CANVAS-ready</span>
          <strong>{canvasReadyCount}</strong>
        </div>
        <div className="rv-canvas-panel-status">
          <span>Preset</span>
          <strong>{selectedPreset.name}</strong>
        </div>
      </div>
    </>
  )
}

export function CanvasEngineFxPanel() {
  const settings = useReactStore(s => s.canvasEngineSettings)
  const setCanvasEngineSettings = useReactStore(s => s.setCanvasEngineSettings)

  const setSettings = (patch: Partial<typeof settings>) => {
    setCanvasEngineSettings(patch)
  }

  return (
    <div className="rv-ctrl-group">
      <Collapsible label="CANVAS Source Link" defaultOpen>
        <div className="rv-canvas-panel-copy">Source selection lives in the left SOURCE panel so the center visualizer stays render-only.</div>
        <CanvasAutoSelectControl />
      </Collapsible>

      <CanvasPresetControls />

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

      <CanvasTimingControls />
    </div>
  )
}
