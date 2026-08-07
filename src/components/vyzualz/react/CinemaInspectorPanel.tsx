import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMediaStore } from '../../../stores/mediaStore'
import { createCinemaMediaLibrarySnapshot } from './CinemaMediaLibraryBridge'
import {
  assignCinemaComposerNodeAsset,
  createCinemaCameraParameterSchemas,
  createCinemaControlDescriptors,
  getCinemaEditorSelection,
  setCinemaComposerCameraParameter,
  setCinemaComposerMasterParameter,
  setCinemaComposerNodeParameter,
  useCinemaStore,
  type CinemaAssetReference,
  type CinemaAssetRole,
  type CinemaExternalAssetSnapshot,
  type CinemaControlDescriptor,
  type CinemaNodeId,
  type CinemaParameterId,
  type CinemaParameterValue,
} from '../cinema'
import { Collapsible, ColorRow, CtrlSection, NumberInputRow, SelectRow, SliderRow, TextInputRow, ToggleRow } from './ReactControlRows'

export function CinemaInspectorPanel() {
  const state = useCinemaStore(useShallow(store => ({
    activeCompositionId: store.activeCompositionId,
    compositions: store.compositions,
    definitions: store.definitions,
    editorMetadata: store.editorMetadata,
    historyTransaction: store.historyTransaction,
  })))
  const composition = state.compositions.find(candidate => candidate.id === state.activeCompositionId) ?? null
  const mediaItems = useMediaStore(store => store.items)
  const mediaAssets = useMemo(() => createCinemaMediaLibrarySnapshot(mediaItems), [mediaItems])
  const selectedNodeId = composition ? getCinemaEditorSelection(state.editorMetadata, composition.id) : null
  const selectedNode = composition?.nodes.find(node => node.id === selectedNodeId) ?? null
  const persistedDefinition = selectedNode ? state.definitions.find(definition => definition.id === selectedNode.typeId) ?? null : null

  const selectedBinding = selectedNode?.assetBindingIds?.[0]
    ? composition?.assetBindings.find(binding => binding.id === selectedNode.assetBindingIds?.[0]) ?? null
    : null

  const masterDescriptors = useMemo(() => composition
    ? createCinemaControlDescriptors({ namespace: 'master', schemas: composition.masterParameters, values: composition.masterValues }).descriptors
    : [], [composition])
  const nodeDescriptors = useMemo(() => selectedNode && persistedDefinition
    ? createCinemaControlDescriptors({
        namespace: selectedNode.family === 'effect' ? 'effects' : 'nodes',
        ownerId: selectedNode.id,
        schemas: persistedDefinition.definition.parameters,
        values: selectedNode.parameterValues,
      }).descriptors
    : [], [persistedDefinition, selectedNode])

  if (!composition) {
    return <div className="rv-ctrl-group"><div className="rv-ctrl-info">Select a Cinema composition to inspect authored controls.</div></div>
  }

  const edit = (label: string, editor: Parameters<ReturnType<typeof useCinemaStore.getState>['editCinemaComposition']>[2]) => {
    useCinemaStore.getState().editCinemaComposition(composition.id, label, editor)
  }
  const beginGesture = (label: string) => {
    if (!useCinemaStore.getState().historyTransaction) useCinemaStore.getState().beginCinemaHistoryTransaction(label)
  }
  const endGesture = () => {
    if (useCinemaStore.getState().historyTransaction) useCinemaStore.getState().commitCinemaHistoryTransaction()
  }
  const assetOptions = mediaAssets.filter(asset => !asset.deleted).map(asset => ({ id: String(asset.assetId), label: asset.name }))

  return (
    <>
      <div className="rv-ctrl-group">
        <CtrlSection label="Cinema Inspector" />
        <InspectorKv label="Composition" value={composition.metadata.name} />
        <InspectorKv label="Schema" value={`v${composition.schemaVersion}`} />
        <InspectorKv label="Selected node" value={selectedNode?.label ?? selectedNode?.typeId ?? 'None'} />
      </div>

      <div className="rv-ctrl-group">
        <Collapsible label="Master parameters">
          {masterDescriptors.length === 0 ? <div className="rv-ctrl-info">This composition has no master parameter schemas.</div> : masterDescriptors.map(descriptor => (
            <SchemaControl
              key={descriptor.path}
              descriptor={descriptor}
              assetOptions={assetOptions}
              onChange={value => edit('Edit Cinema master parameter', current => setCinemaComposerMasterParameter(current, descriptor.id as CinemaParameterId, value))}
              onInteractionStart={() => beginGesture(`Adjust ${descriptor.label}`)}
              onInteractionEnd={endGesture}
            />
          ))}
        </Collapsible>
      </div>

      <div className="rv-ctrl-group">
        <Collapsible label={selectedNode?.family === 'effect' ? 'Selected effect' : 'Selected visual'}>
          {!selectedNode || !persistedDefinition ? (
            <div className="rv-ctrl-info">Select a visual or effect in the Cinema Composer to inspect it.</div>
          ) : (
            <>
              <InspectorKv label="Stable ID" value={String(selectedNode.id)} />
              <InspectorKv label="Type" value={persistedDefinition.definition.label} />
              <SelectRow
                label="Asset source"
                value={selectedBinding?.assetId ?? ''}
                onChange={assetId => {
                  const asset = mediaAssets.find(candidate => candidate.assetId === assetId) ?? null
                  edit('Assign Cinema node asset', current => assignCinemaComposerNodeAsset(
                    current,
                    selectedNode.id,
                    asset?.assetId ?? null,
                    assetRoleForNode(asset, selectedNode.family),
                  ))
                }}
                options={[{ value: '', label: 'No asset' }, ...mediaAssets.filter(asset => !asset.deleted).map(asset => ({ value: String(asset.assetId), label: asset.name }))]}
                description={mediaAssets.length === 0 ? 'No canonical media-library assets are available.' : 'Uses a stable Cinema asset ID; runtime URLs remain outside persisted state.'}
              />
              {nodeDescriptors.map(descriptor => (
                <SchemaControl
                  key={descriptor.path}
                  descriptor={descriptor}
                  assetOptions={assetOptions}
                  onChange={value => edit('Edit Cinema node parameter', current => setCinemaComposerNodeParameter(current, selectedNode.id, descriptor.id as CinemaParameterId, value, state.definitions))}
                  onInteractionStart={() => beginGesture(`Adjust ${descriptor.label}`)}
                  onInteractionEnd={endGesture}
                />
              ))}
              {nodeDescriptors.length === 0 && <div className="rv-ctrl-info">This node type has no authored parameter schemas.</div>}
            </>
          )}
        </Collapsible>
      </div>

      <div className="rv-ctrl-group">
        <Collapsible label={`Camera resources (${composition.cameras.length})`} defaultOpen={false}>
          {composition.cameras.length === 0 ? <div className="rv-ctrl-info">No camera resources are referenced by this composition.</div> : composition.cameras.map(camera => {
            const descriptors = createCinemaControlDescriptors({
              namespace: 'cameras',
              ownerId: camera.id,
              schemas: createCinemaCameraParameterSchemas(camera),
              values: camera.parameterValues,
            }).descriptors
            return (
              <Collapsible key={camera.id} label={camera.label} defaultOpen={false}>
                <InspectorKv label="Mode" value={camera.mode} />
                <InspectorKv label="Stable ID" value={String(camera.id)} />
                {descriptors.map(descriptor => (
                  <SchemaControl
                    key={descriptor.path}
                    descriptor={descriptor}
                    assetOptions={assetOptions}
                    onChange={value => edit('Edit Cinema camera parameter', current => setCinemaComposerCameraParameter(current, camera.id, descriptor.id as CinemaParameterId, value))}
                    onInteractionStart={() => beginGesture(`Adjust ${camera.label} ${descriptor.label}`)}
                    onInteractionEnd={endGesture}
                  />
                ))}
              </Collapsible>
            )
          })}
        </Collapsible>
      </div>

      <div className="rv-ctrl-group">
        <Collapsible label={`Asset bindings (${composition.assetBindings.length})`} defaultOpen={false}>
          {composition.assetBindings.length === 0 ? <div className="rv-ctrl-info">No stable Cinema asset bindings are authored.</div> : composition.assetBindings.map(binding => (
            <Collapsible key={binding.id} label={`${binding.role} · ${binding.assetId}`} defaultOpen={false}>
              <InspectorKv label="Binding ID" value={String(binding.id)} />
              <SelectRow label="Fit" value={binding.fit} onChange={fit => useCinemaStore.getState().upsertCinemaAssetBinding(composition.id, { ...binding, fit: fit as typeof binding.fit })} options={['contain', 'cover', 'stretch', 'none'].map(value => ({ value, label: value }))} />
              <SliderRow label="Opacity" value={binding.opacity} onChange={opacity => useCinemaStore.getState().upsertCinemaAssetBinding(composition.id, { ...binding, opacity })} onInteractionStart={() => beginGesture(`Adjust ${binding.role} asset opacity`)} onInteractionEnd={endGesture} />
              <ToggleRow label="Preserve original colors" value={binding.preserveOriginalColors} onChange={preserveOriginalColors => useCinemaStore.getState().upsertCinemaAssetBinding(composition.id, { ...binding, preserveOriginalColors })} />
              <SelectRow label="Brand role" value={binding.colorizeWithBrandRole ?? ''} onChange={role => useCinemaStore.getState().upsertCinemaAssetBinding(composition.id, { ...binding, colorizeWithBrandRole: role ? role as typeof binding.colorizeWithBrandRole : undefined })} options={[{ value: '', label: 'No Brand Kit mapping' }, ...['primary', 'secondary', 'accent', 'background', 'foreground', 'highlight', 'shadow'].map(value => ({ value, label: value }))]} />
              <SelectRow label="Brand policy" value={binding.brandColorPolicy ?? 'free'} onChange={brandColorPolicy => useCinemaStore.getState().upsertCinemaAssetBinding(composition.id, { ...binding, brandColorPolicy: brandColorPolicy as NonNullable<typeof binding.brandColorPolicy> })} options={['exact', 'derived', 'free'].map(value => ({ value, label: value }))} />
            </Collapsible>
          ))}
        </Collapsible>
      </div>

      {persistedDefinition && (
        <div className="rv-ctrl-group">
          <Collapsible label="Brand Kit mappings" defaultOpen={false}>
            {persistedDefinition.definition.parameters.map(parameter => parameter.type === 'color' && parameter.brandRole ? (
              <InspectorKv key={parameter.id} label={parameter.label} value={`${parameter.brandRole} · ${parameter.brandPolicy ?? 'derived'}`} />
            ) : null)}
            {!persistedDefinition.definition.parameters.some(parameter => parameter.type === 'color' && parameter.brandRole) && <div className="rv-ctrl-info">This node has no schema-declared Brand Kit color mappings.</div>}
          </Collapsible>
        </div>
      )}
    </>
  )
}

