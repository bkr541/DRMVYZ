/**
 * Tests for the React store's engine/preset synchronisation invariant:
 *
 * Preset-backed engines keep engine/preset IDs synchronized. Sound Drawing XY,
 * CANVAS, Cinema 2.0, and Headliner may intentionally run with no active
 * preset. The retired Sound Drawing engine opens Sound Drawing XY. Retired Shader Pads/Cinematic Worlds/Cinema selections normalize to
 * Cinema 2.0.
 *
 * Covers:
 *   1. buildPresetPatch pure-function correctness
 *   2. selectReactEngine — switches to a compatible preset and keeps IDs in sync
 *   3. selectReactPreset — always sets activeReactEngineId to preset.engine
 *   4. setActivePadId — same invariant via performance-pad selection
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useReactStore, buildPresetPatch } from './reactStore'
import {
  DEFAULT_REACT_PRESETS,
  DEFAULT_PERFORMANCE_PADS,
  LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID,
} from '../components/vyzualz/react/ReactTypes'
import type { ReactEngineId, ReactPreset } from '../components/vyzualz/react/ReactTypes'
import { REACT_ENGINE_IDS } from '../components/vyzualz/react/reactEngineCatalog'
import { getXyScopePreset } from '../components/vyzualz/react/xyScope/XyScopeSettings'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const cinPreset       = DEFAULT_REACT_PRESETS.find(p => p.engine === 'cinematicPortal')!
const pixGridPreset   = DEFAULT_REACT_PRESETS.find(p => p.engine === 'pixGrid')!
const PRESET_FREE_ENGINE_IDS = new Set<ReactEngineId>(['canvas', 'cinema2', 'headliner', 'xyScope'])

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the ReactPreset that matches the store's active preset ID, or null. */
function activePreset(presets: ReactPreset[], id: string | null): ReactPreset | null {
  return id ? presets.find(p => p.id === id) ?? null : null
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  useReactStore.getState().resetReactView()
})

// ─────────────────────────────────────────────────────────────────────────────
// buildPresetPatch
// ─────────────────────────────────────────────────────────────────────────────

