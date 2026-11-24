import {add,cage,movement,mul,pose,pulse,rotate,sample,steps,truss,TAU,type ArtifactState,type Emit,type Point} from './ArtifactDomain'

/** Deliberate skeletal landmarks in a front-positive-Z coordinate system. The jaw uses a rear hinge. */
export function relicGeometry(s:ArtifactState,emit:Emit,quality:string){
  const v=s.values,m=movement(s),p=s.phase*v.reconstructionSpeed,n=steps(quality,4,6,7)
  const [fracture,open,ring]=pose(s,pattern=>{
    switch(pattern){
      case 'awaken':return [.04,.38+.14*pulse(p),.25]
      case 'roar':return [.02,.88,.10]
      case 'fracture':return [.95,.45,.8]
      case 'reconstruct':return [1-pulse(p*.65),.20,.5]
      case 'possession':return [.27,.35+.2*Math.sin(p),.45]
      case 'siege':return [.12,.62,.95]
      case 'cataclysm':return [pulse(p*.75),.65,.95]
      default:return [0,.27,.10]
    }
  })
  const scale=v.skullScale, separation=fracture*v.fragmentSeparation*(.7+.55*m*v.buildAmount+.3*m*v.dropAccent)
  const yaw=m*v.headRotation*.18*Math.sin(p*.6)+m*.035*v.bassPressure
  const world=(a:Point)=>mul(rotate(a,0,yaw,0),scale)
  const part=(side:number,level:number,jaw=false)=>{
    const pivot:Point=[0,-.60,-.64]
    return (a:Point):Point=>{
      let q=a
      if(jaw){const a0=.13+v.jawOpening*.33+open*.45+m*v.jawReactivity*(.25*v.kickAccent+.11*v.bassPressure+.12*v.dropAccent)+m*v.jawMotionSpeed*.13*Math.sin(s.phase);q=add(pivot,rotate([q[0]-pivot[0],q[1]-pivot[1],q[2]-pivot[2]],a0,0,0))}
      const tilt=separation*v.fragmentRotation*side*.18+m*v.cranialArticulation*.055*Math.sin(p+level+side)*v.snareAccent
      return world(add(rotate(q,0,tilt,tilt*.55),[side*separation*(.6+level*.15),separation*level*.35+m*v.cranialArticulation*.06*level*Math.sin(p+side),side===0?-separation*.35:separation*.24]))
    }
  }
  const tube=(points:Point[],width:number,depth:number,seed:number,transform:(p:Point)=>Point,light=1)=>truss(s,emit,points.map(transform),width*scale,depth*scale,seed,0,light)
  // Back cranium and temple hoops: a volumetric skull rather than an overlaid frontal mask.
  for(let j=0;j<6;j++){
    const y=-.75+j*.64,r=2.25*Math.sqrt(Math.max(.13,1-((y-1.0)/2.65)**2)),centerZ=-.25
    const transform=part(0,1+j*.15)
    tube(sample(n*2,t=>{const a=Math.PI+t*Math.PI;return [r*Math.cos(a),y,centerZ+r*.88*Math.sin(a)]}),.27,.29,j,transform,.7)
  }
  for(const side of [-1,1]){
    const face=part(side,0),plate=part(side,1),jaw=part(side,-1,true)
    // Forehead, crown and occipital arches link from the brow to the rear skull.
    for(let j=0;j<4;j++){
      const x=side*(.42+j*.48),r=Math.sqrt(Math.max(.15,1-(x/2.5)**2))
      tube(sample(n,t=>[x*(1-.16*Math.sin(t*Math.PI)),.6+2.65*r*Math.sin(Math.PI*t),1.60*r*Math.cos(Math.PI*t)-.05]),.25,.32,j+10,plate,.82)
    }
    // Aggressive eye socket with slanted brow, deep sidewall and rear opening.
    const socket=(t:number,z:number):Point=>{const a=t*TAU;return [side*(1.05+.88*Math.cos(a)),.30+.59*Math.sin(a)-.15*Math.cos(a),z-.18*Math.cos(a)]}
    for(let j=0;j<2;j++)tube(sample(n*2,t=>socket(t,1.85-j*.55)),.23,.26,j+20,face,.55+v.eyeIntensity*.70)
    for(let j=0;j<8;j++){const a=face(socket(j/8,1.85)),b=face(socket(j/8,1.30));emit(a,b,v.strandThickness*1.7,0)}
    tube(sample(n,t=>[side*(.25+1.9*t),1.10+.28*Math.sin(t*Math.PI)-.20*t,1.77-.5*t]),.32,.35,31,plate,1.2)
    tube(sample(n,t=>[side*(.40+1.74*Math.sin(t*Math.PI*.66)), -.62+.40*Math.sin(t*Math.PI)-.12*t,1.9-1.12*t]),.36,.29,32,face,.92)
    // Nasal arch, zygomatic strut and upper dental arch.
    tube(sample(n,t=>[side*(.10+.48*t),.15-1.02*t,1.95-.18*t]),.13,.22,33,face,.8)
    tube(sample(n,t=>[side*(1.97-.60*t),-.18-1.1*t,1.1+.46*t]),.26,.29,34,face,.85)
    const upper=(t:number):Point=>[side*1.38*t,-1.12-.12*t,1.91-.58*t*t]
    tube(sample(n,upper),.23,.28,35,face,.85)
    const lower=(t:number):Point=>[side*(.02+1.85*t),-2.42+1.45*t*t,1.47-2.10*t*t]
    tube(sample(n,lower),.29,.33,36,jaw,1.05)
    tube(sample(n,t=>[side*(1.85-.22*t),-.97+.43*t,-.63+.05*t]),.29,.31,37,jaw,.65)
    for(let j=0;j<6;j++){
      const t=(j+.45)/6,up=upper(t),down=lower(t*.78)
      // Angular tooth cages with a solid wide base and a tapered tip; lower teeth share the jaw pivot.
      for(const [base,sign,transform] of [[up,-1,face],[down,1,jaw]] as const){
        const tip=add(base,[0,sign*(.34+.12*(1-t)),.03])
        const corners:Point[]=[add(base,[-.10,0,-.11]),add(base,[.10,0,-.11]),add(base,[.09,0,.13]),add(base,[-.09,0,.13])]
        for(let k=0;k<4;k++){emit(transform(corners[k]!),transform(corners[(k+1)%4]!),v.strandThickness*1.35,0);emit(transform(corners[k]!),transform(tip),v.strandThickness*1.25,k===1?2:0,.9)}
      }
    }
  }
  cage(s,emit,world([0,.8,-.38]),[.75*v.coreScale,.95*v.coreScale,.71*v.coreScale],10,4,p*.12*m)
  if(s.extraEnabled)for(let layer=0;layer<2;layer++)for(let segment=0;segment<6;segment++){
    const r=(3.35+layer*.42+ring*.42*v.ringSeparation)*scale,a=segment*TAU/6+p*v.ringSpeed*.14*(layer?1:-1)*m
    const path=sample(n,t=>rotate([r*Math.cos(a+t*.82),-2.8+layer*5.7,r*Math.sin(a+t*.82)],m*ring*.21*Math.sin(p+segment),0,m*ring*.13*Math.cos(p+segment)))
    truss(s,emit,path,.27,.30,segment+layer,0,1.05)
  }
}
