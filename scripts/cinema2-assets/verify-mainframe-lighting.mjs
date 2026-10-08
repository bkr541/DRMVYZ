#!/usr/bin/env node
// Pixel-level regression: verifies six isolated Mainframe emitters with no audio.
// Requires the normal dev dependencies (Vite + @playwright/test) and Chromium.
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const root = resolve(import.meta.dirname, '../..')
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
const families = ['circuits', 'radars', 'chips', 'terminals', 'indicators', 'logo']
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, clearScreen: false })
let browser
try {
  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('No Vite port for Mainframe diagnostic.')
  browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'] })
  const baseUrl = `http://127.0.0.1:${address.port}/src/test/browser/cinema2-mainframe-production.html`

  async function capture(family) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => {
      if (message.type() === 'error' && /shader|WebGLProgram|compile|link/i.test(message.text())) errors.push(message.text())
    })
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('quality', 'high')
      url.searchParams.set('timeSec', '0')
      url.searchParams.set('mainframeNoAudio', '1')
      if (family) url.searchParams.set('mainframeLightingDiagnostic', family)
      await page.goto(url.href, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => Boolean(globalThis.__mainframeProduction), undefined, { timeout: 30_000 })
      const status = await page.evaluate(() => globalThis.__mainframeProduction.prepare())
      if (errors.length) throw new Error(`${family ?? 'inactive'}: ${errors.join('\n')}`)
      if (status.modules.failedModuleCount || status.effects.failedEffectCount || status.modules.modules.some(module => module.diagnostics.some(d => /SHADER|SCENE_BUILD/.test(d.code)))) {
        throw new Error(`${family ?? 'inactive'}: render diagnostics ${JSON.stringify(status.modules)}`)
      }
      const png = await page.locator('#mainframe-production').screenshot()
      // Decode the captured actual rendered pixels, not the semantic uniform state.
      return await page.evaluate(async data => {
        const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)], { type: 'image/png' }))
        const canvas = document.createElement('canvas')
        canvas.width = 256; canvas.height = 144
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) throw new Error('No 2D screenshot decode context.')
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        bitmap.close()
        return Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data)
      }, [...png])
    } finally {
      await page.close()
    }
  }

  const inactive = await capture(null)
  for (const family of families) {
    const lit = await capture(family)
    let brighterPixels = 0
    let peakIncrease = 0
    for (let index = 0; index < lit.length; index += 4) {
      const increase = Math.max(lit[index] - inactive[index], lit[index + 1] - inactive[index + 1], lit[index + 2] - inactive[index + 2])
      if (increase > 15) brighterPixels++
      peakIncrease = Math.max(peakIncrease, increase)
    }
    console.log(`${family}: ${brighterPixels} visibly brighter pixels (256×144), peak Δ ${peakIncrease}`)
    if (brighterPixels < 8 || peakIncrease < 28) {
      throw new Error(`${family}: no meaningful rendered illumination compared with audio-free inactive Mainframe.`)
    }
  }
  console.log('Mainframe lighting: all six families produce independent, visible pixels without audio.')
} finally {
  await browser?.close()
  await server.close()
}
