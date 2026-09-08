import {
  AFTERHOURS_DEFAULTS,
  type AfterhoursPattern,
  type AfterhoursSettings,
} from '../../../CinematicWorldSettings'

export const AFTERHOURS_VISUAL_ACCEPTANCE_CHECKPOINT_IDS = [
  'static-wide-fan',
  'static-split-wings',
  'cross-canopy',
  'diamond-star',
  'sparse-architecture',
  'full-rig',
  'mid-motion-wide-sweep',
  'fan-open-close-fixed-phase',
  'full-blackout',
  'music-drop-impact',
  'music-quiet-sparse',
  'beam-8-side-top',
] as const

export type AfterhoursVisualAcceptanceCheckpointId = typeof AFTERHOURS_VISUAL_ACCEPTANCE_CHECKPOINT_IDS[number]

export interface AfterhoursVisualAcceptanceMusicState {
  readonly bpm: number
  readonly timeSec: number
  readonly beatIndex: number
  readonly barIndex: number
  readonly beatPhase: number
  readonly barPhase: number
  readonly sectionId: string
  readonly sectionType: string
  readonly sectionProgress: number
  readonly energy: number
  readonly bass: number
  readonly mid: number
  readonly high: number
  readonly buildProgress: number
  readonly dropImpact: number
  readonly vocalPresence: number
  readonly impulses: Readonly<{
    beat: boolean
    downbeat: boolean
    kick: boolean
    snare: boolean
    transient: boolean
    sectionStart: boolean
    dropStart: boolean
  }>
}

export interface AfterhoursVisualAcceptanceCheckpoint {
  readonly id: AfterhoursVisualAcceptanceCheckpointId
  readonly label: string
  readonly description: string
  readonly settings: Readonly<AfterhoursSettings>
  readonly music: Readonly<AfterhoursVisualAcceptanceMusicState>
}

const DEFAULT_SETTINGS: Readonly<AfterhoursSettings> = Object.freeze({
  ...AFTERHOURS_DEFAULTS,
  colorMode: 'manual',
  primaryColor: '#74f5ff',
  accentColor: '#ffffff',
  backgroundColor: '#000000',
  accentMix: 0.25,
  atmosphere: 0.55,
  bpmSync: true,
  masterIntensity: 0.82,
  trigger: 'beat',
  pulseAmount: 0,
  pulseDecay: 0.45,
  patternChange: 'off',
  blackoutAmount: 0,
})

function settings(
  pattern: AfterhoursPattern,
  overrides: Partial<AfterhoursSettings> = {},
): Readonly<AfterhoursSettings> {
  return Object.freeze({ ...DEFAULT_SETTINGS, pattern, ...overrides })
}

function music(overrides: Partial<AfterhoursVisualAcceptanceMusicState> = {}): Readonly<AfterhoursVisualAcceptanceMusicState> {
  const timeSec = overrides.timeSec ?? 8
  const bpm = overrides.bpm ?? 120
  const absoluteBeat = timeSec * bpm / 60
  const beatIndex = overrides.beatIndex ?? Math.floor(absoluteBeat)
  const barIndex = overrides.barIndex ?? Math.floor(beatIndex / 4)
  return Object.freeze({
    bpm,
    timeSec,
    beatIndex,
    barIndex,
    beatPhase: overrides.beatPhase ?? absoluteBeat - Math.floor(absoluteBeat),
    barPhase: overrides.barPhase ?? ((absoluteBeat / 4) - Math.floor(absoluteBeat / 4)),
    sectionId: overrides.sectionId ?? 'acceptance-section',
    sectionType: overrides.sectionType ?? 'verse',
    sectionProgress: overrides.sectionProgress ?? 0.5,
    energy: overrides.energy ?? 0.62,
    bass: overrides.bass ?? 0.66,
    mid: overrides.mid ?? 0.48,
    high: overrides.high ?? 0.42,
    buildProgress: overrides.buildProgress ?? 0,
    dropImpact: overrides.dropImpact ?? 0,
    vocalPresence: overrides.vocalPresence ?? 0.1,
    impulses: Object.freeze({
      beat: false,
      downbeat: false,
      kick: false,
      snare: false,
      transient: false,
      sectionStart: false,
      dropStart: false,
      ...overrides.impulses,
    }),
  })
}

