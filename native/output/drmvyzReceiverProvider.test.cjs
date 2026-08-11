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
const {
  DRMVYZ_RECEIVER_PROTOCOL_VERSION,
  buildCapabilityDocument,
} = require('./drmvyzReceiverProtocol.cjs')

const PRIVATE_INTERFACES = () => ({
  en0: [{ address: '192.168.1.10', netmask: '255.255.255.0', family: 'IPv4', mac: 'aa:bb:cc:dd:ee:01', internal: false }],
})

function provider(overrides = {}) {
  const receiverTokens = new Map()
  const trustStore = overrides.trustStore ?? {
    getReceiverToken: deviceId => receiverTokens.get(deviceId) ?? null,
    saveReceiverToken: (deviceId, token) => {
      receiverTokens.set(deviceId, token)
      return token
    },
  }
  const fetchImpl = overrides.fetchImpl ?? (async url => {
    if (String(url).endsWith('/api/v2/capabilities')) {
      return {
        ok: true,
        status: 200,
        json: async () => buildCapabilityDocument({
          deviceId: 'remote-device-1',
          name: 'Booth Mac · DRMVYZ',
          paired: false,
          displays: [
            { id: '11', name: 'Primary display', width: 1920, height: 1080, scaleFactor: 1, primary: true },
            { id: '12', name: 'Projector', width: 2560, height: 1440, scaleFactor: 1, primary: false },
          ],
        }),
      }
    }
    throw new Error(`Unexpected fetch: ${url}`)
  })
  return new DrmvyzReceiverProvider({
    isPrivateNetworkAddress: address => address.startsWith('192.168.') || address === '127.0.0.1',
    resolveReachableLocalAddress: async () => '192.168.1.10',
    networkInterfaces: PRIVATE_INTERFACES,
    deviceId: 'local-device-1',
    hostname: () => 'Stage-Mac',
    trustStore,
    ...overrides,
    fetchImpl,
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

test('mDNS/DNS-SD advertisement carries the DRMVYZ service contract and discovers only valid private peers', async () => {
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
  assert.deepEqual((await instance.listTargets()).map(target => target.id), ['receiver:remote-device-1:display:11', 'receiver:remote-device-1:display:12'])
  assert.equal(instance.handleMdnsMessage(Buffer.alloc(10), { address: '192.168.1.21' }), false)
  assert.equal(instance.handleMdnsMessage(packet, { address: '8.8.8.8' }), false)
})

test('duplicate advertisements deduplicate by stable device identity and accept changed addresses', async () => {
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
  const listed = await instance.listTargets()
  assert.equal(listed.length, 2)
  assert.match(listed[0].detail, /192\.168\.1\.21/)
  assert.equal(changed, 2)
})

test('offline receivers expire and goodbye advertisements remove them immediately', async () => {
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
  assert.equal((await instance.listTargets()).length, 0)

  instance.handleLegacyBeacon(serializeDiscoveryAdvertisement(advertisement), { address: '192.168.1.20' })
  assert.equal(instance.handleLegacyBeacon(serializeDiscoveryAdvertisement({ ...advertisement, goodbye: true }), { address: '192.168.1.20' }), true)
  assert.equal((await instance.listTargets()).length, 0)
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

test('Receiver V2 capability negotiation exposes multiple displays and first-use pairing gates session start', async () => {
  const calls = []
  let pairedToken = null
  const trustTokens = new Map()
  const instance = provider({
    trustStore: {
      getReceiverToken: id => trustTokens.get(id) ?? null,
      saveReceiverToken: (id, token) => { trustTokens.set(id, token); return token },
    },
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), init })
      if (String(url).endsWith('/api/v2/capabilities')) {
        return {
          ok: true,
          status: 200,
          json: async () => buildCapabilityDocument({
            deviceId: 'remote-1',
            name: 'Booth Mac · DRMVYZ',
            paired: Boolean(pairedToken && init.headers?.['X-DRMVYZ-Pairing-Token'] === pairedToken),
            displays: [
              { id: 'primary-7', name: 'LED Wall', width: 1920, height: 1080, scaleFactor: 1, primary: true },
              { id: 'aux-9', name: 'Confidence Monitor', width: 1280, height: 720, scaleFactor: 1, primary: false },
            ],
          }),
        }
      }
      if (String(url).endsWith('/api/v2/pair')) {
        pairedToken = 'paired-token-abcdefghijklmnopqrstuvwxyz'
        return { ok: true, status: 200, json: async () => ({ protocolVersion: DRMVYZ_RECEIVER_PROTOCOL_VERSION, paired: true, pairingToken: pairedToken }) }
      }
      if (String(url).endsWith('/api/v2/sessions')) {
        const body = JSON.parse(init.body)
        assert.equal(body.displayId, 'aux-9')
        assert.equal(body.pairingToken, pairedToken)
        assert.equal(body.protocolVersion, DRMVYZ_RECEIVER_PROTOCOL_VERSION)
        return { ok: true, status: 200, json: async () => ({ protocolVersion: DRMVYZ_RECEIVER_PROTOCOL_VERSION, castId: 'cast-1', controlToken: 'control-1', qualityPolicy: body.qualityPolicy }) }
      }
      if (/\/api\/v2\/sessions\/cast-1\/stop$/.test(String(url))) return { ok: true, status: 204, json: async () => ({}) }
      throw new Error(`Unexpected fetch: ${url}`)
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

  const targets = await instance.listTargets()
  assert.deepEqual(targets.map(target => target.receiverDisplayId), ['primary-7', 'aux-9'])
  const aux = targets.find(target => target.receiverDisplayId === 'aux-9')
  assert.equal(aux.receiverPaired, false)
  assert.match(aux.detail, /Pair on first use/)

  const handle = await instance.startSession({
    target: aux,
    request: { windowMode: 'fullscreen', aspectRatio: '16:9' },
    context: { sessionId: 'session-1', sessionToken: 'session-token' },
  })
  assert.equal(handle.remoteControl.castId, 'cast-1')
  assert.equal(trustTokens.get('remote-1'), pairedToken)
  assert.match(JSON.parse(calls.find(call => call.url.endsWith('/api/v2/sessions')).init.body).sourceUrl, /192\.168\.1\.10:44000\/receiver/)
  await instance.stopSession(handle)
  assert.ok(calls.some(call => /\/api\/v2\/sessions\/cast-1\/stop$/.test(call.url)))
})

test('Receiver V2 startup retries one transient transport failure but does not hide destination disappearance', async () => {
  let starts = 0
  const instance = provider({
    setTimeoutImpl: callback => { callback(); return 0 },
    fetchImpl: async (url, init = {}) => {
      if (String(url).endsWith('/api/v2/capabilities')) {
        return { ok: true, status: 200, json: async () => buildCapabilityDocument({
          deviceId: 'remote-2', name: 'Stage Receiver', paired: true,
          displays: [{ id: 'display-2', name: 'Stage', width: 1920, height: 1080, primary: true }],
        }) }
      }
      if (String(url).endsWith('/api/v2/sessions')) {
        starts += 1
        if (starts === 1) throw new Error('ECONNRESET')
        return { ok: false, status: 409, json: async () => ({}) }
      }
      throw new Error(`Unexpected fetch: ${url} ${init.method ?? 'GET'}`)
    },
    trustStore: {
      getReceiverToken: () => 'paired-token-abcdefghijklmnopqrstuvwxyz',
      saveReceiverToken: () => 'paired-token-abcdefghijklmnopqrstuvwxyz',
    },
  })
  instance.configureReceiverService({ port: 44000, receiverToken: 'local-token' })
  instance.handleBeacon(serializeDiscoveryAdvertisement({
    deviceId: 'remote-2', name: 'Stage Receiver', port: 45000, receiverToken: 'remote-token',
  }), { address: '192.168.1.22' })
  const [target] = await instance.listTargets()
  await assert.rejects(instance.startSession({
    target,
    request: { windowMode: 'fullscreen', aspectRatio: '16:9' },
    context: { sessionId: 'session-2', sessionToken: 'session-token' },
  }), /display is no longer available/i)
  assert.equal(starts, 2)
})
