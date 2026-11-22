/* global window, document */
import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

// Real-browser check of the review notes button and panel (development only): the floating button sits at the bottom right of the visualizer, a typed note is
// written to .review-notes/ with its screenshot, typing never reaches the app's shortcuts, and notes can be marked done and deleted. Needs a Vite dev server for
// the project root (PLAYWRIGHT_BASE_URL, default http://127.0.0.1:5174). It writes under .review-notes/ (git-ignored) with a fixture preset id and cleans up after.
const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174'
const notesDir = '.review-notes'
const fileName = 'cinema2__review-notes-fixture.md'
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] })
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } })
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(`${base}/src/test/browser/review-notes.html`)
  const fab = page.getByRole('button', { name: /^Review notes/ })
  await fab.waitFor({ timeout: 60000 })
  // Bottom right of the visualizer (the 1280x720 stand-in), clear of its edges.
  const wrap = await page.locator('#wrap').boundingBox(), box = await fab.boundingBox()
  assert(box.x + box.width <= wrap.x + wrap.width - 4 && box.x + box.width > wrap.x + wrap.width - 70, `button is at the right edge (${JSON.stringify(box)})`)
  assert(box.y + box.height <= wrap.y + wrap.height - 4 && box.y + box.height > wrap.y + wrap.height - 70, 'button is at the bottom edge')
  await page.screenshot({ path: 'artifacts/review-notes-closed.png' }).catch(() => {})

  await fab.click()
  const note = page.getByRole('textbox', { name: 'Note' })
  await note.waitFor()
  assert(await note.evaluate(node => node === document.activeElement), 'the note box has focus when the panel opens')
  const spaceBefore = await page.evaluate(() => window.__reviewNotesFixture.shortcuts.space)
  await note.type('The core needs to rotate faster. Also the dust is too faint.')
  assert.equal(await page.evaluate(() => window.__reviewNotesFixture.shortcuts.space), spaceBefore, 'typing spaces in the note does not trigger the app shortcut')
  const save = page.getByRole('button', { name: 'Save note' })
  assert(await save.isEnabled())

  // Attach a screenshot: a thumbnail of a real, non-blank WebGL frame appears.
  await page.getByLabel('Attach a screenshot of the current frame').check()
  const preview = page.getByAltText('Screenshot that will be attached')
  await preview.waitFor()
  const previewSource = await preview.getAttribute('src')
  const previewPixels = await sharp(Buffer.from(previewSource.split(',')[1], 'base64')).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  assert.equal(previewPixels.info.width, 1280)
  let colour = 0; for (let i = 0; i < previewPixels.data.length; i += 3) colour += previewPixels.data[i] + previewPixels.data[i + 1] + previewPixels.data[i + 2]
  assert(colour / (previewPixels.data.length / 3) > 20, 'the screenshot is the drawn frame, not a blank canvas')
  await page.screenshot({ path: 'artifacts/review-notes-open.png' }).catch(() => {})

  await note.press('Control+Enter')
  await page.locator('.rn-note').first().waitFor()
  assert.equal(await note.inputValue(), '', 'the box clears after saving')
  assert.equal(await page.locator('.rn-note').count(), 1)
  assert(await page.locator('.rn-badge').textContent() === '1', 'the button shows one open note')

  // On disk: one file for the preset, the note text, the context, and a PNG beside it.
  const markdown = await readFile(join(notesDir, fileName), 'utf8')
  assert(markdown.includes('The core needs to rotate faster. Also the dust is too faint.'))
  assert(markdown.includes('Context: playing, 123 BPM, canvas 1280x720'))
  const shotPath = /Screenshot: `([^`]+)`/.exec(markdown)?.[1]
  assert(shotPath, 'the note records its screenshot path')
  const png = await sharp(await readFile(shotPath)).metadata()
  assert.equal(png.format, 'png'); assert.equal(png.width, 1280)
  assert((await readFile(join(notesDir, 'INDEX.md'), 'utf8')).includes('Fixture Preset — 1 open'))

  // A second note with no screenshot; both survive a reload (they come from the file).
  await note.fill('Second thought: the camera sways too far.')
  await save.click()
  await page.waitForFunction(() => document.querySelectorAll('.rn-note').length === 2)
  await page.reload(); await fab.waitFor(); await fab.click()
  await page.waitForFunction(() => document.querySelectorAll('.rn-note').length === 2)
  assert.equal(await page.locator('.rn-thumb').count(), 1, 'only the first note has a screenshot thumbnail')

  // Mark done, reopen, delete.
  await page.getByRole('button', { name: 'Mark done' }).first().click()
  await page.waitForFunction(() => document.querySelectorAll('.rn-note[data-status="done"]').length === 1)
  assert((await readFile(join(notesDir, fileName), 'utf8')).includes('1 open, 1 done'))
  await page.getByRole('button', { name: 'Reopen' }).click()
  await page.waitForFunction(() => document.querySelectorAll('.rn-note[data-status="open"]').length === 2)
  await page.screenshot({ path: 'artifacts/review-notes-list.png' }).catch(() => {})
  await page.getByRole('button', { name: 'Delete' }).first().click(); await page.getByRole('button', { name: 'Delete' }).first().click()
  await page.waitForFunction(() => document.querySelectorAll('.rn-note').length === 0)
  await assert.rejects(stat(join(notesDir, fileName)), 'the file is removed with its last note')
  await assert.rejects(stat(shotPath), 'the screenshot is removed with its note')

  // Not reachable without the header.
  const blocked = await page.evaluate(() => fetch('/__review-notes/notes?engine=cinema2&presetId=x').then(r => r.status))
  assert.equal(blocked, 403)
  assert.deepEqual(errors, [], 'no page errors')
  console.log('PASS review notes: button at the visualizer corner, typing isolated from shortcuts, note + screenshot on disk, reload, done/reopen/delete')
} finally {
  await browser.close()
  const left = await readdir(notesDir).catch(() => [])
  if (left.includes(fileName)) console.error(`left behind: ${fileName}`)
}
