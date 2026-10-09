import { describe, expect, it, vi } from 'vitest'
import {
  HEADLINER_FACE_OVAL_INDICES,
  HeadlinerFaceFilter,
  HeadlinerFaceTracker,
  computeHeadlinerFacePose,
  mapHeadlinerFaceToCanvas,
  type HeadlinerFaceLandmark,
  type HeadlinerFaceSample,
} from './HeadlinerFaceTracking'

/** 478 landmarks at the centre of the frame, with the oval laid out on an ellipse and the eyes set on a line. */
function landmarks(options: { cx?: number; cy?: number; rx?: number; ry?: number; roll?: number } = {}): HeadlinerFaceLandmark[] {
  const { cx = 0.5, cy = 0.4, rx = 0.1, ry = 0.15, roll = 0 } = options
  const points: HeadlinerFaceLandmark[] = Array.from({ length: 478 }, () => ({ x: cx, y: cy }))
  HEADLINER_FACE_OVAL_INDICES.forEach((index, step) => {
    const angle = (step / HEADLINER_FACE_OVAL_INDICES.length) * Math.PI * 2
    points[index] = { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry }
  })
  points[33] = { x: cx - Math.cos(roll) * 0.05, y: cy - Math.sin(roll) * 0.05 }
  points[263] = { x: cx + Math.cos(roll) * 0.05, y: cy + Math.sin(roll) * 0.05 }
  return points
}

const sample = (pose: HeadlinerFaceSample['pose'], sequence: number): HeadlinerFaceSample => ({ status: 'ready', pose, sequence })

describe('Headliner face pose', () => {
  it('finds the centre and size of the face outline', () => {
    const pose = computeHeadlinerFacePose(landmarks({ cx: 0.4, cy: 0.3, rx: 0.1, ry: 0.15 }), 1280, 720)!
    expect(pose.cx).toBeCloseTo(0.4, 2)
    expect(pose.cy).toBeCloseTo(0.3, 2)
    expect(pose.width).toBeCloseTo(0.2, 1)
    expect(pose.height).toBeCloseTo(0.3, 1)
    expect(pose.roll).toBeCloseTo(0, 5)
  })

  it('reads head tilt in pixel space, so a wide frame does not skew the angle', () => {
    // Eyes 0.1 apart in x and 0.1 in y of a 1280 x 640 frame: 128 px across, 64 px down → atan(0.5).
    const tilted = landmarks()
    tilted[33] = { x: 0.45, y: 0.35 }
    tilted[263] = { x: 0.55, y: 0.45 }
    expect(computeHeadlinerFacePose(tilted, 1280, 640)!.roll).toBeCloseTo(Math.atan2(64, 128), 5)
    expect(computeHeadlinerFacePose(landmarks({ roll: 0.3 }), 1000, 1000)!.roll).toBeCloseTo(0.3, 5)
  })

  it('rejects incomplete or degenerate landmark sets', () => {
    expect(computeHeadlinerFacePose([], 1280, 720)).toBeNull()
    expect(computeHeadlinerFacePose(landmarks(), 0, 720)).toBeNull()
    expect(computeHeadlinerFacePose(landmarks({ rx: 0, ry: 0 }), 1280, 720)).toBeNull()
  })

  it('maps a pose from the camera frame into canvas pixels through the crop', () => {
    const pose = { cx: 0.5, cy: 0.5, width: 0.25, height: 0.5, roll: 0.2 }
    const full = mapHeadlinerFaceToCanvas(pose, 1280, 720, { sx: 0, sy: 0, sw: 1280, sh: 720 }, 1280, 720)
    expect(full).toEqual({ cx: 640, cy: 360, width: 320, height: 360, roll: 0.2 })
    // Showing the right half of the camera at the same canvas size doubles everything and shifts the face.
    const cropped = mapHeadlinerFaceToCanvas(pose, 1280, 720, { sx: 640, sy: 0, sw: 640, sh: 720 }, 1280, 720)
    expect(cropped.cx).toBeCloseTo(0, 5)
    expect(cropped.width).toBeCloseTo(640, 5)
  })
})

