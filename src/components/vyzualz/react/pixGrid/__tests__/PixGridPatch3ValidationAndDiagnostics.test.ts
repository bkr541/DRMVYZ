import { describe, expect, it } from 'vitest'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { createDefaultPixGridReactionAssignment, createPixGridGroup } from '../PixGridGroups'
import {
  PixGridReactionRuntime,
  createSilentPixGridAudioFrame,
} from '../PixGridAudioRouting'
import { PIX_GRID_PRESETS } from '../PixGridPresets'
import { auditPixGridPresetRenderedReactivity } from '../PixGridReactivityAudit'
import { applyPixGridRuntimeControls } from '../PixGridRuntimeControls'
import { applyPixGridPresetSettings } from '../PixGridState'
import { ensurePixGridRuntimeAudioRoutes } from '../PixGridStateMigration'
import {
  comparePixGridRendererSemanticPlans,
  inspectPixGridGroups,
  validatePixGridState,
  type PixGridRendererSemanticPlan,
} from '../PixGridValidationAudit'
import {
  PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION,
  PIX_GRID_STATE_VERSION,
  type PixGridReactionAssignment,
  type PixGridState,
} from '../PixGridTypes'
import { normalizePixGridReactionAssignment } from '../PixGridValidation'

function stateForPreset(presetId: string): PixGridState {
  const preset = PIX_GRID_PRESETS.find(candidate => candidate.id === presetId)
  if (!preset) throw new Error(`Missing preset ${presetId}`)
  return applyPixGridPresetSettings(createDefaultPixGridState(), preset.id, preset.pixGridSettings)
}

function assignment(patch: Partial<PixGridReactionAssignment> = {}): PixGridReactionAssignment {
  return normalizePixGridReactionAssignment({
    ...createDefaultPixGridReactionAssignment(),
    id: 'patch-3-route',
    name: 'Patch 3 route',
    source: 'bass',
    target: 'brightness',
    targetScope: 'group',
    amount: 1,
    threshold: 0,
    attack: 0,
    hold: 0.05,
    release: 0.05,
    cooldown: 0,
    smoothing: 0,
    minimumConfidence: 0,
    capabilityFallback: 'energy',
    clamp: [0, 1],
    ...patch,
  }, 0, 'group') as PixGridReactionAssignment
}

function semanticPlan(patch: Partial<PixGridRendererSemanticPlan> = {}): PixGridRendererSemanticPlan {
  return {
    sceneId: 'scene-a',
    visibleLayerIds: ['layer-a'],
    activeGroupIds: ['group-a'],
    routeEnvelopeValues: { 'route-a': 0.75 },
    affectedCellIds: [1, 2, 3],
    paletteIntent: ['accent'],
    frameSelection: { 'layer-a': 2 },
    motionMultiplier: 0.5,
    bassReactivityGain: 1,
    sectionType: 'drop',
    phraseIndex: 4,
    ...patch,
  }
}

describe('PixGrid bundled preset reactivity audit', () => {
  it.each(PIX_GRID_PRESETS.filter(preset => preset.pixGridSettings).map(preset => [preset.id, preset] as const))(
    '%s passes structural and rendered-pixel validation',
    (_presetId: string, preset: (typeof PIX_GRID_PRESETS)[number]) => {
      const state = stateForPreset(preset.id)
      const report = auditPixGridPresetRenderedReactivity(preset, state)
      expect(report.validation.errors).toEqual([])
      expect(report.checks.filter(check => !check.passed)).toEqual([])
      expect(report.acceptanceMatrix.filter(row => !row.passed)).toEqual([])
      expect(report.acceptanceMatrix.map(row => row.id)).toEqual(expect.arrayContaining([
        'fresh-canonical-state',
        'legacy-migrated-state',
        'live-analyser-only',
        'missing-advanced-source-fallbacks',
        'canvas-gpu-semantic-parity',
        'quality-draft',
        'quality-ultra',
        'complete-unified-pipeline',
      ]))
      expect(report.passed).toBe(true)
      expect(new Set(Object.values(report.pixelHashes)).size).toBeGreaterThan(3)
    },
  )
})

