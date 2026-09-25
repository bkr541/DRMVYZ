import type {
  Cinema2JsonValue,
  Cinema2ModuleId,
  Cinema2ModuleManifest,
  Cinema2ModuleTypeId,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2AudioIntelligenceFrame } from '../audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2RandomStream } from '../runtime/Cinema2RandomService'
import type { Cinema2VisualDirectorFrame } from '../director/Cinema2VisualDirector'
import type { Cinema2ResolvedSpatialNode } from '../spatial/Cinema2SpatialRuntime'
import type { Cinema2CameraFrame } from '../spatial/Cinema2CameraRuntime'
import type { Cinema2LightingEnvironmentFrame } from '../spatial/Cinema2LightingEnvironmentRuntime'
import type { Cinema2ManagedMediaResource, Cinema2MediaSlotSnapshot } from '../media/Cinema2MediaSlotRuntime'
import type {
  Cinema2ActionDispatchResult,
  Cinema2DispatchedTargetAction,
  Cinema2ResolvedTargetValue,
  Cinema2TargetContribution,
  Cinema2TargetHandle,
  Cinema2TargetId,
  Cinema2TargetUserAuthority,
} from '../parameters/Cinema2TargetRuntime'

export interface Cinema2ModuleDiagnostic {
  code: string
  message: string
  path: string
  moduleId?: Cinema2ModuleId
}

export interface Cinema2ModuleParameterReadFacet {
  getAuthored(name: string): Cinema2JsonValue | undefined
  resolve(name: string): Cinema2ResolvedTargetValue | null
  get(name: string): Cinema2JsonValue | undefined
}

export interface Cinema2ModuleTargetFacet {
  getTarget(targetId: Cinema2TargetId): Readonly<Cinema2TargetHandle> | null
  resolve(
    targetId: Cinema2TargetId,
    contributions?: readonly Readonly<Cinema2TargetContribution>[],
    userAuthority?: Cinema2TargetUserAuthority,
  ): Cinema2ResolvedTargetValue
  dispatch(
    targetId: Cinema2TargetId,
    contributions: readonly Readonly<Cinema2TargetContribution>[],
  ): Cinema2ActionDispatchResult
}

export interface Cinema2ModuleMediaFacet {
  get(bindingName: string): Readonly<Cinema2ManagedMediaResource> | null
  getSlot(bindingName: string): Readonly<Cinema2MediaSlotSnapshot> | null
}

export interface Cinema2ModuleResourceSnapshot {
  activeLeaseCount: number
  disposedLeaseCount: number
  /** GPU bytes the module reported through `reportGpuBytes` (an estimate the host adds to the budget check). */
  estimatedGpuBytes: number
}

/** Module-scoped view of engine-owned randomness. The host fixes moduleId so
 * creative code cannot perturb or impersonate a sibling module namespace. */
export interface Cinema2ModuleRandomnessFacet {
  sample(purpose: string, index?: number, substream?: string): number
  probability(purpose: string, probability: number, index?: number, substream?: string): boolean
  stream(purpose: string, substream?: string): Cinema2RandomStream
  eventStream(eventId: string, purpose: string, substream?: string): Cinema2RandomStream
}

/**
 * Resource factories receive WebGL2 only inside the engine-owned acquisition
 * boundary. The returned value is tracked by the host and deterministically
 * disposed even when module lifecycle code fails.
 */
export interface Cinema2ModuleResourceFacet {
  acquire<T>(
    key: string,
    kind: string,
    create: (gl: WebGL2RenderingContext) => T,
    dispose: (value: T) => void,
  ): T
  /**
   * Declares the module's current GPU memory estimate in bytes (replaces the previous value; call again when it changes).
   * The host adds it to the engine's own render-target estimate when checking the quality policy's memory budget.
   */
  reportGpuBytes(bytes: number): void
  getSnapshot(): Cinema2ModuleResourceSnapshot
}

export interface Cinema2ModuleCreateContext {
  module: Readonly<Cinema2ModuleManifest>
  parameters: Cinema2ModuleParameterReadFacet
  targets: Cinema2ModuleTargetFacet
  media: Cinema2ModuleMediaFacet
  resources: Cinema2ModuleResourceFacet
  randomness: Cinema2ModuleRandomnessFacet
}

