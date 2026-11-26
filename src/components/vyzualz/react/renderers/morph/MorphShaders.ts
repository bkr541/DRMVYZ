export const MORPH_VERTEX = `#version 300 es
out vec2 uv;
void main() {
  uv = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}`

// Source coordinates remain independent of output-space temporal transport.
export const MORPH_FRAGMENT = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 color;
uniform sampler2D source, history;
uniform vec2 viewportSize, fitSize, position;
uniform float transformScale, rotation, motion, amount, turbulence, feedback, dotDensity, dotSize, tunnelDepth, twist;
uniform float hit, accent, energy, phase, sourceMix, delta;
uniform int mode, fromMode, pattern, flowDirection, palette;
uniform float modeBlend, complexity, depth, spin, brightness;
const float TAU = 6.28318530718;
vec2 rot(vec2 p,float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c)*p;}
float lum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec4 image(vec2 p){
  if(any(lessThan(p,vec2(0)))||any(greaterThan(p,vec2(1))))return vec4(0);
  return texture(source,p);
}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+phase)*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return .56*noise(p)+.28*noise(rot(p,.71)*2.03)+.11*noise(rot(p,-.37)*4.13)+.05*noise(p*8.27);}
vec2 field(vec2 p){return vec2(fbm(p),fbm(p+vec2(17.4,8.1)))-.5;}
// Analytic curl field: several moving vortices plus a large coherent directional shear.
// Unlike random displacement, its direction remains coherent in space and time.
vec2 flow(vec2 q,float t){
  vec2 v=vec2(0);
  for(int i=0;i<3;i++){
    float j=float(i), f=1.7+2.1*j;
    vec2 a=rot(q,.67*j+phase)*f;
    vec2 d=vec2(cos(a.y+t*(.7+.13*j)+j*2.),-cos(a.x-t*(.45+.17*j)+j));
    v+=rot(d,-.67*j-phase)*(.47/(1.+j));
  }
  vec2 radial=q/max(.06,length(q));
  vec2 directed=vec2(0);
  if(flowDirection==1)directed=vec2(.8,0);
  if(flowDirection==2)directed=vec2(0,.8);
  if(flowDirection==3)directed=radial*.8;
  if(flowDirection==4)directed=vec2(-radial.y,radial.x)*.8;
  return v+directed+radial*sin(length(q)*13.-t*2.5)*hit*.45;
}
vec2 trace(vec2 q,float t,float distance){
  for(int i=0;i<4;i++){
    float j=float(i);
    vec2 v=flow(q,t-j*.10);
    q-=flow(q-v*distance*.125,t-j*.10)*distance*.25;
  }
  return q;
}
vec4 liquid(vec2 p,vec2 metric){
  vec2 q=(p-.5)*metric;
  float t=motion*.80;
  float zoom=1.+amount*amount*(.15+depth*.30+hit*.18);
  q/=zoom;
  float travel=amount*(.16+turbulence*.40+hit*.18);
  vec2 adv=trace(q,t,travel)-trace(vec2(0),t,travel)*.67;
  vec2 f=field(adv*(2.0+3.0*turbulence)+vec2(t*.25,-t*.18));
  vec2 w=field(adv*3.2+f*3.7+vec2(-t*.24,t*.20));
  vec2 fine=field(adv*(5.+complexity*12.)+w*3.+t*.12);
  vec2 point=(adv+(f*.40+w*.51+fine*.11)*amount)/metric+.5;
  vec4 a=image(point);
  // Sample along the local flow, giving bright source colors elongated tendrils.
  vec2 tangent=normalize(flow(adv,t)+vec2(.0001));
  vec4 wake=vec4(0);
  for(int i=1;i<=4;i++){
    float j=float(i);
    vec4 sampleColor=image(point+tangent*j*.022*amount/metric);
    wake=max(wake,sampleColor*(1.-j*.17));
  }
  return max(a,wake*amount*.75);
}
vec4 dots(vec2 p,vec2 metric){
  vec2 q=(p-.5)*metric/(1.+amount*.65);
  float angle=.24+.20*sin(motion*.45)+accent*.26;
  float cells=mix(22.,98.,dotDensity)*mix(.72,1.28,complexity);
  vec2 plane=rot(q,angle);
  // Coherent surface bending instead of per-cell jitter; local cells keep their color.
  vec2 bend=field(plane*2.8+motion*.18)*amount*.33;
  vec2 v=(plane+bend)*cells;
  vec2 local=fract(v)-.5;
  vec2 center=(floor(v)+.5)/cells;
  for(int i=0;i<3;i++)center=(floor(v)+.5)/cells-field(center*2.8+motion*.18)*amount*.33;
  vec4 c=image(rot(center,-angle)/metric+.5);
  float l=lum(c.rgb)/max(.001,c.a);
  float radius=mix(.15,.495,dotSize)*(.83+.17*clamp(l+hit*.45,0.,1.));
  float d=length(local),aa=max(fwidth(d)*.7,.009);
  float coverage=1.-smoothstep(radius-aa,radius+aa,d);
  vec2 xy=local/max(.001,radius);
  vec3 normal=normalize(vec3(xy,sqrt(max(0.,1.-dot(xy,xy))))+vec3(0,0,.001));
  float diffuse=.51+.54*max(0.,dot(normal,normalize(vec3(-.45,.65,1.))));
  float spec=pow(max(0.,dot(normal,normalize(vec3(-.22,.32,1.)))),19.)*.28;
  float rim=smoothstep(.74,1.,d/radius)*.24;
  vec3 rgb=min(c.aaa,c.rgb*(diffuse-rim)+c.rgb*spec);
  return vec4(rgb,c.a)*coverage;
}
// Seamless angular wrapping and periodic radial mapping.  Each repeated band
// samples the source itself, including color variations and its internal detail.
vec4 tunnel(vec2 p,vec2 metric){
  vec2 q=(p-.5)*metric;
  float r=max(length(q),.002), a=atan(q.y,q.x);
  float period=mix(.16,.46,tunnelDepth)*mix(1.2,.75,depth);
  float z=log(r)/period+motion*.53+hit*.14;
  float winding=mix(.22,.87,twist);
  float u=a/TAU+z*winding+motion*.045;
  // Use integer angular winding for a seamless turn around the center.
  float band=fract(z+.12*sin(a+z*.65));
  float x=.5+.48*sin(TAU*u);
  float y=.5+(band-.5)*(.49+.14*amount);
  vec4 c=image(vec2(x,y));
  // Blend the last portion toward the exact first sample of the next radial band.
  float seam=smoothstep(.88,1.,band);
  c=mix(c,image(vec2(x,.5-.5*(.49+.14*amount))),seam);
  float shade=(.80+.20*cos((band-.5)*TAU))*smoothstep(.004,.055,r);
  return vec4(c.rgb*shade,c.a);
}
vec4 transformed(int m,vec2 p,vec2 metric){
  return m==0?liquid(p,metric):m==1?dots(p,metric):tunnel(p,metric);
}
vec3 grade(vec3 rgb,float alpha){
  float l=lum(rgb)/max(.001,alpha);
  vec3 tint=palette==1?mix(vec3(.35,.025,.015),vec3(1.,.65,.19),l):palette==2?mix(vec3(.025,.13,.5),vec3(.5,1.,1.),l):palette==3?mix(vec3(.19,.02,.35),vec3(1.,.5,1.),l):vec3(l);
  if(palette!=0)rgb=tint*l*alpha;
  vec3 adjusted=rgb*mix(.35,1.65,brightness);
  return adjusted*min(1.,alpha/max(.001,max(adjusted.r,max(adjusted.g,adjusted.b))));
}
void main(){
  vec2 q=(uv-.5)*viewportSize-position;
  vec2 p=rot(q,rotation)/max(.01,transformScale)/fitSize+.5;
  vec2 metric=fitSize/min(fitSize.x,fitSize.y);
  vec4 original=image(p);
  if(amount<=.00001){color=original;return;}
  vec2 effectP=rot((p-.5)*metric,spin*motion*.35*amount)/metric+.5;
  // FRACTURED is an authored spatial tear, not a random global shake.
  if(pattern==5){
    vec2 cell=floor(effectP*mix(5.,17.,complexity));
    float impulse=max(hit,accent);
    vec2 offset=vec2(hash(cell)-.5,hash(cell+vec2(3,8))-.5);
    effectP+=offset*amount*(.045+.25*impulse)/metric;
  }
  vec4 fresh=transformed(mode,effectP,metric);
  if(modeBlend<.999 && fromMode!=mode)fresh=mix(transformed(fromMode,effectP,metric),fresh,smoothstep(0.,1.,modeBlend));
  fresh.rgb=grade(fresh.rgb,fresh.a);
  fresh=mix(original,fresh,smoothstep(0.,mode==0?.19:.30,amount));
  vec2 outMetric=viewportSize/min(viewportSize.x,viewportSize.y);
  vec2 h=(uv-.5)*outMetric;
  float stepSize=clamp(delta*60.,0.,3.);
  if(mode==0){
    h=trace(h,motion*.8,stepSize*amount*(.013+.018*turbulence+hit*.009));
    h*=1.-stepSize*.008*amount;
  }else if(mode==2){
    h=rot(h,stepSize*(.008+.016*twist)*amount)*(1.-stepSize*.018*amount);
  }else{
    h=rot(h,stepSize*.003*accent);
  }
  vec2 hu=h/outMetric+.5;
  vec4 old=vec4(0);
  if(all(greaterThanEqual(hu,vec2(0)))&&all(lessThanEqual(hu,vec2(1))))old=texture(history,hu)*feedback;
  // Emissive max-composite carries color from preceding frames, but never from bloom.
  // Halftone retains a clear lattice instead of filling every gap with history.
  float carry=mode==1?.30:mode==2?.76:1.;
  old*=carry*amount;
  vec4 mixed=max(fresh,old*(1.-lum(fresh.rgb)*.18));
  mixed.rgb*=1.+energy*.12+accent*.08;
  mixed.rgb*=min(1.,mixed.a/max(.001,max(mixed.r,max(mixed.g,mixed.b))));
  color=mix(mixed,original,sourceMix);
}`

// Separable, thresholded bloom at reduced resolution.  The first pass reads
// the current image, the second reads the first blur; no feedback of bloom.
export const MORPH_BLUR = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 color;
uniform sampler2D inputImage;
uniform vec2 direction;
uniform int threshold;
vec4 tap(vec2 p){
  vec4 c=texture(inputImage,p);
  if(threshold==1){float m=max(c.r,max(c.g,c.b));c*=smoothstep(.17,.64,m);}
  return c;
}
void main(){
  color=tap(uv)*.227027;
  color+=(tap(uv+direction*1.384615)+tap(uv-direction*1.384615))*.316216;
  color+=(tap(uv+direction*3.230769)+tap(uv-direction*3.230769))*.070270;
}`
export const MORPH_COMPOSITE = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 color;
uniform sampler2D imageTexture, bloomTexture;
uniform float strength;
void main(){
  vec4 c=texture(imageTexture,uv), b=texture(bloomTexture,uv)*strength;
  float alpha=max(c.a,min(1.,max(b.a,max(b.r,max(b.g,b.b)))));
  // Preserve transparency and hue while allowing light into the surrounding space.
  vec3 total=c.rgb+b.rgb;
  color=vec4(total*min(1.,alpha/max(.001,max(total.r,max(total.g,total.b)))),alpha);
}`
