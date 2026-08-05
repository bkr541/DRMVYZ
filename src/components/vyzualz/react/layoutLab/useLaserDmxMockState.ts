import { useCallback, useMemo, useState } from 'react'

export type LaserDmxMockMode = 'matrix' | 'showDirector'
export type LaserDmxMockLeftTab = 'workspace' | 'layers'
export type LaserDmxMockDesignSurface = 'engine' | 'selection'
export type LaserDmxMockReactSurface = 'routing' | 'analysis'
export type LaserDmxMockOutputSurface = 'recording' | 'production'
export type LaserDmxMockPresetFilter = 'current' | 'favorites' | 'all'
export type LaserDmxMockRouteScope = 'global' | 'group' | 'beam'
export type LaserDmxMockFixtureInspectorMode = 'dj' | 'production'
export type LaserDmxMockFixtureKind =
  | 'laser'
  | 'movingHead'
  | 'ledBar'
  | 'ledTube'
  | 'strobe'
  | 'blinder'
  | 'parWash'
  | 'videoWall'
  | 'haze'
  | 'co2Jet'

export const LASER_DMX_MOCK_FIXTURE_KINDS: readonly LaserDmxMockFixtureKind[] = [
  'laser',
  'movingHead',
  'ledBar',
  'ledTube',
  'strobe',
  'blinder',
  'parWash',
  'videoWall',
  'haze',
  'co2Jet',
] as const

export const LASER_DMX_MOCK_FIXTURE_LABELS: Record<LaserDmxMockFixtureKind, string> = {
  laser: 'Laser',
  movingHead: 'Moving Head',
  ledBar: 'LED Bar',
  ledTube: 'LED Tube',
  strobe: 'Strobe',
  blinder: 'Blinder',
  parWash: 'PAR Wash',
  videoWall: 'Video Wall',
  haze: 'Haze',
  co2Jet: 'CO₂ Jet',
}

export interface LaserDmxMockGroup {
  id: string
  name: string
  enabled: boolean
  muted: boolean
  soloed: boolean
  colorOverride: boolean
  color: { red: number; green: number; blue: number; white: number; alpha: number }
  launch: {
    trigger: string
    threshold: number
    minEnergy: number
    cooldownBeats: number
    maxActiveBeams: number
  }
  sequence: {
    enabled: boolean
    mode: string
    stepsPerBeat: number
    stepGate: number
    phaseSpread: number
    rotateEveryBars: number
    randomSeed: number
    resetOnDownbeat: boolean
  }
}

export interface LaserDmxMockBeam {
  id: string
  name: string
  enabled: boolean
  groupId: string | null
  useGroupColor: boolean
  origin: { column: number; row: number; z: number }
  target: { kind: 'grid' | 'stage'; column: number; row: number; x: number; y: number; z: number }
  sequenceIndex: number
  motion: {
    enabled: boolean
    travelMode: string
    duration: number
    easing: string
    retrigger: string
    phaseOffset: number
    headGlow: number
  }
  appearance: {
    geometry: string
    dimmer: number
    shutterOpen: boolean
    width: number
    focus: number
    glow: number
    divergence: number
    strobeRate: number
    flicker: number
  }
  color: { red: number; green: number; blue: number; white: number; alpha: number }
}

export interface LaserDmxMockFixture {
  id: string
  kind: LaserDmxMockFixtureKind
  name: string
  enabled: boolean
  groupName: string
  color: string
  brightness: number
  position: { x: number; y: number; z: number; rotation: number; depthLayer: string }
  beamEnabled: boolean
  triggerMode: string
  triggerRecipe: string
  primitive: string
}

export interface LaserDmxMockRoute {
  id: string
  scope: LaserDmxMockRouteScope
  ownerId: string | null
  enabled: boolean
  source: string
  target: string
  curve: string
  mode: string
  amount: number
  min: number
  max: number
  smoothing: number
  attack: number
  release: number
  invert: boolean
  timing: string
  bar: number
  beat: number
  bars: number
  startBar: number
  endBar: number
  everyNBars: number
  anchorBar: number
}

export interface LaserDmxMockPreset {
  id: string
  name: string
  family: 'matrix' | 'performance' | 'rig'
  description: string
  favorite: boolean
  modified: boolean
}

export interface LaserDmxMockControlValues {
  [key: string]: string | number | boolean
}

export interface LaserDmxMockStateValue {
  mode: LaserDmxMockMode
  leftTab: LaserDmxMockLeftTab
  designSurface: LaserDmxMockDesignSurface
  reactSurface: LaserDmxMockReactSurface
  outputSurface: LaserDmxMockOutputSurface
  presetFilter: LaserDmxMockPresetFilter
  activePresetId: string
  routeScope: LaserDmxMockRouteScope
  fixtureInspectorMode: LaserDmxMockFixtureInspectorMode
  groups: LaserDmxMockGroup[]
  beams: LaserDmxMockBeam[]
  fixtures: LaserDmxMockFixture[]
  routes: LaserDmxMockRoute[]
  presets: LaserDmxMockPreset[]
  selectedBeamIds: string[]
  selectedGroupId: string | null
  selectedFixtureIds: string[]
  primaryFixtureId: string | null
  layerFiltersOpen: boolean
  layerNameFilter: string
  layerGroupFilter: string
  layerEnabledFilter: string
  fixtureSearch: string
  resetMatrixConfirm: boolean
  resetLayoutConfirm: boolean
  controls: LaserDmxMockControlValues
  recordingState: 'idle' | 'recording'
  outputAdapter: 'virtual' | 'artnet' | 'sacn'
  outputArmed: boolean
  rehearsalMode: boolean
  emergencyBlackout: boolean
  outputStatusMessage: string
  nextBeamSerial: number
  nextGroupSerial: number
  nextFixtureSerial: number
  nextRouteSerial: number
}

