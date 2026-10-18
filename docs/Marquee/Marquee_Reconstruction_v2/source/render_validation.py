#!/usr/bin/env python3
import json,math
from pathlib import Path
import vtk
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parent.parent
model=root/'assets/DVYDRM_Marquee_HighFidelity_v2.glb'; manifest=json.loads((root/'assets/Marquee_Geometry_Manifest_v2.json').read_text())
for name in ['front_hero','right_three_quarter','low_canopy']:
 W,H=(1440,810)
 imp=vtk.vtkGLTFImporter();imp.SetFileName(str(model)); win=vtk.vtkRenderWindow();win.SetOffScreenRendering(True);win.SetSize(W,H);win.SetMultiSamples(4);imp.SetRenderWindow(win);imp.Update()
 r=win.GetRenderers().GetFirstRenderer()
 r.SetBackground(0.013,0.021,0.025)
 # r.UseFXAAOn()
 for a in r.GetActors():
  a.GetProperty().SetAmbient(.40);a.GetProperty().SetDiffuse(.72)
 c=r.GetActiveCamera();x=manifest['camera_presets'][name];c.SetPosition(*x['eye']);c.SetFocalPoint(*x['target']);c.SetViewUp(0,1,0);c.SetViewAngle(x["fov_y_degrees"]);c.SetClippingRange(.1,200)
 # neutral fill to reveal actual structure (cinematic light effects are host-dependent)
 for pos,col,inten in [((0,15,22),(1,.84,.66),1.00),((-16,8,12),(.60,.70,1),.40),((16,10,3),(1,.4,.30),.40)]:
  l=vtk.vtkLight();l.SetPosition(*pos);l.SetFocalPoint(0,4,0);l.SetColor(*col);l.SetIntensity(inten);l.SetLightTypeToSceneLight();r.AddLight(l)
 win.Render(); wt=vtk.vtkWindowToImageFilter();wt.SetInput(win);wt.Update(); wr=vtk.vtkPNGWriter();wr.SetInputConnection(wt.GetOutputPort());path=root/'previews'/('Marquee_v2_'+name+'.png');wr.SetFileName(str(path));wr.Write()
 print('Rendered',path, path.stat().st_size)
