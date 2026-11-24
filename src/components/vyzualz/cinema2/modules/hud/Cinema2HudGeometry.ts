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
export function sampleHud(pattern:HudPattern,phase:number,c:HudControls,s:HudSignals):Float32Array {
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
