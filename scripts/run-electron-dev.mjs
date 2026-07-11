import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const electronBinary = require('electron')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const devUrl = process.env.DRMVYZ_VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'
const children = new Set()
let shuttingDown = false

function spawnChild(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    ...options,
  })
  children.add(child)
  child.once('exit', () => children.delete(child))
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

function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
  setTimeout(() => process.exit(exitCode), 250).unref()
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(0))
}

const vite = spawnChild(npmCommand, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'])
vite.once('exit', code => {
  if (!shuttingDown) shutdown(code || 1)
})

try {
  await waitForDevServer(devUrl)
  const electron = spawnChild(electronBinary, ['.'], {
    env: {
      ...process.env,
      DRMVYZ_VITE_DEV_SERVER_URL: devUrl,
    },
  })
  electron.once('exit', code => shutdown(code || 0))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  shutdown(1)
}
