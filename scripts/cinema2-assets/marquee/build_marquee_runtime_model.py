#!/usr/bin/env python3
"""DVYDRM Cinema 2.0 Marquee RUNTIME MODEL builder.

Derived from the owner's V2 builder (docs/Marquee/Marquee_Reconstruction_v2/source/build_marquee_hifi.py), which is kept untouched. Every
change from V2 is marked `# RUNTIME DELTA` so the two can be diffed. All node names, fixture counts and transforms used by the Cinema 2.0
controller are unchanged; the deltas only strengthen architecture the approved reference shows and V2 under-modelled:
  - the stepped Art Deco crown (thicker red/amber layers, fat blue and amber fluted fins instead of hairline tubes)
  - the central roof stripes (thicker, blue centre with amber flanks as in the reference)
  - the tower panels (black behind the bulb lenses, larger lenses)
  - the entrance LED cells (larger, nearly touching round cells, on a black housing)
  - the forecourt (one continuous slab instead of slab + curb + lowered road; no hairline paving-joint rods and no pale reflection-lane slabs: hairlines 0.01 above the slab z-fight and tear the
    screen-space floor reflection, and wet reflections should read instead of a tile lattice)

DVYDRM Cinema 2.0 Marquee. Deterministic, dependency-light procedural GLB build.
Requires: trimesh numpy Pillow shapely. Builds reproducible real mesh geometry, not a photo plane.
Coordinate convention: X right, Y up, +Z toward audience. Units are calibrated scene units.
"""
from __future__ import annotations
import math,random,json,os,sys
from pathlib import Path
from collections import Counter
import numpy as np
import trimesh
from trimesh.visual import TextureVisuals
from trimesh.visual.material import PBRMaterial
from PIL import Image,ImageDraw,ImageFont,ImageFilter
from shapely.geometry import Polygon

ROOT=Path(__file__).resolve().parent.parent
# Output directory is injectable so the repository build script can keep generated files out of the source tree.
OUT=Path(os.environ.get('MARQUEE_BUILD_OUT',str(ROOT/'assets'))); OUT.mkdir(exist_ok=True,parents=True)
SEED=31717; R=random.Random(SEED)
S=trimesh.Scene()
COUNT=Counter(); mat_cache={}; NODE_INFO={}; CAMERA={}

def material(key, rgb,metal=0.,rough=.72,emissive=None,em_int=1,texture=None):
 if key in mat_cache: return mat_cache[key]
 base=[int(v) for v in rgb]+[255]
 # intensity factors above 1 allowed in emissiveFactor? glTF clamps on some engines; keep lower.
 emit=(np.array(emissive,dtype=float)*float(em_int)).clip(0,1).tolist() if emissive is not None else None
 kw=dict(name=key,baseColorFactor=base,metallicFactor=float(metal),roughnessFactor=float(rough),doubleSided=True, alphaMode='OPAQUE')
 if emit is not None: kw['emissiveFactor']=emit
 if texture is not None:kw['baseColorTexture']=texture
 m=PBRMaterial(**kw);mat_cache[key]=m;return m

BRICK=material('mat.brick_masonry',(198,105,71),rough=.94)
STONE=material('mat.stone_cream',(196,166,130),rough=.86)
LIMESTONE=material('mat.trim_limestone',(225,195,151),rough=.77)
DARK_STONE=material('mat.brick_cornice',(111,68,50),rough=.87)
DARK_GREEN=material('mat.architecture_deep_green',(13,42,32),metal=.15,rough=.45)
GREEN_LIT=material('mat.green_patina',(37,72,54),metal=.25,rough=.37)
BLACK=material('mat.recess_black',(8,15,15),rough=.55)
GLASS=material('mat.glass_smoke_blue',(25,56,59),metal=.35,rough=.17)
BRASS=material('mat.brass',(213,165,86),metal=.78,rough=.25)
DARK_RED=material('mat.metal_oxblood',(109,20,20),metal=.42,rough=.35)
CRIMSON=material('mat.red_painted_edge',(204,35,27),metal=.32,rough=.27)
SIGN_WHITE=material('mat.marquee_cream_letters',(246,234,214),rough=.63,emissive=(.16,.14,.11),em_int=.36)
NEON_RED=material('mat.neon_red',(246,65,40),rough=.22,emissive=(1,.18,.08))
NEON_AMBER=material('mat.neon_amber',(255,174,66),rough=.2,emissive=(1,.57,.16))
NEON_BLUE=material('mat.neon_blue',(46,189,245),rough=.19,emissive=(.1,.65,1))
BULB_GLASS=material('mat.incandescent_glass',(255,218,154),rough=.19,emissive=(1,.68,.35))
BULB_OFF=material('mat.bulb_opaque_base',(91,62,44),metal=.3,rough=.4)
INTERIOR=material('mat.interior_warm',(101,65,35),rough=.9,emissive=(.16,.11,.055))
PAVEMENT=material('mat.pavement_polished',(56,62,58),metal=.25,rough=.28)
DARK_PANEL=material('mat.tower_black_panel',(10,9,9),metal=.2,rough=.4)  # RUNTIME DELTA
GROUT=material('mat.grout',(24,28,27),rough=.96)
ROOF=material('mat.roof_shadow',(32,29,28),rough=.98)
POSTER_RED=material('mat.poster_red',(126,37,35),rough=.54)


