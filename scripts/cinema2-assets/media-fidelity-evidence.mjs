import { assertion, sourceVisibility } from './release-acceptance-core.mjs'

// Independent source-coordinate checks. These do not establish final-frame
// geometry; an intact decoded image may still be mapped incorrectly by a preset.
export function decodedMediaEvidence(observed, variant, time=0) {
  const alpha=variant==='alpha'||variant==='svg', video=variant==='video'
  const dimensions=variant==='tall'?[180,320]:[320,180]
  const thresholds={rgb:video?28:3,alpha:2,timeSec:.045}
  if(!observed||!Array.isArray(observed.samples)||observed.samples.length!==(alpha?7:6)||observed.variant!==variant)
    return {status:'incomplete',issues:['Missing fixture decode samples'],evidence:{variant,time,thresholds}}
  const issues=[]
  if(observed.width!==dimensions[0]||observed.height!==dimensions[1])issues.push('Decoded dimensions/aspect mismatch')
  // Source oracle is independent of browser-reported expected values.
  const colors=[[255,34,34,255],[24,237,112,255],[34,85,255,255],[255,255,255,255]]
  const order=video&&time>=1?[2,0,1,3]:[0,1,2,3]
  const expected=order.map((j,i)=>alpha&&i===3?[255,255,255,128]:colors[j])
  expected.push([0,0,0,255],[0,0,0,255]);if(alpha)expected.push([0,0,0,0])
  const expectedXY=[[.25,.25],[.75,.25],[.25,.75],[.75,.75],[18/dimensions[0],18/dimensions[1]],[(dimensions[0]-20)/dimensions[0],(dimensions[1]-20)/dimensions[1]], [.5,.5]]
  const measured=observed.samples.map((s,i)=>{
    const want=expected[i], actual=s.actual
    const valid=Array.isArray(actual)&&actual.length===4&&actual.every(v=>Number.isInteger(v)&&v>=0&&v<=255)&&Math.abs(s.x-expectedXY[i][0])<1e-6&&Math.abs(s.y-expectedXY[i][1])<1e-6
    const delta=valid?actual.map((v,c)=>Math.abs(v-want[c])):null
    // Transparent pixels carry no meaningful RGB; only alpha is contractual.
    const pass=valid&&delta[3]<=thresholds.alpha&&(want[3]===0||delta.slice(0,3).every(v=>v<=thresholds.rgb))
    if(!pass)issues.push(`Source fiducial ${i} differs in color, position or alpha`)
    return {x:s.x,y:s.y,actual,expected:want,delta,pass}
  })
  if(video&&(!Number.isFinite(observed.playback?.currentTimeSec)||Math.abs(observed.playback.currentTimeSec-time)>thresholds.timeSec||!observed.playback.paused))issues.push('Video not pinned at requested decoded frame')
  return assertion(issues,{variant,time,dimensions,thresholds,measured,playback:observed.playback})
}

/** Compare different *video* frames at identical scene checkpoints, with a
 * same-time A/A noise control. A static decoder or a stale render is a failure. */
export function videoFrameEvidence(a,aa,b,{first,repeat,second,expectedZones}) {
  const times=[first,repeat,second]
  if(times.some(t=>!Number.isFinite(t))||Math.abs(first-repeat)>.045||second-first<.5)
    return {status:'incomplete',issues:['Missing matched video timestamps'],evidence:{times}}
  const result=sourceVisibility(a,aa,b,{ready:true,fixture:false,expectedZones})
  return {...result,evidence:{...result.evidence,times,fixtureId:'qa05-video',comparison:'same scene, different decoded video frame'}}
}

/** Pixel assertions for independently calibrated projected fiducials. A caller
 * must supply scene-derived screen regions; never infer them from the observed
 * colors (which would allow a flipped or stretched chart to pass). */
export function projectedMediaEvidence(frame,baseline,regions) {
  if(!Array.isArray(regions)||regions.length<4||!frame||!baseline||frame.width!==baseline.width||frame.height!==baseline.height||!Number.isInteger(frame.width)||!Number.isInteger(frame.height)||frame.width<1||frame.height<1||frame.data?.length!==frame.width*frame.height*3||baseline.data?.length!==frame.data.length)
    return {status:'incomplete',issues:['Independent projected fiducial/alpha masks unavailable']}
  const issues=[],measured=[]
  for(const r of regions){
    const {x,y,width,height,expected,tolerance=40,background=false}=r
    if(![x,y,width,height].every(Number.isInteger)||x<0||y<0||width<=0||height<=0||x+width>frame.width||y+height>frame.height||!Number.isFinite(tolerance)||tolerance<0||tolerance>60||(!background&&(!Array.isArray(expected)||expected.length!==3||!expected.every(v=>Number.isFinite(v)&&v>=0&&v<=255))))return {status:'incomplete',issues:['Invalid projected region calibration']}
    let n=0,failed=0,sum=[0,0,0]
    for(let row=y;row<y+height;row++)for(let col=x;col<x+width;col++){
      const i=(row*frame.width+col)*3;let delta=0
      for(let c=0;c<3;c++){const v=frame.data[i+c];sum[c]+=v;delta=Math.max(delta,Math.abs(v-(background?baseline.data[i+c]:expected[c])))}
      n++;if(delta>tolerance)failed++
    }
    const coverage=1-failed/n;measured.push({region:r,mean:sum.map(v=>v/n),coverage});if(coverage<.8)issues.push(`Projected region ${r.id??measured.length} fails reference color/coverage`)
  }
  return assertion(issues,{regions:measured,minimumCoverage:.8})
}
