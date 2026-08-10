// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  laserRuntimePreviewProps: [] as Array<Record<string, unknown>>,
  media: {
    items: [{
      id: 'media-video-1',
      name: 'aurora-loop.mp4',
      title: 'Aurora Loop',
      type: 'video',
      url: 'blob:aurora-loop',
      thumbnailUrl: null,
      meta: 'MP4 · 0:08',
      favorite: false,
      mediaRole: 'background_video',
      tags: [],
      collectionIds: [],
      metadata: { duration: 8 },
      mimeType: 'video/mp4',
    }],
  },
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
    selectReactPreset: vi.fn(),
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
    laserDmxShowManagerPlaybackSectionId: null as string | null,
    laserDmxShowManagerActiveShowId: null as string | null,
    showManagerUndoStack: [] as unknown[],
    showManagerRedoStack: [] as unknown[],
    createLaserDmxShowManagerShow: vi.fn(() => 'laser-show-2'),
    ensureLaserDmxShowManagerShow: vi.fn(() => 'laser-show-1'),
    selectLaserDmxShowManagerSection: vi.fn(),
    updateLaserDmxShowManagerSection: vi.fn(),
    updateLaserDmxShowManagerWorkspaceSettings: vi.fn(),
    addLaserDmxShowManagerSection: vi.fn(),
    removeLaserDmxShowManagerSection: vi.fn(),
    reorderLaserDmxShowManagerSection: vi.fn(),
    addLaserDmxShowManagerFixture: vi.fn(() => 'laser-fixture-new'),
    updateLaserDmxShowManagerFixture: vi.fn(),
    removeLaserDmxShowManagerFixture: vi.fn(),
    copyLaserDmxShowManagerFixturesFromSection: vi.fn((_showId: string, _sourceSectionId: string, _destinationSectionId: string) => [] as string[]),
    updateLaserDmxShowManagerSectionBoundary: vi.fn(),
    undoLaserDmxShowManagerEdit: vi.fn(),
    redoLaserDmxShowManagerEdit: vi.fn(),
    saveLaserDmxShowManagerShow: vi.fn(async () => true),
    canvasShowManagerShows: [],
    canvasShowManagerActiveShowId: null as string | null,
    canvasShowManagerEditingShowId: null as string | null,
    canvasShowManagerEditingSectionId: null as string | null,
    canvasShowManagerEditingElementId: null as string | null,
    canvasShowManagerUndoStack: [] as unknown[],
    canvasShowManagerRedoStack: [] as unknown[],
    canvasShowManagerHistoryTransaction: null as unknown,
    canvasMediaItems: [],
    canvasMediaTimingById: {} as Record<string, unknown>,
    createCanvasShowManagerShow: vi.fn(() => 'canvas-show-1' as string | null),
    selectCanvasShowManagerShow: vi.fn(),
    selectCanvasShowManagerSection: vi.fn(),
    selectCanvasShowManagerMediaElement: vi.fn(),
    renameCanvasShowManagerShow: vi.fn(() => true),
    updateCanvasShowManagerSectionDuration: vi.fn(),
    addCanvasShowManagerMediaElement: vi.fn(),
    updateCanvasShowManagerMediaElement: vi.fn(),
    removeCanvasShowManagerMediaElement: vi.fn(() => true),
    deleteCanvasShowManagerShow: vi.fn(() => true),
    undoCanvasShowManagerEdit: vi.fn(),
    redoCanvasShowManagerEdit: vi.fn(),
    beginCanvasShowManagerHistoryTransaction: vi.fn(),
    commitCanvasShowManagerHistoryTransaction: vi.fn(),
    cancelCanvasShowManagerHistoryTransaction: vi.fn(),
    saveCanvasShowManagerShow: vi.fn(async () => true),
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

vi.mock('../../../stores/mediaStore', () => ({
  useMediaStore: (selector: (state: typeof fixture.media) => unknown) => selector(fixture.media),
}))

vi.mock('../media/MediaLibraryBrowser', () => ({
  MediaLibraryBrowser: ({ onSelect }: { onSelect?: (mediaId: string) => void }) => (
    <div data-testid="mock-media-library-browser">
      <input type="search" aria-label="Search media" />
      <button
        type="button"
        draggable
        onClick={() => onSelect?.('media-video-1')}
        onDragStart={event => event.dataTransfer.setData('vz/mediaId', 'media-video-1')}
      >Aurora Loop</button>
    </div>
  ),
}))

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

vi.mock('../react/ReactPlaceholderCanvas', () => ({
  ReactPlaceholderCanvas: (props: Record<string, unknown>) => {
    fixture.laserRuntimePreviewProps.push(props)
    const programs = Array.isArray(props.laserDmxSectionRuntimePrograms)
      ? props.laserDmxSectionRuntimePrograms as Array<{ section: { id: string }; showDirector: { fixtures: Array<{ id: string }> } }>
      : []
    return (
      <div
        data-testid="laser-dmx-runtime-preview"
        data-program-count={programs.length}
        data-runtime-section-ids={programs.map(program => program.section.id).join(',')}
      />
    )
  },
}))

