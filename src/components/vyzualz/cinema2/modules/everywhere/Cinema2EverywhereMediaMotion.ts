import type { EverywhereCabinet, EverywhereLook } from './Cinema2EverywhereWall'

/** Deterministic content-space choreography. No clock, allocations of GPU resources,
 * or asset-specific assumptions. The caller supplies the shared musical phase. */
export function everywhereMediaPose(cabinet: EverywhereCabinet, index: number, look: Readonly<EverywhereLook>) {
  const {phase,pattern,seed}={phase:look.phase,pattern:look.pattern,seed:cabinet.seed}
  const x=cabinet.x/15, y=cabinet.y/8, r=Math.hypot(x,y)
  const t=phase*.38, wave=(v:number)=>.5+.5*Math.sin(v), cycle=t-Math.floor(t)
  const bank=Math.floor((x+1)*3)+Math.floor((y+1)*2)
  let scale=1, dx=0, dy=0, rotation=0, power=1, channel=0, distortion=0, stretch=1
  switch(pattern) {
    case 'all-eyes': scale=.72+.42*wave(phase+seed*6); power=seed<look.coverage?1:0; channel=Math.floor(seed*3); break
    case 'signal-sweep': { const d=x-(cycle*2-1); power=Math.abs(d)<.45?1:0; scale=1.2-Math.min(.55,Math.abs(d)); dx=d*.13; channel=Math.floor((x+1)*3); break }
    case 'outward-pulse': { const d=r-cycle*1.65; power=Math.abs(d)<.36?1:0; scale=1.28-Math.min(.55,Math.abs(d)); channel=Math.floor(r*4); break }
    case 'cross-cut': { const d=y-x*Math.cos(Math.floor(t)*Math.PI); power=Math.abs(d)<.42?1:0; dx=.15*Math.sin(phase+x*3); scale=.82+.24*wave(phase+y*4); channel=bank; break }
    case 'channel-hold': power=(bank+Math.floor(t))%3!==1?1:0; scale=.65+.45*((bank+Math.floor(t))%3)/2; channel=bank; break
    case 'ghost-feed': scale=.78+.38*wave(phase*1.3+seed*9); dx=.13*Math.sin(phase+seed*7); dy=.05*Math.cos(phase+seed*7); distortion=.3+.25*look.snare; power=wave(phase+seed*9)>.2?1:0; channel=Math.floor(seed*3); break
    case 'static-switch': { const signal=wave(phase*2+seed*15); power=signal>.25?1:0; stretch=.25+.75*signal; distortion=.25+.6*look.snare; scale=.8+.2*signal; channel=Math.floor(seed*3+t); break }
    case 'retro-broadcast': power=(Math.floor((y+1)*4)+Math.floor(t))%4!==0?1:0; scale=.82+.2*wave(phase+y*6); stretch=.85+.15*wave(phase+y*5); channel=Math.floor((y+1)*3); break
    case 'tape-tracking': power=Math.abs(y-Math.sin(phase*.5))<.65?1:0; dx=.12*Math.sin(phase*2+y*10); dy=.09*Math.sin(phase+y*3); distortion=.4+.5*look.snare; scale=.8+.25*wave(phase+x*4); channel=Math.floor((x+1)*3); break
    case 'channel-mosaic': power=wave(index*2.4+Math.floor(t))>.25?1:0; scale=.56+.55*wave(index*2.3+Math.floor(t)); rotation=.12*Math.sin(index*2.4); channel=bank+Math.floor(seed*3); break
    case 'signal-relay': {const d=r-cycle*1.65; power=Math.abs(d)<.28?1:0; scale=.72+.45*Math.exp(-d*d*14); dx=x*.08; channel=Math.floor(r*5); break}
    case 'midnight-replay': power=r<.34||seed>.87?1:0; scale=.65+.45*Math.exp(-r*4); dx=x*.06; channel=Math.floor(seed*3); break
  }
  const motion=(look.contentMotion??.75)*look.motion, variation=look.scaleVariation??.6
  const individual=look.layout==='choreographed'?1:.45
  const amount=motion*individual
  const hero=index===0 && look.heroReadability!==false
  if(hero) {power=1;scale=Math.max(.94,scale);dx*=.15;dy*=.15;rotation*=.15;distortion*=.15;stretch=Math.max(.9,stretch);channel=0}
  if(look.drop>.6 && pattern!=='midnight-replay') power=1
  if(look.screenPower===false || motion===0) power=1
  const pulse=look.kick*.17+look.bass*.08+look.drop*.14
  return {scale:Math.max(.45,Math.min(1.6,1+(scale-1)*amount*variation+pulse*motion)),x:dx*amount,y:dy*amount,rotation:rotation*amount,power,channel:((channel%3)+3)%3,distortion:Math.min(1,distortion*motion+look.snare*.25*motion),stretch:1+(stretch-1)*amount}
}
