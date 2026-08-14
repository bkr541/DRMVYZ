import {
  LivingRibbonSimulation,
  hashVisualSimulationString,
  visualSimulationDeterministicUnit,
  type LivingRibbonRenderView,
  type LivingRibbonRuntimeControls,
  type VisualSimulationQualityTier,
  type VisualSimulationRuntimeMode,
} from '../../../../features/visualSimulation'
import type { ReactPreset } from '../ReactTypes'
import type {
  SoundDrawingLivingRibbonPhysicalControls,
  SoundDrawingResolvedPerformanceFrame,
  SoundDrawingResolvedPerformanceLayer,
  SoundDrawingVisualQuality,
} from '../soundDrawing/SoundDrawingPerformanceTypes'
import type { ReactFrameContext } from './reactRenderUtils'

export const LIVING_RIBBON_MAX_RUNTIMES_PER_CONTEXT = 6
export const LIVING_RIBBON_MAX_FAILURE_RECORDS = 12
export const LIVING_RIBBON_MAX_RECENT_IMPULSES = 8
export const LIVING_RIBBON_AUTO_POOR_FRAME_THRESHOLD_SEC = 1 / 42
export const LIVING_RIBBON_AUTO_GOOD_FRAME_THRESHOLD_SEC = 1 / 58
export const LIVING_RIBBON_AUTO_STEP_DOWN_FRAMES = 45
export const LIVING_RIBBON_AUTO_STEP_UP_FRAMES = 180
export const LIVING_RIBBON_AUTO_COOLDOWN_FRAMES = 120
const MIN_RENDER_POINTS = 4
const MAX_RENDER_POINTS = 256
const MAX_DIAGNOSTIC_COUNTER = 1_000_000
const DEFAULT_FRAME_DELTA_SEC = 1 / 60
const SEEK_EPSILON_SEC = 0.05
const AUTO_ROLLING_WEIGHT = 0.08

export interface LivingRibbonCanvasQualityBudget {
  requested: SoundDrawingVisualQuality
  resolved: Exclude<VisualSimulationQualityTier, 'auto'>
  pointCount: number
  splineSubdivisions: number
  glowPasses: number
  sparkCount: number
  accentStride: number
  trailDetail: number
}

const QUALITY_BUDGETS: Readonly<
  Record<Exclude<VisualSimulationQualityTier, 'auto'>, Omit<LivingRibbonCanvasQualityBudget, 'requested' | 'resolved'>>
> = {
  low: {
    pointCount: 48,
    splineSubdivisions: 1,
    glowPasses: 1,
    sparkCount: 2,
    accentStride: 5,
    trailDetail: 0.45,
  },
  medium: {
    pointCount: 96,
    splineSubdivisions: 2,
    glowPasses: 2,
    sparkCount: 4,
    accentStride: 3,
    trailDetail: 0.72,
  },
  high: {
    pointCount: 160,
    splineSubdivisions: 3,
    glowPasses: 3,
    sparkCount: 7,
    accentStride: 2,
    trailDetail: 1,
  },
}

export function resolveLivingRibbonCanvasQualityBudget(
  requested: SoundDrawingVisualQuality,
  mode: VisualSimulationRuntimeMode,
  pointDensity?: number,
  sparkAmount?: number,
  autoResolved?: Exclude<VisualSimulationQualityTier, 'auto'>,
): LivingRibbonCanvasQualityBudget {
  const safeRequested: SoundDrawingVisualQuality = ['auto', 'low', 'medium', 'high'].includes(requested)
    ? requested
    : 'auto'
  const resolved: Exclude<VisualSimulationQualityTier, 'auto'> = safeRequested === 'auto'
    ? mode === 'thumbnail'
      ? 'low'
      : autoResolved ?? 'medium'
    : safeRequested
  const base = QUALITY_BUDGETS[resolved]
  const densityScale = pointDensity == null ? 1 : 0.55 + clamp01(pointDensity) * 0.75
  const sparkScale = sparkAmount == null ? 1 : clamp01(sparkAmount)
  const modeCap = mode === 'thumbnail' ? 64 : mode === 'preview' ? 128 : MAX_RENDER_POINTS
  return {
    requested: safeRequested,
    resolved,
    // Runtime-mode caps remain authoritative even when a manual tier is selected.
    pointCount: Math.max(8, Math.min(modeCap, MAX_RENDER_POINTS, Math.round(base.pointCount * densityScale))),
    splineSubdivisions: Math.max(1, Math.min(3, base.splineSubdivisions)),
    glowPasses: Math.max(1, Math.min(3, base.glowPasses)),
    sparkCount: Math.max(0, Math.min(mode === 'thumbnail' ? 3 : 8, Math.round(base.sparkCount * sparkScale))),
    accentStride: Math.max(1, Math.min(8, base.accentStride)),
    trailDetail: Math.max(0, Math.min(mode === 'thumbnail' ? 0.55 : 1, base.trailDetail)),
  }
}

interface LivingRibbonProjectedBuffers {
  pointX: Float32Array
  pointY: Float32Array
  pointWidth: Float32Array
  pointHeat: Float32Array
  pointSpeed: Float32Array
  splineX: Float32Array
  splineY: Float32Array
  splineWidth: Float32Array
  splineHeat: Float32Array
  splineSpeed: Float32Array
}

interface LivingRibbonPaletteCache {
  key: string
  bloom: string
  outer: string
  inner: string
  core: string
  accent: string
  spark: string
}

interface LivingRibbonRuntimeRecord {
  key: string
  identity: string
  simulation: LivingRibbonSimulation
  budget: LivingRibbonCanvasQualityBudget
  buffers: LivingRibbonProjectedBuffers
  palette: LivingRibbonPaletteCache
  lastAudioTimeSec: number
  lastTrackIdentity: string | null
  lastStructureRevision: number
  controls: LivingRibbonRuntimeControls
  recentImpulses: string[]
}

