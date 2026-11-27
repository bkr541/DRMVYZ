import type { OverdriveLook, OverdrivePattern } from './OverdriveScene'

/** Eight physical channels, evaluated in the local sector of each articulated part. */
export const OVERDRIVE_LIGHT_ZONES = ['speaker','inner','spoke','ring','core','rear','cavity','panel'] as const
export type OverdriveLightZone = typeof OVERDRIVE_LIGHT_ZONES[number]
const tau = Math.PI * 2
const clamp = (v:number,min=0,max=1) => Math.max(min,Math.min(max,v))
const wave = (v:number) => .5+.5*Math.cos(v*tau)
const pulse = (v:number) => Math.pow(wave(v),4)

// Radial levels are independent of angular sectors; the same program can travel
// between the core, inner bearings, front arms, speaker bank and rear tracks.
const radius:Record<OverdriveLightZone,number>={core:0,inner:.15,spoke:.48,speaker:.75,ring:.55,rear:.84,cavity:.62,panel:1}
const weights:Record<OverdriveLightZone,readonly [number,number,number]>={
  speaker:[.95,.15,.12],inner:[.34,.85,.25],spoke:[.40,.40,.75],ring:[.65,.24,.48],
  core:[.55,.25,.30],rear:[.64,.15,.30],cavity:[.28,.52,.65],panel:[.30,.65,.40],
}

/** Pattern-specific masks. No wall clock, randomness, or independent beat detector. */
function mask(pattern:OverdrivePattern,angle:number,r:number,phase:number,sector:number,zone:OverdriveLightZone,l:OverdriveLook):number {
  switch(pattern){
    case 'core-lock': return .62+.25*wave(phase*.25-r*.45)+.13*pulse(phase-angle-r*.4)
    case 'piston-wave': return .13+.87*pulse(phase*.65-angle*2-r*.7)
    case 'counterforce': return .13+.87*wave(phase*.5+(sector%2)*.5+r*.2)
    case 'compression': return .12+.88*pulse(phase*.50+r*.88)+l.build*(1-r)*.28
    case 'expansion': return .12+.88*pulse(phase*.50-r*.88)+l.drop*r*.28
    case 'acoustic-array': return zone==='speaker'||zone==='inner' ? .54+.46*wave(phase*2-angle) : .10+.48*pulse(phase-r*.65-angle)
    case 'core-fracture': return .12+.88*pulse(phase*.72+angle*3+r*.6+(sector%3)*.14)
    case 'energy-relay': return .08+.92*pulse(phase*.82-angle-r*.7)
    case 'iris': return .10+.90*wave(phase*.35+(sector%2)*.5-r*.45)
    case 'vortex': return .10+.90*pulse(phase*.72-angle*2+r*.8)
    case 'overload': return .55+.45*wave(phase*1.3-r-angle*.4)
    case 'blackout': return .025+.42*pulse(phase*.30-angle-r*.45)*Math.max(l.bass,l.kick,l.snare,l.phrase)
  }
}

export function overdriveLightingLevel(zone:OverdriveLightZone,sector:number,l:OverdriveLook,track=0):number {
  const a=sector/10, r=clamp(radius[zone]+(zone==='ring'?track*.14:0)), t=l.phase*l.motion
  const [bass,snare,high]=weights[zone]
  const program=clamp(mask(l.pattern,a,r,t,sector,zone,l))
  const reactive=l.bass*bass*.40+l.kick*bass*.52+l.snare*snare*.46+l.high*high*.28+l.mid*.13+l.beat*.08+l.phrase*.20+l.build*(1-r)*.22+l.drop*.42
  const concealed=zone==='rear'||zone==='cavity'||zone==='panel'
  const depth=l.blackoutDepth
  // At rest a readable but low-output machine; no constant full-power wash.
  const base=(.11+.56*program)*(concealed?.66:1)
  const selective=concealed ? (1-depth*.52)+depth*.52*program : 1-depth*.30*(1-program)
  const blackout=l.pattern==='blackout' ? .16 : 1
  return clamp((base+reactive*program)*selective*blackout*l.pose[7]*l.intensity*(concealed?l.reactorLighting:l.radialLighting),0,2.2)
}

/** The low-frequency cone excursion is simulated at a visible, beat-derived
 * rate rather than sampling audio-rate oscillation at display refresh. */
export function overdriveSpeakerMotion(sector:number,l:OverdriveLook) {
  const a=sector/10, t=l.phase
  const pattern=clamp(mask(l.pattern,a,.75,t*l.motion,sector,'speaker',l))
  const envelope=clamp(l.bass*.78+l.kick*.72+l.drop*.32)
  const amount=l.speaker*l.motion*envelope*(.35+.65*pattern)*(l.pattern==='blackout'?.20:1)
  const oscillation=Math.sin(t*tau*2.15+a*tau*.40)
  const secondary=Math.sin(t*tau*3.35-a*tau)
  return { diaphragm:clamp(amount*(.36*l.kick+.78*oscillation),-1,1),
    axial:amount*(.055*l.kick+.021*oscillation),
    tiltX:amount*.025*secondary,tiltY:amount*.021*oscillation,
    scale:1+amount*.014*oscillation }
}
