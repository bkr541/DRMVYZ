import test from 'node:test'
import assert from 'node:assert/strict'
import { materialRegions, compareMaterialRegions, authoredMaterialEvidence } from './model-fidelity-evidence.mjs'

const frame = () => ({ width: 48, height: 40, data: new Uint8Array(48*40*3) })
const copy = f => ({...f,data:f.data.slice()})
const fill = (f,x,y,w,h,rgb) => { for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)f.data.set(rgb,(j*f.width+i)*3) }
function fixture() {
  const native=frame(),primary=frame()
  fill(primary,4,4,8,8,[220,20,20]);fill(primary,18,4,8,8,[20,220,20]);fill(primary,32,4,8,8,[20,20,220])
  fill(primary,18,22,8,8,[150,20,100]);fill(primary,32,22,8,8,[220,220,220]);fill(primary,34,24,4,4,[0,0,0])
  for(let i=4;i<12;i++)fill(primary,i,22,1,8,i%2?[220,220,220]:[35,35,35])
  const repeat=copy(primary),wrongColor=copy(primary),opaque=copy(primary),noTexture=copy(primary),noMask=copy(primary)
  fill(wrongColor,4,4,8,8,[20,220,20]);fill(opaque,18,22,8,8,[20,20,220]);fill(noTexture,4,22,8,8,[220,220,220]);fill(noMask,34,24,4,4,[220,220,220])
  return {native,primary,repeat,wrongColor,opaque,noTexture,noMask}
}
test('matched local material signatures and independent editor/production evidence pass',()=>{
  const f=fixture(),production=materialRegions(f),editor=materialRegions({...f,native:undefined})
  assert.equal(production.status,'pass',JSON.stringify(production));assert.equal(editor.status,'pass');assert.equal(compareMaterialRegions(editor,production).status,'pass')
  assert.ok(production.evidence.regions.mask>=8);assert.ok(production.evidence.textureEdges>=3)
})
test('wrong color, opaque blend, missing texture, filled MASK or invisible model cannot pass',()=>{
  for(const variant of ['wrongColor','opaque','noTexture','noMask']){
    const f=fixture();f[variant]=copy(f.primary);assert.equal(materialRegions(f).status,'fail',variant)
  }
  const f=fixture();f.primary=copy(f.native);f.repeat=copy(f.native);assert.equal(materialRegions(f).status,'fail')
})
test('missing controls, dimensions mismatch and absent editor are incomplete',()=>{
  const f=fixture();assert.equal(materialRegions({...f,noMask:undefined}).status,'incomplete');assert.equal(materialRegions({...f,repeat:{...f.repeat,width:1}}).status,'incomplete')
  assert.equal(compareMaterialRegions(null,materialRegions(f)).status,'incomplete')
})
test('authored material diagnostics require exact source channels and named inventory',()=>{
  const a={name:'blend',color:'ff0000',roughness:.5,metalness:.1,emissive:'000000',emissiveIntensity:1,opacity:.35,transparent:true,alphaTest:0,depthWrite:false,side:2,map:{colorSpace:'srgb',offset:[0,0]},normalMap:null,alphaMap:null}
  assert.equal(authoredMaterialEvidence([a],[{...a,environment:'neutral'}]).status,'pass')
  for(const modified of [{opacity:1},{transparent:false},{map:null},{color:'00ff00'},{side:0},{roughness:.9}])assert.equal(authoredMaterialEvidence([a],[{...a,...modified}]).status,'fail')
  assert.equal(authoredMaterialEvidence([a],[a,a]).status,'fail');assert.equal(authoredMaterialEvidence([a],[]).status,'incomplete')
})
