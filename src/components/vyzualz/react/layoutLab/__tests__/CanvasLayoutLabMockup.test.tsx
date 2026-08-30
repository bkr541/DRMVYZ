// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LayoutLabMockup } from '../../LayoutLabMockup'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(async () => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<LayoutLabMockup />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function buttons(): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('button')]
}

function exactButton(text: string): HTMLButtonElement {
  const result = buttons().find(candidate => candidate.textContent?.trim() === text)
  if (!result) throw new Error(`Missing button: ${text}`)
  return result
}

function buttonContaining(text: string): HTMLButtonElement {
  const result = buttons().find(candidate => candidate.textContent?.includes(text))
  if (!result) throw new Error(`Missing button containing: ${text}`)
  return result
}

function buttonByLabel(label: string): HTMLButtonElement {
  const result = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (!result) throw new Error(`Missing button with label: ${label}`)
  return result
}

async function selectEngine(label: string) {
  const trigger = container.querySelector<HTMLButtonElement>('.rv-engine-dropdown-trigger')
  if (!trigger) throw new Error('Missing engine dropdown trigger')
  await act(async () => trigger.click())
  const option = [...container.querySelectorAll<HTMLButtonElement>('[role="option"]')]
    .find(candidate => candidate.textContent?.includes(label))
  if (!option) throw new Error(`Missing engine option: ${label}`)
  await act(async () => option.click())
}

function tabLabels(ariaLabel: string): string[] {
  const list = container.querySelector(`[role="tablist"][aria-label="${ariaLabel}"]`)
  if (!list) throw new Error(`Missing tablist: ${ariaLabel}`)
  return [...list.querySelectorAll('[role="tab"]')].map(tab => tab.textContent?.trim() ?? '')
}

