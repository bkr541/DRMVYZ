import { expect, test } from '@playwright/test'
import { build } from 'vite'
import { resolve } from 'node:path'
import type { MorphRenderer } from '../../components/vyzualz/react/renderers/morph/MorphRenderer'
import { DEFAULT_CANVAS_MORPH_SETTINGS } from '../../components/vyzualz/react/renderers/morph/MorphSettings'

const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH

test.use({ video: 'off', trace: 'off', launchOptions: {
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  ...(systemChromium ? { executablePath: systemChromium } : {}),
} })

test('MORPH production renderer: distinct source-driven modes, bloom, motion, reconstruction and resize', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  // Bundle the actual renderer and its runtime dependencies, not an alternate shader demo.
  const result = await build({ configFile: false, publicDir: false, logLevel: 'error', build: {
    write: false, minify: false, lib: {
      entry: resolve('src/components/vyzualz/react/renderers/morph/MorphRenderer.ts'),
      formats: ['iife'], name: 'MorphTestRuntime',
    },
  } })
  const bundle = Array.isArray(result) ? result[0] : result
  if (!('output' in bundle)) throw new Error('Expected renderer bundle')
  const chunk = bundle.output.find(item => item.type === 'chunk')
  if (!chunk || chunk.type !== 'chunk') throw new Error('Missing renderer chunk')
  await page.setContent('<body style="background:black;margin:0"></body>')
  await page.addScriptTag({ content: chunk.code })
  const metrics = await page.evaluate(defaults => {
    const runtime = (window as unknown as { MorphTestRuntime: { MorphRenderer: typeof MorphRenderer } }).MorphTestRuntime
    const source = document.createElement('canvas'); source.width = 320; source.height = 180
    const ctx = source.getContext('2d')!
    ctx.fillStyle = '#ef351c'; ctx.fillRect(40, 55, 110, 52)
    ctx.fillStyle = '#fff0cc'; ctx.fillRect(151, 40, 20, 100)
    ctx.fillStyle = '#384dff'; ctx.fillRect(185, 65, 90, 44)
    const output = document.createElement('canvas'); document.body.append(output)
    const renderer = runtime.MorphRenderer.create(output)
    const gl = output.getContext('webgl2')!
    const settings = { ...defaults, quality: 'low' as const }
    const transform = { scale: 1, positionX: 0, positionY: 0, rotation: 0 }
    const draw = (mode: number, amount: number, time: number, reset = false, glow = settings.glow, width = 320, height = 180, transition?: { fromMode: number; blend: number }) => {
      const ok = renderer.render({ source, settings: { ...settings, glow }, frame: { mode, amount, motion: time, hit: amount * .7, accent: .2, energy: .6, reset, delta: 1 / 60, paused: false, ...transition }, fitMode: 'contain', transform, viewport: { width, height }, dpr: 1 })
      if (!ok) throw new Error('No drawable frame')
      const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      if (gl.getError() !== gl.NO_ERROR) throw new Error('Pixel readback failed')
      return pixels
    }
    const difference = (a: Uint8Array, b: Uint8Array) => a.reduce((n, v, i) => n + Math.abs(v - b[i]), 0) / a.length
    const lit = (a: Uint8Array) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.max(a[i], a[i+1], a[i+2]) > 25) n++; return n }
    const clean = draw(0, 0, 0, true)
    const outputs: Uint8Array[] = [], captures: string[] = []
    for (let mode = 0; mode < 3; mode++) {
      draw(mode, .82, 0, true)
      for (let i = 1; i < 12; i++) draw(mode, .82, i / 30)
      outputs.push(draw(mode, .82, .4)); captures.push(output.toDataURL('image/png'))
    }
    const later = draw(2, .82, 1.8)
    const unlit = draw(0, .7, .5, true, 0)
    const glowing = draw(0, .7, .5, true, .9)
    const recovered = draw(0, 0, 1.9, true)
    const tunnel = draw(2, .82, .4, true, .5)
    const blended = draw(2, .82, .4, true, .5, 320, 180, { fromMode: 0, blend: .5 })
    const resized = draw(1, .8, 2, true, .5, 400, 240)
    const size = [output.width, output.height]
    renderer.dispose()
    return { lit: outputs.map(lit), distinct: [difference(outputs[0], outputs[1]), difference(outputs[1], outputs[2]), difference(outputs[0], clean)], motion: difference(outputs[2], later), bloom: difference(unlit, glowing), recovery: difference(clean, recovered), transition: difference(tunnel, blended), resized: lit(resized), size, captures }
  }, DEFAULT_CANVAS_MORPH_SETTINGS)
  for (const [index, name] of ['smear', 'halftone', 'droste'].entries()) {
    await testInfo.attach(name, { body: Buffer.from(metrics.captures[index].split(',')[1], 'base64'), contentType: 'image/png' })
  }
  expect(metrics.lit.every(n => n > 1000)).toBe(true)
  expect(metrics.distinct.every(n => n > 2)).toBe(true)
  expect(metrics.motion).toBeGreaterThan(2)
  expect(metrics.bloom).toBeGreaterThan(.1)
  expect(metrics.recovery).toBeLessThan(.1)
  expect(metrics.transition).toBeGreaterThan(2)
  expect(metrics.resized).toBeGreaterThan(1000)
  expect(metrics.size).toEqual([400, 240])
})
