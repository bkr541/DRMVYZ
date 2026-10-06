// Headliner effect presets (docs/HEADLINER_30_POV_Visual_Effects.md, priorities 1–7) and the Design-tab
// parameters each one exposes. The catalog is data only: the Design panel renders it with the standard
// rows and the effect processors read the resolved values, so a control cannot exist without a reader.

import { HEADLINER_ISOLATION_OPTIONS } from './HeadlinerIsolation'
import type { HeadlinerTriggerId } from './HeadlinerTriggers'

export type HeadlinerPresetId =
  | 'motion-echo'
  | 'ghost-trails'
  | 'velocity-smear'
  | 'motion-melt'
  | 'freeze-ghost'
  | 'strobe-clone'
  | 'clone-spread'

/** The four standard Design parent groups. */
export type HeadlinerParameterGroup = 'master' | 'design' | 'effects' | 'palette'

export type HeadlinerParameterValue = number | boolean | string
export type HeadlinerParameterValues = Readonly<Record<string, HeadlinerParameterValue>>

export interface HeadlinerParameterVisibility {
  parameter: string
  /** Shown only while the other parameter holds this value… */
  equals?: HeadlinerParameterValue
  /** …or only while it holds anything else. */
  notEquals?: HeadlinerParameterValue
}

interface HeadlinerParameterBase {
  id: string
  label: string
  group: HeadlinerParameterGroup
  description?: string
  /** Shown only while another parameter of the same preset holds this value (e.g. a ms delay while BPM Sync is off). */
  visibleWhen?: HeadlinerParameterVisibility
}

export interface HeadlinerSliderParameter extends HeadlinerParameterBase {
  kind: 'slider'
  min: number
  max: number
  step: number
  default: number
  format?: 'percent' | 'number' | 'ms' | 'seconds' | 'degrees'
}

export interface HeadlinerToggleParameter extends HeadlinerParameterBase {
  kind: 'toggle'
  default: boolean
}

export interface HeadlinerSelectParameter extends HeadlinerParameterBase {
  kind: 'select'
  default: string
  options: readonly { value: string; label: string }[]
}

export interface HeadlinerColorParameter extends HeadlinerParameterBase {
  kind: 'color'
  default: string
}

/** A one-shot action (Capture Pose…). It has no value and is never saved. */
export interface HeadlinerButtonParameter extends HeadlinerParameterBase {
  kind: 'button'
  trigger: HeadlinerTriggerId
}

export type HeadlinerParameterDefinition =
  | HeadlinerButtonParameter
  | HeadlinerSliderParameter
  | HeadlinerToggleParameter
  | HeadlinerSelectParameter
  | HeadlinerColorParameter

export interface HeadlinerPresetDefinition {
  id: HeadlinerPresetId
  name: string
  description: string
  /** Accent colour of the preset card. */
  tone: string
  parameters: readonly HeadlinerParameterDefinition[]
}

export const HEADLINER_DEFAULT_PRESET_ID: HeadlinerPresetId = 'motion-echo'

export const HEADLINER_GROUP_LABELS: Readonly<Record<HeadlinerParameterGroup, string>> = Object.freeze({
  master: 'Master Controls',
  design: 'Design',
  effects: 'Effects',
  palette: 'Palette',
})

export const HEADLINER_GROUP_ORDER: readonly HeadlinerParameterGroup[] = Object.freeze(['master', 'design', 'effects', 'palette'])

// ── Shared controls ────────────────────────────────────────────────────────────

