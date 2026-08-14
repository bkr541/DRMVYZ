import { describe, expect, it } from 'vitest'
import type { HeadlinerCameraFrameSource } from './HeadlinerCameraRuntime'
import {
  advanceHeadlinerAdaptiveQuality,
  createHeadlinerFullscreenProgram,
  HEADLINER_ADAPTIVE_SCALES,
  HEADLINER_CONNECTION_LOST_TEXT,
  HEADLINER_INITIAL_ADAPTIVE_QUALITY,
  HEADLINER_MAX_CAMERA_LAYERS,
  resolveHeadlinerCoverSourceRect,
} from './HeadlinerCompositor'

describe('Headliner fullscreen compositor domain', () => {
  it('builds a single fullscreen layer while preserving the four-camera extension boundary', () => {
    const video = {} as HTMLVideoElement
    const source = {
      slotId: 'camera-1',
      sourceId: 'default-front-camera',
      video,
      stream: {} as MediaStream,
    } satisfies HeadlinerCameraFrameSource

    expect(HEADLINER_MAX_CAMERA_LAYERS).toBe(4)
    expect(createHeadlinerFullscreenProgram(source)).toEqual({
      mode: 'fullscreen',
      cameraStatus: 'live',
      layers: [{
        slotId: 'camera-1',
        sourceId: 'default-front-camera',
        video,
        enabled: true,
        opacity: 1,
        viewport: { x: 0, y: 0, width: 1, height: 1 },
        sourceCrop: null,
        transform: { scaleX: 1, scaleY: 1, rotationDeg: 0 },
        effectIds: [],
      }],
      masterEffectIds: [],
    })
    expect(createHeadlinerFullscreenProgram(null).layers).toEqual([])
    expect(createHeadlinerFullscreenProgram(null, 'disconnected')).toMatchObject({
      cameraStatus: 'disconnected',
      layers: [],
    })
    expect(HEADLINER_CONNECTION_LOST_TEXT).toBe('Connection Lost')
  })

  it('center-crops landscape and portrait sources to cover the program canvas', () => {
    expect(resolveHeadlinerCoverSourceRect(1920, 1080, 1000, 1000)).toEqual({
      sx: 420,
      sy: 0,
      sw: 1080,
      sh: 1080,
    })
    expect(resolveHeadlinerCoverSourceRect(1080, 1920, 1600, 900)).toEqual({
      sx: 0,
      sy: 656.25,
      sw: 1080,
      sh: 607.5,
    })
    expect(resolveHeadlinerCoverSourceRect(0, 1080, 1600, 900)).toBeNull()
  })

  it('degrades only after sustained pressure and recovers only after a long healthy window', () => {
    let state = { ...HEADLINER_INITIAL_ADAPTIVE_QUALITY }

    for (let index = 0; index < 7; index += 1) state = advanceHeadlinerAdaptiveQuality(state, 48)
    expect(state.tier).toBe(0)
    state = advanceHeadlinerAdaptiveQuality(state, 48)
    expect(state.tier).toBe(1)
    expect(HEADLINER_ADAPTIVE_SCALES[state.tier]).toBe(0.85)

    for (let index = 0; index < 119; index += 1) state = advanceHeadlinerAdaptiveQuality(state, 16)
    expect(state.tier).toBe(1)
    state = advanceHeadlinerAdaptiveQuality(state, 16)
    expect(state.tier).toBe(0)
  })

  it('does not oscillate quality on isolated slow or ambiguous frames', () => {
    const initial = { ...HEADLINER_INITIAL_ADAPTIVE_QUALITY }
    const slow = advanceHeadlinerAdaptiveQuality(initial, 44)
    const ambiguous = advanceHeadlinerAdaptiveQuality(slow, 33)
    const healthy = advanceHeadlinerAdaptiveQuality(ambiguous, 18)

    expect(slow.tier).toBe(0)
    expect(ambiguous.tier).toBe(0)
    expect(healthy.tier).toBe(0)
  })
})
