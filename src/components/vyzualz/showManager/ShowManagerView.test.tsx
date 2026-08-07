// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  audio: {
    analyserMaster: null,
    currentTrackId: 'audio-track-1',
    currentTrack: {
      id: 'audio-track-1',
      displayName: 'Selected Audio Track',
      artist: 'DVYDRM',
    },
    currentTime: 42,
    duration: 240,
    isPlaying: false,
    getCurrentTime: () => 42,
    currentEffectiveBpm: 128,
    currentEffectiveBeatGrid: [
      { timeSec: 0, beatIndex: 0, isDownbeat: true },
      { timeSec: 0.46875, beatIndex: 1, isDownbeat: false },
    ],
    currentAnalysis: {
      beatGridOffsetSec: 0.02,
      sections: [{
        id: 'section-1',
        label: 'Intro',
        type: 'intro',
        startSec: 0,
        endSec: 64,
        intensity: 0.35,
        confidence: 0.9,
        source: 'automatic',
      }],
    },
  },
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
    pixGridDecks: [],
    renamePixGridDeck: vi.fn(),
    updatePixGridDeck: vi.fn(),
    deletePixGridDeck: vi.fn(),
    createPixGridDeckPreset: vi.fn(),
    reactIntensity: 1,
    reactMotion: 0.5,
    reactGlow: 0.5,
    reactBassReactivity: 0.5,
    pixGridActionCuesByTrackId: {},
    manualTrackSectionsByTrackId: {},
    suppressedAutoSectionsByTrackId: {},
    laserDmxShowManagerShows: [{
      schemaVersion: 2,
      id: 'laser-show-1',
      name: 'Untitled Show',
      settings: {
        showGrid: true,
        showLabels: true,
        showBeams: true,
        highlightGrid: true,
        rendererMode: 'auto',
      },
      sections: [
        ['intro', 'Intro'],
        ['verse', 'Verse'],
        ['build', 'Build'],
        ['preDrop', 'Pre-Drop'],
        ['drop', 'Drop'],
        ['breakdown', 'Breakdown'],
        ['outro', 'Outro'],
      ].map(([type, label], index) => ({
        id: `laser-show-1:section:${type}:${index + 1}`,
        type,
        label,
        startSec: index,
        endSec: index + 1,
        intensity: 0.5,
        engineId: 'laserDmx',
        source: 'user-created',
        fixtures: [],
      })),
    }],
    laserDmxShowManagerEditingShowId: 'laser-show-1',
    laserDmxShowManagerEditingSectionId: 'laser-show-1:section:intro:1',
    createLaserDmxShowManagerShow: vi.fn(() => 'laser-show-2'),
    ensureLaserDmxShowManagerShow: vi.fn(() => 'laser-show-1'),
    selectLaserDmxShowManagerSection: vi.fn(),
    updateLaserDmxShowManagerSection: vi.fn(),
    updateLaserDmxShowManagerWorkspaceSettings: vi.fn(),
    addLaserDmxShowManagerSection: vi.fn(),
    removeLaserDmxShowManagerSection: vi.fn(),
    reorderLaserDmxShowManagerSection: vi.fn(),
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
  useSharedAudio: () => fixture.audio,
}))

vi.mock('../../../stores/reactStore', () => {
  const useReactStore = (selector: (state: typeof fixture.state) => unknown) => selector(fixture.state)
  Object.assign(useReactStore, {
    getState: () => fixture.state,
    setState: (update: Partial<typeof fixture.state> | ((state: typeof fixture.state) => Partial<typeof fixture.state>)) => {
      const patch = typeof update === 'function' ? update(fixture.state) : update
      Object.assign(fixture.state, patch)
    },
  })
  return { useReactStore }
})

vi.mock('../react/pixGrid/PixGridSurface', () => ({
  PixGridSurface: ({
    trackIdentity,
    durationSec,
    audioTimeSec,
    trackSections,
    trackAnalysis,
  }: {
    trackIdentity?: string | null
    durationSec?: number
    audioTimeSec?: number
    trackSections?: readonly unknown[]
    trackAnalysis?: unknown
  }) => (
    <div
      data-testid="pix-grid-surface"
      data-track-identity={trackIdentity ?? ''}
      data-duration-sec={durationSec}
      data-audio-time-sec={audioTimeSec}
      data-track-section-count={trackSections?.length ?? 0}
      data-has-track-analysis={trackAnalysis ? 'true' : 'false'}
    >
      PixGrid preview
    </div>
  ),
}))

