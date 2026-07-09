import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { useReactStore } from '../../../stores/reactStore'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { AudioFeatureBus } from '../../../features/musicIntelligence/AudioFeatureBus'
import { musicIntelligenceEngine } from '../../../features/musicIntelligence/MusicIntelligenceEngine'
import type { FeatureCurve, MusicIntelligenceFrame, TrackIntelligenceAnalysis } from '../../../features/musicIntelligence/types'
import { Collapsible, CtrlSection, NumberInputRow, SelectRow, SliderRow, ToggleRow } from './ReactControlRows'
import {
  CANVAS_PRESETS,
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

function makeCanvasMediaStyle(
  settings: ReturnType<typeof useReactStore.getState>['canvasEngineSettings'],
  presetId: CanvasPresetId,
  presetSettings: CanvasPresetSettings,
): CSSProperties {
  const presetSourceVisibility = presetId === 'canvas-particle-aura'
    ? presetSettings.sourceVisibility
    : 1

  return {
    objectFit: canvasObjectFit(settings.fitMode),
    opacity: settings.opacity * presetSourceVisibility,
    transform: `translate(calc(${settings.positionX}% + var(--canvas-preset-shake-x, 0px)), calc(${settings.positionY}% + var(--canvas-preset-shake-y, 0px))) rotate(calc(${settings.rotation}deg + var(--canvas-preset-rotate, 0deg))) scale(calc(${settings.scale} + var(--canvas-preset-scale-boost, 0)))`,
  }
}

function makeCanvasPresetStyle(settings: CanvasPresetSettings): CSSProperties {
  const glitchPx = 2 + settings.glitchAmount * 10
  const trailOffset = settings.motionTrailAmount * 18
  const lumaLift = Math.max(0, 1 - settings.lumaThreshold)
  return {
    '--canvas-preset-intensity': settings.intensity.toFixed(3),
    '--canvas-preset-glow': settings.glow.toFixed(3),
    '--canvas-preset-trail': settings.motionTrailAmount.toFixed(3),
    '--canvas-preset-glitch': settings.glitchAmount.toFixed(3),
    '--canvas-preset-glitch-opacity': (settings.glitchAmount * 0.5).toFixed(3),
    '--canvas-preset-stutter-rate': settings.stutterRate.toFixed(3),
    '--canvas-preset-stutter-duration': `${(1 / Math.max(1, settings.stutterRate)).toFixed(3)}s`,
    '--canvas-preset-luma-threshold': settings.lumaThreshold.toFixed(3),
    '--canvas-preset-luma-opacity': (0.18 + lumaLift * 0.36 + settings.motionTrailAmount * 0.18).toFixed(3),
    '--canvas-preset-luma-contrast': (1.04 + lumaLift * 0.28).toFixed(3),
    '--canvas-preset-glitch-px': `${glitchPx.toFixed(2)}px`,
    '--canvas-preset-glitch-neg-px': `${(-glitchPx).toFixed(2)}px`,
    '--canvas-preset-trail-offset': `${trailOffset.toFixed(2)}px`,
    '--canvas-preset-trail-neg-offset': `${(-trailOffset).toFixed(2)}px`,
    '--canvas-preset-luma-blur': `${(settings.motionTrailAmount * 5 + settings.intensity * 1.5 + lumaLift * 2).toFixed(2)}px`,
    '--canvas-particle-source-visibility': settings.sourceVisibility.toFixed(3),
    '--canvas-particle-glow': settings.glow.toFixed(3),
    '--canvas-particle-glow-blur': `${(18 + settings.glow * 28).toFixed(2)}px`,
    '--canvas-particle-source-brightness': (0.82 + settings.sourceVisibility * 0.34).toFixed(3),
    '--canvas-particle-dissolve': settings.dissolveAmount.toFixed(3),
    '--canvas-particle-dissolve-blur': `${(settings.dissolveAmount * 1.8).toFixed(2)}px`,
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
  const targetCount = CANVAS_PARTICLE_MIN_COUNT + settings.particleAmount * (CANVAS_PARTICLE_MAX_COUNT - CANVAS_PARTICLE_MIN_COUNT)
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
  const threshold = 0.08 + settings.dissolveAmount * 0.28
  const stride = settings.particleAmount > 0.72 ? 1 : 2
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
      if (seededCanvasParticleNoise(seed) < settings.dissolveAmount * 0.36) continue
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
    const jitter = 0.002 + settings.dissolveAmount * 0.018
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
      const fade = 1 - clampCanvasRange(settings.trailLength, 0, 0.94)
      if (settings.trailLength <= 0.03) {
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
      const bassPush = bass * settings.bassBurst * settings.intensity * Math.min(width, height) * 0.18
      const beatScale = 1 + beat * settings.beatPulse * 0.9
      const glow = settings.glow * (8 + bass * 28 + beat * 20)
      const dissolveScatter = settings.dissolveAmount * Math.min(width, height) * 0.12
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
          (0.16 + point.luma * 0.78) * point.alpha * settings.intensity * (1 - settings.dissolveAmount * 0.42) * sparkle,
          0,
          0.95,
        )
        if (alpha <= 0.015 || (settings.dissolveAmount > 0.72 && (index % 3) === 0 && dissolveNoise < settings.dissolveAmount - 0.46)) return

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

export function CanvasEngineSurface({
  isPlaying,
  isPaused,
  analyser,
  trackAnalysis = null,
  trackSections = [],
  getAudioTime,
  activeAudioTrackId = null,
}: {
  isPlaying: boolean
  isPaused: boolean
  analyser?: AnalyserNode | null
  trackAnalysis?: TrackIntelligenceAnalysis | null
  trackSections?: ReactTrackSection[]
  getAudioTime?: () => number
  activeAudioTrackId?: string | null
}) {
  const settings = useReactStore(s => s.canvasEngineSettings)
  const activeCanvasMediaId = useReactStore(s => s.activeCanvasMediaId)
  const mediaItems = useReactStore(s => s.canvasMediaItems)
  const restartRevision = useReactStore(s => s.canvasVideoRestartRevision)
  const restartCanvasVideo = useReactStore(s => s.restartCanvasVideo)
  const selectedCanvasPresetId = useReactStore(s => s.selectedCanvasPresetId)
  const canvasPresetSettings = useReactStore(s => s.canvasPresetSettings)
  const canvasPresetOverride = useReactStore(s => s.canvasPresetOverride)
  const applyCanvasAutoSelection = useReactStore(s => s.applyCanvasAutoSelection)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const outputRef = useRef<HTMLDivElement | null>(null)
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
    () => makeCanvasMediaStyle(settings, selectedPreset.id, canvasPresetSettings),
    [canvasPresetSettings, selectedPreset.id, settings],
  )
  const particleSourceRef = activeVideo ? videoRef : imageRef

  trackAnalysisRef.current = trackAnalysis
  trackSectionsRef.current = trackSections
  getAudioTimeRef.current = getAudioTime

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

    if (isPlaying && !isPaused) playCanvasVideo(video)
    else video.pause()
  }, [activeTiming, activeTiming.clipEndSec, activeTiming.loopClipRange, activeVideo, activeItem?.id, isPaused, isPlaying, settings.loopVideo])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !activeVideo) return

    seekCanvasVideoToClipStart(video, activeTiming, isPlaying && !isPaused)
  }, [activeTiming, activeTiming.clipStartSec, activeVideo, activeItem?.id, isPaused, isPlaying, restartRevision])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !activeVideo) return

    const handleMetadata = () => {
      seekCanvasVideoToClipStart(video, activeTiming, isPlaying && !isPaused)
    }

    video.addEventListener('loadedmetadata', handleMetadata)
    if (video.readyState >= 1) handleMetadata()
    return () => video.removeEventListener('loadedmetadata', handleMetadata)
  }, [activeTiming, activeTiming.clipStartSec, activeVideo, activeItem?.id, isPaused, isPlaying])

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
          seekCanvasVideoToClipStart(video, activeTiming, isPlaying && !isPaused)
        }

        if (hasClipBoundary && endSec !== null && video.currentTime >= endSec - 0.035) {
          if (activeTiming.loopClipRange) {
            seekCanvasVideoToClipStart(video, activeTiming, isPlaying && !isPaused)
          } else {
            video.pause()
          }
        }
      }

      frameId = window.requestAnimationFrame(tick)
    }

    tick()
    return () => window.cancelAnimationFrame(frameId)
  }, [activeTiming, activeTiming.clipEndSec, activeTiming.clipStartSec, activeTiming.loopClipRange, activeVideo, isPaused, isPlaying, settings.loopVideo])

  const previousTimingPresetRef = useRef<CanvasPresetId>(selectedCanvasPresetId)
  useEffect(() => {
    const previousPresetId = previousTimingPresetRef.current
    previousTimingPresetRef.current = selectedCanvasPresetId

    if (!activeVideo || previousPresetId === selectedCanvasPresetId) return
    if (!activeTiming.restartOnManualPresetChange || canvasPresetOverride?.source !== 'manual') return
    seekCanvasVideoToClipStart(videoRef.current, activeTiming, isPlaying && !isPaused)
  }, [activeTiming, activeVideo, canvasPresetOverride?.source, isPaused, isPlaying, selectedCanvasPresetId])

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
      const shouldPlay = isPlaying && !isPaused
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
  }, [activeAudioTrackId, activeTiming, activeVideo, isPaused, isPlaying])

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
      const shake = selectedCanvasPresetId === 'canvas-glitch-pulse' || selectedCanvasPresetId === 'canvas-frame-stutter'
        ? (beat * 9 + high * 4 + 0.8) * glitch * intensity
        : 0
      const bloomScale = selectedCanvasPresetId === 'canvas-bass-bloom'
        ? bass * intensity * 0.16
        : selectedCanvasPresetId === 'canvas-frame-stutter'
          ? beat * intensity * 0.035
          : 0

      output.style.setProperty('--canvas-preset-bass', bass.toFixed(3))
      output.style.setProperty('--canvas-preset-beat', beat.toFixed(3))
      output.style.setProperty('--canvas-preset-high', high.toFixed(3))
      output.style.setProperty('--canvas-preset-scale-boost', bloomScale.toFixed(4))
      output.style.setProperty('--canvas-preset-shake-x', `${(shake * shakePhase).toFixed(2)}px`)
      output.style.setProperty('--canvas-preset-shake-y', `${(shake * Math.cos(now * 41)).toFixed(2)}px`)
      output.style.setProperty('--canvas-preset-rotate', `${(shake * 0.16).toFixed(2)}deg`)
      output.style.setProperty('--canvas-preset-live-glow', (glow * (0.28 + bass * 0.85)).toFixed(3))
      output.style.setProperty('--canvas-preset-live-trail', (canvasPresetSettings.motionTrailAmount * (0.35 + bass * 0.65)).toFixed(3))
      output.style.setProperty('--canvas-particle-bass-scale', (1.02 + bass * 0.08).toFixed(4))

      frameId = window.requestAnimationFrame(tick)
    }

    tick()
    return () => window.cancelAnimationFrame(frameId)
  }, [analyser, canvasPresetSettings, isPaused, isPlaying, selectedCanvasPresetId])

  useEffect(() => {
    if (selectedCanvasPresetId !== 'canvas-frame-stutter' || !activeVideo || !isPlaying || isPaused) return
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
        if (isPlaying && !isPaused) playCanvasVideo(currentVideo)
      }, holdMs)
    }, intervalMs)

    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(resumeTimer)
      if (isPlaying && !isPaused) playCanvasVideo(cleanupVideo)
    }
  }, [activeVideo, canvasPresetSettings.glitchAmount, canvasPresetSettings.intensity, canvasPresetSettings.stutterRate, isPaused, isPlaying, selectedCanvasPresetId])


  if (!activeItem) {
    return (
      <div className="rv-canvas-engine-surface rv-canvas-engine-surface--empty" role="region" aria-label="CANVAS engine media surface">
        <div className="rv-canvas-live-empty-card">
          <div className="rv-canvas-engine-eyebrow">CANVAS Uploaded Media</div>
          <h2 className="rv-canvas-live-empty-title">No active CANVAS media selected</h2>
          <p className="rv-canvas-engine-desc">
            {selectedPreset.id === 'canvas-particle-aura'
              ? 'Particle Aura needs an active video, image, or SVG to sample before it can emit particles.'
              : 'Upload a video, image, or SVG in the CANVAS engine panel, then select it to make it the main React View visual.'}
          </p>
          <CanvasMediaTokens />
          <CanvasUploadControl />
        </div>
      </div>
    )
  }

  return (
    <div className="rv-canvas-engine-surface" role="region" aria-label="CANVAS engine media surface">
      <div
        ref={outputRef}
        className={`rv-canvas-live-output ${canvasPresetClassName(selectedPreset.id)}`}
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
            />
          )}
        </div>
        <CanvasParticleAuraLayer
          active={selectedPreset.id === 'canvas-particle-aura'}
          activeItem={activeItem}
          sourceRef={particleSourceRef}
          settings={canvasPresetSettings}
          analyser={analyser}
          isPlaying={isPlaying}
          isPaused={isPaused}
        />
        <div className="rv-canvas-live-badge">
          <span>CANVAS uploaded media</span>
          <strong title={activeItem.name}>{activeItem.name}</strong>
          <em>{TYPE_LABELS[activeItem.type]} · {CANVAS_FIT_LABELS[settings.fitMode]} · {selectedPreset.name}</em>
        </div>
        <div className="rv-canvas-live-preset-strip" aria-label="CANVAS preset status">
          <span>Preset affects active CANVAS media</span>
          <strong>{selectedPreset.name}</strong>
        </div>
        {activeVideo && (
          <div className="rv-canvas-live-video-strip" aria-label="CANVAS video playback status">
            <span>{isPlaying && !isPaused ? 'Audio-linked playback' : 'Waiting for React transport'}</span>
            <strong>{activeTiming.loopClipRange ? 'Clip loop on' : settings.loopVideo ? 'Loop on' : 'Loop off'}</strong>
            <button type="button" onClick={restartCanvasVideo}>Restart clip</button>
            <em>Muted</em>
          </div>
        )}
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
  intensity: {
    label: 'Intensity',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#4ac7db',
    description: 'Overall strength of the selected CANVAS preset treatment.',
  },
  glow: {
    label: 'Glow',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#61d6aa',
  },
  motionTrailAmount: {
    label: 'Motion / Trail Amount',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#9ddcff',
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
    min: 1,
    max: 12,
    step: 1,
    color: '#d8b95a',
    description: 'Frame holds per second when Frame Stutter is active.',
  },
  lumaThreshold: {
    label: 'Luma Threshold',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#d8b95a',
    description: 'Approximate brightness cutoff for the Luma Melt smear.',
  },
  particleAmount: {
    label: 'Particle Amount',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#dffcff',
    description: 'Controls how many points Particle Aura emits from the active media.',
  },
  particleSize: {
    label: 'Particle Size',
    min: 0.35,
    max: 8,
    step: 0.05,
    color: '#9ddcff',
  },
  sourceVisibility: {
    label: 'Source Visibility',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#61d6aa',
    description: 'Blends the original uploaded media beneath the particle layer.',
  },
  dissolveAmount: {
    label: 'Dissolve Amount',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#d8b95a',
  },
  trailLength: {
    label: 'Trail Length',
    min: 0,
    max: 0.94,
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
  bassBurst: {
    label: 'Bass Burst',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#61d6aa',
    description: 'Bass pushes particles outward and increases glow.',
  },
  beatPulse: {
    label: 'Beat Pulse',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#4ac7db',
    description: 'Detected beats scale and brighten the particle field.',
  },
}

