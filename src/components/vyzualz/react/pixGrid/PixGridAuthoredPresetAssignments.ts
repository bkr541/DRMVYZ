import type {
  PixGridGroup,
  PixGridGroupMaskDefinition,
  PixGridReactionAssignment,
  PixGridReactionConditions,
  PixGridReactionSource,
  PixGridReactionTarget,
  PixGridReactionTargetScope,
} from './PixGridTypes'

const EVENT_SOURCES = new Set<PixGridReactionSource>([
  'beat', 'downbeat', 'kick', 'snare', 'hat', 'transient', 'barEntry',
  'fourBarBoundary', 'eightBarBoundary', 'sixteenBarBoundary', 'phraseEntry',
  'sectionEntry', 'sectionExit', 'dropImpact', 'dropOccurrenceChange',
  'semanticMoment', 'trackMapCueEvent',
])

function authoredAssignment(
  id: string,
  name: string,
  source: PixGridReactionSource,
  target: PixGridReactionTarget,
  overrides: Partial<PixGridReactionAssignment> = {},
): PixGridReactionAssignment {
  const event = EVENT_SOURCES.has(source)
  const targetScope = overrides.targetScope ?? 'group'
  return {
    id,
    name,
    enabled: true,
    source,
    target,
    targetScope,
    targetId: overrides.targetId ?? null,
    amount: overrides.amount ?? 0.5,
    polarity: overrides.polarity ?? 'positive',
    invert: overrides.invert ?? false,
    inputRange: overrides.inputRange ?? [0, 1],
    outputRange: overrides.outputRange ?? [0, 1],
    curve: overrides.curve ?? (event ? 'gate' : 'smoothstep'),
    threshold: overrides.threshold ?? (event ? 0.5 : 0),
    hysteresis: overrides.hysteresis ?? (event ? 0.08 : 0.02),
    attack: overrides.attack ?? (event ? 0 : 0.05),
    hold: overrides.hold ?? (event ? 0.04 : 0),
    release: overrides.release ?? (event ? 0.18 : 0.22),
    decayCurve: overrides.decayCurve ?? 'easeOut',
    smoothing: overrides.smoothing ?? (event ? 0 : 0.08),
    quantization: overrides.quantization ?? 'none',
    retrigger: overrides.retrigger ?? 'restart',
    maximumStacking: overrides.maximumStacking ?? (event ? 2 : 1),
    eventPriority: overrides.eventPriority ?? 0,
    minimumConfidence: overrides.minimumConfidence ?? 0,
    capabilityFallback: overrides.capabilityFallback ?? 'energy',
    ...(overrides.conditions ? { conditions: overrides.conditions } : {}),
    priority: overrides.priority ?? 0,
    clamp: overrides.clamp ?? [0, 1],
    blend: overrides.blend ?? 'add',
    paletteRole: overrides.paletteRole ?? 'accent',
    color: overrides.color ?? '#ffffff',
    seedOffset: overrides.seedOffset ?? 0,
  }
}

function group(
  id: string,
  name: string,
  layerScope: string[],
  displayColor: string,
  reactions: PixGridReactionAssignment[],
  options: {
    mask?: PixGridGroupMaskDefinition
    priority?: number
    overlapBehavior?: PixGridGroup['overlapBehavior']
  } = {},
): PixGridGroup {
  const mask = options.mask ?? { kind: 'layerAlpha', threshold: 0.04, foreground: true }
  return {
    id,
    name,
    source: mask.kind === 'geometric' || mask.kind === 'runs' ? 'manualSelection' : mask.kind,
    mask,
    cellRuns: mask.kind === 'runs' ? [...mask.runs] : [],
    layerId: layerScope[0] ?? null,
    layerScope,
    smartRuleId: mask.kind === 'geometric' ? mask.pattern : mask.kind,
    enabled: true,
    visible: true,
    contentVisible: true,
    priority: options.priority ?? 0,
    overlapBehavior: options.overlapBehavior ?? 'stack',
    reactions,
    displayColor,
  }
}

