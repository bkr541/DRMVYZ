/**
 * Tests for beamEditorVisible / beamPathsVisible visibility controls.
 *
 * These tests cover store-level behavior only (no DOM rendering required):
 *  - Default values
 *  - Toggling does not dirty the preset
 *  - Toggling does not mutate beam definitions
 *  - Loading a preset preserves both flags
 *  - v5 → v6 migration adds both flags with true defaults
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

let uuidCounter = 0
vi.stubGlobal('crypto', {
  randomUUID: () => `vis-uuid-${++uuidCounter}`,
})

import { useReactStore, migrateReactStore } from '../../../../stores/reactStore'
import { createDefaultLaserDmxBeamMatrixSettings } from '../ReactTypes'

function resetBeamMatrix() {
  useReactStore.setState({
    laserDmxBeamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    laserDmxBeamMatrixPresetDirty: false,
  })
}

// ── Default values ────────────────────────────────────────────────────────────

describe('beamEditorVisible + beamPathsVisible — defaults', () => {
  it('beamEditorVisible defaults to true', () => {
    const settings = createDefaultLaserDmxBeamMatrixSettings()
    expect(settings.editor.beamEditorVisible).toBe(true)
  })

  it('beamPathsVisible defaults to true', () => {
    const settings = createDefaultLaserDmxBeamMatrixSettings()
    expect(settings.editor.beamPathsVisible).toBe(true)
  })

  it('store state reflects true defaults after reset', () => {
    resetBeamMatrix()
    const { laserDmxBeamMatrix } = useReactStore.getState()
    expect(laserDmxBeamMatrix.editor.beamEditorVisible).toBe(true)
    expect(laserDmxBeamMatrix.editor.beamPathsVisible).toBe(true)
  })
})

// ── setLaserDmxBeamMatrixEditorSettings ──────────────────────────────────────

describe('beamEditorVisible + beamPathsVisible — toggling', () => {
  beforeEach(resetBeamMatrix)

  it('can hide the beam editor', () => {
    const { setLaserDmxBeamMatrixEditorSettings } = useReactStore.getState()
    setLaserDmxBeamMatrixEditorSettings({ beamEditorVisible: false })
    expect(useReactStore.getState().laserDmxBeamMatrix.editor.beamEditorVisible).toBe(false)
  })

  it('can hide beam paths', () => {
    const { setLaserDmxBeamMatrixEditorSettings } = useReactStore.getState()
    setLaserDmxBeamMatrixEditorSettings({ beamPathsVisible: false })
    expect(useReactStore.getState().laserDmxBeamMatrix.editor.beamPathsVisible).toBe(false)
  })

  it('hiding the beam editor does NOT set preset dirty', () => {
    const { setLaserDmxBeamMatrixEditorSettings } = useReactStore.getState()
    setLaserDmxBeamMatrixEditorSettings({ beamEditorVisible: false })
    expect(useReactStore.getState().laserDmxBeamMatrixPresetDirty).toBe(false)
  })

  it('hiding beam paths does NOT set preset dirty', () => {
    const { setLaserDmxBeamMatrixEditorSettings } = useReactStore.getState()
    setLaserDmxBeamMatrixEditorSettings({ beamPathsVisible: false })
    expect(useReactStore.getState().laserDmxBeamMatrixPresetDirty).toBe(false)
  })

  it('toggling visibility does not mutate beam definitions', () => {
    const { addLaserDmxMatrixBeam, setLaserDmxBeamMatrixEditorSettings } = useReactStore.getState()
    addLaserDmxMatrixBeam()
    const beamsBefore = useReactStore.getState().laserDmxBeamMatrix.beams
    setLaserDmxBeamMatrixEditorSettings({ beamEditorVisible: false, beamPathsVisible: false })
    const beamsAfter = useReactStore.getState().laserDmxBeamMatrix.beams
    expect(beamsAfter).toHaveLength(beamsBefore.length)
    expect(beamsAfter[0].id).toBe(beamsBefore[0].id)
    expect(beamsAfter[0].enabled).toBe(beamsBefore[0].enabled)
  })

  it('Show Guides still controlled independently via guidesVisible', () => {
    const { setLaserDmxBeamMatrixEditorSettings } = useReactStore.getState()
    setLaserDmxBeamMatrixEditorSettings({ beamEditorVisible: false })
    setLaserDmxBeamMatrixEditorSettings({ guidesVisible: false })
    const { editor } = useReactStore.getState().laserDmxBeamMatrix
    expect(editor.guidesVisible).toBe(false)
    expect(editor.beamEditorVisible).toBe(false)
  })
})

// ── Preset loading preserves visibility prefs ─────────────────────────────────

describe('beamEditorVisible + beamPathsVisible — preset loading', () => {
  beforeEach(resetBeamMatrix)

  it('applying a preset does not reset beamEditorVisible', () => {
    const { setLaserDmxBeamMatrixEditorSettings, applyLaserDmxBeamMatrixPreset } = useReactStore.getState()
    setLaserDmxBeamMatrixEditorSettings({ beamEditorVisible: false })
    applyLaserDmxBeamMatrixPreset('bm-preset-pulse-grid')
    expect(useReactStore.getState().laserDmxBeamMatrix.editor.beamEditorVisible).toBe(false)
  })

  it('applying a preset does not reset beamPathsVisible', () => {
    const { setLaserDmxBeamMatrixEditorSettings, applyLaserDmxBeamMatrixPreset } = useReactStore.getState()
    setLaserDmxBeamMatrixEditorSettings({ beamPathsVisible: false })
    applyLaserDmxBeamMatrixPreset('bm-preset-pulse-grid')
    expect(useReactStore.getState().laserDmxBeamMatrix.editor.beamPathsVisible).toBe(false)
  })
})

// ── v5 → v6 migration ────────────────────────────────────────────────────────

describe('beamEditorVisible + beamPathsVisible — v5→v6 migration', () => {
  it('adds beamEditorVisible:true when migrating from v5', () => {
    const oldState = {
      laserDmxBeamMatrix: {
        beams: [],
        groups: [],
        globalModulationRoutes: [],
        output: { masterDimmer: 0.8, blackout: false, safetyClamp: 0.9, backgroundFade: 0.18, beamPersistence: 0.6, globalBeamWidth: 1, globalGlow: 0.65, globalStrobeRate: 0 },
        fog: { enabled: false, density: 0.4, opacity: 0.5, noiseScale: 1, driftSpeed: 0.15, driftDirection: 0.25, turbulence: 0.2, diffusion: 0.3, dissipation: 0.4, beamScatter: 0.2, colorAbsorption: 0.1, quality: 'medium' as const },
        editor: { guidesVisible: true, snapEnabled: true, overscanAmount: 0 },
        selectedBeamIds: [],
        selectedGroupId: null,
      },
    }
    const migrated = migrateReactStore(oldState, 5)
    const bm = migrated.laserDmxBeamMatrix as Record<string, unknown>
    const editor = bm.editor as Record<string, unknown>
    expect(editor.beamEditorVisible).toBe(true)
  })

  it('adds beamPathsVisible:true when migrating from v5', () => {
    const oldState = {
      laserDmxBeamMatrix: {
        beams: [],
        groups: [],
        globalModulationRoutes: [],
        output: { masterDimmer: 0.8, blackout: false, safetyClamp: 0.9, backgroundFade: 0.18, beamPersistence: 0.6, globalBeamWidth: 1, globalGlow: 0.65, globalStrobeRate: 0 },
        fog: { enabled: false, density: 0.4, opacity: 0.5, noiseScale: 1, driftSpeed: 0.15, driftDirection: 0.25, turbulence: 0.2, diffusion: 0.3, dissipation: 0.4, beamScatter: 0.2, colorAbsorption: 0.1, quality: 'medium' as const },
        editor: { guidesVisible: true, snapEnabled: true, overscanAmount: 0 },
        selectedBeamIds: [],
        selectedGroupId: null,
      },
    }
    const migrated = migrateReactStore(oldState, 5)
    const bm = migrated.laserDmxBeamMatrix as Record<string, unknown>
    const editor = bm.editor as Record<string, unknown>
    expect(editor.beamPathsVisible).toBe(true)
  })

  it('preserves existing guidesVisible during migration', () => {
    const oldState = {
      laserDmxBeamMatrix: {
        beams: [], groups: [], globalModulationRoutes: [],
        output: { masterDimmer: 0.8, blackout: false, safetyClamp: 0.9, backgroundFade: 0.18, beamPersistence: 0.6, globalBeamWidth: 1, globalGlow: 0.65, globalStrobeRate: 0 },
        fog: { enabled: false, density: 0.4, opacity: 0.5, noiseScale: 1, driftSpeed: 0.15, driftDirection: 0.25, turbulence: 0.2, diffusion: 0.3, dissipation: 0.4, beamScatter: 0.2, colorAbsorption: 0.1, quality: 'medium' as const },
        editor: { guidesVisible: false, snapEnabled: false, overscanAmount: 0.1 },
        selectedBeamIds: [], selectedGroupId: null,
      },
    }
    const migrated = migrateReactStore(oldState, 5)
    const bm = migrated.laserDmxBeamMatrix as Record<string, unknown>
    const editor = bm.editor as Record<string, unknown>
    expect(editor.guidesVisible).toBe(false)
    expect(editor.snapEnabled).toBe(false)
    expect(editor.overscanAmount).toBe(0.1)
  })

  it('does not overwrite beamEditorVisible if already present in v5 state', () => {
    // Should not happen in practice but guard the migration is idempotent
    const oldState = {
      laserDmxBeamMatrix: {
        beams: [], groups: [], globalModulationRoutes: [],
        output: { masterDimmer: 0.8, blackout: false, safetyClamp: 0.9, backgroundFade: 0.18, beamPersistence: 0.6, globalBeamWidth: 1, globalGlow: 0.65, globalStrobeRate: 0 },
        fog: { enabled: false, density: 0.4, opacity: 0.5, noiseScale: 1, driftSpeed: 0.15, driftDirection: 0.25, turbulence: 0.2, diffusion: 0.3, dissipation: 0.4, beamScatter: 0.2, colorAbsorption: 0.1, quality: 'medium' as const },
        editor: { guidesVisible: true, snapEnabled: true, overscanAmount: 0, beamEditorVisible: false },
        selectedBeamIds: [], selectedGroupId: null,
      },
    }
    const migrated = migrateReactStore(oldState, 5)
    const bm = migrated.laserDmxBeamMatrix as Record<string, unknown>
    const editor = bm.editor as Record<string, unknown>
    expect(editor.beamEditorVisible).toBe(false)
  })

  it('no-op when laserDmxBeamMatrix is absent', () => {
    const oldState = { someOtherKey: 'value' }
    const migrated = migrateReactStore(oldState, 5)
    expect(migrated.laserDmxBeamMatrix).toBeUndefined()
  })
})
