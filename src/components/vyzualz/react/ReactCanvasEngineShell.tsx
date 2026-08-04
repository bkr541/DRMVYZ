import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useReactStore } from '../../../stores/reactStore'
import { useMediaStore, type UploadedMedia } from '../../../stores/mediaStore'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { useBrandKitStore } from '../../../features/personalization/brandKitStore'
import { AudioFeatureBus } from '../../../features/musicIntelligence/AudioFeatureBus'
import { musicIntelligenceEngine } from '../../../features/musicIntelligence/MusicIntelligenceEngine'
import { adaptMIAnalysis, resolveTrackSections } from '../../../features/trackIntelligence/trackMapAdapter'
import { buildSharedPerformanceContext, createSharedPerformanceDiagnostics, type SharedPerformanceContext } from '../../../features/performanceCore'
import type { FeatureCurve, MusicIntelligenceFrame, TrackIntelligenceAnalysis } from '../../../features/musicIntelligence/types'
import { Collapsible, ColorRow, CtrlSection, NumberInputRow, SelectRow, SliderRow, ToggleRow } from './ReactControlRows'
import { HelpInfoTrigger, type HelpInfoTriggerProps } from '../../shared/InfoPopover'
import { SharedPerformanceDiagnosticsPanel } from './SharedPerformanceDiagnosticsPanel'
import { clearSharedPerformanceDiagnostics, publishSharedPerformanceDiagnostics } from './SharedPerformanceDiagnosticsStore'
import { MediaLibraryBrowser } from '../media/MediaLibraryBrowser'
import {
  getCanvasMediaTransparencyKey,
  prepareCanvasCaptureBackground,
  resolveCanvasBackgroundModeWithoutInspection,
  resolveCanvasMediaBackgroundMode,
  type CanvasBackgroundMode,
} from './canvasMediaTransparency'
import { CANVAS_MEDIA_LIBRARY_CAPABILITIES } from '../media/mediaLibraryCapabilities'
import {
  hasCanvasBaseTransform,
  hasCanvasEffectPass,
  makeCanvasCaptureFilter,
  resolveCanvasEffectOpacity,
  resolveCanvasPlaybackUrl,
} from './canvasMediaFidelity'
import {
  CanvasParticleAuraRenderer,
  compositeCanvasParticleLayerToCapture,
  getCanvasParticleSourceSize,
  isCanvasParticleSourceReady,
  resolveCanvasParticleAdaptiveQuality,
  resolveCanvasParticleBudget,
  resolveCanvasParticleQualityProfile,
  sampleCanvasParticleSource,
  type CanvasParticleAudioFrame,
  type CanvasParticlePoint,
} from './renderers/CanvasParticleAuraRenderer'
import { CanvasFracturesRendererLayer } from './renderers/CanvasFracturesRendererLayer'
import {
  buildCanvasPreloadRequests,
  CANVAS_COMPOSITION_TEMPLATE_OPTIONS,
  CANVAS_MEDIA_ROLES,
  CANVAS_MEDIA_ROLE_LABELS,
  CANVAS_PERFORMANCE_SHOW_OPTIONS,
  CanvasOrchestrationStage,
  CanvasPreloadManager,
  resolveCanvasOutputContract,
  getCanvasPerformancePreloadCandidates,
  getCanvasPerformanceShow,
  isCanvasFracturesProcessor,
  resolveCanvasMediaRoles,
  resolveCanvasPerformanceFrame,
  type CanvasCompositionPreference,
  type CanvasLayerRole,
  type CanvasMediaRole,
  type CanvasPerformanceShowId,
  type CanvasResolvedPerformanceFrame,
} from './canvasPerformance'
import {
  CANVAS_PRESET_BY_ID,
  DEFAULT_CANVAS_PRESET_ID,
  DEFAULT_CANVAS_VIDEO_TIMING_SETTINGS,
  type CanvasFitMode,
  type CanvasFractureAnchorMode,
  type CanvasFractureColorSourceMode,
  type CanvasFractureMode,
  type CanvasFracturePlacementMode,
  type CanvasFractureQualityMode,
  type CanvasFractureQuantizeInterval,
  type CanvasFractureTransitionMode,
  type CanvasMediaItem,
  type CanvasMediaItemType,
  type CanvasParticleQuality,
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

interface CanvasHelpControlProps {
  helpId: HelpInfoTriggerProps['helpId']
  currentValue?: ReactNode
  currentValueLabel?: HelpInfoTriggerProps['currentValueLabel']
  currentValueTone?: HelpInfoTriggerProps['currentValueTone']
  placement?: HelpInfoTriggerProps['placement']
  className?: string
  children: ReactNode
}

function CanvasHelpControl({
  helpId,
  currentValue,
  currentValueLabel,
  currentValueTone,
  placement = 'left',
  className = 'rv-canvas-control-help',
  children,
}: CanvasHelpControlProps) {
  return (
    <div className={`${className} drm-help-overlay-anchor`}>
      {children}
      <HelpInfoTrigger
        helpId={helpId}
        currentValue={currentValue}
        currentValueLabel={currentValueLabel}
        currentValueTone={currentValueTone}
        placement={placement}
      />
    </div>
  )
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

interface CanvasOverrideStatusProps {
  message: string
  clearLabel: string
  clearAriaLabel: string
  onClear: () => void
}

function CanvasOverrideStatus({
  message,
  clearLabel,
  clearAriaLabel,
  onClear,
}: CanvasOverrideStatusProps) {
  return (
    <div className="rv-canvas-auto-status rv-canvas-auto-status--override" role="status">
      <span>{message}</span>
      <button type="button" onClick={onClear} aria-label={clearAriaLabel}>{clearLabel}</button>
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
  return resolveCanvasPlaybackUrl(media)
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
    createdAt: Number.isFinite(media.metadata.analyzedAt)
      ? new Date(media.metadata.analyzedAt as number).toISOString()
      : new Date(0).toISOString(),
    width: media.metadata.width,
    height: media.metadata.height,
    durationSec: media.metadata.duration,
    fps: media.metadata.fps,
    hasAlpha: media.metadata.hasAlpha,
    loopable: media.metadata.loopable,
    bpm: media.metadata.bpm,
    energy: media.metadata.energy,
    tags: media.tags,
    collectionIds: media.collectionIds,
    libraryRole: media.mediaRole,
    mediaRevision: media.revision,
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
  const orchestration = useReactStore(s => s.canvasOrchestrationSettings)
  const toggleCanvasMediaPoolItem = useReactStore(s => s.toggleCanvasMediaPoolItem)
  const setCanvasMediaRoles = useReactStore(s => s.setCanvasMediaRoles)
  const mediaItems = useCanvasRuntimeMediaItems()
  const manualMediaOverrideId = useReactStore(s => s.canvasEngineSettings.manualMediaOverrideId)
  const clearCanvasMediaOverride = useReactStore(s => s.clearCanvasMediaOverride)
  const manualMediaOverrideActive = Boolean(manualMediaOverrideId && mediaItems.some(item => item.id === manualMediaOverrideId))
  const activeItem = mediaItems.find(item => item.id === activeCanvasMediaId) ?? null
  const poolItems = orchestration.mediaPoolIds
    .map(id => mediaItems.find(item => item.id === id) ?? null)
    .filter((item): item is CanvasMediaItem => item !== null)
  const roleResolution = activeItem ? resolveCanvasMediaRoles(activeItem, orchestration) : null
  const explicitRoles = activeItem ? orchestration.mediaRolesById[activeItem.id] ?? [] : []

  const toggleRole = (role: CanvasMediaRole) => {
    if (!activeItem) return
    const roles = explicitRoles.includes(role)
      ? explicitRoles.filter(candidate => candidate !== role)
      : [...explicitRoles, role]
    setCanvasMediaRoles(activeItem.id, roles)
  }

  return (
    <div className={`rv-canvas-library-shell${compact ? ' rv-canvas-library-shell--compact' : ''}`}>
      {manualMediaOverrideActive && (
        <CanvasOverrideStatus
          message="Media lock: This CANVAS source stays selected."
          clearLabel="Clear"
          clearAriaLabel="Clear CANVAS media lock"
          onClear={clearCanvasMediaOverride}
        />
      )}
      <MediaLibraryBrowser
        activeMediaId={activeCanvasMediaId}
        onSelect={id => selectCanvasMediaItem(id)}
        context="canvas"
        title="Media Library"
        capabilities={CANVAS_MEDIA_LIBRARY_CAPABILITIES}
        getDisabledReason={getCanvasLibraryDisabledReason}
      />
      <div className="rv-canvas-pool" aria-label="CANVAS performance media pool">
        <div className="rv-canvas-pool__head">
          <span>Performance Pool</span>
          <strong>{poolItems.length}</strong>
        </div>
        {poolItems.length === 0 ? (
          <p className="rv-control-helper-copy">Select media to build a deterministic multi-source pool.</p>
        ) : (
          <div className="rv-canvas-pool__chips">
            {poolItems.map(item => (
              <span key={item.id} className={`rv-canvas-pool-chip${item.id === activeCanvasMediaId ? ' rv-canvas-pool-chip--active' : ''}`}>
                <button type="button" onClick={() => selectCanvasMediaItem(item.id)} title={item.name}>{item.name}</button>
                <button type="button" onClick={() => toggleCanvasMediaPoolItem(item.id, false)} aria-label={`Remove ${item.name} from CANVAS performance pool`}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>
      {activeItem && orchestration.mediaPoolIds.includes(activeItem.id) && (
        <div className="rv-canvas-role-editor" aria-label={`Performance roles for ${activeItem.name}`}>
          <div className="rv-canvas-pool__head">
            <span>Roles · {activeItem.name}</span>
            {explicitRoles.length === 0 && roleResolution && <em>Auto: {roleResolution.automatic.map(role => CANVAS_MEDIA_ROLE_LABELS[role]).join(', ')}</em>}
          </div>
          <div className="rv-canvas-role-grid">
            {CANVAS_MEDIA_ROLES.map(role => {
              const explicit = explicitRoles.includes(role)
              const effective = roleResolution?.effective.includes(role) ?? false
              return (
                <button
                  key={role}
                  type="button"
                  className={`rv-canvas-role-chip${explicit ? ' rv-canvas-role-chip--active' : effective ? ' rv-canvas-role-chip--auto' : ''}`}
                  onClick={() => toggleRole(role)}
                  aria-pressed={explicit}
                  title={explicit ? 'Assigned by user' : effective ? 'Assigned automatically' : 'Assign role'}
                >
                  {CANVAS_MEDIA_ROLE_LABELS[role]}
                </button>
              )
            })}
          </div>
        </div>
      )}
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
  drySourceMix: number,
): CSSProperties {
  const transform = hasCanvasBaseTransform(settings)
    ? `translate(${settings.positionX}%, ${settings.positionY}%) rotate(${settings.rotation}deg) scale(${settings.scale})`
    : undefined

  return {
    objectFit: canvasObjectFit(settings.fitMode),
    opacity: drySourceMix,
    transform,
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
    '--canvas-preset-glitch-px': `${rgbPx.toFixed(2)}px`,
    '--canvas-preset-glitch-neg-px': `${(-rgbPx).toFixed(2)}px`,
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
    '--canvas-particle-source-visibility': settings.drySourceMix.toFixed(3),
    '--canvas-particle-glow': settings.glow.toFixed(3),
    '--canvas-particle-density': settings.particleDensity.toFixed(3),
    '--canvas-particle-glow-blur': `${(18 + settings.glow * 28 + settings.particleDensity * 16).toFixed(2)}px`,
    '--canvas-particle-source-brightness': (0.82 + settings.drySourceMix * 0.34).toFixed(3),
    '--canvas-particle-dissolve': settings.turbulence.toFixed(3),
    '--canvas-particle-dissolve-blur': `${(settings.turbulence * 1.8).toFixed(2)}px`,
  } as CSSProperties & Record<string, string>
}

type CanvasParticleSourceElement = HTMLVideoElement | HTMLImageElement
type CanvasParticleRendererMode = 'webgl' | 'canvas2d'

function clampCanvasRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

function resolveCanvas2dParticleBudget(
  settings: CanvasPresetSettings,
  profile: ReturnType<typeof resolveCanvasParticleQualityProfile>,
  quality: CanvasParticleQuality,
  width: number,
  height: number,
): number {
  const qualityCap = quality === 'high' ? 1800 : quality === 'balanced' ? 1200 : 760
  return Math.min(qualityCap, resolveCanvasParticleBudget(settings, profile, width, height))
}

function getCanvas2dParticleColor(
  point: CanvasParticlePoint,
  mode: CanvasPresetColorMode,
  audio: CanvasParticleAudioFrame,
  alpha: number,
): string {
  if (mode === 'original') return `rgba(${point.r}, ${point.g}, ${point.b}, ${alpha.toFixed(3)})`
  if (mode === 'palette') {
    const mix = clampCanvasRange(point.luma * 0.75 + (point.seed % 1) * 0.25, 0, 1)
    const r = Math.round(74 + (97 - 74) * mix)
    const g = Math.round(199 + (214 - 199) * mix)
    const b = Math.round(219 + (170 - 219) * mix)
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`
  }
  const r = Math.round(74 + (255 - 74) * clampCanvasRange(audio.high * 0.82, 0, 1))
  const g = Math.round(199 + (97 - 199) * clampCanvasRange(audio.bass * 0.45, 0, 1))
  const b = Math.round(219 + (216 - 219) * clampCanvasRange(audio.bass * 0.65 + audio.high * 0.6, 0, 1))
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`
}

function drawCanvas2dParticleFrame({
  context,
  canvas,
  points,
  settings,
  audio,
  timeSec,
  pixelRatio,
}: {
  context: CanvasRenderingContext2D
  canvas: HTMLCanvasElement
  points: CanvasParticlePoint[]
  settings: CanvasPresetSettings
  audio: CanvasParticleAudioFrame
  timeSec: number
  pixelRatio: number
}) {
  const width = canvas.width
  const height = canvas.height
  context.save()
  context.setTransform(1, 0, 0, 1, 0, 0)
  if (settings.trailAmount <= 0.01) {
    context.clearRect(0, 0, width, height)
  } else {
    context.globalCompositeOperation = 'destination-out'
    context.fillStyle = `rgba(0, 0, 0, ${clampCanvasRange(0.24 - settings.trailAmount * 0.19, 0.035, 0.24).toFixed(3)})`
    context.fillRect(0, 0, width, height)
  }

  context.globalCompositeOperation = 'lighter'
  const bassBurst = audio.bass * settings.bassReactivity * settings.intensity
  const beatBurst = audio.beat * settings.beatPulse * settings.intensity
  const centerX = width * 0.5
  const centerY = height * 0.5
  for (const point of points) {
    const phase = timeSec * (0.65 + settings.turbulence * 1.9) + point.seed * 3.7
    const drift = (2 + settings.turbulence * 18) * pixelRatio
    const sourceX = point.baseX * width
    const sourceY = point.baseY * height
    const radialX = sourceX - centerX
    const radialY = sourceY - centerY
    const x = sourceX
      + Math.sin(phase) * drift * settings.motionAmount
      + radialX * (bassBurst * 0.11 + beatBurst * 0.045)
    const y = sourceY
      + Math.cos(phase * 1.13) * drift * settings.motionAmount
      + radialY * (bassBurst * 0.11 + beatBurst * 0.045)
    const size = Math.max(
      0.55,
      settings.particleSize * pixelRatio * (0.52 + point.luma * 0.78) * (1 + bassBurst * 0.7 + beatBurst * 0.42),
    )
    const alpha = clampCanvasRange(
      point.alpha * settings.intensity * (0.28 + settings.glow * 0.64 + point.luma * 0.22),
      0.04,
      1,
    )
    const color = getCanvas2dParticleColor(point, settings.particleColorMode, audio, alpha)
    context.fillStyle = color
    context.shadowColor = color
    context.shadowBlur = settings.glow * 16 * pixelRatio
    context.beginPath()
    context.arc(x, y, size, 0, Math.PI * 2)
    context.fill()
  }
  context.restore()
}

function CanvasParticleAuraLayer({
  active,
  activeItem,
  sourceRef,
  settings,
  fitMode,
  sourceTransform,
  analyser,
  performanceContextRef,
  isPlaying,
  isPaused,
  onCanvasReady,
  onStatusChange,
  outputAlpha,
}: {
  active: boolean
  activeItem: CanvasMediaItem | null
  sourceRef: { current: CanvasParticleSourceElement | null }
  settings: CanvasPresetSettings
  fitMode: CanvasFitMode
  sourceTransform: { scale: number; positionX: number; positionY: number; rotation: number }
  analyser?: AnalyserNode | null
  performanceContextRef: { current: SharedPerformanceContext | null }
  isPlaying: boolean
  isPaused: boolean
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onStatusChange?: (message: string | null) => void
  outputAlpha: number
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const settingsRef = useRef(settings)
  const fitModeRef = useRef(fitMode)
  const sourceTransformRef = useRef(sourceTransform)
  const [rendererMode, setRendererMode] = useState<CanvasParticleRendererMode>('webgl')

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    fitModeRef.current = fitMode
  }, [fitMode])

  useEffect(() => {
    sourceTransformRef.current = sourceTransform
  }, [sourceTransform])

  useEffect(() => {
    setRendererMode('webgl')
  }, [activeItem?.id])

  useEffect(() => {
    if (!active || !activeItem) {
      onCanvasReady?.(null)
      onStatusChange?.(null)
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return

    const sampleCanvas = document.createElement('canvas')
    const frequencyData = analyser ? new Uint8Array(Math.max(1, analyser.frequencyBinCount)) : null
    let points: CanvasParticlePoint[] = []
    let frameId = 0
    let lastSampleAt = 0
    let previousBass = 0
    let heldBeat = 0
    let fpsFrames = 0
    let fpsLastAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
    let requestedQuality = settingsRef.current.particleQuality
    let runtimeQuality = requestedQuality
    let lowFpsWindows = 0
    let highFpsWindows = 0
    let disposed = false
    let lastUploadedColorMode = settingsRef.current.particleColorMode

    const readAudioFrame = (now: number): CanvasParticleAudioFrame => {
      const context = performanceContextRef.current
      if (context && isPlaying && !isPaused) {
        return {
          bass: clampCanvasRange(context.bass, 0, 1),
          mid: clampCanvasRange(context.mid, 0, 1),
          high: clampCanvasRange(context.high, 0, 1),
          beat: clampCanvasRange(Math.max(context.kickStrength, context.transient * 0.72), 0, 1),
          kick: context.kick ? clampCanvasRange(context.kickStrength, 0, 1) : 0,
          snare: context.snare ? clampCanvasRange(context.snareStrength, 0, 1) : 0,
          hat: context.hat ? clampCanvasRange(context.hatStrength, 0, 1) : 0,
          downbeat: context.downbeat && context.boundaries.beatBoundary ? 1 : 0,
          energy: clampCanvasRange(context.energy, 0, 1),
          energyTrend: clampCanvasRange(context.energyTrend * 0.5 + 0.5, 0, 1),
          spectralFlux: clampCanvasRange(context.spectralFlux, 0, 1),
          tension: clampCanvasRange(context.tension, 0, 1),
          buildProgress: clampCanvasRange(context.buildProgress, 0, 1),
          dropImpact: clampCanvasRange(context.dropImpact, 0, 1),
          phraseProgress: clampCanvasRange(context.phraseProgress, 0, 1),
          sectionProgress: clampCanvasRange(context.sectionProgress, 0, 1),
          fourBarProgress: clampCanvasRange(context.fourBarProgress, 0, 1),
          vocalEnergy: clampCanvasRange(context.vocalEnergy, 0, 1),
        }
      }

      let bass = 0.16 + Math.sin(now * 1.4) * 0.035
      let mid = 0.13 + Math.sin(now * 1.9) * 0.025
      let high = 0.12 + Math.sin(now * 2.7) * 0.025
      let beat = Math.max(0, Math.sin(now * 2.2)) * 0.22
      if (analyser && frequencyData && isPlaying && !isPaused) {
        analyser.getByteFrequencyData(frequencyData)
        bass = averageByteRange(frequencyData, 0, 0.09)
        mid = averageByteRange(frequencyData, 0.16, 0.52)
        high = averageByteRange(frequencyData, 0.62, 1)
        const bassDelta = bass - previousBass
        heldBeat = Math.max(0, heldBeat * 0.76, bass > 0.5 && bassDelta > 0.035 ? 1 : 0)
        beat = heldBeat
        previousBass = previousBass * 0.58 + bass * 0.42
      } else {
        previousBass = bass
      }
      return {
        bass,
        mid,
        high,
        beat,
        kick: beat,
        snare: Math.max(0, Math.sin(now * 1.1 + 1.7)) * high * 0.2,
        hat: high * 0.35,
        downbeat: beat > 0.9 ? 1 : 0,
        energy: clampCanvasRange(bass * 0.5 + mid * 0.28 + high * 0.22, 0, 1),
        energyTrend: 0.5,
        spectralFlux: high * 0.5,
        tension: mid * 0.35,
        buildProgress: 0,
        dropImpact: beat * bass,
        phraseProgress: (now / 8) % 1,
        sectionProgress: (now / 24) % 1,
        fourBarProgress: (now / 4) % 1,
        vocalEnergy: mid * 0.22,
      }
    }

    const updateAdaptiveQuality = (nowMs: number) => {
      fpsFrames += 1
      if (nowMs - fpsLastAt < 1200) return false
      const fps = (fpsFrames * 1000) / Math.max(1, nowMs - fpsLastAt)
      fpsFrames = 0
      fpsLastAt = nowMs
      const adaptive = resolveCanvasParticleAdaptiveQuality({
        requested: requestedQuality,
        current: runtimeQuality,
        fps,
        lowFpsWindows,
        highFpsWindows,
      })
      lowFpsWindows = adaptive.lowFpsWindows
      highFpsWindows = adaptive.highFpsWindows
      if (adaptive.quality === runtimeQuality) return false
      runtimeQuality = adaptive.quality
      return true
    }

    if (rendererMode === 'webgl') {
      const createResult = CanvasParticleAuraRenderer.create(canvas)
      if (!createResult.renderer) {
        onStatusChange?.(`${createResult.error}. Using the lower-density Canvas2D compatibility renderer.`)
        setRendererMode('canvas2d')
        return () => {
          disposed = true
          onCanvasReady?.(null)
        }
      }

      onStatusChange?.(null)
      const renderer = createResult.renderer
      const captureSnapshotCanvas = document.createElement('canvas')
      const captureSnapshotContext = captureSnapshotCanvas.getContext('2d', { alpha: true })
      let lastSnapshotAt = 0
      onCanvasReady?.(captureSnapshotCanvas)

      const handleContextLost = (event: Event) => {
        event.preventDefault()
        if (disposed) return
        onStatusChange?.('Particle Aura lost its WebGL2 context. Switching to the Canvas2D compatibility renderer.')
        setRendererMode('canvas2d')
      }
      canvas.addEventListener('webglcontextlost', handleContextLost)

      const tick = () => {
        if (disposed) return
        const rect = canvas.getBoundingClientRect()
        const cssWidth = Math.max(1, Math.round(rect.width || canvas.clientWidth || 1))
        const cssHeight = Math.max(1, Math.round(rect.height || canvas.clientHeight || 1))
        const liveSettings = settingsRef.current
        if (liveSettings.particleQuality !== requestedQuality) {
          requestedQuality = liveSettings.particleQuality
          runtimeQuality = requestedQuality
          lowFpsWindows = 0
          highFpsWindows = 0
          renderer.clear()
        }
        const profile = resolveCanvasParticleQualityProfile(runtimeQuality)
        const dpr = Math.min(profile.maxDpr, Math.max(1, window.devicePixelRatio || 1))
        renderer.resize(Math.round(cssWidth * dpr), Math.round(cssHeight * dpr))

        const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
        const now = nowMs / 1000
        const audio = readAudioFrame(now)
        renderer.render({
          settings: liveSettings,
          audio,
          source: sourceRef.current,
          fitMode: fitModeRef.current,
          sourceTransform: sourceTransformRef.current,
          qualityProfile: profile,
          timeSec: now,
          pixelRatio: dpr,
        })

        if (captureSnapshotContext && nowMs - lastSnapshotAt >= 30) {
          if (captureSnapshotCanvas.width !== canvas.width || captureSnapshotCanvas.height !== canvas.height) {
            captureSnapshotCanvas.width = canvas.width
            captureSnapshotCanvas.height = canvas.height
          }
          captureSnapshotContext.clearRect(0, 0, captureSnapshotCanvas.width, captureSnapshotCanvas.height)
          try {
            captureSnapshotContext.drawImage(canvas, 0, 0)
          } catch {
            // Preserve the previous stable recording frame after transient GPU copies.
          }
          lastSnapshotAt = nowMs
        }

        if (updateAdaptiveQuality(nowMs)) renderer.clear()
        frameId = window.requestAnimationFrame(tick)
      }

      tick()
      return () => {
        disposed = true
        window.cancelAnimationFrame(frameId)
        canvas.removeEventListener('webglcontextlost', handleContextLost)
        renderer.dispose()
        captureSnapshotContext?.clearRect(0, 0, captureSnapshotCanvas.width, captureSnapshotCanvas.height)
        onCanvasReady?.(null)
      }
    }

    const context = canvas.getContext('2d', { alpha: true })
    if (!context) {
      onStatusChange?.('Particle Aura is unavailable because this browser could not initialize WebGL2 or Canvas2D.')
      return () => onCanvasReady?.(null)
    }
    onStatusChange?.('Particle Aura is using the lower-density Canvas2D compatibility renderer because WebGL2 is unavailable.')
    onCanvasReady?.(canvas)

    const tick = () => {
      if (disposed) return
      const rect = canvas.getBoundingClientRect()
      const cssWidth = Math.max(1, Math.round(rect.width || canvas.clientWidth || 1))
      const cssHeight = Math.max(1, Math.round(rect.height || canvas.clientHeight || 1))
      const liveSettings = settingsRef.current
      if (liveSettings.particleQuality !== requestedQuality) {
        requestedQuality = liveSettings.particleQuality
        runtimeQuality = requestedQuality
        lowFpsWindows = 0
        highFpsWindows = 0
        points = []
        lastSampleAt = 0
      }
      const profile = resolveCanvasParticleQualityProfile(runtimeQuality)
      const dpr = Math.min(1.25, Math.max(1, window.devicePixelRatio || 1))
      const targetWidth = Math.round(cssWidth * dpr)
      const targetHeight = Math.round(cssHeight * dpr)
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth
        canvas.height = targetHeight
        points = []
      }

      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const now = nowMs / 1000
      const audio = readAudioFrame(now)
      const source = sourceRef.current
      const sampleInterval = activeItem.type === 'video' && isPlaying && !isPaused
        ? Math.max(120, profile.videoSampleIntervalMs)
        : Math.max(720, profile.staticSampleIntervalMs)
      const targetCount = resolveCanvas2dParticleBudget(liveSettings, profile, runtimeQuality, cssWidth, cssHeight)
      if (points.length === 0 || nowMs - lastSampleAt > sampleInterval || liveSettings.particleColorMode !== lastUploadedColorMode) {
        points = sampleCanvasParticleSource({ source, settings: liveSettings, sampleCanvas, profile, targetCount })
        lastUploadedColorMode = liveSettings.particleColorMode
        lastSampleAt = nowMs
      }

      drawCanvas2dParticleFrame({ context, canvas, points, settings: liveSettings, audio, timeSec: now, pixelRatio: dpr })
      if (updateAdaptiveQuality(nowMs)) points = []
      frameId = window.requestAnimationFrame(tick)
    }

    tick()
    return () => {
      disposed = true
      window.cancelAnimationFrame(frameId)
      context.clearRect(0, 0, canvas.width, canvas.height)
      onCanvasReady?.(null)
    }
  }, [active, activeItem, analyser, isPaused, isPlaying, onCanvasReady, onStatusChange, performanceContextRef, rendererMode, sourceRef])

  if (!active || !activeItem) return null
  return (
    <canvas
      key={rendererMode}
      ref={canvasRef}
      className="rv-canvas-particle-aura-layer"
      data-particle-renderer={rendererMode}
      style={{ opacity: outputAlpha }}
      aria-hidden="true"
    />
  )
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

type CanvasAutoDataMode = 'audioIntelligence' | 'liveAudio' | 'fallback'

type CanvasAutoFeatureSnapshot = {
  hasSmartData: boolean
  dataMode: CanvasAutoDataMode
  sourceLabel: string
  presetId: CanvasPresetId
  reason: string
  energy: number
  brightness: number
  rhythm: number
  sectionType: ReactSectionType | null
  mood: string | null
}

function hasCanvasLiveAudioFeatures(frame: MusicIntelligenceFrame): boolean {
  if (frame.frameId <= 0) return false
  const rawFrequencyData = frame.raw.freqData
  const rawTimeDomainData = frame.raw.timeDomainData
  const hasRawData = Boolean(
    (rawFrequencyData && rawFrequencyData.length > 0) ||
    (rawTimeDomainData && rawTimeDomainData.length > 0),
  )
  const hasLiveCapabilities = Boolean(frame.capabilities?.liveBands || frame.capabilities?.rhythmEvents)
  const liveLevel = Math.max(
    clampCanvasUnit(frame.bands.volume),
    clampCanvasUnit(frame.bands.normalizedBass),
    clampCanvasUnit(frame.bands.normalizedHigh),
    clampCanvasUnit(frame.energy.instant),
    clampCanvasUnit(frame.energy.shortTerm),
    clampCanvasUnit(frame.rhythm.transient),
    clampCanvasUnit(frame.rhythm.kickStrength),
    clampCanvasUnit(frame.rhythm.snareStrength),
  )
  return hasRawData || hasLiveCapabilities || liveLevel > 0.015 || frame.rhythm.beatHit || frame.rhythm.kickHit || frame.rhythm.snareHit
}

function getCanvasAutoSourceLabel(dataMode: CanvasAutoDataMode): string {
  if (dataMode === 'audioIntelligence') return 'Audio Intelligence'
  if (dataMode === 'liveAudio') return 'Live audio features only'
  return 'Fallback/static selection'
}

function formatCanvasAutoSelectionLabel(features: CanvasAutoFeatureSnapshot, presetName: string): string {
  return `${features.sourceLabel}: ${features.reason} · ${presetName}`
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
  const publishedSection = frameMatchesTrack ? frame.currentResolvedSection : null
  const authoredSection = findCanvasSectionAt(trackSections, audioTime)
  const hasAudioIntelligence = Boolean(
    activeAudioTrackId && (
      frameMatchesTrack ||
      trackAnalysis ||
      authoredSection
    ),
  )
  const hasLiveAudio = hasCanvasLiveAudioFeatures(frame)
  const dataMode: CanvasAutoDataMode = hasAudioIntelligence
    ? 'audioIntelligence'
    : hasLiveAudio
      ? 'liveAudio'
      : 'fallback'
  const sourceLabel = getCanvasAutoSourceLabel(dataMode)
  const hasSmartData = dataMode !== 'fallback'

  const sectionType = publishedSection?.type
    ?? authoredSection?.type
    ?? (frameMatchesTrack ? frame.section.type : null)
    ?? null
  const sectionIntensity = clampCanvasUnit(
    publishedSection?.intensity,
    clampCanvasUnit(authoredSection?.intensity, frameMatchesTrack ? frame.section.intensity : 0),
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

  const frameEnergy = Math.max(
    clampCanvasUnit(frame.energy.trackCurve),
    clampCanvasUnit(frame.energy.shortTerm),
    clampCanvasUnit(frame.energy.percentile),
    clampCanvasUnit(frame.energy.instant),
    clampCanvasUnit(frame.bands.volume),
    clampCanvasUnit(frame.bands.normalizedBass),
    sectionIntensity,
  )
  const frameBrightness = Math.max(
    clampCanvasUnit(frame.bands.normalizedHigh),
    clampCanvasUnit(frame.bands.normalizedAir),
    clampCanvasUnit(frame.energy.spectralCentroid),
    curveHigh,
    curveCentroid,
  )
  const frameRhythm = Math.max(
    clampCanvasUnit(frame.rhythm.transient),
    clampCanvasUnit(frame.rhythm.kickStrength),
    clampCanvasUnit(frame.rhythm.snareStrength),
    clampCanvasUnit(frame.stems.drumEnergy),
    clampCanvasUnit(frame.energy.spectralFlux),
    curveFlux,
  )
  const liveFrameAllowed = frameMatchesTrack || dataMode === 'liveAudio'
  const energy = liveFrameAllowed ? frameEnergy : Math.max(curveEnergy, sectionIntensity)
  const brightness = liveFrameAllowed ? frameBrightness : Math.max(curveHigh, curveCentroid)
  const rhythm = liveFrameAllowed ? frameRhythm : Math.max(curveFlux, curveBass, curveComplexity)
  const buildConfidence = liveFrameAllowed ? clampCanvasUnit(frame.semantics.buildConfidence) : 0
  const dropConfidence = liveFrameAllowed ? clampCanvasUnit(frame.semantics.dropConfidence) : 0
  const complexity = liveFrameAllowed ? clampCanvasUnit(frame.energy.complexity, curveComplexity) : curveComplexity
  const mood = liveFrameAllowed ? frame.semantics.mood : null

  if (!hasSmartData) {
    return {
      hasSmartData: false,
      dataMode,
      sourceLabel,
      presetId: DEFAULT_CANVAS_PRESET_ID,
      reason: activeAudioTrackId
        ? 'Fallback/static selection while Audio Intelligence warms up'
        : 'Fallback/static selection until a loaded track or live audio features are available',
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
      dataMode,
      sourceLabel,
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
      dataMode,
      sourceLabel,
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
      dataMode,
      sourceLabel,
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
      dataMode,
      sourceLabel,
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
      dataMode,
      sourceLabel,
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
    dataMode,
    sourceLabel,
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
  const frameMatchesTrack = isCanvasFrameForTrack(frame, activeAudioTrackId)
  const publishedSection = frameMatchesTrack ? frame.currentResolvedSection : null
  const authoredSection = findCanvasSectionAt(trackSections, audioTime)
  return publishedSection?.type ?? authoredSection?.type ?? (frameMatchesTrack ? frame.section.type : null) ?? null
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
  const activeBrandKit = useBrandKitStore(s => s.activeKit)
  const orchestrationSettings = useReactStore(s => s.canvasOrchestrationSettings)
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
  const sourceEffectsCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const particleOutputCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const orchestrationPreloadManagerRef = useRef<CanvasPreloadManager | null>(null)
  if (!orchestrationPreloadManagerRef.current) orchestrationPreloadManagerRef.current = new CanvasPreloadManager()
  const orchestrationPreloadManager = orchestrationPreloadManagerRef.current
  const previousOrchestrationContextRef = useRef<SharedPerformanceContext | null>(null)
  const previousOrchestrationFrameRef = useRef<CanvasResolvedPerformanceFrame | null>(null)
  const previousParticlePerformanceContextRef = useRef<SharedPerformanceContext | null>(null)
  const particlePerformanceContextRef = useRef<SharedPerformanceContext | null>(null)
  const [orchestrationFrame, setOrchestrationFrame] = useState<CanvasResolvedPerformanceFrame | null>(null)
  const [mediaLoadError, setMediaLoadError] = useState<CanvasMediaLoadState>(EMPTY_CANVAS_MEDIA_LOAD_STATE)
  const [particleRendererNotice, setParticleRendererNotice] = useState<string | null>(null)
  const [fracturesRendererNotice, setFracturesRendererNotice] = useState<string | null>(null)
  const [fracturesReadySourceKey, setFracturesReadySourceKey] = useState<string | null>(null)
  const [detectedBackgroundMode, setDetectedBackgroundMode] = useState<{
    mediaKey: string
    mode: CanvasBackgroundMode
  } | null>(null)
  const trackAnalysisRef = useRef<TrackIntelligenceAnalysis | null>(trackAnalysis)
  const trackSectionsRef = useRef<ReactTrackSection[]>(trackSections)
  const getAudioTimeRef = useRef<typeof getAudioTime>(getAudioTime)
  const activeItem = useMemo(
    () => mediaItems.find(item => item.id === activeCanvasMediaId) ?? null,
    [activeCanvasMediaId, mediaItems],
  )
  const fracturesSourceKey = activeItem
    ? `${activeItem.id}:${activeItem.type}:${activeItem.mediaRevision ?? 0}:${activeItem.objectUrl}`
    : null
  const presetStyle = useMemo(() => makeCanvasPresetStyle(canvasPresetSettings), [canvasPresetSettings])
  const selectedPreset = CANVAS_PRESET_BY_ID[selectedCanvasPresetId] ?? CANVAS_PRESET_BY_ID[DEFAULT_CANVAS_PRESET_ID]
  const rendererKind = selectedPreset.rendererKind
  const outputContract = useMemo(() => resolveCanvasOutputContract({
    canvasOutputOpacity: settings.opacity,
    presetSettings: canvasPresetSettings,
  }), [canvasPresetSettings, settings.opacity])
  const particleReconstructionActive = rendererKind === 'particleAura'
  const fragmentCollageActive = rendererKind === 'fragmentCollage'
  const effectPassActive = rendererKind === 'standard' && hasCanvasEffectPass(canvasPresetSettings)
  const activeVideo = activeItem?.type === 'video'
  const activeMediaTransparencyKey = activeItem ? getCanvasMediaTransparencyKey(activeItem) : null
  const activeMediaTransparencyKeyRef = useRef<string | null>(activeMediaTransparencyKey)
  activeMediaTransparencyKeyRef.current = activeMediaTransparencyKey
  const immediateBackgroundMode = activeItem ? resolveCanvasBackgroundModeWithoutInspection(activeItem) : 'stage'
  const effectiveBackgroundMode: CanvasBackgroundMode = immediateBackgroundMode
    ?? (detectedBackgroundMode?.mediaKey === activeMediaTransparencyKey ? detectedBackgroundMode.mode : 'stage')
  const transparentStage = effectiveBackgroundMode === 'transparent'
  const activeTiming = activeItem?.timing ?? DEFAULT_CANVAS_VIDEO_TIMING_SETTINGS
  const mediaStyle = useMemo(
    () => makeCanvasMediaStyle(
      settings,
      fragmentCollageActive && fracturesReadySourceKey === fracturesSourceKey ? 0 : outputContract.drySourceMix,
    ),
    [fracturesReadySourceKey, fracturesSourceKey, fragmentCollageActive, outputContract.drySourceMix, settings],
  )
  const particleSourceRef = activeVideo ? videoRef : imageRef
  const handleParticleCanvasReady = useCallback((canvas: HTMLCanvasElement | null) => {
    particleOutputCanvasRef.current = canvas
  }, [])
  const handleFracturesPreviewReady = useCallback((ready: boolean) => {
    setFracturesReadySourceKey(ready ? fracturesSourceKey : null)
  }, [fracturesSourceKey])

  trackAnalysisRef.current = trackAnalysis
  trackSectionsRef.current = trackSections
  getAudioTimeRef.current = getAudioTime

  useEffect(() => {
    if (!orchestrationSettings.enabled) {
      orchestrationPreloadManager.releaseAll()
      previousOrchestrationContextRef.current = null
      previousOrchestrationFrameRef.current = null
      setOrchestrationFrame(null)
      clearSharedPerformanceDiagnostics('canvas')
      return
    }

    const trackIdentity = activeAudioTrackId ?? 'canvas:unloaded-track'
    orchestrationPreloadManager.setScope(trackIdentity, orchestrationSettings.poolRevision)
    previousOrchestrationContextRef.current = null
    previousOrchestrationFrameRef.current = null

    const resolveFrame = () => {
      const audioTimeSec = resolveCanvasAudioTime(getAudioTimeRef.current)
      const context = buildSharedPerformanceContext({
        audioTimeSec,
        frame: AudioFeatureBus.getFrame(),
        analysis: trackAnalysisRef.current,
        resolvedSections: trackSectionsRef.current,
        trackIdentity,
        trackChangeIdentity: `track:${trackIdentity}`,
        previous: previousOrchestrationContextRef.current,
      })
      const nextFrame = resolveCanvasPerformanceFrame({
        context,
        settings: orchestrationSettings,
        mediaItems,
        previousFrame: previousOrchestrationFrameRef.current,
        isMediaReady: mediaId => orchestrationPreloadManager.isReady(mediaId),
      })
      const activeMediaIds = nextFrame.layers
        .map(layer => layer.sourceMediaId)
        .filter((id): id is string => Boolean(id))
      const candidateMediaIds = getCanvasPerformancePreloadCandidates(nextFrame, orchestrationSettings, mediaItems)
      orchestrationPreloadManager.request(buildCanvasPreloadRequests({
        mediaItems,
        activeMediaIds,
        candidateMediaIds,
        trackIdentity,
        poolRevision: orchestrationSettings.poolRevision,
      }))
      orchestrationPreloadManager.retainOnly([...activeMediaIds, ...candidateMediaIds])
      previousOrchestrationContextRef.current = context
      previousOrchestrationFrameRef.current = nextFrame
      const lockedParameters = [
        ...Object.entries(orchestrationSettings.globalLocks).filter(([, locked]) => locked).map(([key]) => key),
        ...Object.entries(orchestrationSettings.layerLocks).filter(([, locked]) => locked).map(([key]) => `layer:${key}`),
        ...Object.keys(orchestrationSettings.mediaLocksByLayer).map(key => `media:${key}`),
      ]
      const activeEvents = [
        context.kick ? 'kick' : null,
        context.snare ? 'snare' : null,
        context.hat ? 'hat' : null,
        context.downbeat && context.boundaries.beatBoundary ? 'downbeat' : null,
      ].filter((value): value is string => Boolean(value))
      publishSharedPerformanceDiagnostics(createSharedPerformanceDiagnostics(context, {
        engine: 'canvas',
        performanceShow: nextFrame.showLabel,
        scene: nextFrame.sceneId,
        motifOrComposition: nextFrame.template.label,
        activeLayers: nextFrame.layers.filter(layer => layer.enabled).map(layer => `${layer.role}:${layer.source?.name ?? 'fallback'}`),
        activeEventEnvelopes: activeEvents,
        recentActions: [nextFrame.transition?.id, nextFrame.effectRecipeId, ...nextFrame.diagnostics].filter((value): value is string => Boolean(value)),
        continuousRoutes: nextFrame.layers.flatMap(layer => layer.modulationRoutes.map(route => route.id)),
        lockedParameters,
        fallbackState: nextFrame.fallbackUsed ? nextFrame.diagnostics.join(', ') || 'Media fallback active' : null,
        resourceLimitDecisions: nextFrame.diagnostics.filter(item => item.includes('limit') || item.includes('safe-mode') || item.includes('fallback-compositing')),
      }))
      setOrchestrationFrame(nextFrame)
    }

    resolveFrame()
    const intervalId = window.setInterval(resolveFrame, 80)
    return () => window.clearInterval(intervalId)
  }, [activeAudioTrackId, mediaItems, orchestrationPreloadManager, orchestrationSettings])

  useEffect(() => () => {
    orchestrationPreloadManager.dispose()
    clearSharedPerformanceDiagnostics('canvas')
  }, [orchestrationPreloadManager])

  useEffect(() => {
    if (!particleReconstructionActive && !fragmentCollageActive) {
      previousParticlePerformanceContextRef.current = null
      particlePerformanceContextRef.current = null
      return
    }

    const trackIdentity = activeAudioTrackId ?? 'canvas:unloaded-track'
    previousParticlePerformanceContextRef.current = null

    const resolveParticleContext = () => {
      const context = buildSharedPerformanceContext({
        audioTimeSec: resolveCanvasAudioTime(getAudioTimeRef.current),
        frame: AudioFeatureBus.getFrame(),
        analysis: trackAnalysisRef.current,
        resolvedSections: trackSectionsRef.current,
        trackIdentity,
        trackChangeIdentity: `track:${trackIdentity}`,
        previous: previousParticlePerformanceContextRef.current,
      })
      previousParticlePerformanceContextRef.current = context
      particlePerformanceContextRef.current = context
    }

    resolveParticleContext()
    const intervalId = window.setInterval(resolveParticleContext, 50)
    return () => {
      window.clearInterval(intervalId)
      previousParticlePerformanceContextRef.current = null
      particlePerformanceContextRef.current = null
    }
  }, [activeAudioTrackId, fragmentCollageActive, particleReconstructionActive])

  const orchestrationHasFractures = Boolean(
    orchestrationFrame?.layers.some(layer => isCanvasFracturesProcessor(layer.processor)),
  )
  const orchestrationRenderable = Boolean(
    (rendererKind !== 'fragmentCollage' || orchestrationHasFractures)
      && orchestrationSettings.enabled
      && orchestrationFrame?.orchestrationActive
      && orchestrationFrame.readyMediaIds.length > 0,
  )

  useEffect(() => {
    if (fragmentCollageActive && !orchestrationRenderable) {
      onCanvasReady?.(null)
      return
    }
    if (orchestrationRenderable) return
    const captureCanvas = outputCaptureCanvasRef.current
    onCanvasReady?.(captureCanvas)
    return () => onCanvasReady?.(null)
  }, [fragmentCollageActive, onCanvasReady, orchestrationRenderable])

  useEffect(() => {
    if (orchestrationRenderable || fragmentCollageActive) return
    const captureCanvas = outputCaptureCanvasRef.current
    const effectsCanvas = sourceEffectsCanvasRef.current
    if (!captureCanvas || !effectsCanvas) return
    const captureContext = captureCanvas.getContext('2d', { alpha: true })
    const effectsContext = effectsCanvas.getContext('2d', { alpha: true })
    if (!captureContext || !effectsContext) return
    const compositionCanvas = document.createElement('canvas')
    const compositionContext = compositionCanvas.getContext('2d', { alpha: true })
    if (!compositionContext) return

    const frequencyData = analyser ? new Uint8Array(Math.max(1, analyser.frequencyBinCount)) : null
    let frameId = 0
    let previousBass = 0
    let heldBeat = 0
    let fpsFrames = 0
    let fpsLastAt = typeof performance !== 'undefined' ? performance.now() : Date.now()

    const drawSource = () => {
      const visibleRect = outputRef.current?.getBoundingClientRect()
      const cssWidth = Math.max(1, Math.round(visibleRect?.width || 1280))
      const cssHeight = Math.max(1, Math.round(visibleRect?.height || 720))
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
      const targetWidth = Math.max(1, Math.round(cssWidth * dpr))
      const targetHeight = Math.max(1, Math.round(cssHeight * dpr))
      for (const canvas of [captureCanvas, compositionCanvas, effectsCanvas]) {
        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
          canvas.width = targetWidth
          canvas.height = targetHeight
        }
      }

      compositionContext.setTransform(dpr, 0, 0, dpr, 0, 0)
      prepareCanvasCaptureBackground(compositionContext, cssWidth, cssHeight, effectiveBackgroundMode)
      effectsContext.setTransform(dpr, 0, 0, dpr, 0, 0)
      effectsContext.clearRect(0, 0, cssWidth, cssHeight)

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

      const drySourceAlpha = outputContract.drySourceMix
      const processedAlpha = outputContract.sourceMixMode === 'legacyComposite'
        ? outputContract.drySourceMix
        : 1
      const baseTranslateX = cssWidth * 0.5 + cssWidth * 0.5 * (settings.positionX / 100)
      const baseTranslateY = cssHeight * 0.5 + cssHeight * 0.5 * (settings.positionY / 100)
      const liveScale = settings.scale
        + bass * canvasPresetSettings.bassReactivity * canvasPresetSettings.intensity * 0.16
        + beat * canvasPresetSettings.beatPulse * canvasPresetSettings.intensity * 0.045
      const shake = (beat * 9 + high * 4 + 0.8) * canvasPresetSettings.glitchAmount * canvasPresetSettings.intensity
      const motionDriftX = Math.sin(now * (0.9 + canvasPresetSettings.turbulence * 2.6)) * canvasPresetSettings.motionAmount * 9
      const motionDriftY = Math.cos(now * (0.74 + canvasPresetSettings.turbulence * 2.1)) * canvasPresetSettings.motionAmount * 7

      const drawMediaFrame = ({
        context,
        alpha,
        filter,
        reactive,
      }: {
        context: CanvasRenderingContext2D
        alpha: number
        filter: string
        reactive: boolean
      }) => {
        context.save()
        context.globalCompositeOperation = 'source-over'
        context.globalAlpha = alpha
        context.translate(
          baseTranslateX + (reactive ? Math.sin(now * 48) * shake + motionDriftX : 0),
          baseTranslateY + (reactive ? Math.cos(now * 41) * shake + motionDriftY : 0),
        )
        context.rotate((settings.rotation + (reactive ? shake * 0.16 : 0)) * Math.PI / 180)
        context.scale(reactive ? liveScale : settings.scale, reactive ? liveScale : settings.scale)
        context.filter = filter
        try {
          context.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
        } catch {
          // If a browser blocks a specific source draw, keep both render canvases alive.
        }
        context.restore()
      }

      // Standard and Particle Aura capture begins with the same pristine,
      // unfiltered fidelity anchor shown by the browser-owned source. Fractures
      // exits this effect above because recording/output is intentionally
      // deferred until its final renderer contract is implemented.
      drawMediaFrame({
        context: compositionContext,
        alpha: drySourceAlpha,
        filter: 'none',
        reactive: false,
      })

      if (effectPassActive) {
        drawMediaFrame({
          context: effectsContext,
          alpha: processedAlpha * resolveCanvasEffectOpacity(canvasPresetSettings),
          filter: makeCanvasCaptureFilter(canvasPresetSettings, bass, high),
          reactive: true,
        })

        compositionContext.save()
        compositionContext.globalCompositeOperation = 'screen'
        compositionContext.globalAlpha = 1
        compositionContext.filter = 'none'
        compositionContext.drawImage(effectsCanvas, 0, 0, cssWidth, cssHeight)
        compositionContext.restore()
      }

      if (particleReconstructionActive) {
        compositeCanvasParticleLayerToCapture({
          context: compositionContext,
          particleCanvas: particleOutputCanvasRef.current,
          settings: canvasPresetSettings,
          outputAlpha: processedAlpha,
          width: cssWidth,
          height: cssHeight,
        })
      }

      captureContext.setTransform(1, 0, 0, 1, 0, 0)
      captureContext.clearRect(0, 0, targetWidth, targetHeight)
      captureContext.globalCompositeOperation = 'source-over'
      captureContext.globalAlpha = outputContract.canvasOutputOpacity
      captureContext.filter = 'none'
      captureContext.drawImage(compositionCanvas, 0, 0)
      captureContext.globalAlpha = 1
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
  }, [activeItem, analyser, canvasPresetSettings, effectPassActive, effectiveBackgroundMode, fragmentCollageActive, isPaused, isPlaying, onLiveFps, orchestrationRenderable, outputContract, particleReconstructionActive, particleSourceRef, settings])

  useEffect(() => {
    setMediaLoadError(EMPTY_CANVAS_MEDIA_LOAD_STATE)
    setDetectedBackgroundMode(null)
  }, [activeItem?.id, activeItem?.objectUrl])

  const handleCanvasImageLoad = useCallback((image: HTMLImageElement) => {
    setMediaLoadError(EMPTY_CANVAS_MEDIA_LOAD_STATE)
    if (!activeItem || activeItem.type === 'video') return

    const mediaKey = getCanvasMediaTransparencyKey(activeItem)
    void resolveCanvasMediaBackgroundMode(activeItem, image).then(mode => {
      if (activeMediaTransparencyKeyRef.current !== mediaKey) return
      setDetectedBackgroundMode({ mediaKey, mode })
    })
  }, [activeItem])

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
    if (!settings.autoSelectEnabled) return

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

      const mediaId = pickCanvasAutoMedia(mediaItems, activeCanvasMediaId, features)
      const preset = CANVAS_PRESET_BY_ID[features.presetId] ?? CANVAS_PRESET_BY_ID[DEFAULT_CANVAS_PRESET_ID]
      applyCanvasAutoSelection({
        presetId: canvasPresetOverride?.source === 'manual' ? null : preset.id,
        mediaId,
        label: formatCanvasAutoSelectionLabel(features, preset.name),
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
  const sourceEffectsCanvasNode = (
    <canvas
      ref={sourceEffectsCanvasRef}
      className={`rv-canvas-source-fx-canvas${effectPassActive ? ' rv-canvas-source-fx-canvas--active' : ''}`}
      style={{
        opacity: effectPassActive
          ? outputContract.sourceMixMode === 'legacyComposite' ? outputContract.drySourceMix : 1
          : 0,
      }}
      aria-hidden="true"
    />
  )

  if (orchestrationRenderable && orchestrationFrame) {
    return (
      <CanvasOrchestrationStage
        frame={orchestrationFrame}
        preloadManager={orchestrationPreloadManager}
        engineSettings={settings}
        presetSettings={canvasPresetSettings}
        isPlaying={isPlaying}
        isPaused={isPaused}
        motionIntensity={orchestrationSettings.motionIntensity}
        selectedPresetId={selectedCanvasPresetId}
        trackIdentity={activeAudioTrackId}
        trackAnalysis={trackAnalysis}
        trackSections={trackSections}
        getAudioTime={getAudioTime}
        analyser={analyser}
        brandKit={activeBrandKit}
        onCanvasReady={onCanvasReady}
        onLiveFps={onLiveFps}
      />
    )
  }

  if (!activeItem) {
    const hasSelectableMedia = mediaItems.length > 0
    return (
      <div
        className="rv-canvas-engine-surface rv-canvas-engine-surface--empty"
        role="region"
        aria-label="CANVAS engine render surface"
        data-renderer-kind={rendererKind}
      >
        {captureCanvasNode}
        {sourceEffectsCanvasNode}
        <div className="rv-canvas-live-empty-card rv-canvas-live-empty-card--render-only">
          <div className="rv-canvas-engine-eyebrow">CANVAS Output</div>
          <h2 className="rv-canvas-live-empty-title">
            {hasSelectableMedia ? 'No source selected' : 'Choose a CANVAS source'}
          </h2>
          <p className="rv-canvas-engine-desc">
            {fragmentCollageActive
              ? 'Fractures needs an active video, image, or SVG before its specialized fragment renderer can sample the source.'
              : particleReconstructionActive
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
    <div
      className={`rv-canvas-engine-surface${transparentStage ? ' rv-canvas-engine-surface--transparent' : ''}`}
      role="region"
      aria-label="CANVAS engine media surface"
      data-background-mode={effectiveBackgroundMode}
    >
      {captureCanvasNode}
      <div
        ref={outputRef}
        className={`rv-canvas-live-output rv-canvas-param-output${transparentStage ? ' rv-canvas-live-output--transparent' : ''}`}
        data-fit-mode={settings.fitMode}
        data-background-mode={effectiveBackgroundMode}
        data-source-effect-active={effectPassActive ? 'true' : 'false'}
        data-particle-reconstruction-active={particleReconstructionActive ? 'true' : 'false'}
        data-renderer-kind={rendererKind}
        style={{ ...presetStyle, opacity: outputContract.canvasOutputOpacity }}
      >
        {!transparentStage && <div className="rv-canvas-live-grid" aria-hidden="true" />}
        <div className="rv-canvas-preset-aura" aria-hidden="true" />
        <div className="rv-canvas-live-media-shell">
          {activeVideo ? (
            <video
              key={`${activeItem.id}:${activeItem.objectUrl}`}
              ref={videoRef}
              crossOrigin="anonymous"
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
              key={`${activeItem.id}:${activeItem.objectUrl}`}
              ref={imageRef}
              crossOrigin="anonymous"
              src={activeItem.objectUrl}
              alt=""
              className="rv-canvas-live-media"
              style={mediaStyle}
              draggable={false}
              onLoad={event => handleCanvasImageLoad(event.currentTarget)}
              onError={() => setMediaLoadError({ mediaId: activeItem.id, message: getCanvasMediaLoadErrorMessage(activeItem) })}
            />
          )}
          {sourceEffectsCanvasNode}
        </div>
        {activeMediaLoadError && (
          <div className="rv-canvas-live-error-card" role="alert">
            <strong>CANVAS media could not load</strong>
            <span>{activeMediaLoadError}</span>
          </div>
        )}
        <CanvasParticleAuraLayer
          active={particleReconstructionActive}
          activeItem={activeItem}
          sourceRef={particleSourceRef}
          settings={canvasPresetSettings}
          fitMode={settings.fitMode}
          sourceTransform={{
            scale: settings.scale,
            positionX: settings.positionX,
            positionY: settings.positionY,
            rotation: settings.rotation,
          }}
          analyser={analyser}
          performanceContextRef={particlePerformanceContextRef}
          isPlaying={isPlaying}
          isPaused={isPaused}
          onCanvasReady={handleParticleCanvasReady}
          onStatusChange={setParticleRendererNotice}
          outputAlpha={outputContract.sourceMixMode === 'legacyComposite' ? outputContract.drySourceMix : 1}
        />
        {fragmentCollageActive && (
          <CanvasFracturesRendererLayer
            key={fracturesSourceKey ?? activeItem.id}
            active
            sourceRef={particleSourceRef}
            sourceIdentity={fracturesSourceKey ?? activeItem.id}
            mediaType={activeItem.type}
            mediaRevision={activeItem.mediaRevision ?? 0}
            trackIdentity={activeAudioTrackId}
            trackAnalysis={trackAnalysis}
            trackSections={trackSections}
            getAudioTime={getAudioTime}
            analyser={analyser}
            performanceContextRef={particlePerformanceContextRef}
            isPlaying={isPlaying}
            isPaused={isPaused}
            fitMode={settings.fitMode}
            sourceTransform={{
              scale: settings.scale,
              positionX: settings.positionX,
              positionY: settings.positionY,
              rotation: settings.rotation,
            }}
            settings={canvasPresetSettings}
            brandKit={activeBrandKit}
            onPreviewReady={handleFracturesPreviewReady}
            onStatusChange={setFracturesRendererNotice}
          />
        )}
        {particleRendererNotice && particleReconstructionActive && (
          <div className="rv-canvas-render-notice" role="status">{particleRendererNotice}</div>
        )}
        {fracturesRendererNotice && fragmentCollageActive && (
          <div className="rv-canvas-render-notice" role="status">{fracturesRendererNotice}</div>
        )}
      </div>
    </div>
  )
}


type CanvasPresetSliderControlKey = Exclude<CanvasPresetControlKey, 'particleColorMode' | 'particleQuality'>

const CANVAS_PARTICLE_COLOR_MODE_OPTIONS: Array<{ value: CanvasPresetColorMode; label: string }> = [
  { value: 'original', label: 'Original' },
  { value: 'palette', label: 'Palette' },
  { value: 'audioReactive', label: 'Audio Reactive' },
]

const CANVAS_PARTICLE_QUALITY_OPTIONS: Array<{ value: CanvasParticleQuality; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'high', label: 'High' },
]

const CANVAS_FRACTURE_MODE_OPTIONS: Array<{ value: CanvasFractureMode; label: string }> = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'rectangles', label: 'Rectangles' },
  { value: 'horizontalSlices', label: 'Horizontal Slices' },
  { value: 'verticalSlices', label: 'Vertical Slices' },
  { value: 'angledQuads', label: 'Angled Quadrilaterals' },
]

const CANVAS_FRACTURE_ANCHOR_OPTIONS: Array<{ value: CanvasFractureAnchorMode; label: string }> = [
  { value: 'alwaysVisible', label: 'Always Visible' },
  { value: 'reactive', label: 'Reactive' },
  { value: 'fadeWithMusic', label: 'Fade With Music' },
  { value: 'fullyFragmented', label: 'Fully Fragmented' },
]

const CANVAS_FRACTURE_PLACEMENT_OPTIONS: Array<{ value: CanvasFracturePlacementMode; label: string }> = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'offscreenSpill', label: 'Offscreen Spill' },
  { value: 'heavyOverlap', label: 'Heavy Overlap' },
  { value: 'anchorCover', label: 'Anchor Cover' },
  { value: 'repeatedCrops', label: 'Repeated Crops' },
  { value: 'mirrorFlip', label: 'Mirror and Flip' },
  { value: 'randomMix', label: 'Random Mix' },
]

const CANVAS_FRACTURE_TOPOLOGY_INTERVAL_OPTIONS: Array<{ value: CanvasFractureQuantizeInterval; label: string }> = [
  { value: 'manualOnly', label: 'Manual Only' },
  { value: 'section', label: 'Every Section' },
  { value: '16bars', label: 'Every 16 Bars' },
  { value: '8bars', label: 'Every 8 Bars' },
  { value: '4bars', label: 'Every 4 Bars' },
]

const CANVAS_FRACTURE_LAYOUT_INTERVAL_OPTIONS: Array<{ value: CanvasFractureQuantizeInterval; label: string }> = [
  ...CANVAS_FRACTURE_TOPOLOGY_INTERVAL_OPTIONS,
  { value: 'bar', label: 'Every Bar' },
]

const CANVAS_FRACTURE_TRANSITION_OPTIONS: Array<{ value: CanvasFractureTransitionMode; label: string }> = [
  { value: 'hardGlitchCut', label: 'Hard Glitch Cut' },
  { value: 'staggeredAssembly', label: 'Staggered Assembly' },
  { value: 'zoomInOut', label: 'Zoom In and Out' },
]

const CANVAS_FRACTURE_COLOR_SOURCE_OPTIONS: Array<{ value: CanvasFractureColorSourceMode; label: string }> = [
  { value: 'imageSampled', label: 'Image Sampled' },
  { value: 'brandKit', label: 'Brand Kit' },
  { value: 'manualOverride', label: 'Manual Override' },
]

const CANVAS_FRACTURE_QUALITY_OPTIONS: Array<{ value: CanvasFractureQualityMode; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'low', label: 'Low' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'high', label: 'High' },
  { value: 'ultra', label: 'Ultra' },
]

function isCanvasPresetSliderControlKey(control: CanvasPresetControlKey): control is CanvasPresetSliderControlKey {
  return control !== 'particleColorMode' && control !== 'particleQuality'
}

const CANVAS_PRESET_CONTROL_META: Record<CanvasPresetSliderControlKey, {
  label: string
  min: number
  max: number
  step: number
  color: string
  description?: string
}> = {
  drySourceMix: {
    label: 'Dry Source Mix',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#61d6aa',
    description: 'Controls only the untreated source contribution. Processed layers and effects remain visible.',
  },
  sourceVisibility: {
    label: 'Dry Source Mix',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#61d6aa',
    description: 'Legacy control alias for Dry Source Mix.',
  },
  intensity: {
    label: 'Visual Intensity',
    min: 0,
    max: 1,
    step: 0.01,
    color: '#4ac7db',
    description: 'Recipe macro that scales coordinated effect strength without replacing Glow, Trail, Glitch, Particle Density, Motion, Dry Source Mix, or Output Opacity.',
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
    description: 'Controls the density of the source-reconstruction grid. Set to 0 to disable Particle Aura.',
  },
  particleSize: {
    label: 'Particle Size',
    min: 0.35,
    max: 8,
    step: 0.05,
    color: '#9ddcff',
  },
}

export const CANVAS_REACT_CONTROL_GROUPS: Array<{
  title: string
  controls: CanvasPresetControlKey[]
}> = [
  {
    title: 'Source + Reactivity',
    controls: ['drySourceMix', 'intensity', 'bassReactivity', 'beatPulse'],
  },
  {
    title: 'FX',
    controls: ['glow', 'trailAmount', 'rgbSplit', 'glitchAmount', 'stutterRate', 'lumaThreshold'],
  },
  {
    title: 'Motion + Particles',
    controls: ['motionAmount', 'turbulence', 'particleDensity', 'particleSize', 'particleColorMode', 'particleQuality'],
  },
]

const CANVAS_REACT_CONTROL_HELP_IDS: Record<CanvasPresetControlKey, HelpInfoTriggerProps['helpId']> = {
  drySourceMix: 'react.canvas.reactControls.sourceAndReactivity.drySourceMix',
  sourceVisibility: 'react.canvas.reactControls.sourceAndReactivity.drySourceMix',
  intensity: 'react.canvas.reactControls.sourceAndReactivity.visualIntensity',
  bassReactivity: 'react.canvas.reactControls.sourceAndReactivity.bassReactivity',
  beatPulse: 'react.canvas.reactControls.sourceAndReactivity.beatPulse',
  glow: 'react.canvas.reactControls.fx.glowAmount',
  trailAmount: 'react.canvas.reactControls.fx.trailAmount',
  rgbSplit: 'react.canvas.reactControls.fx.rgbSplit',
  glitchAmount: 'react.canvas.reactControls.fx.glitchAmount',
  stutterRate: 'react.canvas.reactControls.fx.stutterRate',
  lumaThreshold: 'react.canvas.reactControls.fx.lumaThreshold',
  motionAmount: 'react.canvas.reactControls.motionAndParticles.motionAmount',
  turbulence: 'react.canvas.reactControls.motionAndParticles.turbulence',
  particleDensity: 'react.canvas.reactControls.motionAndParticles.particleDensity',
  particleSize: 'react.canvas.reactControls.motionAndParticles.particleSize',
  particleColorMode: 'react.canvas.reactControls.motionAndParticles.particleColorMode',
  particleQuality: 'react.canvas.reactControls.motionAndParticles.particleQuality',
}

function formatCanvasPercentage(value: number): string {
  return `${Math.round(value * 100)}%`
}

function formatCanvasReactControlValue(control: CanvasPresetControlKey, value: number): string {
  if (control === 'stutterRate') return value <= 0 ? 'Off' : `${Math.round(value)} holds/sec`
  if (control === 'particleSize') return `${value.toFixed(2)}×`
  return formatCanvasPercentage(value)
}


function CanvasAutoSelectControl() {
  const engine = useSharedAudio()
  const settings = useReactStore(s => s.canvasEngineSettings)
  const selectedCanvasPresetId = useReactStore(s => s.selectedCanvasPresetId)
  const canvasPresetOverride = useReactStore(s => s.canvasPresetOverride)
  const manualTrackSectionsByTrackId = useReactStore(s => s.manualTrackSectionsByTrackId)
  const suppressedAutoSectionsByTrackId = useReactStore(s => s.suppressedAutoSectionsByTrackId)
  const mediaItems = useCanvasRuntimeMediaItems()
  const mediaCount = mediaItems.length
  const setCanvasAutoSelectEnabled = useReactStore(s => s.setCanvasAutoSelectEnabled)
  const clearCanvasPresetOverride = useReactStore(s => s.clearCanvasPresetOverride)
  const clearCanvasMediaOverride = useReactStore(s => s.clearCanvasMediaOverride)
  const selectedPreset = CANVAS_PRESET_BY_ID[selectedCanvasPresetId] ?? CANVAS_PRESET_BY_ID[DEFAULT_CANVAS_PRESET_ID]
  const [autoPreviewRevision, setAutoPreviewRevision] = useState(0)
  const hasTrackLoaded = Boolean(engine.currentTrackId)
  const manualOverrideActive = canvasPresetOverride?.source === 'manual'
  const autoSelectionActive = settings.autoSelectEnabled && canvasPresetOverride?.source === 'auto'
  const manualMediaOverrideActive = Boolean(
    settings.manualMediaOverrideId && mediaItems.some(item => item.id === settings.manualMediaOverrideId),
  )

  useEffect(() => {
    if (!settings.autoSelectEnabled) return
    const intervalId = window.setInterval(() => {
      setAutoPreviewRevision(revision => (revision + 1) % 10000)
    }, 800)
    return () => window.clearInterval(intervalId)
  }, [settings.autoSelectEnabled])

  const previewTrackSections = useMemo(() => {
    const trackId = engine.currentTrackId
    const analyzedSections = engine.currentAnalysis ? adaptMIAnalysis(engine.currentAnalysis) : []
    const manualSections = trackId ? (manualTrackSectionsByTrackId[trackId] ?? []) : []
    const suppressedIds = trackId ? (suppressedAutoSectionsByTrackId[trackId] ?? []) : []
    const analysisDurationSec = (engine.currentAnalysis?.durationMs ?? 0) / 1000
    const durationSec = Number.isFinite(engine.duration) && engine.duration > 0 ? engine.duration : analysisDurationSec
    return resolveTrackSections({ analyzedSections, manualSections, durationSec, suppressedIds })
  }, [engine.currentAnalysis, engine.currentTrackId, engine.duration, manualTrackSectionsByTrackId, suppressedAutoSectionsByTrackId])
  const autoPreview = useMemo(() => {
    void autoPreviewRevision
    return resolveCanvasAutoFeatures({
      frame: AudioFeatureBus.getFrame(),
      trackAnalysis: engine.currentAnalysis,
      trackSections: previewTrackSections,
      audioTime: resolveCanvasAudioTime(engine.getCurrentTime),
      activeAudioTrackId: engine.currentTrackId,
    })
  }, [autoPreviewRevision, engine.currentAnalysis, engine.currentTrackId, engine.getCurrentTime, previewTrackSections])
  const autoPreviewPreset = CANVAS_PRESET_BY_ID[autoPreview.presetId] ?? CANVAS_PRESET_BY_ID[DEFAULT_CANVAS_PRESET_ID]
  const hasAutoSelectionData = autoPreview.dataMode !== 'fallback'
  const autoDataDescription = autoPreview.dataMode === 'audioIntelligence'
    ? 'Using Audio Intelligence sections, curves, energy, brightness, and rhythm.'
    : autoPreview.dataMode === 'liveAudio'
      ? 'Using live audio features only until Audio Intelligence is available.'
      : hasTrackLoaded
        ? 'Using fallback/static selection while Audio Intelligence warms up.'
        : 'Using fallback/static selection until a track or live audio features are available.'

  const description = mediaCount === 0
    ? `Select saved media from your library first. ${autoDataDescription}`
    : manualOverrideActive
      ? `Auto Select can stay on, but it will not replace the manually selected preset until the override is cleared. ${autoDataDescription}`
      : manualMediaOverrideActive
        ? `${autoDataDescription} Lock Active Media keeps the manually selected source protected.`
        : `${autoDataDescription} Auto Select can choose CANVAS presets and unlocked media.`

  return (
    <div className="rv-canvas-auto-select-block">
      <CanvasHelpControl
        helpId="react.canvas.sourceAndDisplay.sourceLink.autoSelect"
        currentValue={settings.autoSelectEnabled ? 'On' : 'Off'}
        currentValueLabel="Status"
        currentValueTone={settings.autoSelectEnabled ? 'accent' : 'default'}
      >
        <ToggleRow
          label="Auto Select"
          value={settings.autoSelectEnabled}
          onChange={setCanvasAutoSelectEnabled}
          description={description}
        />
      </CanvasHelpControl>
      {manualOverrideActive && (
        <CanvasOverrideStatus
          message={`Manual override: ${selectedPreset.name} is selected.`}
          clearLabel="Clear Override"
          clearAriaLabel={`Clear ${selectedPreset.name} manual preset override`}
          onClear={clearCanvasPresetOverride}
        />
      )}
      {!manualOverrideActive && autoSelectionActive && (
        <div className="rv-canvas-auto-status" role="status">
          <span>Auto Select: {canvasPresetOverride?.label ?? `${selectedPreset.name} is selected`}.</span>
        </div>
      )}
      {!manualOverrideActive && settings.autoSelectEnabled && mediaCount === 0 && (
        <div className="rv-canvas-auto-status rv-canvas-auto-status--helper" role="status">
          <span>Select saved media from your library before Auto Select starts choosing visuals. Current mode: {autoPreview.sourceLabel}.</span>
        </div>
      )}
      {!manualOverrideActive && settings.autoSelectEnabled && mediaCount > 0 && autoPreview.dataMode === 'fallback' && (
        <div className="rv-canvas-auto-status rv-canvas-auto-status--helper" role="status">
          <span>{autoPreview.sourceLabel}: CANVAS will use {autoPreviewPreset.name} until Audio Intelligence or live audio features arrive.</span>
        </div>
      )}
      {!manualOverrideActive && settings.autoSelectEnabled && mediaCount > 0 && hasAutoSelectionData && !autoSelectionActive && (
        <div className="rv-canvas-auto-status rv-canvas-auto-status--helper" role="status">
          <span>Auto Select armed. {autoPreview.sourceLabel} is reading {autoPreview.reason.toLowerCase()}.</span>
        </div>
      )}
      {settings.autoSelectEnabled && manualMediaOverrideActive && (
        <CanvasOverrideStatus
          message="Media lock: Auto Select can change presets, but this source stays selected."
          clearLabel="Clear"
          clearAriaLabel="Clear CANVAS media lock"
          onClear={clearCanvasMediaOverride}
        />
      )}
    </div>
  )
}

function CanvasTimingControls() {
  const engine = useSharedAudio()
  const settings = useReactStore(s => s.canvasEngineSettings)
  const manualTrackSectionsByTrackId = useReactStore(s => s.manualTrackSectionsByTrackId)
  const suppressedAutoSectionsByTrackId = useReactStore(s => s.suppressedAutoSectionsByTrackId)
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
    const trackId = engine.currentTrackId
    const analyzedSections = engine.currentAnalysis ? adaptMIAnalysis(engine.currentAnalysis) : []
    const sections = resolveTrackSections({
      analyzedSections,
      manualSections: trackId ? (manualTrackSectionsByTrackId[trackId] ?? []) : [],
      suppressedIds: trackId ? (suppressedAutoSectionsByTrackId[trackId] ?? []) : [],
      durationSec: Math.max(engine.duration, engine.currentAnalysis?.durationMs ? engine.currentAnalysis.durationMs / 1000 : 0),
    })
    sections.forEach(section => {
      if (section.provenance?.authority === 'fallback') return
      const mapped = normalizeCanvasTimingSectionType(section.type)
      const option = CANVAS_SECTION_TRIGGER_OPTIONS.find(entry => entry.value === mapped)
      if (option) labels.add(option.label)
    })
    return Array.from(labels)
  }, [engine.currentAnalysis, engine.currentTrackId, engine.duration, manualTrackSectionsByTrackId, suppressedAutoSectionsByTrackId])

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
      <CanvasHelpControl
        helpId="react.canvas.videoTiming.triggerOn"
        currentValue={CANVAS_TRIGGER_OPTIONS.find(option => option.value === timing.triggerOn)?.label ?? 'Manual Only'}
        currentValueTone={hasActiveVideo ? 'accent' : 'default'}
      >
        <SelectRow
          label="Trigger On"
          value={timing.triggerOn}
          onChange={value => setTiming({ triggerOn: value as CanvasTriggerOn })}
          disabled={!hasActiveVideo}
          options={CANVAS_TRIGGER_OPTIONS}
          description="Choose the musical moment that restarts the active CANVAS video clip."
        />
      </CanvasHelpControl>
      <CanvasHelpControl
        helpId="react.canvas.videoTiming.clipStartSeconds"
        currentValue={formatCanvasTimingSeconds(timing.clipStartSec)}
        currentValueTone={hasActiveVideo ? 'accent' : 'default'}
      >
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
      </CanvasHelpControl>
      <CanvasHelpControl
        helpId="react.canvas.videoTiming.clipEndSeconds"
        currentValue={timing.clipEndSec > 0 ? formatCanvasTimingSeconds(timing.clipEndSec) : 'Video end'}
        currentValueTone={hasActiveVideo ? 'accent' : 'default'}
      >
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
      </CanvasHelpControl>
      <div className="rv-canvas-engine-note">
        End time 0 uses the full video. Active range: {formatCanvasTimingSeconds(timing.clipStartSec)} → {timing.clipEndSec > 0 ? formatCanvasTimingSeconds(timing.clipEndSec) : 'video end'}.
      </div>
      <CanvasHelpControl
        helpId="react.canvas.videoTiming.loopClipRange"
        currentValue={timing.loopClipRange ? 'On' : 'Off'}
        currentValueLabel="Status"
        currentValueTone={timing.loopClipRange ? 'accent' : 'default'}
      >
        <ToggleRow
          label="Loop Clip Range"
          value={timing.loopClipRange}
          onChange={value => setTiming({ loopClipRange: value })}
          disabled={!hasActiveVideo}
          description="Loops from Clip Start Time to Clip End Time, or to video end when end time is 0."
        />
      </CanvasHelpControl>
      <CanvasHelpControl
        helpId="react.canvas.videoTiming.loopFullVideo"
        currentValue={settings.loopVideo ? 'On' : 'Off'}
        currentValueLabel="Status"
        currentValueTone={settings.loopVideo ? 'accent' : 'default'}
      >
        <ToggleRow
          label="Loop Full Video"
          value={settings.loopVideo}
          onChange={value => setCanvasEngineSettings({ loopVideo: value })}
          disabled={!hasActiveVideo}
          description="Fallback full-video loop when no clip end time is set."
        />
      </CanvasHelpControl>
      <CanvasHelpControl
        helpId="react.canvas.videoTiming.restartOnDrop"
        currentValue={timing.restartOnDrop ? 'On' : 'Off'}
        currentValueLabel="Status"
        currentValueTone={timing.restartOnDrop ? 'accent' : 'default'}
      >
        <ToggleRow
          label="Restart on Drop"
          value={timing.restartOnDrop}
          onChange={value => setTiming({ restartOnDrop: value })}
          disabled={!hasActiveVideo}
          description="Restarts the clip when CANVAS detects a drop section or high-confidence drop moment."
        />
      </CanvasHelpControl>
      <CanvasHelpControl
        helpId="react.canvas.videoTiming.restartOnSectionChange"
        currentValue={timing.restartOnSectionChange ? 'On' : 'Off'}
        currentValueLabel="Status"
        currentValueTone={timing.restartOnSectionChange ? 'accent' : 'default'}
      >
        <ToggleRow
          label="Restart on Section Change"
          value={timing.restartOnSectionChange}
          onChange={value => setTiming({ restartOnSectionChange: value })}
          disabled={!hasActiveVideo}
          description="Restarts when the current Audio Intelligence section changes into one of the mapped section types below."
        />
      </CanvasHelpControl>
      <CanvasHelpControl
        helpId="react.canvas.videoTiming.restartOnManualPresetChange"
        currentValue={timing.restartOnManualPresetChange ? 'On' : 'Off'}
        currentValueLabel="Status"
        currentValueTone={timing.restartOnManualPresetChange ? 'accent' : 'default'}
      >
        <ToggleRow
          label="Restart on Manual Preset Change"
          value={timing.restartOnManualPresetChange}
          onChange={value => setTiming({ restartOnManualPresetChange: value })}
          disabled={!hasActiveVideo}
          description="Restarts the clip when the user manually changes the CANVAS preset."
        />
      </CanvasHelpControl>
      <CanvasHelpControl
        helpId="react.canvas.videoTiming.sectionTriggerMapping.overview"
        currentValue={timing.sectionTriggerTypes.length > 0
          ? CANVAS_SECTION_TRIGGER_OPTIONS
              .filter(option => timing.sectionTriggerTypes.includes(option.value))
              .map(option => option.label)
              .join(', ')
          : 'No mapped sections'}
        currentValueTone={timing.sectionTriggerTypes.length > 0 ? 'accent' : 'default'}
        className="rv-canvas-section-trigger-help"
      >
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
      </CanvasHelpControl>
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

const CANVAS_LAYER_ROLE_OPTIONS: Array<{ value: CanvasLayerRole; label: string }> = [
  { value: 'background', label: 'Background' },
  { value: 'hero', label: 'Hero' },
  { value: 'texture', label: 'Texture' },
  { value: 'foregroundAccent', label: 'Foreground Accent' },
  { value: 'mask', label: 'Mask' },
  { value: 'transition', label: 'Transition' },
  { value: 'feedback', label: 'Feedback' },
]

function CanvasOrchestrationControls() {
  const settings = useReactStore(s => s.canvasOrchestrationSettings)
  const setSettings = useReactStore(s => s.setCanvasOrchestrationSettings)
  const setCanvasLayerLock = useReactStore(s => s.setCanvasLayerLock)
  const setCanvasMediaLock = useReactStore(s => s.setCanvasMediaLock)
  const setCanvasOrchestrationLock = useReactStore(s => s.setCanvasOrchestrationLock)
  const resetCanvasOrchestration = useReactStore(s => s.resetCanvasOrchestration)
  const mediaItems = useCanvasRuntimeMediaItems()
  const [lockLayerRole, setLockLayerRole] = useState<CanvasLayerRole>('hero')
  const poolItems = settings.mediaPoolIds
    .map(id => mediaItems.find(item => item.id === id) ?? null)
    .filter((item): item is CanvasMediaItem => item !== null)
  const lockedMediaId = settings.mediaLocksByLayer[lockLayerRole] ?? ''
  const selectedShow = getCanvasPerformanceShow(settings.programId)

  return (
    <Collapsible label="Performance Orchestration" defaultOpen>
      <CanvasHelpControl
        helpId="react.canvas.performanceOrchestration.autoPerformance"
        currentValue={settings.enabled ? 'On' : 'Off'}
        currentValueLabel="Status"
        currentValueTone={settings.enabled ? 'accent' : 'default'}
      >
        <ToggleRow
          label="Auto Performance"
          value={settings.enabled}
          onChange={enabled => setSettings({ enabled })}
          description="Uses the Shared Performance Core to arrange the selected pool. Existing presets and manual playback remain the fallback when disabled."
        />
      </CanvasHelpControl>
      <div className="rv-canvas-orchestration-summary" role="status">
        <span>{poolItems.length} pooled source{poolItems.length === 1 ? '' : 's'}</span>
        <span>{selectedShow.label}</span>
        <span>{settings.compositionPreference === 'auto' ? 'Section-aware templates' : CANVAS_COMPOSITION_TEMPLATE_OPTIONS.find(option => option.value === settings.compositionPreference)?.label}</span>
      </div>
      {settings.enabled && poolItems.length === 0 && (
        <div className="rv-canvas-engine-note rv-canvas-engine-note--warning">Select media in the left SOURCE panel to build the performance pool.</div>
      )}
      <CanvasHelpControl
        helpId="react.canvas.performanceOrchestration.performanceShow"
        currentValue={selectedShow.label}
        currentValueTone="accent"
      >
        <SelectRow
          label="Performance Show"
          value={settings.programId}
          onChange={value => setSettings({ programId: value as CanvasPerformanceShowId })}
          options={CANVAS_PERFORMANCE_SHOW_OPTIONS}
          description={selectedShow.description}
        />
      </CanvasHelpControl>
      <CanvasHelpControl
        helpId="react.canvas.performanceOrchestration.autoRole"
        currentValue={settings.autoRoleEnabled ? 'On' : 'Off'}
        currentValueLabel="Status"
        currentValueTone={settings.autoRoleEnabled ? 'accent' : 'default'}
      >
        <ToggleRow
          label="Auto Role"
          value={settings.autoRoleEnabled}
          onChange={autoRoleEnabled => setSettings({ autoRoleEnabled })}
          description="Derives conservative roles from type, alpha, duration, aspect, tags, and media-library organization when no explicit role exists."
        />
      </CanvasHelpControl>
      <CanvasHelpControl
        helpId="react.canvas.performanceOrchestration.composition"
        currentValue={settings.compositionPreference === 'auto'
          ? 'Auto · Section Aware'
          : CANVAS_COMPOSITION_TEMPLATE_OPTIONS.find(option => option.value === settings.compositionPreference)?.label ?? settings.compositionPreference}
        currentValueTone="accent"
      >
        <SelectRow
          label="Composition"
          value={settings.compositionPreference}
          onChange={value => setSettings({ compositionPreference: value as CanvasCompositionPreference })}
          options={[
            { value: 'auto', label: 'Auto · Section Aware' },
            ...CANVAS_COMPOSITION_TEMPLATE_OPTIONS,
          ]}
        />
      </CanvasHelpControl>
      <CanvasHelpControl helpId="react.canvas.performanceOrchestration.layerComplexity" currentValue={formatCanvasPercentage(settings.complexity)}>
        <SliderRow label="Layer Complexity" value={settings.complexity} onChange={complexity => setSettings({ complexity })} min={0} max={1} step={0.01} color="#61d6aa" />
      </CanvasHelpControl>
      <CanvasHelpControl helpId="react.canvas.performanceOrchestration.transitionDensity" currentValue={formatCanvasPercentage(settings.transitionDensity)}>
        <SliderRow label="Transition Density" value={settings.transitionDensity} onChange={transitionDensity => setSettings({ transitionDensity })} min={0} max={1} step={0.01} color="#4ac7db" />
      </CanvasHelpControl>
      <CanvasHelpControl helpId="react.canvas.performanceOrchestration.effectIntensity" currentValue={formatCanvasPercentage(settings.effectIntensity)}>
        <SliderRow label="Effect Intensity" value={settings.effectIntensity} onChange={effectIntensity => setSettings({ effectIntensity })} min={0} max={1} step={0.01} color="#ff4fd8" />
      </CanvasHelpControl>
      <CanvasHelpControl helpId="react.canvas.performanceOrchestration.motionIntensity" currentValue={formatCanvasPercentage(settings.motionIntensity)}>
        <SliderRow label="Motion Intensity" value={settings.motionIntensity} onChange={motionIntensity => setSettings({ motionIntensity })} min={0} max={1} step={0.01} color="#d8b95a" />
      </CanvasHelpControl>
      <CanvasHelpControl helpId="react.canvas.performanceOrchestration.cutDensity" currentValue={formatCanvasPercentage(settings.cutDensity)}>
        <SliderRow label="Cut Density" value={settings.cutDensity} onChange={cutDensity => setSettings({ cutDensity })} min={0} max={1} step={0.01} color="#f09c5a" />
      </CanvasHelpControl>
      <Collapsible label="Locks" defaultOpen={false}>
        <ToggleRow
          label="Media Lock"
          value={settings.globalLocks.media === true}
          onChange={locked => setCanvasOrchestrationLock('media', locked)}
          description="Keeps current deterministic choices while other orchestration continues."
        />
        <SelectRow
          label="Layer"
          value={lockLayerRole}
          onChange={value => setLockLayerRole(value as CanvasLayerRole)}
          options={CANVAS_LAYER_ROLE_OPTIONS}
        />
        <ToggleRow
          label="Lock Layer State"
          value={settings.layerLocks[lockLayerRole] === true}
          onChange={locked => setCanvasLayerLock(lockLayerRole, locked)}
        />
        <SelectRow
          label="Locked Media"
          value={lockedMediaId}
          onChange={value => setCanvasMediaLock(lockLayerRole, value || null)}
          options={[
            { value: '', label: 'Deterministic Auto' },
            ...poolItems.map(item => ({ value: item.id, label: item.name })),
          ]}
        />
      </Collapsible>
      <SharedPerformanceDiagnosticsPanel engine="canvas" />
      <button type="button" className="rv-reset-btn rv-canvas-restart-btn" onClick={resetCanvasOrchestration}>Reset Authored State</button>
    </Collapsible>
  )
}

function CanvasFracturesActionControl({
  helpId,
  label,
  value,
  description,
  onClick,
}: {
  helpId: HelpInfoTriggerProps['helpId']
  label: string
  value: number
  description: string
  onClick: () => void
}) {
  return (
    <CanvasHelpControl
      helpId={helpId}
      currentValue={`Revision ${value}`}
      className="rv-canvas-react-control-help"
    >
      <div className="rv-ctrl-toggle-row">
        <div className="rv-ctrl-toggle-line">
          <span className="rv-ctrl-label">{label}</span>
          <button type="button" className="rv-reset-btn rv-canvas-fractures-action" onClick={onClick}>
            Trigger
          </button>
        </div>
        <span className="rv-ctrl-description">{description}</span>
      </div>
    </CanvasHelpControl>
  )
}

function CanvasFracturesControls({
  settings,
  setSettings,
  resetSettings,
  customized,
}: {
  settings: CanvasPresetSettings
  setSettings: (patch: Partial<CanvasPresetSettings>) => void
  resetSettings: () => void
  customized: boolean
}) {
  const audioEngine = useSharedAudio()
  const manualColorsEnabled = settings.fractureColorSourceMode === 'manualOverride'
  const getActionPositionSec = () => {
    const direct = audioEngine.getCurrentTime?.()
    if (typeof direct === 'number' && Number.isFinite(direct)) return Math.max(0, direct)
    return typeof audioEngine.currentTime === 'number' && Number.isFinite(audioEngine.currentTime)
      ? Math.max(0, audioEngine.currentTime)
      : 0
  }
  return (
    <Collapsible label="Fractures Controls" defaultOpen>
      <div className="rv-ctrl-toggle-row rv-canvas-recipe-status">
        <div className="rv-ctrl-toggle-line">
          <span className="rv-ctrl-label">Fractures</span>
          <button
            type="button"
            className="rv-ctrl-toggle rv-canvas-recipe-reset"
            onClick={resetSettings}
            aria-label="Reset Fractures settings"
          >
            Reset
          </button>
        </div>
        {customized && <span className="rv-ctrl-description">Customized Fractures settings active.</span>}
      </div>

      <Collapsible label="Structure" defaultOpen>
        <CanvasHelpControl helpId="react.canvas.fractures.structure.intensity" currentValue={formatCanvasPercentage(settings.fractureIntensity)} className="rv-canvas-react-control-help">
          <SliderRow label="Fracture Intensity" value={settings.fractureIntensity} onChange={fractureIntensity => setSettings({ fractureIntensity })} min={0} max={1} step={0.01} color="#8de7ff" />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.structure.mode" currentValue={CANVAS_FRACTURE_MODE_OPTIONS.find(option => option.value === settings.fractureMode)?.label ?? 'Mixed'} currentValueTone="accent" className="rv-canvas-react-control-help">
          <SelectRow label="Fracture Mode" value={settings.fractureMode} onChange={value => setSettings({ fractureMode: value as CanvasFractureMode })} options={CANVAS_FRACTURE_MODE_OPTIONS} />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.structure.anchorMode" currentValue={CANVAS_FRACTURE_ANCHOR_OPTIONS.find(option => option.value === settings.fractureAnchorMode)?.label ?? 'Always Visible'} currentValueTone="accent" className="rv-canvas-react-control-help">
          <SelectRow label="Anchor Mode" value={settings.fractureAnchorMode} onChange={value => setSettings({ fractureAnchorMode: value as CanvasFractureAnchorMode })} options={CANVAS_FRACTURE_ANCHOR_OPTIONS} />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.structure.focusProtection" currentValue={formatCanvasPercentage(settings.fractureFocusProtection)} className="rv-canvas-react-control-help">
          <SliderRow label="Focus Protection" value={settings.fractureFocusProtection} onChange={fractureFocusProtection => setSettings({ fractureFocusProtection })} min={0} max={1} step={0.01} color="#61d6aa" />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.structure.focusX" currentValue={formatCanvasPercentage(settings.fractureFocusX)} className="rv-canvas-react-control-help">
          <SliderRow label="Focus X" value={settings.fractureFocusX} onChange={fractureFocusX => setSettings({ fractureFocusX })} min={0} max={1} step={0.01} color="#4ac7db" />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.structure.focusY" currentValue={formatCanvasPercentage(settings.fractureFocusY)} className="rv-canvas-react-control-help">
          <SliderRow label="Focus Y" value={settings.fractureFocusY} onChange={fractureFocusY => setSettings({ fractureFocusY })} min={0} max={1} step={0.01} color="#4ac7db" />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.structure.composition" currentValue={formatCanvasPercentage(settings.fractureComposition)} className="rv-canvas-react-control-help">
          <SliderRow label="Composition" value={settings.fractureComposition} onChange={fractureComposition => setSettings({ fractureComposition })} min={0} max={1} step={0.01} color="#d8b95a" description="0% is editorial and restrained; 100% is chaotic." />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.structure.placementMode" currentValue={CANVAS_FRACTURE_PLACEMENT_OPTIONS.find(option => option.value === settings.fracturePlacementMode)?.label ?? 'Balanced'} currentValueTone="accent" className="rv-canvas-react-control-help">
          <SelectRow label="Placement Mode" value={settings.fracturePlacementMode} onChange={value => setSettings({ fracturePlacementMode: value as CanvasFracturePlacementMode })} options={CANVAS_FRACTURE_PLACEMENT_OPTIONS} />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.structure.topologyInterval" currentValue={CANVAS_FRACTURE_TOPOLOGY_INTERVAL_OPTIONS.find(option => option.value === settings.fractureTopologyInterval)?.label ?? 'Every 4 Bars'} currentValueTone="accent" className="rv-canvas-react-control-help">
          <SelectRow label="Topology Change" value={settings.fractureTopologyInterval} onChange={value => setSettings({ fractureTopologyInterval: value as CanvasFractureQuantizeInterval })} options={CANVAS_FRACTURE_TOPOLOGY_INTERVAL_OPTIONS} />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.structure.layoutInterval" currentValue={CANVAS_FRACTURE_LAYOUT_INTERVAL_OPTIONS.find(option => option.value === settings.fractureLayoutInterval)?.label ?? 'Every Bar'} currentValueTone="accent" className="rv-canvas-react-control-help">
          <SelectRow label="Layout Change" value={settings.fractureLayoutInterval} onChange={value => setSettings({ fractureLayoutInterval: value as CanvasFractureQuantizeInterval })} options={CANVAS_FRACTURE_LAYOUT_INTERVAL_OPTIONS} />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.structure.variationSeed" currentValue={settings.fractureVariationSeed} className="rv-canvas-react-control-help">
          <NumberInputRow label="Variation Seed" value={settings.fractureVariationSeed} onChange={fractureVariationSeed => setSettings({ fractureVariationSeed })} min={0} max={999999} step={1} />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.structure.quality" currentValue={CANVAS_FRACTURE_QUALITY_OPTIONS.find(option => option.value === settings.fractureQuality)?.label ?? 'Balanced'} currentValueTone="accent" className="rv-canvas-react-control-help">
          <SelectRow label="Quality" value={settings.fractureQuality} onChange={value => setSettings({ fractureQuality: value as CanvasFractureQualityMode })} options={CANVAS_FRACTURE_QUALITY_OPTIONS} />
        </CanvasHelpControl>
      </Collapsible>

      <Collapsible label="Motion" defaultOpen>
        <CanvasHelpControl helpId="react.canvas.fractures.motion.amount" currentValue={formatCanvasPercentage(settings.fractureMotionAmount)} className="rv-canvas-react-control-help">
          <SliderRow label="Motion" value={settings.fractureMotionAmount} onChange={fractureMotionAmount => setSettings({ fractureMotionAmount })} min={0} max={1} step={0.01} color="#61d6aa" />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.motion.transition" currentValue={CANVAS_FRACTURE_TRANSITION_OPTIONS.find(option => option.value === settings.fractureTransitionMode)?.label ?? 'Staggered Assembly'} currentValueTone="accent" className="rv-canvas-react-control-help">
          <SelectRow label="Transition" value={settings.fractureTransitionMode} onChange={value => setSettings({ fractureTransitionMode: value as CanvasFractureTransitionMode })} options={CANVAS_FRACTURE_TRANSITION_OPTIONS} />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.motion.transitionSpeed" currentValue={formatCanvasPercentage(settings.fractureTransitionSpeed)} className="rv-canvas-react-control-help">
          <SliderRow label="Transition Speed" value={settings.fractureTransitionSpeed} onChange={fractureTransitionSpeed => setSettings({ fractureTransitionSpeed })} min={0} max={1} step={0.01} color="#4ac7db" />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.motion.stagger" currentValue={formatCanvasPercentage(settings.fractureStaggerAmount)} className="rv-canvas-react-control-help">
          <SliderRow label="Stagger" value={settings.fractureStaggerAmount} onChange={fractureStaggerAmount => setSettings({ fractureStaggerAmount })} min={0} max={1} step={0.01} color="#d8b95a" />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.motion.zoom" currentValue={formatCanvasPercentage(settings.fractureZoomAmount)} className="rv-canvas-react-control-help">
          <SliderRow label="Zoom" value={settings.fractureZoomAmount} onChange={fractureZoomAmount => setSettings({ fractureZoomAmount })} min={0} max={1} step={0.01} color="#ff4fd8" />
        </CanvasHelpControl>
        <CanvasFracturesActionControl
          helpId="react.canvas.fractures.motion.refracture"
          label="Refracture"
          value={settings.fractureTopologyRevision}
          description="Creates a new deterministic topology and establishes a matching layout."
          onClick={() => setSettings({
            fractureTopologyRevision: settings.fractureTopologyRevision + 1,
            fractureLayoutRevision: settings.fractureLayoutRevision + 1,
            fractureReturnToAnchor: false,
            fractureLastManualAction: 'refracture',
            fractureManualTransitionPositionSec: getActionPositionSec(),
          })}
        />
        <CanvasFracturesActionControl
          helpId="react.canvas.fractures.motion.shuffleLayout"
          label="Shuffle Layout"
          value={settings.fractureLayoutRevision}
          description="Creates a new deterministic placement plan while preserving every source crop."
          onClick={() => setSettings({
            fractureLayoutRevision: settings.fractureLayoutRevision + 1,
            fractureReturnToAnchor: false,
            fractureLastManualAction: 'shuffleLayout',
            fractureManualTransitionPositionSec: getActionPositionSec(),
          })}
        />
        <CanvasHelpControl helpId="react.canvas.fractures.motion.freezeLayout" currentValue={settings.fractureFreezeLayout ? 'On' : 'Off'} currentValueLabel="Status" className="rv-canvas-react-control-help">
          <ToggleRow
            label="Freeze Layout"
            value={settings.fractureFreezeLayout}
            onChange={fractureFreezeLayout => {
              const positionSec = getActionPositionSec()
              setSettings(fractureFreezeLayout
                ? { fractureFreezeLayout: true, fractureFreezePositionSec: positionSec }
                : {
                    fractureFreezeLayout: false,
                    fractureLastManualAction: 'releaseFreeze',
                    fractureManualTransitionPositionSec: positionSec,
                  })
            }}
          />
        </CanvasHelpControl>
        <CanvasFracturesActionControl
          helpId="react.canvas.fractures.motion.returnToAnchor"
          label="Return to Anchor"
          value={settings.fractureLayoutRevision}
          description="Resolves an anchor-oriented target layout without replacing the current topology."
          onClick={() => setSettings({
            fractureLayoutRevision: settings.fractureLayoutRevision + 1,
            fractureReturnToAnchor: true,
            fractureLastManualAction: 'returnToAnchor',
            fractureManualTransitionPositionSec: getActionPositionSec(),
          })}
        />
      </Collapsible>

      <Collapsible label="Effects" defaultOpen={false}>
        <CanvasHelpControl helpId="react.canvas.fractures.effects.intensity" currentValue={formatCanvasPercentage(settings.fractureEffectsIntensity)} className="rv-canvas-react-control-help">
          <SliderRow label="Effects Intensity" value={settings.fractureEffectsIntensity} onChange={fractureEffectsIntensity => setSettings({ fractureEffectsIntensity })} min={0} max={1} step={0.01} color="#ff4fd8" />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.effects.glow" currentValue={formatCanvasPercentage(settings.fractureGlowAmount)} className="rv-canvas-react-control-help">
          <SliderRow label="Glow" value={settings.fractureGlowAmount} onChange={fractureGlowAmount => setSettings({ fractureGlowAmount })} min={0} max={1} step={0.01} color="#8de7ff" description="Controls neon outlines and bloom without exposing individual pass coefficients." />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.effects.glitch" currentValue={formatCanvasPercentage(settings.fractureGlitchAmount)} className="rv-canvas-react-control-help">
          <SliderRow label="Glitch" value={settings.fractureGlitchAmount} onChange={fractureGlitchAmount => setSettings({ fractureGlitchAmount })} min={0} max={1} step={0.01} color="#ff4fd8" description="Controls RGB separation, slice displacement, dissolve, and transition flash readiness." />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.effects.texture" currentValue={formatCanvasPercentage(settings.fractureTextureAmount)} className="rv-canvas-react-control-help">
          <SliderRow label="Texture" value={settings.fractureTextureAmount} onChange={fractureTextureAmount => setSettings({ fractureTextureAmount })} min={0} max={1} step={0.01} color="#d8b95a" description="Controls pixelation, posterization, scanlines, noise, blur, and sharpening." />
        </CanvasHelpControl>
        <SliderRow label="Trails" value={settings.fractureTrailsAmount} onChange={fractureTrailsAmount => setSettings({ fractureTrailsAmount })} min={0} max={1} step={0.01} color="#9ddcff" description="Controls bounded prior-frame feedback persistence and opacity." />
        <SliderRow label="Depth" value={settings.fractureDepthAmount} onChange={fractureDepthAmount => setSettings({ fractureDepthAmount })} min={0} max={1} step={0.01} color="#61d6aa" description="Controls shadows, parallax bias, and restrained fragment depth scaling." />
        <SliderRow label="Duplication" value={settings.fractureDuplicationAmount} onChange={fractureDuplicationAmount => setSettings({ fractureDuplicationAmount })} min={0} max={1} step={0.01} color="#4ac7db" description="Controls deterministic secondary copies and echo offsets within the quality budget." />
        <SliderRow label="Color Treatment" value={settings.fractureColorTreatmentAmount} onChange={fractureColorTreatmentAmount => setSettings({ fractureColorTreatmentAmount })} min={0} max={1} step={0.01} color="#b84fc9" description="Controls hue rotation, duotone mapping, and palette-driven color strength." />
        <CanvasHelpControl helpId="react.canvas.fractures.effects.colorSource" currentValue={CANVAS_FRACTURE_COLOR_SOURCE_OPTIONS.find(option => option.value === settings.fractureColorSourceMode)?.label ?? 'Image Sampled'} currentValueTone="accent" className="rv-canvas-react-control-help">
          <SelectRow label="Color Source" value={settings.fractureColorSourceMode} onChange={value => setSettings({ fractureColorSourceMode: value as CanvasFractureColorSourceMode })} options={CANVAS_FRACTURE_COLOR_SOURCE_OPTIONS} />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.effects.manualPrimaryColor" currentValue={settings.fractureManualPrimaryColor} className="rv-canvas-react-control-help">
          <ColorRow label="Manual Primary Color" value={settings.fractureManualPrimaryColor} onChange={fractureManualPrimaryColor => setSettings({ fractureManualPrimaryColor })} disabled={!manualColorsEnabled} />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.effects.manualSupportingColor" currentValue={settings.fractureManualSupportingColor} className="rv-canvas-react-control-help">
          <ColorRow label="Manual Supporting Color" value={settings.fractureManualSupportingColor} onChange={fractureManualSupportingColor => setSettings({ fractureManualSupportingColor })} disabled={!manualColorsEnabled} />
        </CanvasHelpControl>
      </Collapsible>

      <Collapsible label="Audio" defaultOpen={false}>
        <CanvasHelpControl helpId="react.canvas.fractures.audio.response" currentValue={formatCanvasPercentage(settings.fractureAudioResponse)} className="rv-canvas-react-control-help">
          <SliderRow label="Audio Response" value={settings.fractureAudioResponse} onChange={fractureAudioResponse => setSettings({ fractureAudioResponse })} min={0} max={1} step={0.01} color="#d8b95a" />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.audio.bassMotion" currentValue={formatCanvasPercentage(settings.fractureBassMotion)} className="rv-canvas-react-control-help">
          <SliderRow label="Bass Motion" value={settings.fractureBassMotion} onChange={fractureBassMotion => setSettings({ fractureBassMotion })} min={0} max={1} step={0.01} color="#61d6aa" />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.audio.transientGlitch" currentValue={formatCanvasPercentage(settings.fractureTransientGlitch)} className="rv-canvas-react-control-help">
          <SliderRow label="Transient Glitch" value={settings.fractureTransientGlitch} onChange={fractureTransientGlitch => setSettings({ fractureTransientGlitch })} min={0} max={1} step={0.01} color="#ff4fd8" />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.fractures.audio.structuralResponse" currentValue={formatCanvasPercentage(settings.fractureStructuralResponse)} className="rv-canvas-react-control-help">
          <SliderRow label="Structural Response" value={settings.fractureStructuralResponse} onChange={fractureStructuralResponse => setSettings({ fractureStructuralResponse })} min={0} max={1} step={0.01} color="#4ac7db" />
        </CanvasHelpControl>
      </Collapsible>

      <div className="rv-canvas-engine-note">
        Fractures topology, layout, transitions, effect roles, modifier assignment, feedback, and source-derived colors are deterministic across playback, seeking, and looping. Audio modulation, recording, and cast output remain deferred.
      </div>
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

  if (selectedPreset.rendererKind === 'fragmentCollage') {
    return (
      <CanvasFracturesControls
        settings={canvasPresetSettings}
        setSettings={setCanvasPresetSettings}
        resetSettings={resetCanvasPresetSettings}
        customized={customized}
      />
    )
  }

  const renderControl = (control: CanvasPresetControlKey) => {
    if (control === 'particleColorMode') {
      return (
        <CanvasHelpControl
          key={control}
          helpId={CANVAS_REACT_CONTROL_HELP_IDS[control]}
          currentValue={CANVAS_PARTICLE_COLOR_MODE_OPTIONS.find(option => option.value === canvasPresetSettings.particleColorMode)?.label ?? 'Original'}
          currentValueTone="accent"
          className="rv-canvas-react-control-help"
        >
          <SelectRow
            label="Particle Color Mode"
            value={canvasPresetSettings.particleColorMode}
            onChange={value => setCanvasPresetSettings({ particleColorMode: value as CanvasPresetColorMode })}
            options={CANVAS_PARTICLE_COLOR_MODE_OPTIONS}
            description="Original samples source color, Palette uses the DRMVYZ cyan/emerald palette, and Audio Reactive lets highs and bass recolor the particles."
          />
        </CanvasHelpControl>
      )
    }



    if (control === 'particleQuality') {
      return (
        <CanvasHelpControl
          key={control}
          helpId={CANVAS_REACT_CONTROL_HELP_IDS[control]}
          currentValue={CANVAS_PARTICLE_QUALITY_OPTIONS.find(option => option.value === canvasPresetSettings.particleQuality)?.label ?? 'Balanced'}
          currentValueTone="accent"
          className="rv-canvas-react-control-help"
        >
          <SelectRow
            label="Particle Quality"
            value={canvasPresetSettings.particleQuality}
            onChange={value => setCanvasPresetSettings({ particleQuality: value as CanvasParticleQuality })}
            options={CANVAS_PARTICLE_QUALITY_OPTIONS}
            description="Controls hologram grid resolution, render scale, and compatibility sampling. Adaptive quality can recover after temporary slowdowns."
          />
        </CanvasHelpControl>
      )
    }

    if (!isCanvasPresetSliderControlKey(control)) return null
    const meta = CANVAS_PRESET_CONTROL_META[control]
    return (
      <CanvasHelpControl
        key={control}
        helpId={CANVAS_REACT_CONTROL_HELP_IDS[control]}
        currentValue={formatCanvasReactControlValue(control, canvasPresetSettings[control])}
        className="rv-canvas-react-control-help"
      >
        <SliderRow
          label={meta.label}
          value={canvasPresetSettings[control]}
          onChange={value => setCanvasPresetSettings({ [control]: value } as Partial<CanvasPresetSettings>)}
          min={meta.min}
          max={meta.max}
          step={meta.step}
          color={meta.color}
          description={meta.description}
        />
      </CanvasHelpControl>
    )
  }

  return (
    <Collapsible label="CANVAS React Controls" defaultOpen>
      <div className="rv-ctrl-toggle-row rv-canvas-recipe-status">
        <div className="rv-ctrl-toggle-line">
          <span className="rv-ctrl-label">{selectedPreset.name}</span>
          <button
            type="button"
            className="rv-ctrl-toggle rv-canvas-recipe-reset"
            onClick={resetCanvasPresetSettings}
            aria-label={`Reset ${selectedPreset.name} recipe`}
          >
            Reset
          </button>
        </div>
        {customized && <span className="rv-ctrl-description">Customized recipe active.</span>}
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
  const mediaItems = useCanvasRuntimeMediaItems()
  const canvasReadyCount = mediaItems.length
  const activeCanvasMediaId = useReactStore(s => s.activeCanvasMediaId)
  const activeItem = mediaItems.find(item => item.id === activeCanvasMediaId) ?? null
  const selectedCanvasPresetId = useReactStore(s => s.selectedCanvasPresetId)
  const selectedPreset = CANVAS_PRESET_BY_ID[selectedCanvasPresetId] ?? CANVAS_PRESET_BY_ID[DEFAULT_CANVAS_PRESET_ID]
  return (
    <>
      <CtrlSection label="CANVAS" />
      <div className="rv-canvas-engine-panel">
        <CanvasHelpControl
          helpId="react.canvas.source.mediaLibrary"
          currentValue={activeItem ? `${activeItem.name} · ${TYPE_LABELS[activeItem.type]}` : 'No active media'}
          currentValueTone={activeItem ? 'accent' : 'default'}
          placement="right"
          className="rv-canvas-source-help"
        >
          <CanvasMediaLibrary compact />
        </CanvasHelpControl>
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

      <Collapsible label="Display" defaultOpen>
        <CanvasHelpControl
          helpId="react.canvas.sourceAndDisplay.display.fitMode"
          currentValue={settings.fitMode === 'contain' ? 'Contain' : settings.fitMode === 'cover' ? 'Cover' : 'Stretch'}
          currentValueTone="accent"
        >
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
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.sourceAndDisplay.display.scale" currentValue={`${settings.scale.toFixed(2)}×`}>
          <SliderRow
            label="Scale"
            value={settings.scale}
            onChange={value => setSettings({ scale: value })}
            min={0.1}
            max={4}
            step={0.01}
            color="#61d6aa"
          />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.sourceAndDisplay.display.positionX" currentValue={`${Math.round(settings.positionX)}%`}>
          <SliderRow
            label="Position X"
            value={settings.positionX}
            onChange={value => setSettings({ positionX: value })}
            min={-100}
            max={100}
            step={1}
            color="#4ac7db"
          />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.sourceAndDisplay.display.positionY" currentValue={`${Math.round(settings.positionY)}%`}>
          <SliderRow
            label="Position Y"
            value={settings.positionY}
            onChange={value => setSettings({ positionY: value })}
            min={-100}
            max={100}
            step={1}
            color="#4ac7db"
          />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.sourceAndDisplay.display.rotation" currentValue={`${Math.round(settings.rotation)}°`}>
          <SliderRow
            label="Rotation"
            value={settings.rotation}
            onChange={value => setSettings({ rotation: value })}
            min={-180}
            max={180}
            step={1}
            color="#d8b95a"
          />
        </CanvasHelpControl>
        <CanvasHelpControl helpId="react.canvas.sourceAndDisplay.display.outputOpacity" currentValue={formatCanvasPercentage(settings.opacity)}>
          <SliderRow
            label="Canvas Output Opacity"
            value={settings.opacity}
            onChange={value => setSettings({ opacity: value })}
            min={0}
            max={1}
            step={0.01}
            color="#b84fc9"
          />
        </CanvasHelpControl>
      </Collapsible>


      <CanvasOrchestrationControls />

      <CanvasPresetControls />

      <CanvasTimingControls />
    </div>
  )
}
