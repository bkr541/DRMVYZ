import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createDefaultPixGridState } from '../PixGridDefaults'
import {
  compilePixGridGroupMask,
  createDefaultPixGridReactionAssignment,
  createPixGridConnectedRegionGroups,
  createPixGridDominantColorGroups,
  createPixGridGeometricGroups,
  createPixGridGroup,
  createPixGridLuminanceGroups,
  createPixGridLayerAlphaGroup,
  createPixGridSelectionGroup,
} from '../PixGridGroups'
import { MAX_PIX_GRID_ACTIVE_GROUPS } from '../PixGridLimits'
import { applyPixGridGroupReactions } from '../PixGridReactions'
import { createSilentPixGridAudioFrame, PixGridReactionRuntime } from '../PixGridAudioRouting'
import { normalizePixGridState } from '../PixGridValidation'
import { buildPixGridMaskAtlas } from '../../renderers/pixGrid/PixGridGpuMasks'
import type { ReactPalette } from '../../ReactTypes'
import type { PixGridGroup, PixGridReactionTarget } from '../PixGridTypes'

const PALETTE: ReactPalette = {
  primary: '#00ffff', secondary: '#00ff88', accent: '#ff00ff', background: '#000000', highlight: '#ffffff', text: '#ffffff',
}

function source(width = 8, height = 8) {
  const pixels = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const left = x < width / 2
      pixels[offset] = left ? 240 : 10
      pixels[offset + 1] = left ? 20 : 30
      pixels[offset + 2] = left ? 20 : 230
      pixels[offset + 3] = y === height - 1 ? 0 : 255
    }
  }
  return { width, height, pixels }
}

function reactionGroup(input: { id: string; priority: number; overlap: PixGridGroup['overlapBehavior']; target: PixGridReactionTarget; color?: string }): PixGridGroup {
  const assignment = {
    ...createDefaultPixGridReactionAssignment(),
    id: `${input.id}-reaction`,
    source: 'bass' as const,
    target: input.target,
    amount: 1,
    blend: 'replace' as const,
    color: input.color,
    attack: 0,
    hold: 0,
    release: 0,
    smoothing: 0,
  }
  return {
    ...createPixGridGroup({ name: input.id, source: 'manualSelection', mask: { kind: 'runs', runs: [[0, 0, 2]] }, priority: input.priority }),
    id: input.id,
    priority: input.priority,
    overlapBehavior: input.overlap,
    reactions: [assignment],
  }
}

