import { Fragment, useMemo } from 'react'
import { IconChipButton } from './controls/IconChipButton'
import { useShallow } from 'zustand/react/shallow'
import { useMediaStore } from '../../../stores/mediaStore'
import { useReactStore } from '../../../stores/reactStore'
import { createCinemaFontLibrarySnapshot, createCinemaMediaLibrarySnapshot } from './CinemaMediaLibraryBridge'
import {
  CINEMA_3D_OBJECT_PARAMETER_IDS,
  createCinemaInspectorAppearanceCapabilities,
  createCinemaControlDescriptors,
  filterCinema3DObjectParameterSchemasForSource,
  getCinemaEditorSelection,
  getCinemaCinematicWorldSupportedParameterSchemasForNode,
  getCinemaSupportedPaletteRoles,
  getCinemaSupportedParameterSchemas,
  isCinemaAssetRoleCompatible,
  useCinemaStore,
  type CinemaAssetMediaKind,
  type CinemaAssetReference,
  type CinemaControlDescriptor,
  type CinemaNodeId,
  type CinemaParameterDefinition,
  type CinemaParameterId,
  type CinemaParameterValue,
} from '../cinema'
import { Collapsible, ColorRow, CtrlSection, NumberInputRow, PaletteColorRow, SelectRow, SliderRow, TextInputRow, ToggleRow } from './ReactControlRows'
import { REACT_ENGINE_CATALOG } from './reactEngineCatalog'
import {
  getCinemaLiveInstance,
  resetCinemaLiveOverrides,
  setCinemaLiveCameraOverride,
  setCinemaLiveMasterOverride,
  setCinemaLiveNodeOverride,
} from './CinemaLiveOverrides'

