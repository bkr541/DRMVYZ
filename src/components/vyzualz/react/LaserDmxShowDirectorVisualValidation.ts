import { DEFAULT_MI_FRAME } from '../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../features/musicIntelligence/types'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  type LaserDmxMatrixBeamVisualRole,
  type ReactTrackSection,
} from './ReactTypes'
import { buildLaserDmxShowDirectorPerformanceContext } from './LaserDmxShowDirectorPerformanceContext'
import type { LaserDmxShowDirectorPerformancePresetDefinition } from './LaserDmxShowDirectorPerformancePresets'
import { resolveLaserDmxShowDirectorPerformance } from './LaserDmxShowDirectorPerformanceResolver'
import { compileLaserDmxShowDirectorToBeamMatrix } from './renderers/LaserDmxShowDirectorBeamMatrixCompiler'
import { applyShowDirectorPerformanceGlobalOverrides } from './renderers/LaserDmxRenderer'
import {
  compileLaserDmxBeamMatrix,
  resetBeamMatrixCompilerState,
  type CompiledLaserDmxMatrixBeam,
} from './renderers/LaserDmxBeamMatrixCompiler'

export const SHOW_DIRECTOR_VISUAL_VALIDATION_SEED = 0x5a17cafe
export const SHOW_DIRECTOR_VISUAL_VALIDATION_SIZE = Object.freeze({ width: 640, height: 360 })

export const SHOW_DIRECTOR_VISUAL_VALIDATION_SECTIONS: ReactTrackSection[] = [
  { id: 'intro-1', label: 'Intro', type: 'intro', startSec: 0, endSec: 16, intensity: 0.34, source: 'auto', confidence: 1 },
  { id: 'verse-1', label: 'Verse', type: 'verse', startSec: 16, endSec: 32, intensity: 0.54, source: 'auto', confidence: 1 },
  { id: 'build-1', label: 'Build', type: 'build', startSec: 32, endSec: 40, intensity: 0.8, source: 'auto', confidence: 1 },
  { id: 'pre-drop-1', label: 'Pre-Drop', type: 'preDrop', startSec: 40, endSec: 44, intensity: 0.68, source: 'auto', confidence: 1 },
  { id: 'drop-1', label: 'Drop 1', type: 'drop', startSec: 44, endSec: 60, intensity: 1, source: 'auto', confidence: 1 },
  { id: 'breakdown-1', label: 'Breakdown', type: 'breakdown', startSec: 60, endSec: 76, intensity: 0.28, source: 'auto', confidence: 1 },
  { id: 'drop-2', label: 'Drop 2', type: 'drop', startSec: 76, endSec: 92, intensity: 1, source: 'auto', confidence: 1 },
  { id: 'outro-1', label: 'Outro', type: 'outro', startSec: 92, endSec: 108, intensity: 0.3, source: 'auto', confidence: 1 },
]

export type ShowDirectorVisualValidationFrameId =
  | 'intro' | 'verse' | 'build' | 'pre-drop' | 'drop-1-impact'
  | 'drop-1-body' | 'breakdown' | 'drop-2-impact' | 'drop-2-body' | 'outro'

export interface ShowDirectorVisualValidationFrameDefinition {
  id: ShowDirectorVisualValidationFrameId
  timeSec: number
  kick?: boolean
  snare?: boolean
  transient?: number
}

export const SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES: readonly ShowDirectorVisualValidationFrameDefinition[] = Object.freeze([
  { id: 'intro', timeSec: 4.1 },
  { id: 'verse', timeSec: 20.1, kick: true },
  { id: 'build', timeSec: 38.95 },
  { id: 'pre-drop', timeSec: 42.1 },
  { id: 'drop-1-impact', timeSec: 44.2, kick: true, snare: true, transient: 1 },
  { id: 'drop-1-body', timeSec: 52.95 },
  { id: 'breakdown', timeSec: 64.1 },
  { id: 'drop-2-impact', timeSec: 76.2, kick: true, snare: true, transient: 1 },
  { id: 'drop-2-body', timeSec: 84.95 },
  { id: 'outro', timeSec: 100.1 },
])

function sectionAt(timeSec: number): ReactTrackSection {
  return SHOW_DIRECTOR_VISUAL_VALIDATION_SECTIONS.find(section => timeSec >= section.startSec && timeSec < section.endSec)
    ?? SHOW_DIRECTOR_VISUAL_VALIDATION_SECTIONS[SHOW_DIRECTOR_VISUAL_VALIDATION_SECTIONS.length - 1]
}

