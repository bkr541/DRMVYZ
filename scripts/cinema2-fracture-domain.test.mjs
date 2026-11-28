// Offline domain checks: node --experimental-strip-types --test scripts/cinema2-fracture-domain.test.mjs
// This exercises the production math, not the production WebGL render path.
import test from 'node:test'
import assert from 'node:assert/strict'
import { FRACTURE_PATTERNS, FRACTURE_TRAVEL, tessellate, polygonArea, insetPolygon, shardPose, ruptureField, fieldPose } from '../src/components/vyzualz/cinema2/modules/fracture/FractureDomain.ts'

const defaults = {pattern:'scatter',phase:Math.PI,spread:.82,depthTravel:.85,rotation:42,reassemblyTime:.75,active:true,intensity:.88,safe:true,locked:false,readability:true,vocal:0,kick:0,snare:0,drop:0,bass:0,mid:0,build:0,downbeat:0,phrase:0,impact:0,high:0,energy:0,beat:0,crackEmission:.68,sphereExpansion:.94,orbitalMotion:.65,shardVibration:.60,clusterReconstruction:.70,sub:0}
const length = ({x,y,z,rx,ry,rz}) => Math.hypot(x,y,z,rx,ry,rz)
const close = (a,b,tolerance=1e-8) => assert.ok(Math.abs(a-b)<tolerance, `${a} != ${b}`)
const total = (shards, motion) => shards.reduce((n,s)=>n+length(shardPose(s,motion)),0)

test('315 count/seed combinations partition the source and have connected area-ranked topology',()=>{
  for(let count=16;count<=120;count++) for(const seed of [0,17,65535]){
    const shards=tessellate(count,seed)
    assert.equal(shards.length,count)
    assert.deepEqual(shards,tessellate(count,seed))
    close(shards.reduce((sum,s)=>sum+polygonArea(s.polygon),0),36)
    const visited=new Set();let area=0
    for(const s of [...shards].sort((a,b)=>a.assemblyRank-b.assemblyRank)){
      assert.ok(s.area>.01&&polygonArea(insetPolygon(s,.16))>0)
      assert.ok(s.route>=0)
      if(visited.size)assert.ok(s.neighbors.some(n=>visited.has(n)))
      visited.add(s.id);area+=s.area;close(s.assemblyRank,area/36)
      for(const n of s.neighbors)assert.ok(shards[n].neighbors.includes(s.id))
      for(const p of s.polygon)assert.ok(Math.abs(p.x)<=4+1e-8&&Math.abs(p.y)<=2.25+1e-8)
    }
  }
})

test('major fracture regions are connected and preserve rigid early plate transforms',()=>{
  const shards=tessellate(40,17),groups=new Set(shards.map(s=>s.group))
  assert.equal(groups.size,7)
  assert.ok(Math.max(...shards.map(s=>s.area))/Math.min(...shards.map(s=>s.area))>8)
  assert.ok(shards.some(s=>s.polygon.length===3))
  for(const group of groups){
    const cells=shards.filter(s=>s.group===group),seen=new Set([cells[0].id]),queue=[cells[0]]
    for(let i=0;i<queue.length;i++)for(const id of queue[i].neighbors)if(shards[id].group===group&&!seen.has(id)){seen.add(id);queue.push(shards[id])}
    assert.equal(seen.size,cells.length)
    const poses=cells.map(s=>shardPose(s,{...defaults,pattern:'fracture',phase:Math.PI*2*.22}))
    for(const p of poses){close(p.z,poses[0].z);close(p.rz,poses[0].rz);close(p.rx,0);close(p.ry,0)}
  }
})

test('actual media centers reach front and rear depth at the authored defaults',()=>{
  const shards=tessellate(40,17),poses=shards.map(s=>shardPose(s,defaults)),depth=poses.map(p=>p.z)
  assert.ok(Math.min(...depth)<-3&&Math.max(...depth)>3)
  assert.ok(depth.filter(z=>Math.abs(z)>1.5).length>15)
  assert.ok(Math.max(...poses.map((p,i)=>Math.abs(shards[i].center.x+p.x)))>4.5)
  const flat=shards.map(s=>shardPose(s,{...defaults,sphereExpansion:0}))
  assert.ok(Math.max(...flat.map(p=>Math.abs(p.z)))<Math.max(...depth)*.25)
  console.log(`Default media depth: ${Math.min(...depth).toFixed(2)} to ${Math.max(...depth).toFixed(2)}; ${depth.filter(z=>Math.abs(z)>1.5).length}/${depth.length} outside central +/-1.5 depth`)
})

