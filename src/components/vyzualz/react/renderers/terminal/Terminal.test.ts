import { describe, expect, it } from 'vitest'
import { createSharedPerformanceFallbackContext } from '../../../../../features/performanceCore'
import { normalizeCanvasPresetSettings } from '../../../../../stores/reactStore'
import { CANVAS_PRESET_BY_ID, CANVAS_VISIBLE_PRESETS } from '../../ReactTypes'
import { resolveCanvasPresetProvenance } from '../../canvasPerformance/CanvasPresetProvenance'
import { TerminalPerformance } from './TerminalPerformance'
import { DEFAULT_CANVAS_TERMINAL_SETTINGS as defaults, isTerminalClean, normalizeCanvasTerminalSettings, resolveTerminalGrid, resolveTerminalPlan } from './TerminalSettings'

describe('Terminal', () => {
  it('registers one visible preset, migrates older recipes and tracks modifications', () => {
    expect(CANVAS_VISIBLE_PRESETS.filter(preset => preset.id === 'canvas-terminal')).toHaveLength(1)
    const saved = normalizeCanvasPresetSettings({ schemaVersion: 17, cellular: { amount: 0.2 } })
    expect(saved.cellular.amount).toBe(0.2)
    expect(saved.terminal).toEqual(defaults)
    const preset = CANVAS_PRESET_BY_ID['canvas-terminal']
    const exact = normalizeCanvasPresetSettings(preset.settings)
    expect(resolveCanvasPresetProvenance(preset, exact).status).toBe('exact')
    expect(resolveCanvasPresetProvenance(preset, { ...exact, terminal: { ...defaults, family: 'numbers' } }).status).toBe('modified')
  })

  it('validates enums and ranges and bounds the glyph grid for aspect extremes', () => {
    expect(normalizeCanvasTerminalSettings({ family: 'other', color: '#AA00FF', cellSize: 2, glow: Infinity, seed: -2 }))
      .toEqual({ ...defaults, color: '#aa00ff', cellSize: 4, seed: 0 })
    expect(isTerminalClean({ ...defaults, sourceMix: 1, glow: 1 })).toBe(true)
    expect(resolveTerminalPlan('auto', 3840, 2160)).toEqual({ columns: 96, rows: 72, outputEdge: 960 })
    expect(resolveTerminalGrid(40000, 8, 4, 96, 72)).toEqual({ columns: 96, rows: 1 })
    expect(resolveTerminalGrid(8, 40000, 4, 96, 72)).toEqual({ columns: 1, rows: 72 })
  })

  it('locks the authored family by default and qualifies phrase changes independently from BPM sync', () => {
    const driver = new TerminalPerformance()
    const base = createSharedPerformanceFallbackContext(2)
    const context = { ...base, phraseIndex: 2, absoluteBeat: 16,
      capabilities: { ...base.capabilities, beatGrid: true }, confidence: { ...base.confidence, grid: 1, phrase: 1 } }
    expect(driver.update({ ...defaults, bpmSync: true }, context, 2, 0, false, true)).toMatchObject({ family: 0, epoch: 4 })
    expect(driver.update({ ...defaults, autoPerformance: true }, context, 2, 0, false, true)).toMatchObject({ family: 1, epoch: 1 })
    expect(driver.update({ ...defaults, bpmSync: true, audioReactivity: 0 }, context, 2, 0, false, true)).toMatchObject({ family: 0, epoch: 4, brightness: 0 })
    expect(driver.update({ ...defaults, bpmSync: true }, base, 2, 0, false, true).epoch).toBe(1)
  })

  it('deduplicates repeated hits and reconstructs after a seek without firing an accent', () => {
    const driver = new TerminalPerformance()
    const base = createSharedPerformanceFallbackContext(0)
    const update = (time: number, kick: boolean, paused = false, identity = 'current') => driver.update(defaults, {
      ...base, audioTimeSec: time, runtimeIdentity: identity, kick, kickStrength: 1,
      boundaries: { ...base.boundaries, timingDiscontinuity: false },
      confidence: { ...base.confidence, rhythm: 1 }, capabilities: { ...base.capabilities, rhythmEvents: true },
    }, time, 0.04, paused, true)
    expect(update(0, true).brightness).toBe(0)
    update(0.04, false)
    const hit = update(0.08, true)
    expect(hit.brightness).toBeGreaterThan(0)
    expect(update(0.12, true).brightness).toBeLessThan(hit.brightness)
    expect(update(0.12, true, true)).toEqual(update(0.12, true, true))
    expect(update(2, true, true, 'seek')).toMatchObject({ brightness: 0, epoch: 1 })
  })
})
