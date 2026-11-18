import type { HelpSearchEntry } from './helpSearchEntries'

const words = (text: string) => text.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)

/** How well one query word matches an entry, 0 when it does not match at all. A title match beats a keyword match, which
 * beats a category or summary match, and a match at the start of a word beats one in the middle of it. */
function scoreWord(word: string, entry: HelpSearchEntry): number {
  const title = entry.title.toLocaleLowerCase()
  const titleWords = words(entry.title)
  if (title.startsWith(word)) return 100
  if (titleWords.some(item => item.startsWith(word))) return 80
  if (title.includes(word)) return 55
  if (entry.keywords.some(item => item.toLocaleLowerCase() === word)) return 50
  if (entry.keywords.some(item => item.toLocaleLowerCase().startsWith(word))) return 40
  if (entry.category.toLocaleLowerCase().startsWith(word)) return 30
  if (words(entry.summary).some(item => item.startsWith(word))) return 20
  if (entry.summary.toLocaleLowerCase().includes(word)) return 10
  return 0
}

/** Finds the topics that match every word typed, best first (ties keep the list's own order). A blank query finds nothing. */
export function searchHelpEntries(query: string, entries: readonly HelpSearchEntry[]): HelpSearchEntry[] {
  const queryWords = words(query)
  if (queryWords.length === 0) return []
  return entries
    .map((entry, index) => {
      const scores = queryWords.map(word => scoreWord(word, entry))
      return { entry, index, score: scores.every(value => value > 0) ? scores.reduce((sum, value) => sum + value, 0) : 0 }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(item => item.entry)
}
