import { describe, expect, it } from 'vitest'
import {
  CINEMA_COMPOSITION_SCHEMA_ID,
  CINEMA_COMPOSITION_SCHEMA_VERSION,
  CINEMA_PACKAGE_SCHEMA_ID,
  CINEMA_PACKAGE_SCHEMA_VERSION,
  CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
  CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
  CINEMA_SAFE_OUTPUT_DESCRIPTOR,
  CINEMA_STATE_RESET_ACTION_IDS,
  cinemaNamespacedId,
  cinemaStableId,
  createCinemaDiagnostic,
  createCinemaDiagnosticSnapshot,
  createCinemaParameterPath,
  deduplicateCinemaDiagnostics,
  findDuplicateCinemaIds,
  formatCinemaDiagnostic,
  isCinemaJsonValue,
  parseCinemaNamespacedId,
  parseCinemaParameterPath,
  parseCinemaStableId,
  sortCinemaDiagnostics,
  type CinemaActionId,
  type CinemaAssetBindingId,
  type CinemaAssetId,
  type CinemaCameraId,
  type CinemaCollectionId,
  type CinemaCompositionDefinition,
  type CinemaCompositionId,
  type CinemaCompositionInstanceId,
  type CinemaConnectionId,
  type CinemaJsonObject,
  type CinemaEventId,
  type CinemaModulationRouteId,
  type CinemaModulationSourceId,
  type CinemaNodeDefinition,
  type CinemaNodeId,
  type CinemaNodeTypeDefinition,
  type CinemaNodeTypeId,
  type CinemaPackageDefinition,
  type CinemaParameterId,
  type CinemaParameterValue,
  type CinemaParameterValues,
  type CinemaPerformanceRuleId,
  type CinemaPortId,
  type CinemaShaderAttributeId,
  type CinemaShaderPassId,
  type CinemaShaderResourceId,
  type CinemaStableId,
} from '../index'

const compositionId = id<CinemaCompositionId>('composition-foundation', 'composition')
const proceduralNodeId = id<CinemaNodeId>('procedural-source', 'node')
const logoNodeId = id<CinemaNodeId>('brand-logo', 'node')
const effectNodeId = id<CinemaNodeId>('bloom-effect', 'node')
const mixerNodeId = id<CinemaNodeId>('layer-mixer', 'node')
const outputNodeId = id<CinemaNodeId>('main-output', 'node')
const cameraId = id<CinemaCameraId>('hero-camera', 'camera')
const intensityParameterId = id<CinemaParameterId>('intensity', 'parameter')
const opacityParameterId = id<CinemaParameterId>('opacity', 'parameter')
const densityParameterId = id<CinemaParameterId>('density', 'parameter')
const blendParameterId = id<CinemaParameterId>('blend', 'parameter')
const positionParameterId = id<CinemaParameterId>('position', 'parameter')
const targetParameterId = id<CinemaParameterId>('target', 'parameter')
const fovParameterId = id<CinemaParameterId>('fov', 'parameter')
const sourcePortId = id<CinemaPortId>('color-out', 'port')
const inputAPortId = id<CinemaPortId>('input-a', 'port')
const inputBPortId = id<CinemaPortId>('input-b', 'port')
const outputPortId = id<CinemaPortId>('output', 'port')
const logoAssetId = id<CinemaAssetId>('primary-logo', 'asset')
const logoBindingId = id<CinemaAssetBindingId>('primary-logo-binding', 'asset binding')
const feedbackPassId = id<CinemaShaderPassId>('ribbon-feedback-pass', 'shader pass')
const feedbackOutputId = id<CinemaShaderResourceId>('feedback-color', 'shader resource')
const segmentAttributeId = id<CinemaShaderAttributeId>('segment', 'shader attribute')

function id<T extends CinemaStableId>(value: string, kind: string): T {
  return cinemaStableId<T>(value, kind)
}

function typeId(value: string): CinemaNodeTypeId {
  return cinemaNamespacedId<CinemaNodeTypeId>(value, 'node type')
}

function node(
  nodeId: CinemaNodeId,
  nodeTypeId: CinemaNodeTypeId,
  family: CinemaNodeDefinition['family'],
  parameterValues: CinemaNodeDefinition['parameterValues'] = {},
): CinemaNodeDefinition {
  return {
    id: nodeId,
    typeId: nodeTypeId,
    typeVersion: 1,
    family,
    enabled: true,
    opacity: 1,
    parameterValues,
  }
}

