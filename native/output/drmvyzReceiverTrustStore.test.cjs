'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { createReceiverTrustStore } = require('./drmvyzReceiverTrustStore.cjs')

test('receiver trust persists sender approvals and paired receiver tokens without persisting live sessions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'drmvyz-trust-'))
  const app = { getPath: name => name === 'userData' ? root : root }
  try {
    const first = createReceiverTrustStore(app)
    const senderToken = first.pairSender('sender-device-1', 'Stage Laptop')
    first.saveReceiverToken('receiver-device-1', 'receiver-pairing-token-abcdefghijklmnopqrstuvwxyz', 'Booth Receiver')

    const second = createReceiverTrustStore(app)
    assert.equal(second.verifySenderToken('sender-device-1', senderToken), true)
    assert.equal(second.getReceiverToken('receiver-device-1'), 'receiver-pairing-token-abcdefghijklmnopqrstuvwxyz')
    const snapshot = second.snapshot()
    assert.deepEqual(Object.keys(snapshot).sort(), ['trustedReceivers', 'trustedSenders', 'version'])
    assert.equal(JSON.stringify(snapshot).includes('castId'), false)
    assert.equal(JSON.stringify(snapshot).includes('session'), false)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('re-pairing rotates the sender bearer token and invalidates the previous token', () => {
  let counter = 0
  const cryptoImpl = { randomBytes: () => Buffer.from(`token-seed-${++counter}-token-seed-${counter}`.padEnd(32, 'x')) }
  const store = createReceiverTrustStore(null, { cryptoImpl })
  const first = store.pairSender('sender-device-2', 'Sender')
  const second = store.pairSender('sender-device-2', 'Sender', { replace: true })
  assert.notEqual(first, second)
  assert.equal(store.verifySenderToken('sender-device-2', first), false)
  assert.equal(store.verifySenderToken('sender-device-2', second), true)
})
