import {
  DEFAULT_OSCILLATOR_SETTINGS,
  DEFAULT_REACT_PRESET_RENDER_SETTINGS,
  createDefaultLaserDmxSettings,
  type ReactPreset,
  type ReactSectionType,
} from '../ReactTypes'
import { renderReactEngine } from './ReactEngineRenderer'
import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'
import { DEFAULT_REACT_RENDER_PARAMS } from './reactRenderUtils'
import { clearLaserDmxVisualState, disposeLaserDmxRenderer } from './LaserDmxRenderer'
import {
  disposeCinematicPortalRenderer,
  resetCinematicPortalRenderer,
  resolveCinematicPortalBackend,
} from './CinematicPortalRenderer'
import {
  MAX_ACTIVE_DRMVYZ_THUMBNAIL_WEBGL_CONTEXTS,
  claimDrmvyzThumbnailWebGLContext,
  releaseDrmvyzThumbnailWebGLContext,
  serializeDrmvyzThumbnailWebGLWork,
  type DrmvyzThumbnailWebGLContextLease,
} from '../shaders/runtime/WebGLContextLifecycle'
import {
  isReactLiveEngineInitializing,
  subscribeReactLiveEngineOwnership,
  waitForReactLiveEngineStable,
} from './ReactLiveEngineOwnership'

const DEFAULT_W = 192
const DEFAULT_H = 108
const PREVIEW_BPM = 142
const PREVIEW_START_TIME_SEC = 31.5
const PREVIEW_SECONDS = 2.4
const MAX_CONCURRENT_WEBGL_THUMBNAILS = 1
const MAX_THUMBNAIL_CACHE_ENTRIES = 256
const THUMBNAIL_FINGERPRINT_VERSION = 6
const THUMBNAIL_QUALITY_MODE = 'low-cost-v1'
const MIN_THUMBNAIL_DIMENSION = 16
const MAX_THUMBNAIL_DIMENSION = 1024

export interface ReactPresetThumbnailRequest {
  width?: number
  height?: number
  signal?: AbortSignal
}

export interface ReactPresetThumbnailScheduler {
  yield: (signal: AbortSignal) => Promise<void>
}


type ThumbnailRendererFamily = 'canvas2d' | 'cinematic-webgl'

interface ThumbnailRendererPool {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  family: ThumbnailRendererFamily | null
  webglLease: DrmvyzThumbnailWebGLContextLease | null
}

interface ThumbnailSubscriber {
  id: number
  resolve: (value: string | null) => void
  signal?: AbortSignal
  abortListener?: () => void
}

interface ThumbnailJob {
  key: string
  preset: ReactPreset
  width: number
  height: number
  controller: AbortController
  state: 'queued' | 'running' | 'settled'
  subscribers: Map<number, ThumbnailSubscriber>
  completion: Promise<void>
  complete: () => void
  interruptedByLivePreview: boolean
}

const thumbnailResultCache = new Map<string, string>()
const pendingThumbnailJobs = new Map<string, ThumbnailJob>()
const thumbnailQueue: ThumbnailJob[] = []
let activeThumbnailJobs = 0
let nextSubscriberId = 1
let queuePumpScheduled = false
let queuePumpEpoch = 0
let thumbnailRendererPool: ThumbnailRendererPool | null = null
let retireThumbnailPoolWhenIdle = false
let thumbnailPoolTerminalRetirements = 0
let livePriorityInterruptions = 0
let livePriorityDeferrals = 0
let livePrioritySubscription: (() => void) | null = null

const browserThumbnailScheduler = createBrowserThumbnailScheduler()
let thumbnailScheduler: ReactPresetThumbnailScheduler = browserThumbnailScheduler
const queuePumpSignal = new AbortController().signal

export function renderReactPresetThumbnail(
  preset: ReactPreset,
  request: ReactPresetThumbnailRequest = {},
): Promise<string | null> {
  ensureLivePreviewPrioritySubscription()
  const width = normalizeDimension(request.width, DEFAULT_W)
  const height = normalizeDimension(request.height, DEFAULT_H)
  const cacheKey = createReactPresetThumbnailCacheKey(preset, { width, height })
  const cached = thumbnailResultCache.get(cacheKey)
  if (cached) return Promise.resolve(cached)
  if (request.signal?.aborted) return Promise.resolve(null)

  const existing = pendingThumbnailJobs.get(cacheKey)
  if (existing?.controller.signal.aborted) {
    return waitForRetiringJob(existing, preset, request)
  }

  const job = existing ?? createThumbnailJob(cacheKey, preset, width, height)
  if (!existing) {
    pendingThumbnailJobs.set(cacheKey, job)
    thumbnailQueue.push(job)
    requestQueuePump()
  }
  return subscribeToThumbnailJob(job, request.signal)
}

