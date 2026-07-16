import {
  validateSharedPerformanceProgramCollection,
  type SharedPerformanceActionValidationAdapter,
  type SharedPerformanceProgramValidationIssue,
} from '../../../../features/performanceCore'
import type { PixGridPerformanceProgramId } from './PixGridTypes'
import type { PixGridPerformanceAction, PixGridPerformanceProgram } from './PixGridPerformanceTypes'

const intro = (sceneId: string, extra: readonly PixGridPerformanceAction[] = []): readonly PixGridPerformanceAction[] => [
  { type: 'setScene', sceneId },
  { type: 'setTransition', transition: 'fade', durationBeats: 2 },
  { type: 'setDensity', density: 0.34 },
  ...extra,
]
const verse = (sceneId: string, extra: readonly PixGridPerformanceAction[] = []): readonly PixGridPerformanceAction[] => [
  { type: 'setScene', sceneId },
  { type: 'setTransition', transition: 'fade', durationBeats: 1 },
  { type: 'setDensity', density: 0.58 },
  ...extra,
]
const build = (sceneId: string, extra: readonly PixGridPerformanceAction[] = []): readonly PixGridPerformanceAction[] => [
  { type: 'setScene', sceneId },
  { type: 'setTransition', transition: 'wipeRows', durationBeats: 1 },
  { type: 'setDensity', density: 0.82 },
  ...extra,
]
const drop = (sceneId: string, extra: readonly PixGridPerformanceAction[] = []): readonly PixGridPerformanceAction[] => [
  { type: 'setScene', sceneId },
  { type: 'setTransition', transition: 'cut' },
  { type: 'setDensity', density: 1 },
  ...extra,
]
const breakdown = (sceneId: string, extra: readonly PixGridPerformanceAction[] = []): readonly PixGridPerformanceAction[] => [
  { type: 'setScene', sceneId },
  { type: 'setTransition', transition: 'dissolve', durationBeats: 2 },
  { type: 'setDensity', density: 0.42 },
  ...extra,
]
const outro = (sceneId: string, extra: readonly PixGridPerformanceAction[] = []): readonly PixGridPerformanceAction[] => [
  { type: 'setScene', sceneId },
  { type: 'setTransition', transition: 'wipeColumns', durationBeats: 2 },
  { type: 'setDensity', density: 0.26 },
  ...extra,
]

