import { cinema2StableId, type Cinema2Color, type Cinema2ModuleManifest, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleCreateContext, Cinema2ModuleDiagnostic, Cinema2ModuleRenderExecutionContext, Cinema2ModuleTypeDefinition, Cinema2ModuleUpdateContext } from './Cinema2ModuleContracts'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from './Cinema2AfterhoursNativeModule'
import { resolveCinema2MainframePlaybackState, resolveCinema2MainframeSourceIdentity, selectCinema2MainframeAudio } from './mainframe/Cinema2MainframeAudioDelivery'
import { shouldResetCinema2MainframeDropState } from './mainframe/Cinema2MainframeMusicAdapter'
import { Cinema2MainframeBeatClockResolver, resolveCinema2MainframeTimeSec } from './mainframe/Cinema2MainframePatternEngine'
import { resolveCinema2MainframeTriggerEventIdentity } from './mainframe/Cinema2MainframePatternController'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import { Cinema2SixfoldRenderer, type Cinema2SixfoldDrawState } from './sixfold/Cinema2SixfoldRenderer'

export const CINEMA2_SIXFOLD_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('sixfold-native')
export const CINEMA2_SIXFOLD_NATIVE_MODULE_VERSION = 1 as const
export const CINEMA2_SIXFOLD_PATTERNS = Object.freeze(['facetRelay', 'hexBloom', 'spiralDescent', 'splitPrism', 'coreImplosion', 'chamberPulse'] as const)
export type Cinema2SixfoldPattern = typeof CINEMA2_SIXFOLD_PATTERNS[number]
export type Cinema2SixfoldTriggerId = Cinema2AfterhoursTriggerId
export const CINEMA2_SIXFOLD_TRIGGER_IDS = CINEMA2_AFTERHOURS_TRIGGER_IDS

const PATTERN_INDEX: Readonly<Record<Cinema2SixfoldPattern, number>> = Object.freeze({
  facetRelay: 0,
  hexBloom: 1,
  spiralDescent: 2,
  splitPrism: 3,
  coreImplosion: 4,
  chamberPulse: 5,
})

export class Cinema2SixfoldPatternController {
  private active: Cinema2SixfoldPattern
  private previousEvent: string | null = null
  private previousAuthored: Cinema2SixfoldPattern | null = null
  private previousEnabled: boolean | null = null
  private previousTrigger: Cinema2SixfoldTriggerId | null = null

  constructor(private readonly cycle: readonly Cinema2SixfoldPattern[], initial: Cinema2SixfoldPattern = 'facetRelay') {
    this.active = initial
  }

  update(input: Readonly<{ authored: Cinema2SixfoldPattern; enabled: boolean; trigger: Cinema2SixfoldTriggerId; eventId: string | null; reset: boolean }>): Cinema2SixfoldPattern {
    const authorityChanged = this.previousAuthored != null && input.authored !== this.previousAuthored
    const toggleChanged = this.previousEnabled != null && input.enabled !== this.previousEnabled
    if (input.reset || authorityChanged || toggleChanged || this.previousAuthored == null) {
      this.active = input.authored
      this.previousEvent = input.eventId
    } else if (this.previousTrigger !== input.trigger) {
      this.previousEvent = input.eventId
    } else if (!input.enabled) {
      this.active = input.authored
      this.previousEvent = input.eventId
    } else if (input.eventId && input.eventId !== this.previousEvent) {
      const current = this.cycle.indexOf(this.active)
      this.active = this.cycle[(current < 0 ? 0 : current + 1) % this.cycle.length] ?? 'facetRelay'
      this.previousEvent = input.eventId
    }
    this.previousAuthored = input.authored
    this.previousEnabled = input.enabled
    this.previousTrigger = input.trigger
    return this.active
  }

  reset(): void {
    this.previousEvent = null
    this.previousAuthored = null
    this.previousEnabled = null
    this.previousTrigger = null
  }
}

/** Six semantic response lanes: iris, mirror facets, recursive layers, mechanisms, illumination and locking structure. */
export function resolveCinema2SixfoldComponentResponses(parameters: Cinema2ModuleCreateContext['parameters']): readonly [number, number, number, number, number, number] {
  const energy = clamp(readNumber(parameters, 'overallEnergy', 0), 0, 1)
  const bass = clamp(readNumber(parameters, 'bassPressure', 0), 0, 1)
  const mids = clamp(readNumber(parameters, 'midAmount', 0), 0, 1)
  const kick = clamp(readNumber(parameters, 'kickAccent', 0), 0, 1)
  const snare = clamp(readNumber(parameters, 'snareAccent', 0), 0, 1)
  const highs = clamp(readNumber(parameters, 'highsAmount', 0), 0, 1)
  const downbeat = clamp(readNumber(parameters, 'downbeatAccent', 0), 0, 1)
  const phrase = clamp(readNumber(parameters, 'phraseAccent', 0), 0, 1)
  const build = clamp(readNumber(parameters, 'buildAmount', 0), 0, 1)
  const drop = clamp(readNumber(parameters, 'dropAccent', 0), 0, 1)
  return Object.freeze([
    clamp(bass * 0.62 + kick * 0.78 + build * 0.24, 0, 1),
    clamp(snare * 0.7 + highs * 0.28 + energy * 0.22, 0, 1),
    clamp(energy * 0.46 + bass * 0.36 + phrase * 0.52, 0, 1),
    clamp(mids * 0.72 + downbeat * 0.38 + build * 0.3, 0, 1),
    clamp(energy * 0.58 + highs * 0.58 + kick * 0.22, 0, 1),
    clamp(mids * 0.34 + downbeat * 0.74 + drop * 0.82, 0, 1),
  ] as const)
}