export function CanvasPresetBrowser() {
  const selectedCanvasPresetId = useReactStore(s => s.selectedCanvasPresetId)
  const selectCanvasPreset = useReactStore(s => s.selectCanvasPreset)
  const activeCanvasMediaId = useReactStore(s => s.activeCanvasMediaId)
  const activeItem = useReactStore(s => s.canvasMediaItems.find(item => item.id === activeCanvasMediaId) ?? null)

  return (
    <section className="rv-canvas-preset-browser" aria-label="CANVAS presets">
      <div className="rv-canvas-preset-browser__copy">
        <strong>CANVAS Presets</strong>
        <span>{activeItem ? `These treatments apply to ${activeItem.name}.` : 'Upload and select CANVAS media, then choose a treatment.'}</span>
      </div>
      <div className="rv-preset-group-cards rv-preset-group-cards--current rv-canvas-preset-grid" data-preset-grid>
        {CANVAS_PRESETS.map(preset => {
          const active = preset.id === selectedCanvasPresetId
          return (
            <div key={preset.id} className="rv-preset-card-shell rv-canvas-preset-card-shell">
              <button
                type="button"
                className={`rv-preset-card rv-canvas-preset-card${active ? ' rv-preset-card--active' : ''}`}
                onClick={() => selectCanvasPreset(preset.id)}
                data-preset-card
                aria-pressed={active}
                aria-current={active ? 'true' : undefined}
                title={preset.description}
              >
                <div className="rv-preset-card-content">
                  <div className="rv-preset-card-header">
                    <span className="rv-preset-engine-icon" style={{ color: preset.accent }} aria-hidden="true">▣</span>
                    <span className="rv-preset-name">{preset.name}</span>
                  </div>
                  <div className="rv-preset-chip-row">
                    <span className="rv-preset-mode-chip">Active media FX</span>
                    {active && <span className="rv-preset-modified-chip">Selected</span>}
                  </div>
                  <p className="rv-preset-desc">{preset.description}</p>
                  <div className="rv-preset-palette" aria-label={`${preset.name} accent`}>
                    <span className="rv-palette-swatch" style={{ background: preset.accent }} title={preset.accent} />
                    <span className="rv-palette-swatch" style={{ background: '#4ac7db' }} title="CANVAS cyan" />
                    <span className="rv-palette-swatch" style={{ background: '#61d6aa' }} title="CANVAS emerald" />
                  </div>
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function CanvasAutoSelectControl() {
  const engine = useSharedAudio()
  const settings = useReactStore(s => s.canvasEngineSettings)
  const selectedCanvasPresetId = useReactStore(s => s.selectedCanvasPresetId)
  const canvasPresetOverride = useReactStore(s => s.canvasPresetOverride)
  const setCanvasAutoSelectEnabled = useReactStore(s => s.setCanvasAutoSelectEnabled)
  const clearCanvasPresetOverride = useReactStore(s => s.clearCanvasPresetOverride)
  const selectedPreset = CANVAS_PRESET_BY_ID[selectedCanvasPresetId] ?? CANVAS_PRESET_BY_ID[DEFAULT_CANVAS_PRESET_ID]
  const hasTrackLoaded = Boolean(engine.currentTrackId)
  const hasAnalyzedTrack = Boolean(engine.currentAnalysis && engine.currentAnalysisStatus === 'complete')
  const manualOverrideActive = canvasPresetOverride?.source === 'manual'
  const autoSelectionActive = settings.autoSelectEnabled && canvasPresetOverride?.source === 'auto'

  const description = !hasTrackLoaded
    ? 'Load and analyze a track to enable smarter CANVAS Auto Select.'
    : !hasAnalyzedTrack
      ? 'Load and analyze a track to enable smarter CANVAS Auto Select. Live audio fallback stays safe while analysis is missing.'
      : manualOverrideActive
        ? 'Auto Select can stay on, but it will not replace the manually selected preset until the override is cleared.'
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
          <span>Auto Select: {selectedPreset.name} is selected.</span>
        </div>
      )}
      {!manualOverrideActive && settings.autoSelectEnabled && !hasAnalyzedTrack && (
        <div className="rv-canvas-auto-status rv-canvas-auto-status--helper" role="status">
          <span>Load and analyze a track to enable smarter CANVAS Auto Select.</span>
        </div>
      )}
    </div>
  )
}

function CanvasTimingControls() {
  const engine = useSharedAudio()
  const settings = useReactStore(s => s.canvasEngineSettings)
  const setCanvasEngineSettings = useReactStore(s => s.setCanvasEngineSettings)
  const restartCanvasVideo = useReactStore(s => s.restartCanvasVideo)
  const setCanvasMediaTiming = useReactStore(s => s.setCanvasMediaTiming)
  const activeCanvasMediaId = useReactStore(s => s.activeCanvasMediaId)
  const activeItem = useReactStore(s => s.canvasMediaItems.find(item => item.id === activeCanvasMediaId) ?? null)
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
    ? 'These controls affect uploaded video playback inside CANVAS. Clip audio stays muted so the loaded track remains in charge.'
    : 'CANVAS timing controls are video-only. Select an uploaded video to enable clip starts, ranges, loops, and musical triggers.'

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
  const activeItem = useReactStore(s => s.canvasMediaItems.find(item => item.id === activeCanvasMediaId) ?? null)

  const renderControl = (control: CanvasPresetControlKey) => {
    if (control === 'particleColorMode') {
      return (
        <SelectRow
          key={control}
          label="Color Mode"
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
    <Collapsible label="Preset Treatment" defaultOpen>
      <div className="rv-canvas-preset-controls-head">
        <div>
          <strong>{selectedPreset.name}</strong>
          <span>Applies to the active CANVAS media only.</span>
        </div>
        <button type="button" className="rv-reset-btn" onClick={resetCanvasPresetSettings}>Reset</button>
      </div>
      {selectedPreset.id === 'canvas-particle-aura' && !activeItem && (
        <div className="rv-canvas-engine-note rv-canvas-engine-note--warning">
          Particle Aura needs an active CANVAS media item before it can sample pixels and emit particles.
        </div>
      )}
      {selectedPreset.controls.length > 0 ? selectedPreset.controls.map(renderControl) : (
        <div className="rv-canvas-engine-note">Clean Playback keeps the uploaded media neutral. Use Display controls for transform and opacity.</div>
      )}
      {canvasPresetOverride?.source === 'manual' && (
        <div className="rv-canvas-engine-note">
          Manual override active. Clear it under Auto Select to let CANVAS choose again.
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
  const settings = useReactStore(s => s.canvasEngineSettings)
  const mediaCount = useReactStore(s => s.canvasMediaItems.length)
  const selectedCanvasPresetId = useReactStore(s => s.selectedCanvasPresetId)
  const selectedPreset = CANVAS_PRESET_BY_ID[selectedCanvasPresetId] ?? CANVAS_PRESET_BY_ID[DEFAULT_CANVAS_PRESET_ID]
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
        <div className="rv-canvas-panel-status">
          <span>Preset</span>
          <strong>{selectedPreset.name}</strong>
        </div>
      </div>
    </>
  )
}

export function CanvasEngineFxPlaceholder() {
  const settings = useReactStore(s => s.canvasEngineSettings)
  const setCanvasEngineSettings = useReactStore(s => s.setCanvasEngineSettings)

  const setSettings = (patch: Partial<typeof settings>) => {
    setCanvasEngineSettings(patch)
  }

  return (
    <div className="rv-ctrl-group">
      <Collapsible label="CANVAS Media" defaultOpen>
        <div className="rv-canvas-panel-copy">{CANVAS_MEDIA_COPY}</div>
        <CanvasAutoSelectControl />
        <CanvasUploadControl compact />
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
