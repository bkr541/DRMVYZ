import test from 'node:test'
import assert from 'node:assert/strict'
import { subjects, checkpoints, criteria, inspectPixels, pendingRubric, comparable, validateApproval, cases, binding, evidenceIndex, catalogPath, validateBundle } from './quality-review-core.mjs'

test('dark spatially varied output is not blank; flat black and colored canvases are', () => {
  assert.equal(inspectPixels(Uint8Array.of(0,0,0,0,0,0)).uniform,true)
  assert.equal(inspectPixels(Uint8Array.of(4,2,7,4,2,7)).uniform,true)
  const dark = inspectPixels(Uint8Array.of(0,0,0,1,2,3,0,0,0))
  assert.equal(dark.uniform,false)
  assert.ok(dark.mean < 1)
  assert.throws(()=>inspectPixels([]))
})
test('distinct local signatures, complete timed phase coverage, fresh unapproved rubric', () => {
  assert.equal(Object.keys(subjects).length,21)
  assert.match(subjects.honey[0],/honeycomb/)
  assert.match(subjects.colossus[0],/industrial arms/)
  assert.notDeepEqual(subjects.honey,subjects.colossus)
  assert.deepEqual([...new Set(checkpoints.map(c=>c[0]))],['reference','idle','build','drop','breakdown'])
  for(const stage of ['build','drop','breakdown']) assert.equal(checkpoints.filter(c=>c[0]===stage).reduce((a,c)=>a+c[1],0),60)
  const first=pendingRubric(); first.subjectLegibility.status='pass'
  assert.equal(pendingRubric().subjectLegibility.status,'pending')
})
// Synthetic records exercise only the policy, never represent real render evidence.
const sha='a'.repeat(64), revision='b'.repeat(64), old='c'.repeat(64)
const id='drmvyz.cinema2.honey'
const manifest={id,revision:1,parameters:'{"values":{}}',metadata:{name:'HONEY'},patterns:[{value:'one'}],controls:[],mediaSlots:[],modules:[],cameras:[]}
const capture=(key,sourceRevision=revision)=>{
  const [mode,aspect]=key.split('/'),[width,height]=aspect==='landscape'?[960,540]:[540,960]
  const frames=checkpoints.map(([stage,count],i)=>({name:`${String(i).padStart(2,'0')}-${stage}.png`,stage,stageFrame:i+1,timings:Array(count).fill(1),musicTime:i,settings:manifest.parameters,parametersUnchanged:true,diagnostics:{runtime:{viewport:{width,height}}},sha256:sha,failed:false,pixels:{uniform:false}}))
  return {schemaVersion:2,hash:sha,sourceRevision,environment:{chromium:'fixture',gl:{renderer:'fixture'}},complete:true,disposed:{phase:'disposed'},errors:[],config:{fixture:'sys04-review-v1',fps:30,dpr:1,width,height,quality:'high',mode,aspect,checkpoints},inventory:structuredClone(manifest),frames,contactSheet:{sha256:sha,order:frames.map(f=>f.name)}}
}
function bundle(){
  const matrix=sourceRevision=>({sourceRevision,hash:sha,config:{},environment:{chromium:'fixture',gl:{renderer:'fixture'}},manifest:structuredClone(manifest),frames:['a-0','a-1','a-2','build','drop','hold'].map(s=>({name:`pattern-0-${s}`,file:`pattern-0-${s}.png`,settings:manifest.parameters,sha256:sha}))})
  return {id,baselineKind:'prospective',baseline:cases.map(c=>capture(c,old)),candidate:cases.map(c=>capture(c)),baselineMatrix:matrix(old),candidateMatrix:matrix(revision)}
}
function approval(b){return {binding:binding(b),reference:'Original unavailable',reviewer:'Synthetic test reviewer',approvedAt:'2026-11-26T00:00:00Z',decision:'approved',thumbnailFrame:'00-reference.png',rubric:Object.fromEntries(criteria.map(key=>[key,{status:key==='mediaFidelity'?'not-applicable':'pass',evidence:evidenceIndex(b),reason:'Synthetic test'}]))}}
test('matching capture settings and unchanged catalog identity required',()=>{
  const a=capture(cases[0]),b=capture(cases[0]);assert.equal(comparable(a,b),true)
  b.inventory.parameters='{"values":{"x":1}}';assert.equal(comparable(a,b),false)
  b.inventory.parameters=manifest.parameters;b.inventory.metadata.name='Other';assert.equal(comparable(a,b),false)
  b.inventory=null;assert.equal(comparable(a,b),false)
})
test('approved publication plan maps to exact reviewed catalog asset; no writes',()=>{
  const b=bundle(),r=approval(b),result=validateApproval(r,b,revision)
  assert.equal(result.path,'public/preset-artwork/drmvyz.cinema2.honey.webp')
  assert.equal(result.frame,b.candidate[0].frames[0]);assert.throws(()=>catalogPath('../honey'),/catalog/)
  assert.notEqual(catalogPath('drmvyz.cinema2.monolith'),catalogPath('drmvyz.cinema2.monument'))
})
test('reject absent reviewer, pending or failed criteria, stale revision, changed hashes, bad evidence and blank thumbnail',()=>{
  const b=bundle(),r=approval(b)
  assert.throws(()=>validateApproval({...r,reviewer:''},b,revision),/human approval/)
  assert.throws(()=>validateApproval({...r,decision:'pending'},b,revision),/human approval/)
  assert.throws(()=>validateApproval(r,b,old),/Stale/)
  r.binding.candidateHashes[0][1]=old;assert.throws(()=>validateApproval(r,b,revision),/bound/)
  r.binding=binding(b);r.rubric.noClipping.status='fail';assert.throws(()=>validateApproval(r,b,revision),/Unresolved/)
  r.rubric.noClipping.status='not-applicable';assert.throws(()=>validateApproval(r,b,revision),/Cannot waive/)
  r.rubric.noClipping.status='pass';r.rubric.noClipping.evidence=[{ref:'invented',sha256:sha}];assert.throws(()=>validateApproval(r,b,revision),/invalid evidence/)
  r.rubric.noClipping.evidence=evidenceIndex(b);r.thumbnailFrame='missing.png';assert.throws(()=>validateApproval(r,b,revision),/nonblank/)
  r.thumbnailFrame='01-idle.png';b.candidate[0].frames[1].pixels.uniform=true;assert.throws(()=>validateApproval(r,b,revision),/nonblank/)
})
test('reject missing or failed baseline/candidate cases and unmatched technical settings',()=>{
  let b=bundle();b.baseline[0].errors.push('GL error');assert.throws(()=>validateBundle(b,revision),/failed capture/)
  b=bundle();b.candidate[0].frames.pop();assert.throws(()=>validateBundle(b,revision),/failed capture/)
  b=bundle();b.candidate.pop();assert.throws(()=>validateBundle(b,revision),/Missing required/)
  b=bundle();b.candidate[0].frames[0].failed=true;assert.throws(()=>validateBundle(b,revision),/failed capture/)
  b=bundle();b.baseline[0].environment.chromium='other';assert.throws(()=>validateBundle(b,revision),/configurations/)
  b=bundle();b.candidateMatrix.frames[0].settings='{"values":{"x":1}}';assert.throws(()=>validateBundle(b,revision),/Incompatible/)
  b=bundle();b.candidateMatrix.frames.pop();b.baselineMatrix.frames.pop();assert.throws(()=>validateBundle(b,revision),/pattern sequence/)
})
test('supported media cannot be waived; pattern sequence evidence must actually be reviewed',()=>{
  const b=bundle(),r=approval(b)
  r.rubric.patternDistinction.evidence=r.rubric.patternDistinction.evidence.filter(e=>!e.ref.includes('pattern-0-a-2'))
  assert.throws(()=>validateApproval(r,b,revision),/pattern sequence/)
  for(const report of [...b.baseline,...b.candidate,b.baselineMatrix,b.candidateMatrix]){
    const m=report.inventory??report.manifest;m.mediaSlots=[{id:'slot',accepts:['image']}]
  }
  const r2=approval(b);assert.throws(()=>validateApproval(r2,b,revision),/Cannot waive mediaFidelity/)
})

