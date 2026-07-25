import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../../../features/musicIntelligence/types'
import { buildSharedPerformanceContext } from '../../../../../../features/performanceCore'
import type { ReactTrackSection } from '../../../ReactTypes'
import { NEUTRAL_AUDIO_FRAME, NEUTRAL_TIMING_FRAME } from '../../audio/shaderAudioTypes'
import {
  resolveShaderRendererSectionAction,
  resolveShaderRendererSectionTransitionRequest,
} from '../../ShaderEngineRenderer'
import { ShaderModulationEvaluator } from '../../modulation/ShaderModulationEvaluator'
import { ShaderModulationMatrix } from '../../modulation/ShaderModulationMatrix'
import { createModulationRoute } from '../../modulation/shaderModulationTypes'
import { shaderRegistry } from '../../registry'
import { ShaderDefinitionValidator } from '../../registry/ShaderDefinitionValidator'
import { PRODUCTION_SCENES } from '../../scenes'
import { migrateShaderPanelPersistedState } from '../../ui/shaderPanelStore'
import { ShaderSectionChoreography } from '../../transitions/ShaderSectionChoreography'
import { ShaderPerformanceRuntime } from '../ShaderPerformanceRuntime'
import {
  markShaderRouteModified,
  resolveShaderRoutesForDefinition,
} from '../ShaderPerformanceRoutes'

const SECTIONS: ReactTrackSection[] = [
  { id: 'intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 8, intensity: 0.25, source: 'auto', confidence: 0.96 },
  { id: 'verse', label: 'Verse', type: 'verse', startSec: 8, endSec: 24, intensity: 0.5, source: 'auto', confidence: 0.96 },
  { id: 'build', label: 'Build', type: 'build', startSec: 24, endSec: 32, intensity: 0.85, source: 'auto', confidence: 0.96 },
  { id: 'drop-1', label: 'Drop 1', type: 'drop', startSec: 32, endSec: 64, intensity: 1, source: 'auto', confidence: 0.96, interpretation: { familyId: 'drop', occurrenceIndex: 1 } },
  { id: 'break', label: 'Breakdown', type: 'breakdown', startSec: 64, endSec: 80, intensity: 0.35, source: 'auto', confidence: 0.96 },
  { id: 'build-2', label: 'Build 2', type: 'build', startSec: 80, endSec: 88, intensity: 0.9, source: 'auto', confidence: 0.96 },
  { id: 'drop-2', label: 'Drop 2', type: 'drop', startSec: 88, endSec: 120, intensity: 1, source: 'auto', confidence: 0.96, interpretation: { familyId: 'drop', occurrenceIndex: 2 } },
  { id: 'outro', label: 'Outro', type: 'outro', startSec: 120, endSec: 136, intensity: 0.2, source: 'auto', confidence: 0.96 },
]

function frameAt(timeSec: number, options: { kick?: boolean; semantic?: boolean; confidence?: number } = {}): MusicIntelligenceFrame {
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  const section = SECTIONS.find(candidate => timeSec >= candidate.startSec && timeSec < candidate.endSec)
  const confidence = options.confidence ?? 0.96
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: Math.max(1, Math.round(timeSec * 60)),
    sourceId: 'shader-test-track',
    trackId: 'shader-test-track',
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      sub: 0.72,
      bass: 0.78,
      mid: 0.56,
      high: 0.61,
      normalizedSub: 0.72,
      normalizedBass: 0.78,
      normalizedMid: 0.56,
      normalizedHigh: 0.61,
      volume: 0.8,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: confidence,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      beatHit: options.kick ?? false,
      kickHit: options.kick ?? false,
      kickStrength: options.kick ? 1 : 0,
      downbeatHit: options.kick ?? false,
      phrase4Progress: (Math.floor(beatIndex / 4) % 4) / 4,
      phrase8Progress: (Math.floor(beatIndex / 4) % 8) / 8,
      phrase16Progress: (Math.floor(beatIndex / 4) % 16) / 16,
      phrase4Hit: beatIndex % 16 === 0,
      phrase8Hit: beatIndex % 32 === 0,
      phrase16Hit: beatIndex % 64 === 0,
    },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: section?.type ?? 'unknown',
      label: section?.label ?? 'Unknown',
      startSec: section?.startSec ?? 0,
      endSec: section?.endSec ?? 136,
      progress: section ? (timeSec - section.startSec) / (section.endSec - section.startSec) : 0,
      intensity: section?.intensity ?? 0.5,
      confidence,
      source: 'analysis',
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: 0.84,
      shortTerm: 0.78,
      longTerm: 0.62,
      percentile: 0.86,
      buildProgress: section?.type === 'build'
        ? (timeSec - section.startSec) / (section.endSec - section.startSec)
        : 0,
      dropImpact: options.kick && section?.type === 'drop' ? 0.95 : 0,
      tension: section?.type === 'build' ? 0.82 : 0.55,
      complexity: 0.66,
      spectralFlux: options.kick ? 0.9 : 0.3,
    },
    semanticMoments: options.semantic ? [{
      id: `semantic-${timeSec}`,
      timeSec,
      durationSec: 0.2,
      type: 'major_impact',
      confidence,
      source: 'structural_analysis',
    }] : [],
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: true,
      stemCurves: true,
      lyrics: true,
    },
    confidence: {
      ...DEFAULT_MI_FRAME.confidence,
      overall: confidence,
      rhythm: confidence,
      section: confidence,
    },
  }
}

