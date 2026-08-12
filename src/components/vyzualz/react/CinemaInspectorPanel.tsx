import { useMemo, useState } from 'react'
import { IconChipButton } from './controls/IconChipButton'
import { useShallow } from 'zustand/react/shallow'
import { useMediaStore } from '../../../stores/mediaStore'
import { createCinemaMediaLibrarySnapshot } from './CinemaMediaLibraryBridge'
import {
  createCinemaCameraParameterSchemas,
  createCinemaControlDescriptors,
  buildCinemaComposerLibraryItems,
  CINEMA_PRODUCTION_RUNTIME_REGISTRY,
  getCinemaEditorSelection,
  useCinemaStore,
  type CinemaAssetReference,
  type CinemaControlDescriptor,
  type CinemaNodeId,
  type CinemaParameterId,
  type CinemaParameterValue,
} from '../cinema'
import { Collapsible, ColorRow, CtrlSection, NumberInputRow, PaletteColorRow, SelectRow, SliderRow, TextInputRow, ToggleRow } from './ReactControlRows'
import { DreamVizTextInput } from './controls/DreamVizTextInput'
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
  const selectedNodeId = composition ? getCinemaEditorSelection(state.editorMetadata, composition.id) : null
  const selectedNode = composition?.nodes.find(node => node.id === selectedNodeId) ?? null
  const liveInstance = composition ? getCinemaLiveInstance(composition.id, state.instances) : null
  const persistedDefinition = selectedNode ? state.definitions.find(definition => definition.id === selectedNode.typeId) ?? null : null

  const selectedBinding = selectedNode?.assetBindingIds?.[0]
    ? composition?.assetBindings.find(binding => binding.id === selectedNode.assetBindingIds?.[0]) ?? null
    : null

  const masterDescriptors = useMemo(() => composition
    ? createCinemaControlDescriptors({ namespace: 'master', schemas: composition.masterParameters, values: { ...composition.masterValues, ...(liveInstance?.masterOverrides ?? {}) } }).descriptors
    : [], [composition, liveInstance])
  const nodeDescriptors = useMemo(() => selectedNode && persistedDefinition
    ? createCinemaControlDescriptors({
        namespace: selectedNode.family === 'effect' ? 'effects' : 'nodes',
        ownerId: selectedNode.id,
        schemas: persistedDefinition.definition.parameters,
        values: { ...selectedNode.parameterValues, ...(liveInstance?.nodeOverrides.find(override => override.nodeId === selectedNode.id)?.values ?? {}) },
      }).descriptors
    : [], [liveInstance, persistedDefinition, selectedNode])
  const paletteOrder = ['background', 'primary', 'secondary', 'accent', 'foreground', 'highlight']
  const paletteDescriptors = nodeDescriptors.filter(descriptor => descriptor.type === 'color').sort((left, right) => {
    const roleFor = (id: typeof left.id) => {
      const schema = persistedDefinition?.definition.parameters.find(parameter => parameter.id === id)
      return schema?.type === 'color' ? schema.brandRole : undefined
    }
    const rank = (role: string | undefined) => role ? paletteOrder.indexOf(role) : paletteOrder.length
    return rank(roleFor(left.id)) - rank(roleFor(right.id))
  })
  const detailDescriptors = nodeDescriptors.filter(descriptor => !paletteDescriptors.includes(descriptor))

  if (!composition) {
    return <div className="rv-ctrl-group"><div className="rv-ctrl-info">Select a Cinema preset to edit its live appearance.</div></div>
  }

  const assetOptions = mediaAssets.filter(asset => !asset.deleted).map(asset => ({ id: String(asset.assetId), label: asset.name }))

  return (
    <>
      <div className="rv-ctrl-group">
        <CtrlSection label="Preset Look" />
        <InspectorKv label="Preset" value={composition.metadata.name} />
        <InspectorKv label="Selected layer" value={selectedNode?.label ?? selectedNode?.typeId ?? 'None'} />
        <div className="rv-ctrl-info">Changes here are live overrides. The original preset remains unchanged.</div>
        {liveInstance && <IconChipButton onClick={() => resetCinemaLiveOverrides(composition.id)}>Reset Live Changes</IconChipButton>}
      </div>

      <div className="rv-ctrl-group">
        <Collapsible label="Palette" bodyClassName={paletteDescriptors.length === 0 ? undefined : 'rv-cinema-palette-body'}>
          {paletteDescriptors.length === 0 ? <div className="rv-ctrl-info">This layer does not expose palette colors. Select another visual layer to change its background and brand colors.</div> : paletteDescriptors.map(descriptor => {
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
      </div>

      <div className="rv-ctrl-group">
        <Collapsible label="Master Appearance">
          {masterDescriptors.length === 0 ? <div className="rv-ctrl-info">This preset has no master appearance controls.</div> : masterDescriptors.map(descriptor => (
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
              {detailDescriptors.map(descriptor => (
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
              {detailDescriptors.length === 0 && <div className="rv-ctrl-info">This layer has no additional appearance controls.</div>}
            </>
          )}
        </Collapsible>
      </div>

      <CinemaEffectBrowser />

      <div className="rv-ctrl-group">
        <Collapsible label={`Camera resources (${composition.cameras.length})`} defaultOpen={false}>
          {composition.cameras.length === 0 ? <div className="rv-ctrl-info">No camera resources are referenced by this composition.</div> : composition.cameras.map(camera => {
            const descriptors = createCinemaControlDescriptors({
              namespace: 'cameras',
              ownerId: camera.id,
              schemas: createCinemaCameraParameterSchemas(camera),
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
                      const schema = createCinemaCameraParameterSchemas(camera).find(candidate => candidate.id === descriptor.id)
                      if (schema) setCinemaLiveCameraOverride(composition, camera.id, schema, value)
                    }}
                    onInteractionStart={() => {}}
                    onInteractionEnd={() => {}}
                  />
                ))}
              </Collapsible>
            )
          })}
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

function CinemaEffectBrowser() {
  const [query, setQuery] = useState('')
  const definitions = useCinemaStore(store => store.definitions)
  const effects = useMemo(() => buildCinemaComposerLibraryItems(definitions, CINEMA_PRODUCTION_RUNTIME_REGISTRY)
    .filter(item => item.category === 'Effects' && `${item.label} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase())), [definitions, query])
  return (
    <div className="rv-ctrl-group">
      <Collapsible label="Find Effects" defaultOpen={false}>
        <DreamVizTextInput value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by look or parameter…" aria-label="Search Cinema effects" />
        <div className="rv-cinema-effect-results">
          {effects.map(effect => <article key={effect.id}><strong>{effect.label}</strong><small>{effect.description}</small></article>)}
          {effects.length === 0 && <div className="rv-ctrl-info">No effects match this search.</div>}
        </div>
        <div className="rv-ctrl-info">Effect discovery lives here; attach or remove effects while authoring the preset in Show Manager.</div>
      </Collapsible>
    </div>
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
function numberValue(value: CinemaParameterValue): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0 }
function numberBound(value: number | readonly number[] | undefined, fallback?: number): number | undefined { return typeof value === 'number' ? value : fallback }
function vectorBound(value: number | readonly number[] | undefined, index: number, fallback?: number): number | undefined { return Array.isArray(value) ? Number(value[index] ?? fallback) : typeof value === 'number' ? value : fallback }
function isAssetReference(value: CinemaParameterValue): value is CinemaAssetReference { return value != null && typeof value === 'object' && !Array.isArray(value) && 'assetId' in value }
function rgbaToHex(value: readonly unknown[]): string { return `#${[0, 1, 2].map(index => Math.round(Math.max(0, Math.min(1, Number(value[index] ?? 1))) * 255).toString(16).padStart(2, '0')).join('')}` }
function hexToRgba(value: string, alpha: number): readonly [number, number, number, number] { const clean = value.replace('#', ''); return [parseInt(clean.slice(0, 2), 16) / 255, parseInt(clean.slice(2, 4), 16) / 255, parseInt(clean.slice(4, 6), 16) / 255, alpha] }
