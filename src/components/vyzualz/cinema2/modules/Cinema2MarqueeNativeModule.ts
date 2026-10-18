import {
  cinema2StableId,
  type Cinema2JsonObject,
  type Cinema2ModuleManifest,
  type Cinema2ModuleTypeId,
  type Cinema2RenderQualityLevel,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2DispatchedTargetAction } from '../parameters/Cinema2TargetRuntime'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleDiagnostic,
  Cinema2ModuleParameterReadFacet,
  Cinema2ModuleRenderExecutionContext,
  Cinema2ModuleTypeDefinition,
  Cinema2ModuleUpdateContext,
} from './Cinema2ModuleContracts'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import { MARQUEE_LOOK } from './marquee/Cinema2MarqueeLook'
import { Cinema2MarqueeSceneController, type Cinema2MarqueeSceneFrame } from './marquee/Cinema2MarqueeSceneController'
import {
  CINEMA2_MARQUEE_DEFAULT_PATTERN,
  CINEMA2_MARQUEE_ZERO_IMPULSES,
  Cinema2MarqueePatternController,
  createCinema2MarqueePatternCycle,
  isCinema2MarqueePattern,
  isCinema2MarqueeTrigger,
  resolveCinema2MarqueeTriggerEventIdentity,
  type Cinema2MarqueeImpulses,
  type Cinema2MarqueePatternId,
  type Cinema2MarqueePerformanceFrame,
  type Cinema2MarqueeTriggerId,
} from './marquee/Cinema2MarqueeDomain'
import { Cinema2ThreeAssetCache, type Cinema2ThreeLoadedAsset } from './three/Cinema2ThreeAssetCache'
import { CINEMA2_MARQUEE_ASSET_ID, cinema2ThreeAssetRegistry } from './three/Cinema2ThreeAssetManifest'
import { CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID, cinema2ThreeEnvironmentRegistry } from './three/Cinema2ThreeEnvironmentRegistry'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import { CINEMA2_THREE_DEFAULT_OVERRIDES, Cinema2ThreeSceneBridge } from './three/Cinema2ThreeSceneBridge'

export const CINEMA2_MARQUEE_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('marquee-native-render')
export const CINEMA2_MARQUEE_NATIVE_MODULE_VERSION = 1 as const

type Rgb = readonly [number, number, number]
type CueKind = keyof Cinema2MarqueeImpulses

interface StaticFrame {
  readonly masterIntensity: number
  readonly bpmSync: boolean
  readonly autoPerformance: boolean
  readonly pattern: Cinema2MarqueePatternId
  readonly patternChange: boolean
  readonly trigger: Cinema2MarqueeTriggerId
  readonly text: Readonly<{ front: string; left: string; right: string }>
  readonly signIllumination: number
  readonly zoneIntensity: Readonly<Record<'marquee-front' | 'marquee-left' | 'marquee-right' | 'canopy' | 'tower-left' | 'tower-right' | 'led-left' | 'led-right' | 'neon-red' | 'neon-amber' | 'neon-blue' | 'crowd-flash', number>>
  readonly colors: Readonly<{ night: Rgb; marquee: Rgb; incandescent: Rgb; blue: Rgb; architecture: Rgb }>
  readonly reflection: number
}

const MARQUEE_OVERRIDES = Object.freeze({ ...CINEMA2_THREE_DEFAULT_OVERRIDES, environmentIntensity: MARQUEE_LOOK.environmentIntensity })
const assets = new Cinema2ThreeAssetCache(cinema2ThreeAssetRegistry)
const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))

function number(parameters: Cinema2ModuleParameterReadFacet, name: string, fallback: number): number {
  const value = parameters.get(name)
  return typeof value === 'number' && Number.isFinite(value) ? clamp01(value) : fallback
}

function bool(parameters: Cinema2ModuleParameterReadFacet, name: string, fallback: boolean): boolean {
  const value = parameters.get(name)
  return typeof value === 'boolean' ? value : fallback
}

