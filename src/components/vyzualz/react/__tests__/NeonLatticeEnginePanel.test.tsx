// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useReactStore } from '../../../../stores/reactStore'
import { NeonLatticeEnginePanel } from '../NeonLatticeEnginePanel'
import { DEFAULT_NEON_LATTICE_SETTINGS } from '../ReactTypes'

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
  useReactStore.getState().resetNeonLatticeSettings()
})

describe('NeonLatticeEnginePanel reset action', () => {
  it('uses the shared reset-button treatment and preserves the Neon Lattice reset behavior', async () => {
    useReactStore.getState().setNeonLatticeSettings({
      railDensity: 0.91,
      pulseSpeed: 0.13,
      reseedInterval: 31,
    })

    await act(async () => root.render(<NeonLatticeEnginePanel />))

    const resetButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent?.trim() === 'Reset Engine Settings')

    expect(resetButton).toBeDefined()
    expect(resetButton?.type).toBe('button')
    expect(resetButton?.classList.contains('rv-reset-btn')).toBe(true)
    expect(resetButton?.className).not.toContain('rv-btn')
    expect(resetButton?.title).toBe('Reset all Neon Lattice settings to defaults')
    expect(resetButton?.closest('.rv-ctrl-footer')).not.toBeNull()

    await act(async () => resetButton?.click())

    expect(useReactStore.getState().neonLatticeSettings).toEqual(DEFAULT_NEON_LATTICE_SETTINGS)
  })
})
