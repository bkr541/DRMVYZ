import type {
  Cinema2AfterhoursAim,
  Cinema2AfterhoursBeamShape,
  Cinema2AfterhoursGroupId,
  Cinema2AfterhoursPatternDefinition,
  Cinema2AfterhoursPatternEnergy,
  Cinema2AfterhoursPatternLayer,
  Cinema2AfterhoursPatternStep,
} from './Cinema2AfterhoursPatternEngine'

/**
 * The Afterhours 2.0 pattern library: programmed laser looks of 1 to 16 bars, modelled on professional club laser shows.
 *
 * Gate strings are 16 characters, one per 16th note of a bar: `x` fires on that 16th, `=` stays lit, `.` is dark.
 * Endpoints are [x, y]: x measured outward from the stage centre on the laser's own side (negative crosses over), y from floor (0) to top (1).
 * [x, y, 'rel'] aims relative to the laser's own position (x 0 fires straight ahead).
 */

// ---- Gates -------------------------------------------------------------------------------------------------------------------------------
const HOLD = 'x==============='
const HOLD_PRE = 'x===========....' // hold, then a beat of black before the next bar's hit
const HALVES = 'x=======x======='
const QUARTERS = 'x===x===x===x==='
const STABS = 'x...x...x...x...'
const STABS_8 = 'x=..x=..x=..x=..'
const OFFBEAT = '..x=..x=..x=..x='
const EIGHTHS = 'x=x=x=x=x=x=x=x='
const EIGHTH_STABS = 'x.x.x.x.x.x.x.x.'
const SIXTEENTHS = 'xxxxxxxxxxxxxxxx'
const BACKBEAT = '....x===....x==='
const BACKBEAT_STABS = '....x.......x...'
const DOWNBEAT = 'x===............'
const FIRST_HALF = 'x=======........'
const SECOND_HALF = '........x======='
const LAST_BEAT = '............x==='
const FILL = 'x=======xxxxxxxx'
const FILL_8 = 'x===x===x.x.xxxx'
const STUTTER = 'xxxx============'
const STUTTER_PRE = 'xxxx========....'
const TRESILLO = 'x==x==x=x==x==x='
const TRESILLO_STABS = 'x..x..x.x..x..x.'
const GALLOP = 'x.xxx.xxx.xxx.xx'
const DARK = '................'
const CHASE_HIT = 'x===............'
const CHASE_TICK = 'x===............'

type StepOptions = Omit<Cinema2AfterhoursPatternStep, 'gate' | 'beams' | 'aim'>

function s(gate: string, beams: Cinema2AfterhoursBeamShape, aim: readonly Cinema2AfterhoursAim[], options: StepOptions = {}): Cinema2AfterhoursPatternStep {
  if (gate.length !== 16 || /[^x=.]/.test(gate)) throw new Error(`Afterhours pattern gate "${gate}" must be 16 characters of x, = and .`)
  return Object.freeze({ gate, beams, aim: Object.freeze(aim.map(point => Object.freeze([...point]) as unknown as Cinema2AfterhoursAim)), ...options })
}

const dark = s(DARK, 1, [[0.5, 0.5]])

function layer(group: Cinema2AfterhoursGroupId, role: 'base' | 'accent', bars: readonly Cinema2AfterhoursPatternStep[]): Cinema2AfterhoursPatternLayer {
  return Object.freeze({ group, role, bars: Object.freeze([...bars]) })
}

function pattern(id: string, label: string, energy: Cinema2AfterhoursPatternEnergy, bars: number, layers: readonly Cinema2AfterhoursPatternLayer[]): Cinema2AfterhoursPatternDefinition {
  return Object.freeze({ id, label, energy, bars, layers: Object.freeze([...layers]) })
}

/** Repeats a list of bars `times` times. */
const repeat = <T>(times: number, bars: readonly T[]): T[] => Array.from({ length: times }, () => bars).flat()

