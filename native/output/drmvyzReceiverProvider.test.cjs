'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { DISCOVERY_MAGIC, DISCOVERY_VERSION, DrmvyzReceiverProvider } = require('./providers/drmvyzReceiverProvider.cjs')

test('existing DRMVYZ receiver target and remote start/stop contract remain functional', async () => {
  const calls = []
  const provider = new DrmvyzReceiverProvider({
    isPrivateNetworkAddress: address => address.startsWith('192.168.'),
    resolveReachableLocalAddress: async () => '192.168.1.10',
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return url.endsWith('/api/start-cast')
        ? { ok: true, json: async () => ({ castId: 'cast-1', controlToken: 'control-1' }) }
        : { ok: true, json: async () => ({}) }
    },
  })
  provider.configureReceiverService({ port: 44000, receiverToken: 'local-token' })
  provider.handleBeacon(Buffer.from(JSON.stringify({
    magic: DISCOVERY_MAGIC,
    version: DISCOVERY_VERSION,
    deviceId: 'remote-1',
    name: 'Booth Mac · DRMVYZ',
    port: 45000,
    receiverToken: 'remote-token',
  })), { address: '192.168.1.20' })

  const [target] = provider.listTargets()
  assert.equal(target.id, 'receiver:remote-1')
  assert.match(target.detail, /192\.168\.1\.20/)

  const handle = await provider.startSession({
    target,
    request: { windowMode: 'fullscreen', aspectRatio: '16:9' },
    context: { sessionId: 'session-1', sessionToken: 'session-token' },
  })
  assert.equal(handle.remoteControl.castId, 'cast-1')
  assert.match(JSON.parse(calls[0].init.body).sourceUrl, /192\.168\.1\.10:44000\/receiver/)
  await provider.stopSession(handle)
  assert.equal(calls.length, 2)
  assert.match(calls[1].url, /api\/stop-cast$/)
})
