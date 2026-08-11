'use strict'

const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { isValidDeviceId, isValidPairingToken } = require('./drmvyzReceiverProtocol.cjs')

const TRUST_FILENAME = 'drmvyz-output-receiver-trust-v2.json'
const TRUST_FILE_VERSION = 1

function safeName(value) {
  return typeof value === 'string' ? value.trim().slice(0, 160) : ''
}

function emptyState() {
  return { version: TRUST_FILE_VERSION, trustedReceivers: {}, trustedSenders: {} }
}

function normalizeState(value) {
  const state = emptyState()
  if (!value || typeof value !== 'object' || value.version !== TRUST_FILE_VERSION) return state
  for (const [deviceId, entry] of Object.entries(value.trustedReceivers || {})) {
    if (!isValidDeviceId(deviceId) || !isValidPairingToken(entry?.pairingToken)) continue
    state.trustedReceivers[deviceId] = {
      pairingToken: entry.pairingToken,
      name: safeName(entry.name),
      pairedAt: Number.isFinite(Number(entry.pairedAt)) ? Number(entry.pairedAt) : 0,
    }
  }
  for (const [deviceId, entry] of Object.entries(value.trustedSenders || {})) {
    if (!isValidDeviceId(deviceId) || !isValidPairingToken(entry?.pairingToken)) continue
    state.trustedSenders[deviceId] = {
      pairingToken: entry.pairingToken,
      name: safeName(entry.name),
      pairedAt: Number.isFinite(Number(entry.pairedAt)) ? Number(entry.pairedAt) : 0,
    }
  }
  return state
}

function timingSafeTokenEqual(left, right) {
  if (!isValidPairingToken(left) || !isValidPairingToken(right)) return false
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function createReceiverTrustStore(app, {
  fsImpl = fs,
  cryptoImpl = crypto,
  now = () => Date.now(),
} = {}) {
  let trustPath = null
  try {
    const userData = app?.getPath?.('userData')
    if (typeof userData === 'string' && userData) trustPath = path.join(userData, TRUST_FILENAME)
  } catch {
    trustPath = null
  }

  let state = emptyState()
  if (trustPath) {
    try {
      state = normalizeState(JSON.parse(fsImpl.readFileSync(trustPath, 'utf8')))
    } catch {
      state = emptyState()
    }
  }

  const persist = () => {
    if (!trustPath) return
    try {
      fsImpl.mkdirSync(path.dirname(trustPath), { recursive: true })
      fsImpl.writeFileSync(trustPath, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    } catch (error) {
      console.warn('[DRMVYZ Output] Could not persist receiver trust:', error)
    }
  }

  return {
    path: trustPath,
    getReceiverToken(receiverDeviceId) {
      return state.trustedReceivers[receiverDeviceId]?.pairingToken ?? null
    },
    saveReceiverToken(receiverDeviceId, pairingToken, name = '') {
      if (!isValidDeviceId(receiverDeviceId) || !isValidPairingToken(pairingToken)) throw new Error('Invalid receiver trust record')
      state.trustedReceivers[receiverDeviceId] = { pairingToken, name: safeName(name), pairedAt: now() }
      persist()
      return pairingToken
    },
    hasTrustedSender(senderDeviceId) {
      return Boolean(state.trustedSenders[senderDeviceId])
    },
    verifySenderToken(senderDeviceId, pairingToken) {
      const trusted = state.trustedSenders[senderDeviceId]
      return Boolean(trusted && timingSafeTokenEqual(trusted.pairingToken, pairingToken))
    },
    pairSender(senderDeviceId, name = '', { replace = false } = {}) {
      if (!isValidDeviceId(senderDeviceId)) throw new Error('Invalid sender identity')
      if (state.trustedSenders[senderDeviceId] && !replace) throw new Error('Sender is already paired')
      const pairingToken = cryptoImpl.randomBytes(32).toString('base64url')
      state.trustedSenders[senderDeviceId] = { pairingToken, name: safeName(name), pairedAt: now() }
      persist()
      return pairingToken
    },
    snapshot() {
      return JSON.parse(JSON.stringify(state))
    },
  }
}

module.exports = {
  TRUST_FILENAME,
  TRUST_FILE_VERSION,
  createReceiverTrustStore,
  normalizeState,
  timingSafeTokenEqual,
}
