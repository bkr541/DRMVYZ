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
import type { Cinema2DispatchedTargetAction } from '../parameters/Cinema2TargetRuntime'
import {
  CINEMA2_DEPTH_REPEAT_ORIGIN_Z,
  buildCinema2DepthProofLayout,
  packCinema2DepthInstances,
  type Cinema2DepthProofLayout,
} from './depth/Cinema2DepthLayout'
import {
  CINEMA2_DEPTH_LIGHT_DIRECTIONS,
  CINEMA2_DEPTH_LIGHT_PROGRAMS,
  createCinema2DepthLightFrame,
  updateCinema2DepthLightFrame,
  type Cinema2DepthLightDirection,
  type Cinema2DepthLightProgram,
} from './depth/Cinema2DepthLightPrograms'
import {
  CINEMA2_DEPTH_TRIGGER_IDS,
  Cinema2DepthOrchestration,
  type Cinema2DepthCueKind,
  type Cinema2DepthOrchestrationFrame,
  type Cinema2DepthTriggerId,
} from './depth/Cinema2DepthOrchestration'
import { Cinema2DepthRenderer, type Cinema2DepthDrawState } from './depth/Cinema2DepthRenderer'

export const CINEMA2_DEPTH_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('depth-native')
export const CINEMA2_DEPTH_NATIVE_MODULE_VERSION = 1 as const
export const CINEMA2_DEPTH_STRUCTURE_ROTATION_SECONDS = 24

const DEFAULT_LIGHT: Cinema2Color = Object.freeze([0.96, 0.97, 1, 1]) as Cinema2Color
const DEFAULT_BODY: Cinema2Color = Object.freeze([0.018, 0.019, 0.024, 1]) as Cinema2Color

export interface Cinema2DepthModuleInspection {
  portalCount: number
  lapCopies: number
  instanceCount: number
  estimatedGpuBytes: number
  lightProgram: Cinema2DepthLightProgram
  direction: Cinema2DepthLightDirection
}

interface Cinema2DepthRendererRuntime {
  draw(state: Readonly<Cinema2DepthDrawState>): void
  estimateGpuBytes(): number
  dispose(): void
}

