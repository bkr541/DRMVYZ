import {
  cinema2StableId,
  type Cinema2ModuleTypeId,
  type Cinema2RenderQualityLevel,
} from '../contracts/Cinema2NativePresetManifest'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleDiagnostic,
  Cinema2ModuleRenderExecutionContext,
  Cinema2ModuleTypeDefinition,
  Cinema2ModuleUpdateContext,
} from './Cinema2ModuleContracts'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import {
  CINEMA2_AFTERHOURS_TRIGGER_IDS,
  resolveCinema2AfterhoursTriggerEventIdentity,
  type Cinema2AfterhoursTriggerId,
} from './Cinema2AfterhoursNativeModule'
import {
  CINEMA2_SAY_IT_MATERIAL_STYLES,
  Cinema2SayItBridge,
  type Cinema2SayItDrawState,
  type Cinema2SayItMaterialStyle,
} from './sayIt/Cinema2SayItBridge'
import {
  CINEMA2_SAY_IT_MOTION_DIRECTIONS,
  CINEMA2_SAY_IT_MOTION_PROGRAMS,
  CINEMA2_SAY_IT_MOTION_SAFETY_MODES,
  resolveCinema2SayItGlyphPoses,
  type Cinema2SayItMotionDirection,
  type Cinema2SayItMotionProgram,
  type Cinema2SayItMotionSafety,
} from './sayIt/Cinema2SayItMotion'
import {
  limitCinema2SayItPosesForQuality,
  resolveCinema2SayItQualityProfile,
  type Cinema2SayItQualityProfile,
} from './sayIt/Cinema2SayItQuality'
import {
  CINEMA2_SAY_IT_DEFAULT_PATTERN,
  Cinema2SayItPatternController,
  createCinema2SayItPatternCycle,
  isCinema2SayItPattern,
} from './sayIt/Cinema2SayItPatternController'
import {
  CINEMA2_SAY_IT_DEFAULT_TEXT,
  resolveCinema2SayItTextLayout,
  type Cinema2SayItAlignment,
  type Cinema2SayItTextLayout,
} from './sayIt/Cinema2SayItTextLayout'
import { Cinema2ThreeAssetCache, Cinema2ThreeAssetError, type Cinema2ThreeLoadedAsset } from './three/Cinema2ThreeAssetCache'
import { CINEMA2_SAY_IT_GLYPH_ASSET_ID, cinema2ThreeAssetRegistry } from './three/Cinema2ThreeAssetManifest'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'

export const CINEMA2_SAY_IT_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('say-it-native')
export const CINEMA2_SAY_IT_MODULE_VERSION = 1 as const

export type Cinema2SayItModuleState = 'idle' | 'loading' | 'building' | 'prewarming' | 'ready' | 'failed'

export interface Cinema2SayItPerformanceInspection {
  libraryLoadMs: number | null
  assetDecodeMs: number | null
  prewarmMs: number | null
  firstVisibleFrameMs: number | null
  lastDrawMs: number | null
  averageDrawMs: number | null
  maximumDrawMs: number | null
  drawSampleCount: number
  estimatedGpuBytes: number
}

export interface Cinema2SayItModuleInspection {
  state: Cinema2SayItModuleState
  assetLoaded: boolean
  text: string
  lineCount: number
  visibleGlyphCount: number
  renderedGlyphCount: number
  quality: Cinema2RenderQualityLevel | null
  motionProgram: Cinema2SayItMotionProgram
  motionSafety: Cinema2SayItMotionSafety
  materialStyle: Cinema2SayItMaterialStyle
  truncated: boolean
  replacementCount: number
  performance: Readonly<Cinema2SayItPerformanceInspection>
}

interface Cinema2SayItBridgeRuntime {
  prewarm(exec: Cinema2ModuleRenderExecutionContext, state: Readonly<Cinema2SayItDrawState>, profile: Readonly<Cinema2SayItQualityProfile>): boolean
  draw(exec: Cinema2ModuleRenderExecutionContext, state: Readonly<Cinema2SayItDrawState>, profile: Readonly<Cinema2SayItQualityProfile>): void
  estimateGpuBytes(): number
  dispose(): void
}

interface Cinema2SayItAssetCache {
  acquire(library: Cinema2ThreeLibrary, id: string, quality: Cinema2RenderQualityLevel): Promise<Cinema2ThreeLoadedAsset>
  release(asset: Cinema2ThreeLoadedAsset): void
}

const defaultAssetCache = new Cinema2ThreeAssetCache(cinema2ThreeAssetRegistry)

