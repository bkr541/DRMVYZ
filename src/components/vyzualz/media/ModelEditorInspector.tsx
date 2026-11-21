import '../../../styles/reactView.css'
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { ReactNode } from 'react'
import { useModelEditorStore, type ModelEditorState } from '../../../features/models/state/modelEditorStore'
import type { BuiltinModel } from '../../../features/models/domain/builtinModels'
import { BUILTIN_MODEL_SCALE_RANGE, type BuiltinMaterialValues, type ModelRotation } from '../../../features/models/geometry/builtinModelEdits'
import { MODEL_MATERIAL_PRESETS } from '../../../features/models/materials/modelMaterials'
import { Collapsible, NumberInputRow, PaletteColorRow, SelectRow, SliderRow, TextAreaRow, TextInputRow, ToggleRow } from '../react/ReactControlRows'
import { IconChipButton } from '../react/controls/IconChipButton'
import { ConfirmDialog } from '../react/controls/ConfirmDialog'
import { NoticeCard } from '../react/controls/NoticeCard'
import { MediaDetailsHeader, TagsCollectionsGroup, type MediaInspectorTab } from './MediaManagerInspector'
import { AppIcon } from '../../shared/icons/AppIcon'

function ModelInfoRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="rv-ctrl-row">
    <span className="rv-ctrl-label-cluster"><span className="rv-ctrl-label">{label}</span></span>
    <span className="mmi-readonly">{children}</span>
  </div>
}

function ModelRoleField({ imported = false }: { imported?: boolean }) {
  return <SelectRow id="mmi-role" label="Media Role" value="model" disabled
    options={[{ value: 'model', label: imported ? '3D Model · Imported GLB' : '3D Model' }]} onChange={() => {}} />
}

function modelDimensions(model: ModelEditorState['model']) {
  return model ? model.stats.bounds.max.map((n, i) => (n - model.stats.bounds.min[i]).toFixed(3)).join(' × ') : '—'
}

function ModelOrganizationFields({ state, disabled }: { state: Pick<ModelEditorState, 'tags' | 'collectionIds' | 'sessionKey'>; disabled: boolean }) {
  const patch = (organization: Partial<Pick<ModelEditorState, 'tags' | 'collectionIds'>>) => {
    const current = useModelEditorStore.getState()
    if (current.sessionKey === state.sessionKey) current.setMetadata(organization)
  }
  return <TagsCollectionsGroup idPrefix="model" tags={state.tags} collectionIds={state.collectionIds}
    disabled={disabled} onTagsChange={tags => patch({ tags })} onCollectionIdsChange={collectionIds => patch({ collectionIds })} />
}

const ROTATION_AXES = ['X', 'Y', 'Z'] as const
const toDegrees = (radians: number) => {
  const degrees = (radians * 180 / Math.PI) % 360
  return Math.round(degrees > 180 ? degrees - 360 : degrees < -180 ? degrees + 360 : degrees)
}

function ModelRotationRows({ rotation, disabled, onChange }: { rotation: ModelRotation; disabled: boolean; onChange(axis: number, degrees: number): void }) {
  return ROTATION_AXES.map((axis, index) => <SliderRow key={axis} label={`Rotate ${axis}`} value={rotation[index]} min={-180} max={180} step={1}
    formatValue={value => `${value}°`} resetValue={0} disabled={disabled} onChange={value => onChange(index, value)} />)
}

const TWO_SIDED_DESCRIPTION = 'Keeps the front and adds a matching back, so a logo or wordmark reads correctly (not mirrored) as the model turns. Best for flat or extruded shapes. To keep your original, use Save As New Model in the Output tab.'

