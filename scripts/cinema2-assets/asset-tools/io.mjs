// Shared glTF Transform IO for the Cinema 2.0 asset tools: one NodeIO that understands every extension the runtime loader does and can read and
// write Meshopt- and Draco-compressed files.
import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

let ioPromise = null

export function createIo() {
  ioPromise ??= (async () => {
    await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready])
    return new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({
        'draco3d.decoder': await draco3d.createDecoderModule(),
        'draco3d.encoder': await draco3d.createEncoderModule(),
        'meshopt.decoder': MeshoptDecoder,
        'meshopt.encoder': MeshoptEncoder,
      })
  })()
  return ioPromise
}

/** Reads a .glb or .gltf into a glTF Transform document. Returns the document, the raw bytes of a GLB, and a display name. */
export async function readAsset(path) {
  const io = await createIo()
  const extension = extname(path).toLowerCase()
  if (extension !== '.glb' && extension !== '.gltf') throw new Error(`"${path}" must be a .glb or .gltf file.`)
  const document = await io.read(path)
  const bytes = extension === '.glb' ? new Uint8Array(await readFile(path)) : null
  return { document, bytes, io, name: basename(path, extension), path, container: extension === '.glb' ? 'glb' : 'gltf' }
}

export async function writeGlb(document) {
  const io = await createIo()
  return io.writeBinary(document)
}
