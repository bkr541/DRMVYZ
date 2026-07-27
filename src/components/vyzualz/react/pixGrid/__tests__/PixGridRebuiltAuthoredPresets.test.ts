import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import { buildSharedPerformanceContext } from '../../../../../features/performanceCore'
import type { ReactPreset, ReactTrackSection } from '../../ReactTypes'
import { composePixGridLogicalFrame, type PixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { PixGridFrameGroupCompiler } from '../PixGridGroupCompiler'
import { pixGridMaskHasCell } from '../PixGridGroups'
import { MAX_PIX_GRID_ACTIVE_REACTIONS, MAX_PIX_GRID_VISIBLE_LAYERS } from '../PixGridLimits'
import { resolvePixGridPerformanceFrame } from '../PixGridPerformanceRuntime'
import {
  PIX_GRID_PERFORMANCE_PROGRAMS,
  validatePixGridPerformancePrograms,
} from '../PixGridPerformancePrograms'
import {
  PIX_GRID_AUTHORED_PRESET_CONFIGURATION_VERSION,
  PIX_GRID_PRESETS,
} from '../PixGridPresets'
import { PixGridReactionRuntime, createSilentPixGridAudioFrame } from '../PixGridAudioRouting'
import { applyPixGridPresetSettings } from '../PixGridState'
import type {
  PixGridAudioFrame,
  PixGridGroup,
  PixGridQualityTier,
  PixGridReactionSource,
  PixGridState,
} from '../PixGridTypes'
import { normalizePixGridState } from '../PixGridValidation'

const SECTIONS: ReactTrackSection[] = [
  { id: 'intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 8, intensity: 0.25, source: 'auto', confidence: 0.98 },
  { id: 'verse', label: 'Verse', type: 'verse', startSec: 8, endSec: 24, intensity: 0.5, source: 'auto', confidence: 0.98 },
  { id: 'build', label: 'Build', type: 'build', startSec: 24, endSec: 30, intensity: 0.82, source: 'auto', confidence: 0.98 },
  { id: 'pre-drop', label: 'Pre-drop', type: 'preDrop', startSec: 30, endSec: 32, intensity: 0.28, source: 'auto', confidence: 0.98 },
  { id: 'drop-1', label: 'Drop 1', type: 'drop', startSec: 32, endSec: 64, intensity: 1, source: 'auto', confidence: 0.98, interpretation: { familyId: 'drop', occurrenceIndex: 1 } },
  { id: 'breakdown', label: 'Breakdown', type: 'breakdown', startSec: 64, endSec: 80, intensity: 0.36, source: 'auto', confidence: 0.98 },
  { id: 'drop-2', label: 'Drop 2', type: 'drop', startSec: 80, endSec: 112, intensity: 1, source: 'auto', confidence: 0.98, interpretation: { familyId: 'drop', occurrenceIndex: 2 } },
  { id: 'outro', label: 'Outro', type: 'outro', startSec: 112, endSec: 128, intensity: 0.22, source: 'auto', confidence: 0.98 },
]

function stateFor(
  preset: ReactPreset,
  section: ReactTrackSection['type'] = 'drop',
  quality: PixGridQualityTier = 'low',
): PixGridState {
  const applied = applyPixGridPresetSettings(createDefaultPixGridState(), preset.id, preset.pixGridSettings)
  const selectedSceneId = preset.sectionMappings.find(mapping => mapping.sectionType === section)?.sceneId ?? applied.selectedSceneId
  return normalizePixGridState({ ...applied, quality, selectedSceneId })
}

function frame(
  source: PixGridReactionSource | null = null,
  value = 0,
  patch: Partial<PixGridAudioFrame> = {},
): PixGridAudioFrame {
  const base = createSilentPixGridAudioFrame({
    audioTime: 40,
    beatIndex: 80,
    barIndex: 20,
    phraseIndex: 5,
    sectionOccurrence: 1,
    dropOccurrence: 1,
    sectionType: 'drop',
    sectionPhase: 'body',
    phraseSegment: 'middle',
    autoPerformanceEnabled: true,
    isPlaying: true,
    ...patch,
  })
  return {
    ...base,
    ...patch,
    sourceValues: {
      ...base.sourceValues,
      ...(source ? { [source]: value } : {}),
      ...patch.sourceValues,
    },
  }
}

function isolateReaction(state: PixGridState, reactionId: string, keepAnimations = false): PixGridState {
  return normalizePixGridState({
    ...state,
    layers: state.layers.map(layer => ({
      ...layer,
      animations: keepAnimations ? layer.animations : [],
    })),
    groups: state.groups.map(group => ({
      ...group,
      reactions: group.reactions.map(reaction => ({ ...reaction, enabled: reaction.id === reactionId })),
    })),
    audioAssignments: state.audioAssignments.map(reaction => ({ ...reaction, enabled: reaction.id === reactionId })),
  })
}

function hash(frameValue: PixGridLogicalFrame): number {
  let result = 2_166_136_261
  for (const value of frameValue.pixels) {
    result ^= value
    result = Math.imul(result, 16_777_619)
  }
  return result >>> 0
}

function activePixels(frameValue: PixGridLogicalFrame): number {
  let count = 0
  for (let offset = 3; offset < frameValue.pixels.length; offset += 4) if (frameValue.pixels[offset] > 0) count += 1
  return count
}

function changedAt(a: PixGridLogicalFrame, b: PixGridLogicalFrame, index: number): boolean {
  const offset = index * 4
  return a.pixels[offset] !== b.pixels[offset]
    || a.pixels[offset + 1] !== b.pixels[offset + 1]
    || a.pixels[offset + 2] !== b.pixels[offset + 2]
    || a.pixels[offset + 3] !== b.pixels[offset + 3]
}

function renderPair(
  preset: ReactPreset,
  rawState: PixGridState,
  groupId: string,
  quiet: PixGridAudioFrame,
  active: PixGridAudioFrame,
): {
  quiet: PixGridLogicalFrame
  active: PixGridLogicalFrame
  group: PixGridGroup
  insideChanges: number
  outsideChanges: number
} {
  const state = normalizePixGridState(rawState)
  const compiler = new PixGridFrameGroupCompiler()
  const quietFrame = composePixGridLogicalFrame(preset, state, quiet, undefined, undefined, undefined, undefined, [], compiler)
  const group = state.groups.find(candidate => candidate.id === groupId)
  if (!group) throw new Error(`Missing group ${groupId}`)
  const mask = compiler.compile(group)
  const activeFrame = composePixGridLogicalFrame(preset, state, active)
  let insideChanges = 0
  let outsideChanges = 0
  for (let index = 0; index < quietFrame.width * quietFrame.height; index += 1) {
    if (!changedAt(quietFrame, activeFrame, index)) continue
    if (pixGridMaskHasCell(mask.bits, index)) insideChanges += 1
    else outsideChanges += 1
  }
  return { quiet: quietFrame, active: activeFrame, group, insideChanges, outsideChanges }
}

function performanceFrame(
  preset: ReactPreset,
  timeSec: number,
  options: {
    previous?: ReturnType<typeof buildSharedPerformanceContext> | null
    seekIdentity?: string
    loopIdentity?: string
  } = {},
) {
  const beatIndex = Math.floor(timeSec * 2)
  const musicFrame = {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: Math.round(timeSec * 60),
    sourceId: 'authored-preset-regression',
    trackId: 'authored-preset-regression',
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      sub: 0.72,
      bass: 0.82,
      lowMid: 0.66,
      mid: 0.58,
      high: 0.48,
      air: 0.36,
      normalizedBass: 0.82,
      normalizedMid: 0.58,
      normalizedHigh: 0.48,
      volume: 0.76,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 1,
      beatIndex,
      beatPhase: 0,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      beatHit: true,
      downbeatHit: beatIndex % 4 === 0,
    },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      phrases: true,
      semanticMoments: true,
      trackEnergyCurve: true,
    },
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.98, rhythm: 1, section: 0.98, phrase: 0.96 },
  }
  const context = buildSharedPerformanceContext({
    audioTimeSec: timeSec,
    frame: musicFrame,
    resolvedSections: SECTIONS,
    durationSec: 128,
    trackIdentity: 'authored-preset-regression',
    seekIdentity: options.seekIdentity ?? 'seek-0',
    loopIdentity: options.loopIdentity ?? 'loop-0',
    trackChangeIdentity: 'authored-preset-regression',
    previous: options.previous ?? null,
  })
  return {
    context,
    resolved: resolvePixGridPerformanceFrame(stateFor(preset, 'drop'), context, preset.id),
  }
}