describe('Headliner face filter', () => {
  const pose = (cx: number) => ({ cx, cy: 0.4, width: 0.2, height: 0.3, roll: 0 })

  it('glides toward a moved face instead of jumping, and snaps with zero smoothing', () => {
    const smooth = new HeadlinerFaceFilter()
    smooth.update(sample(pose(0.3), 1), 0, 0.1)
    const step = smooth.update(sample(pose(0.7), 2), 1 / 60, 0.1)
    expect(step.pose!.cx).toBeGreaterThan(0.3)
    expect(step.pose!.cx).toBeLessThan(0.7)

    const tight = new HeadlinerFaceFilter()
    tight.update(sample(pose(0.3), 1), 0, 0)
    expect(tight.update(sample(pose(0.7), 2), 1 / 60, 0).pose!.cx).toBeCloseTo(0.7, 5)
  })

  it('turns the head the short way round the circle', () => {
    const filter = new HeadlinerFaceFilter()
    filter.update(sample({ ...pose(0.5), roll: 3.0 }, 1), 0, 0.1)
    const next = filter.update(sample({ ...pose(0.5), roll: -3.0 }, 2), 0.1, 0.1)
    expect(next.pose!.roll).toBeGreaterThan(3.0)
  })

  it('holds a lost face briefly, then fades it out and forgets it', () => {
    const filter = new HeadlinerFaceFilter()
    filter.update(sample(pose(0.5), 1), 0, 0.05)
    let now = 0
    const run = (seconds: number) => {
      let result = filter.update(sample(null, 2), now, 0.05)
      for (let step = 0; step < Math.round(seconds * 10); step += 1) {
        now += 0.1
        result = filter.update(sample(null, 2), now, 0.05)
      }
      return result
    }
    expect(run(0.2).presence).toBe(1)
    const fading = run(0.3)
    expect(fading.presence).toBeGreaterThan(0)
    expect(fading.presence).toBeLessThan(1)
    expect(run(1.5)).toEqual({ pose: null, presence: 0 })
  })
})

describe('Headliner face tracker', () => {
  const video = { readyState: 4, videoWidth: 1280, videoHeight: 720 } as unknown as HTMLVideoElement

  it('loads on first use, follows detections at a steady rate and closes when the last user lets go', async () => {
    const detect = vi.fn(() => ({ faceLandmarks: [landmarks()] }))
    const close = vi.fn()
    const tracker = new HeadlinerFaceTracker(async () => ({ detectForVideo: detect, close }))

    tracker.acquire()
    expect(tracker.sample(video, 0).status).toBe('loading')
    await Promise.resolve()
    await Promise.resolve()
    expect(tracker.getStatus()).toBe('ready')

    const first = tracker.sample(video, 1)
    expect(first.pose).not.toBeNull()
    const sequence = first.sequence
    // Asking again inside the detection interval re-uses the last result.
    expect(tracker.sample(video, 1.01).sequence).toBe(sequence)
    expect(detect).toHaveBeenCalledTimes(1)
    expect(tracker.sample(video, 1.05).sequence).toBe(sequence + 1)

    tracker.release()
    expect(close).toHaveBeenCalledTimes(1)
    expect(tracker.getStatus()).toBe('idle')
  })

  it('reports no pose when nothing is found, and stays unavailable when the model cannot load', async () => {
    const empty = new HeadlinerFaceTracker(async () => ({ detectForVideo: () => ({ faceLandmarks: [] }), close: vi.fn() }))
    empty.acquire()
    empty.sample(video, 0)
    await Promise.resolve()
    await Promise.resolve()
    expect(empty.sample(video, 1).pose).toBeNull()

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const broken = new HeadlinerFaceTracker(async () => { throw new Error('no wasm') })
    broken.acquire()
    broken.sample(video, 0)
    await Promise.resolve()
    await Promise.resolve()
    expect(broken.sample(video, 1)).toMatchObject({ status: 'unavailable', pose: null })
    warn.mockRestore()
  })

  it('restarts detection when the clock goes backwards', async () => {
    const detect = vi.fn(() => ({ faceLandmarks: [landmarks()] }))
    const tracker = new HeadlinerFaceTracker(async () => ({ detectForVideo: detect, close: vi.fn() }))
    tracker.acquire()
    tracker.sample(video, 5)
    await Promise.resolve()
    await Promise.resolve()
    tracker.sample(video, 5)
    tracker.sample(video, 0)
    expect(detect).toHaveBeenCalledTimes(2)
  })
})
