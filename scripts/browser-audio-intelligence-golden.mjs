#!/usr/bin/env node

import { createReadStream, existsSync } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import { basename, dirname, extname, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'

const DEFAULT_FIXTURE = 'src/test/fixtures/audio-intelligence/eyes-cut-deeper.chromium.json'
const HARNESS_PATH = '/browser-audio-intelligence-golden.html'
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000

function parseArgs(argv) {
  const args = {
    command: argv[0] === 'generate' || argv[0] === 'verify' ? argv[0] : 'verify',
    audio: process.env.DRMVYZ_GOLDEN_AUDIO_FILE || '',
    fixture: process.env.DRMVYZ_GOLDEN_FIXTURE || DEFAULT_FIXTURE,
    sourceName: process.env.DRMVYZ_GOLDEN_SOURCE_NAME || '',
    chromium: process.env.DRMVYZ_CHROMIUM_EXECUTABLE || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '',
    timeoutMs: Number(process.env.DRMVYZ_GOLDEN_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  }

  for (let index = args.command === argv[0] ? 1 : 0; index < argv.length; index += 1) {
    const token = argv[index]
    const value = argv[index + 1]
    if (token === '--audio' && value) { args.audio = value; index += 1 }
    else if (token === '--fixture' && value) { args.fixture = value; index += 1 }
    else if (token === '--source-name' && value) { args.sourceName = value; index += 1 }
    else if (token === '--chromium' && value) { args.chromium = value; index += 1 }
    else if (token === '--timeout-ms' && value) { args.timeoutMs = Number(value); index += 1 }
    else if (token === '--help' || token === '-h') args.help = true
    else throw new Error(`Unknown argument: ${token}`)
  }

  return args
}

function usage() {
  return `Usage:
  npm run audio:golden:generate -- --audio /absolute/path/track.wav [--fixture path] [--source-name name.wav]
  npm run audio:golden:verify   -- --audio /absolute/path/track.wav [--fixture path]

Environment equivalents:
  DRMVYZ_GOLDEN_AUDIO_FILE
  DRMVYZ_GOLDEN_FIXTURE
  DRMVYZ_GOLDEN_SOURCE_NAME
  DRMVYZ_CHROMIUM_EXECUTABLE
  DRMVYZ_GOLDEN_TIMEOUT_MS

Node launches the browser, serves bytes, writes the returned JSON, and compares files.
All decoding, beat-grid, pitch, harmonic, structural, curve, and waveform analysis runs inside Chromium through DRMVYZ production analyzers.`
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
    await new Promise(resolveDelay => setTimeout(resolveDelay, 150))
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}

function mimeTypeFor(path) {
  const extension = extname(path).toLowerCase()
  if (extension === '.wav') return 'audio/wav'
  if (extension === '.mp3') return 'audio/mpeg'
  if (extension === '.flac') return 'audio/flac'
  if (extension === '.m4a' || extension === '.mp4') return 'audio/mp4'
  if (extension === '.ogg') return 'audio/ogg'
  return 'application/octet-stream'
}

async function startAudioServer(audioPath) {
  const token = `audio-${process.pid}-${Math.random().toString(36).slice(2)}`
  const fileStats = await stat(audioPath)
  const server = createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Cache-Control', 'no-store')
    if (request.url !== `/${token}`) {
      response.statusCode = 404
      response.end('Not found')
      return
    }
    response.statusCode = 200
    response.setHeader('Content-Type', mimeTypeFor(audioPath))
    response.setHeader('Content-Length', String(fileStats.size))
    createReadStream(audioPath).pipe(response)
  })

  await new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Unable to resolve audio server address.')
  return {
    url: `http://127.0.0.1:${address.port}/${token}`,
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
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean)
  const found = candidates.find(candidate => existsSync(candidate))
  if (!found) {
    throw new Error('Chromium/Chrome was not found. Pass --chromium or set DRMVYZ_CHROMIUM_EXECUTABLE.')
  }
  return found
}

