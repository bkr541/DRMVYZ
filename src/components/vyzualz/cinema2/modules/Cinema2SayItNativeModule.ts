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

export type Cinema2SayItModuleState = 'idle' | 'loading' | 'building' | 'ready' | 'failed'

export interface Cinema2SayItModuleInspection {
  state: Cinema2SayItModuleState
  assetLoaded: boolean
  text: string
  lineCount: number
  visibleGlyphCount: number
  truncated: boolean
  replacementCount: number
}

const defaultAssetCache = new Cinema2ThreeAssetCache(cinema2ThreeAssetRegistry)

/**
 * Native kinetic-type module backed by a versioned printable-Basic-Latin glyph
 * package. Text layout is pure and bounded; only visible glyphs are instanced.
 */
export function createCinema2SayItNativeModuleDefinition(options: {
  assets?: Cinema2ThreeAssetCache
  loadLibrary?: () => Promise<Cinema2ThreeLibrary>
} = {}): Readonly<Cinema2ModuleTypeDefinition> {
  const assets = options.assets ?? defaultAssetCache
  const loadLibrary = options.loadLibrary ?? loadCinema2ThreeLibrary

  return Object.freeze({
    typeId: CINEMA2_SAY_IT_MODULE_TYPE_ID,
    version: CINEMA2_SAY_IT_MODULE_VERSION,
    create(context: Cinema2ModuleCreateContext) {
      let state: Cinema2SayItModuleState = 'idle'
      let disposed = false
      let bridge: Cinema2SayItBridge | null = null
      let bridgeCreateFailed = false
      let library: Cinema2ThreeLibrary | null = null
      let asset: Cinema2ThreeLoadedAsset | null = null
      let reportedBytes = -1
      let layout: Readonly<Cinema2SayItTextLayout> = resolveCinema2SayItTextLayout(CINEMA2_SAY_IT_DEFAULT_TEXT, {
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
            library = await loadLibrary()
            const loaded = await assets.acquire(library, CINEMA2_SAY_IT_GLYPH_ASSET_ID, quality)
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
            gl => new Cinema2SayItBridge(gl, library!, asset!),
            value => { value.dispose(); releaseAsset() },
          )
          state = 'ready'
        } catch (error) {
          bridgeCreateFailed = true
          state = 'failed'
          report('CINEMA2_SAY_IT_BUILD_FAILED', `SAY IT could not build its 3D scene: ${message(error)}`)
          releaseAsset()
        }
      }

      const provider = Object.freeze({
        id: `${context.module.id}:say-it`,
        moduleId: context.module.id,
        intent: 'world' as const,
        execute(execution: Cinema2ModuleRenderExecutionContext) {
          const quality = execution.lightingEnvironment?.quality ?? 'high'
          if (state === 'idle') startLoading(quality)
          if (state === 'building' && !bridge && !bridgeCreateFailed) buildBridge()
          if (!bridge || state !== 'ready') return
          bridge.draw(execution, drawState)
          const bytes = bridge.estimateGpuBytes()
          if (bytes !== reportedBytes) { reportedBytes = bytes; context.resources.reportGpuBytes(bytes) }
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
            const authoredText = parameters.get('text')
            const text = typeof authoredText === 'string' ? authoredText : CINEMA2_SAY_IT_DEFAULT_TEXT
            const alignment = readAlignment(parameters.get('alignment'))
            const lineMode = parameters.get('lineMode') === 'one' ? 'one' as const : 'two' as const
            const tracking = readNumber(parameters.get('tracking'), -0.15, 0.5) ?? 0.06
            const lineSpacing = readNumber(parameters.get('lineSpacing'), 0.55, 1.2) ?? 0.7
            const glyphScale = readNumber(parameters.get('glyphScale'), 0.35, 1.5) ?? 1
            const nextLayoutKey = JSON.stringify([text, alignment, lineMode, tracking, lineSpacing, glyphScale])
            if (nextLayoutKey !== layoutKey) {
              layoutKey = nextLayoutKey
              layout = resolveCinema2SayItTextLayout(text, { alignment, lineMode, tracking, lineSpacing, glyphScale })
              contentDiagnostics = []
              if (layout.truncated) contentDiagnostics.push({
                code: 'CINEMA2_SAY_IT_TEXT_TRUNCATED',
                message: lineMode === 'one'
                  ? 'SAY IT limited the message to one line and 12 characters.'
                  : 'SAY IT limited the message to two lines, 12 characters per line and 20 characters total.',
                path: `module.${context.module.id}.parameters.text`,
              })
              if (layout.replacementCount > 0) contentDiagnostics.push({
                code: 'CINEMA2_SAY_IT_UNSUPPORTED_CHARACTERS',
                message: `SAY IT replaced ${layout.replacementCount} unsupported character${layout.replacementCount === 1 ? '' : 's'} with ?; the preset supports printable Basic Latin.`,
                path: `module.${context.module.id}.parameters.text`,
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
        getDiagnostics: () => Object.freeze([...diagnostics, ...contentDiagnostics]),
        inspect: (): Cinema2SayItModuleInspection => ({
          state,
          assetLoaded: asset != null,
          text: layout.text,
          lineCount: layout.lines.length,
          visibleGlyphCount: layout.glyphs.length,
          truncated: layout.truncated,
          replacementCount: layout.replacementCount,
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