const sections = (...includeSectionTypes: NonNullable<PixGridReactionConditions['includeSectionTypes']>): PixGridReactionConditions => ({
  includeSectionTypes,
  autoPerformanceOnly: true,
})

export const BASS_BEACON_GROUPS: PixGridGroup[] = [
  group('bass-body-group', 'Letter Body', ['bass-word'], '#36d9ff', [
    authoredAssignment('bass-body-bass-fill', 'Bass body fill', 'bass', 'brightness', {
      amount: 0.52, curve: 'smoothstep', blend: 'add', clamp: [0, 1.45], priority: -40,
    }),
    authoredAssignment('bass-body-energy-contrast', 'Track energy contrast', 'trackRelativeEnergy', 'contrast', {
      amount: 0.28, curve: 'easeOut', blend: 'add', clamp: [0, 1.4], priority: -35,
    }),
    authoredAssignment('bass-body-kick-impact', 'Kick body expansion', 'kick', 'scale', {
      amount: 0.15, attack: 0, hold: 0.06, release: 0.22, decayCurve: 'overshoot',
      capabilityFallback: 'beat', clamp: [0, 1], eventPriority: 120,
    }),
    authoredAssignment('bass-body-downbeat-impact', 'Downbeat typography impact', 'downbeat', 'brightness', {
      amount: 0.42, attack: 0, hold: 0.045, release: 0.24, decayCurve: 'overshoot',
      capabilityFallback: 'beat', paletteRole: 'highlight', blend: 'add', eventPriority: 135,
    }),
  ], { priority: 30 }),
  group('bass-snare-group', 'Letter Outline', ['bass-outline'], '#f2feff', [
    authoredAssignment('bass-outline-tension', 'Tension outline growth', 'tension', 'outlineIntensity', {
      amount: 0.44, curve: 'exponential', capabilityFallback: 'energy', blend: 'max', priority: -30,
    }),
    authoredAssignment('bass-outline-snare', 'Snare outline flash', 'snare', 'outlineFlash', {
      amount: 0.86, attack: 0, hold: 0.045, release: 0.22, capabilityFallback: 'transient',
      paletteRole: 'highlight', blend: 'max', eventPriority: 150,
    }),
  ], { priority: 40 }),
  group('bass-letter-b-group', 'Letter B Highlight', ['bass-letter-b'], '#39e69b', [
    authoredAssignment('bass-letter-b-four-bars', 'Four-bar B emphasis', 'fourBarBoundary', 'paletteRole', {
      amount: 0.92, hold: 0.1, release: 0.44, quantization: 'fourBars', paletteRole: 'secondary',
      capabilityFallback: 'beat', blend: 'max', seedOffset: 11,
    }),
  ], { priority: 45 }),
  group('bass-letter-a-group', 'Letter A Vocal Focus', ['bass-letter-a'], '#d8b95a', [
    authoredAssignment('bass-letter-a-vocal', 'Vocal focal letter', 'vocalEnergy', 'brightness', {
      amount: 0.58, minimumConfidence: 0.35, capabilityFallback: 'energy', curve: 'easeInOut', blend: 'add',
    }),
    authoredAssignment('bass-letter-a-semantic', 'Semantic hero accent', 'semanticMoment', 'paletteRole', {
      amount: 0.9, attack: 0, hold: 0.12, release: 0.46, capabilityFallback: 'disable',
      paletteRole: 'highlight', blend: 'max', eventPriority: 180,
    }),
  ], { priority: 46 }),
  group('bass-letter-s-left-group', 'First S Highlight', ['bass-letter-s-left'], '#36d9ff', [
    authoredAssignment('bass-letter-s-left-four-bars', 'Four-bar first S response', 'fourBarBoundary', 'brightness', {
      amount: 0.7, hold: 0.07, release: 0.36, quantization: 'fourBars', capabilityFallback: 'beat',
      conditions: { ...sections('verse', 'build', 'preDrop', 'drop'), sectionOccurrences: [1, 3, 5, 7] },
      blend: 'add', seedOffset: 23,
    }),
  ], { priority: 47 }),
  group('bass-letter-s-right-group', 'Final S Highlight', ['bass-letter-s-right'], '#39e69b', [
    authoredAssignment('bass-letter-s-right-four-bars', 'Four-bar final S response', 'fourBarBoundary', 'brightness', {
      amount: 0.72, hold: 0.07, release: 0.36, quantization: 'fourBars', capabilityFallback: 'beat',
      conditions: sections('verse', 'build', 'preDrop', 'drop'), blend: 'add', seedOffset: 37,
    }),
  ], { priority: 48 }),
  group('bass-highlight-travel-group', 'Interior Highlight Travel', ['bass-letter-b', 'bass-letter-a', 'bass-letter-s-left', 'bass-letter-s-right'], '#f2feff', [
    authoredAssignment('bass-highlight-phrase-travel', 'Phrase highlight travel', 'phraseProgress', 'columnRecruitment', {
      amount: 1, blend: 'replace', curve: 'linear', clamp: [0, 1], priority: -20,
    }),
  ], { priority: 50 }),
  group('bass-side-accent-group', 'Side Accents', ['bass-side-chevrons-left', 'bass-side-chevrons-right'], '#f2feff', [
    authoredAssignment('bass-side-snare', 'Snare side flash', 'snare', 'brightness', {
      amount: 0.76, attack: 0, hold: 0.035, release: 0.17, capabilityFallback: 'transient',
      paletteRole: 'highlight', blend: 'add', eventPriority: 145,
    }),
    authoredAssignment('bass-side-eight-bars', 'Eight-bar accent recruitment', 'eightBarBoundary', 'scale', {
      amount: 0.12, hold: 0.18, release: 0.52, quantization: 'eightBars', capabilityFallback: 'beat',
      blend: 'max', eventPriority: 90,
    }),
  ], { priority: 20 }),
  group('bass-kick-group', 'Background Pressure Accents', ['bass-rings'], '#39e69b', [
    authoredAssignment('bass-background-sub-pressure', 'Sub pressure mass', 'sub', 'brightness', {
      amount: 0.34, curve: 'logarithmic', capabilityFallback: 'energy', blend: 'add', priority: -55,
    }),
    authoredAssignment('bass-background-drop-impact', 'Drop hero reveal', 'dropImpact', 'brightness', {
      amount: 0.72, attack: 0, hold: 0.06, release: 0.34, decayCurve: 'overshoot',
      capabilityFallback: 'transient', paletteRole: 'secondary', blend: 'add', eventPriority: 190,
    }),
  ], { priority: 5 }),
  group('bass-hat-group', 'Sparkle Detail Cells', ['bass-sparkles'], '#d8b95a', [
    authoredAssignment('bass-sparkle-air-density', 'Air detail density', 'air', 'sparkleDensity', {
      amount: 0.38, curve: 'exponential', capabilityFallback: 'midHighActivity', blend: 'max', priority: -15,
    }),
    authoredAssignment('bass-sparkle-hat', 'Hat sparkle event', 'hat', 'sparkle', {
      amount: 0.64, hold: 0.015, release: 0.095, capabilityFallback: 'midHighActivity',
      blend: 'max', maximumStacking: 3, eventPriority: 125,
    }),
  ], { priority: 60 }),
  group('bass-row-recruitment-group', 'Build Row Recruitment', ['bass-word', 'bass-outline'], '#36d9ff', [
    authoredAssignment('bass-build-row-recruitment', 'Build row recruitment', 'buildProgress', 'rowRecruitment', {
      amount: 1, blend: 'replace', curve: 'easeInOut', clamp: [0, 1], conditions: sections('build', 'preDrop'), priority: -10,
    }),
    authoredAssignment('bass-outro-row-powerdown', 'Outro row power-down', 'sectionProgress', 'rowRecruitment', {
      amount: 1, polarity: 'negative', invert: true, blend: 'replace', curve: 'easeIn', clamp: [0, 1],
      conditions: sections('outro'), priority: -5,
    }),
  ], { priority: 55 }),
]