// ---- Library -----------------------------------------------------------------------------------------------------------------------------
export const CINEMA2_AFTERHOURS_PATTERNS: readonly Cinema2AfterhoursPatternDefinition[] = Object.freeze([
  // The eight original families, rebuilt with fans, holds and multi-endpoint hits.
  pattern('wideFan', 'Wide Fan', 'mid', 8, [
    layer('floor', 'base', [
      s(HOLD, 5, [[0.55, 0.85]]),
      s(HOLD, 5, [[0.7, 0.7]]),
      s(QUARTERS, 3, [[0.4, 0.9], [0.7, 0.75], [0.55, 0.95], [0.8, 0.6]], { aimRate: 'beat' }),
      s(HOLD_PRE, 7, [[0.6, 0.8]], { width: 1.1 }),
    ]),
    layer('topEnds', 'accent', [dark, dark, dark, s(FILL, 1, [[0.3, 0.1], [0.6, 0.2], [0.9, 0.05], [0.45, 0.3]], { color: 'w' })]),
  ]),
  pattern('splitWings', 'Split Wings', 'mid', 8, [
    layer('sides', 'base', [
      s(HOLD, 4, [[0.75, 0.5]], { orient: 'v', width: 0.5 }),
      s(HOLD, 4, [[0.55, 0.6]], { orient: 'v', width: 0.5 }),
      s(QUARTERS, 1, [[0.9, 0.3], [0.7, 0.5], [0.5, 0.7], [0.7, 0.5]], { aimRate: 'beat' }),
      s(HOLD_PRE, 6, [[0.65, 0.55]], { orient: 'v', width: 0.75 }),
    ]),
    layer('floorOuter', 'accent', [s(BACKBEAT, 3, [[0.8, 0.8]], { color: 'a' })]),
  ]),
  pattern('crossCanopy', 'Cross Canopy', 'mid', 8, [
    layer('sides', 'base', [s(HOLD, 3, [[-0.7, 0.75]]), s(HOLD, 3, [[-0.5, 0.85]])]),
    layer('top', 'accent', [
      s(EIGHTH_STABS, 1, [[-0.4, 0.1], [-0.6, 0.15]]),
      s(EIGHTH_STABS, 1, [[-0.3, 0.2], [-0.7, 0.1]]),
      s(EIGHTHS, 3, [[-0.4, 0.1], [-0.6, 0.15]]),
      s(FILL, 1, [[-0.5, 0.2]], { aimMode: 'scatter', color: 'w' }),
    ]),
  ]),
  pattern('diamondStar', 'Diamond / Star', 'mid', 8, [
    layer('floorEnds', 'base', [s(HOLD, 1, [[0, 0.52]])]),
    layer('topEnds', 'base', [s(HOLD, 1, [[0, 0.52]])]),
    layer('centers', 'accent', [
      dark,
      s(QUARTERS, 8, [[0, 0.5]], { width: 1.3, color: 'a' }),
      dark,
      s(STUTTER_PRE, 12, [[0, 0.5]], { width: 1.8, color: 'alt' }),
    ]),
  ]),
  pattern('chevronRoof', 'Chevron / Roof', 'mid', 8, [
    layer('top', 'base', [
      s(HOLD, 1, [[0.25, 0.1]]),
      s(HOLD, 3, [[0.35, 0.15]]),
      s(HOLD, 6, [[0.3, 0.12]]),
      s(STUTTER_PRE, 1, [[0.2, 0.1], [0.5, 0.2], [0.8, 0.1], [0.35, 0.3]], { color: 'alt' }),
    ]),
    layer('floorCenter', 'accent', [s(DOWNBEAT, 'sheet', [[0, 1]], { width: 0.5, color: 'w' })]),
  ]),
  pattern('radialCrown', 'Radial Crown', 'high', 8, [
    layer('topCenter', 'base', [s(HOLD, 12, [[0, 0.2]], { width: 1.8 }), s(HOLD, 16, [[0, 0.15]], { width: 2.1 })]),
    layer('top', 'accent', [
      s(QUARTERS, 1, [[0.6, 0.4], [0.9, 0.2], [0.3, 0.3], [0.8, 0.5]], { aimRate: 'beat', color: 'a' }),
      s(EIGHTHS, 1, [[0.6, 0.4], [0.9, 0.2], [0.3, 0.3], [0.8, 0.5]], { color: 'a' }),
    ]),
  ]),
  pattern('sparseArchitecture', 'Sparse Architecture', 'low', 8, [
    layer('floorEnds', 'base', [s(HOLD, 1, [[0.35, 0.95]]), s(HOLD, 1, [[0.35, 0.95]]), s(HOLD_PRE, 1, [[0.2, 0.95]]), s(HOLD, 1, [[0.5, 0.9]])]),
    layer('topInner', 'accent', [dark, s(FIRST_HALF, 1, [[0, 0, 'rel']], { color: 'a' }), dark, s(SECOND_HALF, 1, [[0.3, 0.1]])]),
  ]),
  pattern('fullRig', 'Full Rig', 'high', 4, [
    layer('floor', 'base', [s(HOLD, 5, [[0.5, 0.9]]), s(HOLD, 5, [[0.65, 0.8]]), s(HOLD, 5, [[0.5, 0.9]]), s(STUTTER, 7, [[0.5, 0.9], [0.3, 0.7], [0.7, 0.95], [0.5, 0.8]], { color: 'alt' })]),
    layer('top', 'base', [s(HOLD, 5, [[0.5, 0.1]]), s(HOLD, 5, [[0.35, 0.15]]), s(HOLD, 5, [[0.5, 0.1]]), s(STUTTER, 7, [[0.5, 0.1], [0.7, 0.2], [0.3, 0.05], [0.5, 0.15]], { color: 'alt' })]),
    layer('mid', 'accent', [s(QUARTERS, 3, [[0.6, 0.5], [0.3, 0.6], [0.8, 0.45], [0.4, 0.55]], { aimRate: 'beat', color: 'a' })]),
    layer('sides', 'accent', [s(EIGHTH_STABS, 1, [[0, 0.5]], { aimMode: 'scatter', aimRate: '8th' })]),
  ]),

  // Looks drawn from the reference shows.
  pattern('pyramidSheet', 'Pyramid Sheet', 'mid', 8, [
    layer('topCenter', 'base', [s(HOLD, 'sheet', [[0, 0]], { width: 1.3 }), s(HOLD, 'sheet', [[0, 0]], { width: 1.5 }), s(HOLD, 'sheet', [[0, 0]], { width: 1.3 }), s(STUTTER_PRE, 'sheet', [[0, 0], [0, 0.2]], { width: 1.6, color: 'alt' })]),
    layer('floorOuter', 'accent', [s(STABS_8, 1, [[0.1, 1]], { color: 'w' })]),
  ]),
  pattern('wZigzag', 'W Zigzag', 'mid', 8, [
    layer('topEven', 'base', [s(HOLD, 1, [[0.12, 0.05, 'rel']]), s(HOLD, 1, [[0.12, 0.05, 'rel']]), s(HOLD, 3, [[0.12, 0.05, 'rel']]), s(HOLD_PRE, 4, [[0.12, 0.05, 'rel']], { width: 0.3 })]),
    layer('topOdd', 'base', [s(HOLD, 1, [[-0.12, 0.05, 'rel']]), s(HOLD, 1, [[-0.12, 0.05, 'rel']]), s(HOLD, 3, [[-0.12, 0.05, 'rel']]), s(HOLD_PRE, 4, [[-0.12, 0.05, 'rel']], { width: 0.3 })]),
    layer('floor', 'accent', [s(BACKBEAT, 1, [[0.09, 0.95, 'rel'], [-0.09, 0.95, 'rel']], { color: 'a' })]),
  ]),
  pattern('xLattice', 'X Lattice', 'high', 8, [
    layer('floorEnds', 'base', [s(HOLD, 3, [[-1, 1]]), s(HOLD, 3, [[-0.8, 1]])]),
    layer('topEnds', 'base', [s(HOLD, 3, [[-1, 0]]), s(HOLD, 3, [[-0.8, 0]])]),
    layer('topCenter', 'accent', [s(TRESILLO_STABS, 'sheet', [[0, 0]], { width: 1.4, color: 'a' }), s('.x..x..x.x..x.x.', 'sheet', [[0, 0]], { width: 1.4, color: 'a' })]),
  ]),
  pattern('fanRow', 'Fan Row + Floor Beams', 'high', 8, [
    layer('mid', 'base', [...repeat(3, [s(HOLD, 7, [[0, 0.82, 'rel']], { width: 0.5 })]), s(STUTTER_PRE, 7, [[0, 0.82, 'rel'], [0, 0.6, 'rel']], { width: 0.6 })]),
    layer('floor', 'accent', [s(EIGHTHS, 1, [[0.15, 0.45], [-0.3, 0.4]], { aimRate: '8th', color: 'a' })]),
  ]),
  pattern('stutterFlip', 'Stutter Flip', 'high', 4, [
    layer('top', 'base', [
      s(STUTTER, 4, [[0.3, 0.1], [0.6, 0.2], [0.2, 0.3], [0.5, 0.05]], { color: 'alt' }),
      s(HOLD, 4, [[0.5, 0.05]]),
      s(STUTTER, 4, [[0.3, 0.1], [0.6, 0.2], [0.2, 0.3], [0.5, 0.05]], { color: 'alt' }),
      s(STUTTER_PRE, 6, [[0.4, 0.15]], { color: 'alt' }),
    ]),
    layer('floor', 'accent', [s(FIRST_HALF, 3, [[0.2, 0.9]], { color: 'a' })]),
  ]),
  pattern('beatJump', 'Beat Jump', 'mid', 4, [
    layer('floor', 'base', [
      s(QUARTERS, 1, [[0.5, 0.8]], { aimMode: 'scatter', aimRate: 'beat' }),
      s(QUARTERS, 1, [[0.5, 0.8]], { aimMode: 'scatter', aimRate: 'beat' }),
      s(QUARTERS, 3, [[0.5, 0.8]], { aimMode: 'scatter', aimRate: 'beat' }),
      s(QUARTERS, 5, [[0.5, 0.8]], { aimMode: 'scatter', aimRate: 'beat' }),
    ]),
    layer('top', 'accent', [s(OFFBEAT, 1, [[0.5, 0.2]], { aimMode: 'scatter', aimRate: 'beat', color: 'a' })]),
  ]),
  pattern('scatterStorm', 'Scatter Storm', 'high', 4, [
    layer('floor', 'base', [s(SIXTEENTHS, 1, [[0.5, 0.8]], { aimMode: 'scatter', aimRate: '16th' })]),
    layer('top', 'base', [s(EIGHTH_STABS, 3, [[0.5, 0.2]], { aimMode: 'scatter', aimRate: '8th' })]),
    layer('sides', 'accent', [
      ...repeat(3, [s(OFFBEAT, 1, [[0, 0.5]], { aimMode: 'scatter', aimRate: '8th', color: 'a' })]),
      s(STUTTER, 5, [[0, 0.5]], { color: 'w' }),
    ]),
  ]),
  pattern('tunnelConverge', 'Tunnel Converge', 'mid', 8, [
    layer('floor', 'base', [s(HOLD, 1, [[0, 0.5]]), s(HOLD, 3, [[0, 0.5]]), s(HOLD, 6, [[0, 0.5]], { width: 0.25 }), s(HOLD_PRE, 'sheet', [[0, 0.5]], { width: 0.25 })]),
    layer('top', 'base', [s(HOLD, 1, [[0, 0.5]]), s(HOLD, 3, [[0, 0.5]]), s(HOLD, 6, [[0, 0.5]], { width: 0.25 }), s(HOLD_PRE, 'sheet', [[0, 0.5]], { width: 0.25 })]),
    layer('sides', 'accent', [s(HOLD, 1, [[0.12, 0.62], [0, 0.72], [-0.12, 0.62], [0, 0.4]], { aimMode: 'sweep', aimRate: 'beat', color: 'a' })]),
  ]),
  pattern('horizonLid', 'Horizon Lid', 'mid', 8, [
    layer('sidesLow', 'base', [
      s(HOLD, 'sheet', [[-0.2, 0.3]], { width: 1.6 }),
      s(HOLD, 'sheet', [[-0.2, 0.36]], { width: 1.6 }),
      s(HOLD, 'sheet', [[-0.2, 0.3]], { width: 1.6 }),
      s(HOLD_PRE, 'sheet', [[-0.2, 0.42]], { width: 1.6 }),
    ]),
    layer('floor', 'accent', [s(STABS, 3, [[0.4, 0.95]], { color: 'a' }), s(STABS, 3, [[0.6, 0.9]], { color: 'a' })]),
  ]),
  pattern('ceilingPlane', 'Ceiling Plane', 'mid', 8, [
    layer('mid', 'base', [s(HOLD, 'sheet', [[0, 0.85, 'rel']], { width: 0.5 })]),
    layer('topOuter', 'accent', [s(BACKBEAT, 3, [[0.4, 0.1]], { color: 'a' })]),
    layer('floorCenter', 'accent', [dark, s(SECOND_HALF, 8, [[0, 0.9]], { width: 1.2 })]),
  ]),
  pattern('backbeatWings', 'Backbeat Wings', 'mid', 4, [
    layer('floor', 'base', [s(HOLD, 1, [[0.3, 0.95], [0.6, 0.85], [0.3, 0.95]], { aimMode: 'sweep', aimRate: 'bar' })]),
    layer('sides', 'accent', [s(BACKBEAT, 5, [[0.6, 0.55]], { orient: 'v', width: 0.6, color: 'a' })]),
  ]),
  pattern('chaseOut', 'Chase Out', 'mid', 4, [
    layer('floor', 'base', [
      s(CHASE_HIT, 3, [[0.4, 0.9]], { chase: 2 }),
      s(CHASE_HIT, 3, [[0.4, 0.9]], { chase: 2, chaseMode: 'in' }),
      s(CHASE_HIT, 5, [[0.4, 0.9]], { chase: 1 }),
      s(FILL_8, 5, [[0.4, 0.9], [0.6, 0.7]]),
    ]),
    layer('top', 'accent', [s(CHASE_HIT, 1, [[0.4, 0.1]], { chase: 2, chaseMode: 'in', color: 'a' })]),
  ]),
  pattern('chaseAcross', 'Chase Across', 'mid', 4, [
    layer('floor', 'base', [
      s(CHASE_TICK, 1, [[0, 0.95, 'rel']], { chase: 1, chaseMode: 'across' }),
      s(CHASE_TICK, 1, [[0, 0.95, 'rel']], { chase: 1, chaseMode: 'across' }),
      s(CHASE_TICK, 3, [[0, 0.95, 'rel']], { chase: 1, chaseMode: 'across' }),
      s(CHASE_TICK, 6, [[0, 0.95, 'rel']], { chase: 1, chaseMode: 'across' }),
    ]),
    layer('top', 'accent', [s('........x=......', 1, [[0, 0.05, 'rel']], { chase: 1, chaseMode: 'across', color: 'a' })]),
  ]),
  pattern('buildRiser', 'Build Riser', 'build', 16, [
    layer('floor', 'base', [
      ...repeat(4, [s(DOWNBEAT, 1, [[0.7, 0.8]])]),
      ...repeat(4, [s('x===....x===....', 1, [[0.6, 0.85], [0.7, 0.8]])]),
      ...repeat(4, [s(EIGHTHS, 3, [[0.45, 0.9], [0.55, 0.85]])]),
      s(SIXTEENTHS, 5, [[0.3, 0.9], [0.4, 0.85]]),
      s(SIXTEENTHS, 5, [[0.2, 0.92], [0.3, 0.88]]),
      s(SIXTEENTHS, 7, [[0.1, 0.95]], { width: 0.5, color: 'w' }),
      dark,
    ]),
    layer('top', 'accent', [
      ...repeat(8, [dark]),
      ...repeat(4, [s(QUARTERS, 1, [[0.4, 0.2], [0.6, 0.1]], { color: 'a' })]),
      s(EIGHTHS, 4, [[0.3, 0.2]], { color: 'a' }),
      s(SIXTEENTHS, 4, [[0.2, 0.25]], { color: 'a' }),
      s(SIXTEENTHS, 6, [[0.1, 0.3]], { color: 'w' }),
      dark,
    ]),
  ]),
  pattern('riserSweep', 'Riser Sweep', 'build', 8, [
    layer('sides', 'base', [
      s(HOLD, 1, [[0.8, 0.3], [0.4, 0.7], [0.8, 0.3]], { aimMode: 'sweep', aimRate: 'bar' }),
      s(HOLD, 1, [[0.8, 0.3], [0.4, 0.7], [0.8, 0.3]], { aimMode: 'sweep', aimRate: 'bar' }),
      s(HALVES, 3, [[0.7, 0.35], [0.4, 0.7]], { aimMode: 'sweep', aimRate: 'beat' }),
      s(HALVES, 3, [[0.6, 0.4], [0.3, 0.7]], { aimMode: 'sweep', aimRate: 'beat' }),
      s(EIGHTHS, 5, [[0.5, 0.45], [0.25, 0.7]], { aimMode: 'sweep', aimRate: '8th', orient: 'v', width: 0.4 }),
      s(EIGHTHS, 5, [[0.4, 0.5], [0.2, 0.7]], { aimMode: 'sweep', aimRate: '8th', orient: 'v', width: 0.4 }),
      s(SIXTEENTHS, 7, [[0.2, 0.6]], { orient: 'v', width: 0.5, color: 'w' }),
      dark,
    ]),
    layer('floorCenter', 'accent', [
      ...repeat(4, [dark]),
      s(QUARTERS, 3, [[0, 1]], { color: 'a' }),
      s(EIGHTHS, 5, [[0, 1]], { color: 'a' }),
      s(SIXTEENTHS, 9, [[0, 1]], { width: 1.1, color: 'w' }),
      dark,
    ]),
  ]),
  pattern('dropExplosion', 'Drop Explosion', 'high', 8, [
    layer('all', 'base', [s(STUTTER_PRE, 5, [[0.5, 0.5]], { aimMode: 'scatter', color: 'w' }), ...repeat(7, [dark])]),
    layer('floor', 'base', [dark, s(HOLD, 7, [[0.55, 0.85]], { width: 1.1 }), s(HOLD, 7, [[0.45, 0.9]], { width: 1.1 }), s(HOLD_PRE, 7, [[0.6, 0.8]], { width: 1.2 })]),
    layer('top', 'base', [dark, s(HOLD, 5, [[0.5, 0.1]]), s(HOLD, 5, [[0.4, 0.15]]), s(HOLD_PRE, 5, [[0.55, 0.05]])]),
    layer('sides', 'accent', [dark, s(EIGHTH_STABS, 1, [[0, 0.5]], { aimMode: 'scatter', aimRate: '8th', color: 'a' })]),
    layer('centers', 'accent', [dark, s(STABS, 'sheet', [[0, 0.5]], { width: 1.2, color: 'a' })]),
  ]),
  pattern('breakdownSparse', 'Breakdown Sparse', 'low', 8, [
    layer('floorEnds', 'base', [s(HOLD, 1, [[0.6, 0.6], [0.2, 0.95], [0.6, 0.6]], { aimMode: 'sweep', aimRate: 'bar' })]),
    layer('topCenter', 'base', [s(HOLD, 1, [[0, 0]]), s(HOLD, 1, [[0, 0]]), s(HOLD, 1, [[0, 0]]), s(HOLD_PRE, 3, [[0, 0]])]),
  ]),
  pattern('crownPulse', 'Crown Pulse', 'mid', 8, [
    layer('top', 'base', [s(STABS_8, 1, [[0.4, 0.2]]), s(STABS_8, 3, [[0.4, 0.2]]), s(STABS_8, 6, [[0.4, 0.2]]), s(FILL, 6, [[0.4, 0.2], [0.6, 0.1]], { color: 'alt' })]),
    layer('floorCenter', 'accent', [s(HOLD, 9, [[0, 0.95]], { width: 1.4, color: 'a' })]),
  ]),
  pattern('mirrorWorld', 'Mirror World', 'high', 8, [
    layer('topEven', 'base', [s(HOLD, 3, [[0.08, 0.5, 'rel']]), s(HOLD, 3, [[-0.08, 0.5, 'rel']])]),
    layer('floorEven', 'base', [s(HOLD, 3, [[0.08, 0.5, 'rel']]), s(HOLD, 3, [[-0.08, 0.5, 'rel']])]),
    layer('mid', 'accent', [s(QUARTERS, 1, [[0.4, 0.3], [0.4, 0.7]], { aimRate: 'beat', color: 'alt' })]),
  ]),
  pattern('crossfire', 'Crossfire', 'high', 4, [
    layer('sidesOdd', 'base', [s(EIGHTHS, 1, [[-0.6, 0.3], [-0.9, 0.6]], { aimRate: '8th' })]),
    layer('sidesEven', 'base', [s(OFFBEAT, 1, [[-0.9, 0.5], [-0.6, 0.8]], { aimRate: '8th', color: 'a' })]),
    layer('floor', 'accent', [...repeat(3, [s(HOLD, 5, [[0.55, 0.85]])]), s(STUTTER_PRE, 7, [[0.55, 0.85], [0.3, 0.95]], { color: 'w' })]),
  ]),
  pattern('spiralSweep', 'Spiral Sweep', 'mid', 8, [
    layer('topCenter', 'base', [s(HOLD, 6, [[0.6, 0.5], [0.3, 0.9], [-0.2, 0.7], [-0.3, 0.3], [0.2, 0.1]], { aimMode: 'sweep', aimRate: 'beat', width: 0.6 })]),
    layer('floorEnds', 'accent', [s(HOLD, 1, [[-0.3, 0.3], [0.2, 0.1], [0.6, 0.5], [0.3, 0.9], [-0.2, 0.7]], { aimMode: 'sweep', aimRate: 'beat', color: 'a' })]),
  ]),
  pattern('strobeWall', 'Strobe Wall', 'high', 2, [
    layer('floor', 'base', [s(SIXTEENTHS, 5, [[0.5, 0.85]], { color: 'w' }), s('x.x.x.x.xxxxxxxx', 7, [[0.5, 0.85]], { color: 'w' })]),
    layer('top', 'base', [s(SIXTEENTHS, 5, [[0.5, 0.15]], { color: 'w' }), s('x.x.x.x.xxxxxxxx', 7, [[0.5, 0.15]], { color: 'w' })]),
    layer('mid', 'accent', [s(EIGHTH_STABS, 'sheet', [[0, 0.5, 'rel']], { width: 0.4 })]),
  ]),
  pattern('syncopatedHits', 'Syncopated Hits', 'mid', 8, [
    layer('floor', 'base', [s(HOLD, 4, [[0.5, 0.85]]), s(HOLD, 4, [[0.6, 0.8]])]),
    layer('top', 'accent', [s(TRESILLO, 3, [[0.4, 0.2]], { aimMode: 'scatter', color: 'a' }), s(TRESILLO_STABS, 3, [[0.4, 0.2]], { aimMode: 'scatter', color: 'a' })]),
  ]),
  pattern('cathedral', 'Cathedral', 'low', 16, [
    layer('top', 'base', [
      ...repeat(4, [s(HOLD, 5, [[0.3, 0.1], [0.45, 0.15], [0.3, 0.1]], { aimMode: 'sweep', aimRate: 'bar' })]),
      ...repeat(4, [s(HOLD, 7, [[0.4, 0.1], [0.55, 0.18], [0.4, 0.1]], { aimMode: 'sweep', aimRate: 'bar' })]),
      ...repeat(4, [s(HOLD, 5, [[0.3, 0.1], [0.45, 0.15], [0.3, 0.1]], { aimMode: 'sweep', aimRate: 'bar', color: 'a' })]),
      ...repeat(3, [s(HOLD, 7, [[0.4, 0.1]])]),
      s(HOLD_PRE, 9, [[0.4, 0.1]], { width: 1.2 }),
    ]),
    layer('mid', 'accent', [...repeat(8, [dark]), ...repeat(8, [s(HOLD, 'sheet', [[0, 0.8, 'rel']], { width: 0.4 })])]),
  ]),
  pattern('laserRain', 'Laser Rain', 'mid', 4, [
    layer('top', 'base', [
      s(CHASE_TICK, 1, [[0, 0, 'rel']], { chase: 1, chaseMode: 'across' }),
      s(CHASE_TICK, 1, [[0, 0, 'rel']], { chase: 1, chaseMode: 'across' }),
      s(CHASE_TICK, 3, [[0, 0, 'rel']], { chase: 1, chaseMode: 'across', orient: 'v', width: 0.2 }),
      s(SIXTEENTHS, 1, [[0, 0, 'rel']], { color: 'w' }),
    ]),
    layer('floorCenter', 'accent', [s(DOWNBEAT, 6, [[0, 0.95]], { width: 0.8, color: 'a' })]),
  ]),
  pattern('zigzagRunner', 'Zigzag Runner', 'mid', 8, [
    layer('mid', 'base', [
      s(EIGHTHS, 1, [[0.1, 0.3, 'rel'], [-0.1, 0.7, 'rel']], { aimRate: '8th' }),
      s(EIGHTHS, 3, [[0.1, 0.3, 'rel'], [-0.1, 0.7, 'rel']], { aimRate: '8th' }),
    ]),
    layer('floor', 'accent', [s(HOLD, 3, [[0.5, 0.9]], { color: 'a' }), s(HOLD_PRE, 3, [[0.5, 0.9]], { color: 'a' })]),
  ]),
  pattern('twinTowers', 'Twin Towers', 'mid', 8, [
    layer('sides', 'base', [s(HOLD, 6, [[0.85, 0.5]], { orient: 'v', width: 0.8 }), s(HOLD, 6, [[0.7, 0.5]], { orient: 'v', width: 0.8 })]),
    layer('floorCenter', 'accent', [s(DOWNBEAT, 'sheet', [[0, 1]], { width: 0.9, color: 'a' }), s(STABS, 'sheet', [[0, 1]], { width: 0.9, color: 'a' })]),
  ]),
  pattern('afterglow', 'Afterglow', 'low', 8, [
    layer('floorInner', 'base', [s(HOLD, 1, [[0.15, 0.95]]), s(HOLD, 1, [[0.25, 0.92]]), s(HOLD, 1, [[0.15, 0.95]]), s(HOLD, 3, [[0.2, 0.95]])]),
    layer('topEnds', 'accent', [dark, dark, dark, s(LAST_BEAT, 1, [[0.2, 0.2]], { color: 'w' })]),
  ]),
  pattern('phraseStory', 'Phrase Story', 'high', 16, [
    layer('floor', 'base', [
      ...repeat(4, [s(HOLD, 1, [[0.4, 0.9]])]),
      ...repeat(3, [s(QUARTERS, 3, [[0.4, 0.9], [0.6, 0.8]])]),
      s(SIXTEENTHS, 3, [[0.3, 0.9]]),
      ...repeat(4, [s(HOLD, 7, [[0.55, 0.85]], { width: 1.1 })]),
      ...repeat(3, [s(EIGHTHS, 5, [[0.5, 0.85], [0.7, 0.75]], { aimRate: 'beat' })]),
      s(FILL, 5, [[0.5, 0.85]], { aimMode: 'scatter', color: 'w' }),
    ]),
    layer('top', 'accent', [
      ...repeat(4, [dark]),
      ...repeat(4, [s(BACKBEAT, 1, [[0.4, 0.2]], { color: 'a' })]),
      s(STUTTER, 5, [[0.3, 0.1], [0.6, 0.2], [0.4, 0.05], [0.5, 0.15]], { color: 'alt' }),
      ...repeat(3, [s(HOLD, 5, [[0.5, 0.1]])]),
      ...repeat(3, [s(OFFBEAT, 3, [[0.5, 0.15]], { aimMode: 'scatter', color: 'a' })]),
      s(STUTTER_PRE, 6, [[0.4, 0.1]], { color: 'w' }),
    ]),
    layer('sides', 'accent', [...repeat(8, [dark]), ...repeat(4, [s(EIGHTH_STABS, 1, [[0, 0.5]], { aimMode: 'scatter', aimRate: '8th' })]), ...repeat(4, [dark])]),
  ]),
  pattern('offbeatPump', 'Offbeat Pump', 'mid', 4, [
    layer('floor', 'base', [s(OFFBEAT, 3, [[0.5, 0.85]]), s(OFFBEAT, 3, [[0.65, 0.8]]), s(OFFBEAT, 5, [[0.5, 0.85]]), s(GALLOP, 5, [[0.5, 0.85], [0.3, 0.95]])]),
    layer('topOdd', 'accent', [s(BACKBEAT_STABS, 1, [[0.3, 0.1]], { color: 'a' })]),
  ]),
  pattern('gridStep', 'Grid Step', 'mid', 8, [
    layer('mid', 'base', [s(QUARTERS, 1, [[0.2, 0.3], [0.5, 0.3], [0.8, 0.3], [0.8, 0.7], [0.5, 0.7], [0.2, 0.7]], { aimRate: 'beat', color: 'alt' })]),
    layer('floorOdd', 'accent', [s(HOLD, 3, [[0.3, 0.95]]), s(HOLD, 3, [[0.6, 0.9]])]),
    layer('topOdd', 'accent', [dark, dark, dark, s(FILL_8, 3, [[0.4, 0.1], [0.7, 0.2]], { color: 'w' })]),
  ]),
])

export const CINEMA2_AFTERHOURS_PATTERN_IDS: readonly string[] = Object.freeze(CINEMA2_AFTERHOURS_PATTERNS.map(candidate => candidate.id))
export const CINEMA2_AFTERHOURS_DEFAULT_PATTERN_ID = 'wideFan'

const PATTERN_BY_ID = new Map(CINEMA2_AFTERHOURS_PATTERNS.map(candidate => [candidate.id, candidate]))

export function isCinema2AfterhoursPatternId(value: unknown): value is string {
  return typeof value === 'string' && PATTERN_BY_ID.has(value)
}

export function getCinema2AfterhoursPattern(id: string): Cinema2AfterhoursPatternDefinition {
  return PATTERN_BY_ID.get(id) ?? PATTERN_BY_ID.get(CINEMA2_AFTERHOURS_DEFAULT_PATTERN_ID)!
}
