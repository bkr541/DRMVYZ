import goonzSvgSource from '../../../../assets/goonz_true_vector_master.svg?raw'
import {
  cinema2StableId,
  type Cinema2Color,
  type Cinema2JsonObject,
  type Cinema2ModuleManifest,
  type Cinema2ModuleTypeId,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2DispatchedTargetAction } from '../parameters/Cinema2TargetRuntime'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleDiagnostic,
  Cinema2ModuleRenderExecutionContext,
  Cinema2ModuleTypeDefinition,
  Cinema2ModuleUpdateContext,
} from './Cinema2ModuleContracts'
import { Cinema2EchoformRenderer, type Cinema2EchoformDrawState } from './echoform/Cinema2EchoformRenderer'
import type { Cinema2EchoformGeometryOptions } from './echoform/Cinema2EchoformGeometry'
import { adaptCinema2BackstreetLighting } from './Cinema2BackstreetNativeModule'
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

export const CINEMA2_ECHOFORM_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('echoform-native-render')
export const CINEMA2_ECHOFORM_NATIVE_MODULE_VERSION = 1 as const

const BLACK = Object.freeze([0.002, 0.002, 0.002, 1]) as Cinema2Color
const SHADOW = Object.freeze([0.62, 0.1, 0.42, 1]) as Cinema2Color
const METAL = Object.freeze([0.1, 0.38, 0.95, 1]) as Cinema2Color
const HIGHLIGHT = Object.freeze([0.42, 0.9, 1, 1]) as Cinema2Color
const EYE = Object.freeze([0.05, 0.9, 1, 1]) as Cinema2Color
const ACCENT = Object.freeze([0.55, 0.2, 0.85, 1]) as Cinema2Color

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value))

