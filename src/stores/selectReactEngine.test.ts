/**
 * Tests for the React store's engine/preset synchronisation invariant:
 *
 *   activeReactEngineId === reactPresets.find(p => p.id === activeReactPresetId)?.engine
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
  DEFAULT_OSCILLATOR_SETTINGS,
  DEFAULT_NEON_LATTICE_SETTINGS,
} from '../components/vyzualz/react/ReactTypes'
import type { ReactPreset, NeonLatticeSettings } from '../components/vyzualz/react/ReactTypes'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const shaderPreset    = DEFAULT_REACT_PRESETS.find(p => p.engine === 'shaderPads')!
const cinPreset       = DEFAULT_REACT_PRESETS.find(p => p.engine === 'cinematicPortal')!
const oscPreset       = DEFAULT_REACT_PRESETS.find(p => p.engine === 'oscilloscope')!
const enhancedOscPreset = DEFAULT_REACT_PRESETS.find(
  p => p.engine === 'oscilloscope' && p.oscillatorSettings != null,
)

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
    const patch = buildPresetPatch(shaderPreset, DEFAULT_OSCILLATOR_SETTINGS)
    expect(patch.activeReactPresetId).toBe(shaderPreset.id)
    expect(patch.activeReactEngineId).toBe('shaderPads')
  })

  it('copies intensity/motion/glow/bassReactivity from preset params', () => {
    const patch = buildPresetPatch(cinPreset, DEFAULT_OSCILLATOR_SETTINGS)
    expect(patch.reactIntensity).toBe(cinPreset.params.intensity)
    expect(patch.reactMotion).toBe(cinPreset.params.motion)
    expect(patch.reactGlow).toBe(cinPreset.params.glow)
    expect(patch.reactBassReactivity).toBe(cinPreset.params.bassReactivity)
  })

  it('leaves oscillatorSettings unchanged for non-oscilloscope presets', () => {
    const patch = buildPresetPatch(shaderPreset, DEFAULT_OSCILLATOR_SETTINGS)
    expect(patch.oscillatorSettings).toBe(DEFAULT_OSCILLATOR_SETTINGS) // same reference
  })

  it('resolves oscillatorSettings from DEFAULT for oscilloscope presets', () => {
    const prevSettings = { ...DEFAULT_OSCILLATOR_SETTINGS, sourceType: 'text' as const, text: 'PREV' }
    const patch = buildPresetPatch(oscPreset, prevSettings)
    expect(patch.activeReactEngineId).toBe('oscilloscope')
    // Oscilloscope resets to DEFAULT — previous sourceType should not survive
    if (!oscPreset.oscillatorSettings?.sourceType) {
      expect(patch.oscillatorSettings.sourceType).toBe(DEFAULT_OSCILLATOR_SETTINGS.sourceType)
    }
  })

  it('applies enhanced preset oscillatorSettings on top of DEFAULT', () => {
    if (!enhancedOscPreset) return
    const patch = buildPresetPatch(enhancedOscPreset, DEFAULT_OSCILLATOR_SETTINGS)
    for (const [key, val] of Object.entries(enhancedOscPreset.oscillatorSettings!)) {
      expect(patch.oscillatorSettings[key as keyof typeof patch.oscillatorSettings]).toBe(val)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// selectReactEngine
// ─────────────────────────────────────────────────────────────────────────────

describe('selectReactEngine', () => {
  it('selecting shaderPads: sets activeReactEngineId to shaderPads', () => {
    useReactStore.getState().selectReactEngine('shaderPads')
    expect(useReactStore.getState().activeReactEngineId).toBe('shaderPads')
  })

  it('selecting shaderPads: active preset belongs to shaderPads', () => {
    useReactStore.getState().selectReactEngine('shaderPads')
    const { activeReactPresetId, reactPresets } = useReactStore.getState()
    const preset = activePreset(reactPresets, activeReactPresetId)
    expect(preset?.engine).toBe('shaderPads')
  })

  it('selecting cinematicPortal: sets activeReactEngineId to cinematicPortal', () => {
    useReactStore.getState().selectReactEngine('cinematicPortal')
    expect(useReactStore.getState().activeReactEngineId).toBe('cinematicPortal')
  })

  it('selecting cinematicPortal: active preset belongs to cinematicPortal', () => {
    useReactStore.getState().selectReactEngine('cinematicPortal')
    const { activeReactPresetId, reactPresets } = useReactStore.getState()
    const preset = activePreset(reactPresets, activeReactPresetId)
    expect(preset?.engine).toBe('cinematicPortal')
  })

  it('selecting oscilloscope: sets activeReactEngineId to oscilloscope', () => {
    useReactStore.getState().selectReactEngine('oscilloscope')
    expect(useReactStore.getState().activeReactEngineId).toBe('oscilloscope')
  })

  it('selecting oscilloscope: active preset belongs to oscilloscope', () => {
    useReactStore.getState().selectReactEngine('oscilloscope')
    const { activeReactPresetId, reactPresets } = useReactStore.getState()
    const preset = activePreset(reactPresets, activeReactPresetId)
    expect(preset?.engine).toBe('oscilloscope')
  })

  it('selecting oscilloscope: oscillatorSettings are resolved (no leftover state)', () => {
    // Put the store into a text-source state first
    useReactStore.getState().setOscillatorSettings({ sourceType: 'text', text: 'LEFTOVER' })
    useReactStore.getState().selectReactEngine('oscilloscope')
    const { oscillatorSettings, activeReactPresetId, reactPresets } = useReactStore.getState()
    const preset = activePreset(reactPresets, activeReactPresetId)
    // If the selected oscilloscope preset has no sourceType override, DEFAULT wins
    if (!preset?.oscillatorSettings?.sourceType) {
      expect(oscillatorSettings.sourceType).toBe(DEFAULT_OSCILLATOR_SETTINGS.sourceType)
      expect(oscillatorSettings.text).toBe(DEFAULT_OSCILLATOR_SETTINGS.text)
    }
  })

  it('re-selecting the current engine does not change the active preset', () => {
    // Start from a known shader-pads state
    useReactStore.getState().selectReactEngine('shaderPads')
    const presetIdBefore = useReactStore.getState().activeReactPresetId

    useReactStore.getState().selectReactEngine('shaderPads')
    expect(useReactStore.getState().activeReactPresetId).toBe(presetIdBefore)
  })

  it("applying params: intensity from the selected engine's first preset", () => {
    useReactStore.getState().selectReactEngine('cinematicPortal')
    const { reactIntensity, activeReactPresetId, reactPresets } = useReactStore.getState()
    const preset = activePreset(reactPresets, activeReactPresetId)
    expect(reactIntensity).toBe(preset?.params.intensity)
  })

  // Invariant: engine ID and preset's engine always agree after selectReactEngine
  it.each(['shaderPads', 'cinematicPortal', 'oscilloscope'] as const)(
    'invariant: activeReactEngineId === activePreset.engine after selecting %s',
    (engineId) => {
      useReactStore.getState().selectReactEngine(engineId)
      const { activeReactEngineId, activeReactPresetId, reactPresets } = useReactStore.getState()
      const preset = activePreset(reactPresets, activeReactPresetId)
      expect(activeReactEngineId).toBe(engineId)
      expect(preset?.engine).toBe(activeReactEngineId)
    },
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// selectReactPreset
// ─────────────────────────────────────────────────────────────────────────────

describe('selectReactPreset', () => {
  it('updates activeReactEngineId to match the selected preset engine', () => {
    useReactStore.getState().selectReactPreset(cinPreset.id)
    expect(useReactStore.getState().activeReactEngineId).toBe('cinematicPortal')
    expect(useReactStore.getState().activeReactPresetId).toBe(cinPreset.id)
  })

  it('invariant: activePreset.engine === activeReactEngineId after any preset selection', () => {
    for (const preset of [shaderPreset, cinPreset, oscPreset]) {
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

    for (const pad of pads.slice(0, 4)) {  // sample first 4 to keep test fast
      useReactStore.getState().setActivePadId(pad.id)
      const { activeReactEngineId, activeReactPresetId } = useReactStore.getState()
      const preset = activePreset(reactPresets, activeReactPresetId)
      expect(preset?.engine).toBe(activeReactEngineId)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Neon Lattice preset transitions — deterministic settings
// ─────────────────────────────────────────────────────────────────────────────

describe('Neon Lattice preset transitions via buildPresetPatch', () => {
  const nlPresets = DEFAULT_REACT_PRESETS.filter(
    p => p.engine === 'neonLattice' && p.neonLatticeSettings != null,
  )

  it('every NL preset transition produces the preset-defined value, not the previous state', () => {
    for (const presetA of nlPresets) {
      for (const presetB of nlPresets) {
        if (presetA.id === presetB.id) continue

        // Apply A first to get "current" state
        const patchA = buildPresetPatch(presetA, DEFAULT_OSCILLATOR_SETTINGS, undefined, DEFAULT_NEON_LATTICE_SETTINGS)
        const stateAfterA = patchA.neonLatticeSettings as NeonLatticeSettings

        // Apply B on top of A's settings — the result must equal B's preset values (not A's)
        const patchB = buildPresetPatch(presetB, DEFAULT_OSCILLATOR_SETTINGS, undefined, stateAfterA)
        const stateAfterB = patchB.neonLatticeSettings as NeonLatticeSettings

        // Every key explicitly in B's neonLatticeSettings must match B's value
        for (const [key, val] of Object.entries(presetB.neonLatticeSettings!)) {
          expect(stateAfterB[key as keyof NeonLatticeSettings]).toBe(val)
        }
      }
    }
  })

  it('NL settings from DEFAULT are never leaked from a previous preset selection', () => {
    // Modify current settings to contain sentinel values on every field
    const modifiedCurrent: NeonLatticeSettings = {
      ...DEFAULT_NEON_LATTICE_SETTINGS,
      railDensity: 0.999,
      parallax:    0.999,
      cameraMotion: 0.999,
      bloom:       0.999,
    }

    for (const preset of nlPresets) {
      const patch = buildPresetPatch(preset, DEFAULT_OSCILLATOR_SETTINGS, undefined, modifiedCurrent)
      const s = patch.neonLatticeSettings as NeonLatticeSettings
      // The result must match the preset's own values, not the 0.999 sentinels
      for (const [key, val] of Object.entries(preset.neonLatticeSettings!)) {
        expect(s[key as keyof NeonLatticeSettings]).toBe(val)
      }
    }
  })

  it('NL preset result contains every NeonLatticeSettings key', () => {
    const allKeys = Object.keys(DEFAULT_NEON_LATTICE_SETTINGS) as Array<keyof NeonLatticeSettings>
    for (const preset of nlPresets) {
      const patch = buildPresetPatch(preset, DEFAULT_OSCILLATOR_SETTINGS, undefined, DEFAULT_NEON_LATTICE_SETTINGS)
      const s = patch.neonLatticeSettings as NeonLatticeSettings
      for (const key of allKeys) {
        expect(s).toHaveProperty(key)
      }
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// NL preset order independence — confirmed via buildPresetPatch
// ─────────────────────────────────────────────────────────────────────────────

describe('NL preset order independence', () => {
  const nlPresets = DEFAULT_REACT_PRESETS.filter(
    p => p.engine === 'neonLattice' && p.neonLatticeSettings != null,
  )

  it('applying preset C after B yields the same settings as applying C directly', () => {
    for (const presetB of nlPresets) {
      for (const presetC of nlPresets) {
        if (presetB.id === presetC.id) continue

        const patchB   = buildPresetPatch(presetB, DEFAULT_OSCILLATOR_SETTINGS, undefined, DEFAULT_NEON_LATTICE_SETTINGS)
        const afterB   = patchB.neonLatticeSettings as NeonLatticeSettings
        const patchBC  = buildPresetPatch(presetC, DEFAULT_OSCILLATOR_SETTINGS, undefined, afterB)

        const patchC   = buildPresetPatch(presetC, DEFAULT_OSCILLATOR_SETTINGS, undefined, DEFAULT_NEON_LATTICE_SETTINGS)

        for (const [key, val] of Object.entries(presetC.neonLatticeSettings!)) {
          const k = key as keyof NeonLatticeSettings
          expect(patchBC.neonLatticeSettings![k]).toBe(val)
          expect(patchC.neonLatticeSettings![k]).toBe(val)
        }
      }
    }
  })

  it('selectReactEngine(neonLattice) produces a consistent active preset', () => {
    useReactStore.getState().selectReactEngine('neonLattice')
    const { activeReactPresetId, activeReactEngineId, reactPresets } = useReactStore.getState()
    const preset = reactPresets.find(p => p.id === activeReactPresetId)
    expect(activeReactEngineId).toBe('neonLattice')
    expect(preset?.engine).toBe('neonLattice')
  })
})
