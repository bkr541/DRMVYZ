import { describe, expect, it } from 'vitest'
import { mergeStorageValues, splitStorageValue } from './splitPersistStorage'

type TestState = {
  preference: string
  project: { payload: string }
  clips: unknown[]
}

describe('splitPersistStorage helpers', () => {
  it('keeps small preferences local and moves project fields into the project envelope', () => {
    const split = splitStorageValue<TestState>({
      version: 7,
      state: {
        preference: 'presets',
        project: { payload: '<svg>large</svg>' },
        clips: [{ id: 'clip-1' }],
      },
    }, ['project', 'clips'])

    expect(split.local).toEqual({
      version: 7,
      state: { preference: 'presets' },
    })
    expect(split.project).toEqual({
      version: 7,
      state: {
        project: { payload: '<svg>large</svg>' },
        clips: [{ id: 'clip-1' }],
      },
    })
    expect(split.hasProjectData).toBe(true)
  })

  it('merges local and project envelopes back into one Zustand snapshot', () => {
    const merged = mergeStorageValues<TestState>(
      { version: 3, state: { preference: 'fx' } },
      { version: 3, state: { project: { payload: 'data' }, clips: [] } },
    )

    expect(merged).toEqual({
      version: 3,
      state: {
        preference: 'fx',
        project: { payload: 'data' },
        clips: [],
      },
    })
  })
})