export function createCinema2DepthNativeModuleDefinition(options: {
  createRenderer?: (gl: WebGL2RenderingContext, instances: Float32Array) => Cinema2DepthRendererRuntime
} = {}): Readonly<Cinema2ModuleTypeDefinition> {
  const createRenderer = options.createRenderer ?? ((gl, instances) => new Cinema2DepthRenderer(gl, instances))
  return Object.freeze({
    typeId: CINEMA2_DEPTH_NATIVE_MODULE_TYPE_ID,
    version: CINEMA2_DEPTH_NATIVE_MODULE_VERSION,
    validate: validateModule,
    create(context: Cinema2ModuleCreateContext) {
      const layout = resolveLayout(context.module)
      const instances = packCinema2DepthInstances(layout.instances)
      const lightFrame = createCinema2DepthLightFrame(layout.instances.length, layout.portalCount)
      const orchestration = new Cinema2DepthOrchestration()
      let orchestrationFrame: Readonly<Cinema2DepthOrchestrationFrame> | null = null
      let orchestrationFrameId = -1
      let structureRotationRadians = 0
      let rotationInitialized = false
      const renderer = context.resources.acquire(
        `depth:proof:${layout.portalCount}:${layout.lapCopies}:${layout.aperture}:${layout.spacing}`,
        'Cinema2DepthRenderer',
        gl => createRenderer(gl, instances),
        value => value.dispose(),
      )
      const estimatedGpuBytes = renderer.estimateGpuBytes()
      context.resources.reportGpuBytes(estimatedGpuBytes)

      const updateOrchestration = (frame: Cinema2ModuleRenderExecutionContext['frame']) => {
        if (frame.frameId === orchestrationFrameId) return
        const resetRotation = !rotationInitialized || (frame.audio?.discontinuity.occurred === true && frame.audio.discontinuity.reason !== 'activation')
        orchestrationFrame = orchestration.update(frame, {
          pattern: readEnum(context, 'program', CINEMA2_DEPTH_LIGHT_PROGRAMS, 'architecturalSparse'),
          auto: readBoolean(context, 'autoPerformance', true),
          patternChange: readBoolean(context, 'patternChange', false),
          trigger: readEnum(context, 'trigger', CINEMA2_DEPTH_TRIGGER_IDS, 'bar4') as Cinema2DepthTriggerId,
          sync: readBoolean(context, 'sync', true),
          routeDensity: clamp(readNumber(context, 'routeDensity', 0.36), 0, 1),
          pulseWidth: clamp(readNumber(context, 'pulseWidth', 0.42), 0, 1),
          dropIntensity: clamp(readNumber(context, 'dropIntensity', 0.9), 0, 1),
        }, CINEMA2_DEPTH_LIGHT_PROGRAMS)
        const baseRadiansPerSecond = Math.PI * 2 / CINEMA2_DEPTH_STRUCTURE_ROTATION_SECONDS
        if (resetRotation) {
          structureRotationRadians = positiveModulo(resolveFrameTimeSeconds(frame) * baseRadiansPerSecond, Math.PI * 2)
          rotationInitialized = true
        } else if (!frame.transport || (frame.transport.animationActive && !frame.transport.paused)) {
          structureRotationRadians = positiveModulo(
            structureRotationRadians + clamp(frame.deltaTimeSec, 0, 0.25) * baseRadiansPerSecond * orchestrationFrame.rotationMultiplier,
            Math.PI * 2,
          )
        }
        orchestrationFrameId = frame.frameId
      }

      const provider = Object.freeze({
        id: `${context.module.id}:depth-tunnel`,
        moduleId: context.module.id,
        intent: 'world' as const,
        execute(execution: Cinema2ModuleRenderExecutionContext) {
          if (!execution.depthAvailable) throw new Error(`Cinema 2.0 Depth module "${context.module.id}" requires a render target with a depth attachment.`)
          if (!execution.camera) throw new Error(`Cinema 2.0 Depth module "${context.module.id}" requires final Camera Runtime state.`)
          updateOrchestration(execution.frame)
          const light = readColor(context, 'lightColor', DEFAULT_LIGHT)
          const body = readColor(context, 'bodyColor', DEFAULT_BODY)
          const lightProgram = readEnum(context, 'program', CINEMA2_DEPTH_LIGHT_PROGRAMS, 'architecturalSparse')
          const direction = readEnum(context, 'direction', CINEMA2_DEPTH_LIGHT_DIRECTIONS, 'forward')
          const beatAccent = clamp(readNumber(context, 'beatAccent', 0), 0, 1)
          const downbeatAccent = clamp(readNumber(context, 'downbeatAccent', 0), 0, 1)
          const phraseAccent = clamp(readNumber(context, 'phraseAccent', 0), 0, 1)
          const buildAmount = clamp(readNumber(context, 'buildAmount', 0), 0, 1)
          const dropAccent = clamp(readNumber(context, 'dropAccent', 0), 0, 1)
          const authoredRate = clamp(readNumber(context, 'rate', 1.1), 0, 8)
          const authoredSpan = clamp(Math.round(readNumber(context, 'activeSpan', 4)), 1, layout.portalCount)
          const timeSeconds = resolveTimeSeconds(execution)
          updateCinema2DepthLightFrame(lightFrame, layout, timeSeconds, {
            program: lightProgram,
            direction,
            rate: authoredRate * (1 + buildAmount * 0.45 + dropAccent * 0.65),
            activeSpan: authoredSpan,
            seed: Math.round(clamp(readNumber(context, 'seed', 7), 0, 9999)),
            centerEnabled: readBoolean(context, 'centerEnabled', true),
            centerIntensity: clamp(readNumber(context, 'centerIntensity', 0.7), 0, 2),
            beatAccent,
            downbeatAccent,
            phraseAccent,
            buildAmount,
            dropAccent,
            orchestration: orchestrationFrame ?? undefined,
          })
          renderer.draw({
            viewProjection: execution.camera.viewProjectionMatrix,
            cameraPosition: execution.camera.position,
            lightColor: [light[0], light[1], light[2]],
            bodyColor: [body[0], body[1], body[2]],
            intensity: clamp(readNumber(context, 'intensity', 1), 0, 2),
            spill: clamp(readNumber(context, 'spill', 0.28), 0, 2),
            centerScale: clamp(readNumber(context, 'centerScale', 1), 0.25, 4),
            emissions: lightFrame.emissions,
            spills: lightFrame.spills,
            repeatDistance: layout.repeatDistance,
            repeatOriginZ: CINEMA2_DEPTH_REPEAT_ORIGIN_Z,
            centerDistance: CINEMA2_DEPTH_REPEAT_ORIGIN_Z - layout.centerDepth,
            structureRotationRadians,
          })
        },
      })

      return {
        lifecycle: {
          update: ({ frame }: Cinema2ModuleUpdateContext) => updateOrchestration(frame),
          dispose: () => orchestration.reset(),
        },
        render: { providers: Object.freeze([provider]) },
        handleAction: (action: string, event: Readonly<Cinema2DispatchedTargetAction>) => {
          if (action !== 'musicalCue' || !event.eventId || !event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) return
          const kind = (event.payload as { kind?: unknown }).kind
          if (typeof kind === 'string' && ['kick', 'snare', 'transient', 'beat', 'downbeat', 'bar', 'phrase', 'section', 'drop'].includes(kind)) {
            orchestration.enqueueCue(kind as Cinema2DepthCueKind, event.eventId)
          }
        },
        inspect: (): Cinema2DepthModuleInspection => ({
          portalCount: layout.portalCount,
          lapCopies: layout.lapCopies,
          instanceCount: layout.instances.length,
          estimatedGpuBytes,
          lightProgram: readEnum(context, 'program', CINEMA2_DEPTH_LIGHT_PROGRAMS, 'architecturalSparse'),
          direction: readEnum(context, 'direction', CINEMA2_DEPTH_LIGHT_DIRECTIONS, 'forward'),
        }),
      }
    },
  })
}

