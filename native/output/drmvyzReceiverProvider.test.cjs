'use strict'

const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const test = require('node:test')
const {
  DISCOVERY_EXPIRY_MS,
  DISCOVERY_MAGIC,
  DISCOVERY_MAX_PAYLOAD_BYTES,
  DISCOVERY_VERSION,
  MDNS_SERVICE_TYPE,
  DrmvyzReceiverProvider,
  createMdnsAnnouncementPacket,
  parseDiscoveryAdvertisement,
  parseDnsPacket,
  serializeDiscoveryAdvertisement,
} = require('./providers/drmvyzReceiverProvider.cjs')

const PRIVATE_INTERFACES = () => ({
  en0: [{ address: '192.168.1.10', netmask: '255.255.255.0', family: 'IPv4', mac: 'aa:bb:cc:dd:ee:01', internal: false }],
})

function provider(overrides = {}) {
  return new DrmvyzReceiverProvider({
    isPrivateNetworkAddress: address => address.startsWith('192.168.') || address === '127.0.0.1',
    resolveReachableLocalAddress: async () => '192.168.1.10',
    networkInterfaces: PRIVATE_INTERFACES,
    deviceId: 'local-device-1',
    hostname: () => 'Stage-Mac',
    ...overrides,
  })
}

class FakeSocket extends EventEmitter {
  constructor(error = null) {
    super()
    this.error = error
    this.sent = []
    this.closed = false
  }
  bind(port, address) {
    this.bound = { port, address }
    queueMicrotask(() => this.error ? this.emit('error', this.error) : this.emit('listening'))
  }
  addMembership() {}
  setMulticastTTL() {}
  setMulticastLoopback() {}
  setMulticastInterface() {}
  setBroadcast() {}
  send(payload, port, address, callback) {
    this.sent.push({ payload, port, address })
    callback?.()
  }
  close() { this.closed = true }
}

function fakeIntervals() {
  const timers = new Set()
  return {
    timers,
    setIntervalImpl(callback, delay) {
      const timer = { callback, delay, unref() {} }
      timers.add(timer)
      return timer
    },
    clearIntervalImpl(timer) { timers.delete(timer) },
  }
}

test('advertisement serialization is versioned, validated, and rejects oversized or malformed input', () => {
  const payload = serializeDiscoveryAdvertisement({
    deviceId: 'remote-device-1',
    name: 'Booth Mac · DRMVYZ',
    port: 45000,
    receiverToken: 'remote-token',
  })
  assert.deepEqual(parseDiscoveryAdvertisement(payload), {
    magic: DISCOVERY_MAGIC,
    version: DISCOVERY_VERSION,
    deviceId: 'remote-device-1',
    name: 'Booth Mac · DRMVYZ',
    port: 45000,
    receiverToken: 'remote-token',
    goodbye: false,
  })
  assert.equal(parseDiscoveryAdvertisement(Buffer.from('{not json')), null)
  assert.equal(parseDiscoveryAdvertisement(Buffer.alloc(DISCOVERY_MAX_PAYLOAD_BYTES + 1)), null)
  assert.equal(parseDiscoveryAdvertisement(Buffer.from(JSON.stringify({
    magic: DISCOVERY_MAGIC,
    version: DISCOVERY_VERSION + 1,
    deviceId: 'remote-device-1',
    port: 45000,
    receiverToken: 'remote-token',
  }))), null)
})

test('mDNS/DNS-SD advertisement carries the DRMVYZ service contract and discovers only valid private peers', () => {
  const instance = provider()
  const packet = createMdnsAnnouncementPacket({
    deviceId: 'remote-device-1',
    name: 'Booth Mac · DRMVYZ',
    port: 45000,
    receiverToken: 'remote-token',
    addresses: ['192.168.1.20'],
  })
  const parsed = parseDnsPacket(packet)
  assert.ok(parsed)
  assert.ok(parsed.records.some(record => record.name === MDNS_SERVICE_TYPE))
  assert.equal(instance.handleMdnsMessage(packet, { address: '192.168.1.20' }), true)
  assert.deepEqual(instance.listTargets().map(target => target.id), ['receiver:remote-device-1'])
  assert.equal(instance.handleMdnsMessage(Buffer.alloc(10), { address: '192.168.1.21' }), false)
  assert.equal(instance.handleMdnsMessage(packet, { address: '8.8.8.8' }), false)
})

test('duplicate advertisements deduplicate by stable device identity and accept changed addresses', () => {
  let changed = 0
  const instance = provider()
  instance.onTargetsChanged = () => { changed += 1 }
  const payload = serializeDiscoveryAdvertisement({
    deviceId: 'remote-device-1',
    name: 'Booth Mac · DRMVYZ',
    port: 45000,
    receiverToken: 'remote-token',
  })
  assert.equal(instance.handleLegacyBeacon(payload, { address: '192.168.1.20' }), true)
  assert.equal(instance.handleLegacyBeacon(payload, { address: '192.168.1.20' }), false)
  assert.equal(instance.handleLegacyBeacon(payload, { address: '192.168.1.21' }), true)
  assert.equal(instance.listTargets().length, 1)
  assert.match(instance.listTargets()[0].detail, /192\.168\.1\.21/)
  assert.equal(changed, 2)
})

