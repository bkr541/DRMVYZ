import { cinema2StableId, type Cinema2Color, type Cinema2ModuleManifest, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleCreateContext, Cinema2ModuleDiagnostic, Cinema2ModuleRenderExecutionContext, Cinema2ModuleTypeDefinition, Cinema2ModuleUpdateContext } from './Cinema2ModuleContracts'
import { resolveCinema2AfterhoursTriggerEventIdentity } from './Cinema2AfterhoursNativeModule'
import { resolveCinema2MainframePlaybackState, resolveCinema2MainframeSourceIdentity, selectCinema2MainframeAudio } from './mainframe/Cinema2MainframeAudioDelivery'
import { Cinema2MainframeBeatClockResolver, resolveCinema2MainframeTimeSec } from './mainframe/Cinema2MainframePatternEngine'
import { resolveCinema2MainframeTriggerEventIdentity } from './mainframe/Cinema2MainframePatternController'
import { shouldResetCinema2MainframeDropState } from './mainframe/Cinema2MainframeMusicAdapter'
import { CINEMA2_ANCIENT_MACHINE_LAYOUT_CONFIG, buildCinema2AncientMachineLayout, packCinema2AncientMachineInstances, type Cinema2AncientMachineLayoutConfig } from './ancientMachine/Cinema2AncientMachineLayout'
import { CINEMA2_ANCIENT_MACHINE_LOOKS, CINEMA2_ANCIENT_MACHINE_TRIGGER_IDS, Cinema2AncientMachineProgramController, createCinema2AncientMachineLookCycle, type Cinema2AncientMachineLook } from './ancientMachine/Cinema2AncientMachineProgramController'
import { Cinema2AncientMachineRenderer } from './ancientMachine/Cinema2AncientMachineRenderer'

export const CINEMA2_ANCIENT_MACHINE_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('ancient-machine-native')
export const CINEMA2_ANCIENT_MACHINE_NATIVE_MODULE_VERSION = 1 as const
export { CINEMA2_ANCIENT_MACHINE_LOOKS, CINEMA2_ANCIENT_MACHINE_TRIGGER_IDS }
export type { Cinema2AncientMachineLook, Cinema2AncientMachineTriggerId } from './ancientMachine/Cinema2AncientMachineProgramController'

const LOOK_INDEX: Readonly<Record<Cinema2AncientMachineLook, number>> = Object.freeze({ oracleLock: 0, gearSun: 1, epochEngine: 2 })
const DEFAULT_METAL = Object.freeze([0.19, 0.17, 0.12, 1]) as Cinema2Color
const DEFAULT_GLYPH = Object.freeze([0.84, 0.71, 0.38, 1]) as Cinema2Color
const DEFAULT_INTERNAL = Object.freeze([0.22, 0.88, 0.82, 1]) as Cinema2Color

