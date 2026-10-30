import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'
import { resolveCinema2EffectiveBpm } from '../Cinema2BeatClock'
import type { IfritPattern } from './Cinema2IfritDomain'

export const IFRIT_REFERENCE_DEPTHS = [2.4, 4.0, 6.6, 10.8] as const
export const IFRIT_PASSAGE_SPAN = 13.6
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t) }
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const mod = (v: number, span: number) => ((v % span) + span) % span

export interface IfritMotionControls { travel: number; rotation: number; sync: boolean }
export interface IfritPhases { travel: number; spin: number; score: number }
/** Reads shared musical position. Energy never enters the timeline integral.
 * Control/sync edits preserve the current pose; discontinuities reconstruct from
 * current authored settings at the canonical position, independent of prior energy.
 */
export class IfritTimeline {
  private previous: IfritMotionControls | null = null
  private offsets: IfritPhases = { travel: 0, spin: 0, score: 0 }
  private last: IfritPhases = { travel: 0, spin: 0, score: 0 }
  reset() { this.previous = null; this.offsets = { travel: 0, spin: 0, score: 0 } }
  update(frame: Readonly<Cinema2ModuleFrameReadContext>, time: number, controls: IfritMotionControls, reset: boolean): IfritPhases {
    const index = frame.audio?.rhythm.beatIndex, phase = frame.audio?.rhythm.beatPhase
    const hasGrid = controls.sync && index?.available && phase?.available && typeof index.value === 'number' && typeof phase.value === 'number'
    const position = hasGrid ? index!.value! + phase!.value! : time * (controls.sync ? (resolveCinema2EffectiveBpm(frame) ?? 120) / 60 : 2)
    const idle = frame.transport?.sourcePresent === false ? 0.12 : 1
    const raw = { travel: position * controls.travel * 2.3 * idle, spin: position * controls.rotation * 1.4 * idle, score: position * Math.max(controls.travel, Math.abs(controls.rotation)) * idle }
    if (reset) this.reset()
    if (this.previous && (this.previous.sync !== controls.sync || this.previous.travel !== controls.travel || this.previous.rotation !== controls.rotation)) {
      this.offsets = { travel: this.last.travel - raw.travel, spin: this.last.spin - raw.spin, score: this.last.score - raw.score }
    }
    this.previous = { ...controls }
    this.last = { travel: raw.travel + this.offsets.travel, spin: raw.spin + this.offsets.spin, score: raw.score + this.offsets.score }
    return { ...this.last }
  }
}
export interface IfritVisualControls { count: number; spacing: number; twist: number; detail: number }
export interface IfritRingPose { distance: number; angle: number; radius: number; illumination: number }
export interface IfritVisualFrame {
  rings: IfritRingPose[]; wallTravel: number; wallRoll: number; wallActivity: number; wallDensity: number
  leftAccent: number; rightAccent: number; wallShimmer: number; transition: number
}
export type IfritChannels = Readonly<Record<string, number>>
/** An authored stroke: anticipation, accelerated opening, hold, controlled retrace. */
export function ifritStroke(position: number) {
  const t = mod(position, 1)
  if (t < 0.18) return 0
  if (t < 0.56) return smooth((t - 0.18) / 0.38)
  if (t < 0.72) return 1
  return 1 - smooth((t - 0.72) / 0.28)
}
function patternPose(pattern: IfritPattern, ring: number, count: number, phase: IfritPhases, c: IfritVisualControls): IfritRingPose {
  const depth = ring / Math.max(1, count - 1), reference = depth * 3, lo = Math.floor(reference)
  const baseDistance = mix(IFRIT_REFERENCE_DEPTHS[lo], IFRIT_REFERENCE_DEPTHS[Math.min(3,lo+1)], reference-lo)
  let distance = mod(baseDistance * c.spacing + 0.8 - phase.travel, IFRIT_PASSAGE_SPAN * c.spacing) - 0.8
  const stroke = ifritStroke(phase.score / 4 - depth * 0.08)
  let angle = phase.spin + [0.035,-0.045,0.02,0][ring % 4]
  let radius = 1, illumination = 1
  switch (pattern) {
    case 'infernalPassage':
      angle += c.twist * (stroke * 1.3 - 0.25) * (0.4 + depth * 0.6)
      illumination = 0.65 + 0.35 * (1-depth)
      break
    case 'twistedDescent':
      angle += c.twist * (depth * 2.4 + (stroke-0.5) * 0.8)
      radius += c.twist * 0.05 * Math.sin(depth * Math.PI * 2 - phase.score)
      illumination = 0.7 + 0.3 * Math.cos(depth * Math.PI + phase.score * 0.4) ** 2
      break
    case 'counterfire':
      angle = (ring % 2 ? -1 : 1) * (phase.spin + c.twist * (0.25 + stroke * 1.3))
      distance += c.twist * (ring % 2 ? -0.35 : 0.35) * stroke
      illumination = ring % 2 ? 0.65 + stroke * 0.35 : 1 - stroke * 0.35
      break
    case 'compressionChamber': {
      const pressure = ifritStroke(phase.score / 6)
      distance = mix(distance, 5 + (distance-5)*0.48, pressure*c.twist)
      angle += (ring % 2 ? -1 : 1) * c.twist * pressure * 0.55
      radius *= 1 - pressure*c.twist*0.07
      illumination = 0.55 + 0.45*pressure
      break
    }
    case 'emberRelay': {
      const wave = mod(phase.score / 5, 1)
      const d = Math.min(Math.abs(depth-wave), 1-Math.abs(depth-wave))
      illumination = 0.22 + 0.95 * (1-smooth(d/0.30))
      angle += c.twist * (stroke-0.5)*0.35
      radius += c.twist * (1-smooth(d/0.25))*0.09
      break
    }
    case 'riftLock': {
      const lock = ifritStroke(phase.score / 4)
      angle = phase.spin*0.25 + (ring % 2 ? -1 : 1)*c.twist*(1-lock)*1.4
      radius += c.twist*(1-lock)*0.10
      distance += (depth-0.5)*c.twist*lock*0.8
      illumination = 0.55 + lock*0.55
      break
    }
  }
  return { distance, angle, radius, illumination }
}
/** All musical inputs are resolved Cinema channels. Spatial gestures have different
 * front/middle/far roles; their delayed envelopes are owned by shared Choreography.
 */
