import { describe, expect, it } from 'vitest'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { createDefaultPixGridReactionAssignment } from '../PixGridGroups'
import { PIX_GRID_NEON_MARQUEE_LEGACY_DIRECT_ASSIGNMENT_IDS } from '../PixGridNeonMarqueeAudioOwnership'
import { PixGridPerformanceProgramCompiler } from '../PixGridPerformanceProgramCompiler'
import {
  NEON_MARQUEE_PERFORMANCE_PROGRAM,
  PIX_GRID_NEON_MARQUEE_AUDIO_ROUTING_MATRIX,
} from '../PixGridPerformancePrograms'
import {
  PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION,
  PIX_GRID_PRESET_BY_ID,
} from '../PixGridPresets'
import { applyPixGridPresetSettings } from '../PixGridState'
import { migratePixGridState } from '../PixGridStateMigration'

const PRESET_ID = 'pix-grid-neon-marquee-cycle'
const PROGRAM_ID = 'pix-grid-neon-marquee-performance'
const PRESET = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!

function canonicalState() {
  return applyPixGridPresetSettings(
    createDefaultPixGridState(),
    PRESET_ID,
    PRESET.pixGridSettings,
  )
}

function matrixKey(route: (typeof PIX_GRID_NEON_MARQUEE_AUDIO_ROUTING_MATRIX)[number]) {
  return `${route.source}:${route.target}:${route.property}`
}

describe('Marquee audio-route ownership consolidation', () => {
  it('keeps the preset free of direct routes and makes the Performance Program the only authored owner', () => {
    const state = canonicalState()
    expect(PRESET.pixGridSettings?.audioAssignments).toEqual([])
    expect(state.audioAssignments).toEqual([])
    expect(state.performance.sharedPerformanceProgramId).toBe(PROGRAM_ID)
    expect(state.layers.some(layer => layer.animations.length > 0)).toBe(true)
    expect(PIX_GRID_NEON_MARQUEE_AUDIO_ROUTING_MATRIX.every(route => (
      route.owner === PROGRAM_ID
      && route.autoPerformanceGating === 'performance.enabled'
    ))).toBe(true)
  })

  it('publishes one source-target-property row per intended route with explicit envelopes and clamps', () => {
    const keys = PIX_GRID_NEON_MARQUEE_AUDIO_ROUTING_MATRIX.map(matrixKey)
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(PIX_GRID_NEON_MARQUEE_AUDIO_ROUTING_MATRIX.map(route => route.routeId)).size)
      .toBe(PIX_GRID_NEON_MARQUEE_AUDIO_ROUTING_MATRIX.length)

    for (const route of PIX_GRID_NEON_MARQUEE_AUDIO_ROUTING_MATRIX) {
      expect(route.attack, route.routeId).toBeGreaterThanOrEqual(0)
      expect(route.release, route.routeId).toBeGreaterThan(0)
      expect(route.clamp[0], route.routeId).toBeGreaterThanOrEqual(0)
      expect(route.clamp[1], route.routeId).toBeLessThanOrEqual(1)
      expect(route.clamp[1], route.routeId).toBeGreaterThan(route.clamp[0])
    }

    expect(keys).toEqual(expect.arrayContaining([
      'bass:marquee-perimeter-bank:brightness',
      'bass:marquee-perimeter-bank:rowRecruitment',
      'bass:marquee-equalizer-bank:brightness',
      'bass:marquee-focal-bank:brightness',
      'kick:marquee-perimeter-bank:brightness',
      'kick:marquee-focal-bank:brightness',
      'snare:marquee-letter-bank:brightness',
      'snare:marquee-trim-bank:outlineFlash',
      'hat:marquee-equalizer-bank:sparkle',
      'hat:marquee-sparkle-bank:sparkle',
      'mid:marquee-letter-bank:brightness',
      'vocalEnergy:marquee-letter-bank:brightness',
      'vocalEnergy:marquee-focal-bank:brightness',
      'downbeat:marquee-perimeter-bank:brightness',
      'downbeat:marquee-letter-bank:brightness',
      'downbeat:marquee-focal-bank:brightness',
      'buildProgress:marquee-bulb-bank:rowRecruitment',
      'buildProgress:marquee-equalizer-bank:rowRecruitment',
      'buildProgress:marquee-perimeter-bank:columnRecruitment',
      'dropImpact:marquee-impact-bank:brightness',
    ]))
  })

  it('does not layer section event actions over program audio routes', () => {
    for (const plan of NEON_MARQUEE_PERFORMANCE_PROGRAM.sectionPlans) {
      expect(Object.keys(plan.eventActions ?? {}), plan.id).toHaveLength(0)
    }
  })

  it('compiles each active source-target-property combination once with controlled stacking', () => {
    const compiled = new PixGridPerformanceProgramCompiler().compile(
      NEON_MARQUEE_PERFORMANCE_PROGRAM,
      canonicalState(),
    )
    for (const plan of NEON_MARQUEE_PERFORMANCE_PROGRAM.sectionPlans) {
      const assignments = compiled.assignments.filter(assignment => (
        assignment.id.startsWith(`program:${plan.id}:`)
      ))
      const keys = assignments.map(assignment => (
        `${assignment.source}:${assignment.targetScope}:${assignment.targetId}:${assignment.target}`
      ))
      expect(new Set(keys).size, plan.id).toBe(keys.length)
      for (const assignment of assignments) {
        expect(assignment.maximumStacking, assignment.id).toBe(1)
        expect(assignment.clamp[1], assignment.id).toBeLessThanOrEqual(1)
        if (assignment.target === 'brightness' || assignment.target === 'scale') {
          expect(assignment.amount, assignment.id).toBeLessThanOrEqual(assignment.clamp[1])
        }
      }
    }
  })

  it('removes retired built-in direct routes during migration while preserving genuine custom routes', () => {
    const legacyId = [...PIX_GRID_NEON_MARQUEE_LEGACY_DIRECT_ASSIGNMENT_IDS][0]!
    const baseAssignment = createDefaultPixGridReactionAssignment()
    const stale = canonicalState()
    stale.configuration.presetConfigurationVersion = PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION - 1
    stale.audioAssignments = [
      { ...baseAssignment, id: legacyId, name: 'Retired Marquee route', targetScope: 'group', targetId: 'marquee-perimeter-group' },
      { ...baseAssignment, id: 'user-custom-marquee-route', name: 'User custom route' },
    ]

    const migrated = migratePixGridState(stale, PRESET)
    expect(migrated.configuration.presetConfigurationVersion).toBe(PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION)
    expect(migrated.audioAssignments.some(route => route.id === legacyId)).toBe(false)
    expect(migrated.audioAssignments.some(route => route.id === 'user-custom-marquee-route')).toBe(true)
  })

  it('leaves existing direct-assignment behavior intact for other presets', () => {
    const bassBeacon = PIX_GRID_PRESET_BY_ID.get('pix-grid-bass-beacon')!
    const state = applyPixGridPresetSettings(
      createDefaultPixGridState(),
      bassBeacon.id,
      bassBeacon.pixGridSettings,
    )
    expect(state.audioAssignments.length).toBeGreaterThan(0)
  })
})
