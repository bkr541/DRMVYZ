'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const {
  MacOsAirPlayProvider,
  OPEN_SYSTEM_PICKER_ACTION,
} = require('./providers/macosAirPlayProvider.cjs')

test('macOS AirPlay provider exposes an action without inventing receiver targets or sessions', async () => {
  let opens = 0
  let targetChanges = 0
  const provider = new MacOsAirPlayProvider({
    platform: 'darwin',
    openSystemDisplays: async () => {
      opens += 1
      return { message: 'Display controls opened.' }
    },
  })
  provider.start({ onTargetsChanged: () => { targetChanges += 1 } })

  assert.deepEqual(provider.capabilities, {
    targetEnumeration: false,
    sessions: false,
    picker: true,
    actions: [OPEN_SYSTEM_PICKER_ACTION],
  })
  assert.deepEqual(provider.listTargets(), [])
  assert.equal(provider.getStatus().state, 'available')

  const result = await provider.performAction(OPEN_SYSTEM_PICKER_ACTION)
  assert.equal(result.state, 'opened')
  assert.equal(opens, 1)
  assert.equal(targetChanges, 1)
  assert.equal(provider.startSession, undefined)
})

test('canceling or closing the system UI never creates provider connection state', async () => {
  const provider = new MacOsAirPlayProvider({
    platform: 'darwin',
    openSystemDisplays: async () => ({ cancelled: true }),
  })
  const before = provider.getStatus()
  const result = await provider.performAction(OPEN_SYSTEM_PICKER_ACTION)
  const after = provider.getStatus()

  assert.equal(result.state, 'opened')
  assert.deepEqual(provider.listTargets(), [])
  assert.equal(before.state, 'available')
  assert.equal(after.state, 'available')
})

test('unsupported platforms and missing native opener are represented explicitly', () => {
  const windows = new MacOsAirPlayProvider({ platform: 'win32', openSystemDisplays: async () => {} })
  assert.equal(windows.getStatus().state, 'unsupported')

  const missing = new MacOsAirPlayProvider({ platform: 'darwin' })
  assert.equal(missing.getStatus().state, 'unavailable')
  assert.match(missing.getStatus().message, /unavailable/i)
})

test('native opener failure is surfaced without stale targets or sessions', async () => {
  const provider = new MacOsAirPlayProvider({
    platform: 'darwin',
    openSystemDisplays: async () => { throw new Error('System Settings could not be opened') },
  })

  await assert.rejects(provider.performAction(OPEN_SYSTEM_PICKER_ACTION), /System Settings could not be opened/)
  assert.equal(provider.getStatus().state, 'initialization-failed')
  assert.deepEqual(provider.listTargets(), [])
})

test('a failed native action can be retried without retaining failed connection state', async () => {
  let attempts = 0
  const provider = new MacOsAirPlayProvider({
    platform: 'darwin',
    openSystemDisplays: async () => {
      attempts += 1
      if (attempts === 1) throw new Error('temporary open failure')
      return { message: 'opened on retry' }
    },
  })

  await assert.rejects(provider.performAction(OPEN_SYSTEM_PICKER_ACTION), /temporary open failure/)
  assert.equal(provider.getStatus().state, 'initialization-failed')
  assert.deepEqual(provider.listTargets(), [])

  const retry = await provider.performAction(OPEN_SYSTEM_PICKER_ACTION)
  assert.equal(retry.state, 'opened')
  assert.equal(provider.getStatus().state, 'available')
  assert.equal(attempts, 2)
})