def add(name,mesh,mat=None,transform=None,meta=None):
 # Enable mesh-level unique name; reuse geometry by caching externally when desired.
 if mat is not None: mesh=mesh.copy();mesh.visual=TextureVisuals(material=mat)
 S.add_geometry(mesh,node_name=name,geom_name='geo.'+name,transform=transform)
 group=name.split('.')[0];COUNT[group]+=1
 if meta is not None:NODE_INFO[name]=meta
 return name

def box(name,center,size,mat):
 m=trimesh.creation.box(extents=size)
 T=np.eye(4);T[:3,3]=center
 return add(name,m,mat,T)

def rod(name,a,b,r,mat,sections=8):
 a=np.asarray(a,float);b=np.asarray(b,float);d=b-a
 if np.linalg.norm(d)<1e-7:return
 mesh=trimesh.creation.cylinder(radius=r,height=np.linalg.norm(d),sections=sections)
 T=trimesh.geometry.align_vectors([0,0,1],d)
 T[:3,3]=(a+b)/2
 return add(name,mesh,mat,T)

def tube(name,pts,r,mat,sections=7):
 # pipe merges segments as a single mesh, retaining section geometry and avoiding thousands of graph nodes
 meshes=[]
 for a,b in zip(pts[:-1],pts[1:]):
  a=np.asarray(a,float);b=np.asarray(b,float);d=b-a
  if np.linalg.norm(d)<1e-5:continue
  m=trimesh.creation.cylinder(radius=r,height=np.linalg.norm(d),sections=sections)
  T=trimesh.geometry.align_vectors([0,0,1],d);T[:3,3]=(a+b)/2;m.apply_transform(T);meshes.append(m)
 if meshes:add(name,trimesh.util.concatenate(meshes),mat)

def sphere(name,center,r,mat,res=1):
 m=trimesh.creation.icosphere(subdivisions=res,radius=r)
 t=np.eye(4);t[:3,3]=center
 add(name,m,mat,t)

def plane(name,pts,mat,uv=None):
 verts=np.asarray(pts,float)
 mesh=trimesh.Trimesh(vertices=verts,faces=[[0,1,2],[0,2,3]],process=False)
 if uv is None: mesh.visual=TextureVisuals(material=mat)
 else:mesh.visual=TextureVisuals(uv=np.asarray(uv,float),material=mat)
 S.add_geometry(mesh,node_name=name,geom_name='geo.'+name)
 COUNT[name.split('.')[0]]+=1
 return name

def prism_xz(name,poly,y0,y1,mat):
 # convex perimeter. winding on XZ, body from bottom to top
 n=len(poly);v=np.array([[x,y0,z] for x,z in poly]+[[x,y1,z] for x,z in poly],dtype=float)
 f=[]
 for i in range(1,n-1):f.extend([[0,i+1,i],[n,n+i,n+i+1]])
 for i in range(n): j=(i+1)%n;f.extend([[i,j,n+j],[i,n+j,n+i]])
 m=trimesh.Trimesh(vertices=v,faces=f,process=False);add(name,m,mat)

def quad_panel(name,p0,p1,y0,y1,mat,offset=0):
 p0=np.array(p0,float);p1=np.array(p1,float)
 dr=p1-p0; ln=np.linalg.norm(dr); outward=np.array([-dr[1],dr[0]])/ln
 p0+=offset*outward;p1+=offset*outward
 vertices=[[p0[0],y0,p0[1]],[p1[0],y0,p1[1]],[p1[0],y1,p1[1]],[p0[0],y1,p0[1]]]
 plane(name,vertices,mat,uv=[[0,0],[1,0],[1,1],[0,1]])
 return outward

def poster_image(path,seed):
 r=random.Random(seed);w,h=256,512;im=Image.new('RGB',(w,h),(r.randint(45,90),r.randint(23,45),r.randint(30,65)));d=ImageDraw.Draw(im)
 cols=[(r.randint(130,215),r.randint(60,160),r.randint(38,90)) for _ in range(5)]
 for j in range(7):
  x=r.randint(-30,200); y=r.randint(50,390);d.polygon([(x,y),(x+r.randint(25,75),y-40),(x+r.randint(42,110),y+130)],fill=cols[j%len(cols)])
 for i in range(12):
  xx=r.randint(18,230);yy=r.randint(0,470)
  d.line((xx,yy,xx+r.randint(-70,70),yy+70),fill=(230,153,76),width=r.randint(1,4))
 for i in range(3):d.rectangle((18,375+i*29,238,381+i*29),fill=(241,211,150))
 im.save(path)
 return im

