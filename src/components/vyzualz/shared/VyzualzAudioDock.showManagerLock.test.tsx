// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioEngine } from '../../../hooks/useAudioEngine'
import { resetAudioSourcePolicyForTests } from '../../../audio/audioSourcePolicy'
import { NotificationDrawer } from './NotificationDrawer'
import { usePageActivityStore } from '../../../stores/pageActivityStore'
import { useNotificationStore } from '../../../stores/notificationStore'

const fixture = vi.hoisted(() => ({
  engine: {
    source: 'file',
    micError: null,
    trackLoadError: null,
    tracks: [],
    currentIndex: -1,
    autoAdvance: true,
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
    addTracks: vi.fn(),
    replaceTracks: vi.fn(),
    addPreparedTracks: vi.fn(),
    replacePreparedTracks: vi.fn(),
    hydrateTrackMetadata: vi.fn(() => true),
    removeTrack: vi.fn(),
    selectTrack: vi.fn(),
    setAutoAdvance: vi.fn(),
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
  nativeRekordbox: {
    guessedRoot: null as string | null,
    lookup: vi.fn(),
    scan: vi.fn(),
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
  createPreparedTrackInputs: (files: File[], library: unknown, options?: { forceUsbMode?: boolean }) => files.map(file => ({
    file,
    imported: library || options?.forceUsbMode ? {
      source: 'rekordbox_usb',
      metadata: { source: 'rekordbox_usb', title: file.name },
      cueMarkers: [],
      cueRegions: [],
      rekordboxPhrases: [],
      analysisSeed: { source: 'rekordbox_usb', featureAvailability: {} },
      matchConfidence: 1,
      matchReason: 'native-path',
      warnings: [],
    } : undefined,
  })),
  importRekordboxXml: vi.fn(),
  selectRekordboxUsbRoot: vi.fn(),
  summarizeRekordboxLibrary: vi.fn(() => 'library'),
}))
vi.mock('../../../features/rekordboxImport/nativeBridge', () => ({
  guessNativeUsbRootFromFile: () => fixture.nativeRekordbox.guessedRoot,
  lookupIndexedRekordboxTracks: (...args: unknown[]) => fixture.nativeRekordbox.lookup(...args),
  scanNativeRekordboxUsbRoot: (...args: unknown[]) => fixture.nativeRekordbox.scan(...args),
}))
vi.mock('../../shared/InfoPopover', () => ({
  InfoPopover: ({ open, title, children }: { open: boolean; title: React.ReactNode; children: React.ReactNode }) => (
    open ? <div role="dialog" aria-label={String(title)}>{children}</div> : null
  ),
}))

vi.mock('../VyzualzSidebar', () => ({
  VyzualzSidebar: () => <nav aria-label="Mock VYZUALZ sidebar" />,
}))
vi.mock('../../../stores/lyricsStore', () => ({
  useLyricsStore: (selector: (state: { editorDirty: boolean; isSaving: boolean }) => unknown) => selector({ editorDirty: false, isSaving: false }),
}))
vi.mock('../../../features/lyrics/components/LyricRuntimePreviewIndicator', () => ({ LyricRuntimePreviewIndicator: () => null }))
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

// The dock's notices are listed in the page's Notifications drawer (the header bell) instead of drawn over the waveform.
// These mocked page views have no header, so open the real drawer for the page directly.
async function drawerText(page: 'react' | 'show-manager'): Promise<string> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const drawerRoot = createRoot(host)
  await act(async () => {
    drawerRoot.render(<NotificationDrawer page={page} scope="viewport" onClose={() => {}} />)
    await Promise.resolve()
  })
  const text = document.body.querySelector('.vz-notifications-drawer')?.textContent ?? ''
  await act(async () => drawerRoot.unmount())
  host.remove()
  return text
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
  usePageActivityStore.setState({ pages: { react: {}, 'show-manager': {}, 'media-manager': {}, 'lyric-manager': {} } })
  resetAudioSourcePolicyForTests()
  fixture.engine.source = 'file'
  fixture.engine.micError = null
  fixture.engine.trackLoadError = null
  useNotificationStore.setState({ events: { ...useNotificationStore.getState().events, react: [] } })
  fixture.engine.tracks = []
  fixture.engine.currentIndex = -1
  fixture.engine.autoAdvance = true
  fixture.engine.currentTrack = null
  fixture.engine.currentTrackId = null
  fixture.engine.currentAudioTrackId = null
  fixture.engine.isPlaying = false
  vi.mocked(fixture.engine.addTracks).mockClear()
  vi.mocked(fixture.engine.replaceTracks).mockClear()
  vi.mocked(fixture.engine.addPreparedTracks).mockClear()
  vi.mocked(fixture.engine.replacePreparedTracks).mockClear()
  vi.mocked(fixture.engine.hydrateTrackMetadata).mockClear()
  vi.mocked(fixture.engine.hydrateTrackMetadata).mockReturnValue(true)
  vi.mocked(fixture.engine.addTracks).mockImplementation(files => files.map((file, index) => ({
    id: `loaded-${index}`,
    sourceFile: file,
  })) as ReturnType<AudioEngine['addTracks']>)
  vi.mocked(fixture.engine.replaceTracks).mockImplementation(files => files.map((file, index) => ({
    id: `loaded-${index}`,
    sourceFile: file,
  })) as ReturnType<AudioEngine['replaceTracks']>)
  vi.mocked(fixture.engine.setSource).mockClear()
  vi.mocked(fixture.engine.pause).mockClear()
  vi.mocked(fixture.engine.prev).mockClear()
  vi.mocked(fixture.engine.next).mockClear()
  vi.mocked(fixture.engine.removeTrack).mockClear()
  vi.mocked(fixture.engine.selectTrack).mockClear()
  vi.mocked(fixture.engine.setAutoAdvance).mockClear()
  fixture.visualState.setPlaying.mockClear()
  fixture.nativeRekordbox.guessedRoot = null
  fixture.nativeRekordbox.lookup.mockReset()
  fixture.nativeRekordbox.lookup.mockResolvedValue(null)
  fixture.nativeRekordbox.scan.mockReset()
  fixture.visualState.bpmSync = false
  fixture.visualState.toggleBpmSync.mockClear()
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
  resetAudioSourcePolicyForTests()
})

