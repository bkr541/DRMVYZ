import assert from 'node:assert/strict'
import { createServer as createHttpServer } from 'node:http'
import { readFile, mkdir, writeFile, cp, rm, stat } from 'node:fs/promises'
import { dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium, _electron } from '@playwright/test'
import { createPackage } from '@electron/asar'

const root = fileURLToPath(new URL('../../', import.meta.url))
const fixtures = resolve(root, 'src/features/models/__tests__/fixtures')
const shell = '<!doctype html><meta charset="utf-8"><title>Model engine verification</title>'
const mime = { '.js': 'text/javascript', '.ts': 'text/javascript', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.html': 'text/html' }
const mode = process.argv[2] ?? 'browser'
const packageDir = process.env.DRMVYZ_MODEL_ELECTRON_PACKAGE_DIR

// Runs the production engine, real worker/WASM, canvas decoder, exporter and loader.
async function checkEngine(page, engineUrl) {
  return page.evaluate(async engineUrl => {
    const engine = await import(engineUrl)
    const checks = []
    const expect = (value, message) => { if (!value) throw new Error(message); checks.push(message) }
    const source = async name => { const r = await fetch(`/fixtures/${name}`); if (!r.ok) throw new Error(`Missing fixture ${name}`); return r.blob() }
    const recipe = engine.createDefaultModelRecipe()
    recipe.materials[0] = { region: 'front', ...engine.MODEL_MATERIAL_PRESETS.Gold }
    const alpha = await engine.createModelArtifact({ source: await source('alpha-donut.png'), recipe })
    expect(alpha.stats.triangles > 0 && alpha.stats.triangles <= 80000, 'actual worker traces transparent PNG within budget')
    expect(alpha.traceSvg.includes('<path'), 'VTracer returns real contours')
    expect(alpha.recipe.engine.version.startsWith('1.0.0-alpha.4') && alpha.recipe.quality === 'normal', 'pinned VTracer engine identity retained')
    const bytes = await alpha.glb.arrayBuffer(), view = new DataView(bytes)
    expect(view.getUint32(0, true) === 0x46546c67 && view.getUint32(8, true) === bytes.byteLength, 'binary GLB header and size validated')
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, view.getUint32(12, true))).trim())
    expect(json.meshes.length > 0 && json.materials.some(m => m.pbrMetallicRoughness?.metallicFactor === 1 && m.pbrMetallicRoughness?.roughnessFactor === 0.2), 'saved GLB contains geometry and edited PBR metalness')
    expect(json.materials.some(m => m.name === 'side'), 'saved GLB retains side material region')
    expect(alpha.files.source.contentType === 'image/png' && alpha.files.trace.contentType === 'image/svg+xml', 'artifacts match Phase 01 save interface')
    alpha.dispose(); expect(alpha.group.children.length === 0, 'regenerated mesh resources can be disposed')
    const donut = await engine.createModelArtifact({ source: await source('donut.svg'), recipe })
    expect(donut.recipe.engine.name === 'drmvyz-svg-extrude' && donut.stats.triangles > 0, 'clean SVG bypasses raster tracing and exports')
    donut.dispose()
    let confirmation = false
    try { await engine.createModelArtifact({ source: await source('opaque-logo.png'), recipe }) }
    catch (error) { confirmation = error.code === 'foreground_confirmation_required' && error.preview?.size > 0 }
    expect(confirmation, 'opaque raster requires reviewable foreground confirmation')
    const opaque = await engine.createModelArtifact({ source: await source('opaque-logo.png'), recipe, foregroundConfirmed: true })
    expect(opaque.recipe.foreground.mode === 'luminance' && opaque.stats.triangles > 0, 'confirmed foreground produces geometry and saves effective recipe')
    opaque.dispose()
    const image = await globalThis.createImageBitmap(await source('opaque-logo.png'))
    const canvas = globalThis.document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
    canvas.getContext('2d').drawImage(image, 0, 0); image.close()
    for (const type of ['image/jpeg', 'image/webp']) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, type))
      if (blob.type !== type) throw new Error(`Browser cannot encode fixture ${type}`)
      const model = await engine.createModelArtifact({ source: blob, recipe, foregroundConfirmed: true })
      expect(model.stats.triangles > 0, `${type} bytes decode, trace and export`); model.dispose()
    }
    const hostile = await source('hostile.svg')
    let blocked = false; try { await engine.createModelArtifact({ source: hostile, recipe }) } catch (error) { blocked = error.code === 'unsafe_svg' }
    expect(blocked, 'untrusted SVG blocked before parsing geometry or loading resources')
    const controller = new AbortController(), pixels = new Uint8Array(1024 * 1024 * 4).fill(255)
    const pending = new engine.VTracerVectorizer().trace({ pixels, width: 1024, height: 1024, options: { smoothing: 0.5 }, signal: controller.signal })
    controller.abort()
    let cancelled = false; try { await pending } catch (error) { cancelled = error.name === 'AbortError' }
    expect(cancelled, 'worker cancellation terminates tracing')
    expect(pixels.byteLength === 1024 * 1024 * 4, 'worker transfer preserves caller source pixels')
    return { checks: checks.length, triangles: alpha.stats.triangles, glbBytes: bytes.byteLength }
  }, engineUrl)
}

