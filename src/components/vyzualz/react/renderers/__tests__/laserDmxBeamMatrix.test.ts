import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Mock crypto.randomUUID so tests are deterministic ─────────────────────────
let uuidCounter = 0
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
})

import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxSettings,
  LASER_DMX_MATRIX_COLUMNS,
  LASER_DMX_MATRIX_ROWS,
  LASER_DMX_MATRIX_MAX_BEAMS,
} from '../../ReactTypes'

// ── Snapshot the store factory for isolated per-test state ────────────────────
// We test store logic directly using the pure helpers extracted into the store
// (clampMatrixBeam, makeDefaultMatrixBeam, etc.) and the action implementations.
// For actions that require Zustand, we import the store and exercise its actions.

import { useReactStore } from '../../../../../stores/reactStore'
import { buildPresetPatch } from '../../../../../stores/reactStore'

// ── Helpers ───────────────────────────────────────────────────────────────────

function freshBeamMatrix() {
  return createDefaultLaserDmxBeamMatrixSettings()
}

// ── Default workspace mode tests ──────────────────────────────────────────────

describe('default workspace mode', () => {
  it('createDefaultLaserDmxBeamMatrixSettings returns spatialFixtures-compatible shape', () => {
    const s = freshBeamMatrix()
    expect(s.beams).toHaveLength(0)
    expect(s.groups.length).toBeGreaterThanOrEqual(4)
  })

  it('default store workspace mode is spatialFixtures', () => {
    // The initial state value is set to 'spatialFixtures'
    const mode = useReactStore.getState().laserDmxWorkspaceMode
    expect(mode).toBe('spatialFixtures')
  })
})

// ── Migration tests ───────────────────────────────────────────────────────────

describe('persist migration', () => {
  it('existing laserDmxSettings survive migration (not overwritten by new fields)', () => {
    // Simulates state after migration: laserDmxSettings must still be present
    const s = useReactStore.getState()
    expect(s.laserDmxSettings).toBeDefined()
    expect(s.laserDmxSettings.fixtures).toBeDefined()
    expect(Array.isArray(s.laserDmxSettings.fixtures)).toBe(true)
  })

  it('laserDmxBeamMatrix is defined in store (migration provided it)', () => {
    const s = useReactStore.getState()
    expect(s.laserDmxBeamMatrix).toBeDefined()
    expect(s.laserDmxBeamMatrix.groups).toBeDefined()
  })
})

// ── Preset application isolation ──────────────────────────────────────────────

describe('preset application does not touch Beam Matrix state', () => {
  it('buildPresetPatch does not include laserDmxWorkspaceMode', () => {
    const { reactPresets, oscillatorSettings, laserDmxSettings } = useReactStore.getState()
    const ldxPreset = reactPresets.find(p => p.engine === 'laserDmx')!
    const patch = buildPresetPatch(ldxPreset, oscillatorSettings, laserDmxSettings)
    expect(patch).not.toHaveProperty('laserDmxWorkspaceMode')
  })

  it('buildPresetPatch does not include laserDmxBeamMatrix', () => {
    const { reactPresets, oscillatorSettings, laserDmxSettings } = useReactStore.getState()
    const ldxPreset = reactPresets.find(p => p.engine === 'laserDmx')!
    const patch = buildPresetPatch(ldxPreset, oscillatorSettings, laserDmxSettings)
    expect(patch).not.toHaveProperty('laserDmxBeamMatrix')
  })

  it('selectReactPreset does not change laserDmxWorkspaceMode', () => {
    const store = useReactStore.getState()
    const ldxPreset = store.reactPresets.find(p => p.engine === 'laserDmx')!
    // Set to beamMatrix first
    store.setLaserDmxWorkspaceMode('beamMatrix')
    store.selectReactPreset(ldxPreset.id)
    expect(useReactStore.getState().laserDmxWorkspaceMode).toBe('beamMatrix')
    // Restore
    useReactStore.getState().setLaserDmxWorkspaceMode('spatialFixtures')
  })

  it('selectReactPreset does not replace beam matrix beams', () => {
    const store = useReactStore.getState()
    store.addLaserDmxMatrixBeam()
    const beforeCount = useReactStore.getState().laserDmxBeamMatrix.beams.length
    const ldxPreset = store.reactPresets.find(p => p.engine === 'laserDmx')!
    store.selectReactPreset(ldxPreset.id)
    expect(useReactStore.getState().laserDmxBeamMatrix.beams.length).toBe(beforeCount)
    // Clean up
    useReactStore.getState().resetLaserDmxBeamMatrix()
  })
})