describe('Audio Dock failure notices', () => {
  it('lists a track that could not be played in the page Notifications drawer', async () => {
    fixture.engine.trackLoadError = '"Night Drive" could not be played: the file is missing or its format is not supported.'
    await renderView('react')
    const text = await drawerText('react')
    expect(text).toContain('Track could not be played')
    expect(text).toContain('"Night Drive" could not be played')
  })

  it('tells the user when a chosen file is not audio, and adds nothing', async () => {
    await renderView('react')
    const input = container?.querySelector<HTMLInputElement>('input[type="file"][accept="audio/*"]')
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['x'], 'notes.pdf', { type: 'application/pdf' })] })
    await act(async () => { input?.dispatchEvent(new Event('change', { bubbles: true })); await Promise.resolve() })
    expect(fixture.engine.addTracks).not.toHaveBeenCalled()
    const text = await drawerText('react')
    expect(text).toContain('No audio files added')
    expect(text).toContain('"notes.pdf" is not a supported audio file')
  })

  it('adds the audio files in a mixed selection and reports the skipped one', async () => {
    await renderView('react')
    const input = container?.querySelector<HTMLInputElement>('input[type="file"][accept="audio/*"]')
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['a'], 'mix.wav', { type: 'audio/wav' }), new File(['x'], 'cover.jpg', { type: 'image/jpeg' })],
    })
    await act(async () => { input?.dispatchEvent(new Event('change', { bubbles: true })); await Promise.resolve() })
    expect(fixture.engine.addTracks).toHaveBeenCalledTimes(1)
    const text = await drawerText('react')
    expect(text).toContain('Some files were skipped')
    expect(text).toContain('1 file was not a supported audio type')
  })
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
    expect(container?.querySelector('[role="alert"]')).toBeNull()
    const drawer = await drawerText('show-manager')
    expect(drawer).toContain('An audio track cannot be loaded while in Show Manager.')
    expect(drawer).toContain('React or Media Manager')
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
    expect(container?.querySelector('.vz-dock-source-inline')?.getAttribute('data-audio-source-kind')).toBe('live')
    expect(container?.querySelector('.vz-dock-source-inline')?.textContent).toContain('Live Input')
    expect(container?.querySelector('[role="alert"]')).toBeNull()
    const drawer = await drawerText('react')
    expect(drawer).toContain('Live Input active')
    expect(drawer).toContain('Permission denied')

    await dispatchAudioFile('blocked-during-live-input.wav')

    expect(fixture.engine.addPreparedTracks).not.toHaveBeenCalled()
    expect(fixture.engine.replacePreparedTracks).not.toHaveBeenCalled()
    expect(fixture.engine.tracks).toHaveLength(1)
  })

  it('preserves normal real Audio Dock file loading in the React workspace', async () => {
    await renderView('react')

    const addTrack = container?.querySelector('.vz-dock-addtrack-btn')
    expect(addTrack?.getAttribute('aria-disabled')).toBe('false')
    expect(addTrack?.getAttribute('aria-label')).toBe('Add Track')
    expect(addTrack?.querySelector('img')).toBeNull()
    expect(addTrack?.querySelector('svg path')?.getAttribute('d')).toBe('M12 5v14M5 12h14')
    await dispatchAudioFile('outside-show-manager.wav')

    expect(fixture.engine.addTracks).toHaveBeenCalledWith(
      [expect.any(File)],
      { notifyOnBlocked: false },
    )
    expect(container?.querySelector('[role="alert"]')).toBeNull()
  })

  it('exposes previous and next playlist controls in the React audio dock', async () => {
    fixture.engine.tracks = [
      { id: 'track-a' },
      { id: 'track-b' },
      { id: 'track-c' },
    ] as unknown as AudioEngine['tracks']
    fixture.engine.currentIndex = 1
    fixture.engine.currentTrack = {
      id: 'track-b',
      url: 'blob:track-b',
      displayName: 'Track B',
      analysisRuntime: {
        analysisKey: 'track-b-key',
        gridStale: false,
      },
    } as AudioEngine['currentTrack']
    await renderView('react')

    const previous = container?.querySelector<HTMLButtonElement>('[aria-label="Previous track"]')
    const next = container?.querySelector<HTMLButtonElement>('[aria-label="Next track"]')
    expect(previous?.disabled).toBe(false)
    expect(next?.disabled).toBe(false)

    await act(async () => previous?.click())
    await act(async () => next?.click())

    expect(fixture.engine.prev).toHaveBeenCalledOnce()
    expect(fixture.engine.next).toHaveBeenCalledOnce()
    expect(fixture.visualState.setPlaying).toHaveBeenCalledTimes(2)
    expect(fixture.visualState.setPlaying).toHaveBeenNthCalledWith(1, true)
    expect(fixture.visualState.setPlaying).toHaveBeenNthCalledWith(2, true)
  })

  it('opens playlist controls for advance, state, selection, removal, and append loading', async () => {
    fixture.engine.tracks = [
      { id: 'track-a', name: 'track-a.wav', displayName: 'Track A' },
      { id: 'track-b', name: 'track-b.wav', displayName: 'Track B' },
    ] as unknown as AudioEngine['tracks']
    fixture.engine.currentIndex = 1
    fixture.engine.currentTrack = {
      id: 'track-b',
      url: 'blob:track-b',
      name: 'track-b.wav',
      displayName: 'Track B',
      analysisRuntime: {
        analysisKey: 'track-b-key',
        gridStale: false,
      },
    } as AudioEngine['currentTrack']
    await renderView('react')

    const trigger = container?.querySelector<HTMLButtonElement>('[aria-label="Playlist"]')
    await act(async () => trigger?.click())

    const popover = container?.querySelector<HTMLElement>('[role="dialog"][aria-label="Playlist"]')
    expect(popover?.textContent).toContain('2 tracks')
    expect(popover?.textContent).toContain('Track A')
    expect(popover?.textContent).toContain('Track B')

    const advance = popover?.querySelector<HTMLButtonElement>('[role="switch"]')
    expect(advance?.getAttribute('aria-checked')).toBe('true')
    await act(async () => advance?.click())
    expect(fixture.engine.setAutoAdvance).toHaveBeenCalledWith(false)

    await act(async () => popover?.querySelectorAll<HTMLButtonElement>('.vz-dock-playlist-select')[0]?.click())
    expect(fixture.engine.selectTrack).toHaveBeenCalledWith(0)

    const remove = popover?.querySelector<HTMLButtonElement>('[aria-label="Remove Track A from playlist"]')
    await act(async () => remove?.click())
    expect(fixture.engine.removeTrack).toHaveBeenCalledWith('track-a')

    const append = Array.from(popover?.querySelectorAll<HTMLButtonElement>('.vz-dock-playlist-load-mode button') ?? [])
      .find(button => button.textContent === 'Append')
    await act(async () => append?.click())
    expect(container?.querySelector('.vz-dock-addtrack-btn')?.getAttribute('aria-label')).toBe('Append Track')

    await dispatchAudioFile('appended-track.wav')
    expect(fixture.engine.addTracks).toHaveBeenCalledWith(
      [expect.any(File)],
      { notifyOnBlocked: false },
    )
    expect(fixture.engine.replaceTracks).not.toHaveBeenCalled()
  })

  it('loads USB audio before the deferred Rekordbox scan completes', async () => {
    fixture.nativeRekordbox.guessedRoot = '/Volumes/DJ'
    let resolveScan!: (value: unknown) => void
    fixture.nativeRekordbox.scan.mockReturnValue(new Promise(resolve => { resolveScan = resolve }))
    await renderView('react')

    await dispatchAudioFile('rekordbox-track.wav')

    expect(fixture.engine.addTracks).toHaveBeenCalledOnce()
    expect(fixture.nativeRekordbox.scan).toHaveBeenCalledWith('/Volumes/DJ')
    expect(vi.mocked(fixture.engine.addTracks).mock.invocationCallOrder[0]).toBeLessThan(
      fixture.nativeRekordbox.scan.mock.invocationCallOrder[0]!,
    )
    expect(fixture.engine.replacePreparedTracks).not.toHaveBeenCalled()
    expect(container?.querySelector('[role="status"]')?.textContent).toContain('Audio ready · Rekordbox metadata loading')
    expect(container?.querySelector<HTMLInputElement>('input[type="file"][accept="audio/*"]')?.disabled).toBe(false)
    expect(Object.values(usePageActivityStore.getState().pages.react)).toContain('Loading Rekordbox metadata')

    await act(async () => {
      resolveScan({
        cancelled: false,
        library: { source: 'rekordbox_usb', tracks: [], stats: {}, warnings: [] },
      })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fixture.engine.hydrateTrackMetadata).toHaveBeenCalledWith(
      'loaded-0',
      expect.objectContaining({ source: 'rekordbox_usb' }),
    )
    expect(fixture.engine.replacePreparedTracks).not.toHaveBeenCalled()
    expect(Object.values(usePageActivityStore.getState().pages.react)).not.toContain('Loading Rekordbox metadata')
  })

  it('keeps audio loaded when the asynchronous Rekordbox scan fails', async () => {
    fixture.nativeRekordbox.guessedRoot = '/Volumes/DJ'
    fixture.nativeRekordbox.scan.mockRejectedValue(new Error('USB unavailable'))
    await renderView('react')

    await dispatchAudioFile('rekordbox-track.wav')
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(fixture.engine.addTracks).toHaveBeenCalledOnce()
    expect(fixture.engine.replacePreparedTracks).not.toHaveBeenCalled()
    expect(container?.querySelector('[role="status"]')?.textContent).toContain(
      'Audio ready · Rekordbox metadata unavailable: USB unavailable',
    )
  })

  it('hydrates USB tracks from the persisted Rekordbox index without scanning the USB', async () => {
    fixture.nativeRekordbox.guessedRoot = '/Volumes/DJ'
    fixture.nativeRekordbox.lookup.mockResolvedValue({
      available: true,
      hasIndex: true,
      hitCount: 1,
      lookupMs: 2,
      selectedRootPath: '/Volumes/DJ',
      selectedRootName: 'DJ',
      library: {
        id: 'indexed-library',
        source: 'rekordbox_usb',
        importedAt: '2026-10-12T10:00:00.000Z',
        tracks: [{ trackId: 'rb-1', name: 'rekordbox-track', filename: 'rekordbox-track.wav', cues: [] }],
        warnings: [],
        stats: { detectedPdbFiles: 1, detectedAnlzFiles: 3 },
      },
    })
    await renderView('react')

    await dispatchAudioFile('rekordbox-track.wav')
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(fixture.engine.addTracks).toHaveBeenCalledOnce()
    expect(fixture.nativeRekordbox.lookup).toHaveBeenCalledOnce()
    expect(fixture.nativeRekordbox.scan).not.toHaveBeenCalled()
    expect(fixture.engine.hydrateTrackMetadata).toHaveBeenCalledWith(
      'loaded-0',
      expect.objectContaining({ source: 'rekordbox_usb' }),
    )
  })

  it('routes the real Audio Dock SYNC button through the canonical toggle action', async () => {
    await renderView('react')

    const sync = container?.querySelector<HTMLButtonElement>('.vz-dock-sync-master-btn')
    expect(sync?.getAttribute('aria-label')).toBe('BPM Sync: OFF')
    await act(async () => sync?.click())
    expect(fixture.visualState.toggleBpmSync).toHaveBeenCalledTimes(1)
  })

  it('reserves the loaded BPM scrub-bar space when no track is loaded', async () => {
    await renderView('react')

    const placeholder = container?.querySelector('.vz-dock-bpm-track-bar--placeholder')
    expect(placeholder).not.toBeNull()
    expect(placeholder?.getAttribute('aria-hidden')).toBe('true')
    expect(container?.querySelector('.vz-dock-bpm-block')?.contains(placeholder ?? null)).toBe(true)
  })

  it('shows Dock Inline with Rekordbox provenance for a loaded Rekordbox track', async () => {
    fixture.engine.tracks = [{ id: 'rekordbox-track' }] as unknown as AudioEngine['tracks']
    fixture.engine.currentTrack = {
      id: 'rekordbox-track',
      url: 'blob:rekordbox-track',
      isRekordbox: true,
      importedCueMarkers: [{}],
      importedRekordboxPhrases: [{}],
      analysisRuntime: {
        analysisKey: 'rekordbox-track-key',
        gridStale: false,
      },
    } as AudioEngine['currentTrack']

    await renderView('react')

    const indicator = container?.querySelector('.vz-dock-source-inline')
    expect(indicator?.querySelector('img')).not.toBeNull()
    expect(indicator?.getAttribute('aria-label')).toBe('Rekordbox data loaded, cues, sections')
    expect(indicator?.getAttribute('data-audio-source-kind')).toBe('rekordbox')
    expect(indicator?.querySelector('.vz-dock-source-inline-dot')).not.toBeNull()
    expect(indicator?.querySelector('.vz-dock-source-inline-tag')?.textContent).toBe('CUES · SECTIONS')
  })

  it('does not show the Rekordbox logo for a track with only an empty Rekordbox provenance marker', async () => {
    fixture.engine.tracks = [{ id: 'file-track' }] as unknown as AudioEngine['tracks']
    fixture.engine.currentTrack = {
      id: 'file-track',
      url: 'blob:file-track',
      isRekordbox: true,
      importedAnalysisSeed: { source: 'rekordbox_usb' },
      analysisRuntime: {
        analysisKey: 'file-track-key',
        gridStale: false,
      },
    } as AudioEngine['currentTrack']

    await renderView('react')

    const indicator = container?.querySelector('.vz-dock-source-inline')
    expect(indicator?.getAttribute('data-audio-source-kind')).toBe('file')
    expect(indicator?.textContent).toContain('Audio Track')
    expect(indicator?.querySelector('.vz-dock-source-inline-tag')?.textContent).toBe('FILE')
  })

})
