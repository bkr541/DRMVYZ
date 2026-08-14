// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioEngine } from '../../../hooks/useAudioEngine'
import { resetAudioSourcePolicyForTests } from '../../../audio/audioSourcePolicy'

const fixture = vi.hoisted(() => ({
  engine: {
    source: 'file',
    micError: null,
    tracks: [],
    currentTrack: null,
    currentTrackId: null,
    currentAudioTrackId: null,
    currentAnalysisStatus: 'not_analyzed',
    currentAnalysisError: null,
    currentAnalysis: null,
    currentAnalyzedBpm: null,
    currentEffectiveBpm: null,
    currentBpmSource: null,
    currentEffectiveBeatGrid: null,
    currentBpmReanalysisStatus: 'idle',
    duration: 0,
    currentTime: 0,
    volume: 1,
    isPlaying: false,
    getDecodedBuffer: vi.fn(),
    setSource: vi.fn(async () => undefined),
    addPreparedTracks: vi.fn(),
    replacePreparedTracks: vi.fn(),
    prev: vi.fn(),
    next: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    setBpmOverride: vi.fn(),
    retryAnalysis: vi.fn(),
    reanalyzeWithBpmOverride: vi.fn(),
  } as unknown as AudioEngine,
  visualState: {
    presets: [{ id: 'preset-a', name: 'Preset A', color: '#ffffff' }],
    activePresetId: 'preset-a',
    bpmSync: false,
    toggleBpmSync: vi.fn(),
    setPlaying: vi.fn(),
    cuePoint: 0,
    setCuePoint: vi.fn(),
    waveformZoom: 1,
    setWaveformZoom: vi.fn(),
    cueMarkers: [],
    addCueMarker: vi.fn(),
    removeCueMarker: vi.fn(),
    updateCueMarker: vi.fn(),
  },
}))

vi.mock('../../../context/AudioEngineContext', () => ({
  useSharedAudio: () => fixture.engine,
}))

vi.mock('../../../stores/visualStore', () => ({
  DEFAULT_PRESETS: [{ id: 'default', name: 'Default', color: '#ffffff' }],
  useVisualStore: (selector: (state: typeof fixture.visualState) => unknown) => selector(fixture.visualState),
}))

vi.mock('../../../stores/reactStore', () => ({
  useReactStore: (selector: (state: { manualTrackSectionsByTrackId: {}; suppressedAutoSectionsByTrackId: {} }) => unknown) => selector({
    manualTrackSectionsByTrackId: {},
    suppressedAutoSectionsByTrackId: {},
  }),
}))

vi.mock('../hooks/useTapTempo', () => ({ useTapTempo: () => ({ handleTap: vi.fn() }) }))
vi.mock('../hooks/useWaveformPeaks', () => ({ useWaveformPeaks: () => ({ peaks: null }) }))
vi.mock('../hooks/useRgbWaveformAnalysis', () => ({ useRgbWaveformAnalysis: () => undefined }))
vi.mock('../../../features/waveform/rgbWaveformStorage', () => ({
  useRgbWaveformStore: (selector: (state: { waveforms: {} }) => unknown) => selector({ waveforms: {} }),
}))
vi.mock('../transport/PeaksWaveformView', () => ({ PeaksWaveformView: () => <div data-testid="waveform" /> }))
vi.mock('../../../features/rekordboxImport', () => ({
  createPreparedTrackInputs: (files: File[]) => files.map(file => ({ sourceFile: file, imported: null })),
  importRekordboxXml: vi.fn(),
  selectRekordboxUsbRoot: vi.fn(),
  summarizeRekordboxLibrary: vi.fn(() => 'library'),
}))
vi.mock('../../../features/rekordboxImport/nativeBridge', () => ({
  guessNativeUsbRootFromFile: () => null,
  scanNativeRekordboxUsbRoot: vi.fn(),
}))
vi.mock('../../shared/InfoPopover', () => ({ HelpInfoTrigger: () => null }))

vi.mock('../VyzualzSidebar', () => ({
  VyzualzSidebar: () => <nav aria-label="Mock VYZUALZ sidebar" />,
}))
vi.mock('../../../stores/lyricsStore', () => ({
  useLyricsStore: (selector: (state: { editorDirty: boolean; isSaving: boolean }) => unknown) => selector({ editorDirty: false, isSaving: false }),
}))
vi.mock('../VisualizerWorkspace', () => ({ VisualizerWorkspace: () => <div>Visualizer</div> }))
vi.mock('../../../features/media/MediaManagerView', () => ({ MediaManagerView: () => <div>Media</div> }))
vi.mock('../../../features/lyrics/LyricManagerView', () => ({ LyricManagerView: () => <div>Lyrics</div> }))

vi.mock('../showManager/ShowManagerView', async () => {
  const ReactModule = await import('react')
  const { VyzualzAudioDock } = await import('./VyzualzAudioDock')
  return { ShowManagerView: () => ReactModule.createElement(VyzualzAudioDock, { expandable: true }) }
})

vi.mock('../react/ReactView', async () => {
  const ReactModule = await import('react')
  const { VyzualzAudioDock } = await import('./VyzualzAudioDock')
  return { ReactView: () => ReactModule.createElement(VyzualzAudioDock, { expandable: true }) }
})

