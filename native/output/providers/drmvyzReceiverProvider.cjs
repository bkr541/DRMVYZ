'use strict'

const crypto = require('node:crypto')
const dgram = require('node:dgram')
const os = require('node:os')
const net = require('node:net')
const {
  DRMVYZ_RECEIVER_CAPABILITY_CACHE_MS,
  DRMVYZ_RECEIVER_PROTOCOL_VERSION,
  DRMVYZ_RECEIVER_QUALITY_POLICY,
  DRMVYZ_RECEIVER_SESSION_RETRY_COUNT,
  DRMVYZ_RECEIVER_SESSION_RETRY_MS,
  buildReceiverDisplayTargetId,
  normalizeCapabilityDocument,
  parseReceiverDisplayTargetId,
} = require('../drmvyzReceiverProtocol.cjs')

const DRMVYZ_RECEIVER_PROVIDER_ID = 'drmvyz-receiver'
const DISCOVERY_PORT = 53531
const DISCOVERY_MAGIC = 'DRMVYZ_CAST_RECEIVER'
const DISCOVERY_VERSION = 1
const DISCOVERY_INTERVAL_MS = 2_500
const DISCOVERY_EXPIRY_MS = 12_000
const DISCOVERY_MAX_PAYLOAD_BYTES = 4_096
const MDNS_PORT = 5353
const MDNS_MULTICAST_IPV4 = '224.0.0.251'
const MDNS_SERVICE_TYPE = '_drmvyz-cast._tcp.local'
const MDNS_MAX_PACKET_BYTES = 9_000
const MDNS_INTERVAL_MS = 5_000
const NETWORK_POLL_INTERVAL_MS = 4_000
const DNS_TYPE_A = 1
const DNS_TYPE_PTR = 12
const DNS_TYPE_TXT = 16
const DNS_TYPE_SRV = 33
const DNS_CLASS_IN = 1
const DNS_CACHE_FLUSH = 0x8000
const DNS_RESPONSE_FLAGS = 0x8400

function truncateUtf8(value, maxBytes) {
  const raw = Buffer.from(String(value), 'utf8')
  if (raw.length <= maxBytes) return raw.toString('utf8')
  let end = maxBytes
  while (end > 0 && (raw[end] & 0xc0) === 0x80) end -= 1
  return raw.subarray(0, end).toString('utf8')
}

function normalizeReceiverName(value) {
  const name = typeof value === 'string' ? truncateUtf8(value.trim(), 120) : ''
  return name || 'DRMVYZ Receiver'
}

function isValidDeviceId(value) {
  return typeof value === 'string' && value.length >= 8 && value.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(value)
}

function isValidReceiverToken(value) {
  return typeof value === 'string' && value.length >= 8 && value.length <= 256
}

function normalizeAdvertisement(value) {
  if (!value || typeof value !== 'object') return null
  if (value.magic !== DISCOVERY_MAGIC || value.version !== DISCOVERY_VERSION) return null
  if (!isValidDeviceId(value.deviceId)) return null
  if (!Number.isInteger(value.port) || value.port <= 0 || value.port > 65_535) return null
  if (!isValidReceiverToken(value.receiverToken)) return null
  return {
    magic: DISCOVERY_MAGIC,
    version: DISCOVERY_VERSION,
    deviceId: value.deviceId,
    name: normalizeReceiverName(value.name),
    port: value.port,
    receiverToken: value.receiverToken,
    goodbye: value.goodbye === true,
  }
}

function serializeDiscoveryAdvertisement(advertisement) {
  const normalized = normalizeAdvertisement({
    magic: DISCOVERY_MAGIC,
    version: DISCOVERY_VERSION,
    ...advertisement,
  })
  if (!normalized) throw new Error('Invalid DRMVYZ discovery advertisement')
  const payload = Buffer.from(JSON.stringify({
    ...normalized,
    transport: 'legacy-udp-compat',
  }), 'utf8')
  if (payload.length > DISCOVERY_MAX_PAYLOAD_BYTES) throw new Error('DRMVYZ discovery advertisement is too large')
  return payload
}

function parseDiscoveryAdvertisement(message) {
  if (!Buffer.isBuffer(message) || message.length === 0 || message.length > DISCOVERY_MAX_PAYLOAD_BYTES) return null
  try {
    return normalizeAdvertisement(JSON.parse(message.toString('utf8')))
  } catch {
    return null
  }
}

function encodeDnsName(value) {
  const labels = String(value).replace(/\.$/, '').split('.').filter(Boolean)
  const chunks = []
  for (const label of labels) {
    const bytes = Buffer.from(label, 'utf8')
    if (bytes.length === 0 || bytes.length > 63) throw new Error('Invalid DNS label')
    chunks.push(Buffer.from([bytes.length]), bytes)
  }
  chunks.push(Buffer.from([0]))
  return Buffer.concat(chunks)
}

