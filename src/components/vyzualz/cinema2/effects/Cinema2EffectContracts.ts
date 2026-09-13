import type {
  Cinema2EffectId,
  Cinema2EffectManifest,
  Cinema2EffectScope,
  Cinema2EffectTypeId,
  Cinema2JsonValue,
  Cinema2RenderQualityLevel,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import type { Cinema2HistoryService } from '../runtime/Cinema2HistoryService'

export interface Cinema2EffectDiagnostic {
  code: string
  message: string
  path: string
  effectId?: Cinema2EffectId
}

export interface Cinema2EffectRenderInput {
  texture: WebGLTexture
  width: number
  height: number
}

export interface Cinema2EffectRenderExecutionContext {
  frame: Readonly<Cinema2ModuleFrameReadContext>
  input: Readonly<Cinema2EffectRenderInput>
  target: WebGLFramebuffer | null
  width: number
  height: number
  mix: number
  parameters: Readonly<Record<string, Cinema2JsonValue>>
}

export interface Cinema2EffectCreateContext {
  gl: WebGL2RenderingContext
  effect: Readonly<Cinema2EffectManifest>
  history: Cinema2HistoryService
}

export interface Cinema2EffectInstance {
  render(context: Readonly<Cinema2EffectRenderExecutionContext>): void
  handleAction?(action: string, eventId: string): void
  dispose(): void
}

export interface Cinema2EffectTypeDefinition {
  typeId: Cinema2EffectTypeId
  version: number
  label: string
  validate?(effect: Readonly<Cinema2EffectManifest>): readonly Cinema2EffectDiagnostic[]
  create(context: Readonly<Cinema2EffectCreateContext>): Cinema2EffectInstance
}

export type Cinema2EffectRuntimeStatus = 'inactive' | 'active' | 'failed' | 'disposed'

export interface Cinema2EffectInstanceSnapshot {
  effectId: Cinema2EffectId
  typeId: Cinema2EffectTypeId
  status: Cinema2EffectRuntimeStatus
  order: number
  scope: Cinema2EffectScope
  quality: Readonly<{ min?: Cinema2RenderQualityLevel; max?: Cinema2RenderQualityLevel }> | null
  diagnostics: readonly Readonly<Cinema2EffectDiagnostic>[]
}

export interface Cinema2EffectRuntimeSnapshot {
  activeEffectCount: number
  failedEffectCount: number
  effects: readonly Readonly<Cinema2EffectInstanceSnapshot>[]
}
