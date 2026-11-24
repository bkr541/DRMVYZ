import {add,cage,ease,mix,movement,pose,rotate,sample,steps,truss,TAU,type ArtifactState,type Emit,type Point} from './ArtifactDomain'

// Closed, thick ribbons use the same normalized path domain so topology changes can interpolate coherently.
function ribbon(pattern:string,t:number,i:number,phase:number,axis:number,twist:number):Point{
  const a=t*TAU,off=i*TAU/3,r=3.2-i*.30
  switch(pattern){
    case 'hypercube': {const square=(x:number)=>Math.sign(x)*Math.pow(Math.abs(x),.20);return rotate([r*square(Math.cos(a)),r*square(Math.sin(a)),.78*Math.sin(2*a+off)],off*.75,off+phase*.22,Math.PI/4)}
    case 'interlock':return rotate([r*Math.cos(a),r*Math.sin(a),.65*Math.sin(3*a)],off+phase*.15,off*.65,Math.PI/4)
    case 'inversion':return rotate([(r+.7*Math.cos(3*a))*Math.cos(a),(r+.7*Math.cos(3*a))*Math.sin(a),1.65*Math.sin(2*a+phase)],off*.72,off+Math.PI*.45*Math.sin(phase),0)
    case 'orbital':return rotate([r*1.14*Math.cos(a),r*Math.sin(a),.35*Math.sin(2*a)],off*.85,phase*.35+off,off*.4)
    case 'prism':{const rr=r*(.88+.19*Math.cos(3*a));return rotate([rr*Math.cos(a),rr*Math.sin(a),.95*Math.sin(3*a)],off*.62,off+phase*.15,0)}
    case 'recursion':return rotate([(r-i*.35)*Math.cos(a),(r-i*.35)*Math.sin(a),.65*Math.sin(2*a+off)],off*.25,off*.33+phase*.1,off)
    case 'impossible':return rotate([(r+.82*Math.cos(3*a))*Math.cos(a),(r+.82*Math.cos(3*a))*Math.sin(a),1.2*Math.sin(3*a+off)],off*.6,off+phase*.15,0)
    default:{const b=a+off,rad=2.65+.95*Math.cos(3*b);return rotate([rad*Math.cos(2*b),rad*Math.sin(2*b),1.05*Math.sin(3*b)],off*.32*axis,off*.37*axis+phase*.10,twist*.28+off*.20)}
  }
}
export function paradoxGeometry(s:ArtifactState,emit:Emit,quality:string){
  const v=s.values,m=movement(s),n=steps(quality,24,36,48),p=s.phase*v.transformSpeed*m
  const count=3
  for(let i=0;i<count;i++){
    const path=sample(n,t=>{
      const a=ribbon(s.previous,t,i,p,v.axisVariation,v.twist),b=ribbon(s.pattern,t,i,p,v.axisVariation,v.twist)
      const k=pose(s,pattern=>[pattern==='inversion'?.95:pattern==='interlock'?.5:pattern==='recursion'?.25:.18])[0]!
      const scale=v.outerScale*(i===0?1.14:mix(.72,1,v.complexity)*v.innerScale)*(1+m*(.07*v.subAmount+.04*v.bassPressure))
      const q:Point=[mix(a[0],b[0],ease(s.transition))*scale,mix(a[1],b[1],ease(s.transition))*scale*1.17,mix(a[2],b[2],ease(s.transition))*scale]
      const separation=(v.separation*.5+k*m*(.4+.35*v.buildAmount+.4*v.dropAccent))*i
      return add(rotate(q,m*.18*v.axisVariation*Math.sin(p+i)+m*.06*v.snareAccent*(i%2?1:-1),m*.13*v.rotationSpeed*Math.cos(p*.65+i)+m*.08*v.kickAccent, (1-v.symmetry)*i*.2+m*.08*v.midAmount),[Math.cos(i*TAU/3)*separation,Math.sin(i*TAU/3)*separation,(-1+i)*separation*.7])
    })
    truss(s,emit,path,.46*v.ribbonWidth,.55*v.trussDepth,i,0,1.1,true)
  }
  cage(s,emit,[0,0,0],[.92*v.coreScale,.92*v.coreScale,.92*v.coreScale],10,5,p*.22)
  cage(s,emit,[0,0,0],[.55*v.coreScale,.55*v.coreScale,.55*v.coreScale],8,4,-p*.22)
}
