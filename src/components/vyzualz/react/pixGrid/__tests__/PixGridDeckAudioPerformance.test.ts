import { describe, expect, it } from 'vitest'
import { createDefaultPixGridState } from '../PixGridDefaults'
import {
  PIX_GRID_DECK_PERFORMANCE_PROGRAM_ID,
  type PixGridDeckDefinition,
  type PixGridDeckReactionProfileId,
} from '../PixGridDeckDomain'
import {
  applyPixGridDeckManualAudioReactions,
  createPixGridDeckPerformanceProgram,
  PIX_GRID_MEDIA_DECK_PERFORMANCE_PROGRAM,
} from '../PixGridDeckPerformanceProgram'
import { withPixGridDeckGeneratedGroups } from '../PixGridDeckRuntime'
import { PixGridPerformanceProgramCompiler, validatePixGridPerformanceProgram } from '../PixGridPerformanceProgramCompiler'
import { PIX_GRID_PERFORMANCE_PROGRAM_BY_ID } from '../PixGridPerformancePrograms'
import { ensurePixGridRuntimeAudioRoutes } from '../PixGridStateMigration'
import type { PixGridState } from '../PixGridTypes'

const DECK_ID = 'deck-audio-performance'

function deck(profile: PixGridDeckReactionProfileId = 'balanced'): PixGridDeckDefinition {
  const item = (id: string, order: number) => ({
    id,
    mediaId: `media:${id}`,
    enabled: true,
    order,
    revision: 1,
    timingOverrideBeats: null,
    source: {
      mediaRevision: 1,
      fingerprint: `legacy:${id}`,
      fileName: `${id}.png`,
      mimeType: 'image/png',
      width: 16,
      height: 9,
      hasAlpha: false,
      transparentBackground: '#000000',
    },
  })
  return {
    schemaVersion: 1,
    id: DECK_ID,
    name: 'Audio Performance',
    revision: 1,
    generatedPresetId: `pix-grid-deck:${DECK_ID}`,
    items: [item('item-a', 0), item('item-b', 1)],
    configuration: {
      playbackOrder: 'forward',
      loop: true,
      reactionProfileId: profile,
      transitionPolicy: { mode: 'auto', durationFraction: 0.25, pairOverrides: [], style: 'wipe', durationBeats: 1 },
      defaultItemDurationBeats: 4,
      sectionTimingBeats: {},
      sectionItemAssignments: {},
      sceneItemAssignments: {},
      preDropBehavior: 'hold',
    },
  }
}

function stateForDeck(enabled = true): PixGridState {
  const base = createDefaultPixGridState()
  const sourceLayer = base.layers[0]!
  const layer = {
    ...sourceLayer,
    id: 'deck-layer',
    frameSource: { kind: 'deck' as const, deckId: DECK_ID },
    mediaId: null,
  }
  const state: PixGridState = {
    ...base,
    selectedPresetId: `pix-grid-deck:${DECK_ID}`,
    layers: [layer],
    scenes: base.scenes.map((scene, index) => ({
      ...scene,
      id: index === 0 ? 'deck-scene' : scene.id,
      layerIds: [layer.id],
    })),
    selectedSceneId: 'deck-scene',
    groups: [],
    audioAssignments: [],
    performance: {
      ...base.performance,
      enabled,
      sharedPerformanceProgramId: PIX_GRID_DECK_PERFORMANCE_PROGRAM_ID,
      programOverrides: { routes: {}, sections: {} },
    },
  }
  return withPixGridDeckGeneratedGroups(state, DECK_ID)
}

