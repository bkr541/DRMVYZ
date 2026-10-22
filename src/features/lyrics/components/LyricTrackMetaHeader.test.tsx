// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricManagerTrack } from '../lyricManagerTypes'
import { LyricTrackMetaHeader } from './LyricTrackMetaHeader'

const track = {
  id: 't1', dbId: 'db1', title: 'Trace of You', artist: 'DVYDRM', fileName: 'trace.mp3', bpm: 148.2, musicalKey: 'Fm', durationSec: 162, genre: 'Melodic Bass',
  lyricVersionCount: 1, activeLyricDocumentId: null, activeLyricDocumentName: null,
} as unknown as LyricManagerTrack

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.useFakeTimers()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

async function render(props: Partial<React.ComponentProps<typeof LyricTrackMetaHeader>> = {}) {
  await act(async () => {
    root.render(
      <LyricTrackMetaHeader track={track} loading={false} selectedTrackLoaded={false} selectedTrackPlaying={false} onLoadTrack={vi.fn()} {...props} />,
    )
  })
  await act(async () => { vi.advanceTimersByTime(300) })
}

describe('LyricTrackMetaHeader', () => {
  it('keeps the text-badge strip when no controls are docked', async () => {
    await render({ selectedTrackLoaded: true, selectedTrackPlaying: true })
    expect(container.querySelector('.lmv-track-meta-fill--docked')).toBeNull()
    expect([...container.querySelectorAll('.lmv-track-state-badges > *')].map(badge => badge.textContent)).toEqual(['Loaded', 'Playing'])
    expect(container.querySelector('.lmv-track-meta-line')?.textContent).toBe('148 BPM • Fm • 2:42 • Melodic Bass')
  })

  describe('with controls docked', () => {
    const controls = <div data-testid="controls" />

    it('shows the artist and genre under the title, and BPM and key as readouts', async () => {
      await render({ controls })
      expect(container.querySelector('.lmv-track-meta-fill')?.classList.contains('lmv-track-meta-fill--docked')).toBe(true)
      expect(container.querySelector('.lmv-track-title')?.textContent).toBe('Trace of You')
      expect(container.querySelector('.lmv-track-byline')?.textContent).toBe('DVYDRM • Melodic Bass')
      const specs = [...container.querySelectorAll('.lmv-track-spec')].map(spec => spec.textContent?.replace(/\s+/g, ' ').trim())
      expect(specs).toEqual(['148 BPM', 'Fm Key'])
      expect(container.querySelector('.lmv-track-specs')?.getAttribute('aria-label')).toBe('Track details')
    })

    it('omits a readout the track does not have, and the whole block when it has neither', async () => {
      await render({ controls, track: { ...track, bpm: null, musicalKey: 'Fm' } as unknown as LyricManagerTrack })
      expect([...container.querySelectorAll('.lmv-track-spec')]).toHaveLength(1)
      await render({ controls, track: { ...track, bpm: null, musicalKey: null, genre: null, artist: '' } as unknown as LyricManagerTrack })
      expect(container.querySelector('.lmv-track-specs')).toBeNull()
      expect(container.querySelector('.lmv-track-byline')?.textContent).toBe('Unknown artist')
    })

    it('shows loaded and playing as named LEDs rather than text badges', async () => {
      await render({ controls, selectedTrackLoaded: false })
      expect(container.querySelector('.lmv-track-led')).toBeNull()
      await render({ controls, selectedTrackLoaded: true, selectedTrackPlaying: true })
      expect([...container.querySelectorAll('.lmv-track-led')].map(led => led.getAttribute('aria-label'))).toEqual(['Loaded', 'Playing'])
      expect(container.querySelector('.lmv-track-state-badges')).toBeNull()
    })

    it('puts the controls after the identity, and Load deck ahead of them until the deck is loaded', async () => {
      const onLoadTrack = vi.fn()
      await render({ controls, onLoadTrack })
      const wrapper = container.querySelector('.lmv-track-meta-controls')!
      expect(wrapper.firstElementChild?.textContent).toBe('Load deck')
      expect(wrapper.contains(container.querySelector('[data-testid="controls"]'))).toBe(true)
      await act(async () => (wrapper.querySelector('button') as HTMLButtonElement).click())
      expect(onLoadTrack).toHaveBeenCalledTimes(1)
      await render({ controls, onLoadTrack, selectedTrackLoaded: true })
      expect(container.querySelector('.lmv-track-meta-load')).toBeNull()
    })

    it('shows Loading while the deck loads, and disables the button', async () => {
      await render({ controls, loading: true })
      const button = container.querySelector('.lmv-track-meta-load') as HTMLButtonElement
      expect(button.textContent).toBe('Loading…')
      expect(button.disabled).toBe(true)
    })
  })
})