export function readCachedReactPresetThumbnail(
  preset: ReactPreset,
  request: Pick<ReactPresetThumbnailRequest, 'width' | 'height'> = {},
): string | null {
  return thumbnailResultCache.get(createReactPresetThumbnailCacheKey(preset, request)) ?? null
}

export function createReactPresetThumbnailCacheKey(
  preset: ReactPreset,
  request: Pick<ReactPresetThumbnailRequest, 'width' | 'height'> = {},
): string {
  const width = normalizeDimension(request.width, DEFAULT_W)
  const height = normalizeDimension(request.height, DEFAULT_H)
  return `${THUMBNAIL_QUALITY_MODE}:${width}x${height}:${fingerprintReactPresetThumbnail(preset)}`
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
    productionPreset: preset.productionPreset ?? null,
    cinematicConfig: preset.cinematicConfig ?? null,
    pixGridSettings: preset.pixGridSettings ?? null,
    sectionMappings: preset.sectionMappings,
    scenes: preset.scenes,
  })
}

/** Test-only reset. Queued work is removed and active work is cooperatively aborted. */
export function clearReactPresetThumbnailCacheForTests(): void {
  thumbnailResultCache.clear()
  queuePumpEpoch += 1
  queuePumpScheduled = false
  for (const job of [...pendingThumbnailJobs.values()]) {
    cancelThumbnailJob(job)
  }
  thumbnailQueue.length = 0
  retireThumbnailPoolWhenIdle = true
  if (activeThumbnailJobs === 0) terminallyDisposeThumbnailRendererPool()
  livePriorityInterruptions = 0
  livePriorityDeferrals = 0
}

export function setReactPresetThumbnailSchedulerForTests(
  scheduler: ReactPresetThumbnailScheduler | null,
): void {
  thumbnailScheduler = scheduler ?? browserThumbnailScheduler
  queuePumpEpoch += 1
  queuePumpScheduled = false
  requestQueuePump()
}

export function getReactPresetThumbnailDiagnosticsForTests(): Readonly<{
  activeJobs: number
  queuedJobs: number
  pendingJobs: number
  cacheEntries: number
  concurrencyLimit: number
  webglContextLimit: number
  pooledCanvasActive: boolean
  pooledFamily: ThumbnailRendererFamily | null
  terminalRetirements: number
  livePriorityInterruptions: number
  livePriorityDeferrals: number
}> {
  return {
    activeJobs: activeThumbnailJobs,
    queuedJobs: thumbnailQueue.filter(job => job.state === 'queued').length,
    pendingJobs: pendingThumbnailJobs.size,
    cacheEntries: thumbnailResultCache.size,
    concurrencyLimit: MAX_CONCURRENT_WEBGL_THUMBNAILS,
    webglContextLimit: MAX_ACTIVE_DRMVYZ_THUMBNAIL_WEBGL_CONTEXTS,
    pooledCanvasActive: thumbnailRendererPool != null,
    pooledFamily: thumbnailRendererPool?.family ?? null,
    terminalRetirements: thumbnailPoolTerminalRetirements,
    livePriorityInterruptions,
    livePriorityDeferrals,
  }
}

export function getReactPresetThumbnailFrameBudgetForTests(preset: ReactPreset): number {
  return resolveThumbnailFrameBudget(preset)
}

function createThumbnailJob(key: string, preset: ReactPreset, width: number, height: number): ThumbnailJob {
  let complete = () => {}
  const completion = new Promise<void>(resolve => { complete = resolve })
  return {
    key,
    preset,
    width,
    height,
    controller: new AbortController(),
    state: 'queued',
    subscribers: new Map(),
    completion,
    complete,
    interruptedByLivePreview: false,
  }
}