/** Master Intensity and BPM Sync are standard in every preset's Master Controls; the two reactions follow the other engines. */
const masterControls = (): HeadlinerParameterDefinition[] => [
  {
    id: 'masterIntensity', kind: 'slider', group: 'master', label: 'Master Intensity',
    min: 0, max: 1.5, step: 0.01, default: 1, format: 'percent',
    description: 'Overall strength of the effect. 0% is the clean camera; 100% is the authored look.',
  },
  {
    id: 'bpmSync', kind: 'toggle', group: 'master', label: 'BPM Sync', default: true,
    description: 'On: timing locks to the loaded track’s BPM and beat grid. Off: it runs at a steady 120 BPM.',
  },
  {
    id: 'musicReactivity', kind: 'slider', group: 'master', label: 'Music Reactivity',
    min: 0, max: 1, step: 0.01, default: 0.5, format: 'percent',
    description: 'How strongly the music’s energy swells the effect.',
  },
  {
    id: 'kickReactivity', kind: 'slider', group: 'master', label: 'Kick Reactivity',
    min: 0, max: 1, step: 0.01, default: 0.5, format: 'percent',
    description: 'How hard each kick drum hit punches the effect.',
  },
]

const BLEND_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'screen', label: 'Screen' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'add', label: 'Add' },
  { value: 'difference', label: 'Difference' },
] as const

export const HEADLINER_BLEND_OPERATIONS: Readonly<Record<string, GlobalCompositeOperation>> = Object.freeze({
  normal: 'source-over',
  screen: 'screen',
  lighten: 'lighten',
  add: 'lighter',
  difference: 'difference',
})

const blendMode = (fallback: string): HeadlinerParameterDefinition => ({
  id: 'blendMode', kind: 'select', group: 'design', label: 'Blend Mode', default: fallback,
  options: BLEND_OPTIONS,
  description: 'How the effect layer mixes with the live picture.',
})

const COLOR_MODE_OPTIONS = [
  { value: 'original', label: 'Original' },
  { value: 'tint', label: 'Tint' },
  { value: 'gradient', label: 'Gradient' },
] as const

const paletteControls = (subject: string, gradientNote: string): HeadlinerParameterDefinition[] => [
  {
    id: 'colorMode', kind: 'select', group: 'palette', label: 'Color Mode', default: 'original',
    options: COLOR_MODE_OPTIONS,
    description: `Original keeps the camera colours. Tint recolours the ${subject}. Gradient ${gradientNote}`,
  },
  {
    id: 'primaryColor', kind: 'color', group: 'palette', label: 'Color', default: '#67f7ff',
    description: `The ${subject} colour (Tint) or its start colour (Gradient).`,
  },
  {
    id: 'secondaryColor', kind: 'color', group: 'palette', label: 'Gradient End Color', default: '#ff4fd8',
    visibleWhen: { parameter: 'colorMode', equals: 'gradient' },
  },
  {
    id: 'tintAmount', kind: 'slider', group: 'palette', label: 'Color Amount',
    min: 0, max: 1, step: 0.01, default: 0.7, format: 'percent',
    description: 'How far the camera colours move toward the chosen colours.',
  },
]

const SPACING_OPTIONS = [
  { value: '0.0625', label: '1/16 beat' },
  { value: '0.125', label: '1/8 beat' },
  { value: '0.25', label: '1/4 beat' },
  { value: '0.5', label: '1/2 beat' },
  { value: '1', label: '1 beat' },
] as const

const TRAIL_BEAT_OPTIONS = [
  { value: '0.25', label: '1/4 beat' },
  { value: '0.5', label: '1/2 beat' },
  { value: '1', label: '1 beat' },
  { value: '2', label: '2 beats' },
  { value: '4', label: '4 beats' },
] as const

// ── Presets ────────────────────────────────────────────────────────────────────

