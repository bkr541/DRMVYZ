import {
  DEFAULT_NEON_LATTICE_SETTINGS,
  DEFAULT_OSCILLATOR_SETTINGS,
  DEFAULT_REACT_PRESET_RENDER_SETTINGS,
  createDefaultLaserDmxSettings,
  type ReactPreset,
  type ReactSectionType,
} from '../ReactTypes'
import { renderReactEngine } from './ReactEngineRenderer'
import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'
import { DEFAULT_REACT_RENDER_PARAMS } from './reactRenderUtils'
import { clearLaserDmxVisualState } from './LaserDmxRenderer'
import { clearNeonLatticeVisualState } from './NeonLatticeRenderer'
import { disposeCinematicPortalRenderer } from './CinematicPortalRenderer'

const DEFAULT_W = 192
const DEFAULT_H = 108
const PREVIEW_BPM = 142
const PREVIEW_FRAMES = 54
const PREVIEW_START_TIME_SEC = 31.5
const PREVIEW_SECONDS = 2.4
const MAX_CONCURRENT_THUMBNAILS = 2
const MAX_THUMBNAIL_CACHE_ENTRIES = 256
const THUMBNAIL_FINGERPRINT_VERSION = 2
const MIN_THUMBNAIL_DIMENSION = 16
const MAX_THUMBNAIL_DIMENSION = 1024

export interface ReactPresetThumbnailRequest {
  width?: number
  height?: number
}

interface ThumbnailJob<T> {
  run: () => Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

const thumbnailPromiseCache = new Map<string, Promise<string | null>>()
const thumbnailQueue: ThumbnailJob<unknown>[] = []
let activeThumbnailJobs = 0

export async function renderReactPresetThumbnail(
  preset: ReactPreset,
  request: ReactPresetThumbnailRequest = {},
): Promise<string | null> {
  const width = normalizeDimension(request.width, DEFAULT_W)
  const height = normalizeDimension(request.height, DEFAULT_H)
  const cacheKey = `${width}x${height}:${fingerprintReactPresetThumbnail(preset)}`
  const cached = thumbnailPromiseCache.get(cacheKey)
  if (cached) return cached

  const promise = scheduleThumbnail(() => renderThumbnailOnce(preset, width, height))
  cacheThumbnailPromise(cacheKey, promise)
  try {
    const result = await promise
    if (!result) thumbnailPromiseCache.delete(cacheKey)
    return result
  } catch {
    thumbnailPromiseCache.delete(cacheKey)
    return null
  }
}

/** Stable cache key containing every persisted preset field that can alter a preview. */
export function fingerprintReactPresetThumbnail(preset: ReactPreset): string {
  return JSON.stringify({
    version: THUMBNAIL_FINGERPRINT_VERSION,
    id: preset.id,
    engine: preset.engine,
    palette: preset.palette,
    params: preset.params,
    renderSettings: preset.renderSettings ?? null,
    oscillatorSettings: preset.oscillatorSettings ?? null,
    laserDmxSettings: preset.laserDmxSettings ?? null,
    neonLatticeSettings: preset.neonLatticeSettings ?? null,
    cinematicConfig: preset.cinematicConfig ?? null,
    sectionMappings: preset.sectionMappings,
    scenes: preset.scenes,
  })
}

/** Test-only cache reset. It does not cancel already-running GPU work. */
export function clearReactPresetThumbnailCacheForTests(): void {
  thumbnailPromiseCache.clear()
}

export function getReactPresetThumbnailDiagnosticsForTests(): Readonly<{
  activeJobs: number
  queuedJobs: number
  cacheEntries: number
  concurrencyLimit: number
}> {
  return {
    activeJobs: activeThumbnailJobs,
    queuedJobs: thumbnailQueue.length,
    cacheEntries: thumbnailPromiseCache.size,
    concurrencyLimit: MAX_CONCURRENT_THUMBNAILS,
  }
}

function cacheThumbnailPromise(key: string, promise: Promise<string | null>): void {
  if (!thumbnailPromiseCache.has(key) && thumbnailPromiseCache.size >= MAX_THUMBNAIL_CACHE_ENTRIES) {
    const oldestKey = thumbnailPromiseCache.keys().next().value as string | undefined
    if (oldestKey) thumbnailPromiseCache.delete(oldestKey)
  }
  thumbnailPromiseCache.set(key, promise)
}

function scheduleThumbnail<T>(run: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    thumbnailQueue.push({ run, resolve, reject } as ThumbnailJob<unknown>)
    drainThumbnailQueue()
  })
}

function drainThumbnailQueue(): void {
  while (activeThumbnailJobs < MAX_CONCURRENT_THUMBNAILS && thumbnailQueue.length > 0) {
    const job = thumbnailQueue.shift()
    if (!job) return
    activeThumbnailJobs += 1
    void job.run()
      .then(job.resolve, job.reject)
      .finally(() => {
        activeThumbnailJobs = Math.max(0, activeThumbnailJobs - 1)
        drainThumbnailQueue()
      })
  }
}

