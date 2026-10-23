from pathlib import Path
import math, itertools, json, xml.etree.ElementTree as ET, re
root=Path(__file__).resolve().parents[1]
out=root/'evidence'
ring=[0,1,2,5,8,7,6,3]
names=['stack','orbit','stagger','split','wave','collapse']
def positions(name, phase=0, size=1.35, spread=1, depth=.45, motion=.55):
    a=max(1.95*spread, math.sqrt(3)*size+.24); p=2*math.pi*phase; d=depth/.45; pts=[]
    for i in range(9):
        r,c=divmod(i,3)
        if name=='stack':
            v=[1.2*(c-1),1-r+.08*motion*math.sin(p+c*math.pi),.35*(c-1)]
        elif name=='orbit':
            if i==4: v=[0,0,0]
            else:
                t=math.pi/2-ring.index(i)*math.pi/4+p
                v=[1.85*math.cos(t),1.55*math.sin(t),.38*math.sin(2*t)]
        elif name=='stagger':
            v=[1.35*(c-1)+.25*(r-1)+.10*motion*math.sin(p+.6*i),1.2*(1-r)+.16*(c-1)+.04*motion*math.sin(p+.6*i),.8*((r+c)%2-.5)+.18*(r-1)]
        elif name=='split':
            if c in [0,2]: v=[(2*c-2)*(.85+.06*motion*math.sin(p)),1-r,.35*(c-1)]
            else: v={1:[-.55,1.4,-.8],4:[0,0,0],7:[.55,-1.4,.8]}[i]
        elif name=='wave':
            q=p+c*math.pi/2+r*math.pi/3
            v=[1.25*(c-1),1.6*(1-r)+.22*motion*math.sin(q),.25*((1-motion)*math.cos(q-p)+motion*math.cos(q))+.2*(r-1)]
        else:
            if i==4: v=[0,0,0]
            else:
                j=ring.index(i); t=math.pi/2-j*math.pi/4; k=1+.06*motion*math.sin(p)
                v=[k*1.45*math.cos(t),k*1.45*math.sin(t),k*.3*(-1)**j]
        pts.append([a*v[0],a*v[1],a*d*v[2]])
    minimum=min(math.dist(x,y) for x,y in itertools.combinations(pts,2))
    dilation=max(1,(math.sqrt(3)*size+.20)/minimum)
    return [[x*dilation for x in v] for v in pts]
# Design arithmetic only. This is not a native implementation or swept-path test.
rows=[]
for n in names:
    worst=0; clearance=1e9
    for size,spread,depth,motion in itertools.product([1.05,1.35,1.8],[.5,1,1.8],[0,.45,1],[0,.55,1]):
        for step in range(64):
            pts=positions(n,step/64,size,spread,depth,motion)
            assert len(pts)==9 and all(math.isfinite(v) for p in pts for v in p)
            minimum=min(math.dist(x,y) for x,y in itertools.combinations(pts,2))
            clearance=min(clearance,minimum-(math.sqrt(3)*size+.04))
            worst=max(worst,max(math.sqrt(sum(x*x for x in p)) for p in pts)+math.sqrt(3)*size/2+.02)
    assert clearance>=.16-1e-8,(n,clearance)
    assert worst<=10,(n,worst)
    rows.append({'pattern':n,'minimum_sphere_surface_clearance':round(clearance,6),'maximum_rig_radius_including_cube':round(worst,6)})
# Perspective-projected SVG; each panel gets the same fitted diagram camera.
eye=[10,7,24]
def norm(v):
    l=math.sqrt(sum(x*x for x in v));return [x/l for x in v]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
f=norm([-v for v in eye]); right=norm(cross(f,[0,1,0])); up=cross(right,f)
def project(v):
    delta=[v[i]-eye[i] for i in range(3)]; z=sum(delta[i]*f[i] for i in range(3));return (sum(delta[i]*right[i] for i in range(3))/z,-sum(delta[i]*up[i] for i in range(3))/z)
