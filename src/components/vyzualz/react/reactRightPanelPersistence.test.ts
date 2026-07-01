import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_REACT_RIGHT_PANEL,
  migrateReactRightPanel,
  readReactRightPanel,
  writeReactRightPanel,
} from './reactRightPanelPersistence'

describe('React right-panel persistence', () => {
  it('restores a valid four-destination panel ID', () => {
    expect(readReactRightPanel({ getItem: () => JSON.stringify('react') })).toBe('react')
  })

  it.each([
    ['fx', 'design'],
    ['insp', 'design'],
    ['mod', 'react'],
    ['audio', 'react'],
    ['rec', 'output'],
  ] as const)('migrates legacy %s destinations to %s', (legacy, expected) => {
    expect(migrateReactRightPanel(legacy)).toBe(expected)
    expect(readReactRightPanel({ getItem: () => JSON.stringify(legacy) })).toBe(expected)
  })

  it('falls back for obsolete, malformed, or non-string values', () => {
    expect(readReactRightPanel({ getItem: () => JSON.stringify('engine') })).toBe(DEFAULT_REACT_RIGHT_PANEL)
    expect(readReactRightPanel({ getItem: () => '{broken' })).toBe(DEFAULT_REACT_RIGHT_PANEL)
    expect(readReactRightPanel({ getItem: () => JSON.stringify(123) })).toBe(DEFAULT_REACT_RIGHT_PANEL)
  })

  it('does not let storage exceptions escape the React effect', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(() => writeReactRightPanel('presets', {
      setItem: () => { throw new Error('quota') },
    })).not.toThrow()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
