import {
  createDefaultLaserDmxShowDirectorFixture,
  DEFAULT_LASER_DMX_SHOW_DIRECTOR_SETTINGS,
  LASER_DMX_SHOW_DIRECTOR_SCHEMA_VERSION,
  isLaserDmxShowDirectorFixtureKind,
  normalizeLaserDmxShowDirectorFixture,
  normalizeLaserDmxShowDirectorSettings,
  normalizeLaserDmxShowDirectorState,
  type LaserDmxShowDirectorFixtureKind,
  type LaserDmxShowDirectorFixturePatch,
  type LaserDmxShowDirectorSettingsPatch,
  type LaserDmxShowDirectorState,
} from './ReactTypes'

export type LaserDmxShowDirectorTemplateCategory = 'club' | 'festival' | 'drop' | 'led' | 'hits' | 'movement' | 'atmosphere'

export type LaserDmxShowDirectorTemplateFixture = LaserDmxShowDirectorFixturePatch & {
  kind: LaserDmxShowDirectorFixtureKind
}

export interface LaserDmxShowDirectorTemplate {
  id: string
  name: string
  description: string
  category: LaserDmxShowDirectorTemplateCategory
  tags: string[]
  settings?: LaserDmxShowDirectorSettingsPatch
  fixtures: LaserDmxShowDirectorTemplateFixture[]
}

type ShowDirectorRecord = Record<string, unknown>

type TemplateIdFactory = () => string

