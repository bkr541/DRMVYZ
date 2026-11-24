// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../stores/reactStore'
import { ReactPresetCard } from '../ReactPresetCard'
import { REACT_ENGINE_IDS, REACT_ENGINE_CATALOG } from '../reactEngineCatalog'
import cinema2Icon from '../../../../assets/preset-engine-icons/icon_Cinema20.svg'
import canvasIcon from '../../../../assets/preset-engine-icons/icon_canvas.svg'
import laserDmxIcon from '../../../../assets/preset-engine-icons/icon_laserdmx.svg'
import pixGridIcon from '../../../../assets/preset-engine-icons/icon_pixgrid.svg'
import headlinerIcon from '../../../../assets/preset-engine-icons/icon_headliner.svg'
import soundDrawingIcon from '../../../../assets/preset-engine-icons/icon_sounddrawing.svg'
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
    expect(card.querySelector('.rv-preset-spotlight-caption')?.textContent).toBe('Shared Card')
    expect(card.querySelector('.rv-preset-frame-scene img')?.getAttribute('src')).toContain('preset-artwork/shared-card.webp')
    expect(card.getAttribute('aria-label')).toBe('Load Shared Card')
    const status = document.getElementById(card.getAttribute('aria-describedby')!)
    expect(status?.querySelector('.rv-preset-poster-selection')).not.toBeNull()
    expect(status?.textContent).toContain('Modified')
    expect(status?.textContent).toContain('Mode')
    expect(card.querySelector('.rv-preset-desc')).toBeNull()
    expect(card.querySelector('.rv-preset-palette')).toBeNull()
    expect(container.querySelector('.rv-preset-more-btn')).toBeNull()

    await click(card)
    expect(activate).toHaveBeenCalledOnce()

    await click(container.querySelector('[aria-label="Restore Shared Card"]')!)
    expect(restore).toHaveBeenCalledOnce()
    expect(activate).toHaveBeenCalledOnce()
  })

  it('maps every live engine to its supplied SVG, independently of preset identity or selection', async () => {
    const expectedIcons = {
      cinema2: cinema2Icon, canvas: canvasIcon, laserDmx: laserDmxIcon,
      pixGrid: pixGridIcon, headliner: headlinerIcon,
      oscilloscope: soundDrawingIcon, xyScope: soundDrawingIcon,
    }
    const activate = vi.fn()
    const favorite = vi.fn()
    await render(<div data-preset-grid>
      {REACT_ENGINE_IDS.map(engineId => (
        <ReactPresetCard key={engineId} id={`future-${engineId}`} engineId={engineId}
          title="New preset" description="" activateLabel="Load new preset" onActivate={activate}
          isActive={engineId === 'cinema2'} isModified={engineId === 'cinema2'}
          onToggleFavorite={favorite} />
      ))}
      <ReactPresetCard id="row" engineId="canvas" layout="row" title="Row" description=""
        activateLabel="Load row" onActivate={activate} />
      <ReactPresetCard id="unscoped" title="Unscoped" description=""
        activateLabel="Load unscoped" onActivate={activate} />
    </div>)
    for (const engineId of REACT_ENGINE_IDS) {
      const card = container.querySelector(`[data-preset-card][data-preset-card-id="future-${engineId}"]`)!
      const badge = card.querySelector(`[data-preset-engine-badge="${engineId}"]`)
      const image = badge?.querySelector('img')
      expect(card.querySelectorAll('[data-preset-engine-badge]')).toHaveLength(1)
      expect(image?.getAttribute('src')).toBe(expectedIcons[engineId])
      expect(image?.alt).toBe(REACT_ENGINE_CATALOG[engineId].label)
      expect(card.getAttribute('aria-describedby')?.split(' ')).toContain(image?.id)
    }
    const active = container.querySelector('[data-preset-card-shell][data-preset-card-id="future-cinema2"]')!
    expect(active.querySelector('.rv-preset-poster-selection')).not.toBeNull()
    expect(active.textContent).toContain('Modified')
    await click(active.querySelector('[data-preset-engine-badge] img')!)
    expect(activate).toHaveBeenCalledOnce()
    await click(active.querySelector('.rv-preset-spotlight-action--favorite')!)
    expect(favorite).toHaveBeenCalledOnce()
    expect(activate).toHaveBeenCalledOnce()
    expect(container.querySelector('[data-preset-card][data-preset-card-id="row"] [data-preset-engine-badge="canvas"]')).not.toBeNull()
    expect(container.querySelector('[data-preset-card][data-preset-card-id="unscoped"] [data-preset-engine-badge]')).toBeNull()
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
    expect(card.querySelector('[data-preset-engine-badge="laserDmx"]')).not.toBeNull()
    expect(card.classList.contains('rv-preset-card')).toBe(true)
    expect(card.className).not.toContain('rv-laser-dmx-preset-card')
    // The shared poster uses a preset-specific renderer frame behind its centered title.
    expect(card.classList.contains('rv-preset-spotlight-card--poster')).toBe(true)
    expect(card.querySelector('[data-thumbnail-kind="blueprint"]')).not.toBeNull()

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

    const categorySearch = filterLaserDmxBeamMatrixPresets(
      LASER_DMX_BEAM_MATRIX_PRESETS,
      'atmospheric',
      null,
      new Set(),
    )
    expect(categorySearch.length).toBeGreaterThan(0)
    expect(categorySearch.some(preset => preset.category === 'atmospheric')).toBe(true)
  })

  it('keeps legacy CANVAS effect recipes available internally but removes them from the visible preset catalog', async () => {
    await act(async () => {
      useReactStore.getState().selectReactEngine('canvas')
      useReactStore.setState({
        selectedCanvasPresetId: 'canvas-bass-bloom',
        canvasPresetOverride: {
          source: 'auto',
          presetId: 'canvas-bass-bloom',
          label: 'Auto: compatibility recipe',
        },
      })
    })
    await render(<ReactPresetsPanel />)

    // Legacy effect recipes are hidden; Clean Playback is also uncarded — it is
    // the implicit base look CANVAS always starts on, not a preset the user picks.
    for (const hidden of ['Bass Bloom', 'Ghost Echo', 'Glitch Pulse', 'Luma Melt', 'Frame Stutter', 'Clean Playback']) {
      expect(container.querySelector(`[aria-label="Load ${hidden}"]`)).toBeNull()
    }
    for (const retained of ['Particle Aura', 'Fractures', 'Laser Image FX', 'CUTBANK']) {
      expect(container.querySelector(`[aria-label="Load ${retained}"]`)).not.toBeNull()
      expect(container.querySelector(`[aria-label="Load ${retained}"] [data-preset-engine-badge="canvas"]`)).not.toBeNull()
    }

    expect(useReactStore.getState().selectedCanvasPresetId).toBe('canvas-bass-bloom')
    expect(container.textContent).not.toContain('CANVAS Media Presets')
    expect(container.textContent).not.toContain('Bass Bloom')
  })

  it('selects CUTBANK from the CANVAS preset picker and loads its dedicated renderer preset', async () => {
    await act(async () => {
      useReactStore.getState().selectReactEngine('canvas')
    })
    await render(<ReactPresetsPanel />)
    const card = container.querySelector<HTMLElement>('[aria-label="Load CUTBANK"]')
    expect(card).not.toBeNull()
    await act(async () => { card!.click() })
    expect(useReactStore.getState().selectedCanvasPresetId).toBe('canvas-cutbank')
    expect(useReactStore.getState().canvasPresetSettings.cutbank.paletteMode).toBe('monochrome')
  })

  it('renders Show Director templates through the shared card with persistent selected and modified state', async () => {
    await act(async () => {
      useReactStore.setState({
        activeReactEngineId: 'laserDmx',
        laserDmxBeamMatrixAuthoringMode: 'showDirector',
      })
    })
    await render(<ReactPresetsPanel />)

    const laserCards = [...container.querySelectorAll('[data-preset-card]')]
    expect(laserCards.length).toBeGreaterThan(0)
    expect(laserCards.every(card => card.querySelector('[data-preset-engine-badge="laserDmx"]'))).toBe(true)
    const card = container.querySelector('[data-preset-card-id="small-club-rig"][data-preset-card]')!
    expect(card.querySelector('[data-preset-engine-badge="laserDmx"]')).not.toBeNull()
    expect(card.classList.contains('rv-preset-card')).toBe(true)
    expect(card.className).not.toContain('rv-show-director-template-preset-card')
    expect(card.classList.contains('rv-preset-spotlight-card--poster')).toBe(true)
    expect(card.querySelector('[data-thumbnail-kind="blueprint"]')).not.toBeNull()

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

  it('labels every visible PixGrid preset using its owning engine', async () => {
    await act(async () => {
      useReactStore.getState().selectReactEngine('pixGrid')
    })
    await render(<ReactPresetsPanel />)
    const cards = [...container.querySelectorAll('[data-preset-card]')]
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.every(card => card.querySelector('[data-preset-engine-badge="pixGrid"]'))).toBe(true)
  })

  it('renders Sound Drawing presets through the shared Spotlight card, same as every other engine', async () => {
    await act(async () => {
      useReactStore.getState().selectReactEngine('oscilloscope')
    })
    await render(<ReactPresetsPanel />)

    const card = container.querySelector<HTMLElement>('[data-preset-card]')!
    expect(card.querySelector('[data-preset-engine-badge="oscilloscope"]')).not.toBeNull()
    expect(card.classList.contains('rv-preset-card')).toBe(true)
    expect(card.classList.contains('rv-preset-spotlight-card')).toBe(true)
    expect(card.classList.contains('rv-shader-scene-card')).toBe(false)
    expect(card.querySelector('.rv-preset-spotlight-thumb')).not.toBeNull()
    expect(card.querySelector('.rv-preset-spotlight-caption')).not.toBeNull()
    expect(card.querySelector('.rv-preset-frame-scene [data-thumbnail-kind="standard"]')).not.toBeNull()
    expect(card.querySelector('.rv-preset-spotlight-caption .rv-preset-poster-chip')).toBeNull()
    expect(card.querySelector('.rv-preset-desc')).toBeNull()
    expect(card.querySelector('.rv-preset-palette')).toBeNull()
    expect(container.querySelector('.rv-preset-more-btn')).toBeNull()
    expect(container.querySelector('.rv-preset-spotlight-action')).not.toBeNull()

    await click(card)
    expect(useReactStore.getState().activeReactPresetId).not.toBeNull()
    expect(card.getAttribute('aria-pressed')).toBe('true')
  })
})