function string(parameters: Cinema2ModuleParameterReadFacet, name: string, fallback: string): string {
  const value = parameters.get(name)
  return typeof value === 'string' ? value : fallback
}

function color(parameters: Cinema2ModuleParameterReadFacet, name: string, fallback: Rgb): Rgb {
  const value = parameters.get(name)
  if (!Array.isArray(value) || value.length < 3) return fallback
  const rgb = value.slice(0, 3)
  return rgb.every(component => typeof component === 'number' && Number.isFinite(component))
    ? [clamp01(rgb[0] as number), clamp01(rgb[1] as number), clamp01(rgb[2] as number)] : fallback
}

export function resolveCinema2MarqueeStaticFrame(parameters: Cinema2ModuleParameterReadFacet): Readonly<StaticFrame> {
  const pattern = parameters.get('pattern')
  const trigger = parameters.get('trigger')
  const front = number(parameters, 'frontIntensity', 1)
  const sides = number(parameters, 'sideIntensity', 0.86)
  const towers = number(parameters, 'towerIntensity', 0.82)
  const leds = number(parameters, 'entranceIntensity', 0.68)
  const neon = number(parameters, 'neonIntensity', 0.92)
  return Object.freeze({
    masterIntensity: number(parameters, 'masterIntensity', 0.9),
    bpmSync: bool(parameters, 'bpmSync', true),
    autoPerformance: bool(parameters, 'autoPerformance', true),
    pattern: isCinema2MarqueePattern(pattern) ? pattern : CINEMA2_MARQUEE_DEFAULT_PATTERN,
    patternChange: bool(parameters, 'patternChange', false),
    trigger: isCinema2MarqueeTrigger(trigger) ? trigger : 'bar4',
    text: Object.freeze({
      front: string(parameters, 'frontText', 'DVYDRM'),
      left: string(parameters, 'leftText', 'SHOWINGS'),
      right: string(parameters, 'rightText', 'SHOWINGS'),
    }),
    signIllumination: number(parameters, 'signIllumination', 0.78),
    zoneIntensity: Object.freeze({
      'marquee-front': front, 'marquee-left': sides, 'marquee-right': sides,
      canopy: number(parameters, 'canopyIntensity', 0.72),
      'tower-left': towers, 'tower-right': towers,
      'led-left': leds, 'led-right': leds,
      'neon-red': neon, 'neon-amber': neon, 'neon-blue': neon, 'crowd-flash': 1,
    }),
    colors: Object.freeze({
      night: color(parameters, 'nightColor', [0.012, 0.025, 0.034]),
      marquee: color(parameters, 'marqueeColor', [0.86, 0.035, 0.025]),
      incandescent: color(parameters, 'incandescentColor', [1, 0.55, 0.14]),
      blue: color(parameters, 'blueColor', [0.04, 0.38, 1]),
      architecture: color(parameters, 'architectureColor', [0.19, 0.11, 0.075]),
    }),
    reflection: number(parameters, 'reflection', 0.72),
  })
}

function signal(value: { available: boolean; value: number | null } | undefined): number {
  return value?.available && typeof value.value === 'number' ? clamp01(value.value) : 0
}

function validateConfig(config: Cinema2JsonObject | undefined): readonly Cinema2ModuleDiagnostic[] {
  return config?.asset === CINEMA2_MARQUEE_ASSET_ID ? Object.freeze([]) : Object.freeze([Object.freeze({
    code: 'CINEMA2_MARQUEE_ASSET_REQUIRED', path: '$.config.asset', message: `MARQUEE requires the shipped ${CINEMA2_MARQUEE_ASSET_ID} model.`,
  })])
}

