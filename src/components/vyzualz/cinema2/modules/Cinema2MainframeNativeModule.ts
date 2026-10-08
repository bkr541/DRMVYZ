import {
  cinema2StableId,
  type Cinema2JsonObject,
  type Cinema2ModuleManifest,
  type Cinema2ModuleTypeId,
  type Cinema2RenderQualityLevel,
} from '../contracts/Cinema2NativePresetManifest'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleDiagnostic,
  Cinema2ModuleParameterReadFacet,
  Cinema2ModuleRenderExecutionContext,
  Cinema2ModuleTypeDefinition,
  Cinema2ModuleUpdateContext,
} from './Cinema2ModuleContracts'
import { CINEMA2_MAINFRAME_ASSET_ID, cinema2ThreeAssetRegistry } from './three/Cinema2ThreeAssetManifest'
import { Cinema2ThreeAssetCache, type Cinema2ThreeLoadedAsset } from './three/Cinema2ThreeAssetCache'
import {
  CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID,
  cinema2ThreeEnvironmentRegistry,
} from './three/Cinema2ThreeEnvironmentRegistry'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import {
  CINEMA2_THREE_DEFAULT_OVERRIDES,
  Cinema2ThreeSceneBridge,
  type Cinema2ThreeMaterialOverrides,
  type Cinema2ThreePartOverrides,
} from './three/Cinema2ThreeSceneBridge'
import {
  CINEMA2_MAINFRAME_DEFAULT_PATTERN,
  CINEMA2_MAINFRAME_PATTERN_IDS,
  Cinema2MainframeReactivityEngine,
  resolveCinema2MainframeBeatClock,
  resolveCinema2MainframeTimeSec,
  type Cinema2MainframeLightingFrame,
  type Cinema2MainframePatternId,
} from './mainframe/Cinema2MainframePatternEngine'
import {
  CINEMA2_MAINFRAME_TRIGGER_IDS,
  Cinema2MainframePatternController,
  createCinema2MainframePatternCycle,
  resolveCinema2MainframeTriggerEventIdentity,
  type Cinema2MainframePatternSelection,
  type Cinema2MainframeTriggerId,
} from './mainframe/Cinema2MainframePatternController'
import {
  resolveCinema2MainframeQualityProfile,
  type Cinema2MainframeQualityProfile,
} from './mainframe/Cinema2MainframeQuality'

export const CINEMA2_MAINFRAME_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('mainframe-native-render')
export const CINEMA2_MAINFRAME_NATIVE_MODULE_VERSION = 1 as const
export const CINEMA2_MAINFRAME_COMPOSITION_ASPECT = 16 / 9
/** Default crop beyond every Stage edge, leaving safe travel for later camera motion and zoom releases. */
export const CINEMA2_MAINFRAME_COVER_OVERSCAN = 1.12
/** The production GLB continues the authored wall this far in both axes. */
export const CINEMA2_MAINFRAME_MODEL_EXTENT_MULTIPLIER = 2.5
/** Deepest operator zoom-out supported by the extended physical wall. */
export const CINEMA2_MAINFRAME_MIN_SCALE = 0.45
export const CINEMA2_MAINFRAME_MAX_SCALE = 1.35

export const CINEMA2_MAINFRAME_PARTS = Object.freeze([
  'board', 'plates', 'recesses', 'circuitHousings', 'hardware', 'circuitCores', 'indicatorCores',
  'radarHardware', 'radarCores', 'chipHardware', 'chipCores', 'logoHousing', 'logoCore',
] as const)

export type Cinema2MainframeModuleState = 'idle' | 'loading' | 'building' | 'ready' | 'failed'

type Rgb = readonly [number, number, number]

export interface Cinema2MainframeStaticFrame {
  readonly intensity: number
  readonly bpmSync: boolean
  readonly pattern: Cinema2MainframePatternId
  readonly patternChange: boolean
  readonly trigger: Cinema2MainframeTriggerId
  readonly scale: number
  readonly colors: Readonly<{ logo: Rgb; circuits: Rgb; indicators: Rgb }>
  readonly visibility: Readonly<Record<string, boolean>>
  readonly overrides: Readonly<Cinema2ThreeMaterialOverrides>
}

/**
 * Cover-fits the authored 16:9 wall instead of containing it. Narrow Stages crop the sides;
 * wider Stages crop the top and bottom. The authored Scale remains an additional operator zoom.
 */
