import { describe, expect, it } from 'vitest'
import { createPixGridSelection, pixGridRectanglePoints } from '../PixGridAuthoring'
import { createSilentPixGridAudioFrame, PixGridReactionRuntime } from '../PixGridAudioRouting'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState, DEFAULT_PIX_GRID_PRESET_ID } from '../PixGridDefaults'
import { applyPixGridGroupFrameEffects } from '../PixGridFrameEffects'
import { PixGridFrameGroupCompiler } from '../PixGridGroupCompiler'
import { createDefaultPixGridReactionAssignment, createPixGridGroup } from '../PixGridGroups'
import { applyPixGridGroupReactions } from '../PixGridReactions'
import { applyPixGridPresetSettings } from '../PixGridState'
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
  sanitizeRetiredPixGridMarqueeState,
} from '../PixGridRetiredPresetMigration'
import type { PixGridGroup } from '../PixGridTypes'
import { normalizePixGridPresetSettings, normalizePixGridState } from '../PixGridValidation'

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

describe('PixGrid Marquee renderer residue removal Stage 4', () => {
  it('removes Marquee-only renderer branches and the backdrop preservation channel', () => {
    const rendererSources = {
      ...import.meta.glob('../PixGridFrameEffects.ts', { eager: true, import: 'default', query: '?raw' }),
      ...import.meta.glob('../PixGridReactions.ts', { eager: true, import: 'default', query: '?raw' }),
      ...import.meta.glob('../PixGridGroupCompiler.ts', { eager: true, import: 'default', query: '?raw' }),
      ...import.meta.glob('../PixGridCompositor.ts', { eager: true, import: 'default', query: '?raw' }),
    } as Record<string, string>
    const source = Object.values(rendererSources).join('\n')

    expect(source).not.toMatch(/(?:startsWith|includes)\(['"]marquee-/u)
    expect(source).not.toContain('marquee-structure')
    expect(source).not.toContain('preservesComposedBackdrop')
    expect(source).not.toContain('captureLayerBackdrop')
    expect(source).not.toContain('restoreBackdrop')
    expect(source).not.toContain('backdropSourceBuffers')
    expect(source).not.toContain('backdropPixels')
    expect(source).toContain('restorePixels')
    expect(source).toContain("'canonical'")
    expect(source).toContain("'rendered'")
  })

  it('keeps supported preset, program, asset, and animation-clock contracts free of retired values', () => {
    const state = createDefaultPixGridState()
    const withRetiredClock = normalizePixGridState({
      ...state,
      layers: state.layers.map((layer, index) => index === 0
        ? { ...layer, animations: [{ ...layer.animations[0], clock: 'sign' }] }
        : layer),
    })

    expect(withRetiredClock.layers[0]?.animations[0]?.clock).toBeUndefined()
    const normalizedPreset = normalizePixGridPresetSettings({
      pattern: 'neonMarqueeCycle',
      performanceProgramId: RETIRED_PIX_GRID_MARQUEE_PERFORMANCE_PROGRAM_ID,
    })
    expect(normalizedPreset?.pattern).toBe('bassBeacon')
    expect(normalizedPreset).not.toHaveProperty('performanceProgramId')
    expect(PIX_GRID_PERFORMANCE_PROGRAM_BY_ID.has(RETIRED_PIX_GRID_MARQUEE_PERFORMANCE_PROGRAM_ID as never)).toBe(false)
    expect(PIX_GRID_BUILT_IN_ASSETS.some(asset => asset.id.startsWith('pix-neon-marquee-'))).toBe(false)
  })

  it('renders every remaining built-in preset with canonical group membership intact', () => {
    const frame = createSilentPixGridAudioFrame({ isPlaying: true, audioTime: 8, beatIndex: 16, barIndex: 4 })
    for (const presetId of REMAINING_PRESET_IDS) {
      const preset = PIX_GRID_PRESET_BY_ID.get(presetId)!
      const state = applyPixGridPresetSettings(createDefaultPixGridState(), preset.id, preset.pixGridSettings)
      const compiler = new PixGridFrameGroupCompiler()
      const logical = composePixGridLogicalFrame(preset, state, frame, undefined, undefined, undefined, null, [], compiler)
      const activeCells = logical.pixels.reduce((count, value, index) => count + (index % 4 === 3 && value > 0 ? 1 : 0), 0)

      expect(activeCells, presetId).toBeGreaterThan(0)
      const canonicalGroupCounts = state.groups.map(group => compiler.compile(group, 'canonical').cellCount)
      expect(canonicalGroupCounts.some(count => count > 0), presetId).toBe(true)
      expect(compiler.compiledGroupIds.length, presetId).toBeGreaterThan(0)
    }
  })

  it('keeps generic frame effects, audio reactions, and Smart Group recruitment functional', () => {
    const runs = [[0, 0, 1]] as PixGridGroup['cellRuns']
    const reaction = {
      ...createDefaultPixGridReactionAssignment(),
      id: 'synthetic-bass-brightness',
      source: 'bass' as const,
      target: 'brightness' as const,
      amount: 1,
      blend: 'add' as const,
      attack: 0,
      hold: 0,
      release: 0,
      smoothing: 0,
    }
    const group: PixGridGroup = {
      ...createPixGridGroup({ name: 'Synthetic Group', source: 'manualSelection', mask: { kind: 'runs', runs }, runs }),
      id: 'synthetic-group',
      cellRuns: [...runs],
      mask: { kind: 'runs', runs: [...runs] },
      reactions: [reaction],
    }
    const frame = createSilentPixGridAudioFrame({ isPlaying: true, bass: 1, sourceValues: { bass: 1 } })
    const pixels = new Uint8Array([80, 80, 80, 255, 40, 40, 40, 255])

    applyPixGridGroupFrameEffects(pixels, 2, 1, [group], [{
      id: 'synthetic-opacity',
      groupId: group.id,
      kind: 'opacity',
      source: 'manual',
      stage: 'manual',
      priority: 0,
      amount: 0.5,
      blend: 'replace',
    }], PIX_GRID_PRESET_BY_ID.get('pix-grid-bass-beacon')!.palette, frame)
    expect(pixels[3]).toBe(128)
    expect(pixels[7]).toBe(255)

    applyPixGridGroupReactions(
      pixels,
      2,
      1,
      [group],
      frame,
      new PixGridReactionRuntime(),
      PIX_GRID_PRESET_BY_ID.get('pix-grid-bass-beacon')!.palette,
    )
    expect(pixels[0]).toBeGreaterThan(80)
    expect(pixels[4]).toBe(40)

    const sourceGroup: PixGridGroup = {
      ...group,
      id: 'synthetic-layer-alpha',
      layerId: 'synthetic-layer',
      layerScope: ['synthetic-layer'],
      source: 'layerAlpha',
      cellRuns: [],
      mask: { kind: 'layerAlpha', threshold: 0.01, foreground: true },
      reactions: [],
    }
    const compiler = new PixGridFrameGroupCompiler()
    compiler.beginFrame([sourceGroup], 2, 1, new Set(['synthetic-layer']))
    compiler.recordPixel('synthetic-layer', 0, [12, 34, 56], 1, 'canonical')
    expect(compiler.compile(sourceGroup, 'rendered').cellCount).toBe(0)
    const canonical = compiler.compile(sourceGroup, 'canonical')
    expect(canonical.cellCount).toBe(1)
    const recruited = new Uint8Array(8)
    expect(compiler.restorePixels(sourceGroup, recruited, canonical.bits)).toBe(1)
    expect([...recruited.slice(0, 4)]).toEqual([12, 34, 56, 255])
  })

  it('retires old Marquee state instead of passing it into generic canonical graph repair', () => {
    const oldState = {
      ...createDefaultPixGridState(),
      selectedPresetId: RETIRED_PIX_GRID_MARQUEE_PRESET_ID,
      configuration: {
        ...createDefaultPixGridState().configuration,
        sourcePresetId: RETIRED_PIX_GRID_MARQUEE_PRESET_ID,
      },
      layers: [{
        ...createDefaultPixGridState().layers[0],
        id: 'marquee-structure',
        assetId: 'pix-neon-marquee-structure',
        frameSource: { kind: 'asset', assetId: 'pix-neon-marquee-structure' },
      }],
    }
    const retired = sanitizeRetiredPixGridMarqueeState(oldState)
    const migrationSource = Object.values(import.meta.glob('../PixGridStateMigration.ts', {
      eager: true,
      import: 'default',
      query: '?raw',
    }) as Record<string, string>).join('\n')

    expect(retired.selectedPresetId).toBe(DEFAULT_PIX_GRID_PRESET_ID)
    expect(retired.layers.some(layer => layer.id.startsWith('marquee-'))).toBe(false)
    expect(migrationSource).not.toContain(RETIRED_PIX_GRID_MARQUEE_PRESET_ID)
    expect(migrationSource).not.toContain('marquee-structure')
    expect(migrationSource).not.toContain('pix-neon-marquee-')
  })

  it('leaves rectangular Marquee Selection authoring untouched', () => {
    expect(createPixGridSelection({ x: 5, y: 7 }, { x: 2, y: 3 })).toEqual({ x: 2, y: 3, width: 4, height: 5 })
    expect(pixGridRectanglePoints({ x: 2, y: 3 }, { x: 5, y: 7 })).toContainEqual({ x: 5, y: 7 })
  })
})
