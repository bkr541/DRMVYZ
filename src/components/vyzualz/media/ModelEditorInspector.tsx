import '../../../styles/reactView.css'
import { useEffect, useState } from 'react'
import { selectModelCanSave, useModelEditorStore } from '../../../features/models/state/modelEditorStore'
import { MODEL_MATERIAL_PRESETS } from '../../../features/models/materials/modelMaterials'
import { Collapsible, ColorRow, NumberInputRow, SelectRow, SliderRow, TextAreaRow, TextInputRow, ToggleRow } from '../react/ReactControlRows'
import { IconChipButton } from '../react/controls/IconChipButton'
import { ConfirmDialog } from '../react/controls/ConfirmDialog'
import { NoticeCard } from '../react/controls/NoticeCard'
import { RailWindowHeader } from '../layout/RailWindowHeader'
import { RailTabs, type RailTabOption } from '../layout/RailTabs'
import { TagsCollectionsGroup } from './MediaManagerInspector'
import { AppIcon } from '../../shared/icons/AppIcon'
const tabs: RailTabOption<'info' | 'edit' | 'output'>[] = [{ id: 'info', label: 'Info' }, { id: 'edit', label: 'Edit' }, { id: 'output', label: 'Output' }]
export function ModelEditorInspector({ onSelectSource }: { onSelectSource?: () => void }) {
  const s = useModelEditorStore(), canSave = useModelEditorStore(selectModelCanSave)
  const [tab, setTab] = useState<'info' | 'edit' | 'output'>(() => useModelEditorStore.getState().asset ? 'info' : 'edit')
  const [url, setUrl] = useState<string | null>(null), [copyName, setCopyName] = useState<string | null>(null)
  const [pendingVersion, setPendingVersion] = useState<number | null>(null), [revertOpen, setRevertOpen] = useState(false)
  useEffect(() => { if (!s.preview) { setUrl(null); return }; const next = URL.createObjectURL(s.preview); setUrl(next); return () => URL.revokeObjectURL(next) }, [s.preview])
  const busy = s.status === 'saving' || s.status === 'deleting'
  const locked = busy || !!s.publishedVersion || !!s.pendingOperationId || !s.source
  const recipe = s.recipe
  const geometry = recipe?.geometry, preview = recipe?.preview
  const size = s.model ? s.model.stats.bounds.max.map((n, i) => (n - s.model!.stats.bounds.min[i]).toFixed(3)).join(' × ') : '—'
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
      <SelectRow label={`${region} material preset`} value={preset} disabled={locked} options={[{ value: 'custom', label: 'Custom', disabled: true }, ...Object.keys(MODEL_MATERIAL_PRESETS).map(name => ({ value: name, label: name }))]}
        onChange={name => { const picked = MODEL_MATERIAL_PRESETS[name as keyof typeof MODEL_MATERIAL_PRESETS]; if (picked) update({ ...picked, emissiveIntensity: 1, clearcoat: 0, clearcoatRoughness: 0.1 }) }} />
      <ColorRow label={`${region} color`} value={value.color} disabled={locked} onChange={color => update({ color })} />
      <SliderRow label={`${region} metalness`} value={value.metalness} disabled={locked} onChange={metalness => update({ metalness })} />
      <SliderRow label={`${region} roughness`} value={value.roughness} disabled={locked} onChange={roughness => update({ roughness })} />
      <ColorRow label={`${region} emissive`} value={value.emissive} disabled={locked} onChange={emissive => update({ emissive })} />
      <SliderRow label={`${region} emissive intensity`} value={value.emissiveIntensity ?? 1} min={0} max={5} disabled={locked || value.emissive === '#000000'} onChange={emissiveIntensity => update({ emissiveIntensity })} />
      <SliderRow label={`${region} clearcoat`} value={value.clearcoat ?? 0} disabled={locked} onChange={clearcoat => update({ clearcoat })} />
      {(value.clearcoat ?? 0) > 0 && <SliderRow label={`${region} clearcoat roughness`} value={value.clearcoatRoughness ?? 0.1} disabled={locked} onChange={clearcoatRoughness => update({ clearcoatRoughness })} />}
      <SliderRow label={`${region} opacity`} value={value.opacity} min={0.05} max={1} disabled={locked} onChange={opacity => update({ opacity })} />
    </Collapsible>
  }
  return <><RailWindowHeader side="right" icon={<AppIcon kind="layers" size={15} />} label="3D Model" />
    <RailTabs tabs={tabs} activeTab={tab} onChange={value => { if (value === 'info' || value === 'edit' || value === 'output') setTab(value) }} ariaLabel="Model inspector tabs" className="mmi-tabs" />
    <div className="mmi-body mm-model-inspector">
      {tab === 'info' && <>
        <Collapsible label="Model Info" icon={<AppIcon kind="info" size={14} />}>
          <TextInputRow label="Model name" value={s.name} maxLength={200} disabled={busy} onChange={name => s.setMetadata({ name })} />
          <TextAreaRow label="Description" value={s.description ?? ''} disabled={busy} onChange={description => s.setMetadata({ description: description.slice(0, 4000) || null })} />
          <ToggleRow label="Favorite model" value={s.favorite} disabled={busy} onChange={favorite => s.setMetadata({ favorite })} />
          <p>{s.asset?.currentVersion ? `Version ${s.activeVersion} · Latest ${s.asset.currentVersion}` : 'Draft / Unsaved'}{s.dirty ? ' · Modified' : ''}</p>
          <p>Dimensions: {size}</p>
          {s.model && <p>{s.model.stats.triangles.toLocaleString()} triangles · {s.model.stats.vertices.toLocaleString()} vertices · {s.artifact?.materialCount ?? s.versions.find(v => v.version === s.activeVersion)?.geometryStats.materialCount ?? '—'} materials</p>}
          {s.sourceInfo && <p>Source snapshot: {s.sourceInfo.width} × {s.sourceInfo.height} · {s.sourceInfo.mimeType}</p>}
          {s.sourceMediaId && <IconChipButton disabled={!onSelectSource || busy} onClick={onSelectSource}>View source image</IconChipButton>}
          {!s.sourceMediaId && s.source && <p>Using the independent source snapshot.</p>}
          {s.asset && <><p>Owner: {s.asset.userId}</p><p>Modified: {new Date(s.asset.updatedAt).toLocaleString()}</p></>}
        </Collapsible>
        <fieldset disabled={busy} className="mm-model-organization"><TagsCollectionsGroup idPrefix="model" tags={s.tags} onTagsChange={tags => s.setMetadata({ tags })} collectionIds={s.collectionIds} onCollectionIdsChange={collectionIds => s.setMetadata({ collectionIds })} /></fieldset>
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
          <IconChipButton disabled={locked || !s.preview || (s.needsConfirmation && !s.confirmed)} onClick={() => { void s.generate() }}>{s.model ? 'Regenerate 3D Model' : 'Generate 3D Model'}</IconChipButton>
        </Collapsible>
        {geometry && <Collapsible label="Geometry" icon={<AppIcon kind="layers" size={14} />}>
          <NumberInputRow label="Depth" value={geometry.depth} min={0.01} max={10} step={0.01} disabled={locked} onChange={depth => s.setRecipe({ geometry: { ...geometry, depth } })} />
          <ToggleRow label="Bevel" value={geometry.bevelEnabled} disabled={locked} onChange={bevelEnabled => s.setRecipe({ geometry: { ...geometry, bevelEnabled } })} />
          {geometry.bevelEnabled && <>
            <NumberInputRow label="Bevel width" value={geometry.bevelSize} min={0} max={1} step={0.005} disabled={locked} onChange={bevelSize => s.setRecipe({ geometry: { ...geometry, bevelSize } })} />
            <NumberInputRow label="Bevel thickness" value={geometry.bevelThickness} min={0} max={1} step={0.005} disabled={locked} onChange={bevelThickness => s.setRecipe({ geometry: { ...geometry, bevelThickness } })} />
            <NumberInputRow label="Bevel segments" value={geometry.bevelSegments} min={1} max={16} step={1} disabled={locked} onChange={bevelSegments => s.setRecipe({ geometry: { ...geometry, bevelSegments } })} />
          </>}
          <NumberInputRow label="Curve detail" value={geometry.curveSegments} min={1} max={64} step={1} disabled={locked} onChange={curveSegments => s.setRecipe({ geometry: { ...geometry, curveSegments } })} />
          <SelectRow label="Pivot" value={recipe.transform.pivot} disabled={locked} options={[{ value: 'center', label: 'Center' }, { value: 'bottom', label: 'Bottom' }]} onChange={pivot => s.setRecipe({ transform: { ...recipe.transform, pivot: pivot as 'center' | 'bottom' } })} />
          <NumberInputRow label="Uniform scale" value={recipe.transform.scale[0]} min={0.01} max={10} step={0.05} disabled={locked} onChange={scale => s.setRecipe({ transform: { ...recipe.transform, scale: [scale, scale, scale] } })} />
        </Collapsible>}
        <Collapsible label="Materials" icon={<AppIcon kind="edit" size={14} />}>{material('front')}{material('side')}</Collapsible>
        {preview && <Collapsible label="Preview" icon={<AppIcon kind="image" size={14} />}>
          <p>Preview lighting, background and motion are included in PNG previews, not the GLB.</p>
          <ColorRow label="Preview background" value={preview.background} disabled={locked} onChange={background => s.setRecipe({ preview: { ...preview, background } })} />
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
        <IconChipButton disabled={!s.model || busy || s.generationPending} onClick={() => { void s.download('glb') }}>Download GLB</IconChipButton>
        <IconChipButton disabled={!s.model || busy} onClick={() => { void s.download('png') }}>Download Preview PNG</IconChipButton>
        <IconChipButton disabled={!canSave} onClick={() => { void s.save() }}>Save{!s.asset ? ' Model' : s.savedRecipe && JSON.stringify(s.savedRecipe) === JSON.stringify(s.recipe) ? ' Metadata' : ' New Version'}</IconChipButton>
        <IconChipButton disabled={!s.artifact || !s.source || busy || s.generationPending || !!s.publishedVersion || !!s.pendingOperationId || !!s.saveTarget} onClick={() => setCopyName(`${s.name} copy`)}>Save As New Model</IconChipButton>
      </Collapsible>}
      {s.dirty && <IconChipButton disabled={busy} onClick={() => setRevertOpen(true)}>{s.asset ? 'Revert to Saved Version' : 'Reset Model'}</IconChipButton>}
      {(s.status === 'loading-source' || s.status === 'loading-model' || s.status === 'generating' || s.generationPending || busy) && <div role="status">{s.progress ?? (s.generationPending ? 'Updating 3D geometry…' : 'Loading model source…')} <IconChipButton disabled={s.status === 'deleting'} onClick={s.cancel}>Cancel operation</IconChipButton></div>}
      {s.error && <NoticeCard tone="error" role="alert" title="Model operation failed">{s.error}
        {(s.saveTarget || s.saveFailure) && <IconChipButton onClick={() => { void s.save() }}>Retry Save</IconChipButton>}
        {!s.saveTarget && !s.saveFailure && s.source && <IconChipButton onClick={() => { void s.prepare() }}>Retry preparation</IconChipButton>}
        {!s.source && !s.asset && <IconChipButton onClick={() => { void s.retrySource() }}>Retry source</IconChipButton>}
        {s.asset && <IconChipButton disabled={busy} onClick={() => setRevertOpen(true)}>Reload latest saved version</IconChipButton>}
      </NoticeCard>}
      {s.warnings.map(warning => <NoticeCard key={warning} tone="warning" title="Model source">{warning}</NoticeCard>)}
    </div>
    {copyName !== null && <ConfirmDialog title="Save As New Model" message="Create a separate model and version history." confirmLabel="Save New Model" danger={false} confirmTone="primary" confirmDisabled={!copyName.trim()} onCancel={() => setCopyName(null)} onConfirm={() => { const name = copyName; setCopyName(null); void s.save(name) }}><TextInputRow label="New model name" value={copyName} maxLength={200} onChange={setCopyName} /></ConfirmDialog>}
    {(pendingVersion !== null || revertOpen) && <ConfirmDialog title="Discard model edits?" message="Reloading a saved version replaces your current edits." confirmLabel="Discard and Reload" onCancel={() => { setPendingVersion(null); setRevertOpen(false) }} onConfirm={() => { if (pendingVersion !== null && s.asset) s.load(s.asset, pendingVersion); else if (s.error) void s.reloadLatest(); else s.revert(); setPendingVersion(null); setRevertOpen(false) }} />}
  </>
}
