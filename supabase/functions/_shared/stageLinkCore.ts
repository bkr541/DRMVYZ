/** Pure helpers for the stage-link function: request parsing, rate limiting and the ICE server list. No network or Deno APIs. */

export interface IceServer {
  urls: string | string[]
  username?: string
  credential?: string
}

export type StageLinkRequest = { action: 'resolve'; token: string } | { action: 'ice' }

export const STAGE_TOKEN_LENGTH = 64
const TOKEN_PATTERN = /^[0-9a-f]{64}$/

export const DEFAULT_STUN_SERVERS: readonly IceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
]

/** Returns the parsed request, or a message describing what is wrong with it. */
export function parseStageLinkRequest(body: unknown): StageLinkRequest | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Expected a JSON object' }
  const record = body as Record<string, unknown>
  if (record.action === 'ice') return { action: 'ice' }
  if (record.action === 'resolve') {
    if (typeof record.token !== 'string' || !TOKEN_PATTERN.test(record.token)) return { error: 'Invalid stage link' }
    return { action: 'resolve', token: record.token }
  }
  return { error: 'Unknown action' }
}

/** Sliding-window limiter, per key. Edge isolates are short lived, so this is a best-effort guard on top of the 244-bit tokens. */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>()
  return (key: string): boolean => {
    const t = now()
    const recent = (hits.get(key) ?? []).filter(time => t - time < windowMs)
    if (recent.length >= limit) { hits.set(key, recent); return false }
    recent.push(t)
    hits.set(key, recent)
    if (hits.size > 5000) for (const [k, v] of hits) if (v.every(time => t - time >= windowMs)) hits.delete(k)
    return true
  }
}

/** Static TURN settings from the environment, appended after STUN. Returns nothing when not configured. */
export function staticTurnServers(env: { get(name: string): string | undefined }): IceServer[] {
  const urls = (env.get('TURN_URLS') ?? '').split(',').map(value => value.trim()).filter(value => /^turns?:/.test(value))
  const username = env.get('TURN_USERNAME')
  const credential = env.get('TURN_CREDENTIAL')
  if (!urls.length || !username || !credential) return []
  return [{ urls, username, credential }]
}

/** Accepts only well-formed ICE server entries from an external provider. */
export function sanitizeIceServers(value: unknown): IceServer[] {
  if (!Array.isArray(value)) return []
  const out: IceServer[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue
    const { urls, username, credential } = entry as Record<string, unknown>
    const list = (Array.isArray(urls) ? urls : [urls]).filter((url): url is string => typeof url === 'string' && /^(stun|turns?):/.test(url))
    if (!list.length) continue
    const server: IceServer = { urls: list }
    if (typeof username === 'string') server.username = username
    if (typeof credential === 'string') server.credential = credential
    out.push(server)
  }
  return out
}
