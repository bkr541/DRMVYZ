import {
  cinemaStableId,
  normalizeCinemaParameterValue,
  useCinemaStore,
  type CinemaCameraId,
  type CinemaCompositionDefinition,
  type CinemaCompositionInstance,
  type CinemaCompositionInstanceId,
  type CinemaNodeId,
  type CinemaParameterDefinition,
  type CinemaParameterId,
  type CinemaParameterValue,
} from '../cinema'

const LIVE_INSTANCE_FLAG = 'reactLiveOverride'

export function isCinemaLiveInstance(
  instance: Readonly<CinemaCompositionInstance> | null | undefined,
): boolean {
  return instance?.metadata?.[LIVE_INSTANCE_FLAG] === true
}

export function getCinemaLiveInstance(
  compositionId: CinemaCompositionDefinition['id'],
  instances: readonly Readonly<CinemaCompositionInstance>[],
): Readonly<CinemaCompositionInstance> | null {
  return instances.find(instance => (
    instance.compositionId === compositionId && isCinemaLiveInstance(instance)
  )) ?? null
}

export function resolveCinemaLiveMasterValue(
  instance: Readonly<CinemaCompositionInstance> | null,
  parameterId: CinemaParameterId,
  fallback: CinemaParameterValue,
): CinemaParameterValue {
  return instance?.masterOverrides[parameterId] ?? fallback
}

export function resolveCinemaLiveNodeValue(
  instance: Readonly<CinemaCompositionInstance> | null,
  nodeId: CinemaNodeId,
  parameterId: CinemaParameterId,
  fallback: CinemaParameterValue,
): CinemaParameterValue {
  return instance?.nodeOverrides.find(override => override.nodeId === nodeId)?.values[parameterId] ?? fallback
}

export function resolveCinemaLiveCameraValue(
  instance: Readonly<CinemaCompositionInstance> | null,
  cameraId: CinemaCameraId,
  parameterId: CinemaParameterId,
  fallback: CinemaParameterValue,
): CinemaParameterValue {
  return instance?.cameraOverrides.find(override => override.cameraId === cameraId)?.values[parameterId] ?? fallback
}

export function setCinemaLiveMasterOverride(
  composition: Readonly<CinemaCompositionDefinition>,
  schema: Readonly<CinemaParameterDefinition>,
  value: CinemaParameterValue,
): void {
  const normalized = normalizeCinemaParameterValue(schema, value)
  if (!normalized.valid) return
  updateLiveInstance(composition, instance => ({
    ...instance,
    masterOverrides: { ...instance.masterOverrides, [schema.id]: normalized.value },
  }))
}

export function setCinemaLiveNodeOverride(
  composition: Readonly<CinemaCompositionDefinition>,
  nodeId: CinemaNodeId,
  schema: Readonly<CinemaParameterDefinition>,
  value: CinemaParameterValue,
): void {
  const normalized = normalizeCinemaParameterValue(schema, value)
  if (!normalized.valid) return
  updateLiveInstance(composition, instance => {
    const existing = instance.nodeOverrides.find(override => override.nodeId === nodeId)
    const next = {
      nodeId,
      values: { ...(existing?.values ?? {}), [schema.id]: normalized.value },
    }
    return {
      ...instance,
      nodeOverrides: [
        ...instance.nodeOverrides.filter(override => override.nodeId !== nodeId),
        next,
      ],
    }
  })
}

export function setCinemaLiveCameraOverride(
  composition: Readonly<CinemaCompositionDefinition>,
  cameraId: CinemaCameraId,
  schema: Readonly<CinemaParameterDefinition>,
  value: CinemaParameterValue,
): void {
  const normalized = normalizeCinemaParameterValue(schema, value)
  if (!normalized.valid) return
  updateLiveInstance(composition, instance => {
    const existing = instance.cameraOverrides.find(override => override.cameraId === cameraId)
    const next = {
      cameraId,
      values: { ...(existing?.values ?? {}), [schema.id]: normalized.value },
    }
    return {
      ...instance,
      cameraOverrides: [
        ...instance.cameraOverrides.filter(override => override.cameraId !== cameraId),
        next,
      ],
    }
  })
}

export function resetCinemaLiveOverrides(compositionId: CinemaCompositionDefinition['id']): void {
  const state = useCinemaStore.getState()
  const live = getCinemaLiveInstance(compositionId, state.instances)
  if (!live) return
  state.deleteCinemaInstance(live.id)
  useCinemaStore.getState().setActiveCinemaComposition(compositionId)
}

function updateLiveInstance(
  composition: Readonly<CinemaCompositionDefinition>,
  update: (instance: CinemaCompositionInstance) => CinemaCompositionInstance,
): void {
  const state = useCinemaStore.getState()
  const active = state.activeInstanceId == null
    ? null
    : state.instances.find(instance => instance.id === state.activeInstanceId) ?? null
  const live = getCinemaLiveInstance(composition.id, state.instances)
  const source = live ?? (active?.compositionId === composition.id ? active : null)
  const id = live?.id ?? cinemaStableId<CinemaCompositionInstanceId>(
    `${composition.id}-react-live`,
    'composition instance',
  )
  const baseline: CinemaCompositionInstance = {
    id,
    compositionId: composition.id,
    label: `${composition.metadata.name} · Live`,
    revision: (live?.revision ?? 0) + 1,
    masterOverrides: { ...(source?.masterOverrides ?? {}) },
    nodeOverrides: (source?.nodeOverrides ?? []).map(override => ({
      nodeId: override.nodeId,
      values: { ...override.values },
    })),
    cameraOverrides: (source?.cameraOverrides ?? []).map(override => ({
      cameraId: override.cameraId,
      values: { ...override.values },
    })),
    assetBindingOverrides: (source?.assetBindingOverrides ?? []).map(override => ({
      bindingId: override.bindingId,
      values: { ...override.values },
    })),
    metadata: {
      ...(source?.metadata ?? {}),
      [LIVE_INSTANCE_FLAG]: true,
      sourcePresetId: String(composition.id),
    },
  }
  const next = update(baseline)
  const result = state.upsertCinemaInstance(next)
  // Activating the just-written live instance is a side effect of this
  // edit, not a separate user action — it must not cost its own undo step
  // (which would otherwise happen only on the first live edit, since later
  // edits find activation already a no-op and skip recording entirely).
  if (result.ok) useCinemaStore.getState().setActiveCinemaComposition(composition.id, id, { recordHistory: false })
}
