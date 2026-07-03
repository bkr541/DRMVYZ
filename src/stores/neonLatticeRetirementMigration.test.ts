import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_PERFORMANCE_PADS,
  DEFAULT_REACT_PRESETS,
  type ReactEngineId,
  type ReactPreset,
} from '../components/vyzualz/react/ReactTypes'
import {
  readReactPresetFavorites,
  writeReactPresetFavorites,
} from '../components/vyzualz/react/reactPresetLibraryState'
import { normalizeBrandKitEngineRules } from '../features/personalization/brandKitNormalization'
import {
  mergeReactStoreState,
  migrateReactStore,
  reactStorePartialize,
  RETIRED_NEON_LATTICE_BUILT_IN_PRESET_IDS,
  sanitizeRetiredNeonLatticeReactState,
  useReactStore,
} from './reactStore'

const NEON_PRESET_ID = 'preset-nl-acid-magenta'
const NON_NEON_PRESET = DEFAULT_REACT_PRESETS.find(preset => preset.engine === 'oscilloscope')!
const SRC_ROOT = join(process.cwd(), 'src')
const DELETED_NEON_PRODUCTION_MODULES = [
  'NeonLatticeConfig',
  'NeonLatticeEnginePanel',
  'NeonLatticeRenderer',
  'neonLatticeAudioDirector',
  'neonLatticePresetValidation',
  'neonLatticePreview',
  'neonLatticeSequencer',
  'neonLatticeUtils',
]
const PRODUCTION_SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])

function collectProductionSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      if (entry === '__tests__') continue
      collectProductionSourceFiles(fullPath, files)
      continue
    }
    if (!PRODUCTION_SOURCE_EXTENSIONS.has(fullPath.slice(fullPath.lastIndexOf('.')))) continue
    if (fullPath.endsWith('.test.ts') || fullPath.endsWith('.test.tsx')) continue
    files.push(fullPath)
  }
  return files
}

const BASE_NEON_PRESET: Record<string, unknown> = {
  ...structuredClone(NON_NEON_PRESET),
  id: NEON_PRESET_ID,
  name: 'Historical Neon Fixture',
  engine: 'neonLattice',
  neonLatticeSettings: {
    railDensity: 0.77,
    triggerRoutes: [{ id: 'legacy-route', source: 'beat', action: 'advanceSequence' }],
  },
}

function customPreset(id: string, engine: ReactEngineId): ReactPreset
function customPreset(id: string, engine: 'neonLattice'): Record<string, unknown>
function customPreset(id: string, engine: ReactEngineId | 'neonLattice'): ReactPreset | Record<string, unknown> {
  const base = engine === 'neonLattice' ? BASE_NEON_PRESET : NON_NEON_PRESET
  return {
    ...structuredClone(base),
    id,
    name: `Custom ${id}`,
    engine,
  } as ReactPreset | Record<string, unknown>
}

function makeMigrationFixture() {
  const customNeon = customPreset('custom-neon-import', 'neonLattice')
  const customNeonId = 'custom-neon-import'
  const customSoundDrawing = customPreset('custom-sound-drawing', 'oscilloscope')
  return {
    activeReactPresetId: customNeonId,
    activeReactEngineId: 'neonLattice',
    reactPresets: [BASE_NEON_PRESET, customNeon, customSoundDrawing],
    performancePads: [{
      ...DEFAULT_PERFORMANCE_PADS[0],
      presetId: customNeonId,
      label: 'Keep My Label',
      color: '#123456',
      keyBinding: '9',
      actionId: 'neonLattice.whiteout',
      position: 17,
    }],
    presetAutomationCuesByTrackId: {
      trackA: [
        { id: 'neon-preset', timeSec: 10, presetId: customNeonId, label: 'Neon', enabled: true, transitionMs: 250 },
        { id: 'neon-action', timeSec: 20, presetId: customSoundDrawing.id, label: 'Action', enabled: true, transitionMs: 350, actionId: 'neonLattice.blackout' },
        { id: 'sound', timeSec: 30, presetId: customSoundDrawing.id, label: 'Sound', enabled: true, transitionMs: 450 },
      ],
    },
    manualTrackSectionsByTrackId: {
      trackA: [{
        id: 'section-1', label: 'Drop', type: 'drop', startSec: 12, endSec: 42,
        intensity: 0.9, engineId: 'neonLattice', source: 'manual', confidence: 0.88,
      }],
    },
    cinematicConfigsByPresetId: {
      [customNeonId]: { stale: true },
      keep: { safe: true },
    },
    cinematicSeedLocksByPresetId: {
      [customNeonId]: true,
      keep: false,
    },
    neonLatticeSettings: { railDensity: 0.99 },
    neonLatticeTrigger: { type: 'whiteout', seq: 9 },
    neonLatticeTriggerSeq: 9,
    performanceActionEvent: {
      actionId: 'neonLattice.reseed',
      sequence: 4,
      target: { engineId: 'neonLattice' },
      triggeredAtMs: 100,
    },
    performanceActionEvents: [
      { actionId: 'neonLattice.reseed', sequence: 4, target: { engineId: 'neonLattice' }, triggeredAtMs: 100 },
      { actionId: 'laserDmx.whiteHit', sequence: 5, target: { engineId: 'laserDmx' }, triggeredAtMs: 120 },
    ],
    performanceActionToggleStates: {
      'neonLattice.blackout': true,
      'laserDmx.blackout': true,
    },
  }
}

