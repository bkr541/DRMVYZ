import {
  cinema2StableId,
  type Cinema2Color,
  type Cinema2ModuleManifest,
  type Cinema2ModuleTypeId,
} from '../contracts/Cinema2NativePresetManifest'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleDiagnostic,
  Cinema2ModuleRenderExecutionContext,
  Cinema2ModuleTypeDefinition,
  Cinema2ModuleUpdateContext,
} from './Cinema2ModuleContracts'
import {
  CINEMA2_CATHEDRAL_LAYOUT_CONFIG,
  buildCinema2CathedralLayout,
  packCinema2CathedralInstances,
  type Cinema2CathedralLayout,
  type Cinema2CathedralLayoutConfig,
} from './cathedral/Cinema2CathedralLayout'
import { Cinema2CathedralRenderer } from './cathedral/Cinema2CathedralRenderer'
import {
  CINEMA2_CATHEDRAL_PROGRAMS,
  CINEMA2_CATHEDRAL_TRIGGER_IDS,
  Cinema2CathedralProgramController,
  createCinema2CathedralProgramCycle,
  type Cinema2CathedralProgram,
} from './cathedral/Cinema2CathedralProgramController'
import { resolveCinema2AfterhoursTriggerEventIdentity } from './Cinema2AfterhoursNativeModule'
import {
  Cinema2MainframeBeatClockResolver,
  resolveCinema2MainframeTimeSec,
} from './mainframe/Cinema2MainframePatternEngine'
import {
  resolveCinema2MainframePlaybackState,
  resolveCinema2MainframeSourceIdentity,
  selectCinema2MainframeAudio,
} from './mainframe/Cinema2MainframeAudioDelivery'
import { resolveCinema2MainframeTriggerEventIdentity } from './mainframe/Cinema2MainframePatternController'
import { shouldResetCinema2MainframeDropState } from './mainframe/Cinema2MainframeMusicAdapter'

export const CINEMA2_CATHEDRAL_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('cathedral-native')
export const CINEMA2_CATHEDRAL_NATIVE_MODULE_VERSION = 1 as const

export { CINEMA2_CATHEDRAL_PROGRAMS, CINEMA2_CATHEDRAL_TRIGGER_IDS }
export type { Cinema2CathedralProgram }
export type { Cinema2CathedralTriggerId } from './cathedral/Cinema2CathedralProgramController'

const PROGRAM_INDEX: Readonly<Record<Cinema2CathedralProgram, number>> = Object.freeze({
  cathedralRun: 0,
  aisleChase: 1,
  alternatingRibs: 2,
  vaultReveal: 3,
  rupture: 4,
})

const DEFAULT_STRUCTURE = Object.freeze([0.018, 0.028, 0.052, 1]) as Cinema2Color
const DEFAULT_PRIMARY = Object.freeze([0.03, 0.84, 1, 1]) as Cinema2Color
const DEFAULT_ACCENT = Object.freeze([0.84, 0.58, 0.12, 1]) as Cinema2Color

