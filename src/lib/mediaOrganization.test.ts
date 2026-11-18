import { describe, expect, it } from 'vitest'
import { findCollectionByName, formatTagTyping, MAX_TAG_LENGTH, normalizeCollectionName, normalizeTag, normalizeTags, sameCollectionName } from './mediaOrganization'

describe('normalizeTag', () => {
  it('lowercases, and turns spaces and punctuation into single hyphens', () => {
    expect(normalizeTag('Open Decks')).toBe('open-decks')
    expect(normalizeTag('OPEN   DECKS!')).toBe('open-decks')
    expect(normalizeTag('rock & roll')).toBe('rock-roll')
    expect(normalizeTag('  --Neon__Glow--  ')).toBe('neon__glow')
  })
  it('keeps accented and non-English letters and digits', () => {
    expect(normalizeTag('Café Noir')).toBe('café-noir')
    expect(normalizeTag('Café')).toBe('café')
    expect(normalizeTag('Åre 2024')).toBe('åre-2024')
  })
  it('gives nothing for input with no letters or digits', () => {
    expect(normalizeTag('')).toBe('')
    expect(normalizeTag(' !!! ')).toBe('')
  })
  it('cuts over-long tags without leaving a trailing hyphen', () => {
    const long = normalizeTag(`${'a'.repeat(MAX_TAG_LENGTH - 1)} b`)
    expect(long).toBe('a'.repeat(MAX_TAG_LENGTH - 1))
    expect(normalizeTag('x'.repeat(200))).toHaveLength(MAX_TAG_LENGTH)
  })
  it('is stable: normalising a normalised tag changes nothing', () => {
    for (const raw of ['Open Decks', 'rock & roll', 'Café Noir', 'a_b-c']) expect(normalizeTag(normalizeTag(raw))).toBe(normalizeTag(raw))
  })
})

describe('normalizeTags', () => {
  it('drops empties and repeats that only differ by case or spacing, keeping first-seen order', () => {
    expect(normalizeTags(['Open Decks', 'open-decks', '!!!', 'Bass', 'OPEN  DECKS'])).toEqual(['open-decks', 'bass'])
  })
})

describe('formatTagTyping', () => {
  it('shows a typed space as the hyphen it will be stored as', () => {
    expect(formatTagTyping('open decks')).toBe('open-decks')
    expect(formatTagTyping('a  b')).toBe('a-b')
  })
})

describe('collection names', () => {
  it('collapses whitespace but keeps the casing as typed', () => {
    expect(normalizeCollectionName('  Open   Decks ')).toBe('Open Decks')
  })
  it('compares ignoring case and spacing', () => {
    expect(sameCollectionName('open  decks', 'OPEN DECKS')).toBe(true)
    expect(sameCollectionName('Open Decks', 'Open Deck')).toBe(false)
  })
  it('finds a collection by name ignoring case', () => {
    const collections = [{ id: '1', name: 'Logo & wordmark' }, { id: '2', name: 'Open Decks' }]
    expect(findCollectionByName(collections, ' open decks ')?.id).toBe('2')
    expect(findCollectionByName(collections, 'nothing')).toBeUndefined()
  })
})
