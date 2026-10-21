import { cinema2StableId, type Cinema2Color, type Cinema2ModuleManifest, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleCreateContext, Cinema2ModuleDiagnostic, Cinema2ModuleRenderExecutionContext, Cinema2ModuleTypeDefinition, Cinema2ModuleUpdateContext } from './Cinema2ModuleContracts'
import { Cinema2BwcRenderer, type Cinema2BwcRenderState } from './bwc/Cinema2BwcRenderer'
import { Cinema2BwcConveyorClock } from './bwc/Cinema2BwcLoop'
import { blendBwcLightingReactivity, neutralBwcLighting, type Cinema2BwcLightColors, type Cinema2BwcLightingState } from './bwc/Cinema2BwcLighting'
import { Cinema2BwcAutoPerformance, type Cinema2BwcPerformance } from './bwc/Cinema2BwcAutoPerformance'
import { CINEMA2_BWC_DEFAULT_PATTERN, CINEMA2_BWC_PATTERN_IDS, evaluateCinema2BwcPattern, type Cinema2BwcPatternId, type Cinema2BwcPatternStyle } from './bwc/Cinema2BwcPatternEngine'
import { Cinema2MainframeBeatClockResolver, Cinema2MainframeReactivityEngine, resolveCinema2MainframeTimeSec } from './mainframe/Cinema2MainframePatternEngine'
import {
  CINEMA2_MAINFRAME_TRIGGER_IDS,
  Cinema2MainframePatternController,
  createCinema2MainframePatternCycle,
  resolveCinema2MainframeTriggerEventIdentity,
  type Cinema2MainframePatternSelection,
  type Cinema2MainframeTriggerId,
} from './mainframe/Cinema2MainframePatternController'
import { resolveCinema2MainframePlaybackState, resolveCinema2MainframeSourceIdentity, selectCinema2MainframeAudio } from './mainframe/Cinema2MainframeAudioDelivery'
import { Cinema2MainframeDropCoordinator, resolveCinema2MainframeMusicalEvents, shouldResetCinema2MainframeDropState, type Cinema2MainframeMusicalCue, type Cinema2MainframeMusicalCueKind } from './mainframe/Cinema2MainframeMusicAdapter'
import { CINEMA2_MAINFRAME_IMPULSE_IDS } from './mainframe/Cinema2MainframeReactivity'
import type { Cinema2DispatchedTargetAction } from '../parameters/Cinema2TargetRuntime'
import { CINEMA2_BWC_CREATURE_LABEL_TEXTURE_ASSET_ID } from '../assets/Cinema2TextureAssetManifest'
import type { Cinema2TextureHandle } from '../assets/Cinema2AssetTextureService'

export const CINEMA2_BWC_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('bwc-native')
export const CINEMA2_BWC_NATIVE_MODULE_VERSION = 1 as const
/** Light above white the lit elements feed the bloom pass with; the preset's bloom decides how much of it shows. */
const GLOW_GAIN = 1.2
/** The hall's fixed materials, which are not part of the palette. */
const HALL_BACKGROUND: Cinema2Color = [0.035, 0.055, 0.058, 1]
const CAN_WHITE: Cinema2Color = [0.86, 0.88, 0.86, 1]
const DARK_METAL: Cinema2Color = [0.018, 0.028, 0.032, 1]

export interface Cinema2BwcRendererLike {
  draw(state: Readonly<Cinema2BwcRenderState>): void
  estimateGpuBytes(): number
  dispose(): void
}