function renderPerformance(preset: ReactPreset, timeSec: number): PixGridLogicalFrame {
  const { context, resolved } = performanceFrame(preset, timeSec)
  return composePixGridLogicalFrame(
    preset,
    resolved.state,
    frame(null, 0, {
      audioTime: timeSec,
      beatIndex: context.beatIndex,
      barIndex: context.barIndex,
      sectionOccurrence: context.sectionOccurrence,
      dropOccurrence: context.dropOccurrence,
      sectionType: context.sectionType,
      sectionPhase: context.sectionPhase,
      phraseProgress: context.phraseProgress,
      sectionProgress: context.sectionProgress,
    }),
    undefined,
    undefined,
    undefined,
    resolved.transition,
    resolved.groupEffects,
  )
}

describe('rebuilt first-party PixGrid preset contracts', () => {
  it('ships bounded, editable, versioned assignments and complete choreography plans', () => {
    expect(validatePixGridPerformancePrograms().filter(issue => issue.severity === 'error')).toEqual([])
    expect(PIX_GRID_PERFORMANCE_PROGRAMS).toHaveLength(3)

    for (const preset of PIX_GRID_PRESETS) {
      const settings = preset.pixGridSettings!
      const groups = settings.groups ?? []
      const audioAssignments = settings.audioAssignments ?? []
      const groupAssignments = groups.flatMap(group => group.reactions)
      const layerIds = new Set((settings.layers ?? []).map(layer => layer.id))
      const program = PIX_GRID_PERFORMANCE_PROGRAMS.find(candidate => candidate.id === settings.performanceProgramId)

      expect(settings.authoredConfigurationVersion).toBe(PIX_GRID_AUTHORED_PRESET_CONFIGURATION_VERSION)
      expect(settings.layers!.filter(layer => layer.visible)).toHaveLength(settings.layers!.length)
      expect(settings.layers!.length).toBeLessThanOrEqual(MAX_PIX_GRID_VISIBLE_LAYERS)
      expect(settings.layers!.every(layer => layer.audioReactivity == null)).toBe(true)
      expect(groups.length).toBeGreaterThanOrEqual(10)
      expect(groups.every(group => group.reactions.length > 0)).toBe(true)
      expect(groups.every(group => (group.layerScope ?? []).every(layerId => layerIds.has(layerId)))).toBe(true)
      expect(audioAssignments.length).toBeGreaterThanOrEqual(4)
      expect(groupAssignments.length + audioAssignments.length).toBeLessThanOrEqual(MAX_PIX_GRID_ACTIVE_REACTIONS)
      expect(new Set([...groupAssignments, ...audioAssignments].map(assignment => assignment.id)).size)
        .toBe(groupAssignments.length + audioAssignments.length)
      expect(groupAssignments.some(assignment => assignment.attack > 0 || assignment.hold > 0 || assignment.release > 0)).toBe(true)
      expect(groupAssignments.some(assignment => ['kick', 'snare', 'hat', 'downbeat'].includes(assignment.source))).toBe(true)
      expect(program).toBeDefined()
      expect(program!.continuousRoutes.length).toBeGreaterThanOrEqual(8)
      expect(program!.eventRoutes.length).toBeGreaterThanOrEqual(10)
      expect(program!.sectionPlans.every(plan => plan.transitionIn)).toBe(true)
      expect(program!.sectionPlans.some(plan => (plan.entryActions?.length ?? 0) > 0)).toBe(true)
      expect(program!.sectionPlans.some(plan => (plan.bodyActions?.length ?? 0) > 0)).toBe(true)
      expect(program!.sectionPlans.some(plan => (plan.exitActions?.length ?? 0) > 0)).toBe(true)
      expect(program!.sectionPlans.some(plan => plan.transitionOut)).toBe(true)
      expect(program!.sectionPlans.some(plan => (plan.fourBarActions?.length ?? 0) > 1)).toBe(true)
      expect(program!.sectionPlans.some(plan => (plan.eightBarRecruitment?.length ?? 0) > 0)).toBe(true)
      expect(program!.sectionPlans.some(plan => (plan.sixteenBarEvolution?.length ?? 0) > 0)).toBe(true)
    }
  })

  it('authors pre-drop as a separate restraint plan with stable spatial impact masks', () => {
    const expectedSpatialGroups = [
      ['bass-center-impact-group', 'bass-edge-snare-group'],
      ['reactor-center-impact-group', 'reactor-edge-snare-group'],
      ['parade-lower-kick-lane-group', 'parade-upper-snare-lane-group'],
    ] as const

    for (const [index, preset] of PIX_GRID_PRESETS.entries()) {
      const program = PIX_GRID_PERFORMANCE_PROGRAMS.find(candidate => candidate.id === preset.pixGridSettings!.performanceProgramId)!
      const buildPlan = program.sectionPlans.find(plan => plan.sectionTypes.includes('build'))!
      const preDropPlan = program.sectionPlans.find(plan => plan.sectionTypes.includes('preDrop'))!
      const groupById = new Map((preset.pixGridSettings!.groups ?? []).map(group => [group.id, group]))
      const [kickGroupId, snareGroupId] = expectedSpatialGroups[index]
      const kickGroup = groupById.get(kickGroupId)!
      const snareGroup = groupById.get(snareGroupId)!
      const resolvedPreDrop = performanceFrame(preset, 31).resolved

      expect(preset.sectionMappings.some(mapping => mapping.sectionType === 'preDrop')).toBe(true)
      expect(resolvedPreDrop.snapshot.sceneId).toBe(preDropPlan.id)
      expect(resolvedPreDrop.state.selectedSceneId).toBe(preset.sectionMappings.find(mapping => mapping.sectionType === 'preDrop')!.sceneId)
      expect(buildPlan.sectionTypes).toEqual(['build'])
      expect(preDropPlan.id).toContain('pre-drop')
      expect(preDropPlan.motionState?.amount).toBeLessThan(0.1)
      expect(preDropPlan.negativeSpaceTarget).toBeGreaterThan(0.75)
      expect(preDropPlan.eventRouteIds).not.toContain('kick-impact')
      expect(preDropPlan.eventRouteIds).not.toContain('snare-outline')
      expect(kickGroup.mask.kind).toBe('geometric')
      expect(snareGroup.mask.kind).toBe('geometric')
      expect(kickGroup.mask).not.toEqual(snareGroup.mask)
      expect(kickGroup.reactions.some(reaction => reaction.source === 'kick')).toBe(true)
      expect(snareGroup.reactions.some(reaction => reaction.source === 'snare')).toBe(true)
    }
  })

  it('gives every built-in preset an immediate native visual delta at normal audio levels', () => {
    for (const preset of PIX_GRID_PRESETS) {
      const state = stateFor(preset, 'drop')
      const quiet = composePixGridLogicalFrame(preset, state, frame('kick', 0))
      const active = composePixGridLogicalFrame(preset, state, frame('kick', 0.85, {
        bass: 0.72,
        energy: 0.76,
        beatHit: true,
        downbeatHit: true,
        kickHit: true,
      }))

      expect(hash(active), preset.name).not.toBe(hash(quiet))
      expect(active.pixels.every(Number.isFinite), preset.name).toBe(true)
    }
  })

  it.each(['draft', 'low', 'high', 'ultra'] as const)('renders every preset at %s with negative space and deterministic pixels', quality => {
    for (const preset of PIX_GRID_PRESETS) {
      const state = stateFor(preset, 'drop', quality)
      const first = composePixGridLogicalFrame(preset, state, frame('trackRelativeEnergy', 0.78))
      const second = composePixGridLogicalFrame(preset, state, frame('trackRelativeEnergy', 0.78))
      const total = first.width * first.height
      const active = activePixels(first)
      expect(hash(second)).toBe(hash(first))
      expect(active).toBeGreaterThan(20)
      expect(active).toBeLessThan(total * 0.78)
    }
  })

  it('persists authored edits and resets both group and preset-owned assignments to defaults', () => {
    for (const preset of PIX_GRID_PRESETS) {
      const original = stateFor(preset)
      const edited = normalizePixGridState(JSON.parse(JSON.stringify({
        ...original,
        groups: original.groups.map((group, index) => ({
          ...group,
          reactions: group.reactions.map((reaction, reactionIndex) => ({
            ...reaction,
            enabled: index === 0 && reactionIndex === 0 ? false : reaction.enabled,
          })),
        })),
        audioAssignments: original.audioAssignments.map((assignment, index) => ({
          ...assignment,
          enabled: index === 0 ? false : assignment.enabled,
        })),
      })))

      expect(edited.groups[0].reactions[0].enabled).toBe(false)
      expect(edited.audioAssignments[0].enabled).toBe(false)

      const reset = applyPixGridPresetSettings(edited, preset.id, preset.pixGridSettings)
      expect(reset.groups[0].reactions[0].enabled).toBe(true)
      expect(reset.audioAssignments[0].enabled).toBe(true)
      expect(reset.groups.map(group => group.reactions.map(reaction => reaction.id)))
        .toEqual(original.groups.map(group => group.reactions.map(reaction => reaction.id)))
      expect(reset.audioAssignments.map(assignment => assignment.id))
        .toEqual(original.audioAssignments.map(assignment => assignment.id))
    }
  })

  it('keeps representative masked reactions visible under dark, bright, monochrome, and limited palettes', () => {
    const palettes = [
      { primary: '#111827', secondary: '#1f2937', accent: '#374151', background: '#000000', highlight: '#f9fafb', text: '#ffffff' },
      { primary: '#ffffff', secondary: '#f8fafc', accent: '#e2e8f0', background: '#ffffff', highlight: '#ffffff', text: '#000000' },
      { primary: '#555555', secondary: '#888888', accent: '#bbbbbb', background: '#000000', highlight: '#ffffff', text: '#ffffff' },
      { primary: '#00d7ff', secondary: '#00d7ff', accent: '#ff2d95', background: '#000000', highlight: '#ff2d95', text: '#ffffff' },
    ] as const
    const routes = [
      { reactionId: 'bass-body-kick-impact', groupId: 'bass-body-group', source: 'kick' },
      { reactionId: 'reactor-core-kick', groupId: 'reactor-core-group', source: 'kick' },
      { reactionId: 'parade-hero-kick-step', groupId: 'parade-hero-group', source: 'kick' },
    ] as const

    for (const [index, preset] of PIX_GRID_PRESETS.entries()) {
      for (const palette of palettes) {
        const themedPreset: ReactPreset = { ...preset, palette: { ...palette } }
        const route = routes[index]
        const result = renderPair(
          themedPreset,
          isolateReaction(stateFor(themedPreset), route.reactionId),
          route.groupId,
          frame(route.source, 0),
          frame(route.source, 1),
        )
        expect(result.insideChanges, `${preset.id} ${palette.primary} ${route.reactionId}`).toBeGreaterThan(0)
      }
    }
  })
})