def brick_texture():
 w,h=1536,1024;r=random.Random(916);im=Image.new('RGB',(w,h),(72,45,34));px=im.load();d=ImageDraw.Draw(im)
 by=32;bw=108
 for row,y in enumerate(range(-by,h+by,by)):
  dx=-bw//2 if row%2 else 0
  for x in range(dx-bw,w+bw,bw):
   c0=(r.randint(94,157),r.randint(51,83),r.randint(35,55));d.rectangle((x+2,y+3,x+bw-3,y+by-3),fill=c0)
   d.line([(x+4,y+4),(x+bw-5,y+4)],fill=(min(255,c0[0]+13),min(255,c0[1]+8),min(255,c0[2]+6)),width=2)
   for k in range(4):
    px0=x+r.randint(5,bw-10);py0=y+r.randint(5,by-6)
    if 0<px0<w and 0<py0<h:d.rectangle((px0,py0,px0+r.randint(1,6),py0+1),fill=tuple(max(0,int(v)-r.randint(4,12)) for v in c0))
 im=im.filter(ImageFilter.GaussianBlur(.28));im.save(OUT/'brick_bond_albedo.png');return im

def curtain_texture():
 w,h=1024,1024; ar=np.zeros((h,w,3),dtype=np.uint8)
 for x in range(w):
  g=(math.sin(x/20)+.47*math.sin(x/7.6+.2)+.32*math.sin(x/43+.9))*0.5
  for y in range(h):
   q=math.sin(y/84+x/60)*.02;v=max(0.28,min(1.08,.67+.24*g+q))
   ar[y,x]=[round(149*v),round(12+14*v),round(21+14*v)]
 im=Image.fromarray(ar);im.save(OUT/'velvet_curtain_albedo.png');return im

def label_texture(text,kind):
 w,h=(1536,420) if kind=='front' else (1280,420)
 im=Image.new('RGB',(w,h),(245,240,225));d=ImageDraw.Draw(im)
 for yy in range(0,h,65):d.line((0,yy,w,yy),fill=(214,211,204),width=2)
 font_candidates=['DejaVuSansCondensed-Bold.ttf','DejaVuSans-Bold.ttf',
                  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
                  '/Library/Fonts/Arial Bold.ttf',
                  'C:/Windows/Fonts/arialbd.ttf']
 def get_font(size):
  for candidate in font_candidates:
   try: return ImageFont.truetype(candidate,size)
   except (OSError,ValueError):pass
  return ImageFont.load_default(size=size)
 desired_size=240 if kind=='front' else 192
 f=get_font(desired_size)
 targetwidth=w*.87
 while d.textbbox((0,0),text,font=f)[2]>targetwidth and desired_size>30:
  desired_size-=4; f=get_font(desired_size)
 bbox=d.textbbox((0,0),text,font=f,stroke_width=3); tw=bbox[2]-bbox[0];th=bbox[3]-bbox[1]; tx=(w-tw)//2-bbox[0];ty=(h-th)//2-bbox[1]
 if kind=='front':
  d.text((tx+3,ty+4),text,font=f,fill=(29,10,10),stroke_width=8,stroke_fill=(38,12,12))
  d.text((tx,ty),text,font=f,fill=(151,20,17),stroke_width=3,stroke_fill=(65,11,9))
 else:d.text((tx,ty),text,font=f,fill=(19,32,25))
 im.save(OUT/f'marquee_{kind}_default_text.png');return im

brick_tex=brick_texture();cur_tex=curtain_texture()
M_BRICK=material('mat.brick_textured',(255,255,255),rough=.94,texture=brick_tex)
M_CURTAIN=material('mat.velvet_textured',(255,255,255),rough=.98,texture=cur_tex)

# ARCHITECTURE  -------------------------------------------------------
# Solid base back wall behind all window features.
box('facade.structural_wall',(0,5.05,-2.28),(26.5,10.1,.65),DARK_STONE)
# large brick facade panel front with physically separate horizontal stone belt courses
plane('facade.brick_wall_front',[[-12.8,.55,-1.94],[12.8,.55,-1.94],[12.8,9.75,-1.94],[-12.8,9.75,-1.94]],M_BRICK,[[0,0],[1,0],[1,1],[0,1]])
box('facade.lower_green_wainscot',(0,1.18,-1.82),(26.65,2.35,.35),DARK_GREEN)
for h,dep,height,mat in [(2.43,-1.67,.16,LIMESTONE),(2.69,-1.68,.12,DARK_GREEN),(8.55,-1.73,.16,LIMESTONE),(8.77,-1.78,.18,DARK_STONE),(9.52,-1.68,.22,STONE),(9.76,-1.8,.16,DARK_STONE),(10.05,-1.95,.17,LIMESTONE)]:
 box(f'facade.horizontal_cornice.{h:.2f}',(0,h,dep),(26.8,height,.38),mat)
