import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import { buildSharedPerformanceContext, type SharedPerformanceContext } from '../../../../../features/performanceCore'
import type { ReactSectionType, ReactTrackSection } from '../../ReactTypes'
import { createPixGridAudioFrame } from '../PixGridAudioRouting'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import { selectPixGridPreviewScene, PIX_GRID_FOLLOW_TRACK_SCENE_VALUE } from '../PixGridScenePreview'
import { applyPixGridPresetSettings } from '../PixGridState'
import { resolvePixGridSurfacePerformanceFrame } from '../PixGridSurfaceRuntime'
import { PixGridUnifiedPerformanceRuntime } from '../PixGridUnifiedPerformanceRuntime'
import { normalizePixGridState } from '../PixGridValidation'
import type { PixGridState } from '../PixGridTypes'

const MARQUEE_ID = 'pix-grid-neon-marquee-cycle'
const BASS_ID = 'pix-grid-bass-beacon'

function intelligence(timeSec: number): MusicIntelligenceFrame {
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: Math.max(1, Math.round(timeSec * 60)),
    sourceId: 'editing-context-track',
    trackId: 'editing-context-track',
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 1,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
    },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
    },
    confidence: {
      ...DEFAULT_MI_FRAME.confidence,
      overall: 1,
      rhythm: 1,
      section: 1,
    },
  }
}

function contextAt(
  sectionType: ReactSectionType,
  timeSec = 12,
  previous: SharedPerformanceContext | null = null,
): SharedPerformanceContext {
  const sections: ReactTrackSection[] = [{
    id: `track-${sectionType}`,
    label: sectionType,
    type: sectionType,
    startSec: 0,
    endSec: 64,
    intensity: sectionType === 'drop' ? 1 : 0.6,
    source: 'auto',
    confidence: 1,
  }]
  return buildSharedPerformanceContext({
    audioTimeSec: timeSec,
    frame: intelligence(timeSec),
    resolvedSections: sections,
    durationSec: 64,
    trackIdentity: 'editing-context-track',
    previous,
  })
}

function stateForPreset(presetId: string, enabled = true): PixGridState {
  const preset = PIX_GRID_PRESET_BY_ID.get(presetId)!
  const applied = applyPixGridPresetSettings(createDefaultPixGridState(), presetId, preset.pixGridSettings)
  return normalizePixGridState({
    ...applied,
    performance: { ...applied.performance, enabled },
  })
}

function resolve(input: {
  state: PixGridState
  trackSceneId: string | null
  context?: SharedPerformanceContext
  runtime?: PixGridUnifiedPerformanceRuntime
}) {
  const context = input.context ?? contextAt('verse')
  return resolvePixGridSurfacePerformanceFrame({
    authoredState: input.state,
    trackSceneId: input.trackSceneId,
    context,
    audioFrame: createPixGridAudioFrame(context, {
      isPlaying: true,
      deltaTimeSec: 1 / 60,
      autoPerformanceEnabled: input.state.performance.enabled,
    }),
    presetId: input.state.selectedPresetId,
    cues: [],
    runtime: input.runtime ?? new PixGridUnifiedPerformanceRuntime(),
    trackId: 'editing-context-track',
  })
}

