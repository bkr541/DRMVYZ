'use strict'

const SESSION_STATES = Object.freeze({
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTING: 'disconnecting',
  DISCONNECTED: 'disconnected',
  FAILED: 'failed',
})

const PROVIDER_STATES = Object.freeze({
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
  UNSUPPORTED: 'unsupported',
  PERMISSION_REQUIRED: 'permission-required',
  CONFIGURATION_REQUIRED: 'configuration-required',
  INITIALIZATION_FAILED: 'initialization-failed',
})

function normalizeProviderCapabilities(provider) {
  const declared = provider.capabilities && typeof provider.capabilities === 'object' ? provider.capabilities : {}
  return {
    targetEnumeration: declared.targetEnumeration !== false,
    sessions: declared.sessions !== false && typeof provider.startSession === 'function',
    picker: declared.picker === true,
    actions: Array.isArray(declared.actions) ? [...new Set(declared.actions.filter(action => typeof action === 'string' && action))] : [],
  }
}

function providerError(provider, error, fallback = 'Output provider failed') {
  const message = error instanceof Error ? error.message : fallback
  return {
    providerId: provider.id,
    label: provider.label,
    state: PROVIDER_STATES.INITIALIZATION_FAILED,
    targetCount: 0,
    message,
    capabilities: normalizeProviderCapabilities(provider),
  }
}

function normalizeProviderStatus(provider, status, targetCount) {
  const state = Object.values(PROVIDER_STATES).includes(status?.state)
    ? status.state
    : PROVIDER_STATES.AVAILABLE
  return {
    providerId: provider.id,
    label: provider.label,
    state,
    targetCount,
    message: typeof status?.message === 'string' && status.message.trim() ? status.message.trim() : null,
    capabilities: normalizeProviderCapabilities(provider),
  }
}


function normalizeTransportStats(value) {
  if (!value || typeof value !== 'object') return null
  const timestampMs = Number(value.timestampMs)
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return null
  const number = (input, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) => {
    const parsed = Number(input)
    return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : null
  }
  return {
    timestampMs: Math.round(timestampMs),
    width: number(value.width, 1, 16_384),
    height: number(value.height, 1, 16_384),
    framesPerSecond: number(value.framesPerSecond, 0, 240),
    bitrateKbps: number(value.bitrateKbps, 0, 1_000_000),
    roundTripTimeMs: number(value.roundTripTimeMs, 0, 60_000),
    packetsLost: number(value.packetsLost, 0, Number.MAX_SAFE_INTEGER),
  }
}

function normalizeTarget(provider, target) {
  if (!target || typeof target !== 'object') throw new Error(`${provider.label} returned an invalid target`)
  const id = typeof target.id === 'string' ? target.id.trim() : ''
  const name = typeof target.name === 'string' ? target.name.trim() : ''
  const kind = target.kind === 'display' || target.kind === 'network' ? target.kind : null
  if (!id || !name || !kind) throw new Error(`${provider.label} returned an invalid target`)
  return {
    ...target,
    id,
    name,
    kind,
    detail: typeof target.detail === 'string' ? target.detail : '',
    available: target.available !== false,
    providerId: provider.id,
  }
}

class OutputTargetManager {
  constructor({ providers = [], onTargetsChanged = () => {}, onSessionChanged = () => {} } = {}) {
    this.providers = new Map()
    this.providerCleanup = new Map()
    this.lastProviderStatus = new Map()
    this.providerStartErrors = new Map()
    this.providerStartErrors.clear()
    this.started = false
    this.activeSession = null
    this.onTargetsChanged = onTargetsChanged
    this.onSessionChanged = onSessionChanged
    for (const provider of providers) this.registerProvider(provider)
  }

  registerProvider(provider) {
    if (!provider || typeof provider.id !== 'string' || !provider.id || typeof provider.listTargets !== 'function') {
      throw new Error('Output providers require a stable id and listTargets implementation')
    }
    if (this.providers.has(provider.id)) throw new Error(`Output provider already registered: ${provider.id}`)
    this.providers.set(provider.id, provider)
    return provider
  }


  getProviderCapabilities(providerId) {
    const provider = this.providers.get(providerId)
    return provider ? normalizeProviderCapabilities(provider) : null
  }

  async performProviderAction(providerId, actionId, payload, context = {}) {
    const provider = this.providers.get(providerId)
    if (!provider) throw new Error(`Unknown output provider: ${providerId}`)
    const capabilities = this.getProviderCapabilities(providerId)
    if (!capabilities.actions.includes(actionId) || typeof provider.performAction !== 'function') {
      throw new Error(`${provider.label} does not support action: ${actionId}`)
    }
    return provider.performAction(actionId, payload, context)
  }

  async start() {
    if (this.started) return
    this.started = true
    for (const provider of this.providers.values()) {
      try {
        const cleanup = await provider.start?.({
          onTargetsChanged: () => this.onTargetsChanged(),
          onStatusChanged: () => this.onTargetsChanged(),
        })
        if (typeof cleanup === 'function') this.providerCleanup.set(provider.id, cleanup)
        this.providerStartErrors.delete(provider.id)
      } catch (error) {
        this.providerStartErrors.set(provider.id, error)
        this.lastProviderStatus.set(provider.id, providerError(provider, error))
      }
    }
  }