vi.mock('../react/pixGrid/PixGridDesignPanel', () => ({
  PixGridDesignPanel: ({ groupedSections }: { groupedSections?: boolean }) => (
    <div data-testid="pix-grid-design-panel" data-grouped={groupedSections ? 'true' : 'false'}>
      PixGrid design controls
    </div>
  ),
}))

vi.mock('../react/pixGrid/PixGridDeckCompilerRuntime', () => ({
  usePixGridDeckCompilerStore: (selector: (state: { statuses: {}; transitionStatuses: {} }) => unknown) => selector({
    statuses: {},
    transitionStatuses: {},
  }),
  getPixGridPreparedFrameSet: () => null,
}))

vi.mock('../react/pixGrid/PixGridDeckMediaService', () => ({
  ingestPixGridDeckSourceFiles: vi.fn(),
}))

vi.mock('../react/ReactPresetThumbnail', () => ({
  ReactPresetThumbnail: () => <div data-testid="preset-thumbnail" />,
}))

vi.mock('../shared/VyzualzAudioDock', () => ({
  VyzualzAudioDock: ({
    expandable,
    unifiedTimeline,
    waveformAppearance,
  }: {
    expandable?: boolean
    unifiedTimeline?: boolean
    waveformAppearance?: string
  }) => (
    <div
      data-testid="show-manager-audio-dock"
      data-expandable={expandable ? 'true' : 'false'}
      data-unified-timeline={unifiedTimeline ? 'true' : 'false'}
      data-waveform-appearance={waveformAppearance}
      data-track-id={fixture.audio.currentTrackId ?? ''}
    >
      <span>{fixture.audio.currentTrack?.displayName}</span>
      <span>{fixture.audio.currentTrack?.artist}</span>
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

describe('ShowManagerView production shell', () => {
  it('uses the shared dropdown in the left rail and enables only the Stage 1 production engines', async () => {
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
    expect(options.find(option => option.textContent?.includes('LaserDMX'))?.getAttribute('aria-disabled')).toBeNull()
    expect(options.filter(option => !option.textContent?.includes('PixGrid') && !option.textContent?.includes('LaserDMX'))
      .every(option => option.getAttribute('aria-disabled') === 'true')).toBe(true)
    expect(container.querySelector('[data-testid="pix-grid-surface"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="pix-grid-design-panel"]')?.getAttribute('data-grouped')).toBe('true')
    expect(container.querySelector('[aria-label="Show Manager track map preview"]')).not.toBeNull()
  })

  it('enters the production LaserDMX path with no audio and exposes the canonical seven Show-owned sections', async () => {
    const originalAudio = {
      currentTrackId: fixture.audio.currentTrackId,
      currentTrack: fixture.audio.currentTrack,
      currentAnalysis: fixture.audio.currentAnalysis,
      currentEffectiveBpm: fixture.audio.currentEffectiveBpm,
      currentEffectiveBeatGrid: fixture.audio.currentEffectiveBeatGrid,
      duration: fixture.audio.duration,
      currentTime: fixture.audio.currentTime,
    }
    Object.assign(fixture.audio, {
      currentTrackId: null,
      currentTrack: null,
      currentAnalysis: null,
      currentEffectiveBpm: null,
      currentEffectiveBeatGrid: [],
      duration: 0,
      currentTime: 0,
    })

    try {
      container = document.createElement('div')
      document.body.appendChild(container)
      root = createRoot(container)

      await act(async () => {
        root?.render(<ShowManagerView />)
        await Promise.resolve()
      })

      const engineTrigger = container.querySelector<HTMLButtonElement>('button[aria-label="Show Manager engine"]')
      await act(async () => {
        engineTrigger?.click()
        await Promise.resolve()
      })
      const engineMenu = document.body.querySelector('.drm-dropdown__menu[role="listbox"]')
      const laserOption = [...(engineMenu?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])]
        .find(option => option.textContent?.includes('LaserDMX'))
      await act(async () => {
        laserOption?.click()
        await Promise.resolve()
      })

      expect(fixture.state.ensureLaserDmxShowManagerShow).toHaveBeenCalled()
      expect(container.querySelector('[aria-label="LaserDMX Part 1 stage foundation"]')).not.toBeNull()
      expect(container.querySelector('[aria-label="Show Manager LaserDMX section timeline"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="pix-grid-surface"]')).toBeNull()
      expect(container.textContent).toContain('18 × 12')
      for (const label of ['Intro', 'Verse', 'Build', 'Pre-Drop', 'Drop', 'Breakdown', 'Outro']) {
        expect(container.textContent).toContain(label)
      }
      expect(container.querySelector('[data-testid="show-manager-audio-dock"]')?.getAttribute('data-track-id')).toBe('')
    } finally {
      Object.assign(fixture.audio, originalAudio)
    }
  })

  it('renders the Stage 2 LaserDMX library and workspace controls through the production Show Manager path', async () => {
    fixture.state.updateLaserDmxShowManagerWorkspaceSettings.mockClear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<ShowManagerView />)
      await Promise.resolve()
    })

    const engineTrigger = container.querySelector<HTMLButtonElement>('button[aria-label="Show Manager engine"]')
    await act(async () => {
      engineTrigger?.click()
      await Promise.resolve()
    })
    const laserOption = [...document.body.querySelectorAll<HTMLElement>('.drm-dropdown__menu [role="option"]')]
      .find(option => option.textContent?.includes('LaserDMX'))
    await act(async () => {
      laserOption?.click()
      await Promise.resolve()
    })

    const library = container.querySelector<HTMLElement>('.sm-library')
    const topLevelGroups = [...(library?.querySelectorAll<HTMLElement>('.sm-library-section') ?? [])]
      .filter(section => section.parentElement === library)
    expect(topLevelGroups).toHaveLength(2)
    expect(topLevelGroups.map(section => section.querySelector('.sm-library-section-toggle strong')?.textContent)).toEqual([
      'Lighting Components',
      'Workspace',
    ])

    const fixtureRows = [...container.querySelectorAll<HTMLButtonElement>('.sm-library-row--fixture')]
    expect(fixtureRows).toHaveLength(10)
    const enabledLabels = fixtureRows.filter(row => !row.disabled).map(row => row.querySelector(':scope > span:nth-child(3)')?.textContent)
    expect(enabledLabels).toEqual(['Laser', 'Moving Head', 'LED Bar', 'Strobe'])
    expect(fixtureRows.filter(row => row.disabled)).toHaveLength(6)
    expect(fixtureRows.find(row => row.textContent?.includes('LED Tube'))?.draggable).toBe(false)
    expect(fixtureRows.find(row => row.textContent?.includes('Laser'))?.draggable).toBe(true)

    const laserRow = fixtureRows.find(row => row.textContent?.includes('Laser'))
    await act(async () => {
      laserRow?.click()
      await Promise.resolve()
    })
    expect(laserRow?.getAttribute('aria-pressed')).toBe('true')

    expect(container.textContent).toContain('Display Settings')
    expect(container.textContent).toContain('Render Settings')
    for (const label of ['Show Grid', 'Show Labels', 'Show Beams', 'Highlight Grid']) {
      expect(container.textContent).toContain(label)
    }

    const gridSize = container.querySelector<HTMLButtonElement>('button[aria-label="Grid Size"]')
    const renderer = container.querySelector<HTMLButtonElement>('button[aria-label="Lighting Renderer"]')
    const quality = container.querySelector<HTMLButtonElement>('button[aria-label="Quality"]')
    expect(gridSize?.disabled).toBe(true)
    expect(gridSize?.textContent).toContain('18 × 12')
    expect(renderer?.disabled).toBe(false)
    expect(renderer?.textContent).toContain('Auto with Fallback')
    expect(quality?.disabled).toBe(true)
    expect(quality?.textContent).toContain('High')

    const showGridRow = [...container.querySelectorAll<HTMLElement>('.rv-ctrl-toggle-row')]
      .find(row => row.textContent?.includes('Show Grid'))
    const showGridToggle = showGridRow?.querySelector<HTMLButtonElement>('.rv-ctrl-toggle')
    await act(async () => {
      showGridToggle?.click()
      await Promise.resolve()
    })
    expect(fixture.state.updateLaserDmxShowManagerWorkspaceSettings).toHaveBeenCalledWith(
      'laser-show-1',
      { showGrid: false },
    )
    expect(container.querySelector<HTMLButtonElement>('button[title="Undo section edit"]')?.disabled).toBe(false)

    await act(async () => {
      renderer?.click()
      await Promise.resolve()
    })
    const rendererOptions = [...document.body.querySelectorAll<HTMLElement>('.drm-dropdown__menu [role="option"]')]
      .map(option => option.textContent?.trim())
    expect(rendererOptions).toEqual(expect.arrayContaining([
      expect.stringContaining('Canvas2D (Compatibility)'),
      expect.stringContaining('WebGL2'),
      expect.stringContaining('Auto with Fallback'),
    ]))
  })

  it('records section edits in the production LaserDMX history controls and exposes undo/redo', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<ShowManagerView />)
      await Promise.resolve()
    })

    const engineTrigger = container.querySelector<HTMLButtonElement>('button[aria-label="Show Manager engine"]')
    await act(async () => {
      engineTrigger?.click()
      await Promise.resolve()
    })
    const laserOption = [...(document.body.querySelectorAll<HTMLElement>('.drm-dropdown__menu [role="option"]'))]
      .find(option => option.textContent?.includes('LaserDMX'))
    await act(async () => {
      laserOption?.click()
      await Promise.resolve()
    })

    const labelInput = [...container.querySelectorAll<HTMLInputElement>('input[type="text"]')]
      .find(input => input.value === 'Intro')
    expect(labelInput).toBeDefined()
    await act(async () => {
      if (!labelInput) return
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(labelInput, 'Opening')
      labelInput.dispatchEvent(new Event('input', { bubbles: true }))
      await Promise.resolve()
    })

    const saveChanges = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent?.trim() === 'Save Changes')
    await act(async () => {
      saveChanges?.click()
      await Promise.resolve()
    })

    expect(fixture.state.updateLaserDmxShowManagerSection).toHaveBeenCalledWith(
      'laser-show-1',
      'laser-show-1:section:intro:1',
      expect.objectContaining({ label: 'Opening' }),
    )
    const undo = container.querySelector<HTMLButtonElement>('button[title="Undo section edit"]')
    const redo = container.querySelector<HTMLButtonElement>('button[title="Redo section edit"]')
    expect(undo?.disabled).toBe(false)
    expect(redo?.disabled).toBe(true)

    await act(async () => {
      undo?.click()
      await Promise.resolve()
    })
    expect(redo?.disabled).toBe(false)
  })

  it('mounts the shared Audio Dock and feeds the selected track into Show Manager rendering', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<ShowManagerView />)
      await Promise.resolve()
    })

    const workspace = container.querySelector<HTMLElement>('[aria-label="Show Manager workspace"]')
    const dock = container.querySelector<HTMLElement>('[data-testid="show-manager-audio-dock"]')
    const surface = container.querySelector<HTMLElement>('[data-testid="pix-grid-surface"]')

    expect(workspace?.classList.contains('rv-shell')).toBe(true)
    expect(dock?.parentElement).toBe(workspace)
    expect(dock?.getAttribute('data-expandable')).toBe('true')
    expect(dock?.getAttribute('data-unified-timeline')).toBe('true')
    expect(dock?.getAttribute('data-waveform-appearance')).toBe('deck')
    expect(dock?.getAttribute('data-track-id')).toBe('audio-track-1')
    expect(dock?.textContent).toContain('Selected Audio Track')
    expect(dock?.textContent).toContain('DVYDRM')

    expect(surface?.getAttribute('data-track-identity')).toBe('audio-track-1')
    expect(surface?.getAttribute('data-duration-sec')).toBe('240')
    expect(surface?.getAttribute('data-audio-time-sec')).toBe('42')
    expect(surface?.getAttribute('data-track-section-count')).toBe('1')
    expect(surface?.getAttribute('data-has-track-analysis')).toBe('true')
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

  it('places Create Deck in the PixGrid Preset inspector and enters Builder mode without replacing the shared shell', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<ShowManagerView />)
      await Promise.resolve()
    })

    const createButtons = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .filter(button => button.textContent?.trim() === 'Create Deck')
    expect(createButtons).toHaveLength(1)
    expect(createButtons[0]?.closest('.sm-inspector')).not.toBeNull()
    expect(createButtons[0]?.closest('.sm-library')).toBeNull()
    expect(container.querySelector('[aria-label="Previous Deck image"]')).toBeNull()
    expect(container.querySelector('[aria-label="Next Deck image"]')).toBeNull()

    await act(async () => {
      createButtons[0]?.click()
      await Promise.resolve()
    })

    expect(container.querySelector('.sm-title-block')?.textContent).toContain('DECK BUILDER')
    expect(container.querySelector('[aria-label="Show Manager Deck images"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Show Manager Deck Builder inspector"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="pix-grid-surface"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="show-manager-audio-dock"]')?.textContent).toContain('Selected Audio Track')
    expect(container.querySelector('input[type="file"][accept="image/png,image/jpeg,image/svg+xml,image/webp"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Previous Deck image"]')).toBeNull()
    expect(container.querySelector('[aria-label="Next Deck image"]')).toBeNull()

    const backButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent?.trim() === 'Back to Show Manager')
    await act(async () => {
      backButton?.click()
      await new Promise(resolve => window.setTimeout(resolve, 0))
    })
    const restoredCreateButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent?.trim() === 'Create Deck')
    expect(document.activeElement).toBe(restoredCreateButton)
  })

})