/**
 * Native kinetic-type module backed by a versioned printable-Basic-Latin glyph
 * package. Text layout is pure and bounded; only visible glyphs are instanced.
 */
export function createCinema2SayItNativeModuleDefinition(options: {
  assets?: Cinema2SayItAssetCache
  loadLibrary?: () => Promise<Cinema2ThreeLibrary>
  createBridge?: (gl: WebGL2RenderingContext, library: Cinema2ThreeLibrary, asset: Readonly<Cinema2ThreeLoadedAsset>) => Cinema2SayItBridgeRuntime
  now?: () => number
} = {}): Readonly<Cinema2ModuleTypeDefinition> {
  const assets = options.assets ?? defaultAssetCache
  const loadLibrary = options.loadLibrary ?? loadCinema2ThreeLibrary
  const createBridge = options.createBridge ?? ((gl, library, asset) => new Cinema2SayItBridge(gl, library, asset))
  const now = options.now ?? (() => performance.now())

  return Object.freeze({
    typeId: CINEMA2_SAY_IT_MODULE_TYPE_ID,
    version: CINEMA2_SAY_IT_MODULE_VERSION,
    create(context: Cinema2ModuleCreateContext) {
      let state: Cinema2SayItModuleState = 'idle'
      let disposed = false
      const createdAtMs = now()
      let bridge: Cinema2SayItBridgeRuntime | null = null
      let bridgeCreateFailed = false
      let library: Cinema2ThreeLibrary | null = null
      let asset: Cinema2ThreeLoadedAsset | null = null
      let reportedBytes = -1
      let renderedGlyphCount = 0
      let resolvedQuality: Cinema2RenderQualityLevel | null = null
      let qualityDiagnostic: Cinema2ModuleDiagnostic | null = null
      let memoryDiagnostic: Cinema2ModuleDiagnostic | null = null
      let performanceDiagnostic: Cinema2ModuleDiagnostic | null = null
      let libraryLoadMs: number | null = null
      let assetDecodeMs: number | null = null
      let prewarmMs: number | null = null
      let firstVisibleFrameMs: number | null = null
      let lastDrawMs: number | null = null
      let averageDrawMs: number | null = null
      let maximumDrawMs: number | null = null
      let drawSampleCount = 0
      let motionProgram: Cinema2SayItMotionProgram = 'tumble'
      let motionSafety: Cinema2SayItMotionSafety = 'full'
      let materialStyle: Cinema2SayItMaterialStyle = 'chrome'
      let layout: Readonly<Cinema2SayItTextLayout> = resolveCinema2SayItTextLayout({ line1: CINEMA2_SAY_IT_DEFAULT_TEXT, line2: '' }, {
        alignment: 'center', lineMode: 'two', tracking: 0.06, lineSpacing: 0.7, glyphScale: 1,
      })
      let layoutKey = ''
      const patternController = new Cinema2SayItPatternController(
        createCinema2SayItPatternCycle(index => typeof context.randomness.sample === 'function'
          ? context.randomness.sample('say-it-pattern-cycle', index)
          : ((index + 1) * 0.38196601125) % 1),
      )
      let triggerPreviousTimeSec: number | null = null
      let triggerPreviousBeat: number | null = null
      let triggerSourceIdentity: string | null = null
      let triggerContextGeneration: number | null = null
      let drawState: Readonly<Cinema2SayItDrawState> = Object.freeze({
        poses: resolveCinema2SayItGlyphPoses(0, { cycleSeconds: 8, motionAmount: 1, spread: 1, program: motionProgram }, layout.glyphs),
        color: Object.freeze([0.82, 0.84, 0.88] as const),
        ledOutlineEnabled: true,
        outlineColor: Object.freeze([0.16, 0.92, 1] as const),
        pattern: CINEMA2_SAY_IT_DEFAULT_PATTERN,
        patternPhaseBeats: 0,
        ledMusicIntensity: 1,
        roughness: 0.16,
        environmentIntensity: 1.25,
        environmentRotationRadians: 0,
        materialStyle,
      })
      const beatClock = new Cinema2BeatClock()
      const diagnostics: Cinema2ModuleDiagnostic[] = []
      let contentDiagnostics: Cinema2ModuleDiagnostic[] = []

      const report = (code: string, message: string) => {
        if (!diagnostics.some(entry => entry.code === code && entry.message === message)) {
          diagnostics.push({ code, message, path: `module.${context.module.id}` })
        }
      }

      const releaseAsset = () => {
        if (!asset) return
        assets.release(asset)
        asset = null
      }

      const startLoading = (quality: Cinema2RenderQualityLevel) => {
        state = 'loading'
        void (async () => {
          try {
            const libraryStartedAt = now()
            library = await loadLibrary()
            libraryLoadMs = elapsedMilliseconds(libraryStartedAt, now())
            const assetStartedAt = now()
            const loaded = await assets.acquire(library, CINEMA2_SAY_IT_GLYPH_ASSET_ID, quality)
            assetDecodeMs = elapsedMilliseconds(assetStartedAt, now())
            if (disposed) { assets.release(loaded); return }
            asset = loaded
            state = 'building'
          } catch (error) {
            if (disposed) return
            state = 'failed'
            report(
              error instanceof Cinema2ThreeAssetError ? error.code : 'CINEMA2_SAY_IT_LOAD_FAILED',
              `SAY IT could not load its production glyph package: ${message(error)}`,
            )
          }
        })()
      }

      const buildBridge = () => {
        if (!library || !asset) return
        try {
          bridge = context.resources.acquire(
            'say-it:bridge',
            'SayItBridge',
            gl => createBridge(gl, library!, asset!),
            value => { value.dispose(); releaseAsset() },
          )
          state = 'prewarming'
        } catch (error) {
          bridgeCreateFailed = true
          state = 'failed'
          report('CINEMA2_SAY_IT_BUILD_FAILED', `SAY IT could not build its 3D scene: ${message(error)}`)
          releaseAsset()
        }
      }

      const reportGpuBytes = (bytes: number, profile: Readonly<Cinema2SayItQualityProfile>) => {
        if (bytes !== reportedBytes) { reportedBytes = bytes; context.resources.reportGpuBytes(bytes) }
        memoryDiagnostic = bytes > profile.gpuBudgetBytes
          ? {
              code: 'CINEMA2_SAY_IT_GPU_BUDGET_EXCEEDED',
              message: `SAY IT estimates ${formatMegabytes(bytes)} MB of GPU memory, above the ${formatMegabytes(profile.gpuBudgetBytes)} MB ${profile.quality}-quality budget.`,
              path: `module.${context.module.id}.resources`,
            }
          : null
      }

      const provider = Object.freeze({
        id: `${context.module.id}:say-it`,
        moduleId: context.module.id,
        intent: 'world' as const,
        execute(execution: Cinema2ModuleRenderExecutionContext) {
          const quality = execution.lightingEnvironment?.quality ?? 'high'
          resolvedQuality = quality
          if (state === 'idle') startLoading(quality)
          if (state === 'building' && !bridge && !bridgeCreateFailed) buildBridge()
          if (!bridge || (state !== 'prewarming' && state !== 'ready')) return

          const profile = resolveCinema2SayItQualityProfile(quality)
          const poses = limitCinema2SayItPosesForQuality(drawState.poses, profile)
          const qualityDrawState: Readonly<Cinema2SayItDrawState> = poses === drawState.poses
            ? drawState
            : Object.freeze({ ...drawState, poses })
          renderedGlyphCount = poses.length
          const omittedGlyphs = drawState.poses.length - poses.length
          qualityDiagnostic = omittedGlyphs > 0
            ? {
                code: 'CINEMA2_SAY_IT_QUALITY_GLYPH_BUDGET',
                message: `SAY IT ${quality} quality draws ${profile.maxVisibleGlyphs} glyphs; ${omittedGlyphs} trailing glyph${omittedGlyphs === 1 ? ' was' : 's were'} omitted. Choose a higher quality tier to draw the complete message.`,
                path: `module.${context.module.id}.quality`,
              }
            : null

          const prewarmStartedAt = now()
          if (!bridge.prewarm(execution, qualityDrawState, profile)) {
            prewarmMs = elapsedMilliseconds(prewarmStartedAt, now())
            state = 'prewarming'
            const bytes = bridge.estimateGpuBytes()
            reportGpuBytes(bytes, profile)
            return
          }

          state = 'ready'
          const drawStartedAt = now()
          bridge.draw(execution, qualityDrawState, profile)
          const drawMs = elapsedMilliseconds(drawStartedAt, now())
          lastDrawMs = drawMs
          drawSampleCount += 1
          averageDrawMs = averageDrawMs == null ? drawMs : averageDrawMs + (drawMs - averageDrawMs) / drawSampleCount
          maximumDrawMs = maximumDrawMs == null ? drawMs : Math.max(maximumDrawMs, drawMs)
          performanceDiagnostic = drawSampleCount >= 30 && averageDrawMs > profile.frameBudgetMs
            ? {
                code: 'CINEMA2_SAY_IT_FRAME_BUDGET_EXCEEDED',
                message: `SAY IT averages ${averageDrawMs.toFixed(2)} ms of module draw time, above the ${profile.frameBudgetMs.toFixed(2)} ms ${quality}-quality budget.`,
                path: `module.${context.module.id}.performance`,
              }
            : null
          if (firstVisibleFrameMs == null) firstVisibleFrameMs = elapsedMilliseconds(createdAtMs, now())
          const bytes = bridge.estimateGpuBytes()
          reportGpuBytes(bytes, profile)
        },
      })

      return {
        lifecycle: {
          update: ({ frame, parameters }: Cinema2ModuleUpdateContext) => {
            const sync = parameters.get('bpmSync') !== false
            const triggerTimeSec = frame.audio?.upstream.timeSec ?? Math.max(0, frame.elapsedTimeSec)
            const sourceIdentity = [
              frame.transport?.trackId ?? frame.audio?.upstream.trackId ?? '',
              frame.audio?.upstream.sourceId ?? '',
              frame.audio?.upstream.publisherId ?? '',
            ].join(':')
            const discontinuity = triggerPreviousTimeSec != null && (
              triggerTimeSec < triggerPreviousTimeSec - 0.05
              || triggerTimeSec - triggerPreviousTimeSec > Math.max(1, frame.deltaTimeSec * 6)
            )
            const triggerReset = (triggerSourceIdentity != null && sourceIdentity !== triggerSourceIdentity)
              || (triggerContextGeneration != null && frame.contextGeneration !== triggerContextGeneration)
              || discontinuity
            if (triggerReset) beatClock.reset()
            const beatState = beatClock.update(frame, sync)
            // At the 120-BPM reference, two beats are one second. With Sync on,
            // the same authored cycle follows the detected track tempo.
            const timeSeconds = beatState.beats / 2
            const cycleSeconds = readNumber(parameters.get('cycleSeconds'), 2, 60) ?? 8
            const authoredMotionAmount = readNumber(parameters.get('motionAmount'), 0, 1) ?? 1
            const authoredSpread = readNumber(parameters.get('spread'), 0, 3) ?? 1
            motionProgram = readEnum(parameters.get('motionProgram'), CINEMA2_SAY_IT_MOTION_PROGRAMS, 'tumble')
            const motionDirection = readEnum(parameters.get('motionDirection'), CINEMA2_SAY_IT_MOTION_DIRECTIONS, 'alternate') as Cinema2SayItMotionDirection
            motionSafety = readEnum(parameters.get('motionSafety'), CINEMA2_SAY_IT_MOTION_SAFETY_MODES, 'full')
            const glyphDelay = readNumber(parameters.get('glyphDelay'), 0, 0.02) ?? 0.004
            const axisWeights = Object.freeze([
              readNumber(parameters.get('axisX'), 0, 1) ?? 1,
              readNumber(parameters.get('axisY'), 0, 1) ?? 1,
              readNumber(parameters.get('axisZ'), 0, 1) ?? 1,
            ] as const)
            const randomSeed = readNumber(parameters.get('randomSeed'), 0, 9999) ?? 7
            const beatAccent = readNumber(parameters.get('beatAccent'), 0, 1) ?? 0
            const downbeatAccent = readNumber(parameters.get('downbeatAccent'), 0, 1) ?? 0
            const phraseAccent = readNumber(parameters.get('phraseAccent'), 0, 1) ?? 0
            const buildAmount = readNumber(parameters.get('buildAmount'), 0, 1) ?? 0
            const dropAccent = readNumber(parameters.get('dropAccent'), 0, 1) ?? 0
            const ledKick = readNumber(parameters.get('ledKick'), 0, 1) ?? 0
            const ledSnare = readNumber(parameters.get('ledSnare'), 0, 1) ?? 0
            const ledTransient = readNumber(parameters.get('ledTransient'), 0, 1) ?? 0
            const overallEnergy = readAudioSignal(frame.audio?.features.overallEnergy)
            const bassEnergy = readAudioSignal(frame.audio?.bands.bass)
            const performanceDrive = 1 + beatAccent * 0.08 + downbeatAccent * 0.14 + phraseAccent * 0.1 + buildAmount * 0.18 + dropAccent * 0.32
            const motionAmount = Math.min(1, authoredMotionAmount * performanceDrive)
            const spread = Math.min(3, authoredSpread * (1 + buildAmount * 0.12 + dropAccent * 0.24))
            const authoredLine1 = parameters.get('line1Text')
            const authoredLine2 = parameters.get('line2Text')
            const line1Text = typeof authoredLine1 === 'string' ? authoredLine1 : CINEMA2_SAY_IT_DEFAULT_TEXT
            const line2Text = typeof authoredLine2 === 'string' ? authoredLine2 : ''
            const alignment = readAlignment(parameters.get('alignment'))
            const lineMode = parameters.get('lineMode') === 'one' ? 'one' as const : 'two' as const
            const tracking = readNumber(parameters.get('tracking'), -0.15, 0.5) ?? 0.06
            const lineSpacing = readNumber(parameters.get('lineSpacing'), 0.55, 1.2) ?? 0.7
            const glyphScale = readNumber(parameters.get('glyphScale'), 0.35, 1.5) ?? 1
            const nextLayoutKey = JSON.stringify([line1Text, line2Text, alignment, lineMode, tracking, lineSpacing, glyphScale])
            if (nextLayoutKey !== layoutKey) {
              layoutKey = nextLayoutKey
              layout = resolveCinema2SayItTextLayout({ line1: line1Text, line2: line2Text }, { alignment, lineMode, tracking, lineSpacing, glyphScale })
              contentDiagnostics = []
              if (layout.truncated) contentDiagnostics.push({
                code: 'CINEMA2_SAY_IT_TEXT_TRUNCATED',
                message: lineMode === 'one'
                  ? 'SAY IT limited Line 1 to 12 characters.'
                  : 'SAY IT limited the text to 12 characters per line and 20 characters total.',
                path: `module.${context.module.id}.parameters`,
              })
              if (layout.replacementCount > 0) contentDiagnostics.push({
                code: 'CINEMA2_SAY_IT_UNSUPPORTED_CHARACTERS',
                message: `SAY IT replaced ${layout.replacementCount} unsupported character${layout.replacementCount === 1 ? '' : 's'} with ?; the preset supports printable Basic Latin.`,
                path: `module.${context.module.id}.parameters`,
              })
            }
            const color = readColor(parameters.get('color')) ?? [0.82, 0.84, 0.88]
            const ledOutlineEnabled = parameters.get('ledOutline') !== false
            const outlineColor = readColor(parameters.get('outlineColor')) ?? [0.16, 0.92, 1]
            const authoredPatternValue = parameters.get('pattern')
            const authoredPattern = isCinema2SayItPattern(authoredPatternValue) ? authoredPatternValue : CINEMA2_SAY_IT_DEFAULT_PATTERN
            const patternChange = parameters.get('patternChange') === true
            const triggerValue = parameters.get('trigger')
            const trigger = isSayItTrigger(triggerValue) ? triggerValue : 'bar4'
            const triggerEventId = triggerReset ? null : resolveSayItTriggerEventIdentity(
              frame, trigger, triggerPreviousTimeSec, triggerPreviousBeat, beatState.beats,
            )
            const patternSelection = patternController.update({
              authoredPattern,
              patternChange,
              trigger,
              triggerEventId,
              absoluteBeat: beatState.beats,
              reset: triggerReset,
            })
            const roughness = readNumber(parameters.get('roughness'), 0.04, 1) ?? 0.16
            const environmentIntensity = readNumber(parameters.get('environmentIntensity'), 0, 4) ?? 1.25
            const highlightSweep = readNumber(parameters.get('highlightSweep'), 0, 2) ?? 0.65
            materialStyle = readEnum(parameters.get('materialStyle'), CINEMA2_SAY_IT_MATERIAL_STYLES, 'chrome')
            drawState = Object.freeze({
              poses: resolveCinema2SayItGlyphPoses(timeSeconds, {
                cycleSeconds,
                motionAmount,
                spread,
                program: motionProgram,
                glyphDelay,
                direction: motionDirection,
                axisWeights,
                randomSeed,
                safety: motionSafety,
              }, layout.glyphs),
              color: Object.freeze(color),
              ledOutlineEnabled,
              outlineColor: Object.freeze(outlineColor),
              pattern: patternSelection.activePattern,
              patternPhaseBeats: Math.max(0, beatState.beats - patternSelection.patternStartBeat),
              ledMusicIntensity: Math.min(3, 1
                + overallEnergy * 0.65 + bassEnergy * 0.35
                + beatAccent * 0.28 + downbeatAccent * 0.5 + phraseAccent * 0.35
                + buildAmount * 0.45 + dropAccent * 0.9
                + ledKick * 0.72 + ledSnare * 0.5 + ledTransient * 0.38),
              roughness,
              environmentIntensity,
              environmentRotationRadians: timeSeconds * highlightSweep * 0.7,
              materialStyle,
            })
            triggerPreviousTimeSec = triggerTimeSec
            triggerPreviousBeat = beatState.beats
            triggerSourceIdentity = sourceIdentity
            triggerContextGeneration = frame.contextGeneration
          },
          dispose: () => {
            disposed = true
            beatClock.reset()
            // When a bridge exists, the engine-owned resource disposer releases
            // the asset after disposing its material instances.
            if (!bridge) releaseAsset()
          },
        },
        render: { providers: Object.freeze([provider]) },
        getDiagnostics: () => Object.freeze([
          ...diagnostics,
          ...contentDiagnostics,
          ...(qualityDiagnostic ? [qualityDiagnostic] : []),
          ...(memoryDiagnostic ? [memoryDiagnostic] : []),
          ...(performanceDiagnostic ? [performanceDiagnostic] : []),
        ]),
        inspect: (): Cinema2SayItModuleInspection => ({
          state,
          assetLoaded: asset != null,
          text: layout.text,
          lineCount: layout.lines.length,
          visibleGlyphCount: layout.glyphs.length,
          renderedGlyphCount,
          quality: resolvedQuality,
          motionProgram,
          motionSafety,
          materialStyle,
          truncated: layout.truncated,
          replacementCount: layout.replacementCount,
          performance: Object.freeze({
            libraryLoadMs,
            assetDecodeMs,
            prewarmMs,
            firstVisibleFrameMs,
            lastDrawMs,
            averageDrawMs,
            maximumDrawMs,
            drawSampleCount,
            estimatedGpuBytes: Math.max(0, reportedBytes),
          }),
        }),
      }
    },
  })
}

