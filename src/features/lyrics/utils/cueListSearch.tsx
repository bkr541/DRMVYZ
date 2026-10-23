/** Literal, case-insensitive token search; never interprets user input as a regular expression. */
function tokens(query: string) { return [...new Set(query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean))] }

export function matchesCueSearch(text: string, query: string): boolean {
  const terms = tokens(query)
  return terms.length > 0 && terms.some(term => text.toLocaleLowerCase().includes(term))
}

export function highlightCueSearch(text: string, query: string) {
  const terms = tokens(query).sort((a, b) => b.length - a.length)
  if (!terms.length) return text
  const lower = text.toLocaleLowerCase()
  const parts = []
  let start = 0, cursor = 0
  while (cursor < text.length) {
    const term = terms.find(value => lower.startsWith(value, cursor))
    if (!term) { cursor++; continue }
    if (cursor > start) parts.push(text.slice(start, cursor))
    parts.push(<mark key={cursor}>{text.slice(cursor, cursor + term.length)}</mark>)
    cursor += term.length
    start = cursor
  }
  if (start < text.length) parts.push(text.slice(start))
  return parts
}