const MOTION_ECHO: HeadlinerPresetDefinition = {
  id: 'motion-echo',
  name: 'Motion Echo',
  description: 'Leaves semi-transparent copies of your recent poses behind you, like temporal clones.',
  tone: '#4ac7db',
  parameters: [
    ...masterControls(),
    {
      id: 'echoCount', kind: 'slider', group: 'design', label: 'Echo Count',
      min: 1, max: 12, step: 1, default: 5, format: 'number',
      description: 'How many previous poses stay on screen.',
    },
    {
      id: 'echoSpacingBeats', kind: 'select', group: 'design', label: 'Echo Spacing', default: '0.25',
      options: SPACING_OPTIONS, visibleWhen: { parameter: 'bpmSync', equals: true },
      description: 'Time between clones, as a fraction of a beat.',
    },
    {
      id: 'echoDelayMs', kind: 'slider', group: 'design', label: 'Echo Delay',
      min: 30, max: 500, step: 5, default: 130, format: 'ms',
      visibleWhen: { parameter: 'bpmSync', equals: false },
      description: 'Time between clones.',
    },
    {
      id: 'echoOpacity', kind: 'slider', group: 'design', label: 'Echo Opacity',
      min: 0, max: 1, step: 0.01, default: 0.55, format: 'percent',
      description: 'Opacity of the newest clone.',
    },
    {
      id: 'echoFalloff', kind: 'slider', group: 'design', label: 'Echo Falloff',
      min: 0.3, max: 0.98, step: 0.01, default: 0.78, format: 'percent',
      description: 'How much each older clone fades relative to the one before it.',
    },
    blendMode('normal'),
    {
      id: 'motionOnly', kind: 'slider', group: 'effects', label: 'Motion Only',
      min: 0, max: 1, step: 0.01, default: 0, format: 'percent',
      description: 'Confines the clones to the parts of the picture that are moving.',
    },
    {
      id: 'echoDrift', kind: 'slider', group: 'effects', label: 'Echo Drift',
      min: 0, max: 1, step: 0.01, default: 0, format: 'percent',
      description: 'Pushes each older clone further along the drift direction.',
    },
    {
      id: 'driftAngle', kind: 'slider', group: 'effects', label: 'Drift Direction',
      min: 0, max: 360, step: 1, default: 270, format: 'degrees',
        description: 'Direction of the drift (270° is upward).',
    },
    {
      id: 'echoZoom', kind: 'slider', group: 'effects', label: 'Echo Zoom',
      min: -0.2, max: 0.2, step: 0.005, default: 0, format: 'number',
      description: 'Grows (positive) or shrinks (negative) each older clone.',
    },
    ...paletteControls('clones', 'blends from the start colour on the newest clone to the end colour on the oldest.'),
  ],
}

const GHOST_TRAILS: HeadlinerPresetDefinition = {
  id: 'ghost-trails',
  name: 'Ghost Trails',
  description: 'Soft vapor streaks follow whatever moves. Fast gestures leave long trails; stillness stays clean.',
  tone: '#6b4cff',
  parameters: [
    ...masterControls(),
    {
      id: 'trailBeats', kind: 'select', group: 'design', label: 'Trail Length', default: '1',
      options: TRAIL_BEAT_OPTIONS, visibleWhen: { parameter: 'bpmSync', equals: true },
      description: 'How long a trail takes to fade to half, in beats.',
    },
    {
      id: 'trailSeconds', kind: 'slider', group: 'design', label: 'Trail Length',
      min: 0.1, max: 3, step: 0.05, default: 0.6, format: 'seconds',
      visibleWhen: { parameter: 'bpmSync', equals: false },
      description: 'How long a trail takes to fade to half.',
    },
    {
      id: 'speedBoost', kind: 'slider', group: 'design', label: 'Speed Boost',
      min: 0, max: 1, step: 0.01, default: 0.6, format: 'percent',
      description: 'How much faster movement stretches the trails.',
    },
    {
      id: 'ghostOpacity', kind: 'slider', group: 'design', label: 'Ghost Opacity',
      min: 0, max: 1, step: 0.01, default: 0.7, format: 'percent',
      description: 'Opacity of the trails over the live picture.',
    },
    blendMode('screen'),
    {
      id: 'motionSensitivity', kind: 'slider', group: 'effects', label: 'Motion Sensitivity',
      min: 0, max: 1, step: 0.01, default: 0.6, format: 'percent',
      description: 'How little movement it takes to leave a trail.',
    },
    {
      id: 'softness', kind: 'slider', group: 'effects', label: 'Vapor Softness',
      min: 0, max: 1, step: 0.01, default: 0.4, format: 'percent',
      description: 'How quickly trails blur into vapor as they age.',
    },
    {
      id: 'vaporRise', kind: 'slider', group: 'effects', label: 'Vapor Rise',
      min: -1, max: 1, step: 0.01, default: 0.15, format: 'number',
      description: 'Floats the trails upward (positive) or sinks them (negative).',
    },
    ...paletteControls('trails', 'shifts the trails from the start colour toward the end colour as they age.'),
  ],
}