function isSayItTrigger(value: unknown): value is Cinema2AfterhoursTriggerId {
  return typeof value === 'string' && CINEMA2_AFTERHOURS_TRIGGER_IDS.includes(value as Cinema2AfterhoursTriggerId)
}

function resolveSayItTriggerEventIdentity(
  frame: Readonly<Cinema2ModuleUpdateContext['frame']>,
  trigger: Cinema2AfterhoursTriggerId,
  previousTimeSec: number | null,
  previousBeat: number | null,
  currentBeat: number,
): string | null {
  const canonical = resolveCinema2AfterhoursTriggerEventIdentity(frame, trigger, previousTimeSec)
  if (canonical || !frame.audio || previousBeat == null || currentBeat <= previousBeat
    || frame.transport?.sourcePresent === false || frame.transport?.paused === true || frame.transport?.playing === false) return canonical
  const interval = trigger === 'beat' ? 1 : trigger === 'beat2' ? 2 : trigger === 'beat4' ? 4
    : trigger === 'bar' ? 4 : trigger === 'bar4' ? 16 : trigger === 'bar8' ? 32
      : trigger === 'phrase' ? 16 : null
  if (interval == null) return null
  const previousBoundary = Math.floor((previousBeat + 1e-6) / interval)
  const currentBoundary = Math.floor((currentBeat + 1e-6) / interval)
  return currentBoundary > previousBoundary ? `say-it-timing:${interval}:${currentBoundary}` : null
}

export const cinema2SayItNativeModuleDefinition = createCinema2SayItNativeModuleDefinition()

function readNumber(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : null
}

function readColor(value: unknown): readonly [number, number, number] | null {
  return Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(component => typeof component === 'number' && Number.isFinite(component))
    ? [value[0] as number, value[1] as number, value[2] as number]
    : null
}

function readAudioSignal(signal: Readonly<{ available: boolean; value: number | null }> | undefined): number {
  return signal?.available && typeof signal.value === 'number' && Number.isFinite(signal.value)
    ? Math.min(1, Math.max(0, signal.value)) : 0
}

function readAlignment(value: unknown): Cinema2SayItAlignment {
  return value === 'left' || value === 'right' ? value : 'center'
}

function readEnum<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === 'string' && values.includes(value as T) ? value as T : fallback
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function elapsedMilliseconds(start: number, end: number): number {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.max(0, end - start)
}

function formatMegabytes(bytes: number): string {
  return (Math.max(0, bytes) / (1024 * 1024)).toFixed(1)
}
