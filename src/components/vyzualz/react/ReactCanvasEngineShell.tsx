import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { useReactStore } from '../../../stores/reactStore'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { AudioFeatureBus } from '../../../features/musicIntelligence/AudioFeatureBus'
import { musicIntelligenceEngine } from '../../../features/musicIntelligence/MusicIntelligenceEngine'
import type { FeatureCurve, MusicIntelligenceFrame, TrackIntelligenceAnalysis } from '../../../features/musicIntelligence/types'
import { Collapsible, CtrlSection, SelectRow, SliderRow, ToggleRow } from './ReactControlRows'
import {
  CANVAS_PRESETS,
  CANVAS_PRESET_BY_ID,
  DEFAULT_CANVAS_PRESET_ID,
  type CanvasFitMode,
  type CanvasMediaItem,
  type CanvasMediaItemType,
  type CanvasPresetControlKey,
  type CanvasPresetId,
  type CanvasPresetSettings,
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
  } as CSSProperties & Record<string, string>
}

function canvasPresetClassName(presetId: CanvasPresetId): string {
  return `rv-canvas-preset--${presetId.replace('canvas-', '')}`
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
    const glitchy = rhythmicSection || mood === 'aggressive' || mood === 'chaotic'
    return {
      hasSmartData,
      presetId: glitchy ? 'canvas-glitch-pulse' : 'canvas-bass-bloom',
      reason: glitchy ? 'High-energy rhythmic section' : 'High-energy drop section',
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
  const highEnergy = features.sectionType === 'drop' || features.energy >= 0.72 || features.presetId === 'canvas-glitch-pulse' || features.presetId === 'canvas-bass-bloom'

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
  const outputRef = useRef<HTMLDivElement | null>(null)
  const trackAnalysisRef = useRef<TrackIntelligenceAnalysis | null>(trackAnalysis)
  const trackSectionsRef = useRef<ReactTrackSection[]>(trackSections)
  const getAudioTimeRef = useRef<typeof getAudioTime>(getAudioTime)
  const activeItem = useMemo(
    () => mediaItems.find(item => item.id === activeCanvasMediaId) ?? null,
    [activeCanvasMediaId, mediaItems],
  )
  const mediaStyle = useMemo(() => makeCanvasMediaStyle(settings), [settings])
  const presetStyle = useMemo(() => makeCanvasPresetStyle(canvasPresetSettings), [canvasPresetSettings])
  const activeVideo = activeItem?.type === 'video'
  const selectedPreset = CANVAS_PRESET_BY_ID[selectedCanvasPresetId] ?? CANVAS_PRESET_BY_ID[DEFAULT_CANVAS_PRESET_ID]

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

      frameId = window.requestAnimationFrame(tick)
    }

    tick()
    return () => window.cancelAnimationFrame(frameId)
  }, [analyser, canvasPresetSettings, isPaused, isPlaying, selectedCanvasPresetId])

  useEffect(() => {
    if (selectedCanvasPresetId !== 'canvas-frame-stutter' || !activeVideo || !isPlaying || isPaused) return
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
        if (isPlaying && !isPaused) playCanvasVideo(videoRef.current)
      }, holdMs)
    }, intervalMs)

    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(resumeTimer)
      if (isPlaying && !isPaused) playCanvasVideo(videoRef.current)
    }
  }, [activeVideo, canvasPresetSettings.glitchAmount, canvasPresetSettings.intensity, canvasPresetSettings.stutterRate, isPaused, isPlaying, selectedCanvasPresetId])


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
          <em>{TYPE_LABELS[activeItem.type]} · {CANVAS_FIT_LABELS[settings.fitMode]} · {selectedPreset.name}</em>
        </div>
        <div className="rv-canvas-live-preset-strip" aria-label="CANVAS preset status">
          <span>Preset affects active CANVAS media</span>
          <strong>{selectedPreset.name}</strong>
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


const CANVAS_PRESET_CONTROL_META: Record<CanvasPresetControlKey, {
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

function CanvasPresetControls() {
  const selectedCanvasPresetId = useReactStore(s => s.selectedCanvasPresetId)
  const canvasPresetSettings = useReactStore(s => s.canvasPresetSettings)
  const canvasPresetOverride = useReactStore(s => s.canvasPresetOverride)
  const setCanvasPresetSettings = useReactStore(s => s.setCanvasPresetSettings)
  const resetCanvasPresetSettings = useReactStore(s => s.resetCanvasPresetSettings)
  const selectedPreset = CANVAS_PRESET_BY_ID[selectedCanvasPresetId] ?? CANVAS_PRESET_BY_ID[DEFAULT_CANVAS_PRESET_ID]

  const renderControl = (control: CanvasPresetControlKey) => {
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
