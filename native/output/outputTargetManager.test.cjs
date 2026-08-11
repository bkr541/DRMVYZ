'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { OutputTargetManager } = require('./outputTargetManager.cjs')

function provider(id, targets, overrides = {}) {
  return {
    id,
    label: overrides.label ?? id,
    listTargets: async () => targets,
    getStatus: () => ({ state: 'available', message: null }),
    ...overrides,
  }
}

test('aggregates normalized provider targets and isolates a failing provider', async () => {
  const manager = new OutputTargetManager({
    providers: [
      provider('local-display', [{
        id: 'display:1',
        kind: 'display',
        name: 'This display',
        detail: '1920 × 1080 · Primary',
        available: true,
      }]),
      provider('drmvyz-receiver', [], {
        label: 'DRMVYZ receivers',
        listTargets: async () => { throw new Error('UDP discovery unavailable') },
      }),
    ],
  })

  const snapshot = await manager.getSnapshot()
  assert.deepEqual(snapshot.targets.map(target => target.id), ['display:1'])
  assert.equal(snapshot.targets[0].providerId, 'local-display')
  assert.deepEqual(snapshot.providers.map(item => item.state), ['available', 'initialization-failed'])
  assert.match(snapshot.providers[1].message, /UDP discovery unavailable/)
})

test('session dispatch uses the target provider and canonical lifecycle states', async () => {
  const states = []
  let stoppedHandle = null
  const local = provider('local-display', [{
    id: 'display:2', kind: 'display', name: 'Stage', detail: '1920 × 1080', available: true,
  }], {
    startSession: async () => ({ windowId: 17 }),
    stopSession: async handle => { stoppedHandle = handle },
  })
  const manager = new OutputTargetManager({
    providers: [local],
    onSessionChanged: session => states.push(session?.state ?? null),
  })

  const session = await manager.startSession({ targetId: 'display:2', windowMode: 'fullscreen', aspectRatio: '16:9' }, { sessionId: 's1' })
  assert.equal(session.state, 'connecting')
  assert.equal(session.providerId, 'local-display')
  assert.equal(manager.markConnected('s1'), true)
  assert.equal(manager.getSession().state, 'connected')
  await manager.stopSession()
  assert.deepEqual(stoppedHandle, { windowId: 17 })
  assert.deepEqual(states, ['connecting', 'connected', 'disconnecting', 'disconnected', null])
})

test('repeated manager start does not duplicate provider initialization', async () => {
  let starts = 0
  const local = provider('local-display', [], { start: () => { starts += 1 } })
  const manager = new OutputTargetManager({ providers: [local] })
  await manager.start()
  await manager.start()
  assert.equal(starts, 1)
})


test('provider capability/action extension points are registry-scoped', async () => {
  const manager = new OutputTargetManager({
    providers: [provider('future-provider', [], {
      capabilities: { targetEnumeration: true, sessions: false, picker: true, actions: ['open-picker'] },
      performAction: async (actionId, payload) => ({ actionId, payload }),
    })],
  })
  assert.deepEqual(manager.getProviderCapabilities('future-provider'), {
    targetEnumeration: true,
    sessions: false,
    picker: true,
    actions: ['open-picker'],
  })
  assert.deepEqual(await manager.performProviderAction('future-provider', 'open-picker', { source: 'ui' }), {
    actionId: 'open-picker',
    payload: { source: 'ui' },
  })
})


