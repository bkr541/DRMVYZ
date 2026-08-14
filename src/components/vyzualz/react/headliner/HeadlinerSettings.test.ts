import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HEADLINER_SETTINGS,
  normalizeHeadlinerEngineMode,
  normalizeHeadlinerInputSource,
  normalizeHeadlinerSettings,
} from './HeadlinerSettings'

describe('Headliner settings normalization', () => {
  it('keeps the only Stage 1 mode and source unchanged', () => {
    expect(normalizeHeadlinerSettings({
      mode: 'fullscreen',
      inputSourceId: 'default-front-camera',
    })).toEqual(DEFAULT_HEADLINER_SETTINGS)
  })

  it('falls unknown future or corrupt mode/source values back to the Stage 1 contract', () => {
    expect(normalizeHeadlinerEngineMode('quad')).toBe('fullscreen')
    expect(normalizeHeadlinerInputSource('usb-camera')).toBe('default-front-camera')
    expect(normalizeHeadlinerSettings({ mode: 'mirror', inputSourceId: 'camera-4' }))
      .toEqual(DEFAULT_HEADLINER_SETTINGS)
  })

  it('normalizes missing and non-object state safely', () => {
    expect(normalizeHeadlinerSettings(undefined)).toEqual(DEFAULT_HEADLINER_SETTINGS)
    expect(normalizeHeadlinerSettings('invalid')).toEqual(DEFAULT_HEADLINER_SETTINGS)
  })
})
