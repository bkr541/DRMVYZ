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

function buttonByLabel(label: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (!button) throw new Error(`Missing button with aria-label: ${label}`)
  return button
}

async function click(button: HTMLButtonElement) {
  await act(async () => button.click())
}

async function additiveClick(button: HTMLButtonElement) {
  await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true })))
}

async function selectEngine(label: string) {
  const trigger = container.querySelector<HTMLButtonElement>('.rv-engine-dropdown-trigger')
  if (!trigger) throw new Error('Missing engine dropdown trigger')
  await click(trigger)
  const option = [...container.querySelectorAll<HTMLButtonElement>('[role="option"]')]
    .find(candidate => candidate.textContent?.includes(label))
  if (!option) throw new Error(`Missing engine option: ${label}`)
  await click(option)
}

function tabLabels(ariaLabel: string): string[] {
  const list = container.querySelector(`[role="tablist"][aria-label="${ariaLabel}"]`)
  if (!list) throw new Error(`Missing tablist: ${ariaLabel}`)
  return [...list.querySelectorAll('[role="tab"]')].map(tab => tab.textContent?.trim() ?? '')
}

describe('LaserDMX Layout Lab through the real shell', () => {
  it('selects LaserDMX and exposes canonical left, right, and lower surfaces', async () => {
    await selectEngine('LaserDMX')

    expect(tabLabels('LaserDMX workspace tabs')).toEqual(['RIG', 'LAYERS'])
    expect(tabLabels('LaserDMX inspector tabs')).toEqual(['PRESETS', 'DESIGN', 'REACT', 'OUTPUT'])
    expect(tabLabels('Timeline surfaces (mockup)')).toEqual(['Track Map', 'Performance Pads'])
    expect(container.querySelector('[data-lower-surface="soundDrawing"]')).toBeNull()
    expect(container.textContent).toContain('Program')
    expect(container.textContent).toContain('Beam Matrix Design')
    expect(container.textContent).toContain('React Master')
    expect(container.querySelector('[aria-label="LaserDMX visual mockup"]')).not.toBeNull()
  })

  it('keeps the Matrix versus Show Director split synchronized across both rails', async () => {
    await selectEngine('LaserDMX')
    await click(exactButton('SHOW DIRECTOR'))

    expect(container.textContent).toContain('Lighting Components')
    expect(container.textContent).toContain('Presentation & Renderer')
    expect(container.textContent).toContain('Performance Program')
    expect(container.textContent).toContain('Fixture Tools')
    expect(container.querySelector('[data-layout-lab-laserdmx="show-director-design"]')).not.toBeNull()
    expect(container.textContent).not.toContain('React Master')

    await click(exactButton('PRESETS'))
    expect(container.textContent).toContain('Show Director Performance Shows')
    expect(container.textContent).toContain('Show Director Rig Layouts')
    expect(container.textContent).not.toContain('Beam Matrix Presets')

    await click(exactButton('MATRIX'))
    expect(container.textContent).toContain('Beam Matrix Presets')
    expect(container.textContent).not.toContain('Show Director Performance Shows')
  })

  it('synchronizes group, single-beam, and multi-beam selection with DESIGN and REACT', async () => {
    await selectEngine('LaserDMX')

    await click(buttonByLabel('Select group Drop Fans'))
    expect(container.textContent).toContain('Edit: Drop Fans')
    await click(exactButton('REACT'))
    expect(container.textContent).toContain('Group Routes')
    expect(container.textContent).toContain('Routes for Drop Fans')

    await click(buttonByLabel('Select beam Cyan Sweep L'))
    expect(container.textContent).toContain('Beam Routes')
    expect(container.textContent).toContain('Routes for Cyan Sweep L')

    await click(exactButton('DESIGN'))
    expect(container.textContent).toContain('Selected Beam')
    expect(container.textContent).toContain('Cyan Sweep L')

    await additiveClick(buttonByLabel('Select beam Cyan Sweep R'))
    expect(container.textContent).toContain('2 Beams Selected')
    expect(container.textContent).toContain('Duplicate with Offset')
  })

  it('exposes no-selection, one-fixture, production, scanner, and bulk inspector conditions', async () => {
    await selectEngine('LaserDMX')
    await click(exactButton('SHOW DIRECTOR'))

    expect(container.textContent).toContain('Select a fixture on the stage or in LAYERS to inspect it.')
    await click(buttonByLabel('Select fixture Laser 1'))
    expect(container.querySelector('[aria-label="Show Director fixture inspector"]')).not.toBeNull()
    expect(container.textContent).toContain('DJ Controls')
    expect(container.textContent).toContain('Trigger Recipe')

    await click(exactButton('PRODUCTION'))
    expect(container.textContent).toContain('Fixture')
    expect(container.textContent).toContain('Scanner Pattern')
    expect(container.querySelector('[aria-label="Ordered scanner path points"]')).not.toBeNull()
    expect(container.textContent).toContain('Scanner Diagnostics')
    expect(container.textContent).toContain('Trigger / Timing')

    await additiveClick(buttonByLabel('Select fixture Moving Head 2'))
    expect(container.querySelector('[aria-label="Show Director bulk fixture inspector"]')).not.toBeNull()
    expect(container.textContent).toContain('2 selected')
    expect(container.textContent).toContain('Bulk Trigger Recipe')
    expect(container.textContent).toContain('Recommended Recipes')
  })

  it('keeps recording and production-output interactions local and reversible', async () => {
    await selectEngine('LaserDMX')
    await click(exactButton('OUTPUT'))

    expect(tabLabels('Output surfaces')).toEqual(['RECORDING', 'PRODUCTION'])
    expect(container.textContent).toContain('never reads the canvas')
    await click(exactButton('Start Simulated Recording'))
    expect(container.textContent).toContain('RECORDING (SIMULATED)')
    await click(exactButton('Stop Simulated Recording'))
    expect(container.textContent).toContain('READY')

    await click(exactButton('PRODUCTION'))
    expect(container.textContent).toContain('DISARMED · Virtual Output')
    await click(exactButton('Arm Virtual Test'))
    expect(container.textContent).toContain('ARMED · Virtual Output')
    await click(exactButton('Emergency Blackout'))
    expect(container.textContent).toContain('BLACKOUT · local Layout Lab latch only')
    await click(exactButton('Clear Latch'))
    expect(container.textContent).toContain('DISARMED · Virtual Output')
  })

  it('preserves lower-tray parity for LaserDMX, Shader Pads, Sound Drawing, and PixGrid', async () => {
    await selectEngine('LaserDMX')
    expect(tabLabels('Timeline surfaces (mockup)')).toEqual(['Track Map', 'Performance Pads'])
    await click(exactButton('Performance Pads'))
    expect(exactButton('Performance Pads').getAttribute('aria-selected')).toBe('true')

    await selectEngine('Shader Pads')
    expect(tabLabels('Timeline surfaces (mockup)')).toEqual(['Track Map'])
    expect(exactButton('Track Map').getAttribute('aria-selected')).toBe('true')

    await selectEngine('Sound Drawing')
    expect(tabLabels('Timeline surfaces (mockup)')).toEqual(['Track Map', 'Sound Drawing', 'Performance Pads'])

    await selectEngine('PixGrid')
    expect(tabLabels('Timeline surfaces (mockup)')).toEqual(['Track Map', 'Performance Pads'])
  })
})