function createGroup(id: string, name: string, color: { red: number; green: number; blue: number }): LaserDmxMockGroup {
  return {
    id,
    name,
    enabled: true,
    muted: false,
    soloed: false,
    colorOverride: true,
    color: { ...color, white: 0, alpha: 1 },
    launch: { trigger: 'bassHit', threshold: 0.56, minEnergy: 0.42, cooldownBeats: 2, maxActiveBeams: 8 },
    sequence: { enabled: true, mode: 'rotate', stepsPerBeat: 2, stepGate: 0.72, phaseSpread: 0.35, rotateEveryBars: 2, randomSeed: 17, resetOnDownbeat: true },
  }
}

function createBeam(id: string, name: string, groupId: string | null, sequenceIndex: number, originCol: number, targetCol: number): LaserDmxMockBeam {
  return {
    id,
    name,
    enabled: true,
    groupId,
    useGroupColor: true,
    origin: { column: originCol, row: 8, z: 0 },
    target: { kind: 'grid', column: targetCol, row: 2, x: 0.5, y: 0.25, z: 0 },
    sequenceIndex,
    motion: { enabled: true, travelMode: 'sweep', duration: 1, easing: 'easeInOut', retrigger: 'restart', phaseOffset: sequenceIndex * 0.15, headGlow: 0.72 },
    appearance: { geometry: 'beam', dimmer: 0.82, shutterOpen: true, width: 1.25, focus: 0.78, glow: 0.62, divergence: 0.12, strobeRate: 0, flicker: 0.04 },
    color: { red: 54, green: 217, blue: 255, white: 0, alpha: 1 },
  }
}

function createFixture(id: string, kind: LaserDmxMockFixtureKind, index: number): LaserDmxMockFixture {
  return {
    id,
    kind,
    name: `${LASER_DMX_MOCK_FIXTURE_LABELS[kind]} ${index + 1}`,
    enabled: true,
    groupName: index % 2 === 0 ? 'Stage Left' : 'Stage Right',
    color: index % 3 === 0 ? '#36d9ff' : index % 3 === 1 ? '#61d6aa' : '#d8b95a',
    brightness: Math.max(0.45, 0.9 - index * 0.035),
    position: {
      x: 0.12 + (index % 5) * 0.19,
      y: index < 5 ? 0.25 : 0.7,
      z: index % 3,
      rotation: index % 2 === 0 ? -12 : 12,
      depthLayer: index < 5 ? 'Overhead' : 'Floor',
    },
    beamEnabled: kind === 'laser' || kind === 'movingHead',
    triggerMode: index % 2 === 0 ? 'beat' : 'section',
    triggerRecipe: index % 2 === 0 ? 'Beat Pulse' : 'Section Lift',
    primitive: kind === 'laser' ? 'scanner' : kind === 'movingHead' ? 'cone' : 'wash',
  }
}