export function resolveCinema2MainframeCoverScale(width: number, height: number, scale = 1): number {
  const aspect = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? width / height
    : CINEMA2_MAINFRAME_COMPOSITION_ASPECT
  const operatorScale = Number.isFinite(scale) ? clamp(scale, CINEMA2_MAINFRAME_MIN_SCALE, CINEMA2_MAINFRAME_MAX_SCALE) : 1
  return operatorScale * CINEMA2_MAINFRAME_COVER_OVERSCAN * Math.max(1, aspect / CINEMA2_MAINFRAME_COMPOSITION_ASPECT)
}

const assets = new Cinema2ThreeAssetCache(cinema2ThreeAssetRegistry)
const DEFAULT_BACKGROUND: Rgb = [0.018, 0.028, 0.022]
const DEFAULT_LOGO: Rgb = [0.3, 1, 0.18]
const DEFAULT_CIRCUITS: Rgb = [0.24, 1, 0.12]
const DEFAULT_INDICATORS: Rgb = [0.4, 1, 0.22]

const BASE_COLORS: Readonly<Record<string, Rgb>> = Object.freeze({
  board: [0.018, 0.026, 0.021],
  plates: [0.055, 0.068, 0.06],
  recesses: [0.006, 0.009, 0.007],
  circuitHousings: [0.19, 0.23, 0.205],
  hardware: [0.34, 0.38, 0.35],
  circuitCores: [0.08, 0.36, 0.045],
  indicatorCores: [0.22, 0.62, 0.12],
  radarHardware: [0.24, 0.28, 0.25],
  radarCores: [0.16, 0.52, 0.09],
  chipHardware: [0.09, 0.105, 0.095],
  chipCores: [0.12, 0.45, 0.07],
  logoHousing: [0.49, 0.54, 0.5],
  logoCore: [0.18, 0.62, 0.1],
})

const EMPTY_PART: Readonly<Cinema2ThreePartOverrides> = Object.freeze({
  color: null,
  emissive: null,
  emissiveIntensity: null,
  roughness: null,
  metalness: null,
  clearcoat: null,
  clearcoatRoughness: null,
  iridescence: null,
  iridescenceIOR: null,
  iridescenceThicknessMin: null,
  iridescenceThicknessMax: null,
  transmission: null,
  ior: null,
  thickness: null,
  dispersion: null,
  environmentIntensity: null,
})

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function readNumber(parameters: Cinema2ModuleParameterReadFacet, name: string, fallback: number, min: number, max: number): number {
  const value = parameters.get(name)
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback
}

function readBoolean(parameters: Cinema2ModuleParameterReadFacet, name: string, fallback: boolean): boolean {
  const value = parameters.get(name)
  return typeof value === 'boolean' ? value : fallback
}

function readColor(parameters: Cinema2ModuleParameterReadFacet, name: string, fallback: Rgb): Rgb {
  const value = parameters.get(name)
  if (!Array.isArray(value) || value.length < 3 || value.slice(0, 3).some(component => typeof component !== 'number' || !Number.isFinite(component))) return fallback
  return [clamp(value[0] as number, 0, 1), clamp(value[1] as number, 0, 1), clamp(value[2] as number, 0, 1)]
}

function scaled(color: Rgb, amount: number, lift = 0): Rgb {
  return [clamp(color[0] * amount + lift, 0, 1), clamp(color[1] * amount + lift, 0, 1), clamp(color[2] * amount + lift, 0, 1)]
}

/** Converts an absolute desired sRGB surface colour into the multiplier expected by the shared Three bridge. */
function colorMultiplier(part: string, target: Rgb): Rgb {
  const base = BASE_COLORS[part] ?? [1, 1, 1]
  return [target[0] / Math.max(base[0], 0.0001), target[1] / Math.max(base[1], 0.0001), target[2] / Math.max(base[2], 0.0001)]
}

function part(partName: string, target: Rgb, values: Partial<Cinema2ThreePartOverrides> = {}): Readonly<Cinema2ThreePartOverrides> {
  return Object.freeze({ ...EMPTY_PART, color: colorMultiplier(partName, target), ...values })
}