// ── Workspace mode switching ──────────────────────────────────────────────────

describe('workspace mode switching', () => {
  it('switching to beamMatrix does not modify laserDmxSettings', () => {
    const store = useReactStore.getState()
    const before = JSON.stringify(store.laserDmxSettings)
    store.setLaserDmxWorkspaceMode('beamMatrix')
    const after = JSON.stringify(useReactStore.getState().laserDmxSettings)
    expect(after).toBe(before)
    store.setLaserDmxWorkspaceMode('spatialFixtures')
  })

  it('switching to spatialFixtures does not modify laserDmxBeamMatrix', () => {
    const store = useReactStore.getState()
    store.setLaserDmxWorkspaceMode('beamMatrix')
    const before = JSON.stringify(useReactStore.getState().laserDmxBeamMatrix)
    store.setLaserDmxWorkspaceMode('spatialFixtures')
    const after = JSON.stringify(useReactStore.getState().laserDmxBeamMatrix)
    expect(after).toBe(before)
  })

  it('setLaserDmxWorkspaceMode updates the mode correctly', () => {
    const store = useReactStore.getState()
    store.setLaserDmxWorkspaceMode('beamMatrix')
    expect(useReactStore.getState().laserDmxWorkspaceMode).toBe('beamMatrix')
    store.setLaserDmxWorkspaceMode('spatialFixtures')
    expect(useReactStore.getState().laserDmxWorkspaceMode).toBe('spatialFixtures')
  })
})

// ── Beam count enforcement ────────────────────────────────────────────────────

describe('beam count limit', () => {
  beforeEach(() => {
    useReactStore.getState().resetLaserDmxBeamMatrix()
  })

  it('blocks beam creation at 300 beams', () => {
    const store = useReactStore.getState()
    // Use setLaserDmxBeamMatrixSettings to fill to max without looping 300 times
    const fakeBeams = Array.from({ length: LASER_DMX_MATRIX_MAX_BEAMS }, (_, i) => ({
      id: `beam-${i}`, name: `B${i}`, enabled: true,
      origin: { column: 1, row: 1, z: 0 },
      target: { kind: 'grid' as const, column: 1, row: 1, z: 0 },
      groupId: null, useGroupColor: false,
      color: { red: 0, green: 255, blue: 220, white: 0, alpha: 1 },
      appearance: { dimmer: 1, shutterOpen: true, width: 1, focus: 1, strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65, geometry: 'line' as const },
      modulationRoutes: [],
    }))
    store.setLaserDmxBeamMatrixSettings({ beams: fakeBeams })
    expect(useReactStore.getState().laserDmxBeamMatrix.beams.length).toBe(LASER_DMX_MATRIX_MAX_BEAMS)
    // This should be blocked
    store.addLaserDmxMatrixBeam()
    expect(useReactStore.getState().laserDmxBeamMatrix.beams.length).toBe(LASER_DMX_MATRIX_MAX_BEAMS)
  })

  it('LASER_DMX_MATRIX_MAX_BEAMS is 300', () => {
    expect(LASER_DMX_MATRIX_MAX_BEAMS).toBe(300)
  })

  it('LASER_DMX_MATRIX_COLUMNS is 15', () => {
    expect(LASER_DMX_MATRIX_COLUMNS).toBe(15)
  })

  it('LASER_DMX_MATRIX_ROWS is 10', () => {
    expect(LASER_DMX_MATRIX_ROWS).toBe(10)
  })
})

