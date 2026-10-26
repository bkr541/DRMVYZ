import { spawn, execFileSync } from 'node:child_process'
import { constants, cpSync, existsSync, mkdirSync, realpathSync, renameSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const stockElectronBinary = require('electron')
const electronVersion = require('electron/package.json').version
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const devUrl = process.env.DRMVYZ_VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'
const devPort = Number(new URL(devUrl).port || 5173)
const repoRoot = realpathSync(process.cwd())
const electronCacheRoot = path.join(repoRoot, 'node_modules', '.cache', 'drmvyz-electron')
const children = new Map()
let shuttingDown = false

function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    // lsof exits non-zero when nothing matches.
    return ''
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function stopProcesses(pids, timeoutMs = 5_000) {
  for (const pid of pids) {
    try { process.kill(pid, 'SIGTERM') } catch { /* already gone */ }
  }
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline && pids.some(isAlive)) await new Promise(resolve => setTimeout(resolve, 100))
  for (const pid of pids.filter(isAlive)) {
    try { process.kill(pid, 'SIGKILL') } catch { /* already gone */ }
  }
}

/**
 * Stops a dev server and Electron shell left over from an earlier run of THIS repository, so a relaunch works.
 * A process is only touched when it provably belongs here: Vite must be listening on the dev port with this
 * repository as its working directory, and Electron must run from this repository's isolated DRMVYZ shell.
 * Other applications' Vite or Electron processes are never stopped; if one owns the port, startup fails with its details.
 */
async function clearStaleRepoProcesses() {
  if (process.platform === 'win32') return

  const electronPids = run('ps', ['-axo', 'pid=,command='])
    .split('\n')
    .map(line => /^\s*(\d+)\s+(.*)$/.exec(line))
    .filter(match => match && Number(match[1]) !== process.pid && match[2].includes(electronCacheRoot))
    .map(match => Number(match[1]))
  if (electronPids.length) {
    console.error(`[electron:dev] Stopping ${electronPids.length} Electron process(es) left over from a previous DRMVYZ run.`)
    await stopProcesses(electronPids)
  }

  const listeners = run('lsof', ['-nP', `-iTCP:${devPort}`, '-sTCP:LISTEN', '-t']).split('\n').map(Number).filter(Boolean)
  const owned = []
  const foreign = []
  for (const pid of new Set(listeners)) {
    const cwd = /^n(.+)$/m.exec(run('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn']))?.[1]
    const command = run('ps', ['-o', 'command=', '-p', String(pid)]).trim()
    let sameRepo = false
    try { sameRepo = Boolean(cwd) && realpathSync(cwd) === repoRoot } catch { /* cwd vanished */ }
    ;(sameRepo && /\bvite\b/.test(command) ? owned : foreign).push({ pid, cwd, command })
  }
  if (foreign.length) {
    const details = foreign.map(item => `  pid ${item.pid} in ${item.cwd ?? 'unknown directory'}: ${item.command}`).join('\n')
    throw new Error(`Port ${devPort} is in use by a process that is not this repository's Vite server, so it was left running:\n${details}`)
  }
  if (owned.length) {
    console.error(`[electron:dev] Stopping DRMVYZ Vite server left over on port ${devPort} (pid ${owned.map(item => item.pid).join(', ')}).`)
    await stopProcesses(owned.map(item => item.pid))
  }
}

function setPlistValue(plistPath, key, value) {
  execFileSync('/usr/bin/plutil', ['-replace', key, '-string', value, plistPath])
}

