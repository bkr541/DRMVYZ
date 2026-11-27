import type * as Three from 'three'

type ThreeNamespace = typeof import('three')
type Merge = typeof import('three/examples/jsm/utils/BufferGeometryUtils.js')['mergeGeometries']
type Finish = 'shell'|'wood'|'bezel'|'recess'|'metal'|'dark'
export interface EverywhereCabinetStyle {
  family: 'broadcast'|'wood-console'|'portable'|'molded'
  w:number; h:number; radius:number; depth:number; taperX:number; taperY:number
  screenW:number; screenH:number; screenX:number; screenY:number; screenZ:number; glassDepth:number
}
// Different aperture sizes, carcass shapes, back profiles and hardware layouts.
// Each screen is located in its own actual aperture, not overlaid on a common shell.
export const EVERYWHERE_CABINET_STYLES: readonly EverywhereCabinetStyle[] = [
  {family:'broadcast',w:2.12,h:1.64,radius:.045,depth:1.05,taperX:.86,taperY:.88,screenW:1.82,screenH:1.29,screenX:0,screenY:.06,screenZ:.205,glassDepth:.105},
  {family:'wood-console',w:2.43,h:1.67,radius:.045,depth:1.25,taperX:.91,taperY:.93,screenW:1.66,screenH:1.28,screenX:-.25,screenY:.015,screenZ:.205,glassDepth:.09},
  {family:'portable',w:1.70,h:1.83,radius:.20,depth:.94,taperX:.67,taperY:.72,screenW:1.42,screenH:1.22,screenX:0,screenY:.14,screenZ:.205,glassDepth:.12},
  {family:'molded',w:2.02,h:1.57,radius:.135,depth:1.34,taperX:.59,taperY:.65,screenW:1.70,screenH:1.19,screenX:0,screenY:.07,screenZ:.205,glassDepth:.13},
]
function roundedPath(path:Three.Path,x:number,y:number,w:number,h:number,r:number) {
  const x1=x+w,y1=y+h
  path.moveTo(x+r,y); path.lineTo(x1-r,y); path.quadraticCurveTo(x1,y,x1,y+r)
  path.lineTo(x1,y1-r);path.quadraticCurveTo(x1,y1,x1-r,y1)
  path.lineTo(x+r,y1);path.quadraticCurveTo(x,y1,x,y1-r)
  path.lineTo(x,y+r);path.quadraticCurveTo(x,y,x+r,y);path.closePath()
}
export function buildEverywhereCabinetParts(T:ThreeNamespace,merge:Merge,s:EverywhereCabinetStyle) {
  const parts = new Map<Finish,Three.BufferGeometry[]>()
  const add=(material:Finish,geometry:Three.BufferGeometry)=>{
    // BufferGeometryUtils requires consistent indexing across every part.
    if(geometry.index) {const flat=geometry.toNonIndexed();geometry.dispose();geometry=flat}
    const list=parts.get(material)??[];list.push(geometry);parts.set(material,list)
  }
  const extrude=(w:number,h:number,r:number,depth:number,bevel:number,z:number,aperture=false, margin=.02, x=0,y=0)=>{
    const shape=new T.Shape();roundedPath(shape,-w/2,-h/2,w,h,r)
    if(aperture){
      // Three's extrusion normalizes hole winding; clearance exceeds bevel.
      const hole=new T.Path();const sw=s.screenW+margin*2,sh=s.screenH+margin*2
      roundedPath(hole,s.screenX-x-sw/2,s.screenY-y-sh/2,sw,sh,Math.min(.13,sh*.13));shape.holes.push(hole)
    }
    return new T.ExtrudeGeometry(shape,{curveSegments:7,depth,steps:1,bevelEnabled:true,bevelSegments:2,bevelSize:bevel,bevelThickness:bevel}).translate(x,y,z)
  }
  const box=(m:Finish,w:number,h:number,d:number,x:number,y:number,z:number)=>add(m,new T.BoxGeometry(w,h,d).translate(x,y,z))
  const knob=(x:number,y:number,r:number,d=.065)=>{
    add('metal',new T.CylinderGeometry(r*.83,r,d,20).rotateX(Math.PI/2).translate(x,y,.21))
    box('dark',.016,r*.73,.012,x,y+r*.15,.21+d/2)
  }
  const shell=extrude(s.w-.075,s.h-.075,s.radius,s.depth-.12,.036,-s.depth)
  const pos=shell.getAttribute('position')
  for(let i=0;i<pos.count;i++){
    const t=T.MathUtils.smoothstep(pos.getZ(i),-s.depth,-.14)
    pos.setXY(i,pos.getX(i)*(s.taperX+(1-s.taperX)*t),pos.getY(i)*(s.taperY+(1-s.taperY)*t))
  }
  pos.needsUpdate=true;shell.computeVertexNormals()
  add(s.family==='wood-console'?'wood':'shell',shell)
  // Front housing, deep black inset, and glass: overlapping depth, not faces
  // stacked at identical Z. Aperture clearance avoids clipping convex glass.
  add(s.family==='wood-console'?'wood':'shell',extrude(s.w-.08,s.h-.08,s.radius,.125,.032,-.105,true,.068))
  add('bezel',extrude(s.w-.095,s.h-.095,Math.max(.025,s.radius-.012),.105,.021,.025,true,.044))
  add('metal',extrude(s.screenW+.19,s.screenH+.19,.16,.019,.006,.137,true,.065,s.screenX,s.screenY))
  add('recess',extrude(s.screenW+.13,s.screenH+.13,.16,.027,.008,.153,true,.012,s.screenX,s.screenY))
  // Recessed face behind glass; the rounded shader corners stay black.
  box('dark',s.screenW+.015,s.screenH+.015,.028,s.screenX,s.screenY,.08)
  switch(s.family){
    case 'broadcast':
      // Squared metal monitor, bottom status rail, rack-style side flanges.
      for(const side of [-1,1]){
        box('bezel',.075,s.h*.83,.14,side*(s.w/2-.01),0,.075)
        for(const y of [-.53,.53]) add('metal',new T.CylinderGeometry(.027,.027,.022,10).rotateX(Math.PI/2).translate(side*(s.w/2-.015),y,.16))
      }
      for(let i=0;i<5;i++) box('metal',.055,.038,.028,-.64+i*.145,-.715,.16)
      box('metal',.25,.026,.018,.64,-.715,.158)
      break
    case 'wood-console':
      // Separate broad side control/speaker panel, aluminum trim, feet.
      box('dark',.43,1.43,.075,.91,0,.125)
      knob(.91,.51,.115,.12);knob(.91,.21,.093,.09)
      for(let i=0;i<12;i++) box('bezel',.32,.025,.027,.91,-.04-i*.052,.179)
      for(const y of [-.78,.78])box('metal',s.w-.13,.025,.045,0,y,.154)
      for(const side of [-1,1])box('dark',.25,.105,.55,side*.71,-.87,-.38)
      break
    case 'portable':
      // Tall rounded portable with carry handle and lower control shelf.
      for(const side of [-1,1])box('shell',.13,.21,.16,side*.36,.91,-.31)
      box('shell',.84,.12,.16,0,1.035,-.31)
      box('dark',1.43,.27,.05,0,-.70,.126)
      knob(.57,-.70,.083);knob(.35,-.70,.057)
      for(let i=0;i<9;i++)box('bezel',.045,.135,.018,-.64+i*.085,-.70,.16)
      break
    case 'molded':
      // Deep tapered consumer CRT, chunky lower chin and side air vents.
      box('shell',1.78,.115,.08,0,-.70,.125)
      for(let i=0;i<5;i++) box('dark',.065,.045,.035,-.56+i*.15,-.70,.18)
      knob(.72,-.70,.052,.044)
      break
  }
  // Actual side and rear ventilation details; revealed only by grazing light.
  for(const side of [-1,1])for(let i=0;i<8;i++){
    const z=-.24-i*.063, t=T.MathUtils.smoothstep(z,-s.depth,-.14)
    const edge=(s.w-.075)/2*(s.taperX+(1-s.taperX)*t)
    box('dark',.024,s.h*.28,.025,side*(edge+.017),s.h*.14,z)
  }
  return [...parts].map(([material,geometries])=>{
    const geometry=merge(geometries)
    geometries.forEach(g=>g.dispose())
    if(!geometry)throw new Error(`Unable to build EVERYWHERE ${s.family} ${material}`)
    return {geometry,material}
  })
}