vi.mock('../react/ReactCanvasEngineShell', () => ({
  CanvasEngineSurface: ({ previewSelectedElementId, showRuntimeStatus }: { previewSelectedElementId?: string | null; showRuntimeStatus?: boolean }) => (
    <canvas
      data-testid="canvas-runtime-preview-surface"
      data-selected-element-id={previewSelectedElementId ?? ''}
      data-runtime-status={showRuntimeStatus === false ? 'hidden' : 'visible'}
    />
  ),
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

import { createDefaultLaserDmxShowDirectorFixture } from '../react/ReactTypes'
import {
  copyLaserDmxShowManagerFixturesBetweenSections,
  removeLaserDmxShowManagerFixtureFromSection,
} from './LaserDmxShowManagerDomain'
import { ShowManagerView } from './ShowManagerView'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

afterEach(() => {
  fixture.laserRuntimePreviewProps.length = 0
  fixture.state.laserDmxShowManagerPlaybackSectionId = null
  fixture.state.showManagerUndoStack = []
  fixture.state.showManagerRedoStack = []
  fixture.state.undoLaserDmxShowManagerEdit.mockClear()
  fixture.state.redoLaserDmxShowManagerEdit.mockClear()
  fixture.state.saveLaserDmxShowManagerShow.mockClear()
  fixture.state.selectReactPreset.mockClear()
  fixture.state.createCanvasShowManagerShow.mockClear()
  fixture.state.selectCanvasShowManagerShow.mockClear()
  fixture.state.saveCanvasShowManagerShow.mockClear()
  fixture.state.addCanvasShowManagerMediaElement.mockReset()
  fixture.state.updateCanvasShowManagerMediaElement.mockReset()
  fixture.state.removeCanvasShowManagerMediaElement.mockReset()
  fixture.state.canvasShowManagerShows = []
  fixture.state.canvasShowManagerEditingShowId = null
  fixture.state.canvasShowManagerEditingSectionId = null
  fixture.state.canvasShowManagerEditingElementId = null
  fixture.audio.isPlaying = false
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

describe('ShowManagerView production shell', () => {
  it('uses the shared dropdown in the left rail and enables the production Show Manager engines', async () => {
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
    expect(options).toHaveLength(5)
    expect(options.find(option => option.textContent?.includes('PixGrid'))?.getAttribute('aria-disabled')).toBeNull()
    expect(options.find(option => option.textContent?.includes('LaserDMX'))?.getAttribute('aria-disabled')).toBeNull()
    expect(options.find(option => option.textContent?.includes('CANVAS'))?.getAttribute('aria-disabled')).toBeNull()
    expect(options.filter(option => !option.textContent?.includes('PixGrid')
      && !option.textContent?.includes('LaserDMX')
      && !option.textContent?.includes('CANVAS'))
      .every(option => option.getAttribute('aria-disabled') === 'true')).toBe(true)
    expect(container.querySelector('[data-testid="pix-grid-surface"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="pix-grid-design-panel"]')?.getAttribute('data-grouped')).toBe('true')
    expect(container.querySelector('[aria-label="Show Manager track map preview"]')).not.toBeNull()
  })

  it('gives PixGrid the shared file actions and LaserDMX section-strip styling', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<ShowManagerView />)
      await Promise.resolve()
    })

    const fileActions = container.querySelector<HTMLElement>('[aria-label="Show file actions"]')
    expect(fileActions?.querySelectorAll('button')).toHaveLength(3)
    expect(fileActions?.textContent?.trim()).toBe('')

    const trackMap = container.querySelector<HTMLElement>('[aria-label="Show Manager track map preview"]')
    const sectionRegion = trackMap?.querySelector<HTMLElement>('.sm-timeline-row--sections .rv-section-region')
    expect(sectionRegion).not.toBeNull()
    expect(sectionRegion?.style.getPropertyValue('--section-color')).toBe('#61d6aa')
    expect([...(trackMap?.querySelectorAll<HTMLButtonElement>('.sm-timeline-tabs button') ?? [])]
      .map(button => button.textContent?.trim())).toEqual(['Track Map'])

    await act(async () => {
      fileActions?.querySelector<HTMLButtonElement>('button[aria-label="Open Show"]')?.click()
      await Promise.resolve()
    })
    const browser = container.querySelector<HTMLElement>('.sm-show-browser[role="dialog"]')
    expect(browser?.textContent).toContain('Test PixGrid')
    expect(browser?.textContent).toContain('PixGrid Preset')
    await act(async () => {
      browser?.querySelector<HTMLButtonElement>('.sm-show-browser-footer .is-primary')?.click()
      await Promise.resolve()
    })

    await act(async () => {
      fileActions?.querySelector<HTMLButtonElement>('button[aria-label="Save + Make Active"]')?.click()
      await Promise.resolve()
    })
    expect(fixture.state.selectReactPreset).toHaveBeenCalledWith('pix-grid-test')

    await act(async () => {
      fileActions?.querySelector<HTMLButtonElement>('button[aria-label="New Show"]')?.click()
      await Promise.resolve()
    })
    expect(container.querySelector('.sm-title-block')?.textContent).toContain('DECK BUILDER')
  })

  it('enters Canvas through the production engine selector and requests only a Show name', async () => {
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
    const canvasOption = [...(engineMenu?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])]
      .find(option => option.textContent?.includes('CANVAS'))
    await act(async () => {
      canvasOption?.click()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="canvas-show-manager-empty-state"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Show Manager Canvas media timeline"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="pix-grid-surface"]')).toBeNull()

    const newShowButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent === 'New Show')
    await act(async () => {
      newShowButton?.click()
      await Promise.resolve()
    })
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog?.textContent).toContain('New Canvas Show')
    expect(dialog?.querySelector('input#canvas-new-show-name')).not.toBeNull()
    expect(dialog?.querySelectorAll('input')).toHaveLength(1)
    expect(dialog?.querySelector('input[type="file"]')).toBeNull()
    expect(dialog?.textContent).toContain('Media is added afterward')
  })

  it('opens Shows from an icon-only header action and directory-style browser', async () => {
    fixture.state.canvasShowManagerShows = [{
      schemaVersion: 3,
      id: 'canvas-show-library',
      name: 'Festival Visuals',
      sections: [{
        id: 'canvas-show-library:section:intro:1',
        type: 'intro',
        label: 'Intro',
        durationSec: 8,
      }],
      mediaElements: [],
    }] as typeof fixture.state.canvasShowManagerShows
    fixture.state.canvasShowManagerEditingShowId = 'canvas-show-library'

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
    const canvasOption = [...document.body.querySelectorAll<HTMLElement>('.drm-dropdown__menu [role="option"]')]
      .find(option => option.textContent?.includes('CANVAS'))
    await act(async () => {
      canvasOption?.click()
      await Promise.resolve()
    })

    const fileActions = container.querySelector('[aria-label="Show file actions"]')
    expect(fileActions?.querySelectorAll('button')).toHaveLength(3)
    expect(fileActions?.textContent?.trim()).toBe('')

    await act(async () => {
      fileActions?.querySelector<HTMLButtonElement>('button[aria-label="Open Show"]')?.click()
      await Promise.resolve()
    })

    const browser = container.querySelector<HTMLElement>('.sm-show-browser[role="dialog"]')
    expect(browser?.textContent).toContain('All Shows')
    expect(browser?.textContent).toContain('Festival Visuals')
    expect(browser?.textContent).toContain('1 section · 0 media items')
    expect(browser?.querySelector('input[type="search"]')).not.toBeNull()
    expect(browser?.querySelector('[role="listbox"]')).not.toBeNull()

    await act(async () => {
      browser?.querySelector<HTMLButtonElement>('.sm-show-browser-footer .is-primary')?.click()
      await Promise.resolve()
    })
    expect(fixture.state.selectCanvasShowManagerShow).toHaveBeenCalledWith('canvas-show-library')
    expect(container.querySelector('.sm-show-browser')).toBeNull()
  })

  it('mirrors the LaserDMX Canvas stage and Track Map layout without Canvas-only playhead controls', async () => {
    const sections = [
      ['intro', 'Intro'], ['verse', 'Verse'], ['build', 'Build'], ['preDrop', 'Pre-Drop'],
      ['drop', 'Drop'], ['breakdown', 'Breakdown'], ['outro', 'Outro'],
    ].map(([type, label], index) => ({
      id: `canvas-show-track-map:section:${type}:${index + 1}`,
      type,
      label,
      durationSec: 8,
    }))
    fixture.state.canvasShowManagerShows = [{
      schemaVersion: 3,
      id: 'canvas-show-track-map',
      name: 'Track Map Show',
      sections,
      mediaElements: [],
    }] as typeof fixture.state.canvasShowManagerShows
    fixture.state.canvasShowManagerEditingShowId = 'canvas-show-track-map'
    fixture.state.canvasShowManagerEditingSectionId = sections[0]!.id

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
    const canvasOption = [...document.body.querySelectorAll<HTMLElement>('.drm-dropdown__menu [role="option"]')]
      .find(option => option.textContent?.includes('CANVAS'))
    await act(async () => {
      canvasOption?.click()
      await Promise.resolve()
    })

    const timeline = container.querySelector<HTMLElement>('[aria-label="Show Manager Canvas media timeline"]')
    const sectionRegions = timeline?.querySelectorAll<HTMLElement>('.sm-timeline-row--sections .rv-section-region')
    expect(sectionRegions).toHaveLength(7)
    expect(sectionRegions?.[0]?.style.getPropertyValue('--section-color')).toBe('#61d6aa')
    expect(sectionRegions?.[4]?.style.getPropertyValue('--section-color')).toBe('#c0314a')
    expect(container.querySelector('.sm-canvas-section-grid--compact')).toBeNull()
    expect(timeline?.querySelector('.sm-canvas-section-map')?.parentElement).toBe(timeline)
    expect(timeline?.querySelector('input[aria-label="Canvas Show playhead"]')).toBeNull()
    expect(timeline?.querySelector('.sm-canvas-playhead-control')).toBeNull()

    const stageHeading = container.querySelector<HTMLElement>('.sm-canvas-stage > .sm-laser-stage-heading')
    expect(stageHeading?.textContent).toContain('Track Map Show')
    expect(stageHeading?.textContent).toContain('Editing: Intro')
    expect(container.querySelector('[data-testid="canvas-runtime-preview-surface"]')?.getAttribute('data-runtime-status')).toBe('hidden')

    const library = container.querySelector<HTMLElement>('.sm-library')
    const topLevelGroups = [...(library?.querySelectorAll<HTMLElement>('.sm-library-section') ?? [])]
      .filter(section => section.parentElement === library)
    expect(topLevelGroups).toHaveLength(1)
    expect(topLevelGroups[0]?.querySelector('.sm-library-section-toggle strong')?.textContent).toBe('Components')
    expect(topLevelGroups[0]?.querySelector('[data-testid="canvas-show-manager-media-library"]')).not.toBeNull()
    expect(topLevelGroups[0]?.textContent).not.toContain('Canvas Shows')
  })

  it('uses the shared media drag contract to place a real element on an explicit Canvas layer target', async () => {
    const show = {
      schemaVersion: 3 as const,
      id: 'canvas-show-authoring',
      name: 'Authoring Show',
      sections: [
        ['intro', 'Intro'], ['verse', 'Verse'], ['build', 'Build'], ['preDrop', 'Pre-Drop'],
        ['drop', 'Drop'], ['breakdown', 'Breakdown'], ['outro', 'Outro'],
      ].map(([type, label], index) => ({
        id: `canvas-show-authoring:section:${type}:${index + 1}`,
        type,
        label,
        durationSec: 8,
      })),
      mediaElements: [] as Array<{
        id: string
        mediaId: string
        layer: number
        showStartSec: number
        showEndSec: number
        sourceInSec: number | null
        sourceOutSec: number | null
        display: { scale: number; x: number; y: number; brightness: number; opacity: number; rotation: number }
        transitions: {
          in: { type: 'hardCut' | 'fade' | 'slide' | 'zoom'; durationSec: number; direction: 'left' | 'right' | 'up' | 'down' }
          out: { type: 'hardCut' | 'fade' | 'slide' | 'zoom'; durationSec: number; direction: 'left' | 'right' | 'up' | 'down' }
        }
        fx: { blur: number; contrast: number; saturation: number; hue: number; glow: number }
      }>,
    }
    fixture.state.canvasShowManagerShows = [show] as typeof fixture.state.canvasShowManagerShows
    fixture.state.canvasShowManagerEditingShowId = show.id
    fixture.state.canvasShowManagerEditingSectionId = show.sections[0]!.id
    fixture.state.addCanvasShowManagerMediaElement.mockImplementation(input => {
      if (show.mediaElements.some(element => element.layer === input.layer)) {
        return { ok: false, code: 'overlap', message: `Layer ${input.layer + 1} already contains media in that Show cue range.` }
      }
      const element = {
        id: 'canvas-element-dropped',
        mediaId: input.mediaId,
        layer: input.layer,
        showStartSec: 0,
        showEndSec: 8,
        sourceInSec: 0,
        sourceOutSec: 8,
        display: { scale: 1, x: 0, y: 0, brightness: 1, opacity: 1, rotation: 0 },
        transitions: {
          in: { type: 'hardCut' as const, durationSec: 0.5, direction: 'left' as const },
          out: { type: 'hardCut' as const, durationSec: 0.5, direction: 'left' as const },
        },
        fx: { blur: 0, contrast: 1, saturation: 1, hue: 0, glow: 0 },
      }
      show.mediaElements.push(element)
      fixture.state.canvasShowManagerEditingElementId = element.id
      return { ok: true, show, element }
    })
    fixture.state.updateCanvasShowManagerMediaElement.mockImplementation((_showId, elementId, patch) => {
      const element = show.mediaElements.find(candidate => candidate.id === elementId)!
      Object.assign(element, patch, {
        display: patch.display ? { ...element.display, ...patch.display } : element.display,
        transitions: patch.transitions ? {
          in: { ...element.transitions.in, ...patch.transitions.in },
          out: { ...element.transitions.out, ...patch.transitions.out },
        } : element.transitions,
        fx: patch.fx ? { ...element.fx, ...patch.fx } : element.fx,
      })
      return { ok: true, show, element }
    })

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
    const canvasOption = [...(document.body.querySelectorAll<HTMLElement>('.drm-dropdown__menu [role="option"]'))]
      .find(option => option.textContent?.includes('CANVAS'))
    await act(async () => {
      canvasOption?.click()
      await Promise.resolve()
    })

    const transfer = {
      types: [] as string[],
      values: new Map<string, string>(),
      effectAllowed: 'all',
      dropEffect: 'none',
      setData(type: string, value: string) { this.values.set(type, value); if (!this.types.includes(type)) this.types.push(type) },
      getData(type: string) { return this.values.get(type) ?? '' },
    }
    const dragStart = new Event('dragstart', { bubbles: true })
    Object.defineProperty(dragStart, 'dataTransfer', { value: transfer })
    container.querySelector<HTMLButtonElement>('[data-testid="mock-media-library-browser"] button')?.dispatchEvent(dragStart)

    const surface = container.querySelector<HTMLElement>('[data-testid="canvas-show-manager-authoring-surface"]')!
    const dragEnter = new Event('dragenter', { bubbles: true })
    Object.defineProperty(dragEnter, 'dataTransfer', { value: transfer })
    await act(async () => { surface.dispatchEvent(dragEnter) })

    const layerThree = container.querySelector<HTMLElement>('[data-testid="canvas-layer-drop-target-3"]')!
    expect(container.querySelectorAll('[data-testid^="canvas-layer-drop-target-"]')).toHaveLength(4)
    expect(container.querySelector('[aria-label="Search media"]')).not.toBeNull()
    const drop = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(drop, 'dataTransfer', { value: transfer })
    await act(async () => { layerThree.dispatchEvent(drop) })

    expect(fixture.state.addCanvasShowManagerMediaElement).toHaveBeenCalledWith({
      showId: show.id,
      sectionId: show.sections[0]!.id,
      mediaId: 'media-video-1',
      layer: 2,
      timedVideo: true,
      sourceDurationSec: 8,
    })
    expect(show.mediaElements[0]).toMatchObject({ layer: 2, showStartSec: 0, showEndSec: 8, sourceInSec: 0, sourceOutSec: 8 })

    await act(async () => {
      root?.render(<ShowManagerView />)
      await Promise.resolve()
    })
    expect(container.querySelector('[data-testid="canvas-video-source-trim"]')).not.toBeNull()
    expect(container.querySelectorAll('.sm-canvas-media-clip')).toHaveLength(1)
    const elementInspector = container.querySelector<HTMLElement>('[data-testid="canvas-show-manager-element-inspector"]')!
    expect(elementInspector.querySelectorAll('[data-testid^="canvas-inspector-group-"]')).toHaveLength(3)
    expect([...elementInspector.querySelectorAll<HTMLElement>('.drc-header > span:first-child')].map(node => node.textContent))
      .toEqual(['Display', 'Transitions', 'FX'])
    expect(elementInspector.textContent).not.toContain('Media Element')
    expect(elementInspector.textContent).not.toContain('Fit Mode')

    const scale = elementInspector.querySelector<HTMLInputElement>('[data-testid="canvas-inspector-group-display"] input[type="range"]')!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(scale, '1.5')
      scale.dispatchEvent(new Event('input', { bubbles: true }))
      scale.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(fixture.state.updateCanvasShowManagerMediaElement).toHaveBeenCalledWith(
      show.id,
      'canvas-element-dropped',
      { display: { scale: 1.5 } },
      8,
    )
    await act(async () => {
      container!.querySelector<HTMLElement>('.sm-canvas-authored-elements')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(fixture.state.selectCanvasShowManagerMediaElement).toHaveBeenCalledWith(null)

    const secondDrop = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(secondDrop, 'dataTransfer', { value: transfer })
    await act(async () => {
      container!.querySelector<HTMLElement>('[data-testid="canvas-layer-drop-target-3"]')?.dispatchEvent(secondDrop)
    })
    expect(show.mediaElements).toHaveLength(1)
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('already contains media')

    const startHandle = container.querySelector<HTMLButtonElement>('.sm-canvas-clip-handle.is-start')!
    await act(async () => {
      startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    })
    expect(fixture.state.updateCanvasShowManagerMediaElement).toHaveBeenCalledWith(
      show.id,
      'canvas-element-dropped',
      { showStartSec: 0.1 },
      8,
    )
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
      expect(container.querySelector('[aria-label="LaserDMX Part 1 authoring grid"]')).not.toBeNull()
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

  it('routes Save and Save + Make Active from the production Show Manager header into canonical persistence', async () => {
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

    const save = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent?.trim() === 'Save')
    const activate = container.querySelector<HTMLButtonElement>('button[aria-label="Save + Make Active"]')
    expect(save?.disabled).toBe(false)
    expect(activate?.disabled).toBe(false)

    await act(async () => {
      save?.click()
      await Promise.resolve()
    })
    expect(fixture.state.saveLaserDmxShowManagerShow).toHaveBeenCalledWith('laser-show-1', { makeActive: false })
    expect(container.querySelector('.sm-header-save-status')?.textContent).toContain('Saved.')

    await act(async () => {
      activate?.click()
      await Promise.resolve()
    })
    expect(fixture.state.saveLaserDmxShowManagerShow).toHaveBeenCalledWith('laser-show-1', { makeActive: true })
    expect(container.querySelector('.sm-header-save-status')?.textContent).toContain('Saved and made active.')
  })

  it('keeps the editing section selected while playback feeds a different section into the real LaserDMX runtime preview', async () => {
    const intro = fixture.state.laserDmxShowManagerShows[0]!.sections[0]!
    const drop = fixture.state.laserDmxShowManagerShows[0]!.sections[4]!
    const originalIntroFixtures = intro.fixtures
    const originalDropFixtures = drop.fixtures
    const originalCurrentTime = fixture.audio.currentTime
    const originalGetCurrentTime = fixture.audio.getCurrentTime
    const editingFixture = { ...createDefaultLaserDmxShowDirectorFixture('laser', 'fixture-editing'), label: 'Editing Laser' }
    const playbackFixture = { ...createDefaultLaserDmxShowDirectorFixture('strobe', 'fixture-playback'), label: 'Playback Strobe' }
    intro.fixtures = [editingFixture] as never[]
    drop.fixtures = [playbackFixture] as never[]
    fixture.audio.currentTime = 4.25
    fixture.audio.getCurrentTime = () => 4.25
    fixture.audio.isPlaying = true

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
      const laserOption = [...document.body.querySelectorAll<HTMLElement>('.drm-dropdown__menu [role="option"]')]
        .find(option => option.textContent?.includes('LaserDMX'))
      await act(async () => {
        laserOption?.click()
        await Promise.resolve()
      })

      expect(container.querySelector('[data-testid="laser-dmx-runtime-preview"]')?.getAttribute('data-program-count')).toBe('7')
      expect(container.querySelector('[data-fixture-id="fixture-editing"]')).not.toBeNull()
      expect(container.querySelector('[data-fixture-id="fixture-playback"]')).toBeNull()
      expect(fixture.state.laserDmxShowManagerEditingSectionId).toBe(intro.id)

      const previewProps = fixture.laserRuntimePreviewProps[fixture.laserRuntimePreviewProps.length - 1]!
      const programs = previewProps.laserDmxSectionRuntimePrograms as Array<{
        section: { id: string }
        showDirector: { fixtures: Array<{ id: string; label: string }> }
      }>
      expect(programs.find(program => program.section.id === intro.id)?.showDirector.fixtures.map(item => item.id))
        .toEqual(['fixture-editing'])
      expect(programs.find(program => program.section.id === drop.id)?.showDirector.fixtures.map(item => item.id))
        .toEqual(['fixture-playback'])
      expect((previewProps.getAudioTime as () => number)()).toBe(4.25)

      await act(async () => {
        ;(previewProps.onLaserDmxPlaybackSectionChange as (sectionId: string | null) => void)(drop.id)
        root?.render(<ShowManagerView />)
        await Promise.resolve()
      })
      expect(fixture.state.laserDmxShowManagerPlaybackSectionId).toBe(drop.id)
      expect(fixture.state.laserDmxShowManagerEditingSectionId).toBe(intro.id)
      expect(container.textContent).toContain('Editing: Intro')
      expect(container.textContent).toContain('Playback: Drop')
      expect(container.querySelector('[data-fixture-id="fixture-editing"]')).not.toBeNull()
    } finally {
      intro.fixtures = originalIntroFixtures
      drop.fixtures = originalDropFixtures
      fixture.audio.currentTime = originalCurrentTime
      fixture.audio.getCurrentTime = originalGetCurrentTime
      fixture.audio.isPlaying = false
      fixture.state.laserDmxShowManagerPlaybackSectionId = null
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

  it('routes Stage 3 drag/drop through the production LaserDMX grid with snapped cells and history', async () => {
    fixture.state.addLaserDmxShowManagerFixture.mockClear()
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

    const grid = container.querySelector<HTMLElement>('[data-testid="laser-dmx-authoring-grid"]')
    expect(grid).not.toBeNull()
    if (!grid) return
    grid.getBoundingClientRect = () => ({
      x: 10,
      y: 20,
      left: 10,
      top: 20,
      right: 190,
      bottom: 140,
      width: 180,
      height: 120,
      toJSON: () => ({}),
    })

    const dispatchDrop = async (payload: string, clientX: number, clientY: number) => {
      const event = new Event('drop', { bubbles: true, cancelable: true })
      Object.defineProperties(event, {
        clientX: { value: clientX },
        clientY: { value: clientY },
        dataTransfer: {
          value: {
            dropEffect: 'none',
            getData: (type: string) => type === 'application/x-drmvyz-laserdmx-fixture-kind' ? payload : '',
          },
        },
      })
      await act(async () => {
        grid.dispatchEvent(event)
        await Promise.resolve()
      })
    }

    await dispatchDrop('co2Jet', 105, 75)
    expect(fixture.state.addLaserDmxShowManagerFixture).not.toHaveBeenCalled()

    await dispatchDrop('laser', 105, 75)
    expect(fixture.state.addLaserDmxShowManagerFixture).toHaveBeenCalledWith(
      'laser-show-1',
      'laser-show-1:section:intro:1',
      'laser',
      { x: 9, y: 5 },
    )
  })

  it('keeps LaserDMX fixture selection single and clears it from empty grid space', async () => {
    const intro = fixture.state.laserDmxShowManagerShows[0]!.sections[0]!
    const originalFixtures = intro.fixtures
    intro.fixtures = [
      { ...createDefaultLaserDmxShowDirectorFixture('laser', 'fixture-a'), x: 4, y: 5, label: 'Laser 1' },
      { ...createDefaultLaserDmxShowDirectorFixture('strobe', 'fixture-b'), x: 4, y: 5, label: 'Strobe 1' },
    ] as never[]

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
      const laserOption = [...document.body.querySelectorAll<HTMLElement>('.drm-dropdown__menu [role="option"]')]
        .find(option => option.textContent?.includes('LaserDMX'))
      await act(async () => {
        laserOption?.click()
        await Promise.resolve()
      })

      const fixtureButtons = [...container.querySelectorAll<HTMLButtonElement>('button[data-fixture-id]')]
      expect(fixtureButtons).toHaveLength(2)
      await act(async () => {
        fixtureButtons[0]?.click()
        await Promise.resolve()
      })
      expect(container.querySelector('[data-testid="laser-dmx-fixture-inspector"]')).not.toBeNull()
      expect(fixtureButtons[0]?.getAttribute('aria-pressed')).toBe('true')
      expect(fixtureButtons[1]?.getAttribute('aria-pressed')).toBe('false')

      await act(async () => {
        fixtureButtons[1]?.click()
        await Promise.resolve()
      })
      expect(fixtureButtons[0]?.getAttribute('aria-pressed')).toBe('false')
      expect(fixtureButtons[1]?.getAttribute('aria-pressed')).toBe('true')

      const grid = container.querySelector<HTMLElement>('[data-testid="laser-dmx-authoring-grid"]')
      await act(async () => {
        grid?.click()
        await Promise.resolve()
      })
      expect(fixtureButtons.every(button => button.getAttribute('aria-pressed') === 'false')).toBe(true)
    } finally {
      intro.fixtures = originalFixtures
    }
  })

  it('binds the Part 1 fixture Inspector to the selected production fixture and exposes only the approved trigger list', async () => {
    const intro = fixture.state.laserDmxShowManagerShows[0]!.sections[0]!
    const originalFixtures = intro.fixtures
    intro.fixtures = [{
      ...createDefaultLaserDmxShowDirectorFixture('laser', 'fixture-inspector'),
      x: 4,
      y: 5,
      label: 'Inspector Laser',
    }] as never[]
    fixture.state.updateLaserDmxShowManagerFixture.mockClear()

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
      const laserOption = [...document.body.querySelectorAll<HTMLElement>('.drm-dropdown__menu [role="option"]')]
        .find(option => option.textContent?.includes('LaserDMX'))
      await act(async () => {
        laserOption?.click()
        await Promise.resolve()
      })

      const fixtureButton = container.querySelector<HTMLButtonElement>('button[data-fixture-id="fixture-inspector"]')
      await act(async () => {
        fixtureButton?.click()
        await Promise.resolve()
      })

      const inspector = container.querySelector<HTMLElement>('[data-testid="laser-dmx-fixture-inspector"]')
      expect(inspector).not.toBeNull()
      expect(inspector?.textContent).toContain('Inspector Laser')
      for (const approved of ['Position', 'X', 'Y', 'Z', 'Rotation', 'Color', 'Color Mode', 'Brightness', 'Beam Configuration', 'Trigger Configuration']) {
        expect(inspector?.textContent).toContain(approved)
      }
      for (const deferred of ['Gobo', 'Prism', 'Diffraction', 'Scanner', 'Modulation']) {
        expect(inspector?.textContent).not.toContain(deferred)
      }

      const colorMode = inspector?.querySelector<HTMLButtonElement>('button[aria-label="Color Mode"]')
      expect(colorMode?.disabled).toBe(true)
      expect(colorMode?.textContent).toContain('Static')

      const trigger = inspector?.querySelector<HTMLButtonElement>('button[aria-label="Trigger"]')
      await act(async () => {
        trigger?.click()
        await Promise.resolve()
      })
      const triggerOptions = [...document.body.querySelectorAll<HTMLElement>('.drm-dropdown__menu [role="option"]')]
        .map(option => option.textContent?.trim())
      expect(triggerOptions).toEqual([
        'None', 'Beat', 'Downbeat', 'Bar', '4 Bars', '8 Bars', '16 Bars', '24 Bars', 'Kick Hit', 'Snare Hit',
      ])

      const xLabel = [...(inspector?.querySelectorAll<HTMLLabelElement>('label') ?? [])]
        .find(label => label.textContent?.trim() === 'X')
      const xInput = xLabel?.htmlFor ? inspector?.querySelector<HTMLInputElement>(`#${xLabel.htmlFor}`) : null
      expect(xInput).not.toBeNull()
      await act(async () => {
        if (!xInput) return
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        setter?.call(xInput, '17')
        xInput.dispatchEvent(new Event('input', { bubbles: true }))
        xInput.dispatchEvent(new Event('change', { bubbles: true }))
        await Promise.resolve()
      })
      expect(fixture.state.updateLaserDmxShowManagerFixture).toHaveBeenCalledWith(
        'laser-show-1',
        'laser-show-1:section:intro:1',
        'fixture-inspector',
        { x: 17 },
      )
    } finally {
      intro.fixtures = originalFixtures
    }
  })

  it('deletes only the selected fixture and routes Undo/Redo through the shared Show Manager history', async () => {
    const show = fixture.state.laserDmxShowManagerShows[0]!
    const intro = show.sections[0]!
    const originalFixtures = intro.fixtures
    intro.fixtures = [
      { ...createDefaultLaserDmxShowDirectorFixture('laser', 'fixture-delete'), x: 4, y: 5 },
      { ...createDefaultLaserDmxShowDirectorFixture('strobe', 'fixture-neighbor'), x: 4, y: 5 },
    ] as never[]
    fixture.state.showManagerUndoStack = [{}]
    fixture.state.showManagerRedoStack = [{}]
    fixture.state.removeLaserDmxShowManagerFixture.mockReset()
    fixture.state.removeLaserDmxShowManagerFixture.mockImplementation((showId: string, sectionId: string, fixtureId: string) => {
      fixture.state.laserDmxShowManagerShows = fixture.state.laserDmxShowManagerShows.map((candidate: typeof fixture.state.laserDmxShowManagerShows[number]) => (
        candidate.id === showId
          ? removeLaserDmxShowManagerFixtureFromSection(candidate, sectionId, fixtureId)
          : candidate
      )) as typeof fixture.state.laserDmxShowManagerShows
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
      const laserOption = [...document.body.querySelectorAll<HTMLElement>('.drm-dropdown__menu [role="option"]')]
        .find(option => option.textContent?.includes('LaserDMX'))
      await act(async () => {
        laserOption?.click()
        await Promise.resolve()
      })
      const selected = container.querySelector<HTMLButtonElement>('button[data-fixture-id="fixture-delete"]')
      await act(async () => {
        selected?.click()
        await Promise.resolve()
      })
      const deleteButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find(button => button.textContent?.trim() === 'Delete Fixture')
      await act(async () => {
        deleteButton?.click()
        await Promise.resolve()
      })

      expect(fixture.state.removeLaserDmxShowManagerFixture).toHaveBeenCalledWith(
        'laser-show-1',
        'laser-show-1:section:intro:1',
        'fixture-delete',
      )
      expect(container.querySelector('button[data-fixture-id="fixture-delete"]')).toBeNull()
      expect(container.querySelector('button[data-fixture-id="fixture-neighbor"]')).not.toBeNull()

      const undo = container.querySelector<HTMLButtonElement>('button[title="Undo section edit"]')
      await act(async () => {
        undo?.click()
        await Promise.resolve()
      })
      expect(fixture.state.undoLaserDmxShowManagerEdit).toHaveBeenCalledTimes(1)

      const redo = container.querySelector<HTMLButtonElement>('button[title="Redo section edit"]')
      await act(async () => {
        redo?.click()
        await Promise.resolve()
      })
      expect(fixture.state.redoLaserDmxShowManagerEdit).toHaveBeenCalledTimes(1)
    } finally {
      const currentIntro = fixture.state.laserDmxShowManagerShows[0]!.sections[0]!
      currentIntro.fixtures = originalFixtures
      fixture.state.removeLaserDmxShowManagerFixture.mockReset()
    }
  })

  it('copies fixtures through the production section toggle/dropdown and treats the entire copy as one Undo/Redo action', async () => {
    const originalShows = fixture.state.laserDmxShowManagerShows
    const originalEditingSectionId = fixture.state.laserDmxShowManagerEditingSectionId
    const testShow = structuredClone(originalShows[0]!)
    const intro = testShow.sections[0]!
    const verse = testShow.sections[1]!
    type TestShow = typeof testShow
    type TestSection = typeof verse
    type TestFixture = typeof verse.fixtures[number]
    intro.fixtures = [{
      ...createDefaultLaserDmxShowDirectorFixture('laser', 'copy-source-laser'),
      label: 'Source Laser',
      x: 8,
      y: 6,
      brightness: 0.41,
    }]
    verse.fixtures = [{
      ...createDefaultLaserDmxShowDirectorFixture('strobe', 'copy-destination-strobe'),
      label: 'Destination Strobe',
      x: 8,
      y: 6,
    }]
    fixture.state.laserDmxShowManagerShows = [testShow] as typeof fixture.state.laserDmxShowManagerShows
    fixture.state.laserDmxShowManagerEditingSectionId = verse.id
    fixture.state.showManagerUndoStack = [{}]
    fixture.state.showManagerRedoStack = [{}]
    fixture.state.copyLaserDmxShowManagerFixturesFromSection.mockReset()
    fixture.state.copyLaserDmxShowManagerFixturesFromSection.mockImplementation((showId: string, sourceSectionId: string, destinationSectionId: string) => {
      let copiedIds: string[] = []
      fixture.state.laserDmxShowManagerShows = fixture.state.laserDmxShowManagerShows.map((candidate: TestShow) => {
        if (candidate.id !== showId) return candidate
        const result = copyLaserDmxShowManagerFixturesBetweenSections(candidate, sourceSectionId, destinationSectionId)
        copiedIds = result.fixtureIds
        return result.show
      }) as typeof fixture.state.laserDmxShowManagerShows
      return copiedIds
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
      const laserOption = [...document.body.querySelectorAll<HTMLElement>('.drm-dropdown__menu [role="option"]')]
        .find(option => option.textContent?.includes('LaserDMX'))
      await act(async () => {
        laserOption?.click()
        await Promise.resolve()
      })

      expect(container.querySelector('button[aria-label="Copy fixtures source section"]')).toBeNull()
      const toggle = container.querySelector<HTMLButtonElement>('#show-manager-laser-copy-fixtures')
      await act(async () => {
        toggle?.click()
        await Promise.resolve()
      })

      const sourceTrigger = container.querySelector<HTMLButtonElement>('button[aria-label="Copy fixtures source section"]')
      expect(sourceTrigger?.disabled).toBe(false)
      await act(async () => {
        sourceTrigger?.click()
        await Promise.resolve()
      })
      const sourceOptions = [...document.body.querySelectorAll<HTMLElement>('.drm-dropdown__menu [role="option"]')]
      expect(sourceOptions).toHaveLength(1)
      expect(sourceOptions[0]?.textContent).toContain('Intro')
      expect(sourceOptions[0]?.textContent).not.toContain('Verse')
      expect(sourceOptions[0]?.textContent).not.toContain('Build')

      await act(async () => {
        sourceOptions[0]?.click()
        await Promise.resolve()
      })
      expect(fixture.state.copyLaserDmxShowManagerFixturesFromSection).toHaveBeenCalledWith(
        'laser-show-1',
        intro.id,
        verse.id,
      )
      let currentVerse = fixture.state.laserDmxShowManagerShows[0]!.sections.find((section: TestSection) => section.id === verse.id)!
      expect(currentVerse.fixtures).toHaveLength(2)
      const copiedId = currentVerse.fixtures[1]!.id
      expect(copiedId).not.toBe('copy-source-laser')
      expect(currentVerse.fixtures[1]).toMatchObject({ label: 'Source Laser', x: 8, y: 6, brightness: 0.41 })

      const undo = container.querySelector<HTMLButtonElement>('button[title="Undo section edit"]')
      await act(async () => {
        undo?.click()
        await Promise.resolve()
      })
      expect(fixture.state.undoLaserDmxShowManagerEdit).toHaveBeenCalledTimes(1)

      const redo = container.querySelector<HTMLButtonElement>('button[title="Redo section edit"]')
      await act(async () => {
        redo?.click()
        await Promise.resolve()
      })
      expect(fixture.state.redoLaserDmxShowManagerEdit).toHaveBeenCalledTimes(1)
      currentVerse = fixture.state.laserDmxShowManagerShows[0]!.sections.find((section: TestSection) => section.id === verse.id)!
      expect(currentVerse.fixtures.map((item: TestFixture) => item.id)).toEqual(['copy-destination-strobe', copiedId])
    } finally {
      fixture.state.laserDmxShowManagerShows = originalShows
      fixture.state.laserDmxShowManagerEditingSectionId = originalEditingSectionId
      fixture.state.copyLaserDmxShowManagerFixturesFromSection.mockReset()
      fixture.state.copyLaserDmxShowManagerFixturesFromSection.mockReturnValue([])
    }
  })

  it('routes section edits through the production LaserDMX history controls', async () => {
    fixture.state.showManagerUndoStack = [{}]
    fixture.state.showManagerRedoStack = [{}]
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
    await act(async () => {
      undo?.click()
      await Promise.resolve()
    })
    expect(fixture.state.undoLaserDmxShowManagerEdit).toHaveBeenCalled()
    await act(async () => {
      redo?.click()
      await Promise.resolve()
    })
    expect(fixture.state.redoLaserDmxShowManagerEdit).toHaveBeenCalled()
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

  it('keeps the inspector panel heading inside its rail and moves stage tools plus account actions into the top bar', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<ShowManagerView />)
      await Promise.resolve()
    })

    expect(container.querySelector('.sm-stage-header')).toBeNull()
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