function subscribeToThumbnailJob(job: ThumbnailJob, signal?: AbortSignal): Promise<string | null> {
  if (signal?.aborted) return Promise.resolve(null)

  return new Promise(resolve => {
    const subscriber: ThumbnailSubscriber = {
      id: nextSubscriberId++,
      resolve,
      signal,
    }
    if (signal) {
      subscriber.abortListener = () => detachThumbnailSubscriber(job, subscriber.id, true)
      signal.addEventListener('abort', subscriber.abortListener, { once: true })
    }
    job.subscribers.set(subscriber.id, subscriber)
  })
}

function detachThumbnailSubscriber(job: ThumbnailJob, subscriberId: number, resolveCancelled: boolean): void {
  const subscriber = job.subscribers.get(subscriberId)
  if (!subscriber) return
  job.subscribers.delete(subscriberId)
  if (subscriber.signal && subscriber.abortListener) {
    subscriber.signal.removeEventListener('abort', subscriber.abortListener)
  }
  if (resolveCancelled) subscriber.resolve(null)
  if (job.subscribers.size === 0) cancelThumbnailJob(job)
}

function cancelThumbnailJob(job: ThumbnailJob): void {
  if (job.state === 'settled') return
  job.controller.abort()
  for (const subscriber of [...job.subscribers.values()]) {
    job.subscribers.delete(subscriber.id)
    if (subscriber.signal && subscriber.abortListener) {
      subscriber.signal.removeEventListener('abort', subscriber.abortListener)
    }
    subscriber.resolve(null)
  }

  if (job.state === 'queued') {
    const index = thumbnailQueue.indexOf(job)
    if (index >= 0) thumbnailQueue.splice(index, 1)
    if (pendingThumbnailJobs.get(job.key) === job) pendingThumbnailJobs.delete(job.key)
    job.state = 'settled'
    job.complete()
    requestQueuePump()
  }
}

function waitForRetiringJob(
  job: ThumbnailJob,
  preset: ReactPreset,
  request: ReactPresetThumbnailRequest,
): Promise<string | null> {
  if (request.signal?.aborted) return Promise.resolve(null)
  return new Promise(resolve => {
    let settled = false
    const finish = (value: string | null) => {
      if (settled) return
      settled = true
      request.signal?.removeEventListener('abort', abort)
      resolve(value)
    }
    const abort = () => finish(null)
    request.signal?.addEventListener('abort', abort, { once: true })
    void job.completion.then(() => {
      if (request.signal?.aborted) finish(null)
      else void renderReactPresetThumbnail(preset, request).then(finish)
    })
  })
}

function requestQueuePump(): void {
  if (queuePumpScheduled || activeThumbnailJobs >= MAX_CONCURRENT_WEBGL_THUMBNAILS) return
  if (!thumbnailQueue.some(job => job.state === 'queued')) return
  if (isReactLiveEngineInitializing()) {
    livePriorityDeferrals += 1
    return
  }

  queuePumpScheduled = true
  const epoch = queuePumpEpoch
  void thumbnailScheduler.yield(queuePumpSignal).then(() => {
    if (epoch !== queuePumpEpoch) return
    queuePumpScheduled = false
    startNextThumbnailJob()
  }, () => {
    if (epoch !== queuePumpEpoch) return
    queuePumpScheduled = false
    requestQueuePump()
  })
}

function startNextThumbnailJob(): void {
  if (activeThumbnailJobs >= MAX_CONCURRENT_WEBGL_THUMBNAILS) return
  let job = thumbnailQueue.shift()
  while (job && (job.state !== 'queued' || job.controller.signal.aborted || job.subscribers.size === 0)) {
    if (job.state === 'queued') cancelThumbnailJob(job)
    job = thumbnailQueue.shift()
  }
  if (!job) return

  job.state = 'running'
  activeThumbnailJobs += 1
  void renderThumbnailOnce(job.preset, job.width, job.height, job.controller.signal)
    .then(
      result => finishRunningThumbnailJob(job, result),
      () => finishRunningThumbnailJob(job, null),
    )
    .finally(() => {
      activeThumbnailJobs = Math.max(0, activeThumbnailJobs - 1)
      if (retireThumbnailPoolWhenIdle && activeThumbnailJobs === 0) {
        terminallyDisposeThumbnailRendererPool()
      }
      requestQueuePump()
    })
}