async function browserChecks() {
  const server = await createServer({ configFile: false, root, server: { host: '127.0.0.1', port: 0 },
    plugins: [{ name: 'model-engine-test-shell', configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/__model_test__.html') { res.setHeader('Content-Type', 'text/html'); res.end(shell); return }
        if (req.url?.startsWith('/fixtures/')) {
          try { const path = resolve(fixtures, req.url.split('/').at(-1)); res.setHeader('Content-Type', mime[extname(path)]); res.end(await readFile(path)) } catch { res.statusCode = 404; res.end() }
          return
        }
        next()
      })
    } }],
  })
  await server.listen()
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__model_test__.html`)
    console.log('Vite/browser', await checkEngine(page, '/src/features/models/generator/createModelArtifact.ts'))
  } finally { await browser.close(); await server.close() }
  const http = createHttpServer(async (req, res) => {
    try {
      if (req.url === '/__model_test__.html') { res.setHeader('Content-Type', 'text/html'); res.end(shell); return }
      const path = req.url.startsWith('/fixtures/') ? resolve(fixtures, req.url.split('/').at(-1)) : resolve(root, 'dist', `.${req.url}`)
      if (!path.startsWith(root)) throw new Error('Invalid test path')
      res.setHeader('Content-Type', mime[extname(path)] ?? 'application/octet-stream'); res.end(await readFile(path))
    } catch { res.statusCode = 404; res.end() }
  })
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve))
  const productionBrowser = await chromium.launch({ headless: true })
  try {
    const page = await productionBrowser.newPage()
    await page.goto(`http://127.0.0.1:${http.address().port}/__model_test__.html`)
    console.log('Production/browser', await checkEngine(page, '/assets/model-generator.js'))
  } finally { await productionBrowser.close(); await new Promise(resolve => http.close(resolve)) }
}

async function packagedElectronChecks() {
  if (!packageDir) throw new Error('Set DRMVYZ_MODEL_ELECTRON_PACKAGE_DIR to a disposable extracted Electron.app directory.')
  const contents = resolve(packageDir, 'Contents'), resources = resolve(contents, 'Resources')
  await stat(resolve(contents, 'MacOS/Electron'))
  const staging = resolve(dirname(packageDir), 'model-engine-test-package')
  await rm(staging, { recursive: true, force: true })
  await mkdir(resolve(staging, 'dist/assets'), { recursive: true })
  const visited = new Set()
  async function copyAsset(relative) {
    const clean = relative.replace(/^\.\//, '')
    if (visited.has(clean)) return
    const src = resolve(root, 'dist/assets', clean)
    try { await stat(src) } catch (error) { if (error.code === 'ENOENT') return; throw error }
    visited.add(clean)
    const dest = resolve(staging, 'dist/assets', clean)
    if (!src.startsWith(resolve(root, 'dist/assets') + '/')) throw new Error('Invalid emitted asset dependency')
    await mkdir(dirname(dest), { recursive: true }); await cp(src, dest)
    if (!clean.endsWith('.js')) return
    const code = await readFile(src, 'utf8')
    const refs = [...code.matchAll(/["'](?:\.\/)?([^"'\s/]+\.(?:js|wasm))["']/g)].map(m => m[1])
    for (const ref of refs) await copyAsset(ref)
  }
  await copyAsset('model-generator.js')
  await cp(fixtures, resolve(staging, 'dist/fixtures'), { recursive: true })
  await writeFile(resolve(staging, 'dist/__model_test__.html'), shell)
  await writeFile(resolve(staging, 'package.json'), JSON.stringify({ name: 'drmvyz-model-engine-verification', version: '1.0.0', main: 'main.cjs' }))
  await writeFile(resolve(staging, 'main.cjs'), `
const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('node:path'); const { pathToFileURL } = require('node:url');
protocol.registerSchemesAsPrivileged([{ scheme: 'drmvyz-app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
app.whenReady().then(() => {
 const root = path.join(app.getAppPath(), 'dist');
 protocol.handle('drmvyz-app', request => {
  const file = path.resolve(root, '.' + new URL(request.url).pathname);
  if (!file.startsWith(root + path.sep)) return new Response('Forbidden', {status:403});
  return net.fetch(pathToFileURL(file).toString());
 });
 const window = new BrowserWindow({ show:false, webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false} });
 window.loadURL('drmvyz-app://app/__model_test__.html');
});
`)
  await createPackage(staging, resolve(resources, 'app.asar'))
  await rm(resolve(resources, 'default_app.asar'), { force: true })
  const executable = resolve(contents, 'MacOS/DRMVYZModelEngine')
  await cp(resolve(contents, 'MacOS/Electron'), executable)
  const app = await _electron.launch({ executablePath: executable, timeout: 30000 })
  try {
    assert.equal(await app.evaluate(({ app }) => app.isPackaged), true, 'Test must run packaged, not electron development mode')
    const page = await app.firstWindow()
    await page.waitForURL('drmvyz-app://app/__model_test__.html')
    console.log('Packaged Electron (ASAR, sandbox, app protocol)', await checkEngine(page, '/assets/model-generator.js'))
    console.log('Packaged engine assets', [...visited])
  } finally { await app.close() }
}
if (mode === 'electron') await packagedElectronChecks()
else await browserChecks()