export const BASS_BEACON_PERFORMANCE_PROGRAM: PixGridPerformanceProgram = {
  id: 'pix-grid-bass-beacon-performance',
  metadata: {
    name: 'Bass Beacon Full-Song Performance',
    description: 'Readable BASS typography with separated kick, snare, and hat roles across a complete song arc.',
    engine: 'pixGrid',
    version: 1,
    visualIdentity: 'typographic beacon',
  },
  fallbackOrder: ['verse', 'intro', 'breakdown', 'drop', 'outro'],
  fallbackSceneId: 'bass-fallback',
  scenes: [
    {
      id: 'bass-intro', sectionTypes: ['intro'], priority: 20,
      actions: intro('pix-grid-bass-beacon-intro', [
        { type: 'setLayerActive', layerId: 'bass-word', active: true },
        { type: 'setLayerOpacity', layerId: 'bass-word', opacity: 0.34 },
        { type: 'setLayerActive', layerId: 'bass-outline', active: true },
        { type: 'setLayerOpacity', layerId: 'bass-outline', opacity: 0.22 },
        { type: 'setLayerActive', layerId: 'bass-burst', active: false },
        { type: 'setLayerActive', layerId: 'bass-sparkles', active: false },
        { type: 'setBackgroundState', state: 'dim', brightness: 0.06 },
      ]),
      fourBarActions: [
        [{ type: 'setPaletteRole', target: { layerId: 'bass-outline' }, role: 'primary' }],
        [{ type: 'setPaletteRole', target: { layerId: 'bass-outline' }, role: 'secondary' }],
      ],
      eventActions: { downbeat: [{ type: 'flashGroup', groupId: 'bass-body-group', amount: 0.18 }] },
    },
    {
      id: 'bass-verse', sectionTypes: ['verse', 'bridge'], priority: 20,
      actions: verse('pix-grid-bass-beacon-verse', [
        { type: 'setGroupBrightness', groupId: 'bass-body-group', brightness: 0.78 },
        { type: 'setGroupBrightness', groupId: 'bass-snare-group', brightness: 0.55 },
        { type: 'setGroupBrightness', groupId: 'bass-hat-group', brightness: 0.28 },
        { type: 'setLayerActive', layerId: 'bass-burst', active: false },
      ]),
      fourBarActions: [
        [{ type: 'shiftGroup', groupId: 'bass-snare-group', x: -0.012 }],
        [{ type: 'shiftGroup', groupId: 'bass-snare-group', x: 0.012 }],
        [{ type: 'changeAnimationSpeed', target: { groupId: 'bass-hat-group' }, multiplier: 0.82 }],
        [{ type: 'changeAnimationSpeed', target: { groupId: 'bass-hat-group' }, multiplier: 1.12 }],
      ],
      eventActions: {
        kick: [{ type: 'flashGroup', groupId: 'bass-kick-group', amount: 0.36 }],
        snare: [{ type: 'flashGroup', groupId: 'bass-snare-group', amount: 0.48, paletteRole: 'highlight' }],
        hat: [{ type: 'flashGroup', groupId: 'bass-hat-group', amount: 0.18 }],
      },
    },
    {
      id: 'bass-build', sectionTypes: ['build', 'preDrop'], priority: 25,
      actions: build('pix-grid-bass-beacon-build', [
        { type: 'revealRows', target: 'all', progress: 0.68, from: 'bottom' },
        { type: 'changeAnimationSpeed', target: 'all', multiplier: 1.35 },
        { type: 'setPaletteRole', target: 'all', role: 'secondary' },
      ]),
      fourBarActions: [
        [{ type: 'revealRows', target: 'all', progress: 0.74, from: 'bottom' }],
        [{ type: 'revealColumns', target: 'all', progress: 0.84, from: 'center' }],
        [{ type: 'recruitLayer', layerId: 'bass-side-chevrons-left', opacity: 0.65 }, { type: 'recruitLayer', layerId: 'bass-side-chevrons-right', opacity: 0.65 }],
        [{ type: 'recruitLayer', layerId: 'bass-sparkles', opacity: 0.52 }],
      ],
      eventActions: {
        kick: [{ type: 'flashGroup', groupId: 'bass-kick-group', amount: 0.42 }],
        snare: [{ type: 'flashGroup', groupId: 'bass-snare-group', amount: 0.56 }],
        transient: [{ type: 'triggerFrame', target: { groupId: 'bass-hat-group' }, step: 0.12 }],
      },
    },
    {
      id: 'bass-drop-one', sectionTypes: ['drop'], dropOccurrence: { occurrences: [1] }, priority: 40,
      actions: drop('pix-grid-bass-beacon-drop', [
        { type: 'setGroupBrightness', groupId: 'bass-body-group', brightness: 1 },
        { type: 'setGroupBrightness', groupId: 'bass-kick-group', brightness: 0.76 },
        { type: 'setGroupBrightness', groupId: 'bass-snare-group', brightness: 0.82 },
        { type: 'setGroupBrightness', groupId: 'bass-hat-group', brightness: 0.5 },
      ]),
      entryActions: [{ type: 'flashGroup', groupId: 'bass-body-group', amount: 0.64 }],
      bodyActions: [{ type: 'setGroupBrightness', groupId: 'bass-body-group', brightness: 0.94 }],
      exitActions: [{ type: 'dissolveGroup', groupId: 'bass-hat-group', amount: 0.28 }],
      variations: [
        { id: 'cyan-core', weight: 2, actions: [{ type: 'setPaletteRole', target: { groupId: 'bass-body-group' }, role: 'primary' }] },
        { id: 'emerald-core', weight: 1, actions: [{ type: 'setPaletteRole', target: { groupId: 'bass-body-group' }, role: 'secondary' }] },
      ],
      fourBarActions: [
        [{ type: 'reverseDirection', target: { groupId: 'bass-snare-group' } }],
        [{ type: 'shiftGroup', groupId: 'bass-kick-group', y: -0.018 }],
        [{ type: 'shiftGroup', groupId: 'bass-kick-group', y: 0.018 }],
        [{ type: 'triggerFrame', target: { groupId: 'bass-hat-group' }, step: 0.2 }],
      ],
      eightBarRecruitment: [
        [{ type: 'recruitLayer', layerId: 'bass-burst', opacity: 0.42 }],
        [{ type: 'recruitLayer', layerId: 'bass-sparkles', opacity: 0.62 }, { type: 'setGroupBrightness', groupId: 'bass-snare-group', brightness: 0.92 }],
      ],
      sixteenBarEvolution: [
        [{ type: 'changeAnimationSpeed', target: 'all', multiplier: 1.08 }],
        [{ type: 'setPaletteRole', target: 'all', role: 'accent' }, { type: 'changeAnimationSpeed', target: 'all', multiplier: 1.18 }],
      ],
      eventActions: {
        kick: [{ type: 'flashGroup', groupId: 'bass-kick-group', amount: 0.7 }],
        snare: [{ type: 'flashGroup', groupId: 'bass-snare-group', amount: 0.78, paletteRole: 'highlight' }],
        hat: [{ type: 'flashGroup', groupId: 'bass-hat-group', amount: 0.28 }],
        semanticMoment: [{ type: 'flashGroup', groupId: 'bass-body-group', amount: 0.58 }],
      },
    },
    {
      id: 'bass-drop-evolved', sectionTypes: ['drop'], dropOccurrence: { minOccurrence: 2 }, priority: 45,
      actions: drop('pix-grid-bass-beacon-drop', [
        { type: 'setPaletteRole', target: 'all', role: 'secondary' },
        { type: 'recruitLayer', layerId: 'bass-burst', opacity: 0.62 },
        { type: 'recruitLayer', layerId: 'bass-sparkles', opacity: 0.72 },
        { type: 'setGroupBrightness', groupId: 'bass-body-group', brightness: 1 },
        { type: 'shiftGroup', groupId: 'bass-snare-group', y: -0.02 },
      ]),
      entryActions: [{ type: 'flashGroup', groupId: 'bass-body-group', amount: 0.72 }],
      bodyActions: [{ type: 'setGroupBrightness', groupId: 'bass-hat-group', brightness: 0.72 }],
      exitActions: [{ type: 'dissolveGroup', groupId: 'bass-snare-group', amount: 0.24 }],
      fourBarActions: [
        [{ type: 'reverseDirection', target: 'all' }],
        [{ type: 'setPaletteRole', target: { groupId: 'bass-body-group' }, role: 'accent' }],
        [{ type: 'shiftGroup', groupId: 'bass-kick-group', x: -0.022 }],
        [{ type: 'shiftGroup', groupId: 'bass-kick-group', x: 0.022 }],
      ],
      eightBarRecruitment: [
        [{ type: 'setGroupBrightness', groupId: 'bass-hat-group', brightness: 0.68 }],
        [{ type: 'changeAnimationSpeed', target: 'all', multiplier: 1.24 }],
      ],
      sixteenBarEvolution: [
        [{ type: 'changeAnimation', layerId: 'bass-sparkles', animation: 'checkerAlternate', speed: 8, amount: 1 }],
        [{ type: 'setPaletteRole', target: 'all', role: 'highlight' }, { type: 'setBackgroundState', state: 'lifted', brightness: 0.18 }],
      ],
      eventActions: {
        kick: [{ type: 'flashGroup', groupId: 'bass-kick-group', amount: 0.78 }],
        snare: [{ type: 'flashGroup', groupId: 'bass-snare-group', amount: 0.82, paletteRole: 'highlight' }],
        hat: [{ type: 'flashGroup', groupId: 'bass-hat-group', amount: 0.34 }],
        semanticMoment: [{ type: 'triggerFrame', target: 'all', step: 0.35 }],
      },
    },
    {
      id: 'bass-breakdown', sectionTypes: ['breakdown'], priority: 20,
      actions: breakdown('pix-grid-bass-beacon-breakdown', [
        { type: 'setGroupBrightness', groupId: 'bass-body-group', brightness: 0.48 },
        { type: 'setLayerActive', layerId: 'bass-burst', active: false },
        { type: 'setLayerActive', layerId: 'bass-sparkles', active: false },
        { type: 'changeAnimationSpeed', target: 'all', multiplier: 0.42 },
        { type: 'setPaletteRole', target: 'all', role: 'highlight' },
      ]),
    },
    {
      id: 'bass-outro', sectionTypes: ['outro'], priority: 20,
      actions: outro('pix-grid-bass-beacon-outro', [
        { type: 'revealRows', target: 'all', progress: 0.38, from: 'top' },
        { type: 'setGroupBrightness', groupId: 'bass-body-group', brightness: 0.42 },
        { type: 'setLayerActive', layerId: 'bass-burst', active: false },
        { type: 'setLayerActive', layerId: 'bass-sparkles', active: false },
      ]),
      exitActions: [{ type: 'clear' }],
    },
    {
      id: 'bass-fallback', sectionTypes: ['unknown'], priority: 1,
      actions: verse('pix-grid-bass-beacon-verse', [{ type: 'setGroupBrightness', groupId: 'bass-body-group', brightness: 0.68 }]),
      eventActions: { beat: [{ type: 'flashGroup', groupId: 'bass-body-group', amount: 0.22 }] },
    },
  ],
}

