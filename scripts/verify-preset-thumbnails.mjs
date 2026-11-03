/* global document, getComputedStyle, requestAnimationFrame */
import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const baseUrl = process.env.DRMVYZ_ARTWORK_BASE_URL ?? 'http://127.0.0.1:5173'
const appHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8')
const fontStylesheet = appHtml.match(/<link href="(https:\/\/fonts\.googleapis\.com[^"]+)" rel="stylesheet"/)?.[1]
assert.ok(fontStylesheet, 'Use the same font stylesheet as the application')
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1050, height: 700 }, deviceScaleFactor: 2 })
  await page.route('**/preset-thumbnail-review', route => route.fulfill({ contentType: 'text/html', body: `<html><head><link rel="stylesheet" href="${fontStylesheet}"></head><body><div id="root"></div></body></html>` }))
  await page.goto(`${baseUrl}/preset-thumbnail-review`)
  await page.evaluate(async () => {
    const { default: refresh } = await import('/@react-refresh')
    refresh.injectIntoGlobalHook(globalThis)
    globalThis.$RefreshReg$ = () => {}
    globalThis.$RefreshSig$ = () => type => type
    globalThis.__vite_plugin_react_preamble_installed__ = true
    await import('/src/styles.css')
    await import('/src/styles/appearance.css')
    await import('/src/styles/reactView.css')
    await import('/src/styles/typography.css')
    document.getElementById('root').style.cssText = 'height:auto;overflow:visible'
    document.body.style.cssText = 'height:auto;overflow:auto'
    document.documentElement.style.cssText = 'height:auto;overflow:auto'
    const { default: React } = await import('/node_modules/.vite/deps/react.js')
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { ReactEngineBlueprint } = await import('/src/components/vyzualz/react/ReactEngineBlueprint.tsx')
    const { ReactPresetCard } = await import('/src/components/vyzualz/react/ReactPresetCard.tsx')
    const { cinema2NativePresetRegistry } = await import('/src/components/vyzualz/cinema2/index.ts')
    const cinemaCatalog = cinema2NativePresetRegistry.list().filter(p => !p.metadata.tags?.includes('internal'))
    const cards = [
      ['drmvyz.cinema2.afterhours', 'Afterhours', 'Cinema 2.0'],
      ['drmvyz.cinema2.ancient-machine', 'Ancient Machine', 'Cinema 2.0'],
      ['drmvyz.cinema2.atl-hoe', 'ATL HOE', 'Cinema 2.0'],
      ['drmvyz.cinema2.atmosphere-reference', 'Crystalized', 'Cinema 2.0'],
      ['drmvyz.cinema2.blockshift', 'Blockshift', 'Cinema 2.0'],
      ['drmvyz.cinema2.bwc', 'BWC', 'Cinema 2.0'],
      ...cinemaCatalog.filter(p => !['afterhours', 'ancient-machine', 'atl-hoe', 'atmosphere-reference', 'blockshift', 'bwc'].some(key => p.id === `drmvyz.cinema2.${key}`)).map(p => [p.id, p.metadata.name, 'Cinema 2.0']),
      ['canvas-fractures', 'Fractures', 'CANVAS'],
      ['canvas-particle-aura', 'Particle Aura', 'CANVAS'],
      ['motion-echo', 'Motion Echo', 'Headliner'],
      ['minimal-crossfire', 'Minimal Crossfire', 'LaserDMX'],
      ['drmvyz.cinema2.afterhours', 'A very long preset name that wraps across several lines', 'Long title'],
    ]
    const { ReactPresetThumbnail } = await import('/src/components/vyzualz/react/ReactPresetThumbnail.tsx')
    const { DEFAULT_REACT_PRESETS } = await import('/src/components/vyzualz/react/ReactTypes.ts')
    const live = ['oscilloscope', 'pixGrid'].map(engine => DEFAULT_REACT_PRESETS.find(p => p.engine === engine))
    const node = (id, title, mode, backdrop, layout) => React.createElement(ReactPresetCard, {
      key: `${id}:${title}:${layout}`, id, title, description: title, activateLabel: `Load ${title}`, onActivate: () => {},
      chips: [{ label: mode }], isActive: id.includes('afterhours'), isModified: mode === 'Long title',
      onToggleFavorite: () => {}, backdrop, layout,
    })
    createRoot(document.getElementById('root')).render(React.createElement('main', { className: 'rv-shell rv-engine-panel-list', style: { display: 'grid', gridTemplateColumns: 'repeat(3, 240px)', gap: 14, padding: 24, height: 'auto', maxHeight: 'none', overflow: 'visible' } },
      ...cards.map(([id, title, mode]) => node(id, title, mode)),
      ...live.map(p => node(p.id, p.name, p.engine, React.createElement(ReactPresetThumbnail, { preset: p }))),
      node('row-test', 'Mixed case row name', 'Row', undefined, 'row'),
      React.createElement('div', { className: 'rv-engine-card', 'data-blueprint-reference': true, style: { width: 300 } },
        React.createElement('span', { className: 'rv-engine-dropdown-icon' }, React.createElement(ReactEngineBlueprint, { engineId: 'oscilloscope' }))),
    ))
  })
  await page.locator('[data-preset-card]').first().waitFor()
  const loadedFont = await page.evaluate(async () => (await document.fonts.load('400 12px Manrope')).length > 0)
  assert.ok(loadedFont, 'Verify actual Manrope glyphs, not a fallback font')
  // The extended catalog includes offscreen lazy artwork; reveal it before
  // checking readiness rather than requiring deferred images to load invisibly.
  for (const image of await page.locator('.rv-preset-blueprint-image').all()) {
    await image.scrollIntoViewIfNeeded()
    await image.evaluate(img => img.decode())
  }
  for (const thumbnail of await page.locator('.rv-preset-thumb').all()) {
    await thumbnail.scrollIntoViewIfNeeded()
    await page.waitForFunction(node => node.dataset.thumbnailState === 'ready', await thumbnail.elementHandle())
  }
  await page.evaluate(() => globalThis.scrollTo(0, 0))
  for (const width of [240, 160]) {
    await page.locator('main').evaluate((node, width) => { node.style.gridTemplateColumns = `repeat(3, ${width}px)` }, width)
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const signShift = await page.locator('[data-art-sign-offset]').first().evaluate(group => {
      const original = group.getAttribute('transform')
      const shifted = group.getBoundingClientRect()
      group.removeAttribute('transform')
      const unshifted = group.getBoundingClientRect()
      group.setAttribute('transform', original)
      return { x: shifted.x - unshifted.x, y: shifted.y - unshifted.y }
    })
    assert.ok(Math.abs(signShift.x + 12) < .05 && Math.abs(signShift.y) < .05, 'Only the ATL HOE sign must move exactly 12px left')
    const authored = await page.locator('[data-thumbnail-kind="authored-blueprint"]').evaluateAll(svgs => svgs.map(svg => {
      const reference = document.querySelector('[data-blueprint-reference] path')
      const matrix = reference.getScreenCTM()
      const referenceWeight = parseFloat(getComputedStyle(reference).strokeWidth) * Math.hypot(matrix.a, matrix.b)
      const path = svg.querySelector('path')
      const drawing = svg.querySelector('[data-art-composition]').getBoundingClientRect()
      const thumbnail = svg.closest('.rv-preset-spotlight-thumb')
      const frame = thumbnail.getBoundingClientRect()
      const scene = svg.closest('.rv-preset-blueprint-scene')
      const sceneBounds = scene.getBoundingClientRect()
      const engine = document.querySelector('[data-blueprint-reference]')
      return { presetId: svg.dataset.artworkPreset,
        rightWeighted: sceneBounds.left >= frame.left + frame.width * .2 && sceneBounds.right > frame.right + frame.width * .1,
        artworkFade: getComputedStyle(scene).maskImage,
        background: getComputedStyle(thumbnail).backgroundImage,
        engineBackground: getComputedStyle(engine).backgroundImage,
        inwardGlow: getComputedStyle(thumbnail).boxShadow,
        engineInwardGlow: getComputedStyle(engine).boxShadow,
        translucentSurfaces: [...svg.querySelectorAll('[fill-opacity]')].some(shape => Number(shape.getAttribute('fill-opacity')) >= .08),
        overscans: drawing.left < frame.left - 1 || drawing.right > frame.right + 1 || drawing.top < frame.top - 1 || drawing.bottom > frame.bottom + 1,
        clipping: getComputedStyle(svg.closest('.rv-preset-spotlight-thumb')).overflow,
        camera: svg.querySelector('[data-art-composition]').getAttribute('transform'),
        motifAngles: [...svg.querySelectorAll('[data-art-motif][transform]')].map(group => group.getAttribute('transform')),
        motifs: [...svg.querySelectorAll('[data-art-motif]')].map(group => group.dataset.artMotif),
        lineWeight: parseFloat(getComputedStyle(path).strokeWidth), referenceWeight,
        vectorEffect: getComputedStyle(path).vectorEffect,
        hasContourFilter: Boolean(svg.closest('.rv-preset-blueprint-scene').style.filter),
      }
    }))
    assert.equal(new Set(authored.map(artwork => artwork.presetId)).size, 37, 'Every public Cinema 2.0 preset must have authored line artwork')
    assert.ok(new Set(authored.map(artwork => artwork.camera)).size >= 10, 'Each preset needs its own camera framing')
    for (const artwork of authored) {
      assert.equal(artwork.artworkFade.includes('radial-gradient'), false, 'Title clearance must come from geometry, without a title-area mask')
      assert.equal(artwork.rightWeighted, true, 'Artwork should occupy an oversized window toward the right')
      assert.ok(artwork.artworkFade.includes('linear-gradient'))
      assert.equal(artwork.background, artwork.engineBackground, 'Background lighting must match the Engine card')
      assert.equal(artwork.inwardGlow, artwork.engineInwardGlow, 'Inward illumination must match the Engine card')
      assert.equal(artwork.translucentSurfaces, true, 'Primary geometry needs translucent surface fills')
      assert.equal(artwork.overscans, true, 'Foreground artwork must extend past a card edge')
      assert.equal(artwork.clipping, 'hidden', 'Artwork must crop cleanly at the rounded border')
      assert.ok(artwork.motifAngles.length >= 2, 'Motif planes must use different poses')
      assert.equal(new Set(artwork.motifs).size, 4)
      assert.equal(artwork.hasContourFilter, false)
      assert.equal(artwork.vectorEffect, 'non-scaling-stroke')
      assert.ok(Math.abs(artwork.lineWeight - artwork.referenceWeight) < .01, 'Line thickness must match the actual Engine dropdown')
    }
    const metrics = await page.locator('[data-preset-card]').evaluateAll(cards => cards.map(card => {
      const title = card.querySelector('.rv-preset-spotlight-name')
      const name = title.getBoundingClientRect(), rect = card.getBoundingClientRect()
      const style = getComputedStyle(title)
      const captionStyle = getComputedStyle(card.querySelector('.rv-preset-spotlight-caption'))
      const artwork = card.querySelector('.rv-preset-spotlight-thumb')?.getBoundingClientRect()
      return { poster: card.classList.contains('rv-preset-spotlight-card--poster'), transform: style.textTransform,
        font: `${style.fontSize}/${style.fontWeight}`, family: style.fontFamily, tracking: style.letterSpacing, color: style.color, visibleTextHeight: title.clientHeight,
        requiredTextHeight: Math.min(title.scrollHeight, 2 * parseFloat(style.lineHeight)), centerX: Math.abs(name.x + name.width / 2 - rect.x - rect.width / 2),
        centerY: Math.abs(name.y + name.height / 2 - rect.y - rect.height / 2),
        artworkWidth: artwork?.width, cardWidth: rect.width, cardHeight: rect.height, captionDisplay: captionStyle.display, scrim: captionStyle.backgroundImage,
      }
    }))
    for (const metric of metrics) {
      assert.equal(metric.transform, 'uppercase')
      assert.equal(metric.font, '12px/400')
      assert.ok(metric.family.startsWith('Manrope'))
      assert.equal(metric.tracking, '1.44px')
      assert.equal(metric.color, 'rgb(255, 255, 255)')
      if (metric.poster) {
        assert.ok(Math.abs(metric.cardHeight - (metric.cardWidth * 2 / 3 - 30)) < .1, 'Preset tile must be exactly 6px shorter than the previous design')
        assert.ok(metric.visibleTextHeight + 1 >= metric.requiredTextHeight, 'Larger wrapped names must not be clipped')
        assert.equal(metric.captionDisplay, 'flex', 'Rail styles must not override caption centering')
        assert.equal(metric.scrim, 'none', 'Production artwork must not have a gradient overlay')
        assert.ok(metric.centerX < 1 && metric.centerY < 1, `Title is not centered: ${JSON.stringify(metric)}`)
        assert.ok(Math.abs(metric.artworkWidth - metric.cardWidth) <= 2)
      }
    }
  }
  await page.locator('main').evaluate(node => { node.style.gridTemplateColumns = 'repeat(3, 240px)' })
  await mkdir('/tmp/drmvyz-preset-review', { recursive: true })
  await page.screenshot({ path: '/tmp/drmvyz-preset-review/preset-thumbnails.png', fullPage: true })
  await page.locator('main').evaluate(node => { node.style.gridTemplateColumns = 'repeat(3, 240px)'; globalThis.scrollTo(0, 0) })
  const bounds = await page.locator('[data-preset-card]').evaluateAll(cards => {
    const rects = cards.slice(0, 6).map(card => card.getBoundingClientRect())
    const x = Math.min(...rects.map(rect => rect.x)) - 12, y = Math.min(...rects.map(rect => rect.y)) + globalThis.scrollY - 12
    return { x, y, width: Math.max(...rects.map(rect => rect.right)) - x + 12, height: Math.max(...rects.map(rect => rect.bottom)) + globalThis.scrollY - y + 12 }
  })
  await page.screenshot({ path: '/tmp/drmvyz-preset-review/six-label-clearance-blueprints.png', clip: bounds })
  await page.setViewportSize({ width: 1050, height: 2200 })
  await page.locator('main').evaluate(node => { node.style.gridTemplateColumns = 'repeat(4, 240px)'; globalThis.scrollTo(0, 0) })
  await page.locator('[data-preset-card-shell]').evaluateAll(shells => shells.forEach((shell, i) => { if (i >= 37) shell.style.visibility = 'hidden' }))
  for (const [sheet, start, end] of [['1', 0, 20], ['2', 20, 37]]) {
    const clip = await page.locator('[data-preset-card]').evaluateAll((cards, [start, end]) => {
      const rects = cards.slice(start, end).map(card => card.getBoundingClientRect())
      const x = Math.min(...rects.map(r => r.x)) - 10, y = Math.min(...rects.map(r => r.y)) + globalThis.scrollY - 10
      return { x, y, width: Math.max(...rects.map(r => r.right)) - x + 10, height: Math.max(...rects.map(r => r.bottom)) + globalThis.scrollY - y + 10 }
    }, [start, end])
    await page.screenshot({ path: `/tmp/drmvyz-preset-review/cinema2-catalog-${sheet}.png`, clip })
  }
  console.log('Verified Engine-matched gradients and inward illumination, right-weighted cropped artwork, translucent surfaces, and all 37 public Cinema 2.0 four-motif SVG illustrations with no tracing and the exact Engine dropdown line thickness; white 12px/400 Manrope uppercase titles with wide tracking, 6px-shorter tiles with exact centering within production preset rails, no gradient overlay, full-size artwork, and rendered thumbnails across all six engines at 240px and 160px widths.')
} finally { await browser.close() }