describe('first-party preset runtime integrity', () => {
  it('reports real active routes and resolves only preset-owned targets', () => {
    for (const preset of PIX_GRID_PRESETS) {
      const ownState = stateFor(preset)
      const ownLayerIds = new Set(ownState.layers.map(layer => layer.id))
      const ownGroupIds = new Set(ownState.groups.map(group => group.id))
      const times = [4, 16, 28, 40, 70, 88, 120]
      let observedContinuous = 0
      let observedEvents = 0

      for (const timeSec of times) {
        const { resolved } = performanceFrame(preset, timeSec)
        observedContinuous += resolved.snapshot.activeContinuousRoutes.length
        observedEvents += resolved.snapshot.activeEventRoutes.length
        expect(resolved.snapshot.missingBindings).toEqual([])
        for (const effect of resolved.groupEffects) expect(ownGroupIds.has(effect.groupId)).toBe(true)
        for (const action of resolved.appliedActions) {
          if ('layerId' in action) expect(ownLayerIds.has(action.layerId)).toBe(true)
          if ('groupId' in action) expect(ownGroupIds.has(action.groupId)).toBe(true)
          if ('target' in action && action.target !== 'all') {
            if ('layerId' in action.target) expect(ownLayerIds.has(action.target.layerId)).toBe(true)
            if ('groupId' in action.target) expect(ownGroupIds.has(action.target.groupId)).toBe(true)
          }
        }
      }

      expect(observedContinuous).toBeGreaterThan(0)
      expect(observedEvents).toBeGreaterThan(0)
    }
  })

  it('holds paused output and reconstructs seek and loop frames deterministically for every preset', () => {
    for (const preset of PIX_GRID_PRESETS) {
      const state = stateFor(preset)
      const live = composePixGridLogicalFrame(preset, state, frame('trackRelativeEnergy', 0.74, { audioTime: 88, isPlaying: true }))
      const paused = composePixGridLogicalFrame(preset, state, frame('trackRelativeEnergy', 0.74, { audioTime: 88, isPlaying: false }))
      const sought = composePixGridLogicalFrame(preset, state, frame('trackRelativeEnergy', 0.74, { audioTime: 88, timingDiscontinuity: true }))
      expect(hash(paused)).toBe(hash(live))
      expect(hash(sought)).toBe(hash(live))

      const previous = performanceFrame(preset, 104).context
      const seekA = performanceFrame(preset, 40, { previous, seekIdentity: 'seek-rebuilt-1' })
      const seekB = performanceFrame(preset, 40, { seekIdentity: 'seek-rebuilt-1' })
      expect(seekA.context.seekDetected).toBe(true)
      expect(seekA.resolved.snapshot.deterministicIdentity).toBe(seekB.resolved.snapshot.deterministicIdentity)
      expect(hash(renderPerformance(preset, 40))).toBe(hash(renderPerformance(preset, 40)))

      const loopA = performanceFrame(preset, 40, { previous, loopIdentity: 'loop-rebuilt-1' })
      const loopB = performanceFrame(preset, 40, { previous, loopIdentity: 'loop-rebuilt-1' })
      expect(loopA.context.loopWrapDetected).toBe(true)
      expect(loopA.resolved.snapshot.deterministicIdentity).toBe(loopB.resolved.snapshot.deterministicIdentity)
      expect(loopA.resolved.state.layers).toEqual(loopB.resolved.state.layers)
    }
  })
})

