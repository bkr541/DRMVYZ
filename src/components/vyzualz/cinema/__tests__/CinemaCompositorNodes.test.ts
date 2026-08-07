import { describe, expect, it } from 'vitest'
import {
  CINEMA_BLEND_NODE_DEFINITIONS,
  CINEMA_COMPOSITION_SCHEMA_ID,
  CINEMA_COMPOSITION_SCHEMA_VERSION,
  CINEMA_BLEND_NODE_TYPE_IDS,
  CINEMA_COLOR_CONVERSION_GLSL,
  CINEMA_COMPOSITOR_COLOR_OUTPUT_PORT_ID,
  CINEMA_COMPOSITOR_EFFECT_INPUT_PORT_ID,
  CINEMA_COMPOSITOR_HISTORY_INPUT_PORT_ID,
  CINEMA_COMPOSITOR_PERSISTED_DEFINITIONS,
  CINEMA_COMPOSITOR_RUNTIME_REGISTRATIONS,
  CINEMA_EFFECT_NODE_DEFINITIONS,
  CINEMA_EFFECT_NODE_TYPE_IDS,
  CINEMA_FOUNDATION_COLOR_OUTPUT_PORT_ID,
  CINEMA_FOUNDATION_GRADIENT_TYPE_ID,
  CINEMA_FOUNDATION_INPUT_PORT_ID,
  CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
  CINEMA_PRODUCTION_PERSISTED_DEFINITIONS,
  CINEMA_PRODUCTION_RUNTIME_REGISTRY,
  CINEMA_STAGE16_REFERENCE_COMPOSITION,
  CINEMA_STAGE16_REFERENCE_COMPOSITION_ID,
  CINEMA_TRANSITION_NODE_DEFINITION,
  CinemaCompositionTransitionClock,
  blendCinemaPremultiplied,
  compileCinemaCompositionGraph,
  convertCinemaLinearDisplayP3ToLinearSrgb,
  createCinemaDefinitionRegistryFromPersisted,
  createCinemaFoundationPersistedState,
  encodeCinemaSrgb,
  linearizeCinemaSrgb,
  resolveCinemaMaskWeight,
  type CinemaColor,
  type CinemaCompositionDefinition,
} from '..'
import { cinemaStableId, type CinemaCompositionId, type CinemaConnectionId, type CinemaNodeId } from '../CinemaIdentifiers'