const SMEAR_QUALITY_OPTIONS = [
  { value: '6', label: 'Low' },
  { value: '10', label: 'Medium' },
  { value: '16', label: 'High' },
] as const

const VELOCITY_SMEAR: HeadlinerPresetDefinition = {
  id: 'velocity-smear',
  name: 'Velocity Smear',
  description: 'Stretches the picture along the direction and speed of your movement: throw an arm right and it smears right.',
  tone: '#ff4fd8',
  parameters: [
    ...masterControls(),
    {
      id: 'smearLength', kind: 'slider', group: 'design', label: 'Smear Length',
      min: 0, max: 1, step: 0.01, default: 0.5, format: 'percent',
      description: 'How far fast movement is stretched.',
    },
    {
      id: 'smearDirection', kind: 'select', group: 'design', label: 'Smear Direction', default: 'with',
      options: [
        { value: 'with', label: 'With Motion' },
        { value: 'behind', label: 'Behind Motion' },
        { value: 'both', label: 'Both Ways' },
      ],
      description: 'Stretch ahead of the movement, trail behind it, or both.',
    },
    {
      id: 'smearOpacity', kind: 'slider', group: 'design', label: 'Smear Opacity',
      min: 0, max: 1, step: 0.01, default: 0.8, format: 'percent',
    },
    blendMode('normal'),
    {
      id: 'motionThreshold', kind: 'slider', group: 'effects', label: 'Motion Threshold',
      min: 0, max: 1, step: 0.01, default: 0.25, format: 'percent',
      description: 'Movement slower than this is left untouched.',
    },
    {
      id: 'smearSoftness', kind: 'slider', group: 'effects', label: 'Smear Softness',
      min: 0, max: 1, step: 0.01, default: 0.35, format: 'percent',
      description: 'Blurs the streaks together so they look continuous.',
    },
    {
      id: 'smearQuality', kind: 'select', group: 'effects', label: 'Smear Quality', default: '10',
      options: SMEAR_QUALITY_OPTIONS,
      description: 'Samples per streak. Higher is smoother and costs more.',
    },
    {
      id: 'beatPump', kind: 'slider', group: 'effects', label: 'Beat Pump',
      min: 0, max: 1, step: 0.01, default: 0, format: 'percent',
      description: 'Lengthens the smear on every beat (locked to the track with BPM Sync on).',
    },
    ...paletteControls('streaks', 'blends the streaks from the start colour on the left of the picture to the end colour on the right.'),
  ],
}

// ── Presets 4–7 ────────────────────────────────────────────────────────────────

const ISOLATION_NOTE = 'Full Frame copies the whole picture. Moving Parts keeps only what is moving. Learned Background keeps whatever differs from a learned picture of the empty scene (use Relearn Background with the performer out of frame).'

const isolationControls = (): HeadlinerParameterDefinition[] => [
  {
    id: 'isolation', kind: 'select', group: 'effects', label: 'Isolate Performer', default: 'off',
    options: HEADLINER_ISOLATION_OPTIONS, description: ISOLATION_NOTE,
  },
  {
    id: 'isolationStrength', kind: 'slider', group: 'effects', label: 'Isolation Strength',
    min: 0, max: 1, step: 0.01, default: 0.6, format: 'percent',
    visibleWhen: { parameter: 'isolation', notEquals: 'off' },
    description: 'How little difference it takes to count as the performer.',
  },
  {
    id: 'relearnBackground', kind: 'button', group: 'effects', label: 'Relearn Background', trigger: 'relearn-background',
    visibleWhen: { parameter: 'isolation', equals: 'background' },
    description: 'Learns the empty scene again. Step out of frame first.',
  },
]

