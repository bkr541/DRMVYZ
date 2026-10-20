// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ReactHeaderPerformanceStatus, qualityTierForFps } from './ReactHeaderPerformanceStatus'

let container: HTMLElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('ReactHeaderPerformanceStatus', () => {
  it('renders FPS, derived frame time, and the active quality tier as CPU-style chips', async () => {
    await act(async () => root.render(<ReactHeaderPerformanceStatus fps={59.8} qualityTier="medium" />))
    const chips = [...container.querySelectorAll<HTMLElement>('.vz-header-performance-metric')]

    expect(chips).toHaveLength(3)
    expect(chips.map(chip => chip.dataset.performanceMetric)).toEqual(['fps', 'frame-time', 'quality'])
    expect(chips.map(chip => chip.textContent)).toEqual(['FPS60', 'FRAME TIME16.7 ms', 'QUALITYmedium'])
    for (const chip of chips) {
      expect(chip.classList.contains('vz-header-cpu')).toBe(true)
      expect(chip.classList.contains('vz-header-status-chip')).toBe(true)
    }
  })

  it('uses an explicit frame-time measurement and shows measuring placeholders before FPS is available', async () => {
    await act(async () => root.render(<ReactHeaderPerformanceStatus fps={0} frameTimeMs={8.25} qualityTier="high" />))
    expect(container.querySelector<HTMLElement>('[data-performance-metric="fps"]')?.textContent).toBe('FPS—')
    expect(container.querySelector<HTMLElement>('[data-performance-metric="frame-time"]')?.textContent).toBe('FRAME TIME8.3 ms')
    expect(container.querySelector<HTMLElement>('[data-performance-metric="quality"]')?.textContent).toBe('QUALITYhigh')
  })

  it('maps presentation rate to low, medium, and high tiers', () => {
    expect(qualityTierForFps(24)).toBe('low')
    expect(qualityTierForFps(45)).toBe('medium')
    expect(qualityTierForFps(60)).toBe('high')
  })
})