export const BASS_BEACON_AUDIO_ASSIGNMENTS: PixGridReactionAssignment[] = [
  authoredAssignment('bass-output-energy-glow', 'Energy-controlled typography glow', 'trackRelativeEnergy', 'glow', {
    targetScope: 'output', amount: 0.16, curve: 'easeOut', blend: 'add', clamp: [0, 1], priority: -80,
  }),
  authoredAssignment('bass-letter-a-vocal-scale', 'Vocal letter scale focus', 'vocalEnergy', 'scale', {
    targetScope: 'layer', targetId: 'bass-letter-a', amount: 0.08, minimumConfidence: 0.35,
    capabilityFallback: 'energy', curve: 'easeInOut', blend: 'add', clamp: [0, 1], priority: -50,
  }),
  authoredAssignment('bass-background-section-arc', 'Section background arc', 'sectionProgress', 'backgroundIntensity', {
    targetScope: 'background', amount: 0.08, curve: 'easeInOut', blend: 'add', clamp: [0, 1], priority: -70,
  }),
  authoredAssignment('bass-track-map-transition', 'Track Map transition handoff', 'trackMapCueEvent', 'transitionStrength', {
    targetScope: 'transition', amount: 1, attack: 0, hold: 0.05, release: 0.26,
    capabilityFallback: 'disable', blend: 'max', eventPriority: 250,
  }),
]

