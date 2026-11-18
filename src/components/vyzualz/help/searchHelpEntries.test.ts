import { describe, expect, it } from 'vitest'
import { HELP_SEARCH_ENTRIES } from './helpSearchEntries'
import { searchHelpEntries } from './searchHelpEntries'

const titles = (query: string) => searchHelpEntries(query, HELP_SEARCH_ENTRIES).map(entry => entry.title)

describe('help search topics', () => {
  it('has the 20 placeholder topics, each with a unique id', () => {
    expect(HELP_SEARCH_ENTRIES).toHaveLength(20)
    expect(new Set(HELP_SEARCH_ENTRIES.map(entry => entry.id)).size).toBe(20)
  })
})

describe('searchHelpEntries', () => {
  it('finds nothing for a blank query', () => {
    expect(titles('')).toEqual([])
    expect(titles('   ')).toEqual([])
  })
  it('matches titles regardless of case and ranks a title that starts with the word first', () => {
    expect(titles('PATTERN')[0]).toBe('Pattern Change')
    expect(titles('auto')[0]).toBe('Auto Performance')
  })
  it('ranks a title match above a keyword or summary match', () => {
    const found = titles('trigger')
    expect(found[0]).toBe('Trigger')
    expect(found.length).toBeGreaterThan(0)
  })
  it('matches keywords the title does not contain', () => {
    expect(titles('bpm')).toContain('Tap Tempo')
    expect(titles('oscilloscope')).toContain('Sound Drawing')
  })
  it('requires every typed word to match', () => {
    expect(titles('tap tempo')).toEqual(['Tap Tempo'])
    expect(titles('tap zebra')).toEqual([])
  })
  it('narrows as more letters are typed', () => {
    expect(titles('m').length).toBeGreaterThan(titles('med').length)
    expect(titles('med')).toEqual(['Media Manager'])
  })
  it('returns nothing for text that matches no topic', () => {
    expect(titles('zzzz')).toEqual([])
  })
})
