// Convert the user-supplied spec/gloss sphere to the renderer's metal/rough workflow.
import { createIo } from './asset-tools/io.mjs'
import sharp from 'sharp'
import { EXTTextureWebP } from '@gltf-transform/extensions'
import { metalRough } from '@gltf-transform/functions'
import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
const source=process.argv[2]
if(!source) throw new Error('Provide the original metal_sphere.glb path.')
const io=await createIo(),bytes=await readFile(source),document=await io.read(source)
const provenance=document.getRoot().getAsset().extras
await document.transform(metalRough())
for(const texture of document.getRoot().listTextures()){
 const image=await sharp(Buffer.from(texture.getImage())).resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).webp({quality:95}).toBuffer()
 texture.setImage(image).setMimeType('image/webp')
}
document.createExtension(EXTTextureWebP).setRequired(true)
const id='cinema2-orbital-gyroscope',output='public/cinema2/models/orbital-metal-sphere.glb'
await io.write(output,document)
await mkdir(path.join('assets/cinema2',id),{recursive:true})
await writeFile(path.join('assets/cinema2',id,'asset.json'),JSON.stringify({id,kind:'model',compression:'none',license:'CC-BY-4.0',attribution:'Abstract sphere by deecube1 (https://sketchfab.com/deecube1), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Source: https://sketchfab.com/3d-models/abstract-sphere-a525fc48c1d245e2883241e344773aa4. Supplied as metal_sphere.glb; converted from specular/glossiness to metal/rough PBR for DRMVYZ; original meshes and animation retained; textures reused on ORBITAL lettering.',origin:'User-supplied metal_sphere.glb; spec/gloss converted to metal/rough, maps capped at 1024px and WebP quality 95 encoded. Legacy asset ID retained for saved references.',sourceSha256:createHash('sha256').update(bytes).digest('hex'),embeddedAsset:provenance,files:{high:output}},null,2)+'\n')
console.log(output)
