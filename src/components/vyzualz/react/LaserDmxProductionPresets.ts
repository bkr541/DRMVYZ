import type {
  LaserDmxFixture,
  LaserDmxProfileId,
  LaserDmxSettings,
  ReactPalette,
  ReactPreset,
  ReactScene,
  ReactSectionMapping,
  ReactSectionType,
} from './ReactTypes'
import {
  DEFAULT_PRODUCTION_ATMOSPHERIC_FIXTURE_SETTINGS,
  DEFAULT_PRODUCTION_CHOREOGRAPHY,
  DEFAULT_PRODUCTION_FLASH_PATTERN,
  DEFAULT_PRODUCTION_GROUP_MOVEMENT,
  DEFAULT_PRODUCTION_LOOK_TRANSITION,
  DEFAULT_PRODUCTION_MOVING_HEAD_SETTINGS,
  DEFAULT_PRODUCTION_WASH_SETTINGS,
  createDefaultProductionStageModel,
  getLaserDmxFixtureProfile,
  type ProductionCompoundCue,
  type ProductionFixtureGroup,
  type ProductionFixtureKind,
  type ProductionGroupMovementConfig,
  type ProductionChoreographyProfileId,
  type ProductionLook,
  type ProductionPresetCompatibilityResult,
  type ProductionPresetMetadata,
} from './LaserDmxProductionRig'

const SECTION_TYPES: readonly ReactSectionType[] = ['intro', 'verse', 'build', 'drop', 'breakdown', 'outro']
const ALL_PERFORMANCE_ACTIONS = [
  'laserDmx.blackout',
  'laserDmx.reveal',
  'laserDmx.whiteHit',
  'laserDmx.blinderHit',
  'laserDmx.laserStarburst',
  'laserDmx.fanOpen',
  'laserDmx.fanClose',
  'laserDmx.movementVariation',
  'laserDmx.strobeBurst',
  'laserDmx.fogBurst',
  'laserDmx.cryoBurst',
  'laserDmx.nextLook',
  'laserDmx.previousLook',
] as const

interface ProductionPresetRecipe {
  id: string
  name: string
  description: string
  prefix: string
  palette: ReactPalette
  profileId: ProductionChoreographyProfileId
  complexity: ProductionPresetMetadata['complexity']
  styleTags: string[]
  referenceVideoIds: string[]
  camera: ProductionPresetMetadata['thumbnail']['framing']
  primaryMovement: ProductionGroupMovementConfig['generator']
  secondaryMovement: ProductionGroupMovementConfig['generator']
  baseColors: { primary: [number, number, number]; secondary: [number, number, number] }
  atmosphere: { haze: number; fog: boolean; cryo: boolean }
  enabledKinds: ProductionFixtureKind[]
}

function scenes(prefix: string): ReactScene[] {
  const params: Partial<Record<ReactSectionType, ReactPreset['params']>> = {
    intro: { intensity: 0.36, motion: 0.24, glow: 0.48, bassReactivity: 0.38 },
    verse: { intensity: 0.58, motion: 0.44, glow: 0.66, bassReactivity: 0.6 },
    build: { intensity: 0.78, motion: 0.72, glow: 0.84, bassReactivity: 0.82 },
    drop: { intensity: 1, motion: 0.92, glow: 1, bassReactivity: 0.98 },
    breakdown: { intensity: 0.42, motion: 0.28, glow: 0.6, bassReactivity: 0.42 },
    outro: { intensity: 0.24, motion: 0.16, glow: 0.36, bassReactivity: 0.26 },
  }
  return SECTION_TYPES.map(sectionType => ({
    id: `${prefix}-${sectionType}`,
    sectionType,
    engineId: 'laserDmx',
    params: params[sectionType] ?? {},
  }))
}

function mappings(prefix: string): ReactSectionMapping[] {
  return SECTION_TYPES.map(sectionType => ({ sectionType, sceneId: `${prefix}-${sectionType}` }))
}

function profileForKind(kind: ProductionFixtureKind): LaserDmxProfileId {
  const profiles: Record<ProductionFixtureKind, LaserDmxProfileId> = {
    laserProjector: 'genericRgbwLaser',
    movingHeadBeam: 'genericMovingHeadBeam',
    movingHeadSpot: 'genericMovingHeadSpot',
    movingHeadWash: 'genericMovingHeadWash',
    staticWash: 'genericStaticWash',
    strobe: 'genericRgbwStrobe',
    blinder: 'genericAudienceBlinder',
    ledBar: 'genericLedBar',
    hazer: 'genericHazer',
    fogger: 'genericFogger',
    cryoJet: 'genericCryoJet',
  }
  return profiles[kind]
}