function BuiltinModelEditPanel() {
  const { edit, exporting, saving, error, editBuiltin } = useModelEditorStore(useShallow(s => ({
    edit: s.builtinEdit, exporting: s.builtinExporting, saving: s.status === 'saving', error: s.error, editBuiltin: s.editBuiltin,
  })))
  const [materialIndex, setMaterialIndex] = useState(0)
  if (!edit) return error
    ? <NoticeCard tone="error" title="Model unavailable">{error}</NoticeCard>
    : <p role="status">Loading model for editing…</p>

  const { scale, rotation, materials, twoSided } = edit.values, material = materials[materialIndex]
  const sides = edit.twoSidedAvailable
  const disabled = exporting || saving
  const changeMaterial = (patch: Partial<BuiltinMaterialValues>) => editBuiltin({
    materials: materials.map((value, index) => index === materialIndex ? { ...value, ...patch } : value),
  })
  return <>
    <Collapsible label="Transform" icon={<AppIcon kind="rotateRight" size={14} />}>
      <div className="mm-model-field-grid">
        <SliderRow label="Uniform scale" value={scale} {...BUILTIN_MODEL_SCALE_RANGE} step={0.01} formatValue={value => `${value.toFixed(2)}×`}
          resetValue={1} disabled={disabled} onChange={value => editBuiltin({ scale: value })} />
        <ModelRotationRows rotation={rotation} disabled={disabled} onChange={(axis, degrees) => {
          const next: ModelRotation = [...rotation]; next[axis] = degrees; editBuiltin({ rotation: next })
        }} />
      </div>
    </Collapsible>
    <Collapsible label="Sides" icon={<AppIcon kind="layers" size={14} />}>
      <ToggleRow label="Readable from both sides" value={twoSided} disabled={disabled || !sides.ok} onChange={value => editBuiltin({ twoSided: value })}
        description={sides.ok ? TWO_SIDED_DESCRIPTION : sides.reason} />
    </Collapsible>
    {material && <Collapsible label="Materials" icon={<AppIcon kind="edit" size={14} />}>
      <SelectRow label="Material" value={String(materialIndex)} disabled={disabled} options={materials.map((value, index) => ({
        value: String(index), label: value.name,
      }))} onChange={value => setMaterialIndex(Number(value))} />
      <PaletteColorRow label="Base color" value={material.color} disabled={disabled} onChange={color => changeMaterial({ color })} />
      <SliderRow label="Metalness" value={material.metalness} disabled={disabled} onChange={metalness => changeMaterial({ metalness })} />
      <SliderRow label="Roughness" value={material.roughness} disabled={disabled} onChange={roughness => changeMaterial({ roughness })} />
    </Collapsible>}
  </>
}

function BuiltinModelInspector({ model }: { model: BuiltinModel }) {
  // Only the fields this panel shows, so generation progress and other editor changes do not re-render it.
  const state = useModelEditorStore(useShallow(s => ({
    tags: s.tags, collectionIds: s.collectionIds, sessionKey: s.sessionKey, savedMetadata: s.savedMetadata, status: s.status, model: s.model,
    builtinOrganizationLoading: s.builtinOrganizationLoading, builtinOrganizationError: s.builtinOrganizationError, loadBuiltinOrganization: s.loadBuiltinOrganization,
  })))
  const [tab, setTab] = useState<MediaInspectorTab>('info')
  return <>
    <MediaDetailsHeader activeTab={tab} onChange={setTab} />
    {tab === 'info' && <div className="mmi-body mm-model-inspector">
      <Collapsible label="Details" defaultOpen>
        <ModelRoleField />
        <ModelInfoRow label="Title">{model.name}</ModelInfoRow>
        <ModelInfoRow label="Description">{model.description}</ModelInfoRow>
      </Collapsible>
      <ModelOrganizationFields state={state} disabled={!state.savedMetadata || state.status === 'saving'} />
      <Collapsible label="Additional Info" defaultOpen={false}>
        <ModelInfoRow label="Dimensions">{modelDimensions(state.model)}</ModelInfoRow>
        {state.model && <>
          <ModelInfoRow label="Triangles">{state.model.stats.triangles.toLocaleString()}</ModelInfoRow>
          <ModelInfoRow label="Meshes">{state.model.stats.meshes.toLocaleString()}</ModelInfoRow>
        </>}
        <ModelInfoRow label="Viewport">Drag to orbit, scroll to zoom, or use Fit Model and Reset Camera.</ModelInfoRow>
      </Collapsible>
      {state.builtinOrganizationLoading && <div role="status">Loading tags and collections…</div>}
      {state.builtinOrganizationError && <NoticeCard tone="error" role="alert" title="Model organization unavailable">
        {state.builtinOrganizationError}
        {!state.savedMetadata && <IconChipButton onClick={() => { void state.loadBuiltinOrganization() }}>Retry tags and collections</IconChipButton>}
      </NoticeCard>}
    </div>}
    {tab === 'edit' && <div className="mmi-body mm-model-inspector"><BuiltinModelEditPanel key={state.sessionKey} /></div>}
  </>
}

