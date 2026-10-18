#!/usr/bin/env python3
import json, math
from pathlib import Path
import svgwrite
P=Path(__file__).resolve().parent.parent; manifest=json.loads((P/'assets/Marquee_Geometry_Manifest_v2.json').read_text())
out=P/'assets/Marquee_Geometry_Blueprint_v2.svg'
w,h=2100,1550;svg=svgwrite.Drawing(str(out),size=(w,h),viewBox=f'0 0 {w} {h}')
bg='#101a23';ink='#def5f4';muted='#849eaf';gold='#f6b65f';red='#fd6f68';blue='#63c8ff';grid='#1e3140'
svg.add(svg.rect(insert=(0,0),size=(w,h),fill=bg))
def text(x,y,s,size=22,fill=ink,weight='normal'):svg.add(svg.text(s,insert=(x,y),font_size=size,fill=fill,font_family='DejaVu Sans',font_weight=weight))
def line(x1,y1,x2,y2,color=ink,width=2,dash=None):
 kw={"stroke":color,"stroke_width":width}
 if dash:kw["stroke_dasharray"]=dash
 svg.add(svg.line((x1,y1),(x2,y2),**kw))
def poly(points,color=ink,width=2,fill='none'):svg.add(svg.polygon(points,fill=fill,stroke=color,stroke_width=width))
def rect(x,y,w,h,col,fill='none',sw=2):svg.add(svg.rect(insert=(x,y),size=(w,h),fill=fill,stroke=col,stroke_width=sw))
text(75,70,'DVYDRM  /  MARQUEE',38,gold,'bold');text(75,107,'HIGH-FIDELITY RECONSTRUCTION V2  /  MODEL-ALIGNED GEOMETRY BLUEPRINT',18,muted)
text(75,148,'WORLD: X right  ·  Y up  ·  +Z toward street/camera  ·  units are authored scene units, not surveyed meters',18,ink)
# front orthographic
X0=742;Y0=873;scale=46
fx=lambda x:X0+x*scale
fy=lambda y:Y0-y*scale
text(75,203,'A  /  FRONT ELEVATION',24,gold,'bold')
rect(fx(-13.25),fy(10.05),26.5*scale,10.05*scale,muted)
for yy in (2.43,8.55,9.52):line(fx(-13.25),fy(yy),fx(13.25),fy(yy),muted,2)
for xx in (-12.2,12.2):rect(fx(xx-.53),fy(10.0),1.06*scale,(10.-2.4)*scale,gold)
for side in (-1,1):
 xx=side*9.4;rect(fx(xx-.94),fy(7.23),1.88*scale,2.85*scale,blue);line(fx(xx),fy(7.2),fx(xx),fy(4.4),blue)
 xx=side*6.35;rect(fx(xx-.43),fy(11.45),.86*scale,5.79*scale,gold)
 for j in range(8):
  cy=6.13+j*.665;svg.add(svg.circle(center=(fx(xx),fy(cy)),r=8,fill=gold))
 xx=side*4.82;rect(fx(xx-.62),fy(2.55),1.24*scale,2.5*scale,red)
for i in range(6):
 xx=-3.55+i*1.42;rect(fx(xx-.63),fy(2.7),1.26*scale,2.5*scale,blue)
rect(fx(-5.20),fy(9.72),10.4*scale,3.72*scale,red)
# big marquee x flat elevation
rect(fx(-3.61),fy(5.49),7.22*scale,1.76*scale,gold)
for s in (-1,1):
 xa,xb=sorted((s*3.61,s*7.48));rect(fx(xa),fy(5.49),(xb-xa)*scale,1.76*scale,red)
for i in range(6):
 w=3.55-i*.59;hy=6.35+i*.38
 poly([(fx(-w),fy(5.6)),(fx(-w),fy(hy-.2)),(fx(-w+.23),fy(hy)),(fx(w-.23),fy(hy)),(fx(w),fy(hy-.2)),(fx(w),fy(5.6))],gold if i%2 else red,2)
for xx in (-.33,-.11,.11,.33):line(fx(xx),fy(5.84),fx(xx),fy(8.83),blue,5)
# dimensions
line(fx(-13.25),fy(11.95),fx(13.25),fy(11.95),muted,2)
line(fx(-13.25),fy(12.15),fx(-13.25),fy(11.75),muted);line(fx(13.25),fy(12.15),fx(13.25),fy(11.75),muted)
text(fx(-2),fy(12.10),'26.5 facade width',18,ink)
line(fx(13.9),fy(0),fx(13.9),fy(11.45),muted,1)
text(fx(14.2),fy(10.5),'11.45 tower top',16,muted)
text(75,911,'B  /  TOP PLAN: REAL CANOPY PROJECTION + THREE SIGN FACES',24,gold,'bold')
# top projection, 1250x430
px=725;pz=1230;ss=62
mx=lambda x:px+x*ss
mz=lambda z:pz-z*ss
poly([(mx(-7.6),mz(-1.02)),(mx(7.6),mz(-1.02)),(mx(7.6),mz(.7)),(mx(3.68),mz(5.73)),(mx(-3.68),mz(5.73)),(mx(-7.6),mz(.7))],muted,2,'#20303b')
# walls
line(mx(-13.25),mz(-1.94),mx(13.25),mz(-1.94),ink,5)
for face,p in manifest['runtime_signage'].items():
 a=p['p0_xz'];b=p['p1_xz'];line(mx(a[0]),mz(a[1]),mx(b[0]),mz(b[1]),red if face=='front' else gold,10)
 nx,nz=p['normal_xz']; mid=[(a[0]+b[0])/2,(a[1]+b[1])/2]
 line(mx(mid[0]),mz(mid[1]),mx(mid[0]+nx*.8),mz(mid[1]+nz*.8),blue,3)
 text(mx(mid[0])-(65 if face=='front' else 80),mz(mid[1])-22,'FRONT' if face=='front' else face.upper(),18,ink,'bold')
for j,xx in enumerate([-6,-4,-2,0,2,4,6]):
 ze=5.63 if abs(xx)<=3.62 else 5.63-(abs(xx)-3.62)/(7.58-3.62)*(5.63-.7)
 line(mx(xx),mz(-.85),mx(xx),mz(ze),gold,2)
# arrows and notes
line(75,1398,1950,1398,grid)
text(75,1433,'FIXTURE INSTANCING: named nodes remain separately addressable  /  runtime renderer should batch emissive updates',19,ink)
text(75,1470,'SIGNAGE: marquee.front.TEXT_SURFACE   ·   marquee.left.TEXT_SURFACE   ·   marquee.right.TEXT_SURFACE',19,blue)
text(75,1510,'VALIDATION: placement is reference-derived and subject to human visual approval; blueprint intentionally not dimensioned in meters.',16,muted)
svg.save(pretty=True)
print(out,out.stat().st_size)
