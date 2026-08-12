import type {
  CinemaActionId,
  CinemaEventId,
  CinemaAssetBindingId,
  CinemaAssetId,
  CinemaCameraId,
  CinemaNodeId,
  CinemaNodeTypeId,
  CinemaParameterId,
  CinemaParameterPath,
  CinemaPortId,
  CinemaShaderAttributeId,
  CinemaShaderPassId,
  CinemaShaderResourceId,
  CinemaStableId,
} from './CinemaIdentifiers'
import type {
  CinemaAssetBindingDefinition,
  CinemaBrandRole,
  CinemaColor,
  CinemaJsonObject,
  CinemaNodeDefinition,
  CinemaParameterDefinition,
  CinemaParameterValues,
  CinemaVector2,
  CinemaVector3,
} from './CinemaDomain'
import type { CinemaDiagnostic } from './CinemaDiagnostics'
import type { CinemaAssetFallbackDescriptor, CinemaAssetMediaKind } from './CinemaAssets'

export type CinemaRenderBackend = 'webgl2' | 'canvas2d'
export type CinemaAlphaMode = 'premultiplied' | 'straight' | 'opaque'
export type CinemaColorSpace = 'srgb' | 'linear-srgb' | 'display-p3'
export type CinemaTargetFormat = 'rgba8' | 'rgba16f' | 'rgba32f' | 'r8' | 'rg8' | 'depth16' | 'depth24'
export type CinemaTextureFilter = 'linear' | 'nearest'
export type CinemaTextureWrap = 'clamp' | 'repeat' | 'mirror'
export type CinemaDrawPrimitive = 'triangles' | 'triangle-strip' | 'lines' | 'line-strip' | 'points'

export interface CinemaOutputDescriptor {
  colorSpace: CinemaColorSpace
  alphaMode: CinemaAlphaMode
  colorFormat: CinemaTargetFormat
  hasDepth: boolean
  hasMask: boolean
}

export const CINEMA_SAFE_OUTPUT_DESCRIPTOR: Readonly<CinemaOutputDescriptor> = Object.freeze({
  colorSpace: 'srgb',
  alphaMode: 'premultiplied',
  colorFormat: 'rgba8',
  hasDepth: false,
  hasMask: false,
})

export interface CinemaTargetDescriptor extends CinemaOutputDescriptor {
  widthScale: number
  heightScale: number
  filter: CinemaTextureFilter
  wrap: CinemaTextureWrap
  clearColor: CinemaColor
}

export type CinemaTargetLifetime = 'frame' | 'persistent-node' | 'ping-pong-node'

/** Runtime-only lease. The owning Cinema runtime creates and retires the underlying GPU/2D resource. */
export interface CinemaRenderTargetLease {
  readonly leaseId: CinemaStableId<'runtime-target-lease'>
  readonly ownerNodeId: CinemaNodeId
  readonly backend: CinemaRenderBackend
  readonly lifetime: CinemaTargetLifetime
  readonly descriptor: CinemaTargetDescriptor
}

/** Runtime-only texture view. It is intentionally an opaque handle, never a WebGLTexture. */
export interface CinemaTextureView {
  readonly textureViewId: CinemaStableId<'runtime-texture-view'>
  readonly ownerNodeId: CinemaNodeId
  readonly descriptor: CinemaOutputDescriptor
}

export interface CinemaRenderTargetService {
  acquire(ownerNodeId: CinemaNodeId, descriptor: CinemaTargetDescriptor, lifetime: CinemaTargetLifetime): CinemaRenderTargetLease
  getReadTexture(lease: CinemaRenderTargetLease): CinemaTextureView | null
  /** Optional mask attachment view for mask-compatible targets. */
  getReadMaskTexture?(lease: CinemaRenderTargetLease): CinemaTextureView | null
  swapPingPong(lease: CinemaRenderTargetLease): void
  clear(lease: CinemaRenderTargetLease): void
  release(lease: CinemaRenderTargetLease): void
}

