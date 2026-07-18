import type { LaserDmxShowDirectorFixtureKind } from './ReactTypes'
import type {
  LaserCueDuration,
  LaserEffectAutomation,
  LaserEffectFamily,
  LaserEffectOpticsSettings,
  LaserEffectScanSettings,
  LaserEffectTransform,
  LaserEffectTransition,
  LaserGroupRelationshipMode,
  LaserPatternDefinition,
} from './LaserDmxShowDirectorProgramming'

export type LaserDmxProfessionalEffectId =
  | 'narrow-stepped-fan' | 'wide-stepped-fan' | 'smooth-opening-fan' | 'smooth-closing-fan'
  | 'mirrored-fans' | 'opposed-fans' | 'crossing-fans' | 'parallel-sheet'
  | 'center-out-fan' | 'outside-in-fan' | 'aerial-rake' | 'upper-canopy'
  | 'tunnel' | 'corridor' | 'circle-scan' | 'arc-scan' | 'triangle-outline'
  | 'diamond-outline' | 'polygon-outline' | 'progressive-wave' | 'grid-scan'
  | 'line-diffraction-accent' | 'grid-diffraction-accent' | 'burst-diffraction-accent'
  | 'held-tension-beam' | 'alternating-bank-fan' | 'call-and-response-fan'
  | 'front-fan-position' | 'cross-position' | 'center-convergence' | 'wide-drop-position'
  | 'slow-pan-sweep' | 'slow-tilt-sweep' | 'gobo-breakup-look' | 'prism-expansion'
  | 'narrow-beam-build' | 'frosted-breakdown'
  | 'section-color-bed' | 'build-lift' | 'drop-saturation' | 'breakdown-wash' | 'outro-fade'
  | 'snare-flash' | 'four-beat-strobe-burst' | 'drop-impact' | 'phrase-blinder' | 'transition-flash'
  | 'center-out-chase' | 'outside-in-chase' | 'alternating-blocks' | 'symmetrical-fill'
  | 'palette-gradient' | 'beat-step' | 'phrase-sweep'
  | 'baseline-haze' | 'build-haze-rise' | 'drop-haze-hold' | 'breakdown-haze-reduction'
  | 'co2-drop-impact' | 'co2-phrase-accent'

export interface LaserDmxProfessionalEffectDefinition {
  id: LaserDmxProfessionalEffectId
  name: string
  family: LaserEffectFamily
  fixtureKinds: LaserDmxShowDirectorFixtureKind[]
  duration: LaserCueDuration
  pattern: Omit<LaserPatternDefinition, 'topologyId'>
  transform: LaserEffectTransform
  scan: LaserEffectScanSettings
  optics: LaserEffectOpticsSettings
  automation: LaserEffectAutomation[]
  relationshipMode?: LaserGroupRelationshipMode
  transitionIn: LaserEffectTransition
  transitionOut: LaserEffectTransition
  intensityFloor: number
  intensityCeiling: number
  qualityPriority: 'hero' | 'primary' | 'support' | 'texture' | 'impact'
}

const cut: LaserEffectTransition = {
  type: 'cut', durationBeats: 0, blankDisconnectedTravel: true, shutterDuringSwap: false,
}
const crossfade: LaserEffectTransition = {
  type: 'crossfade', durationBeats: 0.5, blankDisconnectedTravel: true, shutterDuringSwap: false,
}
const shutter: LaserEffectTransition = {
  type: 'shutterOutIn', durationBeats: 0.25, blankDisconnectedTravel: true, shutterDuringSwap: true,
}
const baseTransform: LaserEffectTransform = {
  centerX: 0.5, centerY: 0.46, depth: 0, width: 0.9, height: 0.64, radius: 0.28, rotationDeg: 0,
}
const baseScan: LaserEffectScanSettings = {
  scanRatePps: 24_000, direction: 'forward', phase: 0, pointDwellMicros: 22,
  cornerDwellMicros: 58, retraceBlanking: true, blankingDelayMicros: 18,
}
const normalOptics: LaserEffectOpticsSettings = { mode: 'normal', copyCount: 1, spreadDeg: 0 }

