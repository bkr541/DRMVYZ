import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { readAsset } from './asset-tools/io.mjs'
import { validateFile } from './asset-tools/validate.mjs'
test('prepared NEON FOREST preserves provenance, complete semantic geometry and source-safe travel',async()=>{
 const bytes=await readFile('scripts/cinema2-assets/sources/neon-forest/neon_stage.glb')
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'a8ca9b80117027adb23db5c4d80e00fa42e7b6071291f295484a77099563e4bb')
 const path='public/cinema2/models/neon-forest-static.glb',validation=await validateFile(path)
 assert.equal(validation.numErrors,0)
 const {document}=await readAsset(path),root=document.getRoot()
 assert.equal(root.listMeshes().length,4)
 assert.equal(new Set(root.listNodes().map(n=>n.getName())).size,root.listNodes().length)
 for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives()){
  const count=p.getAttribute('POSITION').getCount()
  for(const key of ['_NF_ROOT','_NF_HEIGHT','_NF_ID','_NF_ROLE'])assert.equal(p.getAttribute(key).getCount(),count)
 }
 const report=JSON.parse(await readFile('docs/NEON_FOREST/NEON_FOREST-asset-report.json','utf8'))
 assert.ok(report.clusters.filter(c=>c.source).length>1000)
 assert.ok(report.clusters.some(c=>!c.source&&c.root[2]<-20))
 // Source component boxes are exact. A .75 deformation plus scale margin still
 // leaves the +/- .3 aisle camera and its near plane well inside clear space.
 for(const c of report.clusters.filter(c=>c.source))assert.ok(c.bounds.min[0]>=2.45||c.bounds.max[0]<=-2.1||c.bounds.min[2]>=22||c.bounds.max[2]<=-18)
 assert.ok(report.inspection.memory.totalBytes<33554432)
})
