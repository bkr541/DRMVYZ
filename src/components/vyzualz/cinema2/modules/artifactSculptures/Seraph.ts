import {add,cage,clamp,movement,pose,pulse,rotate,sample,steps,truss,TAU,type ArtifactState,type Emit,type Point} from './ArtifactDomain'

/** Three different wing skeletons; feather roots are attached to the moving spine, not to world space. */
export function seraphGeometry(s:ArtifactState,emit:Emit,quality:string){
  const v=s.values,m=movement(s),n=steps(quality,5,7,9),core=v.coreScale
  cage(s,emit,[0,0,0],[.95*core,2.05*core,.82*core],10,5,s.phase*.08*m)
  cage(s,emit,[0,0,0],[.58*core,1.48*core,.57*core],8,4,-s.phase*.12*m)
  for(let pair=0;pair<3;pair++)for(const side of [-1,1]){
    const p=s.phase*.8+pair*v.phaseOffset*1.8+side*.2
    // Each pattern owns a wing-pair-specific pose and timing, including folded enclosure and depth refraction.
    const [open,fold,twist,feather]=pose(s,pattern=>{
      switch(pattern){
        case 'ascension':return [.78+.23*pulse(p-pair*1.1),.35*(1-pulse(p-pair*1.1)),.13,.75]
        case 'halo':return [.86,.18,(pair-1)*.48,.35]
        case 'wingbeat':return [.92,.25+.25*Math.sin(p)*m,.15,.75+.2*Math.sin(p+.5)*m]
        case 'refraction':return [.90,.2,side*(pair-1)*.68+.14*Math.sin(p)*m,.55]
        case 'sanctuary':return [.60,.85,.38*side,.25]
        case 'dominion':return [1.12,.02,.05,.9]
        case 'transcendence':return [.92+.1*Math.sin(p)*m,.28+.14*Math.cos(p)*m,.46*Math.sin(p*.7)*m,.9]
        default:return [.94,.24,.05,.65+.15*pulse(p-pair)*m]
      }
    })
    const span=v.span*open*(1+m*(.08*v.subAmount+.08*v.dropAccent+.05*v.buildAmount))
    const root:Point=[side*.46,1.05-pair*.97,0]
    const bend=clamp(fold+v.fold*.32+m*(v.sweep*.17*Math.sin(p)+v.articulation*(.10*v.kickAccent+.08*side*v.snareAccent)),0,1.1)
    const angle=[.72,.05,-.67][pair]!
    const length=[6.9,7.2,5.7][pair]!*span
    const spine=(t:number):Point=>{
      const a=angle+(pair===0?.24:pair===2?-.24:.07)*t-bend*.38*t+m*v.articulation*.16*Math.sin(p+t*3)*t
      const base:Point=[side*length*t*Math.cos(a)*(1-.32*bend*t),length*t*Math.sin(a),length*t*(bend*.28+twist*.22)+m*v.twist*.48*Math.sin(p+t*2)*t]
      const q=pose(s,pattern=>{
        switch(pattern){
          case 'ascension':return [0,.55*t*t*pulse(p-pair),.20*t*pulse(p-pair)]
          case 'halo':return [-side*.85*t*t,(pair===0?.42:pair===2?-.42:.12)*t*t,side*.65*t*t]
          case 'wingbeat':return [0,m*.32*Math.sin(p-t*2)*t,m*.85*Math.sin(p-t*2)*t*t]
          case 'refraction':return [0,0,side*(pair-1)*1.05*t*t]
          case 'sanctuary':return [-side*.85*t*t,(1-pair)*.48*t*t,1.30*t*t]
          case 'dominion':return [side*.22*t,0,-.22*t*t]
          case 'transcendence':return [m*.22*side*Math.sin(p+t*3)*t,m*.28*Math.cos(p+t*2)*t,m*.62*Math.sin(p-t*4)*t]
          default:return [0,0,0]
        }
      })
      return add(root,add(base,q as Point))
    }
    truss(s,emit,sample(n,spine),.48*v.wingDepth,.42*v.wingDepth,pair*2+(side+1)/2,.70,1.2)
    // Feather blades fan out from successive joints; upper/middle/lower pairs have distinct silhouette.
    for(let j=0;j<6;j++){
      const t=.18+j*.132,anchor=spine(t),bladeLength=([3.05,2.85,2.5][pair]!)*(1-.58*t)*span
      const a=angle-(pair===2?.64:1.04)+j*.08+v.featherArticulation*m*.19*Math.sin(p+j*.55)+(.65-feather)*.45
      const path=sample(steps(quality,3,4,5),u=>add(anchor,[side*bladeLength*u*Math.cos(a-.22*u),bladeLength*u*Math.sin(a-.22*u),bladeLength*u*(.13+bend*.23+twist*.13)+m*.17*Math.sin(p+j+u*2)*u]))
      truss(s,emit,path,.31*(1-.35*t)*v.wingDepth,.28*v.wingDepth,pair*12+j,.86,.70+feather*.55)
    }
    // Paired outer leading-edge supports connect to identical articulated spine endpoints.
    truss(s,emit,sample(n,t=>add(spine(t),[0,.36*Math.sin(Math.PI*t),-.44*Math.sin(Math.PI*t)])),.16,.22,pair+4,.75,.65)
  }
  if(s.extraEnabled)for(let ring=0;ring<2;ring++){
    const r=(1.65+ring*.55)*core,phase=s.phase*v.haloRotation*.12*m*(ring?1:-1)
    truss(s,emit,sample(steps(quality,16,20,24),t=>rotate([r*Math.cos(t*TAU),r*1.25*Math.sin(t*TAU),0],.32+ring*.8,phase,0)),.12,.18,ring,0,.95,true)
  }
}