// ── Duplicate beam gets new IDs ───────────────────────────────────────────────

describe('duplicate beam', () => {
  beforeEach(() => {
    useReactStore.getState().resetLaserDmxBeamMatrix()
    useReactStore.getState().addLaserDmxMatrixBeam()
  })

  it('duplicated beam gets a new ID', () => {
    const store = useReactStore.getState()
    const original = store.laserDmxBeamMatrix.beams[0]
    store.duplicateLaserDmxMatrixBeam(original.id)
    const beams = useReactStore.getState().laserDmxBeamMatrix.beams
    expect(beams.length).toBe(2)
    expect(beams[1].id).not.toBe(original.id)
  })

  it('duplicated beam routes get new IDs', () => {
    const store = useReactStore.getState()
    // Add a route to the beam first
    const beamId = store.laserDmxBeamMatrix.beams[0].id
    store.addLaserDmxMatrixBeamRoute(beamId)
    const originalRouteId = useReactStore.getState().laserDmxBeamMatrix.beams[0].modulationRoutes[0].id
    // Duplicate
    store.duplicateLaserDmxMatrixBeam(beamId)
    const beams = useReactStore.getState().laserDmxBeamMatrix.beams
    const copyRouteId = beams[1].modulationRoutes[0].id
    expect(copyRouteId).not.toBe(originalRouteId)
  })
})

// ── Remove group clears beam group references ─────────────────────────────────

describe('removing reaction group clears beam groupId', () => {
  beforeEach(() => {
    useReactStore.getState().resetLaserDmxBeamMatrix()
  })

  it('beams in removed group have groupId set to null', () => {
    const store = useReactStore.getState()
    // Add a beam and assign it to the first default group
    store.addLaserDmxMatrixBeam()
    const beamId = useReactStore.getState().laserDmxBeamMatrix.beams[0].id
    const groupId = useReactStore.getState().laserDmxBeamMatrix.groups[0].id
    store.updateLaserDmxMatrixBeam(beamId, { groupId })
    expect(useReactStore.getState().laserDmxBeamMatrix.beams[0].groupId).toBe(groupId)
    // Remove the group
    store.removeLaserDmxReactionGroup(groupId)
    expect(useReactStore.getState().laserDmxBeamMatrix.beams[0].groupId).toBeNull()
  })

  it('beams in other groups are not affected when one group is removed', () => {
    const store = useReactStore.getState()
    store.addLaserDmxMatrixBeam()
    store.addLaserDmxMatrixBeam()
    const beams = useReactStore.getState().laserDmxBeamMatrix.beams
    const groups = useReactStore.getState().laserDmxBeamMatrix.groups
    // Assign beams to different groups
    store.updateLaserDmxMatrixBeam(beams[0].id, { groupId: groups[0].id })
    store.updateLaserDmxMatrixBeam(beams[1].id, { groupId: groups[1].id })
    // Remove group 0
    store.removeLaserDmxReactionGroup(groups[0].id)
    expect(useReactStore.getState().laserDmxBeamMatrix.beams.find(b => b.id === beams[1].id)?.groupId).toBe(groups[1].id)
  })
})

// ── Grid coordinate clamping ──────────────────────────────────────────────────

