import type {
  Cinema2JsonValue,
  Cinema2ModuleId,
  Cinema2ModuleManifest,
  Cinema2ModuleTypeId,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2AudioIntelligenceFrame } from '../audio/Cinema2AudioIntelligenceBridge'
import type {
  Cinema2ActionDispatchResult,
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

export interface Cinema2ModuleResourceSnapshot {
  activeLeaseCount: number
  disposedLeaseCount: number
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
  getSnapshot(): Cinema2ModuleResourceSnapshot
}

export interface Cinema2ModuleCreateContext {
  module: Readonly<Cinema2ModuleManifest>
  parameters: Cinema2ModuleParameterReadFacet
  targets: Cinema2ModuleTargetFacet
  resources: Cinema2ModuleResourceFacet
}

export interface Cinema2ModuleViewport {
  width: number
  height: number
  dpr: number
}

export interface Cinema2ModuleFrameReadContext {
  frameId: number
  timestampMs: number
  deltaTimeSec: number
  elapsedTimeSec: number
  viewport: Readonly<Cinema2ModuleViewport>
  contextGeneration: number
  audio: Readonly<Cinema2AudioIntelligenceFrame> | null
}

export interface Cinema2ModuleUpdateContext {
  frame: Readonly<Cinema2ModuleFrameReadContext>
  parameters: Cinema2ModuleParameterReadFacet
  targets: Cinema2ModuleTargetFacet
}

export interface Cinema2ModuleRenderExecutionContext {
  frame: Readonly<Cinema2ModuleFrameReadContext>
  target: WebGLFramebuffer | null
  width: number
  height: number
}

export interface Cinema2ModuleRenderPassProvider {
  id: string
  moduleId: Cinema2ModuleId
  intent: 'fullscreen'
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
}

export interface Cinema2ModuleTypeDefinition {
  typeId: Cinema2ModuleTypeId
  version: number
  validate?(module: Readonly<Cinema2ModuleManifest>): readonly Cinema2ModuleDiagnostic[]
  create(context: Cinema2ModuleCreateContext): Cinema2ModuleInstance
}
