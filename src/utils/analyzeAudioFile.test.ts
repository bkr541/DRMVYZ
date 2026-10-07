import { describe, expect, it } from 'vitest'
import { formatDetectedMusicalKey } from './analyzeAudioFile'

describe('upload audio metadata formatting', () => {
  it('formats detected keys for the upload Key dropdown', () => {
    expect(formatDetectedMusicalKey('C', 'major')).toBe('C')
    expect(formatDetectedMusicalKey('C#', 'major')).toBe('C#/Db')
    expect(formatDetectedMusicalKey('C#', 'minor')).toBe('C#m/Dbm')
    expect(formatDetectedMusicalKey('A', 'minor')).toBe('Am')
    expect(formatDetectedMusicalKey(null, null)).toBeNull()
  })
})
