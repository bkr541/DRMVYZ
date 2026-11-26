import type * as T from 'three'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import type { MonumentPerformance } from './MonumentPerformance'
import { MONUMENT_BAYS, MONUMENT_FLOOR_Y, monumentArchitectureTravel, monumentFit, monumentGroundedFit, monumentLines, monumentPose } from './MonumentGeometry'
import fonts from './MonumentFonts.generated.json'

type Font = {ccw:boolean;glyphs:Record<string,{advance:number;commands:readonly (readonly (string|number)[])[]}>}
const FONT_DATA:Record<string,Font>=fonts
interface Hero {root:T.Object3D;matrix:T.Matrix4;bounds:T.Box3;center:T.Vector3;fit:number;materials:{material:T.MeshStandardMaterial;metalness:number;roughness:number;emissive:T.Color;emission:number}[]}
interface Relay {mesh:T.Mesh;material:T.MeshStandardMaterial;index:number;kind:'floor'|'wall'|'trim'|'crown'}

/** Procedural architecture and local glyph extrusion; leased model resources are owned by the bridge. */
export class MonumentScene {
  private readonly geometries=new Set<T.BufferGeometry>()
  private readonly materials=new Set<T.Material>()
  private readonly relays:Relay[]=[]
  private readonly poses:ReturnType<typeof monumentPose>[]=[]
  private readonly bays:{left:T.Group;right:T.Group;crown:T.Group}[]=[]
  private readonly hall:T.Group
  private readonly podium:T.Group
  private readonly textRoot:T.Group
  private readonly box:T.BoxGeometry
  private readonly structural:T.MeshStandardMaterial
  private readonly floor:T.MeshStandardMaterial
  private readonly dark:T.MeshStandardMaterial
  private readonly inset:T.MeshStandardMaterial
  private readonly face:T.MeshStandardMaterial
  private readonly side:T.MeshStandardMaterial
  private readonly key:T.SpotLight
  private readonly rim:T.PointLight
  private readonly fill:T.PointLight
  private readonly rakes:{sign:number;light:T.SpotLight;target:T.Object3D}[]=[]
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
    this.structural=this.material(.32,.64,.42);this.floor=this.material(.075,.74,.25);this.dark=this.material(.05,.35,.74);this.inset=this.material(.13,.48,.5);this.face=this.material(.7,.55,.35);this.side=this.material(.25,.63,.38)
    this.hall=new THREE.Group();root.add(this.hall)
    this.podium=new THREE.Group();this.podium.name='monument-podium';root.add(this.podium)
    this.textRoot=new THREE.Group();this.textRoot.name='monument-hero-text';root.add(this.textRoot)
    // Long stone slabs, a raised central processional axis, and light recessed beneath the slab surface.
    this.block(root,this.dark,0,-2.82,-8,24,.22,52)
    for(let i=-4;i<=4;i++)this.block(root,this.floor,i*2.25,-2.62,-8,2.10,.18,52)
    for(const sign of [-1,1]){
      this.block(this.hall,this.inset,sign*4.5,-2.46,-7.5,1.9,.14,34)
      this.block(this.hall,this.dark,sign*7.9,2.1,-7.5,1.0,10,29)
      for(let i=0;i<13;i++)this.relay(this.hall,'floor',i,sign*3.375,-2.56,7-i*1.7,.105,.025,1.47)
    }
    // Massive alternating buttresses. Recessed wings and heavy overhead lintels move independently;
    // the load-bearing columns never move or cross the central sightline.
    for(const [i,bay] of MONUMENT_BAYS.entries()){
      const left=new THREE.Group(),right=new THREE.Group(),crown=new THREE.Group();left.name=`monument-wing-left-${i}`;right.name=`monument-wing-right-${i}`;crown.name=`monument-crown-${i}`;this.hall.add(left,right,crown);this.bays.push({left,right,crown})
      for(const sign of [-1,1]){
        const wing=sign<0?left:right
        this.block(this.hall,this.structural,sign*bay.x,(bay.crown+MONUMENT_FLOOR_Y)/2,bay.z,bay.width,bay.crown-MONUMENT_FLOOR_Y,bay.depth)
        this.block(this.hall,this.inset,sign*(bay.x+.45),.8,bay.z-.55,bay.width+.65,6.5,bay.depth+.65)
        this.block(this.hall,this.structural,sign*bay.x,-2.16,bay.z,bay.width+.48,.74,bay.depth+.52)
        // Inner panel stays outside x=4.42 even at the closed stop. Slot sits in a dark backing.
        this.block(wing,this.inset,sign*4.74,.95,bay.z,.64,6.75,.60)
        this.block(wing,this.dark,sign*4.74,.95,bay.z+.32,.28,6.25,.075)
        this.relay(wing,'wall',i,sign*4.74,.95,bay.z+.365,.075,5.85,.025)
      }
      this.block(crown,this.structural,0,bay.crown+.45,bay.z,10.8,.90,bay.depth)
      this.block(crown,this.inset,0,bay.crown-.10,bay.z,9.8,.24,bay.depth*.8)
      this.relay(crown,'crown',i,0,bay.crown-.23,bay.z,8.8,.035,.095)
    }
    // The distant sanctuary has its own relief rather than another repetition of the entrance.
    this.block(this.hall,this.dark,0,2.6,-16.8,18,12,.75)
    for(const sign of [-1,1]){
      this.block(this.hall,this.structural,sign*5.2,2.0,-15.9,4.1,9.1,.8)
      this.block(this.hall,this.inset,sign*2.75,2.0,-16.1,.9,8.6,.55)
      this.relay(this.hall,'wall',5,sign*2.75,2.0,-15.79,.10,7.7,.035)
    }
    this.block(this.hall,this.inset,0,6.05,-15.9,7.3,.65,.8)
    // Four substantial rectangular terraces, with actual risers and shadow gaps.
    this.block(this.podium,this.structural,0,.08,0,10.3,.16,5.4)
    this.block(this.podium,this.dark,0,.20,0,9.75,.08,4.95)
    this.block(this.podium,this.structural,0,.33,0,9.2,.18,4.35)
    this.block(this.podium,this.floor,0,.49,0,8.75,.1,4.05)
    this.relay(this.podium,'trim',0,0,.20,2.49,9.3,.028,.035)
    this.relay(this.podium,'trim',1,0,.43,2.035,8.5,.025,.035)
    this.target=new THREE.Object3D();root.add(this.target)
    this.key=new THREE.SpotLight(0xffffff,40,26,Math.PI/5,.72,2);this.key.target=this.target;root.add(this.key)
    this.rim=new THREE.PointLight(0xffcc88,8,13,2);root.add(this.rim)
    this.fill=new THREE.PointLight(0x00c7dd,8,13,2);this.fill.position.set(0,-1.1,3.3);root.add(this.fill)
    // Non-shadowed grazing lights illuminate the actual stone faces rather than relying on emissive lines to light their neighbours.
    for(const sign of [-1,1]){
      const light=new THREE.SpotLight(0xffffff,0,24,.38,.72,2),target=new THREE.Object3D()
      light.position.set(sign*3.9,3.5,4.7);target.position.set(sign*5.6,.5,-3.8);light.target=target;root.add(light,target);this.rakes.push({sign,light,target})
    }
  }
  private material(color:number,metalness:number,roughness:number){const m=new this.library.THREE.MeshStandardMaterial({color:new this.library.THREE.Color().setScalar(color),metalness,roughness});this.materials.add(m);return m}
  private block(parent:T.Object3D,mat:T.MeshStandardMaterial,x:number,y:number,z:number,w:number,h:number,d:number){const mesh=new this.library.THREE.Mesh(this.box,mat);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
  private relay(parent:T.Object3D,kind:Relay['kind'],index:number,x:number,y:number,z:number,w:number,h:number,d:number){const material=this.material(.35,.2,.4),mesh=this.block(parent,material,x,y,z,w,h,d);mesh.castShadow=false;mesh.name=`monument-relay-${kind}-${index}`;this.relays.push({mesh,material,index,kind})}
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
  private rebuildText(p:MonumentPerformance){
    const lines=monumentLines(p.text('text','STAGELESS'),p.text('line-2',''),p.text('line-3',''))
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
    const f=monumentGroundedFit(hero.fit*p.n('model-scale',1,.5,1.2),this.extent.x,this.extent.y,this.extent.z,top,x,y,z)
    this.vector.set(x,top-this.rotated.min.y*f+y+.015,z);this.scale.setScalar(f)
    this.transform.compose(this.vector,this.quat,this.scale).multiply(this.translation.makeTranslation(-hero.center.x,-hero.center.y,-hero.center.z)).multiply(hero.matrix);hero.root.matrix.copy(this.transform);hero.root.matrixWorldNeedsUpdate=true
    const mode=p.text('material-mode','original'),accent=p.color('accent')
    for(const item of hero.materials){const m=item.material;m.metalness=mode==='brushed'?.8:item.metalness;m.roughness=mode==='brushed'?.32:item.roughness;m.emissive.copy(item.emissive);m.emissiveIntensity=item.emission;if(mode==='edge'){m.emissive.setRGB(accent[0]!,accent[1]!,accent[2]!,THREE.SRGBColorSpace);m.emissiveIntensity=.25*p.n('hero-emission',.2)}}
    if(isText){this.tint(this.face,p.color('text-face'),mode==='edge'?.1*p.n('hero-emission',.2):0);this.tint(this.side,p.color('text-side'),mode==='edge'?.2*p.n('hero-emission',.2):0)}
  }
  apply(p:MonumentPerformance,quality:string){
    const modelMode=p.text('content-type','text')==='model',imported=modelMode?this.imported:null
    if(!imported)this.rebuildText(p)
    this.textRoot.visible=!imported&&p.on('model-visible');if(this.imported)this.imported.root.visible=!!imported&&p.on('model-visible')
    const height=p.n('pedestal-height',.12,.05,.3),stepScale=Math.max(.35,.65+height*3.5+Math.min(0,p.n('model-y',0,-.2,.2))*2.0);this.podium.position.y=MONUMENT_FLOOR_Y;this.podium.scale.y=stepScale;const top=MONUMENT_FLOOR_Y+.54*stepScale
    this.hall.scale.z=p.n('hall-depth',1,.75,1.75)
    const hero=imported??this.textHero;if(hero)this.poseHero(hero,p,top,!imported)
    this.tint(this.structural,p.color('structural'));this.structural.emissiveIntensity=0;this.floor.envMapIntensity=p.n('reflection',.25)*1.5;this.floor.roughness=.56-.42*p.n('reflection',.25)
    const input=p.inputs;for(let i=0;i<13;i++)this.poses[i]=monumentPose(input,i)
    const pose=this.poses[0]!,primary=p.color('primary'),secondary=p.color('secondary'),accent=p.color('accent'),spill=p.n('spill',.3)
    // All three moving pieces of each bay share one bounded travel pose.
    for(let i=0;i<this.bays.length;i++){
      const bay=this.bays[i]!,travel=monumentArchitectureTravel(this.poses[i]!,p.safety)
      bay.left.position.x=-travel.wing;bay.right.position.x=travel.wing;bay.crown.position.y=travel.crown
    }
    for(const relay of this.relays){
      const local=this.poses[relay.index]!,strength=relay.kind==='floor'?local.floor:relay.kind==='wall'?local.wall:relay.kind==='crown'?local.shaft:local.rim
      this.tint(relay.material,relay.kind==='floor'?secondary:relay.kind==='trim'?accent:primary,.045+1.8*strength)
      // Preserve the actual foreground frame and all crown openings on low quality.
      relay.mesh.visible=quality!=='low'||relay.index%2===0||relay.kind==='trim'||relay.kind==='crown'
    }
    this.key.color.setRGB(primary[0]!,primary[1]!,primary[2]!,this.library.THREE.SRGBColorSpace);this.key.position.set(pose.sweep*3.4,4.4+pose.height*1.2,5.8);this.target.position.set(pose.sweep*.65,top+1.35+pose.height*.55,0);this.key.intensity=48+100*pose.key;this.key.angle=.42+.22*p.n('reveal-extent',.65)
    this.rim.color.setRGB(accent[0]!,accent[1]!,accent[2]!,this.library.THREE.SRGBColorSpace);this.rim.position.set(-pose.sweep*2.8,top+3.0,-2.8);this.rim.intensity=12+36*pose.rim+18*p.n('hero-emission',.2)
    this.fill.color.setRGB(secondary[0]!,secondary[1]!,secondary[2]!,this.library.THREE.SRGBColorSpace);this.fill.intensity=2+24*spill*(.2+pose.floor)
    for(const {sign,light,target} of this.rakes){
      const local=this.poses[sign<0?1:3]!
      light.color.setRGB(primary[0]!,primary[1]!,primary[2]!,this.library.THREE.SRGBColorSpace)
      target.position.set(sign*5.6,.5+local.height*2,-3.8-3*local.aperture)
      light.intensity=spill*(18+100*local.wall+45*local.shaft)
    }
  }
  dispose(){for(const g of this.textGeometry)g.dispose();this.textGeometry=[];for(const g of this.geometries)g.dispose();for(const m of this.materials)m.dispose();this.geometries.clear();this.materials.clear();this.imported=null;this.textHero=null}
}
