// Reproducible prepared crystal grove. Source transforms are baked; no imported
// sky or invalid affine node survives. Animation is owned by Cinema 2.0.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { optionalSourceDirectory, requiredSource } from './optional-source.mjs'
import { Document } from '@gltf-transform/core'
import { dedup, prune, quantize, weld } from '@gltf-transform/functions'
import { EXTMeshoptCompression } from '@gltf-transform/extensions'
import { MeshoptEncoder } from 'meshoptimizer'
import * as T from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import sharp from 'sharp'
import { readAsset, writeGlb } from './asset-tools/io.mjs'
import { inspectDocument } from './asset-tools/inspect.mjs'
import { validateFile } from './asset-tools/validate.mjs'
const root = resolve(import.meta.dirname, '../..'), out = resolve(root, 'public/cinema2/models')
const sourcePath = requiredSource(optionalSourceDirectory(root, 'neon-forest', 'scripts/cinema2-assets/sources/neon-forest'), 'neon_stage.glb')
const bytes = await readFile(sourcePath), sha256 = createHash('sha256').update(bytes).digest('hex')
if (sha256 !== 'a8ca9b80117027adb23db5c4d80e00fa42e7b6071291f295484a77099563e4bb') throw new Error('NEON FOREST source hash changed')
const { document: source } = await readAsset(sourcePath)
const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene('NEON FOREST prepared grove')
const batches = new Map(), clusters = [], shift = new T.Vector3(-.80451658358, 0, 5.74022326037)
let seed = 726132, clusterId = 0, removed = 0
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
const material = (name, color, roughness = .5, metal = .15) => doc.createMaterial(name).setBaseColorFactor([...new T.Color(color).toArray(), 1]).setRoughnessFactor(roughness).setMetallicFactor(metal).setDoubleSided(true)
const crystal = material('neonForest.crystals', '#547784', .32, .4)
const terrainMat = material('neonForest.ground', '#25303b', .82, .1)
const portalMat = material('neonForest.portal', '#515c6b', .26, .35)
const trimMat = material('neonForest.roots', '#376f88', .35, .2)
const srcGround = source.getRoot().listMaterials().find(m => m.getName() === 'Material').getBaseColorTexture()
const groundTexture = doc.createTexture('neon-forest-ground').setImage(await sharp(Buffer.from(srcGround.getImage())).resize(512,512).png().toBuffer()).setMimeType('image/png')
terrainMat.setBaseColorTexture(groundTexture)
function add(g, mat, id, pivot, role, height = 1) {
  const n = g.attributes.position.count, roots = new Float32Array(n * 3), heights = new Float32Array(n), ids = new Float32Array(n), roles = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    roots.set(pivot, i * 3); heights[i] = T.MathUtils.clamp((g.attributes.position.getY(i) - pivot[1]) / height, 0, 1); ids[i] = id; roles[i] = role
  }
  for (const [key, array, size] of [['_NF_ROOT', roots, 3], ['_NF_HEIGHT', heights, 1], ['_NF_ID', ids, 1], ['_NF_ROLE', roles, 1]]) g.setAttribute(key, new T.BufferAttribute(array, size))
  if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(n * 2), 2))
  if (!g.index) g.setIndex(Array.from({ length: n }, (_, i) => i))
  if (!g.attributes.normal) g.computeVertexNormals()
  if (!batches.has(mat)) batches.set(mat, [])
  batches.get(mat).push(g)
}
// Weld positions only for component identification, preserving the original
// faceted normals/UVs in the actual output. Each coherent component stays rooted.
for (const node of source.getRoot().listNodes().filter(n => n.getMesh() && n.getName().startsWith('Cylinder'))) {
  for (const p of node.getMesh().listPrimitives()) {
    const pos = p.getAttribute('POSITION').getArray(), normals = p.getAttribute('NORMAL').getArray(), ids = p.getIndices().getArray(), count = pos.length / 3
    const parent = Array.from({ length: count }, (_, i) => i), weld = new Map()
    const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a] } return a }
    const union = (a,b) => { a=find(a);b=find(b);if(a!==b)parent[b]=a }
    for(let i=0;i<count;i++){const key=[pos[i*3],pos[i*3+1],pos[i*3+2]].map(v=>v.toFixed(6)).join(',');if(weld.has(key))union(i,weld.get(key));else weld.set(key,i)}
    for(let i=0;i<ids.length;i+=3){union(ids[i],ids[i+1]);union(ids[i],ids[i+2])}
    const groups=new Map()
    for(let i=0;i<ids.length;i+=3){const id=find(ids[i]);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(ids[i],ids[i+1],ids[i+2])}
    const matrix=new T.Matrix4().fromArray(node.getWorldMatrix()), normalMatrix=new T.Matrix3().getNormalMatrix(matrix)
    for(const indices of groups.values()) {
      const positions=[],ns=[],vs=[]
      for(const i of indices){const v=new T.Vector3().fromArray(pos,i*3).applyMatrix4(matrix).add(shift);vs.push(v);positions.push(...v.toArray());ns.push(...new T.Vector3().fromArray(normals,i*3).applyNormalMatrix(normalMatrix).toArray())}
      const box=new T.Box3().setFromPoints(vs), center=box.getCenter(new T.Vector3()), h=box.max.y-box.min.y
      // Open a real bidirectional portal corridor, including the return turn.
      if(box.min.x<2.45 && box.max.x>-2.1 && box.min.z<22 && box.max.z>-18){removed++;continue}
      const foot=vs.filter(v=>v.y<=box.min.y+Math.max(.02,h*.06)).reduce((a,v)=>a.add(v),new T.Vector3())
      const feet=vs.filter(v=>v.y<=box.min.y+Math.max(.02,h*.06)).length;foot.divideScalar(feet||1);foot.y=Math.min(box.min.y,0)
      const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(positions,3)).setAttribute('normal',new T.Float32BufferAttribute(ns,3))
      add(g,crystal,clusterId,foot.toArray(),center.x<0?0:1,Math.max(.1,box.max.y-foot.y))
      clusters.push({id:clusterId++,source:true,root:foot.toArray(),height:h,bounds:{min:box.min.toArray(),max:box.max.toArray()}})
    }
  }
}
// Surrounding low-poly prism fans finish the grove from every orbit heading.
for(let i=0;i<260;i++) {
 const angle=random()*Math.PI*2,r=16+random()*28,x=Math.sin(angle)*r,z=Math.cos(angle)*r
 if(Math.abs(x)<3 && z>-20 && z<24)continue
 const h=1.8+random()*7, width=.18+random()*.42, pivot=[x,-.1,z], group=clusterId++
 for(let j=0;j<3;j++){
  const height=h*(j===0?1:.55+random()*.3), lean=(j-1)*(.15+random()*.25)
  const g=new T.CylinderGeometry(width*.18,width,height,5,1,false).translate(0,height/2,0).rotateZ(lean).rotateY(angle).translate(x,-.1,z)
  add(g,crystal,group,pivot,x<0?0:1,h)
 }
 clusters.push({id:group,source:false,root:pivot,height:h})
}
const ground=new T.PlaneGeometry(180,180,1,1).rotateX(-Math.PI/2).translate(0,-.04,0)
const uv=ground.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*6,uv.getY(i)*6)
add(ground,terrainMat,-1,[0,0,0],2)
// A physical toroidal core and twelve articulated rim segments keep the source
// portal's proportions while adding depth and independently moving pieces.
add(new T.TorusGeometry(1.78,.045,6,128).translate(0,2.262,0),portalMat,-2,[0,2.262,0],3)
for(let i=0;i<12;i++){
 const a=i*Math.PI/6,len=Math.PI/6*.72
 const g=new T.TorusGeometry(1.92,.065,5,8,len).rotateZ(a).translate(0,2.262,0)
 add(g,portalMat,-3-i,[0,2.262,0],3)
}
// Root filaments define a ground plane without a flat neon floor wash.
for(let i=0;i<28;i++){
 const a=i*Math.PI*2/28,points=Array.from({length:12},(_,j)=>{const r=3+j*2.2,t=a+Math.sin(j*.7+i)*.035;return new T.Vector3(Math.sin(t)*r,.015,Math.cos(t)*r)})
 add(new T.TubeGeometry(new T.CatmullRomCurve3(points),24,.018,4,false),trimMat,-20,[0,0,0],4)
}
function accessor(array,type){return doc.createAccessor().setBuffer(buffer).setType(type).setArray(array)}
for(const [mat,geometries]of batches){const g=mergeGeometries(geometries);if(!g)throw new Error('Merge failed');const p=doc.createPrimitive().setMaterial(mat).setIndices(accessor(Uint32Array.from(g.index.array),'SCALAR'))
 for(const [name,a]of Object.entries(g.attributes)){const semantic={position:'POSITION',normal:'NORMAL',uv:'TEXCOORD_0'}[name]??name;p.setAttribute(semantic,accessor(Float32Array.from(a.array),a.itemSize===1?'SCALAR':`VEC${a.itemSize}`))}
 scene.addChild(doc.createNode(mat.getName()).setMesh(doc.createMesh(mat.getName()).addPrimitive(p)));geometries.forEach(g=>g.dispose());g.dispose()}
