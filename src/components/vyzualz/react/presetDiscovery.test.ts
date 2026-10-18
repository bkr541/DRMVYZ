import { describe, expect, it } from 'vitest'
import { presetMatchesDiscoveryQuery, resolvePresetDiscoveryMetadata } from './presetDiscovery'

describe('preset discovery metadata', () => {
  it('normalizes every preset to a category and de-duplicated tags', () => {
    expect(resolvePresetDiscoveryMetadata(
      { category: ' Drop ', tags: ['dubstep', 'DUBSTEP', 'volumetric'] },
      'fallback',
      ['festival bass'],
    )).toEqual({
      category: 'Drop',
      tags: ['Drop', 'dubstep', 'volumetric', 'festival bass'],
    })

    expect(resolvePresetDiscoveryMetadata({}, 'camera-effect')).toEqual({
      category: 'camera-effect',
      tags: ['camera-effect'],
    })
  })

  it('searches names, descriptions, categories, and tags case-insensitively', () => {
    const preset = {
      name: 'Prism Array',
      description: 'A geometric constellation.',
      category: 'Reactive World',
      tags: ['house', 'audio-reactive'],
    }

    expect(presetMatchesDiscoveryQuery('prism', preset)).toBe(true)
    expect(presetMatchesDiscoveryQuery('GEOMETRIC', preset)).toBe(true)
    expect(presetMatchesDiscoveryQuery('reactive world', preset)).toBe(true)
    expect(presetMatchesDiscoveryQuery('house', preset)).toBe(true)
    expect(presetMatchesDiscoveryQuery('dubstep', preset)).toBe(false)
  })
})