describe('buildPresetPatch', () => {
  it('returns matching activeReactPresetId and activeReactEngineId', () => {
    const patch = buildPresetPatch(pixGridPreset)
    expect(patch.activeReactPresetId).toBe(pixGridPreset.id)
    expect(patch.activeReactEngineId).toBe('pixGrid')
  })

  it('copies intensity/motion/glow/bassReactivity from preset params', () => {
    const patch = buildPresetPatch(pixGridPreset)
    expect(patch.reactIntensity).toBe(pixGridPreset.params.intensity)
    expect(patch.reactMotion).toBe(pixGridPreset.params.motion)
    expect(patch.reactGlow).toBe(pixGridPreset.params.glow)
    expect(patch.reactBassReactivity).toBe(pixGridPreset.params.bassReactivity)
  })

  it('refuses presets of retired engines', () => {
    expect(() => buildPresetPatch(cinPreset)).toThrow(/retired engine/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// selectReactEngine
// ─────────────────────────────────────────────────────────────────────────────

describe('selectReactEngine', () => {
  it('routes the retired Cinematic Worlds engine identity to Cinema 2.0', () => {
    useReactStore.getState().selectReactEngine('cinematicPortal')
    const state = useReactStore.getState()
    expect(state.activeReactEngineId).toBe('cinema2')
    expect(state.activeReactPresetId).toBeNull()
    expect(state.pendingCinemaLegacySelectionMigration).toBeNull()
  })

  it('opens Sound Drawing XY when the retired Sound Drawing engine is selected', () => {
    useReactStore.getState().selectReactEngine('oscilloscope')
    expect(useReactStore.getState().activeReactEngineId).toBe('xyScope')
    expect(useReactStore.getState().activeReactPresetId).toBeNull()
  })

  it('routes the retired Cinema identity to preset-free Cinema 2.0', () => {
    useReactStore.getState().selectReactEngine('cinema')
    useReactStore.getState().selectReactEngine('cinema')
    expect(useReactStore.getState().activeReactEngineId).toBe('cinema2')
    expect(useReactStore.getState().activeReactPresetId).toBeNull()
  })

  it("applying params: intensity from a selectable preset-backed engine's first preset", () => {
    useReactStore.getState().selectReactEngine('laserDmx')
    const { reactIntensity, activeReactPresetId, reactPresets } = useReactStore.getState()
    const preset = activePreset(reactPresets, activeReactPresetId)
    expect(reactIntensity).toBe(preset?.params.intensity)
  })

  it('invariant: selectable preset-backed engines keep the active preset in the same family', () => {
    useReactStore.getState().selectReactEngine('laserDmx')
    const { activeReactEngineId, activeReactPresetId, reactPresets } = useReactStore.getState()
    const preset = activePreset(reactPresets, activeReactPresetId)
    expect(activeReactEngineId).toBe('laserDmx')
    expect(preset?.engine).toBe(activeReactEngineId)
  })

  it('selecting canvas: sets a standalone engine with no preset', () => {
    useReactStore.getState().selectReactEngine('canvas')
    const { activeReactEngineId, activeReactPresetId, canvasEngineSettings } = useReactStore.getState()
    expect(activeReactEngineId).toBe('canvas')
    expect(activeReactPresetId).toBeNull()
    expect(canvasEngineSettings.mediaIds).toEqual([])
  })

  it('can repeatedly switch among every remaining engine without losing synchronization', () => {
    for (let pass = 0; pass < 3; pass += 1) {
      for (const engineId of REACT_ENGINE_IDS) {
        expect(() => useReactStore.getState().selectReactEngine(engineId)).not.toThrow()
        const { activeReactEngineId, activeReactPresetId, reactPresets } = useReactStore.getState()
        expect(activeReactEngineId).toBe(engineId)
        if (PRESET_FREE_ENGINE_IDS.has(engineId)) {
          expect(activeReactPresetId).toBeNull()
        } else {
          expect(activePreset(reactPresets, activeReactPresetId)?.engine).toBe(engineId)
        }
      }
    }
  })

  it('rejects the retired Neon engine and restores the startup pair', () => {
    useReactStore.getState().selectReactEngine('neonLattice' as never)
    const { activeReactPresetId, activeReactEngineId } = useReactStore.getState()
    expect(activeReactEngineId).toBe('cinema2')
    expect(activeReactPresetId).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// selectReactPreset
// ─────────────────────────────────────────────────────────────────────────────

describe('selectReactPreset', () => {
  it('routes a retired Cinematic Worlds preset selection to its Cinema handoff', () => {
    useReactStore.getState().selectReactPreset(cinPreset.id)
    const state = useReactStore.getState()
    expect(state.activeReactEngineId).toBe('cinema2')
    expect(state.activeReactPresetId).toBeNull()
    expect(state.pendingCinemaLegacySelectionMigration).toBeNull()
    expect(state.cinema2Workspace.activePresetId).not.toBeNull()
  })

  it('invariant: activePreset.engine === activeReactEngineId after any preset selection', () => {
    for (const preset of [pixGridPreset]) {
      useReactStore.getState().selectReactPreset(preset.id)
      const { activeReactEngineId, activeReactPresetId, reactPresets } = useReactStore.getState()
      const active = activePreset(reactPresets, activeReactPresetId)
      expect(active?.engine).toBe(activeReactEngineId)
    }
  })

  it('no-ops gracefully for unknown preset ID', () => {
    const before = { ...useReactStore.getState() }
    useReactStore.getState().selectReactPreset('non-existent-id')
    expect(useReactStore.getState().activeReactPresetId).toBe(before.activeReactPresetId)
    expect(useReactStore.getState().activeReactEngineId).toBe(before.activeReactEngineId)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// setActivePadId (performance pads)
// ─────────────────────────────────────────────────────────────────────────────

describe('setActivePadId', () => {
  it('selecting a pad applies its preset and syncs both IDs', () => {
    const pads = useReactStore.getState().performancePads
    const pad = pads.find(p => p.presetId != null)
    if (!pad?.presetId) return

    useReactStore.getState().setActivePadId(pad.id)
    const { activeReactPresetId, activeReactEngineId, reactPresets } = useReactStore.getState()
    const preset = activePreset(reactPresets, activeReactPresetId)

    expect(activeReactPresetId).toBe(pad.presetId)
    expect(preset?.engine).toBe(activeReactEngineId)
  })

  it('invariant: engine and preset agree after every pad selection', () => {
    const pads = useReactStore.getState().performancePads.filter(p => p.presetId != null)
    const { reactPresets } = useReactStore.getState()

    for (const pad of pads) {
      useReactStore.getState().setActivePadId(pad.id)
      const { activeReactEngineId, activeReactPresetId } = useReactStore.getState()
      const preset = activePreset(reactPresets, activeReactPresetId)
      expect(preset?.engine).toBe(activeReactEngineId)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT_PERFORMANCE_PADS — remapped pad assignments
// ─────────────────────────────────────────────────────────────────────────────

describe('DEFAULT_PERFORMANCE_PADS remapped assignments', () => {
  it('keeps the LaserDMX assignments, opens Sound Drawing XY presets and clears retired slots', () => {
    expect(DEFAULT_PERFORMANCE_PADS.find(p => p.id === 'pad-1')?.destination)
      .toEqual({ schemaVersion: 1, engineId: 'xyScope', presetId: 'osc1' })

    expect(DEFAULT_PERFORMANCE_PADS.find(p => p.id === 'pad-2')?.presetId)
      .toBe(LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID)

    expect(DEFAULT_PERFORMANCE_PADS.find(p => p.id === 'pad-3')?.destination)
      .toEqual({ schemaVersion: 1, engineId: 'xyScope', presetId: 'phase-portal' })

    expect(DEFAULT_PERFORMANCE_PADS.find(p => p.id === 'pad-4')?.presetId)
      .toBe(LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID)

    expect(DEFAULT_PERFORMANCE_PADS.find(p => p.id === 'pad-13')?.presetId).toBeNull()
    expect(DEFAULT_PERFORMANCE_PADS.find(p => p.id === 'pad-18')?.presetId).toBeNull()
  })

  it('opens only Sound Drawing XY presets that exist', () => {
    for (const pad of DEFAULT_PERFORMANCE_PADS) {
      if (pad.destination?.engineId !== 'xyScope') continue
      expect(getXyScopePreset(pad.destination.presetId), pad.id).toBeDefined()
    }
  })

  it('no pad references a legacy shaderPads preset', () => {
    const LEGACY_SHADER_PAD_PRESET_IDS = new Set([
      'preset-neon-energy-cloud',
      'preset-lava-tunnel',
      'preset-synth-sun',
      'preset-dot-warp',
      'preset-festival-burst',
    ])

    for (const pad of DEFAULT_PERFORMANCE_PADS) {
      if (pad.presetId != null) {
        expect(LEGACY_SHADER_PAD_PRESET_IDS.has(pad.presetId)).toBe(false)
      }
    }
  })

  it('every non-null presetId resolves to an existing non-shaderPads preset', () => {
    for (const pad of DEFAULT_PERFORMANCE_PADS) {
      if (pad.presetId == null) continue
      const preset = DEFAULT_REACT_PRESETS.find(p => p.id === pad.presetId)
      expect(preset, `pad ${pad.id} presetId '${pad.presetId}' not found in DEFAULT_REACT_PRESETS`).toBeDefined()
      expect(preset?.engine, `pad ${pad.id} maps to shaderPads preset '${pad.presetId}'`).not.toBe('shaderPads')
    }
  })

  it('contains no retired Neon preset or action reference', () => {
    for (const pad of DEFAULT_PERFORMANCE_PADS) {
      expect(pad.presetId?.startsWith('preset-nl-') ?? false).toBe(false)
      expect((pad as { actionId?: string }).actionId?.startsWith('neonLattice.') ?? false).toBe(false)
    }
  })
})
