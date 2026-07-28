// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useReactStore } from '../../../../../stores/reactStore'
import {
  applyPixGridPresentationPatch,
  patchPixGridReactionAssignment,
} from '../PixGridControlContract'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { createDefaultPixGridReactionAssignment } from '../PixGridGroups'
import { PixGridAssignmentCompiler } from '../PixGridAssignmentCompiler'
import { PIX_GRID_PERFORMANCE_PROGRAMS, PIX_GRID_PRESET_ID_BY_PROGRAM } from '../PixGridPerformancePrograms'
import { PIX_GRID_PRESETS } from '../PixGridPresets'
import { applyPixGridPresetSettings } from '../PixGridState'
import { resolvePixGridAdaptiveQualityProfile } from '../PixGridAdaptiveQuality'
import { resolvePixGridPresentation, resolvePixGridPublishedQuality } from '../PixGridPresentation'
import { normalizePixGridReactionAssignment, normalizePixGridState } from '../PixGridValidation'
import { PIX_GRID_PRESENTATION_FRAGMENT_SHADER } from '../../renderers/pixGrid/PixGridGpuShaderSources'
import type { PixGridActionCue } from '../PixGridActionCues'
import type { PixGridReactionAssignment } from '../PixGridTypes'

beforeEach(() => {
  useReactStore.getState().resetReactView()
  useReactStore.getState().selectReactEngine('pixGrid')
})

