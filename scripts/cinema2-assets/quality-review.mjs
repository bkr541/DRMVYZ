#!/usr/bin/env node
/* global document, window */
import { mkdir, mkdtemp, readFile, writeFile, rename, unlink } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import { subjects, checkpoints, inspectPixels, pendingRubric, validateApproval, validateBundle, binding, evidenceIndex, reviewVersion, caseKey } from './quality-review-core.mjs'
import { hash, seal, sourceRevision, readBundle } from './visual-evidence-io.mjs'
import { technicalIssues } from './release-acceptance-core.mjs'
import { inventory, capabilityPlan } from './reviewed-release-inventory.mjs'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const save = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n')
const [command = 'capture', ...args] = process.argv.slice(2)
if (['compare','publish-thumbnail','status'].includes(command)) {
  const [baselineRoot,candidateRoot,baselineMatrix,candidateMatrix,reviewDir,...flags]=args
  if(!reviewDir || !flags.some(f=>f==='--prospective'||f==='--matched-older') || flags.includes('--prospective')&&flags.includes('--matched-older'))throw Error('Supply both quality run roots, both technical manifests, review directory and exactly one baseline provenance flag')
  const option=name=>flags.find(f=>f.startsWith(`--${name}=`))?.split('=')[1]
  const key=option('preset')
  if(command!=='status'&&!inventory.includes(key))throw Error('Supply --preset=<reviewed key>')
  const revision=await sourceRevision(root), kind=flags.includes('--prospective')?'prospective':'matched-older'
  if(command==='compare')await mkdir(reviewDir,{recursive:true})
  const results={}
  for(const k of command==='status'?inventory:[key]) {
    const reviewPath=join(reviewDir,`${k}.json`)
    try {
      const bundle=await readBundle(k,baselineRoot,candidateRoot,baselineMatrix,candidateMatrix,kind)
      validateBundle(bundle,revision)
      if(command==='compare') {
        const rubric=pendingRubric(), index=evidenceIndex(bundle),caps=capabilityPlan(bundle.candidateMatrix.manifest)
        for(const [criterion,item] of Object.entries(rubric)) {
          item.evidence=index.filter(e=>e.ref.endsWith('/contact-sheet.png')||criterion==='patternDistinction'&&/\/matrix\/pattern-\d+-a-[012]\.png$/.test(e.ref)||criterion==='meaningfulMotion'&&/\/matrix\/camera-/.test(e.ref)||criterion==='mediaFidelity'&&/\/matrix\/(media-|model)/.test(e.ref))
        }
        await writeFile(reviewPath,JSON.stringify({binding:binding(bundle),reference:kind==='prospective'?'Original review recording unavailable; prospective comparison only':'Matched older source; original reference provenance must be documented by reviewer',baselineProvenance:'',subject:subjects[k],capabilities:caps,reviewer:'',approvedAt:'',decision:'pending',rubric,thumbnailFrame:''},null,2)+'\n',{flag:'wx'})
        console.log(`Pending review: ${reviewPath}`)
        continue
      }
      let review
      try {review=JSON.parse(await readFile(reviewPath,'utf8'))} catch(e) {if(command==='status'&&e.code==='ENOENT'){results[k]={status:'pending',reason:'No reviewer decision'};continue}throw e}
      if(command==='status'&&review.decision!=='approved') {results[k]={status:review.decision==='rejected'||Object.values(review.rubric??{}).some(c=>c.status==='fail')?'failed':'pending',reason:'Human review not approved'};continue}
      const {frame,report,path}=validateApproval(review,bundle,revision)
      if(command==='status'){results[k]={status:'approved',thumbnail:path};continue}
      const png=await readFile(join(candidateRoot,k,caseKey(report),frame.name))
      if(hash(png)!==frame.sha256)throw Error('Capture changed')
      const {default:sharp}=await import('sharp')
      const original=await sharp(png).metadata()
      if(original.width!==960||original.height!==540||original.format!=='png')throw Error('Invalid source image dimensions or format')
      const output=await sharp(png).resize(480,270).webp({quality:86}).toBuffer()
      const meta=await sharp(output).metadata()
      if(meta.width!==480||meta.height!==270||meta.format!=='webp')throw Error('Invalid catalog image')
      let previous=null;try{previous=hash(await readFile(join(root,path)))}catch(e){if(e.code!=='ENOENT')throw e}
      console.log(JSON.stringify({preset:bundle.id,path,previousHash:previous,newHash:hash(output),sourceFrame:frame.name,sourceHash:frame.sha256,width:480,height:270,action:flags.includes('--apply')?'publish':'dry-run'},null,2))
      if(flags.includes('--apply')) {
        if(await sourceRevision(root)!==revision)throw Error('Source changed before publication')
        const target=join(root,path),temp=`${target}.vis01-${process.pid}.tmp`
        await writeFile(temp,output,{flag:'wx'});try{await rename(temp,target)}finally{await unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e})}
      }
    } catch(e) {if(command!=='status')throw e;results[k]={status:'blocked',reason:String(e)}}
  }
  if(command==='status')console.log(JSON.stringify({presets:results,overallReleaseApproval:false,hardwareElectronCasting:'Not certified by VIS-01; see QA-07 evidence independently'},null,2))
} else if (command === 'capture') {
  const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i+1] }
  const keys = option('presets', Object.keys(subjects).join(',')).split(',')
  const modes = option('modes', 'authored,manual,auto').split(',')
  const quality = option('quality', 'high')
  const aspects = option('aspects', 'landscape,portrait').split(',')
  if (keys.some(key => !Object.hasOwn(subjects,key)) || modes.some(m => !['authored','manual','auto'].includes(m)) || !['high','medium','low'].includes(quality) || aspects.some(a => !['landscape','portrait'].includes(a))) throw Error('Invalid review options')
  const revision = await sourceRevision(root)
  const [{ chromium }, { createServer }, { default: sharp }] = await Promise.all([import('@playwright/test'),import('vite'),import('sharp')])
  const parent = join(root, 'artifacts/cinema2-quality-review'); await mkdir(parent,{recursive:true})
  const output = await mkdtemp(join(parent,'run-')); console.log(output)
  const vite = await createServer({ root, server:{host:'127.0.0.1',port:0} }); let browser, failed = false
  try {
    await vite.listen()
    const url = vite.resolvedUrls.local[0] + 'src/test/browser/cinema2-quality-review.html'
    browser = await chromium.launch({ headless:true, args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'], ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) })
    const probe=await browser.newPage();const gl=await probe.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2');if(!gl)return null;const ext=gl.getExtension('WEBGL_debug_renderer_info');return {vendor:gl.getParameter(ext?.UNMASKED_VENDOR_WEBGL??gl.VENDOR),renderer:gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)}});await probe.close()
    if(!gl)throw Error('WebGL2 unavailable')
    const environment={platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model,node:process.version,chromium:browser.version(),gl}
    for (const key of keys) for (const mode of modes) for (const aspect of aspects) {
      const [width,height] = aspect === 'landscape' ? [960,540] : [540,960]
      const config = { fixture:'sys04-review-v1', width,height,quality,mode,aspect,dpr:1, fps:30, checkpoints }
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
          const pixels = inspectPixels(data)
          const issues = [...technicalIssues(capture),stage==='reference'&&pixels.uniform&&'uniform default output'].filter(Boolean)
          await writeFile(join(folder,name),image)
          frames.push({name,stage,sha256:hash(image),pixels,failed:issues.length>0,issues,...capture,settings:await api('saved')})
        }
      } catch(error) { errors.push(String(error)) }
      finally { try { if(inventory) disposed=await api('dispose') } catch(error){errors.push(String(error))} await page.close() }
      const complete = frames.length === checkpoints.length && disposed?.phase === 'disposed'
      let contactSheet=null
      if(complete) {
        const w=aspect==='landscape'?320:180,h=aspect==='landscape'?180:320
        const tiles=await Promise.all(frames.map(async(f,i)=>({input:await sharp(join(folder,f.name)).resize(w,h).png().toBuffer(),left:i%4*w,top:Math.floor(i/4)*h})))
        const sheet=await sharp({create:{width:4*w,height:Math.ceil(frames.length/4)*h,channels:3,background:'#000'}}).composite(tiles).png().toBuffer()
        await writeFile(join(folder,'contact-sheet.png'),sheet);contactSheet={sha256:hash(sheet),order:frames.map(f=>f.name)}
      }
      if(await sourceRevision(root)!==revision)errors.push('Source changed during capture')
      const report = { schemaVersion:reviewVersion,sourceRevision:revision,environment,config,inventory,subject:subjects[key],prepare,disposed,frames,errors,complete,contactSheet,rubric:pendingRubric() }
      await save(join(folder,'report.json'),seal(report))
      failed ||= !complete || errors.length>0 || frames.some(frame=>frame.failed)
      console.log(`${key}/${mode}/${aspect}: ${frames.length} captures, ${errors.length} errors`)
    }
  } finally { await browser?.close(); await vite.close() }
  if (failed) process.exitCode=1
} else throw Error(`Unknown command: ${command}`)