test('connected reconstruction is source-area based and reaches the complete source plane',()=>{
  const shards=tessellate(40,17).sort((a,b)=>a.assemblyRank-b.assemblyRank)
  for(const [phase,low,high] of [[.63,.4,.7],[.73,.7,.85],[.99,.999,1.001]]){
    const home=shards.filter(s=>length(shardPose(s,{...defaults,pattern:'reconstruction',phase:Math.PI*2*phase}))<1e-8)
    const fraction=home.reduce((sum,s)=>sum+s.area,0)/36
    assert.ok(fraction>=low&&fraction<=high,`reconstructed area ${fraction}`)
    assert.deepEqual(home.map(s=>s.id),shards.slice(0,home.length).map(s=>s.id))
    console.log(`Reconstruction at phase ${phase}: ${(fraction*100).toFixed(1)}% of source area`)
  }
})

test('directional and dual-front reconstruction use precomputed area ranks',()=>{
  const shards=tessellate(40,17)
  assert.equal(new Set(Array.from({length:7},(_,route)=>JSON.stringify(shards.map(s=>s.assemblyRanks[route])))).size,7)
  for(let route=0;route<7;route++){
    const sorted=[...shards].sort((a,b)=>a.assemblyRanks[route]-b.assemblyRanks[route]);let area=0,roots=0;const seen=new Set()
    for(const s of sorted){if(!s.neighbors.some(n=>seen.has(n)))roots++;seen.add(s.id);area+=s.area;close(s.assemblyRanks[route],area/36)}
    assert.ok(roots<= (route===6?2:1))
    for(const s of shards)close(length(shardPose(s,{...defaults,pattern:'reconstruction',phase:Math.PI*2*(route+.99)})),0)
  }
})

test('six distinct programs remain finite and bounded with extreme musical cues and hard lock',()=>{
  const shards=tessellate(40,17)
  assert.equal(new Set(FRACTURE_PATTERNS.map(({value})=>JSON.stringify(shards.map(s=>shardPose(s,{...defaults,pattern:value}))))).size,6)
  for(const {value} of FRACTURE_PATTERNS)for(const s of shards){
    close(length(shardPose(s,{...defaults,pattern:value,phase:Math.PI*2*.99})),0)
    close(length(shardPose(s,{...defaults,pattern:value,locked:true,drop:1})),0)
    close(length(shardPose(s,{...defaults,pattern:value,active:false,drop:1})),0)
    close(length(shardPose(s,{...defaults,pattern:value,spread:0,depthTravel:0,rotation:0,drop:1})),0)
    for(let i=0;i<60;i++){
      const p=shardPose(s,{...defaults,pattern:value,phase:i*Math.PI/30,spread:1,depthTravel:1,rotation:70,intensity:1,safe:false,kick:1,drop:1,mid:1,build:1,bass:1,sub:1,snare:1,high:1,downbeat:1,phrase:1})
      assert.ok(Object.values(p).every(Number.isFinite))
      for(const axis of ['x','y','z'])assert.ok(Math.abs(p[axis])<=FRACTURE_TRAVEL[axis])
      for(const axis of ['rx','ry','rz'])assert.ok(Math.abs(p[axis])<=70*Math.PI/180)
      assert.ok(p.light>=0&&p.light<=1)
    }
  }
})

test('musical and authored controls influence physical motion; debris stays small and deterministic',()=>{
  const shards=tessellate(40,17)
  assert.ok(total(shards,{...defaults,build:1})<total(shards,defaults))
  assert.ok(total(shards,{...defaults,vocal:1})<total(shards,defaults))
  assert.ok(total(shards,{...defaults,phase:0,drop:1})>total(shards,{...defaults,phase:0}))
  assert.ok(total(shards,{...defaults,phase:0,kick:1})>0)
  assert.ok(shards.some(s=>Math.abs(length(shardPose(s,{...defaults,bass:1,sub:1}))-length(shardPose(s,{...defaults,bass:1,sub:1,shardVibration:0})))>.01))
  assert.ok(shards.some(s=>Math.abs(length(shardPose(s,defaults))-length(shardPose(s,{...defaults,orbitalMotion:0})))>.01))
  const field=ruptureField(17)
  assert.equal(field.length,72);assert.deepEqual(field,ruptureField(17));assert.notDeepEqual(field,ruptureField(18))
  assert.ok(field.every(f=>f.thickness>0&&f.thickness<.12&&f.width<1.1&&f.height<.7))
  assert.ok(field.some(f=>f.z>3)&&field.some(f=>f.z< -3))
  for(const f of field)assert.deepEqual(fieldPose(f,{...defaults,locked:true,drop:1}),{x:f.x,y:f.y,z:f.z,rx:f.rx,ry:f.ry,rz:f.rz})
})