export const GEOMETRIC_REACTOR_PERFORMANCE_PROGRAM: PixGridPerformanceProgram = {
  id: 'pix-grid-geometric-reactor-performance',
  metadata: { name: 'Geometric Reactor Full-Song Performance', engine: 'pixGrid', version: 1, visualIdentity: 'coherent geometric reactor' },
  fallbackOrder: ['verse', 'intro', 'breakdown', 'drop', 'outro'],
  fallbackSceneId: 'reactor-fallback',
  scenes: [
    {
      id: 'reactor-intro', sectionTypes: ['intro'], priority: 20,
      actions: intro('pix-grid-geometric-reactor-intro', [
        { type: 'setGroupBrightness', groupId: 'reactor-low-group', brightness: 0.46 },
        { type: 'setGroupBrightness', groupId: 'reactor-mid-group', brightness: 0.36 },
        { type: 'setGroupActive', groupId: 'reactor-high-group', active: false },
        { type: 'changeAnimationSpeed', target: 'all', multiplier: 0.58 },
      ]),
      fourBarActions: [
        [{ type: 'reverseDirection', target: { groupId: 'reactor-low-group' } }],
        [{ type: 'setPaletteRole', target: { groupId: 'reactor-mid-group' }, role: 'secondary' }],
      ],
    },
    {
      id: 'reactor-verse', sectionTypes: ['verse', 'bridge'], priority: 20,
      actions: verse('pix-grid-geometric-reactor-verse', [
        { type: 'setGroupBrightness', groupId: 'reactor-low-group', brightness: 0.72 },
        { type: 'setGroupBrightness', groupId: 'reactor-mid-group', brightness: 0.62 },
        { type: 'setGroupBrightness', groupId: 'reactor-high-group', brightness: 0.32 },
      ]),
      fourBarActions: [
        [{ type: 'reverseDirection', target: { groupId: 'reactor-low-group' } }],
        [{ type: 'shiftGroup', groupId: 'reactor-mid-group', x: 0.014 }],
        [{ type: 'shiftGroup', groupId: 'reactor-mid-group', x: -0.014 }],
        [{ type: 'triggerFrame', target: { groupId: 'reactor-high-group' }, step: 0.16 }],
      ],
      eventActions: {
        kick: [{ type: 'flashGroup', groupId: 'reactor-low-group', amount: 0.42 }],
        snare: [{ type: 'flashGroup', groupId: 'reactor-mid-group', amount: 0.38 }],
        hat: [{ type: 'flashGroup', groupId: 'reactor-high-group', amount: 0.2 }],
      },
    },
    {
      id: 'reactor-build', sectionTypes: ['build', 'preDrop'], priority: 25,
      actions: build('pix-grid-geometric-reactor-build', [
        { type: 'revealColumns', target: 'all', progress: 0.72, from: 'center' },
        { type: 'changeAnimationSpeed', target: 'all', multiplier: 1.42 },
        { type: 'recruitLayer', layerId: 'reactor-cross', opacity: 0.62 },
      ]),
      fourBarActions: [
        [{ type: 'setPaletteRole', target: { groupId: 'reactor-low-group' }, role: 'primary' }],
        [{ type: 'setPaletteRole', target: { groupId: 'reactor-mid-group' }, role: 'secondary' }],
        [{ type: 'recruitLayer', layerId: 'reactor-checker', opacity: 0.28 }],
        [{ type: 'recruitLayer', layerId: 'reactor-orbits', opacity: 0.72 }],
      ],
      eventActions: { transient: [{ type: 'triggerFrame', target: 'all', step: 0.16 }] },
    },
    {
      id: 'reactor-drop-one', sectionTypes: ['drop'], dropOccurrence: { occurrences: [1] }, priority: 40,
      actions: drop('pix-grid-geometric-reactor-drop', [
        { type: 'setGroupBrightness', groupId: 'reactor-low-group', brightness: 0.95 },
        { type: 'setGroupBrightness', groupId: 'reactor-mid-group', brightness: 0.9 },
        { type: 'setGroupBrightness', groupId: 'reactor-high-group', brightness: 0.72 },
      ]),
      entryActions: [{ type: 'triggerFrame', target: 'all', step: 0.32 }],
      bodyActions: [{ type: 'setGroupBrightness', groupId: 'reactor-mid-group', brightness: 0.9 }],
      exitActions: [{ type: 'dissolveGroup', groupId: 'reactor-high-group', amount: 0.3 }],
      fourBarActions: [
        [{ type: 'reverseDirection', target: { groupId: 'reactor-low-group' } }],
        [{ type: 'setPaletteRole', target: { groupId: 'reactor-mid-group' }, role: 'accent' }],
        [{ type: 'shiftGroup', groupId: 'reactor-high-group', y: -0.018 }],
        [{ type: 'shiftGroup', groupId: 'reactor-high-group', y: 0.018 }],
      ],
      eightBarRecruitment: [
        [{ type: 'recruitLayer', layerId: 'reactor-checker', opacity: 0.3 }],
        [{ type: 'recruitLayer', layerId: 'reactor-orbits', opacity: 0.88 }],
      ],
      sixteenBarEvolution: [
        [{ type: 'changeAnimationSpeed', target: 'all', multiplier: 1.12 }],
        [{ type: 'changeAnimation', layerId: 'reactor-chevrons', animation: 'pingPong', speed: 0.65, amount: 0.08 }],
      ],
      eventActions: {
        kick: [{ type: 'flashGroup', groupId: 'reactor-low-group', amount: 0.64 }],
        snare: [{ type: 'flashGroup', groupId: 'reactor-mid-group', amount: 0.58 }],
        hat: [{ type: 'flashGroup', groupId: 'reactor-high-group', amount: 0.3 }],
        semanticMoment: [{ type: 'reverseDirection', target: 'all' }],
      },
    },
    {
      id: 'reactor-drop-evolved', sectionTypes: ['drop'], dropOccurrence: { minOccurrence: 2 }, priority: 45,
      actions: drop('pix-grid-geometric-reactor-drop', [
        { type: 'setPaletteRole', target: 'all', role: 'secondary' },
        { type: 'recruitLayer', layerId: 'reactor-checker', opacity: 0.38 },
        { type: 'recruitLayer', layerId: 'reactor-orbits', opacity: 0.94 },
        { type: 'shiftGroup', groupId: 'reactor-mid-group', y: -0.02 },
      ]),
      entryActions: [{ type: 'triggerFrame', target: 'all', step: 0.4 }],
      bodyActions: [{ type: 'setGroupBrightness', groupId: 'reactor-high-group', brightness: 0.88 }],
      exitActions: [{ type: 'dissolveGroup', groupId: 'reactor-mid-group', amount: 0.22 }],
      fourBarActions: [
        [{ type: 'reverseDirection', target: { groupId: 'reactor-mid-group' } }],
        [{ type: 'setPaletteRole', target: { groupId: 'reactor-low-group' }, role: 'accent' }],
        [{ type: 'changeAnimationSpeed', target: { groupId: 'reactor-high-group' }, multiplier: 1.35 }],
        [{ type: 'triggerFrame', target: 'all', step: 0.28 }],
      ],
      eightBarRecruitment: [
        [{ type: 'setGroupBrightness', groupId: 'reactor-high-group', brightness: 0.84 }],
        [{ type: 'changeAnimation', layerId: 'reactor-tunnel', animation: 'frameCycle', speed: 3.6, amount: 1 }],
      ],
      sixteenBarEvolution: [
        [{ type: 'changeAnimationSpeed', target: 'all', multiplier: 1.22 }],
        [{ type: 'setPaletteRole', target: 'all', role: 'highlight' }, { type: 'reverseDirection', target: 'all' }],
      ],
      eventActions: {
        kick: [{ type: 'flashGroup', groupId: 'reactor-low-group', amount: 0.72 }],
        snare: [{ type: 'flashGroup', groupId: 'reactor-mid-group', amount: 0.66 }],
        hat: [{ type: 'flashGroup', groupId: 'reactor-high-group', amount: 0.36 }],
      },
    },
    {
      id: 'reactor-breakdown', sectionTypes: ['breakdown'], priority: 20,
      actions: breakdown('pix-grid-geometric-reactor-breakdown', [
        { type: 'setGroupBrightness', groupId: 'reactor-low-group', brightness: 0.52 },
        { type: 'setGroupBrightness', groupId: 'reactor-mid-group', brightness: 0.3 },
        { type: 'setGroupActive', groupId: 'reactor-high-group', active: false },
        { type: 'changeAnimationSpeed', target: 'all', multiplier: 0.38 },
      ]),
    },
    {
      id: 'reactor-outro', sectionTypes: ['outro'], priority: 20,
      actions: outro('pix-grid-geometric-reactor-outro', [
        { type: 'revealColumns', target: 'all', progress: 0.34, from: 'center' },
        { type: 'setGroupActive', groupId: 'reactor-high-group', active: false },
        { type: 'changeAnimationSpeed', target: 'all', multiplier: 0.28 },
      ]),
      exitActions: [{ type: 'clear' }],
    },
    {
      id: 'reactor-fallback', sectionTypes: ['unknown'], priority: 1,
      actions: verse('pix-grid-geometric-reactor-verse', [{ type: 'setGroupBrightness', groupId: 'reactor-low-group', brightness: 0.68 }]),
      eventActions: { beat: [{ type: 'flashGroup', groupId: 'reactor-low-group', amount: 0.2 }] },
    },
  ],
}

