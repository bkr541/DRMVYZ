// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { describeUnplayableFile, MAX_PHONE_TRACK_BYTES, PHONE_TRACK_ACCEPT } from './mobileAudioFiles'

const engine = {
  source: 'file' as 'file' | 'microphone',
  liveInputActive: false,
  micError: null as string | null,
  trackLoadError: null as string | null,
  currentTrack: null as { name: string; title?: string } | null,
  currentAudioTrackId: null as string | null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  replaceTracks: vi.fn((files: File[]) => files.map(file => ({ id: file.name }))),
  setSource: vi.fn(async () => {}),
  play: vi.fn(),
  pause: vi.fn(),
}

vi.mock('../../../context/AudioEngineContext', () => ({ useSharedAudio: () => engine }))
vi.mock('../../../stores/audioStore', () => {
  const state = { savedTracks: [], loading: false, loadError: null, loadSavedTracks: vi.fn(), getSignedUrl: vi.fn() }
  const useAudioStore = Object.assign((selector: (s: typeof state) => unknown) => selector(state), { getState: () => state })
  return { useAudioStore }
})

const { MobileAudioPanel } = await import('./MobileAudioPanel')

let container: HTMLElement
let root: ReturnType<typeof createRoot>

beforeEach(async () => {
  Object.assign(engine, { source: 'file', currentTrack: null })
  engine.replaceTracks.mockClear(); engine.setSource.mockClear(); engine.play.mockClear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<MobileAudioPanel />))
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function choose(file: File) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
}

describe('phone file picker', () => {
  it('offers the system file picker for audio files', () => {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
    expect(input.accept).toBe(PHONE_TRACK_ACCEPT)
    expect(input.multiple).toBe(false)
    expect(container.textContent).toContain('Choose a file from this phone')
  })

  it('opens the picker from the button tap', async () => {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
    const click = vi.spyOn(input, 'click')
    const button = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Choose a file'))!
    await act(async () => button.click())
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('loads the chosen file into the audio engine and plays it', async () => {
    const file = new File(['abc'], 'set.mp3', { type: 'audio/mpeg' })
    await choose(file)
    expect(engine.replaceTracks).toHaveBeenCalledWith([file])
    expect(engine.setSource).not.toHaveBeenCalled()
    expect(engine.play).toHaveBeenCalledTimes(1)
  })

  it('switches from the microphone to file playback', async () => {
    engine.source = 'microphone'
    await choose(new File(['abc'], 'set.m4a', { type: '' }))
    expect(engine.setSource).toHaveBeenCalledWith('file')
    expect(engine.play).toHaveBeenCalled()
  })

  it('refuses files that are not audio, without touching the engine', async () => {
    await choose(new File(['x'], 'notes.pdf', { type: 'application/pdf' }))
    expect(engine.replaceTracks).not.toHaveBeenCalled()
    expect(engine.play).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('not an audio file')
  })

  it('names the track that is playing', async () => {
    engine.currentTrack = { name: 'set.mp3' }
    await act(async () => root.render(<MobileAudioPanel />))
    expect(container.querySelector('.mobile-audio-now strong')?.textContent).toBe('set.mp3')
  })
})

describe('describeUnplayableFile', () => {
  it('accepts audio by type or by extension', () => {
    expect(describeUnplayableFile({ name: 'a.mp3', type: 'audio/mpeg', size: 10 })).toBeNull()
    expect(describeUnplayableFile({ name: 'a.FLAC', type: '', size: 10 })).toBeNull()
    expect(describeUnplayableFile({ name: 'voice', type: 'audio/x-m4a', size: 10 })).toBeNull()
  })
  it('rejects other files, empty files and files too large for a phone', () => {
    expect(describeUnplayableFile({ name: 'a.pdf', type: 'application/pdf', size: 10 })).toMatch(/not an audio file/)
    expect(describeUnplayableFile({ name: 'a.mp3', type: 'audio/mpeg', size: 0 })).toMatch(/empty/)
    expect(describeUnplayableFile({ name: 'a.wav', type: 'audio/wav', size: MAX_PHONE_TRACK_BYTES + 1 })).toMatch(/too large/)
  })
})
