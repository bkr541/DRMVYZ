import { describe, expect, it } from 'vitest'
import {
  CINEMA_BRAND_PARAMETER_SLOTS,
  CINEMA_COMPOSITION_SCHEMA_ID,
  CINEMA_COMPOSITION_SCHEMA_VERSION,
  CINEMA_MASTER_PARAMETER_CATALOG,
  CINEMA_MASTER_PARAMETER_IDS,
  CINEMA_PARAMETER_RESOLUTION_ORDER,
  CINEMA_SAFE_OUTPUT_DESCRIPTOR,
  bridgeCinemaBrandKit,
  cinemaNamespacedId,
  cinemaStableId,
  createCinemaControlDescriptors,
  createCinemaNodeDefinitionRegistry,
  createCinemaParameterPath,
  normalizeCinemaParameterValue,
  resolveCinemaParameterDestination,
  resolveCinemaParameterSnapshot,
  validateCinemaParameterSchema,
  validateCinemaParameterSchemas,
  type CinemaAssetId,
  type CinemaCameraId,
  type CinemaCompositionDefinition,
  type CinemaCompositionId,
  type CinemaCompositionInstance,
  type CinemaCompositionInstanceId,
  type CinemaControlPointId,
  type CinemaEnumOptionId,
  type CinemaNodeDefinition,
  type CinemaNodeId,
  type CinemaNodeRegistryEntry,
  type CinemaNodeTypeId,
  type CinemaParameterDefinition,
  type CinemaParameterId,
  type CinemaRendererPluginId,
  type CinemaStableId,
} from '../index'

function stableId<T extends CinemaStableId>(value: string, kind: string): T {
  return cinemaStableId<T>(value, kind)
}

function namespacedId<T extends CinemaStableId>(value: string, kind: string): T {
  return cinemaNamespacedId<T>(value, kind)
}

const intensityId = stableId<CinemaParameterId>('intensity', 'parameter')
const gainId = stableId<CinemaParameterId>('gain', 'parameter')
const effectNodeId = stableId<CinemaNodeId>('bloom-effect', 'node')
const cameraId = stableId<CinemaCameraId>('hero-camera', 'camera')

function floatSchema(overrides: Partial<Extract<CinemaParameterDefinition, { type: 'float' }>> = {}): Extract<CinemaParameterDefinition, { type: 'float' }> {
  return {
    id: gainId,
    label: 'Gain',
    description: 'Scales the node contribution.',
    group: 'Appearance',
    type: 'float',
    default: 1,
    min: 0,
    max: 5,
    step: 0.1,
    modulatable: true,
    ui: { control: 'slider', order: 2, precision: 1, helpText: 'Use small adjustments.' },
    ...overrides,
  }
}

function registryEntry(parameter: CinemaParameterDefinition): CinemaNodeRegistryEntry {
  return {
    definition: {
      typeId: namespacedId<CinemaNodeTypeId>('drmvyz.effect.test-bloom', 'node type'),
      version: 1,
      label: 'Test Bloom',
      family: 'effect',
      inputPorts: [],
      outputPorts: [],
      parameters: [parameter],
      capabilities: {
        backends: ['webgl2'],
        canvas2d: { compatibility: 'unsupported', preservesPremultipliedAlpha: true },
        camera: { mode: 'none', controls: [], autoDirector: false },
        requires: {},
        fallbacks: [],
      },
      cost: {
        cpu: 'low',
        gpu: 'low',
        estimatedPassCount: 1,
        persistentTargetCount: 0,
        pingPongPairCount: 0,
      },
      seekPolicy: { mode: 'stateless' },
      output: CINEMA_SAFE_OUTPUT_DESCRIPTOR,
    },
    rendererPlugin: {
      id: namespacedId<CinemaRendererPluginId>('drmvyz.renderer.test-bloom', 'renderer plugin'),
      available: true,
    },
    source: { kind: 'built-in', id: 'stage-3-test' },
    quality: {
      minimumTier: 'low',
      maximumTier: 'ultra',
      adaptive: true,
      maximumEstimatedPassCount: 1,
      maximumPersistentTargetCount: 0,
      maximumPingPongPairCount: 0,
    },
  }
}

