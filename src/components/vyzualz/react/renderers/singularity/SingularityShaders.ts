// Single-context GPU pipeline: atmospheric pass, instanced geometry, media, particles, foreground, bloom.
export const SINGULARITY_QUAD = `#version 300 es
precision highp float;
out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`
const COMMON = `
float hash(float n){return fract(sin(n*12.9898+seed*.013)*43758.5453);}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
float lum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float n=i.x+i.y*57.;return mix(mix(hash(n),hash(n+1.),f.x),mix(hash(n+57.),hash(n+58.),f.x),f.y);}
float fbm(vec2 p){float v=0.,w=.5;for(int j=0;j<4;j++){v+=w*noise2(p);p=rot(.5)*p*2.1;w*=.5;}return v;}
`
const UNIFORMS = `
uniform float seed,motion,age,energy,hit,accent,force,dissolve,glitch,depth,turbulence,camera,fragmentSize,background,particleDensity;
uniform int pattern,mode,ribbons,preserveColors;
uniform vec2 size,fit,position;
uniform float scale,rotation;
uniform vec3 tint;
uniform sampler2D source;
`
const SOURCE = `
vec2 sourcePoint(vec2 q){return rot(rotation)*((q-.5)*fit*scale)+position;}
vec2 sourceUV(vec2 p){return rot(-rotation)*(p-position)/max(fit*scale,vec2(.0001))+.5;}
float threshold(vec2 q){
 float r=length(q-.5)*1.414;
 if(pattern==1 || pattern==2) return clamp(r*.85+.12*hash(floor(q.x*20.)+floor(q.y*20.)*23.),0.,1.);
 if(pattern==4 || pattern==6) return clamp(1.-r,0.,1.);
 if(pattern==5) return q.y;
 if(pattern==7) return hash(floor(q.x*12.)+floor(q.y*12.)*13.);
 if(pattern==8) return (sin(q.x*9.+q.y*8.)+1.)*.5;
 if(pattern==9) return 1.-q.x;
 return q.x;
}
float removed(vec2 q){return dissolve<=.001?0.:smoothstep(threshold(q)*.88+.02,threshold(q)*.88+.12,dissolve);}
vec3 mediaColor(vec4 c){
 if(preserveColors==1 || mode==1) return c.rgb;
 if(mode==2) return mix(tint*.45,tint+vec3(.3),lum(c.rgb))*(.72+.28*sin(age*7.));
 return mix(c.rgb,tint*.4+vec3(.68),.82)*(.9+hit*.25);
}
`
export const SINGULARITY_ATMOSPHERE = `#version 300 es
precision highp float;
in vec2 uv;out vec4 color;
${UNIFORMS}${COMMON}
void main(){
 vec2 p=(uv-.5)*vec2(size.x/size.y,1.);p+=camera*.055*vec2(sin(motion*.61),cos(motion*.43));
 float r=length(p),a=atan(p.y,p.x);float t=motion*.34;
 vec2 flow=rot(t*.35)*p;vec2 warp=vec2(fbm(flow*5.+t*.12),fbm(flow*5.-t*.14+8.));float cloud=fbm(flow*9.+warp*4.);
 vec3 c=vec3(.005,.012,.019)+tint*(.012+.19*pow(cloud,2.))*exp(-r*1.9);
 for(int i=0;i<14;i++){if(i>=ribbons)break;float k=float(i);float angle=a+sin(r*7.+t+k)*(.32+turbulence*.7)+(warp.x-.5)*1.9;float wave=sin(angle*(2.+mod(k,3.))+r*(10.+k*.8)-t*(.5+force)+k*2.1);float strand=exp(-pow(wave*(3.+k*.35),2.))*(.2+.8*cloud);float fade=smoothstep(.10,.38,r)*(1.-smoothstep(.72,1.2,r));c+=tint*strand*fade*(.025+.12*hash(k+13.))*(1.+energy+hit);}
 float shock=exp(-pow((r-(.13+(1.-hit)*.82))*38.,2.))*hit;
 if(pattern==6) shock+=pow(max(0.,cos(r*36.-motion*5.)),12.)*.19;
 c+=tint*shock*.24; c*=1.-smoothstep(.65,1.35,r)*.72;
 color=vec4(c*background,background);
}`
export const SINGULARITY_MEDIA = `#version 300 es
precision highp float;
in vec2 uv;out vec4 color;
${UNIFORMS}${COMMON}${SOURCE}
void main(){
 vec2 q=sourceUV((uv-.5)*size);float band=floor(q.y*43.);float noise=hash(band+floor(age*13.)*53.);
 float tear=step(1.-glitch*.8,noise)*glitch;
 q.x+=(hash(band+21.)-.5)*tear*.42;
 if(any(lessThan(q,vec2(0.)))||any(greaterThan(q,vec2(1.))))discard;
 vec4 c=texture(source,q);float alpha=c.a*(1.-removed(q));
 if(mode==3)alpha*=.09;
 if(mode==2)alpha*=.45+.35*smoothstep(-.5,.5,sin(q.y*900.-motion*8.));
 if(pattern==3){if(tear>.38)alpha*=.12;alpha*=1.-smoothstep(.38,.8,glitch)*pow(max(0.,sin(age*11.)),6.);}
 if(pattern==7 && tear>.3){vec2 block=floor(q*vec2(75.,40.))/vec2(75.,40.);c=texture(source,block);alpha=min(alpha,c.a);}
 vec3 col=mediaColor(c);float split=tear*.021;
 if((pattern==3||pattern==7)&&tear>.15){vec2 eq=q+vec2((hash(band+8.)-.5)*tear*.18,0.);vec4 echo=texture(source,eq);float ea=echo.a*tear*.25;col=mix(col,mediaColor(echo),ea);alpha=max(alpha,ea*(1.-removed(eq)));}
 if(split>.001){col.r=mix(col.r,texture(source,q+vec2(split,0.)).r,.65);col.b=mix(col.b,texture(source,q-vec2(split,0.)).b,.65);}
 color=vec4(col*alpha,alpha);
}`
export const SINGULARITY_FRAGMENTS_VERTEX = `#version 300 es
precision highp float;
${UNIFORMS}${COMMON}
uniform int zone;
out vec3 vColor;out float vAlpha;out vec3 bary;
void main(){
 float id=float(gl_InstanceID)+float(zone)*1009.;float z=hash(id+17.);float a=hash(id+1.)*6.283+motion*(.15+z*.42)*(pattern==8?cos(age*.7):1.);
 float r=.25+pow(hash(id+2.),1.2)*.81; r+=force*(hit*.38+sin(motion+r*5.)*.065);
 if(pattern==5)a+=r*2.;if(pattern==2)r*=1.-dissolve*.55;
 vec3 center=vec3(cos(a)*r,sin(a)*r*.69,(z-.5)*.65*depth+float(zone-1)*.52*depth);
 center.xy+=turbulence*.11*vec2(sin(motion*1.2+id),cos(motion*.9+id*1.3));
 float pitch=hash(id+4.)*6.28+motion*(.3+z), yaw=hash(id+5.)*6.28+motion*.35;
 vec2 corner=gl_VertexID==0?vec2(-.7,-.55):gl_VertexID==1?vec2(.8,-.38):vec2(.05,.95);
 float s=(.009+pow(hash(id+3.),2.)*.10)*(.45+fragmentSize*1.5)*(zone==2?1.45:1.);
 vec3 local=vec3(rot(yaw)*corner*s,0.);local.yz=rot(pitch)*local.yz;
 vec3 p=center+local; p.xz=rot(camera*.24*sin(motion*.43))*p.xz;
 p.xy-=camera*.09*vec2(sin(motion*.53),cos(motion*.39));
 float perspective=1.5/max(.52,1.65-p.z-camera*hit*.15);
 gl_Position=vec4(p.xy*perspective*vec2(2.*size.y/size.x,2.),0.,1.);
 float flash=pow(max(0.,cos(a*3.-motion*3.)),8.)*(hit+accent*.45);float glint=pow(max(0.,sin(pitch+yaw)),12.)*pow(z,3.);
 vColor=tint*(.28+z*.78+flash+glint*.75)+vec3(.11,.15,.18)*z;vAlpha=(.05+z*.39)*(zone==0?.6:1.)*(1.+hit*.4)*background;
 bary=gl_VertexID==0?vec3(1,0,0):gl_VertexID==1?vec3(0,1,0):vec3(0,0,1);
}`
export const SINGULARITY_FRAGMENTS_PIXEL = `#version 300 es
precision highp float;
in vec3 vColor;in float vAlpha;in vec3 bary;out vec4 color;
void main(){float e=min(bary.x,min(bary.y,bary.z));float edge=1.-smoothstep(.008,.045,e);float facet=.72+.28*bary.x;float a=clamp(vAlpha*(1.3+edge*.35),0.,.78);color=vec4(vColor*a*(facet+edge*.28),a);}`
export const SINGULARITY_PARTICLES_VERTEX = `#version 300 es
precision highp float;
${UNIFORMS}${COMMON}${SOURCE}
uniform vec2 grid;uniform float pixelRatio,trail;
out vec4 vColor;
void main(){
 float id=float(gl_VertexID);vec2 cell=vec2(mod(id,grid.x),floor(id/grid.x));
 vec2 q=(cell+vec2(.2+.6*hash(id+1.),.2+.6*hash(id+2.)))/grid;
 vec4 c=texture(source,q);float removal=removed(q);float show=mode==3?1.:removal;
 vec2 p=sourcePoint(q);vec2 from=p-position;vec2 dir=normalize(from+vec2(.001));float h=hash(id+4.);
 vec2 wind=vec2(sin(q.y*17.+motion+id*.023),cos(q.x*15.-motion+id*.019));
 vec2 displacement=(dir*force*(.12+h*.55)+wind*(.08+turbulence*.18))*size.y;
 if(pattern==0||pattern==3)displacement=vec2(.18+h*.4,wind.y*.22)*size.y;
 if(pattern==5)displacement=vec2(wind.x*.3,-.45-h*.35)*size.y;
 if(pattern==7)displacement=vec2(sign(wind.x)*.36,sign(wind.y)*.12)*size.y;
 if(pattern==8)displacement=rot(motion*.7)*dir*size.y*.5;
 if(pattern==9)displacement=vec2(-.4-h*.3,wind.y*.28)*size.y;
 p+=displacement*removal*(.35+dissolve)*(.6+.4*h)*(1.-trail*.24);
 gl_Position=vec4(p/size*2.,0.,1.);
 gl_PointSize=clamp(pixelRatio*(.8+h*1.9)*(1.+hit*.45),1.,7.);
 float a=c.a*show*(.65+.35*h)*(1.-trail*.85);vColor=vec4(mediaColor(c)*a,a);
}`
export const SINGULARITY_PARTICLES_PIXEL = `#version 300 es
precision highp float;
in vec4 vColor;out vec4 color;
void main(){float a=1.-smoothstep(.12,.5,length(gl_PointCoord-.5));color=vColor*a;}`
// Separate low-resolution selective bloom from the clean media and scene.
export const SINGULARITY_BLUR = `#version 300 es
precision highp float;in vec2 uv;out vec4 color;
uniform sampler2D imageTexture;uniform vec2 direction;uniform int threshold;
vec3 sampleGlow(vec2 p){vec3 c=texture(imageTexture,p).rgb;return threshold==1?c*smoothstep(.23,.85,max(c.r,max(c.g,c.b))):c;}
void main(){vec3 c=sampleGlow(uv)*.227027;c+=(sampleGlow(uv+direction*1.3846)+sampleGlow(uv-direction*1.3846))*.316216;c+=(sampleGlow(uv+direction*3.2308)+sampleGlow(uv-direction*3.2308))*.07027;color=vec4(c,1.);}`
export const SINGULARITY_COMPOSITE = `#version 300 es
precision highp float;in vec2 uv;out vec4 color;uniform sampler2D imageTexture,bloomTexture;uniform float glow;
void main(){vec4 c=texture(imageTexture,uv);vec3 b=texture(bloomTexture,uv).rgb*glow;vec3 rgb=min(c.rgb+b,vec3(1.));color=vec4(rgb,max(c.a,max(rgb.r,max(rgb.g,rgb.b))));}`
