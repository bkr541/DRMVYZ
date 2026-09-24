import { describe, expect, it } from 'vitest'
import {
  MEDIA_EDIT_RANGES,
  MIN_CROP_FRACTION,
  createDefaultMediaEdit,
  dragCropRect,
  isMediaEditNeutral,
  mediaEditsEqual,
  normalizeMediaEdit,
  orientationOf,
  orientedCropToSource,
  rotateMediaEdit,
  sourceCropToOriented,
  toggleMediaEditFlip,
  toggleMediaEditMirror,
  type MediaEditState,
  type Orientation,
} from './mediaEditModel'

/** What the user sees: the display-space transform after applying each action in turn. */
function visualMatrix(actions: Array<'cw' | 'ccw' | 'flip' | 'mirror'>): Orientation {
  let m: number[][] = [[1, 0], [0, 1]]
  const mul = (a: number[][], b: number[][]) => [
    [a[0]![0]! * b[0]![0]! + a[0]![1]! * b[1]![0]!, a[0]![0]! * b[0]![1]! + a[0]![1]! * b[1]![1]!],
    [a[1]![0]! * b[0]![0]! + a[1]![1]! * b[1]![0]!, a[1]![0]! * b[0]![1]! + a[1]![1]! * b[1]![1]!],
  ]
  for (const action of actions) {
    const step = action === 'cw' ? [[0, -1], [1, 0]]
      : action === 'ccw' ? [[0, 1], [-1, 0]]
      : action === 'flip' ? [[1, 0], [0, -1]]
      : [[-1, 0], [0, 1]]
    m = mul(step, m) // each new action is applied to what is already on screen
  }
  return m.map(row => row.map(value => value || 0)) as unknown as Orientation
}

function applyActions(actions: Array<'cw' | 'ccw' | 'flip' | 'mirror'>): MediaEditState {
  let edit = createDefaultMediaEdit()
  for (const action of actions) {
    edit = action === 'cw' ? rotateMediaEdit(edit, 1)
      : action === 'ccw' ? rotateMediaEdit(edit, -1)
      : action === 'flip' ? toggleMediaEditFlip(edit)
      : toggleMediaEditMirror(edit)
  }
  return edit
}

describe('media edit defaults', () => {
  it('start neutral so an untouched session reproduces the source', () => {
    const edit = createDefaultMediaEdit()
    expect(edit).toEqual({
      crop: { x: 0, y: 0, width: 1, height: 1 },
      rotation: 0, flip: false, mirror: false,
      brightness: 0, contrast: 0, saturation: 0, hue: 0, opacity: 100, sharpness: 0, blur: 0,
    })
    expect(isMediaEditNeutral(edit)).toBe(true)
  })

  it('returns independent objects (no shared mutable crop)', () => {
    const a = createDefaultMediaEdit()
    const b = createDefaultMediaEdit()
    a.crop.width = 0.5
    expect(b.crop.width).toBe(1)
  })

  it('clamps every value into its safe range', () => {
    const wild = normalizeMediaEdit({
      ...createDefaultMediaEdit(),
      brightness: 9999, contrast: -9999, saturation: 500, hue: 720, opacity: -5, sharpness: 1000, blur: Number.NaN,
      crop: { x: -1, y: 2, width: 5, height: 0 },
    })
    expect(wild.brightness).toBe(MEDIA_EDIT_RANGES.brightness.max)
    expect(wild.contrast).toBe(MEDIA_EDIT_RANGES.contrast.min)
    expect(wild.saturation).toBe(MEDIA_EDIT_RANGES.saturation.max)
    expect(wild.hue).toBe(MEDIA_EDIT_RANGES.hue.max)
    expect(wild.opacity).toBe(0)
    expect(wild.sharpness).toBe(100)
    expect(wild.blur).toBe(0)
    expect(wild.crop.width).toBe(1)
    expect(wild.crop.height).toBe(MIN_CROP_FRACTION)
    expect(wild.crop.x).toBe(0)
    expect(wild.crop.y).toBeCloseTo(1 - MIN_CROP_FRACTION, 6)
  })
})

