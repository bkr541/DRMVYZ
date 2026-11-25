import type * as T from 'three'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import type { MonumentPerformance } from './MonumentPerformance'
import { MONUMENT_PALETTE, monumentFit, monumentLines, monumentPose } from './MonumentGeometry'
import fonts from './MonumentFonts.generated.json'

type Font = {ccw:boolean;glyphs:Record<string,{advance:number;commands:readonly (readonly (string|number)[])[]}>}
const FONT_DATA:Record<string,Font>=fonts
interface Hero {root:T.Object3D;matrix:T.Matrix4;bounds:T.Box3;center:T.Vector3;fit:number;materials:{material:T.MeshStandardMaterial;metalness:number;roughness:number;emissive:T.Color;emission:number}[]}
interface Relay {mesh:T.Mesh;material:T.MeshStandardMaterial;index:number;kind:'floor'|'wall'|'trim'}

/** Procedural architecture and local glyph extrusion; leased model resources are owned by the bridge. */
export class MonumentScene {
  private readonly geometries=new Set<T.BufferGeometry>()
  private readonly materials=new Set<T.Material>()
  private readonly relays:Relay[]=[]
  private readonly hall:T.Group
  private readonly podium:T.Group
  private readonly textRoot:T.Group
  private readonly box:T.BoxGeometry
  private readonly structural:T.MeshStandardMaterial
  private readonly floor:T.MeshStandardMaterial
  private readonly dark:T.MeshStandardMaterial
  private readonly face:T.MeshStandardMaterial
  private readonly side:T.MeshStandardMaterial
  private readonly key:T.SpotLight
  private readonly rim:T.PointLight
  private readonly fill:T.PointLight
  private readonly target:T.Object3D
  private readonly vector:T.Vector3
  private readonly quat:T.Quaternion
  private readonly euler:T.Euler
  private readonly scale:T.Vector3
  private readonly translation:T.Matrix4
  private readonly transform:T.Matrix4
  private readonly rotationMatrix:T.Matrix4
  private readonly rotated:T.Box3
  private readonly extent:T.Vector3
  private textGeometry:T.BufferGeometry[]=[]
  private textHero:Hero|null=null
  private imported:Hero|null=null
  private textKey=''
  constructor(private readonly library:Cinema2ThreeLibrary,root:T.Object3D){
    const {THREE}=library
    this.vector=new THREE.Vector3();this.quat=new THREE.Quaternion();this.euler=new THREE.Euler();this.scale=new THREE.Vector3();this.translation=new THREE.Matrix4();this.transform=new THREE.Matrix4();this.rotationMatrix=new THREE.Matrix4();this.rotated=new THREE.Box3();this.extent=new THREE.Vector3()
    this.box=new THREE.BoxGeometry(1,1,1);this.geometries.add(this.box)
    this.structural=this.material(.32,.64,.42);this.floor=this.material(.075,.74,.25);this.dark=this.material(.05,.35,.74);this.face=this.material(.7,.55,.35);this.side=this.material(.25,.63,.38)
    this.hall=new THREE.Group();root.add(this.hall)
    this.podium=new THREE.Group();root.add(this.podium)
    this.textRoot=new THREE.Group();root.add(this.textRoot)
    // Floor slabs leave actual gaps for recessed cyan channels; the base lies below them.
    this.block(root,this.dark,0,-2.82,0,24,.22,36)
    for(let i=-4;i<=4;i++)this.block(root,this.floor,i*2.25,-2.62,0,2.10,.18,32)
    for(let i=0;i<11;i++)for(const x of [-3.375,3.375])this.relay(this.hall,'floor',i,x,-2.69,6.5-i*1.45,.105,.025,1.24)
    this.block(this.hall,this.dark,0,2.2,-12,18,10,.6)
    for(const sign of [-1,1]){
      this.block(this.hall,this.dark,sign*6.9,2.1,-3,1,10,21)
      for(let i=0;i<7;i++){
        const z=5-i*2.45
        this.block(this.hall,this.structural,sign*5.65,1.8,z,1.05,8.8,.95)
        this.block(this.hall,this.dark,sign*5.05,1.8,z,.22,8.2,.66)
        this.block(this.hall,this.structural,sign*5.5,-2.15,z,1.65,.7,1.45)
        this.relay(this.hall,'wall',i,sign*4.91,1.5,z+.16,.045,7.2,.055)
        this.block(this.hall,this.structural,sign*4.2,6.05,z,3.7,.46,.85)
        this.relay(this.hall,'wall',i,sign*2.75,5.78,z,2.7,.045,.09)
      }
    }
    for(let i=0;i<5;i++){
      this.block(this.hall,this.structural,(i-2)*2.2,2,-11.5,1.9,9,.28)
      this.relay(this.hall,'trim',i,(i-2)*2.2,2,-11.30,.04,8.2,.045)
    }
    // Stepped broad rectangular plinth, not a circular machine platform.
    this.block(this.podium,this.structural,0,.09,0,10.3,.18,5.4)
    this.block(this.podium,this.dark,0,.22,0,9.7,.12,4.85)
    this.block(this.podium,this.structural,0,.36,0,9.2,.16,4.35)
    this.block(this.podium,this.floor,0,.49,0,8.75,.1,4.05)
    this.relay(this.podium,'trim',0,0,.31,2.20,8.7,.028,.035)
    this.relay(this.podium,'trim',1,0,.18,2.46,9.3,.025,.035)
    this.target=new THREE.Object3D();root.add(this.target)
    this.key=new THREE.SpotLight(0xffffff,40,26,Math.PI/5,.72,2);this.key.target=this.target;root.add(this.key)
    this.rim=new THREE.PointLight(0xffcc88,8,13,2);root.add(this.rim)
    this.fill=new THREE.PointLight(0x00c7dd,8,13,2);this.fill.position.set(0,-1.1,3.3);root.add(this.fill)
  }
  private material(color:number,metalness:number,roughness:number){const m=new this.library.THREE.MeshStandardMaterial({color:new this.library.THREE.Color().setScalar(color),metalness,roughness});this.materials.add(m);return m}
  private block(parent:T.Object3D,mat:T.MeshStandardMaterial,x:number,y:number,z:number,w:number,h:number,d:number){const mesh=new this.library.THREE.Mesh(this.box,mat);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
  private relay(parent:T.Object3D,kind:Relay['kind'],index:number,x:number,y:number,z:number,w:number,h:number,d:number){const material=this.material(.35,.2,.4),mesh=this.block(parent,material,x,y,z,w,h,d);mesh.castShadow=false;this.relays.push({mesh,material,index,kind})}
  private tint(m:T.MeshStandardMaterial,c:readonly number[],emission=0){m.color.setRGB(c[0]!,c[1]!,c[2]!,this.library.THREE.SRGBColorSpace);m.emissive.copy(m.color);m.emissiveIntensity=emission}
  private prepareHero(root:T.Object3D):Hero{
    const {THREE}=this.library; if(root.matrixAutoUpdate)root.updateMatrix();root.updateMatrixWorld(true)
    const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),materials:Hero['materials']=[],seen=new Set<T.Material>()
    root.traverse(object=>{const mesh=object as T.Mesh;if(!mesh.isMesh)return;mesh.castShadow=true;mesh.receiveShadow=true;for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){const m=material as T.MeshStandardMaterial;if(m.isMeshStandardMaterial&&!seen.has(m)){seen.add(m);materials.push({material:m,metalness:m.metalness,roughness:m.roughness,emissive:m.emissive.clone(),emission:m.emissiveIntensity})}}})
    const matrix=root.matrix.clone();root.matrixAutoUpdate=false;return {root,matrix,bounds,center,fit:monumentFit(size.x,size.y,size.z),materials}
  }
  attachModel(root:T.Object3D){this.imported=this.prepareHero(root)}
  detachModel(root:T.Object3D){if(this.imported?.root===root)this.imported=null}
  /** Nest contours by containment instead of relying on font-specific winding. Odd nesting levels are counters. */
  private glyphShapes(path:T.ShapePath):T.Shape[]{
    const {THREE}=this.library
    const contains=(points:T.Vector2[],point:T.Vector2)=>{let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i]!,b=points[j]!;if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside}return inside}
    const contours=path.subPaths.map(sub=>{const points=sub.getPoints(10);return {sub,points,area:Math.abs(THREE.ShapeUtils.area(points)),parent:-1,depth:0}}).filter(c=>c.points.length>=3&&c.area>1e-9).sort((a,b)=>b.area-a.area)
    const byIndex=new Map<number,T.Shape>(),shapes:T.Shape[]=[]
    contours.forEach((c,i)=>{for(let j=i-1;j>=0;j--)if(contains(contours[j]!.points,c.points[0]!)){c.parent=j;c.depth=contours[j]!.depth+1;break}
      if(c.depth%2===0){const shape=new THREE.Shape();shape.curves=c.sub.curves.slice();shape.autoClose=true;byIndex.set(i,shape);shapes.push(shape)}else byIndex.get(c.parent)?.holes.push(c.sub)
    });return shapes
  }
  private rebuildText(p:MonumentPerformance,fallback:boolean){
    const lines=fallback?['STAGELESS']:monumentLines(p.text('text','STAGELESS'),p.text('line-2',''),p.text('line-3',''))
    const fontName=p.text('font','anton'),depth=p.n('text-depth',.12,.02,.3),bevel=p.n('bevel',.015,0,.05),spacing=p.n('letter-spacing',.025,-.05,.2),lineSpacing=p.n('line-spacing',1.1,.8,1.5),alignment=p.text('alignment','center')
    const key=JSON.stringify([lines,fontName,depth,bevel,spacing,lineSpacing,alignment]);if(key===this.textKey)return;this.textKey=key
    this.textRoot.clear();for(const g of this.textGeometry)g.dispose();this.textGeometry=[];this.textHero=null;this.textRoot.matrix.identity();this.textRoot.matrixWorldNeedsUpdate=true
    const {THREE}=this.library,font=FONT_DATA[fontName]??FONT_DATA.anton!
    const glyphs=lines.map(line=>Array.from(line,c=>font.glyphs[c]??font.glyphs['?']!))
    const widths=glyphs.map(line=>line.reduce((n,g)=>n+g.advance+spacing,0)-spacing),width=Math.max(0,...widths)
    glyphs.forEach((line,row)=>{let x=alignment==='left'?0:alignment==='right'?width-widths[row]!:(width-widths[row]!)/2
      for(const glyph of line){const path=new THREE.ShapePath();for(const cmd of glyph.commands){const a=cmd.slice(1) as number[];switch(cmd[0]){case 'm':path.moveTo(a[0]!,a[1]!);break;case 'l':path.lineTo(a[0]!,a[1]!);break;case 'q':path.quadraticCurveTo(a[0]!,a[1]!,a[2]!,a[3]!);break;case 'c':path.bezierCurveTo(a[0]!,a[1]!,a[2]!,a[3]!,a[4]!,a[5]!);break;case 'z':path.currentPath?.closePath();break}}
        const shapes=this.glyphShapes(path);if(shapes.length){const b=Math.min(bevel,.05,depth*.35);const geometry=new THREE.ExtrudeGeometry(shapes,{depth,bevelEnabled:b>0,bevelSize:b,bevelThickness:b,bevelSegments:2,curveSegments:6,steps:1});this.textGeometry.push(geometry);const mesh=new THREE.Mesh(geometry,[this.face,this.side]);mesh.position.set(x,-row*lineSpacing,0);this.textRoot.add(mesh)}x+=glyph.advance+spacing
      }
    });if(this.textGeometry.length){this.face.metalness=.55;this.face.roughness=.35;this.side.metalness=.63;this.side.roughness=.38;this.face.emissiveIntensity=0;this.side.emissiveIntensity=0;this.textHero=this.prepareHero(this.textRoot)}
  }
  private poseHero(hero:Hero,p:MonumentPerformance,top:number,isText:boolean){
    const {THREE}=this.library,rad=Math.PI/180,motion=p.n('hero-motion',.2)*p.safety*(1-.3*p.inputs.vocal)*(1+.15*p.inputs.bass*p.inputs.intensity)
    this.euler.set(p.n('model-pitch',0,-25,25)*rad+.014*motion*Math.sin(p.phase*.4),p.n('model-yaw',0,-180,180)*rad+.045*motion*Math.sin(p.phase*.35),p.n('model-roll',0,-20,20)*rad);this.quat.setFromEuler(this.euler)
    this.rotationMatrix.makeRotationFromQuaternion(this.quat).multiply(this.translation.makeTranslation(-hero.center.x,-hero.center.y,-hero.center.z));this.rotated.copy(hero.bounds).applyMatrix4(this.rotationMatrix);this.rotated.getSize(this.extent)
    const x=p.n('model-x',0,-.2,.2)*2,z=p.n('model-z',0,-.2,.2)*1.5,y=Math.max(0,p.n('model-y',0,-.2,.2)*1.5)
    const f=Math.min(hero.fit*p.n('model-scale',1,.5,1.2),(7.8-2*Math.abs(x))/Math.max(this.extent.x,1e-6),Math.min(4.4-y,2.1-top-y)/Math.max(this.extent.y,1e-6),(3.65-2*Math.abs(z))/Math.max(this.extent.z,1e-6))
    this.vector.set(x,top-this.rotated.min.y*f+y+.015,z);this.scale.setScalar(f)
    this.transform.compose(this.vector,this.quat,this.scale).multiply(this.translation.makeTranslation(-hero.center.x,-hero.center.y,-hero.center.z)).multiply(hero.matrix);hero.root.matrix.copy(this.transform);hero.root.matrixWorldNeedsUpdate=true
    const mode=p.text('material-mode','original'),accent=p.color('accent')
    for(const item of hero.materials){const m=item.material;m.metalness=mode==='brushed'?.8:item.metalness;m.roughness=mode==='brushed'?.32:item.roughness;m.emissive.copy(item.emissive);m.emissiveIntensity=item.emission;if(mode==='edge'){m.emissive.setRGB(accent[0]!,accent[1]!,accent[2]!,THREE.SRGBColorSpace);m.emissiveIntensity=.25*p.n('hero-emission',.2)}}
    if(isText){this.tint(this.face,p.color('text-face'),mode==='edge'?.1*p.n('hero-emission',.2):0);this.tint(this.side,p.color('text-side'),mode==='edge'?.2*p.n('hero-emission',.2):0)}
  }
  apply(p:MonumentPerformance,quality:string){
    const modelMode=p.text('content-type','text')==='model',imported=modelMode?this.imported:null
    if(!imported)this.rebuildText(p,modelMode)
    this.textRoot.visible=!imported&&p.on('model-visible');if(this.imported)this.imported.root.visible=!!imported&&p.on('model-visible')
    const height=p.n('pedestal-height',.12,.05,.3),stepScale=Math.max(.35,.65+height*3.5+Math.min(0,p.n('model-y',0,-.2,.2))*2.0);this.podium.position.y=-2.53;this.podium.scale.y=stepScale;const top=-2.53+.54*stepScale
    this.hall.scale.z=p.n('hall-depth',1,.75,1.75)
    const hero=imported??this.textHero;if(hero)this.poseHero(hero,p,top,!imported)
    this.tint(this.structural,p.color('structural'));this.floor.envMapIntensity=p.n('reflection',.25)*1.5;this.floor.roughness=.48-.28*p.n('reflection',.25)
    const input=p.inputs,pose=monumentPose(input,0),primary=p.color('primary'),secondary=p.color('secondary'),accent=p.color('accent'),spill=p.n('spill',.3)
    for(const relay of this.relays){const local=monumentPose(input,relay.index);const strength=relay.kind==='floor'?local.floor:relay.kind==='wall'?local.wall:local.rim;this.tint(relay.material,relay.kind==='floor'?secondary:relay.kind==='wall'?primary:accent,.08+2.2*strength);relay.mesh.visible=quality!=='low'||relay.index%2===0||relay.kind==='trim'}
    this.key.color.setRGB(primary[0]!,primary[1]!,primary[2]!,this.library.THREE.SRGBColorSpace);this.key.position.set(pose.sweep*4.2,3.1+pose.height*2.1,5.1);this.target.position.set(pose.sweep*1.1,top+1.3+pose.height*.7,0);this.key.intensity=22+66*pose.key;this.key.angle=.36+.35*p.n('reveal-extent',.65)
    this.rim.color.setRGB(accent[0]!,accent[1]!,accent[2]!,this.library.THREE.SRGBColorSpace);this.rim.position.set(-pose.sweep*3,top+2.2,1.2);this.rim.intensity=4+24*pose.rim+18*p.n('hero-emission',.2)
    this.fill.color.setRGB(secondary[0]!,secondary[1]!,secondary[2]!,this.library.THREE.SRGBColorSpace);this.fill.intensity=2+24*spill*(.2+pose.floor)
  }
  dispose(){for(const g of this.textGeometry)g.dispose();this.textGeometry=[];for(const g of this.geometries)g.dispose();for(const m of this.materials)m.dispose();this.geometries.clear();this.materials.clear();this.imported=null;this.textHero=null}
}