function resolveElectronBinary() {
  if (process.platform !== 'darwin') return stockElectronBinary

  // Electron's downloaded development shell identifies every project as
  // com.github.Electron. macOS can consequently treat unrelated dev apps as
  // the same application and terminate one when another launches. Use an APFS
  // clone with DRMVYZ-specific bundle identifiers while leaving node_modules'
  // stock Electron distribution untouched.
  const stockApp = path.dirname(path.dirname(path.dirname(stockElectronBinary)))
  const cacheRoot = path.join(process.cwd(), 'node_modules', '.cache', 'drmvyz-electron', electronVersion)
  const appPath = path.join(cacheRoot, 'DRMVYZ Dev.app')
  const binaryPath = path.join(appPath, 'Contents', 'MacOS', 'Electron')
  if (existsSync(binaryPath)) return binaryPath

  mkdirSync(cacheRoot, { recursive: true })
  const stagingPath = path.join(cacheRoot, `DRMVYZ Dev.app.preparing-${process.pid}`)
  rmSync(stagingPath, { recursive: true, force: true })
  console.error('[electron:dev] Preparing the isolated DRMVYZ macOS development shell...')
  cpSync(stockApp, stagingPath, {
    recursive: true,
    mode: constants.COPYFILE_FICLONE,
    verbatimSymlinks: true,
  })

  const bundleIds = new Map([
    ['Contents/Info.plist', 'com.dvydrm.drmvyz.dev'],
    ['Contents/Frameworks/Electron Helper.app/Contents/Info.plist', 'com.dvydrm.drmvyz.dev.helper'],
    ['Contents/Frameworks/Electron Helper (GPU).app/Contents/Info.plist', 'com.dvydrm.drmvyz.dev.helper.GPU'],
    ['Contents/Frameworks/Electron Helper (Plugin).app/Contents/Info.plist', 'com.dvydrm.drmvyz.dev.helper.Plugin'],
    ['Contents/Frameworks/Electron Helper (Renderer).app/Contents/Info.plist', 'com.dvydrm.drmvyz.dev.helper.Renderer'],
  ])
  for (const [relativePlistPath, bundleId] of bundleIds) {
    setPlistValue(path.join(stagingPath, relativePlistPath), 'CFBundleIdentifier', bundleId)
  }
  const mainPlist = path.join(stagingPath, 'Contents', 'Info.plist')
  setPlistValue(mainPlist, 'CFBundleName', 'DRMVYZ Dev')
  setPlistValue(mainPlist, 'CFBundleDisplayName', 'DRMVYZ Dev')

  rmSync(appPath, { recursive: true, force: true })
  renameSync(stagingPath, appPath)
  return binaryPath
}

function spawnChild(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    ...options,
  })
  children.set(child, name)
  child.once('exit', (code, signal) => {
    children.delete(child)
    console.error(`[electron:dev] ${name} exited (code=${code ?? 'none'}, signal=${signal ?? 'none'}).`)
  })
  return child
}

async function waitForDevServer(url, timeoutMs = 60_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      if (response.ok) return
    } catch {
      // Vite has not bound the port yet.
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Vite did not become reachable at ${url} within ${timeoutMs / 1000} seconds.`)
}

function shutdown(exitCode = 0, reason = 'shutdown requested') {
  if (shuttingDown) return
  shuttingDown = true
  console.error(`[electron:dev] ${reason}; stopping ${children.size} child process(es).`)
  for (const [child] of children) {
    if (child.killed) continue
    child.kill('SIGTERM')
  }
  setTimeout(() => process.exit(exitCode), 250).unref()
}

// SIGHUP is what closing the Terminal window sends; without it Vite is orphaned and keeps the port.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => shutdown(0, `supervisor received ${signal}`))
}
// Last resort if the supervisor exits any other way: never leave this run's children behind.
process.on('exit', () => {
  for (const [child] of children) {
    try { child.kill('SIGTERM') } catch { /* already gone */ }
  }
})

try {
  await clearStaleRepoProcesses()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

const vite = spawnChild('Vite', npmCommand, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'])
vite.once('exit', (code, signal) => {
  if (!shuttingDown) shutdown(code || 1, `Vite stopped unexpectedly (code=${code ?? 'none'}, signal=${signal ?? 'none'})`)
})

try {
  await waitForDevServer(devUrl)
  const electronBinary = resolveElectronBinary()
  const electron = spawnChild('Electron', electronBinary, ['.'], {
    env: {
      ...process.env,
      DRMVYZ_VITE_DEV_SERVER_URL: devUrl,
    },
  })
  electron.once('exit', (code, signal) => shutdown(code || 0, `Electron stopped (code=${code ?? 'none'}, signal=${signal ?? 'none'})`))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  shutdown(1, 'startup failed')
}