function composition(parameter: CinemaParameterDefinition = floatSchema()): CinemaCompositionDefinition {
  const node: CinemaNodeDefinition = {
    id: effectNodeId,
    typeId: registryEntry(parameter).definition.typeId,
    typeVersion: 1,
    family: 'effect',
    enabled: true,
    opacity: 1,
    parameterValues: { [gainId]: 2 },
  }
  return {
    schemaId: CINEMA_COMPOSITION_SCHEMA_ID,
    schemaVersion: CINEMA_COMPOSITION_SCHEMA_VERSION,
    id: stableId<CinemaCompositionId>('stage-3-composition', 'composition'),
    revision: 1,
    metadata: { name: 'Stage 3 Parameter Fixture' },
    nodes: [node],
    connections: [],
    outputNodeId: effectNodeId,
    masterParameters: [{
      id: intensityId,
      label: 'Intensity',
      type: 'float',
      default: 1,
      min: 0,
      max: 3,
      step: 0.1,
      modulatable: true,
    }],
    masterValues: { [intensityId]: 2 },
    cameras: [],
    assetBindings: [],
    modulationRoutes: [],
    performanceRules: [],
  }
}

describe('Cinema parameter schemas and normalization', () => {
  it('normalizes every required parameter type deterministically', () => {
    const enumOptionA = stableId<CinemaEnumOptionId>('soft', 'enum option')
    const enumOptionB = stableId<CinemaEnumOptionId>('hard', 'enum option')
    const pointA = stableId<CinemaControlPointId>('point-a', 'control point')
    const pointB = stableId<CinemaControlPointId>('point-b', 'control point')
    const assetId = stableId<CinemaAssetId>('texture-one', 'asset')
    const schemas: readonly CinemaParameterDefinition[] = [
      floatSchema(),
      { id: stableId('count', 'parameter'), label: 'Count', type: 'integer', default: 2, min: 0, max: 10, step: 2 },
      { id: stableId('enabled', 'parameter'), label: 'Enabled', type: 'boolean', default: true },
      { id: stableId('mode', 'parameter'), label: 'Mode', type: 'enum', default: enumOptionA, options: [{ id: enumOptionA, label: 'Soft' }, { id: enumOptionB, label: 'Hard' }] },
      { id: stableId('fire', 'parameter'), label: 'Fire', type: 'trigger', modulatable: false },
      { id: stableId('color', 'parameter'), label: 'Color', type: 'color', default: [0, 0, 0, 1] },
      { id: stableId('gradient', 'parameter'), label: 'Gradient', type: 'gradient', default: [{ id: pointA, position: 0, color: [0, 0, 0, 1] }, { id: pointB, position: 1, color: [1, 1, 1, 1] }] },
      { id: stableId('position', 'parameter'), label: 'Position', type: 'vector2', default: [0, 0], min: [0, 0], max: [1, 1], step: [0.1, 0.1] },
      { id: stableId('direction', 'parameter'), label: 'Direction', type: 'vector3', default: [0, 0, 0], min: [-1, -1, -1], max: [1, 1, 1] },
      { id: stableId('curve', 'parameter'), label: 'Curve', type: 'curve', default: [{ id: pointA, position: 0, value: 0 }, { id: pointB, position: 1, value: 1, interpolation: 'smooth' }] },
      { id: stableId('texture', 'parameter'), label: 'Texture', type: 'texture', default: null, acceptedRoles: ['image', 'video'] },
      { id: stableId('asset-ref', 'parameter'), label: 'Asset', type: 'asset-reference', default: null, acceptedRoles: ['logo'] },
      { id: stableId('copy', 'parameter'), label: 'Copy', type: 'string', default: 'DVYDRM', minLength: 1, maxLength: 8, multiline: true },
    ]

    expect(validateCinemaParameterSchemas(schemas)).toEqual([])
    expect(normalizeCinemaParameterValue(schemas[0], 8).value).toBe(5)
    expect(normalizeCinemaParameterValue(schemas[1], 8.7).value).toBe(8)
    expect(normalizeCinemaParameterValue(schemas[2], false).value).toBe(false)
    expect(normalizeCinemaParameterValue(schemas[3], enumOptionB).value).toBe(enumOptionB)
    expect(normalizeCinemaParameterValue(schemas[4], true).value).toBe(true)
    expect(normalizeCinemaParameterValue(schemas[5], [-1, 0.5, 2, 1]).value).toEqual([0, 0.5, 1, 1])
    expect(normalizeCinemaParameterValue(schemas[6], [
      { id: pointB, position: 2, color: [1, 1, 1, 1] },
      { id: pointA, position: -1, color: [0, 0, 0, 1] },
    ]).value).toEqual([
      { id: pointA, position: 0, color: [0, 0, 0, 1] },
      { id: pointB, position: 1, color: [1, 1, 1, 1] },
    ])
    expect(normalizeCinemaParameterValue(schemas[7], [2, -1]).value).toEqual([1, 0])
    expect(normalizeCinemaParameterValue(schemas[8], [2, 0, -2]).value).toEqual([1, 0, -1])
    expect(normalizeCinemaParameterValue(schemas[9], [
      { id: pointB, position: 2, value: 1, interpolation: 'smooth' },
      { id: pointA, position: -1, value: 0 },
    ]).value).toEqual([
      { id: pointA, position: 0, value: 0 },
      { id: pointB, position: 1, value: 1, interpolation: 'smooth' },
    ])
    expect(normalizeCinemaParameterValue(schemas[10], { assetId, role: 'image' }).value).toEqual({ assetId, role: 'image' })
    expect(normalizeCinemaParameterValue(schemas[11], { assetId, role: 'logo' }).value).toEqual({ assetId, role: 'logo' })
    expect(normalizeCinemaParameterValue(schemas[12], 'DAYDREAMS').value).toBe('DAYDREAM')

    const invalidEnum = normalizeCinemaParameterValue(schemas[3], 'renamed-label')
    expect(invalidEnum.valid).toBe(false)
    expect(invalidEnum.value).toBe(enumOptionA)
    expect(invalidEnum.diagnostics[0].code).toBe('CINEMA_PARAMETER_VALUE_INVALID')
  })

  it('rejects invalid ranges, defaults, UI hints, and master binding metadata', () => {
    const invalid = {
      ...floatSchema(),
      min: 2,
      max: 1,
      default: 3,
      ui: { control: 'toggle' },
      masterBinding: { masterParameterId: intensityId, operation: 'warp', influence: 2 },
    } as unknown as CinemaParameterDefinition

    const codes = validateCinemaParameterSchema(invalid).map(diagnostic => diagnostic.code)
    expect(codes).toContain('CINEMA_PARAMETER_SCHEMA_INVALID')
    expect(codes).toContain('CINEMA_MASTER_BINDING_INVALID')
  })

  it('keeps stable IDs and paths unchanged when labels change', () => {
    const original = floatSchema({ label: 'Gain' })
    const renamed = floatSchema({ label: 'Brightness Power' })
    const originalPath = createCinemaParameterPath('effects', original.id, effectNodeId)
    const renamedPath = createCinemaParameterPath('effects', renamed.id, effectNodeId)

    expect(original.id).toBe(renamed.id)
    expect(originalPath).toBe(renamedPath)
  })

  it('exports a valid initial master catalog and semantic Brand Kit slots without a bridge', () => {
    expect(validateCinemaParameterSchemas(CINEMA_MASTER_PARAMETER_CATALOG, { owner: 'master' })).toEqual([])
    expect(CINEMA_MASTER_PARAMETER_IDS.intensity).toBe('intensity')
    expect(CINEMA_BRAND_PARAMETER_SLOTS.map(slot => slot.brandRole)).toEqual([
      'primary', 'secondary', 'accent', 'background', 'foreground', 'highlight', 'shadow',
    ])
    expect(CINEMA_MASTER_PARAMETER_CATALOG.some(parameter => parameter.masterBinding != null)).toBe(false)
  })
})