interface LivingRibbonFailureRecord {
  message: string
  attempts: number
  nextRetryFrame: number
}

interface LivingRibbonAutoQualityState {
  mode: VisualSimulationRuntimeMode
  resolved: Exclude<VisualSimulationQualityTier, 'auto'>
  rollingFrameTimeSec: number
  poorFrameCount: number
  goodFrameCount: number
  cooldownFrames: number
  transitionCount: number
}

interface LivingRibbonOwnerState {
  runtimes: Map<string, LivingRibbonRuntimeRecord>
  failures: Map<string, LivingRibbonFailureRecord>
  paused: boolean
  resetCount: number
  finiteRecoveryCount: number
  frameSequence: number
  autoQuality: LivingRibbonAutoQualityState
}

const ownerStateMap = new WeakMap<CanvasRenderingContext2D, LivingRibbonOwnerState>()
let simulationFactory: () => LivingRibbonSimulation = () => new LivingRibbonSimulation()

function createAutoQualityState(mode: VisualSimulationRuntimeMode): LivingRibbonAutoQualityState {
  return {
    mode,
    resolved: mode === 'thumbnail' ? 'low' : 'medium',
    rollingFrameTimeSec: DEFAULT_FRAME_DELTA_SEC,
    poorFrameCount: 0,
    goodFrameCount: 0,
    cooldownFrames: 0,
    transitionCount: 0,
  }
}

function updateAutoQualityState(
  state: LivingRibbonAutoQualityState,
  mode: VisualSimulationRuntimeMode,
  frameDeltaSec: number,
): Exclude<VisualSimulationQualityTier, 'auto'> {
  if (state.mode !== mode) Object.assign(state, createAutoQualityState(mode))
  if (mode === 'thumbnail') return 'low'
  const sample = clamp(finiteNumber(frameDeltaSec, DEFAULT_FRAME_DELTA_SEC), 0, 0.1)
  state.rollingFrameTimeSec = lerp(state.rollingFrameTimeSec, sample, AUTO_ROLLING_WEIGHT)
  if (state.cooldownFrames > 0) state.cooldownFrames -= 1
  if (state.rollingFrameTimeSec >= LIVING_RIBBON_AUTO_POOR_FRAME_THRESHOLD_SEC) {
    state.poorFrameCount = Math.min(LIVING_RIBBON_AUTO_STEP_DOWN_FRAMES, state.poorFrameCount + 1)
    state.goodFrameCount = 0
  } else if (state.rollingFrameTimeSec <= LIVING_RIBBON_AUTO_GOOD_FRAME_THRESHOLD_SEC) {
    state.goodFrameCount = Math.min(LIVING_RIBBON_AUTO_STEP_UP_FRAMES, state.goodFrameCount + 1)
    state.poorFrameCount = Math.max(0, state.poorFrameCount - 1)
  } else {
    state.poorFrameCount = Math.max(0, state.poorFrameCount - 1)
    state.goodFrameCount = Math.max(0, state.goodFrameCount - 1)
  }
  if (state.cooldownFrames > 0) return state.resolved
  if (state.poorFrameCount >= LIVING_RIBBON_AUTO_STEP_DOWN_FRAMES) {
    const next = state.resolved === 'high' ? 'medium' : 'low'
    if (next !== state.resolved) {
      state.resolved = next
      state.transitionCount = incrementBounded(state.transitionCount)
      state.cooldownFrames = LIVING_RIBBON_AUTO_COOLDOWN_FRAMES
    }
    state.poorFrameCount = 0
    state.goodFrameCount = 0
  } else if (state.goodFrameCount >= LIVING_RIBBON_AUTO_STEP_UP_FRAMES) {
    const next = state.resolved === 'low' ? 'medium' : mode === 'preview' ? 'medium' : 'high'
    if (next !== state.resolved) {
      state.resolved = next
      state.transitionCount = incrementBounded(state.transitionCount)
      state.cooldownFrames = LIVING_RIBBON_AUTO_COOLDOWN_FRAMES
    }
    state.poorFrameCount = 0
    state.goodFrameCount = 0
  }
  return state.resolved
}

function recordFailure(state: LivingRibbonOwnerState, key: string, message: string): void {
  const previous = state.failures.get(key)
  const attempts = Math.min(8, (previous?.attempts ?? 0) + 1)
  const retryDelayFrames = Math.min(600, 15 * 2 ** Math.max(0, attempts - 1))
  state.failures.delete(key)
  state.failures.set(key, { message, attempts, nextRetryFrame: state.frameSequence + retryDelayFrames })
  while (state.failures.size > LIVING_RIBBON_MAX_FAILURE_RECORDS) {
    const oldest = state.failures.keys().next().value as string | undefined
    if (!oldest) break
    state.failures.delete(oldest)
  }
}

function incrementBounded(value: number, amount = 1): number {
  return Math.min(MAX_DIAGNOSTIC_COUNTER, Math.max(0, value) + Math.max(0, Math.floor(amount)))
}

function getOwnerState(ownerContext: CanvasRenderingContext2D): LivingRibbonOwnerState {
  const existing = ownerStateMap.get(ownerContext)
  if (existing) return existing
  const created: LivingRibbonOwnerState = {
    runtimes: new Map(),
    failures: new Map(),
    paused: false,
    resetCount: 0,
    finiteRecoveryCount: 0,
    frameSequence: 0,
    autoQuality: createAutoQualityState('live'),
  }
  ownerStateMap.set(ownerContext, created)
  return created
}

function createBuffers(pointCount: number, subdivisions: number): LivingRibbonProjectedBuffers {
  const safePointCount = Math.max(MIN_RENDER_POINTS, Math.min(MAX_RENDER_POINTS, Math.floor(pointCount)))
  const splineCount = Math.max(safePointCount, (safePointCount - 1) * Math.max(1, subdivisions) + 1)
  return {
    pointX: new Float32Array(safePointCount),
    pointY: new Float32Array(safePointCount),
    pointWidth: new Float32Array(safePointCount),
    pointHeat: new Float32Array(safePointCount),
    pointSpeed: new Float32Array(safePointCount),
    splineX: new Float32Array(splineCount),
    splineY: new Float32Array(splineCount),
    splineWidth: new Float32Array(splineCount),
    splineHeat: new Float32Array(splineCount),
    splineSpeed: new Float32Array(splineCount),
  }
}