function fixture(
  id: string,
  name: string,
  kind: ProductionFixtureKind,
  address: number,
  x: number,
  y: number,
  z: number,
  rgb: [number, number, number],
  enabledKinds: readonly ProductionFixtureKind[],
): LaserDmxFixture {
  const isMoving = kind === 'movingHeadBeam' || kind === 'movingHeadSpot' || kind === 'movingHeadWash'
  const isFlash = kind === 'strobe' || kind === 'blinder'
  const isWash = kind === 'movingHeadWash' || kind === 'staticWash'
  const isAtmosphere = kind === 'hazer' || kind === 'fogger' || kind === 'cryoJet'
  const isImpactWhite = isFlash || kind === 'cryoJet'
  return {
    schemaVersion: 4,
    fixtureKind: kind,
    id,
    name,
    enabled: enabledKinds.includes(kind),
    dmx: { universe: 1, startAddress: address, profileId: profileForKind(kind), channelMode: 'extended' },
    stageTransform: {
      position: { x, y, z },
      orientation: { yawDeg: 0, pitchDeg: isAtmosphere ? -90 : -22, rollDeg: 0, panDeg: 0, tiltDeg: isAtmosphere ? -90 : -22 },
    },
    targetId: isAtmosphere ? null : 'target:audience-center',
    position: {
      originX: Math.max(0.04, Math.min(0.96, 0.5 + x / 16)),
      originY: Math.max(0.08, Math.min(0.96, 0.18 + y / 9)),
      originZ: z / 10,
      targetX: 0.5,
      targetY: 0.42,
      targetZ: -0.4,
      pan: 0,
      tilt: isAtmosphere ? -90 : -22,
      rotation: 0,
      mirrorX: x > 0,
      mirrorY: false,
    },
    color: {
      mode: isImpactWhite ? 'fixed' : 'palette',
      red: rgb[0], green: rgb[1], blue: rgb[2], white: isImpactWhite ? 255 : 0,
      alpha: 1,
      paletteId: isImpactWhite ? '' : 'brand:active',
      colorCycleSpeed: isImpactWhite ? 0 : 0.35,
    },
    colorPolicy: {
      whiteAccentPolicy: isImpactWhite ? 'continuous' : 'impactOnly',
      whiteAccentIntensity: 1,
      preserveFixedColor: isImpactWhite,
    },
    beam: {
      dimmer: isAtmosphere ? 0 : 0.85,
      shutterOpen: !isAtmosphere,
      width: kind === 'movingHeadBeam' ? 0.55 : isWash ? 2.6 : 1,
      zoom: kind === 'movingHeadBeam' ? 0.2 : isWash ? 0.72 : 0.5,
      focus: kind === 'movingHeadBeam' ? 0.92 : 0.68,
      strobeRate: 0,
      flickerAmount: 0,
    },
    path: {
      kind: kind === 'laserProjector' ? 'fan' : 'staticBeam',
      scale: 1,
      rotation: 0,
      offsetX: 0,
      offsetY: 0,
      scanSpeed: kind === 'laserProjector' ? 0.58 : 0,
      phaseOffset: x > 0 ? 0.5 : 0,
      pointCount: kind === 'laserProjector' ? 24 : 2,
      spread: kind === 'laserProjector' ? 0.82 : 0.2,
      radius: 0.46,
      complexity: 0.55,
      smoothing: 0.18,
      pathProgress: 1,
    },
    movingHead: isMoving ? { ...DEFAULT_PRODUCTION_MOVING_HEAD_SETTINGS, panSpeedDegPerSec: 190, tiltSpeedDegPerSec: 150, prePositionWhileShuttered: true } : undefined,
    flashPattern: isFlash ? { ...DEFAULT_PRODUCTION_FLASH_PATTERN, enabled: false, pattern: 'singleHit', rateHz: kind === 'strobe' ? 12 : 4 } : undefined,
    wash: isWash ? { ...DEFAULT_PRODUCTION_WASH_SETTINGS, spread: 0.72, softness: 0.68, atmosphericIntensity: 0.74 } : undefined,
    atmospheric: isAtmosphere ? {
      ...DEFAULT_PRODUCTION_ATMOSPHERIC_FIXTURE_SETTINGS,
      armed: kind === 'hazer',
      outputLevel: kind === 'hazer' ? 0.46 : 0.9,
      outputDurationSec: kind === 'cryoJet' ? 0.65 : kind === 'fogger' ? 1.7 : 4,
      plumeVelocity: kind === 'cryoJet' ? 1 : 0.46,
      spread: kind === 'cryoJet' ? 0.18 : 0.5,
      density: kind === 'cryoJet' ? 0.96 : 0.68,
      cooldownSec: kind === 'cryoJet' ? 2.8 : 1.2,
      orientationMode: kind === 'hazer' ? 'fixtureOrientation' : 'vertical',
    } : undefined,
    modulationRoutes: kind === 'laserProjector'
      ? [
          { id: `${id}:beat`, enabled: true, source: 'beatPhase', target: 'pathProgress', amount: 1, min: 0.35, max: 1, curve: 'easeOut', mode: 'set', smoothing: 0.08, attack: 0, release: 0.1, invert: x > 0 },
          { id: `${id}:kick`, enabled: true, source: 'kick', target: 'fixtureDimmer', amount: 0.72, min: 0.34, max: 1, curve: 'pulse', mode: 'trigger', smoothing: 0.05, attack: 0.01, hold: 0.03, release: 0.22, invert: false },
        ]
      : [],
  }
}

function movement(generator: ProductionGroupMovementConfig['generator'], overrides: Partial<ProductionGroupMovementConfig> = {}): ProductionGroupMovementConfig {
  return {
    ...DEFAULT_PRODUCTION_GROUP_MOVEMENT,
    enabled: true,
    generator,
    speed: 0.64,
    amplitude: 0.76,
    panAmplitudeDeg: 46,
    tiltAmplitudeDeg: 34,
    spreadDeg: 64,
    symmetry: 'mirrorPairs',
    quantize: 'phrase',
    durationBeats: 16,
    prePositionWhileShuttered: true,
    ...overrides,
  }
}

function buildRig(recipe: ProductionPresetRecipe): Pick<LaserDmxSettings,
  'fixtures' | 'productionGroups' | 'productionTargets' | 'productionStage'
