// Browser-only account/repository fixture. Real generator, pinned resolver, GLTF
// loader, model cache, model slot and native module are exercised; no backend call.
import { supabase } from '../../lib/supabase'
import { modelAssetRepository as repo } from '../../features/models/data/modelAssetRepository'
import { createDefaultModelRecipe, createModelArtifact } from '../../features/models/generator/createModelArtifact'
const owner = 'a0000000-0000-4000-8000-000000000001'
const id = 'c0000000-0000-4000-8000-000000000001'
const replacementId = 'c0000000-0000-4000-8000-000000000002'
const missingId = 'c0000000-0000-4000-8000-000000000003'
let installed: Promise<void> | undefined
export async function installReleaseModelFixture(variant: 'primary' | 'replacement' | 'missing' = 'primary'): Promise<string> {
  await (installed ??= install())
  return `user-model:${variant === 'primary' ? id : variant === 'replacement' ? replacementId : missingId}:1`
}
async function install() {
  const models = await Promise.all(['donut.svg','islands.svg'].map(async name => {
    const source = await (await fetch(`/src/features/models/__tests__/fixtures/${name}`)).blob()
    const recipe = createDefaultModelRecipe()
    recipe.materials = [{ ...recipe.materials[0]!, color: '#d72b20', roughness: .65, metalness: .1, textureId: 'brushed-metal' }, ...recipe.materials.slice(1)]
    return createModelArtifact({ source, recipe })
  }))
  const urls = models.map(model => URL.createObjectURL(model.glb))
  const keys = [id,replacementId]
  const original = { getUser: supabase.auth.getUser, get: repo.get, getVersion: repo.getVersion, signedUrl: repo.signedUrl }
  supabase.auth.getUser = (async () => ({ data: { user: { id: owner } }, error: null })) as unknown as typeof supabase.auth.getUser
  repo.get = (async (key: string) => {
    if (!keys.includes(key)) throw Error('Fixture model missing')
    return { id: key, userId: owner, status: 'ready', currentVersion: 1, kind: 'imported' }
  }) as unknown as typeof repo.get
  repo.getVersion = (async (key: string, version: number) => {
    const model = models[keys.indexOf(key)]
    if (!model || version !== 1) throw Error('Unexpected fixture model version')
    return { modelAssetId: key, version, geometryStats: model.stats, generatorRecipe: null }
  }) as unknown as typeof repo.getVersion
  repo.signedUrl = (async (key: string) => ({ url: urls[keys.indexOf(key)], expiresAt: Date.now() + 60000 })) as unknown as typeof repo.signedUrl
  addEventListener('beforeunload', () => {
    supabase.auth.getUser = original.getUser; repo.get = original.get; repo.getVersion = original.getVersion; repo.signedUrl = original.signedUrl
    urls.forEach(url => URL.revokeObjectURL(url)); models.forEach(model => model.dispose())
  }, { once: true })
}