describe('PixGrid smart groups and compiled masks', () => {
  it('compiles selection and geometric masks into compact bitsets and row runs', () => {
    const selection = createPixGridSelectionGroup({ x: 2, y: 1, width: 3, height: 2 }, 8, 8, null)
    const compiled = compilePixGridGroupMask(selection, 8, 8)
    expect(compiled.cellCount).toBe(6)
    expect(compiled.runs).toEqual([[1, 2, 3], [2, 2, 3]])
    expect(compiled.bits.byteLength).toBeLessThan(8 * 8)

    const [border] = createPixGridGeometricGroups('border', 8, 8, null)
    const [checkerA, checkerB] = createPixGridGeometricGroups('checkerboardA', 8, 8, null)
    expect(compilePixGridGroupMask(border, 8, 8).cellCount).toBe(28)
    expect(compilePixGridGroupMask(checkerA, 8, 8).cellCount + compilePixGridGroupMask(checkerB, 8, 8).cellCount).toBe(64)
  })

  it('creates bounded dominant-color, luminance, and connected-region groups during preparation', () => {
    const pixels = source()
    const colors = createPixGridDominantColorGroups(pixels, 'layer-a', 4)
    const luminance = createPixGridLuminanceGroups(pixels, 'layer-a', 3)
    const layerAlpha = createPixGridLayerAlphaGroup(pixels, 'layer-a')
    const regions = createPixGridConnectedRegionGroups(pixels, 'layer-a', { maxRegions: 8, maxCells: 5, colorTolerance: 0.05 })
    expect(colors.length).toBeGreaterThanOrEqual(2)
    expect(layerAlpha?.source).toBe('layerAlpha')
    expect(layerAlpha && compilePixGridGroupMask(layerAlpha, 8, 8).cellCount).toBe(56)
    expect(luminance.length).toBeGreaterThan(0)
    expect(luminance.length).toBeLessThanOrEqual(3)
    expect(regions.length).toBeGreaterThan(0)
    expect(Math.max(...regions.map(group => compilePixGridGroupMask(group, 8, 8).cellCount))).toBeLessThanOrEqual(5)
  })

  it('applies deterministic priority and overlap rules', () => {
    const high = reactionGroup({ id: 'high', priority: 10, overlap: 'exclusive', target: 'color', color: '#ff0000' })
    const low = reactionGroup({ id: 'low', priority: 0, overlap: 'stack', target: 'color', color: '#0000ff' })
    const pixels = new Uint8Array([80, 80, 80, 255, 80, 80, 80, 255])
    applyPixGridGroupReactions(pixels, 2, 1, [low, high], createSilentPixGridAudioFrame({ bass: 1, isPlaying: true }), new PixGridReactionRuntime(), PALETTE)
    expect([...pixels.slice(0, 3)]).toEqual([255, 0, 0])

    const stacked = new Uint8Array([80, 80, 80, 255, 80, 80, 80, 255])
    applyPixGridGroupReactions(stacked, 2, 1, [{ ...high, overlapBehavior: 'stack' }, low], createSilentPixGridAudioFrame({ bass: 1, isPlaying: true }), new PixGridReactionRuntime(), PALETTE)
    expect([...stacked.slice(0, 3)]).toEqual([0, 0, 255])
  })

  it('skips layer-scoped reactions when their layer is not active', () => {
    const scoped = { ...reactionGroup({ id: 'scoped', priority: 1, overlap: 'stack', target: 'color', color: '#ff0000' }), layerId: 'layer-a', layerScope: ['layer-a'] }
    const hiddenPixels = new Uint8Array([80, 80, 80, 255, 80, 80, 80, 255])
    applyPixGridGroupReactions(hiddenPixels, 2, 1, [scoped], createSilentPixGridAudioFrame({ bass: 1, isPlaying: true }), new PixGridReactionRuntime(), PALETTE, null, new Set(['layer-b']))
    expect([...hiddenPixels.slice(0, 3)]).toEqual([80, 80, 80])

    const visiblePixels = new Uint8Array(hiddenPixels)
    applyPixGridGroupReactions(visiblePixels, 2, 1, [scoped], createSilentPixGridAudioFrame({ bass: 1, isPlaying: true }), new PixGridReactionRuntime(), PALETTE, null, new Set(['layer-a']))
    expect([...visiblePixels.slice(0, 3)]).toEqual([255, 0, 0])
  })

  it('packs active masks into a bounded four-channel GPU atlas', () => {
    const groups = Array.from({ length: MAX_PIX_GRID_ACTIVE_GROUPS + 8 }, (_, index) => ({
      ...createPixGridSelectionGroup({ x: index % 8, y: 0, width: 1, height: 8 }, 8, 8, null),
      id: `group-${index}`,
      priority: index,
    }))
    const atlas = buildPixGridMaskAtlas(groups, 8, 8)
    expect(atlas.groupCount).toBe(MAX_PIX_GRID_ACTIVE_GROUPS)
    expect(atlas.height).toBe(8 * Math.ceil(MAX_PIX_GRID_ACTIVE_GROUPS / 4))
    expect(atlas.pixels.byteLength).toBe(8 * atlas.height * 4)
  })

  it('reproduces seeded sparkle and displacement at the same musical identity', () => {
    const base = reactionGroup({ id: 'seeded', priority: 1, overlap: 'stack', target: 'sparkle' })
    base.cellRuns = [[0, 0, 8], [1, 0, 8], [2, 0, 8], [3, 0, 8]]
    base.mask = { kind: 'runs', runs: base.cellRuns }
    base.reactions[0] = { ...base.reactions[0], amount: 1 }
    const frame = createSilentPixGridAudioFrame({ bass: 1, isPlaying: true, trackIdentity: 'track-a', sectionOccurrence: 2, barIndex: 9, beatIndex: 36 })
    const first = new Uint8Array(8 * 4 * 4).fill(80)
    const second = new Uint8Array(first)
    for (let offset = 3; offset < first.length; offset += 4) first[offset] = second[offset] = 255
    applyPixGridGroupReactions(first, 8, 4, [base], frame, new PixGridReactionRuntime(), PALETTE)
    applyPixGridGroupReactions(second, 8, 4, [base], frame, new PixGridReactionRuntime(), PALETTE)
    expect(second).toEqual(first)

    const displacement = { ...base, reactions: [{ ...base.reactions[0], target: 'pixelDisplacement' as const }] }
    const movedA = new Uint8Array(first)
    const movedB = new Uint8Array(first)
    applyPixGridGroupReactions(movedA, 8, 4, [displacement], frame, new PixGridReactionRuntime(), PALETTE)
    applyPixGridGroupReactions(movedB, 8, 4, [displacement], frame, new PixGridReactionRuntime(), PALETTE)
    expect(movedB).toEqual(movedA)
  })

  it('normalizes legacy and hostile persisted group data into current bounds', () => {
    const normalized = normalizePixGridState({
      ...createDefaultPixGridState(),
      version: 5,
      groups: [{ id: 'legacy', name: 'Legacy', layerId: null, cellRuns: [[0, 0, 9999]], smartRuleId: null, reactions: [{ id: 'r', source: 'bogus', target: 'bogus', amount: 99 }] }],
      editor: { selectedGroupId: 'legacy', previewReactionAssignmentId: 'r' },
    })
    expect(normalized.version).toBe(9)
    expect(normalized.groups[0].cellRuns[0][2]).toBe(normalized.matrixWidth)
    expect(normalized.groups[0].reactions[0]).toMatchObject({ source: 'bass', target: 'brightness', amount: 4 })
    expect(normalized.editor.selectedGroupId).toBe('legacy')
  })

  it('uses AudioFeatureBus/shared context instead of a duplicate analyser loop and draws compiled editor masks', () => {
    const surface = readFileSync(new URL('../PixGridSurface.tsx', import.meta.url), 'utf8')
    const overlay = readFileSync(new URL('../PixGridEditorOverlay.tsx', import.meta.url), 'utf8')
    expect(surface).toContain('AudioFeatureBus.getFrame()')
    expect(surface).toContain('buildSharedPerformanceContext')
    expect(surface).not.toContain('getByteFrequencyData')
    expect(overlay).toContain('compilePixGridGroupMask')
    expect(overlay).toContain('group.displayColor')
  })
})