function disposeRuntime(record: LivingRibbonRuntimeRecord): void {
  record.simulation.dispose()
  record.recentImpulses.length = 0
}

function boundedInsertRuntime(state: LivingRibbonOwnerState, record: LivingRibbonRuntimeRecord): void {
  while (state.runtimes.size >= LIVING_RIBBON_MAX_RUNTIMES_PER_CONTEXT) {
    const oldestKey = state.runtimes.keys().next().value as string | undefined
    if (!oldestKey) break
    const oldest = state.runtimes.get(oldestKey)
    if (oldest) disposeRuntime(oldest)
    state.runtimes.delete(oldestKey)
    state.failures.delete(oldestKey)
  }
  state.runtimes.set(record.key, record)
}

function layerRuntimeKey(
  performance: SoundDrawingResolvedPerformanceFrame,
  layer: SoundDrawingResolvedPerformanceLayer,
): string {
  return `${performance.showId}:${layer.id}`
}

function layerRuntimeIdentity(
  performance: SoundDrawingResolvedPerformanceFrame,
  layer: SoundDrawingResolvedPerformanceLayer,
  mode: VisualSimulationRuntimeMode,
): string {
  return [performance.showId, layer.id, layer.generator, layer.source.identity, mode].join('|')
}

function controlsForLayer(layer: SoundDrawingResolvedPerformanceLayer): LivingRibbonRuntimeControls {
  const controls: SoundDrawingLivingRibbonPhysicalControls = layer.livingRibbonControls
  return {
    drive: clamp01(controls.drive),
    turbulence: clamp01(controls.turbulence),
    tension: clamp01(controls.tension),
    damping: clamp01(controls.damping),
    spread: clamp01(controls.spread),
    centerAttraction: clamp01(controls.centerAttraction),
    widthTarget: clamp01(controls.widthTarget),
    twist: clampSigned(controls.twist),
    radialPressure: clampSigned(controls.radialPressure),
    collapseAmount: clamp01(controls.collapseAmount),
    releaseAmount: clamp01(controls.releaseAmount),
    directionalDrift: clampSigned(controls.directionalDrift),
    heatDecay: clamp01(controls.heatDecay),
  }
}

function createRuntimeRecord(
  key: string,
  identity: string,
  performance: SoundDrawingResolvedPerformanceFrame,
  layer: SoundDrawingResolvedPerformanceLayer,
  frame: ReactFrameContext,
  quality: SoundDrawingVisualQuality,
  mode: VisualSimulationRuntimeMode,
  pointDensity?: number,
  sparkAmount?: number,
  autoResolved?: Exclude<VisualSimulationQualityTier, 'auto'>,
): LivingRibbonRuntimeRecord {
  const budget = resolveLivingRibbonCanvasQualityBudget(quality, mode, pointDensity, sparkAmount, autoResolved)
  const simulation = simulationFactory()
  const seed = hashVisualSimulationString(`${identity}|${performance.context.trackIdentity ?? 'no-track'}`)
  const configureResult = simulation.configure({
    structural: {
      pointCount: budget.pointCount,
      totalLength: 9,
      baseSeed: seed,
      initializationMode: 'wave',
      fieldScale: 0.42,
      boundarySize: 8,
      qualityTier: budget.resolved,
    },
    controls: controlsForLayer(layer),
    mode,
  })
  simulation.reconstructAtTime(frame.audioTime, `${identity}:create`)
  return {
    key,
    identity,
    simulation,
    budget,
    buffers: createBuffers(budget.pointCount, budget.splineSubdivisions),
    palette: emptyPaletteCache(),
    lastAudioTimeSec: frame.audioTime,
    lastTrackIdentity: performance.context.trackIdentity,
    lastStructureRevision: configureResult.structureRevision,
    controls: controlsForLayer(layer),
    recentImpulses: [],
  }
}

export function usesLivingRibbonCanvasRenderer(layer: SoundDrawingResolvedPerformanceLayer): boolean {
  return (
    layer.enabled && layer.opacity > 0.001 && layer.generator === 'livingRibbon' && layer.source.kind === 'generated'
  )
}

export interface PrepareLivingRibbonCanvasFrameInput {
  ownerContext: CanvasRenderingContext2D
  frame: ReactFrameContext
  performance: SoundDrawingResolvedPerformanceFrame
  quality: SoundDrawingVisualQuality
  mode: VisualSimulationRuntimeMode
  pointDensity?: number
  sparkAmount?: number
}

export interface PrepareLivingRibbonCanvasFrameResult {
  activeRuntimeKeys: ReadonlySet<string>
  clearTrail: boolean
  diagnostics: readonly string[]
  qualityBudget: LivingRibbonCanvasQualityBudget
}

