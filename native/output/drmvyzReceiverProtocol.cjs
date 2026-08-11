'use strict'

const DRMVYZ_RECEIVER_PROTOCOL_NAME = 'drmvyz-receiver'
const DRMVYZ_RECEIVER_PROTOCOL_VERSION = 2
const DRMVYZ_RECEIVER_PROTOCOL_MIN_VERSION = 2
const DRMVYZ_RECEIVER_CAPABILITY_CACHE_MS = 5_000
const DRMVYZ_RECEIVER_STATS_INTERVAL_MS = 2_000
const DRMVYZ_RECEIVER_SESSION_RETRY_MS = 250
const DRMVYZ_RECEIVER_SESSION_RETRY_COUNT = 1
const DRMVYZ_RECEIVER_QUALITY_POLICY = Object.freeze({
  maxLongEdge: 1920,
  maxShortEdge: 1080,
  maxFps: 60,
  maxVideoBitrateKbps: 12_000,
  codecNegotiation: 'webrtc-sdp',
})

function cleanString(value, maxLength = 160) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function isValidDeviceId(value) {
  return typeof value === 'string' && value.length >= 8 && value.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(value)
}

function isValidPairingToken(value) {
  return typeof value === 'string' && value.length >= 24 && value.length <= 256 && /^[A-Za-z0-9_-]+$/.test(value)
}