function SchemaControl({
  descriptor,
  assetOptions,
  onChange,
  onInteractionStart,
  onInteractionEnd,
}: {
  descriptor: CinemaControlDescriptor
  assetOptions: readonly { id: string; label: string }[]
  onChange: (value: CinemaParameterValue) => void
  onInteractionStart: () => void
  onInteractionEnd: () => void
}) {
  const description = descriptor.disabledReason ?? descriptor.help.helpText ?? descriptor.help.description
  if (descriptor.type === 'float') {
    return <SliderRow label={descriptor.label} value={numberValue(descriptor.value)} min={numberBound(descriptor.min, 0)} max={numberBound(descriptor.max, 1)} step={numberBound(descriptor.step, 0.01)} disabled={descriptor.disabled} description={description} onChange={onChange} onInteractionStart={onInteractionStart} onInteractionEnd={onInteractionEnd} />
  }
  if (descriptor.type === 'integer') {
    return <NumberInputRow label={descriptor.label} value={numberValue(descriptor.value)} min={numberBound(descriptor.min)} max={numberBound(descriptor.max)} step={numberBound(descriptor.step, 1)} disabled={descriptor.disabled} unit={descriptor.unit} onChange={onChange} />
  }
  if (descriptor.type === 'boolean') {
    return <ToggleRow label={descriptor.label} value={Boolean(descriptor.value)} disabled={descriptor.disabled} description={description} onChange={onChange} />
  }
  if (descriptor.type === 'enum') {
    return <SelectRow label={descriptor.label} value={String(descriptor.value)} disabled={descriptor.disabled} description={description} options={(descriptor.options ?? []).map(option => ({ value: option.id, label: option.label }))} onChange={onChange} />
  }
  if (descriptor.type === 'string') {
    return <TextInputRow label={descriptor.label} value={String(descriptor.value ?? '')} onChange={onChange} placeholder={descriptor.placeholder} disabled={descriptor.disabled} description={description} />
  }
  if (descriptor.type === 'color') {
    const color = Array.isArray(descriptor.value) ? descriptor.value : [1, 1, 1, 1]
    return <ColorRow label={descriptor.label} value={rgbaToHex(color)} disabled={descriptor.disabled} description={description} onChange={hex => onChange(hexToRgba(hex, Number(color[3] ?? 1)))} />
  }
  if (descriptor.type === 'vector2' || descriptor.type === 'vector3') {
    const values = Array.isArray(descriptor.value) ? [...descriptor.value] as number[] : descriptor.type === 'vector2' ? [0, 0] : [0, 0, 0]
    return (
      <div className="rv-cinema-inspector__vector">
        <span>{descriptor.label}</span>
        {values.map((value, index) => <NumberInputRow key={index} label={['X', 'Y', 'Z'][index]} value={Number(value)} step={vectorBound(descriptor.step, index, 0.01)} min={vectorBound(descriptor.min, index)} max={vectorBound(descriptor.max, index)} disabled={descriptor.disabled} onChange={next => { const updated = [...values]; updated[index] = next; onChange(updated as unknown as CinemaParameterValue) }} />)}
      </div>
    )
  }
  if (descriptor.type === 'asset' || descriptor.type === 'asset-reference' || descriptor.type === 'texture') {
    const reference = isAssetReference(descriptor.value) ? descriptor.value : null
    return <SelectRow label={descriptor.label} value={reference?.assetId ?? ''} disabled={descriptor.disabled} description={description} options={[{ value: '', label: 'No asset' }, ...assetOptions.map(option => ({ value: option.id, label: option.label }))]} onChange={assetId => onChange(assetId ? { assetId, role: descriptor.acceptedRoles?.[0] ?? 'image' } as CinemaParameterValue : null)} />
  }
  return (
    <div className="rv-ctrl-info" role="note">
      <strong>{descriptor.label}</strong><br />
      {descriptor.type === 'trigger' ? 'Runtime trigger controls are commands and are not persisted by the Inspector.' : `Schema control type “${descriptor.type}” is represented by its canonical value but does not have a compact editor yet.`}
    </div>
  )
}