const MOTION_MELT: HeadlinerPresetDefinition = {
  id: 'motion-melt',
  name: 'Motion Melt',
  description: 'Whatever moves turns to liquid: it drags, stretches and drips, then settles back while still areas stay intact.',
  tone: '#ff8a3d',
  parameters: [
    ...masterControls(),
    {
      id: 'meltAmount', kind: 'slider', group: 'design', label: 'Melt Amount',
      min: 0, max: 1, step: 0.01, default: 0.6, format: 'percent',
      description: 'How far moving areas are dragged. Stronger movement melts heavier.',
    },
    {
      id: 'viscosity', kind: 'slider', group: 'design', label: 'Viscosity',
      min: 0, max: 1, step: 0.01, default: 0.5, format: 'percent',
      description: 'How slowly melted areas settle back. Low is runny; high stays melted.',
    },
    {
      id: 'drip', kind: 'slider', group: 'design', label: 'Drip',
      min: 0, max: 1, step: 0.01, default: 0.35, format: 'percent',
      description: 'Pulls melted areas downward.',
    },
    blendMode('normal'),
    {
      id: 'motionThreshold', kind: 'slider', group: 'effects', label: 'Motion Threshold',
      min: 0, max: 1, step: 0.01, default: 0.2, format: 'percent',
      description: 'Movement slower than this does not melt.',
    },
    {
      id: 'fluidity', kind: 'slider', group: 'effects', label: 'Fluidity',
      min: 0, max: 1, step: 0.01, default: 0.5, format: 'percent',
      description: 'Smooths the melt into a continuous liquid instead of blocks.',
    },
    {
      id: 'beatSurge', kind: 'slider', group: 'effects', label: 'Beat Surge',
      min: 0, max: 1, step: 0.01, default: 0, format: 'percent',
      description: 'Melts harder on every beat (locked to the track with BPM Sync on).',
    },
    ...paletteControls('melt', 'blends the melt from the start colour at the top of the picture to the end colour at the bottom.'),
  ],
}

const AUTO_CAPTURE_OPTIONS = [
  { value: '0', label: 'Off' },
  { value: '1', label: 'Every Beat' },
  { value: '2', label: 'Every 2 Beats' },
  { value: '4', label: 'Every Bar' },
] as const

const GHOST_LIFE_OPTIONS = [
  { value: '0', label: 'Until Cleared' },
  { value: '4', label: '4 beats' },
  { value: '8', label: '8 beats' },
  { value: '16', label: '16 beats' },
] as const

const FREEZE_GHOST: HeadlinerPresetDefinition = {
  id: 'freeze-ghost',
  name: 'Freeze Ghost',
  description: 'Capture your pose and leave it frozen in the scene while you keep moving. Capture again to build a group of ghosts.',
  tone: '#9be7ff',
  parameters: [
    ...masterControls(),
    {
      id: 'capturePose', kind: 'button', group: 'design', label: 'Capture Pose', trigger: 'capture-pose',
      description: 'Freezes the current picture as a ghost.',
    },
    {
      id: 'clearGhosts', kind: 'button', group: 'design', label: 'Clear Ghosts', trigger: 'clear-ghosts',
      description: 'Removes every frozen ghost.',
    },
    {
      id: 'autoCapture', kind: 'select', group: 'design', label: 'Auto Capture', default: '0',
      options: AUTO_CAPTURE_OPTIONS,
      description: 'Also captures a ghost on a steady beat (the track’s beat with BPM Sync on).',
    },
    {
      id: 'maxGhosts', kind: 'slider', group: 'design', label: 'Max Ghosts',
      min: 1, max: 8, step: 1, default: 4, format: 'number',
      description: 'How many ghosts stay. The oldest is dropped when this is exceeded.',
    },
    {
      id: 'ghostOpacity', kind: 'slider', group: 'design', label: 'Ghost Opacity',
      min: 0, max: 1, step: 0.01, default: 0.6, format: 'percent',
    },
    blendMode('normal'),
    {
      id: 'ghostLife', kind: 'select', group: 'effects', label: 'Ghost Life', default: '0',
      options: GHOST_LIFE_OPTIONS,
      description: 'How long a ghost lasts before it fades away on its own.',
    },
    ...isolationControls(),
    ...paletteControls('ghosts', 'shifts the ghosts from the start colour on the newest to the end colour on the oldest.'),
  ],
}