export function prepareLivingRibbonCanvasFrame(
  input: PrepareLivingRibbonCanvasFrameInput,
): PrepareLivingRibbonCanvasFrameResult {
  const state = getOwnerState(input.ownerContext)
  state.frameSequence = incrementBounded(state.frameSequence)
  if (state.autoQuality.mode !== input.mode) Object.assign(state.autoQuality, createAutoQualityState(input.mode))
  const autoResolved = input.quality === 'auto' && (input.frame.analysisActive ?? input.frame.isPlaying) !== false
    ? updateAutoQualityState(state.autoQuality, input.mode, input.frame.deltaTimeSec ?? DEFAULT_FRAME_DELTA_SEC)
    : state.autoQuality.resolved
  const qualityBudget = resolveLivingRibbonCanvasQualityBudget(
    input.quality,
    input.mode,
    input.pointDensity,
    input.sparkAmount,
    autoResolved,
  )
  const activeKeys = new Set<string>()
  const diagnostics: string[] = []
  const wasPaused = state.paused
  let clearTrail = false

  for (const layer of input.performance.layers) {
    if (!usesLivingRibbonCanvasRenderer(layer)) continue
    const key = layerRuntimeKey(input.performance, layer)
    const identity = layerRuntimeIdentity(input.performance, layer, input.mode)
    activeKeys.add(key)
    let record = state.runtimes.get(key)
    if (record && record.identity !== identity) {
      disposeRuntime(record)
      state.runtimes.delete(key)
      state.failures.delete(key)
      record = undefined
      clearTrail = true
    }
    if (!record) {
      const priorFailure = state.failures.get(key)
      if (priorFailure && state.frameSequence < priorFailure.nextRetryFrame) {
        diagnostics.push(priorFailure.message)
        continue
      }
      try {
        record = createRuntimeRecord(
          key,
          identity,
          input.performance,
          layer,
          input.frame,
          input.quality,
          input.mode,
          input.pointDensity,
          input.sparkAmount,
          autoResolved,
        )
        boundedInsertRuntime(state, record)
        state.failures.delete(key)
      } catch (error) {
        const message = diagnosticMessage('runtime creation failed', error)
        recordFailure(state, key, message)
        diagnostics.push(message)
        continue
      }
    } else {
      try {
        const nextBudget = qualityBudget
        const result = record.simulation.configure({
          structural: {
            pointCount: nextBudget.pointCount,
            totalLength: 9,
            baseSeed: record.simulation.getRenderView().baseSeed,
            initializationMode: 'wave',
            fieldScale: 0.42,
            boundarySize: 8,
            qualityTier: nextBudget.resolved,
          },
          controls: controlsForLayer(layer),
          mode: input.mode,
        })
        if (result.rebuilt) {
          record.buffers = createBuffers(nextBudget.pointCount, nextBudget.splineSubdivisions)
          record.lastStructureRevision = result.structureRevision
          record.simulation.reconstructAtTime(
            input.frame.audioTime,
            `${identity}:quality:${nextBudget.resolved}`,
          )
          clearTrail = true
        }
        record.budget = nextBudget
        record.controls = controlsForLayer(layer)
      } catch (error) {
        const message = diagnosticMessage('runtime configuration failed', error)
        disposeRuntime(record)
        state.runtimes.delete(key)
        recordFailure(state, key, message)
        diagnostics.push(message)
        clearTrail = true
        continue
      }
    }

    const current = state.runtimes.get(key)
    if (!current) continue
    const context = input.performance.context
    const backwardSeek = context.seekDetected && input.frame.audioTime + SEEK_EPSILON_SEC < current.lastAudioTimeSec
    try {
      if (context.trackReplacementDetected || current.lastTrackIdentity !== context.trackIdentity) {
        current.simulation.replaceTrack(
          hashVisualSimulationString(`${identity}|${context.trackIdentity ?? 'no-track'}`),
          context.trackChangeIdentity,
        )
        clearTrail = true
      } else if (context.loopWrapDetected) {
        current.simulation.loopWrap(input.frame.audioTime, context.loopIdentity)
        clearTrail = true
      } else if (backwardSeek) {
        current.simulation.backwardSeek(input.frame.audioTime, context.seekIdentity)
        clearTrail = true
      } else if (context.seekDetected) {
        current.simulation.seek(input.frame.audioTime, context.seekIdentity)
        clearTrail = true
      } else if (input.frame.timingDiscontinuity) {
        current.simulation.synchronizeTiming(input.frame.audioTime, context.timingDiscontinuityIdentity)
        clearTrail = true
      }
    } catch (error) {
      const message = diagnosticMessage('lifecycle synchronization failed', error)
      disposeRuntime(current)
      state.runtimes.delete(key)
      recordFailure(state, key, message)
      diagnostics.push(message)
      clearTrail = true
      continue
    }
    current.lastAudioTimeSec = input.frame.audioTime
    current.lastTrackIdentity = context.trackIdentity
  }

  for (const [key, record] of state.runtimes) {
    if (activeKeys.has(key)) continue
    disposeRuntime(record)
    state.runtimes.delete(key)
    state.failures.delete(key)
    clearTrail = true
  }
  for (const key of state.failures.keys()) {
    if (!activeKeys.has(key)) state.failures.delete(key)
  }

  if ((input.frame.analysisActive ?? input.frame.isPlaying) === false) {
    pauseLivingRibbonCanvasRuntimes(input.ownerContext)
  } else if (wasPaused) {
    resumeLivingRibbonCanvasRuntimes(input.ownerContext)
    for (const [key, record] of state.runtimes) {
      if (!activeKeys.has(key)) continue
      record.simulation.reconstructAtTime(
        input.frame.audioTime,
        `resume:${input.performance.context.trackIdentity ?? 'no-track'}:${input.frame.audioTime}`,
      )
      record.lastAudioTimeSec = input.frame.audioTime
    }
    clearTrail = true
  }

  return { activeRuntimeKeys: activeKeys, clearTrail, diagnostics, qualityBudget }
}

export interface RenderLivingRibbonCanvasLayerInput {
  ownerContext: CanvasRenderingContext2D
  targetContext: CanvasRenderingContext2D
  frame: ReactFrameContext
  preset: ReactPreset
  performance: SoundDrawingResolvedPerformanceFrame
  layer: SoundDrawingResolvedPerformanceLayer
  intensity: number
  glow: number
}

export interface RenderLivingRibbonCanvasLayerResult {
  rendered: boolean
  fallbackReason: string | null
  runtimeKey: string
}