export const cinema2DepthNativeModuleDefinition = createCinema2DepthNativeModuleDefinition()

function resolveLayout(module: Readonly<Cinema2ModuleManifest>): Readonly<Cinema2DepthProofLayout> {
  return buildCinema2DepthProofLayout({
    portalCount: readConfigNumber(module, 'portalCount'),
    aperture: readConfigNumber(module, 'aperture'),
    spacing: readConfigNumber(module, 'spacing'),
    frameThickness: readConfigNumber(module, 'frameThickness'),
    lapCopies: readConfigNumber(module, 'lapCopies'),
  })
}

function validateModule(module: Readonly<Cinema2ModuleManifest>): readonly Cinema2ModuleDiagnostic[] {
  const diagnostics: Cinema2ModuleDiagnostic[] = []
  for (const property of ['portalCount', 'aperture', 'spacing', 'frameThickness', 'lapCopies']) {
    const value = module.config?.[property]
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
      diagnostics.push({
        code: 'CINEMA2_DEPTH_CONFIG_INVALID',
        path: `$.config.${property}`,
        message: `Depth module config "${property}" must be a finite number.`,
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

function readEnum<const T extends string>(
  context: Cinema2ModuleCreateContext,
  name: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = context.parameters.get(name)
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback
}

function resolveTimeSeconds(execution: Cinema2ModuleRenderExecutionContext): number {
  return resolveFrameTimeSeconds(execution.frame)
}

function resolveFrameTimeSeconds(frame: Cinema2ModuleRenderExecutionContext['frame']): number {
  if (frame.transport?.sourcePresent && Number.isFinite(frame.transport.timeSec)) return Math.max(0, frame.transport.timeSec)
  const audioTime = frame.audio?.upstream.timeSec
  if (typeof audioTime === 'number' && Number.isFinite(audioTime)) return Math.max(0, audioTime)
  return Number.isFinite(frame.elapsedTimeSec) ? Math.max(0, frame.elapsedTimeSec) : 0
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}

function readColor(context: Cinema2ModuleCreateContext, name: string, fallback: Cinema2Color): Cinema2Color {
  const value = context.parameters.get(name)
  return Array.isArray(value) && value.length === 4 && value.every(component => typeof component === 'number' && Number.isFinite(component))
    ? value as unknown as Cinema2Color
    : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
