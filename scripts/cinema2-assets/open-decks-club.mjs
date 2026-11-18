// Original procedural club geometry in world coordinates, converted to the CDJ asset's Z-up space.
import { BoxGeometry, CylinderGeometry, SphereGeometry, TorusGeometry, Matrix4, Quaternion, Vector3 } from 'three'
export const CLUB = Object.freeze({ rows: 5, columns: 9, width: 40, back: -36, fixtureHeight: 11.5 })
const local = new Matrix4().makeRotationX(Math.PI / 2).premultiply(new Matrix4().makeTranslation(0,0,-7.2))
const point = value => new Vector3(...value).applyMatrix4(local).toArray()
const material = (name, color, emissive = [0,0,0], extra = {}) => ({ name, pbrMetallicRoughness: { baseColorFactor: [...color,1], metallicFactor: 0, roughnessFactor: 1 }, emissiveFactor: emissive, extensions: { KHR_materials_specular: { specularFactor: 0 } }, ...extra })
export const CLUB_MATERIALS = {
  'club-ink': material('club-ink',[.0006,.0008,.001]),
  'club-room': material('club-room',[.002,.0016,.0012]),
  'club-hardware': material('club-hardware',[.008,.006,.003]),
  'club-gold': material('club-gold',[.18,.065,.002],[1,.5,.008]),
  'club-rim': material('club-rim',[.025,.009,.001],[.20,.075,.001]),
  'club-lens': material('club-lens',[.25,.08,.001],[1,.55,.015]),
  'club-beam': material('club-beam',[0,0,0],[.8,.30,.008], { alphaMode:'BLEND', doubleSided:true, pbrMetallicRoughness:{ baseColorFactor:[0,0,0,.075],metallicFactor:0,roughnessFactor:1 } }),
}
class MeshBuilder {
  constructor(name, extras = {}) { this.name=name;this.extras=extras;this.parts=new Map() }
  add(geometry, name, transform = new Matrix4()) {
    geometry.applyMatrix4(transform).applyMatrix4(local)
    const part=this.parts.get(name) ?? { material:name,positions:[],normals:[],indices:[] }
    const offset=part.positions.length/3
    part.positions.push(...geometry.attributes.position.array);part.normals.push(...geometry.attributes.normal.array)
    for(const index of geometry.index.array)part.indices.push(index+offset)
    this.parts.set(name,part);geometry.dispose()
  }
  finish() { return {name:this.name,extras:this.extras,primitives:[...this.parts.values()].map(p=>({...p,positions:Float32Array.from(p.positions),normals:Float32Array.from(p.normals),indices:Uint32Array.from(p.indices)}))} }
}
const transform = (position, scale=[1,1,1], rotation=new Quaternion()) => new Matrix4().compose(new Vector3(...position),rotation,new Vector3(...scale))
function box(mesh, position, size, mat='club-room') { mesh.add(new BoxGeometry(...size),mat,transform(position)) }
function bar(mesh, a, b, radius=.08, mat='club-hardware', parent=new Matrix4()) {
  const start=new Vector3(...a),end=new Vector3(...b),direction=end.clone().sub(start)
  const pose=new Matrix4().compose(start.add(end).multiplyScalar(.5),new Quaternion().setFromUnitVectors(new Vector3(0,1,0),direction.clone().normalize()),new Vector3(1,1,1))
  mesh.add(new CylinderGeometry(radius,radius,direction.length(),8,1),mat,parent.clone().multiply(pose))
}
function sphere(mesh, position, size, parent, mat='club-ink') { mesh.add(new SphereGeometry(1,10,6),mat,parent.clone().multiply(transform(position,size))) }
export function buildOpenDecksClub() {
  const meshes=[],room=new MeshBuilder('club-architecture')
  box(room,[0,.005,-20],[40,.035,32])
  box(room,[0,9,-36],[40,18,.3]);for(const x of [-20,20])box(room,[x,9,-20],[.3,18,32])
  for(const x of [-18,-10,10,18]) { box(room,[x,8,-35.7],[.25,16,.25],'club-hardware');box(room,[x+.17,8,-35.5],[.055,16,.055],'club-gold') }
  // Inset light frame and equalizer-shaped wall accents.
  for(const x of [-4,4])box(room,[x,10.5,-35.5],[.075,5,.075],'club-gold')
  for(const y of [8,13])box(room,[0,y,-35.5],[8,.075,.075],'club-gold')
  for(const side of [-1,1])for(let i=0;i<5;i++)box(room,[side*12+(i-2)*.4,12.3+Math.sin(i/4*Math.PI)*.5,-35.5],[.12,.7+Math.sin(i/4*Math.PI),.12],'club-gold')
  for(const x of [-19.75,19.75])for(const z of [-10,-22,-32])box(room,[x,10,z],[.06,.12,5],'club-gold')
  // Truss rails and actual diagonal braces across the club ceiling.
  for(const z of [-10,-22,-34]) {
    bar(room,[-19,11.5,z],[19,11.5,z],.12)
    bar(room,[-19,12.5,z],[19,12.5,z],.10,'club-gold')
    for(let x=-18;x<18;x+=3)bar(room,[x,11.5,z],[x+3,12.5,z],.07)
  }
  for(const x of [-18,18])bar(room,[x,11.5,-5],[x,11.5,-35],.12)
  meshes.push(room.finish())
  for(let row=0;row<CLUB.rows;row++)for(let column=0;column<CLUB.columns;column++){
    const index=row*CLUB.columns+column,x=(column-4)*2.7+Math.sin(index*1.9)*.4,z=-12-row*4+Math.cos(index)*.3
    const height=6.25+Math.sin(index*2.3)*.55,scale=height/2
    const pose=transform([x,.04,z],[scale,scale,scale],new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.sin(index)*.3))
    const extras={clubActor:index,clubRow:row,clubRole:'body',clubPivot:point([x,.04,z])}
    const body=new MeshBuilder(`club-dancer-${index}`,extras)
    sphere(body,[0,1.23,0],[.30,.43,.18],pose)
    sphere(body,[0,.88,0],[.25,.2,.17],pose)
    sphere(body,[0,1.83,0],[.21,.25,.20],pose)
    sphere(body,[0,2.0,-.015],[.23,.13,.21],pose)
    bar(body,[-.16,.9,0],[-.24,.48,.04],.11,'club-ink',pose);bar(body,[-.24,.48,.04],[-.22,.10,.03],.09,'club-ink',pose)
    bar(body,[.16,.9,0],[.22,.48,-.04],.11,'club-ink',pose);bar(body,[.22,.48,-.04],[.29,.10,.07],.09,'club-ink',pose)
    const halo=pose.clone().multiply(transform([0,1.85,-.05]))
    body.add(new TorusGeometry(.215,.014,3,16,Math.PI),'club-rim',halo)
    bar(body,[.29,1.02,-.06],[.26,1.5,-.06],.014,'club-rim',pose)
    meshes.push(body.finish())
    for(const side of [-1,1]){
      const raised=(index+(side>0?1:0))%3!==0
      const shoulder=[side*.25,1.5,0], elbow=[side*.45,raised?1.84:1.08,.02],hand=[side*.57,raised?2.23:1.31,.06]
      const pivot=new Vector3(...shoulder).applyMatrix4(pose).toArray()
      const arm=new MeshBuilder(`club-dancer-${index}-arm-${side}`,{clubActor:index,clubRow:row,clubRole:side<0?'left':'right',clubPivot:point(pivot)})
      bar(arm,shoulder,elbow,.09,'club-ink',pose);bar(arm,elbow,hand,.075,'club-ink',pose)
      sphere(arm,hand,[.075,.10,.075],pose)
      bar(arm,[elbow[0]+side*.075,elbow[1],-.025],[hand[0]+side*.06,hand[1],.015],.012,'club-rim',pose)
      meshes.push(arm.finish())
    }
  }
  for(const side of [-1,1]){
    const tip=[side*9,11.5,-22],target=[side*3,1,-12]
    const fixture=new MeshBuilder(`club-fixture-${side}`)
    const axis=new Vector3(...target).sub(new Vector3(...tip)).normalize(),q=new Quaternion().setFromUnitVectors(new Vector3(0,1,0),axis)
    fixture.add(new CylinderGeometry(.55,.55,1,12),'club-hardware',transform(tip,[1,1,1],q))
    const lens=new Vector3(...tip).addScaledVector(axis,.52)
    fixture.add(new CylinderGeometry(.43,.43,.04,16),'club-lens',transform(lens.toArray(),[1,1,1],q));meshes.push(fixture.finish())
    const length=new Vector3(...target).distanceTo(new Vector3(...tip)),mid=new Vector3(...tip).lerp(new Vector3(...target),.5)
    const beam=new MeshBuilder(`club-beam-${side}`,{clubBeam:true,clubPivot:point(tip)})
    beam.add(new CylinderGeometry(.12,3.5,length,24,1,true),'club-beam',transform(mid.toArray(),[1,1,1],new Quaternion().setFromUnitVectors(new Vector3(0,-1,0),axis)))
    meshes.push(beam.finish())
  }
  return meshes
}
