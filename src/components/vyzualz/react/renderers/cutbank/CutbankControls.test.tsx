/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../../stores/reactStore'
import { CanvasEngineFxPanel, CanvasPerformanceAutomationControls } from '../../ReactCanvasEngineShell'

vi.mock('../../../../../context/AudioEngineContext', () => ({
  useSharedAudio: () => ({ tracks: [], source: 'none', currentAudioTrackId: null, currentTrack: null, isPlaying: false }),
}))

let host: HTMLDivElement
let root: Root
const store = () => useReactStore.getState()

const groupLabels = () => [...host.querySelectorAll<HTMLButtonElement>('.drc-header')].map(button => button.querySelector('span')?.textContent?.trim())
const rowLabels = () => [...host.querySelectorAll<HTMLElement>('.rv-ctrl-label, .rv-ctrl-palette-row-label')].map(el => el.textContent?.trim())

async function mountDesign() {
  await act(async () => { root.render(<CanvasEngineFxPanel />) })
}

beforeEach(() => {
  store().resetReactView()
  store().selectReactEngine('canvas')
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => { root.unmount() })
  host.remove()
})

describe('CUTBANK Design tab', () => {
  it('shows exactly Master Controls, Design, Effects, Palette and no generic Canvas groups', async () => {
    await act(async () => { store().selectCanvasPreset('canvas-cutbank') })
    await mountDesign()
    expect(groupLabels()).toEqual(['Master Controls', 'Design', 'Effects', 'Palette'])
  })

  it('exposes every specified control and none of the forbidden ones', async () => {
    await act(async () => { store().selectCanvasPreset('canvas-cutbank') })
    await mountDesign()
    const labels = rowLabels()
    for (const expected of [
      'Master Intensity', 'BPM Sync', 'Auto Performance', 'Chaos', 'Motion Amount', 'Transition Intensity',
      'Media Pool', 'Media Mode', 'Selection Mode', 'Layout Mode', 'Layout Complexity', 'Cut Rate', 'Minimum Hold', 'Maximum Hold', 'Composition Freedom', 'Layer Count',
      'Effects Enabled', 'Treatment Mode', 'Effect Amount', 'Treatment Variety', 'Grain', 'Threshold', 'Distortion', 'Signal Damage', 'RGB Split', 'Feedback', 'Lens Warp', 'Smear', 'Flash Amount', 'Transition Style', 'Transition Duration', 'Transition Variety',
      'Palette Mode', 'Saturation', 'Contrast', 'Exposure', 'Black Level', 'White Level', 'Tint', 'Invert Colors',
    ]) {
      expect(labels, expected).toContain(expected)
    }
    for (const forbidden of ['Image Bias', 'Text Bias', 'Repeat Protection', 'Crop Amount', 'Overscan', 'Scale Range', 'Rotation Range', 'Negative Space', 'Composition Variety', 'Weighted']) {
      expect(labels.join('|')).not.toContain(forbidden)
    }
    expect(host.textContent).not.toContain('Weighted')
  })

  it('shows palette-mode-specific controls only when they can affect the output', async () => {
    await act(async () => { store().selectCanvasPreset('canvas-cutbank') })
    await mountDesign()
    expect(rowLabels()).not.toContain('Accent Color 1')
    expect(rowLabels()).not.toContain('Source Color Amount')
    const setPalette = async (paletteMode: 'source' | 'custom' | 'auto') => {
      await act(async () => { store().setCanvasPresetSettings({ cutbank: { ...store().canvasPresetSettings.cutbank, paletteMode } }) })
    }
    await setPalette('custom')
    expect(rowLabels()).toEqual(expect.arrayContaining(['Accent Color 1', 'Accent Color 2', 'Colorize Amount', 'Source Color Amount']))
    expect(rowLabels()).not.toContain('Color Change Rate')
    await setPalette('auto')
    expect(rowLabels()).toContain('Color Change Rate')
    await setPalette('source')
    expect(rowLabels()).not.toContain('Accent Color 1')
  })

  it('hides treatment sliders when Effects are disabled but keeps flash and transition controls', async () => {
    await act(async () => { store().selectCanvasPreset('canvas-cutbank') })
    await act(async () => { store().setCanvasPresetSettings({ cutbank: { ...store().canvasPresetSettings.cutbank, effectsEnabled: false } }) })
    await mountDesign()
    const labels = rowLabels()
    expect(labels).not.toContain('Grain')
    expect(labels).not.toContain('Treatment Mode')
    expect(labels).toEqual(expect.arrayContaining(['Flash Amount', 'Transition Style', 'Transition Duration']))
  })

  it('Media Pool dropdown lists named Canvas pools and drives the canonical active pool', async () => {
    const a = store().createCanvasMediaPool('Warmup')
    const b = store().createCanvasMediaPool('Drop')
    if (!a.ok || !b.ok) throw new Error('pool setup failed')
    await act(async () => { store().addCanvasPoolText(b.pool.id, 'HELLO') })
    await act(async () => { store().selectCanvasPreset('canvas-cutbank') })
    await mountDesign()
    const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="Media Pool"]')
    if (!trigger) throw new Error('Expected Media Pool dropdown trigger')
    await act(async () => { trigger.click() })
    const options = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].map(o => o.textContent?.trim())
    expect(options.join('|')).toContain('Warmup')
    expect(options.join('|')).toContain('Drop · 1')
    const drop = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].find(o => o.textContent?.includes('Drop'))!
    await act(async () => { drop.click() })
    expect(store().canvasOrchestrationSettings.activeMediaPoolId).toBe(b.pool.id)
    await act(async () => { store().deleteCanvasMediaPool(b.pool.id) })
    expect(store().canvasOrchestrationSettings.activeMediaPoolId).toBeNull()
  })

  it('edits write back to the persisted CUTBANK settings block', async () => {
    await act(async () => { store().selectCanvasPreset('canvas-cutbank') })
    await mountDesign()
    const toggle = [...host.querySelectorAll<HTMLElement>('.rv-ctrl-toggle-row')].find(row => row.textContent?.includes('BPM Sync'))!
    await act(async () => { toggle.querySelector<HTMLButtonElement>('button')!.click() })
    expect(store().canvasPresetSettings.cutbank.bpmSync).toBe(false)
    await act(async () => { host.querySelector<HTMLButtonElement>('[aria-label="Reset CUTBANK settings"]')!.click() })
    expect(store().canvasPresetSettings.cutbank.bpmSync).toBe(true)
  })

  it('other presets keep their generic Design tab and Performance Automation', async () => {
    await act(async () => { store().selectCanvasPreset('canvas-fractures') })
    await mountDesign()
    expect(groupLabels()).toContain('Display')
    await act(async () => { root.render(<CanvasPerformanceAutomationControls />) })
    expect(groupLabels()).toContain('Performance Automation')
    await act(async () => { store().selectCanvasPreset('canvas-cutbank') })
    expect(host.textContent).not.toContain('Performance Automation')
  })
})