> {
  const { primary, secondary } = recipe.baseColors
  const fixtures: LaserDmxFixture[] = [
    fixture('laser:left-outer', 'Left Outer Laser', 'laserProjector', 1, -6, 6.1, 2.1, primary, recipe.enabledKinds),
    fixture('laser:left-inner', 'Left Inner Laser', 'laserProjector', 17, -2.2, 6.1, 2.3, secondary, recipe.enabledKinds),
    fixture('laser:right-inner', 'Right Inner Laser', 'laserProjector', 33, 2.2, 6.1, 2.3, primary, recipe.enabledKinds),
    fixture('laser:right-outer', 'Right Outer Laser', 'laserProjector', 49, 6, 6.1, 2.1, secondary, recipe.enabledKinds),
    fixture('beam:left-outer', 'Left Outer Beam', 'movingHeadBeam', 65, -5.4, 5.8, 4.8, primary, recipe.enabledKinds),
    fixture('beam:left-inner', 'Left Inner Beam', 'movingHeadBeam', 81, -1.8, 5.8, 5.1, secondary, recipe.enabledKinds),
    fixture('beam:right-inner', 'Right Inner Beam', 'movingHeadBeam', 97, 1.8, 5.8, 5.1, primary, recipe.enabledKinds),
    fixture('beam:right-outer', 'Right Outer Beam', 'movingHeadBeam', 113, 5.4, 5.8, 4.8, secondary, recipe.enabledKinds),
    fixture('wash:left', 'Left Moving Wash', 'movingHeadWash', 129, -4.4, 5.2, 6.4, primary, recipe.enabledKinds),
    fixture('wash:right', 'Right Moving Wash', 'movingHeadWash', 145, 4.4, 5.2, 6.4, secondary, recipe.enabledKinds),
    fixture('strobe:left', 'Left Strobe', 'strobe', 161, -3, 4.8, 1.1, [255, 255, 255], recipe.enabledKinds),
    fixture('strobe:right', 'Right Strobe', 'strobe', 177, 3, 4.8, 1.1, [255, 255, 255], recipe.enabledKinds),
    fixture('blinder:left', 'Left Audience Blinder', 'blinder', 193, -4.8, 3.8, 1, [255, 255, 255], recipe.enabledKinds),
    fixture('blinder:right', 'Right Audience Blinder', 'blinder', 209, 4.8, 3.8, 1, [255, 255, 255], recipe.enabledKinds),
    fixture('haze:center', 'Center Hazer', 'hazer', 225, 0, 0.4, 4.2, [255, 255, 255], recipe.enabledKinds),
    fixture('fog:center', 'Center Fog Emitter', 'fogger', 241, 0, 0.2, 2.3, [255, 255, 255], recipe.enabledKinds),
    fixture('cryo:left', 'Left Cryogenic Jet', 'cryoJet', 257, -2.2, 0.1, 1, [255, 255, 255], recipe.enabledKinds),
    fixture('cryo:right', 'Right Cryogenic Jet', 'cryoJet', 273, 2.2, 0.1, 1, [255, 255, 255], recipe.enabledKinds),
  ]
  const ids = (prefix: string) => fixtures.filter(item => item.id.startsWith(prefix)).map(item => item.id)
  const groups: ProductionFixtureGroup[] = [
    { id: 'group:lasers-left', name: 'Left Laser Bank', fixtureIds: ['laser:left-outer', 'laser:left-inner'], tags: ['laser', 'left'], movement: movement(recipe.primaryMovement) },
    { id: 'group:lasers-right', name: 'Right Laser Bank', fixtureIds: ['laser:right-inner', 'laser:right-outer'], tags: ['laser', 'right'], movement: movement(recipe.primaryMovement, { phaseOffset: 0.5, direction: 'reverse' }) },
    { id: 'group:lasers', name: 'All Lasers', fixtureIds: ids('laser:'), tags: ['laser', 'aerial'], movement: movement(recipe.primaryMovement) },
    { id: 'group:beams', name: 'Aerial Beams', fixtureIds: ids('beam:'), tags: ['moving-head', 'beam'], movement: movement(recipe.secondaryMovement, { speed: 0.48, amplitude: 0.82 }) },
    { id: 'group:washes', name: 'Color Washes', fixtureIds: ids('wash:'), tags: ['wash', 'color'], movement: movement('staticAerialHold', { amplitude: 0.22 }) },
    { id: 'group:strobes', name: 'Stage Strobes', fixtureIds: ids('strobe:'), tags: ['impact', 'white'] },
    { id: 'group:blinders', name: 'Audience Blinders', fixtureIds: ids('blinder:'), tags: ['impact', 'white'] },
    { id: 'group:impacts', name: 'White Impact Fixtures', fixtureIds: [...ids('strobe:'), ...ids('blinder:')], tags: ['impact', 'white'] },
    { id: 'group:fog', name: 'Localized Fog', fixtureIds: ids('fog:'), tags: ['atmosphere', 'fog'] },
    { id: 'group:cryo', name: 'Cryogenic Jets', fixtureIds: ids('cryo:'), tags: ['atmosphere', 'impact'] },
  ]
  const stage = createDefaultProductionStageModel()
  stage.dimensions = recipe.camera === 'clubLowCeiling'
    ? { width: 14, height: 6.5, depth: 9 }
    : { width: 18, height: 10, depth: 12 }
  stage.camera = recipe.camera === 'aerialCanopy'
    ? { ...stage.camera, position: { x: 0, y: 7.2, z: -17.5 }, target: { x: 0, y: 5.2, z: 4.8 }, fieldOfViewDeg: 58 }
    : recipe.camera === 'cathedralWide'
      ? { ...stage.camera, position: { x: 0, y: 4.8, z: -21 }, target: { x: 0, y: 4.4, z: 5.5 }, fieldOfViewDeg: 64 }
      : recipe.camera === 'festivalWide'
        ? { ...stage.camera, position: { x: 0, y: 5.2, z: -19 }, target: { x: 0, y: 4.1, z: 4.8 }, fieldOfViewDeg: 60 }
        : { ...stage.camera, position: { x: 0, y: 3.6, z: -14.2 }, target: { x: 0, y: 3.4, z: 4 }, fieldOfViewDeg: 68 }
  return {
    fixtures,
    productionGroups: groups,
    productionTargets: [
      { id: 'target:audience-center', name: 'Audience Center', kind: 'point', position: { x: 0, y: 2.3, z: -4.5 } },
      { id: 'target:ceiling-plane', name: 'Ceiling Plane', kind: 'zone', shape: 'plane', center: { x: 0, y: 6, z: 3.5 }, size: { x: 14, y: 0.1, z: 8 } },
      { id: 'target:stage-center', name: 'Stage Center', kind: 'point', position: { x: 0, y: 2.4, z: 4.6 } },
    ],
    productionStage: stage,
  }
}

function groupState(groupId: string, properties: ProductionLook['groupStates'][number]['properties'], move?: ProductionGroupMovementConfig): ProductionLook['groupStates'][number] {
  return { groupId, properties, ...(move ? { movement: move } : {}) }
}

function makeLook(
  id: string,
  name: string,
  description: string,
  groups: ProductionLook['groupStates'],
  global: ProductionLook['global'],
  transition: Partial<ProductionLook['transition']> = {},
  atmosphere?: ProductionLook['atmosphere'],
): ProductionLook {
  return {
    schemaVersion: 1,
    id,
    name,
    description,
    omissionMode: 'preserve',
    scope: { fixtureIds: [], fixtureKinds: [], groupIds: groups.map(group => group.groupId), includeGlobal: true, includeAtmosphere: Boolean(atmosphere), includeStage: false },
    fixtureStates: [],
    groupStates: groups,
    global,
    atmosphere,
    transition: { ...DEFAULT_PRODUCTION_LOOK_TRANSITION, ...transition },
    source: 'spatialPreset',
  }
}