function startVite(port) {
  const viteCli = resolve('node_modules/vite/bin/vite.js')
  if (!existsSync(viteCli)) throw new Error('Vite is not installed. Run npm ci before generating the fixture.')
  const child = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  })
  let stderr = ''
  child.stderr.on('data', chunk => { stderr += chunk.toString() })
  return {
    child,
    stderr: () => stderr,
    stop: () => stopChild(child),
  }
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
  ], {
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  let stderr = ''
  child.stderr.on('data', chunk => { stderr += chunk.toString() })
  await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`, 30_000).catch(async error => {
    await stopChild(child)
    throw new Error(`${error.message}\nChromium stderr:\n${stderr}`)
  })
  return {
    child,
    stderr: () => stderr,
    stop: () => stopChild(child),
  }
}

async function openTarget(debugPort, url) {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
  if (!response.ok) throw new Error(`Unable to create Chromium target: ${response.status} ${response.statusText}`)
  return await response.json()
}

async function readBrowserResult(client, timeoutMs) {
  const started = Date.now()
  let lastProgressKey = ''
  while (Date.now() - started < timeoutMs) {
    const evaluation = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const state = window.__DRMVYZ_BROWSER_AUDIO_GOLDEN__;
        if (!state) return null;
        return {
          status: state.status,
          stage: state.stage,
          progress: state.progress,
          error: state.error,
          stack: state.stack,
          canonicalJson: state.canonicalJson,
          runtime: state.runtime,
          volatile: state.volatile,
        };
      })()`,
      returnByValue: true,
      awaitPromise: true,
    })
    const state = evaluation?.result?.value
    if (state) {
      const progressKey = `${state.status}|${state.stage}|${Math.floor((state.progress || 0) * 100)}`
      if (progressKey !== lastProgressKey) {
        lastProgressKey = progressKey
        const percent = Number.isFinite(state.progress) ? ` ${Math.round(state.progress * 100)}%` : ''
        process.stdout.write(`[browser-golden] ${state.stage || state.status}${percent}\n`)
      }
      if (state.status === 'error') throw new Error(`${state.error || 'Browser fixture failed.'}\n${state.stack || ''}`)
      if (state.status === 'complete' && typeof state.canonicalJson === 'string') return state
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 250))
  }
  throw new Error(`Browser fixture timed out after ${timeoutMs} ms.`)
}

function firstByteMismatch(expected, actual) {
  const limit = Math.min(expected.length, actual.length)
  for (let index = 0; index < limit; index += 1) {
    if (expected[index] !== actual[index]) return index
  }
  return expected.length === actual.length ? -1 : limit
}

function mismatchContext(buffer, offset) {
  const start = Math.max(0, offset - 80)
  const end = Math.min(buffer.length, offset + 160)
  return buffer.subarray(start, end).toString('utf8').replaceAll('\n', '\\n')
}

async function runBrowserFixture(args) {
  const audioPath = resolve(args.audio)
  if (!args.audio || !existsSync(audioPath)) {
    throw new Error(`Source audio was not found: ${args.audio || '(not provided)'}`)
  }

  const sourceName = args.sourceName || basename(audioPath)
  const fixturePath = resolve(args.fixture)
  const audioServer = await startAudioServer(audioPath)
  const vitePort = await reservePort()
  const debugPort = await reservePort()
  const tempProfile = await mkdtemp(resolve(tmpdir(), 'drmvyz-browser-golden-'))
  const vite = startVite(vitePort)
  let chromium
  let client

  try {
    const harnessBase = `http://127.0.0.1:${vitePort}${HARNESS_PATH}`
    await waitForHttp(harnessBase, 30_000).catch(error => {
      throw new Error(`${error.message}\nVite stderr:\n${vite.stderr()}`)
    })

    const chromiumPath = resolveChromium(args.chromium)
    chromium = await startChromium(chromiumPath, debugPort, tempProfile)
    const harnessUrl = `${harnessBase}?audioUrl=${encodeURIComponent(audioServer.url)}&sourceName=${encodeURIComponent(sourceName)}&mimeType=${encodeURIComponent(mimeTypeFor(audioPath))}`
    const target = await openTarget(debugPort, harnessUrl)
    if (!target.webSocketDebuggerUrl) throw new Error('Chromium target did not expose a DevTools WebSocket URL.')

    client = new CdpClient(target.webSocketDebuggerUrl)
    await client.connect()
    await client.send('Runtime.enable')
    await client.send('Page.enable')
    const result = await readBrowserResult(client, args.timeoutMs)
    const actualBytes = Buffer.from(result.canonicalJson, 'utf8')

    if (args.command === 'generate') {
      await mkdir(dirname(fixturePath), { recursive: true })
      await writeFile(fixturePath, actualBytes)
      process.stdout.write(`[browser-golden] wrote ${actualBytes.length} bytes to ${fixturePath}\n`)
    } else {
      if (!existsSync(fixturePath)) throw new Error(`Golden fixture does not exist: ${fixturePath}`)
      const expectedBytes = await readFile(fixturePath)
      const mismatch = firstByteMismatch(expectedBytes, actualBytes)
      if (mismatch !== -1) {
        throw new Error([
          `Golden fixture mismatch at byte ${mismatch}.`,
          `Expected bytes: ${expectedBytes.length}`,
          `Actual bytes:   ${actualBytes.length}`,
          `Expected context: ${mismatchContext(expectedBytes, mismatch)}`,
          `Actual context:   ${mismatchContext(actualBytes, mismatch)}`,
        ].join('\n'))
      }
      process.stdout.write(`[browser-golden] verified ${actualBytes.length} identical UTF-8 bytes\n`)
    }

    process.stdout.write(`[browser-golden] Chromium runtime: ${result.runtime?.userAgent || 'unknown'}\n`)
    process.stdout.write(`[browser-golden] AudioContext sample rate: ${result.runtime?.audioContextSampleRate || 'unknown'} Hz\n`)
    return result
  } finally {
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

runBrowserFixture(args).catch(error => {
  process.stderr.write(`[browser-golden] ${error instanceof Error ? error.stack || error.message : String(error)}\n`)
  process.exitCode = 1
})