export function CinemaInspectorPanel() {
  const state = useCinemaStore(useShallow(store => ({
    activeCompositionId: store.activeCompositionId,
    compositions: store.compositions,
    definitions: store.definitions,
    instances: store.instances,
    editorMetadata: store.editorMetadata,
  })))
  const composition = state.compositions.find(candidate => candidate.id === state.activeCompositionId) ?? null
  const mediaItems = useMediaStore(store => store.items)
  const mediaAssets = useMemo(() => createCinemaMediaLibrarySnapshot(mediaItems), [mediaItems])
  const fontAssets = useReactStore(store => store.oscillatorFontAssets)
  const cinemaAssets = useMemo(() => Object.freeze([
    ...mediaAssets,
    ...createCinemaFontLibrarySnapshot(fontAssets),
  ]), [fontAssets, mediaAssets])
  const selectedNodeId = composition ? getCinemaEditorSelection(state.editorMetadata, composition.id) : null
  const selectedNode = composition?.nodes.find(node => node.id === selectedNodeId) ?? null
  const liveInstance = composition ? getCinemaLiveInstance(composition.id, state.instances) : null
  const selectedNodeValues = useMemo(() => selectedNode ? {
    ...selectedNode.parameterValues,
    ...(liveInstance?.nodeOverrides.find(override => override.nodeId === selectedNode.id)?.values ?? {}),
  } : {}, [liveInstance, selectedNode])
  const persistedDefinition = selectedNode ? state.definitions.find(definition => definition.id === selectedNode.typeId) ?? null : null

  const selectedBinding = selectedNode?.assetBindingIds?.[0]
    ? composition?.assetBindings.find(binding => binding.id === selectedNode.assetBindingIds?.[0]) ?? null
    : null

  const appearanceCapabilities = useMemo(() => composition
    ? createCinemaInspectorAppearanceCapabilities(composition, state.definitions)
    : null, [composition, state.definitions])
  const supportedMasterSchemas = appearanceCapabilities?.masterParameters ?? []
  const supportedNodeSchemas = useMemo(() => {
    if (!persistedDefinition || !selectedNode) return []
    const schemas = persistedDefinition.definition.metadata?.adapter === 'CinematicWorldNodeAdapter'
      ? getCinemaCinematicWorldSupportedParameterSchemasForNode(persistedDefinition.definition, selectedNode)
      : getCinemaSupportedParameterSchemas(persistedDefinition.definition)
    return filterCinema3DObjectParameterSchemasForSource(
      schemas.filter(schema => schema.group !== 'React'),
      selectedNodeValues,
    )
  }, [persistedDefinition, selectedNode, selectedNodeValues])
  const supportedCameraSchemas: Readonly<Record<string, readonly Readonly<CinemaParameterDefinition>[]>> =
    appearanceCapabilities?.cameraParameterSchemas ?? Object.freeze({})
  const masterDescriptors = useMemo(() => composition
    ? createCinemaControlDescriptors({ namespace: 'master', schemas: supportedMasterSchemas, values: { ...composition.masterValues, ...(liveInstance?.masterOverrides ?? {}) } }).descriptors
    : [], [composition, liveInstance, supportedMasterSchemas])
  const nodeDescriptors = useMemo(() => selectedNode && persistedDefinition
    ? createCinemaControlDescriptors({
        namespace: selectedNode.family === 'effect' ? 'effects' : 'nodes',
        ownerId: selectedNode.id,
        schemas: supportedNodeSchemas,
        values: selectedNodeValues,
      }).descriptors
    : [], [persistedDefinition, selectedNode, selectedNodeValues, supportedNodeSchemas])
  const paletteOrder = ['background', 'primary', 'secondary', 'accent', 'foreground', 'highlight']
  const supportedPaletteRoles = persistedDefinition ? getCinemaSupportedPaletteRoles(persistedDefinition.definition) : []
  const roleForDescriptor = (id: typeof nodeDescriptors[number]['id']) => {
    const schema = persistedDefinition?.definition.parameters.find(parameter => parameter.id === id)
    return schema?.type === 'color' ? schema.brandRole : undefined
  }
  const colorDescriptors = nodeDescriptors.filter(descriptor => descriptor.type === 'color' && !isCinema3DObjectDescriptor(descriptor))
  const semanticColorDescriptors = colorDescriptors.filter(descriptor => roleForDescriptor(descriptor.id) !== undefined)
  const brandDescriptors = semanticColorDescriptors.filter(descriptor => {
    const role = roleForDescriptor(descriptor.id)
    return role !== undefined && supportedPaletteRoles.includes(role)
  })
  // Prefer only canonical brand-role slots with verified renderer consumers —
  // that's what "Palette" means. Otherwise a node's own non-brand color
  // params (e.g. Prism Tunnel's own "Primary Color"/"Secondary Color"
  // uniforms, added alongside the generic brand set) collide visually under
  // the same stripped label. Nodes with no brand-tagged colors at all (e.g.
  // Foundation Gradient's Background Color/Color B) fall back to showing
  // every color param, same as before.
  const paletteDescriptors = semanticColorDescriptors.length > 0
    ? [...brandDescriptors].sort((left, right) => paletteOrder.indexOf(roleForDescriptor(left.id) as string) - paletteOrder.indexOf(roleForDescriptor(right.id) as string))
    : colorDescriptors
  const detailDescriptors = nodeDescriptors.filter(descriptor => !paletteDescriptors.includes(descriptor))
  const object3dDescriptors = detailDescriptors.filter(isCinema3DObjectDescriptor)
  const regularDetailDescriptors = detailDescriptors.filter(descriptor => !isCinema3DObjectDescriptor(descriptor))

  if (!composition) {
    return <div className="rv-ctrl-group"><div className="rv-ctrl-info">Select a Cinema preset to edit its live appearance.</div></div>
  }

  const assetOptions = cinemaAssets.filter(asset => !asset.deleted).map(asset => ({
    id: String(asset.assetId),
    label: asset.name,
    mediaKind: asset.mediaKind,
    mimeType: asset.mimeType,
  }))

  return (
    <>
      {appearanceCapabilities?.showMasterAppearance && (
        <div className="rv-ctrl-group">
          <Collapsible label="Master Appearance">
            {masterDescriptors.map(descriptor => (
              <SchemaControl
                key={descriptor.path}
                descriptor={descriptor}
                assetOptions={assetOptions}
                onChange={value => {
                  const schema = composition.masterParameters.find(candidate => candidate.id === descriptor.id)
                  if (schema) setCinemaLiveMasterOverride(composition, schema, value)
                }}
                onInteractionStart={() => {}}
                onInteractionEnd={() => {}}
              />
            ))}
          </Collapsible>
        </div>
      )}

      <div className="rv-ctrl-group">
        <div className="rv-ctrl-info">Changes here are live overrides. The original preset remains unchanged.</div>
        {liveInstance && <IconChipButton onClick={() => resetCinemaLiveOverrides(composition.id)}>Reset Live Changes</IconChipButton>}
      </div>

      {paletteDescriptors.length > 0 && <div className="rv-ctrl-group">
        <Collapsible label="Palette" bodyClassName="rv-cinema-palette-body">
          {paletteDescriptors.map(descriptor => {
            const color = Array.isArray(descriptor.value) ? descriptor.value : [1, 1, 1, 1]
            return (
              <PaletteColorRow
                key={descriptor.path}
                label={descriptor.label.replace(' Color', '')}
                value={rgbaToHex(color)}
                disabled={descriptor.disabled}
                description={descriptor.disabledReason ?? descriptor.help.helpText ?? descriptor.help.description}
                onChange={hex => {
                  const schema = persistedDefinition?.definition.parameters.find(candidate => candidate.id === descriptor.id)
                  if (schema && selectedNode) setCinemaLiveNodeOverride(composition, selectedNode.id, schema, hexToRgba(hex, Number(color[3] ?? 1)))
                }}
              />
            )
          })}
        </Collapsible>
      </div>}

      <div className="rv-ctrl-group">
        <Collapsible label={selectedNode?.family === 'effect' ? 'Selected Effect' : 'Selected Layer'}>
          {!selectedNode || !persistedDefinition ? (
            <div className="rv-ctrl-info">Select a layer or effect in Layers to edit it.</div>
          ) : (
            <>
              <InspectorKv label="Stable ID" value={String(selectedNode.id)} />
              <InspectorKv label="Type" value={persistedDefinition.definition.label} />
              <SelectRow
                label="Asset source"
                value={selectedBinding?.assetId ?? ''}
                onChange={() => {}}
                disabled
                options={[{ value: '', label: 'No asset' }, ...mediaAssets.filter(asset => !asset.deleted).map(asset => ({ value: String(asset.assetId), label: asset.name }))]}
                description="Assign media and change preset structure in Show Manager."
              />
              {regularDetailDescriptors.map(descriptor => (
                <SchemaControl
                  key={descriptor.path}
                  descriptor={descriptor}
                  assetOptions={assetOptions}
                  onChange={value => {
                    const schema = persistedDefinition.definition.parameters.find(candidate => candidate.id === descriptor.id)
                    if (schema) setCinemaLiveNodeOverride(composition, selectedNode.id, schema, value)
                  }}
                  onInteractionStart={() => {}}
                  onInteractionEnd={() => {}}
                />
              ))}
              {object3dDescriptors.length > 0 && <CtrlSection label="3D Object" />}
              {['Source', 'Geometry', 'Transform', 'Appearance'].map(group => {
                const descriptors = object3dDescriptors.filter(descriptor => descriptor.group === group)
                if (descriptors.length === 0) return null
                return (
                  <Fragment key={group}>
                    <CtrlSection label={group} />
                    {descriptors.map(descriptor => (
                      <SchemaControl
                        key={descriptor.path}
                        descriptor={descriptor}
                        assetOptions={assetOptions}
                        onChange={value => {
                          const schema = persistedDefinition.definition.parameters.find(candidate => candidate.id === descriptor.id)
                          if (schema) setCinemaLiveNodeOverride(composition, selectedNode.id, schema, value)
                        }}
                        onInteractionStart={() => {}}
                        onInteractionEnd={() => {}}
                      />
                    ))}
                  </Fragment>
                )
              })}
              {detailDescriptors.length === 0 && <div className="rv-ctrl-info">This layer has no additional appearance controls.</div>}
            </>
          )}
        </Collapsible>
      </div>

      {appearanceCapabilities?.showCameraResources && (
        <div className="rv-ctrl-group">
          <Collapsible label={`Camera resources (${composition.cameras.length})`} defaultOpen={false}>
            {composition.cameras.map(camera => {
              const schemas = supportedCameraSchemas[camera.id] ?? []
              const descriptors = createCinemaControlDescriptors({
                namespace: 'cameras',
                ownerId: camera.id,
                schemas,
                values: { ...camera.parameterValues, ...(liveInstance?.cameraOverrides.find(override => override.cameraId === camera.id)?.values ?? {}) },
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
                      onChange={value => {
                        const schema = schemas.find(candidate => candidate.id === descriptor.id)
                        if (schema) setCinemaLiveCameraOverride(composition, camera.id, schema, value)
                      }}
                      onInteractionStart={() => {}}
                      onInteractionEnd={() => {}}
                    />
                  ))}
                  {descriptors.length === 0 && <div className="rv-ctrl-info">This camera mode has no renderer-supported live controls.</div>}
                </Collapsible>
              )
            })}
          </Collapsible>
        </div>
      )}

    </>
  )
}