describe('PixGrid canonical validation', () => {
  it('detects structurally invalid and ineffective music-reactive configuration', () => {
    const base = stateForPreset('pix-grid-bass-beacon')
    const emptyGroup = createPixGridGroup({
      name: 'Empty mask',
      source: 'manualSelection',
      mask: { kind: 'runs', runs: [] },
      runs: [],
    })
    const invalidRoute: PixGridReactionAssignment = {
      ...assignment({ id: 'invalid-route' }),
      targetId: 'missing-group',
      amount: 0,
      threshold: 2,
      attack: -1,
      cooldown: -2,
      capabilityFallback: 'disable',
    }
    const invalid = {
      ...base,
      version: PIX_GRID_STATE_VERSION,
      groups: [{ ...emptyGroup, id: 'duplicate-group' }, { ...emptyGroup, id: 'duplicate-group' }],
      audioAssignments: [invalidRoute, { ...invalidRoute }],
      configuration: {
        ...base.configuration,
        musicReactiveConfigurationVersion: PIX_GRID_MUSIC_REACTIVE_CONFIGURATION_VERSION,
      },
    } as PixGridState

    const report = validatePixGridState(invalid, {
      builtInPresetId: 'pix-grid-bass-beacon',
      capabilities: { bass: false },
    })
    const codes = new Set(report.issues.map(item => item.code))
    expect(codes.has('duplicate-group-id')).toBe(true)
    expect(codes.has('duplicate-assignment-id')).toBe(true)
    expect(codes.has('empty-group-mask')).toBe(true)
    expect(codes.has('missing-assignment-target')).toBe(true)
    expect(codes.has('ineffective-route-amount')).toBe(true)
    expect(codes.has('unsupported-source-without-fallback')).toBe(true)
    expect(report.valid).toBe(false)
  })

  it('distinguishes source-backed masks awaiting render data from truly empty masks', () => {
    const state = stateForPreset('pix-grid-bass-beacon')
    const inspections = inspectPixGridGroups(state)
    expect(inspections.length).toBeGreaterThan(0)
    expect(inspections.every(group => group.maskStatus === 'pending-source' || group.maskStatus === 'valid')).toBe(true)
    expect(validatePixGridState(state, { builtInPresetId: state.selectedPresetId }).errors).toEqual([])
  })

  it('detects Canvas and GPU semantic-plan divergence without requiring identical pixels', () => {
    expect(comparePixGridRendererSemanticPlans(semanticPlan(), semanticPlan())).toEqual([])
    const mismatch = comparePixGridRendererSemanticPlans(
      semanticPlan(),
      semanticPlan({ motionMultiplier: 1, activeGroupIds: ['group-b'] }),
    )
    expect(mismatch).toHaveLength(1)
    expect(mismatch[0]?.code).toBe('renderer-action-plan-mismatch')
  })

  it('reports truthful fallback status for custom scenes instead of calling route-less state valid', () => {
    const builtIn = stateForPreset('pix-grid-bass-beacon')
    const routeLess = {
      ...builtIn,
      selectedPresetId: null,
      groups: [],
      audioAssignments: [],
      performance: { ...builtIn.performance, enabled: false, sharedPerformanceProgramId: null },
      configuration: {
        ...builtIn.configuration,
        origin: 'custom' as const,
        sourcePresetId: null,
        presetConfigurationVersion: 0,
      },
    }
    const missingReport = validatePixGridState(routeLess)
    expect(missingReport.warnings.map(item => item.code)).toContain('missing-effective-audio-routes')
    expect(missingReport.warnings.map(item => item.code)).toContain('current-custom-state-missing-fallback-routing')

    const migrated = ensurePixGridRuntimeAudioRoutes(routeLess).state
    const fallbackReport = validatePixGridState(migrated)
    expect(fallbackReport.warnings.map(item => item.code)).toContain('baseline-fallback-routing-active')
    expect(fallbackReport.warnings.map(item => item.code)).not.toContain('missing-effective-audio-routes')
  })
})