describe('PixGrid Editing Context production scene ownership', () => {
  it('repairs a stale one-layer Marquee document before the unified runtime resolves', () => {
    const canonical = stateForPreset(MARQUEE_ID)
    const structure = canonical.layers.find(layer => layer.id === 'marquee-structure')!
    const legacyLayer = {
      ...structure,
      id: 'neon-marquee-frame',
      name: 'Neon Marquee Frame',
      assetId: 'pix-neon-marquee-cycle' as const,
      animations: [],
    }
    const stale = normalizePixGridState({
      ...canonical,
      configuration: {
        ...canonical.configuration,
        metadataVersion: 0 as never,
        origin: 'custom',
        sourcePresetId: MARQUEE_ID,
        presetConfigurationVersion: 1,
        layerGraphVersion: 1,
        smartGroupConfigurationVersion: 0,
        performanceProgramConfigurationVersion: 0,
        canonicalMigrationCompleted: false,
        legacyOfficialLayerGraph: true,
      },
      layers: [legacyLayer],
      scenes: canonical.scenes.map(scene => ({ ...scene, layerIds: [legacyLayer.id] })),
      groups: [],
      audioAssignments: [],
      performance: { ...canonical.performance, sharedPerformanceProgramId: null },
      editor: { ...canonical.editor, selectedLayerId: legacyLayer.id },
    })
    const frame = resolve({ state: stale, trackSceneId: `${MARQUEE_ID}-verse` })

    expect(frame.mappedState.layers).toHaveLength(12)
    expect(frame.mappedState.groups).toHaveLength(14)
    expect(frame.mappedState.layers.some(layer => layer.id === legacyLayer.id)).toBe(false)
    expect(frame.mappedState.performance.sharedPerformanceProgramId).toBe('pix-grid-neon-marquee-performance')
    expect(frame.resolvedRuntime.state.layers).toHaveLength(12)
  })

  it('keeps Intro selected over a real Verse while running the Intro program plan', () => {
    const introId = `${MARQUEE_ID}-intro`
    const state = selectPixGridPreviewScene(stateForPreset(MARQUEE_ID), introId)
    const frame = resolve({ state, trackSceneId: `${MARQUEE_ID}-verse` })

    expect(frame.sceneOwnership).toBe('editingContext')
    expect(frame.performanceContext.sectionType).toBe('intro')
    expect(frame.performanceContext.macroSectionType).toBe('intro')
    expect(frame.resolvedRuntime.state.selectedSceneId).toBe(introId)
    expect(frame.resolvedRuntime.performance.snapshot.activeSectionPlanId).toBe('marquee-intro')
    expect(frame.resolvedRuntime.performance.appliedActions.some(action => action.type === 'setScene')).toBe(true)
  })

  it('blocks Performance Program setScene actions at the runtime ownership boundary', () => {
    const introId = `${MARQUEE_ID}-intro`
    const state = selectPixGridPreviewScene(stateForPreset(MARQUEE_ID), introId)
    const context = contextAt('verse')
    const resolved = new PixGridUnifiedPerformanceRuntime().resolve({
      authoredState: state,
      context,
      audioFrame: createPixGridAudioFrame(context, {
        isPlaying: true,
        deltaTimeSec: 1 / 60,
        autoPerformanceEnabled: true,
      }),
      presetId: MARQUEE_ID,
      cues: [],
      trackId: 'editing-context-track',
      sceneOwnership: 'editingContext',
    })

    expect(resolved.performance.snapshot.activeSectionPlanId).toBe('marquee-verse')
    expect(resolved.performance.appliedActions.some(action => action.type === 'setScene')).toBe(true)
    expect(resolved.state.selectedSceneId).toBe(introId)
  })

  it('keeps Drop selected over a real Verse and runs the Drop plan, not Verse', () => {
    const dropId = `${MARQUEE_ID}-drop`
    const state = selectPixGridPreviewScene(stateForPreset(MARQUEE_ID), dropId)
    const frame = resolve({ state, trackSceneId: `${MARQUEE_ID}-verse` })

    expect(frame.previewAudioFrame.sectionType).toBe('drop')
    expect(frame.performanceContext.sectionType).toBe('drop')
    expect(frame.resolvedRuntime.state.selectedSceneId).toBe(dropId)
    expect(frame.resolvedRuntime.performance.snapshot.activeSectionPlanId).toBe('marquee-drop')
    expect(frame.resolvedRuntime.performance.snapshot.activeSectionPlanId).not.toBe('marquee-verse')
  })

  it('routes every manually selected Marquee scene through a distinct live renderer state', () => {
    const preset = PIX_GRID_PRESET_BY_ID.get(MARQUEE_ID)!
    const expectedPlans = new Map<string, string>([
      ['intro', 'marquee-intro'],
      ['verse', 'marquee-verse'],
      ['build', 'marquee-build'],
      ['preDrop', 'marquee-pre-drop'],
      ['drop', 'marquee-drop'],
      ['breakdown', 'marquee-breakdown'],
      ['outro', 'marquee-outro'],
    ])
    const hashes = new Set<string>()

    for (const [suffix, planId] of expectedPlans) {
      const sceneId = `${MARQUEE_ID}-${suffix}`
      const state = selectPixGridPreviewScene(stateForPreset(MARQUEE_ID), sceneId)
      const frame = resolve({ state, trackSceneId: `${MARQUEE_ID}-verse` })
      const logical = composePixGridLogicalFrame(
        preset,
        frame.resolvedRuntime.state,
        frame.previewAudioFrame,
        undefined,
        null,
        undefined,
        frame.resolvedRuntime.transition,
        frame.resolvedRuntime.groupEffects,
        undefined,
        frame.resolvedRuntime.choreography,
      )
      let hash = 2166136261
      for (const value of logical.pixels) {
        hash ^= value
        hash = Math.imul(hash, 16777619)
      }
      hashes.add((hash >>> 0).toString(16))
      expect(frame.resolvedRuntime.state.selectedSceneId).toBe(sceneId)
      expect(frame.resolvedRuntime.performance.snapshot.activeSectionPlanId).toBe(planId)
    }

    expect(hashes.size).toBe(expectedPlans.size)
  })

  it('restores Follow Track ownership and does not retain stale selected-scene state', () => {
    const runtime = new PixGridUnifiedPerformanceRuntime()
    const base = stateForPreset(MARQUEE_ID)
    const selectedDrop = selectPixGridPreviewScene(base, `${MARQUEE_ID}-drop`)
    const manual = resolve({ state: selectedDrop, trackSceneId: `${MARQUEE_ID}-verse`, runtime })
    expect(manual.resolvedRuntime.state.selectedSceneId).toBe(`${MARQUEE_ID}-drop`)

    const followTrack = selectPixGridPreviewScene(selectedDrop, PIX_GRID_FOLLOW_TRACK_SCENE_VALUE)
    runtime.reset('editing-context-track')
    const followed = resolve({ state: followTrack, trackSceneId: `${MARQUEE_ID}-verse`, runtime })
    expect(followed.sceneOwnership).toBe('performance')
    expect(followed.resolvedRuntime.state.selectedSceneId).toBe(`${MARQUEE_ID}-verse`)
    expect(followed.resolvedRuntime.performance.snapshot.activeSectionPlanId).toBe('marquee-verse')

    const selectedIntro = selectPixGridPreviewScene(followTrack, `${MARQUEE_ID}-intro`)
    runtime.reset('editing-context-track')
    const manualAgain = resolve({ state: selectedIntro, trackSceneId: `${MARQUEE_ID}-verse`, runtime })
    expect(manualAgain.resolvedRuntime.state.selectedSceneId).toBe(`${MARQUEE_ID}-intro`)
    expect(manualAgain.resolvedRuntime.performance.snapshot.activeSectionPlanId).toBe('marquee-intro')
  })

  it('clears stale manual ownership on preset switching and preserves existing preset behavior', () => {
    const selectedDrop = selectPixGridPreviewScene(stateForPreset(MARQUEE_ID), `${MARQUEE_ID}-drop`)
    const bassPreset = PIX_GRID_PRESET_BY_ID.get(BASS_ID)!
    const switched = normalizePixGridState(applyPixGridPresetSettings(selectedDrop, BASS_ID, bassPreset.pixGridSettings))
    expect(switched.editor.scenePreviewMode).toBe('followTrack')

    const frame = resolve({ state: switched, trackSceneId: `${BASS_ID}-verse` })
    expect(frame.sceneOwnership).toBe('performance')
    expect(frame.resolvedRuntime.state.selectedSceneId).toBe(`${BASS_ID}-verse`)
    expect(frame.resolvedRuntime.performance.snapshot.activeSectionPlanId).toBe('bass-verse')
  })

  it('honors manual scene ownership with Auto Performance both off and on', () => {
    const dropId = `${MARQUEE_ID}-drop`
    const disabledState = selectPixGridPreviewScene(stateForPreset(MARQUEE_ID, false), dropId)
    const disabled = resolve({ state: disabledState, trackSceneId: `${MARQUEE_ID}-verse` })
    expect(disabled.resolvedRuntime.state.selectedSceneId).toBe(dropId)
    expect(disabled.resolvedRuntime.performance.snapshot.active).toBe(false)

    const enabledState = normalizePixGridState({
      ...disabledState,
      performance: { ...disabledState.performance, enabled: true },
    })
    const enabled = resolve({ state: enabledState, trackSceneId: `${MARQUEE_ID}-verse` })
    expect(enabled.resolvedRuntime.state.selectedSceneId).toBe(dropId)
    expect(enabled.resolvedRuntime.performance.snapshot.activeSectionPlanId).toBe('marquee-drop')
  })
})