describe('PixGrid Deck audio performance program', () => {
  it('registers the canonical program without vocal or frame-identity routes', () => {
    expect(PIX_GRID_PERFORMANCE_PROGRAM_BY_ID.get(PIX_GRID_DECK_PERFORMANCE_PROGRAM_ID)).toBe(PIX_GRID_MEDIA_DECK_PERFORMANCE_PROGRAM)
    expect(validatePixGridPerformanceProgram(PIX_GRID_MEDIA_DECK_PERFORMANCE_PROGRAM).filter(issue => issue.severity === 'error')).toEqual([])
    expect(PIX_GRID_MEDIA_DECK_PERFORMANCE_PROGRAM.continuousRoutes.every(route => !route.source.toLowerCase().includes('vocal'))).toBe(true)
    expect(PIX_GRID_MEDIA_DECK_PERFORMANCE_PROGRAM.eventRoutes.every(route => !route.event.toLowerCase().includes('vocal'))).toBe(true)
    expect([
      ...PIX_GRID_MEDIA_DECK_PERFORMANCE_PROGRAM.continuousRoutes,
      ...PIX_GRID_MEDIA_DECK_PERFORMANCE_PROGRAM.eventRoutes,
    ].every(route => route.operation !== 'frameAdvance' && route.operation !== 'frameIndex')).toBe(true)
    expect(PIX_GRID_MEDIA_DECK_PERFORMANCE_PROGRAM.sectionPlans.map(plan => plan.sectionTypes[0])).toEqual([
      'intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'bridge', 'outro', 'unknown',
    ])
  })

  it('compiles all four normalized profiles to distinct canonical route magnitudes', () => {
    const state = stateForDeck()
    const compiler = new PixGridPerformanceProgramCompiler()
    const profiles: PixGridDeckReactionProfileId[] = ['balanced', 'graphicLogo', 'photoArtwork', 'highEnergy']
    const magnitudes = profiles.map(profile => {
      const compiled = compiler.compile(createPixGridDeckPerformanceProgram(state, deck(profile)), state, {
        bass: true,
        energy: true,
        trackRelativeEnergy: true,
        spectralBrightness: true,
        buildProgress: true,
        phraseProgress: true,
        sectionRelativeEnergy: true,
        kick: true,
        snare: true,
        hat: true,
        downbeat: true,
        phraseEntry: true,
        sectionEntry: true,
        dropImpact: true,
      })
      expect(compiled.assignments.length).toBeGreaterThan(0)
      expect(compiled.missingBindings).toEqual([])
      return compiled.assignments.reduce((sum, assignment) => sum + Math.abs(assignment.amount), 0)
    })
    expect(new Set(magnitudes.map(value => value.toFixed(5))).size).toBe(4)
    expect(compiler.compilationCount).toBe(4)
  })

  it('includes the actual program when reconciling fallback routes', () => {
    const state = stateForDeck()
    const program = createPixGridDeckPerformanceProgram(state, deck())
    const result = ensurePixGridRuntimeAudioRoutes(state, { energy: true, bass: true }, program)
    expect(result.fallbackActive).toBe(false)
    expect(result.validAssignmentCount).toBeGreaterThan(0)
  })

  it('adds only non-persistent basic group reactions when Auto Performance is off', () => {
    const state = stateForDeck(false)
    const resolved = applyPixGridDeckManualAudioReactions(state, DECK_ID)
    const assignments = resolved.groups.flatMap(group => group.reactions)
    expect(assignments.map(assignment => assignment.target)).toEqual(expect.arrayContaining(['brightness', 'glow', 'scale']))
    expect(assignments.every(assignment => assignment.target !== 'frameAdvance' && assignment.target !== 'frameIndex')).toBe(true)
    expect(assignments.every(assignment => assignment.conditions == null)).toBe(true)
    expect(state.groups.every(group => group.reactions.length === 0)).toBe(true)

    const fallback = ensurePixGridRuntimeAudioRoutes(resolved, { energy: true, bass: true, spectralBrightness: true }, null)
    expect(fallback.fallbackActive).toBe(false)
    expect(fallback.validAssignmentCount).toBeGreaterThan(0)
    expect(fallback.validAssignmentCount).toBeLessThanOrEqual(assignments.length)
  })
})