describe('Canvas Layout Lab through the real shell', () => {
  it('selects Canvas and exposes SOURCE, complete inspector tabs, and canonical lower surfaces', async () => {
    await selectEngine('CANVAS')

    expect(tabLabels('Canvas left workspace tabs')).toEqual(['SOURCE', 'LAYERS'])
    expect(tabLabels('Canvas inspector tabs')).toEqual(['PRESETS', 'DESIGN', 'REACT', 'OUTPUT'])
    expect(tabLabels('Timeline surfaces (mockup)')).toEqual(['Track Map', 'Performance Pads'])
    expect(container.querySelector('[data-lower-surface="soundDrawing"]')).toBeNull()
    expect(container.textContent).toContain('Media Library')
    expect(container.textContent).toContain('Performance Pool')
    expect(container.textContent).toContain('Roles · Aurora Portrait.png')
    expect(container.textContent).toContain('CANVAS Source Link')
    expect(container.textContent).toContain('Performance Orchestration')
    expect(container.textContent).toContain('CANVAS React Controls')
  })

  it('synchronizes image and video selection with media lock and Video Timing enablement', async () => {
    await selectEngine('CANVAS')

    const triggerOn = container.querySelector<HTMLButtonElement>('[aria-label="Trigger On"]')
    expect(triggerOn?.disabled).toBe(true)

    await act(async () => buttonContaining('Prism Tunnel Loop.mp4').click())
    expect(container.querySelector('.rv-layout-lab-canvas-canvas-status')?.textContent).toContain('Prism Tunnel Loop.mp4')
    expect(container.textContent).toContain('Media lock: This CANVAS source stays selected.')
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Trigger On"]')?.disabled).toBe(false)
    expect(container.querySelector<HTMLInputElement>('input[type="number"]')?.disabled).toBe(false)

    await act(async () => buttonContaining('Aurora Portrait.png').click())
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Trigger On"]')?.disabled).toBe(true)

    await act(async () => buttonByLabel('Clear CANVAS media lock').click())
    expect(container.textContent).not.toContain('Media lock: This CANVAS source stays selected.')
  })

  it('shows the full preset inventory and swaps standard and Fractures controls and output states', async () => {
    await selectEngine('CANVAS')
    await act(async () => exactButton('PRESETS').click())

    for (const preset of ['Clean Playback', 'Particle Aura', 'Fractures', 'Laser Image FX']) {
      expect(container.textContent).toContain(preset)
    }
    for (const retired of ['Bass Bloom', 'Ghost Echo', 'Glitch Pulse', 'Luma Melt', 'Frame Stutter']) {
      expect(container.querySelector(`[aria-label="Load ${retired}"]`)).toBeNull()
    }
    await act(async () => exactButton('All Engines').click())
    for (const engine of ['Cinema', 'Sound Drawing', 'LaserDMX', 'PixGrid']) {
      expect(container.textContent).toContain(engine)
    }
    await act(async () => exactButton('Current Engine').click())

    await act(async () => buttonByLabel('Load Fractures').click())
    await act(async () => exactButton('DESIGN').click())
    expect(container.textContent).toContain('Fractures Controls')
    expect(container.textContent).toContain('Refracture')
    expect(container.textContent).toContain('Shuffle Layout')
    expect(container.textContent).not.toContain('CANVAS React Controls')

    await act(async () => exactButton('OUTPUT').click())
    expect(container.textContent).toContain('Fractures recording is unavailable')
    expect(container.textContent).toContain('capture is intentionally disabled in the current MVP.')
    expect(exactButton('Recording unavailable').disabled).toBe(true)

    await act(async () => exactButton('PRESETS').click())
    await act(async () => buttonByLabel('Load Clean Playback').click())
    await act(async () => exactButton('OUTPUT').click())
    expect(container.textContent).toContain('Start Recording Mock')
    expect(container.textContent).not.toContain('Fractures recording is unavailable')
  })

  it('keeps pool, roles, empty state, and orchestration conditions coherent', async () => {
    await selectEngine('CANVAS')
    expect(container.textContent).toContain('Roles · Aurora Portrait.png')

    const heroRole = exactButton('Hero')
    expect(heroRole.getAttribute('aria-pressed')).toBe('true')
    await act(async () => heroRole.click())
    expect(exactButton('Hero').getAttribute('aria-pressed')).toBe('false')

    await act(async () => exactButton('Show Empty State').click())
    expect(container.textContent).toContain('No saved CANVAS media')
    expect(container.textContent).toContain('Select media to build a deterministic multi-source pool.')
    const autoPerformanceRow = [...container.querySelectorAll<HTMLElement>('.rv-ctrl-toggle-row')]
      .find(row => row.textContent?.includes('Auto Performance'))
    expect(autoPerformanceRow?.querySelector<HTMLButtonElement>('button')?.disabled).toBe(true)

    await act(async () => exactButton('Restore Samples').click())
    expect(container.textContent).toContain('Aurora Portrait.png')
    expect(container.textContent).toContain('Roles · Aurora Portrait.png')
  })

  it('preserves Canvas routing copy and deterministic analysis without live audio', async () => {
    await selectEngine('CANVAS')
    await act(async () => exactButton('REACT').click())

    expect(tabLabels('Canvas react surfaces')).toEqual(['ROUTING', 'ANALYSIS'])
    expect(container.textContent).toContain('This engine currently uses global intensity/motion controls only. Adjust Bass React and Motion in the FX tab for broad audio response.')

    await act(async () => exactButton('ANALYSIS').click())
    for (const section of ['Audio Bands', 'Rhythm', 'Energy', 'Section', 'Harmonic', 'Stems', 'Lyrics', 'Semantic']) {
      expect(container.textContent).toContain(section)
    }
    expect(container.textContent).toContain('static sample')
  })

  it('normalizes lower surfaces across Canvas, Sound Drawing, Cinema, PixGrid, and LaserDMX', async () => {
    await selectEngine('CANVAS')
    await act(async () => exactButton('Performance Pads').click())
    expect(exactButton('Performance Pads').getAttribute('aria-selected')).toBe('true')

    await selectEngine('Sound Drawing')
    expect(tabLabels('Timeline surfaces (mockup)')).toEqual(['Track Map', 'Sound Drawing', 'Performance Pads'])
    expect(exactButton('Track Map').getAttribute('aria-selected')).toBe('true')

    await selectEngine('Cinema')
    expect(tabLabels('Timeline surfaces (mockup)')).toEqual(['Track Map'])

    await selectEngine('PixGrid')
    expect(tabLabels('Timeline surfaces (mockup)')).toEqual(['Track Map', 'Performance Pads'])

    await selectEngine('LaserDMX')
    expect(tabLabels('Timeline surfaces (mockup)')).toEqual(['Track Map', 'Performance Pads'])

    await selectEngine('CANVAS')
    expect(tabLabels('Timeline surfaces (mockup)')).toEqual(['Track Map', 'Performance Pads'])
    expect(exactButton('Track Map').getAttribute('aria-selected')).toBe('true')
  })
})
