import { createLogger } from './logger'

const log = createLogger('system', 'security')

/** Origin and path only: signed Storage links carry their token in the query string. */
function withoutQuery(value: string): string {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'wss:' ? `${url.origin}${url.pathname}` : url.protocol
  } catch {
    return value.slice(0, 80)
  }
}

/**
 * Records anything the Content Security Policy blocks (native/security/contentSecurityPolicy.cjs) in the app log, so a feature that the policy
 * stops shows up in Settings > Developer > Logging and in diagnostics instead of failing silently. Each distinct block is logged once.
 */
export function installContentSecurityPolicyReporting(target: Pick<Document, 'addEventListener' | 'removeEventListener'> = document): () => void {
  const seen = new Set<string>()
  const onViolation = (event: SecurityPolicyViolationEvent) => {
    const blocked = withoutQuery(event.blockedURI || 'inline')
    const key = `${event.effectiveDirective}|${blocked}`
    if (seen.has(key)) return
    seen.add(key)
    log.warn('Blocked by the Content Security Policy', { directive: event.effectiveDirective, blocked, source: event.sourceFile ? withoutQuery(event.sourceFile) : null })
  }
  target.addEventListener('securitypolicyviolation', onViolation as EventListener)
  return () => target.removeEventListener('securitypolicyviolation', onViolation as EventListener)
}
