'use strict'

// Request URLs end up in log files, and the support/diagnostics panel can copy those files out. A signed Supabase Storage URL carries its
// authorization in the query string (`?token=…`), so a logged URL keeps only where the request went (origin + path) and notes that a query
// was present.

const REDACTED_QUERY = '?[redacted]'
const UNPARSEABLE = '[unparseable url]'

function redactUrlForLog(value) {
  if (typeof value !== 'string' || value === '') return UNPARSEABLE
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    return UNPARSEABLE
  }
  const hasQuery = parsed.search !== '' || parsed.hash !== ''
  return `${parsed.origin}${parsed.pathname}${hasQuery ? REDACTED_QUERY : ''}`
}

module.exports = { redactUrlForLog }
