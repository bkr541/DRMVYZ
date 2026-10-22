import { cinema2StableId, type Cinema2Color, type Cinema2ModuleManifest, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2DispatchedTargetAction } from '../parameters/Cinema2TargetRuntime'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleDiagnostic,
  Cinema2ModuleRenderExecutionContext,
  Cinema2ModuleTypeDefinition,
  Cinema2ModuleUpdateContext,
} from './Cinema2ModuleContracts'
import { CINEMA2_MAINFRAME_TRIGGER_IDS, type Cinema2MainframeTriggerId } from './mainframe/Cinema2MainframePatternController'
import type { Cinema2MainframeMusicalCue, Cinema2MainframeMusicalCueKind } from './mainframe/Cinema2MainframeMusicAdapter'
import { CINEMA2_MAINFRAME_IMPULSE_IDS } from './mainframe/Cinema2MainframeReactivity'
import { solveCanopyRods, type CanopyDesign, type CanopyDrive } from './canopy/Cinema2CanopyChoreography'
import {
  CANOPY_DEFAULT_PATTERN,
  CANOPY_DEFAULT_STRUCTURE,
  CANOPY_PATTERN_IDS,
  clampCanopy,
  clampCanopyStructure,
  type CanopyPatternId,
  type CanopyStructure,
} from './canopy/Cinema2CanopyDomain'
import {
  CANOPY_INSTANCE_FLOATS,
  CANOPY_MAX_INSTANCES,
  buildCanopyLayout,
  canopyInstanceCounts,
  createCanopyRodState,
  packCanopyInstances,
  type CanopyLayout,
  type CanopyRodState,
} from './canopy/Cinema2CanopyLayout'
import { Cinema2CanopyOrchestration } from './canopy/Cinema2CanopyOrchestration'
import { Cinema2CanopyRenderer, type CanopyDrawState } from './canopy/Cinema2CanopyRenderer'

export const CINEMA2_CANOPY_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('canopy-native')
export const CINEMA2_CANOPY_NATIVE_MODULE_VERSION = 1 as const

const DEFAULT_PRIMARY: Cinema2Color = [0.3, 0.91, 1, 1]
const DEFAULT_SECONDARY: Cinema2Color = [0.55, 0.4, 1, 1]
const DEFAULT_ACCENT: Cinema2Color = [1, 0.55, 0.12, 1]
const DEFAULT_STRUCTURE_COLOR: Cinema2Color = [0.11, 0.17, 0.21, 1]

export interface Cinema2CanopyRendererLike {
  draw(state: Readonly<CanopyDrawState>): void
  estimateGpuBytes(): number
  dispose(): void
}

export interface Cinema2CanopyModuleInspection {
  readonly rows: number
  readonly columns: number
  readonly rodCount: number
  readonly instanceCount: number
  readonly fitScale: number
  readonly authoredPattern: CanopyPatternId
  readonly activePattern: CanopyPatternId
  readonly patternChange: boolean
  readonly trigger: Cinema2MainframeTriggerId
  readonly bpmSync: boolean
  readonly autoPerformance: boolean
  readonly drive: Readonly<CanopyDrive> | null
  /** Copies of the last solved rod state (cap hang below the mounting plane, emission, accent blend). */
  readonly hang: Float32Array
  readonly emission: Float32Array
  readonly accent: Float32Array
  readonly estimatedGpuBytes: number
}

