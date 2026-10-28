// Replace only the central geometry, retaining the four generated monoliths.
// Usage: node scripts/cinema2-assets/replace-atmosphere-crystal.mjs /path/to/crystal.glb
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { Matrix4 } from 'three'
import sharp from 'sharp'
import { copyToDocument, getBounds, prune, transformPrimitive, unpartition } from '@gltf-transform/functions'
import { readAsset, writeGlb } from './asset-tools/io.mjs'
const root = resolve(import.meta.dirname, '../..')
const sourcePath = process.argv[2]
if (!sourcePath) throw new Error('Provide the owner-supplied crystal.glb path.')
const sourceHash = createHash('sha256').update(await readFile(sourcePath)).digest('hex')
for (const [file, edge] of [['atmosphere-monoliths.glb', 1024], ['atmosphere-monoliths-512.glb', 512]]) {
  const { document: source } = await readAsset(sourcePath)
  const scene = source.getRoot().listScenes()[0]
  const { min, max } = getBounds(scene), scale = 3.9 / (max[1] - min[1])
  const node = source.getRoot().listNodes().find(n => n.getMesh())
  const matrix = new Matrix4().makeTranslation(.35, -1.2, -1.75)
    .multiply(new Matrix4().makeScale(scale, scale, scale))
    .multiply(new Matrix4().makeTranslation(-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2))
    .multiply(new Matrix4().fromArray(node.getWorldMatrix()))
  for (const primitive of node.getMesh().listPrimitives()) transformPrimitive(primitive, matrix.elements)
  node.setName('crystal').setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1])
  node.getMesh().setName('crystal')
  for (const material of source.getRoot().listMaterials()) material.setName('crystal')
  for (const texture of source.getRoot().listTextures()) {
    texture.setImage(await sharp(texture.getImage()).resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true }).png().toBuffer()).setMimeType('image/png')
  }
  const path = resolve(root, 'public/cinema2/models', file)
  const { document: target } = await readAsset(path)
  for (const old of target.getRoot().listNodes()) if (!['left', 'right', 'back', 'violet'].includes(old.getName())) old.dispose()
  // Clamp legacy monolith factors to the glTF color range while repackaging.
  for (const material of target.getRoot().listMaterials()) material.setBaseColorFactor(material.getBaseColorFactor().map(value => Math.max(0, Math.min(1, value))))
  const copied = copyToDocument(target, source, [node]).get(node)
  target.getRoot().listScenes()[0].addChild(copied)
  target.getRoot().getAsset().extras = { ...target.getRoot().getAsset().extras, crystalSource: { ...source.getRoot().getAsset().extras, sha256: sourceHash } }
  await target.transform(prune(), unpartition())
  await writeFile(path, await writeGlb(target))
  console.log(`${file}: center crystal replaced; textures limited to ${edge}px`)
}
