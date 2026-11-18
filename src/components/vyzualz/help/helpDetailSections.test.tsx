import { describe, expect, it } from 'vitest'
import { helpDetailSections } from './helpDetailSections'
import { HELP_SEARCH_ENTRIES } from './helpSearchEntries'

describe('helpDetailSections', () => {
  it('lays a full topic out in reading order with the tip last', () => {
    const sections = helpDetailSections({ whatItDoes: ['a', 'b'], whenToUse: 'when', affects: ['x'], defaultValue: 'd', tip: 't' })
    expect(sections.map(section => section.label)).toEqual(['What it does', 'When to use it', 'What it affects', 'Default', 'Tip'])
    expect(sections.at(-1)?.tone).toBe('accent')
  })
  it('leaves out sections a topic has nothing for', () => {
    expect(helpDetailSections({ whenToUse: 'when' }).map(section => section.label)).toEqual(['When to use it'])
    expect(helpDetailSections({})).toEqual([])
  })
  it('gives every placeholder topic at least one detail section', () => {
    for (const entry of HELP_SEARCH_ENTRIES) expect(helpDetailSections(entry).length, entry.title).toBeGreaterThan(0)
  })
})