function buildLooks(recipe: ProductionPresetRecipe): ProductionLook[] {
  const [pr, pg, pb] = recipe.baseColors.primary
  const [sr, sg, sb] = recipe.baseColors.secondary
  const primary = { red: pr, green: pg, blue: pb, white: 0 }
  const secondary = { red: sr, green: sg, blue: sb, white: 0 }
  return [
    makeLook(
      `${recipe.prefix}:look:hold`,
      'Atmospheric Hold',
      'A restrained opening state with persistent haze, low washes, and shuttered impact fixtures.',
      [
        groupState('group:lasers', { dimmer: 0.18, shutterOpen: true, color: primary }, movement('staticAerialHold', { amplitude: 0.18 })),
        groupState('group:beams', { dimmer: 0.22, shutterOpen: true, color: secondary }, movement('staticAerialHold', { amplitude: 0.12 })),
        groupState('group:washes', { dimmer: 0.34, shutterOpen: true, color: primary }),
        groupState('group:impacts', { dimmer: 0, shutterOpen: false }),
      ],
      { masterDimmer: 0.58, blackout: false, hazeAmount: recipe.atmosphere.haze, backgroundFade: 0.12, glowAmount: 0.68 },
      { durationMs: 900, mode: 'easedFade' },
      { settings: { persistentHaze: { enabled: true, baseDensity: recipe.atmosphere.haze, heightDistribution: 0.68, turbulence: 0.32, diffusion: 0.74, driftSpeed: 0.1, driftDirectionDeg: 18, ventilation: 0.16, beamScatter: 0.84 }, qualityTier: recipe.complexity === 'extreme' ? 'high' : 'medium', maxParticleBudget: recipe.complexity === 'extreme' ? 340 : 240, retainBaseHazeOnClear: true }, armedFixtureIds: ['haze:center'] },
    ),
    makeLook(
      `${recipe.prefix}:look:geometry`,
      'Primary Geometry',
      'Mirrored fans and crossing aerial geometry form the preset’s core visual identity.',
      [
        groupState('group:lasers-left', { dimmer: 0.92, shutterOpen: true, color: primary }, movement(recipe.primaryMovement, { direction: 'forward' })),
        groupState('group:lasers-right', { dimmer: 0.92, shutterOpen: true, color: secondary }, movement(recipe.primaryMovement, { direction: 'reverse', phaseOffset: 0.5 })),
        groupState('group:beams', { dimmer: 0.64, shutterOpen: true, color: secondary }, movement(recipe.secondaryMovement)),
        groupState('group:washes', { dimmer: 0.52, shutterOpen: true, color: primary }),
      ],
      { masterDimmer: 0.88, blackout: false, hazeAmount: recipe.atmosphere.haze, beamPersistence: 0.56, globalBeamWidth: 0.82 },
      { durationMs: 720, mode: 'shutteredPrePosition', blackoutHoldMs: 80 },
    ),
    makeLook(
      `${recipe.prefix}:look:handoff`,
      'Fixture-Family Handoff',
      'Lasers yield to moving beams and washes so the stage breathes instead of stacking every fixture continuously.',
      [
        groupState('group:lasers', { dimmer: 0.18, shutterOpen: false }),
        groupState('group:beams', { dimmer: 0.98, shutterOpen: true, color: primary }, movement(recipe.secondaryMovement, { speed: 0.76, amplitude: 0.94 })),
        groupState('group:washes', { dimmer: 0.76, shutterOpen: true, color: secondary }, movement('alternatingBanks', { speed: 0.46, symmetry: 'alternatingBanks' })),
        groupState('group:impacts', { dimmer: 0, shutterOpen: false }),
      ],
      { masterDimmer: 0.94, blackout: false, hazeAmount: Math.min(1, recipe.atmosphere.haze + 0.08), glowAmount: 0.86 },
      { durationMs: 520, mode: 'crossfade' },
    ),
    makeLook(
      `${recipe.prefix}:look:impact`,
      'Reserved White Impact',
      'A brief deep-white aerial formation with blinders, strobes, and optional atmospheric punctuation.',
      [
        groupState('group:lasers', { dimmer: 0.76, shutterOpen: true, color: { red: 255, green: 255, blue: 255, white: 255 } }, movement('centerOutSpread', { speed: 0.9, durationBeats: 4 })),
        groupState('group:beams', { dimmer: 1, shutterOpen: true, color: { red: 255, green: 255, blue: 255, white: 255 } }, movement('staticAerialHold', { spreadDeg: 78 })),
        groupState('group:impacts', { dimmer: 1, shutterOpen: true, strobeRate: 0.9, color: { red: 255, green: 255, blue: 255, white: 255 } }),
      ],
      { masterDimmer: 1, blackout: false, hazeAmount: 0.92, globalStrobeRate: 0.78, glowAmount: 1, backgroundFade: 0.03 },
      { durationMs: 90, mode: 'cut' },
      { armedFixtureIds: [
        ...(recipe.atmosphere.fog ? ['fog:center'] : []),
        ...(recipe.atmosphere.cryo ? ['cryo:left', 'cryo:right'] : []),
      ] },
    ),
  ]
}

function cue(
  id: string,
  label: string,
  timing: ProductionCompoundCue['timing'],
  actions: ProductionCompoundCue['actions'],
  groups: string[] = [],
  manualOnly = false,
): ProductionCompoundCue {
  return {
    schemaVersion: 1,
    id,
    label,
    enabled: true,
    timing,
    quantize: timing.mode === 'manual' ? 'beat' : timing.mode === 'sectionRelative' ? 'section' : 'bar',
    priority: manualOnly ? 90 : 40,
    retriggerPolicy: manualOnly ? 'restart' : 'oncePerPass',
    cancellationBehavior: 'complete',
    fixtureGroupIds: groups,
    manualOnly,
    actions,
    source: 'preset',
  }
}

