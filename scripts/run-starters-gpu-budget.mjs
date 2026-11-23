/* global window */
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

// GPU budget for the Starters preset. It was once a ray-marcher that took about 120 ms a frame (7x over a 60 fps frame) because it evaluated the whole woodland on every
// march step and marched the flat ground; the app slowed to 8 fps and the cast stream with it. This renders the real renderer on a real GPU through Metal/ANGLE at
// the preset's full render size, and fails if any scenario's frame time passes the budget. Software WebGL (SwiftShader) has no meaningful GPU time, so there it only
// checks that every scenario draws and then reports that the budget was not measured. Needs a Vite server for the project root (PLAYWRIGHT_BASE_URL, default
// http://127.0.0.1:5174).
const W = Number(process.env.STARTERS_BUDGET_WIDTH ?? 1157), H = Number(process.env.STARTERS_BUDGET_HEIGHT ?? 767)
const BUDGET_MS = Number(process.env.STARTERS_BUDGET_MS ?? 12)
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] })
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174'}/src/test/browser/starters-gpu-budget.html`)
  await page.waitForFunction(() => window.__startersBudget, {}, { timeout: 120000 })
  const gpu = await page.evaluate(() => window.__startersBudget.gpu())
  const software = /swiftshader|llvmpipe|software/i.test(gpu)
  const scenarios = await page.evaluate(() => window.__startersBudget.scenarios)
  console.log(`GPU: ${gpu}\nSize: ${W}x${H}, budget ${BUDGET_MS} ms a frame${software ? ' (not enforced: software rendering)' : ''}`)
  const failures = []
  for (const scenario of scenarios) {
    const result = await page.evaluate(([name, w, h, frames]) => window.__startersBudget.run(name, w, h, frames), [scenario, W, H, software ? 1 : 9])
    console.log(`  ${scenario.padEnd(8)} ${result.ms.toFixed(1).padStart(6)} ms   lit pixels ${(result.litShare * 100).toFixed(0)}%`)
    assert(result.litShare > 0.5, `${scenario}: the frame is mostly black (${(result.litShare * 100).toFixed(1)}% lit)`)
    if (!software && result.ms > BUDGET_MS) failures.push(`${scenario}: ${result.ms.toFixed(1)} ms is over the ${BUDGET_MS} ms budget`)
  }
  assert.deepEqual(errors, [], `page errors: ${errors.join('; ')}`)
  assert.equal(failures.length, 0, failures.join('\n'))
  console.log(software ? 'Drew every scenario; the GPU budget was not measured (no real GPU).' : 'Within budget.')
} finally {
  await browser.close()
}