export function createCinema2AncientMachineNativeModuleDefinition(options: {
  createRenderer?: (gl: WebGL2RenderingContext, instances: Float32Array) => Cinema2AncientMachineRenderer
} = {}): Readonly<Cinema2ModuleTypeDefinition> {
  const createRenderer = options.createRenderer ?? ((gl, instances) => new Cinema2AncientMachineRenderer(gl, instances))
  return Object.freeze({
    typeId: CINEMA2_ANCIENT_MACHINE_NATIVE_MODULE_TYPE_ID,
    version: CINEMA2_ANCIENT_MACHINE_NATIVE_MODULE_VERSION,
    validate: validateModule,
    create(context: Cinema2ModuleCreateContext) {
      const config: Partial<Cinema2AncientMachineLayoutConfig> = {}
      for (const property of Object.keys(CINEMA2_ANCIENT_MACHINE_LAYOUT_CONFIG) as (keyof Cinema2AncientMachineLayoutConfig)[]) {
        const value = context.module.config?.[property]
        if (typeof value === 'number' && Number.isFinite(value)) config[property] = value
      }
      const layout = buildCinema2AncientMachineLayout(config)
      const packed = packCinema2AncientMachineInstances(layout.instances)
      const renderer = context.resources.acquire(
        `ancient-machine:${layout.config.ringCount}:${layout.config.segmentsPerRing}:${layout.config.glyphsPerRing}`,
        'Cinema2AncientMachineRenderer',
        gl => createRenderer(gl, packed),
        value => value.dispose(),
      )
      context.resources.reportGpuBytes(renderer.estimateGpuBytes())
      const initialLook = readEnum(context.parameters, 'look', CINEMA2_ANCIENT_MACHINE_LOOKS, 'oracleLock')
      const controller = new Cinema2AncientMachineProgramController(
        createCinema2AncientMachineLookCycle(index => context.randomness.sample('ancient-machine-look-cycle', index)),
        initialLook,
      )
      const beatClock = new Cinema2MainframeBeatClockResolver()
      let activeLook = initialLook
      let previousTimeSec: number | null = null
      let previousBeat: number | null = null
      let previousSourceIdentity: string | null = null
      let previousTrackId: string | null | undefined
      let previousContextGeneration: number | null = null
      let previousPlayback: ReturnType<typeof resolveCinema2MainframePlaybackState> | null = null

      const provider = Object.freeze({
        id: `${context.module.id}:ancient-machine-world`, moduleId: context.module.id, intent: 'world' as const,
        execute(execution: Cinema2ModuleRenderExecutionContext) {
          if (!execution.depthAvailable) throw new Error(`Cinema 2.0 Ancient Machine module "${context.module.id}" requires depth.`)
          if (!execution.camera) throw new Error(`Cinema 2.0 Ancient Machine module "${context.module.id}" requires a camera.`)
          const build = clamp(readNumber(context.parameters, 'buildAmount', 0), 0, 1)
          const drop = clamp(readNumber(context.parameters, 'dropAccent', 0), 0, 1)
          const auto = readBoolean(context.parameters, 'autoPerformance', true)
          const look = auto && drop > 0.05 ? 'gearSun' : auto && build > 0.18 ? 'epochEngine' : activeLook
          const quality = execution.lightingEnvironment?.quality ?? 'high'
          renderer.draw({
            viewProjection: execution.camera.viewProjectionMatrix,
            cameraPosition: execution.camera.position,
            timeSeconds: resolveTime(execution.frame), look: LOOK_INDEX[look],
            metalColor: rgb(readColor(context.parameters, 'metalColor', DEFAULT_METAL)),
            glyphColor: rgb(readColor(context.parameters, 'glyphColor', DEFAULT_GLYPH)),
            internalColor: rgb(readColor(context.parameters, 'internalColor', DEFAULT_INTERNAL)),
            intensity: clamp(readNumber(context.parameters, 'intensity', 0.82), 0, 2),
            rotationSpeed: clamp(readNumber(context.parameters, 'rotationSpeed', 0.35), -2, 2),
            counterRotation: clamp(readNumber(context.parameters, 'counterRotation', 0.72), 0, 2),
            mechanicalDepth: clamp(readNumber(context.parameters, 'mechanicalDepth', 1), 0.25, 2),
            lockProgress: clamp(readNumber(context.parameters, 'lockProgress', 0.82), 0, 1),
            aperture: clamp(readNumber(context.parameters, 'aperture', 0.12) + drop * 0.55, 0, 1),
            glyphDensity: clamp(readNumber(context.parameters, 'glyphDensity', 0.86), 0, 1),
            energy: clamp(readNumber(context.parameters, 'overallEnergy', 0), 0, 1),
            beat: clamp(readNumber(context.parameters, 'beatAccent', 0), 0, 1),
            kick: clamp(readNumber(context.parameters, 'kickAccent', 0), 0, 1),
            snare: clamp(readNumber(context.parameters, 'snareAccent', 0), 0, 1),
            downbeat: clamp(readNumber(context.parameters, 'downbeatAccent', 0), 0, 1),
            phrase: clamp(readNumber(context.parameters, 'phraseAccent', 0), 0, 1),
            build, drop, quality: quality === 'low' ? 0 : quality === 'medium' ? 0.55 : 1,
          })
        },
      })

      return {
        lifecycle: {
          update: ({ parameters, frame }: Cinema2ModuleUpdateContext) => {
            const authoredLook = readEnum(parameters, 'look', CINEMA2_ANCIENT_MACHINE_LOOKS, 'oracleLock')
            const patternChange = readBoolean(parameters, 'patternChange', false)
            const trigger = readEnum(parameters, 'trigger', CINEMA2_ANCIENT_MACHINE_TRIGGER_IDS, 'bar4')
            const audio = selectCinema2MainframeAudio(frame.audio, frame.transport?.trackId)
            const acceptedFrame = audio === frame.audio ? frame : { ...frame, audio }
            const playback = resolveCinema2MainframePlaybackState(acceptedFrame, audio)
            const timeSec = resolveCinema2MainframeTimeSec(acceptedFrame)
            const sourceIdentity = frame.transport?.paused && !audio && previousSourceIdentity != null && frame.transport.trackId === previousTrackId
              ? previousSourceIdentity : resolveCinema2MainframeSourceIdentity(acceptedFrame, audio)
            const reset = shouldResetCinema2MainframeDropState(acceptedFrame, { timeSec, sourceIdentity, playback }, {
              timeSec: previousTimeSec, sourceIdentity: previousSourceIdentity, contextGeneration: previousContextGeneration, playback: previousPlayback,
            })
            if (reset) beatClock.reset()
            const timing = beatClock.resolve(acceptedFrame, readBoolean(parameters, 'bpmSync', true))
            const triggerFrame = acceptedFrame.transport ? { ...acceptedFrame, transport: { ...acceptedFrame.transport, sourcePresent: true } } : acceptedFrame
            const dropEventId = playback === 'playing' ? resolveCinema2AfterhoursTriggerEventIdentity(triggerFrame, 'drop', previousTimeSec) : null
            const triggerEventId = reset ? null : resolveCinema2MainframeTriggerEventIdentity(acceptedFrame, trigger, previousTimeSec, dropEventId, { previousBeat, current: timing })
            activeLook = controller.update({ authoredLook, patternChange, trigger, triggerEventId, reset }).activeLook
            previousTimeSec = timeSec; previousBeat = timing.beats; previousSourceIdentity = sourceIdentity
            previousTrackId = frame.transport?.trackId; previousContextGeneration = frame.contextGeneration; previousPlayback = playback
          },
          dispose: () => { controller.reset(); beatClock.reset() },
        },
        render: { providers: Object.freeze([provider]) },
      }
    },
  })
}