function createInitialControls(): LaserDmxMockControlValues {
  return {
    beamEditorVisible: true,
    snapEnabled: true,
    guidesVisible: true,
    beamPathsVisible: true,
    overscanAmount: 0.08,
    previewOutputTrim: 0.92,
    motion: 0.65,
    previewGlowTrim: 0.72,
    bassReact: 0.58,
    masterDimmer: 0.84,
    safetyClamp: 0.82,
    backgroundFade: 0.18,
    beamPersistence: 0.48,
    globalBeamWidth: 1.15,
    globalGlow: 0.68,
    globalStrobeRate: 0.08,
    fogEnabled: true,
    fogDensity: 0.36,
    fogOpacity: 0.46,
    fogNoiseScale: 1.35,
    fogDriftSpeed: 0.22,
    fogDriftDirection: 0.4,
    fogTurbulence: 0.42,
    fogDiffusion: 0.58,
    fogDissipation: 0.32,
    fogBeamScatter: 0.72,
    fogColorAbsorption: 0.18,
    fogQuality: 'balanced',
    snapToGrid: true,
    showGrid: true,
    showLabels: true,
    showBeams: true,
    highlightFixtures: true,
    gridSize: 24,
    stageZoom: 1,
    presentationMode: 'editing',
    lightingRenderer: 'webgl',
    webglQuality: 'high',
    atmosphereQuality: 'balanced',
    webglRenderScale: 1,
    performanceProgram: true,
    programIntensity: 0.82,
    variationAmount: 0.36,
    audioIntelligenceResponse: 0.74,
    variationSeed: 1138,
    analysisFallback: 'musicalClock',
    hardwareMaster: 0.75,
    strobeLimit: 12,
    multiBeamColumnOffset: 1,
    multiBeamRowOffset: 0,
    multiBeamKeepGroups: true,
    scannerPattern: 'fan',
    scannerPatternSize: 0.68,
    scannerPhase: 0.2,
    scannerScanRate: 0.55,
    scannerRadius: 0.45,
    scannerInterpolation: 'linear',
    scannerPlayback: 'loop',
    scannerPathRevision: 0,
    scannerPointCount: 18,
    scannerMigrationState: 'ready',
    scannerClosedPath: false,
    scannerBlankRetrace: true,
    scannerPointDwell: 12,
    scannerCornerDwell: 24,
    scannerBlankingDelay: 8,
    scannerOpticalMode: 'single',
    scannerOpticalCopies: 1,
    scannerOpticalSpread: 18,
    scannerApertures: 1,
    scannerMaxVelocity: 36000,
    scannerMaxAcceleration: 2800000,
    scannerExposure: 16.67,
    scannerCalibrationProfile: 'layout-lab-synthetic',
    opticsRayCount: 4,
    opticsFanWidth: 42,
    opticsSoftness: 0.3,
    opticsSourceIntensity: 0.82,
    opticsAtmosphereResponse: 0.66,
    opticsZoom: 0.5,
    opticsIris: 0.9,
    opticsFrost: 0.1,
    opticsGoboPattern: 'open',
    opticsGoboAmount: 0,
    opticsGoboRotation: 0,
    opticsPrism: '1',
    opticsPrismRotation: 0,
    triggerBeatDivision: '1',
    triggerBarInterval: 4,
    triggerPhraseBars: 8,
    triggerSection: 'drop',
    triggerCuePoint: 'Drop 1',
    triggerAudioBand: 'bass',
    triggerAudioThreshold: 0.58,
    triggerEnergyThreshold: 0.62,
    triggerFadeIn: 80,
    triggerFadeOut: 240,
    strobeRateHz: 12,
    ledCellCount: 16,
    ledDirection: 'forward',
    movingHeadStyle: 'mirrored',
    hazeIntensity: 0.55,
    co2BurstDuration: 450,
    wallBrightness: 0.78,
    videoSource: 'Program Visual',
    fixtureAim: 'stageCenter',
    fixtureColorMode: 'fixed',
    beamTargetMode: 'fan',
    beamTargetX: 0.5,
    beamTargetY: 0.35,
    beamTargetDepth: 0.4,
    beamAngle: 0.3,
    beamSpread: 0.4,
    beamFocus: 0.75,
    scannerShutterClosed: false,
    recordingMode: 'video',
    recordingFrameRate: '60',
  }
}

function createInitialState(): LaserDmxMockStateValue {
  const groupA = createGroup('mock-group-drop', 'Drop Fans', { red: 54, green: 217, blue: 255 })
  const groupB = createGroup('mock-group-accents', 'Percussion Accents', { red: 97, green: 214, blue: 170 })
  groupB.sequence.mode = 'pingPong'
  groupB.launch.trigger = 'snareTransient'

  const beams = [
    createBeam('mock-beam-1', 'Cyan Sweep L', groupA.id, 0, 3, 12),
    createBeam('mock-beam-2', 'Cyan Sweep R', groupA.id, 1, 12, 3),
    createBeam('mock-beam-3', 'Snare Spear L', groupB.id, 2, 5, 8),
    createBeam('mock-beam-4', 'Snare Spear R', groupB.id, 3, 10, 7),
  ]

  const fixtures = LASER_DMX_MOCK_FIXTURE_KINDS.map((kind, index) => createFixture(`mock-fixture-${index + 1}`, kind, index))

  return {
    mode: 'matrix',
    leftTab: 'workspace',
    designSurface: 'engine',
    reactSurface: 'routing',
    outputSurface: 'recording',
    presetFilter: 'current',
    activePresetId: 'matrix-prism',
    routeScope: 'global',
    fixtureInspectorMode: 'dj',
    groups: [groupA, groupB],
    beams,
    fixtures,
    routes: [
      {
        id: 'mock-route-global', scope: 'global', ownerId: null, enabled: true, source: 'Bass', target: 'Master Dimmer', curve: 'smoothstep', mode: 'add', amount: 0.72, min: 0.1, max: 1, smoothing: 0.22, attack: 0.06, release: 0.28, invert: false,
        timing: 'continuous', bar: 1, beat: 1, bars: 4, startBar: 1, endBar: 64, everyNBars: 4, anchorBar: 1,
      },
      {
        id: 'mock-route-group', scope: 'group', ownerId: groupA.id, enabled: true, source: 'Downbeat', target: 'Group Glow', curve: 'easeOut', mode: 'replace', amount: 0.85, min: 0, max: 1, smoothing: 0.12, attack: 0.02, release: 0.42, invert: false,
        timing: 'barBeat', bar: 1, beat: 1, bars: 8, startBar: 1, endBar: 128, everyNBars: 8, anchorBar: 1,
      },
      {
        id: 'mock-route-beam', scope: 'beam', ownerId: beams[0].id, enabled: true, source: 'Snare Hit', target: 'Beam Strobe', curve: 'linear', mode: 'add', amount: 0.62, min: 0, max: 0.7, smoothing: 0.04, attack: 0.01, release: 0.16, invert: false,
        timing: 'everyNBars', bar: 1, beat: 3, bars: 4, startBar: 9, endBar: 65, everyNBars: 4, anchorBar: 1,
      },
    ],
    presets: [
      { id: 'matrix-prism', name: 'Prism Crossfire', family: 'matrix', description: 'Mirrored cyan and emerald beam-matrix look.', favorite: true, modified: true },
      { id: 'matrix-drop', name: 'Drop Fan Array', family: 'matrix', description: 'Wide fan sweeps with downbeat accents.', favorite: false, modified: false },
      { id: 'show-neon', name: 'Neon Cathedral', family: 'performance', description: 'Finite cues, fixture-group choreography, and authored transitions.', favorite: true, modified: false },
      { id: 'show-impact', name: 'Impact Architecture', family: 'performance', description: 'High-contrast strobe, blinder, CO₂, and moving-head performance show.', favorite: false, modified: false },
      { id: 'rig-arena', name: 'Arena Symmetry', family: 'rig', description: 'Balanced overhead and floor fixture layout.', favorite: false, modified: true },
      { id: 'rig-club', name: 'Club Compact', family: 'rig', description: 'Compact club rig with scanners, bars, haze, and video wall.', favorite: false, modified: false },
    ],
    selectedBeamIds: [],
    selectedGroupId: null,
    selectedFixtureIds: [],
    primaryFixtureId: null,
    layerFiltersOpen: false,
    layerNameFilter: '',
    layerGroupFilter: 'all',
    layerEnabledFilter: 'all',
    fixtureSearch: '',
    resetMatrixConfirm: false,
    resetLayoutConfirm: false,
    controls: createInitialControls(),
    recordingState: 'idle',
    outputAdapter: 'virtual',
    outputArmed: false,
    rehearsalMode: true,
    emergencyBlackout: false,
    outputStatusMessage: 'DISARMED · Virtual Output · 10 fixtures / 1 universe',
    nextBeamSerial: 5,
    nextGroupSerial: 3,
    nextFixtureSerial: fixtures.length + 1,
    nextRouteSerial: 4,
  }
}

