import {
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorFixtureKind,
  type LaserDmxShowDirectorFixturePatch,
} from './ReactTypes'

export type LaserDmxShowDirectorTriggerRecipe =
  | 'alwaysOn'
  | 'pulseEveryBeat'
  | 'pulseEveryHalfBeat'
  | 'pulseEveryBar'
  | 'flashEvery4Bars'
  | 'hitOnKick'
  | 'hitOnSnareTransient'
  | 'turnOnDuringBuild'
  | 'turnOnDuringDrop'
  | 'fireAtDrop'
  | 'reactToEnergy'
  | 'reactToHighs'
  | 'reactToMids'
  | 'reactToBass'

export const TRIGGER_RECIPE_OPTIONS: Array<{ value: LaserDmxShowDirectorTriggerRecipe; label: string }> = [
  { value: 'alwaysOn', label: 'Always On' },
  { value: 'pulseEveryBeat', label: 'Pulse Every Beat' },
  { value: 'pulseEveryHalfBeat', label: 'Pulse Every Half Beat' },
  { value: 'pulseEveryBar', label: 'Pulse Every Bar' },
  { value: 'flashEvery4Bars', label: 'Flash Every 4 Bars' },
  { value: 'hitOnKick', label: 'Hit on Kick' },
  { value: 'hitOnSnareTransient', label: 'Hit on Snare / Transient' },
  { value: 'turnOnDuringBuild', label: 'Turn On During Build' },
  { value: 'turnOnDuringDrop', label: 'Turn On During Drop' },
  { value: 'fireAtDrop', label: 'Fire at Drop' },
  { value: 'reactToEnergy', label: 'React to Energy' },
  { value: 'reactToHighs', label: 'React to Highs' },
  { value: 'reactToMids', label: 'React to Mids' },
  { value: 'reactToBass', label: 'React to Bass' },
]

export const TRIGGER_RECIPE_HINTS: Record<LaserDmxShowDirectorTriggerRecipe, string> = {
  alwaysOn: 'Keeps the fixture alive for steady atmosphere, washes, screens, or preview looks.',
  pulseEveryBeat: 'A clean four-on-the-floor pulse. Great for LED bars, tubes, and simple laser hits.',
  pulseEveryHalfBeat: 'A faster pulse for fills, chases, and busier sections without exposing beat math.',
  pulseEveryBar: 'Fires on each downbeat so the look breathes with the phrase instead of flickering constantly.',
  flashEvery4Bars: 'Big punctuation every 4 bars. Useful for blinders and stage-wide accents.',
  hitOnKick: 'Listens for low-end hits and kicks, then snaps the fixture on briefly.',
  hitOnSnareTransient: 'Listens for snare-like transients and bright impact hits.',
  turnOnDuringBuild: 'Keeps the fixture active while Music Intelligence sees a build section.',
  turnOnDuringDrop: 'Keeps the fixture active while Music Intelligence sees a drop section.',
  fireAtDrop: 'Fires from drop/cue markers for CO₂ jets and single-shot moments.',
  reactToEnergy: 'Fades in when the track energy rises above the show threshold.',
  reactToHighs: 'Responds to hats, air, and bright sparkle in the high band.',
  reactToMids: 'Responds to vocals, synth body, snares, and midrange motion.',
  reactToBass: 'Responds to bass weight without asking DJs to tune a threshold first.',
}

export const RECOMMENDED_TRIGGER_RECIPE_BY_KIND: Record<LaserDmxShowDirectorFixtureKind, LaserDmxShowDirectorTriggerRecipe> = {
  laser:      'turnOnDuringDrop',
  movingHead: 'pulseEveryBar',
  ledBar:     'pulseEveryBeat',
  ledTube:    'pulseEveryBeat',
  strobe:     'hitOnSnareTransient',
  blinder:    'flashEvery4Bars',
  parWash:    'reactToEnergy',
  videoWall:  'turnOnDuringDrop',
  haze:       'alwaysOn',
  co2Jet:     'fireAtDrop',
}

export function triggerRecipeLabel(recipe: LaserDmxShowDirectorTriggerRecipe): string {
  return TRIGGER_RECIPE_OPTIONS.find(option => option.value === recipe)?.label ?? 'Always On'
}

