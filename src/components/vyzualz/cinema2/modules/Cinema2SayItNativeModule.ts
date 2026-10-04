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
import { Cinema2SayItBridge, type Cinema2SayItDrawState } from './sayIt/Cinema2SayItBridge'
import { resolveCinema2SayItGlyphPoses } from './sayIt/Cinema2SayItMotion'
import {
  limitCinema2SayItPosesForQuality,
  resolveCinema2SayItQualityProfile,
  type Cinema2SayItQualityProfile,
} from './sayIt/Cinema2SayItQuality'
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
      let libraryLoadMs: number | null = null
      let assetDecodeMs: number | null = null
      let prewarmMs: number | null = null
      let firstVisibleFrameMs: number | null = null
      let lastDrawMs: number | null = null
      let averageDrawMs: number | null = null
      let maximumDrawMs: number | null = null
      let drawSampleCount = 0
      let layout: Readonly<Cinema2SayItTextLayout> = resolveCinema2SayItTextLayout({ line1: CINEMA2_SAY_IT_DEFAULT_TEXT, line2: '' }, {
        alignment: 'center', lineMode: 'two', tracking: 0.06, lineSpacing: 0.7, glyphScale: 1,
      })
      let layoutKey = ''
      let drawState: Readonly<Cinema2SayItDrawState> = Object.freeze({
        poses: resolveCinema2SayItGlyphPoses(0, { cycleSeconds: 8, motionAmount: 1, spread: 1 }, layout.glyphs),
        color: Object.freeze([0.82, 0.84, 0.88] as const),
        roughness: 0.16,
        environmentIntensity: 1.25,
        environmentRotationRadians: 0,
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
          if (firstVisibleFrameMs == null) firstVisibleFrameMs = elapsedMilliseconds(createdAtMs, now())
          const bytes = bridge.estimateGpuBytes()
          reportGpuBytes(bytes, profile)
        },
      })

      return {
        lifecycle: {
          update: ({ frame, parameters }: Cinema2ModuleUpdateContext) => {
            const sync = parameters.get('bpmSync') !== false
            const beatState = beatClock.update(frame, sync)
            // At the 120-BPM reference, two beats are one second. With Sync on,
            // the same authored cycle follows the detected track tempo.
            const timeSeconds = beatState.beats / 2
            const cycleSeconds = readNumber(parameters.get('cycleSeconds'), 2, 60) ?? 8
            const motionAmount = readNumber(parameters.get('motionAmount'), 0, 1) ?? 1
            const spread = readNumber(parameters.get('spread'), 0, 3) ?? 1
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
            const roughness = readNumber(parameters.get('roughness'), 0.04, 1) ?? 0.16
            const environmentIntensity = readNumber(parameters.get('environmentIntensity'), 0, 4) ?? 1.25
            const highlightSweep = readNumber(parameters.get('highlightSweep'), 0, 2) ?? 0.65
            drawState = Object.freeze({
              poses: resolveCinema2SayItGlyphPoses(timeSeconds, { cycleSeconds, motionAmount, spread }, layout.glyphs),
              color: Object.freeze(color),
              roughness,
              environmentIntensity,
              environmentRotationRadians: timeSeconds * highlightSweep * 0.7,
            })
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
        ]),
        inspect: (): Cinema2SayItModuleInspection => ({
          state,
          assetLoaded: asset != null,
          text: layout.text,
          lineCount: layout.lines.length,
          visibleGlyphCount: layout.glyphs.length,
          renderedGlyphCount,
          quality: resolvedQuality,
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

export const cinema2SayItNativeModuleDefinition = createCinema2SayItNativeModuleDefinition()

function readNumber(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : null
}

function readColor(value: unknown): readonly [number, number, number] | null {
  return Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(component => typeof component === 'number' && Number.isFinite(component))
    ? [value[0] as number, value[1] as number, value[2] as number]
    : null
}

function readAlignment(value: unknown): Cinema2SayItAlignment {
  return value === 'left' || value === 'right' ? value : 'center'
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
