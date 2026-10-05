'use strict'

const os = require('node:os')

// Electron's getAppMetrics() reports each process's CPU since the previous call, so two callers
// polling back to back would each see a sliver of the interval. Callers inside this window share
// the last reading instead.
const MIN_SAMPLE_INTERVAL_MS = 750

/**
 * Whole-app CPU usage: the sum of every Electron process (main, renderers, GPU, utility) as a
 * percentage of total machine capacity, so it reads 0–100 regardless of core count. `rawPercent`
 * is the un-normalised sum (100 = one full core) for tooltips.
 */
function createCpuUsageSampler({ app, cpuCount = os.cpus().length || 1, now = Date.now }) {
  let last = null
  return function sample() {
    const at = now()
    if (last && at - last.timestamp < MIN_SAMPLE_INTERVAL_MS) return last
    const metrics = app.getAppMetrics()
    const rawPercent = metrics.reduce((sum, processMetric) => sum + (processMetric?.cpu?.percentCPUUsage ?? 0), 0)
    last = {
      percent: Math.min(100, Math.max(0, rawPercent / cpuCount)),
      rawPercent,
      processCount: metrics.length,
      cores: cpuCount,
      timestamp: at,
    }
    return last
  }
}

/** Serves the header's CPU readout (see src/native/systemMetricsBridge.ts). Read-only numeric metrics. */
function installSystemMetricsBridge({ app, ipcMain, cpuCount, now, log }) {
  const sample = createCpuUsageSampler({ app, cpuCount, now })
  ipcMain.handle('drmvyz:system:get-cpu-usage', () => {
    try {
      return sample()
    } catch (error) {
      log?.scope?.('system:metrics')?.warn?.('get-cpu-usage failed:', error)
      return null
    }
  })
}

module.exports = { installSystemMetricsBridge, createCpuUsageSampler, MIN_SAMPLE_INTERVAL_MS }