export function renderLivingRibbonCanvasLayer(
  input: RenderLivingRibbonCanvasLayerInput,
): RenderLivingRibbonCanvasLayerResult {
  const key = layerRuntimeKey(input.performance, input.layer)
  const state = getOwnerState(input.ownerContext)
  const record = state.runtimes.get(key)
  if (!record) {
    const failure = state.failures.get(key)
    return {
      rendered: false,
      fallbackReason: failure?.message ?? 'Living Ribbon runtime is unavailable.',
      runtimeKey: key,
    }
  }

  let recoveryAttempted = false
  try {
    const finiteRepairsBefore = record.simulation.getDiagnostics().finiteRepairCount
    if ((input.frame.analysisActive ?? input.frame.isPlaying) !== false && !state.paused) {
      applyPhysicalImpulses(record, input.layer)
      const deltaTimeSec = finiteNumber(input.frame.deltaTimeSec, DEFAULT_FRAME_DELTA_SEC)
      record.simulation.update({ deltaTimeSec: Math.max(0, deltaTimeSec) })
    }
    const finiteRepairsAfter = record.simulation.getDiagnostics().finiteRepairCount
    if (finiteRepairsAfter > finiteRepairsBefore) {
      state.finiteRecoveryCount = incrementBounded(
        state.finiteRecoveryCount,
        finiteRepairsAfter - finiteRepairsBefore,
      )
    }
    let view = record.simulation.getRenderView()
    if (!isValidRenderView(view)) {
      recoveryAttempted = true
      const recovery = record.simulation.validateAndRepairState(`render-repair:${key}:${input.frame.audioTime}`)
      state.finiteRecoveryCount = incrementBounded(state.finiteRecoveryCount, recovery.issueCount || 1)
      view = record.simulation.getRenderView()
      if (!isValidRenderView(view)) {
        record.simulation.reconstructAtTime(input.frame.audioTime, `render-reset:${key}:${input.frame.audioTime}`)
        view = record.simulation.getRenderView()
      }
      if (!isValidRenderView(view)) throw new Error('simulation output remained invalid after bounded recovery')
    }
    const splineCount = projectAndSample(view, record, input.frame)
    if (splineCount < MIN_RENDER_POINTS) {
      throw new Error('projected spline contained insufficient geometry')
    }
    drawRibbonPasses(input.targetContext, input, record, splineCount)
    state.failures.delete(key)
    return { rendered: true, fallbackReason: null, runtimeKey: key }
  } catch (error) {
    const message = diagnosticMessage('rendering failed', error)
    if (!recoveryAttempted) state.finiteRecoveryCount = incrementBounded(state.finiteRecoveryCount)
    disposeRuntime(record)
    state.runtimes.delete(key)
    recordFailure(state, key, message)
    return { rendered: false, fallbackReason: message, runtimeKey: key }
  }
}

function applyPhysicalImpulses(record: LivingRibbonRuntimeRecord, layer: SoundDrawingResolvedPerformanceLayer): void {
  for (const impulse of layer.livingRibbonImpulses) {
    const input = {
      identity: impulse.identity,
      strength: clamp01(impulse.strength),
      direction: impulse.direction,
    }
    let applied = false
    switch (impulse.kind) {
      case 'radialImpact':
        applied = record.simulation.radialImpact(input)
        break
      case 'lateralShock':
        applied = record.simulation.lateralShock(input)
        break
      case 'fineRipple':
        applied = record.simulation.fineRipple(input)
        break
      case 'collapseImpulse':
        applied = record.simulation.collapseImpulse(input)
        break
      case 'releaseBurst':
        applied = record.simulation.releaseBurst(input)
        break
      case 'twistImpulse':
        applied = record.simulation.twistImpulse(input)
        break
      case 'localizedImpulse':
        applied = record.simulation.localizedImpulse({
          ...input,
          location: clamp01(impulse.location ?? 0.5),
          radius: clamp(impulse.radius ?? 0.15, 0.01, 1),
        })
        break
    }
    if (applied) {
      record.recentImpulses.push(`${impulse.kind}:${impulse.identity}`)
      if (record.recentImpulses.length > LIVING_RIBBON_MAX_RECENT_IMPULSES) {
        record.recentImpulses.splice(0, record.recentImpulses.length - LIVING_RIBBON_MAX_RECENT_IMPULSES)
      }
    }
  }
}

function isValidRenderView(view: LivingRibbonRenderView): boolean {
  if (view.activePointCount < MIN_RENDER_POINTS || view.activePointCount > MAX_RENDER_POINTS) return false
  const expectedLength = view.activePointCount * 3
  if (view.positions.length < expectedLength || view.previousPositions.length < expectedLength) return false
  for (let index = 0; index < expectedLength; index += 1) {
    if (!Number.isFinite(view.positions[index]) || !Number.isFinite(view.previousPositions[index])) return false
  }
  for (let index = 0; index < view.activePointCount; index += 1) {
    if (
      !Number.isFinite(view.widths[index]) ||
      !Number.isFinite(view.heat[index]) ||
      !Number.isFinite(view.speedMagnitudes[index])
    )
      return false
  }
  return Number.isFinite(view.interpolationAlpha) && view.boundarySize > 0
}

