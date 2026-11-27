/** Source-specific authoring. Each row is an independent performance vocabulary, not a texture swap. */
export type Color = readonly [number, number, number, number]
export type Profile = {
  key: string; name: string; description: string; patterns: readonly string[]; colors: readonly string[];
  camera: readonly [number, number, number]; interior: boolean; cycles: number; build: number; drop: number;
  labels: readonly [string, string, string, string, string, string]; paletteLabels: readonly [string,string,string,string,string];
  /** Rates for expansion, axial displacement, twist, ripple, emissive accent, and clip playback. */
  weights: readonly [number, number, number, number, number, number];
}
export const PROFILES: readonly Profile[] = [
 {key:'pulse',name:'PULSE',description:'Segmented geometric energy tunnel',patterns:['Resonance','Inversion','Heartbeat','Helix','Collapse','Ripple','Phase Shift','Interference','Singularity','Overload'],colors:['00DDFF','5368FF','AD57FF','E2FFFF','04070D'],camera:[0,0,5.8],interior:false,cycles:8,build:4,drop:9,labels:['Segment Density','Ring Spacing','Rotation Speed','Expansion','Pulse Speed','Pulse Width'],paletteLabels:['Primary Energy','Secondary Energy','Segment Accent','Core Highlight','Background'],weights:[.65,.38,.8,.85,.9,1]},
 {key:'space-jellyfish',name:'SPACE JELLYFISH',description:'Bioluminescent cosmic organism',patterns:['Bioluminescence','Neural Pulse','Migration','Tentacle Flow','Deep Current','Chromatic Bloom','Cellular Division','Cosmic Storm','Metamorphosis','Superorganism'],colors:['21E8FF','7452FF','F654DE','FFD15B','030714'],camera:[2.8,1.4,5.6],interior:false,cycles:32,build:6,drop:9,labels:['Node Density','Ring Separation','Helix Motion','Breathing Depth','Energy Flow','Flow Width'],paletteLabels:['Organism Body','Helix Energy','Bioluminescent Nodes','Cosmic Accent','Background'],weights:[.35,.55,.45,.65,.7,.65]},
 {key:'alter-ego',name:'ALTER EGO',description:'Multilayered animated digital identities',patterns:['Awakening','Doppelgänger','Neural Grid','Identity Fracture','Echo Chamber','Possession','Mind Scan','Dissociation','Digital Scream','Consciousness'],colors:['36FF8A','FC4BC6','557FFF','A1FAFF','05050B'],camera:[0,.15,7.2],interior:false,cycles:16,build:3,drop:9,labels:['Visible Identities','Face Separation','Parallax Speed','Morph Strength','Scan Rate','Scan Width'],paletteLabels:['Primary Face','Secondary Face','Neural Grid','Eye Accent','Background'],weights:[.12,.62,.13,.65,.6,.6]},
 {key:'temple-of-light',name:'TEMPLE OF LIGHT',description:'Radial illuminated mandala architecture',patterns:['Invocation','Sacred Geometry','Ascension','Mandala Rotation','Celestial Gate','Radiant Cascade','Eclipse','Divine Alignment','Infinite Reflection','Enlightenment'],colors:['D95FFF','FFCB65','39CCFF','FFF0D9','080413'],camera:[0,0,5.8],interior:false,cycles:16,build:4,drop:9,labels:['Layer Density','Layer Separation','Mandala Rotation','Radial Expansion','Illumination Flow','Halo Width'],paletteLabels:['Temple Structure','Sacred Light','Mandala Primary','Portal Accent','Background'],weights:[.25,.55,.4,.75,.9,.5]},
 {key:'starfield-warp',name:'STARFIELD WARP',description:'Instanced relativistic starfield',patterns:['Cruise','Hyperspace','Gravity Well','Wormhole','Reverse Time','Constellation','Warp Shock','Orbital Drift','Dimensional Split','Light Speed'],colors:['4F8DFF','B7ECFF','FFFFFF','BB5BFF','02050C'],camera:[0,0,4.6],interior:true,cycles:32,build:2,drop:9,labels:['Star Count','Depth Range','Spiral Strength','Field Curvature','Transit Speed','Star Size'],paletteLabels:['Near Stars','Far Stars','Warp Energy','Shockwave Accent','Background'],weights:[.45,1.3,.65,.9,.65,1.2]},
 {key:'torus',name:'TORUS',description:'Reconfigurable toroidal energy cells',patterns:['Toroidal Orbit','Counterflow','Polarity','Unfold','Magnetic Lock','Vortex','Wavefront','Möbius','Orbital Exchange','Toroidal Collapse'],colors:['14DFFF','7FFF33','FFCC21','FC498C','04080B'],camera:[3.5,2.3,5.7],interior:false,cycles:16,build:4,drop:3,labels:['Cell Count','Cell Separation','Orbital Speed','Torus Diameter','Wave Speed','Satellite Radius'],paletteLabels:['Torus Primary','Torus Secondary','Satellite Energy','Orbital Accent','Background'],weights:[.55,.5,.9,.7,.75,.8]},
 {key:'time-tunnel',name:'TIME TUNNEL',description:'Optical temporal tunnel; restrained luminance defaults',patterns:['Continuum','Time Dilation','Paradox','Temporal Fold','Rewind','Clockwork','Event Horizon','Fractal Time','Phase Tunnel','Time Release'],colors:['FF368F','8E50FF','18CEFF','71FF72','06030D'],camera:[0,0,4.8],interior:true,cycles:32,build:3,drop:9,labels:['Ring Count','Ring Spacing','Rotation Speed','Tunnel Depth','Transit Speed','Phase Offset'],paletteLabels:['Primary Ring','Secondary Ring','Temporal Energy','Tunnel Core','Background'],weights:[.35,.9,.7,.6,.35,.7]},
 {key:'hypnotic-flower',name:'HYPNOTIC FLOWER',description:'Double-layered evolving floral geometry',patterns:['Blossom','Night Bloom','Counterpetal','Kaleidoscope','Breathing','Petal Cascade','Fold','Chromatic Spiral','Pollination','Full Bloom'],colors:['F757D7','8A64FF','54E7FF','FFCE7B','0A0310'],camera:[0,.2,5.8],interior:false,cycles:32,build:6,drop:9,labels:['Petal Count','Layer Separation','Petal Rotation','Petal Opening','Wave Speed','Fold Depth'],paletteLabels:['Inner Petals','Outer Petals','Petal Edges','Floral Core','Background'],weights:[.75,.38,.6,.8,.7,.55]},
 {key:'magic-warp',name:'MAGIC WARP',description:'Fluid spatial currents of luminous spheres',patterns:['Flow State','Whirlpool','Fluid Fold','Magnetic Flow','Chromatic Current','Elasticity','Fusion','Turbulence','Dimensional Drift','Warp Release'],colors:['34FFB0','16DFFF','FF4CD7','9464FF','03070A'],camera:[3.4,1.7,5.7],interior:false,cycles:32,build:6,drop:9,labels:['Particle Density','Depth Spread','Curl Strength','Elasticity','Flow Speed','Turbulence'],paletteLabels:['Primary Current','Secondary Current','Outer Energy','Core Highlight','Background'],weights:[.5,.65,.7,1,.65,.65]},
 {key:'disco-waves',name:'DISCO WAVES',description:'Optical glass and syncopated neon waves',patterns:['Disco Orbit','Groove Wave','Mirror Pulse','Frequency Rings','Rollerwave','Neon Groove','Crystal Spin','Syncopation','Prism Dance','Afterglow'],colors:['FC399F','38E8DF','976BFF','FFFFFF','060610'],camera:[0,1.1,6.2],interior:false,cycles:16,build:4,drop:7,labels:['Wave Density','Optical Separation','Rotation Speed','Wave Expansion','Wave Speed','Pulse Width'],paletteLabels:['Primary Wave','Secondary Wave','Central Energy','Glass Tint','Background'],weights:[.35,.45,.7,.85,.9,.8]},
]
export const slug=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
export const patterns=(p:Profile)=>p.patterns.map(slug)
export const clamp=(v:number,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v))
export const wrap=(v:number,period:number)=>((v%period)+period)%period
export const mix=(a:number,b:number,t:number)=>a+(b-a)*t
export const hex=(s:string):Color=>{const n=parseInt(s,16);return [(n>>16)/255,((n>>8)&255)/255,(n&255)/255,1]}
export const paletteKeys=['primary','secondary','accent','highlight','background','hazeTint'] as const
export type Palette=Record<typeof paletteKeys[number],Color>
export const palette=(p:Profile):Palette=>Object.fromEntries(paletteKeys.map((k,i)=>[k,hex(p.colors[i]??p.colors[4]!)])) as Palette
export const SIGNALS='overallEnergy subAmount bassPressure lowMidAmount midAmount highsAmount airAmount fluxAmount vocalPresence directorIntensity directorMomentum buildAmount directorImpact variation beatAccent kickAccent snareAccent downbeatAccent barAccent phraseAccent sectionAccent dropAccent'.split(' ')
export const controls=(p:Profile)=>[
 ['reactivity','Audio Reactivity',.8,0,1,.01,'master-controls','Performance'],
 ['intensity','Master Intensity',1,0,2,.01,'master-controls','Performance'],
 ['motionAmount','Motion Amount',1,0,2,.01,'master-controls','Performance'],
 ['playbackSpeed','Playback Speed',1,.25,3,.01,'master-controls','Performance'],
 ['density',p.labels[0],1,.15,1,.01,'design','Structure'],
 ['separation',p.labels[1],1,.4,1.6,.01,'design','Structure'],
 ['rotationSpeed',p.labels[2],.55,0,2,.01,'design','Motion'],
 ['expansion',p.labels[3],.35,0,1,.01,'design','Motion'],
 ['flowSpeed',p.labels[4],1,0,3,.01,'design','Motion'],
 ['width',p.labels[5],.5,.05,1,.01,'design','Motion'],
 ['modelSize','Model Size',1,.5,1.4,.01,'design','Structure'],
 ['cameraSpeed','Camera Speed',.25,0,1,.01,'design','Camera'],
 ['cameraAmount','Camera Motion Range',.35,0,1,.01,'design','Camera'],
 ['fov','Field of View',42,30,65,1,'design','Camera'],
 ['glow','Surface Glow',.65,0,2,.01,'effects','Illumination'],
 ['opacity','Surface Opacity',1,.1,1,.01,'effects','Illumination'],
 ['tint','Palette Influence',.35,0,1,.01,'effects','Illumination'],
 ['impactFlash','Impact Accent',p.key==='time-tunnel'?.08:.22,0,.5,.01,'effects','Illumination'],
 ['trails','Motion Trails',.18,0,1,.01,'effects','Optics'],
 ['reflection','Reflection Intensity',.4,0,1,.01,'effects','Optics'],
 ['bloom','Bloom',.55,0,1.5,.01,'effects','Optics'],
 ['haze','Atmosphere',.08,0,.8,.01,'effects','Optics'],
 ['aberration','Chromatic Aberration',.035,0,.25,.01,'effects','Optics'],
] as const
export const defaults=(p:Profile)=>Object.fromEntries([...controls(p).map(c=>[c[0],c[2]] as const),...SIGNALS.map(k=>[k,0] as const)]) as Record<string,number>
export interface ChromaverseState { values:Record<string,number>;palette:Palette;pattern:string;previous:string;transition:number;phase:number;clipTime:number;motion:number;flash:number;silence:number;cameraMode:string; }
export interface Pose { radial:number; axial:number; twist:number; wave:number; light:number; rate:number }
/** Each preset authors a different ordering and shaping of ten bounded spatial programs. */
const programs:Record<string,readonly number[]>={
 pulse:[0,1,2,3,4,5,6,7,8,9], 'space-jellyfish':[2,5,6,3,0,7,4,9,8,1], 'alter-ego':[0,6,5,4,7,3,8,1,9,2], 'temple-of-light':[5,0,6,1,4,3,8,2,7,9], 'starfield-warp':[0,9,4,3,1,2,5,6,7,8], torus:[0,1,6,9,4,3,5,7,2,8], 'time-tunnel':[0,6,1,4,8,5,2,7,3,9], 'hypnotic-flower':[0,8,1,7,2,5,4,3,6,9], 'magic-warp':[0,3,4,6,5,2,8,7,1,9], 'disco-waves':[0,5,1,6,3,7,4,9,8,2],
}
export function patternPose(p:Profile,pattern:string,index:number,phase:number,energy:number,width:number):Pose {
 const n=patterns(p).indexOf(pattern), program=programs[p.key]![Math.max(0,n)]!, u=index, theta=phase*Math.PI*2, a=Math.sin(theta-u*6.283), b=Math.cos(theta*2+u*12.566), alt=Math.floor(u*24)%2?-1:1, ridge=Math.pow(.5+.5*a,1+5*(1-width));
 let v:Pose;
 switch(program){
 case 0:v={radial:.16*a,axial:.13*b,twist:.28*a,wave:ridge,light:.65+.3*ridge,rate:1};break;
 case 1:v={radial:.15*alt,axial:.18*a,twist:alt*.7,wave:.5+.5*b,light:.65+.25*alt*a,rate:-1};break;
 case 2:v={radial:.6*energy+.18*a,axial:.12*b,twist:.1*a,wave:ridge,light:.6+.3*energy,rate:.65};break;
 case 3:v={radial:.3*a,axial:.45*b,twist:.8*Math.sin(theta+u*9.42),wave:ridge,light:.6+.4*ridge,rate:1.2};break;
 case 4:v={radial:-.65*(.4+.6*u),axial:-.5*(u-.5),twist:-.4*a,wave:ridge,light:.5+.45*(1-u),rate:.45};break;
 case 5:v={radial:.35*ridge,axial:.45*ridge,twist:.25*a,wave:ridge,light:.45+.55*ridge,rate:1.4};break;
 case 6:v={radial:.32*alt*a,axial:.4*(u-.5),twist:.5*alt*b,wave:.5+.5*b,light:.7+.2*b,rate:.85};break;
 case 7:v={radial:.28*(a+b),axial:.33*a*b,twist:.6*b,wave:Math.abs(a*b),light:.55+.45*Math.abs(a*b),rate:1.3};break;
 case 8:v={radial:-.35*(1-u)+.12*a,axial:.6*(u-.5),twist:.7*u*a,wave:ridge,light:.45+.5*(1-u),rate:p.key==='time-tunnel'?-1:.7};break;
 default:v={radial:.65+.2*a,axial:.55*b,twist:.75*alt*a,wave:ridge,light:.85+.15*ridge,rate:1.6};
 }
 const [r,z,t,w,l,rate]=p.weights; return {radial:v.radial*r,axial:v.axial*z,twist:v.twist*t,wave:v.wave*w,light:v.light*l,rate:v.rate*rate};
}
export function blendedPose(p:Profile,s:ChromaverseState,index:number):Pose {
 const energy=clamp(s.values.bassPressure!+.6*s.values.kickAccent!+.5*s.values.dropAccent!),t=clamp(s.transition),e=t*t*(3-2*t),a=patternPose(p,s.previous,index,s.phase,energy,s.values.width!),b=patternPose(p,s.pattern,index,s.phase,energy,s.values.width!);
 return {radial:mix(a.radial,b.radial,e),axial:mix(a.axial,b.axial,e),twist:mix(a.twist,b.twist,e),wave:mix(a.wave,b.wave,e),light:mix(a.light,b.light,e),rate:mix(a.rate,b.rate,e)};
}
