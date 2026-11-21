import { parseModelRecipe, type ModelGeneratorRecipe } from '../domain/modelAssetTypes'
import { createExtrudedModel, type GeneratedModel } from '../geometry/createExtrudedModel'
import { checkAbort, MODEL_QUALITY, ModelGenerationError, type ModelQuality } from '../geometry/modelQualityBudget'
import { applyModelMaterialTextures, MODEL_MATERIAL_PRESETS } from '../materials/modelMaterials'
import { sanitizeModelSvg } from '../trace/svgSanitize'
import { prepareModelInput } from '../trace/imageInput'
import { VTracerVectorizer, VTRACER_VERSION } from '../trace/traceImage'
import { exportModelGlb } from '../export/exportGlb'
export { MODEL_MATERIAL_PRESETS, prepareModelInput, VTracerVectorizer }
export { ModelGenerationError }
export function createDefaultModelRecipe(): ModelGeneratorRecipe {
  return {
    schemaVersion: 1, quality: 'normal', engine: { name: 'drmvyz-extrude', version: '1', threeVersion: '0.186.1' },
    foreground: { mode: 'alpha', threshold: 0.5, invert: false },
    trace: { colorMode: 'silhouette', threshold: 0.5, smoothing: 0.35, maxColors: 1 },
    geometry: { depth: 0.25, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3, curveSegments: 12 },
    materials: [{ region: 'front', ...MODEL_MATERIAL_PRESETS.Matte }, { region: 'side', ...MODEL_MATERIAL_PRESETS['Black Chrome'] }],
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], pivot: 'center' },
    preview: { background: '#111111', lightIntensity: 1, environment: 'neutral' },
  }
}
export interface CreateModelArtifactInput { source: Blob; recipe: ModelGeneratorRecipe; quality?: ModelQuality; foregroundConfirmed?: boolean; signal?: AbortSignal }
export interface ModelArtifact extends GeneratedModel {
  traceSvg: string
  sourceSnapshot: Blob
  foregroundPreview?: Blob
  glb: Blob
  files: { glb: { data: Blob; contentType: 'model/gltf-binary' }; source: { data: Blob; contentType: 'image/png' | 'image/svg+xml' }; trace: { data: Blob; contentType: 'image/svg+xml' } }
}
/** A trace of a picture (not the user's own vector) that is too intricate to extrude fails with budget errors written for hand-made SVGs; say what to try instead. */
function explainPictureTraceFailure(error: unknown, fromPicture: boolean): unknown {
  if (fromPicture && error instanceof ModelGenerationError && ['unsupported_svg', 'unsafe_svg', 'overlapping_contours', 'geometry_budget'].includes(error.code)) {
    return new ModelGenerationError('trace_too_complex', 'This image is too detailed to become one solid 3D shape. Try Draft quality, raise Smoothing, adjust the Threshold or Invert foreground, or use a simpler image such as a logo on a transparent background.')
  }
  return error
}
/** Independent engine boundary. Caller owns the returned group's lifetime and calls dispose on replacement. */
export async function createModelArtifact(input: CreateModelArtifactInput): Promise<ModelArtifact> {
  checkAbort(input.signal)
  const recipe = parseModelRecipe(input.recipe), quality = input.quality ?? recipe.quality ?? 'normal'
  if (!MODEL_QUALITY[quality]) throw new ModelGenerationError('quality', 'Unknown model quality.')
  recipe.quality = quality
  if (recipe.trace.colorMode !== 'silhouette') throw new ModelGenerationError('color_mode', 'Full-color layered geometry is not supported; use silhouette mode.')
  const prepared = await prepareModelInput(input.source, recipe, quality, input.signal)
  if (prepared.requiresForegroundConfirmation && !input.foregroundConfirmed) throw new ModelGenerationError('foreground_confirmation_required', 'Review the foreground preview and confirm before generation.', prepared.foregroundPreview)
  let svg: string
  try { svg = prepared.svg ?? await new VTracerVectorizer().trace({ pixels: prepared.pixels!, width: prepared.width, height: prepared.height, options: { smoothing: recipe.trace.smoothing }, signal: input.signal }) } catch (error) { throw explainPictureTraceFailure(error, !prepared.svg) }
  checkAbort(input.signal)
  prepared.recipe.engine = { name: prepared.svg ? 'drmvyz-svg-extrude' : 'drmvyz-vtracer-extrude', version: prepared.svg ? '1' : `${VTRACER_VERSION}/1`, threeVersion: '0.186.1' }
  let model: ReturnType<typeof createExtrudedModel>
  try { model = createExtrudedModel(svg, prepared.recipe, quality, input.signal) } catch (error) { throw explainPictureTraceFailure(error, !prepared.svg) }
  try {
    await applyModelMaterialTextures(model.group, model.recipe, input.signal)
    const glb = await exportModelGlb(model.group, input.signal)
    const sourceType = prepared.svg ? 'image/svg+xml' as const : 'image/png' as const
    return { ...model, warnings: [...prepared.warnings, ...model.warnings], traceSvg: svg, glb, sourceSnapshot: prepared.sourceSnapshot, foregroundPreview: prepared.foregroundPreview,
      files: { glb: { data: glb, contentType: 'model/gltf-binary' }, source: { data: prepared.sourceSnapshot, contentType: sourceType }, trace: { data: new Blob([svg], { type: 'image/svg+xml' }), contentType: 'image/svg+xml' } } }
  } catch (error) { model.dispose(); throw error }
}


/** Reuse a validated trace when only geometry/materials changed; raster tracing is not repeated. */
export async function createModelArtifactFromTrace(sourceSnapshot: Blob, traceSvg: string, recipe: ModelGeneratorRecipe, signal?: AbortSignal): Promise<ModelArtifact> {
  traceSvg = sanitizeModelSvg(traceSvg)
  const model = createExtrudedModel(traceSvg, recipe, recipe.quality ?? 'normal', signal)
  try {
    await applyModelMaterialTextures(model.group, model.recipe, signal)
    const glb = await exportModelGlb(model.group, signal)
    const type = sourceSnapshot.type === 'image/svg+xml' ? 'image/svg+xml' as const : 'image/png' as const
    return { ...model, glb, traceSvg, sourceSnapshot, files: {
      glb: { data: glb, contentType: 'model/gltf-binary' }, source: { data: sourceSnapshot, contentType: type },
      trace: { data: new Blob([traceSvg], { type: 'image/svg+xml' }), contentType: 'image/svg+xml' },
    } }
  } catch (error) { model.dispose(); throw error }
}
