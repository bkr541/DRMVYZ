import {TAU,type Point} from './ArtifactDomain'

/** Shared primitive vocabulary only. Each builder owns its own floor plan, ceiling and support layout. */
export interface Architecture {
 box(p:Point,size:Point,role:'wall'|'rib'|'floor'|'trim',rotation?:Point):void
 beam(a:Point,b:Point,r:number,role:'wall'|'rib'|'floor'|'trim'):void
 disk(p:Point,r:number,height:number,role:'wall'|'rib'|'floor'|'trim',segments?:number):void
 ring(p:Point,r:number,thickness:number,role:'wall'|'rib'|'floor'|'trim',segments?:number):void
}
export function cathedral(a:Architecture,f:number){
  // Long cruciform nave, deep buttressed aisle bays and a high pointed vault.
  a.box([0,f-.3,0],[37,.6,39],'floor')
  a.box([0,5,-16],[36,25,.9],'wall')
  for(const side of [-1,1]){
    a.box([side*18,5,0],[.9,25,39],'wall')
    for(let z=-14;z<=17;z+=5.5){
      a.box([side*16.6,3,z],[2.2,20,1.4],'rib')
      a.box([side*15.3,f+.5,z],[3.6,1,2.7],'rib')
      a.box([side*15.25,3,z],[.10,15,.13],'trim')
      a.beam([side*16.6,12,z],[side*9,17.8,z],.50,'rib')
      a.beam([side*9,17.8,z],[0,21,z],.38,'rib')
    }
    for(let i=0;i<4;i++){
      const x=side*(3.6+i*3.6)
      a.box([x,5,-14.9],[.60,24,1.7],'rib')
      a.box([x-.22,4,-13.98],[.075,18,.10],'trim')
    }
  }
  a.box([0,18,-10],[18,.45,12],'wall')
  for(let i=0;i<4;i++)a.box([0,f+.12+i*.23,-.5],[24-i*3.3,.25,14-i*2.5],'floor')
  a.disk([0,f+1.06,0],4.5,.22,'rib',12);a.ring([0,f+1.22,0],4.2,.045,'trim',12)
  a.ring([0,17.6,0],4.7,.26,'rib');a.ring([0,17.3,0],4.5,.07,'trim')
}
export function mathematicalChamber(a:Architecture,f:number){
  // Staggered, faceted optical vault; panels intersect at oblique seams rather than a cylinder.
  a.disk([0,f-.25,0],23,.5,'floor',8)
  for(let i=0;i<8;i++){
    const t=TAU*i/8,r=18.5,x=r*Math.sin(t),z=r*Math.cos(t)
    a.box([x,2.4,z],[15.6,17,.85],'wall',[0,t,0])
    a.box([x*.92,9,z*.92],[15.6,5,.65],'rib',[Math.PI*.20,t,0])
    const left:Point=[x*.85-5*Math.cos(t),f+.12,z*.85+5*Math.sin(t)],right:Point=[x*.85+5*Math.cos(t),10,z*.85-5*Math.sin(t)]
    a.beam(left,right,.65,'rib');a.beam([left[0]*.98,left[1]+.2,left[2]*.98],[right[0]*.98,right[1]-.2,right[2]*.98],.065,'trim')
    a.box([x*.96,f+.04,z*.96],[12,.10,.16],'trim',[0,t,0])
  }
  a.disk([0,f+.18,0],7.2,.36,'rib',8);a.disk([0,f+.43,0],5.55,.18,'floor',8)
  for(const r of [5.25,7.0,9.4,13])a.ring([0,f+.55-(r>7?.48:0),0],r,.045,'trim',8)
  for(let i=0;i<4;i++)a.box([0,14-i*.65,0],[22-i*4,.35,22-i*4],'rib',[0,i*Math.PI/8,0])
}
export function containmentVault(a:Architecture,f:number){
  // Orthogonal armored hall, recessed machine bays, overhead gantries and a containment pit.
  a.box([0,f-.35,0],[38,.7,40],'floor');a.box([0,3,-17],[38,19,1.4],'wall')
  for(const side of [-1,1]){
    a.box([side*18,3,0],[1.4,19,40],'wall')
    for(let z=-14;z<=14;z+=7){
      a.box([side*16,2,z],[3.4,15,1.9],'rib')
      a.box([side*16,7.5,z],[4.2,2.7,3.3],'rib')
      a.box([side*14.25,2,z],[.16,7,.50],'trim')
      a.box([side*17.4,-1,z+2.6],[.60,8,3.5],'rib')
      a.box([side*16.8,-1,z+2.6],[.65,5.5,2.3],'wall')
    }
  }
  for(const x of [-13,-6.5,6.5,13]){
    a.box([x,2,-15.4],[2.6,17,2.7],'rib');a.box([x,1,-13.95],[.16,10,.18],'trim')
  }
  for(const z of [-12,-3,6,15]){a.box([0,11,z],[34,1.25,1.8],'rib');a.box([0,10.3,z],[19,.12,.25],'trim')}
  // Stepped containment foundation with a raised armored crown and recessed status rail.
  a.disk([0,f+.12,0],5.2,.24,'rib',48);a.disk([0,f+.40,0],4.25,.48,'floor',48)
  a.disk([0,f+.76,0],3.45,.36,'rib',48);a.disk([0,f+1.01,0],2.80,.16,'floor',48)
  a.ring([0,f+.65,0],3.86,.065,'rib',48)
  for(let i=0;i<12;i++){
    const t=i*TAU/12;a.box([3.96*Math.sin(t),f+.40,3.96*Math.cos(t)],[.75,.25,.55],'rib',[0,t,0])
    if(i%2===0)a.box([4.23*Math.sin(t),f+.48,4.23*Math.cos(t)],[.30,.07,.08],'trim',[0,t,0])
  }
  for(let i=0;i<12;i++){
    const t=i*TAU/12; a.box([5.55*Math.sin(t),f+.32,5.55*Math.cos(t)],[1.6,.15,.35],'trim',[0,t,0])
  }
  for(let x=-12;x<=12;x+=3)a.box([x,f+.025,8],[.045,.05,15],'rib')
}
export function alienSanctuary(a:Architecture,f:number){
  // Radial organic-mechanical shell: branching ribs span from the floor into an open oculus.
  a.disk([0,f-.35,0],24,.7,'floor',64)
  for(let i=0;i<20;i++){
    const t=i*TAU/20,r=20.2
    a.box([r*Math.sin(t),3,r*Math.cos(t)],[6.55,22,.8],'wall',[0,t,0])
  }
  for(let i=0;i<12;i++){
    const angle=i*TAU/12
    const pt=(t:number,off=0):Point=>{const r=17.7+1.3*Math.sin(t*Math.PI)-11.7*t**3;const az=angle+off*Math.sin(t*Math.PI);return [r*Math.cos(az),f+.2+t*23.5,r*Math.sin(az)]}
    for(let j=0;j<15;j++){
      a.beam(pt(j/15),pt((j+1)/15),.48-.18*j/15,'rib')
      if(j>1&&j<13)a.beam(pt(j/15,.05),pt((j+1)/15,.05),.055,'trim')
    }
    for(const sign of [-1,1])for(let j=0;j<8;j++){
      const b=(u:number):Point=>{const p=pt(.35+u*.45,sign*.28*u);return [p[0]*(1+.045*u),p[1],p[2]*(1+.045*u)]}
      a.beam(b(j/8),b((j+1)/8),.23-.11*j/8,'rib')
    }
  }
  a.ring([0,16.5,0],6.1,.35,'rib');a.ring([0,16.3,0],5.8,.08,'trim')
  a.disk([0,f+.13,0],6.9,.26,'rib');a.disk([0,f+.36,0],5.45,.20,'floor')
  for(const r of [3.1,5.3,6.7,9.3,12.5])a.ring([0,f+(r<5.5?.49:.035),0],r,.045,'trim')
  for(let i=0;i<12;i++){const t=i*TAU/12;a.beam([7*Math.cos(t),f+.04,7*Math.sin(t)],[16*Math.cos(t),f+.04,16*Math.sin(t)],.055,'trim')}
}