function buildCues(recipe: ProductionPresetRecipe): ProductionCompoundCue[] {
  const section = (sectionType: 'intro' | 'verse' | 'build' | 'drop' | 'breakdown' | 'outro', offsetBars = 0): Extract<ProductionCompoundCue['timing'], { mode: 'sectionRelative' }> => ({
    mode: 'sectionRelative', sectionType, occurrence: 1, offsetBars, offsetBeats: 0, subdivision: 1, subdivisionIndex: 0, offsetSec: 0,
  })
  const sim = (id: string) => ({ id, execution: 'simultaneous' as const })
  return [
    cue(`${recipe.prefix}:cue:intro`, 'Atmospheric Opening', section('intro'), [{ ...sim('look'), type: 'activateLook', lookId: `${recipe.prefix}:look:hold` }]),
    cue(`${recipe.prefix}:cue:verse`, 'Geometry Reveal', section('verse'), [
      { ...sim('reveal'), type: 'reveal' },
      { ...sim('look'), type: 'fadeToLook', lookId: `${recipe.prefix}:look:geometry`, transitionMs: 720 },
      { ...sim('fan'), type: 'fanOpen', groupId: 'group:lasers', movement: { generator: recipe.primaryMovement } },
    ], ['group:lasers']),
    cue(`${recipe.prefix}:cue:build`, 'Build Handoff', section('build'), [
      { ...sim('look'), type: 'fadeToLook', lookId: `${recipe.prefix}:look:handoff`, transitionMs: 520 },
      { ...sim('move'), type: 'runMovementEffect', groupId: 'group:beams', movement: movement(recipe.secondaryMovement, { speed: 0.82, quantize: 'phrase' }) },
      { ...sim('strobe'), type: 'strobeBurst', groupId: 'group:strobes', pattern: 'rampUpBuildStrobe', rateHz: 10, intensity: 0.72 },
    ], ['group:beams', 'group:strobes']),
    cue(`${recipe.prefix}:cue:drop-blackout`, 'Drop Blackout', section('drop'), [{ ...sim('blackout'), type: 'blackout', durationMs: 120 }]),
    cue(`${recipe.prefix}:cue:drop-impact`, 'Drop Impact Reveal', { ...section('drop'), offsetBeats: 1 }, [
      { ...sim('look'), type: 'activateLook', lookId: `${recipe.prefix}:look:impact` },
      { ...sim('reveal'), type: 'reveal' },
      { ...sim('blinder'), type: 'blinderHit', groupId: 'group:blinders', intensity: 1 },
      { ...sim('strobe'), type: 'strobeBurst', groupId: 'group:strobes', pattern: 'tripleHit', rateHz: 14, intensity: 1 },
      ...(recipe.atmosphere.fog ? [{ ...sim('fog'), type: 'fogBurst' as const, groupId: 'group:fog', intensity: 0.9 }] : []),
      ...(recipe.atmosphere.cryo ? [{ ...sim('cryo'), type: 'cryoBurst' as const, groupId: 'group:cryo', intensity: 1 }] : []),
    ], ['group:impacts', 'group:fog', 'group:cryo']),
    cue(`${recipe.prefix}:cue:drop-geometry`, 'Drop Geometry Return', { ...section('drop'), offsetBars: 1 }, [
      { ...sim('look'), type: 'fadeToLook', lookId: `${recipe.prefix}:look:geometry`, transitionMs: 360 },
      { ...sim('fan'), type: 'fanOpen', groupId: 'group:lasers', movement: { generator: recipe.primaryMovement, speed: 0.9 } },
    ], ['group:lasers']),
    cue(`${recipe.prefix}:cue:breakdown`, 'Breakdown Reset', section('breakdown'), [
      { ...sim('look'), type: 'fadeToLook', lookId: `${recipe.prefix}:look:hold`, transitionMs: 1100 },
      { ...sim('fan'), type: 'fanClose', groupId: 'group:lasers', movement: { speed: 0.28 } },
    ], ['group:lasers']),
    cue(`${recipe.prefix}:cue:manual-impact`, 'Manual White Impact', { mode: 'manual' }, [
      { ...sim('white'), type: 'pulse', groupId: 'group:impacts', intensity: 1 },
      { ...sim('blinder'), type: 'blinderHit', groupId: 'group:blinders', intensity: 1 },
    ], ['group:impacts'], true),
  ]
}

function metadata(recipe: ProductionPresetRecipe): ProductionPresetMetadata {
  const requirements: ProductionPresetMetadata['rigRequirements'] = [
    { fixtureKind: 'laserProjector', minimumCount: 2, fallbackKinds: ['movingHeadBeam'] },
    { fixtureKind: 'movingHeadBeam', minimumCount: 2, fallbackKinds: ['movingHeadSpot', 'laserProjector'] },
    { fixtureKind: 'movingHeadWash', minimumCount: 2, optional: true, fallbackKinds: ['staticWash'] },
    { fixtureKind: 'strobe', minimumCount: 1, optional: true },
    { fixtureKind: 'blinder', minimumCount: 1, optional: true, fallbackKinds: ['strobe'] },
    { fixtureKind: 'hazer', minimumCount: 1, optional: true },
    ...(recipe.atmosphere.fog ? [{ fixtureKind: 'fogger' as const, minimumCount: 1, optional: true }] : []),
    ...(recipe.atmosphere.cryo ? [{ fixtureKind: 'cryoJet' as const, minimumCount: 2, optional: true }] : []),
  ]
  return {
    schemaVersion: 1,
    fixtureFamilyBadges: requirements.map(requirement => requirement.fixtureKind),
    complexity: recipe.complexity,
    styleTags: recipe.styleTags,
    requiredCapabilities: [
      { id: 'aerial-geometry', label: 'Aerial beam geometry', fixtureKinds: ['laserProjector', 'movingHeadBeam'] },
      { id: 'phrase-movement', label: 'Phrase-quantized movement', fixtureKinds: ['movingHeadBeam', 'movingHeadSpot', 'laserProjector'] },
      { id: 'white-impact', label: 'Reserved white impact', fixtureKinds: ['strobe', 'blinder'], optional: true },
      { id: 'persistent-haze', label: 'Persistent haze', fixtureKinds: ['hazer'], optional: true },
    ],
    rigRequirements: requirements,
    palettePolicy: 'brandKitAdaptable',
    reserveWhiteForImpacts: true,
    thumbnail: { framing: recipe.camera, activeLookId: `${recipe.prefix}:look:geometry` },
    performanceActionIds: [...ALL_PERFORMANCE_ACTIONS],
    referenceVideoIds: recipe.referenceVideoIds,
  }
}

