export const hostActions = new Set(['create','hostPoll','approve','reject','offer','stop'])
const receiverActions = new Set(['join','receiverPoll','answer','reset','leave'])
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const token = /^[0-9a-f]{64}$/
const code = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/
export function parseWebCastRequest(input: unknown): { action: string; payload: Record<string, unknown> } | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const b = input as Record<string, unknown>, action = b.action
  if (typeof action !== 'string' || (!hostActions.has(action) && !receiverActions.has(action))) return null
  const payload: Record<string, unknown> = {}
  const field = (key: string, pattern: RegExp) => {
    const value = b[key]; if (typeof value !== 'string' || !pattern.test(value)) return false
    payload[key] = value; return true
  }
  if (receiverActions.has(action) && !field('receiverKey',token)) return null
  if (action === 'join') {
    if (!field('token',token) && !field('code',code)) return null
  } else if (action !== 'create' && !field('id',uuid)) return null
  if (['approve','reject','offer','answer','reset'].includes(action) && !field('receiverId',uuid)) return null
  if (action === 'offer' || action === 'answer') {
    const d = b.description as Record<string,unknown> | undefined
    if (!d || d.type !== action || typeof d.sdp !== 'string' || d.sdp.length > 65536 || !d.sdp.startsWith('v=0')) return null
    payload.description = { type: d.type, sdp: d.sdp }
  }
  return { action, payload }
}