# art deco pilasters and fluted vertical cap details
for side in (-1,1):
 x=side*12.2
 box(f'facade.pilaster.{side}.shaft',(x,5.67,-1.58),(1.06,8.84,.61),STONE)
 box(f'facade.pilaster.{side}.cap',(x,9.6,-1.32),(1.35,.64,.88),LIMESTONE)
 box(f'facade.pilaster.{side}.foot',(x,2.5,-1.48),(1.43,.38,.8),LIMESTONE)
 for i in range(3):
  xx=x+(i-1)*.19
  tube(f'facade.pilaster.{side}.fluting.{i}',[(xx,8.85,-1.22),(xx,9.35,-1.22)],.013,BRASS)
 # engraved art deco leaf relief
 for k in range(4):
  cy=7.35+k*.4
  rod(f'facade.pilaster.{side}.leafstem.{k}',(x,cy-.22,-1.233),(x,cy+.20,-1.233),.008,DARK_STONE)
  for sg in (-1,1):rod(f'facade.pilaster.{side}.leaf.{k}.{sg}',(x,cy-.03,-1.228),(x+sg*.16,cy+.10,-1.228),.007,DARK_STONE)
# Art deco parapet stepped central blocks
for x,w,h in [(-4.5,1.0,10.55),(-2.8,2.15,11.1),(0,3.4,11.45),(2.8,2.15,11.1),(4.5,1.0,10.55)]:
 box(f'roof.parapet.block.{x}',(x,(9.98+h)/2,-2.23),(w,h-9.98,.7),STONE)
 for dx in (-w*.37,w*.37):
  if abs(dx)<.2:continue
  box(f'roof.parapet.inset.{x}.{dx}',(x+dx,(10.14+h)/2,-1.83),(.028,max(.08,h-10.14),.032),DARK_STONE)
# central vertical blue facade high accents
for xx in (-.46,-.15,.15,.46):
 box(f'roof.neon.center_support.{xx}',(xx,11.23,-1.69),(.20,2.9,.16),BRASS)  # RUNTIME DELTA: wider support
 if abs(xx)>.3: box(f'neon.roof.amber.{xx}',(xx,11.23,-1.56),(.11,2.9,.08),NEON_AMBER)  # RUNTIME DELTA: amber flanks
 else: box(f'neon.roof.blue.{xx}',(xx,11.23,-1.56),(.11,2.9,.08),NEON_BLUE)  # RUNTIME DELTA: thicker blue centre

# upper side recessed windows: 4 panes + mullions, visible warm lamp interior
for side in (-1,1):
 cx=side*9.4
 box(f'window.upper.{side}.recess',(cx,5.8,-1.80),(1.97,3.05,.08),BLACK)
 box(f'window.upper.{side}.interior',(cx,5.79,-1.75),(1.68,2.65,.03),INTERIOR)
 plane(f'window.upper.{side}.glazed',[[cx-.85,4.48,-1.67],[cx+.85,4.48,-1.67],[cx+.85,7.11,-1.67],[cx-.85,7.11,-1.67]],GLASS)
 for xx in (cx-.88,cx,cx+.88):box(f'window.upper.{side}.vertical.{xx}',(xx,5.79,-1.56),(.09,2.80,.13),DARK_GREEN)
 for yy in (4.42,5.76,7.14):box(f'window.upper.{side}.horizontal.{yy}',(cx,yy,-1.56),(1.88,.09,.13),DARK_GREEN)
 box(f'window.upper.{side}.stone.sill',(cx,4.26,-1.48),(2.27,.23,.42),LIMESTONE)
 box(f'window.upper.{side}.stone.header',(cx,7.37,-1.51),(2.15,.2,.38),LIMESTONE)
 sphere(f'window.upper.{side}.inside_lamp',(cx,5.17,-1.42),.12,BULB_GLASS)
# Lower storefront vitrine, recessed poster display in wall
for side in (-1,1):
 xa,xb=(-11.9,-7.02) if side==-1 else (7.02,11.9)
 box(f'entrance.storefront.{side}.back',((xa+xb)/2,1.31,-1.72),(xb-xa,2.15,.15),BLACK)
 box(f'entrance.storefront.{side}.lobby_glow',((xa+xb)/2,1.35,-1.62),(xb-xa-.22,1.85,.06),INTERIOR)
 for jj in range(4):
  px=xa+.60+jj*(xb-xa-1.2)/3
  im=poster_image(OUT/f'poster_{side}_{jj}.png',300+jj+side*17)
  mp=material(f'mat.poster.{side}.{jj}',(255,255,255),rough=.8,texture=im)
  plane(f'entrance.storefront.{side}.poster.{jj}',[[px-.31,.82,-1.40],[px+.31,.82,-1.40],[px+.31,1.98,-1.40],[px-.31,1.98,-1.40]],mp,[[0,0],[1,0],[1,1],[0,1]])
  box(f'entrance.storefront.{side}.poster_frame.{jj}',(px,1.4,-1.35),(.68,1.22,.025),BRASS)
  # foreground image visible in front of the frame
  plane(f'entrance.storefront.{side}.poster_foreground.{jj}',[[px-.30,.83,-1.318],[px+.30,.83,-1.318],[px+.30,1.97,-1.318],[px-.30,1.97,-1.318]],mp,[[0,0],[1,0],[1,1],[0,1]])
 for j in range(5):
  x=xa+j*(xb-xa)/4
  box(f'entrance.storefront.{side}.window_post.{j}',(x,1.35,-1.24),(.09,2.17,.3),DARK_GREEN)
 for yy in (.25,2.42):box(f'entrance.storefront.{side}.window_rail.{yy}',((xa+xb)/2,yy,-1.24),(xb-xa,.10,.3),GREEN_LIT)
 sphere(f'entrance.storefront.{side}.pendant',(side*9.5,2.1,-1.16),.105,BULB_GLASS)