export function ModelEditorInspector(props: { onSelectSource?: () => void }) {
  const builtin = useModelEditorStore(state => state.builtinModel)
  return builtin ? <BuiltinModelInspector key={builtin.id} model={builtin} /> : <EditableModelInspector {...props} />
}

function EditableModelInspector({ onSelectSource }: { onSelectSource?: () => void }) {
  const s = useModelEditorStore()
  const [tab, setTab] = useState<MediaInspectorTab>(() => useModelEditorStore.getState().asset ? 'info' : 'edit')
  const [url, setUrl] = useState<string | null>(null)
  const [pendingVersion, setPendingVersion] = useState<number | null>(null), [revertOpen, setRevertOpen] = useState(false)
  useEffect(() => { if (!s.preview) { setUrl(null); return }; const next = URL.createObjectURL(s.preview); setUrl(next); return () => URL.revokeObjectURL(next) }, [s.preview])
  const busy = s.status === 'saving' || s.status === 'deleting'
  const locked = busy || !!s.publishedVersion || !!s.pendingOperationId || !s.source
  const recipe = s.recipe
  const imported = s.asset?.kind === 'imported'
  const importedStats = imported ? s.versions.find(v => v.version === s.activeVersion)?.geometryStats.imported : undefined
  const geometry = recipe?.geometry, preview = recipe?.preview
  const loadVersion = (version: number) => { if (!s.asset) return; if (s.dirty) setPendingVersion(version); else s.load(s.asset, version) }
  const material = (region: 'front' | 'side') => {
    if (!recipe) return null
    const value = recipe.materials.find(m => m.region === region) ?? { ...recipe.materials[0], region }
    const update = (patch: Partial<typeof value>) => {
      const existing = recipe.materials.some(m => m.region === region)
      s.setRecipe({ materials: existing ? recipe.materials.map(m => m.region === region ? { ...m, ...patch } : m) : [...recipe.materials, { ...value, ...patch }] })
    }
    const preset = Object.entries(MODEL_MATERIAL_PRESETS).find(([, p]) => p.color === value.color && p.metalness === value.metalness && p.roughness === value.roughness && p.opacity === value.opacity && p.emissive === value.emissive)?.[0] ?? 'custom'
    return <Collapsible label={region === 'front' ? 'Front / Caps' : 'Sides'} defaultOpen>
      <SelectRow label="Material preset" value={preset} disabled={locked} options={[{ value: 'custom', label: 'Custom', disabled: true }, ...Object.keys(MODEL_MATERIAL_PRESETS).map(name => ({ value: name, label: name }))]}
        onChange={name => { const picked = MODEL_MATERIAL_PRESETS[name as keyof typeof MODEL_MATERIAL_PRESETS]; if (picked) update({ ...picked, emissiveIntensity: 1, clearcoat: 0, clearcoatRoughness: 0.1 }) }} />
      <div className="rv-palette-color-grid">
        <PaletteColorRow label="Color" value={value.color} disabled={locked} onChange={color => update({ color })} />
        <PaletteColorRow label="Emissive" value={value.emissive} disabled={locked} onChange={emissive => update({ emissive })} />
      </div>
      <SliderRow label="Metalness" value={value.metalness} disabled={locked} onChange={metalness => update({ metalness })} />
      <SliderRow label="Roughness" value={value.roughness} disabled={locked} onChange={roughness => update({ roughness })} />
      <SliderRow label="Emissive intensity" value={value.emissiveIntensity ?? 1} min={0} max={5} disabled={locked || value.emissive === '#000000'} onChange={emissiveIntensity => update({ emissiveIntensity })} />
      <SliderRow label="Clearcoat" value={value.clearcoat ?? 0} disabled={locked} onChange={clearcoat => update({ clearcoat })} />
      {(value.clearcoat ?? 0) > 0 && <SliderRow label="Clearcoat roughness" value={value.clearcoatRoughness ?? 0.1} disabled={locked} onChange={clearcoatRoughness => update({ clearcoatRoughness })} />}
      <SliderRow label="Opacity" value={value.opacity} min={0.05} max={1} disabled={locked} onChange={opacity => update({ opacity })} />
    </Collapsible>
  }
  return <>
    <MediaDetailsHeader activeTab={tab} onChange={setTab} />
    <div className="mmi-body mm-model-inspector">
      {tab === 'info' && <>
        <Collapsible label="Details" defaultOpen>
          <ModelRoleField imported={imported} />
          <TextInputRow label="Title" value={s.name} maxLength={200} disabled={busy} onChange={name => s.setMetadata({ name })} />
          <TextAreaRow label="Description" value={s.description ?? ''} disabled={busy} onChange={description => s.setMetadata({ description: description.slice(0, 4000) || null })} />
        </Collapsible>
        <ModelOrganizationFields state={s} disabled={busy || s.status === 'loading-model'} />
        <Collapsible label="Additional Info" defaultOpen={false}>
          <ModelInfoRow label="Version">{s.asset?.currentVersion ? `${s.activeVersion} · Latest ${s.asset.currentVersion}` : 'Draft / Unsaved'}{s.dirty ? ' · Modified' : ''}</ModelInfoRow>
          <ModelInfoRow label="Dimensions">{modelDimensions(s.model)}</ModelInfoRow>
          {s.model && <ModelInfoRow label="Geometry">{s.model.stats.triangles.toLocaleString()} triangles · {s.model.stats.vertices.toLocaleString()} vertices · {s.artifact?.materialCount ?? s.versions.find(v => v.version === s.activeVersion)?.geometryStats.materialCount ?? '—'} materials</ModelInfoRow>}
          {importedStats && <ModelInfoRow label="Original file">{importedStats.fileName}</ModelInfoRow>}
          {importedStats && <ModelInfoRow label="Textures">{importedStats.imageCount ? `${importedStats.imageCount} embedded · up to ${importedStats.maxImageSide} px` : 'None'}</ModelInfoRow>}
          {s.sourceInfo && <p>Source snapshot: {s.sourceInfo.width} × {s.sourceInfo.height} · {s.sourceInfo.mimeType}</p>}
          {s.sourceMediaId && <IconChipButton disabled={!onSelectSource || busy} onClick={onSelectSource}>View source image</IconChipButton>}
          {!s.sourceMediaId && s.source && <p>Using the independent source snapshot.</p>}
          {s.asset && <><p>Owner: {s.asset.userId}</p><p>Modified: {new Date(s.asset.updatedAt).toLocaleString()}</p></>}
        </Collapsible>
      </>}
      {tab === 'edit' && imported && <>
        <BuiltinModelEditPanel key={s.sessionKey} />
        <p>Edits are baked into a new GLB. <strong>Save New Version</strong> keeps the earlier version as it was, and <strong>Save As New Model</strong> makes a separate model. Textures are kept; the file is re-encoded on export.</p>
      </>}
      {tab === 'edit' && recipe && <>
        <Collapsible label="Source Preparation" icon={<AppIcon kind="image" size={14} />}>
          {url && <div className="mm-model-source-preview"><img src={url} alt="Foreground and cutout preview" /></div>}
          {s.sourceInfo?.mimeType === 'image/svg+xml' ? <p>SVG uses its filled paths directly. Raster foreground and smoothing controls are unavailable for vector sources.</p> : <>
          <SelectRow label="Foreground" value={recipe.foreground.mode} options={[{ value: 'alpha', label: 'Image alpha' }, { value: 'luminance', label: 'Threshold' }, { value: 'prepared', label: 'Prepared alpha' }]} disabled={locked}
            onChange={value => s.setRecipe({ foreground: { ...recipe.foreground, mode: value as 'alpha' | 'luminance' | 'prepared' } })} />
          <SliderRow label="Threshold" value={recipe.foreground.mode === 'luminance' ? recipe.trace.threshold : recipe.foreground.threshold} min={0.01} max={0.99} step={0.01} disabled={locked}
            onChange={value => s.setRecipe(recipe.foreground.mode === 'luminance' ? { trace: { ...recipe.trace, threshold: value } } : { foreground: { ...recipe.foreground, threshold: value } })} />
          <ToggleRow label="Invert foreground" value={recipe.foreground.invert} disabled={locked} onChange={value => s.setRecipe({ foreground: { ...recipe.foreground, invert: value } })} />
          <SliderRow label="Smoothing" value={recipe.trace.smoothing} disabled={locked} onChange={smoothing => s.setRecipe({ trace: { ...recipe.trace, smoothing } })} />
          </>}
          <SelectRow label="Quality" value={recipe.quality ?? 'normal'} options={[{ value: 'draft', label: 'Draft' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }]} disabled={locked} onChange={quality => s.setRecipe({ quality: quality as 'draft' | 'normal' | 'high' })} />
          {s.needsConfirmation && <ToggleRow label="Confirm foreground preview" value={s.confirmed} disabled={busy} onChange={s.confirmForeground} />}
        </Collapsible>
        <Collapsible label="Transform" icon={<AppIcon kind="rotateRight" size={14} />}>
          <div className="mm-model-field-grid">
            <NumberInputRow label="Uniform scale" value={recipe.transform.scale[0]} min={0.01} max={10} step={0.05} disabled={locked}
              onChange={scale => { if (scale >= 0.01 && scale <= 10) s.setRecipe({ transform: { ...recipe.transform, scale: [scale, scale, scale] } }) }} />
            <ModelRotationRows rotation={recipe.transform.rotation.map(toDegrees) as ModelRotation} disabled={locked} onChange={(axis, degrees) => {
              const rotation: ModelRotation = [...recipe.transform.rotation]
              rotation[axis] = degrees * Math.PI / 180
              s.setRecipe({ transform: { ...recipe.transform, rotation } })
            }} />
          </div>
        </Collapsible>
        {geometry && <Collapsible label="Geometry" icon={<AppIcon kind="layers" size={14} />}>
          <div className="mm-model-field-grid">
            <NumberInputRow label="Depth" value={geometry.depth} min={0.01} max={10} step={0.01} disabled={locked} onChange={depth => s.setRecipe({ geometry: { ...geometry, depth } })} />
            <NumberInputRow label="Curve detail" value={geometry.curveSegments} min={1} max={64} step={1} disabled={locked} onChange={curveSegments => s.setRecipe({ geometry: { ...geometry, curveSegments } })} />
            <SelectRow label="Pivot" value={recipe.transform.pivot} disabled={locked} options={[{ value: 'center', label: 'Center' }, { value: 'bottom', label: 'Bottom' }]} onChange={pivot => s.setRecipe({ transform: { ...recipe.transform, pivot: pivot as 'center' | 'bottom' } })} />
            <div className="mm-model-field-grid__wide"><ToggleRow label="Readable from both sides" value={recipe.twoSided ?? false} disabled={locked} description={TWO_SIDED_DESCRIPTION} onChange={twoSided => s.setRecipe({ twoSided })} /></div>
            <div className="mm-model-field-grid__wide"><ToggleRow label="Bevel" value={geometry.bevelEnabled} disabled={locked} onChange={bevelEnabled => s.setRecipe({ geometry: { ...geometry, bevelEnabled } })} /></div>
            {geometry.bevelEnabled && <>
              <NumberInputRow label="Bevel width" value={geometry.bevelSize} min={0} max={1} step={0.005} disabled={locked} onChange={bevelSize => s.setRecipe({ geometry: { ...geometry, bevelSize } })} />
              <NumberInputRow label="Bevel thickness" value={geometry.bevelThickness} min={0} max={1} step={0.005} disabled={locked} onChange={bevelThickness => s.setRecipe({ geometry: { ...geometry, bevelThickness } })} />
              <NumberInputRow label="Bevel segments" value={geometry.bevelSegments} min={1} max={16} step={1} disabled={locked} onChange={bevelSegments => s.setRecipe({ geometry: { ...geometry, bevelSegments } })} />
            </>}
          </div>
        </Collapsible>}
        <Collapsible label="Materials" icon={<AppIcon kind="edit" size={14} />}>{material('front')}{material('side')}</Collapsible>
        {preview && <Collapsible label="Preview" icon={<AppIcon kind="image" size={14} />}>
          <p>Preview lighting, background and motion are included in PNG previews, not the GLB.</p>
          <PaletteColorRow label="Preview background" value={preview.background} disabled={locked} onChange={background => s.setRecipe({ preview: { ...preview, background } })} />
          <SliderRow label="Preview lighting" value={preview.lightIntensity} min={0.1} max={4} disabled={locked} onChange={lightIntensity => s.setRecipe({ preview: { ...preview, lightIntensity } })} />
          <SelectRow label="Preview environment" value={preview.environment} disabled={locked} options={[{ value: 'neutral', label: 'Neutral' }, { value: 'studio', label: 'Studio' }]} onChange={environment => s.setRecipe({ preview: { ...preview, environment: environment as 'neutral' | 'studio' } })} />
          <ToggleRow label="Preview grid" value={preview.grid ?? true} disabled={locked} onChange={grid => s.setRecipe({ preview: { ...preview, grid } })} />
          <ToggleRow label="Preview shadows" value={preview.shadows ?? true} disabled={locked} onChange={shadows => s.setRecipe({ preview: { ...preview, shadows } })} />
          <ToggleRow label="Turntable" value={preview.turntable ?? false} disabled={locked} description="Stops when you navigate the viewport." onChange={turntable => s.setRecipe({ preview: { ...preview, turntable } })} />
        </Collapsible>}
      </>}
      {tab === 'output' && <Collapsible label="Model Output" icon={<AppIcon kind="save" size={14} />}>
        <p>{s.activeVersion ? `Viewing version ${s.activeVersion}` : 'Unsaved model'} · {s.artifact?.glb.size.toLocaleString() ?? s.versions.find(v => v.version === s.activeVersion)?.geometryStats.glbBytes?.toLocaleString() ?? '—'} GLB bytes</p>
        {!!s.versions.length && <SelectRow label="Model version" value={String(s.activeVersion)} disabled={busy} options={s.versions.map(v => ({ value: String(v.version), label: `Version ${v.version}` }))} onChange={version => loadVersion(Number(version))} />}
        {s.versions.length >= 50 && <IconChipButton onClick={() => { void s.moreVersions() }}>Load older versions</IconChipButton>}
      </Collapsible>}
      {(s.status === 'loading-source' || s.status === 'loading-model' || s.status === 'generating' || s.generationPending || busy) && <div role="status">{s.progress ?? (s.generationPending ? 'Updating 3D geometry…' : 'Loading model source…')} <IconChipButton disabled={s.status === 'deleting'} onClick={s.cancel}>Cancel operation</IconChipButton></div>}
      {s.error && <NoticeCard tone="error" role="alert" title="Model operation failed">{s.error}
        {(s.saveTarget || s.saveFailure) && <IconChipButton onClick={() => { void s.save() }}>Retry Save</IconChipButton>}
        {!s.saveTarget && !s.saveFailure && s.source && <IconChipButton onClick={() => { void s.prepare() }}>Retry preparation</IconChipButton>}
        {!s.source && !s.asset && <IconChipButton onClick={() => { void s.retrySource() }}>Retry source</IconChipButton>}
      </NoticeCard>}
      {s.warnings.map(warning => <NoticeCard key={warning} tone="warning" title="Model source">{warning}</NoticeCard>)}
    </div>
    {(pendingVersion !== null || revertOpen) && <ConfirmDialog title="Discard model edits?" message="Reloading a saved version replaces your current edits." confirmLabel="Discard and Reload" onCancel={() => { setPendingVersion(null); setRevertOpen(false) }} onConfirm={() => { if (pendingVersion !== null && s.asset) s.load(s.asset, pendingVersion); else if (s.error) void s.reloadLatest(); else s.revert(); setPendingVersion(null); setRevertOpen(false) }} />}
  </>
}