test('sealed report and frame bytes are re-read and tampering is rejected',async()=>{
  const {mkdtemp,writeFile,rm}=await import('node:fs/promises')
  const {tmpdir}=await import('node:os'),{join}=await import('node:path')
  const {seal,readSealed,verifyFile,hash,readMatrix}=await import('./visual-evidence-io.mjs')
  const dir=await mkdtemp(join(tmpdir(),'vis01-test-'))
  try {
    const path=join(dir,'report.json'), bytes=Buffer.from('synthetic fixture bytes')
    await writeFile(path,JSON.stringify(seal({status:'pending'})))
    assert.equal((await readSealed(path)).status,'pending')
    await assert.rejects(readMatrix(path,'honey'),/technical matrix/)
    await writeFile(join(dir,'frame.png'),bytes);await verifyFile(dir,'frame.png',hash(bytes))
    await writeFile(join(dir,'frame.png'),'modified');await assert.rejects(verifyFile(dir,'frame.png',hash(bytes)),/changed capture/)
    await assert.rejects(verifyFile(dir,'../frame.png',hash(bytes)),/changed capture/)
    await writeFile(path,JSON.stringify({...seal({status:'pending'}),status:'approved'}))
    await assert.rejects(readSealed(path),/changed or unsealed/)
  } finally {await rm(dir,{recursive:true,force:true})}
})