function createRepresentativeComposition(): CinemaCompositionDefinition {
  const masterIntensityPath = createCinemaParameterPath('master', intensityParameterId)
  const effectOpacityPath = createCinemaParameterPath('effects', opacityParameterId, effectNodeId)
  return {
    schemaId: CINEMA_COMPOSITION_SCHEMA_ID,
    schemaVersion: CINEMA_COMPOSITION_SCHEMA_VERSION,
    id: compositionId,
    revision: 1,
    metadata: {
      name: 'Cinema Foundation Fixture',
      tags: ['stage-1', 'serializable'],
      provenance: { source: 'production-public-contract' },
    },
    nodes: [
      node(proceduralNodeId, typeId('drmvyz.procedural.nebula'), 'procedural', { [densityParameterId]: 0.65 }),
      {
        ...node(logoNodeId, typeId('drmvyz.media.logo'), 'logo'),
        assetBindingIds: [logoBindingId],
      },
      node(effectNodeId, typeId('drmvyz.effect.bloom'), 'effect', { [opacityParameterId]: 0.8 }),
      node(mixerNodeId, typeId('drmvyz.mixer.layer'), 'mixer', { [blendParameterId]: 'screen' }),
      node(outputNodeId, typeId('drmvyz.output.main'), 'output'),
    ],
    connections: [
      connection('procedural-to-mixer', proceduralNodeId, sourcePortId, mixerNodeId, inputAPortId),
      connection('logo-to-mixer', logoNodeId, sourcePortId, mixerNodeId, inputBPortId),
      connection('mixer-to-effect', mixerNodeId, sourcePortId, effectNodeId, inputAPortId),
      connection('effect-to-output', effectNodeId, sourcePortId, outputNodeId, outputPortId),
    ],
    outputNodeId,
    masterParameters: [{
      id: intensityParameterId,
      label: 'Intensity',
      type: 'float',
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      modulatable: true,
    }],
    masterValues: { [intensityParameterId]: 0.9 },
    cameras: [{
      id: cameraId,
      label: 'Hero Camera',
      mode: 'auto-director',
      parameterValues: {
        [positionParameterId]: [0, 0, 4],
        [targetParameterId]: [0, 0, 0],
        [fovParameterId]: 50,
      },
    }],
    assetBindings: [{
      id: logoBindingId,
      assetId: logoAssetId,
      role: 'logo',
      fit: 'contain',
      preserveOriginalColors: true,
      opacity: 1,
      blendMode: 'normal',
    }],
    modulationRoutes: [{
      id: id<CinemaModulationRouteId>('bass-to-intensity', 'modulation route'),
      sourceId: cinemaNamespacedId<CinemaModulationSourceId>('audio.bass', 'modulation source'),
      destination: masterIntensityPath,
      mode: 'multiply',
      amount: 0.35,
      attackMs: 20,
      releaseMs: 180,
      enabled: true,
    }],
    performanceRules: [{
      schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
      id: id<CinemaPerformanceRuleId>('drop-bloom-rule', 'performance rule'),
      label: 'Drop Bloom',
      priority: 100,
      enabled: true,
      condition: {
        schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
        event: cinemaNamespacedId<CinemaEventId>('music.drop-start', 'event'),
        sectionTypes: ['drop'],
      },
      actions: [{
        schemaVersion: CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
        id: id<CinemaActionId>('drop-bloom-action', 'performance action'),
        type: 'set-parameter',
        destination: effectOpacityPath,
        value: 1,
      }],
    }],
  }
}

function connection(
  value: string,
  fromNodeId: CinemaNodeId,
  fromPortId: CinemaPortId,
  toNodeId: CinemaNodeId,
  toPortId: CinemaPortId,
) {
  return {
    id: id<CinemaConnectionId>(value, 'connection'),
    from: { nodeId: fromNodeId, portId: fromPortId },
    to: { nodeId: toNodeId, portId: toPortId },
    enabled: true,
  }
}