export function createCinema2CathedralNativeModuleDefinition(options: {
  createRenderer?: (gl: WebGL2RenderingContext, instances: Float32Array) => Cinema2CathedralRenderer
} = {}): Readonly<Cinema2ModuleTypeDefinition> {
  const createRenderer = options.createRenderer ?? ((gl, instances) => new Cinema2CathedralRenderer(gl, instances))
  return Object.freeze({
    typeId: CINEMA2_CATHEDRAL_NATIVE_MODULE_TYPE_ID,
    version: CINEMA2_CATHEDRAL_NATIVE_MODULE_VERSION,
    validate: validateModule,
    create(context: Cinema2ModuleCreateContext) {
      const layout = resolveLayout(context.module)
      const packed = packCinema2CathedralInstances(layout.instances)
      const renderer = context.resources.acquire(
        `cathedral:${layout.config.archCount}:${layout.config.archSegments}:${layout.config.spacing}:${layout.config.transitionRoomLength}:${layout.config.transitionRoomHalfWidth}:${layout.config.transitionRoomHeight}`,
        'Cinema2CathedralRenderer',
        gl => createRenderer(gl, packed),
        value => value.dispose(),
      )
      const estimatedGpuBytes = renderer.estimateGpuBytes()
      context.resources.reportGpuBytes(estimatedGpuBytes)
      const initialProgram = readEnum(context, 'program', CINEMA2_CATHEDRAL_PROGRAMS, 'cathedralRun')
      const programController = new Cinema2CathedralProgramController(
        createCinema2CathedralProgramCycle(index => context.randomness.sample('cathedral-program-cycle', index)),
        initialProgram,
      )
      const beatClock = new Cinema2MainframeBeatClockResolver()
      let activeProgram = initialProgram
      let previousTimeSec: number | null = null
      let previousBeat: number | null = null
      let previousSourceIdentity: string | null = null
      let previousTrackId: string | null | undefined
      let previousContextGeneration: number | null = null
      let previousPlayback: ReturnType<typeof resolveCinema2MainframePlaybackState> | null = null

      const provider = Object.freeze({
        id: `${context.module.id}:cathedral-world`,
        moduleId: context.module.id,
        intent: 'world' as const,
        execute(execution: Cinema2ModuleRenderExecutionContext) {
          if (!execution.depthAvailable) throw new Error(`Cinema 2.0 Cathedral module "${context.module.id}" requires a depth attachment.`)
          if (!execution.camera) throw new Error(`Cinema 2.0 Cathedral module "${context.module.id}" requires final Camera Runtime state.`)
          const auto = readBoolean(context, 'autoPerformance', true)
          const build = clamp(readNumber(context, 'buildAmount', 0), 0, 1)
          const drop = clamp(readNumber(context, 'dropAccent', 0), 0, 1)
          const energy = clamp(readNumber(context, 'overallEnergy', 0), 0, 1)
          const program = auto && drop > 0.04 ? 'rupture' : auto && build > 0.16 ? 'vaultReveal' : activeProgram
          const quality = execution.lightingEnvironment?.quality ?? 'high'
          renderer.draw({
            viewProjection: execution.camera.viewProjectionMatrix,
            cameraPosition: execution.camera.position,
            repeatDistance: layout.repeatDistance,
            repeatOriginZ: 0,
            timeSeconds: resolveFrameTimeSeconds(execution.frame),
            structureColor: rgb(readColor(context, 'structureColor', DEFAULT_STRUCTURE)),
            primaryColor: rgb(readColor(context, 'primaryColor', DEFAULT_PRIMARY)),
            accentColor: rgb(readColor(context, 'accentColor', DEFAULT_ACCENT)),
            intensity: clamp(readNumber(context, 'intensity', 1), 0, 2),
            activeDensity: clamp(readNumber(context, 'activeDensity', 0.72) + energy * 0.12, 0.08, 1),
            expansion: clamp(readNumber(context, 'expansion', 0.2), 0, 1.5),
            sparkDensity: clamp(readNumber(context, 'sparkDensity', 0.45), 0, 1),
            program: PROGRAM_INDEX[program],
            kick: clamp(readNumber(context, 'kickAccent', 0), 0, 1),
            snare: clamp(readNumber(context, 'snareAccent', 0), 0, 1),
            beat: clamp(readNumber(context, 'beatAccent', 0), 0, 1),
            downbeat: clamp(readNumber(context, 'downbeatAccent', 0), 0, 1),
            phrase: clamp(readNumber(context, 'phraseAccent', 0), 0, 1),
            energy,
            build,
            drop,
            vocalRestraint: clamp(readNumber(context, 'vocalRestraint', 0), 0, 1),
            quality: quality === 'low' ? 0 : quality === 'medium' ? 0.55 : 1,
          })
        },
      })

      return {
        lifecycle: {
          update: ({ parameters, frame }: Cinema2ModuleUpdateContext) => {
            const authoredProgram = readEnumFromParameters(parameters, 'program', CINEMA2_CATHEDRAL_PROGRAMS, 'cathedralRun')
            const patternChange = readBooleanFromParameters(parameters, 'patternChange', false)
            const trigger = readEnumFromParameters(parameters, 'trigger', CINEMA2_CATHEDRAL_TRIGGER_IDS, 'bar4')
            const bpmSync = readBooleanFromParameters(parameters, 'bpmSync', true)
            const audio = selectCinema2MainframeAudio(frame.audio, frame.transport?.trackId)
            const acceptedFrame = audio === frame.audio ? frame : { ...frame, audio }
            const playback = resolveCinema2MainframePlaybackState(acceptedFrame, audio)
            const timeSec = resolveCinema2MainframeTimeSec(acceptedFrame)
            const sourceIdentity = frame.transport?.paused && !audio && previousSourceIdentity != null
              && frame.transport.trackId === previousTrackId
              ? previousSourceIdentity
              : resolveCinema2MainframeSourceIdentity(acceptedFrame, audio)
            const reset = shouldResetCinema2MainframeDropState(
              acceptedFrame,
              { timeSec, sourceIdentity, playback },
              {
                timeSec: previousTimeSec,
                sourceIdentity: previousSourceIdentity,
                contextGeneration: previousContextGeneration,
                playback: previousPlayback,
              },
            )
            if (reset) beatClock.reset()
            const timing = beatClock.resolve(acceptedFrame, bpmSync)
            const triggerFrame = acceptedFrame.transport
              ? { ...acceptedFrame, transport: { ...acceptedFrame.transport, sourcePresent: true } }
              : acceptedFrame
            const dropEventId = playback === 'playing'
              ? resolveCinema2AfterhoursTriggerEventIdentity(triggerFrame, 'drop', previousTimeSec)
              : null
            const triggerEventId = reset
              ? null
              : resolveCinema2MainframeTriggerEventIdentity(acceptedFrame, trigger, previousTimeSec, dropEventId, {
                previousBeat,
                current: timing,
              })
            activeProgram = programController.update({
              authoredProgram,
              patternChange,
              trigger,
              triggerEventId,
              reset,
            }).activeProgram
            previousTimeSec = timeSec
            previousBeat = timing.beats
            previousSourceIdentity = sourceIdentity
            previousTrackId = frame.transport?.trackId
            previousContextGeneration = frame.contextGeneration
            previousPlayback = playback
          },
          dispose: () => {
            programController.reset()
            beatClock.reset()
          },
        },
        render: { providers: Object.freeze([provider]) },
      }
    },
  })
}

