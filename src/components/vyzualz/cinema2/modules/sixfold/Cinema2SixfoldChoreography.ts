export const CINEMA2_SIXFOLD_SYSTEM_COUNT = 6
export const CINEMA2_SIXFOLD_FRAME_COUNT = 5
export const CINEMA2_SIXFOLD_LED_CHANNEL_COUNT = 18

export interface Cinema2SixfoldPerformanceInput {
  readonly pattern: number
  readonly phaseBeats: number
  readonly responses: readonly [number, number, number, number, number, number]
  readonly build: number
  readonly drop: number
  readonly vocalPresence: number
}

export interface Cinema2SixfoldPerformancePose {
  irisBladeOffset: number
  irisScale: number
  outerMechanismRotation: number
  innerMechanismRotation: number
  globalRotation: number
  illumination: number
  readonly facetFold: Float32Array
  readonly facetTwist: Float32Array
  readonly facetRadial: Float32Array
  readonly facetDepth: Float32Array
  readonly frameScale: Float32Array
  readonly frameDepth: Float32Array
  readonly frameLight: Float32Array
  readonly ledLight: Float32Array
  readonly lockFold: Float32Array
  readonly lockRadial: Float32Array
}

/** Allocation-free authored pose resolver for the six Sixfold performance programs. */
export class Cinema2SixfoldChoreography {
  private readonly pose: Cinema2SixfoldPerformancePose = {
    irisBladeOffset: 0,
    irisScale: 1,
    outerMechanismRotation: 0,
    innerMechanismRotation: 0,
    globalRotation: 0,
    illumination: 1,
    facetFold: new Float32Array(CINEMA2_SIXFOLD_SYSTEM_COUNT),
    facetTwist: new Float32Array(CINEMA2_SIXFOLD_SYSTEM_COUNT),
    facetRadial: new Float32Array(CINEMA2_SIXFOLD_SYSTEM_COUNT),
    facetDepth: new Float32Array(CINEMA2_SIXFOLD_SYSTEM_COUNT),
    frameScale: new Float32Array(CINEMA2_SIXFOLD_FRAME_COUNT),
    frameDepth: new Float32Array(CINEMA2_SIXFOLD_FRAME_COUNT),
    frameLight: new Float32Array(CINEMA2_SIXFOLD_FRAME_COUNT),
    ledLight: new Float32Array(CINEMA2_SIXFOLD_LED_CHANNEL_COUNT),
    lockFold: new Float32Array(CINEMA2_SIXFOLD_SYSTEM_COUNT),
    lockRadial: new Float32Array(CINEMA2_SIXFOLD_SYSTEM_COUNT),
  }

  resolve(input: Readonly<Cinema2SixfoldPerformanceInput>): Readonly<Cinema2SixfoldPerformancePose> {
    this.reset()
    const phase = finite(input.phaseBeats)
    const iris = clamp01(input.responses[0])
    const facets = clamp01(input.responses[1])
    const layers = clamp01(input.responses[2])
    const mechanisms = clamp01(input.responses[3])
    const illumination = clamp01(input.responses[4])
    const locks = clamp01(input.responses[5])
    const build = clamp01(input.build)
    const drop = clamp01(input.drop)
    const restraint = 1 - clamp01(input.vocalPresence) * 0.46
    const beatPulse = pulse(phase)

    switch (input.pattern) {
      case 1: this.harmonicExpansion(phase, iris, facets, layers, mechanisms, illumination, locks, restraint); break
      case 2: this.recursiveDescent(phase, iris, facets, layers, mechanisms, illumination, locks, restraint); break
      case 3: this.mirrorFold(phase, iris, facets, layers, mechanisms, illumination, locks, restraint); break
      case 4: this.singularity(phase, iris, facets, layers, mechanisms, illumination, locks, build, drop, restraint); break
      case 5: this.lockstep(phase, iris, facets, layers, mechanisms, illumination, locks, beatPulse, restraint); break
      default: this.phaseCascade(phase, iris, facets, layers, mechanisms, illumination, locks, restraint); break
    }
    return this.pose
  }

  private reset(): void {
    this.pose.irisBladeOffset = 0
    this.pose.irisScale = 1
    this.pose.outerMechanismRotation = 0
    this.pose.innerMechanismRotation = 0
    this.pose.globalRotation = 0
    this.pose.illumination = 1
    this.pose.facetFold.fill(0)
    this.pose.facetTwist.fill(0)
    this.pose.facetRadial.fill(0)
    this.pose.facetDepth.fill(0)
    this.pose.frameScale.fill(0)
    this.pose.frameDepth.fill(0)
    this.pose.frameLight.fill(1)
    this.pose.ledLight.fill(0.15)
    this.pose.lockFold.fill(0)
    this.pose.lockRadial.fill(0)
  }