test('transport failure cleans provider runtime once while preserving failed state', async () => {
  const stopped = []
  const network = provider('drmvyz-receiver', [{
    id: 'receiver:device-123:display:stage', kind: 'network', name: 'Stage receiver', detail: 'Stage', available: true,
  }], {
    startSession: async () => ({ castId: 'remote-cast' }),
    stopSession: async handle => { stopped.push(handle) },
  })
  const manager = new OutputTargetManager({ providers: [network] })
  await manager.startSession({ targetId: 'receiver:device-123:display:stage', windowMode: 'fullscreen', aspectRatio: '16:9' }, { sessionId: 'failed-session' })
  manager.markConnected('failed-session')

  assert.equal(await manager.failSession('failed-session', 'Network path lost'), true)
  assert.equal(manager.getSession().state, 'failed')
  assert.equal(manager.getSession().error, 'Network path lost')
  assert.deepEqual(stopped, [{ castId: 'remote-cast' }])

  await manager.stopSession()
  assert.deepEqual(stopped, [{ castId: 'remote-cast' }])
})

test('low-frequency transport diagnostics attach only to the active session and reject malformed samples', async () => {
  const local = provider('local-display', [{
    id: 'display:3', kind: 'display', name: 'Stage', detail: '1920 × 1080', available: true,
  }], {
    startSession: async () => ({ windowId: 21 }),
    stopSession: async () => {},
  })
  const manager = new OutputTargetManager({ providers: [local] })
  await manager.startSession({ targetId: 'display:3', windowMode: 'fullscreen', aspectRatio: '16:9' }, { sessionId: 'stats-session' })

  assert.equal(manager.updateSessionStats('wrong-session', { timestampMs: Date.now() }), false)
  assert.equal(manager.updateSessionStats('stats-session', { timestampMs: 0 }), false)
  assert.equal(manager.updateSessionStats('stats-session', {
    timestampMs: 123456,
    width: 1920,
    height: 1080,
    framesPerSecond: 59.94,
    bitrateKbps: 8600,
    roundTripTimeMs: 8.2,
    packetsLost: 2,
  }), true)
  assert.deepEqual(manager.getSession().stats, {
    timestampMs: 123456,
    width: 1920,
    height: 1080,
    framesPerSecond: 59.94,
    bitrateKbps: 8600,
    roundTripTimeMs: 8.2,
    packetsLost: 2,
  })
  await manager.stopSession()
  assert.equal(manager.updateSessionStats('stats-session', { timestampMs: 123457 }), false)
})

test('configuration-required Google Cast status does not erase healthy provider targets', async () => {
  const manager = new OutputTargetManager({
    providers: [
      provider('local-display', [{ id: 'display:healthy', kind: 'display', name: 'Healthy display', detail: '', available: true }]),
      provider('google-cast', [], {
        label: 'Google Cast',
        capabilities: { targetEnumeration: false, sessions: true, picker: true, actions: ['open-picker'] },
        getStatus: () => ({ state: 'configuration-required', message: 'Cast deployment configuration is missing.' }),
        startSession: async () => ({ sessionId: 'unused' }),
      }),
    ],
  })

  const snapshot = await manager.getSnapshot()
  assert.deepEqual(snapshot.targets.map(target => target.id), ['display:healthy'])
  assert.equal(snapshot.providers.find(item => item.providerId === 'google-cast').state, 'configuration-required')
  assert.equal(snapshot.providers.find(item => item.providerId === 'local-display').state, 'available')
})

test('duplicate targets from one provider are rejected transactionally without leaking partial targets', async () => {
  const manager = new OutputTargetManager({
    providers: [
      provider('local-display', [
        { id: 'display:healthy', kind: 'display', name: 'Healthy display', detail: '', available: true },
      ]),
      provider('broken-provider', [
        { id: 'network:duplicate', kind: 'network', name: 'First duplicate', detail: '', available: true },
        { id: 'network:duplicate', kind: 'network', name: 'Second duplicate', detail: '', available: true },
      ]),
    ],
  })

  const snapshot = await manager.getSnapshot()
  assert.deepEqual(snapshot.targets.map(target => target.id), ['display:healthy'])
  assert.equal(snapshot.providers.find(item => item.providerId === 'local-display').state, 'available')
  assert.equal(snapshot.providers.find(item => item.providerId === 'broken-provider').state, 'initialization-failed')
  assert.match(snapshot.providers.find(item => item.providerId === 'broken-provider').message, /Duplicate output target id/)
})