function contextAt(timeSec: number, previous: ReturnType<typeof buildSharedPerformanceContext> | null = null, options: { kick?: boolean; semantic?: boolean; confidence?: number } = {}) {
  return buildSharedPerformanceContext({
    audioTimeSec: timeSec,
    frame: frameAt(timeSec, options),
    resolvedSections: SECTIONS,
    durationSec: 136,
    trackIdentity: 'shader-test-track',
    previous,
  })
}

describe('Shader native show director programs', () => {
  it('authors non-empty, differentiated programs for every production shader', () => {
    expect(PRODUCTION_SCENES).toHaveLength(8)
    const fingerprints = new Set<string>()
    for (const definition of PRODUCTION_SCENES) {
      const program = definition.performanceProgram
      expect(program).toBeDefined()
      expect(program!.authoredRoutes.length).toBeGreaterThanOrEqual(6)
      expect(program!.scenes.some(scene => scene.fourBarActions?.length)).toBe(true)
      expect(program!.scenes.some(scene => scene.eightBarRecruitment?.length)).toBe(true)
      expect(program!.scenes.some(scene => scene.sixteenBarEvolution?.length)).toBe(true)
      expect(program!.scenes.some(scene => scene.dropOccurrence?.minOccurrence === 2)).toBe(true)
      fingerprints.add(program!.authoredRoutes.map(route => `${route.source}:${route.targetParamId}`).join('|'))
    }
    expect(fingerprints.size).toBe(PRODUCTION_SCENES.length)
  })

  it('installs authored routes into legacy empty-route state', () => {
    const shaderId = PRODUCTION_SCENES[0].id
    const migrated = migrateShaderPanelPersistedState({
      activeShaderId: shaderId,
      paramValuesByShaderId: {},
      routesByShaderId: { [shaderId]: [] },
      textureSelectionsByShaderId: {},
    })
    expect(migrated.routesByShaderId?.[shaderId].length).toBeGreaterThan(0)
    expect(migrated.routesByShaderId?.[shaderId].every(route => route.origin === 'built-in')).toBe(true)
  })

  it('preserves user routes, disabled authored routes, and authored edits on reselection', () => {
    const definition = PRODUCTION_SCENES[0]
    const installed = resolveShaderRoutesForDefinition(definition, [])
    const edited = markShaderRouteModified(installed[0], { amount: 0.333, enabled: false })
    const userRoute = createModulationRoute({ source: 'energy', targetParamId: installed[1].targetParamId, amount: 0.19 })
    const resolved = resolveShaderRoutesForDefinition(definition, [edited, ...installed.slice(1), userRoute])
    const retained = resolved.find(route => route.id === edited.id)
    expect(retained?.amount).toBe(0.333)
    expect(retained?.enabled).toBe(false)
    expect(retained?.modified).toBe(true)
    expect(resolved.some(route => route.id === userRoute.id && route.origin !== 'built-in')).toBe(true)
    expect(new Set(resolved.map(route => route.id)).size).toBe(resolved.length)
  })

  it('changes a shader target on a kick without manual route authoring', () => {
    const definition = PRODUCTION_SCENES.find(candidate => candidate.id === 'shader-neon-tunnel')!
    const routes = resolveShaderRoutesForDefinition(definition, [])
    const context = contextAt(34, null, { kick: true })
    const runtime = new ShaderPerformanceRuntime()
    const programFrame = runtime.resolve(definition, definition.defaults, context, routes, 0, null)
    const matrix = new ShaderModulationMatrix()
    matrix.setDefinition(definition)
    matrix.fromArray(routes)
    const evaluator = new ShaderModulationEvaluator()
    const evaluated = evaluator.evaluate(
      matrix,
      definition,
      { ...NEUTRAL_AUDIO_FRAME, kick: 1, kickHit: 1, bass: 0.8, energy: 0.8 },
      { ...NEUTRAL_TIMING_FRAME, playbackTime: 34 },
      programFrame.paramValues,
      0.016,
      definition.id,
      frameAt(34, { kick: true }),
      context,
    )
    expect(evaluated.activeRouteCount).toBeGreaterThan(0)
    expect(evaluated.params.tunnelRadius.effectiveValue).not.toEqual(programFrame.paramValues.tunnelRadius)
  })

  it('uses a declared target capability fallback when a preferred target is unavailable', () => {
    const definition = PRODUCTION_SCENES.find(candidate => candidate.id === 'shader-neon-tunnel')!
    const original = resolveShaderRoutesForDefinition(definition, [])[0]
    const route = {
      ...original,
      targetParamId: 'future-tunnel-depth',
      fallbackTargetParamIds: [original.targetParamId],
    }
    const matrix = new ShaderModulationMatrix()
    matrix.setDefinition(definition)
    matrix.fromArray([route])
    expect(matrix.getActiveRoutes()).toHaveLength(1)
    const context = contextAt(34, null, { kick: true })
    const evaluated = new ShaderModulationEvaluator().evaluate(
      matrix,
      definition,
      { ...NEUTRAL_AUDIO_FRAME, kick: 1, kickHit: 1 },
      { ...NEUTRAL_TIMING_FRAME, playbackTime: 34 },
      definition.defaults,
      0.016,
      definition.id,
      frameAt(34, { kick: true }),
      context,
    )
    expect(evaluated.resolvedTargetByRouteId?.[route.id]).toBe(original.targetParamId)
  })

  it('reconstructs identical build and drop plans after seeking', () => {
    const definition = PRODUCTION_SCENES.find(candidate => candidate.id === 'shader-reactor')!
    const routes = resolveShaderRoutesForDefinition(definition, [])
    const directRuntime = new ShaderPerformanceRuntime()
    const directBuild = directRuntime.resolve(definition, definition.defaults, contextAt(29), routes, 0, null)
    const verse = contextAt(12)
    const seekBuild = contextAt(29, verse)
    const seekRuntime = new ShaderPerformanceRuntime()
    const reconstructedBuild = seekRuntime.resolve(definition, definition.defaults, seekBuild, routes, 0, null)
    expect(reconstructedBuild.paramValues).toEqual(directBuild.paramValues)
    expect(reconstructedBuild.snapshot.scenePlanId).toBe(directBuild.snapshot.scenePlanId)
    expect(reconstructedBuild.snapshot.transportReconstructed).toBe(true)

    const dropOne = directRuntime.resolve(definition, definition.defaults, contextAt(36), routes, 0, null)
    const dropTwo = directRuntime.resolve(definition, definition.defaults, contextAt(92), routes, 0, null)
    expect(dropTwo.snapshot.dropOccurrence).toBeGreaterThan(dropOne.snapshot.dropOccurrence)
    expect(dropTwo.paramValues).not.toEqual(dropOne.paramValues)
  })

  it('does not replay the same semantic event every frame', () => {
    const definition = PRODUCTION_SCENES.find(candidate => candidate.id === 'shader-reactor')!
    const routes = resolveShaderRoutesForDefinition(definition, [])
    const runtime = new ShaderPerformanceRuntime()
    const context = contextAt(92, null, { semantic: true, kick: true })
    const first = runtime.resolve(definition, definition.defaults, context, routes, 0, null)
    const repeated = runtime.resolve(definition, definition.defaults, context, routes, 0, null)
    expect(first.feedbackResetRequested).toBe(true)
    expect(repeated.feedbackResetRequested).toBe(false)
  })

  it('falls back to the authored unknown plan when section confidence is low', () => {
    const definition = PRODUCTION_SCENES[0]
    const routes = resolveShaderRoutesForDefinition(definition, [])
    const runtime = new ShaderPerformanceRuntime()
    const lowConfidence = contextAt(29, null, { confidence: 0.1 })
    const resolved = runtime.resolve(definition, definition.defaults, lowConfidence, routes, 0, null)
    expect(resolved.snapshot.scenePlanId).toBe(`${definition.id}:unknown`)
    expect(resolved.snapshot.invalidTargetIds).toEqual([])
  })

  it('reconstructs same-scene section choreography and safely handles unknown sections', () => {
    const definition = PRODUCTION_SCENES[0]
    const choreography = new ShaderSectionChoreography()
    choreography.enabled = true
    choreography.setRules([...(definition.performanceProgram?.sectionChoreography ?? [])])
    choreography.setCurrentScene(definition.id)
    const buildContext = contextAt(29)
    const buildAction = resolveShaderRendererSectionAction(choreography, buildContext, true)
    const unknownAction = choreography.onSection('unknown', { reconstruct: true })
    expect(buildAction?.toSceneId).toBe(definition.id)
    expect(buildAction?.paramOverrides.performancePlan).toBe('build')
    expect(unknownAction?.paramOverrides.performancePlan).toBe('unknown')
  })

  it('turns same-shader section choreography into a visible compositor request but not on seek reconstruction', () => {
    const definition = PRODUCTION_SCENES[0]
    const choreography = new ShaderSectionChoreography()
    choreography.enabled = true
    choreography.setRules([...(definition.performanceProgram?.sectionChoreography ?? [])])
    choreography.setCurrentScene(definition.id)
    const action = resolveShaderRendererSectionAction(choreography, contextAt(29), true)

    const liveRequest = resolveShaderRendererSectionTransitionRequest(action, definition.id, false)
    const reconstructRequest = resolveShaderRendererSectionTransitionRequest(action, definition.id, true)

    expect(liveRequest).toMatchObject({
      mode: 'self',
      toSceneId: definition.id,
      definition: { type: action?.transition.type },
    })
    expect(reconstructRequest?.mode).toBe('reconstruct')
    expect(reconstructRequest?.definition.clearFeedback).toBe(action?.clearFeedback)
  })

  it('validates every registered shader program and rejects invalid targets visibly', () => {
    const validation = shaderRegistry.validateAll()
    for (const definition of PRODUCTION_SCENES) expect(validation[definition.id].valid).toBe(true)

    const base = PRODUCTION_SCENES[0]
    const invalid = ShaderDefinitionValidator.validate({
      ...base,
      id: 'invalid-shader-program',
      performanceProgram: {
        ...base.performanceProgram!,
        id: 'invalid-shader-program:native-show',
        authoredRoutes: [{ ...base.performanceProgram!.authoredRoutes[0], targetParamId: 'missing-target' }],
      },
    })
    expect(invalid.valid).toBe(false)
    expect(invalid.errors.some(error => error.message.includes('missing-target'))).toBe(true)
  })
})
