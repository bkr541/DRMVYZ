// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useMediaStore } from '../../../../../stores/mediaStore'
import { useReactStore } from '../../../../../stores/reactStore'
import { DEFAULT_CANVAS_ORCHESTRATION_SETTINGS } from '../../canvasPerformance'
import { ShiftgridGridRuntime } from './ShiftgridGridState'
import { ShiftgridDesignControls } from './ShiftgridControls'
import { CLEAN_SHIFTGRID_EFFECT_PLAN, resolveShiftgridEffectPlan } from './ShiftgridEffects'
import { buildShiftgridVertexBatch, createShiftgridRenderPlan } from './ShiftgridRenderPlan'
import {
  CANVAS_SHIFTGRID_INSPECTOR_GRID_PRESET_OPTIONS,
  CANVAS_SHIFTGRID_MULTI_MOSAIC_TYPE_OPTIONS,
  CANVAS_SHIFTGRID_PATTERN_OPTIONS,
  CANVAS_SHIFTGRID_POOL_SELECTION_MODE_OPTIONS,
  CANVAS_SHIFTGRID_TRIGGER_OPTIONS,
  DEFAULT_CANVAS_SHIFTGRID_SETTINGS,
  normalizeCanvasShiftgridSettings,
} from './ShiftgridSettings'
import { createShiftgridTileGeometry } from './ShiftgridTileGeometry'

let container: HTMLElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  useReactStore.setState(state => ({
    canvasPresetSettings: { ...state.canvasPresetSettings, shiftgrid: DEFAULT_CANVAS_SHIFTGRID_SETTINGS },
    canvasMediaItems: [],
    canvasOrchestrationSettings: DEFAULT_CANVAS_ORCHESTRATION_SETTINGS,
  }))
  useMediaStore.setState({ items: [] })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function renderControls() {
  await act(async () => root.render(<ShiftgridDesignControls />))
}

function toggle(label: string): HTMLButtonElement {
  const labelNode = [...container.querySelectorAll<HTMLElement>('.rv-ctrl-label')].find(node => node.textContent === label)
  if (!labelNode?.id) throw new Error(`Missing toggle label: ${label}`)
  const button = container.querySelector<HTMLButtonElement>(`button[aria-labelledby="${labelNode.id}"]`)
  if (!button) throw new Error(`Missing toggle: ${label}`)
  return button
}

describe('SHIFTGRID P5 inspector contract', () => {
  it('publishes the requested selector inventories with canonical trigger values', () => {
    expect(CANVAS_SHIFTGRID_INSPECTOR_GRID_PRESET_OPTIONS.map(option => option.value)).toEqual(['auto', '3x3', '4x4', '5x5', '6x6', '8x8', '10x6', '16x9'])
    expect(CANVAS_SHIFTGRID_MULTI_MOSAIC_TYPE_OPTIONS.map(option => option.value)).toEqual(['imageTakeover', 'hybridMosaic', 'travelingImageWave', 'callAndResponse', 'progressiveIdentityReveal', 'autoMosaic'])
    expect(CANVAS_SHIFTGRID_PATTERN_OPTIONS).toHaveLength(8)
    expect(CANVAS_SHIFTGRID_POOL_SELECTION_MODE_OPTIONS.map(option => option.value)).toEqual(['sequential', 'shuffle'])
    expect(CANVAS_SHIFTGRID_TRIGGER_OPTIONS.map(option => [option.value, option.label])).toEqual([
      ['beat', 'Beat'], ['kick', 'Kick'], ['snare', 'Snare'], ['downbeat', 'Downbeat'],
      ['beat2', 'Every 2 Beats'], ['beat4', 'Every 4 Beats'], ['bar', 'Bar'],
      ['bar4', 'Every 4 Bars'], ['bar8', 'Every 8 Bars'], ['phrase', 'Phrase'], ['drop', 'Drop'],
    ])
  })

  it('renders one Design surface and applies conditional Trigger, Mosaic, and effect visibility', async () => {
    await renderControls()
    for (const section of ['Master Controls', 'Design', 'Choreography', 'Effects']) expect(container.textContent).toContain(section)
    expect([...container.querySelectorAll('.rv-ctrl-label')].some(node => node.textContent === 'Trigger')).toBe(true)
    expect(container.textContent).not.toContain('Mosaic Type')
    expect(container.textContent).not.toContain('Edge Glow Strength')

    await act(async () => toggle('Pattern Change').click())
    expect(useReactStore.getState().canvasPresetSettings.shiftgrid.patternChange).toBe(false)
    expect([...container.querySelectorAll('.rv-ctrl-label')].some(node => node.textContent === 'Trigger')).toBe(false)

    const media = [
      { id: 'image-a', name: 'A', type: 'image' as const, objectUrl: 'https://example.test/a.png', mimeType: 'image/png', createdAt: new Date(0).toISOString() },
      { id: 'image-b', name: 'B', type: 'svg' as const, objectUrl: 'https://example.test/b.svg', mimeType: 'image/svg+xml', createdAt: new Date(0).toISOString() },
    ]
    await act(async () => {
      useReactStore.setState({
        canvasMediaItems: media,
        canvasOrchestrationSettings: { ...DEFAULT_CANVAS_ORCHESTRATION_SETTINGS,
          mediaPools: [{ id: 'pool-p5', name: 'P5 Pool', mediaIds: media.map(item => item.id), textItems: [] }],
          activeMediaPoolId: 'pool-p5', mediaPoolIds: media.map(item => item.id) },
      })
      useReactStore.getState().setCanvasPresetSettings({ shiftgrid: {
        ...useReactStore.getState().canvasPresetSettings.shiftgrid,
        sourceMode: 'pool', mosaicType: 'autoMosaic', enhancedEffects: true,
      } })
    })
    expect(container.textContent).toContain('Mosaic Type')
    expect(container.textContent).toContain('Source Selection')
    expect(container.textContent).toContain('Tile Edge Glow')

    await act(async () => toggle('Tile Edge Glow').click())
    expect(container.textContent).toContain('Edge Glow Strength')
    expect(useReactStore.getState().canvasPresetSettings.shiftgrid.tileEdgeGlowEnabled).toBe(true)
    await act(async () => (container.querySelector('[aria-label="Reset SHIFTGRID settings"]') as HTMLButtonElement).click())
    expect(useReactStore.getState().canvasPresetSettings.shiftgrid).toEqual(DEFAULT_CANVAS_SHIFTGRID_SETTINGS)
  })

  it('normalizes persisted P5 settings and migrates legacy effect strengths safely', () => {
    const normalized = normalizeCanvasShiftgridSettings({
      version: 5,
      sourceMode: 'pool',
      poolSelectionMode: 'random',
      enhancedEffects: true,
      edgeGlow: 0.6,
      motionBlur: 0.4,
      chromaticSplit: 0.3,
      tileGap: 4,
    })
    expect(normalized).toMatchObject({ version: 6, sourceMode: 'pool', poolSelectionMode: 'shuffle', mosaicType: 'autoMosaic',
      tileEdgeGlowEnabled: true, motionBlurEnabled: true, rgbSeparationEnabled: true, tileGap: 0.2 })
  })
})