describe('Bass Beacon authored route families', () => {
  const preset = PIX_GRID_PRESETS[0]

  it('preserves the BASS glyph topology in the actual low-resolution framebuffer', () => {
    const glyph = [
      '11110001110001111001111',
      '10001010001010000010000',
      '11110010001011110011110',
      '10001011111000001000001',
      '10001010001000001000001',
      '10001010001010001010001',
      '11110010001011110011110',
    ] as const
    const base = stateFor(preset, 'verse', 'low')
    const hero = base.layers.find(layer => layer.id === 'bass-word')!
    const state = normalizePixGridState({
      ...base,
      selectedSceneId: 'bass-readability-regression',
      scenes: [{ id: 'bass-readability-regression', name: 'Readability Regression', layerIds: ['bass-word'], pixelOverrides: [] }],
      layers: base.layers.map(layer => ({
        ...layer,
        visible: layer.id === 'bass-word',
        opacity: layer.id === 'bass-word' ? 1 : layer.opacity,
        animations: [],
      })),
      groups: [],
      audioAssignments: [],
    })
    const rendered = composePixGridLogicalFrame(preset, state, frame())
    let matchingCells = 0
    let expectedLitCells = 0

    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        const outputU = hero.position.x + hero.scale.x * ((column + 0.5) / glyph[row].length - 0.5)
        const outputV = hero.position.y + hero.scale.y * ((row + 0.5) / glyph.length - 0.5)
        const x = Math.max(0, Math.min(rendered.width - 1, Math.floor(outputU * rendered.width)))
        const y = Math.max(0, Math.min(rendered.height - 1, Math.floor(outputV * rendered.height)))
        const lit = rendered.pixels[(y * rendered.width + x) * 4 + 3] > 0
        const expectedLit = glyph[row][column] === '1'
        if (expectedLit) expectedLitCells += 1
        if (lit === expectedLit) matchingCells += 1
      }
    }

    expect(expectedLitCells).toBeGreaterThan(50)
    expect(matchingCells / (glyph.length * glyph[0].length)).toBeGreaterThan(0.97)
  })

  it('routes bass, snare, and hat into distinct compiled masks', () => {
    const base = stateFor(preset)
    const bass = renderPair(preset, isolateReaction(base, 'bass-body-bass-fill'), 'bass-body-group', frame('bass', 0), frame('bass', 1))
    const snare = renderPair(preset, isolateReaction(base, 'bass-outline-snare'), 'bass-snare-group', frame('snare', 0), frame('snare', 1))
    const hat = renderPair(preset, isolateReaction(base, 'bass-sparkle-hat'), 'bass-hat-group', frame('hat', 0), frame('hat', 1))

    expect(bass.insideChanges).toBeGreaterThan(20)
    expect(bass.outsideChanges).toBe(0)
    expect(snare.insideChanges).toBeGreaterThan(8)
    expect(snare.outsideChanges).toBe(0)
    expect(hat.insideChanges).toBeGreaterThan(0)
    expect(hat.outsideChanges).toBe(0)
  })

  it('keeps kick impact alive for multiple frames and releases deterministically', () => {
    const state = isolateReaction(stateFor(preset), 'bass-body-kick-impact')
    const runtime = new PixGridReactionRuntime()
    composePixGridLogicalFrame(preset, state, frame('kick', 1, { audioTime: 40 }), undefined, undefined, runtime)
    const held = composePixGridLogicalFrame(preset, state, frame('kick', 0, { audioTime: 40.05 }), undefined, undefined, runtime)
    const heldBaseline = composePixGridLogicalFrame(preset, state, frame('kick', 0, { audioTime: 40.05 }))
    const released = composePixGridLogicalFrame(preset, state, frame('kick', 0, { audioTime: 40.5 }), undefined, undefined, runtime)
    const releasedBaseline = composePixGridLogicalFrame(preset, state, frame('kick', 0, { audioTime: 40.5 }))

    expect(hash(held)).not.toBe(hash(heldBaseline))
    expect(hash(released)).toBe(hash(releasedBaseline))
  })

  it('recruits rows during builds and changes four/eight-bar accent banks', () => {
    const buildState = isolateReaction(stateFor(preset, 'build'), 'bass-build-row-recruitment')
    const early = composePixGridLogicalFrame(preset, buildState, frame('buildProgress', 0.2, { sectionType: 'build' }))
    const late = composePixGridLogicalFrame(preset, buildState, frame('buildProgress', 0.92, { sectionType: 'build' }))
    expect(activePixels(late)).toBeGreaterThan(activePixels(early))

    const four = renderPair(
      preset,
      isolateReaction(stateFor(preset), 'bass-letter-b-four-bars'),
      'bass-letter-b-group',
      frame('fourBarBoundary', 0, { fourBarBoundary: false }),
      frame('fourBarBoundary', 1, { fourBarBoundary: true }),
    )
    const eight = renderPair(
      preset,
      isolateReaction(stateFor(preset), 'bass-side-eight-bars'),
      'bass-side-accent-group',
      frame('eightBarBoundary', 0, { eightBarBoundary: false }),
      frame('eightBarBoundary', 1, { eightBarBoundary: true }),
    )
    expect(four.insideChanges).toBeGreaterThan(0)
    expect(four.outsideChanges).toBe(0)
    expect(eight.insideChanges).toBeGreaterThan(0)
    expect(eight.outsideChanges).toBeLessThan(eight.insideChanges)
  })

  it('keeps Drop 2 recognizable while visibly evolving Drop 1', () => {
    const drop1 = renderPerformance(preset, 40)
    const drop2 = renderPerformance(preset, 88)
    expect(hash(drop2)).not.toBe(hash(drop1))
    expect(activePixels(drop1)).toBeGreaterThan(40)
    expect(activePixels(drop2)).toBeGreaterThan(40)
    expect(Math.abs(activePixels(drop2) - activePixels(drop1))).toBeLessThan(drop1.width * drop1.height * 0.45)
  })
})

