// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LyricManagerLayoutMockup } from './LyricManagerLayoutMockup'

let container: HTMLDivElement
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

describe('LyricManagerLayoutMockup', () => {
  it('renders the Lyric Manager header over an empty Media-Manager-shell body', async () => {
    await act(async () => root.render(<LyricManagerLayoutMockup />))

    // Media Manager shell sizing/padding
    expect(container.querySelector('.mmv-root')).not.toBeNull()
    expect(container.querySelector('.mmv-workspace .vz-content.mmv-content')).not.toBeNull()
    expect(container.querySelector('.mmv-stage-area')).not.toBeNull()

    // Lyric Manager header, not the Media Manager header
    expect(container.querySelector('.lmv-header')).not.toBeNull()
    expect(container.querySelector('.mmv-header')).toBeNull()
    expect(container.querySelector('.lmv-header-title')?.textContent).toBe('LYRIC MANAGER')
    expect(container.querySelector('.lmv-header-left .lmv-header-subtitle')).not.toBeNull()

    // Right-justified actions: Show Lyrics toggle, Save, Save + Make Active, Settings, avatar
    const right = container.querySelector('.lmv-header-right')!
    expect(right.querySelector('.lmv-toggle-row')?.textContent).toContain('Show Lyrics')
    const chips = [...right.querySelectorAll('.dv-icon-chip')].map(c => c.textContent?.trim())
    expect(chips).toEqual(['Save', 'Save + Make Active'])
    expect(right.querySelector('.vsm-settings-btn')).not.toBeNull()

    // Both rails present and empty
    const rails = container.querySelectorAll('.vz-content .vz-inspector')
    expect(rails).toHaveLength(2)
    for (const rail of rails) {
      expect(rail.querySelector('.vz-inspector-inner')?.textContent?.trim()).toBe('')
    }
    // Empty visualizer
    expect(container.querySelector('.mmv-stage-area')?.textContent?.trim()).toBe('')
  })
})
