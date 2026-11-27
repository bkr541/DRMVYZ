#!/usr/bin/env python3
"""Run in Blender 4.x: blender --background --python Build_Marquee_v2_in_Blender.py -- --render
Imports v2 GLB, exposes genuine editable Blender FONT objects, five cameras, studio-night rig;
saves `DVYDRM_Marquee_HighFidelity_v2_EDITABLE.blend` alongside assets.
This Blender script is syntax-checked externally but must be executed in Blender by the user.
"""
import bpy, json,math,sys
from pathlib import Path
from mathutils import Vector, Matrix
P=Path(__file__).resolve().parent.parent
GLB=P/'assets/DVYDRM_Marquee_HighFidelity_v2.glb'
manifest=json.loads((P/'assets/Marquee_Geometry_Manifest_v2.json').read_text())
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if not GLB.exists():raise FileNotFoundError(GLB)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(GLB))
scene=bpy.context.scene
scene.render.engine='CYCLES' if '--cycles' in args else 'CYCLES'  # reliable PBR, native physically lit preview
scene.cycles.samples=48
scene.render.resolution_x=1920;scene.render.resolution_y=1080;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='AgX'
scene.view_settings.look='Medium High Contrast'
scene.render.film_transparent=False
# Categorize imported geometry without altering their parent transforms.
root_col=bpy.data.collections.new('MARQUEE V2 | Source GLB');scene.collection.children.link(root_col)
for ob in list(scene.objects):
 if ob.type not in {'MESH','EMPTY'}:continue
 key=ob.name.split('.')[0].upper()
 colname={'BULBS':'01 | INDIVIDUAL BULBS','LEDS':'02 | LED COLUMNS','MARQUEE':'03 | MARQUEE / THREE SIDES','CANOPY':'04 | UNDERSIDE AND PROJECTION','CROWN':'05 | DECO CROWN','TOWER':'06 | BULB TOWERS','FACADE':'07 | FACADE','CURTAIN':'08 | CURTAIN','ENTRANCE':'09 | ENTRANCE','NEON':'10 | NEON','GROUND':'11 | FORECOURT','WINDOW':'12 | WINDOWS','ROOF':'13 | ROOFLINE'}.get(key,'14 | OTHER')
 target=bpy.data.collections.get(colname)
 if not target:target=bpy.data.collections.new(colname);root_col.children.link(target)
 if ob.name not in target.objects:target.objects.link(ob)
 for old in tuple(ob.users_collection):
  if old!=target:old.objects.unlink(ob)
# Make the original named text panels *blank*, retain material slot and mesh identity.
blank=bpy.data.materials.new('C2_MARQUEE_BLANK_SIGN_BOARD');blank.diffuse_color=(.88,.83,.73,1)
blank.use_nodes=True
bsdf=blank.node_tree.nodes.get('Principled BSDF')
if bsdf:
 bsdf.inputs['Base Color'].default_value=(.91,.87,.77,1)
 bsdf.inputs['Roughness'].default_value=.65