test('offline receivers expire and goodbye advertisements remove them immediately', () => {
  let now = 1_000
  const instance = provider({ now: () => now })
  const advertisement = {
    deviceId: 'remote-device-1',
    name: 'Booth Mac · DRMVYZ',
    port: 45000,
    receiverToken: 'remote-token',
  }
  instance.handleLegacyBeacon(serializeDiscoveryAdvertisement(advertisement), { address: '192.168.1.20' })
  now += DISCOVERY_EXPIRY_MS + 1
  assert.equal(instance.expireTargets(), true)
  assert.equal(instance.listTargets().length, 0)

  instance.handleLegacyBeacon(serializeDiscoveryAdvertisement(advertisement), { address: '192.168.1.20' })
  assert.equal(instance.handleLegacyBeacon(serializeDiscoveryAdvertisement({ ...advertisement, goodbye: true }), { address: '192.168.1.20' }), true)
  assert.equal(instance.listTargets().length, 0)
})

test('permission and bind failures remain explicit instead of looking like an empty receiver list', async () => {
  const permissionError = Object.assign(new Error('permission denied'), { code: 'EACCES' })
  const sockets = [new FakeSocket(permissionError), new FakeSocket(permissionError)]
  const intervals = fakeIntervals()
  const instance = provider({
    createSocket: () => sockets.shift(),
    ...intervals,
  })
  await instance.start()
  assert.equal(instance.getStatus().state, 'permission-required')
  assert.match(instance.getStatus().message, /local-network permission/i)
  instance.shutdown()
})

test('mDNS failure falls back explicitly to isolated legacy UDP compatibility discovery', async () => {
  const bindError = Object.assign(new Error('mDNS unavailable'), { code: 'EADDRINUSE' })
  const sockets = [new FakeSocket(bindError), new FakeSocket()]
  const intervals = fakeIntervals()
  const instance = provider({ createSocket: () => sockets.shift(), ...intervals })
  await instance.start()
  assert.equal(instance.getStatus().state, 'available')
  assert.match(instance.getStatus().message, /legacy UDP compatibility discovery/i)
  instance.shutdown()
})

test('network topology changes restart discovery without duplicating lifecycle timers', async () => {
  let interfaces = PRIVATE_INTERFACES()
  const sockets = []
  const intervals = fakeIntervals()
  const instance = provider({
    networkInterfaces: () => interfaces,
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket
    },
    ...intervals,
  })
  await instance.start()
  assert.equal(sockets.length, 2)
  assert.equal(intervals.timers.size, 4)

  interfaces = {
    en0: [{ address: '192.168.2.10', netmask: '255.255.255.0', family: 'IPv4', mac: 'aa:bb:cc:dd:ee:01', internal: false }],
  }
  assert.equal(instance.checkForNetworkChange(), true)
  await new Promise(resolve => setImmediate(resolve))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(sockets.length, 4)
  assert.equal(sockets[0].closed, true)
  assert.equal(sockets[1].closed, true)
  assert.equal(intervals.timers.size, 4)
  instance.shutdown()
  assert.equal(intervals.timers.size, 0)
})

test('existing DRMVYZ receiver target and remote start/stop contract remain functional', async () => {
  const calls = []
  const instance = provider({
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return url.endsWith('/api/start-cast')
        ? { ok: true, json: async () => ({ castId: 'cast-1', controlToken: 'control-1' }) }
        : { ok: true, json: async () => ({}) }
    },
  })
  instance.configureReceiverService({ port: 44000, receiverToken: 'local-token' })
  instance.handleBeacon(Buffer.from(JSON.stringify({
    magic: DISCOVERY_MAGIC,
    version: DISCOVERY_VERSION,
    deviceId: 'remote-1',
    name: 'Booth Mac · DRMVYZ',
    port: 45000,
    receiverToken: 'remote-token',
  })), { address: '192.168.1.20' })

  const [target] = instance.listTargets()
  assert.equal(target.id, 'receiver:remote-1')
  assert.match(target.detail, /192\.168\.1\.20/)

  const handle = await instance.startSession({
    target,
    request: { windowMode: 'fullscreen', aspectRatio: '16:9' },
    context: { sessionId: 'session-1', sessionToken: 'session-token' },
  })
  assert.equal(handle.remoteControl.castId, 'cast-1')
  assert.match(JSON.parse(calls[0].init.body).sourceUrl, /192\.168\.1\.10:44000\/receiver/)
  await instance.stopSession(handle)
  assert.equal(calls.length, 2)
  assert.match(calls[1].url, /api\/stop-cast$/)
})