import { VyzualzView } from '../VyzualzView'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

async function renderView(initialAppView: 'showManager' | 'react'): Promise<void> {
  // Warm the real Audio Dock module before VyzualzView enters a lazy workspace.
  // The mocked ShowManagerView/ReactView factories both render this real component;
  // resolving its large dependency graph inside React.lazy made the first (cold)
  // Show Manager render depend on Vitest's 1s waitFor timeout, while the sibling
  // React test only passed because the module graph had already been cached.
  await import('./VyzualzAudioDock')

  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(<VyzualzView activeView="vyzualz" onNavigate={() => {}} initialAppView={initialAppView} />)
    await Promise.resolve()
  })
  await act(async () => {
    await vi.waitFor(() => {
      expect(container?.querySelector('.vz-dock-addtrack-btn')).not.toBeNull()
    })
  })
}

async function dispatchAudioFile(name = 'track-c.wav'): Promise<void> {
  const input = container?.querySelector<HTMLInputElement>('input[type="file"][accept="audio/*"]')
  expect(input).not.toBeNull()
  const file = new File(['audio'], name, { type: 'audio/wav' })
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  await act(async () => {
    input?.dispatchEvent(new Event('change', { bubbles: true }))
    await Promise.resolve()
  })
}

beforeEach(() => {
  resetAudioSourcePolicyForTests()
  fixture.engine.source = 'file'
  fixture.engine.micError = null
  fixture.engine.tracks = []
  fixture.engine.currentTrack = null
  fixture.engine.currentTrackId = null
  fixture.engine.currentAudioTrackId = null
  fixture.engine.isPlaying = false
  vi.mocked(fixture.engine.addPreparedTracks).mockClear()
  vi.mocked(fixture.engine.replacePreparedTracks).mockClear()
  vi.mocked(fixture.engine.setSource).mockClear()
  vi.mocked(fixture.engine.pause).mockClear()
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
  resetAudioSourcePolicyForTests()
})

describe('Show Manager Audio Dock source lock integration', () => {
  it('enters Show Manager through the app-view router and atomically blocks the real Audio Dock file route', async () => {
    fixture.engine.currentAudioTrackId = 'track-a'
    fixture.engine.isPlaying = true
    await renderView('showManager')

    expect(fixture.engine.pause).toHaveBeenCalledOnce()

    const addTrack = container?.querySelector<HTMLElement>('.vz-dock-addtrack-btn')
    expect(addTrack?.getAttribute('aria-disabled')).toBe('true')
    expect(addTrack?.textContent).toContain('Track Locked')

    await dispatchAudioFile()

    expect(fixture.engine.addPreparedTracks).not.toHaveBeenCalled()
    expect(fixture.engine.replacePreparedTracks).not.toHaveBeenCalled()
    expect(fixture.engine.setSource).not.toHaveBeenCalled()
    expect(container?.querySelector('[role="alert"]')?.textContent).toContain(
      'An audio track cannot be loaded while in Show Manager.',
    )
    expect(container?.querySelector('[role="alert"]')?.textContent).toContain('React, VYZUALZ, or Media Manager')
  })

  it('disables the real Audio Dock track routes and surfaces capture errors while Live Input is selected', async () => {
    fixture.engine.source = 'microphone'
    fixture.engine.micError = 'Live Input access failed: Permission denied'
    fixture.engine.tracks = [{ id: 'loaded-track' }] as unknown as AudioEngine['tracks']
    await renderView('react')

    const dock = container?.querySelector<HTMLElement>('.vz-transport-dock')
    expect(dock?.dataset.liveInputDisabled).toBe('true')
    expect(dock?.getAttribute('aria-disabled')).toBe('true')
    expect(container?.querySelector('.vz-dock-addtrack-btn')?.textContent).toContain('Live Input Active')
    expect(container?.querySelector('.vz-dock-addtrack-btn')?.getAttribute('aria-disabled')).toBe('true')
    expect(container?.querySelector<HTMLInputElement>('input[type="file"][accept="audio/*"]')?.disabled).toBe(true)
    expect(container?.querySelector('[role="alert"]')?.textContent).toContain('Permission denied')

    await dispatchAudioFile('blocked-during-live-input.wav')

    expect(fixture.engine.addPreparedTracks).not.toHaveBeenCalled()
    expect(fixture.engine.replacePreparedTracks).not.toHaveBeenCalled()
    expect(fixture.engine.tracks).toHaveLength(1)
  })

  it('preserves normal real Audio Dock file loading in the React workspace', async () => {
    await renderView('react')

    expect(container?.querySelector('.vz-dock-addtrack-btn')?.getAttribute('aria-disabled')).toBe('false')
    await dispatchAudioFile('outside-show-manager.wav')

    expect(fixture.engine.addPreparedTracks).toHaveBeenCalledWith(
      [expect.objectContaining({ sourceFile: expect.any(File) })],
      { notifyOnBlocked: false },
    )
    expect(container?.querySelector('[role="alert"]')).toBeNull()
  })
})
