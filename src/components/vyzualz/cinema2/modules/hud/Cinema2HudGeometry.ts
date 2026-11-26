import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'

export const HUD_PATTERNS = ['reactor','radar','counter-spin','energy-pulse','orbital','segment-chase','collapse','lock-on','overload'] as const
export type HudPattern = typeof HUD_PATTERNS[number]
export const HUD_PALETTE = {
  primary:[.93,.96,1,1], meters:[.32,.39,.92,1], indicators:[.78,.82,1,1],
  metal:[.19,.22,.34,1], satellites:[.32,.36,.63,1], background:[.006,.008,.019,1],
} as const satisfies Record<string,Cinema2Color>
export const HUD_COLOR_KEYS=['primary','meters','indicators','metal','satellites','background'] as const
export type HudPalette = Record<typeof HUD_COLOR_KEYS[number],Cinema2Color>
export const HUD_DEFAULTS={intensity:1,reactivity:.72,motion:.8,rate:1,separation:.72,coverage:.65,satelliteAmount:.8,shutter:.65,meterTravel:.65} as const
export type HudControls=Record<keyof typeof HUD_DEFAULTS,number>
export const HUD_SIGNALS=['sub','bass','mid','high','air','flux','vocal','build','directorIntensity','directorBuild','directorImpact','kick','snare','beat','downbeat','bar','phrase','section','drop'] as const
export type HudSignals=Record<typeof HUD_SIGNALS[number],number>
export const zeroHudSignals=()=>Object.fromEntries(HUD_SIGNALS.map(key=>[key,0])) as HudSignals
export const HUD_STRIDE=12
export const HUD_PERIPHERAL_PRIMITIVES=136
const TAU=Math.PI*2
const clamp=(v:number,min=0,max=1)=>Math.max(min,Math.min(max,v))
const wave=(v:number)=>.5+.5*Math.sin(v)
const wrap=(v:number)=>((v%1)+1)%1
const smooth=(v:number)=>{const q=clamp(v);return q*q*(3-2*q)}

/** A stable beveled cross section swept along the arc. x = along, y = width, z = thickness. */
export function buildHudMesh():Float32Array {
  const profile=[[-.38,-.5],[.38,-.5],[.5,-.34],[.5,.34],[.38,.5],[-.38,.5],[-.5,.34],[-.5,-.34]]
  const result:number[]=[]
  const p=(x:number,i:number)=>[x,...profile[i]!] as number[]
  const tri=(a:number[],b:number[],c:number[])=>result.push(...a,...b,...c)
  for(let k=0;k<12;k++)for(let i=0;i<8;i++){
    const a=k/12,b=(k+1)/12,j=(i+1)%8
    tri(p(a,i),p(b,i),p(b,j));tri(p(a,i),p(b,j),p(a,j))
  }
  for(let i=1;i<7;i++){tri(p(0,0),p(0,i+1),p(0,i));tri(p(1,0),p(1,i),p(1,i+1))}
  return new Float32Array(result)
}

