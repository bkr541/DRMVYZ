import test from 'node:test'
import assert from 'node:assert/strict'
import { inventory, pixelEvidence, visibleIssues, controlEvidence, p95, regressionIssues, retiredIssues } from './release-acceptance-core.mjs'
const rgb=(r,g,b)=>Uint8Array.from(Array.from({length:81},()=>[r,g,b]).flat())
test('release inventory covers all available review anchors without duplicate IDs',()=>{
  assert.equal(new Set(inventory).size,inventory.length);assert.ok(inventory.length>=16)
  for(const key of ['spectrum','hud','honey','purity','colossus','overdrive','crate-wireframe-portal'])assert.ok(inventory.includes(key))
})
test('blank and flat bright output fail; dark spatial detail is not rejected',()=>{
  for(const frame of [rgb(0,0,0),rgb(255,255,255),rgb(50,100,150)])assert.ok(visibleIssues('honey',pixelEvidence(frame,9,9),'default').length)
  const dark=rgb(0,0,0);dark[0]=3;assert.deepEqual(visibleIssues('honey',pixelEvidence(dark,9,9),'default'),[])
  assert.ok(visibleIssues('spectrum',pixelEvidence(dark,9,9),'default').length)
})
test('ignored control and unchanged noisy control fail; actual change passes',()=>{
  const a=rgb(10,10,10), noise=rgb(11,10,10), b=rgb(200,40,10)
  assert.equal(controlEvidence(a,a,a).pass,false);assert.equal(controlEvidence(a,noise,noise).pass,false)
  assert.equal(controlEvidence(a,noise,b).pass,true)
})
test('p95 and comparative regression gate are not pass-by-absence',()=>{
  assert.equal(p95([1,2,3,4]),4);assert.throws(()=>p95([]))
  const make=(cpuP95,gpuBytes)=>({config:{},environment:{},inventory:['honey'],presets:{honey:{status:'pass',metrics:{default:{cpuP95,gpuBytes,settings:'x',width:960,height:540}}}}})
  assert.deepEqual(regressionIssues(make(4,100),make(5,100)),[])
  assert.equal(regressionIssues(make(4,100),make(100,100)).length,1)
  assert.equal(regressionIssues(make(4,100),{...make(4,100),presets:{}}).length,1)
})
test('retired allocations fail even when runtime reports disposed',()=>{
  const d={runtime:{phase:'disposed',resources:{activeAnimationFrameCount:0}},modules:{activeResourceLeaseCount:0,estimatedGpuBytes:0},resources:{activeLeaseCount:0,estimatedGpuMemoryBytes:0},media:{readyResourceCount:0},glErrors:[]}
  assert.deepEqual(retiredIssues(d),[]);d.modules.activeResourceLeaseCount=1;assert.equal(retiredIssues(d).length,1)
})