function buildPreset(recipe: ProductionPresetRecipe): ReactPreset {
  const rig = buildRig(recipe)
  const looks = buildLooks(recipe)
  const settings: LaserDmxSettings = {
    schemaVersion: 7,
    rigId: `${recipe.prefix}:rig`,
    rigName: recipe.name,
    selectedFixtureId: rig.fixtures.find(item => item.enabled)?.id ?? null,
    masterDimmer: 0.9,
    blackout: false,
    hazeAmount: recipe.atmosphere.haze,
    beamPersistence: 0.58,
    glowAmount: 0.86,
    globalBeamWidth: 0.9,
    globalStrobeRate: 0,
    safetyClamp: 0.92,
    backgroundFade: 0.1,
    showFixtureOrigins: false,
    showPathPoints: false,
    showDmxDebug: false,
    visualComfort: { disableStrobe: false, maxFlashHz: 12, warningThresholdHz: 7, maxContinuousFlashSec: 3 },
    atmosphere: {
      persistentHaze: { enabled: true, baseDensity: recipe.atmosphere.haze, heightDistribution: 0.68, turbulence: 0.34, diffusion: 0.76, driftSpeed: 0.11, driftDirectionDeg: 18, ventilation: 0.14, beamScatter: 0.86 },
      qualityTier: recipe.complexity === 'extreme' ? 'high' : 'medium',
      maxParticleBudget: recipe.complexity === 'extreme' ? 340 : recipe.complexity === 'high' ? 280 : 220,
      retainBaseHazeOnClear: true,
    },
    ...rig,
    productionLooks: looks,
    activeProductionLookId: `${recipe.prefix}:look:geometry`,
    productionLookTransitionDefaults: { ...DEFAULT_PRODUCTION_LOOK_TRANSITION, durationMs: 640, mode: 'shutteredPrePosition' },
    productionCues: buildCues(recipe),
    choreography: {
      ...DEFAULT_PRODUCTION_CHOREOGRAPHY,
      profileId: recipe.profileId,
      intensity: 0.82,
      automaticLookChanges: true,
      automaticMovementChanges: true,
      impactSensitivity: 0.72,
      blackoutFrequency: 0.34,
      whiteImpactIntensity: 1,
      allowStrobe: true,
      allowAtmospherics: recipe.atmosphere.fog || recipe.atmosphere.cryo,
      manualOverridePrecedence: 'manualFirst',
      manualOverrideHoldMs: 1800,
      variationMode: 'controlled',
      variationAmount: 0.32,
      seed: recipe.name.length * 97,
    },
  }
  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    engine: 'laserDmx',
    palette: recipe.palette,
    params: { intensity: 0.94, motion: 0.82, glow: 0.92, bassReactivity: 0.9 },
    renderSettings: { trailDecay: 0.09, fogDensity: recipe.atmosphere.haze, particleDensity: recipe.complexity === 'extreme' ? 0.92 : 0.7 },
    scenes: scenes(recipe.prefix),
    sectionMappings: mappings(recipe.prefix),
    laserDmxSettings: settings,
    productionPreset: metadata(recipe),
  }
}

const RECIPES: readonly ProductionPresetRecipe[] = [
  {
    id: 'preset-red-club-crossfire', name: 'Red Club Crossfire', prefix: 'rcc',
    description: 'Low-ceiling crimson laser banks cross through scanner sweeps, punctuated by blackouts and compact white hits.',
    palette: { primary: '#ff1838', secondary: '#8f001e', accent: '#ff5068', background: '#050102', highlight: '#ffffff', text: '#ffffff' },
    profileId: 'techno', complexity: 'medium', styleTags: ['club', 'techno', 'crossfire', 'scanner'], referenceVideoIds: ['IMG_0600.mp4'], camera: 'clubLowCeiling',
    primaryMovement: 'crossfire', secondaryMovement: 'crowdScan', baseColors: { primary: [255, 18, 45], secondary: [170, 0, 28] }, atmosphere: { haze: 0.68, fog: false, cryo: false },
    enabledKinds: ['laserProjector', 'movingHeadBeam', 'movingHeadWash', 'strobe', 'blinder', 'hazer'],
  },
  {
    id: 'preset-rgb-plane-shift', name: 'RGB Plane Shift', prefix: 'rps',
    description: 'Primary-color planes trade across mirrored laser banks and moving heads with clean phrase-scale handoffs.',
    palette: { primary: '#ff2851', secondary: '#28e06f', accent: '#2f7bff', background: '#020407', highlight: '#ffffff', text: '#ffffff' },
    profileId: 'openFormat', complexity: 'high', styleTags: ['rgb', 'open-format', 'plane-shift', 'handoff'], referenceVideoIds: ['IMG_2246.mp4', 'IMG_8320.mp4'], camera: 'festivalWide',
    primaryMovement: 'alternatingBanks', secondaryMovement: 'panWave', baseColors: { primary: [255, 28, 64], secondary: [35, 110, 255] }, atmosphere: { haze: 0.62, fog: false, cryo: false },
    enabledKinds: ['laserProjector', 'movingHeadBeam', 'movingHeadWash', 'strobe', 'blinder', 'hazer'],
  },
  {
    id: 'preset-ceiling-lattice-overload', name: 'Ceiling Lattice Overload', prefix: 'clo',
    description: 'Dense overhead laser canopies crosshatch the venue ceiling while deep beams travel beneath the grid.',
    palette: { primary: '#2ef2ff', secondary: '#7d3cff', accent: '#ff3fb9', background: '#010205', highlight: '#ffffff', text: '#ffffff' },
    profileId: 'heavyDubstep', complexity: 'extreme', styleTags: ['festival', 'ceiling-canopy', 'crosshatch', 'dubstep'], referenceVideoIds: ['IMG_2257.mp4', 'IMG_3947.mp4'], camera: 'aerialCanopy',
    primaryMovement: 'ceilingCanopy', secondaryMovement: 'tunnel', baseColors: { primary: [32, 232, 255], secondary: [126, 45, 255] }, atmosphere: { haze: 0.82, fog: true, cryo: false },
    enabledKinds: ['laserProjector', 'movingHeadBeam', 'movingHeadWash', 'strobe', 'blinder', 'hazer', 'fogger'],
  },
  {
    id: 'preset-magenta-cyan-festival-fan', name: 'Magenta Cyan Festival Fan', prefix: 'mcf',
    description: 'Wide mirrored fans alternate cyan and magenta groups, opening at phrase boundaries and folding inward for breaks.',
    palette: { primary: '#ff2fbd', secondary: '#16e7ff', accent: '#9d55ff', background: '#020108', highlight: '#ffffff', text: '#ffffff' },
    profileId: 'melodicBass', complexity: 'high', styleTags: ['melodic-bass', 'festival', 'fan', 'cyan-magenta'], referenceVideoIds: ['IMG_8320.mp4', 'IMG_3317.mp4'], camera: 'festivalWide',
    primaryMovement: 'mirroredFan', secondaryMovement: 'centerOutSpread', baseColors: { primary: [255, 28, 184], secondary: [12, 224, 255] }, atmosphere: { haze: 0.72, fog: false, cryo: false },
    enabledKinds: ['laserProjector', 'movingHeadBeam', 'movingHeadWash', 'strobe', 'blinder', 'hazer'],
  },
  {
    id: 'preset-blinder-cryo-drop', name: 'Blinder and Cryo Drop', prefix: 'bcd',
    description: 'A blackout-led drop weapon with reserved white blinders, triple strobe hits, and short paired cryogenic-style plumes.',
    palette: { primary: '#ff2b75', secondary: '#5d3bff', accent: '#26e6ff', background: '#020104', highlight: '#ffffff', text: '#ffffff' },
    profileId: 'hybridTrap', complexity: 'high', styleTags: ['drop', 'hybrid-trap', 'blinder', 'cryo'], referenceVideoIds: ['IMG_8957.mp4', 'IMG_3317.mp4'], camera: 'festivalWide',
    primaryMovement: 'fanOpen', secondaryMovement: 'outsideInCollapse', baseColors: { primary: [255, 30, 105], secondary: [82, 54, 255] }, atmosphere: { haze: 0.7, fog: false, cryo: true },
    enabledKinds: ['laserProjector', 'movingHeadBeam', 'movingHeadWash', 'strobe', 'blinder', 'hazer', 'cryoJet'],
  },
  {
    id: 'preset-white-fog-cathedral', name: 'White Fog Cathedral', prefix: 'wfc',
    description: 'Deep white aerial-beam columns emerge through persistent haze and localized fog, opening into a cathedral-scale formation.',
    palette: { primary: '#f4fbff', secondary: '#a8d9ff', accent: '#d7c8ff', background: '#010205', highlight: '#ffffff', text: '#ffffff' },
    profileId: 'melodicBass', complexity: 'extreme', styleTags: ['cinematic', 'white-aerials', 'fog', 'cathedral'], referenceVideoIds: ['IMG_2246.mp4', 'IMG_8957.mp4'], camera: 'cathedralWide',
    primaryMovement: 'staticAerialHold', secondaryMovement: 'centerOutSpread', baseColors: { primary: [238, 250, 255], secondary: [190, 224, 255] }, atmosphere: { haze: 0.9, fog: true, cryo: false },
    enabledKinds: ['laserProjector', 'movingHeadBeam', 'movingHeadWash', 'strobe', 'blinder', 'hazer', 'fogger'],
  },
]