export interface CinemaTextureGraphService {
  resolveInput(nodeId: CinemaNodeId, portId: CinemaPortId): CinemaTextureView | null
  publishOutput(nodeId: CinemaNodeId, portId: CinemaPortId, texture: CinemaTextureView): void
}

/**
 * Runtime-owned WebGL2 access granted to renderer plugins.
 *
 * Nodes may create node-local programs, buffers, and uniforms against this
 * context, but they must never create another canvas, context, or animation
 * loop. Framebuffer and texture resolution stays behind Cinema-owned handles.
 */
export interface CinemaWebGLTargetBinding {
  /** Cinema-owned framebuffer. Nodes may bind/use it for the current render call but never retain or delete it. */
  readonly framebuffer: WebGLFramebuffer | null
  /** Cinema-owned color attachment. Nodes may sample it only when their renderer contract requires the current target texture. */
  readonly texture: WebGLTexture | null
  readonly width: number
  readonly height: number
}

export interface CinemaWebGLRenderService {
  readonly gl: WebGL2RenderingContext
  bindTarget(lease: CinemaRenderTargetLease): Readonly<CinemaWebGLTargetBinding>
  bindDefaultFramebuffer(viewport: CinemaViewport): void
  resolveTexture(view: CinemaTextureView): WebGLTexture | null
  resetState(): void
}

export interface CinemaRuntimeDiagnosticSink {
  report(diagnostic: CinemaDiagnostic): void
}

export interface CinemaViewport {
  width: number
  height: number
  dpr: number
}

export type CinemaFrameDiscontinuityReason =
  | 'activation'
  | 'track-change'
  | 'playback-restart'
  | 'seek'
  | 'loop-wrap'
  | 'resume'
  | 'visibility-suspension'
  | 'backwards-time'
  | 'timing-discontinuity'

export interface CinemaFrameResetSignal {
  required: boolean
  reconstruct: boolean
  generation: number
  reasons: readonly CinemaFrameDiscontinuityReason[]
  actionIds: readonly CinemaStateResetActionId[]
  identity: string | null
}

export interface CinemaTransportFrame {
  trackId: string | null
  audioTimeSec: number
  durationSec: number | null
  playing: boolean
  paused: boolean
  seeking: boolean
  looped: boolean
  visibilitySuspended: boolean
  discontinuity: boolean
  discontinuityReasons: readonly CinemaFrameDiscontinuityReason[]
  reset: Readonly<CinemaFrameResetSignal>
}

export interface CinemaDeterministicSeedFrame {
  composition: number
  track: number
  musicalPosition: number
  event: number
}

export interface CinemaTimingFrame {
  frameIndex: number
  elapsedTimeSec: number
  deltaTimeSec: number
  seeds: CinemaDeterministicSeedFrame
}

export interface CinemaAudioFrame {
  available: boolean
  volume: number
  rms: number
  energy: number
  bass: number
  mid: number
  high: number
  sub: number
  centroid: number
  flux: number
  harmonicity: number
  complexity: number
  tension: number
  buildProgress: number
  dropImpact: number
  vocalPresence: number
  fft: Uint8Array | null
  waveform: Uint8Array | null
}

export type CinemaMusicalClockId = 'beat' | 'beat2' | 'beat4' | 'bar' | 'bar4' | 'bar8' | 'phrase'

export interface CinemaClockFrame {
  available: boolean
  spanBeats: number
  index: number | null
  phase: number
  hit: boolean
  eventId: CinemaEventId | null
}

export interface CinemaMusicalClockFrame {
  beat: boolean
  beat2: boolean
  beat4: boolean
  bar: boolean
  bar4: boolean
  bar8: boolean
  phrase: boolean
  states: Readonly<Record<CinemaMusicalClockId, Readonly<CinemaClockFrame>>>
}

/** Engine-neutral copy of the resolved section timeline needed by node-local choreography. */
export interface CinemaResolvedSectionFrame {
  id: string
  label: string
  type: string
  startSec: number
  endSec: number
  intensity: number
  confidence: number
  source: string | null
  dropConfidence: number
  familyId: string | null
  occurrenceIndex: number | null
}