describe('Geometric Reactor authored route families', () => {
  const preset = PIX_GRID_PRESETS[1]

  it.each([
    ['reactor-core-sub-mass', 'reactor-core-group', 'sub'],
    ['reactor-inner-bass', 'reactor-inner-ring-group', 'bass'],
    ['reactor-outer-low-mid', 'reactor-outer-ring-group', 'lowMid'],
    ['reactor-chevron-mid', 'reactor-chevron-group', 'mid'],
    ['reactor-node-high-density', 'reactor-node-group', 'high'],
    ['reactor-cross-air', 'reactor-cross-group', 'air'],
  ] as const)('routes %s into its owned geometry', (reactionId, groupId, source) => {
    const result = renderPair(preset, isolateReaction(stateFor(preset), reactionId), groupId, frame(source, 0), frame(source, 1))
    expect(result.insideChanges).toBeGreaterThan(0)
  })

  it('separates kick, snare, and hat structures and responds to complexity and tension', () => {
    for (const [reactionId, groupId, source] of [
      ['reactor-core-kick', 'reactor-core-group', 'kick'],
      ['reactor-cross-snare', 'reactor-cross-group', 'snare'],
      ['reactor-node-hat', 'reactor-node-group', 'hat'],
      ['reactor-checker-complexity', 'reactor-checker-group', 'complexity'],
      ['reactor-outer-tension', 'reactor-outer-ring-group', 'tension'],
    ] as const) {
      const result = renderPair(preset, isolateReaction(stateFor(preset), reactionId), groupId, frame(source, 0), frame(source, 1))
      expect(result.insideChanges).toBeGreaterThan(0)
    }
  })

  it('renders four/eight/sixteen-bar development and an evolved second drop', () => {
    const early = renderPerformance(preset, 34)
    const eightBar = renderPerformance(preset, 48)
    const sixteenBar = renderPerformance(preset, 58)
    const drop2 = renderPerformance(preset, 88)
    expect(new Set([hash(early), hash(eightBar), hash(sixteenBar), hash(drop2)]).size).toBeGreaterThanOrEqual(3)
    expect(hash(drop2)).not.toBe(hash(early))
  })
})