describe('Cinema Stage 16 compositor contracts', () => {
  it('implements the required premultiplied-alpha blend equations without corrupting transparent edges', () => {
    const transparent: CinemaColor = [0, 0, 0, 0]
    const halfRed: CinemaColor = [0.4, 0.1, 0.05, 0.5]
    expect(blendCinemaPremultiplied(transparent, halfRed, 'normal')).toEqual(halfRed)

    const opaqueBackground: CinemaColor = [0.2, 0.4, 0.6, 1]
    expect(blendCinemaPremultiplied(opaqueBackground, halfRed, 'normal')).toEqual([0.5, 0.3, 0.35, 1])
    expect(blendCinemaPremultiplied([0.5, 0.5, 0.5, 1], [0.2, 0.4, 0.8, 1], 'multiply')).toEqual([0.1, 0.2, 0.4, 1])

    for (const mode of Object.keys(CINEMA_BLEND_NODE_TYPE_IDS) as Array<keyof typeof CINEMA_BLEND_NODE_TYPE_IDS>) {
      const blended = blendCinemaPremultiplied(opaqueBackground, halfRed, mode, 0.75)
      expect(blended.every(Number.isFinite)).toBe(true)
      expect(blended[3]).toBe(1)
    }
  })

  it('samples alpha and linear-light luminance masks deterministically', () => {
    const sample: CinemaColor = [0.1, 0.2, 0.05, 0.5]
    expect(resolveCinemaMaskWeight(sample, 'alpha')).toBe(0.5)
    expect(resolveCinemaMaskWeight(sample, 'luminance')).toBeCloseTo(0.33582, 5)
    expect(resolveCinemaMaskWeight(sample, 'luminance', true)).toBeCloseTo(0.66418, 5)
  })

  it('uses explicit, reversible sRGB conversion boundaries', () => {
    for (const value of [0, 0.003, 0.04, 0.18, 0.5, 1]) {
      expect(encodeCinemaSrgb(linearizeCinemaSrgb(value))).toBeCloseTo(value, 6)
    }
  })

  it('converts Display-P3 primaries into the shared internal linear-sRGB convention', () => {
    expect(convertCinemaLinearDisplayP3ToLinearSrgb([1, 0, 0])).toEqual([1.224745, -0.042058, -0.019642])
    expect(convertCinemaLinearDisplayP3ToLinearSrgb([0, 1, 0])).toEqual([-0.224904, 1.042081, -0.078655])
    expect(CINEMA_COLOR_CONVERSION_GLSL).toContain('cinemaDisplayP3ToLinearSrgb')
  })

  it('retains progress when an automatic composition transition is interrupted', () => {
    const clock = new CinemaCompositionTransitionClock()
    expect(clock.begin('first', 0, 2)).toMatchObject({ progress: 0, generation: 1, active: true })
    expect(clock.sample(1)).toMatchObject({ progress: 0.5, active: true })
    expect(clock.begin('second', 1, 2)).toMatchObject({ progress: 0.5, initialProgress: 0.5, generation: 2 })
    expect(clock.sample(2)).toMatchObject({ progress: 0.75, active: true })
    expect(clock.sample(3)).toMatchObject({ progress: 1, active: false })
  })

  it('registers every mixer, effect, feedback contract, and transition as stable production definitions', () => {
    expect(Object.keys(CINEMA_BLEND_NODE_DEFINITIONS)).toHaveLength(8)
    expect(Object.keys(CINEMA_EFFECT_NODE_DEFINITIONS)).toHaveLength(13)
    expect(CINEMA_COMPOSITOR_PERSISTED_DEFINITIONS).toHaveLength(23)
    expect(CINEMA_COMPOSITOR_RUNTIME_REGISTRATIONS).toHaveLength(23)

    for (const definition of [
      ...Object.values(CINEMA_BLEND_NODE_DEFINITIONS),
      ...Object.values(CINEMA_EFFECT_NODE_DEFINITIONS),
      CINEMA_TRANSITION_NODE_DEFINITION,
    ]) {
      expect(definition.output).toMatchObject({ colorSpace: 'linear-srgb', alphaMode: 'premultiplied' })
      expect(CINEMA_PRODUCTION_RUNTIME_REGISTRY.getByTypeId(definition.typeId)).toBeDefined()
    }

    const feedback = CINEMA_COMPOSITOR_PERSISTED_DEFINITIONS.find(candidate => (
      candidate.definition.typeId === CINEMA_EFFECT_NODE_TYPE_IDS.feedback
    ))
    expect(feedback?.feedback).toEqual({
      inputPortId: CINEMA_COMPOSITOR_HISTORY_INPUT_PORT_ID,
      outputPortId: CINEMA_COMPOSITOR_COLOR_OUTPUT_PORT_ID,
      historyFrames: 1,
    })
  })

  it('compiles the production Stage 16 world, logo, lyrics, mask, generator, effects, and transition graph', () => {
    const registry = createCinemaDefinitionRegistryFromPersisted(
      CINEMA_PRODUCTION_PERSISTED_DEFINITIONS,
      CINEMA_PRODUCTION_RUNTIME_REGISTRY,
    )
    const compiled = compileCinemaCompositionGraph(CINEMA_STAGE16_REFERENCE_COMPOSITION, registry.registry)

    expect(registry.diagnostics).toEqual([])
    expect(compiled.diagnostics.counts).toEqual({ info: 0, warning: 0, error: 0, fatal: 0 })
    expect(compiled.plan).not.toBeNull()
    expect(compiled.plan?.nodeOrder).toHaveLength(13)
    expect(CINEMA_STAGE16_REFERENCE_COMPOSITION.nodes.map(node => node.family)).toEqual(expect.arrayContaining([
      'procedural', 'effect', 'logo', 'lyrics', 'mixer', 'output',
    ]))
    expect(CINEMA_STAGE16_REFERENCE_COMPOSITION.metadata.provenance).toEqual({ builtIn: true, stage: 16 })
  })

  it('keeps Stage 16 additive to the current schema and reconciles its built-in graph on fresh state', () => {
    const state = createCinemaFoundationPersistedState()
    expect(state.compositions.some(composition => composition.id === CINEMA_STAGE16_REFERENCE_COMPOSITION_ID)).toBe(true)
    expect(state.editorMetadata.compositorNodeVersion).toBe(1)
    expect(state.schemaVersion).toBe(CINEMA_COMPOSITION_SCHEMA_VERSION)
  })

  it('compiles the feedback effect as an explicit one-frame graph cycle', () => {
    const composition = feedbackComposition()
    const registry = createCinemaDefinitionRegistryFromPersisted(
      CINEMA_PRODUCTION_PERSISTED_DEFINITIONS,
      CINEMA_PRODUCTION_RUNTIME_REGISTRY,
    )
    const compiled = compileCinemaCompositionGraph(composition, registry.registry)

    expect(compiled.diagnostics.counts.error).toBe(0)
    expect(compiled.diagnostics.counts.fatal).toBe(0)
    expect(compiled.plan?.feedbackEdges).toHaveLength(1)
    expect(compiled.plan?.feedbackEdges[0]).toMatchObject({
      sourceNodeId: 'stage16-feedback',
      targetNodeId: 'stage16-feedback',
      historyFrames: 1,
    })
  })
})