export interface CinemaMusicalFrame {
  available: boolean
  source: 'music-intelligence' | 'react-frame' | 'bpm-derived' | 'unavailable'
  bpm: number | null
  beatIndex: number | null
  beatPhase: number
  beatInBar: number | null
  barIndex: number | null
  phraseIndex: number | null
  sectionId: string | null
  sectionType: string | null
  sectionProgress: number
  /** Additive runtime-only detail; absent on older synthetic/test frames. */
  resolvedSections?: readonly Readonly<CinemaResolvedSectionFrame>[]
  clocks: CinemaMusicalClockFrame
}

export interface CinemaImpulseFrame {
  beat: boolean
  downbeat: boolean
  kick: boolean
  snare: boolean
  transient: boolean
  sectionStart: boolean
  dropStart: boolean
  lyricCue: boolean
  lyricWord: boolean
  phrase4: boolean
  phrase8: boolean
  eventIds: Readonly<{
    beat: CinemaEventId | null
    downbeat: CinemaEventId | null
    kick: CinemaEventId | null
    snare: CinemaEventId | null
    transient: CinemaEventId | null
    sectionStart: CinemaEventId | null
    dropStart: CinemaEventId | null
    lyricCue: CinemaEventId | null
    lyricWord: CinemaEventId | null
    phrase4: CinemaEventId | null
    phrase8: CinemaEventId | null
  }>
}

export interface CinemaLyricFrame {
  available: boolean
  sourceIdentity: string | null
  lineId: string | null
  lineText: string | null
  wordId: string | null
  wordText: string | null
  lineProgress: number
  wordProgress: number
  lineStarted?: boolean
  lineEnded?: boolean
  wordChanged?: boolean
  lineActive?: boolean
  lineAbsent?: boolean
  density?: number
  lineDurationSec?: number
  vocalsActive: boolean
}

export interface CinemaPerformanceEventFrame {
  actionId: CinemaActionId
  sequence: number
}

export interface CinemaPerformanceFrame {
  /** Ordered manual events consumed exactly once by sequence identity. */
  events?: readonly Readonly<CinemaPerformanceEventFrame>[]
  /** Compatibility projection retained for shader trigger parameters and legacy adapters. */
  actionIds: readonly CinemaActionId[]
  toggleStates: Readonly<Partial<Record<CinemaActionId, boolean>>>
}

export interface CinemaBrandFrame {
  available: boolean
  colors: Partial<Record<CinemaBrandRole, CinemaColor>>
}

export interface CinemaFrameCapabilities {
  analyser: boolean
  musicIntelligence: boolean
  beatGrid: boolean
  authoritativeSections: boolean
  lyrics: boolean
  brandKit: boolean
  sharedPerformance: boolean
  mediaAssets: boolean
}

/** One immutable snapshot delivered to every node. Nodes must not poll application stores. */
export interface CinemaFrameContext {
  version: 1
  viewport: CinemaViewport
  timing: CinemaTimingFrame
  transport: CinemaTransportFrame
  audio: CinemaAudioFrame
  music: CinemaMusicalFrame
  impulses: CinemaImpulseFrame
  lyrics: CinemaLyricFrame
  performance: CinemaPerformanceFrame
  brand: CinemaBrandFrame
  capabilities: CinemaFrameCapabilities
  activeCameraId: CinemaCameraId | null
  camera: CinemaCameraUniformSnapshot | null
}

export type CinemaCameraCapability = 'none' | 'uniformCamera' | 'worldCamera' | 'nativeCamera' | 'uniform' | 'world' | 'native'
export type CinemaCameraControl =
  | 'position'
  | 'rotation'
  | 'target'
  | 'fov'
  | 'roll'
  | 'orbit'
  | 'dolly'
  | 'speed'
  | 'look-ahead'
  | 'banking'
  | 'handheld'
  | 'beat-punch'
  | 'shake'
  | 'depth-of-field'
  | 'near'
  | 'far'