function projectAndSample(
  view: LivingRibbonRenderView,
  record: LivingRibbonRuntimeRecord,
  frame: ReactFrameContext,
): number {
  const count = Math.min(view.activePointCount, record.buffers.pointX.length)
  const alpha = clamp01(view.interpolationAlpha)
  const scale = (Math.min(frame.W, frame.H) * 0.38) / Math.max(0.5, view.boundarySize)
  const depthScale = scale * 0.18
  const centerX = frame.W * 0.5
  const centerY = frame.H * 0.5
  const buffers = record.buffers
  for (let index = 0; index < count; index += 1) {
    const offset = index * 3
    const x = lerp(view.previousPositions[offset], view.positions[offset], alpha)
    const y = lerp(view.previousPositions[offset + 1], view.positions[offset + 1], alpha)
    const z = lerp(view.previousPositions[offset + 2], view.positions[offset + 2], alpha)
    buffers.pointX[index] = centerX + x * scale + z * depthScale
    buffers.pointY[index] = centerY + y * scale - z * depthScale * 0.65
    buffers.pointWidth[index] = clamp(view.widths[index], 0.1, 2.75)
    buffers.pointHeat[index] = clamp01(view.heat[index])
    buffers.pointSpeed[index] = clamp(view.speedMagnitudes[index] / 5, 0, 1)
  }

  const subdivisions = record.budget.splineSubdivisions
  let cursor = 0
  for (let segment = 0; segment < count - 1; segment += 1) {
    const p0 = Math.max(0, segment - 1)
    const p1 = segment
    const p2 = segment + 1
    const p3 = Math.min(count - 1, segment + 2)
    for (let step = 0; step < subdivisions; step += 1) {
      const t = step / subdivisions
      buffers.splineX[cursor] = catmullRom(
        buffers.pointX[p0],
        buffers.pointX[p1],
        buffers.pointX[p2],
        buffers.pointX[p3],
        t,
      )
      buffers.splineY[cursor] = catmullRom(
        buffers.pointY[p0],
        buffers.pointY[p1],
        buffers.pointY[p2],
        buffers.pointY[p3],
        t,
      )
      buffers.splineWidth[cursor] = lerp(buffers.pointWidth[p1], buffers.pointWidth[p2], t)
      buffers.splineHeat[cursor] = lerp(buffers.pointHeat[p1], buffers.pointHeat[p2], t)
      buffers.splineSpeed[cursor] = lerp(buffers.pointSpeed[p1], buffers.pointSpeed[p2], t)
      cursor += 1
    }
  }
  buffers.splineX[cursor] = buffers.pointX[count - 1]
  buffers.splineY[cursor] = buffers.pointY[count - 1]
  buffers.splineWidth[cursor] = buffers.pointWidth[count - 1]
  buffers.splineHeat[cursor] = buffers.pointHeat[count - 1]
  buffers.splineSpeed[cursor] = buffers.pointSpeed[count - 1]
  return cursor + 1
}

function drawRibbonPasses(
  ctx: CanvasRenderingContext2D,
  input: RenderLivingRibbonCanvasLayerInput,
  record: LivingRibbonRuntimeRecord,
  splineCount: number,
): void {
  const palette = resolvePalette(record, input.preset)
  const buffers = record.buffers
  const dpr = Math.max(0.5, finiteNumber(input.frame.dpr, 1))
  let widthAverage = 0
  let heatAverage = 0
  let speedAverage = 0
  for (let index = 0; index < splineCount; index += 1) {
    widthAverage += buffers.splineWidth[index]
    heatAverage += buffers.splineHeat[index]
    speedAverage += buffers.splineSpeed[index]
  }
  widthAverage /= splineCount
  heatAverage /= splineCount
  speedAverage /= splineCount
  const intensity = clamp(input.intensity, 0, 1.4)
  const glow = clamp(input.glow, 0, 1.4)
  const baseWidth = clamp((2.2 + widthAverage * 5.6) * dpr, 1.25, 18)
  const brightness = clamp01(0.48 + heatAverage * 0.34 + speedAverage * 0.28)

  ctx.save()
  try {
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (let pass = record.budget.glowPasses - 1; pass >= 0; pass -= 1) {
      const passScale = 1 + pass * 0.48
      strokeSpline(ctx, buffers, splineCount, {
        width: baseWidth * (3.1 + passScale),
        style: palette.bloom,
        alpha: clamp(intensity * glow * (0.055 + pass * 0.025) * brightness, 0, 0.28),
        shadowBlur: Math.round((10 + pass * 8) * glow * dpr),
        shadowColor: palette.bloom,
      })
    }

    strokeSpline(ctx, buffers, splineCount, {
      width: baseWidth * 2.25,
      style: palette.outer,
      alpha: clamp(intensity * (0.34 + brightness * 0.24), 0, 0.9),
      shadowBlur: Math.round(8 * glow * dpr),
      shadowColor: palette.outer,
    })
    strokeSpline(ctx, buffers, splineCount, {
      width: baseWidth * 1.25,
      style: palette.inner,
      alpha: clamp(intensity * (0.5 + brightness * 0.28), 0, 1),
      shadowBlur: Math.round(4 * glow * dpr),
      shadowColor: palette.inner,
    })
    strokeSpline(ctx, buffers, splineCount, {
      width: Math.max(1, baseWidth * 0.42),
      style: palette.core,
      alpha: clamp(intensity * (0.64 + brightness * 0.34), 0, 1),
      shadowBlur: Math.round(2 * glow * dpr),
      shadowColor: palette.core,
    })

    drawHeatAccents(ctx, record, splineCount, palette.accent, baseWidth, intensity, dpr)
    drawRestrainedSparks(ctx, input, record, splineCount, palette.spark, baseWidth, intensity, dpr)
  } finally {
    ctx.restore()
  }
}

interface StrokeSplineOptions {
  width: number
  style: string
  alpha: number
  shadowBlur: number
  shadowColor: string
}

function strokeSpline(
  ctx: CanvasRenderingContext2D,
  buffers: LivingRibbonProjectedBuffers,
  count: number,
  options: StrokeSplineOptions,
): void {
  if (count < 2 || options.alpha <= 0.001) return
  ctx.beginPath()
  ctx.moveTo(buffers.splineX[0], buffers.splineY[0])
  for (let index = 1; index < count; index += 1) {
    ctx.lineTo(buffers.splineX[index], buffers.splineY[index])
  }
  ctx.lineWidth = options.width
  ctx.strokeStyle = options.style
  ctx.globalAlpha = options.alpha
  ctx.shadowBlur = options.shadowBlur
  ctx.shadowColor = options.shadowColor
  ctx.stroke()
}