# Central entrance: actual framed transparent/tinted door areas and glass recession
box('entrance.portal.architrave',(0,1.37,-1.62),(9.12,2.74,.46),DARK_GREEN)
box('entrance.portal.interior',(0,1.48,-1.33),(8.30,2.63,.04),BLACK)
for i in range(6):
 x=-3.55+i*1.42
 box(f'entrance.door.{i}.shadow',(x,1.43,-1.10),(1.28,2.43,.08),BLACK)
 box(f'entrance.door.{i}.glass',(x,1.46,-1.025),(1.10,2.22,.035),GLASS)
 for sx in (-.63,.63):box(f'entrance.door.{i}.jamb.{sx}',(x+sx,1.45,-.95),(.10,2.52,.18),DARK_GREEN)
 for yy in (.26,2.62):box(f'entrance.door.{i}.rail.{yy}',(x,yy,-.94),(1.38,.095,.18),DARK_GREEN)
 box(f'entrance.door.{i}.bottom_kick',(x,.39,-.875),(1.09,.25,.04),BRASS)
 box(f'entrance.door.{i}.pushbar',(x,1.36,-.82),(1.0,.055,.055),BRASS)
 rod(f'entrance.door.{i}.pull',(x+.43,1.19,-.76),(x+.43,1.63,-.76),.02,BRASS)
# LED array columns: 9 x 19 cells per side with brass sockets and emissive faces
for side in (-1,1):
 x0=side*4.82
 box(f'leds.{"left" if side==-1 else "right"}.housing',(x0,1.25,-.95),(1.24,2.55,.29),DARK_PANEL)  # RUNTIME DELTA: black housing
 for j in range(19):
  for i in range(9):
   x=x0+(i-4)*.115;y=.23+j*.115
   # richer gradient from lower cream through orange to red higher up
   if j<7: mm=BULB_GLASS
   elif j<12:mm=NEON_AMBER
   else:mm=NEON_RED
   sphere(f'leds.{"left" if side==-1 else "right"}.r{j:02d}.c{i:02d}',(x,y,-.72),.047,mm,0)  # RUNTIME DELTA: .036 -> .047
# curtain mesh real fold depth from variable z, wavy shader texture
nx=164; ny=30;cw=5.2
vv=[];uv=[];ff=[]
for iy in range(ny+1):
 y=6.0+iy/ny*3.7
 for ix in range(nx+1):
  x=-cw+ix/nx*(2*cw)
  zz=-1.18+.21*math.sin((x+cw)*math.pi*3.1)+.08*math.sin((x+cw)*math.pi*8.7)+.05*math.sin((y-6)*2.5+x*2.6)
  vv.append((x,y,zz));uv.append((ix/nx,iy/ny))
  if ix<nx and iy<ny:
   a=iy*(nx+1)+ix; b=a+1;c=a+(nx+1);d=c+1;ff.extend([[a,b,d],[a,d,c]])
curmesh=trimesh.Trimesh(vertices=vv,faces=ff,process=False)
curmesh.visual=TextureVisuals(uv=np.array(uv),material=M_CURTAIN)
S.add_geometry(curmesh,node_name='curtain.volumetric_pleated_fabric',geom_name='geo.curtain.volumetric_pleated_fabric');COUNT['curtain']+=1
box('curtain.header_red',(0,9.71,-1.07),(10.75,.17,.20),DARK_RED)
# scalloped valance
for i in range(22):
 x=-5.18+(i+.5)*10.36/22
 tube(f'curtain.valance.scallop.{i}',[(x-.235,9.65,-.94),(x-.16,9.57,-.94),(x,9.54,-.95),(x+.16,9.57,-.94),(x+.235,9.65,-.94)],.037,DARK_RED)

# CANOPY footprint and layered projection
shape=[(-7.60,-1.02),(7.60,-1.02),(7.60,0.70),(3.68,5.73),(-3.68,5.73),(-7.60,0.70)]
prism_xz('canopy.structural_projecting_shell',shape,3.17,3.53,DARK_RED)
prism_xz('canopy.recessed_underside',shape,3.13,3.17,LIMESTONE)
# underside dark channels/beams and pendant bulb fan rays, clear visible 3D rows
# front boundary max z as function of x
zedge=lambda x:5.63 if abs(x)<=3.62 else max(.70,5.63-(abs(x)-3.62)/(7.58-3.62)*(5.63-.70))
for ix in range(27):
 x=-7.06+ix*(14.12/26);ze=zedge(x)-.10
 tube(f'canopy.underside.brass_rib.{ix:02d}',[(x,3.095,-.86),(x,3.095,ze)],.034,BRASS)
 # long rows of real incandescent bulb fixtures beneath each rib
 qty=max(5,round((ze+.86)/.315))
 for j in range(qty):
  z=-.68+j/(qty-1)*(ze+.58)
  sphere(f'bulbs.canopy.row{ix:02d}.position{j:02d}',(x,3.005,z),.064,BULB_GLASS,0)