export interface CinemaCameraCapabilityDescriptor {
  mode: CinemaCameraCapability
  controls: readonly CinemaCameraControl[]
  autoDirector: boolean
}

export interface CinemaPlatformCapabilities {
  webgl2: boolean
  canvas2d: boolean
  floatColorTargets: boolean
  floatBlending: boolean
  textureArrays: boolean
  instancing: boolean
  timerQueries: boolean
  maximumTextureSize: number
  maximumTextureUnits: number
}

export type CinemaParameterSupportMode = 'live' | 'structural' | 'conditional' | 'unsupported'

export interface CinemaParameterCapabilityDescriptor {
  parameterId: CinemaParameterId
  /** Runtime update semantics. Unsupported entries stay persisted but must not be exposed as editable controls. */
  support: CinemaParameterSupportMode
  reason?: string
}

export interface CinemaNodeCapabilityDescriptor {
  backends: readonly CinemaRenderBackend[]
  canvas2d: {
    compatibility: 'native' | 'raster-upload' | 'unsupported'
    preservesPremultipliedAlpha: boolean
  }
  camera: CinemaCameraCapabilityDescriptor
  requires: Partial<Record<keyof CinemaPlatformCapabilities, boolean | number>>
  fallbacks: readonly {
    capability: keyof CinemaPlatformCapabilities | keyof CinemaFrameCapabilities
    behavior: 'disable-node' | 'safe-output' | 'use-neutral-input' | 'use-canvas2d' | 'use-lower-quality'
    message: string
  }[]
}

export interface CinemaNodeCostProfile {
  cpu: 'minimal' | 'low' | 'medium' | 'high' | 'extreme'
  gpu: 'minimal' | 'low' | 'medium' | 'high' | 'extreme'
  estimatedPassCount: number
  persistentTargetCount: number
  pingPongPairCount: number
  estimatedTextureMemoryMb?: number
  qualityScalars?: readonly {
    parameterId: CinemaParameterId
    low: number
    medium: number
    high: number
    ultra: number
  }[]
}

export type CinemaSeekReconstructionPolicy =
  | { mode: 'stateless' }
  | { mode: 'reset-at-position'; seedScope: 'composition' | 'node' | 'track' | 'musical-position' }
  | { mode: 'deterministic-replay'; seedScope: 'composition' | 'node' | 'track' | 'musical-position' | 'event'; maximumWarmupSec: number }
  | { mode: 'checkpoint-replay'; checkpointIntervalSec: number; maximumCheckpoints: number; maximumReplaySec: number }
  | { mode: 'unsupported'; fallback: 'reset-at-position' | 'safe-output'; diagnosticMessage: string }

export const CINEMA_STATE_RESET_ACTION_IDS = Object.freeze({
  activation: 'cinema.reset.activation',
  trackChange: 'cinema.reset.track-change',
  playbackRestart: 'cinema.reset.playback-restart',
  seek: 'cinema.reset.seek',
  loopWrap: 'cinema.reset.loop-wrap',
  sectionChange: 'cinema.reset.section-change',
  resolutionChange: 'cinema.reset.resolution-change',
  contextRestore: 'cinema.reset.context-restore',
  manual: 'cinema.reset.manual',
  resume: 'cinema.reset.resume',
  visibilityRestore: 'cinema.reset.visibility-restore',
  timingDiscontinuity: 'cinema.reset.timing-discontinuity',
} as const)

export type CinemaStateResetActionId = typeof CINEMA_STATE_RESET_ACTION_IDS[keyof typeof CINEMA_STATE_RESET_ACTION_IDS]

export const CINEMA_PERFORMANCE_STATE_ACTION_IDS = Object.freeze({
  resetNodeState: 'cinema.action.reset-node-state',
  resetFeedback: 'cinema.action.reset-feedback',
  reseedSimulation: 'cinema.action.reseed-simulation',
  clearTrailHistory: 'cinema.action.clear-trail-history',
} as const)