describe('Cinema parameter resolution', () => {
  it('applies the fixed resolution order and final safety clamp', () => {
    const schema = floatSchema({
      masterBinding: { masterParameterId: intensityId, operation: 'scale', influence: 1 },
    })
    const fixture = composition(schema)
    const registry = createCinemaNodeDefinitionRegistry([registryEntry(schema)]).registry
    const instance: CinemaCompositionInstance = {
      id: stableId<CinemaCompositionInstanceId>('stage-3-instance', 'composition instance'),
      compositionId: fixture.id,
      label: 'Stage 3 Instance',
      revision: 1,
      masterOverrides: {},
      nodeOverrides: [{ nodeId: effectNodeId, values: { [gainId]: 3 } }],
      cameraOverrides: [],
      assetBindingOverrides: [],
    }
    const path = createCinemaParameterPath('effects', gainId, effectNodeId)
    const beforeComposition = structuredClone(fixture)
    const beforeInstance = structuredClone(instance)
    const result = resolveCinemaParameterSnapshot({
      composition: fixture,
      registry,
      instance,
      modulationSnapshot: { [path]: 7 },
      performanceOverrides: { [path]: 8 },
    })
    const entry = result.entries.find(candidate => candidate.path === path)!

    expect(entry.trace.map(step => step.stage)).toEqual(CINEMA_PARAMETER_RESOLUTION_ORDER)
    expect(entry.trace.map(step => step.value)).toEqual([1, 2, 3, 3, 6, 7, 8, 5, 5, 5])
    expect(entry.value).toBe(5)
    expect(fixture).toEqual(beforeComposition)
    expect(instance).toEqual(beforeInstance)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(entry.trace)).toBe(true)
  })

  it('bridges semantic Brand Kit colors and protects exact policies from transient overrides', () => {
    const colorId = stableId<CinemaParameterId>('brand-color', 'parameter')
    const schema: CinemaParameterDefinition = {
      id: colorId,
      label: 'Brand Color',
      type: 'color',
      default: [0, 0, 0, 1],
      brandRole: 'accent',
      brandPolicy: 'exact',
    }
    const fixture = composition(schema)
    fixture.nodes[0].parameterValues = { [colorId]: [0.1, 0.1, 0.1, 1] }
    const registry = createCinemaNodeDefinitionRegistry([registryEntry(schema)]).registry
    const path = createCinemaParameterPath('effects', colorId, effectNodeId)
    const brand = bridgeCinemaBrandKit({
      palette: {
        primary: '#112233',
        secondary: '#223344',
        accent: '#00ff80',
        background: '#08090a',
        highlight: '#ffffff',
        text: '#f0f1f2',
      },
    })
    const result = resolveCinemaParameterSnapshot({
      composition: fixture,
      registry,
      brandColors: brand.colors,
      modulationSnapshot: { [path]: [1, 0, 0, 1] },
      performanceOverrides: { [path]: [0, 0, 1, 1] },
    })

    expect(brand.available).toBe(true)
    expect(brand.colors.accent).toEqual([0, 1, 128 / 255, 1])
    expect(result.values[path]).toEqual(brand.colors.accent)
    expect(result.entries.find(entry => entry.path === path)?.trace.find(step => step.stage === 'exact-brand-protection')).toMatchObject({ applied: true })
  })

  it('allows derived Brand Kit colors to continue through performance resolution and free colors to ignore the kit', () => {
    const colorId = stableId<CinemaParameterId>('brand-color-derived', 'parameter')
    const brand = bridgeCinemaBrandKit({
      palette: {
        primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff',
        background: '#000000', highlight: '#ffffff', text: '#eeeeee',
      },
    })
    const resolvePolicy = (brandPolicy: 'derived' | 'free', withPerformanceOverride: boolean) => {
      const schema: CinemaParameterDefinition = {
        id: colorId,
        label: 'Brand Color',
        type: 'color',
        default: [0.25, 0.25, 0.25, 1],
        brandRole: 'primary',
        brandPolicy,
      }
      const fixture = composition(schema)
      fixture.nodes[0].parameterValues = { [colorId]: [0.2, 0.2, 0.2, 1] }
      const registry = createCinemaNodeDefinitionRegistry([registryEntry(schema)]).registry
      const path = createCinemaParameterPath('effects', colorId, effectNodeId)
      return resolveCinemaParameterSnapshot({
        composition: fixture,
        registry,
        brandColors: brand.colors,
        ...(withPerformanceOverride ? { performanceOverrides: { [path]: [0, 0, 1, 1] } } : {}),
      }).values[path]
    }

    expect(resolvePolicy('derived', false)).toEqual([1, 0, 0, 1])
    expect(resolvePolicy('derived', true)).toEqual([0, 0, 1, 1])
    expect(resolvePolicy('free', false)).toEqual([0.2, 0.2, 0.2, 1])
  })

  it('applies scaling master influence without persisting resolved values', () => {
    const schema = floatSchema({
      max: 10,
      masterBinding: { masterParameterId: intensityId },
    })
    const fixture = composition(schema)
    const registry = createCinemaNodeDefinitionRegistry([registryEntry(schema)]).registry
    const path = createCinemaParameterPath('effects', gainId, effectNodeId)
    const result = resolveCinemaParameterSnapshot({ composition: fixture, registry })

    expect(result.values[path]).toBe(4)
    expect(fixture.nodes[0].parameterValues[gainId]).toBe(2)
  })

  it('resolves all destination namespaces and diagnoses unavailable destinations', () => {
    const schema = floatSchema()
    const fixture: CinemaCompositionDefinition = {
      ...composition(schema),
      cameras: [{ id: cameraId, label: 'Hero', mode: 'locked', parameterValues: { [gainId]: 1.5 } }],
    }
    const registry = createCinemaNodeDefinitionRegistry([registryEntry(schema)]).registry
    const cameraSchemas = { [cameraId]: [schema] }

    expect(resolveCinemaParameterDestination(createCinemaParameterPath('master', intensityId), { composition: fixture, registry }).ok).toBe(true)
    expect(resolveCinemaParameterDestination(createCinemaParameterPath('nodes', gainId, effectNodeId), { composition: fixture, registry }).ok).toBe(true)
    expect(resolveCinemaParameterDestination(createCinemaParameterPath('effects', gainId, effectNodeId), { composition: fixture, registry }).ok).toBe(true)
    expect(resolveCinemaParameterDestination(createCinemaParameterPath('cameras', gainId, cameraId), { composition: fixture, registry, cameraParameterSchemas: cameraSchemas }).ok).toBe(true)

    const unavailable = resolveCinemaParameterDestination('effects.missing-node.gain', { composition: fixture, registry })
    expect(unavailable.ok).toBe(false)
    expect(unavailable.diagnostics[0].code).toBe('CINEMA_PARAMETER_DESTINATION_UNAVAILABLE')
  })
})

