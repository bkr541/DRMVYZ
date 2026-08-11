'use strict'

const crypto = require('node:crypto')
const dgram = require('node:dgram')
const os = require('node:os')

const DRMVYZ_RECEIVER_PROVIDER_ID = 'drmvyz-receiver'
const DISCOVERY_PORT = 53531
const DISCOVERY_MAGIC = 'DRMVYZ_CAST_RECEIVER'
const DISCOVERY_VERSION = 1
const DISCOVERY_INTERVAL_MS = 2_500
const DISCOVERY_EXPIRY_MS = 8_000

class DrmvyzReceiverProvider {
  constructor({ isPrivateNetworkAddress, resolveReachableLocalAddress, fetchImpl = globalThis.fetch }) {
    this.id = DRMVYZ_RECEIVER_PROVIDER_ID
    this.label = 'DRMVYZ receivers'
    this.capabilities = Object.freeze({ targetEnumeration: true, sessions: true, picker: false, actions: [] })
    this.isPrivateNetworkAddress = isPrivateNetworkAddress
    this.resolveReachableLocalAddress = resolveReachableLocalAddress
    this.fetchImpl = fetchImpl
    this.deviceId = crypto.randomUUID()
    this.targets = new Map()
    this.receiverService = null
    this.discoverySocket = null
    this.discoveryInterval = null
    this.expiryInterval = null
    this.onTargetsChanged = () => {}
    this.status = { state: 'unavailable', message: 'Receiver discovery is starting' }
  }

  configureReceiverService({ port, receiverToken }) {
    this.receiverService = { port, receiverToken }
    if (this.discoverySocket) this.sendDiscoveryBeacon()
  }

  getStatus() {
    return this.status
  }

  listTargets() {
    return Array.from(this.targets.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(target => ({
        id: `receiver:${target.deviceId}`,
        kind: 'network',
        name: target.name,
        detail: `DRMVYZ Receiver · ${target.address}`,
        available: true,
        receiverId: target.deviceId,
      }))
  }

  start({ onTargetsChanged }) {
    if (this.discoverySocket) return () => this.shutdown()
    this.onTargetsChanged = typeof onTargetsChanged === 'function' ? onTargetsChanged : () => {}
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    this.discoverySocket = socket
    socket.on('message', (message, rinfo) => this.handleBeacon(message, rinfo))
    socket.on('error', error => {
      this.status = { state: 'unavailable', message: `Receiver discovery unavailable: ${error.message}` }
      this.onTargetsChanged()
    })
    socket.bind(DISCOVERY_PORT, '0.0.0.0', () => {
      try { socket.setBroadcast(true) } catch { /* Platform may restrict broadcast. */ }
      this.status = { state: 'available', message: null }
      this.sendDiscoveryBeacon()
      this.onTargetsChanged()
      this.discoveryInterval = setInterval(() => this.sendDiscoveryBeacon(), DISCOVERY_INTERVAL_MS)
      this.discoveryInterval.unref?.()
    })
    this.expiryInterval = setInterval(() => this.expireTargets(), 4_000)
    this.expiryInterval.unref?.()
    return () => this.shutdown()
  }

  handleBeacon(message, rinfo) {
    try {
      const beacon = JSON.parse(message.toString('utf8'))
      if (
        beacon.magic !== DISCOVERY_MAGIC
        || beacon.version !== DISCOVERY_VERSION
        || beacon.deviceId === this.deviceId
        || !Number.isInteger(beacon.port)
        || beacon.port <= 0
        || beacon.port > 65_535
        || typeof beacon.receiverToken !== 'string'
        || !this.isPrivateNetworkAddress(rinfo.address)
      ) return
      const name = typeof beacon.name === 'string' && beacon.name.trim() ? beacon.name.trim() : 'DRMVYZ Receiver'
      const previous = this.targets.get(beacon.deviceId)
      this.targets.set(beacon.deviceId, {
        deviceId: beacon.deviceId,
        name,
        address: rinfo.address,
        port: beacon.port,
        receiverToken: beacon.receiverToken,
        lastSeenAt: Date.now(),
      })
      if (!previous || previous.address !== rinfo.address || previous.port !== beacon.port || previous.name !== name) {
        this.onTargetsChanged()
      }
    } catch {
      // Ignore unrelated UDP traffic on the discovery port.
    }
  }

  expireTargets(now = Date.now()) {
    const cutoff = now - DISCOVERY_EXPIRY_MS
    let changed = false
    for (const [id, target] of this.targets) {
      if (target.lastSeenAt < cutoff) {
        this.targets.delete(id)
        changed = true
      }
    }
    if (changed) this.onTargetsChanged()
  }

  sendDiscoveryBeacon() {
    if (!this.discoverySocket || !this.receiverService?.port) return
    const payload = Buffer.from(JSON.stringify({
      magic: DISCOVERY_MAGIC,
      version: DISCOVERY_VERSION,
      deviceId: this.deviceId,
      name: `${os.hostname()} · DRMVYZ`,
      port: this.receiverService.port,
      receiverToken: this.receiverService.receiverToken,
    }))
    this.discoverySocket.send(payload, DISCOVERY_PORT, '255.255.255.255', () => {})
  }

  async startSession({ target, request, context }) {
    const receiverId = target.receiverId ?? target.id.slice('receiver:'.length)
    const receiver = this.targets.get(receiverId)
    if (!receiver) throw new Error('That network receiver is no longer available')
    if (!this.receiverService?.port) throw new Error('The output receiver is still starting')
    const sourceAddress = await this.resolveReachableLocalAddress(receiver.address)
    const sourceUrl = `http://${sourceAddress}:${this.receiverService.port}/receiver?session=${encodeURIComponent(context.sessionId)}&token=${encodeURIComponent(context.sessionToken)}`
    const response = await this.fetchImpl(`http://${receiver.address}:${receiver.port}/api/start-cast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceUrl,
        windowMode: request.windowMode,
        aspectRatio: request.aspectRatio,
        receiverToken: receiver.receiverToken,
      }),
      signal: AbortSignal.timeout(4_000),
    })
    if (!response.ok) throw new Error(`The receiver refused the cast (${response.status})`)
    const remote = await response.json()
    if (!remote || typeof remote.castId !== 'string' || typeof remote.controlToken !== 'string') {
      throw new Error('The receiver returned an invalid session')
    }
    return {
      remoteControl: {
        address: receiver.address,
        port: receiver.port,
        castId: remote.castId,
        controlToken: remote.controlToken,
        receiverToken: receiver.receiverToken,
      },
    }
  }

  async stopSession(handle) {
    const remote = handle?.remoteControl
    if (!remote) return
    try {
      await this.fetchImpl(`http://${remote.address}:${remote.port}/api/stop-cast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          castId: remote.castId,
          controlToken: remote.controlToken,
          receiverToken: remote.receiverToken,
        }),
        signal: AbortSignal.timeout(2_500),
      })
    } catch {
      // The receiver may already be gone. Local state must still close.
    }
  }

  shutdown() {
    if (this.discoveryInterval) clearInterval(this.discoveryInterval)
    if (this.expiryInterval) clearInterval(this.expiryInterval)
    this.discoveryInterval = null
    this.expiryInterval = null
    try { this.discoverySocket?.close() } catch { /* Already closed. */ }
    this.discoverySocket = null
    this.targets.clear()
  }
}

module.exports = {
  DISCOVERY_EXPIRY_MS,
  DISCOVERY_MAGIC,
  DISCOVERY_PORT,
  DISCOVERY_VERSION,
  DRMVYZ_RECEIVER_PROVIDER_ID,
  DrmvyzReceiverProvider,
}