export function createCinema2CanopyNativeModuleDefinition(
  options: { createRenderer?: (gl: WebGL2RenderingContext) => Cinema2CanopyRendererLike } = {},
): Readonly<Cinema2ModuleTypeDefinition> {
  const createRenderer = options.createRenderer ?? (gl => new Cinema2CanopyRenderer(gl))
  return Object.freeze({
    typeId: CINEMA2_CANOPY_NATIVE_MODULE_TYPE_ID,
    version: CINEMA2_CANOPY_NATIVE_MODULE_VERSION,
    validate: validateModule,
    create(context: Cinema2ModuleCreateContext) {
      const renderer = context.resources.acquire('canopy:rods-v1', 'Cinema2CanopyRenderer', gl => createRenderer(gl), value => value.dispose())
      const estimatedGpuBytes = renderer.estimateGpuBytes()
      context.resources.reportGpuBytes(estimatedGpuBytes)

      const instances = new Float32Array(CANOPY_MAX_INSTANCES * CANOPY_INSTANCE_FLOATS)
      let design = resolveDesign(context.parameters)
      let layout: Readonly<CanopyLayout> = buildCanopyLayout(design.structure)
      let layoutKey = structureKey(design.structure)
      let rods: CanopyRodState = createCanopyRodState(layout.fixtures.length)
      let counts = canopyInstanceCounts(layout)
      let drive: Readonly<CanopyDrive> | null = null
      // Filled only by the engine-owned choreography dispatcher before module.update; there is no second subscription to the audio bus.
      const musicalCues: Cinema2MainframeMusicalCue[] = []
      const orchestration = new Cinema2CanopyOrchestration(index => context.randomness.sample('canopy-pattern-cycle', index), design.pattern)

      const provider = Object.freeze({
        id: `${context.module.id}:canopy`,
        moduleId: context.module.id,
        intent: 'world' as const,
        execute(execution: Cinema2ModuleRenderExecutionContext) {
          if (!execution.depthAvailable) throw new Error(`Cinema 2.0 CANOPY module "${context.module.id}" requires a render target with a depth attachment.`)
          if (!execution.camera) throw new Error(`Cinema 2.0 CANOPY module "${context.module.id}" requires final Camera Runtime state.`)
          const p = context.parameters
          renderer.draw({
            viewProjection: execution.camera.viewProjectionMatrix,
            cameraPosition: execution.camera.position,
            primary: rgb(readColor(p, 'primaryColor', DEFAULT_PRIMARY)),
            secondary: rgb(readColor(p, 'secondaryColor', DEFAULT_SECONDARY)),
            accent: rgb(readColor(p, 'accentColor', DEFAULT_ACCENT)),
            structure: rgb(readColor(p, 'structureColor', DEFAULT_STRUCTURE_COLOR)),
            instances,
            boxCount: counts.boxes,
            diffuserCount: counts.diffusers,
          })
        },
      })

      return {
        lifecycle: {
          update: ({ parameters, frame }: Cinema2ModuleUpdateContext) => {
            design = resolveDesign(parameters)
            const key = structureKey(design.structure)
            if (key !== layoutKey) {
              layoutKey = key
              layout = buildCanopyLayout(design.structure)
              rods = createCanopyRodState(layout.fixtures.length)
              counts = canopyInstanceCounts(layout)
            }
            drive = orchestration.update(frame, {
              pattern: design.pattern, patternChange: design.patternChange, trigger: design.trigger, bpmSync: design.bpmSync, motionSpeed: design.motionSpeed,
            }, musicalCues.splice(0))
            solveCanopyRods(layout, design, drive, rods)
            packCanopyInstances(layout, rods, instances)
            // Opt-in test seam: a browser harness that installs this object receives each frame's solved rods. Nothing reads it in production.
            const probe = (globalThis as { __CINEMA2_CANOPY_PROBE__?: { latest: unknown } }).__CINEMA2_CANOPY_PROBE__
            if (probe) probe.latest = { pattern: drive.pattern, previous: drive.previous?.pattern ?? null, phase: drive.phase, musicActive: drive.musicActive, rows: layout.structure.rows, columns: layout.structure.columns, hang: Array.from(rods.hang), emission: Array.from(rods.emission), accent: Array.from(rods.accent) }
          },
          dispose() {
            orchestration.reset()
            musicalCues.splice(0)
            drive = null
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
        inspect: (): Cinema2CanopyModuleInspection => ({
          rows: layout.structure.rows,
          columns: layout.structure.columns,
          rodCount: layout.fixtures.length,
          instanceCount: counts.total,
          fitScale: layout.scale,
          authoredPattern: design.pattern,
          activePattern: orchestration.inspect().activePattern,
          patternChange: design.patternChange,
          trigger: design.trigger,
          bpmSync: design.bpmSync,
          autoPerformance: design.autoPerformance,
          drive,
          hang: Float32Array.from(rods.hang),
          emission: Float32Array.from(rods.emission),
          accent: Float32Array.from(rods.accent),
          estimatedGpuBytes,
        }),
      }
    },
  })
}

export const cinema2CanopyNativeModuleDefinition = createCinema2CanopyNativeModuleDefinition()

type Parameters = Cinema2ModuleCreateContext['parameters']

interface ResolvedDesign extends CanopyDesign {
  readonly pattern: CanopyPatternId
  readonly patternChange: boolean
  readonly trigger: Cinema2MainframeTriggerId
  readonly bpmSync: boolean
  readonly motionSpeed: number
}

function resolveDesign(parameters: Parameters): Readonly<ResolvedDesign> {
  const pattern = parameters.get('pattern')
  const trigger = parameters.get('trigger')
  return Object.freeze({
    pattern: typeof pattern === 'string' && CANOPY_PATTERN_IDS.includes(pattern as CanopyPatternId) ? pattern as CanopyPatternId : CANOPY_DEFAULT_PATTERN,
    patternChange: readBoolean(parameters, 'patternChange', false),
    trigger: typeof trigger === 'string' && CINEMA2_MAINFRAME_TRIGGER_IDS.includes(trigger as Cinema2MainframeTriggerId) ? trigger as Cinema2MainframeTriggerId : 'bar4',
    bpmSync: readBoolean(parameters, 'bpmSync', true),
    autoPerformance: readBoolean(parameters, 'autoPerformance', false),
    masterIntensity: clampCanopy(readNumber(parameters, 'masterIntensity', 0.78), 0, 1),
    motionAmount: clampCanopy(readNumber(parameters, 'motionAmount', 0.55), 0, 1),
    motionSpeed: clampCanopy(readNumber(parameters, 'motionSpeed', 1), 0.3, 2),
    heightRange: clampCanopy(readNumber(parameters, 'heightRange', 0.6), 0, 0.8),
    symmetry: readBoolean(parameters, 'symmetry', true),
    idleGlow: clampCanopy(readNumber(parameters, 'idleGlow', 0.28), 0, 0.6),
    accentStrength: clampCanopy(readNumber(parameters, 'accentStrength', 0.55), 0, 1),
    structure: clampCanopyStructure({
      rows: readNumber(parameters, 'rows', CANOPY_DEFAULT_STRUCTURE.rows),
      columns: readNumber(parameters, 'columns', CANOPY_DEFAULT_STRUCTURE.columns),
      rowSpacing: readNumber(parameters, 'rowSpacing', CANOPY_DEFAULT_STRUCTURE.rowSpacing),
      columnSpacing: readNumber(parameters, 'columnSpacing', CANOPY_DEFAULT_STRUCTURE.columnSpacing),
      rodLength: readNumber(parameters, 'rodLength', CANOPY_DEFAULT_STRUCTURE.rodLength),
      lengthVariation: readNumber(parameters, 'lengthVariation', CANOPY_DEFAULT_STRUCTURE.lengthVariation),
    }),
  })
}

const structureKey = (s: Readonly<CanopyStructure>) => `${s.rows}|${s.columns}|${s.rowSpacing}|${s.columnSpacing}|${s.rodLength}|${s.lengthVariation}`

function validateModule(module: Readonly<Cinema2ModuleManifest>): readonly Cinema2ModuleDiagnostic[] {
  const diagnostics: Cinema2ModuleDiagnostic[] = []
  const pattern = module.parameters?.pattern
  if (pattern !== undefined && !(typeof pattern === 'string' && CANOPY_PATTERN_IDS.includes(pattern as CanopyPatternId))) {
    diagnostics.push({ code: 'CINEMA2_CANOPY_PATTERN_INVALID', path: '$.parameters.pattern', message: `CANOPY pattern must be one of: ${CANOPY_PATTERN_IDS.join(', ')}.` })
  }
  const trigger = module.parameters?.trigger
  if (trigger !== undefined && !(typeof trigger === 'string' && CINEMA2_MAINFRAME_TRIGGER_IDS.includes(trigger as Cinema2MainframeTriggerId))) {
    diagnostics.push({ code: 'CINEMA2_CANOPY_TRIGGER_INVALID', path: '$.parameters.trigger', message: `CANOPY trigger must be one of: ${CINEMA2_MAINFRAME_TRIGGER_IDS.join(', ')}.` })
  }
  return Object.freeze(diagnostics.map(diagnostic => Object.freeze(diagnostic)))
}

function readNumber(parameters: Parameters, name: string, fallback: number): number {
  const value = parameters.get(name)
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
function readBoolean(parameters: Parameters, name: string, fallback: boolean): boolean {
  const value = parameters.get(name)
  return typeof value === 'boolean' ? value : fallback
}
function readColor(parameters: Parameters, name: string, fallback: Cinema2Color): Cinema2Color {
  const value = parameters.get(name)
  return Array.isArray(value) && value.length === 4 && value.every(component => typeof component === 'number' && Number.isFinite(component))
    ? value as unknown as Cinema2Color
    : fallback
}
function rgb(value: Cinema2Color): readonly [number, number, number] { return [value[0], value[1], value[2]] }
