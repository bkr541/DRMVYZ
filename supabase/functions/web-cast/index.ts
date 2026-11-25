import { createClient } from 'npm:@supabase/supabase-js@2'
import { DEFAULT_STUN_SERVERS, sanitizeIceServers, staticTurnServers, type IceServer } from '../_shared/stageLinkCore.ts'
import { parseWebCastRequest, hostActions } from '../_shared/webCastCore.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}
const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
async function iceServers(): Promise<IceServer[]> {
  const servers: IceServer[] = [...DEFAULT_STUN_SERVERS, ...staticTurnServers(Deno.env)]
  const id = Deno.env.get('CF_TURN_KEY_ID'), secret = Deno.env.get('CF_TURN_API_TOKEN')
  if (id && secret) {
    try {
      const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${id}/credentials/generate-ice-servers`, {
        method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: 43200 }), signal: AbortSignal.timeout(4000),
      })
      if (response.ok) servers.push(...sanitizeIceServers((await response.json()).iceServers))
    } catch { console.warn('web-cast: TURN credentials unavailable') }
  }
  return servers
}
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' })
  const url = Deno.env.get('SUPABASE_URL'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !service || !anon) return json(503, { error: 'Casting service is not configured' })
  let parsed: ReturnType<typeof parseWebCastRequest>
  try {
    const raw = await request.text()
    if (raw.length > 90000) return json(413, { error: 'Request too large' })
    parsed = parseWebCastRequest(JSON.parse(raw))
  } catch { return json(400, { error: 'Invalid JSON' }) }
  if (!parsed) return json(400, { error: 'Invalid cast request' })
  const { action, payload } = parsed
  const admin = createClient(url, service, { auth: { persistSession: false } })
  let owner: string | null = null
  if (hostActions.has(action)) {
    const jwt = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
    const { data, error } = await admin.auth.getUser(jwt)
    if (error || !data.user || data.user.is_anonymous) return json(401, { error: 'Sign in to STAGELESS first' })
    owner = data.user.id
  }
  if (action === 'join') {
    const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(address))
    payload.bucket = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2,'0')).join('')
  }
  const { data, error } = await admin.rpc('web_cast_command', { p_action: action, p_owner: owner, p_payload: payload })
  if (error || !data) { console.error('web-cast RPC failed', error?.code); return json(500, { error: 'Casting service temporarily unavailable' }) }
  if (data.error) return json(data.status || 400, { error: data.error })
  if (action === 'create' || action === 'join') data.iceServers = await iceServers()
  return json(200, data)
})