function decodeDnsName(buffer, offset, depth = 0) {
  if (!Buffer.isBuffer(buffer) || depth > 12 || offset < 0 || offset >= buffer.length) throw new Error('Invalid DNS name')
  const labels = []
  let cursor = offset
  let nextOffset = null
  let steps = 0
  while (cursor < buffer.length) {
    if (++steps > 128) throw new Error('Invalid DNS name')
    const length = buffer[cursor]
    if (length === 0) {
      cursor += 1
      if (nextOffset === null) nextOffset = cursor
      return { name: labels.join('.'), nextOffset }
    }
    if ((length & 0xc0) === 0xc0) {
      if (cursor + 1 >= buffer.length) throw new Error('Invalid DNS pointer')
      const pointer = ((length & 0x3f) << 8) | buffer[cursor + 1]
      if (pointer >= buffer.length) throw new Error('Invalid DNS pointer')
      const pointed = decodeDnsName(buffer, pointer, depth + 1)
      if (pointed.name) labels.push(pointed.name)
      cursor += 2
      if (nextOffset === null) nextOffset = cursor
      return { name: labels.join('.'), nextOffset }
    }
    if ((length & 0xc0) !== 0 || length > 63 || cursor + 1 + length > buffer.length) throw new Error('Invalid DNS label')
    labels.push(buffer.subarray(cursor + 1, cursor + 1 + length).toString('utf8'))
    cursor += 1 + length
  }
  throw new Error('Unterminated DNS name')
}

function dnsQuestion(name, type) {
  const suffix = Buffer.alloc(4)
  suffix.writeUInt16BE(type, 0)
  suffix.writeUInt16BE(DNS_CLASS_IN, 2)
  return Buffer.concat([encodeDnsName(name), suffix])
}

function dnsRecord(name, type, ttl, data, cacheFlush = true) {
  const header = Buffer.alloc(10)
  header.writeUInt16BE(type, 0)
  header.writeUInt16BE(DNS_CLASS_IN | (cacheFlush ? DNS_CACHE_FLUSH : 0), 2)
  header.writeUInt32BE(Math.max(0, Math.min(0xffffffff, ttl)), 4)
  header.writeUInt16BE(data.length, 8)
  return Buffer.concat([encodeDnsName(name), header, data])
}

function encodeTxt(values) {
  const chunks = []
  for (const value of values) {
    const bytes = Buffer.from(value, 'utf8')
    if (bytes.length > 255) throw new Error('DNS-SD TXT entry is too large')
    chunks.push(Buffer.from([bytes.length]), bytes)
  }
  return Buffer.concat(chunks)
}

function encodeSrv(port, target) {
  const header = Buffer.alloc(6)
  header.writeUInt16BE(0, 0)
  header.writeUInt16BE(0, 2)
  header.writeUInt16BE(port, 4)
  return Buffer.concat([header, encodeDnsName(target)])
}

function encodeIpv4(address) {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return null
  return Buffer.from(parts)
}

function createDnsPacket({ flags = 0, questions = [], answers = [], additionals = [] }) {
  const header = Buffer.alloc(12)
  header.writeUInt16BE(0, 0)
  header.writeUInt16BE(flags, 2)
  header.writeUInt16BE(questions.length, 4)
  header.writeUInt16BE(answers.length, 6)
  header.writeUInt16BE(0, 8)
  header.writeUInt16BE(additionals.length, 10)
  return Buffer.concat([header, ...questions, ...answers, ...additionals])
}

function parseDnsPacket(message) {
  if (!Buffer.isBuffer(message) || message.length < 12 || message.length > MDNS_MAX_PACKET_BYTES) return null
  try {
    const flags = message.readUInt16BE(2)
    const qdCount = message.readUInt16BE(4)
    const anCount = message.readUInt16BE(6)
    const nsCount = message.readUInt16BE(8)
    const arCount = message.readUInt16BE(10)
    if (qdCount + anCount + nsCount + arCount > 256) return null
    let cursor = 12
    const questions = []
    for (let index = 0; index < qdCount; index += 1) {
      const decoded = decodeDnsName(message, cursor)
      cursor = decoded.nextOffset
      if (cursor + 4 > message.length) return null
      questions.push({
        name: decoded.name,
        type: message.readUInt16BE(cursor),
        class: message.readUInt16BE(cursor + 2) & 0x7fff,
      })
      cursor += 4
    }
    const records = []
    const recordCount = anCount + nsCount + arCount
    for (let index = 0; index < recordCount; index += 1) {
      const decoded = decodeDnsName(message, cursor)
      cursor = decoded.nextOffset
      if (cursor + 10 > message.length) return null
      const type = message.readUInt16BE(cursor)
      const klass = message.readUInt16BE(cursor + 2) & 0x7fff
      const ttl = message.readUInt32BE(cursor + 4)
      const length = message.readUInt16BE(cursor + 8)
      const dataOffset = cursor + 10
      const dataEnd = dataOffset + length
      if (dataEnd > message.length) return null
      let data = null
      if (type === DNS_TYPE_PTR) {
        const target = decodeDnsName(message, dataOffset)
        if (target.nextOffset > dataEnd) return null
        data = target.name
      } else if (type === DNS_TYPE_SRV) {
        if (length < 7) return null
        const target = decodeDnsName(message, dataOffset + 6)
        if (target.nextOffset > dataEnd) return null
        data = {
          port: message.readUInt16BE(dataOffset + 4),
          target: target.name,
        }
      } else if (type === DNS_TYPE_TXT) {
        const values = []
        let txtCursor = dataOffset
        while (txtCursor < dataEnd) {
          const txtLength = message[txtCursor]
          txtCursor += 1
          if (txtCursor + txtLength > dataEnd) return null
          values.push(message.subarray(txtCursor, txtCursor + txtLength).toString('utf8'))
          txtCursor += txtLength
        }
        data = values
      } else if (type === DNS_TYPE_A && length === 4) {
        data = Array.from(message.subarray(dataOffset, dataEnd)).join('.')
      }
      records.push({ name: decoded.name, type, class: klass, ttl, data })
      cursor = dataEnd
    }
    return { flags, questions, records }
  } catch {
    return null
  }
}

