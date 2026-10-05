'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { createCpuUsageSampler, installSystemMetricsBridge, MIN_SAMPLE_INTERVAL_MS } = require('./systemMetricsBridge.cjs')

const appWith = (...percents) => ({
  calls: 0,
  getAppMetrics() { this.calls += 1; return percents.map(percentCPUUsage => ({ cpu: { percentCPUUsage } })) },
})

test('sums every process and normalises by core count', () => {
  const sample = createCpuUsageSampler({ app: appWith(40, 120, 40), cpuCount: 8 })()
  assert.equal(sample.rawPercent, 200)
  assert.equal(sample.percent, 25)
  assert.equal(sample.processCount, 3)
  assert.equal(sample.cores, 8)
})

test('clamps to 0–100 and tolerates processes without cpu data', () => {
  const app = { getAppMetrics: () => [{ cpu: { percentCPUUsage: 900 } }, {}, null] }
  assert.equal(createCpuUsageSampler({ app, cpuCount: 4 })().percent, 100)
})

test('callers inside the minimum interval share one reading instead of resetting the sample window', () => {
  let clock = 1000
  const app = appWith(50)
  const sample = createCpuUsageSampler({ app, cpuCount: 1, now: () => clock })
  const first = sample()
  clock += MIN_SAMPLE_INTERVAL_MS - 1
  assert.equal(sample(), first)
  assert.equal(app.calls, 1)
  clock += 2
  assert.notEqual(sample(), first)
  assert.equal(app.calls, 2)
})

test('serves the reading over ipc and returns null when the metrics call throws', async () => {
  const handlers = new Map()
  const ipcMain = { handle: (channel, handler) => handlers.set(channel, handler) }
  installSystemMetricsBridge({ app: appWith(30), ipcMain, cpuCount: 2 })
  const result = await handlers.get('drmvyz:system:get-cpu-usage')({})
  assert.equal(result.percent, 15)

  const failing = new Map()
  installSystemMetricsBridge({
    app: { getAppMetrics() { throw new Error('boom') } },
    ipcMain: { handle: (channel, handler) => failing.set(channel, handler) },
    cpuCount: 2,
  })
  assert.equal(await failing.get('drmvyz:system:get-cpu-usage')({}), null)
})