export const PIXEL_PARADE_PERFORMANCE_PROGRAM: PixGridPerformanceProgram = {
  id: 'pix-grid-pixel-parade-performance',
  metadata: { name: 'Pixel Parade Full-Song Performance', engine: 'pixGrid', version: 1, visualIdentity: 'progressive pixel cast' },
  fallbackOrder: ['verse', 'intro', 'breakdown', 'drop', 'outro'],
  fallbackSceneId: 'parade-fallback',
  scenes: [
    {
      id: 'parade-intro', sectionTypes: ['intro'], priority: 20,
      actions: intro('pix-grid-pixel-parade-intro', [
        { type: 'setGroupBrightness', groupId: 'parade-foreground-group', brightness: 0.54 },
        { type: 'setGroupBrightness', groupId: 'parade-background-group', brightness: 0.34 },
        { type: 'setGroupActive', groupId: 'parade-impact-group', active: false },
        { type: 'setLayerActive', layerId: 'parade-orbit', active: false },
      ]),
      fourBarActions: [
        [{ type: 'shiftGroup', groupId: 'parade-foreground-group', x: 0.018 }],
        [{ type: 'shiftGroup', groupId: 'parade-foreground-group', x: -0.018 }],
      ],
    },
    {
      id: 'parade-verse', sectionTypes: ['verse', 'bridge'], priority: 20,
      actions: verse('pix-grid-pixel-parade-verse', [
        { type: 'setGroupBrightness', groupId: 'parade-foreground-group', brightness: 0.76 },
        { type: 'setGroupBrightness', groupId: 'parade-background-group', brightness: 0.48 },
        { type: 'setLayerActive', layerId: 'parade-burst', active: false },
      ]),
      fourBarActions: [
        [{ type: 'reverseDirection', target: { groupId: 'parade-background-group' } }],
        [{ type: 'shiftGroup', groupId: 'parade-foreground-group', y: -0.012 }],
        [{ type: 'shiftGroup', groupId: 'parade-foreground-group', y: 0.012 }],
        [{ type: 'triggerFrame', target: { groupId: 'parade-background-group' }, step: 0.14 }],
      ],
      eightBarRecruitment: [
        [{ type: 'recruitLayer', layerId: 'parade-orbit', opacity: 0.58 }],
        [{ type: 'recruitLayer', layerId: 'parade-eq', opacity: 0.52 }],
      ],
      eventActions: {
        kick: [{ type: 'flashGroup', groupId: 'parade-foreground-group', amount: 0.34 }],
        snare: [{ type: 'flashGroup', groupId: 'parade-background-group', amount: 0.3 }],
        hat: [{ type: 'triggerFrame', target: { groupId: 'parade-background-group' }, step: 0.08 }],
      },
    },
    {
      id: 'parade-build', sectionTypes: ['build', 'preDrop'], priority: 25,
      actions: build('pix-grid-pixel-parade-build', [
        { type: 'revealColumns', target: 'all', progress: 0.76, from: 'left' },
        { type: 'changeAnimationSpeed', target: 'all', multiplier: 1.36 },
        { type: 'recruitLayer', layerId: 'parade-eq', opacity: 0.82 },
      ]),
      fourBarActions: [
        [{ type: 'reverseDirection', target: { groupId: 'parade-background-group' } }],
        [{ type: 'recruitLayer', layerId: 'parade-orbit', opacity: 0.7 }],
        [{ type: 'shiftGroup', groupId: 'parade-foreground-group', x: 0.03 }],
        [{ type: 'shiftGroup', groupId: 'parade-foreground-group', x: -0.03 }],
      ],
      eventActions: { transient: [{ type: 'triggerFrame', target: 'all', step: 0.14 }] },
    },
    {
      id: 'parade-drop-one', sectionTypes: ['drop'], dropOccurrence: { occurrences: [1] }, priority: 40,
      actions: drop('pix-grid-pixel-parade-drop', [
        { type: 'setGroupBrightness', groupId: 'parade-foreground-group', brightness: 0.96 },
        { type: 'setGroupBrightness', groupId: 'parade-background-group', brightness: 0.74 },
        { type: 'setGroupBrightness', groupId: 'parade-impact-group', brightness: 0.7 },
      ]),
      entryActions: [{ type: 'flashGroup', groupId: 'parade-impact-group', amount: 0.66 }],
      bodyActions: [{ type: 'setGroupBrightness', groupId: 'parade-foreground-group', brightness: 0.96 }],
      exitActions: [{ type: 'dissolveGroup', groupId: 'parade-background-group', amount: 0.26 }],
      variations: [
        { id: 'left-lead', weight: 1, actions: [{ type: 'shiftGroup', groupId: 'parade-foreground-group', x: -0.026 }] },
        { id: 'right-lead', weight: 1, actions: [{ type: 'shiftGroup', groupId: 'parade-foreground-group', x: 0.026 }] },
      ],
      fourBarActions: [
        [{ type: 'reverseDirection', target: { groupId: 'parade-background-group' } }],
        [{ type: 'setPaletteRole', target: { groupId: 'parade-foreground-group' }, role: 'secondary' }],
        [{ type: 'shiftGroup', groupId: 'parade-foreground-group', y: -0.02 }],
        [{ type: 'shiftGroup', groupId: 'parade-foreground-group', y: 0.02 }],
      ],
      eightBarRecruitment: [
        [{ type: 'recruitLayer', layerId: 'parade-orbit', opacity: 0.84 }],
        [{ type: 'recruitLayer', layerId: 'parade-burst', opacity: 0.48 }],
      ],
      sixteenBarEvolution: [
        [{ type: 'changeAnimationSpeed', target: 'all', multiplier: 1.12 }],
        [{ type: 'setPaletteRole', target: 'all', role: 'accent' }, { type: 'reverseDirection', target: { groupId: 'parade-foreground-group' } }],
      ],
      eventActions: {
        kick: [{ type: 'flashGroup', groupId: 'parade-impact-group', amount: 0.62 }],
        snare: [{ type: 'flashGroup', groupId: 'parade-foreground-group', amount: 0.54 }],
        hat: [{ type: 'flashGroup', groupId: 'parade-background-group', amount: 0.22 }],
        semanticMoment: [{ type: 'recruitLayer', layerId: 'parade-burst', opacity: 0.62 }],
      },
    },
    {
      id: 'parade-drop-evolved', sectionTypes: ['drop'], dropOccurrence: { minOccurrence: 2 }, priority: 45,
      actions: drop('pix-grid-pixel-parade-drop', [
        { type: 'setPaletteRole', target: 'all', role: 'secondary' },
        { type: 'recruitLayer', layerId: 'parade-orbit', opacity: 0.94 },
        { type: 'recruitLayer', layerId: 'parade-burst', opacity: 0.68 },
        { type: 'shiftGroup', groupId: 'parade-foreground-group', x: 0.02 },
      ]),
      entryActions: [{ type: 'flashGroup', groupId: 'parade-impact-group', amount: 0.74 }],
      bodyActions: [{ type: 'setGroupBrightness', groupId: 'parade-impact-group', brightness: 0.88 }],
      exitActions: [{ type: 'dissolveGroup', groupId: 'parade-foreground-group', amount: 0.2 }],
      fourBarActions: [
        [{ type: 'reverseDirection', target: 'all' }],
        [{ type: 'setPaletteRole', target: { groupId: 'parade-foreground-group' }, role: 'highlight' }],
        [{ type: 'changeAnimationSpeed', target: { groupId: 'parade-background-group' }, multiplier: 1.35 }],
        [{ type: 'triggerFrame', target: 'all', step: 0.28 }],
      ],
      eightBarRecruitment: [
        [{ type: 'setGroupBrightness', groupId: 'parade-impact-group', brightness: 0.84 }],
        [{ type: 'changeAnimation', layerId: 'parade-pal', animation: 'bounce', speed: 1.25, amount: 0.08 }],
      ],
      sixteenBarEvolution: [
        [{ type: 'changeAnimationSpeed', target: 'all', multiplier: 1.2 }],
        [{ type: 'setPaletteRole', target: 'all', role: 'highlight' }, { type: 'shiftGroup', groupId: 'parade-background-group', y: -0.025 }],
      ],
      eventActions: {
        kick: [{ type: 'flashGroup', groupId: 'parade-impact-group', amount: 0.7 }],
        snare: [{ type: 'flashGroup', groupId: 'parade-foreground-group', amount: 0.62 }],
        hat: [{ type: 'flashGroup', groupId: 'parade-background-group', amount: 0.28 }],
        semanticMoment: [{ type: 'reverseDirection', target: { groupId: 'parade-foreground-group' } }],
      },
    },
    {
      id: 'parade-breakdown', sectionTypes: ['breakdown'], priority: 20,
      actions: breakdown('pix-grid-pixel-parade-breakdown', [
        { type: 'setGroupBrightness', groupId: 'parade-foreground-group', brightness: 0.54 },
        { type: 'setGroupBrightness', groupId: 'parade-background-group', brightness: 0.24 },
        { type: 'setGroupActive', groupId: 'parade-impact-group', active: false },
        { type: 'changeAnimationSpeed', target: 'all', multiplier: 0.42 },
      ]),
    },
    {
      id: 'parade-outro', sectionTypes: ['outro'], priority: 20,
      actions: outro('pix-grid-pixel-parade-outro', [
        { type: 'revealRows', target: 'all', progress: 0.32, from: 'bottom' },
        { type: 'setGroupActive', groupId: 'parade-impact-group', active: false },
        { type: 'setLayerActive', layerId: 'parade-orbit', active: false },
        { type: 'changeAnimationSpeed', target: 'all', multiplier: 0.28 },
      ]),
      exitActions: [{ type: 'clear' }],
    },
    {
      id: 'parade-fallback', sectionTypes: ['unknown'], priority: 1,
      actions: verse('pix-grid-pixel-parade-verse', [{ type: 'setGroupBrightness', groupId: 'parade-foreground-group', brightness: 0.68 }]),
      eventActions: { beat: [{ type: 'flashGroup', groupId: 'parade-foreground-group', amount: 0.2 }] },
    },
  ],
}