export const GEOMETRIC_REACTOR_GROUPS: PixGridGroup[] = [
  group('reactor-core-group', 'Center Core', ['reactor-diamond'], '#fff3c7', [
    authoredAssignment('reactor-core-sub-mass', 'Sub center mass', 'sub', 'brightness', {
      amount: 0.5, curve: 'logarithmic', capabilityFallback: 'energy', blend: 'add', priority: -60,
    }),
    authoredAssignment('reactor-core-kick', 'Kick core impact', 'kick', 'scale', {
      amount: 0.13, hold: 0.05, release: 0.22, decayCurve: 'overshoot', capabilityFallback: 'beat',
      clamp: [0, 1], eventPriority: 160,
    }),
  ], { priority: 50 }),
  group('reactor-inner-ring-group', 'Inner Ring', ['reactor-rings'], '#a969ff', [
    authoredAssignment('reactor-inner-bass', 'Bass inner ring', 'bass', 'brightness', {
      amount: 0.52, curve: 'smoothstep', blend: 'add', priority: -55,
    }),
    authoredAssignment('reactor-inner-bass-scale', 'Bass ring expansion', 'bass', 'scale', {
      amount: 0.11, curve: 'easeOut', blend: 'add', clamp: [0, 1], priority: -50,
    }),
    authoredAssignment('reactor-inner-downbeat', 'Downbeat ring contraction', 'downbeat', 'maskContraction', {
      amount: 0.18, hold: 0.04, release: 0.2, capabilityFallback: 'beat', blend: 'max', eventPriority: 140,
    }),
  ], { priority: 42 }),
  group('reactor-outer-ring-group', 'Outer Ring and Tunnel', ['reactor-tunnel'], '#30d7ff', [
    authoredAssignment('reactor-outer-low-mid', 'Low-mid tunnel motion', 'lowMid', 'pixelDisplacement', {
      amount: 0.22, curve: 'easeInOut', capabilityFallback: 'energy', blend: 'add', clamp: [0, 1], priority: -45,
    }),
    authoredAssignment('reactor-outer-tension', 'Tension convergence', 'tension', 'maskContraction', {
      amount: 0.15, curve: 'exponential', capabilityFallback: 'energy', blend: 'max', priority: -40,
    }),
  ], { priority: 20 }),
  group('reactor-chevron-group', 'Chevrons', ['reactor-chevrons'], '#30d7ff', [
    authoredAssignment('reactor-chevron-mid', 'Mid-band structural movement', 'mid', 'positionX', {
      amount: 0.08, curve: 'easeInOut', capabilityFallback: 'energy', clamp: [0, 1], priority: -35,
    }),
    authoredAssignment('reactor-chevron-four-bars', 'Four-bar direction alternation', 'fourBarBoundary', 'directionReverse', {
      targetScope: 'animation', amount: 1, hold: 0.08, release: 0.16, quantization: 'fourBars',
      capabilityFallback: 'beat', blend: 'replace', eventPriority: 95,
    }),
  ], { priority: 35 }),
  group('reactor-mid-band-group', 'Mid-Band Structures', ['reactor-tunnel', 'reactor-chevrons'], '#30d7ff', [
    authoredAssignment('reactor-mid-flux-ripple', 'Spectral flux ripple', 'spectralFlux', 'pixelDisplacement', {
      amount: 0.22, curve: 'exponential', capabilityFallback: 'transient', blend: 'add', clamp: [0, 1], priority: -30,
    }),
  ], { priority: 25 }),
  group('reactor-node-group', 'High-Frequency Nodes', ['reactor-orbits'], '#f2c45c', [
    authoredAssignment('reactor-node-high-density', 'High node density', 'high', 'sparkleDensity', {
      amount: 0.44, curve: 'exponential', capabilityFallback: 'midHighActivity', blend: 'max', priority: -25,
    }),
    authoredAssignment('reactor-node-hat', 'Hat node sparkle', 'hat', 'sparkle', {
      amount: 0.72, hold: 0.015, release: 0.09, capabilityFallback: 'midHighActivity',
      maximumStacking: 3, blend: 'max', eventPriority: 130,
    }),
  ], { priority: 55 }),
  group('reactor-cross-group', 'Cross and Diagonal Accents', ['reactor-cross'], '#fff3c7', [
    authoredAssignment('reactor-cross-air', 'Air cross detail', 'air', 'brightness', {
      amount: 0.34, curve: 'exponential', capabilityFallback: 'midHighActivity', blend: 'add', priority: -20,
    }),
    authoredAssignment('reactor-cross-snare', 'Snare cross flash', 'snare', 'outlineFlash', {
      amount: 0.88, hold: 0.04, release: 0.22, capabilityFallback: 'transient',
      paletteRole: 'highlight', blend: 'max', eventPriority: 165,
    }),
  ], { priority: 60 }),
  group('reactor-checker-group', 'Checker Background Field', ['reactor-checker'], '#a969ff', [
    authoredAssignment('reactor-checker-complexity', 'Complexity checker density', 'complexity', 'checkerAlternation', {
      amount: 1, curve: 'stepped', capabilityFallback: 'energy', blend: 'replace', priority: -15,
    }),
  ], { priority: 0 }),
  group('reactor-impact-group', 'Impact Bank', ['reactor-diamond', 'reactor-cross'], '#fff3c7', [
    authoredAssignment('reactor-impact-drop', 'Drop reactor ignition', 'dropImpact', 'brightness', {
      amount: 0.92, hold: 0.06, release: 0.34, decayCurve: 'overshoot', capabilityFallback: 'transient',
      paletteRole: 'highlight', blend: 'add', eventPriority: 210,
    }),
    authoredAssignment('reactor-impact-semantic', 'Semantic focal convergence', 'semanticMoment', 'maskContraction', {
      amount: 0.26, attack: 0, hold: 0.1, release: 0.42, capabilityFallback: 'disable',
      blend: 'max', eventPriority: 190,
    }),
  ], { priority: 65 }),
  group('reactor-recruitment-group', 'Recruitment Bank', ['reactor-checker', 'reactor-orbits', 'reactor-cross'], '#f2c45c', [
    authoredAssignment('reactor-build-recruitment', 'Build geometry recruitment', 'buildProgress', 'rowRecruitment', {
      amount: 1, curve: 'easeInOut', blend: 'replace', conditions: sections('build', 'preDrop'), priority: -10,
    }),
    authoredAssignment('reactor-eight-bar-recruitment', 'Eight-bar secondary geometry', 'eightBarBoundary', 'maskExpansion', {
      amount: 0.18, hold: 0.14, release: 0.48, quantization: 'eightBars', capabilityFallback: 'beat',
      blend: 'max', eventPriority: 100,
    }),
  ], { priority: 45 }),
]