describe('dirty-state comparison', () => {
  it('is dirty only while a value differs from the baseline', () => {
    const baseline = createDefaultMediaEdit()
    const changed = { ...baseline, brightness: 20 }
    expect(mediaEditsEqual(changed, baseline)).toBe(false)
    expect(mediaEditsEqual({ ...changed, brightness: 0 }, baseline)).toBe(true)
  })

  it.each([
    ['crop', { crop: { x: 0.1, y: 0, width: 0.9, height: 1 } }],
    ['rotation', { rotation: 90 as const }],
    ['flip', { flip: true }],
    ['mirror', { mirror: true }],
    ['brightness', { brightness: 5 }],
    ['contrast', { contrast: 5 }],
    ['saturation', { saturation: 5 }],
    ['hue', { hue: 5 }],
    ['opacity', { opacity: 99 }],
    ['sharpness', { sharpness: 5 }],
    ['blur', { blur: 5 }],
  ])('%s alone makes the edit non-neutral', (_name, patch) => {
    expect(isMediaEditNeutral({ ...createDefaultMediaEdit(), ...patch })).toBe(false)
  })

  it('treats flip + mirror as the 180° rotation they render as, so undoing either is clean', () => {
    const both = { ...createDefaultMediaEdit(), flip: true, mirror: true }
    const rotated = { ...createDefaultMediaEdit(), rotation: 180 as const }
    expect(mediaEditsEqual(both, rotated)).toBe(true)
    expect(isMediaEditNeutral(rotateMediaEdit(both, 2))).toBe(true)
  })
})

describe('transform composition', () => {
  const sequences: Array<Array<'cw' | 'ccw' | 'flip' | 'mirror'>> = [
    ['cw'],
    ['cw', 'flip'],
    ['flip', 'cw'],
    ['mirror', 'cw', 'cw'],
    ['flip', 'cw', 'mirror', 'ccw'],
    ['cw', 'flip', 'cw', 'mirror', 'cw'],
    ['flip', 'mirror', 'cw', 'flip'],
    ['ccw', 'ccw', 'flip', 'ccw'],
  ]
  it.each(sequences.map(sequence => [sequence.join(' → '), sequence] as const))(
    'each button acts on what is on screen: %s',
    (_label, sequence) => {
      const edit = applyActions([...sequence])
      const actual = orientationOf(edit).map(row => row.map(value => value || 0))
      expect(actual).toEqual(visualMatrix([...sequence]))
    },
  )

  it('does not let transforms overwrite one another', () => {
    const edit = applyActions(['cw', 'flip', 'mirror'])
    expect(edit.flip).toBe(true)
    expect(edit.mirror).toBe(true)
    expect(isMediaEditNeutral(edit)).toBe(false)
  })

  it('four turns return to identity', () => {
    expect(isMediaEditNeutral(applyActions(['cw', 'cw', 'cw', 'cw']))).toBe(true)
    expect(isMediaEditNeutral(applyActions(['flip', 'flip']))).toBe(true)
  })
})

describe('crop in source space', () => {
  const crop = { x: 0.1, y: 0.2, width: 0.5, height: 0.3 }
  const orientations = [
    { rotation: 0, flip: false, mirror: false },
    { rotation: 90, flip: false, mirror: false },
    { rotation: 180, flip: true, mirror: false },
    { rotation: 270, flip: false, mirror: true },
    { rotation: 90, flip: true, mirror: true },
  ] as const

  it.each(orientations.map(o => [JSON.stringify(o), o] as const))(
    'round-trips through the oriented frame: %s',
    (_label, orientation) => {
      const oriented = sourceCropToOriented(crop, orientation)
      const back = orientedCropToSource(oriented, orientation)
      expect(back.x).toBeCloseTo(crop.x, 5)
      expect(back.y).toBeCloseTo(crop.y, 5)
      expect(back.width).toBeCloseTo(crop.width, 5)
      expect(back.height).toBeCloseTo(crop.height, 5)
    },
  )

  it('swaps the rectangle axes for a quarter turn', () => {
    const oriented = sourceCropToOriented({ x: 0, y: 0, width: 0.5, height: 1 }, { rotation: 90, flip: false, mirror: false })
    expect(oriented.width).toBeCloseTo(1)
    expect(oriented.height).toBeCloseTo(0.5)
  })
})

describe('crop dragging', () => {
  const start = { x: 0.2, y: 0.2, width: 0.4, height: 0.4 }
  it('moves without leaving the frame', () => {
    expect(dragCropRect(start, 'move', 5, 5)).toMatchObject({ x: 0.6, y: 0.6 })
    expect(dragCropRect(start, 'move', -5, -5)).toMatchObject({ x: 0, y: 0 })
  })
  it('resizes from any corner or edge and never collapses', () => {
    const se = dragCropRect(start, 'se', 0.1, 0.1)
    expect(se).toMatchObject({ x: 0.2, y: 0.2 })
    expect(se.width).toBeCloseTo(0.5)
    const nw = dragCropRect(start, 'nw', 10, 10)
    expect(nw.width).toBeGreaterThanOrEqual(MIN_CROP_FRACTION)
    expect(nw.height).toBeGreaterThanOrEqual(MIN_CROP_FRACTION)
    const east = dragCropRect(start, 'e', 10, 10)
    expect(east.x + east.width).toBeLessThanOrEqual(1)
    expect(east.height).toBeCloseTo(0.4)
  })
})