const CAPTURE_SOURCE_OPTIONS = [
  { value: 'kick', label: 'Music Kicks' },
  { value: 'beat', label: 'Every Beat' },
  { value: 'half', label: 'Every Half Beat' },
] as const

const RESET_OPTIONS = [
  { value: '0', label: 'Never' },
  { value: '1', label: 'Every Bar' },
  { value: '2', label: 'Every 2 Bars' },
  { value: '4', label: 'Every 4 Bars' },
] as const

const CLONE_LIFE_OPTIONS = [
  { value: '2', label: '2 beats' },
  { value: '4', label: '4 beats' },
  { value: '8', label: '8 beats' },
  { value: '16', label: '16 beats' },
  { value: '0', label: 'Until Reset' },
] as const

const STROBE_CLONE: HeadlinerPresetDefinition = {
  id: 'strobe-clone',
  name: 'Strobe Clone',
  description: 'Captures a new clone only on musical events: kicks add clones, snares add a different style, downbeats reset, builds speed it up.',
  tone: '#ffd23f',
  parameters: [
    ...masterControls(),
    {
      id: 'captureSource', kind: 'select', group: 'design', label: 'Capture On', default: 'kick',
      options: CAPTURE_SOURCE_OPTIONS,
      description: 'The event that captures a clone. Music Kicks needs a playing track; the beat options follow the track’s beat with BPM Sync on, or a steady 120 BPM.',
    },
    {
      id: 'maxClones', kind: 'slider', group: 'design', label: 'Max Clones',
      min: 1, max: 10, step: 1, default: 6, format: 'number',
      description: 'How many clones stay. The oldest is dropped when this is exceeded.',
    },
    {
      id: 'cloneOpacity', kind: 'slider', group: 'design', label: 'Clone Opacity',
      min: 0, max: 1, step: 0.01, default: 0.55, format: 'percent',
      description: 'Opacity of the newest clone; older ones fade as they age.',
    },
    {
      id: 'cloneLife', kind: 'select', group: 'design', label: 'Clone Life', default: '8',
      options: CLONE_LIFE_OPTIONS,
      description: 'How long a clone lasts before it fades away.',
    },
    blendMode('normal'),
    {
      id: 'snareClones', kind: 'toggle', group: 'effects', label: 'Snare Clones', default: true,
      description: 'A snare hit captures a clone in the alternate style instead of ignoring it.',
    },
    {
      id: 'altStyle', kind: 'select', group: 'effects', label: 'Snare Style', default: 'color',
      options: [
        { value: 'color', label: 'Colour Shift' },
        { value: 'mirror', label: 'Mirrored' },
        { value: 'negative', label: 'Negative' },
      ],
      visibleWhen: { parameter: 'snareClones', equals: true },
      description: 'How snare clones look different from kick clones.',
    },
    {
      id: 'resetEvery', kind: 'select', group: 'effects', label: 'Reset On Downbeat', default: '4',
      options: RESET_OPTIONS,
      description: 'Clears all clones on the downbeat of every bar, 2 bars or 4 bars.',
    },
    {
      id: 'buildAcceleration', kind: 'slider', group: 'effects', label: 'Build Acceleration',
      min: 0, max: 1, step: 0.01, default: 0.7, format: 'percent',
      description: 'During a build-up in the music, captures come faster and faster.',
    },
    ...isolationControls(),
    ...paletteControls('clones', 'shifts the clones from the start colour on the newest to the end colour on the oldest.'),
    {
      id: 'altColor', kind: 'color', group: 'palette', label: 'Snare Color', default: '#ff4fd8',
      visibleWhen: { parameter: 'altStyle', equals: 'color' },
      description: 'The colour of snare clones when Snare Style is Colour Shift.',
    },
  ],
}

