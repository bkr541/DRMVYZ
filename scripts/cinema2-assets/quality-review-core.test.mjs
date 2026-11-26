import test from 'node:test'
import assert from 'node:assert/strict'
import { subjects, checkpoints, criteria, inspectPixels, pendingRubric, comparable, validateApproval } from './quality-review-core.mjs'

test('dark spatially varied output is not blank; flat black and colored canvases are', () => {
  assert.equal(inspectPixels(Uint8Array.of(0,0,0,0,0,0)).uniform,true)
  assert.equal(inspectPixels(Uint8Array.of(4,2,7,4,2,7)).uniform,true)
  const dark = inspectPixels(Uint8Array.of(0,0,0,1,2,3,0,0,0))
  assert.equal(dark.uniform,false)
  assert.ok(dark.mean < 1)
  assert.throws(()=>inspectPixels([]))
})
test('distinct local signatures, complete timed phase coverage, fresh unapproved rubric', () => {
  assert.equal(Object.keys(subjects).length,7)
  assert.match(subjects.honey[0],/honeycomb/)
  assert.match(subjects.colossus[0],/industrial arms/)
  assert.notDeepEqual(subjects.honey,subjects.colossus)
  assert.deepEqual([...new Set(checkpoints.map(c=>c[0]))],['reference','idle','build','drop','breakdown'])
  for(const stage of ['build','drop','breakdown']) assert.equal(checkpoints.filter(c=>c[0]===stage).reduce((a,c)=>a+c[1],0),60)
  const first=pendingRubric(); first.subjectLegibility.status='pass'
  assert.equal(pendingRubric().subjectLegibility.status,'pending')
})
const report=(hash='base')=>({hash,complete:true,errors:[],config:{width:960,height:540,quality:'high'},inventory:{id:'drmvyz.cinema2.honey',parameters:'{"values":{}}',metadata:{name:'HONEY'}},frames:[{name:'00-reference.png',failed:false,pixels:{uniform:false}}]})
const review=()=>({baselineHash:'base',candidateHash:'candidate',reviewer:'Reviewer',approvedAt:'2026-11-26T00:00:00Z',decision:'approved',thumbnailFrame:'00-reference.png',rubric:Object.fromEntries(criteria.map(key=>[key,{status:'pass',evidence:'00-reference.png',reason:'Reviewed'}]))})
test('matching capture settings and unchanged catalog identity required',()=>{
  const a=report(),b=report('candidate'); assert.equal(comparable(a,b),true)
  b.inventory.parameters='{"values":{"x":1}}'; assert.equal(comparable(a,b),false)
  b.inventory.parameters='{"values":{}}'; b.inventory.metadata.name='Other'; assert.equal(comparable(a,b),false)
  b.inventory=null; assert.equal(comparable(a,b),false)
})
test('publication is bound to reviewed before/after records and real nonblank candidate',()=>{
  const a=report(), b=report('candidate'), r=review()
  assert.equal(validateApproval(r,a,b),b.frames[0])
  assert.throws(()=>validateApproval({...r,decision:'pending'},a,b),/approval/)
  assert.throws(()=>validateApproval({...r,candidateHash:'other'},a,b),/bound/)
  assert.throws(()=>validateApproval({...r,thumbnailFrame:'missing.png'},a,b),/nonblank/)
  r.rubric.noClipping.status='not-applicable'; assert.throws(()=>validateApproval(r,a,b),/Cannot waive/)
  r.rubric.noClipping.status='pass'; r.rubric.mediaFidelity.status='not-applicable'; assert.equal(validateApproval(r,a,b),b.frames[0])
  b.frames[0].pixels.uniform=true; assert.throws(()=>validateApproval(r,a,b),/nonblank/)
  b.frames[0].failed=true; assert.throws(()=>validateApproval(r,a,b),/failed candidate/)
})
