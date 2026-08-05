#!/usr/bin/env node

import { createReadStream, existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import { tmpdir } from 'node:os'
import { basename, extname, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import {
  atomicWriteFile,
  canonicalJson,
  createDatasetManifest,
  createFailedManifestTrackRecord,
  DEFAULT_AUDIO_EXTENSIONS,
  discoverAudioFiles,
  displayPath,
  extractManifestTrackRecord,
  inspectExistingSidecar,
  normalizeExtensions,
  resolveGenreMetadata,
  sha256File,
  sidecarPathFor,
} from './audio-intelligence-batch-core.mjs'

const HARNESS_PATH = '/browser-audio-intelligence-golden.html'
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000
const DEFAULT_MANIFEST_NAME = 'drmvyz-audio-intelligence-manifest.json'

function parseArgs(argv) {
  const args = {
    input: process.env.DRMVYZ_AUDIO_BATCH_INPUT || '',
    recursive: false,
    genreFromParent: false,
    manualGenres: [],
    skipExisting: false,
    overwrite: false,
    failFast: false,
    includeHidden: false,
    output: 'beside',
    extensions: [...DEFAULT_AUDIO_EXTENSIONS],
    manifest: '',
    chromium: process.env.DRMVYZ_CHROMIUM_EXECUTABLE || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '',
    timeoutMs: Number(process.env.DRMVYZ_AUDIO_BATCH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    const value = argv[index + 1]
    if (token === '--input' && value) { args.input = value; index += 1 }
    else if (token === '--recursive') args.recursive = true
    else if (token === '--genre-from-parent') args.genreFromParent = true
    else if (token === '--genre' && value) { args.manualGenres.push(value); index += 1 }
    else if (token === '--skip-existing') args.skipExisting = true
    else if (token === '--overwrite') args.overwrite = true
    else if (token === '--fail-fast') args.failFast = true
    else if (token === '--include-hidden') args.includeHidden = true
    else if (token === '--output' && value) { args.output = value; index += 1 }
    else if (token === '--extensions' && value) {
      args.extensions = value.split(',').map(extension => extension.trim()).filter(Boolean)
      index += 1
    } else if (token === '--manifest' && value) { args.manifest = value; index += 1 }
    else if (token === '--chromium' && value) { args.chromium = value; index += 1 }
    else if (token === '--timeout-ms' && value) { args.timeoutMs = Number(value); index += 1 }
    else if (token === '--help' || token === '-h') args.help = true
    else throw new Error(`Unknown or incomplete argument: ${token}`)
  }

  if (args.skipExisting && args.overwrite) throw new Error('--skip-existing and --overwrite cannot be used together.')
  if (args.output !== 'beside') throw new Error('The initial batch CLI supports only --output beside.')
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) throw new Error('--timeout-ms must be a positive number.')
  args.extensions = [...normalizeExtensions(args.extensions)]
  return args
}

function usage() {
  return `Usage:
  npm run audio:batch -- --input /absolute/path/to/dataset [options]

Options:
  --recursive                 Include nested directories.
  --genre-from-parent         Use each track's immediate parent directory as a genre label.
  --genre <label>             Add a manual label to every discovered track. Repeatable.
  --skip-existing             Skip sidecars only when source hash and analyzer versions are current.
  --overwrite                 Reanalyze and replace every sidecar.
  --fail-fast                 Stop after the first track failure.
  --include-hidden            Include hidden files and directories.
  --extensions wav,mp3,...    Override the supported extension list.
  --output beside             Write <track>.drmvyz-ai.json beside each source track.
  --manifest <path>           Override the dataset manifest path.
  --chromium <path>           Use a specific Chromium or Chrome executable.
  --timeout-ms <number>       Per-track timeout. Default: ${DEFAULT_TIMEOUT_MS}.
  --help                      Show this help.

Environment equivalents:
  DRMVYZ_AUDIO_BATCH_INPUT
  DRMVYZ_CHROMIUM_EXECUTABLE
  DRMVYZ_AUDIO_BATCH_TIMEOUT_MS

The command starts Vite and Chromium once, then runs DRMVYZ's production
analyzeTrackBuffer() and RGB waveform analyzer sequentially for every track.`
}

async function reservePort() {
  return await new Promise((resolvePort, reject) => {
    const server = createNetServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(error => error ? reject(error) : resolvePort(port))
    })
  })
}