function normalizeDisplayCapability(value) {
  if (!value || typeof value !== 'object') return null
  const id = cleanString(value.id, 128)
  const name = cleanString(value.name, 160)
  const width = Number(value.width)
  const height = Number(value.height)
  const scaleFactor = Number(value.scaleFactor)
  const refreshRate = value.refreshRate == null ? null : Number(value.refreshRate)
  if (!id || !name || !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return null
  return {
    id,
    name,
    width: Math.round(width),
    height: Math.round(height),
    scaleFactor: Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1,
    refreshRate: Number.isFinite(refreshRate) && refreshRate > 0 ? Math.round(refreshRate) : null,
    primary: value.primary === true,
  }
}

function normalizeQualityPolicy(value) {
  if (!value || typeof value !== 'object') return { ...DRMVYZ_RECEIVER_QUALITY_POLICY }
  const maxLongEdge = Number(value.maxLongEdge)
  const maxShortEdge = Number(value.maxShortEdge)
  const maxFps = Number(value.maxFps)
  const maxVideoBitrateKbps = Number(value.maxVideoBitrateKbps)
  return {
    maxLongEdge: Number.isFinite(maxLongEdge) && maxLongEdge >= 320 ? Math.min(7680, Math.round(maxLongEdge)) : DRMVYZ_RECEIVER_QUALITY_POLICY.maxLongEdge,
    maxShortEdge: Number.isFinite(maxShortEdge) && maxShortEdge >= 240 ? Math.min(4320, Math.round(maxShortEdge)) : DRMVYZ_RECEIVER_QUALITY_POLICY.maxShortEdge,
    maxFps: Number.isFinite(maxFps) && maxFps >= 1 ? Math.min(120, Math.round(maxFps)) : DRMVYZ_RECEIVER_QUALITY_POLICY.maxFps,
    maxVideoBitrateKbps: Number.isFinite(maxVideoBitrateKbps) && maxVideoBitrateKbps >= 250 ? Math.min(100_000, Math.round(maxVideoBitrateKbps)) : DRMVYZ_RECEIVER_QUALITY_POLICY.maxVideoBitrateKbps,
    codecNegotiation: 'webrtc-sdp',
  }
}

function buildCapabilityDocument({ deviceId, name, displays, paired, qualityPolicy = DRMVYZ_RECEIVER_QUALITY_POLICY }) {
  if (!isValidDeviceId(deviceId)) throw new Error('Invalid DRMVYZ receiver device id')
  const normalizedDisplays = Array.isArray(displays) ? displays.map(normalizeDisplayCapability).filter(Boolean) : []
  if (normalizedDisplays.length === 0) throw new Error('DRMVYZ receiver has no selectable displays')
  const policy = normalizeQualityPolicy(qualityPolicy)
  return {
    protocol: {
      name: DRMVYZ_RECEIVER_PROTOCOL_NAME,
      version: DRMVYZ_RECEIVER_PROTOCOL_VERSION,
      minVersion: DRMVYZ_RECEIVER_PROTOCOL_MIN_VERSION,
    },
    device: {
      id: deviceId,
      name: cleanString(name, 160) || 'DRMVYZ Receiver',
    },
    pairing: {
      required: true,
      paired: paired === true,
    },
    displays: normalizedDisplays,
    video: {
      transport: 'webrtc',
      codecNegotiation: 'webrtc-sdp',
      codecs: ['video/VP8'],
      maxLongEdge: policy.maxLongEdge,
      maxShortEdge: policy.maxShortEdge,
      maxFps: policy.maxFps,
      maxVideoBitrateKbps: policy.maxVideoBitrateKbps,
      statsIntervalMs: DRMVYZ_RECEIVER_STATS_INTERVAL_MS,
    },
  }
}

function normalizeCapabilityDocument(value) {
  if (!value || typeof value !== 'object') throw new Error('The receiver returned an invalid capability document')
  const protocol = value.protocol
  if (!protocol || protocol.name !== DRMVYZ_RECEIVER_PROTOCOL_NAME || protocol.version !== DRMVYZ_RECEIVER_PROTOCOL_VERSION) {
    throw new Error(`Receiver protocol is incompatible; DRMVYZ Receiver V${DRMVYZ_RECEIVER_PROTOCOL_VERSION} is required`)
  }
  if (!isValidDeviceId(value.device?.id)) throw new Error('The receiver capability identity is invalid')
  const displays = Array.isArray(value.displays) ? value.displays.map(normalizeDisplayCapability).filter(Boolean) : []
  if (displays.length === 0) throw new Error('The receiver reported no selectable displays')
  return {
    protocol: {
      name: DRMVYZ_RECEIVER_PROTOCOL_NAME,
      version: DRMVYZ_RECEIVER_PROTOCOL_VERSION,
      minVersion: Number.isInteger(protocol.minVersion) ? protocol.minVersion : DRMVYZ_RECEIVER_PROTOCOL_MIN_VERSION,
    },
    device: {
      id: value.device.id,
      name: cleanString(value.device.name, 160) || 'DRMVYZ Receiver',
    },
    pairing: {
      required: value.pairing?.required !== false,
      paired: value.pairing?.paired === true,
    },
    displays,
    video: {
      transport: value.video?.transport === 'webrtc' ? 'webrtc' : 'webrtc',
      codecNegotiation: 'webrtc-sdp',
      codecs: Array.isArray(value.video?.codecs) ? value.video.codecs.filter(item => typeof item === 'string').slice(0, 32) : [],
      maxLongEdge: normalizeQualityPolicy(value.video).maxLongEdge,
      maxShortEdge: normalizeQualityPolicy(value.video).maxShortEdge,
      maxFps: normalizeQualityPolicy(value.video).maxFps,
      maxVideoBitrateKbps: normalizeQualityPolicy(value.video).maxVideoBitrateKbps,
      statsIntervalMs: Number.isFinite(Number(value.video?.statsIntervalMs))
        ? Math.max(1_000, Math.min(10_000, Math.round(Number(value.video.statsIntervalMs))))
        : DRMVYZ_RECEIVER_STATS_INTERVAL_MS,
    },
  }
}

function buildReceiverDisplayTargetId(receiverDeviceId, displayId) {
  if (!isValidDeviceId(receiverDeviceId)) throw new Error('Invalid receiver target identity')
  const normalizedDisplayId = cleanString(displayId, 128)
  if (!normalizedDisplayId) throw new Error('Invalid receiver display identity')
  return `receiver:${receiverDeviceId}:display:${encodeURIComponent(normalizedDisplayId)}`
}

function parseReceiverDisplayTargetId(value) {
  if (typeof value !== 'string') return null
  const match = value.match(/^receiver:([A-Za-z0-9._:-]{8,128}):display:(.+)$/)
  if (!match) return null
  try {
    const displayId = decodeURIComponent(match[2])
    if (!displayId || displayId.length > 128) return null
    return { receiverDeviceId: match[1], displayId }
  } catch {
    return null
  }
}

function normalizePairRequest(value) {
  if (!value || typeof value !== 'object' || !isValidDeviceId(value.senderDeviceId)) return null
  const senderName = cleanString(value.senderName, 160)
  return {
    protocolVersion: Number(value.protocolVersion),
    senderDeviceId: value.senderDeviceId,
    senderName: senderName || 'DRMVYZ Sender',
    receiverToken: cleanString(value.receiverToken, 256),
  }
}

function normalizeV2StartRequest(value, validWindowModes, validAspectRatios) {
  if (!value || typeof value !== 'object') return null
  if (Number(value.protocolVersion) !== DRMVYZ_RECEIVER_PROTOCOL_VERSION) return null
  if (!isValidDeviceId(value.senderDeviceId) || !isValidPairingToken(value.pairingToken)) return null
  const displayId = cleanString(value.displayId, 128)
  const sourceUrl = cleanString(value.sourceUrl, 2_048)
  const windowMode = cleanString(value.windowMode, 32)
  const aspectRatio = cleanString(value.aspectRatio, 32)
  if (!displayId || !sourceUrl || !validWindowModes.has(windowMode) || !validAspectRatios.has(aspectRatio)) return null
  return {
    protocolVersion: DRMVYZ_RECEIVER_PROTOCOL_VERSION,
    senderDeviceId: value.senderDeviceId,
    pairingToken: value.pairingToken,
    receiverToken: cleanString(value.receiverToken, 256),
    displayId,
    sourceUrl,
    windowMode,
    aspectRatio,
    qualityPolicy: normalizeQualityPolicy(value.qualityPolicy),
  }
}

module.exports = {
  DRMVYZ_RECEIVER_CAPABILITY_CACHE_MS,
  DRMVYZ_RECEIVER_PROTOCOL_MIN_VERSION,
  DRMVYZ_RECEIVER_PROTOCOL_NAME,
  DRMVYZ_RECEIVER_PROTOCOL_VERSION,
  DRMVYZ_RECEIVER_QUALITY_POLICY,
  DRMVYZ_RECEIVER_SESSION_RETRY_COUNT,
  DRMVYZ_RECEIVER_SESSION_RETRY_MS,
  DRMVYZ_RECEIVER_STATS_INTERVAL_MS,
  buildCapabilityDocument,
  buildReceiverDisplayTargetId,
  isValidDeviceId,
  isValidPairingToken,
  normalizeCapabilityDocument,
  normalizeDisplayCapability,
  normalizePairRequest,
  normalizeQualityPolicy,
  normalizeV2StartRequest,
  parseReceiverDisplayTargetId,
}
