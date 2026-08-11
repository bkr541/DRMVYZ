'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const {
  OPEN_WINDOWS_DISPLAY_SETTINGS_ACTION,
  WindowsMiracastProvider,
} = require('./providers/windowsMiracastProvider.cjs')

test('Windows Miracast provider exposes an OS-owned action without inventing duplicate targets or sessions', async () => {
  let opens = 0
  let targetChanges = 0
  const provider = new WindowsMiracastProvider({
    platform: 'win32',
    openWindowsDisplays: async () => {
      opens += 1
      return { message: 'Windows Display settings opened.' }
    },
  })
  provider.start({ onTargetsChanged: () => { targetChanges += 1 } })

  assert.deepEqual(provider.capabilities, {
    targetEnumeration: false,
    sessions: false,
    picker: true,
    actions: [OPEN_WINDOWS_DISPLAY_SETTINGS_ACTION],
  })
  assert.deepEqual(provider.listTargets(), [])
  assert.equal(provider.getStatus().state, 'available')

  const result = await provider.performAction(OPEN_WINDOWS_DISPLAY_SETTINGS_ACTION)
  assert.equal(result.state, 'opened')
  assert.equal(opens, 1)
  assert.equal(targetChanges, 1)
  assert.equal(provider.startSession, undefined)
})

test('unsupported platforms and missing native opener are represented explicitly', () => {
  const mac = new WindowsMiracastProvider({ platform: 'darwin', openWindowsDisplays: async () => {} })
  assert.equal(mac.getStatus().state, 'unsupported')

  const missing = new WindowsMiracastProvider({ platform: 'win32' })
  assert.equal(missing.getStatus().state, 'unavailable')
  assert.match(missing.getStatus().message, /unavailable/i)
})

test('native opener failure remains explicit and can be retried without stale session state', async () => {
  let attempts = 0
  const provider = new WindowsMiracastProvider({
    platform: 'win32',
    openWindowsDisplays: async () => {
      attempts += 1
      if (attempts === 1) throw new Error('Windows Settings launch failed')
      return { message: 'opened on retry' }
    },
  })

  await assert.rejects(provider.performAction(OPEN_WINDOWS_DISPLAY_SETTINGS_ACTION), /Windows Settings launch failed/)
  assert.equal(provider.getStatus().state, 'initialization-failed')
  assert.deepEqual(provider.listTargets(), [])

  const retry = await provider.performAction(OPEN_WINDOWS_DISPLAY_SETTINGS_ACTION)
  assert.equal(retry.state, 'opened')
  assert.equal(provider.getStatus().state, 'available')
  assert.equal(attempts, 2)
})
