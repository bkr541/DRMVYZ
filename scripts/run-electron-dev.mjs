import { spawn, execFileSync } from 'node:child_process'
import { constants, cpSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const stockElectronBinary = require('electron')
const electronVersion = require('electron/package.json').version
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const devUrl = process.env.DRMVYZ_VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'
const children = new Map()
let shuttingDown = false

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

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(0, `supervisor received ${signal}`))
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
