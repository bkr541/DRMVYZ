// Keep the supplied geometry/materials; reduce embedded texture resolution for the static preview.
import { NodeIO } from '@gltf-transform/core'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
const source=process.argv[2]??'/Users/kodyrobinson/Downloads/demon_mask.glb'
const output='public/cinema2/models/switch-it-demon-mask.glb'
const bytes=await readFile(source),io=new NodeIO(),document=await io.readBinary(bytes)
const textures=[]
for(const texture of document.getRoot().listTextures()){
 const input=texture.getImage();if(!input)continue
 const meta=await sharp(input).metadata()
 texture.setImage(await sharp(input).resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).png().toBuffer()).setMimeType('image/png')
 textures.push({sourceWidth:meta.width,sourceHeight:meta.height,maxOutputDimension:1024})
}
await mkdir('public/cinema2/models',{recursive:true});await io.write(output,document)
const glb=await readFile(output)
const jsonLength=bytes.readUInt32LE(12),metadata=JSON.parse(bytes.subarray(20,20+jsonLength).toString()).asset.extras
const manifest={source,sourceSha256:createHash('sha256').update(bytes).digest('hex'),output,outputSha256:createHash('sha256').update(glb).digest('hex'),sourceMetadata:metadata,triangles:5686,textures,modifications:'Embedded textures limited to 1024px; mesh topology, UVs, authored transforms and material maps retained. Runtime applies portrait registration and red lighting.'}
await writeFile('assets/cinema2/switch-it/demon-mask-provenance.json',JSON.stringify(manifest,null,2)+'\n')
console.log(JSON.stringify(manifest,null,2))
