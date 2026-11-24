import {add,cage,movement,pose,pulse,rotate,sample,steps,truss,type ArtifactState,type Emit,type Point} from './ArtifactDomain'

/** Asymmetric radial branches authored with distinct depth, curvature, lengths and secondary branching. */
const BRANCHES=[[-.08,6.1,.55,.7],[.45,6.6,-.65,-.4],[.94,5.8,.7,.8],[1.38,6.6,-.4,-.3],[1.97,6.25,.6,.5],[2.52,5.8,-.85,-.5],[3.02,6.4,.35,.7],[3.56,5.8,-.45,-.5],[4.02,5.6,.7,.6],[4.62,5.35,-.7,-.8],[5.12,6.0,.4,.5],[5.70,6.4,-.5,-.6]] as const
export function monolithGeometry(s:ArtifactState,emit:Emit,quality:string){
  const v=s.values,m=movement(s),p=s.phase*v.waveSpeed,core=v.coreScale*(1+m*.10*v.subAmount)
  cage(s,emit,[0,0,0],[1.2*core,1.28*core,1.0*core],12,5,p*.10*m*v.coreArticulation)
  cage(s,emit,[0,0,0],[.80*core,.85*core,.72*core],9,4,-p*.13*m*v.coreArticulation)
  for(let i=0;i<BRANCHES.length;i++){
    const [angle,length,depth,curve]=BRANCHES[i]!,ph=p-i*v.phaseOffset*.64
    const [span,curl,plane,wave]=pose(s,pattern=>{
      switch(pattern){
        case 'ignition':return [.72+.26*pulse(ph*.7),.30,.22,.55]
        case 'telescope':return [1.12,.04,.2,.20]
        case 'gyroscope':return [.93,.25,.90*Math.sin(ph*.65),.5]
        case 'unlock':return [.73+.32*pulse(ph*.50),.12,.4,.7]
        case 'convergence':return [.65,.86,.22,.25]
        case 'overdrive':return [1.12,.08,.55,.95]
        case 'discharge':return [.77+.35*pulse(ph),.50*(1-pulse(ph)),.6,1]
        default:return [.87,.27,.25,.45]
      }
    })
    const radius=length*v.radialSpan*(.76+.40*v.telescope)*span*(.88+.22*v.bladeExtension+m*(.08*v.bassPressure+.08*v.dropAccent+.07*v.buildAmount))
    const main=(t:number):Point=>{
      const a=angle+curve*(v.curvature*.55+v.curl*.48+curl*.95)*t*t+m*v.bladeArticulation*(.21*wave*Math.sin(ph-t*4)+.10*v.kickAccent*Math.sin(t*4-i)+.1*v.snareAccent*(i%2?1:-1))*t
      const r=core*.85+radius*t*(1-.18*curl*t)
      const base:Point=[r*Math.cos(a),r*Math.sin(a)*.86,r*depth*.38+plane*t*t*1.5+m*v.branchSeparation*.66*Math.sin(ph+t*3)*t]
      // The local root is fixed. Each score changes the actual centerline, including the tip, not just its overall scale.
      const delta=pose(s,pattern=>{
        const travel=pulse(ph-t*5),joint=Math.max(0,(t-.35)/.65)
        switch(pattern){
          case 'ignition':return [0,0,m*.55*travel*t]
          case 'telescope':return [Math.cos(angle)*joint*.48*pulse(ph),Math.sin(angle)*joint*.42*pulse(ph),0]
          case 'gyroscope':{const q=rotate(base,Math.sin(ph*.45)*t*.48,Math.cos(ph*.45)*t*.34,0);return [q[0]-base[0],q[1]-base[1],q[2]-base[2]]}
          case 'unlock':return [0,0,depth*joint*.75*pulse(ph-joint*3)]
          case 'convergence':return [-Math.cos(angle)*joint*.85,-Math.sin(angle)*joint*.72,depth*joint*.35]
          case 'overdrive':return [m*.26*Math.cos(a)*travel*t,m*.26*Math.sin(a)*travel*t,m*.72*Math.sin(ph-t*4)*t]
          case 'discharge':return [Math.cos(angle)*joint*.65*travel,Math.sin(angle)*joint*.55*travel,m*.63*travel*t]
          default:return [0,0,0]
        }
      })
      return add(base,delta as Point)
    }
    truss(s,emit,sample(steps(quality,7,10,13),main),.43*v.tendrilThickness,.38*v.tendrilThickness,i,.86,.9+v.energyPropagation*.45*pulse(ph))
    // Secondary branches use live parent endpoints and share the root motion at every frame.
    const children=v.branchingComplexity>.68?2:v.branchingComplexity>.12?1:0
    for(let child=0;child<children;child++){
      const t=.40+child*.24,root=main(t),a=angle+curve*.55+(child?-.7:.7),len=radius*(child?.32:.46)
      const branch=(u:number):Point=>add(root,[len*u*Math.cos(a+curve*u*.42),len*u*Math.sin(a+curve*u*.42)*.85,len*u*(depth*.42+(child?-.22:.18))+m*v.bladeArticulation*.42*Math.sin(ph-u*3)*u])
      truss(s,emit,sample(steps(quality,4,5,6),branch),.22*v.tendrilThickness,.21*v.tendrilThickness,i+child*3,.9,.72+v.energyPropagation*.4*pulse(ph-child))
    }
  }
}