export type CinemaPerformanceStateActionId = typeof CINEMA_PERFORMANCE_STATE_ACTION_IDS[keyof typeof CINEMA_PERFORMANCE_STATE_ACTION_IDS]

export interface CinemaNodeStateCommand {
  type: 'resetNodeState' | 'resetFeedback' | 'reseedSimulation' | 'clearTrailHistory' | 'seekReconstruction'
  eventIdentity?: string
  seed?: number
  reconstructionMode?: CinemaSeekReconstructionPolicy['mode']
}

export interface CinemaShaderSourceMetadata {
  language: 'glsl-es-300'
  source: string
  entryPoint?: string
}

export type CinemaShaderFrameUniformSource =
  | 'frame-index'
  | 'elapsed-time-sec'
  | 'delta-time-sec'
  | 'audio-time-sec'
  | 'duration-sec'
  | 'viewport-size'
  | 'viewport-dpr'
  | 'volume'
  | 'rms'
  | 'energy'
  | 'bass'
  | 'mid'
  | 'high'
  | 'sub'
  | 'centroid'
  | 'flux'
  | 'harmonicity'
  | 'complexity'
  | 'tension'
  | 'build-progress'
  | 'drop-impact'
  | 'vocal-presence'
  | 'beat-phase'
  | 'section-progress'
  | 'beat-impulse'
  | 'downbeat-impulse'
  | 'kick-impulse'
  | 'snare-impulse'
  | 'transient-impulse'
  | 'section-start-impulse'
  | 'drop-start-impulse'

export type CinemaShaderUniformSource =
  | { kind: 'parameter'; parameterId: CinemaParameterId }
  | { kind: 'frame'; source: CinemaShaderFrameUniformSource }
  | { kind: 'camera'; source: CinemaCameraControl }
  | { kind: 'brand-color'; role: CinemaBrandRole }
  | { kind: 'constant'; value: number | boolean | CinemaVector2 | CinemaVector3 | CinemaColor }

export interface CinemaShaderUniformBinding {
  uniformName: string
  uniformType: 'float' | 'int' | 'bool' | 'vec2' | 'vec3' | 'vec4' | 'mat3' | 'mat4'
  source: CinemaShaderUniformSource
}

export type CinemaShaderTextureSource =
  | { kind: 'node-input'; portId: CinemaPortId }
  | { kind: 'pass-output'; outputId: CinemaShaderResourceId }
  | { kind: 'pass-history'; outputId: CinemaShaderResourceId; framesAgo: number }
  | { kind: 'frame-texture'; source: 'fft' | 'waveform' | 'noise' }
  | { kind: 'asset-parameter'; parameterId: CinemaParameterId }

export interface CinemaShaderPassInputBinding {
  source: CinemaShaderTextureSource
  uniformName: string
  required: boolean
}

export interface CinemaShaderVertexAttribute {
  id: CinemaShaderAttributeId
  location?: number
  components: 1 | 2 | 3 | 4
  scalarType: 'float32' | 'uint8' | 'uint16' | 'uint32' | 'int8' | 'int16' | 'int32'
  normalized?: boolean
  divisor?: number
}

export interface CinemaShaderGeometryMetadata {
  primitive: CinemaDrawPrimitive
  indexed: boolean
  instanced: boolean
  attributes: readonly CinemaShaderVertexAttribute[]
  maximumVertices?: number
  maximumIndices?: number
  maximumInstances?: number
}

export interface CinemaShaderPassMetadata {
  id: CinemaShaderPassId
  label?: string
  vertex: CinemaShaderSourceMetadata | { language: 'shared-fullscreen-triangle' }
  fragment: CinemaShaderSourceMetadata
  draw: { kind: 'fullscreen' } | { kind: 'geometry'; geometry: CinemaShaderGeometryMetadata }
  uniforms: readonly CinemaShaderUniformBinding[]
  inputs: readonly CinemaShaderPassInputBinding[]
  outputId: CinemaShaderResourceId
  dependsOn: readonly CinemaShaderPassId[]
  target: {
    resolutionScale: number
    format: CinemaTargetFormat
    filter: CinemaTextureFilter
    wrap: CinemaTextureWrap
    clearBeforeRender: boolean
    blendMode: 'none' | 'alpha' | 'additive' | 'multiply' | 'screen'
    persistent: boolean
    pingPong: boolean
    historyFrames?: number
    bloomTier?: number
  }
}