export const PIX_GRID_PERFORMANCE_PROGRAMS: readonly PixGridPerformanceProgram[] = [
  BASS_BEACON_PERFORMANCE_PROGRAM,
  GEOMETRIC_REACTOR_PERFORMANCE_PROGRAM,
  PIXEL_PARADE_PERFORMANCE_PROGRAM,
]

export const PIX_GRID_PERFORMANCE_PROGRAM_BY_ID = new Map<PixGridPerformanceProgramId, PixGridPerformanceProgram>(
  PIX_GRID_PERFORMANCE_PROGRAMS.map(program => [program.id as PixGridPerformanceProgramId, program]),
)

export const PIX_GRID_DEFAULT_PROGRAM_BY_PRESET_ID: Readonly<Record<string, PixGridPerformanceProgramId>> = {
  'pix-grid-bass-beacon': 'pix-grid-bass-beacon-performance',
  'pix-grid-geometric-reactor': 'pix-grid-geometric-reactor-performance',
  'pix-grid-pixel-parade': 'pix-grid-pixel-parade-performance',
}

export const PIX_GRID_PRESET_ID_BY_PROGRAM: Readonly<Record<PixGridPerformanceProgramId, string>> = {
  'pix-grid-bass-beacon-performance': 'pix-grid-bass-beacon',
  'pix-grid-geometric-reactor-performance': 'pix-grid-geometric-reactor',
  'pix-grid-pixel-parade-performance': 'pix-grid-pixel-parade',
}

