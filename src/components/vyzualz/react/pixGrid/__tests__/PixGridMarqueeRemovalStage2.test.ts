import { describe, expect, it } from 'vitest'
import { PIX_GRID_BUILT_IN_ASSETS, PIX_GRID_BUILT_IN_ASSET_BY_ID } from '../PixGridArtwork'
import { PIX_GRID_MEDIA_DECK_PERFORMANCE_PROGRAM } from '../PixGridDeckPerformanceProgram'
import {
  PIX_GRID_DEFAULT_PROGRAM_BY_PRESET_ID,
  PIX_GRID_PERFORMANCE_PROGRAMS,
  PIX_GRID_PERFORMANCE_PROGRAM_BY_ID,
  PIX_GRID_PRESET_ID_BY_PROGRAM,
} from '../PixGridPerformancePrograms'
import { PIX_GRID_PRESET_BY_ID, PIX_GRID_PRESET_IDS, PIX_GRID_PRESETS } from '../PixGridPresets'
import {
  RETIRED_PIX_GRID_MARQUEE_PERFORMANCE_PROGRAM_ID,
  RETIRED_PIX_GRID_MARQUEE_PRESET_ID,
  isRetiredPixGridMarqueeState,
} from '../PixGridRetiredPresetMigration'
import { normalizePixGridPresetSettings } from '../PixGridValidation'

const REMAINING_PRESET_IDS = [
  'pix-grid-bass-beacon',
  'pix-grid-geometric-reactor',
  'pix-grid-pixel-parade',
] as const

const REMAINING_PROGRAM_IDS = [
  'pix-grid-bass-beacon-performance',
  'pix-grid-geometric-reactor-performance',
  'pix-grid-pixel-parade-performance',
  'pix-grid-media-deck-performance',
] as const

describe('PixGrid Marquee removal Stage 2', () => {
  it('removes the retired preset while preserving every remaining built-in preset', () => {
    expect(PIX_GRID_PRESET_IDS).toEqual(REMAINING_PRESET_IDS)
    expect(PIX_GRID_PRESETS.map(preset => preset.id)).toEqual(REMAINING_PRESET_IDS)
    expect(PIX_GRID_PRESET_BY_ID.has(RETIRED_PIX_GRID_MARQUEE_PRESET_ID)).toBe(false)
    expect([...PIX_GRID_PRESET_BY_ID.keys()]).toEqual(REMAINING_PRESET_IDS)
  })

  it('removes the dedicated program and both registry mappings', () => {
    expect(PIX_GRID_PERFORMANCE_PROGRAMS.map(program => program.id)).toEqual(REMAINING_PROGRAM_IDS)
    expect(PIX_GRID_PERFORMANCE_PROGRAM_BY_ID.has(RETIRED_PIX_GRID_MARQUEE_PERFORMANCE_PROGRAM_ID as never)).toBe(false)
    expect(PIX_GRID_DEFAULT_PROGRAM_BY_PRESET_ID).not.toHaveProperty(RETIRED_PIX_GRID_MARQUEE_PRESET_ID)
    expect(PIX_GRID_PRESET_ID_BY_PROGRAM).not.toHaveProperty(RETIRED_PIX_GRID_MARQUEE_PERFORMANCE_PROGRAM_ID)
  })

  it('removes the active pattern and all Marquee artwork IDs', () => {
    expect(normalizePixGridPresetSettings({ pattern: 'neonMarqueeCycle' })?.pattern).toBe('bassBeacon')
    expect(PIX_GRID_BUILT_IN_ASSETS.some(asset => asset.id.startsWith('pix-neon-marquee-'))).toBe(false)
    expect([...PIX_GRID_BUILT_IN_ASSET_BY_ID.keys()].some(id => id.startsWith('pix-neon-marquee-'))).toBe(false)
  })

  it('deletes the dedicated embedded modules and leaves no active imports behind', () => {
    const pixGridSourceModules = import.meta.glob('../PixGrid*.ts', {
      eager: true,
      import: 'default',
      query: '?raw',
    }) as Record<string, string>

    const deletedModuleNames = [
      'PixGridNeonMarqueeFrames.ts',
      'PixGridNeonMarqueeMasks.ts',
      'PixGridNeonMarqueeGroups.ts',
      'PixGridNeonMarqueeAudioOwnership.ts',
    ]
    for (const moduleName of deletedModuleNames) {
      expect(Object.keys(pixGridSourceModules).some(path => path.endsWith(`/${moduleName}`))).toBe(false)
    }

    for (const source of Object.values(pixGridSourceModules)) {
      expect(source).not.toMatch(/from ['"].*PixGridNeonMarquee(?:Frames|Masks|Groups|AudioOwnership)['"]/u)
    }
  })

  it('keeps Deck frame ownership intact without a Marquee compatibility asset', () => {
    const deckBindingTargets = PIX_GRID_MEDIA_DECK_PERFORMANCE_PROGRAM.bindings.map(binding => binding.target.id)
    expect(deckBindingTargets.length).toBeGreaterThan(0)
    expect(JSON.stringify(PIX_GRID_MEDIA_DECK_PERFORMANCE_PROGRAM)).not.toContain('pix-neon-marquee-')
  })

  it('keeps the Stage 1 tombstone able to identify legacy state', () => {
    expect(isRetiredPixGridMarqueeState({
      selectedPresetId: RETIRED_PIX_GRID_MARQUEE_PRESET_ID,
      performance: { sharedPerformanceProgramId: RETIRED_PIX_GRID_MARQUEE_PERFORMANCE_PROGRAM_ID },
    })).toBe(true)
  })
})
