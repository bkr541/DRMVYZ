import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  createRateLimiter,
  DEFAULT_STUN_SERVERS,
  parseStageLinkRequest,
  sanitizeIceServers,
  staticTurnServers,
  type IceServer,
} from '../_shared/stageLinkCore.ts'

/**
 * Stage links: lets a screen with only a link (a TV browser) join a phone's live visual.
 *   { action: 'resolve', token }  anyone holding the link. Returns the signalling channel id and ICE servers.
 *   { action: 'ice' }             a signed-in phone. Returns ICE servers for its side of the connection.
 * Tokens are checked by the service-role-only resolve_stage_link function, which is why this is the only way to redeem one.
 * Optional secrets for TURN (a relay for networks that block direct connections): TURN_URLS, TURN_USERNAME, TURN_CREDENTIAL, or
 * CF_TURN_KEY_ID and CF_TURN_API_TOKEN to mint short-lived Cloudflare credentials. Without them, only STUN is offered.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const allowResolve = createRateLimiter(20, 60_000)
const allowIce = createRateLimiter(30, 60_000)

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}

async function iceServers(): Promise<IceServer[]> {
  const servers: IceServer[] = [...DEFAULT_STUN_SERVERS, ...staticTurnServers(Deno.env)]
  const keyId = Deno.env.get('CF_TURN_KEY_ID')
  const apiToken = Deno.env.get('CF_TURN_API_TOKEN')
  if (keyId && apiToken) {
    try {
      const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: 86_400 }),
        signal: AbortSignal.timeout(4000),
      })
      if (response.ok) servers.push(...sanitizeIceServers(((await response.json()) as { iceServers?: unknown }).iceServers))
      else console.error('stage-link: TURN provider returned', response.status)
    } catch (error) {
      console.error('stage-link: TURN provider unavailable', error instanceof Error ? error.message : error)
    }
  }
  return servers
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey || !anonKey) return json(500, { error: 'Function is not configured' })

  let body: unknown
  try { body = await request.json() } catch { return json(400, { error: 'Expected JSON' }) }
  const parsed = parseStageLinkRequest(body)
  if ('error' in parsed) return json(400, parsed)

  const client = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  if (parsed.action === 'ice') {
    if (!allowIce(client)) return json(429, { error: 'Too many requests' })
    const authorization = request.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
    const { data, error } = await userClient.auth.getUser(authorization.replace(/^Bearer\s+/i, ''))
    if (error || !data.user || data.user.is_anonymous) return json(401, { error: 'Sign in required' })
    return json(200, { iceServers: await iceServers() })
  }

  if (!allowResolve(client)) return json(429, { error: 'Too many requests' })
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data, error } = await admin.rpc('resolve_stage_link', { p_token: parsed.token })
  if (error) {
    console.error('stage-link: resolve failed', error.message)
    return json(500, { error: 'Could not check this link' })
  }
  if (!data) return json(404, { error: 'This stage link is not valid or has expired' })
  const link = data as { linkId: string; label: string; expiresAt: string }
  return json(200, { linkId: link.linkId, label: link.label, expiresAt: link.expiresAt, iceServers: await iceServers() })
})