function effect(
  id: LaserDmxProfessionalEffectId,
  name: string,
  family: LaserEffectFamily,
  fixtureKinds: LaserDmxShowDirectorFixtureKind[],
  patternType: LaserPatternDefinition['scannerPatternType'],
  raySlotCount: number,
  overrides: Partial<LaserDmxProfessionalEffectDefinition> = {},
): LaserDmxProfessionalEffectDefinition {
  return {
    id,
    name,
    family,
    fixtureKinds,
    duration: { kind: 'fourBars' },
    pattern: {
      scannerPatternType: patternType,
      raySlotCount,
      traversal: patternType.startsWith('diffraction') ? 'simultaneousOpticalCopies' : 'sequential',
      spacing: 'equal',
      closed: patternType === 'circle' || patternType === 'triangle' || patternType === 'polygon',
    },
    transform: { ...baseTransform },
    scan: { ...baseScan },
    optics: { ...normalOptics },
    automation: [],
    transitionIn: { ...crossfade },
    transitionOut: { ...crossfade },
    intensityFloor: 0.12,
    intensityCeiling: 0.9,
    qualityPriority: fixtureKinds.includes('laser') ? 'primary' : 'support',
    ...overrides,
  }
}

const laser = ['laser'] as LaserDmxShowDirectorFixtureKind[]
const movingHead = ['movingHead'] as LaserDmxShowDirectorFixtureKind[]
const wash = ['parWash'] as LaserDmxShowDirectorFixtureKind[]
const led = ['ledBar', 'ledTube'] as LaserDmxShowDirectorFixtureKind[]
const haze = ['haze'] as LaserDmxShowDirectorFixtureKind[]

