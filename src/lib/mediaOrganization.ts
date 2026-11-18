/**
 * The one canonical form for tags and collection names. The database enforces the same rules
 * (migration 0055: `normalize_media_tag`, `normalize_media_collection_name`), so what the app shows
 * is what is stored. Keep the two in step.
 *
 * Tags are keys, not display text: lowercase letters, digits and underscores, with every other run of
 * characters (spaces included) turned into one hyphen and no hyphen at either end. "Open Decks" and
 * "OPEN  DECKS!" are both "open-decks". The interface shows tags in capitals, so casing never matters
 * to the user, and two tags can never differ only by case or spacing.
 *
 * Collection names are display text: kept as typed, with runs of whitespace collapsed to one space,
 * and compared ignoring case.
 */

/** The longest stored tag; longer input is cut (the server accepts up to 100 and the model editor up to 64). */
export const MAX_TAG_LENGTH = 64

const NOT_TAG_CHARACTER = /[^\p{L}\p{N}_]+/gu

export function normalizeTag(raw: string): string {
  const key = raw.trim().normalize('NFC').toLowerCase().replace(NOT_TAG_CHARACTER, '-').replace(/^-+|-+$/g, '')
  return key.length > MAX_TAG_LENGTH ? key.slice(0, MAX_TAG_LENGTH).replace(/-+$/g, '') : key
}

/** A tag list in canonical form: each tag normalised, empty ones dropped, repeats removed, first-seen order kept. */
export function normalizeTags(raw: readonly string[]): string[] {
  return [...new Set(raw.map(normalizeTag).filter(Boolean))]
}

/** What the tag field shows while typing: a space becomes the hyphen it will be stored as. */
export function formatTagTyping(raw: string): string {
  return raw.replace(/\s+/g, '-')
}

export function normalizeCollectionName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

export function sameCollectionName(a: string, b: string): boolean {
  return normalizeCollectionName(a).toLowerCase() === normalizeCollectionName(b).toLowerCase()
}

export function findCollectionByName<T extends { name: string }>(collections: readonly T[], name: string): T | undefined {
  return collections.find(collection => sameCollectionName(collection.name, name))
}