export function triggerPatchForRecipe(recipe: LaserDmxShowDirectorTriggerRecipe): NonNullable<LaserDmxShowDirectorFixturePatch['trigger']> {
  switch (recipe) {
    case 'pulseEveryBeat':
      return { mode: 'beat', quantize: 'beat', retrigger: 'oncePerBeat', beatDivision: 1, fadeInMs: 0, fadeOutMs: 140 }
    case 'pulseEveryHalfBeat':
      return { mode: 'beat', quantize: 'beat', retrigger: 'oncePerBeat', beatDivision: 0.5, fadeInMs: 0, fadeOutMs: 110 }
    case 'pulseEveryBar':
      return { mode: 'bar', quantize: 'bar', retrigger: 'oncePerBar', beatDivision: 1, barInterval: 1, fadeInMs: 0, fadeOutMs: 220 }
    case 'flashEvery4Bars':
      return { mode: 'bar', quantize: 'bar', retrigger: 'oncePerBar', beatDivision: 1, barInterval: 4, fadeInMs: 0, fadeOutMs: 360 }
    case 'hitOnKick':
      return { mode: 'bassHit', quantize: 'none', retrigger: 'allow', audioBand: 'bass', audioThreshold: 0.65, fadeInMs: 0, fadeOutMs: 160 }
    case 'hitOnSnareTransient':
      return { mode: 'snareTransient', quantize: 'none', retrigger: 'allow', audioBand: 'highMid', audioThreshold: 0.58, fadeInMs: 0, fadeOutMs: 120 }
    case 'turnOnDuringBuild':
      return { mode: 'section', quantize: 'section', retrigger: 'allow', sectionTypes: ['build'], fadeInMs: 300, fadeOutMs: 520 }
    case 'turnOnDuringDrop':
      return { mode: 'section', quantize: 'section', retrigger: 'allow', sectionTypes: ['drop'], fadeInMs: 120, fadeOutMs: 380 }
    case 'fireAtDrop':
      return { mode: 'cuePoint', quantize: 'bar', retrigger: 'oncePerBar', cuePointIds: ['drop'], fadeInMs: 0, fadeOutMs: 450 }
    case 'reactToEnergy':
      return { mode: 'energy', quantize: 'none', retrigger: 'allow', energyThreshold: 0.7, fadeInMs: 180, fadeOutMs: 420 }
    case 'reactToHighs':
      return { mode: 'audioBand', quantize: 'none', retrigger: 'allow', audioBand: 'high', audioThreshold: 0.48, fadeInMs: 0, fadeOutMs: 160 }
    case 'reactToMids':
      return { mode: 'audioBand', quantize: 'none', retrigger: 'allow', audioBand: 'mid', audioThreshold: 0.48, fadeInMs: 0, fadeOutMs: 180 }
    case 'reactToBass':
      return { mode: 'audioBand', quantize: 'none', retrigger: 'allow', audioBand: 'bass', audioThreshold: 0.45, fadeInMs: 0, fadeOutMs: 190 }
    case 'alwaysOn':
    default:
      return { mode: 'alwaysOn', quantize: 'beat', retrigger: 'allow', beatDivision: 1, fadeInMs: 0, fadeOutMs: 0 }
  }
}

export function recipeForTriggerConfig(trigger: LaserDmxShowDirectorFixture['trigger']): LaserDmxShowDirectorTriggerRecipe {
  switch (trigger.mode) {
    case 'beat':
      return trigger.beatDivision === 0.5 ? 'pulseEveryHalfBeat' : 'pulseEveryBeat'
    case 'bar':
      return trigger.barInterval >= 4 ? 'flashEvery4Bars' : 'pulseEveryBar'
    case 'section': {
      const sections = new Set(trigger.sectionTypes)
      return sections.has('build') && !sections.has('drop') ? 'turnOnDuringBuild' : 'turnOnDuringDrop'
    }
    case 'cuePoint':
      return 'fireAtDrop'
    case 'bassHit':
      return 'hitOnKick'
    case 'snareTransient':
      return 'hitOnSnareTransient'
    case 'energy':
      return 'reactToEnergy'
    case 'audioBand':
      if (trigger.audioBand === 'high' || trigger.audioBand === 'highMid') return 'reactToHighs'
      if (trigger.audioBand === 'mid' || trigger.audioBand === 'lowMid') return 'reactToMids'
      return 'reactToBass'
    case 'alwaysOn':
    default:
      return 'alwaysOn'
  }
}