function actionTarget(action: PixGridPerformanceAction): string | null {
  switch (action.type) {
    case 'setScene': return 'scene'
    case 'setLayerActive':
    case 'setLayerOpacity':
    case 'recruitLayer':
    case 'changeAnimation': return `layer:${action.layerId}:${action.type}`
    case 'setGroupActive':
    case 'setGroupBrightness':
    case 'flashGroup':
    case 'dissolveGroup':
    case 'shiftGroup': return `group:${action.groupId}:${action.type}`
    case 'freeze': return 'freeze'
    case 'clear':
    case 'restore': return 'canvas-clear-state'
    case 'setTransition': return 'transition'
    case 'setDensity': return 'density'
    case 'setBackgroundState': return 'background'
    default: return null
  }
}

const VALIDATION_ADAPTER: SharedPerformanceActionValidationAdapter<PixGridPerformanceAction> = {
  validate(action) {
    const issues: Array<{ severity: 'error' | 'warning' | 'info'; code: string; message: string }> = []
    if ('opacity' in action && action.opacity != null && (!Number.isFinite(action.opacity) || action.opacity < 0 || action.opacity > 1)) issues.push({ severity: 'error', code: 'pix-grid-opacity-range', message: 'Opacity must be between 0 and 1.' })
    if ('brightness' in action && action.brightness != null && (!Number.isFinite(action.brightness) || action.brightness < 0 || action.brightness > 2)) issues.push({ severity: 'error', code: 'pix-grid-brightness-range', message: 'Brightness must be between 0 and 2.' })
    if (action.type === 'setDensity' && (!Number.isFinite(action.density) || action.density < 0 || action.density > 1)) issues.push({ severity: 'error', code: 'pix-grid-density-range', message: 'Density must be between 0 and 1.' })
    if ((action.type === 'revealRows' || action.type === 'revealColumns') && (!Number.isFinite(action.progress) || action.progress < 0 || action.progress > 1)) issues.push({ severity: 'error', code: 'pix-grid-reveal-range', message: 'Reveal progress must be between 0 and 1.' })
    return issues
  },
  exclusiveTargetKey: actionTarget,
  estimateResources(action) {
    if (action.type === 'recruitLayer' || action.type === 'setLayerActive' || action.type === 'changeAnimation') return { layers: 1 }
    return {}
  },
}

export function validatePixGridPerformancePrograms(): SharedPerformanceProgramValidationIssue[] {
  return validateSharedPerformanceProgramCollection(PIX_GRID_PERFORMANCE_PROGRAMS, {
    adapter: VALIDATION_ADAPTER,
    resourceLimits: { layers: 24, envelopes: 32 },
    requireFallbackScene: true,
  })
}
