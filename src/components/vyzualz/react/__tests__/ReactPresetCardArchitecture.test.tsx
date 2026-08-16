// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../stores/reactStore'
import { ReactPresetCard } from '../ReactPresetCard'
import {
  filterLaserDmxBeamMatrixPresets,
  LaserDmxBeamMatrixPresetBrowser,
} from '../LaserDmxBeamMatrixPresetBrowser'
import { LASER_DMX_BEAM_MATRIX_PRESETS } from '../laserDmxBeamMatrixPresets'
import { ReactPresetsPanel } from '../ReactPresetsPanel'

vi.mock('../ReactPresetThumbnail', () => ({
  ReactPresetThumbnail: ({ className = '' }: { className?: string }) => (
    <div
      className={`rv-preset-thumb${className ? ` ${className}` : ''}`}
      data-thumbnail-kind="standard"
      aria-hidden="true"
    />
  ),
}))

let container: HTMLDivElement
let root: Root
let mounted = false

async function render(node: React.ReactNode): Promise<void> {
  await act(async () => {
    root.render(node)
    mounted = true
  })
}

async function click(element: Element): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

async function input(element: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('canonical React preset card architecture', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    useReactStore.getState().resetReactView()
  })

  afterEach(async () => {
    if (mounted) await act(async () => root.unmount())
    container.remove()
    mounted = false
    vi.unstubAllGlobals()
  })

  it('keeps whole-card activation separate from canonical secondary actions', async () => {
    const activate = vi.fn()
    const restore = vi.fn()
    await render(
      <div data-preset-grid>
        <ReactPresetCard
          id="shared-card"
          title="Shared Card"
          description="Canonical preset card"
          thumbnail={<div className="rv-preset-thumb" />}
          chips={[{ label: 'Mode' }]}
          palette={[{ color: '#4ac7db' }]}
          isActive
          isModified
          activateLabel="Load Shared Card"
          onActivate={activate}
          secondaryActions={[{
            id: 'restore',
            label: 'Restore',
            ariaLabel: 'Restore Shared Card',
            onSelect: restore,
          }]}
        />
      </div>,
    )

    const card = container.querySelector('[data-preset-card="true"], [data-preset-card]')!
    expect(card.classList.contains('rv-preset-card--active')).toBe(true)
    expect(card.classList.contains('rv-preset-spotlight-card')).toBe(true)
    expect(card.classList.contains('rv-preset-spotlight-card--active')).toBe(true)
    expect(card.querySelector('.rv-preset-spotlight-thumb')).not.toBeNull()
    expect(card.querySelector('.rv-preset-spotlight-caption')).not.toBeNull()
    expect(card.querySelector('.rv-preset-desc')).toBeNull()
    expect(card.querySelector('.rv-preset-palette')).toBeNull()
    expect(container.querySelector('.rv-preset-more-btn')).toBeNull()
    expect(container.textContent).toContain('Modified')

    await click(card)
    expect(activate).toHaveBeenCalledOnce()

    await click(container.querySelector('[aria-label="Restore Shared Card"]')!)
    expect(restore).toHaveBeenCalledOnce()
    expect(activate).toHaveBeenCalledOnce()
  })

  it('preserves canonical keyboard navigation between cards', async () => {
    await render(
      <div data-preset-grid>
        <ReactPresetCard
          id="first-card"
          title="First Card"
          description="First preset"
          activateLabel="Load First Card"
          onActivate={vi.fn()}
        />
        <ReactPresetCard
          id="second-card"
          title="Second Card"
          description="Second preset"
          activateLabel="Load Second Card"
          onActivate={vi.fn()}
        />
      </div>,
    )

    const first = container.querySelector<HTMLButtonElement>('[data-preset-card-id="first-card"][data-preset-card]')!
    const second = container.querySelector<HTMLButtonElement>('[data-preset-card-id="second-card"][data-preset-card]')!
    first.focus()
    await act(async () => {
      first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    expect(document.activeElement).toBe(second)
  })

  it('renders Beam Matrix presets through the shared card and preserves apply, modified, restore, search, and filters', async () => {
    useReactStore.getState().resetLaserDmxBeamMatrix()
    await render(<LaserDmxBeamMatrixPresetBrowser />)

    const card = container.querySelector('[data-preset-card-id="minimal-crossfire"][data-preset-card]')!
    expect(card.classList.contains('rv-preset-card')).toBe(true)
    expect(card.className).not.toContain('rv-laser-dmx-preset-card')
    expect(card.querySelector('[data-thumbnail-kind="beam-matrix"]')).not.toBeNull()

    await click(card)
    expect(useReactStore.getState().activeLaserDmxBeamMatrixPresetId).toBe('minimal-crossfire')
    expect(card.getAttribute('aria-pressed')).toBe('true')

    const beamId = useReactStore.getState().laserDmxBeamMatrix.beams[0].id
    await act(async () => {
      useReactStore.getState().updateLaserDmxMatrixBeam(beamId, { name: 'Edited Beam' })
    })
    expect(container.querySelector('[data-preset-card-id="minimal-crossfire"][data-preset-card-shell]')?.textContent).toContain('Modified')

    await click(container.querySelector('[aria-label="Restore Beam Matrix preset Minimal Crossfire"]')!)
    expect(useReactStore.getState().laserDmxBeamMatrixPresetDirty).toBe(false)
    expect(useReactStore.getState().activeLaserDmxBeamMatrixPresetId).toBe('minimal-crossfire')

    const search = container.querySelector<HTMLInputElement>('[aria-label="Search Beam Matrix presets"]')!
    await input(search, 'cathedral')
    expect(container.querySelectorAll('[data-preset-card]')).toHaveLength(1)
    expect(container.textContent).toContain('Fog Cathedral')

    const filtered = filterLaserDmxBeamMatrixPresets(
      LASER_DMX_BEAM_MATRIX_PRESETS,
      '',
      'drop',
      new Set(['volumetric']),
    )
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every(preset => preset.category === 'drop' && preset.tags.includes('volumetric'))).toBe(true)
  })

  it('renders Show Director templates through the shared card with persistent selected and modified state', async () => {
    await act(async () => {
      useReactStore.setState({
        activeReactEngineId: 'laserDmx',
        laserDmxBeamMatrixAuthoringMode: 'showDirector',
      })
    })
    await render(<ReactPresetsPanel />)

    const card = container.querySelector('[data-preset-card-id="small-club-rig"][data-preset-card]')!
    expect(card.classList.contains('rv-preset-card')).toBe(true)
    expect(card.className).not.toContain('rv-show-director-template-preset-card')
    expect(card.querySelector('[data-thumbnail-kind="show-director"]')).not.toBeNull()

    await click(card)
    expect(useReactStore.getState().laserDmxShowDirector.sourceTemplateId).toBe('small-club-rig')
    expect(useReactStore.getState().laserDmxBeamMatrixPresetDirty).toBe(false)
    expect(card.getAttribute('aria-pressed')).toBe('true')

    await act(async () => {
      useReactStore.getState().updateLaserDmxShowDirectorSettings({
        snapEnabled: false,
        showGrid: false,
        showLabels: false,
        showBeams: false,
        highlightFixtures: false,
      })
    })
    expect(useReactStore.getState().laserDmxBeamMatrixPresetDirty).toBe(false)
    expect(container.querySelector('[data-preset-card-id="small-club-rig"][data-preset-card-shell]')?.textContent).not.toContain('Modified')

    await act(async () => {
      useReactStore.getState().applyLaserDmxShowDirectorTemplate('festival-front-beams')
    })
    expect(useReactStore.getState().laserDmxShowDirector.settings).toMatchObject({
      snapEnabled: false,
      showGrid: false,
      showLabels: false,
      showBeams: false,
      highlightFixtures: false,
    })
    expect(useReactStore.getState().laserDmxBeamMatrixPresetDirty).toBe(false)

    await act(async () => {
      useReactStore.getState().applyLaserDmxShowDirectorTemplate('small-club-rig')
    })
    await act(async () => {
      useReactStore.getState().updateLaserDmxShowDirectorSettings({ zoom: 1.2 })
    })
    expect(container.querySelector('[data-preset-card-id="small-club-rig"][data-preset-card-shell]')?.textContent).toContain('Modified')

    await click(container.querySelector('[aria-label="Restore Show Director rig layout Small Club Rig"]')!)
    expect(useReactStore.getState().laserDmxShowDirector.sourceTemplateId).toBe('small-club-rig')
    expect(useReactStore.getState().laserDmxBeamMatrixPresetDirty).toBe(false)
    expect(useReactStore.getState().laserDmxShowDirector.settings).toMatchObject({
      snapEnabled: false,
      showGrid: false,
      showLabels: false,
      showBeams: false,
      highlightFixtures: false,
    })
  })

  it('renders Sound Drawing presets through the shared Spotlight card, same as every other engine', async () => {
    await act(async () => {
      useReactStore.getState().selectReactEngine('oscilloscope')
    })
    await render(<ReactPresetsPanel />)

    const card = container.querySelector<HTMLElement>('[data-preset-card]')!
    expect(card.classList.contains('rv-preset-card')).toBe(true)
    expect(card.classList.contains('rv-preset-spotlight-card')).toBe(true)
    expect(card.classList.contains('rv-shader-scene-card')).toBe(false)
    expect(card.querySelector('.rv-preset-spotlight-thumb')).not.toBeNull()
    expect(card.querySelector('.rv-preset-spotlight-caption')).not.toBeNull()
    expect(card.querySelector('.rv-preset-desc')).toBeNull()
    expect(card.querySelector('.rv-preset-palette')).toBeNull()
    expect(container.querySelector('.rv-preset-more-btn')).toBeNull()
    expect(container.querySelector('.rv-preset-spotlight-action')).not.toBeNull()

    await click(card)
    expect(useReactStore.getState().activeReactPresetId).not.toBeNull()
    expect(card.getAttribute('aria-pressed')).toBe('true')
  })
})