export function createCinema2SixfoldNativeModuleDefinition(options: { loadLibrary?: () => Promise<Cinema2ThreeLibrary> } = {}): Readonly<Cinema2ModuleTypeDefinition> {
  const loadLibrary = options.loadLibrary ?? loadCinema2ThreeLibrary
  return Object.freeze({
    typeId: CINEMA2_SIXFOLD_NATIVE_MODULE_TYPE_ID,
    version: CINEMA2_SIXFOLD_NATIVE_MODULE_VERSION,
    validate: validateModule,
    create(context: Cinema2ModuleCreateContext) {
      let renderer: Cinema2SixfoldRenderer | null = null
      let loading: Promise<void> | null = null
      let failed = false
      let disposed = false
      const diagnostics: Cinema2ModuleDiagnostic[] = []
      let activePattern = readEnum(context.parameters, 'look', CINEMA2_SIXFOLD_PATTERNS, 'facetRelay')
      const cycle = shuffledCycle(index => context.randomness.sample('sixfold-pattern-cycle', index))
      const controller = new Cinema2SixfoldPatternController(cycle, activePattern)
      const beatClock = new Cinema2MainframeBeatClockResolver()
      let previousTimeSec: number | null = null
      let previousBeat: number | null = null
      let previousSourceIdentity: string | null = null
      let previousContextGeneration: number | null = null
      let previousTrackId: string | null | undefined
      let previousPlayback: ReturnType<typeof resolveCinema2MainframePlaybackState> | null = null
      let patternPhaseBeats = 0

      const ensureRenderer = () => {
        if (renderer || failed || loading) return
        loading = loadLibrary().then(library => {
          if (disposed) return
          renderer = context.resources.acquire(
            'sixfold:recursive-mirror-chamber:v2',
            'Cinema2SixfoldRenderer',
            gl => new Cinema2SixfoldRenderer(gl, library),
            value => value.dispose(),
          )
          context.resources.reportGpuBytes(renderer.estimateGpuBytes())
        }).catch(error => {
          failed = true
          diagnostics.push(Object.freeze({
            code: 'CINEMA2_SIXFOLD_RENDERER_LOAD_FAILED',
            path: `module.${context.module.id}`,
            message: error instanceof Error ? error.message : 'Sixfold could not initialize its Three.js chamber renderer.',
          }))
        })
      }

      const provider = Object.freeze({
        id: `${context.module.id}:sixfold-three-world`,
        moduleId: context.module.id,
        intent: 'world' as const,
        execute(execution: Cinema2ModuleRenderExecutionContext) {
          ensureRenderer()
          if (!renderer) return
          const responses = resolveCinema2SixfoldComponentResponses(context.parameters)
          const auto = readBoolean(context.parameters, 'autoPerformance', true)
          const build = readNumber(context.parameters, 'buildAmount', 0)
          const drop = readNumber(context.parameters, 'dropAccent', 0)
          const resolvedPattern: Cinema2SixfoldPattern = auto
            ? drop > 0.38 ? 'coreImplosion' : build > 0.52 ? 'spiralDescent' : activePattern
            : activePattern
          const state: Cinema2SixfoldDrawState = {
            timeSeconds: execution.frame.transport?.timeSec ?? execution.frame.elapsedTimeSec,
            pattern: PATTERN_INDEX[resolvedPattern],
            patternPhaseBeats,
            intensity: clamp(readNumber(context.parameters, 'intensity', 0.9), 0, 2),
            chamberRadius: clamp(readNumber(context.parameters, 'spread', 1.58) / 1.58, 0.35, 1.8),
            chamberDepth: clamp(readNumber(context.parameters, 'depthSpread', 1.42), 0.25, 2.5),
            facetScale: clamp(readNumber(context.parameters, 'nodeScale', 0.18) / 0.18, 0.2, 2.2),
            mechanicalDetail: clamp(readNumber(context.parameters, 'nodeDensity', 1), 0, 1),
            perspectiveReveal: clamp(readNumber(context.parameters, 'scaleVariation', 0.56), 0, 1),
            idleDrift: clamp(readNumber(context.parameters, 'drift', 0.1), 0, 2),
            railGlow: clamp(readNumber(context.parameters, 'edgeGlow', 1.78), 0, 3),
            irisGlow: clamp(readNumber(context.parameters, 'internalGlow', 1.42), 0, 3),
            fineDetail: clamp(readNumber(context.parameters, 'starDensity', 0.12), 0, 1),
            fold: clamp(0.55 + readNumber(context.parameters, 'collapse', 0) + readNumber(context.parameters, 'burst', 0.12) * 0.3, 0, 1.8),
            rotation: readNumber(context.parameters, 'spin', 0.42),
            responses,
            build: clamp(build, 0, 1),
            drop: clamp(drop, 0, 1),
            vocalPresence: clamp(readNumber(context.parameters, 'vocalPresence', 0), 0, 1),
            colors: [
              rgb(readColor(context.parameters, 'primaryColor', [0.11, 0.84, 1, 1])),
              rgb(readColor(context.parameters, 'secondaryColor', [0.28, 0.18, 0.8, 1])),
              rgb(readColor(context.parameters, 'accentColor', [1, 0.24, 0.72, 1])),
              rgb(readColor(context.parameters, 'highlightColor', [0.92, 0.99, 1, 1])),
            ],
          }
          renderer.draw(execution, state)
        },
      })

      return {
        lifecycle: {
          update({ parameters, frame }: Cinema2ModuleUpdateContext) {
            const authored = readEnum(parameters, 'look', CINEMA2_SIXFOLD_PATTERNS, 'facetRelay')
            const enabled = readBoolean(parameters, 'patternChange', false)
            const trigger = readEnum(parameters, 'trigger', CINEMA2_SIXFOLD_TRIGGER_IDS, 'bar4')
            const audio = selectCinema2MainframeAudio(frame.audio, frame.transport?.trackId)
            const accepted = audio === frame.audio ? frame : { ...frame, audio }
            const playback = resolveCinema2MainframePlaybackState(accepted, audio)
            const timeSec = resolveCinema2MainframeTimeSec(accepted)
            const sourceIdentity = frame.transport?.paused && !audio && previousSourceIdentity != null && frame.transport.trackId === previousTrackId
              ? previousSourceIdentity
              : resolveCinema2MainframeSourceIdentity(accepted, audio)
            const reset = shouldResetCinema2MainframeDropState(accepted, { timeSec, sourceIdentity, playback }, { timeSec: previousTimeSec, sourceIdentity: previousSourceIdentity, contextGeneration: previousContextGeneration, playback: previousPlayback })
            if (reset) beatClock.reset()
            const timing = beatClock.resolve(accepted, readBoolean(parameters, 'bpmSync', true))
            patternPhaseBeats = timing.beats
            const triggerFrame = accepted.transport ? { ...accepted, transport: { ...accepted.transport, sourcePresent: true } } : accepted
            const dropEventId = playback === 'playing' ? resolveCinema2AfterhoursTriggerEventIdentity(triggerFrame, 'drop', previousTimeSec) : null
            const eventId = reset ? null : resolveCinema2MainframeTriggerEventIdentity(accepted, trigger, previousTimeSec, dropEventId, { previousBeat, current: timing })
            activePattern = controller.update({ authored, enabled, trigger, eventId, reset })
            previousTimeSec = timeSec
            previousBeat = timing.beats
            previousSourceIdentity = sourceIdentity
            previousTrackId = frame.transport?.trackId
            previousContextGeneration = frame.contextGeneration
            previousPlayback = playback
          },
          dispose() {
            disposed = true
            controller.reset()
            beatClock.reset()
            renderer = null
          },
        },
        render: { providers: Object.freeze([provider]) },
        getDiagnostics: () => Object.freeze([...diagnostics]),
      }
    },
  })
}