function InspectorKv({ label, value }: { label: string; value: string }) {
  return <div className="rv-insp-kv"><span className="rv-insp-key">{label}</span><span className="rv-insp-val" title={value}>{value}</span></div>
}
function assetRoleForNode(asset: Readonly<CinemaExternalAssetSnapshot> | null, family: string): CinemaAssetRole {
  if (family === 'logo') return 'logo'
  switch (asset?.mediaKind) {
    case 'video': return 'video'
    case 'svg': return family === 'logo' ? 'logo' : 'image'
    case 'font': return 'font'
    case 'audio': return 'audio'
    case 'node-output': return 'node-output'
    case 'image': return 'image'
    default: return 'image'
  }
}
function numberValue(value: CinemaParameterValue): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0 }
function numberBound(value: number | readonly number[] | undefined, fallback?: number): number | undefined { return typeof value === 'number' ? value : fallback }
function vectorBound(value: number | readonly number[] | undefined, index: number, fallback?: number): number | undefined { return Array.isArray(value) ? Number(value[index] ?? fallback) : typeof value === 'number' ? value : fallback }
function isAssetReference(value: CinemaParameterValue): value is CinemaAssetReference { return value != null && typeof value === 'object' && !Array.isArray(value) && 'assetId' in value }
function rgbaToHex(value: readonly unknown[]): string { return `#${[0, 1, 2].map(index => Math.round(Math.max(0, Math.min(1, Number(value[index] ?? 1))) * 255).toString(16).padStart(2, '0')).join('')}` }
function hexToRgba(value: string, alpha: number): readonly [number, number, number, number] { const clean = value.replace('#', ''); return [parseInt(clean.slice(0, 2), 16) / 255, parseInt(clean.slice(2, 4), 16) / 255, parseInt(clean.slice(4, 6), 16) / 255, alpha] }