export function createShowDirectorVisualValidationFrame(
  definition: ShowDirectorVisualValidationFrameDefinition,
): MusicIntelligenceFrame {
  const section = sectionAt(definition.timeSec)
  const absoluteBeat = definition.timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  const progress = (definition.timeSec - section.startSec) / Math.max(0.001, section.endSec - section.startSec)
  const drop = section.type === 'drop'
  const energy = drop ? 0.96 : section.type === 'build' ? 0.82 : section.type === 'breakdown' ? 0.3 : section.intensity
  return {
    ...DEFAULT_MI_FRAME,
    timeSec: definition.timeSec,
    frameId: Math.round(definition.timeSec * 60),
    trackId: 'show-director-visual-validation-track',
    sourceId: 'show-director-visual-validation-track',
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      sub: 0.76, bass: 0.82, mid: 0.5, high: 0.58, volume: energy,
      normalizedSub: 0.76, normalizedBass: 0.82, normalizedMid: 0.5, normalizedHigh: 0.58,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 1,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatHit: true,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      downbeatHit: beatIndex % 4 === 0,
      kickHit: definition.kick ?? false,
      kickStrength: definition.kick ? 1 : 0,
      snareHit: definition.snare ?? false,
      snareStrength: definition.snare ? 1 : 0,
      transient: definition.transient ?? 0,
      transientConfidence: 1,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: energy,
      shortTerm: energy,
      longTerm: 0.56,
      peak: 0.98,
      delta: section.type === 'build' ? 0.14 : 0.02,
      buildProgress: section.type === 'build' || section.type === 'preDrop' ? progress : 0,
      dropImpact: drop && progress < 0.08 ? 1 : 0.18,
      tension: section.type === 'build' || section.type === 'preDrop' ? 0.82 : 0.42,
    },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: section.type,
      label: section.label,
      startSec: section.startSec,
      endSec: section.endSec,
      progress,
      intensity: section.intensity,
      confidence: 1,
      source: 'analysis',
    },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!,
      beatGrid: true,
      rhythmEvents: true,
      sections: true,
      liveBands: true,
      trackEnergyCurve: true,
    },
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 1, rhythm: 1, section: 1 },
  }
}

function ids(prefix: string): () => string {
  let index = 0
  return () => `${prefix}-${++index}`
}

export interface ShowDirectorVisualValidationResolution {
  presetId: string
  presetName: string
  frame: ShowDirectorVisualValidationFrameDefinition
  section: string
  bar: number
  fixtureCount: number
  activeFixtureCount: number
  compiledBeamCount: number
  activeMotif: string | null
  recruitmentStage: number
  beams: CompiledLaserDmxMatrixBeam[]
  metrics: ShowDirectorVisualGeometryMetrics
  output: ReturnType<typeof compileLaserDmxBeamMatrix>['output']
  fog: ReturnType<typeof compileLaserDmxBeamMatrix>['fog']
}