export const LASER_DMX_PRODUCTION_PRESETS: readonly ReactPreset[] = RECIPES.map(buildPreset)

export function analyzeProductionPresetCompatibility(
  preset: Pick<ReactPreset, 'productionPreset'>,
  currentSettings: Pick<LaserDmxSettings, 'fixtures'>,
): ProductionPresetCompatibilityResult {
  const metadata = preset.productionPreset
  const counts: Partial<Record<ProductionFixtureKind, number>> = {}
  for (const item of currentSettings.fixtures.filter(candidate => candidate.enabled)) {
    const kind = item.fixtureKind ?? getLaserDmxFixtureProfile(item.dmx.profileId)?.fixtureKind
    if (!kind) continue
    counts[kind] = (counts[kind] ?? 0) + 1
  }
  if (!metadata) return { mode: 'full', availableFixtureCounts: counts, missingRequiredKinds: [], adaptedKinds: {}, diagnostics: [] }

  const missingRequiredKinds: ProductionFixtureKind[] = []
  const adaptedKinds: Partial<Record<ProductionFixtureKind, ProductionFixtureKind>> = {}
  const diagnostics: ProductionPresetCompatibilityResult['diagnostics'] = []
  let playableFamilies = 0

  for (const requirement of metadata.rigRequirements) {
    const count = counts[requirement.fixtureKind] ?? 0
    if (count >= requirement.minimumCount) {
      playableFamilies += 1
      continue
    }
    const fallback = requirement.fallbackKinds?.find(kind => (counts[kind] ?? 0) >= requirement.minimumCount)
    if (fallback) {
      adaptedKinds[requirement.fixtureKind] = fallback
      playableFamilies += 1
      diagnostics.push({ code: 'fallbackFixtureFamily', severity: 'info', fixtureKind: requirement.fixtureKind, fallbackKind: fallback, message: `${requirement.fixtureKind} adapts safely to ${fallback}.` })
      continue
    }
    if (!requirement.optional) missingRequiredKinds.push(requirement.fixtureKind)
    diagnostics.push({
      code: 'missingFixtureFamily',
      severity: requirement.optional ? 'warning' : 'error',
      fixtureKind: requirement.fixtureKind,
      message: `${requirement.fixtureKind} requires ${requirement.minimumCount}; the current rig has ${count}. ${requirement.optional ? 'That layer will be skipped.' : 'Playback will continue with the remaining compatible layers.'}`,
    })
  }

  for (const capability of metadata.requiredCapabilities) {
    const available = capability.fixtureKinds.some(kind => (counts[kind] ?? 0) > 0)
    if (!available) diagnostics.push({ code: 'missingCapability', severity: capability.optional ? 'warning' : 'error', message: `${capability.label} is unavailable on the current rig.` })
  }

  if (playableFamilies === 0) {
    diagnostics.push({ code: 'noPlayableFixtures', severity: 'error', message: 'No compatible production fixture families are available. The preset remains previewable with its included virtual rig.' })
    return { mode: 'unavailable', availableFixtureCounts: counts, missingRequiredKinds, adaptedKinds, diagnostics }
  }
  const hasFallback = Object.keys(adaptedKinds).length > 0
  const hasMissing = diagnostics.some(item => item.code === 'missingFixtureFamily')
  return {
    mode: missingRequiredKinds.length > 0 || hasMissing ? 'partial' : hasFallback ? 'adapted' : 'full',
    availableFixtureCounts: counts,
    missingRequiredKinds,
    adaptedKinds,
    diagnostics,
  }
}


export interface AdaptedProductionPresetResult {
  settings: LaserDmxSettings
  compatibility: ProductionPresetCompatibilityResult
}

function resolvedKind(fixture: LaserDmxFixture): ProductionFixtureKind | null {
  return fixture.fixtureKind ?? getLaserDmxFixtureProfile(fixture.dmx.profileId)?.fixtureKind ?? null
}

function actionTargetsAvailable(
  action: ProductionCompoundCue['actions'][number],
  groupIds: ReadonlySet<string>,
  fixtureIds: ReadonlySet<string>,
): boolean {
  if ('groupId' in action && action.groupId && !groupIds.has(action.groupId)) return false
  if ('fixtureId' in action && action.fixtureId && !fixtureIds.has(action.fixtureId)) return false
  return true
}