  private harmonicExpansion(phase: number, iris: number, facets: number, layers: number, mechanisms: number, light: number, locks: number, restraint: number): void {
    const breath = wave(phase * 0.25)
    this.pose.irisBladeOffset = -(0.035 + iris * 0.13) * breath * restraint
    this.pose.irisScale = 0.98 + breath * (0.025 + iris * 0.045) * restraint
    this.pose.outerMechanismRotation = phase * 0.035 * (0.35 + mechanisms)
    this.pose.innerMechanismRotation = -phase * 0.052 * (0.35 + mechanisms)
    this.pose.globalRotation = Math.sin(phase * Math.PI / 8) * 0.012 * mechanisms
    this.pose.illumination = 0.72 + light * 0.9 + breath * 0.28
    for (let index = 0; index < CINEMA2_SIXFOLD_SYSTEM_COUNT; index += 1) {
      this.pose.facetFold[index] = signed(index) * breath * (0.055 + facets * 0.13) * restraint
      this.pose.facetRadial[index] = breath * (0.04 + facets * 0.16) * restraint
      this.pose.lockRadial[index] = (breath - 0.5) * locks * 0.12 * restraint
    }
    for (let index = 0; index < CINEMA2_SIXFOLD_FRAME_COUNT; index += 1) {
      const delayed = wave(phase * 0.25 - index * 0.08)
      this.pose.frameScale[index] = delayed * layers * 0.025 * restraint
      this.pose.frameDepth[index] = -delayed * layers * index * 0.035 * restraint
      this.pose.frameLight[index] = 0.66 + delayed * (0.24 + light * 0.7)
    }
    for (let side = 0; side < 6; side += 1) for (let segment = 0; segment < 3; segment += 1) {
      const expansion = wave(phase * 0.25 - Math.abs(segment - 1) * 0.16 - (side % 2) * 0.025)
      this.pose.ledLight[side * 3 + segment] = 0.16 + expansion * (0.36 + light * 1.08)
    }
  }

  private recursiveDescent(phase: number, iris: number, facets: number, layers: number, mechanisms: number, light: number, locks: number, restraint: number): void {
    this.pose.irisBladeOffset = iris * 0.045 * restraint
    this.pose.irisScale = 0.97 - iris * 0.025 * restraint
    this.pose.outerMechanismRotation = phase * 0.09 * (0.4 + mechanisms)
    this.pose.innerMechanismRotation = -phase * 0.12 * (0.4 + mechanisms)
    this.pose.globalRotation = Math.sin(phase * Math.PI / 6) * 0.018 * mechanisms
    this.pose.illumination = 0.62 + light * 0.72
    for (let index = 0; index < CINEMA2_SIXFOLD_SYSTEM_COUNT; index += 1) {
      const relay = wave(phase * 0.5 - index / 6)
      this.pose.facetFold[index] = signed(index) * relay * facets * 0.1 * restraint
      this.pose.facetDepth[index] = -relay * facets * 0.16 * restraint
      this.pose.lockFold[index] = relay * locks * 0.08 * restraint
    }
    for (let index = 0; index < CINEMA2_SIXFOLD_FRAME_COUNT; index += 1) {
      const descent = wave(phase * 0.5 - index * 0.18)
      this.pose.frameScale[index] = (descent - 0.5) * layers * 0.035 * restraint
      this.pose.frameDepth[index] = -descent * (0.08 + layers * 0.24) * restraint
      this.pose.frameLight[index] = 0.48 + descent * (0.35 + light * 0.85)
    }
    for (let channel = 0; channel < CINEMA2_SIXFOLD_LED_CHANNEL_COUNT; channel += 1) {
      const descent = wave(phase * 0.5 - channel * 0.075)
      this.pose.ledLight[channel] = 0.12 + descent * (0.4 + light * 1.12)
    }
  }