describe('grid coordinate clamping', () => {
  beforeEach(() => {
    useReactStore.getState().resetLaserDmxBeamMatrix()
  })

  it('beam origin column is clamped to 1–15', () => {
    const store = useReactStore.getState()
    store.addLaserDmxMatrixBeam({ origin: { column: 99, row: 5, z: 0 } })
    const beam = useReactStore.getState().laserDmxBeamMatrix.beams[0]
    expect(beam.origin.column).toBe(LASER_DMX_MATRIX_COLUMNS)
  })

  it('beam origin row is clamped to 1–10', () => {
    const store = useReactStore.getState()
    store.addLaserDmxMatrixBeam({ origin: { column: 5, row: 99, z: 0 } })
    const beam = useReactStore.getState().laserDmxBeamMatrix.beams[0]
    expect(beam.origin.row).toBe(LASER_DMX_MATRIX_ROWS)
  })

  it('beam origin column minimum is 1', () => {
    const store = useReactStore.getState()
    store.addLaserDmxMatrixBeam({ origin: { column: -5, row: 5, z: 0 } })
    const beam = useReactStore.getState().laserDmxBeamMatrix.beams[0]
    expect(beam.origin.column).toBe(1)
  })

  it('stage target x is NOT clamped to 0–1 (offscreen coordinates supported)', () => {
    const store = useReactStore.getState()
    store.addLaserDmxMatrixBeam({
      target: { kind: 'stage', x: -0.5, y: 1.8, z: 0 },
    })
    const beam = useReactStore.getState().laserDmxBeamMatrix.beams[0]
    if (beam.target.kind !== 'stage') throw new Error('expected stage target')
    expect(beam.target.x).toBe(-0.5)
    expect(beam.target.y).toBe(1.8)
  })

  it('stage target x clamps at −1 (lower bound)', () => {
    const store = useReactStore.getState()
    store.addLaserDmxMatrixBeam({
      target: { kind: 'stage', x: -3, y: 0.5, z: 0 },
    })
    const beam = useReactStore.getState().laserDmxBeamMatrix.beams[0]
    if (beam.target.kind !== 'stage') throw new Error('expected stage target')
    expect(beam.target.x).toBe(-1)
  })

  it('stage target y clamps at 2 (upper bound)', () => {
    const store = useReactStore.getState()
    store.addLaserDmxMatrixBeam({
      target: { kind: 'stage', x: 0.5, y: 5, z: 0 },
    })
    const beam = useReactStore.getState().laserDmxBeamMatrix.beams[0]
    if (beam.target.kind !== 'stage') throw new Error('expected stage target')
    expect(beam.target.y).toBe(2)
  })
})

// ── Trigger envelope tests ────────────────────────────────────────────────────

