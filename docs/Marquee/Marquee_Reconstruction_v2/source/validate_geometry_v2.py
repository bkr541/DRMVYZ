#!/usr/bin/env python3
"""Structural-only automated checks; cannot certify visual similarity or Blender render parity."""
from pathlib import Path
import json,trimesh,math
P=Path(__file__).resolve().parent.parent
J=json.loads((P/'assets/Marquee_Geometry_Manifest_v2.json').read_text())
S=trimesh.load(P/'assets/DVYDRM_Marquee_HighFidelity_v2.glb',force='scene')
names=set(S.graph.nodes)
checks={}
for side in ('front','left','right'):
 checks[f'editable_surface_{side}']=f'marquee.{side}.TEXT_SURFACE' in names
 checks[f'sign_orientation_{side}']=math.isclose(math.hypot(*J['runtime_signage'][side]['normal_xz']),1,abs_tol=0.0001)
checks['canopy_has_true_3d_shell']='canopy.structural_projecting_shell' in names
checks['deep_canopy_ends_in_front_of_sign']=5.73>J['runtime_signage']['front']['p0_xz'][1]+1
checks['roof_portals_at_least_six']=sum('crown.layer.' in n and 'rounded_metal' in n for n in names)>=6
checks['volumetric_pleated_curtain']='curtain.volumetric_pleated_fabric' in names
checks['independently_named_light_nodes'] = sum(n.startswith(('bulbs.','leds.')) for n in names) >= 1000
checks['doors_six']=sum(n.startswith('entrance.door.') and n.endswith('.glass') for n in names)==6
checks['night_architectural_lighting']='neon.crown.blue.0' in names
checks['geometry_nonempty']=len(S.geometry)>200 and len(S.graph.nodes)>1000
checks['all_meshes_finite']=all(g.is_empty is False and bool((~g.vertices.isna()).all()) if hasattr(g.vertices,'isna') else bool(__import__('numpy').isfinite(g.vertices).all()) for g in S.geometry.values())
checks['all_camera_views_named']=len(J['camera_presets'])>=5
status={'structural_checks':checks,'passed':sum(checks.values()),'total':len(checks),'all_passed':all(checks.values()),'preview_status':'VTK GLB renders captured. Not a Blender or Cinema 2.0 canvas render.', 'visual_approval':'NOT TESTED; user must approve side-by-side match after runtime material/lighting work.'}
(P/'assets/Marquee_Structural_Validation_v2.json').write_text(json.dumps(status,indent=2))
print(json.dumps(status,indent=2))
if not status['all_passed']:raise SystemExit('Structural validation failed')
