/* global window, document */
// Verifies the Auto Performance lock in the real Inspector (Ifrit's production harness): what is disabled, what stays editable,
// that nothing changes size or position when it turns on or off, and that turning it off restores everything.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const output = path.resolve('artifacts/cinema2-lock')
const port = 47000 + process.pid % 1000
const url = `http://127.0.0.1:${port}/src/test/browser/cinema2-ifrit-production.html?enhancements=off`
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] })
let serverLog = '', browser
server.stdout.on('data', value => { serverLog += value })
server.stderr.on('data', value => { serverLog += value })
const errors = []

try {
  await mkdir(output, { recursive: true })
  let ready = false
  for (let attempt = 0; attempt < 200; attempt++) {
    if (server.exitCode != null) throw new Error(serverLog)
    try { if ((await fetch(url)).ok) { ready = true; break } } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert(ready, serverLog || 'review server did not start')
  browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] })
  const page = await browser.newPage({ viewport: { width: 1000, height: 1400 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(url)
  await page.waitForFunction(() => !!window.__ifritProduction)
  const api = (method, ...args) => page.evaluate(({ method, args }) => window.__ifritProduction[method](...args), { method, args })
  await api('reset')
  await api('showInspector', true)
  await page.waitForSelector('#ifrit-inspector .rv-ctrl-row', { timeout: 20000 })

  // Everything the Inspector shows: each control element, its state, and its exact place and size.
  const snapshot = () => page.evaluate(() => {
    const host = document.querySelector('#ifrit-inspector')
    const controls = [...host.querySelectorAll('input, select, button, textarea')].map(el => {
      const r = el.getBoundingClientRect()
      const row = el.closest('.rv-ctrl-row, .rv-ctrl-toggle-row, .rv-ctrl-group') ?? el
      const parent = el.closest('[data-cinema2-parent-group]')
      const text = (el.getAttribute('aria-label') || row.textContent || '').trim().slice(0, 60)
      return { tag: el.tagName, type: el.getAttribute('type'), id: el.id, label: text, disabled: el.disabled, cls: String(el.className).slice(0, 60), aria: el.getAttribute('aria-controls') ?? el.getAttribute('aria-expanded'), text: (el.textContent || '').trim().slice(0, 24), header: /drc-header|collapsible-hdr/.test(String(el.className)), top: Math.round(r.top * 100) / 100, left: Math.round(r.left * 100) / 100, w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100, group: parent?.getAttribute('data-cinema2-parent-group') ?? '' }
    })
    return { controls, scrollHeight: host.scrollHeight, text: host.textContent, locked: host.querySelectorAll('[data-auto-performance-locked]').length }
  })
  await page.screenshot({ path: path.join(output, 'inspector-off.png') })
  const off = await snapshot()
  await api('set', { 'auto-performance': true })
  await page.waitForTimeout(400)
  const on = await snapshot()
  await page.screenshot({ path: path.join(output, 'inspector-on.png') })
  await api('set', { 'auto-performance': false })
  await page.waitForTimeout(400)
  const back = await snapshot()

  const key = c => `${c.tag}:${c.type}:${c.id}`
  assert(off.controls.length > 25, `the Inspector shows its controls (${off.controls.length})`)
  assert.equal(on.controls.length, off.controls.length, 'locking adds and removes no control')
  // No size or position changes anywhere, and no extra text.
  for (let i = 0; i < off.controls.length; i++) {
    const a = off.controls[i], b = on.controls[i]
    assert.equal(key(a), key(b))
    assert.deepEqual([a.top, a.left, a.w, a.h], [b.top, b.left, b.w, b.h], `${a.label}: position and size unchanged by the lock`)
  }
  assert.equal(on.scrollHeight, off.scrollHeight, 'the panel is exactly the same height locked or not')
  assert.equal(on.text, off.text, 'no text appears or disappears')
  assert(on.locked > 12, `controls are wrapped as locked (${on.locked})`)
  assert.equal(off.locked, 0)

  // What is disabled, by label.
  const editable = on.controls.filter(c => !c.disabled)
  const names = editable.map(c => `${c.label}`).join(' | ')
  const lockedNow = on.controls.filter(c => c.disabled)
  assert(lockedNow.length > 15, `Design and Effects controls are disabled (${lockedNow.length})`)
  const master = on.controls.filter(c => c.group === 'master-controls')
  const isBpm = c => /^BPM Sync/.test(c.label), isAuto = c => /^Auto Performance/.test(c.label), isReset = c => /Reset Parameters/.test(c.label)
  assert(master.some(isBpm) && master.filter(isBpm).every(c => !c.disabled), 'BPM Sync stays editable')
  assert(master.some(isAuto) && master.filter(isAuto).every(c => !c.disabled), 'Auto Performance stays editable')
  assert(master.filter(c => !isBpm(c) && !isAuto(c)).every(c => c.disabled), 'every other Master Controls control is disabled')
  const open = on.controls.filter(c => (c.group === 'design' || c.group === 'effects') && !c.header && !c.disabled)
  assert.equal(open.length, 0, `every Design and Effects control is disabled; still editable: ${JSON.stringify(open.map(c => [c.tag, c.cls, c.aria, c.text]))}`)
  const disabledHeaders = on.controls.filter(c => c.header && c.disabled)
  assert.equal(disabledHeaders.length, 0, `group headers still open and close: ${JSON.stringify(disabledHeaders.map(c => [c.tag, c.type, c.label, c.group]))}`)
  assert(on.controls.filter(isReset).every(c => c.disabled) && on.controls.some(isReset), 'Reset Parameters is disabled while locked')
  const palette = on.controls.filter(c => c.group === 'palette')
  assert(palette.length >= 4 && palette.every(c => !c.disabled), `all Palette colors stay editable (${palette.length})`)
  assert(on.controls.filter(c => c.tag === 'INPUT' && c.type === 'range').every(c => c.disabled), 'every slider is disabled')
  assert(on.controls.filter(c => c.tag === 'SELECT').every(c => c.disabled), 'every dropdown is disabled')
  assert.equal(JSON.stringify(back.controls), JSON.stringify(off.controls), 'turning Auto Performance off restores every control exactly')
  assert.equal(back.locked, 0)
  assert.deepEqual(errors, [])
  await api('dispose')
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ controls: off.controls.length, lockedWhenOn: lockedNow.length, editableWhenOn: editable.map(c => c.label), paletteColors: palette.length, scrollHeight: on.scrollHeight }, null, 2))
  console.log(`Auto Performance lock verified in the real Inspector: ${lockedNow.length} of ${on.controls.length} controls disabled, ${palette.length} palette colors editable, nothing moved. Editable while locked: ${names}`)
} finally {
  await browser?.close()
  server.kill()
}