describe('Pixel Parade authored route families', () => {
  const preset = PIX_GRID_PRESETS[2]

  it.each([
    ['parade-hero-bass-body', 'parade-hero-group', 'bass'],
    ['parade-secondary-low-mid', 'parade-secondary-group', 'lowMid'],
    ['parade-primary-mid-motion', 'parade-foreground-group', 'mid'],
    ['parade-star-high', 'parade-star-group', 'high'],
  ] as const)('routes %s into its owned parade role', (reactionId, groupId, source) => {
    const result = renderPair(preset, isolateReaction(stateFor(preset), reactionId), groupId, frame(source, 0), frame(source, 1))
    expect(result.insideChanges).toBeGreaterThan(0)
  })

  it('targets kick, snare, hat, vocal, and semantic moments independently', () => {
    for (const [reactionId, groupId, source, patch] of [
      ['parade-hero-kick-step', 'parade-hero-group', 'kick', {}],
      ['parade-prop-snare', 'parade-prop-group', 'snare', {}],
      ['parade-star-hat', 'parade-star-group', 'hat', {}],
      ['parade-hero-vocal', 'parade-hero-group', 'vocalEnergy', { confidence: { vocalEnergy: 1 } }],
      ['parade-hero-semantic', 'parade-hero-group', 'semanticMoment', { semanticMomentHit: true }],
    ] as const) {
      const result = renderPair(
        preset,
        isolateReaction(stateFor(preset), reactionId),
        groupId,
        frame(source, 0, patch),
        frame(source, 1, patch),
      )
      expect(result.insideChanges).toBeGreaterThan(0)
    }
  })

  it('recruits participants and changes four/eight/sixteen-bar staging', () => {
    const recruitment = isolateReaction(stateFor(preset, 'build'), 'parade-build-recruitment')
    const sparse = composePixGridLogicalFrame(preset, recruitment, frame('buildProgress', 0.18, { sectionType: 'build' }))
    const recruited = composePixGridLogicalFrame(preset, recruitment, frame('buildProgress', 0.94, { sectionType: 'build' }))
    expect(activePixels(recruited)).toBeGreaterThan(activePixels(sparse))

    const fourState = isolateReaction(stateFor(preset), 'parade-prop-four-bars', true)
    const fourQuiet = composePixGridLogicalFrame(preset, fourState, frame('fourBarBoundary', 0, { fourBarBoundary: false }))
    const fourActive = composePixGridLogicalFrame(preset, fourState, frame('fourBarBoundary', 1, { fourBarBoundary: true }))
    const eight = renderPair(
      preset,
      isolateReaction(stateFor(preset), 'parade-secondary-eight-bars'),
      'parade-secondary-group',
      frame('eightBarBoundary', 0, { eightBarBoundary: false }),
      frame('eightBarBoundary', 1, { eightBarBoundary: true }),
    )
    const sixteen = renderPair(
      preset,
      isolateReaction(stateFor(preset), 'parade-sixteen-bar-cast'),
      'parade-recruitment-group',
      frame('sixteenBarBoundary', 0, { sixteenBarBoundary: false }),
      frame('sixteenBarBoundary', 1, { sixteenBarBoundary: true }),
    )
    expect(hash(fourActive)).not.toBe(hash(fourQuiet))
    expect(eight.insideChanges).toBeGreaterThan(0)
    expect(sixteen.insideChanges).toBeGreaterThan(0)
  })

  it('expands the cast and staging for Drop 2 without losing the parade identity', () => {
    const drop1 = renderPerformance(preset, 40)
    const drop2 = renderPerformance(preset, 88)
    expect(hash(drop2)).not.toBe(hash(drop1))
    expect(activePixels(drop2)).toBeGreaterThan(activePixels(drop1) * 0.72)
  })
})