# canopy perimeter visible gold/metal trim
for h,r,ma,idx in [(3.10,.085,BRASS,'gold_lower'),(3.24,.074,NEON_AMBER,'amber_inner'),(3.47,.09,CRIMSON,'red_upper')]:
 tube(f'canopy.trim.{idx}',[(x,h,z) for x,z in shape[2:]+[shape[2]]],r,ma)
# narrow thin facade-side skirt prevents canopy appearing detached
box('canopy.rear_mounted_shadow',(0,3.35,-.95),(14.8,.45,.18),DARK_RED)

# MARQUEE three genuine angled volumes with independent UV sign planes
faces=[('left',(-7.48,.83),(-3.61,4.37)),('front',(-3.61,4.37),(3.61,4.37)),('right',(3.61,4.37),(7.48,.83))]
sign_meta={}
for kind,p0,p1 in faces:
 p0=np.array(p0,float);p1=np.array(p1,float);d=p1-p0;length=float(np.linalg.norm(d));t=d/length;n=np.array([-t[1],t[0]])
 def P(k,y,out):
  v=p0+(p1-p0)*k+n*out
  return (float(v[0]),float(y),float(v[1]))
 y0,y1=3.73,5.49
 # Sign housing stands off from red structure with true shell depth.
 quad_panel(f'marquee.{kind}.panel_body',p0,p1,y0,y1,DARK_RED,0.0)
 quad_panel(f'marquee.{kind}.cream_backboard',p0,p1,y0+.18,y1-.16,SIGN_WHITE,.16)
 tex=label_texture('DVYDRM' if kind=='front' else 'SHOWINGS',kind)
 tmat=material(f'mat.marquee_{kind}_default_text',(255,255,255),rough=.73,texture=tex)
 # Runtime should hide/replace this plane with dynamic canvas text. NOT baked into backboard.
 quad_panel(f'marquee.{kind}.TEXT_SURFACE',p0+(p1-p0)*.048,p1-(p1-p0)*.048,y0+.25,y1-.23,tmat,.192)
 sign_meta[kind]={'p0_xz':[float(v) for v in p0],'p1_xz':[float(v) for v in p1],'normal_xz':[float(v) for v in n],'text_surface':f'marquee.{kind}.TEXT_SURFACE','letterboard_y':[y0+.25,y1-.23],'text_offset':.192,'default_text':'DVYDRM' if kind=='front' else 'SHOWINGS','length_units':round(length,4)}
 # proper dimensional top/bottom rails, illuminated inner reveal, bulb sockets
 for h,tag in [(3.69,'bottom'),(5.52,'top')]:
  tube(f'marquee.{kind}.frame.{tag}.red', [P(0,h,.10),P(1,h,.10)],.109,CRIMSON)
  tube(f'marquee.{kind}.frame.{tag}.neon',[P(0,h+.11 if tag=='bottom' else h-.11,.20),P(1,h+.11 if tag=='bottom' else h-.11,.20)],.046,NEON_RED)
  tube(f'marquee.{kind}.frame.{tag}.brass',[P(0,h+(.20 if tag=='bottom' else -.20),.18),P(1,h+(.20 if tag=='bottom' else -.20),.18)],.035,BRASS)
  nbulbs=35 if kind=='front' else 25
  for i in range(nbulbs):
   k=.026+.948*i/(nbulbs-1)
   sphere(f'bulbs.marquee.{kind}.{tag}.{i:02d}',P(k,h,.245),.061,BULB_GLASS,0)
 for edge,pp in [('start',0),('end',1)]:
  tube(f'marquee.{kind}.frame.{edge}.red',[P(pp,3.65,.12),P(pp,5.57,.12)],.105,CRIMSON)
  for i in range(10):sphere(f'bulbs.marquee.{kind}.{edge}.{i:02d}',P(pp,3.82+i*.16,.255),.06,BULB_GLASS,0)
 # layered upper neon (raised scrolled edge) traced around wing top
 tube(f'neon.marquee.{kind}.raised_outline',[P(0,5.52,-.23),P(.13,5.77,-.18),P(.88,5.77,-.18),P(1,5.52,-.23)],.053,NEON_RED)
 # dimensional raised trim plate along front above illuminated sign
 for zoff,h,ma,label in [(-.20,5.68,CRIMSON,'metal'),(-.17,5.73,NEON_AMBER,'gold_neon')]:
  tube(f'marquee.{kind}.step_trim.{label}',[P(.04,h,zoff),P(.96,h,zoff)],.065,ma)
# geometric steel canopy interior support coffer detail
for i in range(13):
 x=-3.25+i*6.50/12
 box(f'canopy.coffer.endtrim.{i}',(x,3.11,5.37),(.04,.07,.4),BRASS)

