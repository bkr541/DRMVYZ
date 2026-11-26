import {add,clamp,movement,mul,pose,pulse,rotate,sample,steps,TAU,type ArtifactState,type Emit,type Point} from './ArtifactDomain'

export type RelicPart = 'crown'|'face'|'jaw'
/** Single pose authority for the solid sculpture and its inset channels. Front is +Z. */
export function relicPose(s:ArtifactState){
  const v=s.values,m=movement(s),p=s.phase*v.reconstructionSpeed
  const [fracture,open,ring,charge]=pose(s,pattern=>{
    switch(pattern){
      case 'awaken':return [.04,.23+.14*pulse(p),.24,.65]
      case 'roar':return [.02,.88,.10,.82]
      case 'fracture':return [.95,.32,.8,.54]
      case 'reconstruct':return [.12+.76*(1-pulse(p*.65)),.20,.5,.48]
      case 'possession':return [.26,.35+.2*Math.sin(p),.45,.92]
      case 'siege':return [.12,.62,.95,.72]
      case 'cataclysm':return [.30+.55*pulse(p*.75),.65,.95,1]
      default:return [0,.06,.08,.18]
    }
  })
  const separation=clamp(fracture*v.fragmentSeparation*(.7+.55*m*v.buildAmount+.3*m*v.dropAccent),0,1.25)
  // A single safety fit keeps the solid plates and their channels registered at extremes.
  const scale=Math.min(v.skullScale,1.16/(1+.16*separation))
  const yaw=m*v.headRotation*(.13+.13*charge)*Math.sin(p*.6)+m*.035*v.bassPressure
  const jawAngle=clamp(.06+v.jawOpening*.29+open*.42+m*v.jawReactivity*(.18*v.kickAccent+.09*v.bassPressure+.08*v.dropAccent)+m*v.jawMotionSpeed*.10*Math.sin(s.phase*(.4+1.2*v.jawMotionSpeed)),.02,.91)
  const world=(a:Point)=>mul(rotate(a,0,yaw,0),scale)
  const part=(side:number,region:RelicPart)=>(a:Point):Point=>{
    const level=region==='crown'?1:region==='jaw'?-1:0
    let q=a
    if(region==='jaw'){
      const pivot:Point=[0,-.60,-.64]
      q=add(pivot,rotate(add(q,mul(pivot,-1)),jawAngle,0,0))
    }
    const tilt=separation*v.fragmentRotation*side*.15+m*v.cranialArticulation*.045*Math.sin(p+level+side)*(.25+v.snareAccent)
    return world(add(rotate(q,0,tilt,tilt*.55),[side*separation*(.48+Math.max(0,level)*.17),separation*level*.30+m*v.cranialArticulation*.045*level*Math.sin(p+side),separation*(level===1?-.30:.17)]))
  }
  const energy=clamp(charge*(.60+.25*v.overallEnergy+.15*v.midAmount+.12*s.flash*v.kickAccent+.12*v.dropAccent),0,1)
  return {part,scale,ring,p,m,energy,jawAngle,separation}
}

/** Opaque containment rails and sparse inset light strips; the skull itself is rendered by RelicVolumes. */
export function relicGeometry(s:ArtifactState,emit:Emit,quality:string){
  const v=s.values,{part,scale,ring,p,m,energy}=relicPose(s),n=steps(quality,5,7,9)
  const thickness=clamp(v.strandThickness,.012,.12)*scale
  const channel=(points:Point[],side:number,region:RelicPart,light:number)=>{
    const transform=part(side,region)
    for(let i=1;i<points.length;i++)emit(transform(points[i-1]!),transform(points[i]!),thickness*.54,2,light)
  }
  for(const side of [-1,1]){
    // The upper orbital rim is recessed behind the front plate, not a full glowing outline.
    channel(sample(n,t=>[side*(.36+1.27*t),.71+.13*Math.sin(t*Math.PI)-.22*t,1.48]),side,'face',energy*clamp(v.eyeIntensity,0,1.5))
    channel(sample(n,t=>[side*(.32+.92*t),2.41+.10*Math.sin(t*Math.PI)-.08*t,1.34]),side,'crown',energy*.50)
    if(v.density>.25)channel(sample(n,t=>[side*(.48+1.12*t),-.60+.15*Math.sin(t*Math.PI),1.68]),side,'face',energy*.35)
    channel(sample(n,t=>[side*(.18+.95*t),-2.18+.24*t,1.63-.36*t]),side,'jaw',energy*.32)
  }
  if(!s.extraEnabled)return
  for(let layer=0;layer<2;layer++)for(let segment=0;segment<8;segment++){
    const r=(3.04+layer*.25+ring*.42*v.ringSeparation)*scale
    const angle=segment*TAU/8+Math.sin(p*v.ringSpeed*.22)*(layer?1:-1)*m*.18
    const y=(-3.0+layer*5.62)*scale
    // Fixed front clearance keeps the face readable even as the ring panels rotate.
    if(Math.sin(segment*TAU/8+.31)>.68)continue
    const point=(t:number,offset=0,height=0):Point=>rotate([(r+offset)*Math.cos(angle+t*.60),y+height,(r+offset)*Math.sin(angle+t*.60)],m*ring*.09*Math.sin(p+layer),0,m*ring*.10*Math.cos(p+layer))
    const panels=sample(n,t=>point(t))
    for(let i=1;i<panels.length;i++){
      emit(panels[i-1]!,panels[i]!,.17*scale,0)
      emit(point((i-1)/n,.20*scale,.03*scale),point(i/n,.20*scale,.03*scale),.067*scale,1)
      if((i+segment)%3===0&&((i*7+segment*3)%11)/11<v.density){
        emit(point((i-.82)/n,.20*scale,.10*scale),point((i-.18)/n,.20*scale,.10*scale),thickness*.68,2,energy*.62)
      }
    }
    for(const t of [.04,.96])emit(point(t,-.14*scale),point(t,.25*scale),.095*scale,1)
  }
}