/** Each primitive has stable identity across patterns. No randomness or music detection. */
export function sampleHud(pattern:HudPattern,phase:number,c:HudControls,s:HudSignals,aspect=16/9):Float32Array {
  const out:number[]=[]
  const t=phase*TAU/8
  const a=c.reactivity, sub=s.sub*a, bass=s.bass*a, kick=s.kick*a, drop=s.drop*a, snare=s.snare*a
  const treble=(s.high*.45+s.air*.3+s.flux*.25)*a
  const build=clamp((s.build*.7+s.directorBuild*.3)*a), vocal=s.vocal*a
  const energy=s.directorIntensity*a, impact=s.directorImpact*a
  let scale=1, separation=1, sat=1, turn=1, scan=1, density=1, shutter=0, pulse=0, orbital=0
  switch(pattern){
    case 'radar': turn=.32;scan=.32;density=.7;break
    case 'counter-spin':turn=1.65;separation=1.22;break
    case 'energy-pulse':pulse=1;turn=.32;separation=1.3;break
    case 'orbital':scale=.72;sat=1.2;turn=.4;density=.53;orbital=1;break
    case 'segment-chase':turn=0;scan=.75;break
    case 'collapse':scale=.13+.87*smooth(wave(t*.62));sat=scale;density=.38+.62*scale;separation=scale;break
    case 'lock-on':turn=0;shutter=1;scan=.4;density=.72;break
    case 'overload':turn=1.85;scan=1.7;density=1.35;separation=1.35;pulse=.5;break
  }
  const radial=scale*(1+.05*sub+.045*kick+.06*drop)
  const zSpace=c.separation*separation
  const emission=c.intensity*(1+.22*energy+.2*impact)*(1-.24*vocal)
  // shape: center, depth plane, radius; angle, sweep, width, thickness; role, gain, mode, reserved
  function arc(cx:number,cy:number,z:number,r:number,start:number,span:number,width:number,depth:number,role:number,gain:number){
    out.push(cx,cy,z,r,start,span,Math.max(.0001,width),Math.max(.0001,depth),role,Math.max(0,gain),0,0)
  }
  function line(cx:number,cy:number,z:number,length:number,angle:number,width:number,depth:number,role:number,gain:number){
    out.push(cx,cy,z,length,angle,1,Math.max(.0001,width),Math.max(.0001,depth),role,Math.max(0,gain),1,0)
  }
  function channel(cx:number,cy:number,z:number,r:number,start:number,span:number,width:number,depth:number,role:number,gain:number){
    arc(cx,cy,z-depth*.17,r,start,span,width,depth*.65,3,0)
    arc(cx,cy,z+depth*.16,r-width*.39,start,span,width*.22,depth*.82,3,0)
    arc(cx,cy,z+depth*.16,r+width*.39,start,span,width*.22,depth*.82,3,0)
    arc(cx,cy,z+depth*.30,r,start+.025*span,span*.95,width*.50,depth*.30,role,gain)
  }
  // Quiet full tracks. Their slots and their narrow emissive inserts have actual Z separation.
  const radii=[1.69,2.02,2.35,2.68,3.02]
  for(let band=0;band<5;band++){
    const ringWave=pulse*.085*Math.sin(t*2-band*.82)+kick*.035*Math.sin(band*.75+s.kick*3)
    const assembly=pattern==='collapse'?(.35+.65*smooth((scale-band*.055)*1.6)):1
    const r=radii[band]!*radial*assembly*(1+ringWave),z=(band-2)*.26*zSpace
    const count=[3,36,36,72,72][band]!,step=TAU/count
    const direction=pattern==='counter-spin'||pattern==='overload'?(band%2===0?1:-1):1
    const angleOffset=direction*t*turn*(.28+band*.13)
    for(let i=0;i<count;i++){
      const u=i/count,angle=i*step+angleOffset
      const chase=wrap(u+angleOffset/TAU-t/TAU*(pattern==='radar'?1:(.9+band*.18))*scan)
      const lit=smooth((c.coverage*density-chase)*7+.25)
      const scanLit=pattern==='radar'?Math.exp(-chase*11):pattern==='lock-on'?smooth((.16+c.coverage*.2-Math.abs(wrap(u*4+.5)-.5))*9):lit
      const accent=(band%2===0?snare:0)+s.beat*a*.18+s.downbeat*a*.14
      const gain=emission*(.08+scanLit*(band===0?1.2:.8)+accent*.4+drop*.35)
      if(band===0){channel(0,0,z,r,angle,step*.82,.14*radial,.16,0,emission*(.72+.55*scanLit+snare*.4));continue}
      if(band===1){channel(0,0,z,r,angle,step*.45,.096*radial,.12,2,gain*(.75+treble*.8));continue}
      if(band===2){channel(0,0,z,r,angle,step*.78,.22*radial,.16,0,gain);continue}
      if(band===3){const travel=(.09+.23*c.meterTravel*(.22+bass+scanLit*.65+drop*.55))*radial
        channel(0,0,z,r+travel*.34,angle,step*.53,travel,.16,1,gain*(.5+bass*.65));continue}
      // Exterior arrowheads: pairs of solid bars, oriented along the circumference.
      const theta=angle, rr=r+.06*radial, x=Math.cos(theta)*rr,y=Math.sin(theta)*rr
      const w=.045*radial,l=.14*radial,g=emission*(.035+scanLit*(.62+treble*.6))
      line(x,y,z,l,theta+Math.PI*.24,w,.06,2,g);line(x,y,z,l,theta-Math.PI*.24,w,.06,2,g)
    }
  }
  // The scanner is a physical narrow bar, activated only by RADAR; stable topology across programs.
  const radar=pattern==='radar'?1:0, scanAngle=t*scan
  line(Math.cos(scanAngle)*1.59,Math.sin(scanAngle)*1.59,-.6,Math.max(.0001,2.95*radar),scanAngle,.026*radar,.035,2,emission*radar*.55)
  // Independent aperture leaves converge inward in lock-on and builds, outward on impact.
  for(let i=0;i<12;i++){
    const theta=i*TAU/12+t*.12*turn,travel=c.shutter*(.16+.34*build+.28*shutter*wave(t*1.2)-.16*drop)
    const r=(1.47-travel)*radial
    channel(0,0,-.6*zSpace,r,theta,.25,.17*radial,.22,3,0)
    arc(0,0,-.47*zSpace,r-.045*radial,theta,.19,.025*radial,.06,2,emission*(.16+s.downbeat*a*.65))
  }
  // Seed stays tiny; the empty center remains the dominant shape in the assembled state.
  arc(0,0,-.5,.035,0,TAU,.055,.055,2,emission*(pattern==='collapse'?1.1:.25))
  for(let i=0;i<2;i++){
    const sign=i===0?1:-1, theta=(i===0?.53:Math.PI+.53)+t*.45*orbital+sign*s.mid*a*.18+s.section*a*.12
    const amount=c.satelliteAmount*sat, distance=(3.8+orbital*.2)*(pattern==='collapse'?scale:1)
    const cx=Math.cos(theta)*distance,cy=Math.sin(theta)*distance
    const r=.62*amount,z=-.75*zSpace
    for(let j=0;j<24;j++){
      const angle=j*TAU/24+sign*t*.55
      channel(cx,cy,z,r,angle,.18,.12*amount,.1,4,emission*amount*(.18+.5*wave(angle-t*2)+treble*.24))
    }
    for(let j=0;j<6;j++)channel(cx,cy,z-.18,.37*amount,j*TAU/6-sign*t*.3,.72,.15*amount,.12,4,emission*amount*.35)
    const bracketAngle=theta+Math.PI/2
    for(let j=0;j<3;j++)line(cx+Math.cos(theta)*.8*amount,cy+Math.sin(theta)*.8*amount+(j-1)*.13*amount,z-.2,.45*amount,bracketAngle,.026*amount,.05,2,emission*amount*(.12+s.bar*a*.5))
  }
  // Quiet angular framework, not attached to the spinning reactor. Small accents remain independently addressable.
  for(let i=0;i<4;i++){
    const theta=Math.PI/4+i*Math.PI/2, rr=3.7-(shutter*.27*wave(t)+s.phrase*a*.2)
    const frameScale=pattern==='collapse'?scale:1
    const x=Math.cos(theta)*rr*frameScale,y=Math.sin(theta)*rr*frameScale
    line(x,y,-1.1*zSpace,.95*frameScale,theta+Math.PI*.5,.045*frameScale,.08,3,0)
    line(x,y,-1.06*zSpace,.34*frameScale,theta+Math.PI*.5,.024*frameScale,.04,2,emission*frameScale*(.16+s.bar*a*.48))
    for(let j=0;j<5;j++)line(x+Math.cos(theta)*.13*frameScale,y+Math.sin(theta)*.13*frameScale+(j-2)*.09*frameScale,-1.12*zSpace,.047*frameScale,0,.034*frameScale,.035,4,emission*frameScale*(.08+treble*.2))
  }
  // HUD-01: append stable, independently lit instrumentation; leave every core
  // primitive and its ordering intact. Keep the outer frame in world space behind
  // the reactor. The shared camera fits to 1.3 on narrow stages, so rotate the
  // banks toward the extra vertical space instead of shrinking the central HUD.
  const ratio=Number.isFinite(aspect)&&aspect>0?aspect:16/9
  const portrait=smooth((1.25-ratio)/.4)
  const bankAngle=portrait*Math.PI/2
  const bankRadius=4.85+clamp((ratio-1.3)*2.3,0,3.1)
  const fine=clamp(treble+snare*.45)
  const accentGain=emission*(.35+.65*c.coverage)*(pattern==='collapse'?.35+.35*scale:1)
  // Two graduated arcs, inset from the viewport edges. Bass stays with the
  // original ring meters; high-frequency detail animates the outer graduations.
  const graduationRadius=3.66+.12*drop+.09*kick
  for(let side=0;side<2;side++){
    const axis=Math.PI/2+side*Math.PI
    const start=axis-.60
    arc(0,0,-1.32*zSpace-.34,graduationRadius,start,1.2,.027,.04,3,0)
    for(let i=0;i<17;i++){
      const theta=start+i*1.2/16
      const major=i%4===0
      const head=wrap(i/17-t*scan*.25+side*.5)
      const lit=pattern==='radar'?Math.exp(-head*9):smooth((.16+.38*c.coverage*density-head)*6)
      const length=(major?.17:.085)*(1+.32*fine)
      line(Math.cos(theta)*(graduationRadius+.10),Math.sin(theta)*(graduationRadius+.10),-1.28*zSpace-.34,length,theta,major?.035:.024,.035,major?2:4,accentGain*(.12+.24*lit+.34*fine))
    }
    // A short traveling scan head, confined to the peripheral arc.
    const head=start+.10+wrap(t*scan*.19+side*.5)*.99
    arc(0,0,-1.18*zSpace-.34,graduationRadius-.10,head,.09,.045,.04,2,accentGain*(.15+.28*fine+.15*build))
  }
  for(let side=0;side<2;side++){
    const theta=bankAngle+side*Math.PI, nx=Math.cos(theta),ny=Math.sin(theta)
    const tx=-ny,ty=nx
    // Bank-local coordinates: u is outward, v is along the panel. A bounded
    // phrase accent opens its spacing; no new phrase detection or timing state.
    const spread=1+.08*s.phrase*a+.06*build
    const baseZ=-1.50-.30*zSpace
    const direction=pattern==='counter-spin'||pattern==='overload'?(side===0?1:-1):1
    const bankLine=(u:number,v:number,z:number,length:number,angle:number,width:number,role:number,gain:number)=>
      line(nx*(bankRadius+u)+tx*v*spread,ny*(bankRadius+u)+ty*v*spread,z,length,theta+angle,width,.04,role,gain)
    // Machined rails and four corner returns rather than a text-filled UI card.
    for(const u of [-.66,.66])bankLine(u,0,baseZ,2.55*spread,Math.PI/2,.045,3,0)
    for(const v of [-1.30,1.30]){
      bankLine(-.43,v,baseZ,.46,0,.042,3,0)
      bankLine(.43,v,baseZ,.46,0,.042,3,0)
      bankLine(.48,v,baseZ+.06,.23,0,.032,2,accentGain*(.17+.25*snare))
    }
    // Eight telemetry channels with persistent unlit tracks and short luminous
    // inserts. Highs/snare change their fill; the bass does not drive these bars.
    for(let i=0;i<8;i++){
      const v=(i-3.5)*.29
      const chase=wrap(i/8-direction*t*scan*.29+side*.33)
      const gate=pattern==='lock-on'?(i===1||i===6?1:.15):pattern==='segment-chase'?smooth((.24-chase)*8):wave(chase*TAU)
      const fill=clamp(.22+.35*gate+.32*fine+.09*build,.14,1)
      bankLine(.21,v,baseZ+.08,.68,0,.080,3,0)
      bankLine(-.13+.34*fill,v,baseZ+.14,.68*fill,0,.052,1,accentGain*(.16+.20*gate+.38*fine))
      bankLine(.60,v,baseZ+.14,.055,0,.055,4,accentGain*(.12+.24*fine+.16*gate))
    }
    // A continuous, stylized spectral trace (not a fabricated PCM display).
    // Connect adjacent samples as solid line segments in a distinct depth plane.
    const trace=(i:number)=>-.40+(.055+.16*fine+.045*build)*Math.sin(i*.95-direction*t*1.6+side)*Math.cos(i*.38+t*.65)
    for(let i=0;i<16;i++){
      const u0=trace(i),u1=trace(i+1),v0=(i/16-.5)*2.2,v1=((i+1)/16-.5)*2.2
      const du=u1-u0,dv=(v1-v0)*spread
      bankLine((u0+u1)/2,(v0+v1)/2,baseZ+.23,Math.hypot(du,dv),Math.atan2(dv,du),.034,2,accentGain*(.19+.34*fine))
    }
    const cursor=(wrap(direction*t*scan*.18+side*.5)-.5)*2.25
    bankLine(-.40,cursor,baseZ+.30,.38,0,.028,4,accentGain*(.13+.32*fine))
  }
  return new Float32Array(out)
}

/** Stable interpolation, including the unwrapped angle; role and geometry kind stay discrete. */
export function blendHud(from:Float32Array,to:Float32Array,mix:number):Float32Array {
  const result=new Float32Array(to.length),t=smooth(mix)
  for(let i=0;i<to.length;i++){
    const component=i%HUD_STRIDE,b=to[i]!,a=from[i]??b
    const delta=component===4?Math.atan2(Math.sin(b-a),Math.cos(b-a)):b-a
    result[i]=component===8||component===10||component===11?b:a+delta*t
  }
  return result
}