function isRecord(value: unknown): value is ShowDirectorRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function createTemplateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `show-director-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function grid(columns: number, rows: number): LaserDmxShowDirectorSettingsPatch {
  return { gridSize: { columns, rows }, snapEnabled: true, showLabels: true, showBeams: true, showGrid: true, zoom: 1 }
}

function fx(
  kind: LaserDmxShowDirectorFixtureKind,
  label: string,
  x: number,
  y: number,
  patch: Omit<LaserDmxShowDirectorFixturePatch, 'kind' | 'label' | 'x' | 'y'> = {},
): LaserDmxShowDirectorTemplateFixture {
  return { kind, label, x, y, ...patch }
}

const LASER_CYAN = '#4ac7db'
const LASER_GREEN = '#61d6aa'
const LASER_BLUE = '#4b6dff'
const LASER_MAGENTA = '#c45cff'
const WARM_BLINDER = '#ffd27a'
const STROBE_WHITE = '#f4fbff'
const DROP_RED = '#ff355e'
const CO2_BLUE = '#bdeaff'

export const LASER_DMX_SHOW_DIRECTOR_TEMPLATES = [
  {
    id: 'small-club-rig',
    name: 'Small Club Rig',
    description: 'Balanced starter stage with front LEDs, two lasers, two moving heads, a strobe, a wash, and haze.',
    category: 'club',
    tags: ['starter', 'balanced', 'club'],
    settings: grid(15, 10),
    fixtures: [
      fx('ledBar', 'Front LED Bar L', 4, 8, { rotation: 0, color: LASER_CYAN, trigger: { mode: 'audioBand', audioBand: 'bass', audioThreshold: 0.42 }, component: { ledCellCount: 12, ledDirection: 'leftToRight' } }),
      fx('ledBar', 'Front LED Bar R', 10, 8, { rotation: 0, color: LASER_GREEN, trigger: { mode: 'audioBand', audioBand: 'mid', audioThreshold: 0.4 }, component: { ledCellCount: 12, ledDirection: 'rightToLeft' } }),
      fx('laser', 'Club Laser L', 2, 6, { color: LASER_CYAN, rotation: -18, beam: { targetMode: 'fan', beamSpread: 24, targetX: 7, targetY: 2 }, trigger: { mode: 'beat', beatDivision: 1, fadeOutMs: 150 } }),
      fx('laser', 'Club Laser R', 12, 6, { color: LASER_GREEN, rotation: 198, beam: { targetMode: 'fan', beamSpread: 24, targetX: 7, targetY: 2 }, trigger: { mode: 'beat', beatDivision: 1, fadeOutMs: 150 } }),
      fx('movingHead', 'Moving Head L', 5, 3, { color: LASER_BLUE, rotation: 28, beam: { targetMode: 'sweep', beamSpread: 10, targetX: 7, targetY: 7 }, trigger: { mode: 'bar', barInterval: 2, fadeOutMs: 220 }, component: { movingHeadPanTiltStyle: 'smoothSweep' } }),
      fx('movingHead', 'Moving Head R', 9, 3, { color: LASER_MAGENTA, rotation: 152, beam: { targetMode: 'sweep', beamSpread: 10, targetX: 7, targetY: 7 }, trigger: { mode: 'bar', barInterval: 2, fadeOutMs: 220 }, component: { movingHeadPanTiltStyle: 'smoothSweep' } }),
      fx('strobe', 'Center Strobe', 7, 5, { color: STROBE_WHITE, brightness: 0.95, trigger: { mode: 'snareTransient', audioThreshold: 0.58, fadeOutMs: 110 }, component: { strobeRate: 12 } }),
      fx('parWash', 'Back Wash', 7, 2, { color: '#243dff', brightness: 0.62, beam: { beamSpread: 74, focus: 0.32 }, trigger: { mode: 'section', sectionTypes: ['build', 'drop'], fadeInMs: 360, fadeOutMs: 520 } }),
      fx('haze', 'Soft Haze', 1, 1, { color: CO2_BLUE, brightness: 0.36, trigger: { mode: 'alwaysOn', fadeInMs: 900 }, component: { hazeIntensity: 0.38 } }),
    ],
  },
  {
    id: 'festival-front-beams',
    name: 'Festival Front Beams',
    description: 'Symmetrical front-line lasers and moving heads aimed toward the backline for big-stage sweeps.',
    category: 'festival',
    tags: ['festival', 'frontline', 'symmetry'],
    settings: grid(18, 12),
    fixtures: [
      fx('laser', 'Front Beam 1', 2, 10, { color: LASER_CYAN, rotation: -52, beam: { targetMode: 'cross', beamSpread: 16, targetX: 9, targetY: 2 }, trigger: { mode: 'beat', beatDivision: 0.5, fadeOutMs: 140 } }),
      fx('laser', 'Front Beam 2', 5, 10, { color: LASER_GREEN, rotation: -35, beam: { targetMode: 'fan', beamSpread: 20, targetX: 9, targetY: 2 }, trigger: { mode: 'beat', beatDivision: 1, fadeOutMs: 150 } }),
      fx('laser', 'Front Beam 3', 12, 10, { color: LASER_BLUE, rotation: 215, beam: { targetMode: 'fan', beamSpread: 20, targetX: 9, targetY: 2 }, trigger: { mode: 'beat', beatDivision: 1, fadeOutMs: 150 } }),
      fx('laser', 'Front Beam 4', 15, 10, { color: LASER_MAGENTA, rotation: 232, beam: { targetMode: 'cross', beamSpread: 16, targetX: 9, targetY: 2 }, trigger: { mode: 'beat', beatDivision: 0.5, fadeOutMs: 140 } }),
      fx('movingHead', 'Sweep Head 1', 3, 7, { color: '#8cf7ff', beam: { targetMode: 'sweep', beamSpread: 9, targetX: 9, targetY: 3 }, trigger: { mode: 'bar', barInterval: 1, fadeOutMs: 180 }, component: { movingHeadPanTiltStyle: 'smoothSweep' } }),
      fx('movingHead', 'Sweep Head 2', 14, 7, { color: '#b794ff', beam: { targetMode: 'sweep', beamSpread: 9, targetX: 9, targetY: 3 }, trigger: { mode: 'bar', barInterval: 1, fadeOutMs: 180 }, component: { movingHeadPanTiltStyle: 'smoothSweep' } }),
      fx('parWash', 'Festival Wash L', 0, 4, { color: '#225cff', beam: { beamSpread: 88, focus: 0.28 }, trigger: { mode: 'section', sectionTypes: ['build', 'drop'], fadeInMs: 500 } }),
      fx('parWash', 'Festival Wash R', 17, 4, { color: '#00d9a3', beam: { beamSpread: 88, focus: 0.28 }, trigger: { mode: 'section', sectionTypes: ['build', 'drop'], fadeInMs: 500 } }),
    ],
  },
  {
    id: 'dubstep-drop-lasers',
    name: 'Dubstep Drop Lasers',
    description: 'Quarter-beat laser gates, snare strobes, warm blinders, and CO₂ bursts tuned for heavy drops.',
    category: 'drop',
    tags: ['dubstep', 'drop', 'quarter-beat'],
    settings: grid(15, 10),
    fixtures: [
      fx('laser', 'Drop Gate L', 1, 7, { color: DROP_RED, rotation: -14, beam: { targetMode: 'fan', beamSpread: 42, focus: 0.92, targetX: 7, targetY: 3 }, trigger: { mode: 'beat', beatDivision: 0.25, fadeOutMs: 80 } }),
      fx('laser', 'Drop Gate R', 13, 7, { color: LASER_CYAN, rotation: 194, beam: { targetMode: 'fan', beamSpread: 42, focus: 0.92, targetX: 7, targetY: 3 }, trigger: { mode: 'beat', beatDivision: 0.25, fadeOutMs: 80 } }),
      fx('laser', 'Drop Cross L', 3, 4, { color: LASER_MAGENTA, rotation: -34, beam: { targetMode: 'cross', beamSpread: 14, targetX: 10, targetY: 6 }, trigger: { mode: 'bassHit', audioThreshold: 0.62, fadeOutMs: 100 } }),
      fx('laser', 'Drop Cross R', 11, 4, { color: LASER_GREEN, rotation: 214, beam: { targetMode: 'cross', beamSpread: 14, targetX: 4, targetY: 6 }, trigger: { mode: 'bassHit', audioThreshold: 0.62, fadeOutMs: 100 } }),
      fx('strobe', 'Snare Strobe L', 5, 2, { color: STROBE_WHITE, brightness: 1, trigger: { mode: 'snareTransient', audioThreshold: 0.5, fadeOutMs: 70 }, component: { strobeRate: 18 } }),
      fx('strobe', 'Snare Strobe R', 9, 2, { color: STROBE_WHITE, brightness: 1, trigger: { mode: 'snareTransient', audioThreshold: 0.5, fadeOutMs: 70 }, component: { strobeRate: 18 } }),
      fx('blinder', 'Downbeat Blinder', 7, 8, { color: WARM_BLINDER, brightness: 1, trigger: { mode: 'bar', barInterval: 4, fadeOutMs: 260 } }),
      fx('co2Jet', 'CO₂ Drop L', 2, 9, { color: CO2_BLUE, trigger: { mode: 'cuePoint', cuePointIds: ['drop'], fadeOutMs: 420 }, component: { co2BurstDurationMs: 650 } }),
      fx('co2Jet', 'CO₂ Drop R', 12, 9, { color: CO2_BLUE, trigger: { mode: 'cuePoint', cuePointIds: ['drop'], fadeOutMs: 420 }, component: { co2BurstDurationMs: 650 } }),
    ],
  },
  {
    id: 'led-bar-grid',
    name: 'LED Bar Grid',
    description: 'A clean LED wall and tube grid using bass, mid, and high-band triggers for pixel-chase style looks.',
    category: 'led',
    tags: ['led', 'grid', 'audio-band'],
    settings: grid(15, 10),
    fixtures: [
      fx('ledBar', 'Top Bar 1', 3, 2, { color: LASER_CYAN, trigger: { mode: 'audioBand', audioBand: 'high', audioThreshold: 0.38 }, component: { ledCellCount: 10, ledDirection: 'leftToRight' } }),
      fx('ledBar', 'Top Bar 2', 7, 2, { color: LASER_BLUE, trigger: { mode: 'audioBand', audioBand: 'mid', audioThreshold: 0.4 }, component: { ledCellCount: 10, ledDirection: 'centerOut' } }),
      fx('ledBar', 'Top Bar 3', 11, 2, { color: LASER_GREEN, trigger: { mode: 'audioBand', audioBand: 'highMid', audioThreshold: 0.42 }, component: { ledCellCount: 10, ledDirection: 'rightToLeft' } }),
      fx('ledBar', 'Mid Bar 1', 3, 5, { color: '#ff4ed8', trigger: { mode: 'audioBand', audioBand: 'bass', audioThreshold: 0.36 }, component: { ledCellCount: 12, ledDirection: 'chase' } }),
      fx('ledBar', 'Mid Bar 2', 7, 5, { color: '#fff075', trigger: { mode: 'bar', barInterval: 1, fadeOutMs: 210 }, component: { ledCellCount: 12, ledDirection: 'edgesIn' } }),
      fx('ledBar', 'Mid Bar 3', 11, 5, { color: '#61d6aa', trigger: { mode: 'audioBand', audioBand: 'bass', audioThreshold: 0.36 }, component: { ledCellCount: 12, ledDirection: 'chase' } }),
      fx('ledTube', 'Tube L 1', 1, 3, { color: LASER_CYAN, rotation: 90, trigger: { mode: 'beat', beatDivision: 0.5, fadeOutMs: 180 }, component: { ledCellCount: 16, ledDirection: 'centerOut' } }),
      fx('ledTube', 'Tube L 2', 1, 6, { color: LASER_BLUE, rotation: 90, trigger: { mode: 'beat', beatDivision: 1, fadeOutMs: 220 }, component: { ledCellCount: 16, ledDirection: 'leftToRight' } }),
      fx('ledTube', 'Tube R 1', 13, 3, { color: LASER_GREEN, rotation: 90, trigger: { mode: 'beat', beatDivision: 0.5, fadeOutMs: 180 }, component: { ledCellCount: 16, ledDirection: 'centerOut' } }),
      fx('ledTube', 'Tube R 2', 13, 6, { color: LASER_MAGENTA, rotation: 90, trigger: { mode: 'beat', beatDivision: 1, fadeOutMs: 220 }, component: { ledCellCount: 16, ledDirection: 'rightToLeft' } }),
    ],
  },
  {
    id: 'strobe-blinder-hits',
    name: 'Strobe + Blinder Hits',
    description: 'Impact layer with transient strobes and downbeat blinders that can sit on top of another Show Director layout.',
    category: 'hits',
    tags: ['strobe', 'blinder', 'hits'],
    settings: grid(15, 10),
    fixtures: [
      fx('strobe', 'Transient Strobe L', 4, 3, { color: STROBE_WHITE, trigger: { mode: 'snareTransient', audioThreshold: 0.48, fadeOutMs: 75 }, component: { strobeRate: 22 } }),
      fx('strobe', 'Transient Strobe R', 10, 3, { color: STROBE_WHITE, trigger: { mode: 'snareTransient', audioThreshold: 0.48, fadeOutMs: 75 }, component: { strobeRate: 22 } }),
      fx('strobe', 'Bass Flash Center', 7, 4, { color: '#dff8ff', trigger: { mode: 'bassHit', audioThreshold: 0.66, fadeOutMs: 95 }, component: { strobeRate: 14 } }),
      fx('blinder', 'Blinder L', 3, 8, { color: WARM_BLINDER, brightness: 1, trigger: { mode: 'bar', barInterval: 4, fadeOutMs: 300 } }),
      fx('blinder', 'Blinder C', 7, 8, { color: '#fff0bd', brightness: 1, trigger: { mode: 'phrase', phraseLengthBars: 8, fadeOutMs: 420 } }),
      fx('blinder', 'Blinder R', 11, 8, { color: WARM_BLINDER, brightness: 1, trigger: { mode: 'bar', barInterval: 4, fadeOutMs: 300 } }),
    ],
  },
  {
    id: 'moving-head-sweep',
    name: 'Moving Head Sweep',
    description: 'Four moving heads with mirrored sweep timing, plus a soft wash to make movement visible.',
    category: 'movement',
    tags: ['moving-head', 'sweep', 'build'],
    settings: grid(15, 10),
    fixtures: [
      fx('movingHead', 'Sweep Head FL', 3, 7, { color: LASER_CYAN, rotation: -26, beam: { targetMode: 'sweep', beamSpread: 8, targetX: 7, targetY: 2 }, trigger: { mode: 'beat', beatDivision: 2, fadeOutMs: 240 }, component: { movingHeadPanTiltStyle: 'smoothSweep' } }),
      fx('movingHead', 'Sweep Head FR', 11, 7, { color: LASER_GREEN, rotation: 206, beam: { targetMode: 'sweep', beamSpread: 8, targetX: 7, targetY: 2 }, trigger: { mode: 'beat', beatDivision: 2, fadeOutMs: 240 }, component: { movingHeadPanTiltStyle: 'smoothSweep' } }),
      fx('movingHead', 'Sweep Head BL', 4, 3, { color: LASER_BLUE, rotation: 32, beam: { targetMode: 'mirror', beamSpread: 10, targetX: 10, targetY: 7 }, trigger: { mode: 'bar', barInterval: 1, fadeOutMs: 200 }, component: { movingHeadPanTiltStyle: 'figureEight' } }),
      fx('movingHead', 'Sweep Head BR', 10, 3, { color: LASER_MAGENTA, rotation: 148, beam: { targetMode: 'mirror', beamSpread: 10, targetX: 4, targetY: 7 }, trigger: { mode: 'bar', barInterval: 1, fadeOutMs: 200 }, component: { movingHeadPanTiltStyle: 'figureEight' } }),
      fx('parWash', 'Sweep Wash', 7, 1, { color: '#223bff', brightness: 0.5, beam: { beamSpread: 82, focus: 0.3 }, trigger: { mode: 'section', sectionTypes: ['build', 'drop'], fadeInMs: 450, fadeOutMs: 700 } }),
    ],
  },
  {
    id: 'haze-co2-drops',
    name: 'Haze + CO₂ Drops',
    description: 'Atmosphere-first layer with always-on haze and cue/section-gated CO₂ jets for phrase impacts.',
    category: 'atmosphere',
    tags: ['haze', 'co2', 'atmosphere'],
    settings: grid(15, 10),
    fixtures: [
      fx('haze', 'Haze Base L', 1, 2, { color: '#9ddfff', brightness: 0.42, trigger: { mode: 'alwaysOn', fadeInMs: 1200, fadeOutMs: 1600 }, component: { hazeIntensity: 0.44 } }),
      fx('haze', 'Haze Base R', 13, 2, { color: '#a7ffe9', brightness: 0.42, trigger: { mode: 'alwaysOn', fadeInMs: 1200, fadeOutMs: 1600 }, component: { hazeIntensity: 0.44 } }),
      fx('co2Jet', 'CO₂ Jet L', 3, 9, { color: CO2_BLUE, trigger: { mode: 'cuePoint', cuePointIds: ['drop', 'impact'], fadeOutMs: 500 }, component: { co2BurstDurationMs: 800 } }),
      fx('co2Jet', 'CO₂ Jet R', 11, 9, { color: CO2_BLUE, trigger: { mode: 'cuePoint', cuePointIds: ['drop', 'impact'], fadeOutMs: 500 }, component: { co2BurstDurationMs: 800 } }),
      fx('co2Jet', 'Phrase CO₂ Center', 7, 9, { color: '#ffffff', trigger: { mode: 'phrase', phraseLengthBars: 8, fadeOutMs: 420 }, component: { co2BurstDurationMs: 500 } }),
    ],
  },
] as const satisfies readonly LaserDmxShowDirectorTemplate[]

export function getLaserDmxShowDirectorTemplate(templateId: string): LaserDmxShowDirectorTemplate | null {
  return LASER_DMX_SHOW_DIRECTOR_TEMPLATES.find(template => template.id === templateId) ?? null
}

export function createLaserDmxShowDirectorStateFromTemplate(
  templateInput: LaserDmxShowDirectorTemplate | null | undefined,
  createId: TemplateIdFactory = createTemplateId,
): LaserDmxShowDirectorState | null {
  if (!templateInput) return null
  const template = templateInput as LaserDmxShowDirectorTemplate & { fixtures?: unknown }
  const settings = normalizeLaserDmxShowDirectorSettings({
    ...DEFAULT_LASER_DMX_SHOW_DIRECTOR_SETTINGS,
    ...(isRecord(template.settings) ? template.settings : {}),
    gridSize: {
      ...DEFAULT_LASER_DMX_SHOW_DIRECTOR_SETTINGS.gridSize,
      ...(isRecord(template.settings?.gridSize) ? template.settings.gridSize : {}),
    },
  })
  const fixtures = Array.isArray(template.fixtures)
    ? template.fixtures.flatMap((raw, index) => {
      if (!isRecord(raw) || !isLaserDmxShowDirectorFixtureKind(raw.kind)) return []
      const id = createId()
      const base = createDefaultLaserDmxShowDirectorFixture(raw.kind, id, index)
      return [normalizeLaserDmxShowDirectorFixture({
        ...base,
        ...raw,
        id,
        kind: raw.kind,
        beam: isRecord(raw.beam) ? { ...base.beam, ...raw.beam } : base.beam,
        trigger: isRecord(raw.trigger) ? { ...base.trigger, ...raw.trigger } : base.trigger,
        component: isRecord(raw.component) ? { ...base.component, ...raw.component } : base.component,
      }, index)]
    })
    : []

  return normalizeLaserDmxShowDirectorState({
    schemaVersion: LASER_DMX_SHOW_DIRECTOR_SCHEMA_VERSION,
    sourceTemplateId: template.id,
    fixtures,
    selectedFixtureId: fixtures[0]?.id ?? null,
    settings,
  })
}

export function createLaserDmxShowDirectorTemplateState(
  templateId: string,
  createId?: TemplateIdFactory,
): LaserDmxShowDirectorState | null {
  return createLaserDmxShowDirectorStateFromTemplate(getLaserDmxShowDirectorTemplate(templateId), createId)
}
