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

function selected(base: PixGridState, layerId: string): PixGridState {
  return {
    ...base,
    editor: { ...base.editor, selectedLayerId: layerId },
  }
}

describe('PixGrid Marquee semantic Edit Target visualization', () => {
  it('resolves exact nonempty source-alpha membership for every canonical target', () => {
    const base = state()
    expect(base.layers).toHaveLength(12)

    for (const layer of base.layers) {
      const targetState = selected(base, layer.id)
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

  it('does not change compositor output or saved layer content when selection changes', () => {
    const base = state()
    const before = composePixGridLogicalFrame(PRESET, base, frame()).pixels
    const selectedPerimeter = selected(base, 'marquee-bulbs-a')
    const after = composePixGridLogicalFrame(PRESET, selectedPerimeter, frame()).pixels

    expect(after).toEqual(before)
    expect(selectedPerimeter.layers).toEqual(base.layers)
    expect(resolvePixGridSemanticTargetCells(selectedPerimeter, 0).length).toBeGreaterThan(0)
  })

  it('stays disabled for unrelated presets and nonexistent targets', () => {
    const base = state()
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