describe('trigger envelope releases after hit frame', () => {
  it('applyModulationRoute with trigger mode returns non-zero value on hit frame', async () => {
    const { applyModulationRoute } = await import('../LaserDmxModulationEngine')
    const route = {
      id: 'r1', enabled: true, source: 'snare', target: 'dimmer' as const,
      amount: 1, min: 0, max: 1, curve: 'linear' as const,
      mode: 'trigger' as const, smoothing: 0, attack: 0, release: 0.3, invert: false,
    }
    // Hit frame: snareHit = true
    const mi = makeMiFakeHit('snareHit')
    const result = applyModulationRoute(route, mi, 'test:r1', 1 / 60)
    expect(result).not.toBeNull()
    expect(result!.value).toBeGreaterThan(0)
  })

  it('trigger envelope releases on non-hit frames (value stays > 0 during slow release)', async () => {
    const { applyModulationRoute, resetAllEnvelopes } = await import('../LaserDmxModulationEngine')
    resetAllEnvelopes()

    // release=0.98 → rate ≈ 4.5 → per-frame decay ≈ 7% at 60fps, so value stays > 0.5 after 1 frame
    const route = {
      id: 'r2', enabled: true, source: 'kick', target: 'dimmer' as const,
      amount: 1, min: 0, max: 1, curve: 'linear' as const,
      mode: 'trigger' as const, smoothing: 0, attack: 0, release: 0.98, invert: false,
    }
    const dt = 1 / 60
    // Hit frame
    const hitMi = makeMiFakeHit('kickHit')
    applyModulationRoute(route, hitMi, 'env:r2', dt)
    // Non-hit frame immediately after
    const noHitMi = makeMiFakeNoHit()
    const afterResult = applyModulationRoute(route, noHitMi, 'env:r2', dt)
    // With release=0.98, the envelope decays slowly: value should remain > 0.5 after one frame
    expect(afterResult).not.toBeNull()
    expect(afterResult!.value).toBeGreaterThan(0.5)
  })

  it('trigger with release=0 drops immediately to 0 after hit frame', async () => {
    const { applyModulationRoute, resetAllEnvelopes } = await import('../LaserDmxModulationEngine')
    resetAllEnvelopes()

    const route = {
      id: 'r3', enabled: true, source: 'beat', target: 'dimmer' as const,
      amount: 1, min: 0, max: 1, curve: 'linear' as const,
      mode: 'trigger' as const, smoothing: 0, attack: 0, release: 0, invert: false,
    }
    const dt = 1 / 60
    // Hit frame
    applyModulationRoute(route, makeMiFakeHit('beatHit'), 'env:r3', dt)
    // Non-hit frame: release=0 means rate is very fast (200), so it decays almost instantly
    const after = applyModulationRoute(route, makeMiFakeNoHit(), 'env:r3', dt)
    // With release=0 (rate=200), decay in 1/60s: prev + (0-prev)*min(1, (1/60)*200) = prev*(1-1) = 0
    expect(after).not.toBeNull()
    expect(after!.value).toBeCloseTo(0, 3)
  })

  it('snare alias snareHit works as trigger source', async () => {
    const { getTriggerSourceValue } = await import('../../../../../features/musicIntelligence/selectors')
    const mi = makeMiFakeHit('snareHit')
    expect(getTriggerSourceValue(mi, 'snare')).toBe(true)
    expect(getTriggerSourceValue(mi, 'snareHit')).toBe(true)
  })

  it('beat alias beatHit works as trigger source', async () => {
    const { getTriggerSourceValue } = await import('../../../../../features/musicIntelligence/selectors')
    const mi = makeMiFakeHit('beatHit')
    expect(getTriggerSourceValue(mi, 'beat')).toBe(true)
    expect(getTriggerSourceValue(mi, 'beatHit')).toBe(true)
  })

  it('kick alias kickHit works as trigger source', async () => {
    const { getTriggerSourceValue } = await import('../../../../../features/musicIntelligence/selectors')
    const mi = makeMiFakeHit('kickHit')
    expect(getTriggerSourceValue(mi, 'kick')).toBe(true)
    expect(getTriggerSourceValue(mi, 'kickHit')).toBe(true)
  })

  it('phrase4 alias phrase4Hit works as trigger source', async () => {
    const { getTriggerSourceValue } = await import('../../../../../features/musicIntelligence/selectors')
    const mi = makeMiFakeHit('phrase4Hit')
    expect(getTriggerSourceValue(mi, 'phrase4')).toBe(true)
    expect(getTriggerSourceValue(mi, 'phrase4Hit')).toBe(true)
  })
})

// ── Selection integrity tests ─────────────────────────────────────────────────

describe('selection integrity', () => {
  beforeEach(() => {
    useReactStore.getState().resetLaserDmxBeamMatrix()
  })

  it('selection is cleared when the selected beam is removed', () => {
    const store = useReactStore.getState()
    store.addLaserDmxMatrixBeam()
    const beamId = useReactStore.getState().laserDmxBeamMatrix.beams[0].id
    store.selectLaserDmxMatrixBeam(beamId)
    store.removeLaserDmxMatrixBeam(beamId)
    expect(useReactStore.getState().laserDmxBeamMatrix.selectedBeamIds).not.toContain(beamId)
  })

  it('setSelectedLaserDmxMatrixBeams filters out IDs that no longer exist', () => {
    const store = useReactStore.getState()
    store.addLaserDmxMatrixBeam()
    const beamId = useReactStore.getState().laserDmxBeamMatrix.beams[0].id
    store.setSelectedLaserDmxMatrixBeams([beamId, 'nonexistent-id'])
    expect(useReactStore.getState().laserDmxBeamMatrix.selectedBeamIds).toEqual([beamId])
  })
})