function finishRunningThumbnailJob(job: ThumbnailJob, result: string | null): void {
  if (job.interruptedByLivePreview && job.subscribers.size > 0) {
    job.interruptedByLivePreview = false
    job.controller = new AbortController()
    job.state = 'queued'
    thumbnailQueue.unshift(job)
    return
  }
  settleThumbnailJob(job, result)
}

function settleThumbnailJob(job: ThumbnailJob, result: string | null): void {
  const validResult = !job.controller.signal.aborted && job.subscribers.size > 0 ? result : null
  if (validResult) cacheThumbnailResult(job.key, validResult)

  for (const subscriber of [...job.subscribers.values()]) {
    job.subscribers.delete(subscriber.id)
    if (subscriber.signal && subscriber.abortListener) {
      subscriber.signal.removeEventListener('abort', subscriber.abortListener)
    }
    subscriber.resolve(validResult)
  }

  if (pendingThumbnailJobs.get(job.key) === job) pendingThumbnailJobs.delete(job.key)
  job.state = 'settled'
  job.complete()
}

function cacheThumbnailResult(key: string, value: string): void {
  if (!thumbnailResultCache.has(key) && thumbnailResultCache.size >= MAX_THUMBNAIL_CACHE_ENTRIES) {
    const oldestKey = thumbnailResultCache.keys().next().value as string | undefined
    if (oldestKey) thumbnailResultCache.delete(oldestKey)
  }
  thumbnailResultCache.delete(key)
  thumbnailResultCache.set(key, value)
}

function renderThumbnailOnce(
  preset: ReactPreset,
  width: number,
  height: number,
  signal: AbortSignal,
): Promise<string | null> {
  return serializeDrmvyzThumbnailWebGLWork(
    () => renderThumbnailOnceWithExclusiveContextAccess(preset, width, height, signal),
  )
}

async function renderThumbnailOnceWithExclusiveContextAccess(
  preset: ReactPreset,
  width: number,
  height: number,
  signal: AbortSignal,
): Promise<string | null> {
  let pool: ThumbnailRendererPool | null = null
  let completed = false
  try {
    if (signal.aborted) return null
    if (isReactLiveEngineInitializing()) await waitForReactLiveEngineStable(signal)
    if (signal.aborted) return null
    const thumbnailPreset = createLowCostThumbnailPreset(preset)
    pool = acquireThumbnailRendererPool(thumbnailPreset, width, height)
    if (!pool || signal.aborted) return null
    const { canvas, context: ctx } = pool

    const renderParams = buildRenderParams(thumbnailPreset)
    const sectionType = pickPreviewSectionType(thumbnailPreset)
    const sections = sectionType ? [{
      id: `thumb-${thumbnailPreset.id}-${sectionType}`,
      label: 'Preview',
      type: sectionType,
      startSec: 0,
      endSec: 999,
      intensity: 1,
      source: 'manual' as const,
    }] : []
    const frameBudget = resolveThumbnailFrameBudget(thumbnailPreset)

    for (let index = 0; index < frameBudget; index += 1) {
      if (signal.aborted) return null
      const frame = buildFrame(index, frameBudget, width, height, sectionType)
      renderReactEngine(ctx, frame, thumbnailPreset, renderParams, sections, {
        webglLifetime: 'transient-thumbnail',
      })
      if (index < frameBudget - 1) {
        if (isReactLiveEngineInitializing()) await waitForReactLiveEngineStable(signal)
        await thumbnailScheduler.yield(signal)
      }
    }

    if (signal.aborted) return null
    const result = canvas.toDataURL('image/png')
    completed = true
    return result
  } catch {
    return null
  } finally {
    if (pool) {
      if (!completed || signal.aborted) invalidateThumbnailRendererPool(pool)
      else resetThumbnailRendererPoolAfterJob(pool)
    }
  }
}

function ensureLivePreviewPrioritySubscription(): void {
  if (livePrioritySubscription) return
  livePrioritySubscription = subscribeReactLiveEngineOwnership(snapshot => {
    queuePumpEpoch += 1
    queuePumpScheduled = false

    if (snapshot.phase !== 'initializing') {
      requestQueuePump()
      return
    }

    retireThumbnailPoolWhenIdle = activeThumbnailJobs > 0
    for (const job of pendingThumbnailJobs.values()) {
      if (job.state !== 'running' || job.controller.signal.aborted || job.subscribers.size === 0) continue
      job.interruptedByLivePreview = true
      livePriorityInterruptions += 1
      job.controller.abort()
    }

    // Active thumbnail work is always suspended at an explicit yield boundary
    // when this callback can run. Retire the pooled context synchronously so
    // the user-selected live renderer receives the GPU slot first.
    terminallyDisposeThumbnailRendererPool()
  })
}

