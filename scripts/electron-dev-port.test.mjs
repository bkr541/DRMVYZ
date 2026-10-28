import { test } from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import { isDevPortAvailable, selectDevServerUrl } from './electron-dev-port.mjs'

test('uses the requested port when it is free', async () => {
  const result = await selectDevServerUrl('http://127.0.0.1:5173', { available: async () => true })
  assert.equal(result.href, 'http://127.0.0.1:5173/')
})
test('skips occupied ports while keeping the configured host and path', async () => {
  const checked = []
  const result = await selectDevServerUrl('http://localhost:6000/custom?q=1', { available: async (host, port) => {
    checked.push([host, port]); return port === 6002
  } })
  assert.equal(result.href, 'http://localhost:6002/custom?q=1')
  assert.deepEqual(checked, [['localhost',6000],['localhost',6001],['localhost',6002]])
})
test('reports exhaustion with an actionable error', async () => {
  await assert.rejects(selectDevServerUrl('http://127.0.0.1:5173', { maximumAttempts: 2, available: async () => false }), /No available development port found starting at 5173/)
})
test('stops at the TCP port limit', async () => {
  const checked=[]
  await assert.rejects(selectDevServerUrl('http://127.0.0.1:65535', { available: async (_, port) => { checked.push(port); return false } }), /No available/)
  assert.deepEqual(checked,[65535])
})
test('does not hide unexpected socket failures', async () => {
  await assert.rejects(selectDevServerUrl('http://127.0.0.1:5173', { available: async () => { throw new Error('socket failure') } }), /socket failure/)
})

test('a real occupied listener stays running while a different port is selected', async () => {
  const listener = net.createServer()
  await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve) })
  try {
    const port = listener.address().port
    assert.equal(await isDevPortAvailable('127.0.0.1', port), false)
    const selected = await selectDevServerUrl(`http://127.0.0.1:${port}`)
    assert.notEqual(Number(selected.port), port)
    assert.equal(listener.listening, true)
  } finally {
    await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()))
  }
})
