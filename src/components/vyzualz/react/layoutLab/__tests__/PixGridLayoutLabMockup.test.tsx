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

async function selectEngine(label: string) {
  const trigger = container.querySelector<HTMLButtonElement>('.rv-engine-dropdown-trigger')
  if (!trigger) throw new Error('Missing engine dropdown trigger')
  await act(async () => trigger.click())
  const option = [...container.querySelectorAll<HTMLButtonElement>('[role="option"]')]
    .find(candidate => candidate.textContent?.includes(label))
  if (!option) throw new Error(`Missing engine option: ${label}`)
  await act(async () => option.click())
}


async function setTextInput(labelText: string, value: string) {
  const label = [...container.querySelectorAll<HTMLLabelElement>('label')]
    .find(candidate => candidate.querySelector('span')?.textContent?.trim() === labelText)
  const input = label?.querySelector<HTMLInputElement>('input')
  if (!input) throw new Error(`Missing text input: ${labelText}`)
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  if (!setter) throw new Error('Missing native input value setter')
  await act(async () => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await act(async () => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
}

function tabLabels(ariaLabel: string): string[] {
  const list = container.querySelector(`[role="tablist"][aria-label="${ariaLabel}"]`)
  if (!list) throw new Error(`Missing tablist: ${ariaLabel}`)
  return [...list.querySelectorAll('[role="tab"]')].map(tab => tab.textContent?.trim() ?? '')
}

describe('PixGrid Layout Lab through the real shell', () => {
  it('selects PixGrid and exposes canonical left, right, and lower surfaces', async () => {
    await selectEngine('PixGrid')

    expect(tabLabels('PixGrid workspace tabs')).toEqual(['SETUP', 'MEDIA'])
    expect(tabLabels('PixGrid inspector tabs')).toEqual(['PRESETS', 'DESIGN', 'REACT', 'OUTPUT'])
    expect(tabLabels('Timeline surfaces (mockup)')).toEqual(['Track Map', 'Performance Pads'])
    expect(container.querySelector('[data-lower-surface="soundDrawing"]')).toBeNull()
    expect(container.textContent).toContain('SCENES')
    expect(container.textContent).toContain('LAYERS')
    expect(container.textContent).toContain('BUILT-INS')
    expect(container.textContent).toContain('Editing Context')
    await act(async () => exactButton('PRESETS').click())
    expect(tabLabels('Preset library filter')).toEqual(['Current Engine', 'Favorites 1', 'All Engines'])
    await act(async () => exactButton('MEDIA').click())
    expect(container.textContent).toContain('PixGrid accepts still images and SVGs, not video.')
    expect(container.textContent).not.toContain('Add to Scene')
  })

  it('keeps scene and layer selection synchronized across both rails', async () => {
    await selectEngine('PixGrid')
    await act(async () => buttonContaining('Drop Scene').click())

    expect(container.querySelector('.rv-layout-lab-pix-grid-canvas-status')?.textContent).toContain('Drop Scene')
    expect(container.querySelector('.rv-layout-lab-pix-grid-canvas-status')?.textContent).toContain('Drop Chevrons')
    expect(container.textContent).toContain('Drop Scene')

    await act(async () => exactButton('Layer').click())
    expect(container.textContent).toContain('Drop Chevrons')

    const deleteLayer = container.querySelector<HTMLButtonElement>('[aria-label="Delete Drop Chevrons"]')
    expect(deleteLayer).not.toBeNull()
    await act(async () => deleteLayer?.click())

    expect(container.textContent).toContain('No layers in this scene.')
    expect(exactButton('Layer').disabled).toBe(true)
    expect(container.querySelector('.rv-layout-lab-pix-grid-canvas-status')?.textContent).toContain('Scene Pixels')
  })

  it('supports local scene add, rename, duplicate, and delete normalization', async () => {
    await selectEngine('PixGrid')

    await act(async () => exactButton('Add').click())
    expect(container.textContent).toContain('Scene 3')
    expect(container.textContent).toContain('No layers in this scene.')

    await setTextInput('Scene Name', 'Bridge Pixels')
    expect(container.textContent).toContain('Bridge Pixels')

    await act(async () => exactButton('Duplicate').click())
    expect(container.textContent).toContain('Bridge Pixels Copy')
    expect(container.querySelector('.rv-layout-lab-pix-grid-canvas-status')?.textContent).toContain('Bridge Pixels Copy')

    await act(async () => exactButton('Delete').click())
    expect(container.querySelector('.rv-layout-lab-pix-grid-canvas-status')?.textContent).toContain('Intro Scene')
  })

  it('preserves locked-layer disabling and local duplicate/delete behavior', async () => {
    await selectEngine('PixGrid')

    const lock = container.querySelector<HTMLButtonElement>('[aria-label="Lock Reactor Core"]')
    expect(lock).not.toBeNull()
    await act(async () => lock?.click())
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Duplicate Reactor Core"]')?.disabled).toBe(true)
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Delete Reactor Core"]')?.disabled).toBe(true)

    const unlock = container.querySelector<HTMLButtonElement>('[aria-label="Unlock Reactor Core"]')
    await act(async () => unlock?.click())
    const duplicate = container.querySelector<HTMLButtonElement>('[aria-label="Duplicate Reactor Core"]')
    expect(duplicate?.disabled).toBe(false)
    await act(async () => duplicate?.click())
    expect(container.textContent).toContain('Reactor Core Copy')

    const deleteCopy = container.querySelector<HTMLButtonElement>('[aria-label="Delete Reactor Core Copy"]')
    await act(async () => deleteCopy?.click())
    expect(container.querySelector('.rv-layout-lab-pix-grid-canvas-status')?.textContent).toContain('Reactor Core')
  })

  it('switches continuous and event route editors without stale controls', async () => {
    await selectEngine('PixGrid')
    await act(async () => exactButton('REACT').click())

    expect(tabLabels('PixGrid reactivity surfaces')).toEqual(['ROUTING', 'EVENTS', 'CHOREOGRAPHY', 'ANALYSIS'])
    expect(container.textContent).toContain('CONTINUOUS ROUTES')
    expect(container.textContent).toContain('Polarity')
    expect(container.textContent).toContain('Phrase Segment')
    expect(container.textContent).toContain('Auto Performance Only')
    expect(container.textContent).toContain('Active Layer')
    expect(container.textContent).toContain('Active Group')

    await act(async () => exactButton('EVENTS').click())
    expect(container.textContent).toContain('EVENT ROUTES')
    expect(container.textContent).toContain('Event Attack')
    expect(container.textContent).toContain('Event Hold')
    expect(container.textContent).toContain('Event Release')
    expect(container.textContent).not.toContain('Polarity')
  })

  it('shows choreography, analysis, and local-only output capability states', async () => {
    await selectEngine('PixGrid')
    await act(async () => exactButton('REACT').click())
    await act(async () => exactButton('CHOREOGRAPHY').click())
    expect(container.textContent).toContain('PERFORMANCE PROGRAM')
    expect(container.textContent).toContain('SECTION PLAN CONTROLS')
    expect(container.textContent).toContain('VISUAL ROLES AND BANKS')
    expect(container.textContent).toContain('OVERRIDES')

    await act(async () => exactButton('ANALYSIS').click())
    expect(container.textContent).toContain('AUDIO INPUT AND TRANSPORT')
    expect(container.textContent).toContain('WHY PIXGRID IS MOVING')
    expect(container.textContent).toContain('RUNTIME DIAGNOSTICS')
    expect(container.textContent).toContain('Layout Lab static fixture')

    await act(async () => exactButton('OUTPUT').click())
    expect(tabLabels('Output surfaces')).toEqual(['RECORDING', 'PRODUCTION'])
    expect(exactButton('PRODUCTION').disabled).toBe(true)
    expect(container.textContent).toContain('never reads the canvas')
  })

  it('normalizes lower surfaces while switching between PixGrid, Sound Drawing, and Shader Pads', async () => {
    await selectEngine('PixGrid')
    await act(async () => exactButton('Performance Pads').click())
    expect(exactButton('Performance Pads').getAttribute('aria-selected')).toBe('true')

    await selectEngine('Sound Drawing')
    expect(tabLabels('Timeline surfaces (mockup)')).toEqual(['Track Map', 'Sound Drawing', 'Performance Pads'])
    expect(exactButton('Track Map').getAttribute('aria-selected')).toBe('true')

    await selectEngine('Shader Pads')
    expect(tabLabels('Timeline surfaces (mockup)')).toEqual(['Track Map'])
    expect(exactButton('Track Map').getAttribute('aria-selected')).toBe('true')

    await selectEngine('PixGrid')
    expect(tabLabels('Timeline surfaces (mockup)')).toEqual(['Track Map', 'Performance Pads'])
    expect(exactButton('Track Map').getAttribute('aria-selected')).toBe('true')
  })
})