describe('PixGrid canonical control contract', () => {
  it('changes requested quality without changing the explicit quality mode', () => {
    const store = useReactStore.getState()
    expect(store.pixGridState.qualityMode).toBe('adaptive')

    store.setPixGridRequestedQuality('draft')
    expect(useReactStore.getState().pixGridState).toMatchObject({ quality: 'draft', qualityMode: 'adaptive' })
    expect(useReactStore.getState().pixGridUndoStack).toHaveLength(1)

    useReactStore.getState().setPixGridQualityMode('fixed')
    const historyBeforeTierChange = useReactStore.getState().pixGridUndoStack.length
    useReactStore.getState().setPixGridRequestedQuality('ultra')
    expect(useReactStore.getState().pixGridState).toMatchObject({ quality: 'ultra', qualityMode: 'fixed' })
    expect(useReactStore.getState().pixGridUndoStack).toHaveLength(historyBeforeTierChange + 1)
  })

  it('truthfully publishes adaptive and Canvas2D Draft promotion while retaining fixed GPU Draft', () => {
    const adaptiveDraft = resolvePixGridAdaptiveQualityProfile('draft', 'adaptive', 0)
    expect(resolvePixGridPublishedQuality('draft', adaptiveDraft, 'webgl2')).toMatchObject({
      requestedQuality: 'draft',
      effectiveQuality: 'low',
      logicalWidth: 96,
      logicalHeight: 54,
      promotionSource: 'adaptive-controller',
    })

    const fixedDraft = resolvePixGridAdaptiveQualityProfile('draft', 'fixed', 0)
    expect(resolvePixGridPublishedQuality('draft', fixedDraft, 'webgl2')).toMatchObject({
      requestedQuality: 'draft',
      effectiveQuality: 'draft',
      logicalWidth: 64,
      logicalHeight: 36,
      promotionSource: null,
    })
    expect(resolvePixGridPublishedQuality('draft', fixedDraft, 'canvas2d-fallback')).toMatchObject({
      requestedQuality: 'draft',
      effectiveQuality: 'low',
      logicalWidth: 96,
      logicalHeight: 54,
      promotionSource: 'canvas2d-fallback',
    })
  })

  it('round-trips requested quality and mode without rewriting Draft to Low', () => {
    const authored = normalizePixGridState({ ...createDefaultPixGridState(), quality: 'draft', qualityMode: 'adaptive' })
    const reloaded = normalizePixGridState(JSON.parse(JSON.stringify(authored)))
    expect(reloaded).toMatchObject({ quality: 'draft', qualityMode: 'adaptive', matrixWidth: 64, matrixHeight: 36 })
  })

  it('centralizes legacy intensity without double application and keeps Glow, Halo Radius, and Diffusion distinct', () => {
    const state = applyPixGridPresentationPatch(createDefaultPixGridState(), {
      globalIntensity: 0.8,
      cellBrightness: 0.5,
      glowAmount: 0.25,
      diffusion: 0.1,
    })
    const resolved = resolvePixGridPresentation(state, { intensity: 0.5, glow: 0.75 })
    expect(resolved).toMatchObject({
      outputIntensity: 0.8,
      authoredPerformanceTrim: 0.5,
      cellCalibration: 0.5,
      resolvedOutputIntensity: 0.2,
      glow: 0.25,
      haloRadius: 0.75,
      diffusion: 0.1,
    })

    const equivalent = resolvePixGridPresentation(
      { ...state, globalIntensity: 0.5, cellBrightness: 0.8 },
      { intensity: 0.5, glow: 0.75 },
    )
    expect(equivalent.resolvedOutputIntensity).toBeCloseTo(resolved.resolvedOutputIntensity)

    expect(resolvePixGridPresentation({ ...state, globalIntensity: 0, cellBrightness: 1 }, { intensity: 1, glow: 0 })).toMatchObject({ resolvedOutputIntensity: 0 })
    expect(resolvePixGridPresentation({ ...state, globalIntensity: 0.5, cellBrightness: 0.5 }, { intensity: 0.5, glow: 0.5 })).toMatchObject({ resolvedOutputIntensity: 0.125 })
    expect(resolvePixGridPresentation({ ...state, globalIntensity: 1, cellBrightness: 1 }, { intensity: 1, glow: 1 })).toMatchObject({ resolvedOutputIntensity: 1 })

    const reloaded = normalizePixGridState(JSON.parse(JSON.stringify(state)))
    expect(resolvePixGridPresentation(reloaded, { intensity: 0.5, glow: 0.75 }).resolvedOutputIntensity).toBeCloseTo(0.2)

    expect(resolvePixGridPresentation(state, { intensity: 0.5, glow: 0.2 })).toMatchObject({ glow: 0.25, haloRadius: 0.2 })
    expect(resolvePixGridPresentation({ ...state, glowAmount: 0.9 }, { intensity: 0.5, glow: 0.2 })).toMatchObject({ glow: 0.9, haloRadius: 0.2 })
    expect(PIX_GRID_PRESENTATION_FRAGMENT_SHADER).toContain('clamp(uHaloRadius')
    expect(PIX_GRID_PRESENTATION_FRAGMENT_SHADER).toContain('clamp(uGlow')
    expect(PIX_GRID_PRESENTATION_FRAGMENT_SHADER).toContain('clamp(uDiffusion')
  })

  it('keeps built-in preset intensity materially equivalent to the legacy renderer product', () => {
    for (const preset of PIX_GRID_PRESETS) {
      const state = applyPixGridPresetSettings(createDefaultPixGridState(), preset.id, preset.pixGridSettings)
      const authoredTrim = 0.7
      const legacyProduct = state.globalIntensity * authoredTrim * state.cellBrightness
      const resolved = resolvePixGridPresentation(state, { intensity: authoredTrim, glow: 0.65 })
      expect(resolved.resolvedOutputIntensity).toBeCloseTo(legacyProduct)
      const reloaded = normalizePixGridState(JSON.parse(JSON.stringify(state)))
      expect(resolvePixGridPresentation(reloaded, { intensity: authoredTrim, glow: 0.65 }).resolvedOutputIntensity).toBeCloseTo(legacyProduct)
    }
  })


  it('uses one presentation action for validation and history transactions', () => {
    const store = useReactStore.getState()
    store.beginPixGridHistoryTransaction()
    store.setPixGridPresentation({ cellGap: 0.21 })
    store.setPixGridPresentation({ cellGap: 0.28, glowAmount: 0.64 })
    expect(useReactStore.getState().pixGridUndoStack).toHaveLength(0)
    useReactStore.getState().commitPixGridHistoryTransaction()
    expect(useReactStore.getState().pixGridUndoStack).toHaveLength(1)
    expect(useReactStore.getState().pixGridState).toMatchObject({ cellGap: 0.28, glowAmount: 0.64 })
    useReactStore.getState().undoPixGridEdit()
    expect(useReactStore.getState().pixGridState.cellGap).toBe(store.pixGridState.cellGap)
  })

  it('separates broad preset loading from program-only changes and keeps provenance coherent', () => {
    const [firstProgram, secondProgram] = PIX_GRID_PERFORMANCE_PROGRAMS
    expect(firstProgram).toBeDefined()
    expect(secondProgram).toBeDefined()
    const trackCue: PixGridActionCue = {
      version: 1,
      id: 'preserved-track-cue',
      timeSec: 4,
      label: 'Preserved Track Map cue',
      enabled: true,
      engineId: 'pixGrid',
      action: { type: 'clearScreen' },
      quantization: 'beat',
      transition: 'cut',
      transitionDurationSec: 0,
      oneShotDurationSec: 0.25,
      loopBehavior: 'retrigger',
      order: 0,
    }
    useReactStore.setState({ pixGridActionCuesByTrackId: { 'track-map-test': [trackCue] } })

    useReactStore.getState().loadPixGridProgramPreset(firstProgram!.id)
    const firstPresetId = PIX_GRID_PRESET_ID_BY_PROGRAM[firstProgram!.id]
    expect(useReactStore.getState().activeReactPresetId).toBe(firstPresetId)
    expect(useReactStore.getState().pixGridUndoStack).toHaveLength(0)

    const original = useReactStore.getState().pixGridState
    useReactStore.getState().applyPixGridAuthoringState({
      ...original,
      backgroundColor: '#123456',
      layers: original.layers.map((layer, index) => index === 0 ? { ...layer, name: 'Preserve Me' } : layer),
      performance: {
        ...original.performance,
        programOverrides: { routes: { test: { amount: 0.25 } }, sections: {} },
      },
    })
    const artworkBeforeProgramOnly = useReactStore.getState().pixGridState.layers
    const historyBeforeProgramOnly = useReactStore.getState().pixGridUndoStack.length
    useReactStore.getState().changePixGridPerformanceProgramOnly(secondProgram!.id)
    const programOnly = useReactStore.getState()
    expect(programOnly.pixGridState.performance.sharedPerformanceProgramId).toBe(secondProgram!.id)
    expect(programOnly.pixGridState.performance.programOverrides).toEqual({ routes: {}, sections: {} })
    expect(programOnly.pixGridState.layers).toEqual(artworkBeforeProgramOnly)
    expect(programOnly.pixGridState.backgroundColor).toBe('#123456')
    expect(programOnly.activeReactPresetId).toBe(firstPresetId)
    expect(programOnly.pixGridState.selectedPresetId).toBe(firstPresetId)
    expect(programOnly.pixGridState.configuration.userCustomized).toBe(true)
    expect(programOnly.pixGridUndoStack).toHaveLength(historyBeforeProgramOnly + 1)

    const serialized = normalizePixGridState(JSON.parse(JSON.stringify(programOnly.pixGridState)))
    expect(serialized.performance.sharedPerformanceProgramId).toBe(secondProgram!.id)
    expect(serialized.layers).toEqual(artworkBeforeProgramOnly)

    useReactStore.getState().loadPixGridProgramPreset(secondProgram!.id)
    const broad = useReactStore.getState()
    expect(broad.activeReactPresetId).toBe(PIX_GRID_PRESET_ID_BY_PROGRAM[secondProgram!.id])
    expect(broad.pixGridState.performance.sharedPerformanceProgramId).toBe(secondProgram!.id)
    expect(broad.pixGridState.layers).not.toEqual(artworkBeforeProgramOnly)
    expect(broad.pixGridUndoStack).toHaveLength(0)
    expect(broad.pixGridRedoStack).toHaveLength(0)
    expect(broad.pixGridActionCuesByTrackId).toEqual({ 'track-map-test': [trackCue] })
  })


  it('preserves advanced route fields when compact edits patch a safe subset', () => {
    const assignment: PixGridReactionAssignment = {
      ...createDefaultPixGridReactionAssignment(0),
      amount: 3.25,
      priority: 420,
      cooldown: 1.75,
      inputRange: [-2, 3],
      outputRange: [-1, 2],
      conditions: { includeSectionTypes: ['drop'] },
      quantization: 'fourBars' as const,
    }
    const edited = patchPixGridReactionAssignment(assignment, { amount: -3.5, threshold: 0.42 })
    expect(edited).toMatchObject({
      amount: -3.5,
      threshold: 0.42,
      priority: 420,
      cooldown: 1.75,
      inputRange: [-2, 3],
      outputRange: [-1, 2],
      quantization: 'fourBars',
    })
    expect(edited.conditions).toEqual(assignment.conditions)

    const normalized = normalizePixGridReactionAssignment(JSON.parse(JSON.stringify(edited)), 0, 'group')
    expect(normalized).toMatchObject({
      amount: -3.5,
      priority: 420,
      cooldown: 1.75,
      inputRange: [-2, 3],
      outputRange: [-1, 2],
      quantization: 'fourBars',
    })
    expect(normalized?.conditions?.includeSectionTypes).toEqual(['drop'])
    const compiled = new PixGridAssignmentCompiler().compile(normalized!)
    expect(compiled).toMatchObject({ amount: -3.5, priority: 420, cooldown: 1.75, compatible: true })
    expect([...(compiled.conditions.includeSectionTypes ?? [])]).toEqual(['drop'])
  })
})