const entries: LaserDmxProfessionalEffectDefinition[] = [
  effect('narrow-stepped-fan', 'Narrow Stepped Fan', 'steppedFan', laser, 'fanSweep', 8, { transform: { ...baseTransform, width: 0.48 }, relationshipMode: 'parallel', qualityPriority: 'hero' }),
  effect('wide-stepped-fan', 'Wide Stepped Fan', 'steppedFan', laser, 'fanSweep', 12, { transform: { ...baseTransform, width: 1.32 }, relationshipMode: 'parallel', qualityPriority: 'hero' }),
  effect('smooth-opening-fan', 'Smooth Opening Fan', 'smoothFanSweep', laser, 'fanSweep', 12, { relationshipMode: 'symmetricalPair', automation: [{ id: 'fan-open', parameter: 'fanSpread', from: 18, to: 118, startProgress: 0, endProgress: 1, curve: 'easeInOut' }], qualityPriority: 'hero' }),
  effect('smooth-closing-fan', 'Smooth Closing Fan', 'smoothFanSweep', laser, 'fanSweep', 12, { relationshipMode: 'symmetricalPair', automation: [{ id: 'fan-close', parameter: 'fanSpread', from: 118, to: 16, startProgress: 0, endProgress: 1, curve: 'easeInOut' }], qualityPriority: 'hero' }),
  effect('mirrored-fans', 'Mirrored Fans', 'mirroredFan', laser, 'fanSweep', 8, { relationshipMode: 'mirrored', qualityPriority: 'hero' }),
  effect('opposed-fans', 'Opposed Fans', 'opposedFans', laser, 'fanSweep', 8, { relationshipMode: 'opposed', qualityPriority: 'hero' }),
  effect('crossing-fans', 'Crossing Fans', 'crossingFans', laser, 'fanSweep', 8, { relationshipMode: 'alternating', transform: { ...baseTransform, rotationDeg: 18 }, qualityPriority: 'hero' }),
  effect('parallel-sheet', 'Parallel Sheet', 'parallelSheet', laser, 'lineSweep', 10, { relationshipMode: 'parallel', transform: { ...baseTransform, height: 0.16 }, qualityPriority: 'hero' }),
  effect('center-out-fan', 'Center-Out Fan', 'centerOutFan', laser, 'fanSweep', 10, { relationshipMode: 'centerOut', automation: [{ id: 'center-out', parameter: 'fanSpread', from: 10, to: 104, startProgress: 0, endProgress: 1, curve: 'easeOut' }] }),
  effect('outside-in-fan', 'Outside-In Fan', 'outsideInFan', laser, 'fanSweep', 10, { relationshipMode: 'outsideIn', automation: [{ id: 'outside-in', parameter: 'fanSpread', from: 112, to: 14, startProgress: 0, endProgress: 1, curve: 'easeIn' }] }),
  effect('aerial-rake', 'Aerial Rake', 'frontAirRake', laser, 'lineSweep', 8, { relationshipMode: 'phaseOffset', transform: { ...baseTransform, centerY: 0.35, height: 0.48, rotationDeg: -8 } }),
  effect('upper-canopy', 'Upper Canopy', 'upperAirCanopy', laser, 'arc', 12, { relationshipMode: 'mirrored', transform: { ...baseTransform, centerY: 0.27, radius: 0.42, height: 0.34 } }),
  effect('tunnel', 'Tunnel', 'tunnel', laser, 'tunnel', 12, { relationshipMode: 'frontRearDepthPlanes', transform: { ...baseTransform, depth: 0.28, radius: 0.34 }, duration: { kind: 'eightBars' }, qualityPriority: 'hero' }),
  effect('corridor', 'Corridor', 'corridor', laser, 'mirroredCorridor', 12, { relationshipMode: 'frontRearDepthPlanes', transform: { ...baseTransform, depth: 0.35, width: 1.1 }, duration: { kind: 'eightBars' }, qualityPriority: 'hero' }),
  effect('circle-scan', 'Circle Scan', 'sequentialCircle', laser, 'circle', 16, { relationshipMode: 'phaseOffset', transform: { ...baseTransform, radius: 0.3 }, scan: { ...baseScan, scanRatePps: 28_000 }, duration: { kind: 'twoBars' } }),
  effect('arc-scan', 'Arc Scan', 'arcSweep', laser, 'arc', 14, { relationshipMode: 'mirrored', transform: { ...baseTransform, radius: 0.4 }, duration: { kind: 'twoBars' } }),
  effect('triangle-outline', 'Triangle Outline', 'polygonOutline', laser, 'triangle', 3, { relationshipMode: 'symmetricalPair', duration: { kind: 'twoBars' } }),
  effect('diamond-outline', 'Diamond Outline', 'polygonOutline', laser, 'polygon', 4, { relationshipMode: 'symmetricalPair', transform: { ...baseTransform, rotationDeg: 45 }, duration: { kind: 'twoBars' } }),
  effect('polygon-outline', 'Polygon Outline', 'polygonOutline', laser, 'polygon', 6, { relationshipMode: 'phaseOffset', duration: { kind: 'twoBars' } }),
  effect('progressive-wave', 'Progressive Wave', 'progressiveWave', laser, 'wave', 18, { relationshipMode: 'phaseOffset', automation: [{ id: 'wave-phase', parameter: 'phase', from: 0, to: 1, startProgress: 0, endProgress: 1, curve: 'linear' }] }),
  effect('grid-scan', 'Grid Scan', 'gridScan', laser, 'gridScan', 16, { relationshipMode: 'phaseOffset', qualityPriority: 'texture' }),
  effect('line-diffraction-accent', 'Line Diffraction Accent', 'lineDiffraction', laser, 'diffractionLine', 7, { optics: { mode: 'lineDiffraction', copyCount: 7, spreadDeg: 14 }, duration: { kind: 'beat' }, transitionIn: cut, transitionOut: shutter, qualityPriority: 'impact' }),
  effect('grid-diffraction-accent', 'Grid Diffraction Accent', 'gridDiffraction', laser, 'diffractionGrid', 9, { optics: { mode: 'gridDiffraction', copyCount: 9, spreadDeg: 12 }, duration: { kind: 'beat' }, transitionIn: cut, transitionOut: shutter, qualityPriority: 'impact' }),
  effect('burst-diffraction-accent', 'Burst Diffraction Accent', 'burstDiffraction', laser, 'diffractionBurst', 11, { optics: { mode: 'burstDiffraction', copyCount: 11, spreadDeg: 16 }, duration: { kind: 'beat' }, transitionIn: cut, transitionOut: shutter, qualityPriority: 'impact' }),
  effect('held-tension-beam', 'Held Tension Beam', 'heldBeam', laser, 'holdBeam', 1, { relationshipMode: 'symmetricalPair', transform: { ...baseTransform, width: 0.08, height: 0.08 }, duration: { kind: 'twoBars' }, transitionOut: shutter, qualityPriority: 'hero' }),
  effect('alternating-bank-fan', 'Alternating Bank Fan', 'steppedFan', laser, 'fanSweep', 8, { relationshipMode: 'alternating', automation: [{ id: 'alternate-phase', parameter: 'phase', from: 0, to: 1, startProgress: 0, endProgress: 1, curve: 'stepped', steps: 4 }] }),
  effect('call-and-response-fan', 'Call-and-Response Fan', 'steppedFan', laser, 'fanSweep', 8, { relationshipMode: 'callResponse', duration: { kind: 'twoBars' }, qualityPriority: 'hero' }),

  effect('front-fan-position', 'Front Fan Position', 'movingHeadPositionLook', movingHead, 'holdBeam', 1, { transform: { ...baseTransform, rotationDeg: -36 }, duration: { kind: 'fourBars' } }),
  effect('cross-position', 'Cross Position', 'movingHeadPositionLook', movingHead, 'holdBeam', 1, { transform: { ...baseTransform, rotationDeg: 28 }, relationshipMode: 'opposed' }),
  effect('center-convergence', 'Center Convergence', 'movingHeadPositionLook', movingHead, 'holdBeam', 1, { transform: { ...baseTransform, rotationDeg: 0 }, relationshipMode: 'centerOut' }),
  effect('wide-drop-position', 'Wide Drop Position', 'movingHeadPositionLook', movingHead, 'holdBeam', 1, { transform: { ...baseTransform, rotationDeg: 52 }, relationshipMode: 'symmetricalPair' }),
  effect('slow-pan-sweep', 'Slow Pan Sweep', 'movingHeadSweep', movingHead, 'holdBeam', 1, { automation: [{ id: 'slow-pan', parameter: 'movingHeadPan', from: -70, to: 70, startProgress: 0, endProgress: 1, curve: 'sine' }], duration: { kind: 'eightBars' } }),
  effect('slow-tilt-sweep', 'Slow Tilt Sweep', 'movingHeadSweep', movingHead, 'holdBeam', 1, { automation: [{ id: 'slow-tilt', parameter: 'movingHeadTilt', from: -25, to: 52, startProgress: 0, endProgress: 1, curve: 'easeInOut' }], duration: { kind: 'eightBars' } }),
  effect('gobo-breakup-look', 'Gobo Breakup Look', 'movingHeadGoboLook', movingHead, 'holdBeam', 1, { automation: [{ id: 'gobo-rotation', parameter: 'goboRotation', from: 0, to: 180, startProgress: 0, endProgress: 1, curve: 'linear' }], duration: { kind: 'eightBars' } }),
  effect('prism-expansion', 'Prism Expansion', 'movingHeadGoboLook', movingHead, 'holdBeam', 1, { automation: [{ id: 'prism-zoom', parameter: 'movingHeadZoom', from: 0.15, to: 0.72, startProgress: 0, endProgress: 1, curve: 'easeOut' }] }),
  effect('narrow-beam-build', 'Narrow Beam Build', 'movingHeadPositionLook', movingHead, 'holdBeam', 1, { automation: [{ id: 'narrow-build', parameter: 'movingHeadZoom', from: 0.5, to: 0.08, startProgress: 0, endProgress: 1, curve: 'easeIn' }] }),
  effect('frosted-breakdown', 'Frosted Breakdown', 'movingHeadGoboLook', movingHead, 'holdBeam', 1, { automation: [{ id: 'frosted-zoom', parameter: 'movingHeadZoom', from: 0.42, to: 0.8, startProgress: 0, endProgress: 1, curve: 'easeInOut' }], duration: { kind: 'eightBars' } }),

  effect('section-color-bed', 'Section Color Bed', 'washScene', wash, 'holdBeam', 1, { intensityCeiling: 0.54, qualityPriority: 'support' }),
  effect('build-lift', 'Build Lift', 'washScene', wash, 'holdBeam', 1, { automation: [{ id: 'wash-lift', parameter: 'washIntensity', from: 0.32, to: 0.86, startProgress: 0, endProgress: 1, curve: 'easeIn' }] }),
  effect('drop-saturation', 'Drop Saturation', 'washScene', wash, 'holdBeam', 1, { intensityCeiling: 0.82 }),
  effect('breakdown-wash', 'Breakdown Wash', 'washScene', wash, 'holdBeam', 1, { intensityCeiling: 0.42, duration: { kind: 'eightBars' } }),
  effect('outro-fade', 'Outro Fade', 'washScene', wash, 'holdBeam', 1, { automation: [{ id: 'outro-wash-fade', parameter: 'washIntensity', from: 0.44, to: 0, startProgress: 0, endProgress: 1, curve: 'easeOut' }], duration: { kind: 'eightBars' }, transitionOut: shutter }),

  effect('snare-flash', 'Snare Flash', 'strobeAccent', ['strobe'], 'holdBeam', 1, { duration: { kind: 'beat' }, transitionIn: cut, transitionOut: cut, intensityCeiling: 1, qualityPriority: 'impact' }),
  effect('four-beat-strobe-burst', 'Four-Beat Strobe Burst', 'strobeAccent', ['strobe'], 'holdBeam', 1, { duration: { kind: 'bar' }, transitionIn: cut, transitionOut: cut, intensityCeiling: 1, qualityPriority: 'impact' }),
  effect('drop-impact', 'Drop Impact', 'blinderImpact', ['blinder'], 'holdBeam', 1, { duration: { kind: 'beat' }, transitionIn: cut, transitionOut: cut, intensityCeiling: 1, qualityPriority: 'impact' }),
  effect('phrase-blinder', 'Phrase Blinder', 'blinderImpact', ['blinder'], 'holdBeam', 1, { duration: { kind: 'beat' }, transitionIn: cut, transitionOut: cut, intensityCeiling: 0.92, qualityPriority: 'impact' }),
  effect('transition-flash', 'Transition Flash', 'strobeAccent', ['strobe', 'blinder'], 'holdBeam', 1, { duration: { kind: 'beat' }, transitionIn: cut, transitionOut: cut, intensityCeiling: 0.95, qualityPriority: 'impact' }),

  effect('center-out-chase', 'Center-Out Chase', 'ledChase', led, 'holdBeam', 8, { relationshipMode: 'centerOut', automation: [{ id: 'led-center-out', parameter: 'ledChasePosition', from: 0.5, to: 1, startProgress: 0, endProgress: 1, curve: 'stepped', steps: 8 }] }),
  effect('outside-in-chase', 'Outside-In Chase', 'ledChase', led, 'holdBeam', 8, { relationshipMode: 'outsideIn', automation: [{ id: 'led-outside-in', parameter: 'ledChasePosition', from: 0, to: 0.5, startProgress: 0, endProgress: 1, curve: 'stepped', steps: 8 }] }),
  effect('alternating-blocks', 'Alternating Blocks', 'ledChase', led, 'holdBeam', 8, { relationshipMode: 'alternating', automation: [{ id: 'led-alternate', parameter: 'ledChasePosition', from: 0, to: 1, startProgress: 0, endProgress: 1, curve: 'stepped', steps: 4 }] }),
  effect('symmetrical-fill', 'Symmetrical Fill', 'ledChase', led, 'holdBeam', 8, { relationshipMode: 'symmetricalPair' }),
  effect('palette-gradient', 'Palette Gradient', 'ledChase', led, 'holdBeam', 8, { relationshipMode: 'colorAlternation', automation: [{ id: 'led-gradient', parameter: 'colorBlend', from: 0, to: 1, startProgress: 0, endProgress: 1, curve: 'linear' }] }),
  effect('beat-step', 'Beat Step', 'ledChase', led, 'holdBeam', 8, { relationshipMode: 'chase', duration: { kind: 'bar' }, automation: [{ id: 'led-beat-step', parameter: 'ledChasePosition', from: 0, to: 1, startProgress: 0, endProgress: 1, curve: 'stepped', steps: 4 }] }),
  effect('phrase-sweep', 'Phrase Sweep', 'ledChase', led, 'holdBeam', 12, { relationshipMode: 'chase', duration: { kind: 'eightBars' }, automation: [{ id: 'led-phrase-sweep', parameter: 'ledChasePosition', from: 0, to: 1, startProgress: 0, endProgress: 1, curve: 'easeInOut' }] }),

  effect('baseline-haze', 'Baseline Haze', 'mixedFixtureScene', haze, 'holdBeam', 1, { automation: [{ id: 'baseline-haze-level', parameter: 'hazeAmount', from: 0.2, to: 0.28, startProgress: 0, endProgress: 1, curve: 'hold' }], intensityCeiling: 0.32, qualityPriority: 'texture' }),
  effect('build-haze-rise', 'Build Haze Rise', 'mixedFixtureScene', haze, 'holdBeam', 1, { automation: [{ id: 'build-haze-rise', parameter: 'hazeAmount', from: 0.28, to: 0.7, startProgress: 0, endProgress: 1, curve: 'easeIn' }], qualityPriority: 'texture' }),
  effect('drop-haze-hold', 'Drop Haze Hold', 'mixedFixtureScene', haze, 'holdBeam', 1, { automation: [{ id: 'drop-haze-hold', parameter: 'hazeAmount', from: 0.68, to: 0.68, startProgress: 0, endProgress: 1, curve: 'hold' }], qualityPriority: 'texture' }),
  effect('breakdown-haze-reduction', 'Breakdown Haze Reduction', 'mixedFixtureScene', haze, 'holdBeam', 1, { automation: [{ id: 'breakdown-haze-reduction', parameter: 'hazeAmount', from: 0.36, to: 0.18, startProgress: 0, endProgress: 1, curve: 'easeOut' }], qualityPriority: 'texture' }),
  effect('co2-drop-impact', 'CO₂ Drop Impact', 'co2Impact', ['co2Jet'], 'holdBeam', 1, { duration: { kind: 'beat' }, transitionIn: cut, transitionOut: cut, intensityCeiling: 1, qualityPriority: 'impact' }),
  effect('co2-phrase-accent', 'CO₂ Phrase Accent', 'co2Impact', ['co2Jet'], 'holdBeam', 1, { duration: { kind: 'beat' }, transitionIn: cut, transitionOut: cut, intensityCeiling: 0.86, qualityPriority: 'impact' }),
]

