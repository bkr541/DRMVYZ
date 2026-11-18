import { prepareModelInput } from '../../../features/models/trace/imageInput'
import { createDefaultModelRecipe, createModelArtifact } from '../../../features/models/generator/createModelArtifact'
;(window as unknown as Record<string, unknown>).__run = async (svg: string) => {
  const out: Record<string, unknown> = {}
  const recipe = createDefaultModelRecipe()
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  try {
    const t0 = performance.now()
    const prepared = await prepareModelInput(blob, recipe, 'normal')
    out.prepare = { ok: true, ms: Math.round(performance.now() - t0), width: prepared.width, height: prepared.height, confirm: prepared.requiresForegroundConfirmation, warnings: prepared.warnings.map(w => w.message) }
  } catch (e) { out.prepare = { ok: false, name: (e as Error).name, code: (e as { code?: string }).code, message: (e as Error).message }; return out }
  try {
    const t0 = performance.now()
    const artifact = await createModelArtifact({ source: blob, recipe, foregroundConfirmed: false })
    out.generate = { ok: true, ms: Math.round(performance.now() - t0), warnings: artifact.warnings.map(w => w.message), tri: artifact.stats.triangles }
  } catch (e) { out.generate = { ok: false, name: (e as Error).name, code: (e as { code?: string }).code, message: (e as Error).message } }
  return out
}