export const AFTERHOURS_VISUAL_ACCEPTANCE_CHECKPOINTS: readonly AfterhoursVisualAcceptanceCheckpoint[] = Object.freeze([
  Object.freeze({
    id: 'static-wide-fan',
    label: 'Static Wide Fan, Motion 0',
    description: 'Wide Fan with scanner authority disabled for a stable architectural baseline.',
    settings: settings('wideFan', { motionAmount: 0, beamCount: 8, sideLasers: false, topLasers: false }),
    music: music({ timeSec: 8 }),
  }),
  Object.freeze({
    id: 'static-split-wings',
    label: 'Static Split Wings, Motion 0',
    description: 'Split Wings with no scanner motion so bank geometry can be compared directly.',
    settings: settings('splitWings', { motionAmount: 0, beamCount: 8, sideLasers: true, topLasers: false }),
    music: music({ timeSec: 8 }),
  }),
  Object.freeze({
    id: 'cross-canopy',
    label: 'Cross Canopy',
    description: 'Deterministic crossed canopy scene at a fixed transport phase.',
    settings: settings('crossCanopy', { motionAmount: 0.35, beamCount: 10, sideLasers: true, topLasers: false }),
    music: music({ timeSec: 10, beatPhase: 0.25, barPhase: 0.5 }),
  }),
  Object.freeze({
    id: 'diamond-star',
    label: 'Diamond / Star',
    description: 'Geometric traversal checkpoint for the authored diamond/star topology.',
    settings: settings('diamondStar', { motionAmount: 0.28, beamCount: 8, sideLasers: true, topLasers: true }),
    music: music({ timeSec: 12, beatPhase: 0.5, barPhase: 0.25 }),
  }),
  Object.freeze({
    id: 'sparse-architecture',
    label: 'Sparse Architecture',
    description: 'Deliberate negative-space scene with a low beam ceiling.',
    settings: settings('sparseArchitecture', { motionAmount: 0, beamCount: 4, sideLasers: false, topLasers: false, spread: 0.48 }),
    music: music({ timeSec: 14, energy: 0.28, sectionType: 'breakdown', sectionId: 'acceptance-breakdown' }),
  }),
  Object.freeze({
    id: 'full-rig',
    label: 'Full Rig',
    description: 'All fixture families enabled at the maximum authored beam budget.',
    settings: settings('fullRig', { motionAmount: 0.45, beamCount: 16, sideLasers: true, topLasers: true, spread: 0.72 }),
    music: music({ timeSec: 16, energy: 0.9, sectionType: 'drop', sectionId: 'acceptance-full-rig', dropImpact: 0.65 }),
  }),
  Object.freeze({
    id: 'mid-motion-wide-sweep',
    label: 'Mid-motion Wide Sweep',
    description: 'Wide Fan at a fixed scanner phase with full Motion authority.',
    settings: settings('wideFan', { motionAmount: 1, beamCount: 8, sideLasers: false, topLasers: false }),
    music: music({ timeSec: 18.5, beatPhase: 0.5, barPhase: 0.625, energy: 0.76 }),
  }),
  Object.freeze({
    id: 'fan-open-close-fixed-phase',
    label: 'Fan Open / Close Fixed Phase',
    description: 'Wide Fan captured at a second exact phase to expose the open/close scanner choreography.',
    settings: settings('wideFan', { motionAmount: 0.82, beamCount: 10, sideLasers: false, topLasers: false, spread: 0.82 }),
    music: music({ timeSec: 20.25, beatPhase: 0.5, barPhase: 0.125, energy: 0.72 }),
  }),
  Object.freeze({
    id: 'full-blackout',
    label: 'Full Blackout',
    description: 'A canonical drop cue with Blackout Amount 1, producing a literal zero laser multiplier.',
    settings: settings('fullRig', { motionAmount: 0.5, beamCount: 16, sideLasers: true, topLasers: true, blackoutAmount: 1 }),
    music: music({
      timeSec: 24,
      energy: 1,
      sectionId: 'acceptance-blackout-drop',
      sectionType: 'drop',
      sectionProgress: 0,
      dropImpact: 1,
      impulses: { beat: true, downbeat: true, kick: true, snare: true, transient: true, sectionStart: true, dropStart: true },
    }),
  }),
  Object.freeze({
    id: 'music-drop-impact',
    label: 'Music-driven Drop / Impact',
    description: 'High-energy canonical drop snapshot with kick, snare, downbeat and drop impulses.',
    settings: settings('fullRig', { motionAmount: 0.75, beamCount: 16, sideLasers: true, topLasers: true, trigger: 'drop', pulseAmount: 0.8, blackoutAmount: 0 }),
    music: music({
      timeSec: 28,
      energy: 1,
      bass: 1,
      mid: 0.84,
      high: 0.78,
      sectionId: 'acceptance-drop-impact',
      sectionType: 'drop',
      sectionProgress: 0.02,
      dropImpact: 1,
      impulses: { beat: true, downbeat: true, kick: true, snare: true, transient: true, sectionStart: true, dropStart: true },
    }),
  }),
  Object.freeze({
    id: 'music-quiet-sparse',
    label: 'Music-driven Quiet / Sparse',
    description: 'Low-energy intro snapshot that forces the Stage 6 hierarchy toward a sparse density tier.',
    settings: settings('sparseArchitecture', { motionAmount: 0.22, beamCount: 10, sideLasers: true, topLasers: true, spread: 0.5 }),
    music: music({
      timeSec: 32,
      energy: 0.12,
      bass: 0.12,
      mid: 0.1,
      high: 0.08,
      sectionId: 'acceptance-quiet-intro',
      sectionType: 'intro',
      sectionProgress: 0.35,
      vocalPresence: 0.08,
    }),
  }),
  Object.freeze({
    id: 'beam-8-side-top',
    label: 'Beam Count 8, Side + Top',
    description: 'Literal eight-beam budget with lower, left, right and top banks all participating.',
    settings: settings('fullRig', { motionAmount: 0, beamCount: 8, sideLasers: true, topLasers: true, spread: 0.7 }),
    music: music({
      timeSec: 36,
      energy: 0.96,
      bass: 0.9,
      mid: 0.7,
      high: 0.72,
      sectionId: 'acceptance-bank-participation',
      sectionType: 'drop',
      sectionProgress: 0.5,
      dropImpact: 0.6,
    }),
  }),
])

const CHECKPOINT_BY_ID = new Map(AFTERHOURS_VISUAL_ACCEPTANCE_CHECKPOINTS.map(checkpoint => [checkpoint.id, checkpoint]))

export function getAfterhoursVisualAcceptanceCheckpoint(
  id: AfterhoursVisualAcceptanceCheckpointId,
): AfterhoursVisualAcceptanceCheckpoint {
  const checkpoint = CHECKPOINT_BY_ID.get(id)
  if (!checkpoint) throw new Error(`Unknown Afterhours visual acceptance checkpoint: ${id}`)
  return checkpoint
}