describe('Cinema UI-neutral control descriptors', () => {
  it('contains the metadata required by a later generated Inspector', () => {
    const optionA = stableId<CinemaEnumOptionId>('soft', 'enum option')
    const optionB = stableId<CinemaEnumOptionId>('hard', 'enum option')
    const schema: CinemaParameterDefinition = {
      id: stableId('quality-mode', 'parameter'),
      label: 'Quality Mode',
      description: 'Controls effect quality.',
      group: 'Quality',
      type: 'enum',
      default: optionA,
      options: [{ id: optionA, label: 'Soft' }, { id: optionB, label: 'Hard' }],
      ui: { control: 'select', order: 4, helpText: 'Higher modes cost more GPU time.' },
    }
    const path = createCinemaParameterPath('effects', schema.id, effectNodeId)
    const result = createCinemaControlDescriptors({
      namespace: 'effects',
      ownerId: effectNodeId,
      schemas: [schema],
      values: { [schema.id]: optionB },
      disabledReasons: { [path]: 'Renderer plugin unavailable.' },
    })

    expect(result.diagnostics.counts.error).toBe(0)
    expect(result.descriptors[0]).toMatchObject({
      id: 'quality-mode',
      path,
      control: 'select',
      label: 'Quality Mode',
      group: 'Quality',
      order: 4,
      value: optionB,
      disabled: true,
      disabledReason: 'Renderer plugin unavailable.',
      options: [{ id: optionA, label: 'Soft' }, { id: optionB, label: 'Hard' }],
      help: {
        description: 'Controls effect quality.',
        helpText: 'Higher modes cost more GPU time.',
      },
    })
  })
})
