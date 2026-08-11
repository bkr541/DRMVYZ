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
