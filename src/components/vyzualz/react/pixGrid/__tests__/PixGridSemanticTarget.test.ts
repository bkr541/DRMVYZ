import { describe, expect, it } from 'vitest'
import { samplePixGridBuiltInAsset } from '../PixGridArtwork'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import {
  isPixGridSemanticTargetActive,
  resolvePixGridSemanticTargetCells,
} from '../PixGridSemanticTarget'
import { applyPixGridPresetSettings } from '../PixGridState'
import { normalizePixGridState } from '../PixGridValidation'
import type { PixGridAudioFrame, PixGridState } from '../PixGridTypes'

const PRESET_ID = 'pix-grid-neon-marquee-cycle'
const PRESET = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!

function state(): PixGridState {
  return applyPixGridPresetSettings(createDefaultPixGridState(), PRESET_ID, PRESET.pixGridSettings)
}

function frame(): PixGridAudioFrame {
  return {
    audioTime: 4,
    bass: 0,
    mid: 0,
    high: 0,
    volume: 0,
    beatHit: false,
    beatPhase: 0,
    isPlaying: true,
    beatIndex: 8,
    barIndex: 2,
    beatsSinceSectionStart: 8,
    barsSinceSectionStart: 2,
    sectionType: 'verse',
    motionClockSectionType: 'verse',
    motionClockSectionBeat: 8,
    motionClockSectionBar: 2,
    motionClockSectionProgress: 0.25,
    sectionProgress: 0.25,
    signClock: 0.25,
    motionClockSign: 0.25,
    transportState: 'playing',
    autoPerformanceEnabled: false,
    sourceValues: {},
  }
}

function selected(base: PixGridState, layerId: string, authoringOverlayVisible = base.authoringOverlayVisible): PixGridState {
  return {
    ...base,
    authoringOverlayVisible,
    editor: { ...base.editor, selectedLayerId: layerId },
  }
}

describe('PixGrid Marquee semantic Edit Target visualization', () => {
  it('requires the intentional authoring overlay even when a semantic layer remains selected', () => {
    const base = selected(state(), 'marquee-bulbs-a', false)

    expect(isPixGridSemanticTargetActive(base)).toBe(false)
    expect(resolvePixGridSemanticTargetCells(base, 0)).toEqual([])

    const preview = { ...base, authoringOverlayVisible: true }
    expect(isPixGridSemanticTargetActive(preview)).toBe(true)
    expect(resolvePixGridSemanticTargetCells(preview, 0).length).toBeGreaterThan(0)

    const closedAgain = { ...preview, authoringOverlayVisible: false }
    expect(closedAgain.editor.selectedLayerId).toBe('marquee-bulbs-a')
    expect(isPixGridSemanticTargetActive(closedAgain)).toBe(false)
    expect(resolvePixGridSemanticTargetCells(closedAgain, 0)).toEqual([])
  })

  it('resolves exact nonempty source-alpha membership for every canonical target while authoring is open', () => {
    const base = state()
    expect(base.layers).toHaveLength(12)

    for (const layer of base.layers) {
      const targetState = selected(base, layer.id, true)
      expect(isPixGridSemanticTargetActive(targetState), layer.id).toBe(true)
      const cells = resolvePixGridSemanticTargetCells(targetState, 0)
      expect(cells.length, layer.id).toBeGreaterThan(0)
      const resolved = new Set(cells.map(cell => `${cell.x}:${cell.y}`))

      for (let y = 0; y < base.matrixHeight; y += 1) {
        for (let x = 0; x < base.matrixWidth; x += 1) {
          const sample = samplePixGridBuiltInAsset(
            layer.assetId,
            (x + 0.5) / base.matrixWidth,
            (y + 0.5) / base.matrixHeight,
            0,
            layer.seed,
          )
          expect(resolved.has(`${x}:${y}`), `${layer.id}:${x}:${y}`).toBe(sample.alpha > 0)
        }
      }
    }
  })

  it('does not change compositor output or saved layer content when selection or preview visibility changes', () => {
    const base = state()
    const before = composePixGridLogicalFrame(PRESET, base, frame()).pixels
    const selectedPerimeter = selected(base, 'marquee-bulbs-a', false)
    const previewPerimeter = { ...selectedPerimeter, authoringOverlayVisible: true }
    const selectedOutput = composePixGridLogicalFrame(PRESET, selectedPerimeter, frame()).pixels
    const previewOutput = composePixGridLogicalFrame(PRESET, previewPerimeter, frame()).pixels

    expect(selectedOutput).toEqual(before)
    expect(previewOutput).toEqual(before)
    expect(selectedPerimeter.layers).toEqual(base.layers)
    expect(resolvePixGridSemanticTargetCells(selectedPerimeter, 0)).toEqual([])
    expect(resolvePixGridSemanticTargetCells(previewPerimeter, 0).length).toBeGreaterThan(0)
  })

  it('keeps hydrated selected-layer state separate from preview visibility', () => {
    const selectedClosed = selected(state(), 'marquee-bulbs-a', false)
    const hydrated = normalizePixGridState(JSON.parse(JSON.stringify(selectedClosed)))

    expect(hydrated.editor.selectedLayerId).toBe('marquee-bulbs-a')
    expect(hydrated.authoringOverlayVisible).toBe(false)
    expect(isPixGridSemanticTargetActive(hydrated)).toBe(false)
    expect(resolvePixGridSemanticTargetCells(hydrated, 0)).toEqual([])
  })

  it('stays disabled for unrelated presets and nonexistent targets', () => {
    const base = selected(state(), 'marquee-bulbs-a', true)
    expect(isPixGridSemanticTargetActive({
      ...base,
      selectedPresetId: 'pix-grid-bass-beacon',
    })).toBe(false)
    expect(resolvePixGridSemanticTargetCells({
      ...base,
      editor: { ...base.editor, selectedLayerId: 'missing-target' },
    }, 0)).toEqual([])
  })
})
