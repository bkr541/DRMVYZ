import { assert, assertEquals } from 'jsr:@std/assert'
import { createRateLimiter, parseStageLinkRequest, sanitizeIceServers, staticTurnServers } from './stageLinkCore.ts'

const token = 'a'.repeat(64)

Deno.test('requests are validated', () => {
  assertEquals(parseStageLinkRequest({ action: 'resolve', token }), { action: 'resolve', token })
  assertEquals(parseStageLinkRequest({ action: 'ice' }), { action: 'ice' })
  assert('error' in parseStageLinkRequest({ action: 'resolve', token: 'short' }))
  assert('error' in parseStageLinkRequest({ action: 'resolve', token: 'A'.repeat(64) }))
  assert('error' in parseStageLinkRequest({ action: 'nope' }))
  assert('error' in parseStageLinkRequest(null))
})

Deno.test('the rate limiter allows a burst and then recovers', () => {
  let now = 0
  const allow = createRateLimiter(3, 1000, () => now)
  assertEquals([allow('a'), allow('a'), allow('a'), allow('a')], [true, true, true, false])
  assertEquals(allow('b'), true)
  now = 1500
  assertEquals(allow('a'), true)
})

Deno.test('TURN is only added when fully configured', () => {
  const env = (values: Record<string, string>) => ({ get: (name: string) => values[name] })
  assertEquals(staticTurnServers(env({})), [])
  assertEquals(staticTurnServers(env({ TURN_URLS: 'turn:t.example:3478', TURN_USERNAME: 'u' })), [])
  assertEquals(staticTurnServers(env({ TURN_URLS: 'turn:t.example:3478, https://bad', TURN_USERNAME: 'u', TURN_CREDENTIAL: 'c' })), [
    { urls: ['turn:t.example:3478'], username: 'u', credential: 'c' },
  ])
})

Deno.test('provider ICE servers are filtered', () => {
  assertEquals(sanitizeIceServers([{ urls: ['stun:x:1', 'http://evil'], username: 'u', credential: 'c' }, { urls: 'javascript:1' }, 7]), [
    { urls: ['stun:x:1'], username: 'u', credential: 'c' },
  ])
  assertEquals(sanitizeIceServers('nope'), [])
})
