import { describe, expect, it } from 'vitest'
import { normalizeBrandKitEngineRules } from '../../../../features/personalization/brandKitNormalization'
import { BrandKitEngineControls } from '../../../../features/personalization/components/BrandKitEngineControls'
import { useReactStore } from '../../../../stores/reactStore'
import { REACT_VISUAL_PERFORMANCE_ACTIONS } from '../ReactPerformanceActions'
import { DEFAULT_REACT_PRESETS, type ReactEngineId, type ReactPreset } from '../ReactTypes'
import { REACT_ENGINE_IDS, isSelectableReactEngineId } from '../reactEngineCatalog'
import { filterReactPresetLibrary, sanitizeReactPresetFavorites, writeReactPresetFavorites } from '../reactPresetLibraryState'
import { getReactPresetThumbnailFrameBudgetForTests } from '../renderers/ReactPresetThumbnailRenderer'

const SOURCE_TEXT = import.meta.glob('../../../../**/*.{ts,tsx,css}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const MIGRATION_TOMBSTONE_FILES = [
  '/stores/reactStore.ts',
  '/features/personalization/brandKitNormalization.ts',
  '/features/personalization/brandKitStore.ts',
]

function productionSources(): Array<[string, string]> {
  return Object.entries(SOURCE_TEXT).filter(([path]) => (
    !path.includes('/__tests__/')
    && !path.endsWith('.test.ts')
    && !path.endsWith('.test.tsx')
  ))
}

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