  private mirrorFold(phase: number, iris: number, facets: number, layers: number, mechanisms: number, light: number, locks: number, restraint: number): void {
    const fold = Math.sin(phase * Math.PI * 0.5)
    this.pose.irisBladeOffset = -iris * 0.035 * restraint
    this.pose.irisScale = 1 + iris * 0.018 * restraint
    this.pose.outerMechanismRotation = fold * (0.08 + mechanisms * 0.16)
    this.pose.innerMechanismRotation = -fold * (0.11 + mechanisms * 0.2)
    this.pose.illumination = 0.7 + light * 0.82
    for (let index = 0; index < CINEMA2_SIXFOLD_SYSTEM_COUNT; index += 1) {
      const pairSign = index < 3 ? 1 : -1
      this.pose.facetFold[index] = pairSign * fold * (0.09 + facets * 0.22) * restraint
      this.pose.facetTwist[index] = signed(index) * fold * facets * 0.065 * restraint
      this.pose.lockFold[index] = pairSign * fold * locks * 0.12 * restraint
    }
    for (let index = 0; index < CINEMA2_SIXFOLD_FRAME_COUNT; index += 1) {
      this.pose.frameScale[index] = Math.abs(fold) * layers * 0.008 * restraint
      this.pose.frameLight[index] = 0.62 + (index % 2 === 0 ? 1 : 0.42) * light * (0.42 + Math.abs(fold) * 0.48)
    }
    for (let side = 0; side < 6; side += 1) for (let segment = 0; segment < 3; segment += 1) {
      const mirroredSegment = side < 3 ? segment : 2 - segment
      const reflected = wave(phase * 0.25 - (side % 3) * 0.13 - mirroredSegment * 0.09)
      this.pose.ledLight[side * 3 + segment] = 0.14 + reflected * (0.34 + light * 1.16)
    }
  }

  private phaseCascade(phase: number, iris: number, facets: number, layers: number, mechanisms: number, light: number, locks: number, restraint: number): void {
    this.pose.irisBladeOffset = -pulse(phase * 0.5) * iris * 0.07 * restraint
    this.pose.irisScale = 1 + pulse(phase * 0.5) * iris * 0.035 * restraint
    this.pose.outerMechanismRotation = phase * 0.065 * (0.4 + mechanisms)
    this.pose.innerMechanismRotation = -phase * 0.04 * (0.4 + mechanisms)
    this.pose.globalRotation = Math.sin(phase * Math.PI / 12) * 0.01 * mechanisms
    this.pose.illumination = 0.62 + light * 0.78
    for (let index = 0; index < CINEMA2_SIXFOLD_SYSTEM_COUNT; index += 1) {
      const cascade = pulse(phase - index / 6)
      this.pose.facetFold[index] = cascade * (0.04 + facets * 0.24) * restraint
      this.pose.facetRadial[index] = cascade * facets * 0.13 * restraint
      this.pose.lockFold[index] = cascade * locks * 0.14 * restraint
      this.pose.lockRadial[index] = cascade * locks * 0.07 * restraint
    }
    for (let index = 0; index < CINEMA2_SIXFOLD_FRAME_COUNT; index += 1) {
      const cascade = wave(phase * 0.5 - index * 0.14)
      this.pose.frameScale[index] = (cascade - 0.5) * layers * 0.025 * restraint
      this.pose.frameDepth[index] = -cascade * layers * 0.08 * restraint
      this.pose.frameLight[index] = 0.5 + cascade * (0.3 + light * 0.86)
    }
    for (let side = 0; side < 6; side += 1) for (let segment = 0; segment < 3; segment += 1) {
      const cascade = pulse(phase - side / 6 - segment / 18)
      this.pose.ledLight[side * 3 + segment] = 0.1 + cascade * (0.72 + light * 1.22)
    }
  }