# NEON ARCHITECTURAL CROWN in front of curtain but behind signs.
# Rounded ascending Deco portals with thickness; tubes follow genuinely curved corners, not flat rectangles.
for k,(halfwidth,height) in enumerate([(3.55,6.35),(2.94,6.79),(2.36,7.20),(1.77,7.64),(1.14,8.02),(.61,8.37)]):
 z=-.66+k*.18
 # upward stems and rounded shoulders
 def arc_crown(w,hy,z):
  p=[(-w,5.76,z),(-w,hy-.32,z)]
  for q in range(1,7):
   th=math.pi-q/6*math.pi/2
   p.append((-w+.32+.32*math.cos(th),hy-.32+.32*math.sin(th),z))
  p.append((w-.32,hy,z))
  for q in range(1,7):
   th=math.pi/2-q/6*math.pi/2
   p.append((w-.32+.32*math.cos(th),hy-.32+.32*math.sin(th),z))
  p.append((w,5.76,z));return p
 pts=arc_crown(halfwidth,height,z)
 tube(f'crown.layer.{k}.rounded_metal',pts,.235,STONE,12)  # RUNTIME DELTA: .160 -> .235
 tube(f'crown.layer.{k}.neon',[(x,y,z+.14) for x,y,z in pts],.118,NEON_RED if k%2==0 else NEON_AMBER,10)  # RUNTIME DELTA: thicker, proud of the metal
# central blue raised fluted crown columns
for i,xx in enumerate((-.33,-.11,.11,.33)):
 ht=8.83 if i in (1,2) else 8.57
 box(f'crown.center_column.{i}',(xx,(5.77+ht)/2,.57),(.215,ht-5.77,.30),STONE)  # RUNTIME DELTA: wider
 box(f'neon.crown.blue.{i}',(xx,(5.81+ht)/2,.77),(.15,ht-5.81,.11),NEON_BLUE)  # RUNTIME DELTA: fat fluted fin, not a hairline
# RUNTIME DELTA: amber and red fins stepping down either side of the blue ones, as on the reference crown.
for i,(xx,ht,mm,label) in enumerate([(-.58,8.12,NEON_AMBER,'amber'),(.58,8.12,NEON_AMBER,'amber'),(-.84,7.50,NEON_RED,'red'),(.84,7.50,NEON_RED,'red')]):
 box(f'crown.side_column.{i}',(xx,(5.77+ht)/2,.55),(.22,ht-5.77,.28),STONE)
 box(f'neon.crown.{label}.fin.{i}',(xx,(5.81+ht)/2,.75),(.13,ht-5.81,.10),mm)
# amber arcs outside center blue spine, dimensional shoulders
for s in (-1,1):
 pts=[(s*.50,5.78,.60),(s*.50,7.54,.60),(s*.58,7.70,.60),(s*.87,7.72,.60),(s*.95,7.60,.60),(s*.95,5.78,.60)]
 tube(f'crown.blue_side_arch.{s}',pts,.08,NEON_AMBER)

# TOWERS: rounded top rim with large bulb lenses, two-sided border arrays
for side in (-1,1):
 x=side*6.35;z=-.53;lo,hi=5.66,11.45;w=.86;r=.43
 box(f'tower.{side}.housing',(x,(lo+hi-r)/2,z),(.99,hi-lo-r,.69),DARK_RED)
 # outer semicircular cap
 arc=[(x-w/2,hi-r,z)]
 for i in range(21):
  a=math.pi-i/20*math.pi
  arc.append((x+(w/2)*math.cos(a),hi-r+(w/2)*math.sin(a),z))
 arc.append((x+w/2,lo,z))
 tube(f'tower.{side}.round_cap_and_outline',[(x-w/2,lo,z)]+arc,.135,BRASS,9)
 # interior gold panel and bulb cover at front
 box(f'tower.{side}.inset',(x,8.43,-.15),(.62,5.11,.13),DARK_PANEL)  # RUNTIME DELTA: black panel behind the lenses
 for j in range(8):
  yy=6.13+j*.665
  sphere(f'bulbs.tower.{side}.lens.{j:02d}',(x,yy,.04),.245,BULB_GLASS,2)  # RUNTIME DELTA: .23 -> .245
  sphere(f'tower.{side}.fixture.rim.{j:02d}',(x,yy,-.02),.278,BRASS,1)
  sphere(f'bulbs.tower.{side}.glass.{j:02d}',(x,yy,.25),.205,BULB_GLASS,1)
 # side border bulbs - small lens arrays
 for edge in (-1,1):
  for j in range(34):
   yy=5.78+j*.151
   sphere(f'bulbs.tower.{side}.border.{edge}.{j:02d}',(x+edge*.48,yy,.10),.053,BULB_GLASS,0)
 for i in range(13):
  ang=math.pi-i/12*math.pi
  sphere(f'bulbs.tower.{side}.arch.{i:02d}',(x+(.48)*math.cos(ang),hi-.44+(.49)*math.sin(ang),.12),.05,BULB_GLASS,0)