export const cinema2SixfoldNativeModuleDefinition = createCinema2SixfoldNativeModuleDefinition()

function validateModule(_module: Readonly<Cinema2ModuleManifest>): readonly Cinema2ModuleDiagnostic[] { return Object.freeze([]) }
function shuffledCycle(sample: (index: number) => number): readonly Cinema2SixfoldPattern[] { const values = [...CINEMA2_SIXFOLD_PATTERNS]; for (let index = values.length - 1, sampleIndex = 0; index > 0; index -= 1, sampleIndex += 1) { const swap = Math.floor(clamp(sample(sampleIndex), 0, 0.999999) * (index + 1)); [values[index], values[swap]] = [values[swap]!, values[index]!] } return Object.freeze(values) }
type Parameters = Cinema2ModuleCreateContext['parameters']
function readNumber(parameters: Parameters, name: string, fallback: number): number { const value = parameters.get(name); return typeof value === 'number' && Number.isFinite(value) ? value : fallback }
function readBoolean(parameters: Parameters, name: string, fallback: boolean): boolean { const value = parameters.get(name); return typeof value === 'boolean' ? value : fallback }
function readEnum<const T extends string>(parameters: Parameters, name: string, values: readonly T[], fallback: T): T { const value = parameters.get(name); return typeof value === 'string' && values.includes(value as T) ? value as T : fallback }
function readColor(parameters: Parameters, name: string, fallback: Cinema2Color): Cinema2Color { const value = parameters.get(name); return Array.isArray(value) && value.length === 4 && value.every(component => typeof component === 'number' && Number.isFinite(component)) ? value as unknown as Cinema2Color : fallback }
function rgb(value: Cinema2Color): readonly [number, number, number] { return [value[0], value[1], value[2]] }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)) }
