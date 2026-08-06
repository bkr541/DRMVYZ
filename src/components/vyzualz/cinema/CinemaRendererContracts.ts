import type {
  CinemaActionId,
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
  swapPingPong(lease: CinemaRenderTargetLease): void
  clear(lease: CinemaRenderTargetLease): void
  release(lease: CinemaRenderTargetLease): void
}

export interface CinemaTextureGraphService {
  resolveInput(nodeId: CinemaNodeId, portId: CinemaPortId): CinemaTextureView | null
  publishOutput(nodeId: CinemaNodeId, portId: CinemaPortId, texture: CinemaTextureView): void
}

export interface CinemaRuntimeDiagnosticSink {
  report(diagnostic: CinemaDiagnostic): void
}

export interface CinemaViewport {
  width: number
  height: number
  dpr: number
}

export interface CinemaTransportFrame {
  trackId: string | null
  audioTimeSec: number
  durationSec: number | null
  playing: boolean
  paused: boolean
  seeking: boolean
  looped: boolean
  discontinuity: boolean
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

export interface CinemaMusicalClockFrame {
  beat: boolean
  beat2: boolean
  beat4: boolean
  bar: boolean
  bar4: boolean
  bar8: boolean
  phrase: boolean
}

export interface CinemaMusicalFrame {
  available: boolean
  bpm: number | null
  beatIndex: number | null
  beatPhase: number
  barIndex: number | null
  phraseIndex: number | null
  sectionId: string | null
  sectionType: string | null
  sectionProgress: number
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
}

export interface CinemaLyricFrame {
  available: boolean
  lineId: string | null
  lineText: string | null
  wordId: string | null
  wordText: string | null
  lineProgress: number
  wordProgress: number
  vocalsActive: boolean
}

export interface CinemaPerformanceFrame {
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
  authoritativeSections: boolean
  lyrics: boolean
  brandKit: boolean
  sharedPerformance: boolean
  mediaAssets: boolean
}

/** One immutable snapshot delivered to every node. Nodes must not poll application stores. */
export interface CinemaFrameContext {
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

export type CinemaCameraCapability = 'none' | 'uniform' | 'world' | 'native'
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
} as const)

export type CinemaStateResetActionId = typeof CINEMA_STATE_RESET_ACTION_IDS[keyof typeof CINEMA_STATE_RESET_ACTION_IDS]

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
  diagnostics: CinemaRuntimeDiagnosticSink
  signal: AbortSignal
}

export interface CinemaNodeResizeContext {
  nodeId: CinemaNodeId
  previousViewport: CinemaViewport
  viewport: CinemaViewport
  targets: CinemaRenderTargetService
  diagnostics: CinemaRuntimeDiagnosticSink
}

export interface CinemaNodeRenderContext {
  nodeId: CinemaNodeId
  frame: Readonly<CinemaFrameContext>
  values: Readonly<CinemaParameterValues>
  inputs: Readonly<Partial<Record<CinemaPortId, CinemaTextureView | null>>>
  target: CinemaRenderTargetLease
  targets: CinemaRenderTargetService
  textures: CinemaTextureGraphService
  diagnostics: CinemaRuntimeDiagnosticSink
}

export interface CinemaNodeResetContext {
  nodeId: CinemaNodeId
  actionId: CinemaStateResetActionId | CinemaActionId
  frame: Readonly<CinemaFrameContext> | null
  seekTargetSec?: number
  diagnostics: CinemaRuntimeDiagnosticSink
}

export interface CinemaNodeDisposeContext {
  nodeId: CinemaNodeId
  reason: 'unmount' | 'superseded' | 'setup-failed' | 'render-failed' | 'context-lost' | 'registry-change'
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

export interface CinemaAssetAvailability {
  assetId: CinemaAssetId
  available: boolean
  mediaKind?: 'image' | 'video' | 'svg' | 'font' | 'audio'
  dimensions?: CinemaVector2
  durationSec?: number
}

export interface CinemaCameraUniformSnapshot {
  cameraId: CinemaCameraId
  position: CinemaVector3
  rotation: CinemaVector3
  target: CinemaVector3
  fovDegrees: number
  rollRadians: number
  near: number
  far: number
}

export interface CinemaResolvedParameterSnapshot {
  values: Readonly<CinemaParameterValues>
  sources: Readonly<Partial<Record<CinemaParameterId, 'default' | 'preset' | 'instance' | 'master' | 'modulation' | 'performance' | 'clamp'>>>
  invalidDestinations: readonly CinemaParameterPath[]
}