function txtValuesToObject(values) {
  const result = {}
  if (!Array.isArray(values)) return result
  for (const value of values) {
    const index = value.indexOf('=')
    if (index <= 0) continue
    const key = value.slice(0, index).trim().toLowerCase()
    if (!key || Object.hasOwn(result, key)) continue
    result[key] = value.slice(index + 1)
  }
  return result
}

function mdnsNames(deviceId) {
  const safe = deviceId.replace(/[^A-Za-z0-9-]/g, '').slice(0, 40) || crypto.createHash('sha256').update(deviceId).digest('hex').slice(0, 24)
  return {
    instance: `drmvyz-${safe}.${MDNS_SERVICE_TYPE}`,
    hostname: `drmvyz-${safe.slice(0, 24)}.local`,
  }
}

function createMdnsQueryPacket() {
  return createDnsPacket({ questions: [dnsQuestion(MDNS_SERVICE_TYPE, DNS_TYPE_PTR)] })
}

function createMdnsAnnouncementPacket({ deviceId, name, port, receiverToken, addresses = [], ttl = 12 }) {
  if (!isValidDeviceId(deviceId) || !Number.isInteger(port) || port <= 0 || port > 65_535 || !isValidReceiverToken(receiverToken)) {
    throw new Error('Invalid DRMVYZ mDNS advertisement')
  }
  const names = mdnsNames(deviceId)
  const txt = encodeTxt([
    `v=${DISCOVERY_VERSION}`,
    `id=${deviceId}`,
    `name=${normalizeReceiverName(name)}`,
    `token=${receiverToken}`,
  ])
  const answers = [
    dnsRecord(MDNS_SERVICE_TYPE, DNS_TYPE_PTR, ttl, encodeDnsName(names.instance), false),
    dnsRecord(names.instance, DNS_TYPE_SRV, ttl, encodeSrv(port, names.hostname)),
    dnsRecord(names.instance, DNS_TYPE_TXT, ttl, txt),
  ]
  const additionals = []
  for (const address of [...new Set(addresses)]) {
    const data = encodeIpv4(address)
    if (data) additionals.push(dnsRecord(names.hostname, DNS_TYPE_A, ttl, data))
  }
  const packet = createDnsPacket({ flags: DNS_RESPONSE_FLAGS, answers, additionals })
  if (packet.length > MDNS_MAX_PACKET_BYTES) throw new Error('DRMVYZ mDNS advertisement is too large')
  return packet
}

function ipv4ToInt(address) {
  return address.split('.').reduce((value, part) => ((value << 8) | Number(part)) >>> 0, 0)
}

function intToIpv4(value) {
  return [24, 16, 8, 0].map(shift => (value >>> shift) & 0xff).join('.')
}

function formatUrlHost(address) {
  return net.isIPv6(address) ? `[${address}]` : address
}

function directedBroadcast(address, netmask) {
  if (!net.isIPv4(address) || !net.isIPv4(netmask)) return null
  const addressInt = ipv4ToInt(address)
  const maskInt = ipv4ToInt(netmask)
  return intToIpv4((addressInt | (~maskInt >>> 0)) >>> 0)
}

function classifyDiscoveryError(error, prefix) {
  const code = typeof error?.code === 'string' ? error.code : ''
  const detail = error instanceof Error ? error.message : String(error || 'unknown error')
  if (code === 'EACCES' || code === 'EPERM') {
    return { state: 'permission-required', message: `${prefix} needs local-network permission: ${detail}` }
  }
  if (code === 'ENETDOWN' || code === 'ENETUNREACH' || code === 'EHOSTUNREACH' || code === 'EADDRNOTAVAIL') {
    return { state: 'unavailable', message: `${prefix} is unavailable on the current network: ${detail}` }
  }
  return { state: 'initialization-failed', message: `${prefix} failed to initialize: ${detail}` }
}

function startSocket(socket, port, address) {
  return new Promise(resolve => {
    let settled = false
    const finish = error => {
      if (settled) return
      settled = true
      socket.removeListener('listening', onListening)
      socket.removeListener('error', onStartupError)
      resolve(error || null)
    }
    const onListening = () => finish(null)
    const onStartupError = error => finish(error)
    socket.once('listening', onListening)
    socket.once('error', onStartupError)
    try {
      socket.bind(port, address)
    } catch (error) {
      finish(error)
    }
  })
}

class DrmvyzReceiverProvider {
  constructor({
    isPrivateNetworkAddress,
    resolveReachableLocalAddress,
    fetchImpl = globalThis.fetch,
    deviceId = crypto.randomUUID(),
    createSocket = options => dgram.createSocket(options),
    networkInterfaces = () => os.networkInterfaces(),
    hostname = () => os.hostname(),
    now = () => Date.now(),
    setIntervalImpl = setInterval,
    clearIntervalImpl = clearInterval,
    setTimeoutImpl = setTimeout,
    trustStore = null,
    senderName = () => `${hostname()} · DRMVYZ`,
  }) {
    this.id = DRMVYZ_RECEIVER_PROVIDER_ID
    this.label = 'DRMVYZ Receivers'
    this.capabilities = Object.freeze({ targetEnumeration: true, sessions: true, picker: false, actions: [] })
    this.isPrivateNetworkAddress = isPrivateNetworkAddress
    this.resolveReachableLocalAddress = resolveReachableLocalAddress
    this.fetchImpl = fetchImpl
    this.deviceId = isValidDeviceId(deviceId) ? deviceId : crypto.randomUUID()
    this.createSocket = createSocket
    this.networkInterfaces = networkInterfaces
    this.hostname = hostname
    this.now = now
    this.setIntervalImpl = setIntervalImpl
    this.clearIntervalImpl = clearIntervalImpl
    this.setTimeoutImpl = setTimeoutImpl
    this.trustStore = trustStore
    this.senderName = senderName
    this.targets = new Map()
    this.capabilityCache = new Map()
    this.capabilityRequests = new Map()
    this.receiverService = null
    this.receiverServiceError = null
    this.mdnsSocket = null
    this.legacySocket = null
    this.mdnsInterval = null
    this.legacyInterval = null
    this.expiryInterval = null
    this.networkPollInterval = null
    this.onTargetsChanged = () => {}
    this.onStatusChanged = () => {}
    this.started = false
    this.generation = 0
    this.networkSignature = ''
    this.mdnsReady = false
    this.legacyReady = false
    this.mdnsError = null
    this.legacyError = null
    this.status = { state: 'unavailable', message: 'Receiver discovery is starting' }
  }

