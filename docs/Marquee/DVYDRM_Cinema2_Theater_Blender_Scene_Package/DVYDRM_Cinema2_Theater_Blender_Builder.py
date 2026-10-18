"""DVYDRM CINEMA 2.0 THEATER | EDITABLE BLENDER SCENE BUILDER

Source: previous geometry blueprint / GLB theater model.
Target: Blender 3.6 LTS and Blender 4.x; should also work with newer versions.

USAGE, run with Blender (not normal Python):
    blender --background --python DVYDRM_Cinema2_Theater_Blender_Builder.py \
        -- --output DVYDRM_Cinema2_Theater_EDITABLE.blend

Optional still render:
    blender --background --python DVYDRM_Cinema2_Theater_Blender_Builder.py \
        -- --output DVYDRM_Cinema2_Theater_EDITABLE.blend --render

In Blender GUI: Scripting > Open script > Run Script. Requires the accompanying
DVYDRM_Cinema2_Theater.glb next to this .py file. Saves a real .blend file.

What you get:
- Full existing 3D architecture (not image planes), including >1,000 light meshes
- Grouped collections with stable per-fixture object names
- THREE actual Blender FONT objects above distinct ivory marquee backgrounds
- 8 independent light-intensity controls using driver-linked materials
- Three native camera setups plus close-up and side cameras
- World/fill lighting, filmic-looking emission + optional compositor glow
- Timeline markers and very simple kick/build/drop lighting illustration
- Blender .blend output; no reliance on texture assets after import (pack all)

Coordinates: glTF source X-right, Y-up, Z-front. Blender importer converts to
Z-up with the facade facing toward -Y. This script derives sign orientation
from imported mesh corners rather than guessing side sign rotations.

Authored as Blender Python. Cinema 2.0 audio intelligence is NOT embedded here:
material groups / names are prepared to be controlled by the host preset.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
from pathlib import Path

try:
    import bpy
    from mathutils import Matrix, Vector
except ImportError as exc:
    raise SystemExit(
        "This script must run INSIDE Blender. Use: blender --background --python "
        "DVYDRM_Cinema2_Theater_Blender_Builder.py"
    ) from exc


SCENE_NAME = "DVYDRM | CINEMA 2.0 THEATER"
FACE_TEXT = {
    "front": ("DVYDRM", (0.96, 0.12, 0.06, 1.0)),
    "left": ("SHOWINGS", (0.018, 0.023, 0.017, 1.0)),
    "right": ("SHOWINGS", (0.018, 0.023, 0.017, 1.0)),
}
CONTROLS = {
    "C2_MASTER": 1.0,
    "C2_CANOPY": 1.0,
    "C2_MARQUEE_BULBS": 1.0,
    "C2_TOWER_BULBS": 1.0,
    "C2_LED_LEFT": 1.0,
    "C2_LED_RIGHT": 1.0,
    "C2_NEON_RED": 1.0,
    "C2_NEON_BLUE": 1.0,
    "C2_NEON_AMBER": 1.0,
}
DEFAULT_STRENGTH = {
    "C2_CANOPY": 3.9,
    "C2_MARQUEE_BULBS": 3.9,
    "C2_TOWER_BULBS": 4.0,
    "C2_LED_LEFT": 2.8,
    "C2_LED_RIGHT": 2.8,
    "C2_NEON_RED": 3.6,
    "C2_NEON_BLUE": 4.3,
    "C2_NEON_AMBER": 3.2,
}


def parse_args():
    cli = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description="Generate an editable DVYDRM Blender theater .blend")
    parser.add_argument("--source", help="Path to source glb (defaults to sibling file)")
    parser.add_argument("--output", help="Output .blend path (defaults to script folder)")
    parser.add_argument("--render", action="store_true", help="Render PNG preview after saving")
    parser.add_argument("--samples", type=int, default=32, help="Eevee sample count when supported")
    parser.add_argument("--engine", choices=["eevee", "cycles"], default="eevee")
    return parser.parse_args(cli)


def source_directory():
    if "__file__" in globals():
        return Path(__file__).resolve().parent
    return Path(bpy.path.abspath("//")).resolve()


def collection(name, parent):
    child = bpy.data.collections.new(name)
    parent.children.link(child)
    return child


def move_to_collection(obj, dest):
    if obj not in dest.objects:
        dest.objects.link(obj)
    for old in list(obj.users_collection):
        if old != dest:
            old.objects.unlink(obj)


def initialize_collections():
    root = collection(SCENE_NAME, bpy.context.scene.collection)
    architecture = collection("01 | ARCHITECTURE", root)
    marquee = collection("02 | THREE-SIDED MARQUEE", root)
    lighting = collection("03 | FIXTURE ARRAYS", root)
    neon = collection("04 | NEON TUBES", root)
    letterforms = collection("05 | LIVE BLENDER TEXT", root)
    camera_col = collection("06 | CAMERAS", root)
    stage = collection("07 | WORLD + LIGHT RIG", root)
    helper = collection("08 | OTHER SOURCE OBJECTS", root)
    groups = {
        "root": root,
        "arch": architecture,
        "arch_facade": collection("Facade + windows", architecture),
        "arch_entrance": collection("Doors + lobby", architecture),
        "arch_curtain": collection("Curtain", architecture),
        "arch_roof": collection("Roof + finials", architecture),
        "arch_pavement": collection("Ground + curb", architecture),
        "marquee": marquee,
        "marquee_front": collection("FRONT sign", marquee),
        "marquee_left": collection("LEFT sign", marquee),
        "marquee_right": collection("RIGHT sign", marquee),
        "marquee_canopy": collection("Canopy + underside", marquee),
        "lighting": lighting,
        "lights_marquee": collection("Marquee · addressable bulbs", lighting),
        "lights_canopy": collection("Canopy · addressable bulbs", lighting),
        "lights_tower": collection("Tower · addressable bulbs", lighting),
        "leds_left": collection("Entrance LED column LEFT", lighting),
        "leds_right": collection("Entrance LED column RIGHT", lighting),
        "neon": neon,
        "txt": letterforms,
        "cams": camera_col,
        "stage": stage,
        "others": helper,
    }
    return groups


def route_imported_objects(groups):
    """Only move objects; parent transforms and stable names are unchanged."""
    imported = list(bpy.context.scene.objects)
    for obj in imported:
        n = obj.name.lower()
        if obj.type == 'CAMERA':
            key = "cams"
        elif obj.type == 'LIGHT':
            key = "stage"
        elif n.startswith("bulbs.canopy"):
            key = "lights_canopy"
        elif n.startswith("bulbs.marquee"):
            key = "lights_marquee"
        elif n.startswith("bulbs.tower"):
            key = "lights_tower"
        elif n.startswith("leds.left"):
            key = "leds_left"
        elif n.startswith("leds.right"):
            key = "leds_right"
        elif n.startswith(("neon.", "roof_neon", "roof.neon")):
            key = "neon"
        elif n.startswith("marquee.front"):
            key = "marquee_front"
        elif n.startswith("marquee.left"):
            key = "marquee_left"
        elif n.startswith("marquee.right"):
            key = "marquee_right"
        elif n.startswith("canopy."):
            key = "marquee_canopy"
        elif n.startswith(("facade", "window.", "tower.")):
            key = "arch_facade"
        elif n.startswith("entrance."):
            key = "arch_entrance"
        elif n.startswith("curtain."):
            key = "arch_curtain"
        elif n.startswith("roof."):
            key = "arch_roof"
        elif n.startswith("pavement."):
            key = "arch_pavement"
        elif n == "dvydrm_theater_root":
            key = "others"
        else:
            key = "others"
        move_to_collection(obj, groups[key])
        obj["Cinema2_Source_Identifier"] = obj.name
    return imported


def make_material(name, rgba, metal=0.0, rough=0.32, emission=0.0):
    m = bpy.data.materials.new(name=name)
    m.use_nodes = True
    nodes = m.node_tree.nodes
    bsdf = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf:
        inp = bsdf.inputs.get('Base Color')
        if inp: inp.default_value = rgba
        inp = bsdf.inputs.get('Metallic')
        if inp: inp.default_value = metal
        inp = bsdf.inputs.get('Roughness')
        if inp: inp.default_value = rough
        inp = bsdf.inputs.get('Emission Color') or bsdf.inputs.get('Emission')
        if inp: inp.default_value = rgba
        inp = bsdf.inputs.get('Emission Strength')
        if inp: inp.default_value = emission
    m.diffuse_color = rgba
    return m


def make_blender_sign(face, source_obj, group):
    """Build genuine editable Blender FONT object, accurately aligned to angled face."""
    bpy.context.view_layer.update()
    world_pts = [source_obj.matrix_world @ v.co for v in source_obj.data.vertices]
    if len(world_pts) < 4:
        raise RuntimeError(f"{face}: panel needs >=4 corners; got {len(world_pts)}")
    pts = sorted(world_pts, key=lambda p: p.z)
    bottom = sorted(pts[:2], key=lambda p: p.x)
    top = sorted(pts[-2:], key=lambda p: p.x)
    left_bottom, right_bottom = bottom[0], bottom[1]
    left_top, right_top = top[0], top[1]

    horiz = (right_bottom - left_bottom)
    vertical = ((left_top + right_top) * 0.5 - (left_bottom + right_bottom) * 0.5)
    sign_width = horiz.length
    sign_height = vertical.length
    right = horiz.normalized()
    up = (vertical - right * vertical.dot(right)).normalized()
    outward = right.cross(up).normalized()
    midpoint = sum(world_pts, Vector((0, 0, 0))) / len(world_pts)

    # A +18mm camera-facing offset keeps the native type just outside the panel.
    pose = Matrix(((right.x, up.x, outward.x),
                   (right.y, up.y, outward.y),
                   (right.z, up.z, outward.z)))
    string, color = FACE_TEXT[face]

    # Remove the baked text image from the old GLB panel: it becomes an illuminated
    # blank letterboard backing.  Preserve node name / mesh / UVs for runtime.
    old = source_obj.data
    if old.users > 1:
        source_obj.data = old.copy()
    blank = make_material(f"C2 | {face.upper()} ivory illuminated blank", (0.93, 0.885, 0.76, 1), rough=0.48, emission=0.21)
    source_obj.data.materials.clear()
    source_obj.data.materials.append(blank)
    source_obj["C2_ROLE"] = "RUNTIME_TEXT_TEXTURE_TARGET"
    source_obj["C2_FACE"] = face
    source_obj["C2_DEFAULT_TEXT"] = string
    source_obj["C2_SUGGESTED_TEXTURE_RES"] = "2048x440"

    curve = bpy.data.curves.new(name=f"C2 · {face.upper()} editable lettering", type='FONT')
    curve.body = string
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.size = 0.9
    curve.extrude = 0.003
    curve.bevel_depth = 0.001
    curve.bevel_resolution = 1
    obj = bpy.data.objects.new(f"C2_TEXT_{face.upper()}_EDITABLE", curve)
    group.objects.link(obj)
    obj.location = midpoint + outward * 0.021
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = pose.to_quaternion()
    obj.data.materials.append(make_material(f"C2 | {face.upper()} lettering", color, rough=0.34, emission=0.08 if face == 'front' else 0.0))
    obj["C2_ROLE"] = "EDITABLE_BLENDER_FONT"
    obj["C2_RUNTIME_ID"] = f"marquee.{face}.TEXT_SURFACE"
    obj["C2_README"] = "Edit Object Data Properties > Text > Body or Tab into Edit Mode"
    obj["C2_SIGN_WIDTH"] = round(sign_width, 5)
    obj["C2_SIGN_HEIGHT"] = round(sign_height, 5)

    # Scale to use most of each letterboard. Nonuniform x compression is deliberate
    # to preserve traditional narrow theater typography on side faces.
    bpy.context.view_layer.update()
    if obj.dimensions.y > 1e-6:
        curve.size *= (sign_height * 0.76) / obj.dimensions.y
    bpy.context.view_layer.update()
    if obj.dimensions.x > sign_width * 0.91:
        obj.scale.x = (sign_width * 0.91) / obj.dimensions.x
    return {
        "face": face,
        "source_mesh": source_obj.name,
        "blender_text": obj.name,
        "default": string,
        "width_blender_units": round(sign_width, 5),
        "height_blender_units": round(sign_height, 5),
        "outward_normal": [round(i, 5) for i in outward],
    }


def find_sign_mesh(face):
    expected = f"marquee.{face}.TEXT_SURFACE"
    matches = [o for o in bpy.context.scene.objects
               if o.type == 'MESH' and (o.name == expected or o.name.startswith(expected + '.'))]
    if len(matches) != 1:
        raise RuntimeError(f"Expected exactly one mesh '{expected}', found {len(matches)}")
    return matches[0]


def which_emissive_control(name):
    n = name.lower()
    if n.startswith("bulbs.canopy."):
        return "C2_CANOPY"
    if n.startswith("bulbs.marquee."):
        return "C2_MARQUEE_BULBS"
    if n.startswith("bulbs.tower."):
        return "C2_TOWER_BULBS"
    if n.startswith("leds.left."):
        return "C2_LED_LEFT"
    if n.startswith("leds.right."):
        return "C2_LED_RIGHT"
    if n.startswith("neon.red") or n.startswith("roof_neon.red") or n.startswith("roof.neon.red"):
        return "C2_NEON_RED"
    if n.startswith("neon.blue") or n.startswith("roof_neon.blue") or n.startswith("roof.neon.blue"):
        return "C2_NEON_BLUE"
    if n.startswith("neon.amber") or n.startswith("roof_neon.amber") or n.startswith("roof.neon.amber"):
        return "C2_NEON_AMBER"
    # architectural glTF neon may be broken down by shape, not parent name:
    if "neon" in n and "red" in n: return "C2_NEON_RED"
    if "neon" in n and "blue" in n: return "C2_NEON_BLUE"
    if "neon" in n and "amber" in n: return "C2_NEON_AMBER"
    return None


def driven_emission(mat, scene, control, multiplier):
    """Preserve GLB emission color and PBR inputs, but expose strength control."""
    mat.use_nodes = True
    count = 0
    for node in mat.node_tree.nodes:
        if node.type == 'BSDF_PRINCIPLED':
            slot = node.inputs.get('Emission Strength')
        elif node.type == 'EMISSION':
            slot = node.inputs.get('Strength')
        else:
            continue
        if slot is None:
            continue
        # Node input drivers are shared per material, not per individual bulb.
        try:
            f = slot.driver_add('default_value')
            driver = f.driver
            driver.type = 'SCRIPTED'
            driver.expression = f"max(0, master * group * {multiplier:.5f})"
            for varname, prop in [('master', 'C2_MASTER'), ('group', control)]:
                var = driver.variables.new()
                var.name = varname
                var.type = 'SINGLE_PROP'
                target = var.targets[0]
                target.id_type = 'SCENE'
                target.id = scene
                target.data_path = f'["{prop}"]'
            count += 1
        except Exception as exc:
            print(f"[warning] emission driver for {mat.name}: {exc}")
    return count


def prepare_lighting(scene):
    for name, v in CONTROLS.items():
        scene[name] = float(v)
        try:
            ui = scene.id_properties_ui(name)
            ui.update(description=f"Cinema 2.0 scene light control: {name}", min=0.0, max=8.0, soft_min=0.0, soft_max=3.0)
        except Exception:
            pass

    # For every control and imported material create ONE copy per original shader.
    # This avoids breaking original gradient variations in the LED columns.
    made = {}
    count = {}
    for obj in list(scene.objects):
        if obj.type != 'MESH':
            continue
        ctl = which_emissive_control(obj.name)
        if not ctl:
            continue
        count[ctl] = count.get(ctl, 0) + 1
        # Avoid changing shared mesh data across groups (GLB importer occasionally
        # shares instances for repeated geometry).
        if obj.data.users > 1:
            obj.data = obj.data.copy()
        for i, orig in enumerate(list(obj.data.materials)):
            if orig is None:
                continue
            ident = (orig.as_pointer(), ctl)
            if ident not in made:
                mat = orig.copy()
                mat.name = f"C2 DRIVEN | {ctl} | {orig.name}"
                driven_emission(mat, scene, ctl, DEFAULT_STRENGTH[ctl])
                made[ident] = mat
            obj.data.materials[i] = made[ident]
        obj["C2_AUDIO_LIGHT_GROUP"] = ctl
    print("[C2] Lighting mesh counts:", count)
    return count


def add_point(name, xyz, color, watts, group, radius=2.3):
    light_data = bpy.data.lights.new(name, type='POINT')
    light_data.energy = watts
    light_data.color = color
    try: light_data.shadow_soft_size = radius
    except Exception: pass
    obj = bpy.data.objects.new(name, light_data)
    group.objects.link(obj)
    obj.location = xyz
    return obj


def add_area(name, xyz, target, color, watts, width, group):
    light = bpy.data.lights.new(name, 'AREA')
    light.energy = watts
    light.color = color
    light.shape = 'DISK'
    light.size = width
    o = bpy.data.objects.new(name, light)
    group.objects.link(o)
    o.location = xyz
    vec = Vector(target) - o.location
    o.rotation_euler = vec.to_track_quat('-Z', 'Y').to_euler()
    return o


def create_camera(name, pos, aim, lens, group):
    dat = bpy.data.cameras.new(name)
    dat.type = 'PERSP'
    dat.lens = lens
    dat.clip_end = 700
    obj = bpy.data.objects.new(name, dat)
    group.objects.link(obj)
    obj.location = pos
    obj.rotation_euler = (Vector(aim) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    obj["C2_PRESET_CAMERA"] = name.split(' | ')[-1]
    return obj


def preview_world(scene, groups, engine='eevee', samples=32):
    world = bpy.data.worlds.new("C2 World | Near-black Emerald Night")
    scene.world = world
    world.use_nodes = True
    back = world.node_tree.nodes.get('Background')
    back.inputs['Color'].default_value = (0.0025, 0.012, 0.011, 1.0)
    back.inputs['Strength'].default_value = 0.15

    if engine == 'cycles':
        scene.render.engine = 'CYCLES'
        scene.cycles.samples = max(16, samples)
    else:
        try:
            scene.render.engine = 'BLENDER_EEVEE_NEXT'
        except Exception:
            scene.render.engine = 'BLENDER_EEVEE'
        if hasattr(scene, 'eevee') and hasattr(scene.eevee, 'taa_render_samples'):
            scene.eevee.taa_render_samples = max(16, samples)

    stage = groups['stage']
    # Lower-area fill reveals the masonry when the marquee dominates the frame.
    add_area("C2 | SOFT WARM FACADE LEFT", (-9, -13, 8), (-8, 0, 4.6), (1.0, .48, .20), 900, 9.0, stage)
    add_area("C2 | SOFT WARM FACADE RIGHT", (9, -13, 8), (8, 0, 4.6), (1.0, .48, .20), 900, 9.0, stage)
    add_area("C2 | AMBIENT SOFTBOX", (0, -13, 15), (0, -2, 5.3), (0.72, 0.84, 1.0), 800, 16.0, stage)
    add_point("C2 | WALKWAY REFLECTED WARMTH", (0, -9, 2.1), (1.0, .56, .25), 160, stage, 4.0)

    cams = groups['cams']
    camera_main = create_camera("C2 CAMERA | 01 Front Hero", (0, -31.5, 8.3), (0, -2.1, 5.0), 31, cams)
    create_camera("C2 CAMERA | 02 Left Three-Quarter", (-19, -23, 9.0), (0, -2.3, 5.0), 31, cams)
    create_camera("C2 CAMERA | 03 Right Three-Quarter", (19, -23, 9.0), (0, -2.3, 5.0), 31, cams)
    create_camera("C2 CAMERA | 04 Marquee Detail", (0, -15.5, 7.0), (0, -3.7, 4.8), 32, cams)
    create_camera("C2 CAMERA | 05 Low Angle", (0, -18.0, 2.7), (0, -2.4, 6.1), 35, cams)
    scene.camera = camera_main
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.render.fps = 60
    scene.frame_start = 1
    scene.frame_end = 240
    try:
        scene.view_settings.view_transform = 'AgX'
    except Exception:
        try: scene.view_settings.view_transform = 'Filmic'
        except Exception: pass
    try:
        scene.view_settings.look = 'Medium High Contrast'
    except Exception:
        pass  # View-transform looks differ between Blender releases.
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0

    # Compositor glow is a conventional post effect. Disable this node if using
    # other Cinema 2.0 post processes to avoid double-bloom.
    scene.use_nodes = True
    nodes = scene.node_tree.nodes
    nodes.clear()
    layer = nodes.new('CompositorNodeRLayers'); layer.location = (-340, 0)
    out = nodes.new('CompositorNodeComposite'); out.location = (190, 0)
    try:
        glow = nodes.new('CompositorNodeGlare')
        glow.location = (-70, 0)
        glow.glare_type = 'FOG_GLOW'
        glow.quality = 'MEDIUM'
        glow.threshold = 1.5
        scene.node_tree.links.new(layer.outputs['Image'], glow.inputs['Image'])
        scene.node_tree.links.new(glow.outputs['Image'], out.inputs['Image'])
    except Exception as err:
        print('[C2] Glow not available on this Blender version:', err)
        scene.node_tree.links.new(layer.outputs['Image'], out.inputs['Image'])

    return camera_main


def timeline_demo(scene):
    """Optional pre-keyframed illustration. Replace this with live audio routing."""
    scene.timeline_markers.new('INTRO | Standby', frame=1)
    scene.timeline_markers.new('KICK | Canopy pulse', frame=30)
    scene.timeline_markers.new('BUILD | Neon increase', frame=90)
    scene.timeline_markers.new('DROP | Full marquee', frame=150)
    scene.timeline_markers.new('OUTRO | Reset', frame=219)

    values = {
        1:   {'C2_CANOPY': .38, 'C2_MARQUEE_BULBS': .52, 'C2_TOWER_BULBS': .62, 'C2_LED_LEFT': .40, 'C2_LED_RIGHT': .40, 'C2_NEON_RED': .55, 'C2_NEON_BLUE': .63, 'C2_NEON_AMBER': .55},
        30:  {'C2_CANOPY': 1.25, 'C2_MARQUEE_BULBS': .80, 'C2_TOWER_BULBS': .75, 'C2_LED_LEFT': .53, 'C2_LED_RIGHT': .53, 'C2_NEON_RED': .70, 'C2_NEON_BLUE': .80, 'C2_NEON_AMBER': .75},
        50:  {'C2_CANOPY': .62, 'C2_MARQUEE_BULBS': .85, 'C2_TOWER_BULBS': .75, 'C2_LED_LEFT': .55, 'C2_LED_RIGHT': .55, 'C2_NEON_RED': .75, 'C2_NEON_BLUE': .88, 'C2_NEON_AMBER': .74},
        90:  {'C2_CANOPY': .90, 'C2_MARQUEE_BULBS': 1.10, 'C2_TOWER_BULBS': 1.03, 'C2_LED_LEFT': .90, 'C2_LED_RIGHT': .90, 'C2_NEON_RED': 1.05, 'C2_NEON_BLUE': 1.23, 'C2_NEON_AMBER': .95},
        149: {'C2_CANOPY': .04, 'C2_MARQUEE_BULBS': .06, 'C2_TOWER_BULBS': .05, 'C2_LED_LEFT': .06, 'C2_LED_RIGHT': .06, 'C2_NEON_RED': .09, 'C2_NEON_BLUE': .08, 'C2_NEON_AMBER': .08},
        150: {'C2_CANOPY': 2.3, 'C2_MARQUEE_BULBS': 2.25, 'C2_TOWER_BULBS': 1.85, 'C2_LED_LEFT': 2.1, 'C2_LED_RIGHT': 2.1, 'C2_NEON_RED': 2.0, 'C2_NEON_BLUE': 1.9, 'C2_NEON_AMBER': 2.0},
        185: {'C2_CANOPY': 1.15, 'C2_MARQUEE_BULBS': 1.2, 'C2_TOWER_BULBS': 1.15, 'C2_LED_LEFT': .99, 'C2_LED_RIGHT': .99, 'C2_NEON_RED': 1.1, 'C2_NEON_BLUE': 1.1, 'C2_NEON_AMBER': 1.15},
        219: {'C2_CANOPY': .67, 'C2_MARQUEE_BULBS': .65, 'C2_TOWER_BULBS': .65, 'C2_LED_LEFT': .5, 'C2_LED_RIGHT': .5, 'C2_NEON_RED': .68, 'C2_NEON_BLUE': .7, 'C2_NEON_AMBER': .66},
    }
    for frame, props in values.items():
        for key, value in props.items():
            scene[key] = float(value)
            scene.keyframe_insert(data_path=f'["{key}"]', frame=frame, group="C2 | Audio light preview")
    scene.frame_set(90)


def pack_images():
    number = 0
    for image in bpy.data.images:
        if image.source != 'FILE':
            continue
        try:
            image.pack()
            number += 1
        except Exception as exc:
            print('[warning] Cannot pack image:', image.name, exc)
    return number


def save_manifest_json(blend_file, sign_records, bulb_counts):
    data = {
        'title': SCENE_NAME,
        'source_geometry': 'DVYDRM_Cinema2_Theater.glb',
        'source_coordinate_system': 'glTF: X-right Y-up Z-front',
        'blender_coordinate_system': 'X-right Z-up -Y-front',
        'marquee_signs': sign_records,
        'audio_control_scene_custom_properties': list(CONTROLS.keys()),
        'mapped_mesh_count': bulb_counts,
        'editable_text_instructions': "Select C2_TEXT_FRONT_EDITABLE / C2_TEXT_LEFT_EDITABLE / C2_TEXT_RIGHT_EDITABLE; press Tab, replace text, press Tab.",
        'note': 'Blender uses real FONT objects. For Cinema 2.0 export, convert to mesh or render user-editable CanvasTextures at runtime; glTF does not preserve FONT editability.',
        'render': {'width': 1920, 'height': 1080, 'samples_preview': 32},
    }
    path = blend_file.with_name('DVYDRM_Cinema2_Theater_Blender_Manifest.json')
    path.write_text(json.dumps(data, indent=2), encoding='utf8')
    return path


def main():
    args = parse_args()
    directory = source_directory()
    source = Path(args.source).resolve() if args.source else directory / 'DVYDRM_Cinema2_Theater.glb'
    output = Path(args.output).resolve() if args.output else directory / 'DVYDRM_Cinema2_Theater_EDITABLE.blend'
    if not source.is_file():
        raise FileNotFoundError(f'Missing GLB source: {source}. Extract the full ZIP alongside this .py script.')
    output.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    # Remove stale default collections from a previously opened file.
    for coll in list(scene.collection.children):
        try: scene.collection.children.unlink(coll)
        except Exception: pass

    print('[C2] Importing existing theater geometry:', source)
    bpy.ops.import_scene.gltf(filepath=str(source))
    print('[C2] Imported scene objects:', len(scene.objects))
    groups = initialize_collections()
    route_imported_objects(groups)

    signs = []
    for face in ('front', 'left', 'right'):
        signs.append(make_blender_sign(face, find_sign_mesh(face), groups['txt']))
    mapped_counts = prepare_lighting(scene)
    preview_world(scene, groups, args.engine, args.samples)
    timeline_demo(scene)

    scene['C2_CONTRACT'] = 'Cinema 2.0 | Editable 3-sided marquee; grouped audio-addressable lights'
    scene['C2_TEXT_INSTRUCTIONS'] = 'Edit C2_TEXT_FRONT_EDITABLE, C2_TEXT_LEFT_EDITABLE, C2_TEXT_RIGHT_EDITABLE as Blender FONT objects.'
    scene['C2_GEOMETRY_IS'] = 'True 3D asset from prior validated export; not a textured reference plane'
    scene['C2_WORKFLOW_STATUS'] = 'Blender lookdev preview, NOT final Cinema 2.0 engine preset'
    # Embed a copy of the builder in the generated .blend Text Editor for provenance.
    try:
        builder_path = Path(__file__).resolve()
        if builder_path.is_file():
            text_datablock = bpy.data.texts.load(str(builder_path), internal=True)
            text_datablock.name = 'C2_THEATER_SCENE_BUILDER.py'
    except Exception as exc:
        print('[C2] Could not embed scene-builder source:', exc)
    # Open directly into camera composition in Blender's saved Layout workspace.
    try:
        for screen in bpy.data.screens:
            for area in screen.areas:
                if area.type == 'VIEW_3D':
                    area.spaces.active.region_3d.view_perspective = 'CAMERA'
                    area.spaces.active.shading.type = 'MATERIAL'
    except Exception as exc:
        print('[C2] Optional viewport setup unavailable:', exc)
    packed_count = pack_images()
    print('[C2] Packed', packed_count, 'image datablocks')
    # Do not save with missing files. When Blender imports a GLB textures should
    # be extracted to image datablocks and packed into the .blend file here.
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
    manifest_path = save_manifest_json(output, signs, mapped_counts)
    print('[C2] SAVED:', output)
    print('[C2] MANIFEST:', manifest_path)
    print('[C2] Signs:', signs)

    if args.render:
        path = output.with_suffix('.png')
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        print('[C2] RENDERED:', path)


if __name__ == '__main__':
    main()
