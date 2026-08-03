'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const {
  buildLocalDisplayTargets,
  calculateWindowBounds,
  createReceiverHtml,
  isAllowedReceiverSource,
  isPrivateNetworkAddress,
  normalizeCastRequest,
} = require('./outputCastBridge.cjs')

test('normalizeCastRequest requires a target, window mode, and aspect ratio', () => {
  assert.deepEqual(normalizeCastRequest({
    targetId: 'display:1',
    windowMode: 'fullscreen',
    aspectRatio: '16:9',
  }), {
    targetId: 'display:1',
    windowMode: 'fullscreen',
    aspectRatio: '16:9',
  })
  assert.equal(normalizeCastRequest({ targetId: 'display:1', windowMode: '', aspectRatio: '16:9' }), null)
  assert.equal(normalizeCastRequest({ targetId: 'display:1', windowMode: 'fullscreen', aspectRatio: '' }), null)
  assert.equal(normalizeCastRequest({ targetId: 'display:1', windowMode: 'floating', aspectRatio: '21:9' }), null)
})

test('calculateWindowBounds centers a bounded window at the requested aspect ratio', () => {
  const bounds = calculateWindowBounds({ x: 100, y: 50, width: 1920, height: 1080 }, '4:3')
  assert.ok(bounds.width <= 1920)
  assert.ok(bounds.height <= 1080)
  assert.ok(Math.abs(bounds.width / bounds.height - 4 / 3) < 0.01)
  assert.equal(bounds.x, Math.round(100 + (1920 - bounds.width) / 2))
  assert.equal(bounds.y, Math.round(50 + (1080 - bounds.height) / 2))
})

test('buildLocalDisplayTargets labels primary and secondary displays without inventing network targets', () => {
  const targets = buildLocalDisplayTargets([
    { id: 1, label: '', bounds: { width: 1920, height: 1080 } },
    { id: 2, label: 'Stage Screen', bounds: { width: 3840, height: 2160 } },
  ], 1)
  assert.deepEqual(targets.map(target => target.id), ['display:1', 'display:2'])
  assert.equal(targets[0].name, 'This display')
  assert.equal(targets[1].name, 'Stage Screen')
  assert.match(targets[1].detail, /3840 × 2160/)
})


test('receiver page ships a syntactically valid isolated WebRTC client', () => {
  const html = createReceiverHtml()
  const script = html.match(/<script>([\s\S]+)<\/script>/)?.[1]
  assert.ok(script)
  assert.doesNotThrow(() => new Function(script))
  assert.match(html, /Content-Security-Policy/)
  assert.match(html, /RTCPeerConnection/)
})

test('receiver navigation is restricted to the requesting private-network sender', () => {
  assert.equal(isPrivateNetworkAddress('192.168.1.8'), true)
  assert.equal(isPrivateNetworkAddress('10.0.0.4'), true)
  assert.equal(isPrivateNetworkAddress('8.8.8.8'), false)
  assert.equal(isAllowedReceiverSource('http://192.168.1.8:51300/receiver?session=a', '192.168.1.8'), true)
  assert.equal(isAllowedReceiverSource('https://192.168.1.8/receiver', '192.168.1.8'), false)
  assert.equal(isAllowedReceiverSource('http://192.168.1.9:51300/receiver', '192.168.1.8'), false)
  assert.equal(isAllowedReceiverSource('http://8.8.8.8:51300/receiver', '8.8.8.8'), false)
})
