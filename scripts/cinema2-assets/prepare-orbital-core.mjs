// Prepare the supplied "Sphere" (texture1.glb, by Cyril43) as ORBITAL's inner core: drop the one loose solid-red emissive part, make the material opaque
// (the source blends), drop the tangents (three derives them for the normal map), encode the maps as WebP and compress the geometry with Meshopt, so the
// core stays small enough for the installer budget. The three textured shells, their emissive map and their animation are kept; the source is unchanged.
import { createIo } from './asset-tools/io.mjs'
import sharp from 'sharp'
import { EXTMeshoptCompression, EXTTextureWebP } from '@gltf-transform/extensions'
import { prune } from '@gltf-transform/functions'
import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const source = process.argv[2]
if (!source) throw new Error('Provide the original texture1.glb path.')
const io = await createIo(), bytes = await readFile(source), document = await io.read(source)
const root = document.getRoot(), provenance = root.getAsset().extras

for (const node of root.listNodes()) {
  const mesh = node.getMesh()
  if (mesh?.listPrimitives().some(primitive => primitive.getMaterial()?.getName() === 'emissive')) node.dispose()
}
await document.transform(prune())
for (const material of root.listMaterials()) material.setAlphaMode('OPAQUE')
for (const mesh of root.listMeshes()) for (const primitive of mesh.listPrimitives()) primitive.setAttribute('TANGENT', null)
await document.transform(prune())
for (const texture of root.listTextures()) {
  const image = await sharp(Buffer.from(texture.getImage())).resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer()
  texture.setImage(image).setMimeType('image/webp')
}
document.createExtension(EXTTextureWebP).setRequired(true)
document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })

const id = 'cinema2-orbital-core', output = 'public/cinema2/models/orbital-core.glb'
await io.write(output, document)
await mkdir(path.join('assets/cinema2', id), { recursive: true })
await writeFile(path.join('assets/cinema2', id, 'asset.json'), JSON.stringify({
  id, kind: 'model', compression: 'meshopt', license: 'CC-BY-4.0',
  attribution: 'Sphere by Cyril43 (https://sketchfab.com/Cyril43), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Source: https://sketchfab.com/3d-models/sphere-6d478ca4f15d4e4badcff5f5e491338e. Supplied as texture1.glb; the loose red emissive part removed, material made opaque, tangents dropped, geometry Meshopt-compressed and maps encoded as WebP for STAGELESS; the textured shells, emissive map and animation retained; used as the inner core of ORBITAL.',
  origin: 'User-supplied texture1.glb; one solid-red emissive part removed, alpha blending replaced by opaque, tangents dropped, geometry Meshopt-compressed, maps capped at 1024px and encoded as WebP quality 85.',
  sourceSha256: createHash('sha256').update(bytes).digest('hex'),
  embeddedAsset: provenance,
  files: { high: output },
}, null, 2) + '\n')
console.log(output)