describe('Cinema public domain contracts', () => {
  it('constructs and round-trips the representative composition as pure serializable data', () => {
    const composition = createRepresentativeComposition()
    const serialized = JSON.stringify(composition)
    const hydrated = JSON.parse(serialized) as CinemaCompositionDefinition

    expect(hydrated).toEqual(composition)
    expect(hydrated.outputNodeId).toBe('main-output')
    expect(hydrated.nodes.map(candidate => candidate.family)).toEqual([
      'procedural', 'logo', 'effect', 'mixer', 'output',
    ])
    expect(serialized).not.toMatch(/WebGL|HTMLCanvas|blob:/)
    expect(isCinemaJsonValue(composition.metadata.provenance)).toBe(true)
    expect(isCinemaJsonValue(new Uint8Array([1, 2, 3]))).toBe(false)
    expect(isCinemaJsonValue(Object.create({ runtimeResource: true }))).toBe(false)
    expect(isCinemaJsonValue([1, , 3])).toBe(false)
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(isCinemaJsonValue(cyclic)).toBe(false)
    const hostile = new Proxy({}, { ownKeys: () => { throw new Error('blocked') } })
    expect(isCinemaJsonValue(hostile)).toBe(false)
  })

  it('round-trips package, instance, and collection contracts without runtime state', () => {
    const composition = createRepresentativeComposition()
    const instanceId = id<CinemaCompositionInstanceId>('instance-one', 'composition instance')
    const collectionId = id<CinemaCollectionId>('collection-one', 'collection')
    const cinemaPackage: CinemaPackageDefinition = {
      schemaId: CINEMA_PACKAGE_SCHEMA_ID,
      schemaVersion: CINEMA_PACKAGE_SCHEMA_VERSION,
      exportedAt: '2026-08-06T09:00:00.000Z',
      compositions: [composition],
      instances: [{
        id: instanceId,
        compositionId,
        label: 'Main Performance',
        revision: 1,
        masterOverrides: { [intensityParameterId]: 0.75 },
        nodeOverrides: [],
        cameraOverrides: [],
        assetBindingOverrides: [],
      }],
      collections: [{
        id: collectionId,
        label: 'Foundation Collection',
        compositionIds: [compositionId],
      }],
      assetIds: [logoAssetId],
    }

    expect(JSON.parse(JSON.stringify(cinemaPackage))).toEqual(cinemaPackage)
  })

  it('represents Canvas2D fallback, complete shader-pass metadata, reset actions, and seek reconstruction', () => {
    const definition: CinemaNodeTypeDefinition = {
      typeId: typeId('drmvyz.shader.feedback-ribbon'),
      version: 1,
      label: 'Feedback Ribbon',
      family: 'shader',
      inputPorts: [],
      outputPorts: [{
        id: sourcePortId,
        label: 'Color',
        direction: 'output',
        dataType: 'color-texture',
      }],
      parameters: [],
      capabilities: {
        backends: ['webgl2', 'canvas2d'],
        canvas2d: {
          compatibility: 'raster-upload',
          preservesPremultipliedAlpha: true,
        },
        camera: { mode: 'uniform', controls: ['position', 'target', 'fov'], autoDirector: true },
        requires: { webgl2: true, floatColorTargets: true },
        fallbacks: [{
          capability: 'floatColorTargets',
          behavior: 'use-lower-quality',
          message: 'Use rgba8 when float targets are unavailable.',
        }],
      },
      cost: {
        cpu: 'low',
        gpu: 'high',
        estimatedPassCount: 2,
        persistentTargetCount: 0,
        pingPongPairCount: 1,
      },
      seekPolicy: {
        mode: 'checkpoint-replay',
        checkpointIntervalSec: 8,
        maximumCheckpoints: 16,
        maximumReplaySec: 8,
      },
      output: CINEMA_SAFE_OUTPUT_DESCRIPTOR,
      shaderPasses: [{
        id: feedbackPassId,
        vertex: {
          language: 'glsl-es-300',
          source: '#version 300 es\nvoid main() {}',
        },
        fragment: {
          language: 'glsl-es-300',
          source: '#version 300 es\nprecision highp float; out vec4 color; void main(){ color=vec4(1.0); }',
        },
        draw: {
          kind: 'geometry',
          geometry: {
            primitive: 'triangle-strip',
            indexed: false,
            instanced: true,
            attributes: [{ id: segmentAttributeId, components: 4, scalarType: 'float32', divisor: 1 }],
            maximumInstances: 4096,
          },
        },
        uniforms: [{
          uniformName: 'u_intensity',
          uniformType: 'float',
          source: { kind: 'parameter', parameterId: intensityParameterId },
        }],
        inputs: [{
          source: { kind: 'pass-history', outputId: feedbackOutputId, framesAgo: 1 },
          uniformName: 'u_previousFrame',
          required: true,
        }],
        outputId: feedbackOutputId,
        dependsOn: [],
        target: {
          resolutionScale: 1,
          format: 'rgba16f',
          filter: 'linear',
          wrap: 'clamp',
          clearBeforeRender: false,
          blendMode: 'alpha',
          persistent: true,
          pingPong: true,
          historyFrames: 2,
        },
      }],
    }

    expect(definition.capabilities.canvas2d.compatibility).toBe('raster-upload')
    expect(definition.shaderPasses?.[0].draw.kind).toBe('geometry')
    expect(definition.shaderPasses?.[0].target).toMatchObject({ persistent: true, pingPong: true })
    expect(definition.seekPolicy.mode).toBe('checkpoint-replay')
    expect(CINEMA_STATE_RESET_ACTION_IDS.contextRestore).toBe('cinema.reset.context-restore')
  })
})