  async getSnapshot() {
    const targets = []
    const providers = []
    const ids = new Set()

    for (const provider of this.providers.values()) {
      try {
        const rawTargets = await provider.listTargets()
        const providerTargets = Array.isArray(rawTargets) ? rawTargets.map(target => normalizeTarget(provider, target)) : []
        for (const target of providerTargets) {
          if (ids.has(target.id)) throw new Error(`Duplicate output target id: ${target.id}`)
          ids.add(target.id)
          targets.push(target)
        }
        const status = this.providerStartErrors.has(provider.id)
          ? { ...providerError(provider, this.providerStartErrors.get(provider.id)), targetCount: providerTargets.length }
          : normalizeProviderStatus(provider, await provider.getStatus?.(), providerTargets.length)
        this.lastProviderStatus.set(provider.id, status)
        providers.push(status)
      } catch (error) {
        const status = providerError(provider, error)
        this.lastProviderStatus.set(provider.id, status)
        providers.push(status)
      }
    }

    return { targets, providers }
  }

  async listTargets() {
    return (await this.getSnapshot()).targets
  }

  getSession() {
    if (!this.activeSession) return null
    const { runtimeHandle: _runtimeHandle, runtimeCleaned: _runtimeCleaned, provider: _provider, ...session } = this.activeSession
    return { ...session }
  }

  emitSession() {
    this.onSessionChanged(this.getSession())
  }

  async startSession(request, context = {}) {
    if (!request?.targetId) throw new Error('An output target is required')
    if (this.activeSession) await this.stopSession()

    const snapshot = await this.getSnapshot()
    const target = snapshot.targets.find(item => item.id === request.targetId)
    if (!target || !target.available) throw new Error('That output target is no longer available')
    const provider = this.providers.get(target.providerId)
    if (!provider || typeof provider.startSession !== 'function') throw new Error('That output provider cannot start sessions')

    const session = {
      id: context.sessionId,
      targetId: target.id,
      targetName: target.name,
      providerId: provider.id,
      transport: typeof provider.transport === 'string' && provider.transport ? provider.transport : 'webrtc',
      windowMode: request.windowMode,
      aspectRatio: request.aspectRatio,
      state: SESSION_STATES.CONNECTING,
      error: null,
      provider,
      runtimeHandle: null,
      runtimeCleaned: false,
    }
    this.activeSession = session
    this.emitSession()

    try {
      session.runtimeHandle = await provider.startSession({ target, request, context })
      return this.getSession()
    } catch (error) {
      session.state = SESSION_STATES.FAILED
      session.error = error instanceof Error ? error.message : 'Could not start output'
      this.emitSession()
      throw error
    }
  }

  markConnected(sessionId) {
    if (!this.activeSession || this.activeSession.id !== sessionId) return false
    this.activeSession.state = SESSION_STATES.CONNECTED
    this.activeSession.error = null
    this.emitSession()
    return true
  }

  async failSession(sessionId, message) {
    const session = this.activeSession
    if (!session || session.id !== sessionId) return false
    session.state = SESSION_STATES.FAILED
    session.error = typeof message === 'string' && message.trim() ? message.trim() : 'Output stream failed'
    this.emitSession()
    if (!session.runtimeCleaned) {
      session.runtimeCleaned = true
      const runtimeHandle = session.runtimeHandle
      session.runtimeHandle = null
      try {
        await session.provider.stopSession?.(runtimeHandle, session)
      } catch {
        // Preserve the original transport failure; cleanup is best-effort after a failed session.
      }
    }
    return true
  }

  updateSessionStats(sessionId, value) {
    if (!this.activeSession || this.activeSession.id !== sessionId) return false
    const stats = normalizeTransportStats(value)
    if (!stats) return false
    this.activeSession.stats = stats
    this.emitSession()
    return true
  }

  async stopSession() {
    const session = this.activeSession
    if (!session) return null
    session.state = SESSION_STATES.DISCONNECTING
    this.emitSession()
    try {
      if (!session.runtimeCleaned) {
        session.runtimeCleaned = true
        const runtimeHandle = session.runtimeHandle
        session.runtimeHandle = null
        await session.provider.stopSession?.(runtimeHandle, session)
      }
      session.state = SESSION_STATES.DISCONNECTED
      session.error = null
      this.emitSession()
    } catch (error) {
      session.state = SESSION_STATES.FAILED
      session.error = error instanceof Error ? error.message : 'Could not stop output'
      this.emitSession()
      throw error
    } finally {
      if (this.activeSession === session) this.activeSession = null
      this.emitSession()
    }
    return null
  }

  async shutdown() {
    try { await this.stopSession() } catch { /* Continue provider cleanup. */ }
    for (const [id, cleanup] of this.providerCleanup) {
      try { await cleanup() } catch { /* Best-effort shutdown. */ }
      this.providerCleanup.delete(id)
    }
    for (const provider of this.providers.values()) {
      try { await provider.shutdown?.() } catch { /* Best-effort shutdown. */ }
    }
    this.providerStartErrors.clear()
    this.started = false
  }
}

module.exports = {
  OutputTargetManager,
  PROVIDER_STATES,
  SESSION_STATES,
  normalizeProviderCapabilities,
  normalizeTarget,
  normalizeTransportStats,
}
