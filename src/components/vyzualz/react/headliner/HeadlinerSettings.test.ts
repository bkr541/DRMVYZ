import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HEADLINER_SETTINGS,
  normalizeHeadlinerEngineMode,
  normalizeHeadlinerInputSource,
  normalizeHeadlinerSettings,
} from './HeadlinerSettings'

describe('Headliner settings normalization', () => {
  it('keeps the only Stage 1 mode and the default source unchanged', () => {
    expect(normalizeHeadlinerSettings({
      mode: 'fullscreen',
      inputSourceId: 'default-front-camera',
    })).toEqual(DEFAULT_HEADLINER_SETTINGS)
  })

  it('falls unknown future or corrupt mode values back to the Stage 1 contract', () => {
    expect(normalizeHeadlinerEngineMode('quad')).toBe('fullscreen')
    expect(normalizeHeadlinerSettings({ mode: 'mirror', inputSourceId: '' }))
      .toEqual(DEFAULT_HEADLINER_SETTINGS)
  })

  it('keeps a chosen camera deviceId and rejects non-string or oversized source ids', () => {
    expect(normalizeHeadlinerInputSource('a1b2c3deviceid')).toBe('a1b2c3deviceid')
    expect(normalizeHeadlinerInputSource(42)).toBe('default-front-camera')
    expect(normalizeHeadlinerInputSource('x'.repeat(513))).toBe('default-front-camera')
  })

  it('normalizes missing and non-object state safely', () => {
    expect(normalizeHeadlinerSettings(undefined)).toEqual(DEFAULT_HEADLINER_SETTINGS)
    expect(normalizeHeadlinerSettings('invalid')).toEqual(DEFAULT_HEADLINER_SETTINGS)
  })
})
