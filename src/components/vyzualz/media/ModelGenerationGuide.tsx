import { selectModelCanGenerate, useModelEditorStore } from '../../../features/models/state/modelEditorStore'
import type { ModelGeneratorRecipe } from '../../../features/models/domain/modelAssetTypes'
import { IconChipButton } from '../react/controls/IconChipButton'

const stages = ['Preparing source', 'Tracing foreground', 'Constructing geometry', 'Applying materials', 'Validating and exporting GLB'] as const
function recovery(code: string | null, recipe: ModelGeneratorRecipe | null, error: string | null): { text: string; patch?: Partial<ModelGeneratorRecipe> } {
  switch (code) {
    case 'empty_foreground': case 'empty_geometry': return { text: 'Review the foreground mask. Adjust Threshold or Invert foreground until the intended solid areas are white and openings are transparent.' }
    case 'geometry_budget': if (error?.includes('point budget')) return { text: 'The traced outline contains too many points. Try Draft quality or simplify the source image.', ...(recipe && recipe.quality !== 'draft' ? { patch: { quality: 'draft' } } : {}) }; return { text: 'The geometry exceeds a safe complexity limit. A higher quality tier allows more triangles, but can trace more detail. Try simplifying the source or increasing smoothing; review the new mask.', ...(recipe && recipe.quality !== 'high' ? { patch: { quality: 'high' } } : {}) }
    case 'trace_failed': case 'trace_timeout': return { text: 'Tracing could not finish. Draft quality and increased smoothing may reduce the workload.', ...(recipe && recipe.quality !== 'draft' ? { patch: { quality: 'draft', trace: { ...recipe.trace, smoothing: Math.max(recipe.trace.smoothing, 0.5) } } } : {}) }
    case 'overlapping_contours': return { text: 'Solid outlines overlap. Merge overlapping fills in the source artwork or adjust raster foreground settings to separate them.' }
    case 'invalid_contour': return { text: 'An outline crosses itself. Try simplifying the source or increasing smoothing before retrying.', ...(recipe ? { patch: { trace: { ...recipe.trace, smoothing: Math.min(1, recipe.trace.smoothing + 0.15) } } } : {}) }
    case 'unsafe_svg': case 'unsupported_svg': return { text: 'This vector contains unsupported or unsafe features. Use a simplified, flattened SVG with filled paths or a trusted PNG of the artwork.' }
    case 'input_budget': case 'input_format': case 'input_decode': return { text: 'Check the source format, size and resolution. Replace the source with a supported image if necessary.' }
    case 'glb_invalid': return { text: 'The geometry was created but GLB validation failed. Retry generation; if it persists, simplify the source or reset the geometry settings.' }
    case 'foreground_confirmation_required': return { text: 'Review and confirm the foreground in Source Preparation before generating.' }
    default: return { text: 'Review Source Preparation and retry. Your current settings have been preserved.' }
  }
}
export function ModelGenerationGuide({ overlay = false }: { overlay?: boolean }) {
  const s = useModelEditorStore(), canGenerate = selectModelCanGenerate(s)
  if (s.status === 'generating' || s.generationPending || s.status === 'preparing' || s.status === 'loading-source' || s.status === 'loading-model') {
    const step = s.generationStage ? stages.indexOf(s.generationStage) : -1
    return <div className="mm-model-generation-guide" role="status">
      <h3>{s.status === 'generating' ? overlay ? 'Updating 3D model' : 'Generating 3D model' : s.status === 'loading-model' ? 'Loading saved model' : s.status === 'loading-source' ? 'Loading source image' : 'Preparing source'}</h3>
      {s.status === 'generating' && (overlay ? <p>{s.generationStage ?? 'Starting generation'}… Last successful model remains visible.</p> : <ol className="mm-model-generation-steps">{stages.map((stage, index) => <li key={stage} data-state={index === step ? 'active' : index < step ? 'done' : 'pending'}>{stage}{index === step ? '…' : ''}</li>)}</ol>)}
      <IconChipButton onClick={s.cancel}>Cancel operation</IconChipButton>
    </div>
  }
  if (s.status === 'error' || (overlay && s.error)) {
    const advice = recovery(s.generationErrorCode, s.recipe, s.error)
    return <div className="mm-model-generation-guide" role="alert"><h3>{overlay ? 'Model update needs attention' : 'Your model needs refinement'}</h3>
      <p>{overlay ? 'Showing the last successful model. ' : ''}{s.error ?? 'Model unavailable. Retry loading or select another asset.'}</p>
      {s.recipe && !s.saveFailure && <><p>{advice.text}</p>{advice.patch && <IconChipButton disabled={!s.source || !!s.pendingOperationId || !!s.publishedVersion} tone="primary" onClick={() => void s.retryGeneration(advice.patch)}>Apply Suggested Settings &amp; Retry</IconChipButton>}
        <IconChipButton disabled={!s.source || !!s.publishedVersion || !!s.pendingOperationId || (s.needsConfirmation && !s.confirmed)} onClick={() => void s.retryGeneration()}>Retry with Current Settings</IconChipButton></>}
      {!s.source && !s.asset && <IconChipButton onClick={() => void s.retrySource()}>Retry source</IconChipButton>}
      {s.generationErrorCode && <details><summary>Technical details</summary>{s.generationErrorCode}</details>}
    </div>
  }
  if (overlay) return null
  return <div className="mm-model-generation-guide"><h3>Create your 3D model</h3>
    <p>Turn your selected image into an editable 3D model for STAGELESS Studio.</p>
    <ol><li><strong>Prepare your source.</strong> Adjust Foreground, Threshold and Smoothing in Source Preparation.</li><li><strong>Review the silhouette.</strong> White areas become solid geometry; transparent areas become openings.</li><li><strong>Generate your model.</strong> Use the current source settings to create the first model. Refine it after generation.</li></ol>
    {s.needsConfirmation && !s.confirmed && <p>Confirm the foreground preview in Source Preparation to enable generation.</p>}
    <IconChipButton tone="primary" disabled={!canGenerate} onClick={() => void s.generate()}>Generate 3D Model</IconChipButton>
    <p role="status">{canGenerate ? 'Source prepared and ready for generation.' : 'Prepare and confirm your source to continue.'}</p>
  </div>
}
