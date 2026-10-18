import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotificationStore } from '../../../../stores/notificationStore'
import { HeadlinerFaceTracker } from './HeadlinerFaceTracking'
import { HeadlinerPoseTracker } from './HeadlinerPoseTracking'
import { HeadlinerSegmenter } from './HeadlinerSegmentation'

const cards = () => useNotificationStore.getState().events['react']
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }
const video = { readyState: 4, videoWidth: 640, videoHeight: 360 } as HTMLVideoElement

beforeEach(() => {
  useNotificationStore.setState({ events: { ...useNotificationStore.getState().events, react: [] } })
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

describe('Headliner tracker failure cards', () => {
  it('tells the user when the face model cannot start, once', async () => {
    const tracker = new HeadlinerFaceTracker(async () => { throw new Error('model file missing') })
    tracker.acquire()
    tracker.sample(video, 0)
    await settle()
    tracker.sample(video, 1)
    await settle()
    expect(tracker.getStatus()).toBe('unavailable')
    expect(cards()).toHaveLength(1)
    expect(cards()[0]).toMatchObject({ tone: 'warning', title: 'Face tracking unavailable' })
    expect(cards()[0]!.message).toContain('model file missing')
  })

  it('tells the user when the body model cannot start', async () => {
    const tracker = new HeadlinerPoseTracker(async () => { throw new Error('offline') })
    tracker.acquire()
    tracker.sample(video, 0)
    await settle()
    expect(cards()[0]).toMatchObject({ tone: 'warning', title: 'Body tracking unavailable' })
  })

  it('tells the user when the person cut-out cannot start', async () => {
    const segmenter = new HeadlinerSegmenter(async () => { throw new Error('wasm blocked') })
    segmenter.acquire()
    segmenter.sample(video, { sx: 0, sy: 0, sw: 640, sh: 360 }, 0)
    await settle()
    expect(cards()[0]).toMatchObject({ tone: 'warning', title: 'Person cut-out unavailable' })
    expect(cards()[0]!.message).toContain('Silhouette')
  })

  it('reports a detection error once, not on every frame', async () => {
    const tracker = new HeadlinerFaceTracker(async () => ({
      detectForVideo: () => { throw new Error('bad frame') },
      close: () => undefined,
    }) as never)
    tracker.acquire()
    tracker.sample(video, 0)
    await settle()
    for (let t = 1; t <= 5; t += 1) tracker.sample(video, t)
    expect(cards()).toHaveLength(1)
    expect(cards()[0]).toMatchObject({ tone: 'warning', title: 'Face tracking stopped' })
  })

  it('stays quiet when the model loads and runs', async () => {
    const tracker = new HeadlinerFaceTracker(async () => ({
      detectForVideo: () => ({ faceLandmarks: [] }),
      close: () => undefined,
    }) as never)
    tracker.acquire()
    tracker.sample(video, 0)
    await settle()
    tracker.sample(video, 1)
    expect(tracker.getStatus()).toBe('ready')
    expect(cards()).toHaveLength(0)
  })
})
