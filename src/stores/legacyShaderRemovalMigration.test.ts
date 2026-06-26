/**
 * Focused migration tests for the version-19 Legacy Shader Pads removal.
 *
 * Covers:
 *   - Each of the 5 removed preset IDs falls back to Dream Gate
 *   - shaderPads engine with null / unknown preset falls back to Dream Gate
 *   - Valid non-Shader preset with stale shaderPads engine is repaired
 *   - Valid Sound Drawing / LaserDMX / Neon Lattice / Cinematic Portal states are untouched
 *   - All unrelated state fields survive migration unchanged
 *   - Version 19 is idempotent (no second-pass changes)
 *   - resetReactView() lands on Dream Gate / cinematicPortal
 *   - Fallback invariant: preset-dream-gate exists in DEFAULT_REACT_PRESETS with engine cinematicPortal
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { migrateReactStore, useReactStore } from './reactStore'
import { DEFAULT_REACT_PRESETS } from '../components/vyzualz/react/ReactTypes'

// ── Helpers ───────────────────────────────────────────────────────────────────

function migrate18(patch: Record<string, unknown>): Record<string, unknown> {
  return migrateReactStore(patch, 18)
}

function migrate19(patch: Record<string, unknown>): Record<string, unknown> {
  return migrateReactStore(patch, 19)
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  useReactStore.getState().resetReactView()
})

// ── Fallback invariant ────────────────────────────────────────────────────────

describe('fallback invariant', () => {
  it('DEFAULT_REACT_PRESETS contains exactly one preset-dream-gate with engine cinematicPortal', () => {
    const matches = DEFAULT_REACT_PRESETS.filter(p => p.id === 'preset-dream-gate')
    expect(matches).toHaveLength(1)
    expect(matches[0].engine).toBe('cinematicPortal')
  })
})

// ── Legacy preset migration ───────────────────────────────────────────────────

describe('legacy preset migration — each removed ID falls back to Dream Gate', () => {
  const LEGACY_IDS = [
    'preset-neon-energy-cloud',
    'preset-lava-tunnel',
    'preset-synth-sun',
    'preset-dot-warp',
    'preset-festival-burst',
  ]

  it.each(LEGACY_IDS)(
    'version-18 state with activeReactPresetId=%s → preset-dream-gate / cinematicPortal',
    (legacyId) => {
      const result = migrate18({
        activeReactPresetId: legacyId,
        activeReactEngineId: 'shaderPads',
      })
      expect(result.activeReactPresetId).toBe('preset-dream-gate')
      expect(result.activeReactEngineId).toBe('cinematicPortal')
    },
  )
})

// ── Legacy engine without valid preset ───────────────────────────────────────

describe('legacy engine without valid preset → Dream Gate fallback', () => {
  it('shaderPads engine with null activeReactPresetId falls back to Dream Gate', () => {
    const result = migrate18({
      activeReactPresetId: null,
      activeReactEngineId: 'shaderPads',
    })
    expect(result.activeReactPresetId).toBe('preset-dream-gate')
    expect(result.activeReactEngineId).toBe('cinematicPortal')
  })

  it('shaderPads engine with unknown preset ID falls back to Dream Gate', () => {
    const result = migrate18({
      activeReactPresetId: 'unknown-preset',
      activeReactEngineId: 'shaderPads',
    })
    expect(result.activeReactPresetId).toBe('preset-dream-gate')
    expect(result.activeReactEngineId).toBe('cinematicPortal')
  })
})

// ── Valid preset with stale shaderPads engine ─────────────────────────────────

describe('valid preset with stale shaderPads engine → engine repaired', () => {
  it('preset-bass-triangle-reactor with shaderPads engine → repaired to oscilloscope', () => {
    const result = migrate18({
      activeReactPresetId: 'preset-bass-triangle-reactor',
      activeReactEngineId: 'shaderPads',
    })
    expect(result.activeReactPresetId).toBe('preset-bass-triangle-reactor')
    expect(result.activeReactEngineId).toBe('oscilloscope')
  })

  it('preset-laser-dmx-default with shaderPads engine → repaired to laserDmx', () => {
    const result = migrate18({
      activeReactPresetId: 'preset-laser-dmx-default',
      activeReactEngineId: 'shaderPads',
    })
    expect(result.activeReactPresetId).toBe('preset-laser-dmx-default')
    expect(result.activeReactEngineId).toBe('laserDmx')
  })
})

// ── Valid state remains unchanged ─────────────────────────────────────────────

describe('valid non-Shader state is not modified', () => {
  it('Sound Drawing state is preserved', () => {
    const result = migrate18({
      activeReactPresetId: 'preset-xy-cyan-scope',
      activeReactEngineId: 'oscilloscope',
    })
    expect(result.activeReactPresetId).toBe('preset-xy-cyan-scope')
    expect(result.activeReactEngineId).toBe('oscilloscope')
  })

  it('LaserDMX state is preserved', () => {
    const result = migrate18({
      activeReactPresetId: 'preset-laser-dmx-default',
      activeReactEngineId: 'laserDmx',
    })
    expect(result.activeReactPresetId).toBe('preset-laser-dmx-default')
    expect(result.activeReactEngineId).toBe('laserDmx')
  })

  it('Neon Lattice state is preserved', () => {
    const result = migrate18({
      activeReactPresetId: 'preset-nl-acid-magenta',
      activeReactEngineId: 'neonLattice',
    })
    expect(result.activeReactPresetId).toBe('preset-nl-acid-magenta')
    expect(result.activeReactEngineId).toBe('neonLattice')
  })

  it('Cinematic Portal state is preserved', () => {
    const result = migrate18({
      activeReactPresetId: 'preset-dream-gate',
      activeReactEngineId: 'cinematicPortal',
    })
    expect(result.activeReactPresetId).toBe('preset-dream-gate')
    expect(result.activeReactEngineId).toBe('cinematicPortal')
  })
})

// ── Unrelated state preservation ─────────────────────────────────────────────

describe('unrelated state fields survive migration unchanged', () => {
  it('all representative nested values are deeply equal after migration', () => {
    const oscillatorSettings = {
      sourceType: 'text',
      text: 'DRMVYZ',
      textFontId: 'font-abc-123',
      pathResolution: 512,
    }
    const soundDrawingLayersByTrackId = {
      'track-1': [{ id: 'layer-1', name: 'Test Layer', enabled: true, sourceType: 'text', text: 'hello', fontId: null, letterSpacing: 0, lineHeight: 1.2, alignment: 'center', svgId: null, shape: 'circle', x: 0, y: 0, scale: 1, rotation: 0, oscillatorOverride: {} }],
    }
    const soundDrawingClipsByTrackId = {
      'track-1': [{ id: 'clip-1', trackId: 'track-1', layerId: 'layer-1', startSec: 0, endSec: 4, enabled: true, zIndex: 0, fadeInMs: 0, fadeOutMs: 0 }],
    }
    const laserDmxSettings = {
      masterDimmer: 0.75,
      blackout: false,
      fixtures: [{ id: 'fix-1', name: 'Test' }],
    }
    const laserDmxBeamMatrix = {
      beams: [{ id: 'beam-1', name: 'B1' }],
      groups: [],
      output: { masterDimmer: 0.9 },
    }
    const neonLatticeSettings = {
      railDensity: 0.88,
      bloom: 0.77,
    }
    const presetAutomationCuesByTrackId = {
      'track-1': [{ id: 'cue-1', timeSec: 12, presetId: 'preset-dream-gate', label: 'Intro', enabled: true, transitionMs: 500 }],
    }
    const futureField = { custom: 'value', count: 42 }

    const input: Record<string, unknown> = {
      activeReactPresetId: 'preset-neon-energy-cloud',
      activeReactEngineId: 'shaderPads',
      oscillatorSettings,
      soundDrawingLayersByTrackId,
      soundDrawingClipsByTrackId,
      laserDmxSettings,
      laserDmxBeamMatrix,
      neonLatticeSettings,
      presetAutomationCuesByTrackId,
      futureField,
    }

    const result = migrate18(input)

    // Active IDs must be migrated
    expect(result.activeReactPresetId).toBe('preset-dream-gate')
    expect(result.activeReactEngineId).toBe('cinematicPortal')

    // All other fields must be deeply preserved
    expect(result.oscillatorSettings).toEqual(oscillatorSettings)
    expect(result.soundDrawingLayersByTrackId).toEqual(soundDrawingLayersByTrackId)
    expect(result.soundDrawingClipsByTrackId).toEqual(soundDrawingClipsByTrackId)
    expect(result.laserDmxSettings).toEqual(laserDmxSettings)
    expect(result.laserDmxBeamMatrix).toEqual(laserDmxBeamMatrix)
    expect(result.neonLatticeSettings).toEqual(neonLatticeSettings)
    expect(result.presetAutomationCuesByTrackId).toEqual(presetAutomationCuesByTrackId)
    expect((result as Record<string, unknown>).futureField).toEqual(futureField)
  })
})

// ── Version 19 idempotence ────────────────────────────────────────────────────

describe('version 19 idempotence', () => {
  it('calling migrateReactStore with version=19 does not apply the v19 migration', () => {
    // At version 19 the migration has already run — re-running must not change state.
    const state = {
      activeReactPresetId: 'preset-neon-energy-cloud',
      activeReactEngineId: 'shaderPads',
    }
    const result = migrate19(state)
    // Version 19 block should be skipped, so IDs remain as-is
    expect(result.activeReactPresetId).toBe('preset-neon-energy-cloud')
    expect(result.activeReactEngineId).toBe('shaderPads')
  })
})

// ── Reset behavior ────────────────────────────────────────────────────────────

describe('resetReactView', () => {
  it('lands on preset-dream-gate / cinematicPortal after reset', () => {
    const { activeReactPresetId, activeReactEngineId } = useReactStore.getState()
    expect(activeReactPresetId).toBe('preset-dream-gate')
    expect(activeReactEngineId).toBe('cinematicPortal')
  })
})
