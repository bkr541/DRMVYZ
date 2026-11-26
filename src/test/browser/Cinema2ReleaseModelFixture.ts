// Browser-only account/repository fixture. Real generator, pinned resolver, GLTF
// loader, model cache, model slot and native module are exercised; no backend call.
import { supabase } from '../../lib/supabase'
import { modelAssetRepository as repo } from '../../features/models/data/modelAssetRepository'
import { createDefaultModelRecipe, createModelArtifact } from '../../features/models/generator/createModelArtifact'
const owner = 'a0000000-0000-4000-8000-000000000001'
const id = 'c0000000-0000-4000-8000-000000000001'
let installed: Promise<string> | undefined
export function installReleaseModelFixture(): Promise<string> {
  return installed ??= install()
}
async function install() {
  const source = await (await fetch('/src/features/models/__tests__/fixtures/donut.svg')).blob()
  const model = await createModelArtifact({ source, recipe: createDefaultModelRecipe() })
  const url = URL.createObjectURL(model.glb)
  const original = { getUser: supabase.auth.getUser, get: repo.get, getVersion: repo.getVersion, signedUrl: repo.signedUrl }
  supabase.auth.getUser = (async () => ({ data: { user: { id: owner } }, error: null })) as unknown as typeof supabase.auth.getUser
  repo.get = (async (key: string) => {
    if (key !== id) throw Error('Unexpected fixture model')
    return { id, userId: owner, status: 'ready', currentVersion: 1, kind: 'generated' }
  }) as unknown as typeof repo.get
  repo.getVersion = (async (key: string, version: number) => {
    if (key !== id || version !== 1) throw Error('Unexpected fixture model version')
    return { modelAssetId: id, version, geometryStats: model.stats, generatorRecipe: model.recipe }
  }) as unknown as typeof repo.getVersion
  repo.signedUrl = (async () => ({ url, expiresAt: Date.now() + 60000 })) as unknown as typeof repo.signedUrl
  addEventListener('beforeunload', () => {
    supabase.auth.getUser = original.getUser; repo.get = original.get; repo.getVersion = original.getVersion; repo.signedUrl = original.signedUrl
    URL.revokeObjectURL(url)
  }, { once: true })
  return `user-model:${id}:1`
}