/** Resolves the persistent PBR look; Stage 4 lighting is layered separately through semantic GPU attributes. */
export function resolveCinema2MainframeStaticFrame(parameters: Cinema2ModuleParameterReadFacet): Readonly<Cinema2MainframeStaticFrame> {
  const intensity = readNumber(parameters, 'masterIntensity', 0.8, 0, 1)
  const bpmSync = readBoolean(parameters, 'bpmSync', true)
  const patternValue = parameters.get('pattern')
  const pattern = isMainframePattern(patternValue) ? patternValue : CINEMA2_MAINFRAME_DEFAULT_PATTERN
  const patternChange = readBoolean(parameters, 'patternChange', false)
  const triggerValue = parameters.get('trigger')
  const trigger = isMainframeTrigger(triggerValue) ? triggerValue : 'bar4'
  const scale = readNumber(parameters, 'scale', 1, CINEMA2_MAINFRAME_MIN_SCALE, CINEMA2_MAINFRAME_MAX_SCALE)
  const background = readColor(parameters, 'background', DEFAULT_BACKGROUND)
  const logo = readColor(parameters, 'logoColor', DEFAULT_LOGO)
  const circuits = readColor(parameters, 'circuitsColor', DEFAULT_CIRCUITS)
  const indicators = readColor(parameters, 'indicatorsColor', DEFAULT_INDICATORS)
  const radar = readBoolean(parameters, 'enableRadar', true)
  const chip = readBoolean(parameters, 'enableChip', true)

  const parts: Record<string, Readonly<Cinema2ThreePartOverrides>> = {
    board: part('board', background, { roughness: 0.74, metalness: 0.12, environmentIntensity: 0.22 }),
    plates: part('plates', scaled(background, 1.65, 0.018), { roughness: 0.46, metalness: 0.62, environmentIntensity: 0.38 }),
    recesses: part('recesses', scaled(background, 0.2), { roughness: 0.72, metalness: 0.12, environmentIntensity: 0.08 }),
    circuitHousings: part('circuitHousings', [0.075, 0.09, 0.08], { roughness: 0.3, metalness: 0.9, clearcoat: 0.12, clearcoatRoughness: 0.2, environmentIntensity: 0.42 }),
    hardware: part('hardware', [0.16, 0.18, 0.17], { roughness: 0.22, metalness: 0.98, clearcoat: 0.18, clearcoatRoughness: 0.12, environmentIntensity: 0.56 }),
    radarHardware: part('radarHardware', [0.14, 0.16, 0.145], { roughness: 0.24, metalness: 0.96, clearcoat: 0.16, clearcoatRoughness: 0.14, environmentIntensity: 0.52 }),
    chipHardware: part('chipHardware', [0.065, 0.075, 0.07], { roughness: 0.38, metalness: 0.7, clearcoat: 0.2, clearcoatRoughness: 0.2, environmentIntensity: 0.48 }),
    logoHousing: part('logoHousing', [0.3, 0.34, 0.31], { roughness: 0.22, metalness: 1, clearcoat: 0.28, clearcoatRoughness: 0.12, environmentIntensity: 0.68 }),
    circuitCores: part('circuitCores', scaled(circuits, 0.1), { emissive: circuits, emissiveIntensity: 2.8 * intensity, roughness: 0.26, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.12, environmentIntensity: 0.12 }),
    indicatorCores: part('indicatorCores', scaled(indicators, 0.12), { emissive: indicators, emissiveIntensity: 2.3 * intensity, roughness: 0.24, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.1, environmentIntensity: 0.12 }),
    radarCores: part('radarCores', scaled(indicators, 0.12), { emissive: indicators, emissiveIntensity: 2.5 * intensity, roughness: 0.22, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.1, environmentIntensity: 0.12 }),
    chipCores: part('chipCores', scaled(indicators, 0.12), { emissive: indicators, emissiveIntensity: 2.5 * intensity, roughness: 0.24, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.1, environmentIntensity: 0.12 }),
    logoCore: part('logoCore', scaled(logo, 0.13), { emissive: logo, emissiveIntensity: 3.4 * intensity, roughness: 0.18, metalness: 0.04, clearcoat: 0.3, clearcoatRoughness: 0.08, environmentIntensity: 0.18 }),
  }

  return Object.freeze({
    intensity,
    bpmSync,
    pattern,
    patternChange,
    trigger,
    scale,
    colors: Object.freeze({ logo, circuits, indicators }),
    visibility: Object.freeze({ radarHardware: radar, radarCores: radar, chipHardware: chip, chipCores: chip }),
    overrides: Object.freeze({
      ...CINEMA2_THREE_DEFAULT_OVERRIDES,
      environmentIntensity: 0.28,
      environmentRotation: -18,
      parts: Object.freeze(parts),
    }),
  })
}