async function renderThumbnailOnce(
  preset: ReactPreset,
  width: number,
  height: number,
): Promise<string | null> {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  try {
    canvas = createCanvas(width, height)
    if (!canvas) return null
    ctx = canvas.getContext('2d')
    if (!ctx) return null

    const renderParams = buildRenderParams(preset)
    const sectionType = pickPreviewSectionType(preset)
    const sections = sectionType ? [{
      id: `thumb-${preset.id}-${sectionType}`,
      label: 'Preview',
      type: sectionType,
      startSec: 0,
      endSec: 999,
      intensity: 1,
      source: 'manual' as const,
    }] : []

    ctx.clearRect(0, 0, width, height)
    clearNeonLatticeVisualState(ctx, width, height)
    clearLaserDmxVisualState(ctx, width, height)

    // The same engine entry point used by the live canvas is deliberately warmed
    // long enough for fixed-step springs and historical beam trails to settle.
    for (let index = 0; index < PREVIEW_FRAMES; index += 1) {
      const frame = buildFrame(index, width, height, sectionType)
      renderReactEngine(ctx, frame, preset, renderParams, sections)
    }

    return canvas.toDataURL('image/png')
  } catch {
    return null
  } finally {
    if (ctx) {
      // A thumbnail owns its renderer host. Explicit disposal is required because
      // WeakMap reachability alone does not release WebGL contexts or GPU buffers.
      try { disposeCinematicPortalRenderer(ctx) } catch { /* Graceful fallback below. */ }
      try { clearLaserDmxVisualState(ctx, width, height) } catch { /* Best-effort transient cleanup. */ }
      try { clearNeonLatticeVisualState(ctx, width, height) } catch { /* Best-effort transient cleanup. */ }
    }
    if (canvas) releaseCanvas(canvas)
  }
}

function createCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function releaseCanvas(canvas: HTMLCanvasElement): void {
  // Clearing the backing store gives browsers permission to release its pixels
  // immediately when a scrolling preset grid creates many previews.
  canvas.width = 0
  canvas.height = 0
}

function normalizeDimension(value: number | undefined, fallback: number): number {
  const finite = value != null && Number.isFinite(value) ? Math.round(value) : fallback
  return Math.max(MIN_THUMBNAIL_DIMENSION, Math.min(MAX_THUMBNAIL_DIMENSION, finite))
}

function buildRenderParams(preset: ReactPreset): ReactRenderParams {
  const renderSettings = {
    ...DEFAULT_REACT_PRESET_RENDER_SETTINGS,
    ...(preset.renderSettings ?? {}),
  }

  return {
    ...DEFAULT_REACT_RENDER_PARAMS,
    intensity: preset.params.intensity,
    motion: preset.params.motion,
    glow: preset.params.glow,
    bassReactivity: preset.params.bassReactivity,
    trailDecay: renderSettings.trailDecay,
    fogDensity: renderSettings.fogDensity,
    particleDensity: renderSettings.particleDensity,
    oscillator: {
      ...DEFAULT_OSCILLATOR_SETTINGS,
      ...(preset.oscillatorSettings ?? {}),
    },
    neonLatticeSettings: preset.neonLatticeSettings
      ? { ...DEFAULT_NEON_LATTICE_SETTINGS, ...preset.neonLatticeSettings }
      : undefined,
    thumbnailLaserDmxSettings: preset.laserDmxSettings
      ? { ...createDefaultLaserDmxSettings(), ...preset.laserDmxSettings }
      : undefined,
    neonLatticeTrigger: null,
  }
}

function pickPreviewSectionType(preset: ReactPreset): ReactSectionType | null {
  const mappedTypes = preset.sectionMappings.map(mapping => mapping.sectionType)
  if (mappedTypes.includes('drop')) return 'drop'
  if (mappedTypes.includes('build')) return 'build'
  if (mappedTypes.includes('verse')) return 'verse'
  if (mappedTypes.includes('intro')) return 'intro'
  return mappedTypes[0] ?? null
}

function buildFrame(
  index: number,
  width: number,
  height: number,
  sectionType: ReactSectionType | null,
): ReactFrameContext {
  const progress = PREVIEW_FRAMES <= 1 ? 1 : index / (PREVIEW_FRAMES - 1)
  const timeSec = PREVIEW_START_TIME_SEC + PREVIEW_SECONDS * progress
  const musicalTime = timeSec * PREVIEW_BPM / 60
  const beatPhase = musicalTime - Math.floor(musicalTime)
  const beatHit = beatPhase < 0.08
  const energyBias = sectionType === 'drop' ? 1 : sectionType === 'build' ? 0.82 : sectionType === 'verse' ? 0.62 : 0.44
  const bass = clamp01(0.28 + energyBias * 0.58 + Math.sin(timeSec * 4.6) * 0.14 + (beatHit ? 0.18 : 0))
  const mid = clamp01(0.22 + energyBias * 0.45 + Math.cos(timeSec * 2.8) * 0.12)
  const high = clamp01(0.18 + energyBias * 0.38 + Math.sin(timeSec * 6.4 + 1.2) * 0.11)
  const volume = clamp01((bass * 0.44) + (mid * 0.33) + (high * 0.23))

  return {
    W: width,
    H: height,
    dpr: 1,
    t: index,
    elapsedTimeSec: timeSec,
    deltaTimeSec: PREVIEW_SECONDS / PREVIEW_FRAMES,
    timingDiscontinuity: index === 0,
    timeSec,
    audioTime: timeSec,
    bpm: PREVIEW_BPM,
    beatPhase,
    beatHit,
    isPlaying: true,
    isPaused: false,
    audio: { bass, mid, high, volume },
    freqData: null,
    timeDomainData: null,
    musicIntelligence: null,
    resolvedSection: sectionType ? {
      type: sectionType,
      startSec: 0,
      endSec: 999,
      progress,
      source: 'manual',
    } : null,
    sectionChanged: index === 0,
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