export interface CinemaNodeTypeDefinition {
  typeId: CinemaNodeTypeId
  version: number
  label: string
  description?: string
  family: CinemaNodeDefinition['family']
  inputPorts: readonly import('./CinemaDomain').CinemaPortDefinition[]
  outputPorts: readonly import('./CinemaDomain').CinemaPortDefinition[]
  parameters: readonly CinemaParameterDefinition[]
  /** Renderer/adapter-owned truth for which persisted parameters have real runtime consumers. */
  parameterCapabilities?: readonly CinemaParameterCapabilityDescriptor[]
  capabilities: CinemaNodeCapabilityDescriptor
  cost: CinemaNodeCostProfile
  seekPolicy: CinemaSeekReconstructionPolicy
  output: CinemaOutputDescriptor
  shaderPasses?: readonly CinemaShaderPassMetadata[]
  metadata?: CinemaJsonObject
}

export interface CinemaNodeInitializeContext {
  node: Readonly<CinemaNodeDefinition>
  definition: Readonly<CinemaNodeTypeDefinition>
  viewport: CinemaViewport
  platform: Readonly<CinemaPlatformCapabilities>
  targets: CinemaRenderTargetService
  textures: CinemaTextureGraphService
  webgl: CinemaWebGLRenderService
  /** Authored stable asset bindings resolved with the active instance overrides. */
  assets: readonly Readonly<CinemaAssetBindingDefinition>[]
  assetManager: CinemaAssetRuntimeService
  diagnostics: CinemaRuntimeDiagnosticSink
  signal: AbortSignal
}

export interface CinemaNodeResizeContext {
  nodeId: CinemaNodeId
  previousViewport: CinemaViewport
  viewport: CinemaViewport
  targets: CinemaRenderTargetService
  webgl: CinemaWebGLRenderService
  diagnostics: CinemaRuntimeDiagnosticSink
}

export interface CinemaNodeRuntimeQuality {
  tier: 'low' | 'medium' | 'high' | 'ultra'
  role: 'output' | 'foreground' | 'background'
  resolutionScale: number
  simulationScale: number
  feedbackHistoryScale: number
  optionalPassTier: number
  degraded: boolean
}

export interface CinemaNodeRenderContext {
  nodeId: CinemaNodeId
  frame: Readonly<CinemaFrameContext>
  viewport: Readonly<CinemaViewport>
  values: Readonly<CinemaParameterValues>
  /** Authored stable asset bindings resolved with the active instance overrides. */
  assets: readonly Readonly<CinemaAssetBindingDefinition>[]
  assetManager: CinemaAssetRuntimeService
  inputs: Readonly<Partial<Record<CinemaPortId, CinemaTextureView | null>>>
  /** Null only for the one compiled output node, which is authorized to bind the default framebuffer. */
  target: CinemaRenderTargetLease | null
  outputNode: boolean
  targets: CinemaRenderTargetService
  textures: CinemaTextureGraphService
  webgl: CinemaWebGLRenderService
  diagnostics: CinemaRuntimeDiagnosticSink
  /** Runtime-only graph-aware quality decision. It never mutates authored values. */
  quality?: Readonly<CinemaNodeRuntimeQuality>
}

export interface CinemaNodeResetContext {
  nodeId: CinemaNodeId
  actionId: CinemaStateResetActionId | CinemaActionId | CinemaPerformanceStateActionId
  frame: Readonly<CinemaFrameContext> | null
  seekTargetSec?: number
  command?: Readonly<CinemaNodeStateCommand>
  webgl: CinemaWebGLRenderService
  diagnostics: CinemaRuntimeDiagnosticSink
}

