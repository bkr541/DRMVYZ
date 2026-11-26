#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { subjects, checkpoints, inspectPixels, pendingRubric, comparable, validateApproval } from './quality-review-core.mjs'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const hash = data => createHash('sha256').update(data).digest('hex')
const save = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n')
async function readReport(path) {
  const { hash: recorded, ...report } = JSON.parse(await readFile(path, 'utf8'))
  if (hash(JSON.stringify(report)) !== recorded) throw Error(`Report changed: ${path}`)
  for (const frame of report.frames) {
    if (!/^\d\d-(reference|idle|build|drop|breakdown)\.png$/.test(frame.name)) throw Error('Invalid frame name')
    if (hash(await readFile(join(dirname(path), frame.name))) !== frame.sha256) throw Error(`Capture changed: ${frame.name}`)
  }
  return { ...report, hash: recorded }
}
const [command = 'capture', ...args] = process.argv.slice(2)
if (command === 'compare' || command === 'publish-thumbnail') {
  const [baselinePath, candidatePath, reviewPath] = args
  if (!baselinePath || !candidatePath || !reviewPath) throw Error('Supply baseline report, candidate report and review JSON path')
  const baseline = await readReport(resolve(baselinePath)), candidate = await readReport(resolve(candidatePath))
  if (!comparable(baseline, candidate)) throw Error('Capture configurations or authored settings differ')
  if (command === 'compare') {
    const record = { baselineHash: baseline.hash, candidateHash: candidate.hash, reviewer: '', approvedAt: '', decision: 'pending',
      rubric: pendingRubric(), thumbnailFrame: '', pairs: baseline.frames.map((frame, i) => ({ baseline: frame.name, candidate: candidate.frames[i].name,
        identical: frame.sha256 === candidate.frames[i].sha256, before: frame.pixels, after: candidate.frames[i].pixels })) }
    await writeFile(reviewPath, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' })
  } else {
    const review = JSON.parse(await readFile(reviewPath, 'utf8'))
    const frame = validateApproval(review, baseline, candidate)
    const id = candidate.inventory.id
    if (!Object.hasOwn(subjects, id.replace(/^drmvyz\.cinema2\./, '')) || !id.startsWith('drmvyz.cinema2.')) throw Error('Preset not in review inventory')
    if (candidate.config.width !== 960 || candidate.config.height !== 540) throw Error('Use the landscape review for catalog artwork')
    const { default: sharp } = await import('sharp')
    const png = await readFile(join(dirname(resolve(candidatePath)), frame.name))
    if (hash(png) !== frame.sha256) throw Error('Capture changed')
    // Exact path consumed by PresetBlueprintImage. No illustrations or runtime settings writes.
    await sharp(png).resize(480, 270).webp({ quality: 86 }).toFile(join(root, 'public/preset-artwork', `${id}.webp`))
    console.log(`Published approved native capture for ${id}`)
  }
} else if (command === 'capture') {
  const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i+1] }
  const keys = option('presets', Object.keys(subjects).join(',')).split(',')
  const modes = option('modes', 'authored,manual,auto').split(',')
  const quality = option('quality', 'high')
  const aspects = option('aspects', 'landscape').split(',')
  if (keys.some(key => !Object.hasOwn(subjects,key)) || modes.some(m => !['authored','manual','auto'].includes(m)) || !['high','medium','low'].includes(quality) || aspects.some(a => !['landscape','portrait'].includes(a))) throw Error('Invalid review options')
  const [{ chromium }, { createServer }, { default: sharp }] = await Promise.all([import('@playwright/test'),import('vite'),import('sharp')])
  const parent = join(root, 'artifacts/cinema2-quality-review'); await mkdir(parent,{recursive:true})
  const output = await mkdtemp(join(parent,'run-')); console.log(output)
  const vite = await createServer({ root, server:{host:'127.0.0.1',port:0} }); let browser, failed = false
  try {
    await vite.listen()
    const url = vite.resolvedUrls.local[0] + 'src/test/browser/cinema2-quality-review.html'
    browser = await chromium.launch({ headless:true, args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'], ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) })
    for (const key of keys) for (const mode of modes) for (const aspect of aspects) {
      const [width,height] = aspect === 'landscape' ? [960,540] : [540,960]
      const config = { fixture:'sys04-review-v1', width,height,quality,mode,dpr:1, fps:30, checkpoints }
      const folder = join(output,key,mode,aspect); await mkdir(folder,{recursive:true})
      const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:1}); const errors = [], frames = []
      let inventory = null, prepare = null, disposed = null
      page.on('pageerror',error=>errors.push(error.message)); page.on('console',msg=>{if(msg.type()==='error' || /GL_INVALID|WebGL.*error/i.test(msg.text())) errors.push(msg.text())})
      const api = (method,...values)=>page.evaluate(({method,values})=>window.__cinema2QualityReview[method](...values),{method,values})
      try {
        const query = new URLSearchParams({preset:`drmvyz.cinema2.${key}`,quality,mode})
        await page.goto(`${url}?${query}`); await page.waitForFunction(()=>Boolean(window.__cinema2QualityReview),{},{timeout:30000})
        inventory = await api('inventory'); prepare = await api('prepare')
        for (const [stage,count] of checkpoints) {
          const {png,...capture} = await api('capture',stage,count)
          const image = Buffer.from(png.split(',')[1],'base64'); const name = `${String(frames.length).padStart(2,'0')}-${stage}.png`
          const {data,info} = await sharp(image).toColourspace('srgb').removeAlpha().raw().toBuffer({resolveWithObject:true})
          if (info.width!==width || info.height!==height || info.channels!==3) throw Error('Unexpected capture dimensions')
          const pixels = inspectPixels(data), d = capture.diagnostics
          const issues = [pixels.uniform && 'uniform output (inspect intentional blackout)', !capture.parametersUnchanged && 'authored parameters changed',
            d.runtime.phase !== 'running' && `runtime ${d.runtime.phase}`, d.modules.failedModuleCount > 0 && 'failed module', d.render.failedPassCount > 0 && 'failed render pass',
            d.modules.modules.some(m=>m.inspection?.ready===false) && 'module not ready',
            d.glError !== 0 && `WebGL error ${d.glError}`].filter(Boolean)
          await writeFile(join(folder,name),image)
          frames.push({name,stage,sha256:hash(image),pixels,failed:issues.length>0,issues,...capture})
        }
      } catch(error) { errors.push(String(error)) }
      finally { try { if(inventory) disposed=await api('dispose') } catch(error){errors.push(String(error))} await page.close() }
      const complete = frames.length === checkpoints.length && disposed?.phase === 'disposed'
      const report = { config,inventory,subject:subjects[key],prepare,disposed,frames,errors,complete,rubric:pendingRubric() }
      await save(join(folder,'report.json'),{...report,hash:hash(JSON.stringify(report))})
      failed ||= !complete || errors.length>0 || frames.some(frame=>frame.failed)
      console.log(`${key}/${mode}/${aspect}: ${frames.length} captures, ${errors.length} errors`)
    }
  } finally { await browser?.close(); await vite.close() }
  if (failed) process.exitCode=1
} else throw Error(`Unknown command: ${command}`)