function number(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function color(value: unknown, fallback: Cinema2Color): Cinema2Color {
  return Array.isArray(value) && value.length === 4 && value.every(component => typeof component === 'number' && Number.isFinite(component))
    ? Object.freeze([...value]) as Cinema2Color
    : fallback
}

function motionRate(value: unknown): number {
  if (value === '1/2x') return 0.5
  if (value === '2x') return 2
  return 1
}

function pointDensity(value: unknown): number {
  if (value === 'Sparse') return 44
  if (value === 'Dense') return 96
  return 64
}

function shellCount(value: unknown): number {
  if (value === 'Single') return 1
  if (value === 'Deep') return 4
  return 3
}

function parameterPattern(value: unknown): Cinema2MainframePatternId {
  return typeof value === 'string' && CINEMA2_MAINFRAME_PATTERN_IDS.includes(value as Cinema2MainframePatternId) ? value as Cinema2MainframePatternId : CINEMA2_MAINFRAME_DEFAULT_PATTERN
}

function validateConfig(config: Cinema2JsonObject | undefined): readonly Cinema2ModuleDiagnostic[] {
  if (config?.label == null || typeof config.label === 'string') return Object.freeze([])
  return Object.freeze([Object.freeze({
    code: 'CINEMA2_ECHOFORM_MODULE_LABEL_INVALID',
    path: '$.config.label',
    message: 'Echoform native renderer label must be a string when provided.',
  })])
}

/** The artwork an Echoform-family preset renders, and how it is read into the point and wire cloud. */
export interface Cinema2EchoformFigure {
  readonly typeId: Cinema2ModuleTypeId
  readonly svgSource: string
  readonly geometry?: Cinema2EchoformGeometryOptions
  /** A second figure the particles disperse into and merge from, alternating with the first every 8 beats. */
  readonly secondary?: Readonly<{ svgSource: string; geometry?: Cinema2EchoformGeometryOptions }>
  /** Names the shared GPU resource; unique per artwork. */
  readonly resourceKey: string
}

/** Builds the native module for one Echoform-family figure (Echoform's bulldog, Echowave's wordmark): the orchestration is identical, only the artwork differs. */
export function createCinema2EchoformModuleDefinition(figure: Readonly<Cinema2EchoformFigure>): Readonly<Cinema2ModuleTypeDefinition> {
  return Object.freeze({
  typeId: figure.typeId,
  version: CINEMA2_ECHOFORM_NATIVE_MODULE_VERSION,
  validate: (module: Readonly<Cinema2ModuleManifest>) => validateConfig(module.config),
  create: (context: Cinema2ModuleCreateContext) => {
    const beatClock = new Cinema2BeatClock()
    let draw: Omit<Cinema2EchoformDrawState, 'modelMatrix' | 'viewProjectionMatrix'> | null = null
    let structuralSeed = context.randomness.sample('echoform-initial-seed')
    let turnDirection = 1
    // The same audio intelligence and orchestration engine as Mainframe (see Cinema2BackstreetNativeModule for the walk-through): the shared
    // choreography's musical cues become events, the pattern controller picks the program, and the reactivity engine evaluates it into one
    // lighting frame per tick. The figure's vertices carry Mainframe's route / bank / region / system / phase attributes (Cinema2EchoformGeometry).
    const reactivity = new Cinema2MainframeReactivityEngine()
    const orchestrationClock = new Cinema2MainframeBeatClockResolver()
    const dropCoordinator = new Cinema2MainframeDropCoordinator()
    const musicalCues: Cinema2MainframeMusicalCue[] = []
    const initialPattern = parameterPattern(context.parameters.get('pattern'))
    const patternController = new Cinema2MainframePatternController(
      createCinema2MainframePatternCycle(index => context.randomness.sample('echoform-pattern-cycle', index)),
      initialPattern,
    )
    let lighting: Readonly<Cinema2MainframeLightingFrame> | null = null
    let triggerPreviousTimeSec: number | null = null
    let triggerPreviousBeat: number | null = null
    let triggerSourceIdentity: string | null = null
    let triggerTrackId: string | null | undefined
    let triggerContextGeneration: number | null = null
    let previousPlayback: ReturnType<typeof resolveCinema2MainframePlaybackState> | null = null
    let selection: Readonly<Cinema2MainframePatternSelection> = Object.freeze({ activePattern: initialPattern, patternStartBeat: 0, changed: false })

    const provider = Object.freeze({
      id: `${context.module.id}:echoform-native`,
      moduleId: context.module.id,
      intent: 'world' as const,
      execute: (execution: Cinema2ModuleRenderExecutionContext) => {
        if (!draw) return
        if (!execution.depthAvailable) throw new Error(`Cinema 2.0 Echoform module "${context.module.id}" requires a depth target.`)
        if (!execution.camera) throw new Error(`Cinema 2.0 Echoform module "${context.module.id}" requires the final world camera.`)
        const node = (execution.spatialNodes ?? []).find(candidate => candidate.visible && candidate.coordinateSpace === 'world')
        if (!node) return
        const renderer = context.resources.acquire(
          figure.resourceKey,
          'EchoformSvgRenderer',
          gl => new Cinema2EchoformRenderer(gl, figure.svgSource, figure.geometry, figure.secondary ?? null),
          value => value.dispose(),
        )
        renderer.draw({
          ...draw,
          modelMatrix: node.worldMatrix,
          viewProjectionMatrix: execution.camera.viewProjectionMatrix,
        })
      },
    })

    return {
      lifecycle: {
        update: ({ frame, parameters }: Cinema2ModuleUpdateContext) => {
          const authoredPattern = parameterPattern(parameters.get('pattern'))
          const patternChange = bool(parameters.get('patternChange'), false)
          const triggerValue = parameters.get('trigger')
          const trigger: Cinema2MainframeTriggerId = typeof triggerValue === 'string' && CINEMA2_MAINFRAME_TRIGGER_IDS.includes(triggerValue as Cinema2MainframeTriggerId)
            ? triggerValue as Cinema2MainframeTriggerId : 'bar4'
          const idleGlow = clamp(number(parameters.get('idleGlow'), 0.45))
          const bpmSync = bool(parameters.get('bpmSync'), true)
          const audio = selectCinema2MainframeAudio(frame.audio, frame.transport?.trackId)
          const accepted = audio === frame.audio ? frame : { ...frame, audio }
          const playback = resolveCinema2MainframePlaybackState(accepted, audio)
          const timeSec = resolveCinema2MainframeTimeSec(accepted)
          const sourceIdentity = frame.transport?.paused && !audio && triggerSourceIdentity != null && frame.transport.trackId === triggerTrackId
            ? triggerSourceIdentity : resolveCinema2MainframeSourceIdentity(frame, audio)
          const triggerReset = shouldResetCinema2MainframeDropState(accepted,
            { timeSec, sourceIdentity, playback },
            { timeSec: triggerPreviousTimeSec, sourceIdentity: triggerSourceIdentity, contextGeneration: triggerContextGeneration, playback: previousPlayback })
          if (triggerReset) dropCoordinator.reset()
          const cues = musicalCues.splice(0)
          const dispatched = triggerReset || playback !== 'playing' ? [] : resolveCinema2MainframeMusicalEvents(accepted, cues)
          const coordinated = dropCoordinator.update(accepted, dispatched)
          if (triggerReset) orchestrationClock.reset()
          const timing = orchestrationClock.resolve(accepted, bpmSync)
          const triggerEventId = triggerReset ? null : resolveCinema2MainframeTriggerEventIdentity(accepted, trigger, triggerPreviousTimeSec, coordinated.dropEventId, {
            previousBeat: triggerPreviousBeat,
            current: timing,
          })
          selection = patternController.update({ authoredPattern, patternChange, trigger, triggerEventId, absoluteBeat: timing.beats, reset: triggerReset })
          lighting = reactivity.update(frame, selection.activePattern, bpmSync, selection.patternStartBeat, coordinated.events, timing.beats)
          triggerPreviousTimeSec = timeSec
          triggerPreviousBeat = timing.beats
          triggerSourceIdentity = sourceIdentity
          triggerTrackId = frame.transport?.trackId
          triggerContextGeneration = frame.contextGeneration
          previousPlayback = playback
          const adapted = lighting ? adaptCinema2BackstreetLighting(lighting, idleGlow) : null

          const intensity = clamp(number(parameters.get('masterIntensity'), 0.8))
          const motion = clamp(number(parameters.get('motionAmount'), 0.72))
          const beat = beatClock.update(frame, bool(parameters.get('bpmSync'), true))
          const rate = motionRate(parameters.get('motionRate'))
          const musicalBeat = beat.beats * rate
          // Dissolve and re-form over 8 beats: assemble, hold, thin to the outline, then evaporate to a few points.
          const phase = (musicalBeat / 8) - Math.floor(musicalBeat / 8)
          const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }
          const cyclePhase = clamp(number(parameters.get('motionAmount'), 0.72)) < 0.05 ? 0.5 : phase
          const cycle = smooth(0.04, 0.34, phase) * (1 - smooth(0.6, 0.94, phase))
          const energy = clamp(number(parameters.get('overallEnergy'), 0))
          const bass = clamp(number(parameters.get('bassEnergy'), 0))
          const high = clamp(number(parameters.get('highEnergy'), 0))
          const flux = clamp(number(parameters.get('spectralFlux'), 0))
          const beatPulse = clamp(number(parameters.get('beatPulse'), 0))
          const downbeatReveal = clamp(number(parameters.get('downbeatReveal'), 0))
          const kickScatter = clamp(number(parameters.get('kickScatter'), 0))
          const sectionTurn = clamp(number(parameters.get('sectionTurn'), 0))
          const authoredReconstruction = clamp(number(parameters.get('reconstruction'), 0.62))
          const authoredFragmentation = clamp(number(parameters.get('fragmentation'), 0.18))
          const reconstruction = clamp(
            authoredReconstruction * (1 - motion * 0.72)
              + cycle * motion * 0.72
              + energy * intensity * 0.16
              + downbeatReveal * intensity * 0.2,
          )
          const fragmentation = clamp(authoredFragmentation + flux * intensity * 0.28 + kickScatter * intensity * 0.18)
          const rotationDegrees = clamp(number(parameters.get('rotationAmount'), 26), 0, 55)
          const idleYaw = Math.sin(musicalBeat * Math.PI / 8) * rotationDegrees * motion
          const structuralYaw = sectionTurn * turnDirection * Math.min(42, rotationDegrees * 1.35)
          const shellPulse = 1 + bass * intensity * 0.38 + beatPulse * intensity * 0.24

          draw = {
            orchestration: adapted ? Object.freeze({ strength: clamp(number(parameters.get('masterIntensity'), 0.8) / 0.8, 0, 1.25), frame: adapted }) : null,
            reconstruction,
            phase: cyclePhase,
            morph: figure.secondary ? Object.freeze({
              figure: (motion < 0.05 ? 0 : Math.floor(musicalBeat / 8) % 2) as 0 | 1,
              // Merges in over the first of each cycle and disperses over the last, so each figure appears out of dust and goes back to it.
              assemble: motion < 0.05 ? 1 : smooth(0.02, 0.2, phase) * (1 - smooth(0.8, 0.98, phase)),
            }) : null,
            waveBeats: musicalBeat,
            waveGain: clamp(0.55 + bass * intensity * 0.9 + beatPulse * intensity * 0.4, 0, 1.5),
            fragmentation,
            pointDensity: pointDensity(parameters.get('pointDensity')),
            pointSize: clamp(number(parameters.get('pointSize'), 0.34), 0.12, 0.62),
            shellCount: shellCount(parameters.get('shellCount')),
            shellSeparation: clamp(number(parameters.get('shellSeparation'), 0.58) * shellPulse, 0, 1.5),
            yawRadians: (idleYaw + structuralYaw) * Math.PI / 180,
            scale: clamp(number(parameters.get('figureScale'), 1), 0.55, 1.65),
            pulse: clamp(beatPulse * intensity + bass * intensity * 0.25),
            sparkle: clamp(high * intensity),
            scatter: clamp(fragmentation + kickScatter * intensity * 0.72, 0, 1.4),
            seed: structuralSeed + Math.floor(musicalBeat) * 0.013,
            background: color(parameters.get('backgroundColor'), BLACK),
            shadow: color(parameters.get('shadowColor'), SHADOW),
            metal: color(parameters.get('metalColor'), METAL),
            highlight: color(parameters.get('highlightColor'), HIGHLIGHT),
            eye: color(parameters.get('eyeColor'), EYE),
            accent: color(parameters.get('accentColor'), ACCENT),
          }
        },
        dispose: () => {
          beatClock.reset()
          musicalCues.splice(0)
          dropCoordinator.reset()
          orchestrationClock.reset()
          reactivity.reset()
          patternController.reset()
          draw = null
        },
      },
      handleAction: (action: string, event: Readonly<Cinema2DispatchedTargetAction>) => {
        if (action === 'musicalCue') {
          if (!event.eventId || !event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) return
          const kind = (event.payload as { kind?: unknown }).kind
          if (typeof kind !== 'string' || kind === 'eightBeat' || !CINEMA2_MAINFRAME_IMPULSE_IDS.includes(kind as Cinema2MainframeMusicalCueKind)) return
          if (musicalCues.some(cue => cue.dispatchedEventId === event.eventId)) return
          if (musicalCues.length >= 128) musicalCues.shift()
          musicalCues.push({ kind: kind as Cinema2MainframeMusicalCueKind, dispatchedEventId: event.eventId })
          return
        }
        if (action !== 'structuralEvent') return
        const stream = context.randomness.eventStream(event.eventId, 'echoform-structural-event')
        structuralSeed = stream.next()
        turnDirection = stream.next() < 0.5 ? -1 : 1
      },
      render: { providers: Object.freeze([provider]) },
    }
  },
  })
}

export const cinema2EchoformNativeModuleDefinition = createCinema2EchoformModuleDefinition({
  typeId: CINEMA2_ECHOFORM_NATIVE_MODULE_TYPE_ID,
  svgSource: goonzSvgSource,
  resourceKey: 'echoform:goonz-svg-renderer:v2',
})
