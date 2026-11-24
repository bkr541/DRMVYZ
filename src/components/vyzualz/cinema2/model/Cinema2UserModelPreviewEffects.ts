import type * as Three from 'three'
import type { Cinema2RenderQualityLevel } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2MainframePatternController } from '../modules/mainframe/Cinema2MainframePatternController'
import { Cinema2MainframeBeatClockResolver, computeCinema2MainframeBuildCharge, resolveCinema2MainframeTimeSec, type Cinema2MainframeBeatClockFrame } from '../modules/mainframe/Cinema2MainframePatternEngine'
import { readCinema2MainframeContinuous } from '../modules/mainframe/Cinema2MainframeMusicAdapter'
import { Cinema2PatternAutoPerformance } from '../modules/mainframe/Cinema2PatternAutoPerformance'
import { resolveCinema2MainframeSourceIdentity, selectCinema2MainframeAudio, resolveCinema2MainframePlaybackState } from '../modules/mainframe/Cinema2MainframeAudioDelivery'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from '../modules/Cinema2AfterhoursNativeModule'
import { cinema2DustCycle, cinema2DustSurfaceRank, Cinema2UserModelDustDissolve, decorateCinema2DustPoints, createCinema2DustUniforms, cinema2ProgressiveSample, cinema2GrainSeed, type Cinema2DustUniforms } from './Cinema2UserModelFormDust'
import { buildCinema2UserModelSlices, cinema2SliceSpread, type Cinema2SlicedUserModel } from './Cinema2UserModelSlices'
import { prepareCinema2UserModel, type Cinema2PreparedUserModel } from './Cinema2UserModelPreparation'
import { Cinema2ShatteredUserModel, animateCinema2Shatter } from './Cinema2UserModelShatter'
import { Cinema2VoxelizedUserModel } from './Cinema2UserModelVoxels'
import { Cinema2UserModelHologram } from './Cinema2UserModelHologram'
import { CINEMA2_USER_MODEL_PREVIEWS, CINEMA2_USER_MODEL_PROXY_LIMITS, type Cinema2UserModelPreviewKind } from './Cinema2UserModelPreviewPatterns'

const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n))
interface Controls { tintModel: boolean; modelYaw: number; modelScale: number; pattern: number; phase: number; movement: number; intensity: number; opacity: number; emission: number; reaction: number; primary: readonly number[]; secondary: readonly number[]; accent: readonly number[] }
interface Original { material: Three.MeshStandardMaterial; color: Three.Color; emissive: Three.Color; intensity: number; opacity: number; transparent: boolean; wireframe: boolean; depthWrite: boolean }
interface Attached {
  shatter: Cinema2ShatteredUserModel | null
  voxels: Cinema2VoxelizedUserModel | null
  hologram: Cinema2UserModelHologram | null
  effectProblem: string | null
  cutModel: Cinema2SlicedUserModel | null
  sliceProblem: string | null
  dissolve: Cinema2UserModelDustDissolve | null
  dustUniforms: Cinema2DustUniforms
  ownsPreparation: boolean
  prepared: Cinema2PreparedUserModel
  root: Three.Object3D; pivot: Three.Group; source: Three.Group; accent: Three.Mesh
  meshes: Three.Mesh[]; originals: Original[]
  points: Three.Points[]
  primary: Three.MeshStandardMaterial; secondary: Three.MeshStandardMaterial; pointMaterials: Three.PointsMaterial[]
  geometries: Set<Three.BufferGeometry>; materials: Set<Three.Material>; extent: number
}
/**
 * What Auto Performance puts on stage for each preview: a build gathers the model toward a compact or charged form, and a drop releases it
 * into the preview's most energetic arrangement. Both are patterns the preview already offers in its Pattern list.
 */
