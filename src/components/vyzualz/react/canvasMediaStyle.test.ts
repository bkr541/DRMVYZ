import { describe, expect, it } from 'vitest'
import { makeCanvasMediaStyle } from './ReactCanvasEngineShell'
import { resolveCanvasPresetClick } from './ReactPresetsPanel'
import { DEFAULT_CANVAS_ENGINE_SETTINGS, DEFAULT_CANVAS_PRESET_ID } from './ReactTypes'

const settings = (patch: Partial<typeof DEFAULT_CANVAS_ENGINE_SETTINGS>) => ({ ...DEFAULT_CANVAS_ENGINE_SETTINGS, ...patch })

describe('makeCanvasMediaStyle', () => {
  it('sizes a Cover fit to the cover rectangle (stage units) so Scale shrinks the whole picture instead of a cropped box', () => {
    const style = makeCanvasMediaStyle(settings({ fitMode: 'cover' }), 1, 2.5)
    expect(style.objectFit).toBe('fill')
    expect(style.width).toBe('max(100cqw, calc(100cqh * 2.5))')
    expect(style.height).toBe('max(100cqh, calc(100cqw / 2.5))')
    expect(style.placeSelf).toBe('unsafe center')
  })

  it('keeps Position a percentage of the stage for a Cover fit, whatever the media size', () => {
    const style = makeCanvasMediaStyle(settings({ fitMode: 'cover', scale: 0.4, positionX: -4, positionY: 2, rotation: 10 }), 1, 2.5)
    expect(style.transform).toBe('translate(-4cqw, 2cqh) rotate(10deg) scale(0.4)')
  })

  it('has no transform at the default framing', () => {
    expect(makeCanvasMediaStyle(settings({ fitMode: 'cover' }), 1, 2.5).transform).toBeUndefined()
  })

  it('falls back to object-fit cover until the media size is known', () => {
    for (const aspect of [null, 0, Number.NaN]) {
      const style = makeCanvasMediaStyle(settings({ fitMode: 'cover' }), 1, aspect)
      expect(style.objectFit).toBe('cover')
      expect(style.width).toBeUndefined()
    }
  })

  it('leaves Contain and Stretch as plain object-fit with the element-relative transform', () => {
    expect(makeCanvasMediaStyle(settings({ fitMode: 'contain' }), 1, 2.5).objectFit).toBe('contain')
    expect(makeCanvasMediaStyle(settings({ fitMode: 'stretch' }), 1, 2.5).objectFit).toBe('fill')
    expect(makeCanvasMediaStyle(settings({ fitMode: 'contain', scale: 0.5, positionX: 10 }), 1, 2.5).transform)
      .toBe('translate(10%, 0%) rotate(0deg) scale(0.5)')
  })
})

describe('resolveCanvasPresetClick', () => {
  it('selects a preset that is not active', () => {
    expect(resolveCanvasPresetClick('canvas-fractures', 'canvas-clean-playback')).toBe('canvas-fractures')
    expect(resolveCanvasPresetClick('canvas-fractures', 'canvas-laser-image-fx')).toBe('canvas-fractures')
  })

  it('clicking the active preset again falls back to Clean Playback', () => {
    expect(resolveCanvasPresetClick('canvas-fractures', 'canvas-fractures')).toBe(DEFAULT_CANVAS_PRESET_ID)
    expect(resolveCanvasPresetClick('canvas-laser-image-fx', 'canvas-laser-image-fx')).toBe('canvas-clean-playback')
  })

  it('clicking Clean Playback while it is active keeps it', () => {
    expect(resolveCanvasPresetClick('canvas-clean-playback', 'canvas-clean-playback')).toBe('canvas-clean-playback')
  })
})