function acquireThumbnailRendererPool(
  preset: ReactPreset,
  width: number,
  height: number,
): ThumbnailRendererPool | null {
  const family = resolveThumbnailRendererFamily(preset)
  let pool = thumbnailRendererPool
  if (!pool) {
    const canvas = createCanvas(width, height)
    const context = canvas?.getContext('2d') ?? null
    if (!canvas || !context) return null
    pool = { canvas, context, family: null, webglLease: null }
    thumbnailRendererPool = pool
    retireThumbnailPoolWhenIdle = false
  }

  if (pool.family && pool.family !== family) {
    retireIncompatibleThumbnailFamily(pool)
  }
  pool.family = family
  if (family === 'cinematic-webgl' && !pool.webglLease) {
    pool.webglLease = claimDrmvyzThumbnailWebGLContext(
      'react-preset-thumbnail',
      () => terminallyDisposeThumbnailRendererPool(pool),
    )
  }
  prepareThumbnailRendererPool(pool, width, height)
  return pool
}

function resolveThumbnailRendererFamily(preset: ReactPreset): ThumbnailRendererFamily {
  return preset.engine === 'cinematicPortal' && resolveCinematicPortalBackend(preset) === 'webgl2'
    ? 'cinematic-webgl'
    : 'canvas2d'
}

function prepareThumbnailRendererPool(
  pool: ThumbnailRendererPool,
  width: number,
  height: number,
): void {
  const { canvas, context } = pool
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  resetCanvas2DState(context)
  resetCinematicPortalRenderer(context, 'thumbnailReuse')
  clearLaserDmxVisualState(context, width, height, { affectProductionOutput: false })
  disposeLaserDmxRenderer(context, { affectProductionOutput: false })
  context.clearRect(0, 0, width, height)
}

function resetThumbnailRendererPoolAfterJob(pool: ThumbnailRendererPool): void {
  if (thumbnailRendererPool !== pool) return
  resetCinematicPortalRenderer(pool.context, 'thumbnailReuse')
  clearLaserDmxVisualState(pool.context, pool.canvas.width, pool.canvas.height, { affectProductionOutput: false })
  disposeLaserDmxRenderer(pool.context, { affectProductionOutput: false })
  resetCanvas2DState(pool.context)
}

function retireIncompatibleThumbnailFamily(pool: ThumbnailRendererPool): void {
  if (pool.family === 'cinematic-webgl') {
    disposeCinematicPortalRenderer(pool.context, 'terminal-retire')
    releaseDrmvyzThumbnailWebGLContext(pool.webglLease)
    pool.webglLease = null
    thumbnailPoolTerminalRetirements += 1
  } else {
    resetCinematicPortalRenderer(pool.context, 'thumbnailReuse')
  }
  clearLaserDmxVisualState(pool.context, pool.canvas.width, pool.canvas.height, { affectProductionOutput: false })
  disposeLaserDmxRenderer(pool.context, { affectProductionOutput: false })
  resetCanvas2DState(pool.context)
}

function invalidateThumbnailRendererPool(pool: ThumbnailRendererPool): void {
  if (thumbnailRendererPool !== pool) return
  terminallyDisposeThumbnailRendererPool()
}

function terminallyDisposeThumbnailRendererPool(expectedPool: ThumbnailRendererPool | null = thumbnailRendererPool): void {
  const pool = thumbnailRendererPool
  if (!pool || (expectedPool && expectedPool !== pool)) {
    retireThumbnailPoolWhenIdle = false
    return
  }
  try { disposeCinematicPortalRenderer(pool.context, 'terminal-retire') } catch { /* Best effort. */ }
  try {
    clearLaserDmxVisualState(pool.context, pool.canvas.width, pool.canvas.height, { affectProductionOutput: false })
    disposeLaserDmxRenderer(pool.context, { affectProductionOutput: false })
  } catch { /* Best effort. */ }
  releaseDrmvyzThumbnailWebGLContext(pool.webglLease)
  pool.webglLease = null
  releaseCanvas(pool.canvas)
  thumbnailRendererPool = null
  retireThumbnailPoolWhenIdle = false
  thumbnailPoolTerminalRetirements += 1
}

