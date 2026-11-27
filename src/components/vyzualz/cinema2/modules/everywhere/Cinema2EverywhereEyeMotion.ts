import type { EverywhereCabinet, EverywhereLook } from './Cinema2EverywhereWall'
import { everywhereSpatialPosition } from './Cinema2EverywhereSpatial'

export type EverywhereEyePose = readonly [gazeX: number, gazeY: number, blink: number, rollBack: number]
const clamp = (n: number, lo=0, hi=1) => Math.max(lo,Math.min(hi,n))
const smooth = (n: number) => { const t=clamp(n); return t*t*(3-2*t) }
const mod = (n: number,d: number) => ((n%d)+d)%d
const pulse = (t: number,period: number,width: number) => {
  const p=mod(t,period)
  return p<width ? Math.sin(Math.PI*p/width)**2 : 0
}
// Saccades ease into a direction, then hold, rather than continuously sliding.
const gaze = (t: number,period: number) => {
  const q=mod(t,period)/period
  const segment=Math.floor(q*4), f=q*4-segment
  const targets=[0,1,0,-1,0] as const
  return targets[segment]!+(targets[segment+1]!-targets[segment]!)*smooth(f*4)
}

/** Read-only choreography derived from the existing beat phase and shared
 * kick/snare/build/drop envelopes. No local clock, random frame state or events. */
export function everywhereEyePose(item: Readonly<EverywhereCabinet>,index: number,look: Readonly<EverywhereLook>): EverywhereEyePose {
  if (look.motion<=0) return [0,0,0,0]
  const t=Math.max(0,look.phase-.22)
  const spatial=everywhereSpatialPosition(item), radius=spatial.radius
  const nx=spatial.x/Math.max(1,radius), ny=spatial.y/Math.max(1,radius)
  const travelRadius=radius*.67, travelX=spatial.x*.67, travelY=spatial.y*.67
  let x=0,y=0,blink=0,roll=0
  switch (look.pattern) {
    case 'all-eyes':
      x=gaze(t,8); y=.35*gaze(t-2,16)*smooth(t*3)
      blink=pulse(t-2,8,.52); roll=pulse(t-6,16,1.3)*.8; break
    case 'signal-sweep':
      x=gaze(t,6); blink=pulse(t-1.1-travelX*.17,6,.48); break
    case 'outward-pulse': {
      const wave=pulse(t-travelRadius*.17,6,2.6)
      x=nx*wave; y=ny*wave*.65; blink=pulse(t-travelRadius*.20,6,.55); break
    }
    case 'cross-cut':
      x=gaze(t,8)*(item.y>=0?1:-1); y=gaze(t,8)*(item.x>=0?-.55:.55)
      blink=pulse(t-2-(travelX+travelY)*.12,8,.52); break
    case 'channel-hold': {
      const bank=(Math.floor((spatial.x+15)/3.4)+Math.floor((spatial.y+8)/2.4))%3, p=t-bank*.55
      x=gaze(p,9); y=.28*gaze(p-2,9); blink=pulse(p-2,9,.65); break
    }
    case 'ghost-feed':
      x=.70*gaze(t-item.seed*1.5,7); y=.50*gaze(t-item.seed*2,9)
      blink=pulse(t-item.seed*2-1,5,.7); roll=pulse(t-item.seed-3,10,1.5)*.65; break
    case 'static-switch':
      x=gaze(t,4); blink=Math.max(pulse(t-1,4,.42),look.kick*.92); break
    case 'retro-broadcast':
      x=.65*gaze(t,8); y=.24*gaze(t-2,8); blink=pulse(t-3,8,.74); break
    case 'tape-tracking':
      x=.75*gaze(t-travelY*.10,6); y=.42*gaze(t,6); blink=pulse(t-2-travelY*.10,6,.50); break
    case 'channel-mosaic':
      x=gaze(t+(index%3)*.8,8); y=.45*gaze(t+(index%3)*.8,6); blink=pulse(t-1-(index%3)*.5,6,.52); break
    case 'signal-relay':
      x=nx*pulse(t-travelRadius*.20,6,2.3); y=ny*pulse(t-travelRadius*.20,6,2.3); blink=pulse(t-travelRadius*.20,6,.50); break
    case 'midnight-replay':
      x=.5*gaze(t,12); y=.3*gaze(t,8); blink=pulse(t-3-item.seed*.5,10,.85); roll=pulse(t-7,16,2); break
  }
  // Builds converge toward a raised gaze; drops roll the irises upward in
  // unison. Kick is a blink accent, snare a small vertical saccade. Vocals
  // soften surrounding movement without disrupting synchronized directions.
  const strength=clamp(look.motion)*(1-look.vocal*.35)
  x=x*(1-look.build*.65)*(1-look.drop)
  y=y*(1-look.drop)+look.build*.4+look.snare*.12
  blink=Math.max(blink,look.kick*.78*(1-look.vocal*.45))*(1-look.drop*.8)
  roll=Math.max(roll,look.drop)
  return [clamp(x*strength,-1,1),clamp(y*strength,-1,1),clamp(blink*Math.min(1,strength*1.65)),clamp(roll*strength)]
}
