import { describe, expect, it } from 'vitest'
import { LYRIC_LAYOUT_BREAKPOINTS, lyricLayoutDrawers, resolveLyricLayoutMode } from './lyricLayoutMode'

describe('lyric layout mode', () => {
  it('resolves the manager width to wide / standard / laptop / narrow at the documented breakpoints', () => {
    const { wide, standard, laptop } = LYRIC_LAYOUT_BREAKPOINTS
    expect(resolveLyricLayoutMode(1848)).toBe('wide')
    expect(resolveLyricLayoutMode(wide)).toBe('wide')
    expect(resolveLyricLayoutMode(wide - 1)).toBe('standard')
    expect(resolveLyricLayoutMode(1368)).toBe('standard')
    expect(resolveLyricLayoutMode(standard)).toBe('standard')
    expect(resolveLyricLayoutMode(standard - 1)).toBe('laptop')
    expect(resolveLyricLayoutMode(952)).toBe('laptop')
    expect(resolveLyricLayoutMode(laptop)).toBe('laptop')
    expect(resolveLyricLayoutMode(laptop - 1)).toBe('narrow')
    expect(resolveLyricLayoutMode(696)).toBe('narrow')
  })

  it('keeps the primary desktop layout when the width is unknown', () => {
    expect(resolveLyricLayoutMode(null)).toBe('wide')
    expect(resolveLyricLayoutMode(undefined)).toBe('wide')
    expect(resolveLyricLayoutMode(0)).toBe('wide')
    expect(resolveLyricLayoutMode(Number.NaN)).toBe('wide')
  })

  it('turns the Tracks rail into a drawer first, then the Inspector', () => {
    expect(lyricLayoutDrawers('wide')).toEqual({ left: false, right: false })
    expect(lyricLayoutDrawers('standard')).toEqual({ left: false, right: false })
    expect(lyricLayoutDrawers('laptop')).toEqual({ left: true, right: false })
    expect(lyricLayoutDrawers('narrow')).toEqual({ left: true, right: true })
  })
})
