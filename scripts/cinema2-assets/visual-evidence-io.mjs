// VIS-01: bind evidence to actual source bytes, not a Git HEAD which may omit local patches.
import { createHash } from 'node:crypto'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { reportStatus, fullInventoryStatus } from './release-acceptance-core.mjs'
import { inventory, capabilityPlan } from './reviewed-release-inventory.mjs'
import { cases, digest, validateCapture } from './quality-review-core.mjs'
export const hash = data => createHash('sha256').update(data).digest('hex')
export async function sourceRevision(root) {
  const h=createHash('sha256')
  async function visit(path) {
    // Approved artwork must not invalidate another preset's review.
    if(path==='public/preset-artwork')return
    const s=await stat(join(root,path))
    if(s.isDirectory())for(const name of (await readdir(join(root,path))).sort())await visit(`${path}/${name}`)
    else if(s.isFile()){h.update(`${path}\0${s.size}\0`);h.update(await readFile(join(root,path)))}
  }
  for(const path of ['src','public','electron','native','scripts/cinema2-assets','scripts/generate-preset-artwork.mjs','package.json','package-lock.json','vite.config.ts','index.html'])await visit(path)
  return h.digest('hex')
}
export function seal(report){return {...report,hash:hash(JSON.stringify(report))}}
export async function readSealed(path) {
  const {hash:recorded,...report}=JSON.parse(await readFile(path,'utf8'))
  if(!digest(recorded)||hash(JSON.stringify(report))!==recorded)throw Error(`Report changed or unsealed: ${path}`)
  return {...report,hash:recorded}
}
export async function verifyFile(folder,name,sha256) {
  if(typeof name!=='string'||!/^[-a-zA-Z0-9_]+\.png$/.test(name)||!digest(sha256)||hash(await readFile(join(folder,name)))!==sha256)throw Error(`Missing or changed capture: ${name}`)
}
export async function readCapture(path,id) {
  const report=await readSealed(path);validateCapture(report,id)
  for(const f of report.frames)await verifyFile(dirname(path),f.name,f.sha256)
  await verifyFile(dirname(path),'contact-sheet.png',report.contactSheet.sha256)
  return report
}
export async function readMatrix(path,key) {
  const report=await readSealed(path)
  const p=report.presets?.[key]
  if(!digest(report.sourceRevision)||!p||report.technicalStatus!=='pass'||report.gates?.browserTechnical!=='pass'||reportStatus(report)!=='pass'||fullInventoryStatus(report)!=='pass')throw Error('Full reviewed technical matrix is missing, incomplete or failed')
  const required=['scenario:manual-controls','scenario:patterns','scenario:camera','scenario:transport-auto','scenario:trigger-matrix','scenario:media','scenario:model','scenario:reentry','frame:default','final-dispose']
  for(const k of inventory){const r=report.presets[k];if(required.some(n=>!r.required.includes(n)||!r.checks.some(c=>c.name===n&&['pass','not-applicable'].includes(c.status))))throw Error(`Missing mandatory technical gate: ${k}`)}
  const caps=capabilityPlan(p.manifest)
  const must=['frame:default','final-dispose','scenario:patterns','scenario:reentry','scenario:manual-controls','scenario:transport-auto','pattern-trigger-transition','context-restored',...Object.keys(caps.media).filter(k=>caps.media[k].length).map(k=>`media-format:${k}`),...(caps.model?['model-material-fidelity','model-loaded','model-pixel-evidence','model-fallback-evidence']:[]),...(caps.camera.permission||caps.camera.mode?['camera-off-lock','camera-on-evidence']:[])]
  if(must.some(n=>!p.checks.some(c=>c.name===n&&c.status==='pass')))throw Error('Missing applicable technical pass')
  const folder=join(dirname(path),key)
  if(new Set(p.frames.map(f=>f.file)).size!==p.frames.length)throw Error('Duplicate matrix frames')
  for(const f of [...p.frames,...(p.editorReferences??[])])await verifyFile(folder,f.file,f.sha256)
  return {hash:report.hash,sourceRevision:report.sourceRevision,config:report.config,environment:report.environment,manifest:p.manifest,frames:p.frames,editorReferences:p.editorReferences??[],gates:report.gates}
}
export async function readBundle(key,baselineRoot,candidateRoot,baselineMatrixPath,candidateMatrixPath,baselineKind) {
  if(!inventory.includes(key))throw Error('Unknown reviewed preset')
  const id=`drmvyz.cinema2.${key}`
  const load=root=>Promise.all(cases.map(c=>readCapture(join(root,key,c,'report.json'),id)))
  return {id,baselineKind,baseline:await load(baselineRoot),candidate:await load(candidateRoot),baselineMatrix:await readMatrix(baselineMatrixPath,key),candidateMatrix:await readMatrix(candidateMatrixPath,key)}
}
