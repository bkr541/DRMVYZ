/* global window, document */
import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

// Real-browser check of the app-level review notes (development only): the button sits in the middle of the header, a note belongs to the preset, the page or the whole
// app and has a type and an area, the "Screenshot this window" button captures the window (the WebGL canvas included, with what sits over it still over it, and
// without the notes panel), notes land in .review-notes/ and can be listed for the whole app, marked done and deleted. Needs a Vite dev server for the project root
// (PLAYWRIGHT_BASE_URL, default http://127.0.0.1:5174). It writes under .review-notes/ (git-ignored) with fixture ids and cleans up after.
const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174'
const files = { page: '.review-notes/app__review-notes-fixture-page.md', general: '.review-notes/app__general.md', preset: '.review-notes/cinema2__review-notes-fixture.md' }
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] })
const errors = []
const leftovers = async () => (await readdir('.review-notes').catch(() => [])).filter(name => /review-notes-fixture|app__general/.test(name))
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } })
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(`${base}/src/test/browser/review-notes.html`)
  const fab = page.getByRole('button', { name: /^Review notes/ })
  await fab.waitFor({ timeout: 60000 })

  // In the middle of the header.
  const header = await page.locator('#header').boundingBox(), box = await fab.boundingBox()
  assert(Math.abs(box.x + box.width / 2 - (header.x + header.width / 2)) < 4, `the button is at the horizontal middle of the header (${JSON.stringify(box)})`)
  assert(box.y >= header.y && box.y + box.height <= header.y + header.height, 'and inside the header')

  await fab.click()
  const note = page.getByRole('textbox', { name: 'Note' })
  await note.waitFor()
  assert(await note.evaluate(node => node === document.activeElement), 'the note box has focus when the panel opens')
  const places = () => page.locator('.rn-place').allTextContents()
  assert.deepEqual(await places(), ['This page: Fixture Page', 'The whole app'], 'with no preset on stage, a note is about the page or the whole app')
  assert(await page.getByRole('radio', { name: 'This page: Fixture Page' }).isChecked(), 'and the page is the default')

  // Typing never reaches the app's shortcuts.
  const spaceBefore = await page.evaluate(() => window.__reviewNotesFixture.shortcuts.space)
  await note.type('The upload modal loses its tags. Also the header is too tall.')
  assert.equal(await page.evaluate(() => window.__reviewNotesFixture.shortcuts.space), spaceBefore, 'typing spaces in the note does not trigger the app shortcut')
  await page.getByRole('radio', { name: 'Bug' }).click()
  await page.getByRole('textbox', { name: 'Area' }).fill('upload modal')

  // The screenshot button: the whole window, the canvas in it, the label still over it, and no notes panel.
  await page.getByRole('button', { name: 'Screenshot this window' }).click()
  const preview = page.getByAltText('Screenshot that will be attached')
  await preview.waitFor({ timeout: 60000 })
  const source = await preview.getAttribute('src')
  const image = await sharp(Buffer.from(source.split(',')[1], 'base64')).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  assert.equal(image.info.width, 1400); assert.equal(image.info.height, 800)
  const pixel = (x, y) => { const i = (y * image.info.width + x) * 3; return [...image.data.subarray(i, i + 3)] }
  const near = (actual, expected, label) => assert(actual.every((v, k) => Math.abs(v - expected[k]) <= 12), `${label}: ${actual} is not near ${expected}`)
  near(pixel(700, 20), [11, 16, 18], 'the header')
  near(pixel(24 + 400, 24 + 56 + 250), [230, 51, 26], 'the WebGL canvas is in the screenshot, not blank')
  near(pixel(24 + 20 + 4, 56 + 24 + 20 + 4), [0, 170, 68], 'the label that sits over the canvas is still over it')
  near(pixel(1000, 700), [18, 52, 86], 'the page behind')
  // The panel hangs from the button and is left out of the picture: where it is, the page shows through.
  const panel = await page.locator('.rn-panel').boundingBox()
  near(pixel(Math.round(panel.x + panel.width / 2), Math.round(panel.y + 40)), [18, 52, 86], 'the notes panel is not in the screenshot')
  await page.screenshot({ path: 'artifacts/review-notes-open.png' }).catch(() => {})

  await note.press('Control+Enter')
  await page.locator('.rn-note').first().waitFor()
  assert.equal(await note.inputValue(), '', 'the box clears after saving')
  assert.equal(await page.locator('.rn-kind').first().textContent(), 'Bug')
  const markdown = await readFile(files.page, 'utf8')
  assert(markdown.includes('The upload modal loses its tags.'))
  assert(markdown.includes('Type: Bug · Area: upload modal'))
  const shotPath = /Screenshot: `([^`]+)`/.exec(markdown)?.[1]
  assert(shotPath, 'the note records its screenshot path')
  const png = await sharp(await readFile(shotPath)).metadata()
  assert.equal(png.format, 'png'); assert.equal(png.width, 1400)

  // A note about the whole app, with no screenshot.
  await page.getByRole('radio', { name: 'The whole app' }).click()
  await page.getByRole('radio', { name: 'Gap' }).click()
  await note.fill('There is no way to export a show.')
  await page.getByRole('button', { name: 'Save note' }).click()
  await page.waitForFunction(() => document.querySelectorAll('.rn-note').length >= 1)
  assert((await readFile(files.general, 'utf8')).includes('Type: Gap'))

  // With a preset on stage the note can be about the preset, as before; Everything open lists all three places.
  await page.evaluate(() => window.__reviewNotesFixture.setScene(true))
  await page.waitForFunction(() => document.querySelectorAll('.rn-place').length === 3)
  assert.deepEqual(await places(), ['This preset: Fixture Preset', 'This page: Fixture Page', 'The whole app'])
  assert(await page.getByRole('radio', { name: 'This preset: Fixture Preset' }).isChecked(), 'with a preset on stage it is the default')
  await page.getByRole('radio', { name: 'Change' }).click()
  await note.fill('The preset needs more neon.')
  await page.getByRole('button', { name: 'Save note' }).click()
  await page.waitForFunction(() => document.querySelectorAll('.rn-note').length === 1)
  const presetMarkdown = await readFile(files.preset, 'utf8')
  assert(presetMarkdown.includes('Context: playing, 123 BPM'), 'a preset note carries the preset\'s settings')
  await page.getByRole('button', { name: /^Everything open/ }).click()
  await page.waitForFunction(() => document.querySelectorAll('.rn-note').length === 3)
  const where = await page.locator('.rn-where').allTextContents()
  assert(where.some(text => text.includes('Fixture Page (app)')) && where.some(text => text.includes('General (app)')) && where.some(text => text.includes('Fixture Preset')), `every place is named (${where})`)
  assert((await readFile('.review-notes/INDEX.md', 'utf8')).includes('[bug]'))
  assert.equal(await page.locator('.rn-badge').textContent(), '3', 'the header button counts every open note in the app')

  // Mark done, reopen, delete, across places.
  await page.getByRole('button', { name: 'Mark done' }).first().click()
  await page.waitForFunction(() => document.querySelectorAll('.rn-note').length === 2)
  await page.getByRole('button', { name: /^Everything open/ }).click()
  for (let left = 2; left > 0; left--) { await page.getByRole('button', { name: 'Mark done' }).first().click(); await page.waitForFunction(count => document.querySelectorAll('.rn-note').length === count, left - 1) }
  await page.getByRole('button', { name: /^Here/ }).click()
  while (await page.locator('.rn-note').count()) { await page.getByRole('button', { name: 'Delete' }).first().click(); await page.waitForTimeout(250) }
  await page.getByRole('radio', { name: 'This page: Fixture Page' }).click()
  while (await page.locator('.rn-note').count()) { await page.getByRole('button', { name: 'Delete' }).first().click(); await page.waitForTimeout(250) }
  await page.getByRole('radio', { name: 'The whole app' }).click()
  while (await page.locator('.rn-note').count()) { await page.getByRole('button', { name: 'Delete' }).first().click(); await page.waitForTimeout(250) }
  await assert.rejects(stat(files.page)); await assert.rejects(stat(shotPath))
  assert.deepEqual(errors, [], 'no page errors')
  console.log('PASS review notes: header button, preset/page/app places, type and area, window screenshot with canvas and overlay and no panel, list everything, done and delete')
} finally {
  await browser.close()
  const left = await leftovers()
  if (left.length) console.error(`left behind: ${left.join(', ')}`)
}