function resetCanvas2DState(ctx: CanvasRenderingContext2D): void {
  try {
    ctx.resetTransform?.()
    ctx.setTransform?.(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.filter = 'none'
    ctx.shadowBlur = 0
    ctx.shadowColor = 'rgba(0,0,0,0)'
    ctx.lineWidth = 1
    ctx.setLineDash?.([])
  } catch {
    // Tests and older canvas implementations may expose only a subset of state APIs.
  }
}

function createLowCostThumbnailPreset(preset: ReactPreset): ReactPreset {
  let thumbnailPreset = preset
  if (preset.cinematicConfig) {
    thumbnailPreset = {
      ...thumbnailPreset,
      cinematicConfig: { ...preset.cinematicConfig, qualityTier: 'low' },
    }
  }
  if (preset.laserDmxSettings) {
    const productionStage = preset.laserDmxSettings.productionStage
    const atmosphere = preset.laserDmxSettings.atmosphere
    thumbnailPreset = {
      ...thumbnailPreset,
      laserDmxSettings: {
        ...preset.laserDmxSettings,
        ...(productionStage ? {
          productionStage: {
            ...productionStage,
            editor: { ...productionStage.editor, qualityTier: 'low' },
          },
        } : {}),
        ...(atmosphere ? {
          atmosphere: {
            ...atmosphere,
            qualityTier: 'low',
            maxParticleBudget: Math.min(atmosphere.maxParticleBudget, 80),
          },
        } : {}),
      },
    }
  }
  return thumbnailPreset
}

function resolveThumbnailFrameBudget(preset: ReactPreset): number {
  switch (preset.engine) {
    case 'shaderPads': return 1
    case 'oscilloscope': return 2
    case 'laserDmx': return 5
    case 'pixGrid': return 3
    case 'cinematicPortal':
      if (preset.cinematicConfig?.worldMode === 'reactiveConstellation') return 10
      return 7
    default: return 4
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
    thumbnailLaserDmxSettings: preset.laserDmxSettings
      ? {
          ...createDefaultLaserDmxSettings(),
          ...preset.laserDmxSettings,
          ...(preset.productionPreset?.thumbnail.activeLookId
            ? { activeProductionLookId: preset.productionPreset.thumbnail.activeLookId }
            : {}),
        }
      : undefined,
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
  frameBudget: number,
  width: number,
  height: number,
  sectionType: ReactSectionType | null,
): ReactFrameContext {
  const progress = frameBudget <= 1 ? 1 : index / (frameBudget - 1)
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
    deltaTimeSec: PREVIEW_SECONDS / Math.max(1, frameBudget),
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

function createBrowserThumbnailScheduler(): ReactPresetThumbnailScheduler {
  return {
    yield(signal) {
      if (signal.aborted) return Promise.resolve()
      return new Promise(resolve => {
        let finished = false
        let cancelScheduled = () => {}
        const finish = () => {
          if (finished) return
          finished = true
          signal.removeEventListener('abort', finish)
          cancelScheduled()
          resolve()
        }
        signal.addEventListener('abort', finish, { once: true })

        const requestIdle = (globalThis as typeof globalThis & {
          requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
          cancelIdleCallback?: (id: number) => void
        }).requestIdleCallback
        const cancelIdle = (globalThis as typeof globalThis & {
          cancelIdleCallback?: (id: number) => void
        }).cancelIdleCallback

        if (typeof requestIdle === 'function') {
          const id = requestIdle(finish, { timeout: 80 })
          cancelScheduled = () => cancelIdle?.(id)
        } else if (typeof requestAnimationFrame === 'function') {
          const id = requestAnimationFrame(() => finish())
          cancelScheduled = () => { if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id) }
        } else if (typeof MessageChannel !== 'undefined') {
          const channel = new MessageChannel()
          channel.port1.onmessage = finish
          channel.port2.postMessage(undefined)
          cancelScheduled = () => {
            channel.port1.onmessage = null
            channel.port1.close()
            channel.port2.close()
          }
        } else {
          queueMicrotask(finish)
        }
      })
    },
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
