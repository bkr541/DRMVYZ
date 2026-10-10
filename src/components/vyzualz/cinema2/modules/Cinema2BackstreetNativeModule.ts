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
import { CINEMA2_BACKSTREET_ASSET_ID, cinema2ThreeAssetRegistry } from './three/Cinema2ThreeAssetManifest'
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
  Cinema2MainframeBeatClockResolver,
  Cinema2MainframeReactivityEngine,
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
  diagnoseCinema2MainframeAudio,
  resolveCinema2MainframePlaybackState,
  resolveCinema2MainframeSourceIdentity,
  selectCinema2MainframeAudio,
} from './mainframe/Cinema2MainframeAudioDelivery'
import {
  Cinema2MainframeDropCoordinator,
  resolveCinema2MainframeMusicalEvents,
  shouldResetCinema2MainframeDropState,
  type Cinema2MainframeMusicalCue,
  type Cinema2MainframeMusicalCueKind,
} from './mainframe/Cinema2MainframeMusicAdapter'
import { CINEMA2_MAINFRAME_IMPULSE_IDS } from './mainframe/Cinema2MainframeReactivity'
import type { Cinema2DispatchedTargetAction } from '../parameters/Cinema2TargetRuntime'

/**
 * BACKSTREET: the DVYDRM wordmark as a neon sign on a black painted brick wall.
 *
 * It runs on exactly the same audio intelligence and choreography engine as Mainframe: the Mainframe music adapter and drop coordinator turn the
 * shared choreography's musical cues into events, the Mainframe pattern controller picks the lighting program (and, with Pattern Change, the
 * next one on a qualified Trigger), and the Mainframe reactivity engine evaluates the six programs into one lighting frame per tick. The sign's
 * tubes carry Mainframe's circuit vertex attributes (see scripts/cinema2-assets/generate-backstreet.mjs), so the shared Three bridge's Mainframe
 * circuit shader lights them; nothing in the engine or the shader is duplicated or changed.
 *
 * What is Backstreet's own is how a neon sign reads those programs: `adaptCinema2BackstreetLighting` keeps a sign that is always visibly lit,
 * turns Radar Sweep into a beam that rotates round the sign, and the part looks (white glass tubes, glossy black paint) live in the static frame.
 */
export const CINEMA2_BACKSTREET_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('backstreet-native-render')
export const CINEMA2_BACKSTREET_NATIVE_MODULE_VERSION = 1 as const
/** The sign is authored for a 16:9 frame; a narrower Stage zooms it out to keep the whole sign in view. */
export const CINEMA2_BACKSTREET_COMPOSITION_ASPECT = 16 / 9
export const CINEMA2_BACKSTREET_MIN_SCALE = 0.5
export const CINEMA2_BACKSTREET_MAX_SCALE = 1.4
export const CINEMA2_BACKSTREET_PARTS = Object.freeze(['tubeCores', 'clips', 'wall'] as const)

export type Cinema2BackstreetModuleState = 'idle' | 'loading' | 'building' | 'ready' | 'failed'
type Rgb = readonly [number, number, number]

export interface Cinema2BackstreetStaticFrame {
  readonly intensity: number
  readonly bpmSync: boolean
  readonly pattern: Cinema2MainframePatternId
  readonly patternChange: boolean
  readonly trigger: Cinema2MainframeTriggerId
  readonly scale: number
  /** How much of the sign stays lit between hits, 0 (dark until a program lights it) to 1 (steady neon with the programs riding on top). */
  readonly idleGlow: number
  readonly tubeColor: Rgb
  readonly overrides: Readonly<Cinema2ThreeMaterialOverrides>
}

const DEFAULT_TUBE_COLOR: Rgb = [1, 1, 1]
const DEFAULT_IDLE_GLOW = 0.45
/** Emission of the sign with no music playing: steady neon, as in the production reference. */
const STATIC_EMISSIVE_INTENSITY = 2.6
/**
 * Scales the circuit shader's output while music plays. The shader is tuned for Mainframe's green traces, whose lit peaks sit far above 1; white
 * neon at that level clips to flat white and the programs would no longer show. At this gain a fully addressed tube sits just above white-hot
 * and an unaddressed one stays visibly dim, so Center Out, Marquee, the relay and the sweep all read.
 */