describe('SHIFTGRID P5 rendered effects', () => {
  const allEffects = {
    ...DEFAULT_CANVAS_SHIFTGRID_SETTINGS,
    enhancedEffects: true,
    tileEdgeGlowEnabled: true, edgeGlow: 0.8,
    lightTrailsEnabled: true, lightTrails: 0.7,
    motionBlurEnabled: true, motionBlur: 0.6,
    rgbSeparationEnabled: true, chromaticSplit: 0.5,
    beatPulseEnabled: true, beatPulse: 0.9,
    snapFlashEnabled: true, snapFlash: 0.75,
    tileGapEnabled: true, tileGap: 0.1,
  } as const

  it('gates every effect independently and preserves a truly clean zero-effect plan', () => {
    expect(resolveShiftgridEffectPlan({ ...allEffects, enhancedEffects: false }, { edgeShimmer: 1, gridPulse: 1, snapAccent: 1 })).toEqual(CLEAN_SHIFTGRID_EFFECT_PLAN)
    const resolved = resolveShiftgridEffectPlan(allEffects, { edgeShimmer: 0.8, gridPulse: 0.7, snapAccent: 0.6 })
    for (const value of Object.values(resolved)) expect(value).toBeGreaterThan(0)
    expect(resolveShiftgridEffectPlan({ ...allEffects, lightTrailsEnabled: false }, null).lightTrails).toBe(0)
    expect(resolveShiftgridEffectPlan({ ...allEffects, motionBlurEnabled: false }, null).motionBlur).toBe(0)
    expect(resolveShiftgridEffectPlan({ ...allEffects, rgbSeparationEnabled: false }, null).rgbSeparation).toBe(0)
    expect(resolveShiftgridEffectPlan({ ...allEffects, beatPulseEnabled: false }, { edgeShimmer: 1, gridPulse: 1, snapAccent: 1 }).beatPulse).toBe(0)
  })

  it('adds batched directional trails, gap geometry, and snap envelopes without changing tile identity or source crops', () => {
    const geometry = createShiftgridTileGeometry({ gridColumns: 4, gridRows: 4, tileShape: 'rectangular' }, 400, 400)
    const runtime = new ShiftgridGridRuntime(geometry, 'p5-effects')
    runtime.swap(1, 1000)
    runtime.advance(850)
    const effects = resolveShiftgridEffectPlan(allEffects, { edgeShimmer: 1, gridPulse: 1, snapAccent: 1 })
    const plan = createShiftgridRenderPlan({ geometry, runtime, width: 400, height: 400, sourceWidth: 400, sourceHeight: 400,
      fitMode: 'cover', easing: 'linear', effects })
    expect(plan.tiles).toHaveLength(16)
    expect(new Set(plan.tiles.map(tile => tile.tileId)).size).toBe(16)
    expect(plan.trails.length).toBeGreaterThan(0)
    expect(plan.tiles.some(tile => tile.snapFlash > 0)).toBe(true)
    expect(plan.tiles[0]!.destination.width).toBeLessThan(geometry.tiles[0]!.width)
    expect(plan.tiles[0]!.source).toEqual({ x: 0, y: 0, width: 0.25, height: 0.25 })
    expect(buildShiftgridVertexBatch(plan)).toHaveLength((plan.tiles.length + plan.trails.length + 1) * 6 * 15)
  })
})