  configureReceiverService({ port, receiverToken }) {
    if (!Number.isInteger(port) || port <= 0 || port > 65_535 || !isValidReceiverToken(receiverToken)) {
      this.receiverService = null
      return
    }
    this.receiverService = { port, receiverToken }
    this.receiverServiceError = null
    this.updateDiscoveryStatus()
    this.sendMdnsAnnouncement()
    this.sendLegacyBeacon()
  }

  reportReceiverServiceError(error) {
    this.receiverService = null
    this.receiverServiceError = classifyDiscoveryError(error, 'DRMVYZ receiver service')
    this.updateDiscoveryStatus()
  }

  getStatus() {
    return this.status
  }

  async listTargets() {
    const discovered = Array.from(this.targets.values()).sort((a, b) => a.name.localeCompare(b.name))
    const results = []
    for (const receiver of discovered) {
      try {
        const capabilities = await this.getReceiverCapabilities(receiver)
        for (const display of capabilities.displays) {
          results.push({
            id: buildReceiverDisplayTargetId(receiver.deviceId, display.id),
            kind: 'network',
            name: `${receiver.name} — ${display.name}`,
            detail: `${display.width} × ${display.height}${display.primary ? ' · Primary' : ''} · up to ${capabilities.video.maxFps} fps · ${capabilities.video.codecs[0] || 'WebRTC negotiated codec'} · ${receiver.address}${capabilities.pairing.paired ? ' · Paired' : ' · Pair on first use'}`,
            available: true,
            receiverId: receiver.deviceId,
            receiverDisplayId: display.id,
            receiverDisplayName: display.name,
            receiverPaired: capabilities.pairing.paired,
            receiverProtocolVersion: capabilities.protocol.version,
            receiverVideoCapabilities: { ...capabilities.video },
          })
        }
      } catch (error) {
        results.push({
          id: `receiver:${receiver.deviceId}`,
          kind: 'network',
          name: receiver.name,
          detail: `${receiver.address} · ${error instanceof Error ? error.message : 'Receiver capabilities unavailable'}`,
          available: false,
          receiverId: receiver.deviceId,
        })
      }
    }
    return results
  }

  capabilityHeaders(receiver, pairingToken = null) {
    const headers = {
      'X-DRMVYZ-Receiver-Token': receiver.receiverToken,
      'X-DRMVYZ-Sender-Id': this.deviceId,
    }
    if (pairingToken) headers['X-DRMVYZ-Pairing-Token'] = pairingToken
    return headers
  }

  async getReceiverCapabilities(receiver, { force = false } = {}) {
    const cached = this.capabilityCache.get(receiver.deviceId)
    if (!force && cached && this.now() - cached.fetchedAt < DRMVYZ_RECEIVER_CAPABILITY_CACHE_MS) return cached.value
    if (!force && this.capabilityRequests.has(receiver.deviceId)) return this.capabilityRequests.get(receiver.deviceId)
    const pairingToken = this.trustStore?.getReceiverToken?.(receiver.deviceId) ?? null
    const request = (async () => {
      const response = await this.fetchImpl(`http://${formatUrlHost(receiver.address)}:${receiver.port}/api/v2/capabilities`, {
        method: 'GET',
        headers: this.capabilityHeaders(receiver, pairingToken),
        signal: AbortSignal.timeout(2_500),
      })
      if (response.status === 426) throw new Error(`Receiver protocol is incompatible; DRMVYZ Receiver V${DRMVYZ_RECEIVER_PROTOCOL_VERSION} is required`)
      if (!response.ok) throw new Error(`Receiver capability handshake failed (${response.status})`)
      const value = normalizeCapabilityDocument(await response.json())
      if (value.device.id !== receiver.deviceId) throw new Error('Receiver capability identity does not match discovery identity')
      this.capabilityCache.set(receiver.deviceId, { value, fetchedAt: this.now() })
      return value
    })()
    this.capabilityRequests.set(receiver.deviceId, request)
    try {
      return await request
    } finally {
      if (this.capabilityRequests.get(receiver.deviceId) === request) this.capabilityRequests.delete(receiver.deviceId)
    }
  }