const CLONE_SPREAD: HeadlinerPresetDefinition = {
  id: 'clone-spread',
  name: 'Clone Spread',
  description: 'Duplicates you into several copies laid out side by side, stacked, in a ring or mirrored, spreading and collapsing with the music.',
  tone: '#7affb0',
  parameters: [
    ...masterControls(),
    {
      id: 'layout', kind: 'select', group: 'design', label: 'Layout', default: 'horizontal',
      options: [
        { value: 'horizontal', label: 'Horizontal' },
        { value: 'vertical', label: 'Vertical' },
        { value: 'radial', label: 'Radial' },
        { value: 'mirror', label: 'Mirrored' },
      ],
      description: 'How the copies are arranged around you.',
    },
    {
      id: 'copies', kind: 'slider', group: 'design', label: 'Copies',
      min: 1, max: 8, step: 1, default: 4, format: 'number',
      description: 'How many copies are added to the live picture.',
    },
    {
      id: 'spread', kind: 'slider', group: 'design', label: 'Spread',
      min: 0, max: 1, step: 0.01, default: 0.5, format: 'percent',
      description: 'How far the copies sit from the live picture.',
    },
    {
      id: 'copyScale', kind: 'slider', group: 'design', label: 'Copy Size',
      min: 0.3, max: 1, step: 0.01, default: 0.7, format: 'percent',
      description: 'Size of each copy relative to the live picture.',
    },
    {
      id: 'copyOpacity', kind: 'slider', group: 'design', label: 'Copy Opacity',
      min: 0, max: 1, step: 0.01, default: 0.75, format: 'percent',
    },
    blendMode('normal'),
    {
      id: 'spreadMotion', kind: 'select', group: 'effects', label: 'Motion', default: 'pulse',
      options: [
        { value: 'static', label: 'Still' },
        { value: 'pulse', label: 'Beat Breathe' },
        { value: 'kick', label: 'Kick Burst' },
        { value: 'shift', label: 'Shift' },
      ],
      description: 'Still holds the layout. Beat Breathe spreads out and collapses back every beat. Kick Burst throws the copies out on each kick. Shift moves them to a new position on a beat or bar.',
    },
    {
      id: 'motionAmount', kind: 'slider', group: 'effects', label: 'Motion Amount',
      min: 0, max: 1, step: 0.01, default: 0.6, format: 'percent',
      description: 'How far the copies travel during the motion.',
    },
    {
      id: 'shiftEvery', kind: 'select', group: 'effects', label: 'Shift Every', default: 'bar',
      options: [{ value: 'beat', label: 'Beat' }, { value: 'bar', label: 'Bar' }],
      visibleWhen: { parameter: 'spreadMotion', equals: 'shift' },
      description: 'How often the copies move to their next position.',
    },
    ...isolationControls(),
    ...paletteControls('copies', 'shifts the copies from the start colour on the first to the end colour on the last.'),
  ],
}

export const HEADLINER_PRESETS: readonly HeadlinerPresetDefinition[] = Object.freeze([
  MOTION_ECHO,
  GHOST_TRAILS,
  VELOCITY_SMEAR,
  MOTION_MELT,
  FREEZE_GHOST,
  STROBE_CLONE,
  CLONE_SPREAD,
])

export function getHeadlinerPreset(id: unknown): HeadlinerPresetDefinition {
  return HEADLINER_PRESETS.find(preset => preset.id === id) ?? HEADLINER_PRESETS[0]
}

export function isHeadlinerPresetId(value: unknown): value is HeadlinerPresetId {
  return HEADLINER_PRESETS.some(preset => preset.id === value)
}