export const GEOMETRIC_REACTOR_AUDIO_ASSIGNMENTS: PixGridReactionAssignment[] = [
  authoredAssignment('reactor-output-energy-glow', 'Reactor energy glow', 'trackRelativeEnergy', 'glow', {
    targetScope: 'output', amount: 0.18, curve: 'easeOut', blend: 'add', clamp: [0, 1], priority: -80,
  }),
  authoredAssignment('reactor-ring-tension-speed', 'Tension ring speed', 'tension', 'animationSpeed', {
    targetScope: 'layer', targetId: 'reactor-rings', amount: 0.34, curve: 'exponential',
    capabilityFallback: 'energy', blend: 'add', clamp: [0, 1], priority: -55,
  }),
  authoredAssignment('reactor-build-tunnel-speed', 'Build tunnel acceleration', 'buildProgress', 'animationSpeed', {
    targetScope: 'layer', targetId: 'reactor-tunnel', amount: 0.72, curve: 'easeIn',
    blend: 'add', clamp: [0, 1], conditions: sections('build', 'preDrop'), priority: -50,
  }),
  authoredAssignment('reactor-complexity-density', 'Complexity scene density', 'complexity', 'density', {
    targetScope: 'output', amount: 1, outputRange: [0.52, 1], curve: 'smoothstep',
    blend: 'replace', clamp: [0.52, 1], capabilityFallback: 'energy', priority: -70,
  }),
  authoredAssignment('reactor-track-map-transition', 'Track Map transition handoff', 'trackMapCueEvent', 'transitionStrength', {
    targetScope: 'transition', amount: 1, hold: 0.05, release: 0.24, capabilityFallback: 'disable',
    blend: 'max', eventPriority: 250,
  }),
]

