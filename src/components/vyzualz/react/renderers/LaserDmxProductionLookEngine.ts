import type { LaserDmxFixture, LaserDmxSettings } from '../ReactTypes'
import {
  ALL_PRODUCTION_FIXTURE_KINDS,
  DEFAULT_PRODUCTION_LOOK_SCOPE,
  DEFAULT_PRODUCTION_LOOK_TRANSITION,
  buildProductionRig,
  normalizeLaserDmxSettings,
  normalizeProductionAtmosphericFixtureSettings,
  normalizeProductionFlashPattern,
  normalizeProductionLedBarSettings,
  normalizeProductionLook,
  normalizeProductionLookTransition,
  normalizeProductionMovingHeadSettings,
  normalizeProductionWashSettings,
  resolveLaserDmxFixtureCapabilities,
  type ProductionAtmosphereSettings,
  type ProductionCameraView,
  type ProductionFixtureKind,
  type ProductionFixturePropertyState,
  type ProductionLook,
  type ProductionLookFixtureState,
  type ProductionLookScope,
  type ProductionLookTransitionSettings,
  type ProductionStageModel,
} from '../LaserDmxProductionRig'

export interface ProductionLookApplyDiagnostic {
  fixtureId?: string
  groupId?: string
  property?: keyof ProductionFixturePropertyState | 'stage' | 'atmosphere' | 'fixtureState'
  message: string
}

export interface ApplyProductionLookResult {
  settings: LaserDmxSettings
  diagnostics: ProductionLookApplyDiagnostic[]
}

export interface CaptureProductionLookOptions {
  id?: string
  name?: string
  description?: string
  scope?: Partial<ProductionLookScope>
  transition?: Partial<ProductionLookTransitionSettings>
  omissionMode?: ProductionLook['omissionMode']
  source?: ProductionLook['source']
  createdAt?: string
}

