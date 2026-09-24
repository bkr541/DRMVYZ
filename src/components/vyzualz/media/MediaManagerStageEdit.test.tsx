// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  overlay: vi.fn(),
  timeline: vi.fn(),
}))

/** The most recent props a mocked component was rendered with. */
function lastProps(mock: { mock: { calls: unknown[][] } }): Record<string, any> {
  const calls = mock.mock.calls
  return calls[calls.length - 1]![0] as Record<string, any>
}

vi.mock('../../../stores/mediaStore', () => ({
  useMediaStore: Object.assign(
    (selector: (state: unknown) => unknown) => selector({ retryMediaAsset: async () => false, markMediaAssetLoaded: () => undefined }),
    { getState: () => ({ items: [], ensureMediaSigned: async () => undefined }) },
  ),
}))
vi.mock('../../../stores/audioStore', () => ({
  useAudioStore: (selector: (state: unknown) => unknown) => selector({ getSignedUrl: async () => null }),
}))
vi.mock('../hooks/useWaveformPeaks', () => ({ useWaveformPeaks: () => ({ peaks: null }) }))
vi.mock('../transport/VzMiniWaveform', () => ({ VzMiniWaveform: () => null }))
vi.mock('./MediaEditPreview', () => ({
  MediaEditPreview: (props: Record<string, unknown>) => { mocks.preview(props); return <canvas data-testid="edit-canvas" /> },
}))
vi.mock('./MediaEditCropOverlay', () => ({
  MediaEditCropOverlay: (props: Record<string, unknown>) => { mocks.overlay(props); return <div data-testid="crop-overlay" /> },
}))
vi.mock('./MediaVideoTimeline', () => ({
  MediaVideoTimeline: (props: Record<string, unknown>) => { mocks.timeline(props); return <div data-testid="video-timeline" /> },
}))

import { MediaManagerStage } from './MediaManagerStage'
import { useMediaEditStore } from '../../../stores/mediaEditStore'
import type { UploadedMedia } from '../../../stores/mediaStore'

function media(overrides: Partial<UploadedMedia> = {}): UploadedMedia {
  return {
    id: 'db-1', name: 'sunset.jpg', title: 'Sunset', type: 'image', url: 'https://signed/sunset.jpg',
    thumbnailUrl: null, meta: 'JPG', favorite: false, mediaRole: 'background_image', tags: [], collectionIds: [],
    metadata: {}, mimeType: 'image/jpeg', ...overrides,
  }
}
const video = () => media({ id: 'db-2', type: 'video', name: 'clip.mp4', url: 'https://signed/clip.mp4', mimeType: 'video/mp4' })

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

async function renderStage(item: UploadedMedia) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => { root?.render(<MediaManagerStage media={item} track={null} />) })
}

beforeEach(() => {
  vi.clearAllMocks()
  useMediaEditStore.getState().endSession()
})
afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
  useMediaEditStore.getState().endSession()
})

