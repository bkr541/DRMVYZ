// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../stores/reactStore'
import { LaserDmxShowDirectorControls } from '../LaserDmxShowDirectorControls'
import { LaserDmxShowDirectorPalette } from '../LaserDmxShowDirectorPalette'

let container: HTMLDivElement
let root: Root
let mounted = false

async function render(node: React.ReactNode): Promise<void> {
  await act(async () => {
    root.render(node)
    mounted = true
  })
}

describe('Show Director workspace architecture', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    useReactStore.getState().resetReactView()
    useReactStore.getState().applyLaserDmxShowDirectorTemplate('small-club-rig')
  })

  afterEach(async () => {
    if (mounted) await act(async () => root.unmount())
    container.remove()
    mounted = false
    vi.unstubAllGlobals()
  })

  it('places stage-wide design controls below Lighting Components in the left palette', async () => {
    await render(<LaserDmxShowDirectorPalette />)

    expect(container.textContent).toContain('Lighting Components')
    expect(container.textContent).toContain('Show Director Design')
    expect(container.textContent).toContain('Snap to Grid')
    expect(container.textContent).toContain('Show Beams')
    expect(container.textContent).not.toContain('Fixture Tools')
  })

  it('keeps only selected-fixture tools and inspection in the right DESIGN rail', async () => {
    await render(<LaserDmxShowDirectorControls />)

    expect(container.textContent).toContain('Fixture Tools')
    expect(container.textContent).not.toContain('Show Director Design')
    expect(container.textContent).not.toContain('Snap to Grid')
    expect(container.textContent).not.toContain('Show Beams')
  })
})
