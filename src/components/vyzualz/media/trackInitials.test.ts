import { describe, expect, it } from 'vitest'
import { trackInitials } from './trackInitials'

describe('trackInitials', () => {
  it('uses the first letters of the first two words of the title and artist', () => {
    expect(trackInitials({ title: 'Tape B x Levity', artist: 'Levity' })).toBe('TB')
  })

  it('skips separators like the dash in "MPH - Raw"', () => {
    expect(trackInitials({ title: 'MPH - Raw (UrBoiN8 Remix)', artist: 'UrBoiN8' })).toBe('MR')
  })

  it('falls back to the file name, then to a note glyph', () => {
    expect(trackInitials({ title: '', fileName: 'reverie.mp3', artist: null })).toBe('R')
    expect(trackInitials({ title: ' - ', artist: null })).toBe('♪')
    expect(trackInitials(null)).toBe('♪')
  })
})