verts=list(itertools.product([-.675,.675],repeat=3))
faces=[([4,5,7,6],'#242e40'),([2,3,7,6],'#344158'),([1,3,7,5],'#1a2231')]
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="2200" viewBox="0 0 1800 2200">','<rect width="1800" height="2200" fill="#050811"/>','<g font-family="Arial,Helvetica,sans-serif" fill="#e8efff">','<text x="60" y="68" font-size="34" font-weight="700">BLOCKSHIFT / P1 FORMATION REFERENCE</text>','<text x="60" y="103" font-size="18" fill="#aebad1">50% larger cubes · nine stable IDs · phase 0 · no bloom · no production acceptance claimed</text>']
# Same scale across all formations; camera direction is fixed, panel fit is diagrammatic.
scale=1050
for ix,n in enumerate(names):
    col=ix%2; row=ix//2; x=40+col*860; y=145+row*620
    svg.append(f'<rect x="{x}" y="{y}" width="840" height="600" rx="18" fill="#090f1c" stroke="#243047"/>')
    svg.append(f'<text x="{x+25}" y="{y+42}" font-size="25" font-weight="700">{ix+1:02} / {n.upper()}</text>')
    pts=positions(n)
    for i in sorted(range(9),key=lambda i:sum((pts[i][j]-eye[j])**2 for j in range(3)),reverse=True):
        color='#fff1d6' if i==4 else '#55e6ff' if i%3==0 or i==1 else '#7866ff'
        pv=[project([pts[i][j]+v[j] for j in range(3)]) for v in verts]
        for face,fill in faces:
            coords=' '.join(f'{x+420+pv[k][0]*scale:.2f},{y+300+pv[k][1]*scale:.2f}' for k in face)
            svg.append(f'<polygon points="{coords}" fill="{fill}" stroke="{color}" stroke-width="2" stroke-linejoin="round"/>')
        center=project(pts[i]); svg.append(f'<text x="{x+420+center[0]*scale:.2f}" y="{y+304+center[1]*scale:.2f}" text-anchor="middle" font-size="11" fill="#dce6f8">{i:02}</text>')
    desc={'stack':'Three towers / restrained sway','orbit':'Eight around one / elliptical circulation','stagger':'Default / stepped rows and depth','split':'Opposed banks / open center seam','wave':'Sequenced height / serpentine depth','collapse':'Compact cluster / alternating depth'}[n]
    svg.append(f'<text x="{x+25}" y="{y+570}" font-size="18" fill="#aebad1">{desc}</text>')
svg+=['<text x="60" y="2050" font-size="19">Palette roles</text>']
for i,(label,c) in enumerate([('Primary','#55e6ff'),('Secondary','#7866ff'),('Impact / center','#fff1d6'),('Body','#151a24'),('Background','#050811')]):
    x=60+i*340; svg.append(f'<rect x="{x}" y="2070" width="36" height="28" fill="{c}" stroke="#6d7891"/><text x="{x+50}" y="2091" font-size="18" fill="#c1cce0">{label} {c.upper()}</text>')
svg+=['<text x="60" y="2160" font-size="17" fill="#8795af">Fixed view direction, shared diagram scale. Face shading is illustrative. Review geometry and color roles; P2 must prove real canvas output.</text>','</g></svg>']
(out/'P1_FORMATION_REFERENCE.svg').write_text('\n'.join(svg))
ET.parse(out/'P1_FORMATION_REFERENCE.svg')
# Check new/local markdown links and status consistency once after writing.
for doc in [root/'README.md',root/'12_P0_CURRENT_SOURCE_AUDIT.md',root/'13_P1_LOCKED_SPECIFICATION.md']:
    for link in re.findall(r'\]\(([^)]+)\)',doc.read_text()):
        if not link.startswith(('http','/','#')):
            assert (doc.parent/link.split('#')[0]).exists(),(doc,link)
summary={'scope':'P1 authored formation arithmetic, not runtime or production acceptance','configurations_per_pattern':81,'phases_per_configuration':64,'total_sampled_poses':6*81*64,'checks':['nine finite centers','conservative sphere clearance >=0.16 after formation spacing clamp','rig radius <=10 including cube envelope','SVG XML parses','new local markdown links resolve'],'patterns':rows,'not_tested':['transitions','audio offsets','Auto overlays','native shaders','actual camera visibility','production rendering'],'result':'PASS'}
(out/'P1_DESIGN_VALIDATION.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