const PLAYBACK_EMISSION_GAIN = 0.4

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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const clamp01 = (value: number) => clamp(Number.isFinite(value) ? value : 0, 0, 1)

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

/** Scales the authored 16:9 composition: zoomed out on a narrower Stage so the whole sign stays in view, never zoomed in past the authored framing. */
export function resolveCinema2BackstreetScale(width: number, height: number, scale = 1): number {
  const aspect = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? width / height : CINEMA2_BACKSTREET_COMPOSITION_ASPECT
  const operator = Number.isFinite(scale) ? clamp(scale, CINEMA2_BACKSTREET_MIN_SCALE, CINEMA2_BACKSTREET_MAX_SCALE) : 1
  return operator * Math.min(1, aspect / CINEMA2_BACKSTREET_COMPOSITION_ASPECT)
}

/** The persistent look and the operator's choices; the music's lighting is layered on separately through the circuit shader. */
export function resolveCinema2BackstreetStaticFrame(parameters: Cinema2ModuleParameterReadFacet): Readonly<Cinema2BackstreetStaticFrame> {
  const intensity = readNumber(parameters, 'masterIntensity', 1, 0, 1)
  const patternValue = parameters.get('pattern')
  const triggerValue = parameters.get('trigger')
  const tubeColor = readColor(parameters, 'tubeColor', DEFAULT_TUBE_COLOR)
  return Object.freeze({
    intensity,
    bpmSync: readBoolean(parameters, 'bpmSync', true),
    pattern: isBackstreetPattern(patternValue) ? patternValue : CINEMA2_MAINFRAME_DEFAULT_PATTERN,
    patternChange: readBoolean(parameters, 'patternChange', false),
    trigger: isBackstreetTrigger(triggerValue) ? triggerValue : 'bar4',
    scale: readNumber(parameters, 'scale', 1, CINEMA2_BACKSTREET_MIN_SCALE, CINEMA2_BACKSTREET_MAX_SCALE),
    idleGlow: readNumber(parameters, 'idleGlow', DEFAULT_IDLE_GLOW, 0, 1),
    tubeColor,
    overrides: Object.freeze({
      ...CINEMA2_THREE_DEFAULT_OVERRIDES,
      environmentIntensity: 0.12,
      parts: Object.freeze({
        // The static (no music) look: steady white neon. During playback the circuit shader replaces this emission entirely.
        tubeCores: Object.freeze({ ...EMPTY_PART, emissive: tubeColor, emissiveIntensity: STATIC_EMISSIVE_INTENSITY * intensity, roughness: 0.16, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.05, environmentIntensity: 0.35 }),
        clips: Object.freeze({ ...EMPTY_PART, roughness: 0.3, metalness: 0.85, environmentIntensity: 0.4 }),
        wall: Object.freeze({ ...EMPTY_PART, environmentIntensity: 0.18 }),
      }),
    }),
  })
}

/** Region numbering round the sign, clockwise on screen from the bottom: bottom 0, bottom-left 1, left 2, top-left 3, top 7, top-right 6, right 5, bottom-right 4. */
const SWEEP_ORDER = Object.freeze([0, 1, 2, 3, 7, 6, 5, 4] as const)

/** A beam rotating once every four beats: the sector it is in is full, its neighbours fade with distance. */
export function resolveCinema2BackstreetSweepRegions(beats: number): readonly [number, number, number, number, number, number, number, number] {
  const position = (((Number.isFinite(beats) ? beats : 0) / 4) % 1 + 1) % 1 * 8
  const weights = [0, 0, 0, 0, 0, 0, 0, 0]
  SWEEP_ORDER.forEach((region, slot) => {
    const distance = Math.min(Math.abs(slot - position), 8 - Math.abs(slot - position))
    weights[region] = clamp01(1 - distance / 1.7)
  })
  return Object.freeze(weights) as unknown as readonly [number, number, number, number, number, number, number, number]
}