/**
 * Clean Playback is the plain camera with no effect, shown in settings as a null preset. A click on the
 * active preset toggles it off to Clean Playback; any other click selects that preset (same rule as CANVAS).
 */
export function resolveHeadlinerPresetClick(clickedId: HeadlinerPresetId, activeId: HeadlinerPresetId | null): HeadlinerPresetId | null {
  return clickedId === activeId ? null : clickedId
}

// ── Values ─────────────────────────────────────────────────────────────────────

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

function coerceValue(definition: Exclude<HeadlinerParameterDefinition, HeadlinerButtonParameter>, value: unknown): HeadlinerParameterValue {
  switch (definition.kind) {
    case 'slider': {
      const number = typeof value === 'number' && Number.isFinite(value) ? value : definition.default
      const clamped = Math.min(definition.max, Math.max(definition.min, number))
      // Snap to the step so stored values stay on the slider's grid.
      const snapped = definition.min + Math.round((clamped - definition.min) / definition.step) * definition.step
      return Number(Math.min(definition.max, Math.max(definition.min, snapped)).toFixed(6))
    }
    case 'toggle':
      return typeof value === 'boolean' ? value : definition.default
    case 'select':
      return typeof value === 'string' && definition.options.some(option => option.value === value) ? value : definition.default
    case 'color':
      return typeof value === 'string' && HEX_COLOR.test(value) ? value.toLowerCase() : definition.default
  }
}

/** Every parameter of the preset, with stored overrides validated and the rest at their defaults. */
export function resolveHeadlinerParameters(presetId: unknown, overrides?: unknown): HeadlinerParameterValues {
  const record = overrides && typeof overrides === 'object' && !Array.isArray(overrides)
    ? overrides as Record<string, unknown>
    : {}
  const values: Record<string, HeadlinerParameterValue> = {}
  for (const definition of getHeadlinerPreset(presetId).parameters) {
    if (definition.kind === 'button') continue
    values[definition.id] = coerceValue(definition, record[definition.id])
  }
  return values
}

/** Keeps only valid overrides of known presets; used when settings are loaded or patched. */
export function normalizeHeadlinerParameterOverrides(value: unknown): Record<string, Record<string, HeadlinerParameterValue>> {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const result: Record<string, Record<string, HeadlinerParameterValue>> = {}
  for (const preset of HEADLINER_PRESETS) {
    const stored = record[preset.id]
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) continue
    const source = stored as Record<string, unknown>
    const kept: Record<string, HeadlinerParameterValue> = {}
    for (const definition of preset.parameters) {
      if (definition.kind === 'button' || !(definition.id in source)) continue
      const coerced = coerceValue(definition, source[definition.id])
      if (coerced !== definition.default) kept[definition.id] = coerced
    }
    if (Object.keys(kept).length > 0) result[preset.id] = kept
  }
  return result
}

export function isHeadlinerParameterVisible(
  definition: HeadlinerParameterDefinition,
  values: HeadlinerParameterValues,
): boolean {
  const rule = definition.visibleWhen
  if (rule) {
    const current = values[rule.parameter]
    if (rule.equals !== undefined && current !== rule.equals) return false
    if (rule.notEquals !== undefined && current === rule.notEquals) return false
  }
  // The colour controls only matter once a colour mode other than Original is chosen.
  if (definition.group === 'palette' && definition.id !== 'colorMode' && values.colorMode === 'original') return false
  return true
}

export function getHeadlinerNumber(values: HeadlinerParameterValues, id: string, fallback = 0): number {
  const value = values[id]
  return typeof value === 'number' ? value : fallback
}

export function getHeadlinerString(values: HeadlinerParameterValues, id: string, fallback = ''): string {
  const value = values[id]
  return typeof value === 'string' ? value : fallback
}

export function getHeadlinerBoolean(values: HeadlinerParameterValues, id: string, fallback = false): boolean {
  const value = values[id]
  return typeof value === 'boolean' ? value : fallback
}