export const CINEMA2_USER_MODEL_AUTO_PERFORMANCE_PATTERNS: Readonly<Record<Cinema2UserModelPreviewKind, Readonly<{ build: string; drop: string }>>> = Object.freeze({
  form: Object.freeze({ build: 'Breathing Form', drop: 'Rocking Plinth' }),
  shatter: Object.freeze({ build: 'Rejoined Clusters', drop: 'Radial Burst' }),
  dust: Object.freeze({ build: 'Compressed Mist', drop: 'Twin Plumes' }),
  hologram: Object.freeze({ build: 'Scan Sweep', drop: 'Signal Pulse' }),
  slices: Object.freeze({ build: 'Collapsed Layers', drop: 'Fan Sections' }),
  voxel: Object.freeze({ build: 'Compact Blocks', drop: 'Column Lift' }),
})
/** Runtime-only visual controller; source geometry stays owned by the private asset lease. */
export class Cinema2UserModelPreviewEffects {
  readonly afterVisibility = true
  private readonly attachments = new Map<Three.Object3D, Attached>()
  private readonly clock = new Cinema2MainframeBeatClockResolver()
  private readonly patterns: Cinema2MainframePatternController<string>
  private previousTime: number | null = null
  private previousIdentity: string | null = null
  private previousGeneration: number | null = null
  private previousEdit: number | null = null
  private lastImpulse: string | null = null
  private impulse = 0
  private previousDiscontinuity: string | null = null
  private previousAuthored: string | null = null
  private readonly autoPerformance: Cinema2PatternAutoPerformance<string>
  /** The pattern Auto Performance has on stage right now, or null while the authored/triggered one is. For inspection and tests. */
  performancePattern: string | null = null
  private controls: Controls = { tintModel: false, modelYaw: 0, modelScale: 1, pattern: 0, phase: 0, movement: 0.35, intensity: 0.8, opacity: 1, emission: 0.2, reaction: 0, primary: [0.55, 0.85, 1], secondary: [0.7, 0.3, 0.9], accent: [0.1, 0.9, 0.8] }
  private shardImpulse = 0
  private dustImpulse = 0
  private dustSparkle = 0
  private dustBrightness = 0
  private holoFlash = 0
  private holoInterference = 0
  private holoEcho = 0
  private holoDistortion = 0
  private scanPhase = 0
  private dustPhase = 0
  private previousVisualPhase: number | null = null
  private shardMotion = 1
  private debris = .35
  private shardCracks = 0
  private dustSize = 1
  private dustOpacity = 1
  private dustTurbulence = .5
  private holoThickness = 1
  private holoScanWidth = .12
  private holoRim = 1
  private holoScanSpeed = 1
  private holoDirection = 0
  private voxelRotation = .5
  private voxelVariation = .2
  private formDeformation = 0
  private manualPose = false
  private hologramLines = 1
  private density = 1
  private dustDrift = 1
  private dustFlow = 1
  private dustFlowDirection = 0
  private musicalDirector = false
  private sliceDirection = 'y'
  private voxelDetail = 'auto'
  private representedStart = false
  startRepresented(): void { this.representedStart = true }
  private fallbackMotionBeats = 0
  private cycleStartBeat: number | null = null
  private lastStagePattern: string | null = null
  private sliceSpread = 0
  private dustCycle = cinema2DustCycle(0)
  private readonly dummy: Three.Object3D
  private readonly tint: Three.Color
  constructor(private readonly library: Cinema2ThreeLibrary, readonly kind: Cinema2UserModelPreviewKind, private readonly shardDetail = 24, private readonly sliceCount = 14, private readonly sliceAxis = 'y') {
    this.patterns = new Cinema2MainframePatternController<string>(CINEMA2_USER_MODEL_PREVIEWS[kind], CINEMA2_USER_MODEL_PREVIEWS[kind][0])
    const programs = CINEMA2_USER_MODEL_AUTO_PERFORMANCE_PATTERNS[kind]
    const patterns = CINEMA2_USER_MODEL_PREVIEWS[kind]
    this.autoPerformance = new Cinema2PatternAutoPerformance<string>({ buildPattern: programs.build, dropPattern: programs.drop, mood: { options: { calm: [patterns[0], patterns[5]], driving: [patterns[1], patterns[2]], tense: [patterns[3], patterns[4]], peak: [patterns[0], patterns[3]] }, minHoldSec: 4 } })
    this.dummy = new library.THREE.Object3D(); this.tint = new library.THREE.Color()
  }
  update({ frame, parameters }: Cinema2ModuleUpdateContext, sharedTiming?: Readonly<{ timing: Readonly<Cinema2MainframeBeatClockFrame>; motionBeats: number }>): void {
    const number = (name: string, fallback: number, min = 0, max = 1) => { const value = parameters.get(name); return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback }
    const color = (name: string, fallback: readonly number[]) => { const value = parameters.get(name); return Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(n => typeof n === 'number' && Number.isFinite(n)) ? value as number[] : fallback }
    const audio = selectCinema2MainframeAudio(frame.audio, frame.transport?.trackId)
    const time = resolveCinema2MainframeTimeSec(frame), identity = resolveCinema2MainframeSourceIdentity(frame, audio)
    const discontinuity = audio?.discontinuity.occurred ? JSON.stringify(audio.discontinuity) : null
    const reset = this.previousIdentity !== null && identity !== this.previousIdentity || this.previousTime !== null && (time < this.previousTime - 1e-6 || time - this.previousTime > 0.75) || this.previousGeneration !== null && frame.contextGeneration !== this.previousGeneration || discontinuity !== null && discontinuity !== this.previousDiscontinuity
    const timing = sharedTiming?.timing ?? this.clock.resolve(frame, parameters.get('bpmSync') !== false)
    const names: readonly string[] = CINEMA2_USER_MODEL_PREVIEWS[this.kind], value = parameters.get('pattern'), authored = typeof value === 'string' && names.includes(value) ? value : names[0]
    const triggerValue = parameters.get('trigger'), trigger = CINEMA2_AFTERHOURS_TRIGGER_IDS.includes(triggerValue as Cinema2AfterhoursTriggerId) ? triggerValue as Cinema2AfterhoursTriggerId : 'beat'
    const acceptedFrame = audio ? { ...frame, audio } : { ...frame, audio: null }
    const event = resolveCinema2AfterhoursTriggerEventIdentity(acceptedFrame, trigger, this.previousTime)
    const edit = parameters.getEditRevision?.('pattern') ?? 0
    const sameValueEdit = this.previousEdit !== null && edit !== this.previousEdit
    const selection = this.patterns.update({ authoredPattern: authored, patternChange: parameters.get('patternChange') === true, trigger, triggerEventId: event, absoluteBeat: timing.beats, reset: reset || sameValueEdit })
    const playing = resolveCinema2MainframePlaybackState(frame, audio) === 'playing' || (frame.transport?.playing === true && frame.transport.sourcePresent && !frame.transport.paused)
    // Basic choreography follows actual playback even while analysis is unavailable.
    // No musical events or energy are invented; analyzed frames keep the shared clock.
    if (!audio) {
      if (reset || this.previousTime === null) this.fallbackMotionBeats = timing.beats
      else if (playing) this.fallbackMotionBeats += clamp(time - this.previousTime, 0, .25) * timing.bpm / 60
    }
    const motionBeats = sharedTiming?.motionBeats ?? (!audio ? this.fallbackMotionBeats : timing.beats)
    // Auto Performance (when on): the canonical drop identity and the shared build charge substitute a pattern for a bounded moment. The
    // authored Pattern, Pattern Change and Trigger keep running underneath; nothing is written back to the saved settings.
    const dropEventId = playing ? resolveCinema2AfterhoursTriggerEventIdentity(acceptedFrame, 'drop', this.previousTime) : null
    const buildCharge = playing && audio ? computeCinema2MainframeBuildCharge(readCinema2MainframeContinuous(audio, frame.director)) : 0
    const performing = this.autoPerformance.update({
      enabled: parameters.get('autoPerformance') === true && playing, absoluteBeat: timing.beats, buildCharge, dropEventId,
      patternEdited: this.previousAuthored != null && authored !== this.previousAuthored || sameValueEdit, reset,
      mood: parameters.get('audioRepresentationDirector') === true ? frame.mood : null, deltaTimeSec: frame.deltaTimeSec, basePattern: selection.activePattern, patternChange: parameters.get('patternChange') === true, seed: identity,
    })
    this.performancePattern = performing.pattern
    this.previousAuthored = authored
    const onStage = performing.pattern ?? selection.activePattern
    if (reset) { this.impulse = 0; this.lastImpulse = null }
    const dt = playing ? clamp(frame.deltaTimeSec, 0, 0.25) : 0
    this.impulse *= Math.exp(-dt / number('response', 0.35, 0.05, 1.5))
    const hit = playing ? audio?.rhythm.kick ?? audio?.rhythm.downbeat : null
    const structural = playing ? resolveCinema2AfterhoursTriggerEventIdentity(acceptedFrame, 'drop', this.previousTime) ?? resolveCinema2AfterhoursTriggerEventIdentity(acceptedFrame, 'phrase', this.previousTime) : null
    const impulseId = structural ?? hit?.id ?? null
    if (impulseId && impulseId !== this.lastImpulse && !reset) { this.impulse = structural ? 1 : 0.7; this.lastImpulse = impulseId }
    const energy = playing && audio?.features.overallEnergy.available ? clamp(audio.features.overallEnergy.value ?? 0) : 0
    const reaction = number('reactivity', 0.6) * clamp(energy * 0.5 + this.impulse * 0.7)
    const speed = number('speed', 1, 0, 3), movement = number('movement', .35, 0, .8)
    if (this.cycleStartBeat === null || reset || sameValueEdit || onStage !== this.lastStagePattern) this.cycleStartBeat = motionBeats
    this.lastStagePattern = onStage
    if (this.representedStart) {
      const duration = number(this.kind === 'dust' ? 'cycleBeats' : this.kind === 'slices' ? 'sliceCycleBeats' : 'transformCycleBeats', 16, 8, 64)
      this.cycleStartBeat = motionBeats - duration * .48 / Math.max(.01, number('speed', 1, 0, 3))
      this.representedStart = false
    }
    this.musicalDirector = parameters.get('audioRepresentationDirector') === true && parameters.get('autoPerformance') === true
    const enhanced = this.musicalDirector || parameters.get('audioMappingsEnabled') === true
    const cycleBeats = number('cycleBeats', 16, 8, 64), moving = speed > 0 && movement > 0
    this.dustCycle = cinema2DustCycle(moving ? Math.max(0, motionBeats - this.cycleStartBeat) * speed : 0, cycleBeats)
    if (moving && performing.reason === 'build') this.dustCycle = cinema2DustCycle((enhanced ? .05 + .29 * buildCharge : .66 + .22 * buildCharge) * cycleBeats, cycleBeats)
    if (moving && performing.reason === 'drop') this.dustCycle = cinema2DustCycle((.34 + .54 * clamp((timing.beats - performing.startBeat) / 8)) * cycleBeats, cycleBeats)
    this.sliceSpread = moving ? cinema2SliceSpread(Math.max(0, motionBeats - this.cycleStartBeat) * speed, number(this.kind === 'slices' ? 'sliceCycleBeats' : 'transformCycleBeats', 16, 8, 64)) : 0
    if (moving && performing.reason === 'build') this.sliceSpread = enhanced ? .08 + .72 * clamp(buildCharge) : 1 - clamp(buildCharge)
    if (moving && performing.reason === 'drop') this.sliceSpread = clamp((8 - (timing.beats - performing.startBeat)) / 3) * (enhanced ? clamp((timing.beats - performing.startBeat) / .25) : 1)
    // Manual pose is opt-in; legacy presets retain the original musical transformation cycles.
    const manualPose = parameters.get('effectPose') === 'representation'
    if (manualPose) {
      this.sliceSpread = 1
      this.dustCycle = { ...this.dustCycle, dissolve: 1, spread: 1 }
    }
    this.shardImpulse = number('shardImpulse', 0)
    this.dustImpulse = number('dustImpulse', 0)
    this.dustSparkle = number('dustSparkle', 0)
    this.dustBrightness = number('dustBrightness', 0)
    this.holoFlash = number('hologramFlash', 0)
    this.holoInterference = number('hologramInterference', 0)
    this.holoEcho = number('hologramEcho', 0)
    this.holoDistortion = number('hologramDistortion', 0)
    this.shardMotion = number('shardMotion', 1)
    this.debris = number('shardDebris', .35)
    this.shardCracks = number('shardCracks', 0)
    this.dustSize = number('dustSize', 1, .25, 3)
    this.dustOpacity = number('dustOpacity', 1)
    this.dustTurbulence = number('dustTurbulence', .5, 0, 2)
    this.holoThickness = number('hologramThickness', 1, .25, 3)
    this.holoScanWidth = number('hologramScanWidth', .12, .02, .5)
    this.holoRim = number('hologramRim', 1, 0, 3)
    this.holoScanSpeed = number('hologramScanSpeed', 1, 0, 3)
    this.holoDirection = ['y', 'x', 'z', 'diagonal'].indexOf(String(parameters.get('hologramScanDirection') ?? 'y'))
    this.voxelRotation = number('voxelRotation', .5)
    this.voxelVariation = number('voxelVariation', .2)
    this.formDeformation = number('formDeformation', 0, 0, .15)
    this.density = number('dustDensity', 1, .1, 1)
    this.dustDrift = number('dustDrift', 1, 0, 1)
    this.dustFlow = number('dustFlow', 1, 0, 2)
    this.dustFlowDirection = number('dustFlowDirection', 0, -1, 1)
    this.sliceDirection = String(parameters.get('sliceDirection') ?? 'y')
    this.voxelDetail = String(parameters.get('voxelDetail') ?? 'auto')
    const separation = this.kind === 'shatter' ? number('shatterSpread', 1) : this.kind === 'slices' ? number('sliceSeparation', 1) : this.kind === 'voxel' ? number('voxelSeparation', 1) : 1
    // Keep the representation visible at zero separation in manual pose, while preserving the legacy reassembly path.
    this.sliceSpread *= separation
    if (this.kind === 'shatter') {
      const reassembly = 1 - number('shardReassembly', 0)
      this.shardImpulse *= reassembly
      this.sliceSpread = Math.max(this.sliceSpread, this.shardCracks * .006, this.shardImpulse * .55) * reassembly
    }
    if (this.kind === 'dust') {
      const reassembly = 1 - number('dustReassembly', 0)
      this.dustImpulse *= reassembly
      this.dustCycle = { ...this.dustCycle, dissolve: clamp(Math.max(this.dustCycle.dissolve, this.dustImpulse * .65) * reassembly), spread: clamp(Math.max(this.dustCycle.spread, this.dustImpulse * .55) * reassembly) }
    }
    if (this.kind === 'hologram') this.sliceSpread = Math.max(this.sliceSpread, this.holoFlash * .35)
    this.manualPose = manualPose
    this.hologramLines = number('hologramLines', 1, .25, 2)
    this.controls = { tintModel: this.kind === 'form' && parameters.get('formMaterial') === 'original' ? false : parameters.get('tintModel') === true || this.kind === 'form' && parameters.get('formMaterial') === 'palette', modelYaw: number('modelYaw', 0, -180, 180) * Math.PI / 180, modelScale: number('modelScale', 1, .5, 1.2), pattern: names.indexOf(onStage), phase: motionBeats * Math.PI * 0.25 * number('speed', 1, 0, 3) * (number('movement', .35, 0, .8) > 0 ? 1 : 0), movement: number('movement', 0.35, 0, 0.8), intensity: number('intensity', 0.8, 0, 2), opacity: number('opacity', 1, 0.1, 1) * (this.kind === 'hologram' ? 1 - number('hologramTransparency', 0, 0, .9) : 1), emission: number('emission', 0.2, 0, 2) + (this.kind === 'hologram' ? number('hologramGlow', 0, 0, 2) : 0), reaction, primary: color('primary', this.controls.primary), secondary: color('secondary', this.controls.secondary), accent: color('accent', this.controls.accent) }
    // Integrate modulation of motion rates using the already-resolved shared musical phase.
    // Changing a rate changes velocity, not absolute position; no independent clock is introduced.
    const phase = this.controls.phase
    if (reset || this.previousVisualPhase === null) { this.dustPhase = phase * this.dustFlow; this.scanPhase = phase * this.holoScanSpeed }
    else { const advance = phase - this.previousVisualPhase; this.dustPhase += advance * this.dustFlow; this.scanPhase += advance * this.holoScanSpeed }
    this.previousVisualPhase = phase
    this.previousTime = time; this.previousIdentity = identity; this.previousGeneration = frame.contextGeneration; this.previousEdit = edit; this.previousDiscontinuity = discontinuity
  }
  attach(root: Three.Object3D, userModel?: boolean, sharedPreparation?: Cinema2PreparedUserModel): void {
    if (!userModel || this.attachments.has(root)) return
    const T = this.library.THREE, prepared = sharedPreparation ?? prepareCinema2UserModel(this.library, root, this.kind === 'dust' ? CINEMA2_USER_MODEL_PROXY_LIMITS.high.dust : undefined)
    const meshes: Three.Mesh[] = []
    root.traverse(object => { if ((object as Three.Mesh).isMesh) meshes.push(object as Three.Mesh) })
    const { center, size, extent } = prepared
    const dustUniforms = createCinema2DustUniforms(extent)
    const pivot = new T.Group(), source = new T.Group(); pivot.name = 'UserModelPreview'; pivot.position.copy(center); source.position.copy(center).multiplyScalar(-1)
    for (const child of [...root.children]) source.add(child)
    pivot.add(source); root.add(pivot)
    const geometries = new Set<Three.BufferGeometry>(), materials = new Set<Three.Material>(), originals: Original[] = []
    let shatter: Cinema2ShatteredUserModel | null = null, voxels: Cinema2VoxelizedUserModel | null = null, hologram: Cinema2UserModelHologram | null = null, effectProblem: string | null = null
    let dissolve: Cinema2UserModelDustDissolve | null = null
    let cutModel: Cinema2SlicedUserModel | null = null, sliceProblem: string | null = null
    try {
      const primary = new T.MeshStandardMaterial({ roughness: 0.45, metalness: 0.25 }); materials.add(primary)
      const secondary = primary.clone(); materials.add(secondary)
      for (const mesh of meshes) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const m = material as Three.MeshStandardMaterial
        if (m.isMeshStandardMaterial) originals.push({ material: m, color: m.color.clone(), emissive: m.emissive.clone(), intensity: m.emissiveIntensity, opacity: m.opacity, transparent: m.transparent, wireframe: m.wireframe, depthWrite: m.depthWrite })
      }
      const ringGeometry = new T.TorusGeometry(extent * 0.59, extent * 0.012, 6, 64), accentMaterial = new T.MeshBasicMaterial(), accent = new T.Mesh(ringGeometry, accentMaterial)
      accent.rotation.x = Math.PI / 2; accent.position.y = -size.y / 2 - extent * 0.035; pivot.add(accent); geometries.add(ringGeometry); materials.add(accentMaterial)
      const haloGeometry = new T.TorusGeometry(extent * .56, extent * .009, 5, 64), halo = new T.Mesh(haloGeometry, secondary); halo.position.z = -size.z / 2 - extent * .05; pivot.add(halo); geometries.add(haloGeometry)
      halo.visible = false; accent.visible = false
      const points: Three.Points[] = [], pointMaterials: Three.PointsMaterial[] = []
      if (this.kind === 'dust') {
        dissolve = new Cinema2UserModelDustDissolve(this.library, root, meshes, center, extent)
        for (let part = 0; part < 2; part++) {
          const geometry = new T.BufferGeometry(), count = prepared.samplePositions.length / 6
          const positions = new Float32Array(count * 3), ranks = new Float32Array(count), seeds = new Float32Array(count)
          for (let i = 0; i < count; i++) {
            const index = cinema2ProgressiveSample(i, count) * 2 + part, offset = index * 3
            positions.set(prepared.samplePositions.subarray(offset, offset + 3), i * 3)
            ranks[i] = cinema2DustSurfaceRank(positions[i * 3] / extent, positions[i * 3 + 1] / extent, positions[i * 3 + 2] / extent)
            seeds[i] = cinema2GrainSeed(index)
          }
          geometry.setAttribute('position', new T.BufferAttribute(positions, 3))
          geometry.setAttribute('c2DustAlpha', new T.BufferAttribute(ranks, 1))
          geometry.setAttribute('c2Seed', new T.BufferAttribute(seeds, 1))
          const material = new T.PointsMaterial({ size: extent * .006, sizeAttenuation: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending })
          decorateCinema2DustPoints(material, dustUniforms)
          const cloud = new T.Points(geometry, material); cloud.frustumCulled = false; pivot.add(cloud); points.push(cloud); pointMaterials.push(material); geometries.add(geometry); materials.add(material)
        }
      } else if (this.kind === 'shatter' || this.kind === 'voxel') {
        try {
          if (this.kind === 'shatter') { shatter = Cinema2ShatteredUserModel.build(this.library, root, prepared, meshes, this.shardDetail); pivot.add(shatter.group) }
          else { voxels = new Cinema2VoxelizedUserModel(this.library, prepared, meshes); pivot.add(voxels.group) }
        } catch (error) { effectProblem = error instanceof Error ? error.message : 'Model transformation unavailable. The original model is kept visible.' }
      } else if (this.kind === 'slices') {
        try {
          let lastError: unknown
          for (const count of new Set([this.sliceCount, Math.min(this.sliceCount, 14), Math.min(this.sliceCount, 8), 2])) {
            try { cutModel = buildCinema2UserModelSlices(this.library, prepared, meshes, count, this.sliceAxis); break } catch (error) { lastError = error }
          }
          if (!cutModel) throw lastError
          pivot.add(cutModel.group)
          for (const material of cutModel.materials.slice(1)) {
            const m = material as Three.MeshStandardMaterial
            if (m.isMeshStandardMaterial) originals.push({ material: m, color: m.color.clone(), emissive: m.emissive.clone(), intensity: m.emissiveIntensity, opacity: m.opacity, transparent: m.transparent, wireframe: m.wireframe, depthWrite: m.depthWrite })
          }
        } catch (error) { sliceProblem = error instanceof Error ? error.message : 'Actual model slices could not be prepared. The original model is kept visible.' }
      } else if (this.kind === 'hologram') {
        hologram = new Cinema2UserModelHologram(this.library, root, meshes, prepared); pivot.add(hologram.group)
      }
      if (shatter) for (const material of shatter.materials) {
        const m = material as Three.MeshStandardMaterial
        if (m.isMeshStandardMaterial) originals.push({ material: m, color: m.color.clone(), emissive: m.emissive.clone(), intensity: m.emissiveIntensity, opacity: m.opacity, transparent: m.transparent, wireframe: m.wireframe, depthWrite: m.depthWrite })
      }
      this.attachments.set(root, { shatter, voxels, hologram, effectProblem, cutModel, sliceProblem, dissolve, dustUniforms, prepared, ownsPreparation: !sharedPreparation, root, pivot, source, meshes, originals, points, primary, secondary, pointMaterials, accent, geometries, materials, extent })
    } catch (error) {
      for (const child of [...source.children]) root.add(child)
      root.remove(pivot)
      pivot.traverse(object => { if ((object as Three.InstancedMesh).isInstancedMesh) (object as Three.InstancedMesh).dispose() })
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
      shatter?.dispose(); voxels?.dispose(); hologram?.dispose(); cutModel?.dispose(); dissolve?.dispose(); if (!sharedPreparation) prepared.dispose()
      throw error
    }
  }
  setTransitionOpacity(opacity: number): void { this.transitionOpacity = clamp(opacity) }
  private transitionOpacity = 1
  beforeDraw(quality: Cinema2RenderQualityLevel = 'high'): void {
    const T = this.library.THREE, c = { ...this.controls, opacity: this.controls.opacity * this.transitionOpacity }, p = c.pattern, phase = c.phase, m = c.movement, r = c.reaction
    const assembly = this.musicalDirector ? this.transitionOpacity : 1
    const drawSpread = this.sliceSpread * assembly, drawDissolve = this.dustCycle.dissolve * assembly
    for (const a of this.attachments.values()) {
      a.source.visible = this.kind === 'form' || this.kind === 'hologram' || this.kind === 'dust' && drawDissolve < .99999 || this.kind === 'slices' && (!a.cutModel || this.sliceSpread < .00001) || this.kind === 'shatter' && (!a.shatter || drawSpread < .00001) || this.kind === 'voxel' && (!a.voxels || !this.manualPose && this.sliceSpread < .15)
      a.pivot.rotation.set(0, 0, 0); a.pivot.scale.setScalar(1); a.pivot.position.copy(a.prepared.center)
      const e = a.extent, oscillation = Math.sin(phase)
      if (this.kind === 'form') {
        // Whole-model choreography only: original topology, UVs and PBR texture maps stay intact.
        const pulse = r * m * .035
        a.pivot.rotation.set(p === 3 ? Math.sin(phase) * m * .3 : Math.cos(phase * .5) * m * .035,
          c.modelYaw + (p === 1 ? .55 + oscillation * m * .18 : p === 5 ? phase * .4 : oscillation * m * .18),
          p === 3 ? Math.sin(phase * .5) * m * .12 : p === 2 ? Math.sin(phase * .7) * m * .08 : 0)
        a.pivot.position.x += Math.sin(phase * .5) * e * m * (p === 0 ? .035 : .015)
        a.pivot.position.y += (p === 2 ? .08 + oscillation * m * .12 : Math.sin(phase * .6) * m * .015) * e
        a.pivot.scale.setScalar(c.modelScale * (1 + (p === 4 ? oscillation * m * .08 : 0) + pulse))
        const flex = this.formDeformation * (.55 + .45 * Math.sin(phase)) * (1 + r * .2)
        a.pivot.scale.x *= 1 + flex; a.pivot.scale.y /= 1 + flex
        // Blend whole-model choreography toward the common rest transform as it crossfades.
        const gain = this.transitionOpacity
        a.pivot.rotation.x *= gain; a.pivot.rotation.y = c.modelYaw + (a.pivot.rotation.y - c.modelYaw) * gain; a.pivot.rotation.z *= gain
        a.pivot.position.lerp(a.prepared.center, 1 - gain)
        a.pivot.scale.x = c.modelScale + (a.pivot.scale.x - c.modelScale) * gain; a.pivot.scale.y = c.modelScale + (a.pivot.scale.y - c.modelScale) * gain; a.pivot.scale.z = c.modelScale + (a.pivot.scale.z - c.modelScale) * gain
      }
      if (this.kind === 'dust') {
        a.pivot.rotation.y = c.modelYaw; a.pivot.scale.setScalar(c.modelScale)
        a.dissolve!.amount.value = drawDissolve
        a.dissolve!.edgeColor.value.setRGB(c.accent[0], c.accent[1], c.accent[2], T.SRGBColorSpace)
        a.dissolve!.edgeStrength.value = c.emission * .5
      }
      for (let i = 0; i < a.originals.length; i++) {
        const o = a.originals[i], tint = o.material.name === 'Model Cut Face' ? c.accent : o.material.name === 'side' ? c.secondary : c.primary
        this.tint.setRGB(tint[0], tint[1], tint[2], T.SRGBColorSpace)
        o.material.color.copy(o.color)
        if (c.tintModel) o.material.color.multiply(this.tint)
        if (o.material.name === 'Model Cut Face') o.material.color.copy(this.tint)
        o.material.color.multiplyScalar(c.intensity)
        o.material.emissive.copy(o.emissive); o.material.emissiveIntensity = o.intensity + c.emission
        o.material.opacity = o.opacity * c.opacity * (this.kind === 'voxel' && a.voxels ? 1 - (this.manualPose ? 1 : clamp(this.sliceSpread / .15)) : 1)
        const transparent = this.kind === 'hologram' || o.transparent || o.material.opacity < 1; if (o.material.transparent !== transparent) o.material.needsUpdate = true; o.material.transparent = transparent; o.material.depthWrite = o.depthWrite && o.material.opacity >= 1 && !(this.kind === 'hologram' && this.sliceSpread > .00001)
      }
      for (const [material, rgb] of [[a.primary, c.primary], [a.secondary, c.secondary]] as const) { material.color.setRGB(rgb[0], rgb[1], rgb[2], T.SRGBColorSpace).multiplyScalar(c.intensity); material.emissive.copy(material.color); material.emissiveIntensity = c.emission + r * .25; material.opacity = c.opacity; if (material.transparent !== (c.opacity < 1)) material.needsUpdate = true; material.transparent = c.opacity < 1 }
      const accent = a.accent.material as Three.MeshBasicMaterial; accent.color.setRGB(c.accent[0], c.accent[1], c.accent[2], T.SRGBColorSpace).multiplyScalar(.7 + c.emission); accent.opacity = c.opacity; if (accent.transparent !== (c.opacity < 1)) accent.needsUpdate = true; accent.transparent = c.opacity < 1
      if (this.kind !== 'form') { a.pivot.rotation.y = c.modelYaw; a.pivot.scale.setScalar(c.modelScale) }
      if (a.hologram) {
        a.pivot.rotation.z = p === 3 ? .25 * this.sliceSpread : 0
        if (p === 4) a.pivot.scale.multiplyScalar(1 + Math.cos(phase * 3) * m * .06 * this.sliceSpread)
        a.hologram.lineDensity.value = this.hologramLines
        a.hologram.qualityScale = quality === 'low' ? .35 : quality === 'medium' ? .65 : 1
        a.hologram.thickness.value = this.holoThickness; a.hologram.scanWidth.value = this.holoScanWidth
        a.hologram.rim.value = this.holoRim; a.hologram.scanSpeed.value = this.holoScanSpeed; a.hologram.direction.value = Math.max(0, this.holoDirection)
        a.hologram.scanOffset.value = this.scanPhase - phase * this.holoScanSpeed
        a.hologram.flash.value = this.holoFlash; a.hologram.interference.value = this.holoInterference
        a.hologram.echoAmount.value = this.holoEcho; a.hologram.distortion.value = this.holoDistortion
        a.hologram.animate(p, phase, this.sliceSpread, e, c.opacity, c.intensity * (.6 + c.emission + r * .3), c.primary, c.accent)
      }
      if (a.shatter) {
        a.shatter.group.visible = drawSpread >= .00001
        animateCinema2Shatter(a.shatter, p, phase, drawSpread * (.35 + .65 * this.transitionOpacity), e, m, r, this.shardMotion, this.debris * (quality === 'low' ? .25 : quality === 'medium' ? .65 : 1), this.shardImpulse * this.transitionOpacity)
      }
      if (a.voxels) {
        a.voxels.group.visible = this.manualPose || this.sliceSpread > .00001
        const tiers = ['low', 'medium', 'high'] as const
        const detail = tiers.findIndex(tier => tier === this.voxelDetail)
        const voxelQuality = detail < 0 ? quality : tiers[Math.min(detail, tiers.indexOf(quality))]!
        a.voxels.animate(voxelQuality, p, phase, this.sliceSpread * (.35 + .65 * this.transitionOpacity), m, r, c.tintModel, c.primary, c.secondary, this.dummy, this.tint, this.voxelRotation, this.voxelVariation)
        const material = a.voxels.material
        material.color.setScalar(c.intensity); material.emissive.setScalar(1); material.emissiveIntensity = c.emission * .2
        material.opacity = c.opacity * (this.manualPose ? 1 : clamp(this.sliceSpread / .15))
        if (material.transparent !== (material.opacity < 1)) material.needsUpdate = true
        material.transparent = material.opacity < 1; material.depthWrite = material.opacity >= 1
      }
      if (a.points.length) {
        const u = a.dustUniforms
        u.c2Release.value = drawDissolve; u.c2Spread.value = this.dustCycle.spread * assembly * this.dustDrift * (.35 + .65 * this.transitionOpacity)
        u.c2Time.value = this.dustPhase; u.c2FlowBias.value = this.dustFlowDirection; u.c2Impulse.value = this.dustImpulse; u.c2Sparkle.value = this.dustSparkle; u.c2Pattern.value = p; u.c2Motion.value = m + r * .2
        u.c2Turbulence.value = this.dustTurbulence; u.c2Density.value = this.density
        for (let part = 0; part < a.points.length; part++) {
          const cloud = a.points[part], count = Math.max(1, Math.floor(CINEMA2_USER_MODEL_PROXY_LIMITS[quality].dust / 2 * this.density))
          cloud.geometry.setDrawRange(0, Math.min(count, cloud.geometry.attributes.position.count)); cloud.visible = drawDissolve > .00001
          const mat = a.pointMaterials[part], rgb = part ? c.secondary : c.primary
          mat.color.setRGB(rgb[0], rgb[1], rgb[2], T.SRGBColorSpace).multiplyScalar(c.intensity * (1 + c.emission + r * .4 + this.dustBrightness * .6))
          mat.opacity = c.opacity * this.dustOpacity; mat.size = e * (quality === 'low' ? .009 : quality === 'medium' ? .006 : .0045) * this.dustSize * (1 + r * m * .3)
        }
      }
      if (a.cutModel) {
        const cut = a.cutModel, spread = this.sliceSpread * (1 + r * .1) * (.35 + .65 * this.transitionOpacity), motion = .35 + m
        cut.group.visible = spread >= .00001
        a.pivot.rotation.y = c.modelYaw; a.pivot.scale.setScalar(c.modelScale)
        const cap = cut.capMaterial
        cap.color.setRGB(c.accent[0], c.accent[1], c.accent[2], T.SRGBColorSpace).multiplyScalar(c.intensity)
        cap.emissive.copy(cap.color); cap.emissiveIntensity = c.emission * .25; cap.opacity = c.opacity
        if (cap.transparent !== (c.opacity < 1)) cap.needsUpdate = true
        cap.transparent = c.opacity < 1; cap.depthWrite = c.opacity >= 1
        for (let i = 0; i < cut.meshes.length; i++) {
          const layer = cut.meshes[i], center = cut.centers[i], y = center / Math.max(a.prepared.size[this.sliceAxis === 'x' ? 'x' : this.sliceAxis === 'z' ? 'z' : 'y'], .001)
          layer.position.set(0, center, 0); layer.rotation.set(0, 0, 0); layer.scale.setScalar(1)
          if (p === 0) layer.position.y += y * e * .45 * spread * motion
          if (p === 1) { layer.position.x += y * e * .6 * spread * motion; layer.position.y += y * e * .18 * spread }
          if (p === 2) { layer.rotation.y = y * 1.5 * spread * motion; layer.position.z += Math.abs(y) * e * .25 * spread; layer.position.y += y * e * .15 * spread }
          if (p === 3) { layer.position.x += (i % 2 ? 1 : -1) * e * .25 * spread * motion; layer.position.y += y * e * .2 * spread }
          if (p === 4) { layer.position.x += Math.sin(y * 7 + phase) * e * .18 * spread * motion; layer.position.z += Math.cos(y * 5 + phase) * e * .15 * spread * motion; layer.rotation.y = Math.sin(phase + y * 3) * .18 * spread }
          if (p === 5) { layer.position.y *= 1 - .65 * spread; layer.position.z += y * e * .2 * spread; layer.rotation.z = -.12 * spread }
          if (this.sliceDirection === 'x') { layer.position.x += layer.position.y - center; layer.position.y = center }
          if (this.sliceDirection === 'z') { layer.position.z += layer.position.y - center; layer.position.y = center }
        }
      }
    }
  }
  detach(root: Three.Object3D): void {
    const a = this.attachments.get(root); if (!a) return
    for (const original of a.originals) {
      const material = original.material
      material.color.copy(original.color); material.emissive.copy(original.emissive)
      material.emissiveIntensity = original.intensity; material.opacity = original.opacity
      if (material.transparent !== original.transparent || material.wireframe !== original.wireframe) material.needsUpdate = true
      material.transparent = original.transparent; material.wireframe = original.wireframe; material.depthWrite = original.depthWrite
    }
    for (const child of [...a.source.children]) root.add(child)
    root.remove(a.pivot); a.shatter?.dispose(); a.voxels?.dispose(); a.hologram?.dispose(); a.cutModel?.dispose(); a.dissolve?.dispose(); if (a.ownsPreparation) a.prepared.dispose(); for (const geometry of a.geometries) geometry.dispose(); for (const material of a.materials) material.dispose()
    this.attachments.delete(root)
  }
  dispose(): void { for (const root of this.attachments.keys()) this.detach(root); this.patterns.reset(); this.clock.reset() }
  hasUsableRepresentation(root: Three.Object3D): boolean {
    const a = this.attachments.get(root)
    return !!a && !a.effectProblem && !a.sliceProblem
  }
  /** Points are not included by the bridge's mesh measurement; report their resident buffers separately. */
  estimateAdditionalGpuBytes(): number {
    let bytes = 0
    for (const a of this.attachments.values()) for (const cloud of a.points) for (const attribute of Object.values(cloud.geometry.attributes)) bytes += attribute.array.byteLength
    for (const a of this.attachments.values()) bytes += (a.voxels?.additionalGpuBytes ?? 0) // Wide-line meshes are counted by the bridge.
    return bytes
  }
  getDiagnostics(): readonly { code: string; message: string }[] {
    return [...this.attachments.values()].flatMap(a => {
      const messages: { code: string; message: string }[] = []
      if (a.sliceProblem || a.effectProblem) messages.push({ code: `CINEMA2_USER_MODEL_${this.kind.toUpperCase()}_LIMIT`, message: a.sliceProblem ?? a.effectProblem! })
      if (a.cutModel && a.cutModel.meshes.length < this.sliceCount) messages.push({ code: 'CINEMA2_USER_MODEL_SLICES_DETAIL', message: 'Slice detail produced fewer nonempty layers than requested, or was reduced to stay within the geometry budget.' })
      if (a.shatter?.limited) messages.push({ code: 'CINEMA2_USER_MODEL_SHATTER_BUDGET', message: 'Fracture detail was reduced to the last complete partition within the geometry budget.' })
      if (a.voxels && !a.voxels.grids.has('high')) messages.push({ code: 'CINEMA2_USER_MODEL_VOXEL_BUDGET', message: 'Voxel resolution was reduced to the highest available occupancy grid within the work and cell budgets.' })
      if (a.cutModel?.openContours || a.shatter?.openContours) messages.push({ code: 'CINEMA2_USER_MODEL_SLICES_OPEN', message: 'Some source surfaces have open or non-manifold cut contours. Only closed contours receive cut-face caps.' })
      if (a.voxels && !a.voxels.solid) messages.push({ code: 'CINEMA2_USER_MODEL_VOXEL_SHELL', message: 'This model has open or non-manifold edges. Voxel uses its actual surface shell; a solid interior is not inferred.' })
      if (a.hologram?.edgeProblem) messages.push({ code: 'CINEMA2_USER_MODEL_HOLOGRAM_EDGES', message: a.hologram.edgeProblem })
      return messages
    })
  }
  inspect() { return { transformSpread: this.sliceSpread, fragments: [...this.attachments.values()].flatMap(a => a.shatter ? [{ count: a.shatter.fragments.length, triangles: a.shatter.triangles, bytes: a.shatter.bytes }] : []), voxels: [...this.attachments.values()].flatMap(a => a.voxels ? [{ solid: a.voxels.solid, grids: [...a.voxels.grids].map(([quality, grid]) => ({ quality, count: grid.count })) }] : []), sliceSpread: this.kind === 'slices' ? this.sliceSpread : null, sliceGeometry: [...this.attachments.values()].flatMap(a => a.cutModel ? [{ layers: a.cutModel.meshes.length, triangles: a.cutModel.triangleCount, capTriangles: a.cutModel.capTriangles, openContours: a.cutModel.openContours, bytes: a.cutModel.byteLength }] : []), dustCycle: this.kind === 'dust' ? this.dustCycle : null, kind: this.kind, pattern: CINEMA2_USER_MODEL_PREVIEWS[this.kind][this.controls.pattern], phase: this.controls.phase, reaction: this.controls.reaction, attachmentCount: this.attachments.size, preparations: [...this.attachments.values()].map(a => ({ triangles: a.prepared.triangleCount, samples: a.prepared.samplePositions.length / 3, sections: a.prepared.sections.length, cpuBytes: a.prepared.byteLength, center: a.prepared.center.toArray(), size: a.prepared.size.toArray(), scaleToUnit: a.prepared.scaleToUnit })), limits: CINEMA2_USER_MODEL_PROXY_LIMITS } }
}
