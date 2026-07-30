/**
 * Tests for the React store's engine/preset synchronisation invariant:
 *
 * Preset-backed engines keep engine/preset IDs synchronized. Sound Drawing,
 * Shader Pads, and CANVAS may intentionally run with no active preset.
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
  DEFAULT_PERFORMANCE_PADS,
  LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID,
} from '../components/vyzualz/react/ReactTypes'
import type { ReactEngineId, ReactPreset } from '../components/vyzualz/react/ReactTypes'
import { REACT_ENGINE_IDS } from '../components/vyzualz/react/reactEngineCatalog'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const cinPreset       = DEFAULT_REACT_PRESETS.find(p => p.engine === 'cinematicPortal')!
const oscPreset       = DEFAULT_REACT_PRESETS.find(p => p.engine === 'oscilloscope')!
const enhancedOscPreset = DEFAULT_REACT_PRESETS.find(
  p => p.engine === 'oscilloscope' && p.oscillatorSettings != null,
)
const PRESET_FREE_ENGINE_IDS = new Set<ReactEngineId>(['shaderPads', 'canvas', 'oscilloscope'])

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
    const patch = buildPresetPatch(cinPreset, DEFAULT_OSCILLATOR_SETTINGS)
    expect(patch.activeReactPresetId).toBe(cinPreset.id)
    expect(patch.activeReactEngineId).toBe('cinematicPortal')
  })

  it('copies intensity/motion/glow/bassReactivity from preset params', () => {
    const patch = buildPresetPatch(cinPreset, DEFAULT_OSCILLATOR_SETTINGS)
    expect(patch.reactIntensity).toBe(cinPreset.params.intensity)
    expect(patch.reactMotion).toBe(cinPreset.params.motion)
    expect(patch.reactGlow).toBe(cinPreset.params.glow)
    expect(patch.reactBassReactivity).toBe(cinPreset.params.bassReactivity)
  })

  it('leaves oscillatorSettings unchanged for non-oscilloscope presets', () => {
    const patch = buildPresetPatch(cinPreset, DEFAULT_OSCILLATOR_SETTINGS)
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

  it('selecting oscilloscope: opens the preset-free base engine', () => {
    useReactStore.getState().selectReactEngine('oscilloscope')
    const { activeReactPresetId, oscillatorSettings } = useReactStore.getState()
    expect(activeReactPresetId).toBeNull()
    expect(oscillatorSettings).toEqual(DEFAULT_OSCILLATOR_SETTINGS)
    expect(oscillatorSettings.sourceType).toBe('classic')
    expect(oscillatorSettings.classicMode).toBe('waveform')
    expect(oscillatorSettings.autoSectionMode).toBe(false)
  })

  it('selecting oscilloscope: removes settings left by a previously selected preset', () => {
    useReactStore.getState().selectReactPreset(oscPreset.id)
    useReactStore.getState().setOscillatorSettings({ sourceType: 'text', text: 'LEFTOVER' })
    useReactStore.getState().selectReactEngine('oscilloscope')
    const { oscillatorSettings, activeReactPresetId } = useReactStore.getState()
    expect(activeReactPresetId).toBeNull()
    expect(oscillatorSettings).toEqual(DEFAULT_OSCILLATOR_SETTINGS)
  })

  it('re-selecting the current engine does not change the active preset', () => {
    useReactStore.getState().selectReactEngine('cinematicPortal')
    const presetIdBefore = useReactStore.getState().activeReactPresetId

    useReactStore.getState().selectReactEngine('cinematicPortal')
    expect(useReactStore.getState().activeReactPresetId).toBe(presetIdBefore)
  })

  it("applying params: intensity from the selected engine's first preset", () => {
    // Prime a different engine first so selectReactEngine('cinematicPortal') is a real switch.
    useReactStore.getState().selectReactEngine('oscilloscope')
    useReactStore.getState().selectReactEngine('cinematicPortal')
    const { reactIntensity, activeReactPresetId, reactPresets } = useReactStore.getState()
    const preset = activePreset(reactPresets, activeReactPresetId)
    expect(reactIntensity).toBe(preset?.params.intensity)
  })

  it('invariant: preset-backed engines keep the active preset in the same family', () => {
    useReactStore.getState().selectReactEngine('cinematicPortal')
    const { activeReactEngineId, activeReactPresetId, reactPresets } = useReactStore.getState()
    const preset = activePreset(reactPresets, activeReactPresetId)
    expect(activeReactEngineId).toBe('cinematicPortal')
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
    expect(activeReactEngineId).toBe('cinematicPortal')
    expect(activeReactPresetId).toBe('preset-singularity-crown')
  })
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
    for (const preset of [cinPreset, oscPreset]) {
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
  it('preserves the four non-Neon replacement assignments and clears retired slots', () => {
    expect(DEFAULT_PERFORMANCE_PADS.find(p => p.id === 'pad-1')?.presetId)
      .toBe('preset-bass-triangle-reactor')

    expect(DEFAULT_PERFORMANCE_PADS.find(p => p.id === 'pad-2')?.presetId)
      .toBe(LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID)

    expect(DEFAULT_PERFORMANCE_PADS.find(p => p.id === 'pad-3')?.presetId)
      .toBe('preset-infinity-signal')

    expect(DEFAULT_PERFORMANCE_PADS.find(p => p.id === 'pad-4')?.presetId)
      .toBe(LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID)

    expect(DEFAULT_PERFORMANCE_PADS.find(p => p.id === 'pad-13')?.presetId).toBeNull()
    expect(DEFAULT_PERFORMANCE_PADS.find(p => p.id === 'pad-18')?.presetId).toBeNull()
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
