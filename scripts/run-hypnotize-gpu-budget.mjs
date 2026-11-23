/* global window */
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

// GPU and CPU budget for the Hypnotize ring tunnel. The first Hypnotize was a Three.js scene of about 600 meshes with a material per LED: it cost 18 ms of CPU a frame and ran at 53 fps
// at Low quality. This renders the real renderer on a real GPU through Metal/ANGLE at the preset's full render size, for every pattern and every music scenario, and fails if the draw
// or the per-frame animation passes its budget. Software WebGL (SwiftShader) has no meaningful GPU time, so there it checks that every case draws and reports that the budget was
// not measured. Needs a Vite server for the project root (PLAYWRIGHT_BASE_URL, default http://127.0.0.1:5174).
const W = Number(process.env.HYPNOTIZE_BUDGET_WIDTH ?? 1637), H = Number(process.env.HYPNOTIZE_BUDGET_HEIGHT ?? 876)
const GPU_BUDGET_MS = Number(process.env.HYPNOTIZE_BUDGET_MS ?? 4)
const CPU_BUDGET_MS = Number(process.env.HYPNOTIZE_CPU_BUDGET_MS ?? 0.5)
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] })
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174'}/src/test/browser/hypnotize-gpu-budget.html`)
  await page.waitForFunction(() => window.__hypnotizeBudget, {}, { timeout: 120000 })
  const gpu = await page.evaluate(() => window.__hypnotizeBudget.gpu())
  const software = /swiftshader|llvmpipe|software/i.test(gpu)
  const { patterns, scenarios } = await page.evaluate(() => ({ patterns: window.__hypnotizeBudget.patterns, scenarios: window.__hypnotizeBudget.scenarios }))
  console.log(`GPU: ${gpu}\nSize: ${W}x${H}, budgets ${GPU_BUDGET_MS} ms draw and ${CPU_BUDGET_MS} ms animation per frame${software ? ' (not enforced: software rendering)' : ''}`)
  const failures = []
  for (const pattern of patterns) {
    for (const scenario of scenarios) {
      const result = await page.evaluate(([p, s, w, h, frames]) => window.__hypnotizeBudget.run(p, s, w, h, frames), [pattern, scenario, W, H, software ? 1 : 15])
      console.log(`  ${pattern.padEnd(16)} ${scenario.padEnd(6)} draw ${result.ms.toFixed(2).padStart(6)} ms   animation ${result.cpuMs.toFixed(3).padStart(6)} ms   lit pixels ${(result.litShare * 100).toFixed(0)}%`)
      assert(result.litShare > 0.02, `${pattern}/${scenario}: the frame is black (${(result.litShare * 100).toFixed(2)}% lit)`)
      if (!software && result.ms > GPU_BUDGET_MS) failures.push(`${pattern}/${scenario}: the draw takes ${result.ms.toFixed(2)} ms, over the ${GPU_BUDGET_MS} ms budget`)
      if (!software && result.cpuMs > CPU_BUDGET_MS) failures.push(`${pattern}/${scenario}: the animation takes ${result.cpuMs.toFixed(3)} ms of CPU, over the ${CPU_BUDGET_MS} ms budget`)
    }
  }
  assert.deepEqual(errors, [], `page errors: ${errors.join('; ')}`)
  assert.equal(failures.length, 0, failures.join('\n'))
  console.log(software ? 'Drew every case; the budgets were not measured (no real GPU).' : 'Within budget.')
} finally {
  await browser.close()
}