export function createCinema2BwcNativeModuleDefinition(
  options: { createRenderer?: (gl: WebGL2RenderingContext) => Cinema2BwcRendererLike } = {},
): Readonly<Cinema2ModuleTypeDefinition> {
  const createRenderer = options.createRenderer ?? (gl => new Cinema2BwcRenderer(gl))
  return Object.freeze({
    typeId: CINEMA2_BWC_NATIVE_MODULE_TYPE_ID,
    version: CINEMA2_BWC_NATIVE_MODULE_VERSION,
    validate: validateModule,
    create(context: Cinema2ModuleCreateContext) {
      const renderer = context.resources.acquire('bwc:factory-corridor-v2', 'Cinema2BwcRenderer', gl => createRenderer(gl), value => value.dispose())
      context.resources.reportGpuBytes(renderer.estimateGpuBytes())
      // The creature's printed label is a shipped texture from the shared texture service. The creature draws as plain ivory
      // fleece until it has loaded; the rest of the scene never waits for it.
      let labelHandle: Cinema2TextureHandle | null = null
      let labelQuality: string | null = null
      const creatureLabel = (quality: 'low' | 'medium' | 'high'): WebGLTexture | null => {
        if (!context.textures) return null
        if (labelQuality !== quality) {
          labelHandle?.release()
          labelHandle = context.textures.acquire(CINEMA2_BWC_CREATURE_LABEL_TEXTURE_ASSET_ID, quality)
          labelQuality = quality
        }
        return labelHandle?.status === 'ready' ? labelHandle.texture : null
      }
      const conveyorClock = new Cinema2BwcConveyorClock()
      // The lighting programs reuse the shared musical infrastructure Backstreet and Mainframe use: the beat clock, the drop coordinator, the
      // reactivity engine (envelopes, signals, buildup) and the pattern controller. Only the six programs themselves are BWC's.
      const reactivity = new Cinema2MainframeReactivityEngine()
      const beatClock = new Cinema2MainframeBeatClockResolver()
      const dropCoordinator = new Cinema2MainframeDropCoordinator()
      // Filled only by the engine-owned choreography dispatcher before module.update; there is no second subscription to the audio bus.
      const musicalCues: Cinema2MainframeMusicalCue[] = []
      let design = resolveDesign(context.parameters)
      const patternController = new Cinema2MainframePatternController<Cinema2BwcPatternId>(
        createCinema2MainframePatternCycle<Cinema2BwcPatternId>(index => context.randomness.sample('bwc-pattern-cycle', index), CINEMA2_BWC_PATTERN_IDS),
        design.pattern,
      )
      let selection: Readonly<Cinema2MainframePatternSelection<Cinema2BwcPatternId>> = Object.freeze({ activePattern: design.pattern, patternStartBeat: 0, changed: false })
      // Auto Performance puts Surge on stage through a buildup and Core Burst on a drop; the pattern controller above keeps running beneath it.
      const autoPerformance = new Cinema2BwcAutoPerformance()
      let performance: Readonly<Cinema2BwcPerformance> = Object.freeze({ pattern: null, reason: null, startBeat: 0 })
      let previousAuthoredPattern: Cinema2BwcPatternId | null = null
      let lighting: Readonly<Cinema2BwcLightingState> = neutralBwcLighting()
      let triggerPreviousTimeSec: number | null = null
      let triggerPreviousBeat: number | null = null
      let triggerSourceIdentity: string | null = null
      let triggerTrackId: string | null | undefined
      let triggerContextGeneration: number | null = null
      let previousPlayback: ReturnType<typeof resolveCinema2MainframePlaybackState> | null = null
      const provider = Object.freeze({
        id: `${context.module.id}:bwc`, moduleId: context.module.id, intent: 'fullscreen' as const,
        execute(execution: Cinema2ModuleRenderExecutionContext) {
          const p = context.parameters
          const bpmSync = readBoolean(p, 'bpmSync', true)
          renderer.draw({
            target: execution.target, width: execution.width, height: execution.height,
            intensity: clamp(readNumber(p, 'intensity', 1.1), 0, 2),
            portalScale: clamp(readNumber(p, 'portalScale', 1), 0.7, 1.35),
            canScale: clamp(readNumber(p, 'canScale', 1), 0.7, 1.35),
            conveyorWidth: clamp(readNumber(p, 'conveyorWidth', 1), 0.75, 1.35),
            loopPhase: conveyorClock.resolve(execution.frame, bpmSync, clamp(readNumber(p, 'conveyorSpeed', 1), 0, 2)),
            ledStrength: clamp(readNumber(p, 'ledStrength', 0.85), 0, 1.5),
            glow: GLOW_GAIN,
            background: rgb(HALL_BACKGROUND),
            structure: rgb(readColor(p, 'structureColor', [0.52, 0.59, 0.62, 1])),
            canWhite: rgb(CAN_WHITE),
            energy: rgb(readColor(p, 'reactorColor', [0.28, 0.62, 0.18, 1])),
            darkMetal: rgb(DARK_METAL),
            creatureLabel: creatureLabel(execution.lightingEnvironment?.quality ?? 'high'),
            lighting,
            lightColors: lightColors(p),
          })
        },
      })
      return {
        lifecycle: {
          update: ({ parameters, frame: updateFrame }: Cinema2ModuleUpdateContext) => {
            design = resolveDesign(parameters)
            const audio = selectCinema2MainframeAudio(updateFrame.audio, updateFrame.transport?.trackId)
            const acceptedFrame = audio === updateFrame.audio ? updateFrame : { ...updateFrame, audio }
            const playback = resolveCinema2MainframePlaybackState(acceptedFrame, audio)
            const timeSec = resolveCinema2MainframeTimeSec(acceptedFrame)
            const sourceIdentity = updateFrame.transport?.paused && !audio && triggerSourceIdentity != null && updateFrame.transport.trackId === triggerTrackId
              ? triggerSourceIdentity : resolveCinema2MainframeSourceIdentity(updateFrame, audio)
            const reset = shouldResetCinema2MainframeDropState(acceptedFrame,
              { timeSec, sourceIdentity, playback },
              { timeSec: triggerPreviousTimeSec, sourceIdentity: triggerSourceIdentity, contextGeneration: triggerContextGeneration, playback: previousPlayback })
            if (reset) { dropCoordinator.reset(); beatClock.reset() }
            const cues = musicalCues.splice(0)
            const dispatched = reset || playback !== 'playing' ? [] : resolveCinema2MainframeMusicalEvents(acceptedFrame, cues)
            const coordinated = dropCoordinator.update(acceptedFrame, dispatched)
            const timing = beatClock.resolve(acceptedFrame, design.bpmSync)
            const triggerEventId = reset ? null : resolveCinema2MainframeTriggerEventIdentity(acceptedFrame, design.trigger, triggerPreviousTimeSec, coordinated.dropEventId, {
              previousBeat: triggerPreviousBeat, current: timing,
            })
            selection = patternController.update({
              authoredPattern: design.pattern, patternChange: design.patternChange, trigger: design.trigger, triggerEventId, absoluteBeat: timing.beats, reset,
            })
            // The shared engine's own pattern output is not used; it supplies the envelopes, signals and buildup the BWC programs read. Its clock
            // runs from zero here so each program can be timed from its own start (the base pattern's, or an override's).
            const music = reactivity.update(updateFrame, 'outward-bus', design.bpmSync, 0, coordinated.events, timing.beats)
            performance = autoPerformance.update({
              enabled: design.autoPerformance && music.active, absoluteBeat: timing.beats, buildCharge: music.buildCharge,
              dropEventId: coordinated.dropEventId, patternEdited: previousAuthoredPattern != null && design.pattern !== previousAuthoredPattern, reset,
            })
            previousAuthoredPattern = design.pattern
            const onStage = performance.pattern ?? selection.activePattern
            const startBeat = performance.pattern ? performance.startBeat : selection.patternStartBeat
            lighting = blendBwcLightingReactivity(evaluateCinema2BwcPattern({
              pattern: onStage, beats: Math.max(0, music.beats - startBeat), level: music.level, buildCharge: music.buildCharge,
              signals: music.signals, impulses: music.impulses, active: music.active, style: design.style,
            }), design.lightReactivity)
            triggerPreviousTimeSec = timeSec
            triggerPreviousBeat = timing.beats
            triggerSourceIdentity = sourceIdentity
            triggerTrackId = updateFrame.transport?.trackId
            triggerContextGeneration = updateFrame.contextGeneration
            previousPlayback = playback
          },
          dispose() {
            labelHandle?.release(); labelHandle = null
            conveyorClock.reset(); reactivity.reset(); beatClock.reset(); dropCoordinator.reset(); patternController.reset(); autoPerformance.reset()
            musicalCues.splice(0)
            triggerPreviousBeat = null
            previousAuthoredPattern = null
          },
        },
        handleAction: (action: string, event: Readonly<Cinema2DispatchedTargetAction>) => {
          if (action !== 'musicalCue' || !event.eventId || !event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) return
          const kind = (event.payload as { kind?: unknown }).kind
          if (typeof kind !== 'string' || kind === 'eightBeat' || !CINEMA2_MAINFRAME_IMPULSE_IDS.includes(kind as Cinema2MainframeMusicalCueKind)) return
          if (musicalCues.some(cue => cue.dispatchedEventId === event.eventId)) return
          if (musicalCues.length >= 128) musicalCues.shift()
          musicalCues.push({ kind: kind as Cinema2MainframeMusicalCueKind, dispatchedEventId: event.eventId })
        },
        render: { providers: Object.freeze([provider]) },
        inspect: () => Object.freeze({
          authoredPattern: design.pattern, activePattern: selection.activePattern, patternChange: design.patternChange, trigger: design.trigger,
          patternStartBeat: selection.patternStartBeat, autoPerformance: design.autoPerformance, performance, onStage: performance.pattern ?? selection.activePattern, bpmSync: design.bpmSync, lightReactivity: design.lightReactivity, style: design.style, lighting,
        }),
      }
    },
  })
}