export const cinema2AncientMachineNativeModuleDefinition = createCinema2AncientMachineNativeModuleDefinition()

function validateModule(module: Readonly<Cinema2ModuleManifest>): readonly Cinema2ModuleDiagnostic[] {
  const diagnostics: Cinema2ModuleDiagnostic[] = []
  for (const property of Object.keys(CINEMA2_ANCIENT_MACHINE_LAYOUT_CONFIG)) {
    const value = module.config?.[property]
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) diagnostics.push({ code: 'CINEMA2_ANCIENT_MACHINE_CONFIG_INVALID', path: `$.config.${property}`, message: `Ancient Machine config "${property}" must be a positive finite number.` })
  }
  return Object.freeze(diagnostics.map(value => Object.freeze(value)))
}

type Parameters = Cinema2ModuleCreateContext['parameters']
function readNumber(parameters: Parameters, name: string, fallback: number): number { const value = parameters.get(name); return typeof value === 'number' && Number.isFinite(value) ? value : fallback }
function readBoolean(parameters: Parameters, name: string, fallback: boolean): boolean { const value = parameters.get(name); return typeof value === 'boolean' ? value : fallback }
function readEnum<const T extends string>(parameters: Parameters, name: string, allowed: readonly T[], fallback: T): T { const value = parameters.get(name); return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback }
function readColor(parameters: Parameters, name: string, fallback: Cinema2Color): Cinema2Color { const value = parameters.get(name); return Array.isArray(value) && value.length === 4 && value.every(component => typeof component === 'number' && Number.isFinite(component)) ? value as unknown as Cinema2Color : fallback }
function rgb(value: Cinema2Color): readonly [number, number, number] { return [value[0], value[1], value[2]] }
function resolveTime(frame: Cinema2ModuleRenderExecutionContext['frame']): number { return frame.transport?.sourcePresent && Number.isFinite(frame.transport.timeSec) ? Math.max(0, frame.transport.timeSec) : Math.max(0, frame.audio?.upstream.timeSec ?? frame.elapsedTimeSec) }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)) }