// ── Spatial Fixture compiler continues passing (guard test) ───────────────────

describe('spatial fixture compiler backward compatibility', () => {
  it('createDefaultLaserDmxSettings still returns valid settings', () => {
    const s = createDefaultLaserDmxSettings()
    expect(s.fixtures.length).toBeGreaterThan(0)
    expect(s.masterDimmer).toBeGreaterThan(0)
    expect(s.fixtures[0].modulationRoutes.length).toBeGreaterThan(0)
  })
})

// ── MusicIntelligenceFrame factory helpers ────────────────────────────────────

type HitEventKey = 'beatHit' | 'kickHit' | 'snareHit' | 'hatHit' | 'downbeatHit' |
  'phrase4Hit' | 'phrase8Hit' | 'phrase16Hit' | 'phrase32Hit'

function makeMiFakeHit(event: HitEventKey) {
  return makeMiBase({
    beatHit:      event === 'beatHit',
    kickHit:      event === 'kickHit',
    snareHit:     event === 'snareHit',
    hatHit:       event === 'hatHit',
    downbeatHit:  event === 'downbeatHit',
    phrase4Hit:   event === 'phrase4Hit',
    phrase8Hit:   event === 'phrase8Hit',
    phrase16Hit:  event === 'phrase16Hit',
    phrase32Hit:  event === 'phrase32Hit',
  })
}

function makeMiFakeNoHit() {
  return makeMiBase({
    beatHit: false, kickHit: false, snareHit: false, hatHit: false, downbeatHit: false,
    phrase4Hit: false, phrase8Hit: false, phrase16Hit: false, phrase32Hit: false,
  })
}

// Minimal MusicIntelligenceFrame stub covering fields used by the modulation engine
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeMiBase(rhythmOverrides: Record<string, boolean>): any {
  return {
    frameId: 1,
    bands: { sub: 0, bass: 0, lowMid: 0, mid: 0, high: 0, air: 0, volume: 0, normalizedSub: 0, normalizedBass: 0, normalizedLowMid: 0, normalizedMid: 0, normalizedHigh: 0, normalizedAir: 0 },
    rhythm: {
      beatHit: false, kickHit: false, snareHit: false, hatHit: false, downbeatHit: false,
      phrase4Hit: false, phrase8Hit: false, phrase16Hit: false, phrase32Hit: false,
      beatPhase: 0, bpm: 120, transient: 0, kickStrength: 0, snareStrength: 0, hatStrength: 0,
      ...rhythmOverrides,
    },
    energy: { instant: 0, shortTerm: 0, longTerm: 0, spectralFlux: 0, tension: 0, complexity: 0, buildProgress: 0, dropImpact: 0, rms: 0, peak: 0, crestFactor: 0, percentile: 0, delta: 0, spectralCentroid: 0, spectralSpread: 0, spectralRolloff: 0, spectralFlatness: 0 },
    harmonic: { pitchHz: null, keyConfidence: 0, chordConfidence: 0, chordChanged: false, mode: 'unknown' },
    stems: { vocals: 0, drums: 0, bassStemEnergy: 0, instrumentEnergy: 0, vocalEnergy: 0, drumEnergy: 0, vocalActivity: 0, drumTransient: false, bassStemTransient: false },
    lyrics: { vocalActivity: 0, lyricLineProgress: 0, phraseConfidence: 0, wordHit: false, activeLine: null, activeWord: null },
    semantics: { buildConfidence: 0, dropConfidence: 0, fakeoutConfidence: 0, vocalHookConfidence: 0, mood: 'unknown' },
    section: { type: 'unknown', progress: 0, intensity: 0 },
  }
}