describe('Cinema stable identifiers and parameter paths', () => {
  it('rejects empty, display-label, malformed, and non-namespaced identifiers', () => {
    expect(parseCinemaStableId('', 'node').diagnostics[0].code).toBe('CINEMA_ID_EMPTY')
    expect(parseCinemaStableId('Hero Camera', 'camera').diagnostics[0].code).toBe('CINEMA_ID_LOOKS_LIKE_LABEL')
    expect(parseCinemaStableId('hero.camera', 'camera').diagnostics[0].code).toBe('CINEMA_ID_INVALID')
    expect(parseCinemaNamespacedId('shader', 'node type').diagnostics[0].code).toBe('CINEMA_ID_INVALID')
    expect(parseCinemaNamespacedId('drmvyz.shader.plasma', 'node type').ok).toBe(true)
  })

  it('builds and parses only the four stable parameter namespaces', () => {
    const master = createCinemaParameterPath('master', intensityParameterId)
    const effect = createCinemaParameterPath('effects', opacityParameterId, effectNodeId)

    expect(master).toBe('master.intensity')
    expect(parseCinemaParameterPath(master)).toMatchObject({
      ok: true,
      namespace: 'master',
      ownerId: null,
      parameterId: 'intensity',
    })
    expect(parseCinemaParameterPath(effect)).toMatchObject({
      ok: true,
      namespace: 'effects',
      ownerId: 'bloom-effect',
      parameterId: 'opacity',
    })
    expect(parseCinemaParameterPath('nodes.Hero Camera.opacity').ok).toBe(false)
    expect(parseCinemaParameterPath('runtime.node.opacity').ok).toBe(false)
  })

  it('reports duplicate stable IDs deterministically', () => {
    const duplicates = findDuplicateCinemaIds([proceduralNodeId, logoNodeId, proceduralNodeId], 'node')
    expect(duplicates).toHaveLength(1)
    expect(duplicates[0]).toMatchObject({ code: 'CINEMA_ID_DUPLICATE', severity: 'error' })
  })
})

describe('Cinema diagnostics foundation', () => {
  it('sorts, deduplicates, aggregates, formats, and serializes diagnostics', () => {
    const warning = createCinemaDiagnostic({
      code: 'CINEMA_ASSET_MISSING',
      severity: 'warning',
      message: 'Primary logo is unavailable.',
      attribution: { nodeId: logoNodeId, assetId: logoAssetId },
    })
    const fatal = createCinemaDiagnostic({
      code: 'CINEMA_SCHEMA_VERSION_UNSUPPORTED',
      severity: 'fatal',
      message: 'Composition version 99 is not supported.',
      attribution: { compositionId },
      recoverable: false,
    })

    const reorderedWarning = createCinemaDiagnostic({
      code: 'CINEMA_ASSET_MISSING',
      severity: 'warning',
      message: 'Primary logo is unavailable.',
      attribution: { assetId: logoAssetId, nodeId: logoNodeId },
    })

    expect(reorderedWarning.id).toBe(warning.id)
    expect(deduplicateCinemaDiagnostics([warning, fatal, warning])).toHaveLength(2)
    expect(sortCinemaDiagnostics([warning, fatal])[0]).toEqual(fatal)

    const snapshot = createCinemaDiagnosticSnapshot([warning, fatal, warning])
    expect(snapshot).toMatchObject({
      version: 1,
      counts: { info: 0, warning: 1, error: 0, fatal: 1 },
      highestSeverity: 'fatal',
      totalUniqueCount: 2,
      truncated: false,
    })
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
    expect(createCinemaDiagnosticSnapshot([warning, fatal], { maximumDiagnostics: 1 })).toMatchObject({
      diagnostics: [fatal],
      totalUniqueCount: 2,
      truncated: true,
    })
    expect(formatCinemaDiagnostic(warning)).toContain('nodeId=brand-logo')
  })
})

/** Compile-time acceptance: persisted Cinema contracts cannot contain browser/GPU runtime objects. */
function assertPersistedCinemaStateRejectsRuntimeResources(
  texture: WebGLTexture,
  framebuffer: WebGLFramebuffer,
  video: HTMLVideoElement,
): void {
  // @ts-expect-error WebGL textures are runtime resources, not Cinema parameter values.
  const invalidTextureValue: CinemaParameterValue = texture
  // @ts-expect-error Parameter maps must use stable branded parameter IDs, not display labels.
  const invalidLabelKey: CinemaParameterValues = { Intensity: 1 }
  // @ts-expect-error WebGL framebuffers cannot be stored in serializable Cinema metadata.
  const invalidFramebufferMetadata: CinemaJsonObject = { framebuffer }
  // @ts-expect-error DOM media objects cannot be stored in serializable Cinema metadata.
  const invalidVideoMetadata: CinemaJsonObject = { video }
  void invalidTextureValue
  void invalidLabelKey
  void invalidFramebufferMetadata
  void invalidVideoMetadata
}
void assertPersistedCinemaStateRejectsRuntimeResources