describe('Neon Lattice secondary integration retirement', () => {
  it('leaves exact retired Neon identifiers only in historical sanitizers', () => {
    const retiredNeedles = [
      /neonLattice/g,
      /NeonLattice/g,
      /neon_lattice/gi,
      /NEON_LATTICE/g,
      /Neon\s+Lattice/g,
      /neon\s+lattice/g,
      /neon-lattice/gi,
      /preset-nl-/g,
      /nl-trigger/g,
      /acid-magenta/g,
      /drmvyz-lattice/g,
      /sparse-starlines/g,
      /overload-matrix/g,
      /reverie-keygrid/g,
      /preset-neon-energy-cloud/g,
      /triggerNeonLattice/g,
    ]
    const offenders: string[] = []

    for (const [path, text] of productionSources()) {
      if (MIGRATION_TOMBSTONE_FILES.some(allowed => path.endsWith(allowed))) continue
      for (const needle of retiredNeedles) {
        if (needle.test(text)) offenders.push(`${path}: ${needle.source}`)
        needle.lastIndex = 0
      }
    }

    expect(offenders).toEqual([])
  })

  it('keeps preset thumbnails budgeted for every remaining engine without Neon-specific frame budgets', () => {
    const sampleByEngine = new Map<ReactEngineId, ReactPreset>()
    for (const preset of DEFAULT_REACT_PRESETS) {
      if (isSelectableReactEngineId(preset.engine)) sampleByEngine.set(preset.engine, preset)
    }

    const canvasPreset: ReactPreset = {
      ...DEFAULT_REACT_PRESETS[0],
      id: 'test-canvas-thumbnail',
      engine: 'canvas',
    }
    sampleByEngine.set('canvas', canvasPreset)
    sampleByEngine.set('cinema', {
      ...DEFAULT_REACT_PRESETS[0],
      id: 'test-cinema-thumbnail',
      engine: 'cinema',
    })

    expect([...sampleByEngine.keys()].sort()).toEqual([...REACT_ENGINE_IDS].sort())
    for (const engineId of REACT_ENGINE_IDS) {
      const budget = getReactPresetThumbnailFrameBudgetForTests(sampleByEngine.get(engineId)!)
      expect(budget).toBeGreaterThan(0)
      expect(budget).toBeLessThanOrEqual(5)
    }
  })

  it('preserves LaserDMX, CANVAS, and Reactive Constellation action IDs while excluding retired Neon actions', () => {
    expect(REACT_VISUAL_PERFORMANCE_ACTIONS.map(action => action.id)).toEqual([
      'laserDmx.blackout', 'laserDmx.reveal', 'laserDmx.whiteHit', 'laserDmx.blinderHit',
      'laserDmx.laserStarburst', 'laserDmx.fanOpen', 'laserDmx.fanClose', 'laserDmx.movementVariation',
      'laserDmx.strobeBurst', 'laserDmx.fogBurst', 'laserDmx.cryoBurst', 'laserDmx.previousLook',
      'laserDmx.nextLook', 'canvas.cleanPlayback', 'canvas.bassBloom', 'canvas.ghostEcho',
      'canvas.glitchPulse', 'canvas.lumaMelt', 'canvas.frameStutter', 'canvas.particleAura',
      'canvas.restartClip', 'reactiveConstellation.collapse', 'reactiveConstellation.burst',
      'reactiveConstellation.reseed', 'reactiveConstellation.freeze', 'reactiveConstellation.beamFan',
      'reactiveConstellation.crystalOnly', 'reactiveConstellation.edgesOnly', 'reactiveConstellation.paletteFlip',
      'reactiveConstellation.whiteFlash', 'reactiveConstellation.blackout',
    ])
    expect(REACT_VISUAL_PERFORMANCE_ACTIONS.every(action => (
      !action.id.startsWith('neonLattice.') && String(action.target.engineId) !== 'neonLattice'
    ))).toBe(true)
  })

  it('prevents retired Neon actions from dispatching through automation or pads', () => {
    useReactStore.getState().resetReactView()
    const before = useReactStore.getState().performanceActionSeq
    useReactStore.getState().triggerPerformanceAction('neonLattice.railBurst')
    expect(useReactStore.getState().performanceActionSeq).toBe(before)
    expect(useReactStore.getState().performanceActionEvent).toBeNull()
  })

  it('exposes only remaining engines through Brand Kit rule normalization and controls', () => {
    const normalized = normalizeBrandKitEngineRules({
      neonLattice: { mode: 'brand', strength: 1 },
      oscilloscope: { mode: 'hybrid', strength: 0.5 },
      laserDmx: { mode: 'brand', strength: 0.8, preserveTriggerSemantics: true },
      reactiveConstellation: { mode: 'custom', strength: 0.7 },
      unknownEngine: { mode: 'brand', strength: 1 },
    })

    expect(Object.keys(normalized).sort()).toEqual(['laserDmx', 'oscilloscope', 'reactiveConstellation'])
    expect(String(BrandKitEngineControls)).not.toContain('neonLattice')
  })

  it('keeps favorites, preset filters, and preset labels free of retired Neon presentation residue', () => {
    const storage = memoryStorage()
    const valid = DEFAULT_REACT_PRESETS.map(preset => preset.id)
    writeReactPresetFavorites(['preset-nl-acid-magenta', valid[1], 'missing-preset', valid[0]], storage)
    expect(sanitizeReactPresetFavorites(valid, storage)).toEqual([valid[1], valid[0]])

    const visible = filterReactPresetLibrary(DEFAULT_REACT_PRESETS, 'cinematicPortal', 'current', new Set())
    expect(visible.length).toBeGreaterThan(0)
    expect(visible.every(preset => preset.engine === 'cinematicPortal')).toBe(true)
    expect(DEFAULT_REACT_PRESETS.some(preset => String(preset.engine) === 'neonLattice')).toBe(false)
    expect(DEFAULT_REACT_PRESETS.some(preset => /Neon\s+Lattice|neonLattice|preset-nl-/i.test([
      preset.name,
      preset.description,
      preset.id,
    ].join(' ')))).toBe(false)
    expect(DEFAULT_REACT_PRESETS.some(preset => /\bNeon\b/i.test(`${preset.name} ${preset.description}`))).toBe(false)
  })

  it('keeps track-map, inspector, and CSS output free of stale Neon classes and labels', () => {
    const presentationFiles = productionSources().filter(([path]) => (
      path.endsWith('/ReactTrackMapStrip.tsx')
      || path.endsWith('/ReactInspectorPanel.tsx')
      || path.endsWith('/ReactPresetThumbnail.tsx')
      || path.endsWith('/ReactPerformancePads.tsx')
      || path.endsWith('/ReactPresetsPanel.tsx')
    ))
    const stalePresentationHits = presentationFiles.flatMap(([path, text]) => (
      /Neon\s+Lattice|neonLattice|preset-nl-|preset-neon-energy-cloud/i.test(text) ? [path] : []
    ))
    const staleClassHits = productionSources().flatMap(([path, text]) => (
      /className\s*=\s*(?:{)?[`'\"][^`'\"]*(?:neonLattice|neon-lattice|preset-nl-|nl-)[^`'\"]*/i.test(text) ? [path] : []
    ))

    expect(stalePresentationHits).toEqual([])
    expect(staleClassHits).toEqual([])
  })
})