export const cinema2MarqueeNativeModuleDefinition: Readonly<Cinema2ModuleTypeDefinition> = Object.freeze({
  typeId: CINEMA2_MARQUEE_NATIVE_MODULE_TYPE_ID,
  version: CINEMA2_MARQUEE_NATIVE_MODULE_VERSION,
  validate: (module: Readonly<Cinema2ModuleManifest>) => validateConfig(module.config),
  create(context: Cinema2ModuleCreateContext) {
    let disposed = false
    let library: Cinema2ThreeLibrary | null = null
    let held: Cinema2ThreeLoadedAsset | null = null
    let bridge: Cinema2ThreeSceneBridge | null = null
    let sceneController: Cinema2MarqueeSceneController | null = null
    let staticFrame = resolveCinema2MarqueeStaticFrame(context.parameters)
    let sceneFrame: Cinema2MarqueeSceneFrame | null = null
    let state: 'idle' | 'loading' | 'building' | 'ready' | 'failed' = 'idle'
    const diagnostics: Cinema2ModuleDiagnostic[] = []
    const beatClock = new Cinema2BeatClock()
    const patternController = new Cinema2MarqueePatternController(createCinema2MarqueePatternCycle(index => context.randomness.sample('marquee-pattern-cycle', index)))
    const impulse = { ...CINEMA2_MARQUEE_ZERO_IMPULSES }
    const cueIds = new Set<string>()
    let dropEventId: string | null = null
    let previousTimeSec: number | null = null
    let previousTrackId: string | null | undefined
    let previousGeneration: number | null = null
    let reportedBytes = -1
    const environmentId = typeof context.module.config?.environment === 'string' ? context.module.config.environment : CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID

    const report = (code: string, message: string, path: string) => {
      if (!diagnostics.some(existing => existing.code === code)) diagnostics.push({ code, message, path })
    }
    const resetTimeline = () => {
      beatClock.reset(); patternController.reset(); previousTimeSec = null; dropEventId = null; cueIds.clear()
      for (const key of Object.keys(impulse) as CueKind[]) impulse[key] = 0
    }
    const startLoading = (quality: Cinema2RenderQualityLevel) => {
      state = 'loading'
      void (async () => {
        try {
          const loadedLibrary = await loadCinema2ThreeLibrary()
          const asset = await assets.acquire(loadedLibrary, CINEMA2_MARQUEE_ASSET_ID, quality)
          if (disposed) { assets.release(asset); return }
          library = loadedLibrary; held = asset; state = 'building'
        } catch (error) {
          if (!disposed) {
            state = 'failed'
            report('CINEMA2_MARQUEE_ASSET_LOAD_FAILED', `MARQUEE could not load its theater model: ${error instanceof Error ? error.message : String(error)}`, '$.config.asset')
          }
        }
      })()
    }
    const buildBridge = () => {
      if (!library || !held) return
      try {
        const asset = held
        sceneController = new Cinema2MarqueeSceneController(library)
        bridge = context.resources.acquire('marquee:three-bridge', 'MarqueeThreeSceneBridge', gl => new Cinema2ThreeSceneBridge(gl, library!, [{ asset, node: null }], {
          hdr: true,
          environmentUrl: quality => cinema2ThreeEnvironmentRegistry.resolveUrl(environmentId, quality),
          modelController: {
            attach: root => sceneController!.attach(root),
            beforeDraw: () => { if (sceneFrame) sceneController!.apply(sceneFrame) },
            dispose: () => sceneController?.dispose(),
          },
        }), value => { value.dispose(); assets.release(asset) })
        for (const message of sceneController.getDiagnostics()) report('CINEMA2_MARQUEE_MODEL_CONTRACT', message, '$.config.asset')
      } catch (error) {
        state = 'failed'; assets.release(held); held = null
        report('CINEMA2_MARQUEE_SCENE_BUILD_FAILED', `MARQUEE could not build its scene: ${error instanceof Error ? error.message : String(error)}`, '$.config')
      }
    }

    const provider = Object.freeze({
      id: `${context.module.id}:marquee`, moduleId: context.module.id, intent: 'world' as const,
      execute(execution: Cinema2ModuleRenderExecutionContext) {
        if (state === 'idle') startLoading(execution.lightingEnvironment?.quality ?? 'high')
        if (state === 'building' && !bridge) buildBridge()
        if (!bridge || !sceneFrame || state === 'loading' || state === 'failed') return
        bridge.draw(execution, MARQUEE_OVERRIDES)
        if (bridge.ready) state = 'ready'
        const bytes = bridge.estimateGpuBytes()
        if (bytes !== reportedBytes) { reportedBytes = bytes; context.resources.reportGpuBytes(bytes) }
      },
    })

    return {
      lifecycle: {
        update({ parameters, frame }: Cinema2ModuleUpdateContext) {
          staticFrame = resolveCinema2MarqueeStaticFrame(parameters)
          const timeSec = frame.audio?.upstream.timeSec ?? frame.transport?.timeSec ?? frame.elapsedTimeSec
          const reset = frame.audio?.discontinuity.occurred === true
            || (previousTimeSec != null && timeSec + 0.05 < previousTimeSec)
            || (previousTrackId !== undefined && previousTrackId !== frame.transport?.trackId)
            || (previousGeneration != null && previousGeneration !== frame.contextGeneration)
          if (reset) resetTimeline()
          const dt = Math.min(0.25, Math.max(0, frame.deltaTimeSec))
          for (const key of Object.keys(impulse) as CueKind[]) impulse[key] *= Math.exp(-dt / (key === 'phrase' || key === 'section' || key === 'drop' ? 0.9 : 0.26))
          const beats = beatClock.update(frame, staticFrame.bpmSync).beats
          const triggerEventId = resolveCinema2MarqueeTriggerEventIdentity(frame, staticFrame.trigger, reset ? null : previousTimeSec)
          const audio = frame.audio
          const director = frame.director
          const build = Math.max(signal(audio?.features.buildProgress), director?.context.build.available && typeof director.context.build.value === 'number' ? clamp01(director.context.build.value) : 0)
          const selection = patternController.update({
            authoredPattern: staticFrame.pattern, patternChange: staticFrame.patternChange, trigger: staticFrame.trigger,
            triggerEventId, absoluteBeat: beats, autoPerformance: staticFrame.autoPerformance, build, dropEventId, reset,
          })
          const performance: Cinema2MarqueePerformanceFrame = Object.freeze({
            pattern: selection.activePattern, beats, patternBeats: Math.max(0, beats - selection.patternStartBeat),
            signals: Object.freeze({
              overall: Math.max(signal(audio?.features.overallEnergy), director?.continuous.intensity.available && typeof director.continuous.intensity.value === 'number' ? clamp01(director.continuous.intensity.value) : 0),
              sub: signal(audio?.bands.sub), bass: signal(audio?.bands.bass), mid: signal(audio?.bands.mid), high: signal(audio?.bands.high),
              vocal: signal(audio?.features.vocalPresence), build,
              significance: director?.authority.impact.occurred ? clamp01(director.authority.impact.authority) : 0,
            }),
            impulses: Object.freeze({ ...impulse }),
          })
          sceneFrame = Object.freeze({ performance, text: staticFrame.text, masterIntensity: staticFrame.masterIntensity,
            signIllumination: staticFrame.signIllumination, zoneIntensity: staticFrame.zoneIntensity, colors: staticFrame.colors, reflection: staticFrame.reflection })
          previousTimeSec = timeSec; previousTrackId = frame.transport?.trackId; previousGeneration = frame.contextGeneration
        },
        dispose() { disposed = true; resetTimeline(); if (!bridge && held) { assets.release(held); held = null } },
      },
      handleAction(action: string, event: Readonly<Cinema2DispatchedTargetAction>) {
        if (action !== 'musicalCue' || disposed || !event.eventId || cueIds.has(event.eventId) || !event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) return
        const kind = (event.payload as { kind?: unknown }).kind
        if (typeof kind !== 'string' || !(kind in impulse)) return
        cueIds.add(event.eventId); if (cueIds.size > 128) cueIds.delete(cueIds.values().next().value!)
        impulse[kind as CueKind] = 1
        if (kind === 'drop') dropEventId = event.eventId
      },
      render: { providers: Object.freeze([provider]) },
      getDiagnostics: () => Object.freeze([...diagnostics, ...(bridge?.getDiagnostics().map(item => ({ ...item, path: '$.config.environment' })) ?? [])]),
    }
  },
})