export const PIXEL_PARADE_GROUPS: PixGridGroup[] = [
  group('parade-hero-group', 'Hero Participant', ['parade-pal'], '#ff6d7f', [
    authoredAssignment('parade-hero-bass-body', 'Bass hero body', 'bass', 'brightness', {
      amount: 0.46, curve: 'smoothstep', blend: 'add', priority: -55,
    }),
    authoredAssignment('parade-hero-kick-step', 'Kick hero step', 'kick', 'positionY', {
      amount: -0.07, hold: 0.05, release: 0.22, decayCurve: 'overshoot', capabilityFallback: 'beat',
      clamp: [0, 1], eventPriority: 160,
    }),
    authoredAssignment('parade-hero-vocal', 'Vocal hero focus', 'vocalEnergy', 'outlineIntensity', {
      amount: 0.54, minimumConfidence: 0.35, capabilityFallback: 'energy', curve: 'easeInOut', blend: 'max',
    }),
    authoredAssignment('parade-hero-semantic', 'Semantic hero action', 'semanticMoment', 'scale', {
      amount: 0.12, attack: 0, hold: 0.12, release: 0.44, capabilityFallback: 'disable',
      blend: 'max', eventPriority: 205,
    }),
  ], { priority: 60 }),
  group('parade-foreground-group', 'Primary Participants', ['parade-star-left', 'parade-pal'], '#ff6d7f', [
    authoredAssignment('parade-primary-mid-motion', 'Mid participant motion', 'mid', 'positionY', {
      amount: 0.08, curve: 'easeInOut', capabilityFallback: 'energy', clamp: [0, 1], priority: -45,
    }),
    authoredAssignment('parade-primary-downbeat', 'Downbeat parade step', 'downbeat', 'positionX', {
      amount: 0.08, hold: 0.04, release: 0.2, capabilityFallback: 'beat', clamp: [0, 1], eventPriority: 145,
    }),
  ], { priority: 45 }),
  group('parade-secondary-group', 'Secondary Participants', ['parade-orbit', 'parade-eq'], '#ffd35c', [
    authoredAssignment('parade-secondary-low-mid', 'Low-mid parade travel', 'lowMid', 'positionX', {
      amount: 0.08, curve: 'easeInOut', capabilityFallback: 'energy', clamp: [0, 1], priority: -40,
    }),
    authoredAssignment('parade-secondary-eight-bars', 'Eight-bar participant recruitment', 'eightBarBoundary', 'maskExpansion', {
      amount: 0.16, hold: 0.18, release: 0.52, quantization: 'eightBars', capabilityFallback: 'beat',
      blend: 'max', eventPriority: 105,
    }),
  ], { priority: 40 }),
  group('parade-ground-group', 'Ground and Baseline', ['parade-wave-bottom'], '#43d9ff', [
    authoredAssignment('parade-ground-bass', 'Bass baseline weight', 'bass', 'brightness', {
      amount: 0.34, curve: 'logarithmic', blend: 'add', priority: -35,
    }),
  ], { priority: 10 }),
  group('parade-background-group', 'Background Field', ['parade-wave-top', 'parade-stars'], '#43d9ff', [
    authoredAssignment('parade-background-complexity', 'Complexity background pattern', 'complexity', 'checkerAlternation', {
      amount: 1, curve: 'stepped', capabilityFallback: 'energy', blend: 'replace', priority: -25,
    }),
    authoredAssignment('parade-background-section-arc', 'Section motion arc', 'sectionProgress', 'columnRecruitment', {
      amount: 1, curve: 'easeInOut', blend: 'replace', priority: -20,
    }),
  ], { priority: 0 }),
  group('parade-star-group', 'Stars and Particles', ['parade-stars'], '#43d9ff', [
    authoredAssignment('parade-star-high', 'High star density', 'high', 'sparkleDensity', {
      amount: 0.46, curve: 'exponential', capabilityFallback: 'midHighActivity', blend: 'max', priority: -15,
    }),
    authoredAssignment('parade-star-hat', 'Hat star sparkle', 'hat', 'sparkle', {
      amount: 0.7, hold: 0.015, release: 0.09, capabilityFallback: 'midHighActivity',
      maximumStacking: 3, blend: 'max', eventPriority: 130,
    }),
  ], { priority: 55 }),
  group('parade-prop-group', 'Accent Props', ['parade-eq', 'parade-orbit'], '#ffd35c', [
    authoredAssignment('parade-prop-snare', 'Snare prop flash', 'snare', 'outlineFlash', {
      amount: 0.78, hold: 0.04, release: 0.2, capabilityFallback: 'transient',
      paletteRole: 'highlight', blend: 'max', eventPriority: 165,
    }),
    authoredAssignment('parade-prop-four-bars', 'Four-bar call and response', 'fourBarBoundary', 'directionReverse', {
      targetScope: 'animation', amount: 1, hold: 0.08, release: 0.16, quantization: 'fourBars',
      capabilityFallback: 'beat', blend: 'replace', eventPriority: 95,
    }),
  ], { priority: 50 }),
  group('parade-impact-group', 'Percussion Impact Bank', ['parade-burst', 'parade-eq'], '#ffd35c', [
    authoredAssignment('parade-impact-drop', 'Drop full-parade reveal', 'dropImpact', 'brightness', {
      amount: 0.86, hold: 0.06, release: 0.34, decayCurve: 'overshoot', capabilityFallback: 'transient',
      paletteRole: 'highlight', blend: 'add', eventPriority: 210,
    }),
    authoredAssignment('parade-impact-kick', 'Kick foreground bounce', 'kick', 'scale', {
      amount: 0.1, hold: 0.035, release: 0.18, decayCurve: 'overshoot', capabilityFallback: 'beat',
      clamp: [0, 1], eventPriority: 155,
    }),
  ], { priority: 65 }),
  group('parade-recruitment-group', 'Participant Recruitment Bank', ['parade-star-left', 'parade-pal', 'parade-orbit', 'parade-eq'], '#67e3aa', [
    authoredAssignment('parade-build-recruitment', 'Build participant recruitment', 'buildProgress', 'columnRecruitment', {
      amount: 1, curve: 'easeInOut', blend: 'replace', conditions: sections('build', 'preDrop'), priority: -10,
    }),
    authoredAssignment('parade-sixteen-bar-cast', 'Sixteen-bar cast evolution', 'sixteenBarBoundary', 'maskExpansion', {
      amount: 0.2, hold: 0.16, release: 0.56, quantization: 'sixteenBars', capabilityFallback: 'beat',
      blend: 'max', eventPriority: 110,
    }),
  ], { priority: 42 }),
  group('parade-alternate-layout-group', 'Alternate Layout Bank', ['parade-wave-top', 'parade-wave-bottom', 'parade-orbit'], '#67e3aa', [
    authoredAssignment('parade-drop-two-layout', 'Drop 2 alternate staging', 'dropOccurrenceChange', 'positionX', {
      amount: 0.08, hold: 0.2, release: 0.6, capabilityFallback: 'disable', clamp: [0, 1],
      conditions: { dropOccurrences: [2, 3, 4, 5, 6, 7, 8], autoPerformanceOnly: true }, eventPriority: 175,
    }),
  ], { priority: 30 }),
]