export interface Cinema2ModuleViewport {
  width: number
  height: number
  dpr: number
}

/**
 * Transport truth captured by the Cinema 2.0 host for this visual frame.
 * `animationActive` is deliberately separate from renderer liveness: the RAF
 * loop may keep rendering while musical/procedural time is frozen.
 */
export interface Cinema2TransportFrameState {
  sourcePresent: boolean
  playing: boolean
  analysisActive: boolean
  paused: boolean
  animationActive: boolean
  trackId: string | null
  timeSec: number
  /** Global Audio Dock Sync BPM preference sampled by the host for this frame. */
  bpmSync?: boolean
  /** Optional canonical host BPM fallback when analyzed beat-grid timing is unavailable. */
  bpm?: number | null
}

export interface Cinema2ModuleFrameReadContext {
  frameId: number
  timestampMs: number
  deltaTimeSec: number
  elapsedTimeSec: number
  viewport: Readonly<Cinema2ModuleViewport>
  contextGeneration: number
  /** Optional for isolated/test hosts that intentionally run without a transport provider. */
  transport?: Readonly<Cinema2TransportFrameState>
  audio: Readonly<Cinema2AudioIntelligenceFrame> | null
  director: Readonly<Cinema2VisualDirectorFrame> | null
}

export interface Cinema2ModuleUpdateContext {
  frame: Readonly<Cinema2ModuleFrameReadContext>
  parameters: Cinema2ModuleParameterReadFacet
  targets: Cinema2ModuleTargetFacet
}

export interface Cinema2ModuleRenderInput {
  id: string
  attachment: 'color' | 'depth'
  texture: WebGLTexture
  width: number
  height: number
}

export interface Cinema2ModuleRenderExecutionContext {
  frame: Readonly<Cinema2ModuleFrameReadContext>
  target: WebGLFramebuffer | null
  width: number
  height: number
  /** True only when the currently bound engine-owned target has a depth attachment. */
  depthAvailable?: boolean
  /** Final target-resolved Scene Graph nodes associated with this module for the current pass. */
  spatialNodes?: readonly Readonly<Cinema2ResolvedSpatialNode>[]
  /** Final semantic world-camera state. Screen-space providers may ignore it. */
  camera?: Readonly<Cinema2CameraFrame>
  /** Shared final lighting/environment state. Specialized emissive shader logic remains module-local. */
  lightingEnvironment?: Readonly<Cinema2LightingEnvironmentFrame>
  /** Compiled upstream render inputs. Modules may read them but never own their lifetime. */
  inputs?: readonly Readonly<Cinema2ModuleRenderInput>[]
}

export interface Cinema2ModuleRenderPassProvider {
  id: string
  moduleId: Cinema2ModuleId
  intent: 'fullscreen' | 'world'
  execute(context: Cinema2ModuleRenderExecutionContext): void
}

export interface Cinema2ModuleRenderFacet {
  providers: readonly Readonly<Cinema2ModuleRenderPassProvider>[]
}

export interface Cinema2ModuleLifecycleFacet {
  update(context: Cinema2ModuleUpdateContext): void
  dispose(): void
}

/** Focused facets keep small modules from inheriting a universal mini-engine API. */
export interface Cinema2ModuleInstance {
  lifecycle: Cinema2ModuleLifecycleFacet
  render?: Cinema2ModuleRenderFacet
  /**
   * Non-fatal problems the module wants surfaced while it keeps running (for example an asset that failed to load and is
   * skipped). Polled by the host for snapshots; the module stays `active`.
   */
  getDiagnostics?(): readonly Cinema2ModuleDiagnostic[]
  /** Receives only actions explicitly bound by the authored module manifest. */
  handleAction?(action: string, event: Readonly<Cinema2DispatchedTargetAction>): void
}

export interface Cinema2ModuleTypeDefinition {
  typeId: Cinema2ModuleTypeId
  version: number
  validate?(module: Readonly<Cinema2ModuleManifest>): readonly Cinema2ModuleDiagnostic[]
  create(context: Cinema2ModuleCreateContext): Cinema2ModuleInstance
}