function drawHeatAccents(
  ctx: CanvasRenderingContext2D,
  record: LivingRibbonRuntimeRecord,
  count: number,
  accent: string,
  baseWidth: number,
  intensity: number,
  dpr: number,
): void {
  const buffers = record.buffers
  const stride = record.budget.accentStride
  ctx.strokeStyle = accent
  ctx.shadowColor = accent
  for (let index = 1; index < count; index += stride) {
    const heat = clamp01(buffers.splineHeat[index] * 0.72 + buffers.splineSpeed[index] * 0.52)
    if (heat < 0.14) continue
    const previous = Math.max(0, index - stride)
    ctx.beginPath()
    ctx.moveTo(buffers.splineX[previous], buffers.splineY[previous])
    ctx.lineTo(buffers.splineX[index], buffers.splineY[index])
    ctx.lineWidth = Math.max(0.75 * dpr, baseWidth * (0.24 + heat * 0.38))
    ctx.globalAlpha = clamp(intensity * heat * 0.58, 0, 0.78)
    ctx.shadowBlur = Math.round((2 + heat * 8) * dpr)
    ctx.stroke()
  }
}

function drawRestrainedSparks(
  ctx: CanvasRenderingContext2D,
  input: RenderLivingRibbonCanvasLayerInput,
  record: LivingRibbonRuntimeRecord,
  count: number,
  sparkColor: string,
  baseWidth: number,
  intensity: number,
  dpr: number,
): void {
  if (record.budget.sparkCount <= 0 || count <= 2) return
  const buffers = record.buffers
  const view = record.simulation.getRenderView()
  const seed = view.baseSeed
  const presentationStep = Math.max(0, Math.floor(view.simulationTimeSec * 8))
  ctx.fillStyle = sparkColor
  ctx.shadowColor = sparkColor
  let drawn = 0
  for (
    let candidate = 0;
    candidate < record.budget.sparkCount * 2 && drawn < record.budget.sparkCount;
    candidate += 1
  ) {
    const unit = visualSimulationDeterministicUnit(seed ^ presentationStep, candidate + presentationStep * 17)
    const index = 1 + Math.floor(unit * Math.max(1, count - 2))
    const heat = clamp01(buffers.splineHeat[index] * 0.65 + buffers.splineSpeed[index] * 0.55)
    if (heat < 0.28) continue
    const sign = visualSimulationDeterministicUnit(seed, candidate + presentationStep * 11) >= 0.5 ? 1 : -1
    const previous = Math.max(0, index - 1)
    const next = Math.min(count - 1, index + 1)
    const tangentX = buffers.splineX[next] - buffers.splineX[previous]
    const tangentY = buffers.splineY[next] - buffers.splineY[previous]
    const tangentLength = Math.hypot(tangentX, tangentY) || 1
    const normalX = -tangentY / tangentLength
    const normalY = tangentX / tangentLength
    const offset = sign * baseWidth * (0.9 + heat * 1.6)
    const radius = Math.max(0.55 * dpr, baseWidth * (0.07 + heat * 0.05))
    ctx.beginPath()
    ctx.arc(
      buffers.splineX[index] + normalX * offset,
      buffers.splineY[index] + normalY * offset,
      radius,
      0,
      Math.PI * 2,
    )
    ctx.globalAlpha = clamp(intensity * heat * 0.42, 0, 0.62)
    ctx.shadowBlur = Math.round((3 + heat * 7) * dpr)
    ctx.fill()
    drawn += 1
  }
}

function resolvePalette(record: LivingRibbonRuntimeRecord, preset: ReactPreset): LivingRibbonPaletteCache {
  const key = [preset.palette.primary, preset.palette.secondary, preset.palette.accent, preset.palette.highlight].join(
    '|',
  )
  if (record.palette.key === key) return record.palette
  const primary = parseColor(preset.palette.primary)
  const secondary = parseColor(preset.palette.secondary)
  const accent = parseColor(preset.palette.accent)
  const highlight = parseColor(preset.palette.highlight)
  const white = { r: 255, g: 255, b: 255 }
  record.palette = {
    key,
    bloom: rgbCss(mixColor(secondary, accent, 0.42)),
    outer: rgbCss(mixColor(secondary, primary, 0.38)),
    inner: rgbCss(mixColor(primary, highlight, 0.22)),
    core: rgbCss(mixColor(highlight, white, 0.72)),
    accent: rgbCss(mixColor(accent, white, 0.38)),
    spark: rgbCss(mixColor(highlight, white, 0.86)),
  }
  return record.palette
}

function emptyPaletteCache(): LivingRibbonPaletteCache {
  return {
    key: '',
    bloom: '#ffffff',
    outer: '#ffffff',
    inner: '#ffffff',
    core: '#ffffff',
    accent: '#ffffff',
    spark: '#ffffff',
  }
}

interface RgbColor {
  r: number
  g: number
  b: number
}

function parseColor(value: string): RgbColor {
  const hex = value.trim().replace('#', '')
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    }
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    }
  }
  return { r: 255, g: 255, b: 255 }
}

function mixColor(a: RgbColor, b: RgbColor, amount: number): RgbColor {
  const t = clamp01(amount)
  return {
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t)),
  }
}

function rgbCss(color: RgbColor): string {
  return `rgb(${color.r},${color.g},${color.b})`
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

function diagnosticMessage(prefix: string, error: unknown): string {
  const detail = error instanceof Error && error.message ? error.message : String(error)
  return `Living Ribbon ${prefix}: ${detail}`
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, finiteNumber(value, minimum)))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function clampSigned(value: number): number {
  return clamp(value, -1, 1)
}

function lerp(a: number, b: number, amount: number): number {
  return a + (b - a) * amount
}

export function pauseLivingRibbonCanvasRuntimes(ownerContext: CanvasRenderingContext2D): void {
  const state = ownerStateMap.get(ownerContext)
  if (!state || state.paused) return
  state.paused = true
  for (const record of state.runtimes.values()) record.simulation.pause()
}

export function resumeLivingRibbonCanvasRuntimes(ownerContext: CanvasRenderingContext2D): void {
  const state = ownerStateMap.get(ownerContext)
  if (!state || !state.paused) return
  state.paused = false
  for (const record of state.runtimes.values()) record.simulation.resume()
}