export const cinema2CathedralNativeModuleDefinition = createCinema2CathedralNativeModuleDefinition()

function resolveLayout(module: Readonly<Cinema2ModuleManifest>): Readonly<Cinema2CathedralLayout> {
  const config: Partial<Cinema2CathedralLayoutConfig> = {}
  for (const property of Object.keys(CINEMA2_CATHEDRAL_LAYOUT_CONFIG) as (keyof typeof CINEMA2_CATHEDRAL_LAYOUT_CONFIG)[]) {
    const value = readConfigNumber(module, property)
    if (value !== undefined) config[property] = value
  }
  return buildCinema2CathedralLayout(config)
}

function validateModule(module: Readonly<Cinema2ModuleManifest>): readonly Cinema2ModuleDiagnostic[] {
  const diagnostics: Cinema2ModuleDiagnostic[] = []
  for (const property of Object.keys(CINEMA2_CATHEDRAL_LAYOUT_CONFIG)) {
    const value = module.config?.[property]
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) {
      diagnostics.push({
        code: 'CINEMA2_CATHEDRAL_CONFIG_INVALID',
        path: `$.config.${property}`,
        message: `Cathedral module config "${property}" must be a positive finite number.`,
      })
    }
  }
  for (const property of ['archCount', 'archSegments'] as const) {
    const value = module.config?.[property]
    if (typeof value === 'number' && Number.isFinite(value) && value > 0 && !Number.isInteger(value)) {
      diagnostics.push({
        code: 'CINEMA2_CATHEDRAL_CONFIG_INTEGER_REQUIRED',
        path: `$.config.${property}`,
        message: `Cathedral module config "${property}" must be an integer.`,
      })
    }
  }
  return Object.freeze(diagnostics.map(diagnostic => Object.freeze(diagnostic)))
}

function readConfigNumber(module: Readonly<Cinema2ModuleManifest>, name: string): number | undefined {
  const value = module.config?.[name]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readNumber(context: Cinema2ModuleCreateContext, name: string, fallback: number): number {
  const value = context.parameters.get(name)
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readBoolean(context: Cinema2ModuleCreateContext, name: string, fallback: boolean): boolean {
  const value = context.parameters.get(name)
  return typeof value === 'boolean' ? value : fallback
}

function readBooleanFromParameters(parameters: Cinema2ModuleUpdateContext['parameters'], name: string, fallback: boolean): boolean {
  const value = parameters.get(name)
  return typeof value === 'boolean' ? value : fallback
}

function readEnum<const T extends string>(context: Cinema2ModuleCreateContext, name: string, allowed: readonly T[], fallback: T): T {
  const value = context.parameters.get(name)
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback
}

function readEnumFromParameters<const T extends string>(parameters: Cinema2ModuleUpdateContext['parameters'], name: string, allowed: readonly T[], fallback: T): T {
  const value = parameters.get(name)
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback
}

function readColor(context: Cinema2ModuleCreateContext, name: string, fallback: Cinema2Color): Cinema2Color {
  const value = context.parameters.get(name)
  return Array.isArray(value) && value.length === 4 && value.every(component => typeof component === 'number' && Number.isFinite(component))
    ? value as unknown as Cinema2Color
    : fallback
}

function rgb(value: Cinema2Color): readonly [number, number, number] {
  return [value[0], value[1], value[2]]
}

function resolveFrameTimeSeconds(frame: Cinema2ModuleRenderExecutionContext['frame']): number {
  if (frame.transport?.sourcePresent && Number.isFinite(frame.transport.timeSec)) return Math.max(0, frame.transport.timeSec)
  const audioTime = frame.audio?.upstream.timeSec
  if (typeof audioTime === 'number' && Number.isFinite(audioTime)) return Math.max(0, audioTime)
  return Number.isFinite(frame.elapsedTimeSec) ? Math.max(0, frame.elapsedTimeSec) : 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