export const PIXEL_PARADE_AUDIO_ASSIGNMENTS: PixGridReactionAssignment[] = [
  authoredAssignment('parade-hero-bass-bounce', 'Bass foreground bounce', 'bass', 'bounceAmount', {
    targetScope: 'layer', targetId: 'parade-pal', amount: 0.08, curve: 'smoothstep',
    capabilityFallback: 'energy', blend: 'add', clamp: [0, 1], priority: -60,
  }),
  authoredAssignment('parade-wave-top-travel', 'Low-mid upper lane travel', 'lowMid', 'scrollRate', {
    targetScope: 'layer', targetId: 'parade-wave-top', amount: 0.28, curve: 'easeInOut',
    capabilityFallback: 'energy', blend: 'add', clamp: [0, 1], priority: -55,
  }),
  authoredAssignment('parade-wave-bottom-travel', 'Low-mid lower lane travel', 'lowMid', 'scrollRate', {
    targetScope: 'layer', targetId: 'parade-wave-bottom', amount: -0.24,
    curve: 'easeInOut', capabilityFallback: 'energy', blend: 'add', clamp: [0, 1], priority: -54,
  }),
  authoredAssignment('parade-energy-density', 'Energy participant density', 'trackRelativeEnergy', 'density', {
    targetScope: 'output', amount: 1, outputRange: [0.48, 1], curve: 'smoothstep',
    capabilityFallback: 'energy', blend: 'replace', clamp: [0.48, 1], priority: -75,
  }),
  authoredAssignment('parade-vocal-hero-scale', 'Vocal hero focus scale', 'vocalEnergy', 'scale', {
    targetScope: 'layer', targetId: 'parade-pal', amount: 0.1, minimumConfidence: 0.35,
    capabilityFallback: 'energy', curve: 'easeInOut', blend: 'add', clamp: [0, 1], priority: -50,
  }),
  authoredAssignment('parade-track-map-transition', 'Track Map transition handoff', 'trackMapCueEvent', 'transitionStrength', {
    targetScope: 'transition', amount: 1, hold: 0.05, release: 0.25, capabilityFallback: 'disable',
    blend: 'max', eventPriority: 250,
  }),
]
