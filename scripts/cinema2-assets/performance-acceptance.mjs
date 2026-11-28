#!/usr/bin/env node
/* global document, screen, devicePixelRatio, window */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import { inventory, inventoryCoverage } from './reviewed-release-inventory.mjs'
import { retiredIssues, technicalIssues } from './release-acceptance-core.mjs'
import { summarizePlayback, ownershipIssues, steadyStateIssues, rendererClass, comparePlayback } from './performance-evidence.mjs'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'), args=process.argv.slice(2)
const opt=(key,def=null)=>{const i=args.indexOf(`--${key}`);return i<0?def:args[i+1]}
const smoke=args.includes('--smoke'), keys=opt('presets',smoke?'spectrum,honey':inventory.join(',')).split(',')
const tiers=opt('tiers',smoke?'high':'high,medium,low').split(',')
const duration=(name,def,min,max)=>{const n=Number(opt(name,def));if(!Number.isFinite(n)||n<min||n>max)throw Error(`Invalid --${name}`);return n}
const settings={warmupMs:duration('warmup',smoke?1000:10000,0,600000),measureMs:duration('measure',smoke?2000:60000,1,600000),stressMs:duration('stress',smoke?3000:600000,1,600000),cycles:duration('cycles',smoke?2:20,1,100),tiers,viewports:[{width:960,height:540},{width:540,height:960}]}
if(!Number.isInteger(settings.cycles)||new Set(tiers).size!==tiers.length||tiers.some(t=>!['high','medium','low'].includes(t)))throw Error('Invalid cycles or tiers')
const coverage=inventoryCoverage(keys,smoke||args.includes('--presets'))
const dir=join(root,'artifacts/cinema2-performance');await mkdir(dir,{recursive:true});const out=await mkdtemp(join(dir,'run-'))
const hash=b=>createHash('sha256').update(b).digest('hex')
const fixtureHash=hash(await Promise.all(['src/test/support/TrippyBroMusicFixture.ts','src/test/browser/Cinema2QualityReviewHarness.ts','src/test/browser/Cinema2ReleaseMediaFixture.ts'].map(p=>readFile(join(root,p)))).then(b=>Buffer.concat(b)))
let revision=opt('revision');if(!revision)try{const dirty=execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'});if(!dirty.trim())revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()}catch{/* not a git checkout: leave the revision unset */}
const report={schemaVersion:1,revision,fixtureHash,...coverage,environment:{platform:os.platform(),osRelease:os.release(),arch:os.arch(),cpu:os.cpus()[0]?.model,refreshHz:opt('refresh-hz')?duration('refresh-hz',60,1,1000):null,driver:opt('driver'),display:opt('display'),fixtureHash,capture:'none during sampling',config:settings,dpr:1,headless:!args.includes('--headed'),allowSoftware:args.includes('--allow-software')},scenarios:{},lifecycle:[],gates:{browserTechnical:'not-run',hardwareTiming:'not-run',electronPreview:'not-run',electronFullscreen:'not-run',casting:'not-run',externalCasting:'not-run',performanceComparison:'not-run',humanVisual:'pending'},errors:[],blockers:[]}
const imageExerciseComplete=r=>r.sourceExercise==='executed'&&!!r.transport
const save=()=>writeFile(join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n')
console.log(`Performance evidence: ${out}`)
let browser,vite
try{
  const [{chromium},{createServer}]=await Promise.all([import('@playwright/test'),import('vite')])
  vite=await createServer({root,server:{host:'127.0.0.1',port:0}});await vite.listen()
  browser=await chromium.launch({headless:report.environment.headless,args:['--enable-webgl','--ignore-gpu-blocklist',...(args.includes('--allow-software')?['--enable-unsafe-swiftshader']:[])],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})})
  report.environment.browser=browser.version()
  const probe=await browser.newPage();try{report.environment.renderer=await probe.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2');if(!gl)return null;const ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)):null});report.environment.screen=await probe.evaluate(()=>({width:screen.width,height:screen.height,dpr:devicePixelRatio}))}finally{await probe.close()}
  report.environment.rendererClass=rendererClass(report.environment.renderer??'')
  const url=vite.resolvedUrls.local[0]+'src/test/browser/cinema2-quality-review.html'
  async function withPage(key,tier,viewport,fn){
    const page=await browser.newPage({viewport,deviceScaleFactor:1});const errors=[]
    let watchdog
    const timeout = Math.max(120000, settings.warmupMs + settings.measureMs + 90000, settings.stressMs+settings.cycles*2*(settings.warmupMs+1000)+180000)
    const deadline=new Promise((_,reject)=>{watchdog=setTimeout(()=>{void page.close();reject(Error('Performance scenario exceeded deadline'))},timeout)})
    page.on('pageerror',()=>errors.push('Uncaught page error'));page.on('console',m=>{if(/GL_INVALID|WebGL.*error|context.*exhaust|context bound exceeded/i.test(m.text()))errors.push('GL/context error')})
    const api=(method,...values)=>page.evaluate(({method,values})=>window.__cinema2QualityReview[method](...values),{method,values})
    try{await page.goto(`${url}?preset=drmvyz.cinema2.${key}&quality=${tier}&mode=authored&release=1`);await page.waitForFunction(()=>!!window.__cinema2QualityReview,{},{timeout:30000});await Promise.race([fn(api,page,errors),deadline])}finally{clearTimeout(watchdog);try{if(!page.isClosed()){await api('dispose');const d=await api('playbackResources');report.errors.push(...retiredIssues(d),...ownershipIssues(d,true),...errors)}}finally{await page.close()}}
  }
  for(const key of keys)for(const tier of tiers)for(const viewport of settings.viewports){
    const name=`${key}/${tier}/${viewport.width}x${viewport.height}`
    await withPage(key,tier,viewport,async(api)=>{
      const raw=await api('playback',settings.warmupMs,settings.measureMs), summary=summarizePlayback(raw,report.environment.refreshHz)
      const issues=[...steadyStateIssues(raw.resources),...raw.resources.flatMap(d=>technicalIssues({diagnostics:d,parametersUnchanged:raw.settings===raw.initialSettings}))];const last=raw.resources.at(-1)
      const evidence={...summary,settings:raw.settings,gpuBytes:last.resources.estimatedGpuMemoryBytes+last.modules.estimatedGpuBytes,resourceIssues:issues,raw}
      if(issues.length||raw.finalSnapshot.performance.resolvedQuality!==tier)evidence.status='fail'
      report.scenarios[name]=evidence;await save()
    })
  }
  await withPage(keys[0],tiers[0],settings.viewports[0],async(api,page)=>{
    const raw=await api('playback',settings.warmupMs,settings.stressMs,true)
    report.stress={...summarizePlayback(raw,report.environment.refreshHz),raw,resourceIssues:[...steadyStateIssues(raw.resources),...raw.resources.flatMap(d=>technicalIssues({diagnostics:d,parametersUnchanged:raw.settings===raw.initialSettings}))]}
    const anchor=keys[0],other=keys.find(k=>k!==anchor)??(anchor==='spectrum'?'honey':'spectrum'),saved=await api('saved'),samples=[]
    for(let i=0;i<settings.cycles;i++){
      for(const key of [other,anchor]){const retired=await api('switchPreset',`drmvyz.cinema2.${key}`,tiers[0],key===anchor?saved:undefined);const issues=retiredIssues(retired);const playback=await api('playback',settings.warmupMs,Math.min(settings.measureMs,1000));const live=playback.resources.at(-1);issues.push(...ownershipIssues(live),...summarizePlayback(playback,report.environment.refreshHz).issues);report.lifecycle.push({cycle:i,key,issues,retired,live});if(key===anchor)samples.push(live)}
    }
    report.errors.push(...steadyStateIssues(samples))
    // Exercise the existing context restoration and source lifecycle APIs; retain the actual snapshots.
    await page.setViewportSize(settings.viewports[1]);await api('resize',540,960)
    let meta=await api('inventory');if(!meta.mediaSlots.some(s=>s.accepts.includes('image'))){const retired=await api('switchPreset','drmvyz.cinema2.corridor',tiers[0]);report.errors.push(...retiredIssues(retired));meta=await api('inventory')}
    const image=meta.mediaSlots.some(s=>s.accepts.includes('image'))
    if(image){const first=await api('mediaFixture',false,'image','chart');await api('playback',settings.warmupMs,1000);const replacement=await api('mediaFixture',false,'image','tall');await api('playback',settings.warmupMs,1000);const removed=await api('mediaFixture',true,'image');report.sourceSnapshots={first,replacement,removed};if(first.readyResourceCount<1||replacement.readyResourceCount<1||removed.readyResourceCount!==0)report.errors.push('Source replacement/retirement did not reach expected state')}
    report.sourceExercise=image?'executed':'not-applicable to selected stress preset'
    const paused=await api('playback',0,1000,false,true),playing=await api('playback',0,1000);report.transport={paused:{start:paused.startVisualTime,end:paused.endVisualTime},resumed:{start:playing.startVisualTime,end:playing.endVisualTime}};if(paused.endVisualTime!==paused.startVisualTime||playing.endVisualTime<=playing.startVisualTime)report.errors.push('Pause/resume visual time invariant failed')
    report.recovery=await api('recoverContext')
    if(report.recovery.supported){const resumed=await api('playback',settings.warmupMs,1000);report.errors.push(...summarizePlayback(resumed,report.environment.refreshHz).issues,...ownershipIssues(resumed.resources.at(-1)))}
  })
  const scenarios=Object.values(report.scenarios), failed=report.errors.length||scenarios.some(s=>s.status==='fail')||report.lifecycle.some(s=>s.issues.length)||report.stress?.status==='fail'||report.stress?.resourceIssues.length
  report.gates.browserTechnical=failed?'fail':report.recovery?.supported&&imageExerciseComplete(report)?'pass':'incomplete'
  const completeMatrix=!smoke&&coverage.fullInventory&&tiers.length===3&&settings.warmupMs>=10000&&settings.measureMs>=60000&&settings.stressMs>=600000&&settings.cycles>=20
  report.gates.hardwareTiming=failed?'fail':report.gates.browserTechnical==='pass'&&completeMatrix&&!report.environment.headless&&report.environment.rendererClass==='hardware-reported'&&report.environment.driver&&report.environment.display&&report.environment.refreshHz&&revision&&scenarios.every(s=>s.gpuStatus==='measured')&&report.stress.gpuStatus==='measured'?'pass':'incomplete'
  if(opt('baseline')){const bytes=await readFile(resolve(opt('baseline')));report.baselineHash=hash(bytes);report.comparison=comparePlayback(JSON.parse(bytes),report);report.gates.performanceComparison=report.comparison.status}
}catch(error){report.blockers.push(error?.code??error?.message??'Execution blocked');report.gates.browserTechnical=Object.keys(report.scenarios).length?'fail':'incomplete';report.gates.hardwareTiming='not-run'}
finally{await browser?.close();await vite?.close();await save()}
// Smoke is intentionally not hardware or full release acceptance.
process.exitCode=report.gates.browserTechnical==='pass'&&(smoke||report.gates.hardwareTiming==='pass')&&(!opt('baseline')||report.gates.performanceComparison==='pass')?0:1