# Forecourt slab / curb / realistic inset pavement bands and distant reflective roadway
# RUNTIME DELTA: one continuous polished slab under the whole street view. The V2 curb and lowered road sat at different heights from the slab,
# which the single-plane screen-space floor reflection cannot represent (it tore along their edges).
box('ground.pavement_slab',(0,-.12,11.2),(64,.19,26),PAVEMENT)
for i in range(0):  # RUNTIME DELTA: paving-joint rods omitted (they z-fight the slab and tear the floor reflection)
 x=-13.3+i*.78;rod(f'ground.paving_joint.x{i:02d}',(x,-.015,-1.7),(x,-.015,8.14),.009,GROUT)
for i in range(0):  # RUNTIME DELTA: paving-joint rods omitted
 zz=-1.7+i*.85;rod(f'ground.paving_joint.z{i:02d}',(-13.4,-.014,zz),(13.4,-.014,zz),.009,GROUT)
# emphasize reflection strips as subtle mesh strips under facade (do not fake with full image)
# RUNTIME DELTA: the V2 'reflection_receiving_lane' slabs are omitted; the runtime floor reflection supplies the wet-street read.

# One main scene camera and named calibration records, camera proof after exporting.
CAMERA={
 'front_hero':{'eye':[0,1.60,19.0],'target':[0,5.15,.30],'fov_y_degrees':42,'notes':'Slightly low to expose underside; centered symmetric hero'},
 'left_three_quarter':{'eye':[-8.0,2.65,24.6],'target':[0,5.4,.45],'fov_y_degrees':38},
 'right_three_quarter':{'eye':[8.0,2.65,24.6],'target':[0,5.4,.45],'fov_y_degrees':38},
 'marquee_closeup':{'eye':[0,3.00,15.8],'target':[0,5.40,1.18],'fov_y_degrees':40},
 'low_canopy':{'eye':[.2,1.15,16.4],'target':[0,4.43,2.18],'fov_y_degrees':45}
}
S.camera.resolution=(1920,1080);S.camera.fov=(59.4,35)
# Trimesh default: camera looks down -Z, up Y
front=CAMERA['front_hero'];T=trimesh.scene.cameras.look_at(np.asarray([[-13,.0,-2],[13,11.5,5]]),distance=27,fov=(59.4,35))
# Explicit camera position rotation via camera z to eye-target
v=np.array(front['eye']);t=np.array(front['target']);back=(v-t)/np.linalg.norm(v-t);right=np.cross([0,1,0],back);right/=np.linalg.norm(right);up=np.cross(back,right)
T[:3,0]=right;T[:3,1]=up;T[:3,2]=back;T[:3,3]=v
S.camera_transform=T

# Export and audit
filename=OUT/'DVYDRM_Marquee_HighFidelity_v2.glb'
filename.write_bytes(S.export(file_type='glb'))
# a second glTF compatible package with separate buffer/textures; GLB is preferred runtime artifact
# Geometry stats counted from constructed source; tests also re-read GLB below.
G=trimesh.load(filename,force='scene')
fixture_groups={}
for n in G.graph.nodes:
 if n.startswith('bulbs.') or n.startswith('leds.'):
  parts=n.split('.'); group='.'.join(parts[:3]) if n.startswith('bulbs.marquee') else '.'.join(parts[:2]);fixture_groups[group]=fixture_groups.get(group,0)+1
report={
 'schema':'cinema2.marquee.reconstruction.v2','file':filename.name,
 'source':'manually authored procedural reconstruction from cleaned DVYDRM 4:3 reference; not a surveyed/photogrammetry replica',
 'coordinate_system':{'x':'right','y':'up','z':'toward street/audience','units':'artistic scene units','facade_plane_z':-1.94},
 'geometry':{'node_count':len(G.graph.nodes),'mesh_count':len(G.geometry),'world_bounds_xyz':G.bounds.tolist(),'mesh_triangles':int(sum(len(g.faces) for g in G.geometry.values())),'fixture_count':sum(1 for x in G.graph.nodes if x.startswith(('bulbs.','leds.'))),'group_counts':dict(COUNT)},
 'runtime_signage':sign_meta,
 'fixtures':fixture_groups,
 'camera_presets':CAMERA,
 'material_names':list(mat_cache),
 'asset_authority':{'reference_image':'art_deco_theater_marquee_at_night.png','replacement_model':filename.name,'prior_model':'DVYDRM_Cinema2_Theater.glb (superseded blockout)'},
 'validation':{'automated':'GLB parses, bounds and node identities auditable','manual_pending':'Final photoreal reference parity and engine rendering require review'},
 'notes':['Text surfaces currently contain *separate removable default text textures*; for runtime, replace textures independently without modifying geometry.', 'Bulb nodes are independently named, but production renderer should batch or instance their shared shapes.', 'Materials contain restrained emission factors; bloom should be set by Cinema 2.0 postprocess instead of baking overexposure.', 'Wings, canopy and crown contain physically separate extruded/rounded 3D geometry, not a photograph projected onto a plane.']
}
(OUT/'Marquee_Geometry_Manifest_v2.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'path':str(filename),'bytes':filename.stat().st_size,'nodes':len(G.graph.nodes),'meshes':len(G.geometry),'triangles':report['geometry']['mesh_triangles'],'fixtures':report['geometry']['fixture_count'],'bounds':G.bounds.tolist()},indent=2))
