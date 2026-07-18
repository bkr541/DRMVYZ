import { closeSync, existsSync, openSync, readFileSync } from 'node:fs'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

const root = process.cwd()
const output = path.join(root, 'artifacts/show-director-webgl-visual-review')
const runtimeOutput = path.join(output, '.runtime')
const esbuildCli = path.join(root, 'node_modules/esbuild/bin/esbuild')
const playwrightCli = path.join(root, 'node_modules/@playwright/test/cli.js')
const systemChromium = ['/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync)
const managedXvfbAvailable = process.platform === 'linux' && existsSync('/usr/bin/Xvfb')
const useHeadlessWebGL = process.env.DRMVYZ_WEBGL_HEADLESS === '1' || !managedXvfbAvailable
const visualRunId = randomUUID()
const baseEnv = {
  ...process.env,
  DRMVYZ_SHOW_DIRECTOR_WEBGL_VISUAL: '1',
  DRMVYZ_WEBGL_HEADLESS: useHeadlessWebGL ? '1' : '0',
  DRMVYZ_WEBGL_VISUAL_RUN_ID: visualRunId,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? {}
    : systemChromium ? { PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: systemChromium } : {}),
}

function stopProcessGroup(child, signal = 'SIGTERM') {
  if (child?.pid == null) return
  try {
    if (process.platform !== 'win32') process.kill(-child.pid, signal)
    else child.kill(signal)
  } catch {
    // The process tree may have already exited between inspection and signal.
  }
}

function processGroupAlive(child) {
  if (child?.pid == null || process.platform === 'win32') return child?.exitCode == null
  try {
    process.kill(-child.pid, 0)
    return true
  } catch {
    return false
  }
}

function terminateProcessGroup(child) {
  if (!child || !processGroupAlive(child)) return
  stopProcessGroup(child, 'SIGTERM')
  stopProcessGroup(child, 'SIGKILL')
}

async function run(command, args, timeoutMs = 240_000, env = baseEnv) {
  const detached = process.platform !== 'win32'
  const child = spawn(command, args, {
    cwd: root,
    env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
    detached,
  })
  const exitPromise = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve({ code, signal }))
  })
  const timeoutPromise = new Promise((_, reject) => {
    const timer = setTimeout(() => {
      stopProcessGroup(child, 'SIGTERM')
      setTimeout(() => stopProcessGroup(child, 'SIGKILL'), 2_000).unref()
      child.unref()
      reject(new Error(`${command} ${args.join(' ')} timed out after ${timeoutMs}ms; its process group was terminated.`))
    }, timeoutMs)
    timer.unref()
    exitPromise.finally(() => clearTimeout(timer)).catch(() => {})
  })
  const status = await Promise.race([exitPromise, timeoutPromise])
  terminateProcessGroup(child)
  if (status.code !== 0) throw new Error(`${command} exited with status ${status.code ?? status.signal ?? 'unknown'}`)
}

function waitForFinalVisualReport(logPath, timeoutMs = 360_000) {
  const reportPath = path.join(output, 'report.json')
  const startedAt = Date.now()
  const sleepState = new Int32Array(new SharedArrayBuffer(4))
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const report = JSON.parse(readFileSync(reportPath, 'utf8'))
      if (report.generatedBy === 'npm run visual:show-director:webgl' && report.runId === visualRunId) return report
    } catch {
      // The test writes report.json at the end of its assertions.
    }
    try {
      const log = readFileSync(logPath, 'utf8')
      if (/(?:^|\n)\s*\d+\s+(?:failed|skipped)\s*\([^\n]+\)/.test(log)) {
        throw new Error(`Playwright visual validation did not pass.\n${log}`)
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Playwright visual validation did not pass.')) throw error
    }
    Atomics.wait(sleepState, 0, 0, 250)
  }
  let log = ''
  try { log = readFileSync(logPath, 'utf8') } catch { /* no log available */ }
  throw new Error(`Playwright visual validation did not publish its final report within ${timeoutMs}ms.\n${log}`)
}

async function runPlaywrightVisual(env) {
  const args = [playwrightCli, 'test', 'src/test/e2e/showDirectorWebGLVisual.spec.ts', '--project=chromium']
  const logPath = path.join(runtimeOutput, 'playwright.log')
  const logFd = openSync(logPath, 'w')
  const child = spawn(process.execPath, args, {
    cwd: root,
    env,
    shell: process.platform === 'win32',
    stdio: ['ignore', logFd, logFd],
    detached: process.platform !== 'win32',
  })
  closeSync(logFd)
  if (child.pid == null) throw new Error('Playwright visual validation did not start.')
  try {
    return waitForFinalVisualReport(logPath)
  } finally {
    terminateProcessGroup(child)
    try {
      process.stdout.write(readFileSync(logPath, 'utf8'))
    } catch {
      // A spawn failure may occur before the log file is readable.
    }
  }
}

async function stopManagedXvfb(xvfb) {
  terminateProcessGroup(xvfb?.child)
}

async function assertVisualReport() {
  const reportPath = path.join(output, 'report.json')
  const report = JSON.parse(await readFile(reportPath, 'utf8'))
  if (report.runId !== visualRunId) throw new Error('LaserDMX WebGL validation report came from a stale runner instance.')
  const failedFrames = (report.frames ?? []).filter(frame => frame.validationStatus !== 'passed')
  if (report.status !== 'pass' || (report.missingReferenceSceneIds ?? []).length > 0 || failedFrames.length > 0) {
    throw new Error(
      `LaserDMX WebGL validation report failed: status=${report.status ?? 'missing'}, ` +
      `missing=${(report.missingReferenceSceneIds ?? []).join(',') || 'none'}, ` +
      `failedFrames=${failedFrames.map(frame => frame.id).join(',') || 'none'}`,
    )
  }
}

async function startManagedXvfb() {
  if (!managedXvfbAvailable || useHeadlessWebGL) return null
  let displayNumber = 91 + (process.pid % 80)
  while (existsSync(`/tmp/.X11-unix/X${displayNumber}`)) displayNumber += 1
  const display = `:${displayNumber}`
  const child = spawn('/usr/bin/Xvfb', [display, '-screen', '0', '1280x720x24', '-nolisten', 'tcp', '-noreset'], {
    cwd: root,
    env: baseEnv,
    stdio: 'ignore',
    detached: true,
  })
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 500)
    child.once('error', error => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('exit', code => {
      if (code != null && code !== 0) {
        clearTimeout(timer)
        reject(new Error(`Managed Xvfb exited during startup with status ${code}`))
      }
    })
  })
  if (child.exitCode != null) throw new Error(`Managed Xvfb exited during startup with status ${child.exitCode}`)
  return { child, display }
}

await rm(output, { recursive: true, force: true })
await mkdir(runtimeOutput, { recursive: true })
let xvfb = null

try {
  await run(esbuildCli, [
    'scripts/show-director-webgl-visual-review-page.ts',
    '--bundle',
    '--format=iife',
    '--platform=browser',
    '--define:import.meta.env={}',
    `--outfile=${path.join(runtimeOutput, 'showDirectorWebGLVisualReview.bundle.js')}`,
  ], 60_000)
  xvfb = await startManagedXvfb()
  const visualEnv = xvfb ? { ...baseEnv, DISPLAY: xvfb.display } : baseEnv
  await runPlaywrightVisual(visualEnv)
  await assertVisualReport()
  console.log(`LaserDMX WebGL validation frames: ${output}`)
} finally {
  await stopManagedXvfb(xvfb)
  await rm(runtimeOutput, { recursive: true, force: true })
}