textcol=bpy.data.collections.new('15 | EDITABLE BLENDER FONT');root_col.children.link(textcol)
for face,m in manifest['runtime_signage'].items():
 target=next((o for o in bpy.data.objects if o.name==m['text_surface'] or o.name.startswith(m['text_surface']+'.')),None)
 if target:
  target.data.materials.clear();target.data.materials.append(blank)
 # Surface world coords from authored glTF. Blender importer rotates glTF Y-up to Blender Z-up.
 a=Vector((m['p0_xz'][0],-m['p0_xz'][1],0));b=Vector((m['p1_xz'][0],-m['p1_xz'][1],0))
 right=(b-a).normalized();up=Vector((0,0,1));normal=right.cross(up).normalized()
 centre=(a+b)*.5 +normal*.235 + Vector((0,0,(m['letterboard_y'][0]+m['letterboard_y'][1])*.5))
 # Native curve font is editable in Blender. Cinema 2.0 runtime must still replace text texture.
 cu=bpy.data.curves.new('MARQUEE_FONT_'+face,'FONT');cu.body=m['default_text'];cu.align_x='CENTER';cu.align_y='CENTER';cu.size=1.03 if face=='front' else .83;cu.extrude=.008;cu.bevel_depth=.001;cu.bevel_resolution=1
 o=bpy.data.objects.new('C2_TEXT_'+face.upper()+'_EDITABLE',cu);textcol.objects.link(o)
 mat=bpy.data.materials.new('C2_FONT_'+face);mat.diffuse_color=(.42,.027,.02,1) if face=='front' else (.025,.04,.028,1);mat.use_nodes=True
 principled=mat.node_tree.nodes.get('Principled BSDF')
 if principled:principled.inputs['Base Color'].default_value=mat.diffuse_color
 cu.materials.append(mat)
 o.matrix_world=Matrix(((right.x,up.x,normal.x,centre.x),(right.y,up.y,normal.y,centre.y),(right.z,up.z,normal.z,centre.z),(0,0,0,1)))
 o['marquee_text_face']=face;o['cinema2_runtime_surface']=m['text_surface']
# Camera rig
camcol=bpy.data.collections.new('16 | VALIDATION CAMERAS');root_col.children.link(camcol)
scene.render.resolution_x=1920;scene.render.resolution_y=1080
for key,cfg in manifest['camera_presets'].items():
 ob=bpy.data.objects.new('C2_CAMERA_'+key,bpy.data.cameras.new('C2_CAMERA_'+key));camcol.objects.link(ob)
 eye=Vector((cfg['eye'][0],-cfg['eye'][2],cfg['eye'][1]));target=Vector((cfg['target'][0],-cfg['target'][2],cfg['target'][1])); direction=(target-eye).normalized()
 ob.location=eye;ob.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
 fovy=math.radians(cfg['fov_y_degrees']);fovx=2*math.atan(math.tan(fovy/2)*(16/9));ob.data.angle=fovx;ob.data.clip_start=.05;ob.data.clip_end=300
 if key=='front_hero':scene.camera=ob
# Lighting for Blender preview, not audio reactive: runtime controls belong in Cinema 2.0.
lightcol=bpy.data.collections.new('17 | PREVIEW LIGHTING ONLY');root_col.children.link(lightcol)
def area(name,xyz,at,power,color,size):
 l=bpy.data.lights.new(name,'AREA');l.energy=power;l.color=color;l.shape='DISK';l.size=size
 ob=bpy.data.objects.new(name,l);lightcol.objects.link(ob)
 ob.location=Vector((xyz[0],-xyz[2],xyz[1]));point=Vector((at[0],-at[2],at[1]));ob.rotation_euler=(point-ob.location).to_track_quat('-Z','Y').to_euler()
area('MARQUEE_key_warm',(0,11,12),(0,4,-1),2500,(1,.84,.63),11)
area('MARQUEE_left_warm',(-13,8,7),(-3,5,0),1100,(1,.43,.27),7)
area('MARQUEE_right_cool',(13,10,8),(4,5,0),950,(.44,.71,1),8)
area('MARQUEE_lobby_fill',(0,2.5,2),(0,1.3,-1),600,(1,.85,.69),8)
world=bpy.data.worlds.new('Marquee Night World');scene.world=world;world.use_nodes=True
back=world.node_tree.nodes.get('Background');back.inputs['Color'].default_value=(.007,.015,.011,1);back.inputs['Strength'].default_value=.38
path=P/'assets/DVYDRM_Marquee_HighFidelity_v2_EDITABLE.blend'
scene.render.filepath=str(P/'previews/Marquee_v2_Blender_hero.png')
bpy.ops.wm.save_as_mainfile(filepath=str(path))
if '--render' in args:bpy.ops.render.render(write_still=True)
print('Saved',path)