export interface CinemaNodeDisposeContext {
  nodeId: CinemaNodeId
  reason: 'unmount' | 'superseded' | 'setup-failed' | 'render-failed' | 'context-lost' | 'registry-change'
  webgl: CinemaWebGLRenderService
  diagnostics: CinemaRuntimeDiagnosticSink
}

export interface CinemaRenderNode {
  readonly nodeId: CinemaNodeId
  readonly typeId: CinemaNodeTypeId
  initialize(context: CinemaNodeInitializeContext): void | Promise<void>
  resize(context: CinemaNodeResizeContext): void
  render(context: CinemaNodeRenderContext): void
  reset(context: CinemaNodeResetContext): void
  dispose(context: CinemaNodeDisposeContext): void
}


/** Registry extension point. Creating a node must not allocate a canvas, context, loop, or target. */
export interface CinemaNodePlugin {
  readonly definition: Readonly<CinemaNodeTypeDefinition>
  createNode(node: Readonly<CinemaNodeDefinition>): CinemaRenderNode
}

export type CinemaRuntimeAssetStatus = 'loading' | 'ready' | 'error' | 'fallback'

/** Runtime-only resolved asset view. Raw media/GPU objects never enter persisted state. */
export interface CinemaRuntimeAssetView {
  bindingId: CinemaAssetBindingId
  assetId: CinemaAssetId
  status: CinemaRuntimeAssetStatus
  mediaKind: CinemaAssetMediaKind
  mimeType: string | null
  width: number | null
  height: number | null
  durationSec: number | null
  texture: WebGLTexture | null
  mediaElement: HTMLImageElement | HTMLVideoElement | null
  fallback: Readonly<CinemaAssetFallbackDescriptor> | null
  error?: string
}

export interface CinemaVideoSyncOptions {
  offsetSec?: number
  loop?: boolean
  playbackRate?: number
}

export interface CinemaAssetRuntimeService {
  resolve(binding: Readonly<CinemaAssetBindingDefinition>): Readonly<CinemaRuntimeAssetView>
  prepare(binding: Readonly<CinemaAssetBindingDefinition>, signal?: AbortSignal): Promise<Readonly<CinemaRuntimeAssetView>>
  synchronizeVideo?(
    binding: Readonly<CinemaAssetBindingDefinition>,
    transport: Readonly<CinemaTransportFrame>,
    options?: Readonly<CinemaVideoSyncOptions>,
  ): Readonly<CinemaRuntimeAssetView>
  releaseAsset(assetId: CinemaAssetId): void
  getDiagnostics(): Readonly<{ sourceCount: number; resourceCount: number; readyCount: number }>
}

export interface CinemaAssetAvailability {
  assetId: CinemaAssetId
  available: boolean
  mediaKind?: 'image' | 'video' | 'svg' | 'font' | 'audio'
  dimensions?: CinemaVector2
  durationSec?: number
}

export interface CinemaCameraUniformSnapshot {
  cameraId: CinemaCameraId
  mode?: import('./CinemaDomain').CinemaCameraMode
  resolvedMode?: Exclude<import('./CinemaDomain').CinemaCameraMode, 'auto-director'>
  shotId?: string | null
  position: CinemaVector3
  rotation: CinemaVector3
  target: CinemaVector3
  fovDegrees: number
  rollRadians: number
  near: number
  far: number
  orbitProgress?: number
  dollyProgress?: number
  banking?: number
  shake?: number
  beatPunch?: number
  handheld?: number
  focusDistance?: number
  aperture?: number
}

export interface CinemaResolvedParameterSnapshot {
  values: Readonly<CinemaParameterValues>
  sources: Readonly<Partial<Record<CinemaParameterId, 'default' | 'preset' | 'instance' | 'master' | 'modulation' | 'performance' | 'clamp'>>>
  invalidDestinations: readonly CinemaParameterPath[]
}
