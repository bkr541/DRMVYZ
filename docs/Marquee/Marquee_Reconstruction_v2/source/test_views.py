import vtk
p='/mnt/data/Marquee_Reconstruction_v2/assets/DVYDRM_Marquee_HighFidelity_v2.glb'
for x,z,y,ang in [('a',21,1.5,38),('b',19,1.6,42),('c',23,1.2,39)]:
 imp=vtk.vtkGLTFImporter();imp.SetFileName(p);w=vtk.vtkRenderWindow();w.SetOffScreenRendering(True);w.SetSize(1024,576);imp.SetRenderWindow(w);imp.Update();r=w.GetRenderers().GetFirstRenderer();r.SetBackground(.01,.02,.02)
 c=r.GetActiveCamera();c.SetPosition(0,y,z);c.SetFocalPoint(0,5.15,.3);c.SetViewUp(0,1,0);c.SetViewAngle(ang);c.SetClippingRange(.1,200)
 for a in r.GetActors():
  a.GetProperty().SetAmbient(.40);a.GetProperty().SetDiffuse(.72)
 for pos,inten in [((0,8,23),1.15),((-12,15,3),.6),((12,15,3),.6)]:
  l=vtk.vtkLight();l.SetPosition(*pos);l.SetFocalPoint(0,4,0);l.SetIntensity(inten);r.AddLight(l)
 w.Render();wt=vtk.vtkWindowToImageFilter();wt.SetInput(w);wt.Update();ww=vtk.vtkPNGWriter();ww.SetFileName('/mnt/data/'+x+'_camtest.png');ww.SetInputConnection(wt.GetOutputPort());ww.Write()