async function waitForHttp(url, timeoutMs = 30_000) {
  const started = Date.now()
  let lastError
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { cache: 'no-store' })
      if (response.ok) return
      lastError = new Error(`${response.status} ${response.statusText}`)
    } catch (error) {
      lastError = error
    }
    await delay(150)
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}

function mimeTypeFor(filePath) {
  const extension = extname(filePath).toLowerCase()
  if (extension === '.wav') return 'audio/wav'
  if (extension === '.mp3') return 'audio/mpeg'
  if (extension === '.flac') return 'audio/flac'
  if (extension === '.m4a' || extension === '.mp4') return 'audio/mp4'
  if (extension === '.ogg') return 'audio/ogg'
  return 'application/octet-stream'
}

async function startBatchAudioServer(audioFiles) {
  const secret = `batch-${process.pid}-${Math.random().toString(36).slice(2)}`
  const routes = new Map()
  audioFiles.forEach((filePath, index) => routes.set(`/${secret}/${index}`, filePath))

  const server = createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Cache-Control', 'no-store')
    const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname
    const filePath = routes.get(pathname)
    if (!filePath) {
      response.statusCode = 404
      response.end('Not found')
      return
    }

    try {
      const fileStats = await stat(filePath)
      response.statusCode = 200
      response.setHeader('Content-Type', mimeTypeFor(filePath))
      response.setHeader('Content-Length', String(fileStats.size))
      const stream = createReadStream(filePath)
      stream.on('error', error => {
        if (!response.headersSent) response.statusCode = 500
        response.end(error.message)
      })
      stream.pipe(response)
    } catch (error) {
      response.statusCode = 500
      response.end(error instanceof Error ? error.message : String(error))
    }
  })

  await new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Unable to resolve batch audio server address.')

  return {
    urlFor(filePath) {
      const index = audioFiles.indexOf(filePath)
      if (index < 0) throw new Error(`Audio file is not registered with the batch server: ${filePath}`)
      return `http://127.0.0.1:${address.port}/${secret}/${index}`
    },
    close: () => new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose())),
  }
}

function resolveChromium(explicitPath) {
  const candidates = [
    explicitPath,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean)
  const found = candidates.find(candidate => existsSync(candidate))
  if (!found) throw new Error('Chromium/Chrome was not found. Pass --chromium or set DRMVYZ_CHROMIUM_EXECUTABLE.')
  return found
}

function startVite(port) {
  const viteCli = resolve('node_modules/vite/bin/vite.js')
  if (!existsSync(viteCli)) throw new Error('Vite is not installed. Run npm ci before using the batch analyzer.')
  const child = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  })
  let stderr = ''
  child.stderr.on('data', chunk => { stderr += chunk.toString() })
  return { stderr: () => stderr, stop: () => stopChild(child) }
}