export const LASER_DMX_PROFESSIONAL_EFFECT_LIBRARY: Readonly<Record<LaserDmxProfessionalEffectId, Readonly<LaserDmxProfessionalEffectDefinition>>> = Object.freeze(
  Object.fromEntries(entries.map(item => [item.id, Object.freeze(item)])) as Record<LaserDmxProfessionalEffectId, Readonly<LaserDmxProfessionalEffectDefinition>>,
)

function cloneEffect(item: Readonly<LaserDmxProfessionalEffectDefinition>): LaserDmxProfessionalEffectDefinition {
  return {
    ...item,
    fixtureKinds: [...item.fixtureKinds],
    duration: { ...item.duration },
    pattern: { ...item.pattern, ...(item.pattern.stablePointIds ? { stablePointIds: [...item.pattern.stablePointIds] } : {}) },
    transform: { ...item.transform },
    scan: { ...item.scan },
    optics: { ...item.optics },
    automation: item.automation.map(lane => ({ ...lane })),
    transitionIn: { ...item.transitionIn },
    transitionOut: { ...item.transitionOut },
  }
}

export function getLaserDmxProfessionalEffect(id: LaserDmxProfessionalEffectId): LaserDmxProfessionalEffectDefinition {
  return cloneEffect(LASER_DMX_PROFESSIONAL_EFFECT_LIBRARY[id])
}

export function listLaserDmxProfessionalEffects(): LaserDmxProfessionalEffectDefinition[] {
  return Object.values(LASER_DMX_PROFESSIONAL_EFFECT_LIBRARY).map(cloneEffect)
}