function feedbackComposition(): CinemaCompositionDefinition {
  const sourceId = cinemaStableId<CinemaNodeId>('stage16-feedback-source', 'node')
  const feedbackId = cinemaStableId<CinemaNodeId>('stage16-feedback', 'node')
  const outputId = cinemaStableId<CinemaNodeId>('stage16-feedback-output', 'node')
  const connection = (
    id: string,
    fromNodeId: CinemaNodeId,
    fromPortId: string,
    toNodeId: CinemaNodeId,
    toPortId: string,
  ) => ({
    id: cinemaStableId<CinemaConnectionId>(id, 'connection'),
    from: { nodeId: fromNodeId, portId: fromPortId as never },
    to: { nodeId: toNodeId, portId: toPortId as never },
    enabled: true,
  })
  return {
    schemaId: CINEMA_COMPOSITION_SCHEMA_ID,
    schemaVersion: CINEMA_COMPOSITION_SCHEMA_VERSION,
    id: cinemaStableId<CinemaCompositionId>('stage16-feedback-cycle-test', 'composition'),
    revision: 1,
    metadata: { name: 'Stage 16 Feedback Cycle Test' },
    nodes: [
      { id: sourceId, typeId: CINEMA_FOUNDATION_GRADIENT_TYPE_ID, typeVersion: 1, family: 'procedural', label: 'Source', enabled: true, opacity: 1, parameterValues: {} },
      { id: feedbackId, typeId: CINEMA_EFFECT_NODE_TYPE_IDS.feedback, typeVersion: 1, family: 'effect', label: 'Feedback', enabled: true, opacity: 1, parameterValues: {} },
      { id: outputId, typeId: CINEMA_FOUNDATION_OUTPUT_TYPE_ID, typeVersion: 1, family: 'output', label: 'Output', enabled: true, opacity: 1, parameterValues: {} },
    ],
    connections: [
      connection('source-feedback', sourceId, CINEMA_FOUNDATION_COLOR_OUTPUT_PORT_ID, feedbackId, CINEMA_COMPOSITOR_EFFECT_INPUT_PORT_ID),
      connection('feedback-history', feedbackId, CINEMA_COMPOSITOR_COLOR_OUTPUT_PORT_ID, feedbackId, CINEMA_COMPOSITOR_HISTORY_INPUT_PORT_ID),
      connection('feedback-output', feedbackId, CINEMA_COMPOSITOR_COLOR_OUTPUT_PORT_ID, outputId, CINEMA_FOUNDATION_INPUT_PORT_ID),
    ],
    outputNodeId: outputId,
    masterParameters: [],
    masterValues: {},
    cameras: [],
    assetBindings: [],
    modulationRoutes: [],
    performanceRules: [],
  }
}