function validateConfig(config: Cinema2JsonObject | undefined): readonly Cinema2ModuleDiagnostic[] {
  const diagnostics: Cinema2ModuleDiagnostic[] = []
  const asset = config?.asset
  if (asset !== CINEMA2_MAINFRAME_ASSET_ID) diagnostics.push({ code: 'CINEMA2_MAINFRAME_ASSET_REQUIRED', path: '$.config.asset', message: `Mainframe requires the shipped ${CINEMA2_MAINFRAME_ASSET_ID} model.` })
  const environment = config?.environment
  if (environment !== undefined && (typeof environment !== 'string' || cinema2ThreeEnvironmentRegistry.resolveUrl(environment, 'high') == null)) {
    diagnostics.push({ code: 'CINEMA2_MAINFRAME_ENVIRONMENT_UNKNOWN', path: '$.config.environment', message: 'Mainframe environment must reference a shipped Cinema 2.0 environment.' })
  }
  if (config?.pattern !== undefined && !isMainframePattern(config.pattern)) diagnostics.push({ code: 'CINEMA2_MAINFRAME_PATTERN_UNKNOWN', path: '$.config.pattern', message: 'Mainframe pattern must be one of the six shipped Stage 4 programs.' })
  return Object.freeze(diagnostics.map(diagnostic => Object.freeze(diagnostic)))
}

