import { describe, expect, it } from 'vitest'
import { LOG_COMPONENTS, LOG_COMPONENT_LABELS, isLogComponent } from './logComponents'

describe('logComponents', () => {
  it('has a label for every declared component and no extras', () => {
    expect(Object.keys(LOG_COMPONENT_LABELS).sort()).toEqual([...LOG_COMPONENTS].sort())
  })

  it('recognizes every declared component id', () => {
    for (const component of LOG_COMPONENTS) {
      expect(isLogComponent(component)).toBe(true)
    }
  })

  it('rejects unknown strings, including stale conventions like "renderer"', () => {
    expect(isLogComponent('renderer')).toBe(false)
    expect(isLogComponent('main')).toBe(false)
    expect(isLogComponent('')).toBe(false)
    expect(isLogComponent('React')).toBe(false) // case-sensitive — ids are lowercase
  })
})