Object.assign(doc.getRoot().getAsset(),{generator:'DRMVYZ NEON FOREST',extras:{source:source.getRoot().getAsset().extras,sha256,modifications:'Affine transforms baked; invalid sky omitted in favor of authored environment; opaque terrain; coherent surface pivots; source crystals retained outside cleared aisle; surrounding prism fans, portal rim and filaments added.'}})
await MeshoptEncoder.ready
await doc.transform(weld(),dedup(),prune({keepAttributes:true}),quantize({pattern:/^(POSITION|NORMAL|TEXCOORD_0)$/,quantizePosition:16,quantizeNormal:10,quantizeTexcoord:12}))
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE})
await mkdir(out,{recursive:true})
const output=await writeGlb(doc);await writeFile(resolve(out,'neon-forest-static.glb'),output)
const validation=await validateFile(resolve(out,'neon-forest-static.glb'))
if(validation.numErrors)throw new Error(JSON.stringify(validation))
const inspection=inspectDocument(doc,{name:'neon-forest-static',fileBytes:output.length})
if(!inspection.ok||inspection.memory.totalBytes>33554432)throw new Error(JSON.stringify(inspection.issues))
await mkdir(resolve(root, 'docs/NEON_FOREST'), { recursive: true })
await writeFile(resolve(root,'docs/NEON_FOREST/NEON_FOREST-asset-report.json'),JSON.stringify({sha256,inspection,validation,removedForCorridor:removed,clusters},null,2)+'\n')
await writeFile(resolve(root,'scripts/cinema2-assets/sources/neon-forest/source.json'),JSON.stringify({file:'neon_stage.glb',sha256,...source.getRoot().getAsset().extras},null,2)+'\n')
console.log(JSON.stringify({bytes:output.length,triangles:inspection.geometry.triangles,gpuMiB:inspection.memory.totalBytes/1048576,clusters:clusters.length,removedForCorridor:removed,validationErrors:validation.numErrors}))
