// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  state: {
    reactPresets: [{
      id: 'pix-grid-test',
      name: 'Test PixGrid',
      description: 'Test preset',
      engine: 'pixGrid',
      palette: {
        primary: '#4ac7db',
        secondary: '#61d6aa',
        accent: '#ffffff',
        background: '#000000',
        highlight: '#b84fc9',
        text: '#ffffff',
      },
      params: { intensity: 1, motion: 0.5, glow: 0.5, bassReactivity: 0.5 },
      scenes: [],
      sectionMappings: [],
    }],
    activeReactPresetId: 'pix-grid-test',
    reactIntensity: 1,
    reactMotion: 0.5,
    reactGlow: 0.5,
    reactBassReactivity: 0.5,
    pixGridActionCuesByTrackId: {},
    pixGridState: {
      matrixWidth: 160,
      matrixHeight: 90,
      selectedSceneId: 'scene-1',
      scenes: [{ id: 'scene-1', name: 'Intro', layerIds: ['layer-1'] }],
      layers: [{ id: 'layer-1', name: 'Neon Grid', visible: true }],
      groups: [],
    },
  },
}))

vi.mock('../../../context/AudioEngineContext', () => ({
  useSharedAudio: () => ({
    analyserMaster: null,
    currentTrackId: null,
    currentTime: 0,
    duration: 180,
    isPlaying: false,
    getCurrentTime: () => 0,
    currentEffectiveBpm: 128,
  }),
}))

vi.mock('../../../stores/reactStore', () => ({
  useReactStore: (selector: (state: typeof fixture.state) => unknown) => selector(fixture.state),
}))

vi.mock('../react/pixGrid/PixGridSurface', () => ({
  PixGridSurface: () => <div data-testid="pix-grid-surface">PixGrid preview</div>,
}))

vi.mock('../react/pixGrid/PixGridDesignPanel', () => ({
  PixGridDesignPanel: ({ groupedSections }: { groupedSections?: boolean }) => (
    <div data-testid="pix-grid-design-panel" data-grouped={groupedSections ? 'true' : 'false'}>
      PixGrid design controls
    </div>
  ),
}))

vi.mock('../shared/VyzualzHeaderActions', () => ({
  VyzualzHeaderActions: () => (
    <>
      <button type="button" className="vsm-settings-btn" aria-label="Settings" />
      <div className="vz-header-avatar" aria-label="Profile" />
    </>
  ),
}))

import { ShowManagerView } from './ShowManagerView'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

describe('ShowManagerView PixGrid-first shell', () => {
  it('uses the shared dropdown in the left rail and keeps future engines disabled', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<ShowManagerView />)
      await Promise.resolve()
    })

    const engineTrigger = container.querySelector<HTMLButtonElement>('button[aria-label="Show Manager engine"]')
    expect(engineTrigger?.textContent).toContain('PixGrid')
    expect(engineTrigger?.closest('.sm-library')).not.toBeNull()
    expect(engineTrigger?.closest('.sm-topbar')).toBeNull()
    expect(container.querySelectorAll('select')).toHaveLength(0)

    await act(async () => {
      engineTrigger?.click()
      await Promise.resolve()
    })

    const engineMenu = document.body.querySelector('.drm-dropdown__menu[role="listbox"]')
    const options = [...(engineMenu?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])]
    expect(options).toHaveLength(6)
    expect(options.find(option => option.textContent?.includes('PixGrid'))?.getAttribute('aria-disabled')).toBeNull()
    expect(options.filter(option => !option.textContent?.includes('PixGrid')).every(option => option.getAttribute('aria-disabled') === 'true')).toBe(true)
    expect(container.querySelector('[data-testid="pix-grid-surface"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="pix-grid-design-panel"]')?.getAttribute('data-grouped')).toBe('true')
    expect(container.querySelector('[aria-label="Show Manager track map preview"]')).not.toBeNull()
  })

  it('keeps panel headings inside their rails and moves stage tools plus account actions into the top bar', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<ShowManagerView />)
      await Promise.resolve()
    })

    expect(container.querySelector('.sm-stage-header')).toBeNull()
    expect(container.querySelector('.sm-library > .sm-panel-heading')?.textContent).toContain('COMPONENT LIBRARY')
    expect(container.querySelector('.sm-inspector > .sm-panel-heading')?.textContent).toContain('INSPECTOR')
    expect(container.querySelector('[aria-label="Show Manager stage tools"]')?.closest('.sm-topbar')).not.toBeNull()
    expect(container.querySelector('.sm-topbar > .vsm-settings-btn')).not.toBeNull()
    expect(container.querySelector('.sm-topbar > .vz-header-avatar')).not.toBeNull()
  })

  it('moves the preset chooser into the inspector and expands or collapses library groups independently', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<ShowManagerView />)
      await Promise.resolve()
    })

    const presetTrigger = container.querySelector<HTMLButtonElement>('button[aria-label="Show Manager PixGrid preset"]')
    expect(presetTrigger?.textContent).toContain('Test PixGrid')
    expect(presetTrigger?.closest('.sm-inspector')).not.toBeNull()
    expect(presetTrigger?.closest('.sm-topbar')).toBeNull()

    const componentsToggle = [...container.querySelectorAll<HTMLButtonElement>('.sm-library-section-toggle')]
      .find(button => button.textContent?.includes('Components'))
    expect(componentsToggle?.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('.sm-library-row.is-active')).not.toBeNull()

    await act(async () => {
      componentsToggle?.click()
      await Promise.resolve()
    })

    expect(componentsToggle?.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('.sm-library-row.is-active')).toBeNull()

    await act(async () => {
      componentsToggle?.click()
      await Promise.resolve()
    })

    expect(componentsToggle?.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('.sm-library-row.is-active')).not.toBeNull()
  })
})