export function createIfritVisualFrame(phase: IfritPhases, c: IfritVisualControls, channels: IfritChannels, pattern: IfritPattern, previous: IfritPattern = pattern, transition = 1): IfritVisualFrame {
  const ch = (key: string) => clamp(channels[key] ?? 0)
  const progress=channels.buildPhase == null ? ch('build') : ch('buildPhase')
  const buildAmount=progress>0 ? clamp(ch('build')/progress) : ch('directorBuild')
  const tension=clamp(Math.max(progress,ch('directorBuild')*.7))
  const t = smooth(transition), intensity = ch('directorIntensity'), momentum = ch('directorMomentum')
  const impactWeight=.7+.3*ch('directorImpact')
  const patternKick = { infernalPassage:1, twistedDescent:0.7, counterfire:0.9, compressionChamber:0.5, emberRelay:0.6, riftLock:1.2 }[pattern]
  const rings = Array.from({length:c.count},(_,ring)=>{
    const a = patternPose(previous,ring,c.count,phase,c), b = patternPose(pattern,ring,c.count,phase,c)
    const delta = Math.atan2(Math.sin(b.angle-a.angle),Math.cos(b.angle-a.angle))
    // A transition changes each ring's real pose, including distance/radius/light.
    const pose = { distance:mix(a.distance,b.distance,t),angle:a.angle+delta*t,radius:mix(a.radius,b.radius,t),illumination:mix(a.illumination,b.illumination,t) }
    // Recycling changes a fixture's physical role. Group accents by its current
    // distance, never its original array index, so the wave keeps moving into depth.
    const depth=clamp(pose.distance/(IFRIT_PASSAGE_SPAN*c.spacing))
    const near = 1-smooth((depth-0.15)/0.45), far = smooth((depth-0.4)/0.5), middle = Math.max(0,1-Math.abs(depth-0.5)*2)
    const kick = (ch('kickNear')*near + ch('kickMiddle')*middle + ch('kickFar')*far)*patternKick*impactWeight
    // Build stages: gather depth, wind opposing banks, then brace for release.
    const gather=smooth(tension/.4)*buildAmount, wind=smooth((tension-.3)/.45)*buildAmount, brace=smooth((tension-.75)/.25)*buildAmount
    pose.distance=mix(pose.distance,5.0+(pose.distance-5.0)*0.72,gather*0.65)
    pose.angle += c.twist*(ring%2?-1:1)*wind*(1-brace)*0.65
    pose.radius *= 1-0.06*brace*(0.5+far)
    pose.distance -= kick*(0.45*near+0.22*middle+0.08*far)
    pose.radius *= 1+kick*0.08*(1-depth*.6)-ch('bass')*0.035*(0.4+near*.6)
    // Drop: expand near frames -> align depth -> recover to authored pose.
    pose.radius *= 1+ch('dropExpand')*(0.15*near+0.04*middle)*impactWeight-ch('dropRecover')*0.02*far
    const snap=Math.round(pose.angle/(Math.PI/3))*(Math.PI/3)
    pose.angle=mix(pose.angle,snap,ch('dropAlign')*0.85)
    pose.angle += c.twist*ch('directorVariation')*(depth-.5)*0.12
    pose.radius *= 1+momentum*0.025*Math.sin(phase.score-depth*2)
    pose.illumination *= 1+kick*.45+ch('drop')*.2*impactWeight+intensity*.18+ch('downbeatAccent')*.2*near+ch('phraseAccent')*.18*far
    pose.illumination *= 1-ch('vocal')*.25*far
    return pose
  })
  return {
    rings,wallTravel:phase.travel,wallRoll:phase.spin*.22,
    wallActivity:1+ch('energy')*.28+intensity*.24+ch('dropExpand')*.6*impactWeight,
    wallDensity:c.detail*(1-ch('vocal')*.28),
    leftAccent:ch('snareLeft'),rightAccent:ch('snareRight'),wallShimmer:ch('highs')*.5+ch('phraseAccent')*.2,transition:t,
  }
}