describe('Neon Lattice persisted-data retirement', () => {
  beforeEach(() => {
    localStorage.clear()
    useReactStore.getState().resetReactView()
  })

  it('keeps Neon out of current live engine, preset, and store shapes', () => {
    const state = useReactStore.getState() as unknown as Record<string, unknown>
    expect(state).not.toHaveProperty('neonLatticeSettings')
    expect(state).not.toHaveProperty('neonLatticeTrigger')
    expect(state).not.toHaveProperty('triggerNeonLattice')
    expect(DEFAULT_REACT_PRESETS.some(preset => String(preset.engine) === 'neonLattice')).toBe(false)
    expect(DEFAULT_REACT_PRESETS.some(preset => 'neonLatticeSettings' in preset)).toBe(false)
  })

  it('keeps the live ReactEngineId union closed to Neon Lattice', () => {
    const acceptLiveEngine = (engine: ReactEngineId): ReactEngineId => engine
    expect(acceptLiveEngine('cinematicPortal')).toBe('cinematicPortal')
    // @ts-expect-error Neon Lattice is a historical raw string only, not a live engine member.
    acceptLiveEngine('neonLattice')
  })

  it('has no production imports of deleted Neon-only runtime modules', () => {
    const residues: string[] = []
    for (const filePath of collectProductionSourceFiles(SRC_ROOT)) {
      const text = readFileSync(filePath, 'utf8')
      for (const moduleName of DELETED_NEON_PRODUCTION_MODULES) {
        const importPattern = new RegExp(`(?:from\\s+['\"][^'\"]*${moduleName}|import\\(['\"][^'\"]*${moduleName})`)
        if (importPattern.test(text)) residues.push(`${relative(process.cwd(), filePath)} -> ${moduleName}`)
      }
    }
    expect(residues).toEqual([])
  })

  it('migrates an active Neon project to the authoritative safe startup pair', () => {
    const migrated = migrateReactStore(makeMigrationFixture(), 36)
    expect(migrated.activeReactEngineId).toBe('cinematicPortal')
    expect(migrated.activeReactPresetId).toBe('preset-dream-gate')
  })

  it('removes built-in and custom Neon presets while preserving non-Neon custom presets', () => {
    const migrated = migrateReactStore(makeMigrationFixture(), 36)
    const presets = migrated.reactPresets as ReactPreset[]
    expect(presets.map(preset => preset.id)).toEqual(['custom-sound-drawing'])
    expect(presets.some(preset => String(preset.engine) === 'neonLattice')).toBe(false)
  })

  it('clears only invalid pad assignments and keeps pad identity and user metadata', () => {
    const migrated = migrateReactStore(makeMigrationFixture(), 36)
    const pad = (migrated.performancePads as Array<Record<string, unknown>>)[0]
    expect(pad).toMatchObject({
      id: DEFAULT_PERFORMANCE_PADS[0].id,
      presetId: null,
      actionId: null,
      label: 'Keep My Label',
      color: '#123456',
      keyBinding: '9',
      position: 17,
    })
  })

  it('removes Neon automation and preserves unrelated automation byte-for-byte', () => {
    const fixture = makeMigrationFixture()
    const safeCue = fixture.presetAutomationCuesByTrackId.trackA[2]
    const migrated = migrateReactStore(fixture, 36)
    const cues = (migrated.presetAutomationCuesByTrackId as Record<string, Array<Record<string, unknown>>>).trackA
    expect(cues).toEqual([safeCue])
  })

  it('preserves track sections while neutralizing only the retired engine assignment', () => {
    const migrated = migrateReactStore(makeMigrationFixture(), 36)
    const section = (migrated.manualTrackSectionsByTrackId as Record<string, Array<Record<string, unknown>>>).trackA[0]
    expect(section).toMatchObject({
      id: 'section-1', label: 'Drop', startSec: 12, endSec: 42,
      intensity: 0.9, source: 'manual', confidence: 0.88,
    })
    expect(section).not.toHaveProperty('engineId')
  })

  it('drops only the retired Brand Kit engine rule', () => {
    expect(normalizeBrandKitEngineRules({
      neonLattice: { mode: 'brand', strength: 0.8 },
      oscilloscope: { mode: 'hybrid', strength: 0.6 },
      laserDmx: { mode: 'brand', strength: 0.7, preserveTriggerSemantics: true },
    })).toEqual({
      oscilloscope: { mode: 'hybrid', strength: 0.6 },
      laserDmx: { mode: 'brand', strength: 0.7, preserveTriggerSemantics: true },
    })
  })

  it('removes stale Neon favorites and preserves remaining favorite order', () => {
    writeReactPresetFavorites([
      NEON_PRESET_ID,
      NON_NEON_PRESET.id,
      'custom-sound-drawing',
      'missing-preset',
    ])
    mergeReactStoreState(makeMigrationFixture(), useReactStore.getState())
    expect(readReactPresetFavorites()).toEqual([NON_NEON_PRESET.id, 'custom-sound-drawing'])
  })

  it('sanitizes malformed current-version imported state', () => {
    const imported = {
      ...makeMigrationFixture(),
      activeReactPresetId: NEON_PRESET_ID,
      activeReactEngineId: 'neonLattice',
      neonLatticePreviewState: { lane: 3 },
    }
    const sanitized = migrateReactStore(imported, 37)
    expect(sanitized.activeReactPresetId).toBe('preset-dream-gate')
    expect(sanitized).not.toHaveProperty('neonLatticePreviewState')
    expect(sanitized).not.toHaveProperty('neonLatticeSettings')
  })

  it('does not invent a selection when sanitizing an unrelated partial import', () => {
    const sanitized = sanitizeRetiredNeonLatticeReactState({ reactIntensity: 0.42 })
    expect(sanitized).toEqual({ reactIntensity: 0.42 })
  })

  it('is idempotent', () => {
    const once = sanitizeRetiredNeonLatticeReactState(makeMigrationFixture())
    const twice = sanitizeRetiredNeonLatticeReactState(once)
    expect(twice).toEqual(once)
  })

  it('can persist and hydrate repeatedly without retired Neon data returning', () => {
    const migrated = migrateReactStore(makeMigrationFixture(), 36)
    const hydrated = mergeReactStoreState(migrated, useReactStore.getState())
    const persistedAgain = reactStorePartialize(hydrated) as Record<string, unknown>
    const hydratedAgain = mergeReactStoreState(
      migrateReactStore(persistedAgain, 37),
      useReactStore.getState(),
    )
    const persistedTwice = reactStorePartialize(hydratedAgain) as Record<string, unknown>
    const serialized = JSON.stringify(persistedTwice)

    expect(serialized).not.toContain('neonLattice')
    for (const presetId of RETIRED_NEON_LATTICE_BUILT_IN_PRESET_IDS) {
      expect(serialized).not.toContain(presetId)
    }
    expect(persistedTwice.activeReactEngineId).toBe('cinematicPortal')
    expect(persistedTwice.activeReactPresetId).toBe('preset-dream-gate')
  })
})