describe('PixGrid route observability and controls', () => {
  it('records the route that fired, its envelope phase, affected group, and effective amount', () => {
    const runtime = new PixGridReactionRuntime()
    const route = assignment({ source: 'kick', capabilityFallback: 'beat', cooldown: 0.2 })
    const frame = createSilentPixGridAudioFrame({
      audioTime: 1,
      isPlaying: true,
      kickHit: true,
      sourceValues: { kick: 1, beat: 1 },
      eventIdentities: { kick: 'kick:1' },
    })
    runtime.beginFrame(frame)
    const resolved = runtime.resolve(route, frame, false, { currentGroupId: 'group-a' })
    const activity = runtime.getDiagnostics().routeActivity[0]
    expect(resolved.active).toBe(true)
    expect(activity).toMatchObject({
      routeId: route.id,
      state: 'active',
      affectedGroupIds: ['group-a'],
      usingFallback: false,
    })
    expect(activity?.effectiveAmount).toBeGreaterThan(0)
    expect(activity?.rawSourceValue).toBe(1)
    expect(activity?.adjustedSourceValue).toBeGreaterThan(0)
    expect(activity?.curveOutput).toBeGreaterThan(0)
    expect(activity?.threshold).toBe(route.threshold)
    expect(['attack', 'hold']).toContain(activity?.envelopePhase)
  })

  it('retains cooldown after a short envelope expires and reconstructs cleanly after a seek', () => {
    const runtime = new PixGridReactionRuntime()
    const route = assignment({ source: 'kick', capabilityFallback: 'beat', cooldown: 1, attack: 0, hold: 0.02, release: 0.02 })
    const first = createSilentPixGridAudioFrame({
      audioTime: 1,
      isPlaying: true,
      kickHit: true,
      beatIndex: 2,
      sourceValues: { kick: 1 },
      eventIdentities: { kick: 'kick:2' },
    })
    expect(runtime.resolve(route, first).value).toBeGreaterThan(0)
    const tooSoon = createSilentPixGridAudioFrame({
      ...first,
      audioTime: 1.2,
      beatIndex: 3,
      eventIdentities: { kick: 'kick:3' },
    })
    expect(runtime.resolve(route, tooSoon).value).toBe(0)
    const afterCooldown = createSilentPixGridAudioFrame({
      ...first,
      audioTime: 2.1,
      beatIndex: 4,
      eventIdentities: { kick: 'kick:4' },
    })
    expect(runtime.resolve(route, afterCooldown).value).toBeGreaterThan(0)

    const sought = createSilentPixGridAudioFrame({
      ...first,
      audioTime: 1.2,
      beatIndex: 3,
      timingDiscontinuity: true,
      eventIdentities: { kick: 'kick:3' },
    })
    expect(runtime.resolve(route, sought).value).toBeGreaterThan(0)
  })

  it('lets authored bass routes either participate in or intentionally bypass Bass Reactivity', () => {
    const controlled = applyPixGridRuntimeControls(createSilentPixGridAudioFrame({
      audioTime: 4,
      isPlaying: true,
      bass: 1,
      sourceValues: { bass: 1, energy: 0 },
    }), { bassReactivity: 0, motion: 1 })
    const participating = new PixGridReactionRuntime().resolve(assignment({ bassReactivityEnabled: true }), controlled)
    const bypassing = new PixGridReactionRuntime().resolve(assignment({ bassReactivityEnabled: false }), controlled)
    expect(participating.value).toBeCloseTo(0, 6)
    expect(bypassing.value).toBeGreaterThan(0.9)
  })

  it('settles on analyser loss and resumes without preset reselection', () => {
    const runtime = new PixGridReactionRuntime()
    const route = assignment({ attack: 0, hold: 0, release: 0.1, smoothing: 0 })
    const active = createSilentPixGridAudioFrame({
      audioTime: 10,
      isPlaying: true,
      bass: 1,
      sourceValues: { bass: 1 },
      inputSource: 'analyser',
      analyserConnected: true,
      analyserActive: true,
    })
    expect(runtime.resolve(route, active).value).toBeGreaterThan(0.9)
    const disconnected = createSilentPixGridAudioFrame({
      ...active,
      audioTime: 10.2,
      deltaTimeSec: 0.2,
      bass: 0,
      sourceValues: { bass: 0 },
      inputSource: 'neutral',
      analyserConnected: false,
      analyserActive: false,
    })
    expect(runtime.resolve(route, disconnected).value).toBeLessThan(0.2)
    const recovered = createSilentPixGridAudioFrame({
      ...active,
      audioTime: 10.3,
      bass: 0.8,
      sourceValues: { bass: 0.8 },
    })
    expect(runtime.resolve(route, recovered).value).toBeGreaterThan(0.7)
  })

  it('keeps diagnostic history frame-bounded and compiler caches stable', () => {
    const runtime = new PixGridReactionRuntime()
    const routes = Array.from({ length: 8 }, (_, index) => assignment({ id: `bounded-${index}`, amount: 0.5 + index * 0.01 }))
    for (let frameIndex = 0; frameIndex < 120; frameIndex += 1) {
      const frame = createSilentPixGridAudioFrame({ audioTime: frameIndex / 60, isPlaying: true, bass: 0.8, sourceValues: { bass: 0.8 } })
      runtime.beginFrame(frame)
      routes.forEach(route => runtime.resolve(route, frame, false, { currentGroupId: 'group-a' }))
      expect(runtime.getDiagnostics().routeActivity).toHaveLength(routes.length)
    }
    expect(runtime.cachedAssignmentCount).toBe(routes.length)
    expect(runtime.compilationCount).toBe(routes.length)
  })
})