export function resolveShowDirectorVisualValidationFrame(
  preset: LaserDmxShowDirectorPerformancePresetDefinition,
  definition: ShowDirectorVisualValidationFrameDefinition,
  size = SHOW_DIRECTOR_VISUAL_VALIDATION_SIZE,
): ShowDirectorVisualValidationResolution {
  const frame = createShowDirectorVisualValidationFrame(definition)
  const program = preset.createProgram()
  const context = buildLaserDmxShowDirectorPerformanceContext({
    audioTimeSec: definition.timeSec,
    frame,
    resolvedSections: SHOW_DIRECTOR_VISUAL_VALIDATION_SECTIONS,
    trackIdentity: 'show-director-visual-validation-track',
    seekIdentity: `visual:${preset.id}:${definition.id}`,
    loopIdentity: 'visual-loop-0',
    previous: null,
  })
  const result = resolveLaserDmxShowDirectorPerformance({
    authoredShowDirector: preset.createRig(ids(`${preset.id}-visual`)),
    program,
    context,
    tuning: program.tuning,
    programSeed: program.deterministicSeed ^ SHOW_DIRECTOR_VISUAL_VALIDATION_SEED,
    enabled: true,
    audioIntelligenceEnabled: true,
    fallbackBehavior: 'basicTiming',
    runtimeInvalidationId: `${preset.id}:visual-validation`,
    transportDiscontinuityIdentity: `visual:${definition.id}`,
  })
  const authoredMatrix = compileLaserDmxShowDirectorToBeamMatrix({
    showDirector: result.showDirector,
    beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    sections: SHOW_DIRECTOR_VISUAL_VALIDATION_SECTIONS,
    fixturePriorityById: result.fixturePriorityById,
    fixturePriorityRoleById: result.fixturePriorityRoleById,
  })
  const matrix = applyShowDirectorPerformanceGlobalOverrides(authoredMatrix, result.requestedGlobalOutputOverrides)
  resetBeamMatrixCompilerState()
  const compiled = compileLaserDmxBeamMatrix({
    settings: matrix,
    mi: frame,
    timeSec: definition.timeSec,
    canvasWidth: size.width,
    canvasHeight: size.height,
  })
  const activeFixtureCount = result.showDirector.fixtures.filter(fixture => fixture.enabled && fixture.brightness > 0.01).length
  return {
    presetId: preset.id,
    presetName: preset.name,
    frame: definition,
    section: result.currentSection,
    bar: context.barWithinMacroSection,
    fixtureCount: result.showDirector.fixtures.length,
    activeFixtureCount,
    compiledBeamCount: compiled.beams.length,
    activeMotif: result.activeMotifFamily ?? null,
    recruitmentStage: result.eightBarRecruitmentStage,
    beams: compiled.beams,
    metrics: measureShowDirectorVisualGeometry(preset.id, compiled.beams, size.width, size.height, activeFixtureCount),
    output: compiled.output,
    fog: compiled.fog,
  }
}

export interface ShowDirectorVisualGeometryMetrics {
  activeSourceCount: number
  originDistinguishability: number
  angularDiversity: number
  protectedZoneOccupancy: number
  symmetry: number
  saturation: number
  luminance: number
  heroToTextureBrightnessRatio: number
  dominantColorCount: number
  roleCounts: Record<LaserDmxMatrixBeamVisualRole, number>
  geometrySignature: string
}

function sourceKey(beam: CompiledLaserDmxMatrixBeam): string {
  return beam.groupId ?? `${Math.round(beam.origin.x)}:${Math.round(beam.origin.y)}`
}

function protectedZoneContains(presetId: string, x: number, y: number, width: number, height: number): boolean {
  const nx = x / width
  const ny = y / height
  if (presetId === 'cyan-mirror-cage') return nx >= 0.445 && nx <= 0.555 && ny >= 0.08 && ny <= 0.94
  if (presetId === 'cardinal-fan-reactor') {
    const dx = (nx - 0.5) / 0.115
    const dy = (ny - 0.52) / 0.16
    return dx * dx + dy * dy <= 1
  }
  const dx = Math.abs(nx - 0.5) / 0.105
  const dy = Math.abs(ny - 0.52) / 0.135
  return dx + dy <= 1
}

function lineProtectedOccupancy(
  presetId: string,
  beam: CompiledLaserDmxMatrixBeam,
  width: number,
  height: number,
): number {
  let occupied = 0
  const samples = 24
  for (let index = 1; index < samples; index += 1) {
    const t = index / samples
    const x = beam.visibleOrigin.x + (beam.visibleTarget.x - beam.visibleOrigin.x) * t
    const y = beam.visibleOrigin.y + (beam.visibleTarget.y - beam.visibleOrigin.y) * t
    if (protectedZoneContains(presetId, x, y, width, height)) occupied += 1
  }
  return occupied / (samples - 1)
}

function colorFamily(beam: CompiledLaserDmxMatrixBeam): string {
  const { r, g, b } = beam.rgba
  if (Math.max(r, g, b) - Math.min(r, g, b) < 35) return 'white'
  if (r > b * 1.15 && r > g * 1.15) return r > 235 && g > 90 ? 'orange-red' : 'red-magenta'
  if (b > r * 1.12 && b > g * 1.03) return r > 120 ? 'violet' : 'blue'
  if (g > r * 1.05 && b > r * 1.18) return 'cyan'
  return 'accent'
}