export const cinema2MainframeNativeModuleDefinition: Readonly<Cinema2ModuleTypeDefinition> = Object.freeze({
  typeId: CINEMA2_MAINFRAME_NATIVE_MODULE_TYPE_ID,
  version: CINEMA2_MAINFRAME_NATIVE_MODULE_VERSION,
  validate: (module: Readonly<Cinema2ModuleManifest>) => validateConfig(module.config),
  create(context: Cinema2ModuleCreateContext) {
    let state: Cinema2MainframeModuleState = 'idle'
    let disposed = false
    let library: Cinema2ThreeLibrary | null = null
    let held: Cinema2ThreeLoadedAsset | null = null
    let bridge: Cinema2ThreeSceneBridge | null = null
    let bridgeCreateFailed = false
    let frame = resolveCinema2MainframeStaticFrame(context.parameters)
    const reactivity = new Cinema2MainframeReactivityEngine()
    const patternController = new Cinema2MainframePatternController(
      createCinema2MainframePatternCycle(index => context.randomness.sample('mainframe-pattern-cycle', index)),
      frame.pattern,
    )
    let selection: Readonly<Cinema2MainframePatternSelection> = Object.freeze({ activePattern: frame.pattern, patternStartBeat: 0, changed: false })
    let lighting: Readonly<Cinema2MainframeLightingFrame> | null = null
    let triggerPreviousTimeSec: number | null = null
    let triggerTrackId: string | null | undefined
    let triggerContextGeneration: number | null = null
    let reportedBytes = -1
    let qualityProfile: Readonly<Cinema2MainframeQualityProfile> = resolveCinema2MainframeQualityProfile('high')
    const diagnostics: Cinema2ModuleDiagnostic[] = []
    const environmentId = typeof context.module.config?.environment === 'string'
      ? context.module.config.environment
      : CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID

    const report = (code: string, message: string, path: string) => {
      if (!diagnostics.some(existing => existing.code === code && existing.message === message)) diagnostics.push({ code, message, path })
    }

    const startLoading = (quality: Cinema2RenderQualityLevel) => {
      state = 'loading'
      void (async () => {
        try {
          const loadedLibrary = await loadCinema2ThreeLibrary()
          const asset = await assets.acquire(loadedLibrary, CINEMA2_MAINFRAME_ASSET_ID, quality)
          if (disposed) { assets.release(asset); return }
          library = loadedLibrary
          held = asset
          state = 'building'
        } catch (error) {
          if (!disposed) {
            state = 'failed'
            report('CINEMA2_MAINFRAME_ASSET_LOAD_FAILED', `Mainframe could not load its production model: ${error instanceof Error ? error.message : String(error)}`, '$.config.asset')
          }
        }
      })()
    }

    const buildBridge = () => {
      if (!library || !held) return
      try {
        const asset = held
        bridge = context.resources.acquire(
          'mainframe:three-bridge',
          'MainframeThreeSceneBridge',
          gl => new Cinema2ThreeSceneBridge(gl, library!, [{ asset, node: null }], {
            hdr: true,
            environmentUrl: quality => cinema2ThreeEnvironmentRegistry.resolveUrl(environmentId, quality),
            shadows: {
              cast: Object.freeze(['circuitHousings', 'hardware', 'radarHardware', 'chipHardware', 'logoHousing']),
              receive: Object.freeze(['board', 'plates', 'recesses', 'circuitHousings', 'logoHousing']),
            },
            mainframe: Object.freeze({
              circuitCores: 'circuit', indicatorCores: 'indicator', radarCores: 'radar',
              chipCores: 'chip', logoCore: 'logo',
            }),
          }),
          value => { value.dispose(); assets.release(asset) },
        )
      } catch (error) {
        bridgeCreateFailed = true
        state = 'failed'
        assets.release(held)
        held = null
        report('CINEMA2_MAINFRAME_SCENE_BUILD_FAILED', `Mainframe could not build its production scene: ${error instanceof Error ? error.message : String(error)}`, '$.config')
      }
    }

    const provider = Object.freeze({
      id: `${context.module.id}:mainframe`,
      moduleId: context.module.id,
      intent: 'world' as const,
      execute(execution: Cinema2ModuleRenderExecutionContext) {
        const quality = execution.lightingEnvironment?.quality ?? 'high'
        qualityProfile = resolveCinema2MainframeQualityProfile(quality)
        if (state === 'idle') startLoading(quality)
        if (state === 'building' && !bridge && !bridgeCreateFailed) buildBridge()
        if (!bridge || state === 'loading' || state === 'failed') return
        bridge.draw(execution, frame.overrides, 0, null, null, {
          scale: resolveCinema2MainframeCoverScale(execution.width, execution.height, frame.scale),
          parts: frame.visibility,
        }, lighting ? {
          circuitColor: frame.colors.circuits,
          indicatorColor: frame.colors.indicators,
          logoColor: frame.colors.logo,
          strength: frame.intensity,
          frame: lighting,
        } : null)
        if (bridge.ready) state = 'ready'
        const bytes = bridge.estimateGpuBytes()
        if (bytes !== reportedBytes) { reportedBytes = bytes; context.resources.reportGpuBytes(bytes) }
      },
    })

    return {
      lifecycle: {
        update: ({ parameters, frame: updateFrame }: Cinema2ModuleUpdateContext) => {
          frame = resolveCinema2MainframeStaticFrame(parameters)
          const timeSec = resolveCinema2MainframeTimeSec(updateFrame)
          const triggerReset = Boolean(updateFrame.audio?.discontinuity.occurred && updateFrame.audio.discontinuity.reason !== 'activation')
            || (triggerPreviousTimeSec != null && timeSec < triggerPreviousTimeSec - 1e-6)
            || (triggerTrackId !== undefined && updateFrame.transport?.trackId !== triggerTrackId)
            || (triggerContextGeneration != null && updateFrame.contextGeneration !== triggerContextGeneration)
          const triggerEventId = triggerReset
            ? null
            : resolveCinema2MainframeTriggerEventIdentity(updateFrame, frame.trigger, triggerPreviousTimeSec)
          selection = patternController.update({
            authoredPattern: frame.pattern,
            patternChange: frame.patternChange,
            trigger: frame.trigger,
            triggerEventId,
            absoluteBeat: resolveCinema2MainframeBeatClock(updateFrame, frame.bpmSync),
            reset: triggerReset,
          })
          lighting = reactivity.update(updateFrame, selection.activePattern, frame.bpmSync, selection.patternStartBeat)
          triggerPreviousTimeSec = timeSec
          triggerTrackId = updateFrame.transport?.trackId
          triggerContextGeneration = updateFrame.contextGeneration
        },
        dispose: () => {
          disposed = true
          reactivity.reset()
          patternController.reset()
          if (!bridge && held) { assets.release(held); held = null }
        },
      },
      render: { providers: Object.freeze([provider]) },
      getDiagnostics: () => Object.freeze([
        ...diagnostics,
        ...(bridge?.getDiagnostics().map(diagnostic => ({ ...diagnostic, path: '$.config.environment' })) ?? []),
      ]),
      inspect: () => Object.freeze({
        state,
        authoredPattern: frame.pattern,
        activePattern: selection.activePattern,
        patternChange: frame.patternChange,
        trigger: frame.trigger,
        patternStartBeat: selection.patternStartBeat,
        scale: frame.scale,
        intensity: frame.intensity,
        bpmSync: frame.bpmSync,
        visibility: frame.visibility,
        qualityProfile,
        lighting,
      }),
    }
  },
})

function isMainframePattern(value: unknown): value is Cinema2MainframePatternId {
  return typeof value === 'string' && CINEMA2_MAINFRAME_PATTERN_IDS.includes(value as Cinema2MainframePatternId)
}

function isMainframeTrigger(value: unknown): value is Cinema2MainframeTriggerId {
  return typeof value === 'string' && CINEMA2_MAINFRAME_TRIGGER_IDS.includes(value as Cinema2MainframeTriggerId)
}