export function disposeLivingRibbonCanvasRuntimes(ownerContext: CanvasRenderingContext2D): void {
  const state = ownerStateMap.get(ownerContext)
  if (!state) return
  for (const record of state.runtimes.values()) disposeRuntime(record)
  state.runtimes.clear()
  state.failures.clear()
  ownerStateMap.delete(ownerContext)
}

function fingerprintRenderView(view: LivingRibbonRenderView): string {
  let hash = 2166136261 >>> 0
  const length = Math.min(view.activePointCount * 3, view.positions.length)
  for (let index = 0; index < length; index += 1) {
    const quantized = Math.round(finiteNumber(view.positions[index], 0) * 1_000_000)
    hash ^= quantized
    hash = Math.imul(hash, 16777619) >>> 0
  }
  hash ^= Math.round(finiteNumber(view.simulationTimeSec, 0) * 1_000_000)
  return hash.toString(16).padStart(8, '0')
}

export interface LivingRibbonCanvasRuntimeDiagnostics {
  runtimeCount: number
  failureCount: number
  paused: boolean
  resetCount: number
  finiteRecoveryCount: number
  autoQuality: {
    resolvedQuality: Exclude<VisualSimulationQualityTier, 'auto'>
    rollingFrameTimeSec: number
    poorFrameCount: number
    goodFrameCount: number
    cooldownFrames: number
    transitionCount: number
  }
  runtimes: readonly {
    key: string
    identity: string
    requestedQuality: SoundDrawingVisualQuality
    resolvedQuality: Exclude<VisualSimulationQualityTier, 'auto'>
    pointCount: number
    structureRevision: number
    structuralSignature: string
    simulationTimeSec: number
    pointCapacity: number
    splineCapacity: number
    sparkCapacity: number
    rememberedImpulseCount: number
    maximumRememberedImpulses: number
    maximumSubsteps: number
    reconstructionCount: number
    lastReconstructionSteps: number
    lastReconstructionDurationSec: number
    deterministicResetCount: number
    stateFingerprint: string
    normalizedControls: LivingRibbonRuntimeControls
    recentImpulses: readonly string[]
  }[]
}

export function getLivingRibbonCanvasDiagnostics(
  ownerContext: CanvasRenderingContext2D,
): Readonly<LivingRibbonCanvasRuntimeDiagnostics> {
  const state = ownerStateMap.get(ownerContext)
  if (!state) {
    return {
      runtimeCount: 0,
      failureCount: 0,
      paused: false,
      resetCount: 0,
      finiteRecoveryCount: 0,
      autoQuality: {
        resolvedQuality: 'medium',
        rollingFrameTimeSec: DEFAULT_FRAME_DELTA_SEC,
        poorFrameCount: 0,
        goodFrameCount: 0,
        cooldownFrames: 0,
        transitionCount: 0,
      },
      runtimes: [],
    }
  }
  return {
    runtimeCount: state.runtimes.size,
    failureCount: state.failures.size,
    paused: state.paused,
    resetCount: state.resetCount,
    finiteRecoveryCount: state.finiteRecoveryCount,
    autoQuality: {
      resolvedQuality: state.autoQuality.resolved,
      rollingFrameTimeSec: state.autoQuality.rollingFrameTimeSec,
      poorFrameCount: state.autoQuality.poorFrameCount,
      goodFrameCount: state.autoQuality.goodFrameCount,
      cooldownFrames: state.autoQuality.cooldownFrames,
      transitionCount: state.autoQuality.transitionCount,
    },
    runtimes: [...state.runtimes.values()].map((record) => {
      const view = record.simulation.getRenderView()
      const simulationDiagnostics = record.simulation.getDiagnostics()
      return {
        key: record.key,
        identity: record.identity,
        requestedQuality: record.budget.requested,
        resolvedQuality: record.budget.resolved,
        pointCount: view.activePointCount,
        structureRevision: view.structureRevision,
        structuralSignature: view.structuralSignature,
        simulationTimeSec: view.simulationTimeSec,
        pointCapacity: simulationDiagnostics.pointCapacity,
        splineCapacity: record.buffers.splineX.length,
        sparkCapacity: record.budget.sparkCount,
        rememberedImpulseCount: simulationDiagnostics.rememberedImpulseCount,
        maximumRememberedImpulses: simulationDiagnostics.maximumRememberedImpulses,
        maximumSubsteps: simulationDiagnostics.maximumSubsteps,
        reconstructionCount: simulationDiagnostics.reconstructionCount,
        lastReconstructionSteps: simulationDiagnostics.lastReconstructionSteps,
        lastReconstructionDurationSec: simulationDiagnostics.lastReconstructionDurationSec,
        deterministicResetCount: simulationDiagnostics.deterministicResetCount,
        stateFingerprint: fingerprintRenderView(view),
        normalizedControls: { ...record.controls },
        recentImpulses: [...record.recentImpulses],
      }
    }),
  }
}

export function getLivingRibbonCanvasDiagnosticsForTests(
  ownerContext: CanvasRenderingContext2D,
): Readonly<LivingRibbonCanvasRuntimeDiagnostics> {
  return getLivingRibbonCanvasDiagnostics(ownerContext)
}

export function resetLivingRibbonCanvasRuntimes(
  ownerContext: CanvasRenderingContext2D,
  identity: string | number,
): number {
  const state = ownerStateMap.get(ownerContext)
  if (!state) return 0
  let reset = 0
  for (const record of state.runtimes.values()) {
    record.simulation.reconstructAtTime(record.lastAudioTimeSec, identity)
    record.recentImpulses = []
    reset += 1
  }
  state.failures.clear()
  if (reset > 0) state.resetCount = incrementBounded(state.resetCount)
  return reset
}

export function setLivingRibbonSimulationFactoryForTests(factory: (() => LivingRibbonSimulation) | null): void {
  simulationFactory = factory ?? (() => new LivingRibbonSimulation())
}