  private lockstep(phase: number, iris: number, facets: number, layers: number, mechanisms: number, light: number, locks: number, beatPulse: number, restraint: number): void {
    const step = Math.floor(fract(phase) * 6) / 5
    const direction = Math.floor(phase) % 2 === 0 ? 1 : -1
    this.pose.irisBladeOffset = -step * iris * 0.08 * restraint
    this.pose.irisScale = 0.985 + step * iris * 0.04 * restraint
    this.pose.outerMechanismRotation = direction * step * (0.14 + mechanisms * 0.18)
    this.pose.innerMechanismRotation = -direction * step * (0.18 + mechanisms * 0.22)
    this.pose.illumination = 0.48 + light * 0.72 + beatPulse * 0.7
    for (let index = 0; index < CINEMA2_SIXFOLD_SYSTEM_COUNT; index += 1) {
      const indexStep = ((index + Math.floor(phase)) % 6) / 5
      this.pose.facetFold[index] = direction * indexStep * facets * 0.17 * restraint
      this.pose.facetTwist[index] = signed(index) * step * facets * 0.04 * restraint
      this.pose.lockFold[index] = beatPulse * locks * 0.18 * restraint
      this.pose.lockRadial[index] = beatPulse * locks * 0.09 * restraint
    }
    for (let index = 0; index < CINEMA2_SIXFOLD_FRAME_COUNT; index += 1) {
      const layerStep = Math.floor(fract(phase * 0.5 + index * 0.12) * 4) / 3
      this.pose.frameScale[index] = layerStep * layers * 0.018 * restraint
      this.pose.frameDepth[index] = -layerStep * layers * 0.09 * restraint
      this.pose.frameLight[index] = 0.42 + beatPulse * (0.5 + light) + (index === Math.floor(phase) % 5 ? 0.35 : 0)
    }
    const activeLed = (Math.floor(fract(phase) * CINEMA2_SIXFOLD_LED_CHANNEL_COUNT) + Math.floor(phase) * 3) % CINEMA2_SIXFOLD_LED_CHANNEL_COUNT
    for (let channel = 0; channel < CINEMA2_SIXFOLD_LED_CHANNEL_COUNT; channel += 1) {
      const trailDistance = (activeLed - channel + CINEMA2_SIXFOLD_LED_CHANNEL_COUNT) % CINEMA2_SIXFOLD_LED_CHANNEL_COUNT
      this.pose.ledLight[channel] = channel === activeLed
        ? 1.05 + light * 1.15
        : trailDistance <= 2 ? 0.42 + beatPulse * 0.55 : 0.08
    }
  }

  private singularity(phase: number, iris: number, facets: number, layers: number, mechanisms: number, light: number, locks: number, build: number, drop: number, restraint: number): void {
    const tension = Math.max(build, wave(phase * 0.125) * 0.28)
    const release = drop
    this.pose.irisBladeOffset = (tension * 0.13 - release * 0.18) * (0.45 + iris) * restraint
    this.pose.irisScale = 1 - tension * 0.11 * restraint + release * 0.14
    this.pose.outerMechanismRotation = phase * (0.04 + tension * 0.18) * (0.5 + mechanisms)
    this.pose.innerMechanismRotation = -phase * (0.07 + tension * 0.24) * (0.5 + mechanisms)
    this.pose.globalRotation = Math.sin(phase * Math.PI) * tension * 0.012
    this.pose.illumination = 0.42 + light * 0.55 + tension * 0.9 + release * 1.25
    for (let index = 0; index < CINEMA2_SIXFOLD_SYSTEM_COUNT; index += 1) {
      this.pose.facetFold[index] = signed(index) * (tension * 0.16 - release * 0.26) * (0.4 + facets) * restraint
      this.pose.facetRadial[index] = (-tension * 0.2 + release * 0.34) * (0.45 + facets) * restraint
      this.pose.facetDepth[index] = (tension * 0.24 - release * 0.36) * restraint
      this.pose.lockFold[index] = tension * locks * 0.17 * restraint - release * 0.13
      this.pose.lockRadial[index] = tension * locks * 0.1 * restraint - release * 0.12
    }
    for (let index = 0; index < CINEMA2_SIXFOLD_FRAME_COUNT; index += 1) {
      const depthWeight = (index + 1) / CINEMA2_SIXFOLD_FRAME_COUNT
      this.pose.frameScale[index] = (-tension * 0.045 + release * 0.075) * depthWeight * (0.5 + layers) * restraint
      this.pose.frameDepth[index] = (tension * 0.2 - release * 0.34) * depthWeight * restraint
      this.pose.frameLight[index] = 0.38 + tension * depthWeight * (0.5 + light) + release * (1.3 - depthWeight * 0.25)
    }
    for (let side = 0; side < 6; side += 1) for (let segment = 0; segment < 3; segment += 1) {
      const compressionOrder = segment === 1 ? 1 : 0.48
      const charge = wave(phase * 0.125 - Math.abs(segment - 1) * 0.11 - side * 0.012)
      this.pose.ledLight[side * 3 + segment] = 0.1 + tension * compressionOrder * (0.68 + light * 0.9) + charge * 0.18 + release * (1.25 + light)
    }
  }
}

function wave(cycles: number): number { return 0.5 + 0.5 * Math.sin(cycles * Math.PI * 2) }
function pulse(beats: number): number { const value = Math.max(0, Math.sin(fract(beats) * Math.PI)); return value * value * value * value }
function fract(value: number): number { return value - Math.floor(value) }
function signed(index: number): number { return index % 2 === 0 ? 1 : -1 }
function finite(value: number): number { return Number.isFinite(value) ? value : 0 }
function clamp01(value: number): number { return Math.min(1, Math.max(0, finite(value))) }
