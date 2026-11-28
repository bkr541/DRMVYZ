'use strict'

const fsp = require('node:fs/promises')
const path = require('node:path')

/**
 * Performance recordings written to disk as they are made (beta remediation PERF-01).
 *
 * The renderer's MediaRecorder hands over a chunk every half second; each one is appended to `<Downloads>/STAGELESS Recordings/<name>.partial`
 * straight away, so memory use stays flat however long the set is. Stopping renames the file to its final name. If the app or the computer
 * stops first, the .partial file stays where it is and holds everything recorded up to that moment (WebM plays as it is).
 *
 * Free space is checked before starting and every 30 seconds of recording; below the minimum the renderer is told to stop, and the recording
 * so far is kept.
 */

const MIN_FREE_BYTES_TO_START = 2 * 1024 ** 3
const MIN_FREE_BYTES_WHILE_RECORDING = 512 * 1024 ** 2
const SPACE_CHECK_EVERY_APPENDS = 60
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(webm|mp4|mov)$/

async function freeBytes(directory) {
  try {
    const stats = await fsp.statfs(directory)
    return Number(stats.bavail) * Number(stats.bsize)
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

function installRecordingBridge({ ipcMain, app, log, fsApi = fsp, freeSpace = freeBytes }) {
  const scope = log?.scope?.('system:recording')
  const recordings = new Map()
  let nextId = 1

  const directory = () => path.join(app.getPath('downloads'), 'STAGELESS Recordings')

  ipcMain.handle('drmvyz:recording:start', async (_event, fileName) => {
    if (typeof fileName !== 'string' || !SAFE_NAME.test(fileName)) throw new Error('Invalid recording file name')
    const folder = directory()
    await fsApi.mkdir(folder, { recursive: true })
    const available = await freeSpace(folder)
    if (available < MIN_FREE_BYTES_TO_START) {
      return { ok: false, reason: 'low-disk', freeBytes: available }
    }
    const finalPath = path.join(folder, fileName)
    const partialPath = `${finalPath}.partial`
    const handle = await fsApi.open(partialPath, 'w')
    const id = nextId++
    recordings.set(id, { handle, finalPath, partialPath, bytes: 0, appends: 0, chain: Promise.resolve() })
    scope?.info?.('recording started', { fileName })
    return { ok: true, id }
  })

  ipcMain.handle('drmvyz:recording:append', async (_event, id, chunk) => {
    const recording = recordings.get(id)
    if (!recording) throw new Error('Unknown recording')
    if (!(chunk instanceof ArrayBuffer) && !ArrayBuffer.isView(chunk)) throw new Error('Invalid recording chunk')
    const buffer = chunk instanceof ArrayBuffer ? Buffer.from(chunk) : Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)
    // Appends are written strictly in order.
    recording.chain = recording.chain.then(async () => {
      await recording.handle.write(buffer)
      recording.bytes += buffer.length
      recording.appends += 1
    })
    await recording.chain
    if (recording.appends % SPACE_CHECK_EVERY_APPENDS === 0) {
      const available = await freeSpace(path.dirname(recording.partialPath))
      if (available < MIN_FREE_BYTES_WHILE_RECORDING) return { ok: true, bytes: recording.bytes, lowDisk: true }
    }
    return { ok: true, bytes: recording.bytes, lowDisk: false }
  })

  ipcMain.handle('drmvyz:recording:finish', async (_event, id) => {
    const recording = recordings.get(id)
    if (!recording) throw new Error('Unknown recording')
    recordings.delete(id)
    await recording.chain
    await recording.handle.close()
    if (recording.bytes === 0) {
      await fsApi.rm(recording.partialPath, { force: true })
      return { ok: false, reason: 'empty' }
    }
    await fsApi.rename(recording.partialPath, recording.finalPath)
    scope?.info?.('recording saved', { bytes: recording.bytes })
    return { ok: true, path: recording.finalPath, bytes: recording.bytes }
  })

  // Stops writing but keeps what was recorded, under its .partial name, so nothing already captured is lost.
  ipcMain.handle('drmvyz:recording:abort', async (_event, id) => {
    const recording = recordings.get(id)
    if (!recording) return { ok: true, path: null }
    recordings.delete(id)
    await recording.chain.catch(() => undefined)
    await recording.handle.close().catch(() => undefined)
    if (recording.bytes === 0) {
      await fsApi.rm(recording.partialPath, { force: true })
      return { ok: true, path: null }
    }
    scope?.warn?.('recording interrupted; partial file kept', { bytes: recording.bytes })
    return { ok: true, path: recording.partialPath }
  })

  app.on?.('before-quit', () => {
    for (const recording of recordings.values()) void recording.handle.close().catch(() => undefined)
  })
}

module.exports = { installRecordingBridge, MIN_FREE_BYTES_TO_START, MIN_FREE_BYTES_WHILE_RECORDING }