describe('Media Manager stage with the edit session', () => {
  it('shows untouched media directly, with no edit canvas', async () => {
    useMediaEditStore.getState().beginSession('db-1')
    await renderStage(media())
    expect(container!.querySelector('img.mms-image')).not.toBeNull()
    expect(container!.querySelector('img.mms-source--hidden')).toBeNull()
    expect(container!.querySelector('[data-testid="edit-canvas"]')).toBeNull()
  })

  it('hands the image preview the live edit state', async () => {
    useMediaEditStore.getState().beginSession('db-1')
    await renderStage(media())
    await act(async () => {
      useMediaEditStore.getState().setSlider('brightness', 30)
      useMediaEditStore.getState().toggleMirror()
    })
    expect(container!.querySelector('[data-testid="edit-canvas"]')).not.toBeNull()
    const props = lastProps(mocks.preview)
    expect(props.kind).toBe('image')
    expect(props.edit).toMatchObject({ brightness: 30, mirror: true })
    expect(props.ignoreCrop).toBe(false)
    // The real <img> stays mounted (hidden) as the source.
    expect(container!.querySelector('img.mms-source--hidden')).not.toBeNull()
  })

  it('hands the video preview the live edit state without creating a second video', async () => {
    useMediaEditStore.getState().beginSession('db-2')
    await renderStage(video())
    await act(async () => { useMediaEditStore.getState().setSlider('contrast', -20) })
    const props = lastProps(mocks.preview)
    expect(props.kind).toBe('video')
    expect(props.edit).toMatchObject({ contrast: -20 })
    expect(container!.querySelectorAll('video')).toHaveLength(1)
    expect(container!.querySelector('video.mms-source--hidden')).not.toBeNull()
  })

  it('keeps the video playback controls and timeline mounted while editing', async () => {
    useMediaEditStore.getState().beginSession('db-2')
    await renderStage(video())
    await act(async () => { useMediaEditStore.getState().setSlider('blur', 40) })

    expect(container!.querySelector('.mms-play-btn')).not.toBeNull()
    expect(container!.querySelector('.mms-scrubber')).not.toBeNull()
    expect(container!.querySelector('[data-testid="video-timeline"]')).not.toBeNull()
    // Controls sit between the visualizer and the timeline, as before.
    const order = [...container!.querySelectorAll('.mms-media-area, .mms-controls, [data-testid="video-timeline"]')]
      .map(node => node.className || node.getAttribute('data-testid'))
    expect(order).toEqual(['mms-media-area', 'mms-controls', 'video-timeline'])
    expect(lastProps(mocks.timeline)).toMatchObject({ mediaId: 'db-2', src: 'https://signed/clip.mp4' })
  })

  it('ignores an edit session that belongs to a different item', async () => {
    useMediaEditStore.getState().beginSession('db-other')
    await act(async () => { useMediaEditStore.getState().setSlider('brightness', 50) })
    await renderStage(media())
    expect(container!.querySelector('[data-testid="edit-canvas"]')).toBeNull()
  })

  it('crop mode shows the full frame with a crop overlay and Apply / Cancel / Reset', async () => {
    useMediaEditStore.getState().beginSession('db-1')
    await renderStage(media())
    await act(async () => { useMediaEditStore.getState().setCropMode(true) })

    expect(lastProps(mocks.preview).ignoreCrop).toBe(true)
    expect(container!.querySelector('[data-testid="crop-overlay"]')).not.toBeNull()
    const labels = [...container!.querySelectorAll('.mms-crop-toolbar button')].map(b => b.textContent)
    expect(labels).toEqual(['Reset', 'Cancel', 'Apply Crop'])
  })

  it('Apply Crop stores a source-space crop and leaves crop mode', async () => {
    useMediaEditStore.getState().beginSession('db-1')
    await renderStage(media())
    await act(async () => { useMediaEditStore.getState().rotate(1); useMediaEditStore.getState().setCropMode(true) })
    // Draw a rectangle in the oriented frame: the left half of what the user sees.
    await act(async () => { lastProps(mocks.overlay).onChange({ x: 0, y: 0, width: 0.5, height: 1 }) })
    const apply = [...container!.querySelectorAll<HTMLButtonElement>('.mms-crop-toolbar button')].find(b => b.textContent === 'Apply Crop')!
    await act(async () => { apply.click() })

    const { crop, rotation } = useMediaEditStore.getState().edit
    expect(useMediaEditStore.getState().cropMode).toBe(false)
    expect(rotation).toBe(90)
    // A quarter turn clockwise puts the source's bottom edge on the left, so the visible left half is the source's bottom half.
    expect(crop.width).toBeCloseTo(1)
    expect(crop.height).toBeCloseTo(0.5)
    expect(crop.y).toBeCloseTo(0.5)
  })

  it('Cancel leaves the crop untouched', async () => {
    useMediaEditStore.getState().beginSession('db-1')
    await renderStage(media())
    await act(async () => { useMediaEditStore.getState().setCropMode(true) })
    const cancel = [...container!.querySelectorAll<HTMLButtonElement>('.mms-crop-toolbar button')].find(b => b.textContent === 'Cancel')!
    await act(async () => { cancel.click() })
    expect(useMediaEditStore.getState().cropMode).toBe(false)
    expect(useMediaEditStore.getState().edit.crop).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })

  it('falls back to the plain source, with a notice, if the GPU preview cannot start', async () => {
    useMediaEditStore.getState().beginSession('db-1')
    await renderStage(media())
    await act(async () => { useMediaEditStore.getState().setSlider('brightness', 30) })
    await act(async () => { lastProps(mocks.preview).onFault('Live edit preview needs GPU (WebGL2) rendering') })
    expect(container!.querySelector('[data-testid="edit-canvas"]')).toBeNull()
    expect(container!.querySelector('img.mms-source--hidden')).toBeNull()
    expect(container!.textContent).toContain('Live preview unavailable')
  })
})