/** Cinema's SELECTION tab — mirrors the canvas engine's SELECTION tab shape
 * exactly (an Engine Summary rv-ctrl-group, then a read-only rv-ctrl-group
 * of KvRow-style pairs for the selected object) instead of the editable
 * Collapsible/SchemaControl form CinemaInspectorPanel uses for the same
 * layer under ENGINE. Re-derives the same selected-node/descriptor data
 * CinemaInspectorPanel computes rather than sharing state with it, so
 * editing on the ENGINE tab can't be disturbed by this read-only view. */
export function CinemaSelectedLayerSummary() {
  const state = useCinemaStore(useShallow(store => ({
    activeCompositionId: store.activeCompositionId,
    compositions: store.compositions,
    definitions: store.definitions,
    instances: store.instances,
    editorMetadata: store.editorMetadata,
  })))
  const mediaItems = useMediaStore(store => store.items)
  const mediaAssets = useMemo(() => createCinemaMediaLibrarySnapshot(mediaItems), [mediaItems])
  const fontAssets = useReactStore(store => store.oscillatorFontAssets)
  const cinemaAssets = useMemo(() => Object.freeze([
    ...mediaAssets,
    ...createCinemaFontLibrarySnapshot(fontAssets),
  ]), [fontAssets, mediaAssets])
  const assetOptions = useMemo(
    () => cinemaAssets.filter(asset => !asset.deleted).map(asset => ({ id: String(asset.assetId), label: asset.name, mediaKind: asset.mediaKind, mimeType: asset.mimeType })),
    [cinemaAssets],
  )
  const composition = state.compositions.find(candidate => candidate.id === state.activeCompositionId) ?? null

  const engineSummary = (
    <div className="rv-ctrl-group">
      <CtrlSection label="Engine Summary" />
      <InspectorKv label="Engine" value={REACT_ENGINE_CATALOG.cinema.label} />
      <InspectorKv label="Active Preset" value={composition?.metadata.name ?? 'None'} />
    </div>
  )

  if (!composition) {
    return (
      <>
        {engineSummary}
        <div className="rv-ctrl-group">
          <div className="rv-ctrl-info">Select a Cinema preset to inspect its layers.</div>
        </div>
      </>
    )
  }

  const selectedNodeId = getCinemaEditorSelection(state.editorMetadata, composition.id)
  const selectedNode = composition.nodes.find(node => node.id === selectedNodeId) ?? null
  const liveInstance = getCinemaLiveInstance(composition.id, state.instances)
  const persistedDefinition = selectedNode
    ? state.definitions.find(definition => definition.id === selectedNode.typeId) ?? null
    : null
  const selectedBinding = selectedNode?.assetBindingIds?.[0]
    ? composition.assetBindings.find(binding => binding.id === selectedNode.assetBindingIds?.[0]) ?? null
    : null
  const assetName = selectedBinding
    ? assetOptions.find(option => option.id === selectedBinding.assetId)?.label ?? 'Unknown asset'
    : 'No asset'

  const selectedNodeValues = selectedNode ? {
    ...selectedNode.parameterValues,
    ...(liveInstance?.nodeOverrides.find(override => override.nodeId === selectedNode.id)?.values ?? {}),
  } : {}
  const supportedNodeSchemas = !persistedDefinition || !selectedNode
    ? []
    : filterCinema3DObjectParameterSchemasForSource(
        (persistedDefinition.definition.metadata?.adapter === 'CinematicWorldNodeAdapter'
          ? getCinemaCinematicWorldSupportedParameterSchemasForNode(persistedDefinition.definition, selectedNode)
          : getCinemaSupportedParameterSchemas(persistedDefinition.definition))
          .filter(schema => schema.group !== 'React'),
        selectedNodeValues,
      )
  const nodeDescriptors = selectedNode && persistedDefinition
    ? createCinemaControlDescriptors({
        namespace: selectedNode.family === 'effect' ? 'effects' : 'nodes',
        ownerId: selectedNode.id,
        schemas: supportedNodeSchemas,
        values: selectedNodeValues,
      }).descriptors
    : []

  return (
    <>
      {engineSummary}
      <div className="rv-ctrl-group">
        <CtrlSection label={selectedNode?.family === 'effect' ? 'Cinema Effect' : 'Cinema Layer'} />
        {!selectedNode || !persistedDefinition ? (
          <div className="rv-ctrl-info">Select a layer or effect in Layers to inspect it.</div>
        ) : (
          <>
            <InspectorKv label="Stable ID" value={String(selectedNode.id)} />
            <InspectorKv label="Type" value={persistedDefinition.definition.label} />
            <InspectorKv label="Asset source" value={assetName} />
            {nodeDescriptors.map(descriptor => (
              <InspectorKv key={descriptor.path} label={descriptor.label} value={formatCinemaDescriptorValue(descriptor, assetOptions)} />
            ))}
            {nodeDescriptors.length === 0 && <div className="rv-ctrl-info">This layer has no additional appearance controls.</div>}
          </>
        )}
      </div>
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
  assetOptions: readonly CinemaInspectorAssetOption[]
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
    const eligibleAssets = getEligibleCinemaAssetOptions(descriptor, assetOptions)
    return <SelectRow label={descriptor.label} value={reference?.assetId ?? ''} disabled={descriptor.disabled} description={description} options={[{ value: '', label: 'No asset' }, ...eligibleAssets.map(option => ({ value: option.id, label: option.label }))]} onChange={assetId => onChange(assetId ? { assetId, role: descriptor.acceptedRoles?.[0] ?? 'image' } as CinemaParameterValue : null)} />
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
function numberValue(value: CinemaParameterValue): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0 }
function numberBound(value: number | readonly number[] | undefined, fallback?: number): number | undefined { return typeof value === 'number' ? value : fallback }
function vectorBound(value: number | readonly number[] | undefined, index: number, fallback?: number): number | undefined { return Array.isArray(value) ? Number(value[index] ?? fallback) : typeof value === 'number' ? value : fallback }
function isAssetReference(value: CinemaParameterValue): value is CinemaAssetReference { return value != null && typeof value === 'object' && !Array.isArray(value) && 'assetId' in value }
// Read-only counterpart to SchemaControl for CinemaSelectedLayerSummary — a
// display string per descriptor type instead of an editable input.
type CinemaInspectorAssetOption = { id: string; label: string; mediaKind: CinemaAssetMediaKind; mimeType: string | null }

const CINEMA_3D_OBJECT_PARAMETER_ID_SET = new Set<string>(Object.values(CINEMA_3D_OBJECT_PARAMETER_IDS))
function isCinema3DObjectDescriptor(descriptor: Pick<CinemaControlDescriptor, 'id'>): boolean { return CINEMA_3D_OBJECT_PARAMETER_ID_SET.has(descriptor.id) }

function getEligibleCinemaAssetOptions(
  descriptor: CinemaControlDescriptor,
  assetOptions: readonly CinemaInspectorAssetOption[],
): readonly CinemaInspectorAssetOption[] {
  if (descriptor.id === CINEMA_3D_OBJECT_PARAMETER_IDS.font) return assetOptions.filter(option => option.mediaKind === 'font')
  if (descriptor.id === CINEMA_3D_OBJECT_PARAMETER_IDS.svgAsset) return assetOptions.filter(option => option.mediaKind === 'svg')
  const acceptedRoles = descriptor.acceptedRoles ?? []
  if (acceptedRoles.length === 0) return assetOptions
  return assetOptions.filter(option => acceptedRoles.some(role => isCinemaAssetRoleCompatible(role, option.mediaKind, option.mimeType)))
}

function formatCinemaDescriptorValue(descriptor: CinemaControlDescriptor, assetOptions: readonly CinemaInspectorAssetOption[]): string {
  const value = descriptor.value
  if (descriptor.type === 'float') return numberValue(value).toFixed(2)
  if (descriptor.type === 'integer') return `${numberValue(value)}${descriptor.unit ? ` ${descriptor.unit}` : ''}`
  if (descriptor.type === 'boolean') return value ? 'Yes' : 'No'
  if (descriptor.type === 'enum') {
    const option = descriptor.options?.find(candidate => candidate.id === value)
    return option?.label ?? String(value ?? '—')
  }
  if (descriptor.type === 'string') return String(value ?? '') || '—'
  if (descriptor.type === 'color') return rgbaToHex(Array.isArray(value) ? value : [1, 1, 1, 1])
  if (descriptor.type === 'vector2' || descriptor.type === 'vector3') {
    const values = Array.isArray(value) ? value as number[] : descriptor.type === 'vector2' ? [0, 0] : [0, 0, 0]
    return values.map(component => Number(component).toFixed(2)).join(', ')
  }
  if (descriptor.type === 'asset' || descriptor.type === 'asset-reference' || descriptor.type === 'texture') {
    const reference = isAssetReference(value) ? value : null
    const asset = reference ? assetOptions.find(option => option.id === reference.assetId) : null
    return asset?.label ?? 'No asset'
  }
  return '—'
}
function rgbaToHex(value: readonly unknown[]): string { return `#${[0, 1, 2].map(index => Math.round(Math.max(0, Math.min(1, Number(value[index] ?? 1))) * 255).toString(16).padStart(2, '0')).join('')}` }
function hexToRgba(value: string, alpha: number): readonly [number, number, number, number] { const clean = value.replace('#', ''); return [parseInt(clean.slice(0, 2), 16) / 255, parseInt(clean.slice(2, 4), 16) / 255, parseInt(clean.slice(4, 6), 16) / 255, alpha] }