export function useLaserDmxMockState() {
  const [state, setState] = useState<LaserDmxMockStateValue>(createInitialState)

  const patch = useCallback((update: Partial<LaserDmxMockStateValue>) => {
    setState(current => ({ ...current, ...update }))
  }, [])

  const setMode = useCallback((mode: LaserDmxMockMode) => {
    setState(current => ({
      ...current,
      mode,
      designSurface: 'engine',
      routeScope: 'global',
      selectedBeamIds: [],
      selectedGroupId: null,
      selectedFixtureIds: [],
      primaryFixtureId: null,
      fixtureInspectorMode: 'dj',
      resetMatrixConfirm: false,
      resetLayoutConfirm: false,
    }))
  }, [])

  const setControl = useCallback((key: string, value: string | number | boolean) => {
    setState(current => ({ ...current, controls: { ...current.controls, [key]: value } }))
  }, [])

  const selectGroup = useCallback((id: string | null) => {
    setState(current => ({
      ...current,
      selectedGroupId: id,
      selectedBeamIds: [],
      selectedFixtureIds: [],
      primaryFixtureId: null,
      designSurface: id ? 'selection' : 'engine',
      routeScope: id ? 'group' : 'global',
    }))
  }, [])

  const selectBeam = useCallback((id: string, additive = false) => {
    setState(current => {
      const already = current.selectedBeamIds.includes(id)
      const selectedBeamIds = additive
        ? already ? current.selectedBeamIds.filter(candidate => candidate !== id) : [...current.selectedBeamIds, id]
        : [id]
      return {
        ...current,
        selectedBeamIds,
        selectedGroupId: null,
        selectedFixtureIds: [],
        primaryFixtureId: null,
        designSurface: selectedBeamIds.length ? 'selection' : 'engine',
        routeScope: selectedBeamIds.length === 1 ? 'beam' : 'global',
      }
    })
  }, [])

  const selectAllBeams = useCallback(() => {
    setState(current => ({
      ...current,
      selectedBeamIds: current.beams.map(beam => beam.id),
      selectedGroupId: null,
      designSurface: current.beams.length ? 'selection' : 'engine',
      routeScope: 'global',
    }))
  }, [])

  const clearMatrixSelection = useCallback(() => {
    setState(current => ({ ...current, selectedBeamIds: [], selectedGroupId: null, designSurface: 'engine', routeScope: 'global' }))
  }, [])

  const addBeam = useCallback(() => {
    setState(current => {
      const serial = current.nextBeamSerial
      const groupId = current.groups[0]?.id ?? null
      const beam = createBeam(`mock-beam-${serial}`, `Beam ${serial}`, groupId, current.beams.length, 2 + (serial % 12), 13 - (serial % 12))
      return { ...current, beams: [...current.beams, beam], selectedBeamIds: [beam.id], selectedGroupId: null, designSurface: 'selection', routeScope: 'beam', nextBeamSerial: serial + 1 }
    })
  }, [])

  const duplicateSelectedBeams = useCallback((withOffset = false) => {
    setState(current => {
      const sourceIds = current.selectedBeamIds.length ? current.selectedBeamIds : current.beams.slice(0, 1).map(beam => beam.id)
      let serial = current.nextBeamSerial
      const copies = sourceIds.flatMap(id => {
        const source = current.beams.find(beam => beam.id === id)
        if (!source) return []
        const copy: LaserDmxMockBeam = {
          ...source,
          id: `mock-beam-${serial}`,
          name: `${source.name} Copy`,
          origin: {
            ...source.origin,
            column: Math.max(1, Math.min(15, source.origin.column + (withOffset ? Number(current.controls.multiBeamColumnOffset) : 0))),
            row: Math.max(1, Math.min(9, source.origin.row + (withOffset ? Number(current.controls.multiBeamRowOffset) : 0))),
          },
          target: {
            ...source.target,
            column: Math.max(1, Math.min(15, source.target.column + (withOffset ? Number(current.controls.multiBeamColumnOffset) : 0))),
            row: Math.max(1, Math.min(9, source.target.row + (withOffset ? Number(current.controls.multiBeamRowOffset) : 0))),
          },
          groupId: Boolean(current.controls.multiBeamKeepGroups) ? source.groupId : null,
          sequenceIndex: current.beams.length + (serial - current.nextBeamSerial),
        }
        serial += 1
        return [copy]
      })
      return { ...current, beams: [...current.beams, ...copies], selectedBeamIds: copies.map(copy => copy.id), selectedGroupId: null, designSurface: copies.length ? 'selection' : current.designSurface, routeScope: copies.length === 1 ? 'beam' : 'global', nextBeamSerial: serial }
    })
  }, [])

  const deleteSelectedBeams = useCallback(() => {
    setState(current => {
      const removed = new Set(current.selectedBeamIds)
      return {
        ...current,
        beams: current.beams.filter(beam => !removed.has(beam.id)),
        routes: current.routes.filter(route => !(route.scope === 'beam' && route.ownerId && removed.has(route.ownerId))),
        selectedBeamIds: [],
        selectedGroupId: null,
        designSurface: 'engine',
        routeScope: 'global',
      }
    })
  }, [])

  const updateBeam = useCallback((id: string, update: Partial<LaserDmxMockBeam>) => {
    setState(current => ({ ...current, beams: current.beams.map(beam => beam.id === id ? { ...beam, ...update } : beam) }))
  }, [])

  const resetMatrix = useCallback(() => {
    setState(current => {
      const initial = createInitialState()
      return {
        ...current,
        groups: initial.groups,
        beams: initial.beams,
        routes: initial.routes,
        selectedBeamIds: [],
        selectedGroupId: null,
        designSurface: 'engine',
        routeScope: 'global',
        resetMatrixConfirm: false,
      }
    })
  }, [])

  const addGroup = useCallback(() => {
    setState(current => {
      const serial = current.nextGroupSerial
      const group = createGroup(`mock-group-${serial}`, `Reaction Group ${serial}`, { red: 216, green: 185, blue: 90 })
      return { ...current, groups: [...current.groups, group], selectedGroupId: group.id, selectedBeamIds: [], designSurface: 'selection', routeScope: 'group', nextGroupSerial: serial + 1 }
    })
  }, [])

  const updateGroup = useCallback((id: string, update: Partial<LaserDmxMockGroup>) => {
    setState(current => ({ ...current, groups: current.groups.map(group => group.id === id ? { ...group, ...update } : group) }))
  }, [])

  const duplicateGroup = useCallback((id: string) => {
    setState(current => {
      const source = current.groups.find(group => group.id === id)
      if (!source) return current
      const serial = current.nextGroupSerial
      const copy: LaserDmxMockGroup = { ...source, id: `mock-group-${serial}`, name: `${source.name} Copy`, color: { ...source.color }, launch: { ...source.launch }, sequence: { ...source.sequence } }
      return { ...current, groups: [...current.groups, copy], selectedGroupId: copy.id, selectedBeamIds: [], designSurface: 'selection', routeScope: 'group', nextGroupSerial: serial + 1 }
    })
  }, [])

  const deleteGroup = useCallback((id: string) => {
    setState(current => ({
      ...current,
      groups: current.groups.filter(group => group.id !== id),
      beams: current.beams.map(beam => beam.groupId === id ? { ...beam, groupId: null } : beam),
      routes: current.routes.filter(route => !(route.scope === 'group' && route.ownerId === id)),
      selectedGroupId: current.selectedGroupId === id ? null : current.selectedGroupId,
      designSurface: current.selectedGroupId === id ? 'engine' : current.designSurface,
      routeScope: current.selectedGroupId === id ? 'global' : current.routeScope,
    }))
  }, [])

  const selectFixture = useCallback((id: string, additive = false) => {
    setState(current => {
      const already = current.selectedFixtureIds.includes(id)
      const selectedFixtureIds = additive
        ? already ? current.selectedFixtureIds.filter(candidate => candidate !== id) : [...current.selectedFixtureIds, id]
        : [id]
      return {
        ...current,
        selectedFixtureIds,
        primaryFixtureId: selectedFixtureIds[0] ?? null,
        selectedBeamIds: [],
        selectedGroupId: null,
        fixtureInspectorMode: 'dj',
      }
    })
  }, [])

  const clearFixtureSelection = useCallback(() => patch({ selectedFixtureIds: [], primaryFixtureId: null, fixtureInspectorMode: 'dj' }), [patch])

  const addFixture = useCallback((kind: LaserDmxMockFixtureKind) => {
    setState(current => {
      const serial = current.nextFixtureSerial
      const fixture = createFixture(`mock-fixture-${serial}`, kind, serial - 1)
      fixture.name = `${LASER_DMX_MOCK_FIXTURE_LABELS[kind]} ${serial}`
      return { ...current, fixtures: [...current.fixtures, fixture], selectedFixtureIds: [fixture.id], primaryFixtureId: fixture.id, fixtureInspectorMode: 'dj', nextFixtureSerial: serial + 1 }
    })
  }, [])

  const updateFixture = useCallback((id: string, update: Partial<LaserDmxMockFixture>) => {
    setState(current => ({ ...current, fixtures: current.fixtures.map(fixture => fixture.id === id ? { ...fixture, ...update } : fixture) }))
  }, [])

  const duplicateSelectedFixtures = useCallback(() => {
    setState(current => {
      let serial = current.nextFixtureSerial
      const copies = current.selectedFixtureIds.flatMap(id => {
        const source = current.fixtures.find(fixture => fixture.id === id)
        if (!source) return []
        const copy: LaserDmxMockFixture = {
          ...source,
          id: `mock-fixture-${serial}`,
          name: `${source.name} Copy`,
          position: { ...source.position, x: Math.min(0.96, source.position.x + 0.05), y: Math.min(0.96, source.position.y + 0.05) },
        }
        serial += 1
        return [copy]
      })
      return { ...current, fixtures: [...current.fixtures, ...copies], selectedFixtureIds: copies.map(copy => copy.id), primaryFixtureId: copies[0]?.id ?? null, nextFixtureSerial: serial }
    })
  }, [])

  const deleteSelectedFixtures = useCallback(() => {
    setState(current => {
      const removed = new Set(current.selectedFixtureIds)
      return { ...current, fixtures: current.fixtures.filter(fixture => !removed.has(fixture.id)), selectedFixtureIds: [], primaryFixtureId: null, fixtureInspectorMode: 'dj' }
    })
  }, [])

  const clearRig = useCallback(() => patch({ fixtures: [], selectedFixtureIds: [], primaryFixtureId: null, resetLayoutConfirm: false }), [patch])

  const resetRig = useCallback(() => {
    const fixtures = LASER_DMX_MOCK_FIXTURE_KINDS.map((kind, index) => createFixture(`mock-fixture-${index + 1}`, kind, index))
    patch({ fixtures, selectedFixtureIds: [], primaryFixtureId: null, resetLayoutConfirm: false, nextFixtureSerial: fixtures.length + 1 })
  }, [patch])

  const applyPreset = useCallback((id: string) => {
    setState(current => {
      const preset = current.presets.find(candidate => candidate.id === id)
      if (!preset) return current
      return {
        ...current,
        activePresetId: id,
        mode: preset.family === 'matrix' ? 'matrix' : 'showDirector',
        designSurface: 'engine',
        routeScope: 'global',
        selectedBeamIds: [],
        selectedGroupId: null,
        selectedFixtureIds: [],
        primaryFixtureId: null,
        fixtureInspectorMode: 'dj',
        presets: current.presets.map(candidate => candidate.id === id ? { ...candidate, modified: false } : candidate),
      }
    })
  }, [])

  const togglePresetFavorite = useCallback((id: string) => {
    setState(current => ({ ...current, presets: current.presets.map(preset => preset.id === id ? { ...preset, favorite: !preset.favorite } : preset) }))
  }, [])

  const rotateSelectedFixtures = useCallback(() => {
    setState(current => {
      const selected = new Set(current.selectedFixtureIds)
      return { ...current, fixtures: current.fixtures.map(fixture => selected.has(fixture.id) ? { ...fixture, position: { ...fixture.position, rotation: ((fixture.position.rotation + 270) % 360) - 180 } } : fixture) }
    })
  }, [])

  const mirrorSelectedFixtures = useCallback((axis: 'horizontal' | 'vertical') => {
    setState(current => {
      const selected = new Set(current.selectedFixtureIds)
      return { ...current, fixtures: current.fixtures.map(fixture => selected.has(fixture.id) ? { ...fixture, position: { ...fixture.position, x: axis === 'horizontal' ? 1 - fixture.position.x : fixture.position.x, y: axis === 'vertical' ? 1 - fixture.position.y : fixture.position.y } } : fixture) }
    })
  }, [])

  const duplicateRig = useCallback(() => {
    setState(current => {
      let serial = current.nextFixtureSerial
      const copies = current.fixtures.map(fixture => {
        const copy: LaserDmxMockFixture = { ...fixture, id: `mock-fixture-${serial}`, name: `${fixture.name} Copy`, position: { ...fixture.position, x: Math.min(0.96, fixture.position.x + 0.035), y: Math.min(0.96, fixture.position.y + 0.035) } }
        serial += 1
        return copy
      })
      return { ...current, fixtures: [...current.fixtures, ...copies], selectedFixtureIds: copies.map(fixture => fixture.id), primaryFixtureId: copies[0]?.id ?? null, nextFixtureSerial: serial }
    })
  }, [])

  const mirrorRig = useCallback((axis: 'horizontal' | 'vertical') => {
    setState(current => ({ ...current, fixtures: current.fixtures.map(fixture => ({ ...fixture, position: { ...fixture.position, x: axis === 'horizontal' ? 1 - fixture.position.x : fixture.position.x, y: axis === 'vertical' ? 1 - fixture.position.y : fixture.position.y } })) }))
  }, [])

  const groupSelectedFixtures = useCallback(() => {
    setState(current => {
      const selected = new Set(current.selectedFixtureIds)
      const groupName = current.primaryFixtureId ? current.fixtures.find(fixture => fixture.id === current.primaryFixtureId)?.groupName || 'Fixture Group' : 'Fixture Group'
      return { ...current, fixtures: current.fixtures.map(fixture => selected.has(fixture.id) ? { ...fixture, groupName } : fixture) }
    })
  }, [])

  const ungroupSelectedFixtures = useCallback(() => {
    setState(current => {
      const selected = new Set(current.selectedFixtureIds)
      return { ...current, fixtures: current.fixtures.map(fixture => selected.has(fixture.id) ? { ...fixture, groupName: 'Ungrouped' } : fixture) }
    })
  }, [])

  const addRoute = useCallback((scope: LaserDmxMockRouteScope) => {
    setState(current => {
      const serial = current.nextRouteSerial
      const ownerId = scope === 'group' ? current.selectedGroupId : scope === 'beam' ? current.selectedBeamIds[0] ?? null : null
      if (scope !== 'global' && !ownerId) return current
      const route: LaserDmxMockRoute = {
        id: `mock-route-${serial}`, scope, ownerId, enabled: true, source: 'Energy', target: scope === 'beam' ? 'Beam Width' : scope === 'group' ? 'Group Dimmer' : 'Global Glow', curve: 'linear', mode: 'add', amount: 0.5, min: 0, max: 1, smoothing: 0.15, attack: 0.05, release: 0.25, invert: false,
        timing: 'continuous', bar: 1, beat: 1, bars: 4, startBar: 1, endBar: 64, everyNBars: 4, anchorBar: 1,
      }
      return { ...current, routes: [...current.routes, route], nextRouteSerial: serial + 1 }
    })
  }, [])

  const updateRoute = useCallback((id: string, update: Partial<LaserDmxMockRoute>) => {
    setState(current => ({ ...current, routes: current.routes.map(route => route.id === id ? { ...route, ...update } : route) }))
  }, [])

  const deleteRoute = useCallback((id: string) => setState(current => ({ ...current, routes: current.routes.filter(route => route.id !== id) })), [])

  const toggleRecording = useCallback(() => setState(current => ({ ...current, recordingState: current.recordingState === 'idle' ? 'recording' : 'idle' })), [])

  const setOutputAdapter = useCallback((outputAdapter: LaserDmxMockStateValue['outputAdapter']) => {
    setState(current => ({ ...current, outputAdapter, outputArmed: false, emergencyBlackout: false, outputStatusMessage: `DISARMED · ${outputAdapter === 'virtual' ? 'Virtual Output' : outputAdapter === 'artnet' ? 'Art-Net (trusted host required)' : 'sACN (trusted host required)'} · ${current.fixtures.length} fixtures / 1 universe` }))
  }, [])

  const setRehearsalMode = useCallback((rehearsalMode: boolean) => {
    setState(current => ({ ...current, rehearsalMode, outputArmed: rehearsalMode && current.outputAdapter !== 'virtual' ? false : current.outputArmed, outputStatusMessage: `${current.outputArmed ? 'ARMED' : 'DISARMED'} · ${current.outputAdapter === 'virtual' ? 'Virtual Output' : current.outputAdapter.toUpperCase()} · rehearsal ${rehearsalMode ? 'on' : 'off'}` }))
  }, [])

  const armOutput = useCallback(() => {
    setState(current => {
      if (current.outputAdapter !== 'virtual') return { ...current, outputArmed: false, outputStatusMessage: 'UNAVAILABLE · trusted host boundary required; no packets sent' }
      return { ...current, outputArmed: true, emergencyBlackout: false, outputStatusMessage: `ARMED · Virtual Output · ${current.fixtures.length} fixtures / 1 universe` }
    })
  }, [])

  const disarmOutput = useCallback(() => setState(current => ({ ...current, outputArmed: false, outputStatusMessage: `DISARMED · ${current.outputAdapter === 'virtual' ? 'Virtual Output' : current.outputAdapter.toUpperCase()} · ${current.fixtures.length} fixtures / 1 universe` })), [])

  const triggerEmergencyBlackout = useCallback(() => setState(current => ({ ...current, outputArmed: false, emergencyBlackout: true, outputStatusMessage: 'BLACKOUT · local Layout Lab latch only · no output emitted' })), [])
  const clearBlackout = useCallback(() => setState(current => ({ ...current, emergencyBlackout: false, outputStatusMessage: `DISARMED · ${current.outputAdapter === 'virtual' ? 'Virtual Output' : current.outputAdapter.toUpperCase()} · ${current.fixtures.length} fixtures / 1 universe` })), [])

  const selectedGroup = useMemo(() => state.groups.find(group => group.id === state.selectedGroupId) ?? null, [state.groups, state.selectedGroupId])
  const selectedBeams = useMemo(() => state.beams.filter(beam => state.selectedBeamIds.includes(beam.id)), [state.beams, state.selectedBeamIds])
  const selectedFixtures = useMemo(() => state.fixtures.filter(fixture => state.selectedFixtureIds.includes(fixture.id)), [state.fixtures, state.selectedFixtureIds])
  const primaryFixture = useMemo(() => state.fixtures.find(fixture => fixture.id === state.primaryFixtureId) ?? selectedFixtures[0] ?? null, [state.fixtures, state.primaryFixtureId, selectedFixtures])

  const filteredBeams = useMemo(() => state.beams.filter(beam => {
    const nameMatches = beam.name.toLowerCase().includes(state.layerNameFilter.trim().toLowerCase())
    const groupMatches = state.layerGroupFilter === 'all' || beam.groupId === state.layerGroupFilter || (state.layerGroupFilter === 'none' && !beam.groupId)
    const enabledMatches = state.layerEnabledFilter === 'all' || (state.layerEnabledFilter === 'enabled' ? beam.enabled : !beam.enabled)
    return nameMatches && groupMatches && enabledMatches
  }), [state.beams, state.layerNameFilter, state.layerGroupFilter, state.layerEnabledFilter])

  const filteredFixtureKinds = useMemo(() => {
    const query = state.fixtureSearch.trim().toLowerCase()
    if (!query) return [...LASER_DMX_MOCK_FIXTURE_KINDS]
    return LASER_DMX_MOCK_FIXTURE_KINDS.filter(kind => `${kind} ${LASER_DMX_MOCK_FIXTURE_LABELS[kind]}`.toLowerCase().includes(query))
  }, [state.fixtureSearch])

  const visiblePresets = useMemo(() => state.presets.filter(preset => {
    const familyMatches = state.mode === 'matrix' ? preset.family === 'matrix' : preset.family === 'performance' || preset.family === 'rig'
    if (!familyMatches) return false
    if (state.presetFilter === 'favorites') return preset.favorite
    return true
  }), [state.presets, state.mode, state.presetFilter])

  return {
    ...state,
    outputStatusMessage: state.outputStatusMessage.replace(/\d+ fixtures/, `${state.fixtures.length} fixtures`),
    selectedGroup,
    selectedBeams,
    selectedFixtures,
    primaryFixture,
    filteredBeams,
    filteredFixtureKinds,
    visiblePresets,
    patch,
    setMode,
    setControl,
    setLeftTab: (leftTab: LaserDmxMockLeftTab) => patch({ leftTab }),
    setDesignSurface: (designSurface: LaserDmxMockDesignSurface) => patch({ designSurface }),
    setReactSurface: (reactSurface: LaserDmxMockReactSurface) => patch({ reactSurface }),
    setOutputSurface: (outputSurface: LaserDmxMockOutputSurface) => patch({ outputSurface }),
    setPresetFilter: (presetFilter: LaserDmxMockPresetFilter) => patch({ presetFilter }),
    applyPreset,
    togglePresetFavorite,
    setRouteScope: (routeScope: LaserDmxMockRouteScope) => patch({ routeScope }),
    setFixtureInspectorMode: (fixtureInspectorMode: LaserDmxMockFixtureInspectorMode) => patch({ fixtureInspectorMode }),
    setLayerFiltersOpen: (layerFiltersOpen: boolean) => patch({ layerFiltersOpen }),
    setLayerNameFilter: (layerNameFilter: string) => patch({ layerNameFilter }),
    setLayerGroupFilter: (layerGroupFilter: string) => patch({ layerGroupFilter }),
    setLayerEnabledFilter: (layerEnabledFilter: string) => patch({ layerEnabledFilter }),
    setFixtureSearch: (fixtureSearch: string) => patch({ fixtureSearch }),
    setResetMatrixConfirm: (resetMatrixConfirm: boolean) => patch({ resetMatrixConfirm }),
    setResetLayoutConfirm: (resetLayoutConfirm: boolean) => patch({ resetLayoutConfirm }),
    selectGroup,
    selectBeam,
    selectAllBeams,
    clearMatrixSelection,
    addBeam,
    duplicateSelectedBeams,
    deleteSelectedBeams,
    updateBeam,
    resetMatrix,
    addGroup,
    updateGroup,
    duplicateGroup,
    deleteGroup,
    selectFixture,
    clearFixtureSelection,
    addFixture,
    updateFixture,
    duplicateSelectedFixtures,
    deleteSelectedFixtures,
    rotateSelectedFixtures,
    mirrorSelectedFixtures,
    groupSelectedFixtures,
    ungroupSelectedFixtures,
    duplicateRig,
    mirrorRig,
    clearRig,
    resetRig,
    addRoute,
    updateRoute,
    deleteRoute,
    toggleRecording,
    setOutputAdapter,
    setRehearsalMode,
    armOutput,
    disarmOutput,
    triggerEmergencyBlackout,
    clearBlackout,
  }
}

export type LaserDmxMockState = ReturnType<typeof useLaserDmxMockState>