test('rapid stop while a provider is still starting cannot resurrect a stale session and cleans the late runtime', async () => {
  let resolveRuntime
  const stopped = []
  const local = provider('local-display', [
    { id: 'display:slow', kind: 'display', name: 'Slow display', detail: '', available: true },
  ], {
    startSession: () => new Promise(resolve => { resolveRuntime = resolve }),
    stopSession: async handle => { stopped.push(handle) },
  })
  const manager = new OutputTargetManager({ providers: [local] })

  const starting = manager.startSession(
    { targetId: 'display:slow', windowMode: 'fullscreen', aspectRatio: '16:9' },
    { sessionId: 'slow-session' },
  )
  while (!manager.getSession()) await new Promise(resolve => setImmediate(resolve))

  await manager.stopSession()
  assert.equal(manager.getSession(), null)
  resolveRuntime({ windowId: 77 })

  await assert.rejects(starting, /cancelled before it finished starting/)
  await manager.shutdown()
  assert.deepEqual(stopped, [{ windowId: 77 }])
  assert.equal(manager.getSession(), null)
})

test('provider shutdown does not run twice when start returned an owning cleanup callback', async () => {
  let cleanupCalls = 0
  let shutdownCalls = 0
  const local = provider('local-display', [], {
    start: () => () => { cleanupCalls += 1 },
    shutdown: () => { shutdownCalls += 1 },
  })
  const manager = new OutputTargetManager({ providers: [local] })

  await manager.start()
  await manager.shutdown()

  assert.equal(cleanupCalls, 1)
  assert.equal(shutdownCalls, 0)
})

test('provider startup failure cannot publish stale targets while healthy providers remain visible', async () => {
  const stale = provider('stale-provider', [
    { id: 'network:stale', kind: 'network', name: 'Stale receiver', detail: '', available: true },
  ], {
    start: async () => { throw new Error('provider startup failed') },
  })
  const manager = new OutputTargetManager({
    providers: [
      provider('local-display', [
        { id: 'display:healthy-after-start-failure', kind: 'display', name: 'Healthy display', detail: '', available: true },
      ]),
      stale,
    ],
  })

  await manager.start()
  const snapshot = await manager.getSnapshot()

  assert.deepEqual(snapshot.targets.map(target => target.id), ['display:healthy-after-start-failure'])
  assert.equal(snapshot.providers.find(item => item.providerId === 'stale-provider').state, 'initialization-failed')
  assert.match(snapshot.providers.find(item => item.providerId === 'stale-provider').message, /provider startup failed/)
  await manager.shutdown()
})

test('session cleanup still calls provider stop when a provider uses no runtime handle', async () => {
  let stopCalls = 0
  const actionOnlyRuntime = provider('handleless-provider', [
    { id: 'network:handleless', kind: 'network', name: 'Handleless target', detail: '', available: true },
  ], {
    startSession: async () => undefined,
    stopSession: async handle => {
      assert.equal(handle, undefined)
      stopCalls += 1
    },
  })
  const manager = new OutputTargetManager({ providers: [actionOnlyRuntime] })

  await manager.startSession(
    { targetId: 'network:handleless', windowMode: 'fullscreen', aspectRatio: '16:9' },
    { sessionId: 'handleless-session' },
  )
  await manager.stopSession()

  assert.equal(stopCalls, 1)
})

test('provider shutdown falls back to shutdown when the owning cleanup callback fails', async () => {
  let shutdownCalls = 0
  const local = provider('local-display', [], {
    start: () => async () => { throw new Error('cleanup failed') },
    shutdown: () => { shutdownCalls += 1 },
  })
  const manager = new OutputTargetManager({ providers: [local] })

  await manager.start()
  await manager.shutdown()

  assert.equal(shutdownCalls, 1)
})