/**
 * Turns a Mainframe lighting frame into one a neon sign should show. Mainframe's programs dim whatever they are not addressing down to a
 * dark locator glow, which suits a circuit board but would switch a neon sign off, so `idleGlow` holds a floor under the sign's energy and under
 * the bank and region selections. Radar Sweep addresses radar hardware the sign does not have; here it becomes the rotating beam above, and the
 * expanding ring the program already draws runs with it. An inactive frame (no music, nothing playing) passes through untouched.
 */
export function adaptCinema2BackstreetLighting(frame: Readonly<Cinema2MainframeLightingFrame>, idleGlow: number): Readonly<Cinema2MainframeLightingFrame> {
  if (!frame.active) return frame
  const idle = clamp01(idleGlow)
  const floor = 0.5 * idle
  const lift = (weight: number) => floor + (1 - floor) * clamp01(weight)
  const sweeping = frame.pattern === 'radar-sweep'
  const regions = sweeping ? resolveCinema2BackstreetSweepRegions(frame.beats) : frame.regionWeights
  return Object.freeze({
    ...frame,
    // The shader reads Quadrant Relay's region selection for the sweep; the engine's own pattern id is left alone everywhere else.
    pattern: sweeping ? 'quadrant-relay' as const : frame.pattern,
    circuitEnergy: Math.max(frame.circuitEnergy, 0.9 * idle),
    bankWeights: Object.freeze(frame.bankWeights.map(lift)) as unknown as Cinema2MainframeLightingFrame['bankWeights'],
    regionWeights: Object.freeze(regions.map(lift)) as unknown as Cinema2MainframeLightingFrame['regionWeights'],
  })
}

const assets = new Cinema2ThreeAssetCache(cinema2ThreeAssetRegistry)

function validateConfig(config: Cinema2JsonObject | undefined): readonly Cinema2ModuleDiagnostic[] {
  const diagnostics: Cinema2ModuleDiagnostic[] = []
  if (config?.asset !== CINEMA2_BACKSTREET_ASSET_ID) {
    diagnostics.push({ code: 'CINEMA2_BACKSTREET_ASSET_REQUIRED', path: '$.config.asset', message: `Backstreet requires the shipped ${CINEMA2_BACKSTREET_ASSET_ID} model.` })
  }
  const environment = config?.environment
  if (environment !== undefined && (typeof environment !== 'string' || cinema2ThreeEnvironmentRegistry.resolveUrl(environment, 'high') == null)) {
    diagnostics.push({ code: 'CINEMA2_BACKSTREET_ENVIRONMENT_UNKNOWN', path: '$.config.environment', message: 'Backstreet environment must reference a shipped Cinema 2.0 environment.' })
  }
  return Object.freeze(diagnostics.map(diagnostic => Object.freeze(diagnostic)))
}