export function measureShowDirectorVisualGeometry(
  presetId: string,
  beams: CompiledLaserDmxMatrixBeam[],
  width: number,
  height: number,
  activeFixtureCount: number,
): ShowDirectorVisualGeometryMetrics {
  const visible = beams.filter(beam => beam.strobeVisible && beam.intensity > 0.005)
  const sources = new Set(visible.map(sourceKey))
  const angleBins = new Set(visible.map(beam => {
    const angle = Math.atan2(beam.visibleTarget.y - beam.visibleOrigin.y, beam.visibleTarget.x - beam.visibleOrigin.x)
    return Math.round(angle / (Math.PI / 24))
  }))
  const protectedZoneOccupancy = visible.length
    ? visible.reduce((sum, beam) => sum + lineProtectedOccupancy(presetId, beam, width, height), 0) / visible.length
    : 0
  const left = new Array<number>(12).fill(0)
  const right = new Array<number>(12).fill(0)
  for (const beam of visible) {
    const yBin = Math.max(0, Math.min(11, Math.floor(beam.visibleTarget.y / height * 12)))
    const weight = beam.intensity * Math.max(0.25, beam.beamWidth)
    if (beam.visibleTarget.x < width / 2) left[yBin] += weight
    else right[yBin] += weight
  }
  const symmetryDenominator = left.reduce((sum, value, index) => sum + Math.max(value, right[index]), 0)
  const symmetryDifference = left.reduce((sum, value, index) => sum + Math.abs(value - right[index]), 0)
  const symmetry = symmetryDenominator > 0 ? Math.max(0, 1 - symmetryDifference / symmetryDenominator) : 1
  let saturationWeight = 0
  let saturationSum = 0
  let luminanceSum = 0
  const roleCounts: Record<LaserDmxMatrixBeamVisualRole, number> = { hero: 0, primary: 0, secondary: 0, texture: 0, impact: 0 }
  const roleEnergy: Record<LaserDmxMatrixBeamVisualRole, number[]> = { hero: [], primary: [], secondary: [], texture: [], impact: [] }
  const families = new Map<string, number>()
  for (const beam of visible) {
    roleCounts[beam.visualRole] += 1
    const weight = beam.intensity * Math.max(0.25, beam.beamWidth)
    roleEnergy[beam.visualRole].push(weight)
    const max = Math.max(beam.rgba.r, beam.rgba.g, beam.rgba.b)
    const min = Math.min(beam.rgba.r, beam.rgba.g, beam.rgba.b)
    const saturation = max > 0 ? (max - min) / max : 0
    saturationSum += saturation * weight
    saturationWeight += weight
    luminanceSum += ((0.2126 * beam.rgba.r + 0.7152 * beam.rgba.g + 0.0722 * beam.rgba.b) / 255) * weight
    families.set(colorFamily(beam), (families.get(colorFamily(beam)) ?? 0) + weight)
  }
  const averageRole = (roles: LaserDmxMatrixBeamVisualRole[]) => {
    const values = roles.flatMap(role => roleEnergy[role])
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
  }
  const hero = averageRole(['hero', 'impact'])
  const texture = averageRole(['texture'])
  const familyTotal = [...families.values()].reduce((sum, value) => sum + value, 0)
  const dominantColorCount = [...families.values()].filter(value => familyTotal > 0 && value / familyTotal >= 0.1).length
  const geometrySignature = visible
    .map(beam => `${sourceKey(beam)}:${Math.round(beam.visibleTarget.x / 8)}:${Math.round(beam.visibleTarget.y / 8)}:${beam.visualRole}:${colorFamily(beam)}`)
    .sort()
    .join('|')
  return {
    activeSourceCount: sources.size,
    originDistinguishability: activeFixtureCount > 0 ? Math.min(1, sources.size / activeFixtureCount) : 1,
    angularDiversity: visible.length ? Math.min(1, angleBins.size / Math.min(24, visible.length)) : 0,
    protectedZoneOccupancy,
    symmetry,
    saturation: saturationWeight > 0 ? saturationSum / saturationWeight : 0,
    luminance: saturationWeight > 0 ? luminanceSum / saturationWeight : 0,
    heroToTextureBrightnessRatio: texture > 0 ? hero / texture : hero > 0 ? 8 : 1,
    dominantColorCount,
    roleCounts,
    geometrySignature,
  }
}

export function showDirectorGeometryDifference(
  a: ShowDirectorVisualGeometryMetrics,
  b: ShowDirectorVisualGeometryMetrics,
): number {
  const left = new Set(a.geometrySignature.split('|').filter(Boolean))
  const right = new Set(b.geometrySignature.split('|').filter(Boolean))
  const union = new Set([...left, ...right])
  if (!union.size) return 0
  let shared = 0
  for (const item of left) if (right.has(item)) shared += 1
  return 1 - shared / union.size
}
