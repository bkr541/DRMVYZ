import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizePlayback, ownershipIssues, steadyStateIssues, rendererClass, comparePlayback } from './performance-evidence.mjs'
const raw={intervals:[16,17,33],cpu:[1,2,3],gpu:[2,3],elapsedMs:66,measuredFrames:3,startSnapshot:{frameCount:10},finalSnapshot:{frameCount:13},gpuSupported:true,disjointCount:0,glError:0}
test('delivery and CPU/GPU are separate, missing GPU never becomes zero',()=>{
  const x=summarizePlayback(raw,60);assert.equal(x.status,'pass');assert.equal(x.deliveredFps,3000/66);assert.equal(x.estimatedMissedRefreshes,1);assert.equal(x.cpu.p95,3);assert.equal(x.gpu.count,2)
  assert.equal(summarizePlayback({...raw,gpuSupported:false,gpu:[]},60).gpu,null)
  assert.equal(summarizePlayback({...raw,disjointCount:1},60).gpuStatus,'disjoint')
  assert.equal(summarizePlayback({...raw,measuredFrames:4},60).status,'fail')
  assert.equal(summarizePlayback({...raw,glError:1282},60).status,'fail')
  assert.equal(summarizePlayback(raw,null).estimatedMissedRefreshes,null)
})
const snap={owners:{activeRuntimeCount:1,activeTargetResolverCount:1,activeWebGLContextCount:1,activeAnimationFrameCount:1,activeEventListenerCount:2},resources:{activeLeaseCount:2,estimatedGpuMemoryBytes:100,pooledAllocationCount:1,maximumPooledAllocationCount:3,maximumEstimatedGpuMemoryBytes:1000},modules:{activeResourceLeaseCount:1,estimatedGpuBytes:100},modelCache:{heldCount:0}}
test('leak tripwires distinguish bounded warm cache and retired ownership',()=>{
  assert.deepEqual(steadyStateIssues([snap,snap]),[])
  assert.ok(steadyStateIssues([snap,{...snap,resources:{...snap.resources,activeLeaseCount:3}}]).length)
  assert.ok(ownershipIssues(snap,true).length)
  assert.ok(ownershipIssues({...snap,owners:{...snap.owners,activeWebGLContextCount:2}}).length)
})
test('comparison requires compatible hardware and evidence; regression propagates',()=>{
  const environment=Object.fromEntries(['platform','osRelease','arch','cpu','browser','renderer','display','refreshHz','dpr','fixtureHash','driver','capture','config','screen','headless','allowSoftware'].map(k=>[k,'same']))
  environment.rendererClass='hardware-reported';environment.headless=false;environment.allowSoftware=false
  const measurement={...summarizePlayback(raw,60),settings:'same',gpuBytes:100}
  const before={revision:'a',environment,scenarios:{a:measurement}},after={...before,revision:'b'}
  assert.equal(comparePlayback(before,after).status,'pass')
  assert.equal(comparePlayback(before,{...after,environment:{...environment,driver:null}}).status,'incomplete')
  assert.equal(comparePlayback(before,{...after,environment:{...environment,rendererClass:'software'}}).status,'incomplete')
  assert.equal(comparePlayback(before,{...after,scenarios:{a:{...measurement,gpuStatus:'disjoint'}}}).status,'incomplete')
  assert.equal(comparePlayback(before,{...after,scenarios:{a:{...measurement,deliveredFps:1}}}).status,'fail')
  assert.equal(rendererClass('ANGLE (Google, Vulkan SwiftShader)'), 'software')
})