export const cinema2BackstreetNativeModuleDefinition: Readonly<Cinema2ModuleTypeDefinition> = Object.freeze({
  typeId: CINEMA2_BACKSTREET_NATIVE_MODULE_TYPE_ID,
  version: CINEMA2_BACKSTREET_NATIVE_MODULE_VERSION,
  validate: (module: Readonly<Cinema2ModuleManifest>) => validateConfig(module.config),
  create(context: Cinema2ModuleCreateContext) {
    let state: Cinema2BackstreetModuleState = 'idle'
    let disposed = false
    let library: Cinema2ThreeLibrary | null = null
    let held: Cinema2ThreeLoadedAsset | null = null
    let bridge: Cinema2ThreeSceneBridge | null = null
    let bridgeCreateFailed = false
    let frame = resolveCinema2BackstreetStaticFrame(context.parameters)
    const reactivity = new Cinema2MainframeReactivityEngine()
    const beatClock = new Cinema2MainframeBeatClockResolver()
    const dropCoordinator = new Cinema2MainframeDropCoordinator()
    // Filled only by the engine-owned choreography dispatcher before module.update; no second subscription to the Audio Feature Bus.
    const musicalCues: Cinema2MainframeMusicalCue[] = []
    const patternController = new Cinema2MainframePatternController(
      createCinema2MainframePatternCycle(index => context.randomness.sample('backstreet-pattern-cycle', index)),
      frame.pattern,
    )
    let selection: Readonly<Cinema2MainframePatternSelection> = Object.freeze({ activePattern: frame.pattern, patternStartBeat: 0, changed: false })
    let lighting: Readonly<Cinema2MainframeLightingFrame> | null = null
    let triggerPreviousTimeSec: number | null = null
    let triggerPreviousBeat: number | null = null
    let triggerSourceIdentity: string | null = null
    let triggerTrackId: string | null | undefined
    let triggerContextGeneration: number | null = null
    let previousPlayback: ReturnType<typeof resolveCinema2MainframePlaybackState> | null = null
    let reportedBytes = -1
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
          const asset = await assets.acquire(loadedLibrary, CINEMA2_BACKSTREET_ASSET_ID, quality)
          if (disposed) { assets.release(asset); return }
          library = loadedLibrary
          held = asset
          state = 'building'
        } catch (error) {
          if (!disposed) {
            state = 'failed'
            report('CINEMA2_BACKSTREET_ASSET_LOAD_FAILED', `Backstreet could not load its production model: ${error instanceof Error ? error.message : String(error)}`, '$.config.asset')
          }
        }
      })()
    }

    const buildBridge = () => {
      if (!library || !held) return
      try {
        const asset = held
        bridge = context.resources.acquire(
          'backstreet:three-bridge',
          'BackstreetThreeSceneBridge',
          gl => new Cinema2ThreeSceneBridge(gl, library!, [{ asset, node: null }], {
            hdr: true,
            environmentUrl: quality => cinema2ThreeEnvironmentRegistry.resolveUrl(environmentId, quality),
            // The tubes and their clips throw soft shadows on the bricks from the preset's one shadow-casting spot.
            shadows: { cast: Object.freeze(['tubeCores', 'clips']), receive: Object.freeze(['wall']) },
            mainframe: Object.freeze({ tubeCores: 'circuit' }),
          }),
          value => { value.dispose(); assets.release(asset) },
        )
      } catch (error) {
        bridgeCreateFailed = true
        state = 'failed'
        assets.release(held)
        held = null
        report('CINEMA2_BACKSTREET_SCENE_BUILD_FAILED', `Backstreet could not build its production scene: ${error instanceof Error ? error.message : String(error)}`, '$.config')
      }
    }

    const provider = Object.freeze({
      id: `${context.module.id}:backstreet`,
      moduleId: context.module.id,
      intent: 'world' as const,
      execute(execution: Cinema2ModuleRenderExecutionContext) {
        const quality = execution.lightingEnvironment?.quality ?? 'high'
        if (state === 'idle') startLoading(quality)
        if (state === 'building' && !bridge && !bridgeCreateFailed) buildBridge()
        if (!bridge || state === 'loading' || state === 'failed') return
        const adapted = lighting ? adaptCinema2BackstreetLighting(lighting, frame.idleGlow) : null
        bridge.draw(execution, frame.overrides, 0, null, null, {
          scale: resolveCinema2BackstreetScale(execution.width, execution.height, frame.scale),
        }, adapted ? {
          circuitColor: frame.tubeColor,
          indicatorColor: frame.tubeColor,
          logoColor: frame.tubeColor,
          strength: frame.intensity * PLAYBACK_EMISSION_GAIN,
          frame: adapted,
        } : null)
        if (bridge.ready) state = 'ready'
        const bytes = bridge.estimateGpuBytes()
        if (bytes !== reportedBytes) { reportedBytes = bytes; context.resources.reportGpuBytes(bytes) }
      },
    })

    return {
      lifecycle: {
        update: ({ parameters, frame: updateFrame }: Cinema2ModuleUpdateContext) => {
          frame = resolveCinema2BackstreetStaticFrame(parameters)
          const audioSelection = diagnoseCinema2MainframeAudio(updateFrame.audio, updateFrame.transport?.trackId)
          const audio = selectCinema2MainframeAudio(updateFrame.audio, updateFrame.transport?.trackId)
          const acceptedFrame = audio === updateFrame.audio ? updateFrame : { ...updateFrame, audio }
          const playback = resolveCinema2MainframePlaybackState(acceptedFrame, audio)
          const timeSec = resolveCinema2MainframeTimeSec(acceptedFrame)
          const sourceIdentity = updateFrame.transport?.paused && !audio && triggerSourceIdentity != null
            && updateFrame.transport.trackId === triggerTrackId
            ? triggerSourceIdentity : resolveCinema2MainframeSourceIdentity(updateFrame, audio)
          const triggerReset = shouldResetCinema2MainframeDropState(acceptedFrame,
            { timeSec, sourceIdentity, playback },
            { timeSec: triggerPreviousTimeSec, sourceIdentity: triggerSourceIdentity, contextGeneration: triggerContextGeneration, playback: previousPlayback })
          if (triggerReset) dropCoordinator.reset()
          const cues = musicalCues.splice(0)
          const dispatched = triggerReset || playback !== 'playing' ? [] : resolveCinema2MainframeMusicalEvents(acceptedFrame, cues)
          const coordinated = dropCoordinator.update(acceptedFrame, dispatched)
          if (triggerReset) beatClock.reset()
          const timing = beatClock.resolve(acceptedFrame, frame.bpmSync)
          const triggerEventId = triggerReset
            ? null
            : resolveCinema2MainframeTriggerEventIdentity(acceptedFrame, frame.trigger, triggerPreviousTimeSec, coordinated.dropEventId, {
              previousBeat: triggerPreviousBeat,
              current: timing,
            })
          selection = patternController.update({
            authoredPattern: frame.pattern,
            patternChange: frame.patternChange,
            trigger: frame.trigger,
            triggerEventId,
            absoluteBeat: timing.beats,
            reset: triggerReset,
          })
          lighting = reactivity.update(updateFrame, selection.activePattern, frame.bpmSync, selection.patternStartBeat, coordinated.events, timing.beats)
          void audioSelection
          triggerPreviousTimeSec = timeSec
          triggerPreviousBeat = timing.beats
          triggerSourceIdentity = sourceIdentity
          triggerTrackId = updateFrame.transport?.trackId
          triggerContextGeneration = updateFrame.contextGeneration
          previousPlayback = playback
        },
        dispose: () => {
          disposed = true
          musicalCues.splice(0)
          dropCoordinator.reset()
          beatClock.reset()
          triggerPreviousBeat = null
          reactivity.reset()
          patternController.reset()
          if (!bridge && held) { assets.release(held); held = null }
        },
      },
      handleAction: (action: string, event: Readonly<Cinema2DispatchedTargetAction>) => {
        if (action !== 'musicalCue' || disposed || !event.eventId || !event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) return
        const kind = (event.payload as { kind?: unknown }).kind
        if (typeof kind !== 'string' || kind === 'eightBeat' || !CINEMA2_MAINFRAME_IMPULSE_IDS.includes(kind as Cinema2MainframeMusicalCueKind)) return
        if (musicalCues.some(cue => cue.dispatchedEventId === event.eventId)) return
        if (musicalCues.length >= 128) musicalCues.shift()
        musicalCues.push({ kind: kind as Cinema2MainframeMusicalCueKind, dispatchedEventId: event.eventId })
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
        idleGlow: frame.idleGlow,
        lighting,
      }),
    }
  },
})

function isBackstreetPattern(value: unknown): value is Cinema2MainframePatternId {
  return typeof value === 'string' && CINEMA2_MAINFRAME_PATTERN_IDS.includes(value as Cinema2MainframePatternId)
}

function isBackstreetTrigger(value: unknown): value is Cinema2MainframeTriggerId {
  return typeof value === 'string' && CINEMA2_MAINFRAME_TRIGGER_IDS.includes(value as Cinema2MainframeTriggerId)
}