export interface ProductionLookTransitionRuntime {
  requestId: number
  startedAtMs: number
  lookId: string
  from: LaserDmxSettings
  target: LaserDmxSettings
  transition: ProductionLookTransitionSettings
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

function makeId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `look-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function withoutRuntime(settings: LaserDmxSettings): LaserDmxSettings {
  const copy = clone(settings)
  delete copy.runtime
  return copy
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

function normalizeCaptureScope(settings: LaserDmxSettings, input?: Partial<ProductionLookScope>): ProductionLookScope {
  const fixtureKinds = unique(
    settings.fixtures
      .map(fixture => fixture.fixtureKind)
      .filter((kind): kind is ProductionFixtureKind => Boolean(kind)),
  )
  const defaults: ProductionLookScope = {
    ...DEFAULT_PRODUCTION_LOOK_SCOPE,
    fixtureIds: [],
    fixtureKinds,
    groupIds: (settings.productionGroups ?? []).map(group => group.id),
  }
  return {
    fixtureIds: unique(input?.fixtureIds ?? defaults.fixtureIds),
    fixtureKinds: unique(input?.fixtureKinds ?? defaults.fixtureKinds),
    groupIds: unique(input?.groupIds ?? defaults.groupIds),
    includeGlobal: input?.includeGlobal ?? defaults.includeGlobal,
    includeAtmosphere: input?.includeAtmosphere ?? defaults.includeAtmosphere,
    includeStage: input?.includeStage ?? defaults.includeStage,
  }
}

function fixtureIsInScope(
  fixture: LaserDmxFixture,
  scope: ProductionLookScope,
  groupIdsByFixture: Map<string, string[]>,
): boolean {
  const hasSelectors = scope.fixtureIds.length > 0 || scope.fixtureKinds.length > 0 || scope.groupIds.length > 0
  if (!hasSelectors) return false
  if (scope.fixtureIds.includes(fixture.id)) return true
  if (fixture.fixtureKind && scope.fixtureKinds.includes(fixture.fixtureKind)) return true
  return (groupIdsByFixture.get(fixture.id) ?? []).some(groupId => scope.groupIds.includes(groupId))
}

function captureFixtureState(
  fixture: LaserDmxFixture,
  properties: ProductionFixturePropertyState,
): ProductionLookFixtureState {
  const capabilities = resolveLaserDmxFixtureCapabilities(fixture)
  const cleanProperties = clone(properties)
  delete cleanProperties.triggered
  const atmosphericMedium = capabilities?.atmosphericOutput?.medium
  return {
    fixtureId: fixture.id,
    properties: cleanProperties,
    enabled: fixture.enabled,
    colorAssignment: {
      mode: fixture.color.mode,
      paletteId: fixture.color.paletteId,
      colorCycleSpeed: fixture.color.colorCycleSpeed,
    },
    ...(fixture.movingHead ? { movingHead: clone(fixture.movingHead) } : {}),
    ...(fixture.flashPattern ? { flashPattern: clone(fixture.flashPattern) } : {}),
    ...(fixture.wash ? { wash: clone(fixture.wash) } : {}),
    ...(fixture.ledBar ? { ledBar: clone(fixture.ledBar) } : {}),
    ...(fixture.atmospheric && atmosphericMedium ? {
      armed: fixture.atmospheric.armed,
      atmosphericMedium,
      atmospheric: {
        ...clone(fixture.atmospheric),
        // Trigger counters are commands, not authored Look state.
        triggerRequestId: 0,
      },
    } : {}),
  }
}

export function captureProductionLook(
  settingsInput: LaserDmxSettings,
  options: CaptureProductionLookOptions = {},
): ProductionLook {
  const settings = normalizeLaserDmxSettings(settingsInput)
  const rig = buildProductionRig(settings)
  const scope = normalizeCaptureScope(settings, options.scope)
  const groupIdsByFixture = new Map<string, string[]>()
  for (const group of settings.productionGroups ?? []) {
    for (const fixtureId of group.fixtureIds) {
      groupIdsByFixture.set(fixtureId, [...(groupIdsByFixture.get(fixtureId) ?? []), group.id])
    }
  }
  const sourceFixtures = new Map(settings.fixtures.map(fixture => [fixture.id, fixture]))
  const fixtureStates = rig.fixtures.flatMap(rigFixture => {
    const fixture = sourceFixtures.get(rigFixture.id)
    if (!fixture || !fixtureIsInScope(fixture, scope, groupIdsByFixture)) return []
    return [captureFixtureState(fixture, rigFixture.properties)]
  })
  const groupStates = (settings.productionGroups ?? [])
    .filter(group => scope.groupIds.includes(group.id))
    .map(group => ({
      groupId: group.id,
      properties: {},
      ...(group.movement ? { movement: clone(group.movement) } : {}),
      ...(group.chase ? { chase: clone(group.chase) } : {}),
    }))
  const now = options.createdAt ?? new Date().toISOString()
  return normalizeProductionLook({
    schemaVersion: 1,
    id: options.id ?? makeId(),
    name: options.name ?? `Look ${(settings.productionLooks?.length ?? 0) + 1}`,
    ...(options.description ? { description: options.description } : {}),
    omissionMode: options.omissionMode ?? 'preserve',
    scope,
    fixtureStates,
    groupStates,
    ...(scope.includeGlobal ? {
      global: {
        masterDimmer: settings.masterDimmer,
        blackout: settings.blackout,
        hazeAmount: settings.hazeAmount,
        beamPersistence: settings.beamPersistence,
        glowAmount: settings.glowAmount,
        globalBeamWidth: settings.globalBeamWidth,
        globalStrobeRate: settings.globalStrobeRate,
        safetyClamp: settings.safetyClamp,
        backgroundFade: settings.backgroundFade,
      },
    } : {}),
    ...(scope.includeAtmosphere ? {
      atmosphere: {
        ...(settings.atmosphere ? { settings: clone(settings.atmosphere) } : {}),
        armedFixtureIds: settings.fixtures
          .filter(fixture => fixture.atmospheric?.armed)
          .map(fixture => fixture.id),
      },
    } : {}),
    ...(scope.includeStage && settings.productionStage ? {
      stage: {
        camera: clone(settings.productionStage.camera),
        activeCameraViewId: settings.productionStage.activeCameraViewId,
      },
    } : {}),
    transition: normalizeProductionLookTransition({
      ...(settings.productionLookTransitionDefaults ?? DEFAULT_PRODUCTION_LOOK_TRANSITION),
      ...(options.transition ?? {}),
    }),
    source: options.source ?? 'authored',
    createdAt: now,
    updatedAt: now,
  })
}

export function ensureProductionLookCompatibility(
  settingsInput: LaserDmxSettings,
  name = 'Default Look',
  source: ProductionLook['source'] = 'migration',
): LaserDmxSettings {
  const settings = normalizeLaserDmxSettings(settingsInput)
  if ((settings.productionLooks?.length ?? 0) > 0) return settings
  const look = captureProductionLook(settings, {
    id: 'production-look:default',
    name,
    source,
    scope: { includeStage: true },
    // Epoch timestamp makes compatibility/migration looks deterministic across repeated calls.
    createdAt: '1970-01-01T00:00:00.000Z',
  })
  return normalizeLaserDmxSettings({
    ...settings,
    productionLooks: [look],
    activeProductionLookId: look.id,
  })
}

function neutralProperties(
  capabilities: ReturnType<typeof resolveLaserDmxFixtureCapabilities>,
): ProductionFixturePropertyState {
  if (!capabilities) return {}
  return {
    ...(capabilities.dimmer ? { dimmer: 1 } : {}),
    ...(capabilities.shutter ? { shutterOpen: true } : {}),
    ...(capabilities.strobe ? { strobeRate: 0 } : {}),
    ...(capabilities.color?.mode === 'rgb' || capabilities.color?.mode === 'rgbw'
      ? {
          color: {
            red: 255,
            green: 255,
            blue: 255,
            ...(capabilities.color.mode === 'rgbw' ? { white: 0 } : {}),
          },
        }
      : {}),
    ...(capabilities.panTilt ? { panDeg: 0, tiltDeg: -35 } : {}),
    ...(capabilities.zoom ? { zoom: 1 } : {}),
    ...(capabilities.focus ? { focus: 1 } : {}),
    ...(capabilities.iris ? { iris: 1 } : {}),
    ...(capabilities.frost ? { frost: 0 } : {}),
    ...(capabilities.gobo ? {
      goboIndex: 0,
      ...(capabilities.gobo.rotation ? { goboRotation: 0 } : {}),
    } : {}),
    ...(capabilities.prism ? {
      prismFacets: 0,
      ...(capabilities.prism.rotation ? { prismRotation: 0 } : {}),
    } : {}),
    ...(capabilities.atmosphericOutput ? { atmosphericOutput: 0 } : {}),
    ...(capabilities.wash ? { washSpread: 0.72, washSoftness: 0.72 } : {}),
    ...(capabilities.pixels ? { pixelSegmentCount: Math.min(8, capabilities.pixels.maxSegments) } : {}),
  }
}

function resetFixtureForLook(
  fixtureInput: LaserDmxFixture,
  diagnostics: ProductionLookApplyDiagnostic[],
): LaserDmxFixture {
  const capabilities = resolveLaserDmxFixtureCapabilities(fixtureInput)
  if (!capabilities) return clone(fixtureInput)
  const priorTriggerRequestId = fixtureInput.atmospheric?.triggerRequestId ?? 0
  let fixture = applyFixtureProperties(fixtureInput, neutralProperties(capabilities), diagnostics)

  fixture.enabled = true
  fixture.color = {
    ...fixture.color,
    mode: 'fixed',
    paletteId: '',
    colorCycleSpeed: 0,
    red: 255,
    green: 255,
    blue: 255,
    white: capabilities.color?.mode === 'fixedWhite' ? 255 : 0,
    alpha: 1,
  }
  if (capabilities.panTilt) {
    fixture.movingHead = normalizeProductionMovingHeadSettings(undefined)
    fixture.position = {
      ...fixture.position,
      pan: fixture.movingHead.panDeg,
      tilt: fixture.movingHead.tiltDeg,
    }
  }
  if (capabilities.strobe) fixture.flashPattern = normalizeProductionFlashPattern(undefined)
  if (capabilities.wash) fixture.wash = normalizeProductionWashSettings(undefined)
  if (capabilities.pixels) {
    fixture.ledBar = normalizeProductionLedBarSettings(undefined, capabilities.pixels.maxSegments)
  }
  if (capabilities.atmosphericOutput) {
    fixture.atmospheric = {
      ...normalizeProductionAtmosphericFixtureSettings(undefined, capabilities.atmosphericOutput.medium),
      armed: false,
      outputLevel: 0,
      // Resetting authored state must never replay an effect command.
      triggerRequestId: priorTriggerRequestId,
    }
  }
  return fixture
}

function applyFixtureProperties(
  fixtureInput: LaserDmxFixture,
  properties: ProductionFixturePropertyState,
  diagnostics: ProductionLookApplyDiagnostic[],
): LaserDmxFixture {
  const fixture = clone(fixtureInput)
  const capabilities = resolveLaserDmxFixtureCapabilities(fixture)
  if (!capabilities) return fixture
  const unsupported = (property: keyof ProductionFixturePropertyState) => diagnostics.push({
    fixtureId: fixture.id,
    property,
    message: `${fixture.name} does not support ${property}; the Look value was ignored.`,
  })
  if (properties.dimmer != null) capabilities.dimmer ? fixture.beam.dimmer = properties.dimmer : unsupported('dimmer')
  if (properties.shutterOpen != null) capabilities.shutter ? fixture.beam.shutterOpen = properties.shutterOpen : unsupported('shutterOpen')
  if (properties.strobeRate != null) capabilities.strobe ? fixture.beam.strobeRate = properties.strobeRate : unsupported('strobeRate')
  if (properties.color) {
    if (capabilities.color?.mode === 'rgb' || capabilities.color?.mode === 'rgbw') {
      fixture.color = {
        ...fixture.color,
        ...(properties.color.red != null ? { red: properties.color.red } : {}),
        ...(properties.color.green != null ? { green: properties.color.green } : {}),
        ...(properties.color.blue != null ? { blue: properties.color.blue } : {}),
        ...(properties.color.white != null && capabilities.color.mode === 'rgbw'
          ? { white: properties.color.white }
          : {}),
      }
    } else unsupported('color')
  }
  if (properties.panDeg != null || properties.tiltDeg != null) {
    if (capabilities.panTilt) {
      const movingHead = normalizeProductionMovingHeadSettings(fixture.movingHead)
      fixture.movingHead = {
        ...movingHead,
        ...(properties.panDeg != null ? { panDeg: properties.panDeg } : {}),
        ...(properties.tiltDeg != null ? { tiltDeg: properties.tiltDeg } : {}),
      }
      fixture.position = {
        ...fixture.position,
        ...(properties.panDeg != null ? { pan: properties.panDeg } : {}),
        ...(properties.tiltDeg != null ? { tilt: properties.tiltDeg } : {}),
      }
    } else {
      if (properties.panDeg != null) unsupported('panDeg')
      if (properties.tiltDeg != null) unsupported('tiltDeg')
    }
  }
  if (properties.zoom != null) capabilities.zoom ? fixture.beam.zoom = properties.zoom : unsupported('zoom')
  if (properties.focus != null) capabilities.focus ? fixture.beam.focus = properties.focus : unsupported('focus')
  if (properties.colorWheelSlot != null) {
    if (capabilities.color?.mode === 'colorWheel') {
      fixture.movingHead = {
        ...normalizeProductionMovingHeadSettings(fixture.movingHead),
        colorWheelSlot: properties.colorWheelSlot,
      }
    } else unsupported('colorWheelSlot')
  }
  const movingHeadUpdates: Record<string, number> = {}
  const movingFields: Array<[keyof ProductionFixturePropertyState, string, boolean]> = [
    ['iris', 'iris', Boolean(capabilities.iris)],
    ['frost', 'frost', Boolean(capabilities.frost)],
    ['goboIndex', 'goboIndex', Boolean(capabilities.gobo)],
    ['goboRotation', 'goboRotation', Boolean(capabilities.gobo?.rotation)],
    ['prismFacets', 'prismFacets', Boolean(capabilities.prism)],
    ['prismRotation', 'prismRotation', Boolean(capabilities.prism?.rotation)],
  ]
  for (const [property, target, supported] of movingFields) {
    const value = properties[property]
    if (typeof value !== 'number') continue
    if (supported) movingHeadUpdates[target] = value
    else unsupported(property)
  }
  if (Object.keys(movingHeadUpdates).length > 0) {
    fixture.movingHead = {
      ...normalizeProductionMovingHeadSettings(fixture.movingHead),
      ...movingHeadUpdates,
    }
  }
  if (properties.beamPatternId != null) {
    if (capabilities.beamPattern) fixture.path.kind = properties.beamPatternId as LaserDmxFixture['path']['kind']
    else unsupported('beamPatternId')
  }
  if (properties.flashPatternId != null) {
    if (capabilities.strobe) {
      fixture.flashPattern = {
        ...normalizeProductionFlashPattern(fixture.flashPattern),
        pattern: properties.flashPatternId,
      }
    } else unsupported('flashPatternId')
  }
  if (properties.washSpread != null || properties.washSoftness != null) {
    if (capabilities.wash) {
      fixture.wash = {
        ...normalizeProductionWashSettings(fixture.wash),
        ...(properties.washSpread != null ? { spread: properties.washSpread } : {}),
        ...(properties.washSoftness != null ? { softness: properties.washSoftness } : {}),
      }
    } else {
      if (properties.washSpread != null) unsupported('washSpread')
      if (properties.washSoftness != null) unsupported('washSoftness')
    }
  }
  if (properties.pixelSegmentCount != null) {
    if (capabilities.pixels) {
      fixture.ledBar = {
        ...normalizeProductionLedBarSettings(fixture.ledBar, capabilities.pixels.maxSegments),
        segmentCount: Math.round(properties.pixelSegmentCount),
      }
    } else unsupported('pixelSegmentCount')
  }
  if (properties.atmosphericOutput != null) {
    if (capabilities.atmosphericOutput) {
      fixture.atmospheric = {
        ...normalizeProductionAtmosphericFixtureSettings(
          fixture.atmospheric,
          capabilities.atmosphericOutput.medium,
        ),
        outputLevel: properties.atmosphericOutput,
      }
    } else unsupported('atmosphericOutput')
  }
  return fixture
}

function applyFixtureState(
  fixtureInput: LaserDmxFixture,
  state: ProductionLookFixtureState,
  diagnostics: ProductionLookApplyDiagnostic[],
): LaserDmxFixture {
  let fixture = applyFixtureProperties(fixtureInput, state.properties, diagnostics)
  const capabilities = resolveLaserDmxFixtureCapabilities(fixture)
  if (!capabilities) return fixture
  if (state.enabled != null) fixture.enabled = state.enabled
  if (state.colorAssignment) {
    fixture.color = {
      ...fixture.color,
      ...(state.colorAssignment.mode ? { mode: state.colorAssignment.mode } : {}),
      ...(state.colorAssignment.paletteId != null ? { paletteId: state.colorAssignment.paletteId } : {}),
      ...(state.colorAssignment.colorCycleSpeed != null
        ? { colorCycleSpeed: state.colorAssignment.colorCycleSpeed }
        : {}),
    }
  }
  if (state.movingHead) {
    if (capabilities.panTilt) fixture.movingHead = clone(state.movingHead)
    else diagnostics.push({ fixtureId: fixture.id, property: 'fixtureState', message: `${fixture.name} cannot accept moving-head state.` })
  }
  if (state.flashPattern) {
    if (capabilities.strobe) fixture.flashPattern = clone(state.flashPattern)
    else diagnostics.push({ fixtureId: fixture.id, property: 'fixtureState', message: `${fixture.name} cannot accept a flash pattern.` })
  }
  if (state.wash) {
    if (capabilities.wash) fixture.wash = clone(state.wash)
    else diagnostics.push({ fixtureId: fixture.id, property: 'fixtureState', message: `${fixture.name} cannot accept wash state.` })
  }
  if (state.ledBar) {
    if (capabilities.pixels) fixture.ledBar = clone(state.ledBar)
    else diagnostics.push({ fixtureId: fixture.id, property: 'fixtureState', message: `${fixture.name} cannot accept LED-bar state.` })
  }
  if (state.atmospheric) {
    if (capabilities.atmosphericOutput) {
      const priorTriggerRequestId = fixture.atmospheric?.triggerRequestId ?? 0
      fixture.atmospheric = {
        ...clone(state.atmospheric),
        armed: state.armed ?? state.atmospheric.armed,
        // Activating a Look must not fire fog or cryo by replaying a stored counter.
        triggerRequestId: priorTriggerRequestId,
      }
    } else diagnostics.push({ fixtureId: fixture.id, property: 'fixtureState', message: `${fixture.name} cannot accept atmospheric state.` })
  } else if (state.armed != null && fixture.atmospheric) {
    fixture.atmospheric = { ...fixture.atmospheric, armed: state.armed }
  }
  return fixture
}

function selectedFixtureIds(settings: LaserDmxSettings, look: ProductionLook): Set<string> {
  const ids = new Set<string>()
  const hasSelectors = look.scope.fixtureIds.length > 0
    || look.scope.fixtureKinds.length > 0
    || look.scope.groupIds.length > 0
  if (!hasSelectors) for (const state of look.fixtureStates) ids.add(state.fixtureId)
  for (const fixture of settings.fixtures) {
    if (look.scope.fixtureIds.includes(fixture.id)) ids.add(fixture.id)
    if (fixture.fixtureKind && look.scope.fixtureKinds.includes(fixture.fixtureKind)) ids.add(fixture.id)
  }
  for (const group of settings.productionGroups ?? []) {
    if (look.scope.groupIds.includes(group.id)) {
      for (const fixtureId of group.fixtureIds) ids.add(fixtureId)
    }
  }
  return ids
}

export function applyProductionLook(
  settingsInput: LaserDmxSettings,
  lookInput: ProductionLook,
): ApplyProductionLookResult {
  const settings = normalizeLaserDmxSettings(settingsInput)
  const look = normalizeProductionLook(lookInput)
  const diagnostics: ProductionLookApplyDiagnostic[] = []
  const selectedIds = selectedFixtureIds(settings, look)
  let fixtures = settings.fixtures.map(fixture => {
    if (!selectedIds.has(fixture.id)) return fixture
    return look.omissionMode === 'resetIncluded'
      ? resetFixtureForLook(fixture, diagnostics)
      : clone(fixture)
  })
  const fixtureStateById = new Map(look.fixtureStates.map(state => [state.fixtureId, state]))
  fixtures = fixtures.map(fixture => {
    const state = fixtureStateById.get(fixture.id)
    if (!state || !selectedIds.has(fixture.id)) return fixture
    return applyFixtureState(fixture, state, diagnostics)
  })
  let groups = clone(settings.productionGroups ?? [])
  for (const groupState of look.groupStates.filter(state => look.scope.groupIds.includes(state.groupId))) {
    const group = groups.find(candidate => candidate.id === groupState.groupId)
    if (!group) {
      diagnostics.push({
        groupId: groupState.groupId,
        message: `Look references missing fixture group ${groupState.groupId}.`,
      })
      continue
    }
    const ids = new Set(group.fixtureIds)
    fixtures = fixtures.map(fixture => ids.has(fixture.id)
      ? applyFixtureProperties(fixture, groupState.properties, diagnostics)
      : fixture)
    groups = groups.map(candidate => candidate.id === group.id ? {
      ...candidate,
      ...(groupState.movement ? { movement: clone(groupState.movement) } : {}),
      ...(groupState.chase ? { chase: clone(groupState.chase) } : {}),
    } : candidate)
  }
  if (look.atmosphere?.armedFixtureIds) {
    const armed = new Set(look.atmosphere.armedFixtureIds)
    const explicitlyAuthoredArming = new Set(
      look.fixtureStates
        .filter(state => state.armed != null || state.atmospheric?.armed != null)
        .map(state => state.fixtureId),
    )
    fixtures = fixtures.map(fixture => fixture.atmospheric
      && selectedIds.has(fixture.id)
      && !explicitlyAuthoredArming.has(fixture.id)
      ? { ...fixture, atmospheric: { ...fixture.atmospheric, armed: armed.has(fixture.id) } }
      : fixture)
  }
  const next: LaserDmxSettings = {
    ...settings,
    fixtures,
    productionGroups: groups,
    activeProductionLookId: look.id,
    ...(look.scope.includeGlobal && look.global ? look.global : {}),
    ...(look.scope.includeAtmosphere && look.atmosphere?.settings
      ? { atmosphere: clone(look.atmosphere.settings) }
      : {}),
  }
  if (look.scope.includeStage && look.stage) {
    if (!next.productionStage) {
      diagnostics.push({ property: 'stage', message: 'The Look includes camera state but the rig has no production stage.' })
    } else {
      next.productionStage = {
        ...next.productionStage,
        ...(look.stage.camera ? { camera: clone(look.stage.camera) } : {}),
        ...(look.stage.activeCameraViewId ? { activeCameraViewId: look.stage.activeCameraViewId } : {}),
      }
    }
  }
  return { settings: normalizeLaserDmxSettings(next), diagnostics }
}

function interpolateNumber(a: number, b: number, progress: number): number {
  return a + (b - a) * progress
}

function ease(progress: number, easing: ProductionLookTransitionSettings['easing']): number {
  const t = Math.max(0, Math.min(1, progress))
  if (easing === 'easeIn') return t * t
  if (easing === 'easeOut') return 1 - (1 - t) * (1 - t)
  if (easing === 'easeInOut') return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  return t
}

function choose<T>(from: T, to: T, progress: number, switchPoint: number): T {
  return progress >= switchPoint ? to : from
}

function interpolateCamera(
  from: ProductionCameraView,
  to: ProductionCameraView,
  progress: number,
  switchPoint: number,
): ProductionCameraView {
  return {
    ...to,
    id: choose(from.id, to.id, progress, switchPoint),
    name: choose(from.name, to.name, progress, switchPoint),
    position: {
      x: interpolateNumber(from.position.x, to.position.x, progress),
      y: interpolateNumber(from.position.y, to.position.y, progress),
      z: interpolateNumber(from.position.z, to.position.z, progress),
    },
    target: {
      x: interpolateNumber(from.target.x, to.target.x, progress),
      y: interpolateNumber(from.target.y, to.target.y, progress),
      z: interpolateNumber(from.target.z, to.target.z, progress),
    },
    fieldOfViewDeg: interpolateNumber(from.fieldOfViewDeg, to.fieldOfViewDeg, progress),
    near: interpolateNumber(from.near, to.near, progress),
    far: interpolateNumber(from.far, to.far, progress),
  }
}

function interpolateStage(
  from: ProductionStageModel | undefined,
  to: ProductionStageModel | undefined,
  progress: number,
  switchPoint: number,
): ProductionStageModel | undefined {
  if (!from || !to) return choose(from, to, progress, switchPoint)
  return {
    ...to,
    camera: interpolateCamera(from.camera, to.camera, progress, switchPoint),
    activeCameraViewId: choose(from.activeCameraViewId, to.activeCameraViewId, progress, switchPoint),
  }
}

function interpolateAtmosphere(
  from: ProductionAtmosphereSettings | undefined,
  to: ProductionAtmosphereSettings | undefined,
  progress: number,
  switchPoint: number,
): ProductionAtmosphereSettings | undefined {
  if (!from || !to) return choose(from, to, progress, switchPoint)
  return {
    ...to,
    persistentHaze: {
      ...to.persistentHaze,
      enabled: choose(from.persistentHaze.enabled, to.persistentHaze.enabled, progress, switchPoint),
      baseDensity: interpolateNumber(from.persistentHaze.baseDensity, to.persistentHaze.baseDensity, progress),
      heightDistribution: interpolateNumber(from.persistentHaze.heightDistribution, to.persistentHaze.heightDistribution, progress),
      turbulence: interpolateNumber(from.persistentHaze.turbulence, to.persistentHaze.turbulence, progress),
      diffusion: interpolateNumber(from.persistentHaze.diffusion, to.persistentHaze.diffusion, progress),
      driftSpeed: interpolateNumber(from.persistentHaze.driftSpeed, to.persistentHaze.driftSpeed, progress),
      driftDirectionDeg: interpolateNumber(from.persistentHaze.driftDirectionDeg, to.persistentHaze.driftDirectionDeg, progress),
      ventilation: interpolateNumber(from.persistentHaze.ventilation, to.persistentHaze.ventilation, progress),
      beamScatter: interpolateNumber(from.persistentHaze.beamScatter, to.persistentHaze.beamScatter, progress),
    },
    maxParticleBudget: Math.round(interpolateNumber(from.maxParticleBudget, to.maxParticleBudget, progress)),
    qualityTier: choose(from.qualityTier, to.qualityTier, progress, switchPoint),
    retainBaseHazeOnClear: choose(from.retainBaseHazeOnClear, to.retainBaseHazeOnClear, progress, switchPoint),
  }
}

function interpolateFixture(
  from: LaserDmxFixture,
  to: LaserDmxFixture,
  progress: number,
  transition: ProductionLookTransitionSettings,
): LaserDmxFixture {
  const p = transition.mode === 'linearFade' ? progress : ease(progress, transition.easing)
  const discrete = <T>(a: T, b: T) => choose(a, b, progress, transition.switchPoint)
  const colorOnly = transition.mode === 'colorOnly'
  const movementOnly = transition.mode === 'movementOnly'
  const result = clone(colorOnly || movementOnly ? from : to)

  if (!movementOnly) {
    result.color = {
      ...to.color,
      red: interpolateNumber(from.color.red, to.color.red, p),
      green: interpolateNumber(from.color.green, to.color.green, p),
      blue: interpolateNumber(from.color.blue, to.color.blue, p),
      white: interpolateNumber(from.color.white, to.color.white, p),
      alpha: interpolateNumber(from.color.alpha, to.color.alpha, p),
      mode: discrete(from.color.mode, to.color.mode),
      paletteId: discrete(from.color.paletteId, to.color.paletteId),
      colorCycleSpeed: interpolateNumber(from.color.colorCycleSpeed, to.color.colorCycleSpeed, p),
    }
  }

  if (!colorOnly && !movementOnly) {
    result.beam = {
      ...to.beam,
      dimmer: interpolateNumber(from.beam.dimmer, to.beam.dimmer, p),
      shutterOpen: discrete(from.beam.shutterOpen, to.beam.shutterOpen),
      width: interpolateNumber(from.beam.width, to.beam.width, p),
      zoom: interpolateNumber(from.beam.zoom, to.beam.zoom, p),
      focus: interpolateNumber(from.beam.focus, to.beam.focus, p),
      strobeRate: interpolateNumber(from.beam.strobeRate, to.beam.strobeRate, p),
      flickerAmount: interpolateNumber(from.beam.flickerAmount, to.beam.flickerAmount, p),
    }
  }

  if (!colorOnly) {
    const fromMoving = normalizeProductionMovingHeadSettings(from.movingHead)
    const toMoving = normalizeProductionMovingHeadSettings(to.movingHead)
    result.movingHead = to.movingHead || from.movingHead ? {
      ...toMoving,
      panDeg: interpolateNumber(fromMoving.panDeg, toMoving.panDeg, p),
      tiltDeg: interpolateNumber(fromMoving.tiltDeg, toMoving.tiltDeg, p),
      goboRotation: interpolateNumber(fromMoving.goboRotation, toMoving.goboRotation, p),
      prismRotation: interpolateNumber(fromMoving.prismRotation, toMoving.prismRotation, p),
      iris: interpolateNumber(fromMoving.iris, toMoving.iris, p),
      frost: interpolateNumber(fromMoving.frost, toMoving.frost, p),
      colorWheelSlot: discrete(fromMoving.colorWheelSlot, toMoving.colorWheelSlot),
      goboIndex: discrete(fromMoving.goboIndex, toMoving.goboIndex),
      prismFacets: discrete(fromMoving.prismFacets, toMoving.prismFacets),
    } : undefined
    result.position = {
      ...to.position,
      pan: interpolateNumber(from.position.pan, to.position.pan, p),
      tilt: interpolateNumber(from.position.tilt, to.position.tilt, p),
      rotation: interpolateNumber(from.position.rotation, to.position.rotation, p),
      targetX: interpolateNumber(from.position.targetX, to.position.targetX, p),
      targetY: interpolateNumber(from.position.targetY, to.position.targetY, p),
      targetZ: interpolateNumber(from.position.targetZ, to.position.targetZ, p),
    }
  }

  if (transition.mode === 'shutteredPrePosition' && progress < transition.switchPoint) {
    result.beam.shutterOpen = false
  }

  if (movementOnly) result.path = discrete(from.path, to.path)
  else if (!colorOnly) result.path = discrete(from.path, to.path)

  if (!colorOnly && !movementOnly) {
    result.flashPattern = discrete(from.flashPattern, to.flashPattern)
    result.wash = discrete(from.wash, to.wash)
    result.ledBar = discrete(from.ledBar, to.ledBar)
    result.atmospheric = discrete(from.atmospheric, to.atmospheric)
    result.enabled = discrete(from.enabled, to.enabled)
  }
  return result
}

export function interpolateProductionLookSettings(
  fromInput: LaserDmxSettings,
  targetInput: LaserDmxSettings,
  transitionInput: ProductionLookTransitionSettings,
  elapsedMs: number,
): LaserDmxSettings {
  const from = normalizeLaserDmxSettings(fromInput)
  const target = normalizeLaserDmxSettings(targetInput)
  const transition = normalizeProductionLookTransition(transitionInput)
  const presentKinds = new Set(target.fixtures.map(fixture => fixture.fixtureKind ?? 'laserProjector'))
  const familyDurations = Object.entries(transition.fixtureFamilyDurationsMs)
    .filter(([kind, value]) => presentKinds.has(kind as ProductionFixtureKind) && typeof value === 'number')
    .map(([, value]) => value as number)
  const totalDuration = Math.max(transition.durationMs, ...familyDurations)
  if (transition.mode === 'cut' || totalDuration <= 0 || elapsedMs >= totalDuration) return target
  const baseProgress = Math.max(0, Math.min(1, elapsedMs / Math.max(1, transition.durationMs)))
  const fromById = new Map(from.fixtures.map(fixture => [fixture.id, fixture]))
  const fixtures = target.fixtures.map(toFixture => {
    const fromFixture = fromById.get(toFixture.id) ?? toFixture
    const duration = transition.fixtureFamilyDurationsMs[toFixture.fixtureKind ?? 'laserProjector']
      ?? transition.durationMs
    const progress = duration <= 0 ? 1 : Math.max(0, Math.min(1, elapsedMs / duration))
    return interpolateFixture(fromFixture, toFixture, progress, transition)
  })
  const p = transition.mode === 'linearFade' ? baseProgress : ease(baseProgress, transition.easing)
  const discrete = <T>(a: T, b: T) => choose(a, b, baseProgress, transition.switchPoint)
  const result: LaserDmxSettings = {
    ...target,
    fixtures,
    masterDimmer: interpolateNumber(from.masterDimmer, target.masterDimmer, p),
    hazeAmount: interpolateNumber(from.hazeAmount, target.hazeAmount, p),
    beamPersistence: interpolateNumber(from.beamPersistence, target.beamPersistence, p),
    glowAmount: interpolateNumber(from.glowAmount, target.glowAmount, p),
    globalBeamWidth: interpolateNumber(from.globalBeamWidth, target.globalBeamWidth, p),
    globalStrobeRate: interpolateNumber(from.globalStrobeRate, target.globalStrobeRate, p),
    safetyClamp: interpolateNumber(from.safetyClamp, target.safetyClamp, p),
    backgroundFade: interpolateNumber(from.backgroundFade, target.backgroundFade, p),
    atmosphere: interpolateAtmosphere(from.atmosphere, target.atmosphere, p, transition.switchPoint),
    productionGroups: discrete(from.productionGroups, target.productionGroups),
    productionStage: interpolateStage(from.productionStage, target.productionStage, p, transition.switchPoint),
    blackout: discrete(from.blackout, target.blackout),
  }
  if (transition.mode === 'blackout') {
    const holdRatio = Math.min(0.4, transition.blackoutHoldMs / Math.max(1, transition.durationMs))
    const fadeSpan = Math.max(0.05, (1 - holdRatio) / 2)
    let envelope = 0
    if (baseProgress < fadeSpan) envelope = 1 - baseProgress / fadeSpan
    else if (baseProgress > 1 - fadeSpan) envelope = (baseProgress - (1 - fadeSpan)) / fadeSpan
    result.masterDimmer *= Math.max(0, Math.min(1, envelope))
    result.blackout = envelope <= 0.001
  }
  if (transition.mode === 'crossfade') {
    // Virtual fixtures sharing one address cannot be duplicated safely, so the
    // midpoint dips the common output while fixture state crosses underneath.
    result.masterDimmer *= 0.75 + 0.25 * Math.abs(2 * p - 1)
  }
  if (transition.mode === 'colorOnly' || transition.mode === 'movementOnly') {
    result.masterDimmer = from.masterDimmer
    result.hazeAmount = from.hazeAmount
    result.beamPersistence = from.beamPersistence
    result.glowAmount = from.glowAmount
    result.globalBeamWidth = from.globalBeamWidth
    result.globalStrobeRate = from.globalStrobeRate
    result.safetyClamp = from.safetyClamp
    result.backgroundFade = from.backgroundFade
    result.atmosphere = from.atmosphere
    result.blackout = from.blackout
  }
  if (transition.mode === 'colorOnly') {
    result.productionGroups = from.productionGroups
    result.productionStage = from.productionStage
  }
  return normalizeLaserDmxSettings(result)
}

export function beginProductionLookTransition(
  settingsInput: LaserDmxSettings,
  lookInput: ProductionLook,
  transitionOverride?: Partial<ProductionLookTransitionSettings>,
  nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now(),
): ApplyProductionLookResult {
  const settings = resolveProductionLookTransitionRuntime(settingsInput, nowMs)
  const look = normalizeProductionLook(lookInput)
  const applied = applyProductionLook(settings, look)
  const transition = normalizeProductionLookTransition({
    ...(settings.productionLookTransitionDefaults ?? DEFAULT_PRODUCTION_LOOK_TRANSITION),
    ...look.transition,
    ...(transitionOverride ?? {}),
  })
  const target = {
    ...applied.settings,
    blackout: look.global?.blackout ?? (transition.revealOutput ? false : applied.settings.blackout),
  }
  const from = withoutRuntime(settings)
  const cleanTarget = withoutRuntime(target)
  const prior = settings.runtime?.lookTransition
  const priorRequestId = isTransitionRuntime(prior) ? prior.requestId : 0
  const runtime: ProductionLookTransitionRuntime = {
    requestId: priorRequestId + 1,
    startedAtMs: nowMs,
    lookId: look.id,
    from,
    target: cleanTarget,
    transition,
  }
  return {
    diagnostics: applied.diagnostics,
    settings: normalizeLaserDmxSettings({
      ...cleanTarget,
      activeProductionLookId: look.id,
      runtime: { ...settings.runtime, lookTransition: runtime },
    }),
  }
}

function isTransitionRuntime(value: unknown): value is ProductionLookTransitionRuntime {
  if (!value || typeof value !== 'object') return false
  const runtime = value as Partial<ProductionLookTransitionRuntime>
  return typeof runtime.requestId === 'number'
    && typeof runtime.startedAtMs === 'number'
    && typeof runtime.lookId === 'string'
    && Boolean(runtime.from)
    && Boolean(runtime.target)
    && Boolean(runtime.transition)
}

export function resolveProductionLookTransitionRuntime(
  settingsInput: LaserDmxSettings,
  nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now(),
): LaserDmxSettings {
  const settings = normalizeLaserDmxSettings(settingsInput)
  const runtimeValue = settings.runtime?.lookTransition
  if (!isTransitionRuntime(runtimeValue)) return settings
  const resolved = interpolateProductionLookSettings(
    runtimeValue.from,
    runtimeValue.target,
    runtimeValue.transition,
    Math.max(0, nowMs - runtimeValue.startedAtMs),
  )
  return { ...resolved, runtime: settings.runtime }
}

export function listProductionFixtureKinds(settingsInput: LaserDmxSettings): ProductionFixtureKind[] {
  const present = new Set(
    normalizeLaserDmxSettings(settingsInput).fixtures
      .map(fixture => fixture.fixtureKind)
      .filter(Boolean),
  )
  return ALL_PRODUCTION_FIXTURE_KINDS.filter(kind => present.has(kind))
}