function stopChild(child) {
  if (!child || child.exitCode !== null) return Promise.resolve()
  child.kill('SIGTERM')
  return new Promise(resolveStop => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL')
      resolveStop()
    }, 2_000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolveStop()
    })
  })
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl
    this.nextId = 1
    this.pending = new Map()
  }

  async connect() {
    this.socket = new WebSocket(this.webSocketUrl)
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data))
      if (!message.id) return
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)
      if (message.error) pending.reject(new Error(message.error.message || JSON.stringify(message.error)))
      else pending.resolve(message.result)
    })
    this.socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) pending.reject(new Error('Chromium DevTools connection closed.'))
      this.pending.clear()
    })
    await new Promise((resolveOpen, reject) => {
      this.socket.addEventListener('open', resolveOpen, { once: true })
      this.socket.addEventListener('error', reject, { once: true })
    })
  }

  send(method, params = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Chromium DevTools connection is not open.'))
    }
    const id = this.nextId++
    return new Promise((resolveSend, reject) => {
      this.pending.set(id, { resolve: resolveSend, reject })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  close() {
    this.socket?.close()
  }
}

async function startChromium(chromiumPath, debugPort, userDataDir) {
  const child = spawn(chromiumPath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--metrics-recording-only',
    '--no-first-run',
    '--autoplay-policy=no-user-gesture-required',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', chunk => { stderr += chunk.toString() })
  await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`, 30_000).catch(async error => {
    await stopChild(child)
    throw new Error(`${error.message}\nChromium stderr:\n${stderr}`)
  })
  return { stderr: () => stderr, stop: () => stopChild(child) }
}

async function openTarget(debugPort, url) {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
  if (!response.ok) throw new Error(`Unable to create Chromium target: ${response.status} ${response.statusText}`)
  return await response.json()
}

async function evaluateByValue(client, expression) {
  const evaluation = await client.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (evaluation?.exceptionDetails) {
    const description = evaluation.exceptionDetails.exception?.description
      || evaluation.exceptionDetails.text
      || 'Browser evaluation failed.'
    throw new Error(description)
  }
  return evaluation?.result?.value
}

async function waitForBatchApi(client, timeoutMs = 30_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const ready = await evaluateByValue(client, `Boolean(
      window.__DRMVYZ_AUDIO_INTELLIGENCE_BATCH__
      && typeof window.__DRMVYZ_AUDIO_INTELLIGENCE_BATCH__.startAnalysis === 'function'
      && typeof window.__DRMVYZ_AUDIO_INTELLIGENCE_BATCH__.getAnalyzerVersions === 'function'
    )`)
    if (ready) return
    await delay(100)
  }
  throw new Error('The browser Audio Intelligence batch API did not become ready.')
}

async function startBrowserAnalysis(client, request) {
  const serializedRequest = JSON.stringify(request)
  return await evaluateByValue(
    client,
    `window.__DRMVYZ_AUDIO_INTELLIGENCE_BATCH__.startAnalysis(${serializedRequest})`,
  )
}

async function readBrowserResult(client, runId, timeoutMs, progressPrefix) {
  const started = Date.now()
  let lastProgressKey = ''
  while (Date.now() - started < timeoutMs) {
    const state = await evaluateByValue(client, `(() => {
      const state = window.__DRMVYZ_BROWSER_AUDIO_GOLDEN__;
      if (!state || state.runId !== ${JSON.stringify(runId)}) return null;
      return {
        runId: state.runId,
        status: state.status,
        stage: state.stage,
        progress: state.progress,
        error: state.error,
        stack: state.stack,
        canonicalJson: state.status === 'complete' ? state.canonicalJson : undefined,
        runtime: state.status === 'complete' ? state.runtime : undefined,
      };
    })()`)

    if (state) {
      const percentValue = Number.isFinite(state.progress) ? Math.round(state.progress * 100) : null
      const progressKey = `${state.status}|${state.stage}|${percentValue}`
      if (progressKey !== lastProgressKey) {
        lastProgressKey = progressKey
        const percent = percentValue === null ? '' : ` ${percentValue}%`
        process.stdout.write(`[audio-batch] ${progressPrefix}: ${state.stage || state.status}${percent}\n`)
      }
      if (state.status === 'error') throw new Error(`${state.error || 'Browser analysis failed.'}\n${state.stack || ''}`)
      if (state.status === 'complete' && typeof state.canonicalJson === 'string') return state
    }
    await delay(250)
  }
  throw new Error(`Browser analysis timed out after ${timeoutMs} ms.`)
}


async function resetBrowserHarness(client, harnessUrl) {
  await client.send('Page.navigate', { url: harnessUrl })
  await waitForBatchApi(client)
}

async function readExistingManifestCreatedAt(manifestPath) {
  try {
    const existing = JSON.parse(await readFile(manifestPath, 'utf8'))
    return typeof existing.createdAt === 'string' ? existing.createdAt : null
  } catch {
    return null
  }
}

function delay(milliseconds) {
  return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds))
}

async function runBatch(args) {
  if (!args.input) throw new Error('--input is required.')
  const inputDirectory = resolve(args.input)
  const inputStats = await stat(inputDirectory).catch(() => null)
  if (!inputStats?.isDirectory()) throw new Error(`Input directory was not found: ${inputDirectory}`)

  const manifestPath = args.manifest ? resolve(args.manifest) : resolve(inputDirectory, DEFAULT_MANIFEST_NAME)
  const audioFiles = await discoverAudioFiles(inputDirectory, {
    recursive: args.recursive,
    includeHidden: args.includeHidden,
    extensions: args.extensions,
  })
  const command = {
    script: 'npm run audio:batch',
    arguments: process.argv.slice(2),
  }
  const createdAt = await readExistingManifestCreatedAt(manifestPath) || new Date().toISOString()
  const trackRecords = []
  let analyzerVersions = null
  let stopRequested = false
  let interrupted = false

  const requestStop = () => {
    stopRequested = true
    interrupted = true
    process.stdout.write('\n[audio-batch] Stop requested. Finishing the current track before closing.\n')
  }
  process.once('SIGINT', requestStop)
  process.once('SIGTERM', requestStop)

  process.stdout.write([
    '[audio-batch] DRMVYZ Audio Intelligence Batch',
    `[audio-batch] Directory: ${inputDirectory}`,
    `[audio-batch] Tracks found: ${audioFiles.length}`,
    `[audio-batch] Manifest: ${manifestPath}`,
  ].join('\n') + '\n')

  const audioServer = await startBatchAudioServer(audioFiles)
  const vitePort = await reservePort()
  const debugPort = await reservePort()
  const tempProfile = await mkdtemp(resolve(tmpdir(), 'drmvyz-audio-batch-'))
  const vite = startVite(vitePort)
  let chromium
  let client

  async function persistManifest() {
    if (!analyzerVersions) return
    const manifest = createDatasetManifest({
      inputDirectory,
      analyzerVersions,
      trackRecords,
      discoveredCount: audioFiles.length,
      createdAt,
      updatedAt: new Date().toISOString(),
      interrupted,
      command,
    })
    await atomicWriteFile(manifestPath, canonicalJson(manifest))
  }

  try {
    const harnessBase = `http://127.0.0.1:${vitePort}${HARNESS_PATH}`
    await waitForHttp(harnessBase, 30_000).catch(error => {
      throw new Error(`${error.message}\nVite stderr:\n${vite.stderr()}`)
    })

    const chromiumPath = resolveChromium(args.chromium)
    chromium = await startChromium(chromiumPath, debugPort, tempProfile)
    const target = await openTarget(debugPort, harnessBase)
    if (!target.webSocketDebuggerUrl) throw new Error('Chromium target did not expose a DevTools WebSocket URL.')

    client = new CdpClient(target.webSocketDebuggerUrl)
    await client.connect()
    await client.send('Runtime.enable')
    await client.send('Page.enable')
    await waitForBatchApi(client)
    analyzerVersions = await evaluateByValue(
      client,
      'window.__DRMVYZ_AUDIO_INTELLIGENCE_BATCH__.getAnalyzerVersions()',
    )
    await persistManifest()

    for (let index = 0; index < audioFiles.length; index += 1) {
      if (stopRequested) break
      const audioPath = audioFiles[index]
      const relativeAudioPath = displayPath(audioPath, inputDirectory)
      const sidecarPath = sidecarPathFor(audioPath)
      const genre = resolveGenreMetadata(audioPath, inputDirectory, {
        manualLabels: args.manualGenres,
        genreFromParent: args.genreFromParent,
      })
      process.stdout.write(`[audio-batch] [${index + 1}/${audioFiles.length}] ${relativeAudioPath}\n`)

      try {
        let existing = { current: false, reason: existsSync(sidecarPath) ? 'reanalysis-requested' : 'missing' }
        if (args.skipExisting && existsSync(sidecarPath)) {
          process.stdout.write(`[audio-batch] Hashing source to validate existing sidecar...\n`)
          const sourceSha256 = await sha256File(audioPath)
          existing = await inspectExistingSidecar(sidecarPath, {
            schemaVersion: analyzerVersions.goldenSchemaVersion,
            sourceSha256,
            trackAnalysisVersion: analyzerVersions.trackAnalysisVersion,
            rgbWaveformVersion: analyzerVersions.rgbWaveformVersion,
          })
        }

        if (args.skipExisting && existing.current) {
          trackRecords.push(extractManifestTrackRecord({
            fixture: existing.fixture,
            audioPath,
            sidecarPath,
            inputDirectory,
            ...genre,
            batchDisposition: 'skipped',
            staleReason: null,
          }))
          process.stdout.write(`[audio-batch] Skipped current sidecar: ${displayPath(sidecarPath, inputDirectory)}\n`)
          await persistManifest()
          continue
        }

        if (args.skipExisting && existing.reason !== 'missing') {
          process.stdout.write(`[audio-batch] Reanalyzing stale sidecar (${existing.reason}).\n`)
        } else if (args.overwrite && existsSync(sidecarPath)) {
          process.stdout.write('[audio-batch] Overwriting existing sidecar.\n')
        }

        const runId = await startBrowserAnalysis(client, {
          audioUrl: audioServer.urlFor(audioPath),
          sourceName: basename(audioPath),
          mimeType: mimeTypeFor(audioPath),
        })
        const result = await readBrowserResult(client, runId, args.timeoutMs, relativeAudioPath)
        const fixture = JSON.parse(result.canonicalJson)
        await atomicWriteFile(sidecarPath, result.canonicalJson)
        trackRecords.push(extractManifestTrackRecord({
          fixture,
          audioPath,
          sidecarPath,
          inputDirectory,
          ...genre,
          batchDisposition: 'analyzed',
          staleReason: existing.reason === 'missing' ? null : existing.reason,
        }))
        process.stdout.write(`[audio-batch] Wrote ${displayPath(sidecarPath, inputDirectory)}\n`)
      } catch (error) {
        trackRecords.push(createFailedManifestTrackRecord({
          audioPath,
          sidecarPath,
          inputDirectory,
          ...genre,
          error,
        }))
        process.stderr.write(`[audio-batch] Failed ${relativeAudioPath}: ${error instanceof Error ? error.message : String(error)}\n`)
        await persistManifest()
        if (args.failFast) throw error
        await resetBrowserHarness(client, harnessBase).catch(resetError => {
          throw new Error(`Unable to reset the browser analyzer after a track failure: ${resetError instanceof Error ? resetError.message : String(resetError)}`)
        })
        continue
      }

      await persistManifest()
    }

    if (stopRequested) interrupted = true
    await persistManifest()
    const summary = createDatasetManifest({
      inputDirectory,
      analyzerVersions,
      trackRecords,
      discoveredCount: audioFiles.length,
      createdAt,
      updatedAt: new Date().toISOString(),
      interrupted,
      command,
    }).summary
    process.stdout.write([
      '[audio-batch] Finished.',
      `[audio-batch] Analyzed: ${summary.completed}`,
      `[audio-batch] Skipped: ${summary.skipped}`,
      `[audio-batch] Failed: ${summary.failed}`,
      `[audio-batch] Manifest: ${manifestPath}`,
    ].join('\n') + '\n')

    if (summary.failed > 0) process.exitCode = 1
    if (interrupted) process.exitCode = 130
  } finally {
    process.removeListener('SIGINT', requestStop)
    process.removeListener('SIGTERM', requestStop)
    client?.close()
    await chromium?.stop().catch(() => undefined)
    await vite.stop().catch(() => undefined)
    await audioServer.close().catch(() => undefined)
    await rm(tempProfile, { recursive: true, force: true }).catch(() => undefined)
  }
}

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  process.stdout.write(`${usage()}\n`)
  process.exit(0)
}

runBatch(args).catch(error => {
  process.stderr.write(`[audio-batch] ${error instanceof Error ? error.stack || error.message : String(error)}\n`)
  process.exitCode = 1
})