export const cinema2BwcNativeModuleDefinition = createCinema2BwcNativeModuleDefinition()
function lightColors(parameters: Parameters): Readonly<Cinema2BwcLightColors> {
  return Object.freeze({
    reactor: rgb(readColor(parameters, 'reactorColor', [0.28, 0.62, 0.18, 1])),
    pipes: rgb(readColor(parameters, 'pipeColor', [0.28, 0.62, 0.18, 1])),
    wall: rgb(readColor(parameters, 'wallColor', [0.82, 0.94, 1, 1])),
    ceiling: rgb(readColor(parameters, 'ceilingColor', [0.82, 0.94, 1, 1])),
  })
}
function resolveDesign(parameters: Parameters): Readonly<{ pattern: Cinema2BwcPatternId; patternChange: boolean; trigger: Cinema2MainframeTriggerId; bpmSync: boolean; autoPerformance: boolean; lightReactivity: number; style: Readonly<Cinema2BwcPatternStyle> }> {
  const pattern = parameters.get('pattern')
  const trigger = parameters.get('trigger')
  return Object.freeze({
    pattern: typeof pattern === 'string' && CINEMA2_BWC_PATTERN_IDS.includes(pattern as Cinema2BwcPatternId) ? pattern as Cinema2BwcPatternId : CINEMA2_BWC_DEFAULT_PATTERN,
    patternChange: readBoolean(parameters, 'patternChange', false),
    trigger: typeof trigger === 'string' && CINEMA2_MAINFRAME_TRIGGER_IDS.includes(trigger as Cinema2MainframeTriggerId) ? trigger as Cinema2MainframeTriggerId : 'bar4',
    bpmSync: readBoolean(parameters, 'bpmSync', true),
    autoPerformance: readBoolean(parameters, 'autoPerformance', true),
    lightReactivity: clamp(readNumber(parameters, 'lightReactivity', 1), 0, 1),
    style: Object.freeze({
      pulseWidth: clamp(readNumber(parameters, 'pulseWidth', 0.5), 0, 1),
      dropIntensity: clamp(readNumber(parameters, 'dropIntensity', 1), 0, 1),
      flicker: clamp(readNumber(parameters, 'flicker', 0.15), 0, 1),
    }),
  })
}
function validateModule(_module: Readonly<Cinema2ModuleManifest>): readonly Cinema2ModuleDiagnostic[] { return Object.freeze([]) }
type Parameters = Cinema2ModuleCreateContext['parameters']
function readNumber(parameters: Parameters, name: string, fallback: number): number { const value = parameters.get(name); return typeof value === 'number' && Number.isFinite(value) ? value : fallback }
function readColor(parameters: Parameters, name: string, fallback: Cinema2Color): Cinema2Color { const value = parameters.get(name); return Array.isArray(value) && value.length === 4 && value.every(component => typeof component === 'number' && Number.isFinite(component)) ? value as unknown as Cinema2Color : fallback }
function readBoolean(parameters: Parameters, name: string, fallback: boolean): boolean { const value = parameters.get(name); return typeof value === 'boolean' ? value : fallback }
function rgb(value: Cinema2Color): readonly [number, number, number] { return [value[0], value[1], value[2]] }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)) }