  async ensurePaired(receiver, capabilities) {
    const existingToken = this.trustStore?.getReceiverToken?.(receiver.deviceId) ?? null
    if (existingToken && capabilities.pairing.paired) return existingToken
    if (!this.trustStore?.saveReceiverToken) throw new Error('Receiver pairing storage is unavailable')
    const response = await this.fetchImpl(`http://${formatUrlHost(receiver.address)}:${receiver.port}/api/v2/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        protocolVersion: DRMVYZ_RECEIVER_PROTOCOL_VERSION,
        senderDeviceId: this.deviceId,
        senderName: this.senderName(),
        receiverToken: receiver.receiverToken,
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (response.status === 403) throw new Error('Pairing was declined on the receiver')
    if (response.status === 409) throw new Error('This receiver is already paired to this sender identity, but the local trust token is missing')
    if (!response.ok) throw new Error(`Receiver pairing failed (${response.status})`)
    const result = await response.json()
    if (result?.protocolVersion !== DRMVYZ_RECEIVER_PROTOCOL_VERSION || typeof result.pairingToken !== 'string') {
      throw new Error('The receiver returned an invalid pairing response')
    }
    this.trustStore.saveReceiverToken(receiver.deviceId, result.pairingToken, receiver.name)
    this.capabilityCache.delete(receiver.deviceId)
    return result.pairingToken
  }

  wait(milliseconds) {
    return new Promise(resolve => this.setTimeoutImpl(resolve, milliseconds))
  }

  async startRemoteCast(receiver, body) {
    let lastError = null
    for (let attempt = 0; attempt <= DRMVYZ_RECEIVER_SESSION_RETRY_COUNT; attempt += 1) {
      try {
        const response = await this.fetchImpl(`http://${formatUrlHost(receiver.address)}:${receiver.port}/api/v2/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(5_000),
        })
        if (response.status === 401 || response.status === 403) throw new Error('Receiver trust is no longer valid; pair the receiver again')
        if (response.status === 409) throw new Error('The selected receiver display is no longer available')
        if (response.status === 426) throw new Error(`Receiver protocol is incompatible; DRMVYZ Receiver V${DRMVYZ_RECEIVER_PROTOCOL_VERSION} is required`)
        if (!response.ok) throw new Error(`The receiver refused the cast (${response.status})`)
        return response
      } catch (error) {
        lastError = error
        if (attempt >= DRMVYZ_RECEIVER_SESSION_RETRY_COUNT || (error instanceof Error && /pair|display|protocol|refused/i.test(error.message))) break
        await this.wait(DRMVYZ_RECEIVER_SESSION_RETRY_MS)
      }
    }
    throw lastError ?? new Error('The receiver connection failed')
  }

  setStatus(status) {
    if (this.status.state === status.state && this.status.message === status.message) return
    this.status = status
    this.onStatusChanged()
  }

  updateDiscoveryStatus() {
    if (this.receiverServiceError) {
      this.setStatus(this.receiverServiceError)
      return
    }
    if (this.mdnsReady) {
      this.setStatus({ state: 'available', message: null })
      return
    }
    if (this.legacyReady) {
      const detail = this.mdnsError?.message || 'mDNS/DNS-SD could not start'
      this.setStatus({ state: 'available', message: `Using legacy UDP compatibility discovery because ${detail}` })
      return
    }
    const errors = [this.mdnsError, this.legacyError].filter(Boolean)
    const permission = errors.find(error => error.state === 'permission-required')
    if (permission) {
      this.setStatus(permission)
      return
    }
    const initialization = errors.find(error => error.state === 'initialization-failed')
    if (initialization) {
      this.setStatus(initialization)
      return
    }
    const unavailable = errors.find(error => error.state === 'unavailable')
    if (unavailable) {
      this.setStatus(unavailable)
      return
    }
    this.setStatus({ state: 'unavailable', message: 'Receiver discovery is starting' })
  }

  async start({ onTargetsChanged, onStatusChanged } = {}) {
    if (this.started) return () => this.shutdown()
    this.started = true
    this.onTargetsChanged = typeof onTargetsChanged === 'function' ? onTargetsChanged : () => {}
    this.onStatusChanged = typeof onStatusChanged === 'function' ? onStatusChanged : this.onTargetsChanged
    this.networkSignature = this.getNetworkSignature()
    await this.restartDiscovery('start')
    this.expiryInterval = this.setIntervalImpl(() => this.expireTargets(), 4_000)
    this.expiryInterval?.unref?.()
    this.networkPollInterval = this.setIntervalImpl(() => this.checkForNetworkChange(), NETWORK_POLL_INTERVAL_MS)
    this.networkPollInterval?.unref?.()
    return () => this.shutdown()
  }

  getInterfaceInfo() {
    const result = []
    let interfaces
    try {
      interfaces = this.networkInterfaces() || {}
    } catch {
      interfaces = {}
    }
    for (const [name, entries] of Object.entries(interfaces)) {
      for (const entry of entries || []) {
        const family = typeof entry.family === 'string' ? entry.family : entry.family === 4 ? 'IPv4' : entry.family === 6 ? 'IPv6' : ''
        const address = typeof entry.address === 'string' ? entry.address : ''
        if (entry.internal || family !== 'IPv4' || !net.isIPv4(address) || !this.isPrivateNetworkAddress(address)) continue
        result.push({ name, address, netmask: entry.netmask || '255.255.255.0', mac: entry.mac || '' })
      }
    }
    return result.sort((a, b) => `${a.name}:${a.address}`.localeCompare(`${b.name}:${b.address}`))
  }

  getNetworkSignature() {
    return this.getInterfaceInfo().map(info => `${info.name}:${info.address}/${info.netmask}:${info.mac}`).join('|')
  }

  checkForNetworkChange() {
    if (!this.started) return false
    const signature = this.getNetworkSignature()
    if (signature === this.networkSignature) return false
    this.networkSignature = signature
    void this.restartDiscovery('network-change')
    return true
  }

  async restartDiscovery(_reason = 'manual') {
    if (!this.started) return
    const generation = ++this.generation
    this.closeDiscoverySockets()
    this.mdnsReady = false
    this.legacyReady = false
    this.mdnsError = null
    this.legacyError = null
    this.updateDiscoveryStatus()

    const [mdnsResult, legacyResult] = await Promise.allSettled([
      this.startMdns(generation),
      this.startLegacyDiscovery(generation),
    ])
    if (!this.started || generation !== this.generation) return
    if (mdnsResult.status === 'rejected') {
      this.mdnsReady = false
      this.mdnsError = classifyDiscoveryError(mdnsResult.reason, 'DRMVYZ local service discovery')
      try { this.mdnsSocket?.close() } catch { /* Failed startup socket may already be closed. */ }
      this.mdnsSocket = null
    }
    if (legacyResult.status === 'rejected') {
      this.legacyReady = false
      this.legacyError = classifyDiscoveryError(legacyResult.reason, 'DRMVYZ UDP compatibility discovery')
      try { this.legacySocket?.close() } catch { /* Failed startup socket may already be closed. */ }
      this.legacySocket = null
    }
    this.updateDiscoveryStatus()
  }

  async startMdns(generation) {
    const socket = this.createSocket({ type: 'udp4', reuseAddr: true })
    this.mdnsSocket = socket
    socket.on('message', (message, rinfo) => {
      if (generation === this.generation) this.handleMdnsMessage(message, rinfo)
    })
    socket.on('error', error => {
      if (generation !== this.generation || !this.started) return
      this.mdnsReady = false
      this.mdnsError = classifyDiscoveryError(error, 'DRMVYZ local service discovery')
      this.updateDiscoveryStatus()
    })
    const error = await startSocket(socket, MDNS_PORT, '0.0.0.0')
    if (error) throw error
    if (!this.started || generation !== this.generation) return
    const interfaces = this.getInterfaceInfo()
    let memberships = 0
    const addresses = interfaces.map(info => info.address)
    for (const address of addresses) {
      try {
        socket.addMembership(MDNS_MULTICAST_IPV4, address)
        memberships += 1
      } catch {
        // Other usable interfaces can still carry discovery.
      }
    }
    if (memberships === 0) {
      try {
        socket.addMembership(MDNS_MULTICAST_IPV4)
        memberships += 1
      } catch (membershipError) {
        throw membershipError
      }
    }
    try { socket.setMulticastTTL(255) } catch { /* Keep platform default when unavailable. */ }
    try { socket.setMulticastLoopback(true) } catch { /* Loopback is not required for peer discovery. */ }
    this.mdnsReady = true
    this.mdnsError = null
    this.updateDiscoveryStatus()
    this.sendMdnsQuery()
    this.sendMdnsAnnouncement()
    this.mdnsInterval = this.setIntervalImpl(() => {
      this.sendMdnsQuery()
      this.sendMdnsAnnouncement()
    }, MDNS_INTERVAL_MS)
    this.mdnsInterval?.unref?.()
  }

  async startLegacyDiscovery(generation) {
    const socket = this.createSocket({ type: 'udp4', reuseAddr: true })
    this.legacySocket = socket
    socket.on('message', (message, rinfo) => {
      if (generation === this.generation) this.handleLegacyBeacon(message, rinfo)
    })
    socket.on('error', error => {
      if (generation !== this.generation || !this.started) return
      this.legacyReady = false
      this.legacyError = classifyDiscoveryError(error, 'DRMVYZ UDP compatibility discovery')
      this.updateDiscoveryStatus()
    })
    const error = await startSocket(socket, DISCOVERY_PORT, '0.0.0.0')
    if (error) throw error
    if (!this.started || generation !== this.generation) return
    try { socket.setBroadcast(true) } catch { /* Directed broadcasts below may still work. */ }
    this.legacyReady = true
    this.legacyError = null
    this.updateDiscoveryStatus()
    this.sendLegacyBeacon()
    this.legacyInterval = this.setIntervalImpl(() => this.sendLegacyBeacon(), DISCOVERY_INTERVAL_MS)
    this.legacyInterval?.unref?.()
  }

  handleLegacyBeacon(message, rinfo) {
    const beacon = parseDiscoveryAdvertisement(message)
    const address = typeof rinfo?.address === 'string' ? rinfo.address : ''
    if (!beacon || beacon.deviceId === this.deviceId || !this.isPrivateNetworkAddress(address)) return false
    if (beacon.goodbye) return this.removeTarget(beacon.deviceId)
    return this.upsertTarget({
      deviceId: beacon.deviceId,
      name: beacon.name,
      address,
      port: beacon.port,
      receiverToken: beacon.receiverToken,
      transport: 'legacy-udp-compat',
    })
  }

  handleBeacon(message, rinfo) {
    return this.handleLegacyBeacon(message, rinfo)
  }

  handleMdnsMessage(message, rinfo) {
    const packet = parseDnsPacket(message)
    if (!packet) return false
    const remoteAddress = typeof rinfo?.address === 'string' ? rinfo.address : ''
    const serviceName = MDNS_SERVICE_TYPE.toLowerCase()
    if ((packet.flags & 0x8000) === 0) {
      if (packet.questions.some(question => question.name.toLowerCase() === serviceName && (question.type === DNS_TYPE_PTR || question.type === 255))) {
        this.sendMdnsAnnouncement()
      }
      return false
    }

    const ptrInstances = new Set(packet.records
      .filter(record => record.type === DNS_TYPE_PTR && record.name.toLowerCase() === serviceName && typeof record.data === 'string')
      .map(record => record.data.toLowerCase()))
    const txtRecords = packet.records.filter(record => record.type === DNS_TYPE_TXT && record.name.toLowerCase().endsWith(`.${serviceName}`))
    let changed = false
    for (const txtRecord of txtRecords) {
      const instanceName = txtRecord.name.toLowerCase()
      if (ptrInstances.size > 0 && !ptrInstances.has(instanceName)) continue
      const txt = txtValuesToObject(txtRecord.data)
      if (Number(txt.v) !== DISCOVERY_VERSION || !isValidDeviceId(txt.id) || txt.id === this.deviceId || !isValidReceiverToken(txt.token)) continue
      if (txtRecord.ttl === 0) {
        changed = this.removeTarget(txt.id) || changed
        continue
      }
      const srv = packet.records.find(record => record.type === DNS_TYPE_SRV && record.name.toLowerCase() === instanceName && record.data)
      if (!srv || !Number.isInteger(srv.data.port) || srv.data.port <= 0 || srv.data.port > 65_535) continue
      const aRecord = packet.records.find(record => record.type === DNS_TYPE_A
        && typeof record.data === 'string'
        && record.name.toLowerCase() === String(srv.data.target || '').toLowerCase()
        && this.isPrivateNetworkAddress(record.data))
      const address = this.isPrivateNetworkAddress(remoteAddress) ? remoteAddress : aRecord?.data
      if (!address || !this.isPrivateNetworkAddress(address)) continue
      changed = this.upsertTarget({
        deviceId: txt.id,
        name: normalizeReceiverName(txt.name),
        address,
        port: srv.data.port,
        receiverToken: txt.token,
        transport: 'mdns',
      }) || changed
    }
    return changed
  }

  upsertTarget(target) {
    const previous = this.targets.get(target.deviceId)
    const next = { ...target, lastSeenAt: this.now() }
    this.targets.set(target.deviceId, next)
    if (!previous || previous.address !== next.address || previous.port !== next.port || previous.receiverToken !== next.receiverToken) this.capabilityCache.delete(target.deviceId)
    const changed = !previous
      || previous.address !== next.address
      || previous.port !== next.port
      || previous.name !== next.name
      || previous.receiverToken !== next.receiverToken
      || previous.transport !== next.transport
    if (changed) this.onTargetsChanged()
    return changed
  }

  removeTarget(deviceId) {
    const changed = this.targets.delete(deviceId)
    this.capabilityCache.delete(deviceId)
    this.capabilityRequests.delete(deviceId)
    if (changed) this.onTargetsChanged()
    return changed
  }

  expireTargets(now = this.now()) {
    const cutoff = now - DISCOVERY_EXPIRY_MS
    let changed = false
    for (const [id, target] of this.targets) {
      if (target.lastSeenAt < cutoff) {
        this.targets.delete(id)
        this.capabilityCache.delete(id)
        this.capabilityRequests.delete(id)
        changed = true
      }
    }
    if (changed) this.onTargetsChanged()
    return changed
  }

  sendSocketPacket(socket, payload, port, address) {
    if (!socket || !payload) return
    try {
      socket.send(payload, port, address, () => {})
    } catch {
      // Runtime socket errors are surfaced by the socket error handler.
    }
  }

  sendMdnsPacket(payload) {
    const socket = this.mdnsSocket
    if (!socket || !this.mdnsReady) return
    const interfaces = this.getInterfaceInfo()
    if (interfaces.length === 0) {
      this.sendSocketPacket(socket, payload, MDNS_PORT, MDNS_MULTICAST_IPV4)
      return
    }
    for (const info of interfaces) {
      try { socket.setMulticastInterface(info.address) } catch { /* Default route remains usable. */ }
      this.sendSocketPacket(socket, payload, MDNS_PORT, MDNS_MULTICAST_IPV4)
    }
  }

  sendMdnsQuery() {
    this.sendMdnsPacket(createMdnsQueryPacket())
  }

  sendMdnsAnnouncement(ttl = 12) {
    if (!this.receiverService?.port || !this.receiverService.receiverToken) return
    try {
      const addresses = this.getInterfaceInfo().map(info => info.address)
      const payload = createMdnsAnnouncementPacket({
        deviceId: this.deviceId,
        name: `${this.hostname()} · DRMVYZ`,
        port: this.receiverService.port,
        receiverToken: this.receiverService.receiverToken,
        addresses,
        ttl,
      })
      this.sendMdnsPacket(payload)
    } catch {
      // Configuration validation happens before the receiver service is accepted.
    }
  }

  sendLegacyBeacon(goodbye = false) {
    if (!this.legacySocket || !this.legacyReady || !this.receiverService?.port || !this.receiverService.receiverToken) return
    let payload
    try {
      payload = serializeDiscoveryAdvertisement({
        deviceId: this.deviceId,
        name: `${this.hostname()} · DRMVYZ`,
        port: this.receiverService.port,
        receiverToken: this.receiverService.receiverToken,
        goodbye,
      })
    } catch {
      return
    }
    const destinations = new Set(['255.255.255.255'])
    for (const info of this.getInterfaceInfo()) {
      const broadcast = directedBroadcast(info.address, info.netmask)
      if (broadcast) destinations.add(broadcast)
    }
    for (const address of destinations) this.sendSocketPacket(this.legacySocket, payload, DISCOVERY_PORT, address)
  }

  async startSession({ target, request, context }) {
    const parsedTarget = parseReceiverDisplayTargetId(target.id)
    const receiverId = target.receiverId ?? parsedTarget?.receiverDeviceId
    const displayId = target.receiverDisplayId ?? parsedTarget?.displayId
    if (!receiverId || !displayId) throw new Error(`Select a DRMVYZ Receiver V${DRMVYZ_RECEIVER_PROTOCOL_VERSION} display before casting`)
    const receiver = this.targets.get(receiverId)
    if (!receiver) throw new Error('That network receiver is no longer available')
    if (!this.receiverService?.port) throw new Error('The output receiver is still starting')
    let capabilities = await this.getReceiverCapabilities(receiver, { force: true })
    if (!capabilities.displays.some(display => display.id === displayId)) throw new Error('The selected receiver display is no longer available')
    const pairingToken = await this.ensurePaired(receiver, capabilities)
    capabilities = await this.getReceiverCapabilities(receiver, { force: true })
    if (!capabilities.pairing.paired) throw new Error('Receiver pairing did not become active')
    if (!capabilities.displays.some(display => display.id === displayId)) throw new Error('The selected receiver display is no longer available')
    const sourceAddress = await this.resolveReachableLocalAddress(receiver.address)
    const sourceUrl = `http://${formatUrlHost(sourceAddress)}:${this.receiverService.port}/receiver?session=${encodeURIComponent(context.sessionId)}&token=${encodeURIComponent(context.sessionToken)}`
    const response = await this.startRemoteCast(receiver, {
      protocolVersion: DRMVYZ_RECEIVER_PROTOCOL_VERSION,
      sourceUrl,
      displayId,
      windowMode: request.windowMode,
      aspectRatio: request.aspectRatio,
      receiverToken: receiver.receiverToken,
      senderDeviceId: this.deviceId,
      pairingToken,
      qualityPolicy: { ...DRMVYZ_RECEIVER_QUALITY_POLICY },
    })
    const remote = await response.json()
    if (!remote || remote.protocolVersion !== DRMVYZ_RECEIVER_PROTOCOL_VERSION || typeof remote.castId !== 'string' || typeof remote.controlToken !== 'string') {
      throw new Error('The receiver returned an invalid V2 session')
    }
    return {
      remoteControl: {
        address: receiver.address,
        port: receiver.port,
        castId: remote.castId,
        controlToken: remote.controlToken,
        receiverToken: receiver.receiverToken,
        receiverId,
        displayId,
        pairingToken,
      },
      qualityPolicy: remote.qualityPolicy ?? { ...DRMVYZ_RECEIVER_QUALITY_POLICY },
    }
  }

  async stopSession(handle) {
    const remote = handle?.remoteControl
    if (!remote) return
    try {
      await this.fetchImpl(`http://${formatUrlHost(remote.address)}:${remote.port}/api/v2/sessions/${encodeURIComponent(remote.castId)}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          controlToken: remote.controlToken,
          receiverToken: remote.receiverToken,
          senderDeviceId: this.deviceId,
          pairingToken: remote.pairingToken,
        }),
        signal: AbortSignal.timeout(2_500),
      })
    } catch {
      // The receiver may already be gone. Local state must still close.
    }
  }

  closeDiscoverySockets() {
    if (this.mdnsInterval) this.clearIntervalImpl(this.mdnsInterval)
    if (this.legacyInterval) this.clearIntervalImpl(this.legacyInterval)
    this.mdnsInterval = null
    this.legacyInterval = null
    for (const socket of [this.mdnsSocket, this.legacySocket]) {
      try { socket?.close() } catch { /* Already closed or not yet bound. */ }
    }
    this.mdnsSocket = null
    this.legacySocket = null
  }

  shutdown() {
    if (!this.started && !this.mdnsSocket && !this.legacySocket) return
    this.sendMdnsAnnouncement(0)
    this.sendLegacyBeacon(true)
    this.started = false
    this.generation += 1
    this.closeDiscoverySockets()
    if (this.expiryInterval) this.clearIntervalImpl(this.expiryInterval)
    if (this.networkPollInterval) this.clearIntervalImpl(this.networkPollInterval)
    this.expiryInterval = null
    this.networkPollInterval = null
    const hadTargets = this.targets.size > 0
    this.targets.clear()
    this.capabilityCache.clear()
    this.capabilityRequests.clear()
    if (hadTargets) this.onTargetsChanged()
    this.mdnsReady = false
    this.legacyReady = false
    this.status = { state: 'unavailable', message: 'Receiver discovery is stopped' }
  }
}

module.exports = {
  DISCOVERY_EXPIRY_MS,
  DISCOVERY_MAGIC,
  DISCOVERY_MAX_PAYLOAD_BYTES,
  DISCOVERY_PORT,
  DISCOVERY_VERSION,
  DRMVYZ_RECEIVER_PROVIDER_ID,
  MDNS_MAX_PACKET_BYTES,
  MDNS_MULTICAST_IPV4,
  MDNS_PORT,
  MDNS_SERVICE_TYPE,
  DrmvyzReceiverProvider,
  createMdnsAnnouncementPacket,
  createMdnsQueryPacket,
  directedBroadcast,
  parseDiscoveryAdvertisement,
  parseDnsPacket,
  serializeDiscoveryAdvertisement,
  txtValuesToObject,
}
