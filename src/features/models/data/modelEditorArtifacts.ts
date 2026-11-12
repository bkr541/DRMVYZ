import { Color, Mesh, MeshPhysicalMaterial, MeshStandardMaterial } from 'three'
import { modelAssetRepository, type ModelArtifact } from './modelAssetRepository'
import { MODEL_MAX_FILE_BYTES, type ModelAsset, type ModelGeneratorRecipe, type ModelGeometryStats } from '../domain/modelAssetTypes'
import { loadModelPreview } from './loadModelPreview'
import { checkAbort } from '../geometry/modelQualityBudget'
import { sniffModelImage } from '../trace/imageInput'

export async function downloadModelArtifact(assetId: string, version: number, artifact: ModelArtifact, signal?: AbortSignal): Promise<Blob> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { url } = await modelAssetRepository.signedUrl(assetId, version, artifact); checkAbort(signal)
    const response = await fetch(url, { signal })
    if (response.ok) {
      if (Number(response.headers.get('content-length')) > MODEL_MAX_FILE_BYTES) throw new Error('Stored model artifact exceeds the file budget.')
      const blob = await response.blob(); if (!blob.size || blob.size > MODEL_MAX_FILE_BYTES) throw new Error('Stored model artifact is empty or too large.')
      return blob
    }
    if (attempt || ![401, 403].includes(response.status)) throw new Error(`The saved ${artifact} could not be downloaded.`)
  }
  throw new Error('Model artifact download failed.')
}
export async function inspectModelSource(source: Blob): Promise<NonNullable<ModelGeometryStats['source']>> {
  const bytes = new Uint8Array(await source.arrayBuffer()), detected = sniffModelImage(bytes)
  let width = detected.width ?? 0, height = detected.height ?? 0
  if (detected.mime === 'image/svg+xml') {
    const root = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'image/svg+xml').documentElement
    const box = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
    width = box?.[2] ?? parseFloat(root.getAttribute('width') ?? '0'); height = box?.[3] ?? parseFloat(root.getAttribute('height') ?? '0')
  }
  return { width: Number.isFinite(width) ? width : 0, height: Number.isFinite(height) ? height : 0, mimeType: detected.mime, byteSize: source.size }
}
function close(a: number, b: number) { return Math.abs(a - b) <= 1e-4 * Math.max(1, Math.abs(a), Math.abs(b)) }
export async function verifyPublishedModel(asset: ModelAsset, version: number, recipe: ModelGeneratorRecipe, expected: ModelGeometryStats, signal: AbortSignal) {
  const loaded = await loadModelPreview({ ...asset, currentVersion: version }, signal)
  try {
    if (loaded.stats.triangles !== expected.triangles || !loaded.stats.bounds.min.every((n, i) => close(n, expected.bounds.min[i])) || !loaded.stats.bounds.max.every((n, i) => close(n, expected.bounds.max[i]))) throw new Error('Saved GLB geometry differs from the preview.')
    loaded.group.traverse(object => {
      if (!(object instanceof Mesh)) return
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof MeshStandardMaterial)) throw new Error('Saved model lost its PBR materials.')
        const wanted = recipe.materials.find(m => m.region === material.name) ?? recipe.materials[0]
        const emissive = new Color(wanted.emissive).multiplyScalar(wanted.emissiveIntensity ?? 1)
        const actualEmissive = material.emissive.clone().multiplyScalar(material.emissiveIntensity)
        const physical = material instanceof MeshPhysicalMaterial ? material : null
        if (material.color.getHexString() !== wanted.color.slice(1).toLowerCase() || !close(material.metalness, wanted.metalness) || !close(material.roughness, wanted.roughness) || !close(material.opacity, wanted.opacity)
          || !emissive.toArray().every((n, i) => close(n, actualEmissive.toArray()[i])) || !close(physical?.clearcoat ?? 0, wanted.clearcoat ?? 0) || ((wanted.clearcoat ?? 0) > 0 && !close(physical?.clearcoatRoughness ?? 0, wanted.clearcoatRoughness ?? 0.1))) throw new Error('Saved GLB material differs from the preview.')
      }
    })
    return loaded
  } catch (error) { loaded.dispose(); throw error }
}
export function downloadModelBlob(blob: Blob, name: string, extension: 'glb' | 'png'): void {
  const safe = (name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\.(glb|png)$/i, '').trim().slice(0, 120) || 'model') + '.' + extension
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = safe; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