/**
 * Applies a curated preset's looks and choreography to an already patched rig.
 * Existing fixture identities, addresses, transforms, targets, and stage geometry
 * remain authoritative. Empty or unsupported layers are removed with explicit
 * diagnostics instead of fabricating unrelated fixture controls.
 */
export function adaptProductionPresetToRig(
  preset: Pick<ReactPreset, 'productionPreset' | 'laserDmxSettings'>,
  currentSettings: LaserDmxSettings,
): AdaptedProductionPresetResult {
  const compatibility = analyzeProductionPresetCompatibility(preset, currentSettings)
  const authored = preset.laserDmxSettings
  if (!authored || !preset.productionPreset) return { settings: currentSettings, compatibility }

  const currentByKind = new Map<ProductionFixtureKind, string[]>()
  for (const item of currentSettings.fixtures.filter(fixtureItem => fixtureItem.enabled)) {
    const kind = resolvedKind(item)
    if (!kind) continue
    currentByKind.set(kind, [...(currentByKind.get(kind) ?? []), item.id])
  }

  const sourceFixtures = authored.fixtures ?? []
  const sourceKindById = new Map(sourceFixtures.map(item => [item.id, resolvedKind(item)]))
  const sourceGroups = authored.productionGroups ?? []
  const adaptedGroups = sourceGroups.map(group => {
    const sourceKinds = [...new Set(group.fixtureIds.map(id => sourceKindById.get(id)).filter((kind): kind is ProductionFixtureKind => Boolean(kind)))]
    const mapped = sourceKinds.flatMap(kind => {
      const exact = currentByKind.get(kind)
      if (exact?.length) return exact
      const fallback = compatibility.adaptedKinds[kind]
      return fallback ? currentByKind.get(fallback) ?? [] : []
    })
    return { ...group, fixtureIds: [...new Set(mapped)] }
  }).filter(group => group.fixtureIds.length > 0)

  const groupIds = new Set(adaptedGroups.map(group => group.id))
  const fixtureIds = new Set(currentSettings.fixtures.map(item => item.id))
  const adaptedLooks = (authored.productionLooks ?? []).map(look => ({
    ...look,
    scope: {
      ...look.scope,
      fixtureIds: look.scope.fixtureIds.filter(id => fixtureIds.has(id)),
      groupIds: look.scope.groupIds.filter(id => groupIds.has(id)),
      fixtureKinds: look.scope.fixtureKinds.filter(kind => (currentByKind.get(kind)?.length ?? 0) > 0 || Boolean(compatibility.adaptedKinds[kind])),
    },
    fixtureStates: look.fixtureStates.filter(state => fixtureIds.has(state.fixtureId)),
    groupStates: look.groupStates.filter(state => groupIds.has(state.groupId)),
    atmosphere: look.atmosphere ? {
      ...look.atmosphere,
      armedFixtureIds: look.atmosphere.armedFixtureIds?.filter(id => fixtureIds.has(id)),
    } : undefined,
  }))
  const lookIds = new Set(adaptedLooks.map(look => look.id))
  const adaptedCues = (authored.productionCues ?? []).map(cueItem => ({
    ...cueItem,
    fixtureGroupIds: cueItem.fixtureGroupIds.filter(id => groupIds.has(id)),
    actions: cueItem.actions.filter(action => {
      if ((action.type === 'activateLook' || action.type === 'fadeToLook') && !lookIds.has(action.lookId)) return false
      return actionTargetsAvailable(action, groupIds, fixtureIds)
    }),
  })).filter(cueItem => cueItem.actions.length > 0)

  const diagnosticMessages = compatibility.diagnostics.map(item => item.message)
  const settings: LaserDmxSettings = {
    ...currentSettings,
    masterDimmer: authored.masterDimmer ?? currentSettings.masterDimmer,
    blackout: false,
    hazeAmount: authored.hazeAmount ?? currentSettings.hazeAmount,
    beamPersistence: authored.beamPersistence ?? currentSettings.beamPersistence,
    glowAmount: authored.glowAmount ?? currentSettings.glowAmount,
    globalBeamWidth: authored.globalBeamWidth ?? currentSettings.globalBeamWidth,
    globalStrobeRate: authored.globalStrobeRate ?? currentSettings.globalStrobeRate,
    safetyClamp: Math.min(currentSettings.safetyClamp, authored.safetyClamp ?? currentSettings.safetyClamp),
    backgroundFade: authored.backgroundFade ?? currentSettings.backgroundFade,
    visualComfort: authored.visualComfort ?? currentSettings.visualComfort,
    atmosphere: authored.atmosphere ?? currentSettings.atmosphere,
    productionGroups: adaptedGroups,
    productionLooks: adaptedLooks,
    activeProductionLookId: lookIds.has(authored.activeProductionLookId ?? '')
      ? authored.activeProductionLookId
      : adaptedLooks[0]?.id ?? null,
    productionLookTransitionDefaults: authored.productionLookTransitionDefaults ?? currentSettings.productionLookTransitionDefaults,
    productionCues: adaptedCues,
    choreography: authored.choreography ? {
      ...authored.choreography,
      fixtureFamilyParticipation: Object.fromEntries(
        Object.entries(authored.choreography.fixtureFamilyParticipation).map(([kind, enabled]) => [
          kind,
          Boolean(enabled && ((currentByKind.get(kind as ProductionFixtureKind)?.length ?? 0) > 0)),
        ]),
      ) as LaserDmxSettings['choreography'] extends { fixtureFamilyParticipation: infer T } ? T : never,
    } : currentSettings.choreography,
    runtime: {
      ...(currentSettings.runtime ?? {}),
      productionPresetCompatibility: compatibility,
      productionPresetDiagnostics: diagnosticMessages,
    },
  }
  return { settings, compatibility }
}

export function shouldPreserveCurrentProductionRig(settings: LaserDmxSettings): boolean {
  const enabled = settings.fixtures.filter(item => item.enabled)
  return enabled.length > 3 || enabled.some(item => {
    const kind = resolvedKind(item)
    return kind != null && kind !== 'laserProjector'
  })
}

export function getProductionPresetById(id: string): ReactPreset | null {
  return LASER_DMX_PRODUCTION_PRESETS.find(preset => preset.id === id) ?? null
}
