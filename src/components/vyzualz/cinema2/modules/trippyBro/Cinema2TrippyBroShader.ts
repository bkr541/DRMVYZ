/** Reference-led geometric instrument: component motion, staged handoffs and emissive stroke profiles. */
export const CINEMA2_TRIPPY_BRO_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_pattern, u_previous, u_transition, u_phase;
uniform float u_scale, u_density, u_width, u_amount, u_detail, u_intensity;
uniform float u_bass, u_energy, u_kick, u_snare, u_build, u_drop, u_highs, u_vocal;
uniform float u_split, u_echo, u_glow;
uniform vec3 u_background, u_cyan, u_blue, u_magenta, u_amber, u_highlight;
out vec4 outColor;
const float PI=3.14159265359;
const float TAU=6.28318530718;
float aa;
float stroke(float d,float w) { return 1.0-smoothstep(max(0.0,w-aa),w+aa,abs(d)); }
mat2 turn(float a) { return mat2(cos(a),-sin(a),sin(a),cos(a)); }
float segment(vec2 p,vec2 a,vec2 b) {
  vec2 v=b-a; return length(p-a-v*clamp(dot(p-a,v)/max(dot(v,v),0.000001),0.0,1.0));
}
float diamond(vec2 p,float r) { return (abs(p.x)+abs(p.y)-r)*0.70710678; }
float angularDistance(float a,float b) { return abs(atan(sin(a-b),cos(a-b))); }
float pulse(float x,float center,float width) { return exp(-pow((x-center)/width,2.0)); }
vec3 spectral(float x) {
  float band=mod(x,4.0);
  if(band<1.0) return mix(u_cyan,u_blue,smoothstep(0.0,1.0,band));
  if(band<2.0) return mix(u_blue,u_magenta,smoothstep(1.0,2.0,band));
  if(band<3.0) return mix(u_magenta,u_amber,smoothstep(2.0,3.0,band));
  return mix(u_amber,u_cyan,smoothstep(3.0,4.0,band));
}
// Bright cores, colored bodies and controllable soft halos; dark strokes stay dark.
vec3 ink(vec3 c,float d,float w,float drive) {
  float width=w*2.0*u_width;
  float core=stroke(d,width*0.34);
  float split=u_split*0.003;
  vec3 body=vec3(stroke(d-split,width),stroke(d,width),stroke(d+split,width));
  float halo=0.0;
  if(u_glow>0.0001) halo=exp(-pow(abs(d)/(width*2.8+aa),2.0))*u_glow;
  vec3 whiteCore=mix(c,u_highlight,0.58)*core*0.95;
  return (c*body*1.10+whiteCore+c*halo*0.65)*max(0.0,drive);
}
// Local echoes belong to a moving contour; no second complete scene is composited.
vec3 contour(vec3 c,float d,float w,float drive,float displacement) {
  vec3 light=ink(c,d,w,drive);
  if(u_echo>0.0001) {
    light+=ink(c,d+displacement,w*0.62,drive*u_echo*0.18);
    light+=ink(c,d+displacement*2.0,w*0.46,drive*u_echo*0.07);
  }
  return light;
}
float assembly(float form,float rank) { return smoothstep(rank*0.32,rank*0.32+0.46,form); }
vec3 jewel(vec2 p,float size,float drive,float t,float detail) {
  float d=abs(p.x)+abs(p.y);
  float flare=0.65+0.35*pow(0.5+0.5*cos(t*2.2),4.0);
  vec3 light=ink(u_magenta,(d-size)*0.70710678,0.0028,drive);
  light+=ink(u_amber,(d-size*0.65)*0.70710678,0.0022,drive*1.2);
  light+=ink(u_highlight,d*0.70710678,0.0035,drive*flare*1.4);
  float radius=length(p),angle=atan(p.y,p.x);
  float petals=sin(angle*14.0+t*0.5)*radius/14.0;
  float annulus=smoothstep(size*0.65,size*0.85,radius)*(1.0-smoothstep(size*1.04,size*1.30,radius));
  light+=ink(mix(u_cyan,u_highlight,0.65),petals,0.0013,drive*detail*flare)*annulus;
  return light;
}
vec3 grid(vec2 p,float t,float form,float radius,float motion) {
  vec3 light=vec3(0);
  float halfCount=floor(u_density*0.5),spacing=radius/max(halfCount+0.5,1.0);
  float compression=1.0+motion*0.15*sin(t*1.6);
  vec2 q=p*compression;
  float mask=1.0-smoothstep(radius-aa,radius+aa,abs(q.x)+abs(q.y));
  float opening=0.4+0.6*form;
  mask*=1.0-smoothstep(radius*opening-aa,radius*opening+aa,abs(q.x)+abs(q.y));
  for(int i=-10;i<=10;i++) {
    if(abs(float(i))>halfCount) continue;
    float offset=float(i)*spacing;
    float rank=abs(float(i))/max(halfCount,1.0);
    float draw=assembly(form,rank);
    float slide=motion*spacing*0.8*sin(t*1.7);
    float along=(q.x-q.y)*0.70710678;
    float highlight=pulse(along,sin(t*1.4+float(i)*0.15)*0.6,0.13);
    float occupancy=0.28+0.72*(0.5+0.5*cos(float(i)*0.47-t*1.5));
    light+=ink(spectral(rank*2.2+along*0.7),(q.x+q.y-offset-slide)*0.70710678,0.00165,draw*occupancy*(0.5+highlight))*mask;
    light+=ink(spectral(3.0-rank*1.8-along*0.8),(q.x-q.y-offset+slide)*0.70710678,0.00165,draw*(0.48+highlight*0.7))*mask;
  }
  return light;
}
vec3 borders(vec2 p,float t,float form,float motion) {
  vec3 light=vec3(0);
  float tips=smoothstep(0.018,0.034,min(abs(p.x),abs(p.y)));
  vec3 warm=u_amber*vec3(0.95,0.286,1.5);
  for(int i=0;i<3;i++) {
    float r=0.74+float(i)*0.06+motion*0.018*sin(t*1.2-float(i)*0.6);
    float gate=assembly(form,float(i)*0.28);
    light+=contour(i==2 ? warm : (i==1 ? u_amber:u_cyan),diamond(p,r),0.0021,gate*0.8,motion*0.015)*tips;
  }
  return light;
}
vec3 latticeFamily(vec2 p,float t,float form,float motion) {
  vec3 light=grid(p,t,form,0.681,motion)+borders(p,t,form,motion);
  float wave=0.5+0.5*sin(t*1.8);
  // Square/diamond collars rotate through each other, with a traveling illuminated edge.
  for(int i=0;i<6;i++) {
    float rank=float(i)/5.0;
    float angle=motion*(0.12*sin(t)+rank*0.23*sin(t*0.8));
    vec2 q=turn(angle)*p;
    float r=0.40+rank*0.14;
    float d=max(abs(q.x),abs(q.y))-r;
    float travel=0.18+0.82*pow(0.5+0.5*cos(atan(q.y,q.x)*2.0-t*2.2+rank),3.0);
    light+=contour(spectral(rank*2.0+1.0),d,0.0015,assembly(form,rank)*motion*wave*travel*0.68,motion*0.012);
  }
  light+=ink(u_amber,length(p)-0.685,0.0018,assembly(form,0.6)*(0.35+wave*0.55));
  for(int i=0;i<4;i++) {
    float a=float(i)*PI*0.5;
    float reach=0.59*(0.55+0.45*assembly(form,0.8));
    light+=jewel(p-vec2(cos(a),sin(a))*reach,0.039,form*(0.8+wave),t+float(i)*0.3,u_detail);
    vec2 node=vec2(cos(a+PI*0.25),sin(a+PI*0.25))*0.685;
    light+=jewel(p-node,0.018,form*u_detail,t+float(i),1.0);
  }
  return light;
}
vec3 foldedFamily(vec2 p,float t,float form,float motion) {
  vec3 light=vec3(0);
  vec2 q=turn(PI*0.25)*p;
  float fold=0.5+0.5*sin(t*2.4);
  for(int i=0;i<21;i++) {
    if(float(i)>=u_density) break;
    float rank=float(i)/max(u_density-1.0,1.0);
    float draw=assembly(form,rank);
    float r=0.14+rank*0.47+motion*0.055*sin(t*2.4-rank*2.0);
    float gap=r*mix(0.48,0.82,fold);
    vec2 a=vec2(-gap,r),b=vec2(gap,r);
    float d=min(min(segment(q,a,b),segment(q,-a,-b)),min(segment(q,a.yx,b.yx),segment(q,-a.yx,-b.yx)));
    float sweep=0.18+0.82*pow(0.5+0.5*cos(rank*4.0-t*3.0),2.0);
    light+=contour(mix(u_amber,spectral(rank*1.4),0.18),d,0.0022,draw*(0.5+sweep),motion*0.012);
  }
  light+=grid(p,-t,form,0.29,motion)*0.65;
  // A colored X appears through the combs before the fan handoff.
  float cross=motion*smoothstep(0.55,0.95,fold)*form;
  light+=ink(u_cyan,segment(p,vec2(-0.28),vec2(0.28)),0.007,cross);
  light+=ink(u_blue,segment(p,vec2(-0.28,0.28),vec2(0.28,-0.28)),0.007,cross);
  return light;
}
vec3 fansFamily(vec2 p,float t,float form,float motion) {
  vec3 light=vec3(0);
  float cycle=0.5+0.5*sin(t*2.1);
  float dark=motion*smoothstep(0.75,0.98,0.5+0.5*sin(t*1.05));
  float fanLight=1.0-dark*0.94;
  for(int h=0;h<4;h++) {
    vec2 hub=vec2(h%2==0 ? -0.27:0.27,h<2 ? -0.27:0.27);
    hub*=mix(0.38,1.0,form);
    vec2 q=p*0.88-hub;
    float radius=length(q),angle=atan(q.y,q.x);
    float direction=h%2==0 ? 1.0:-1.0;
    float spin=t*direction*1.6;
    float aperture=mix(0.48,2.4,cycle)*motion+0.5*(1.0-motion);
    float count=u_density+7.0;
    // Evaluate the nearest angular segment analytically (constant work per fan).
    float rank=floor((angle+PI)/TAU*count+0.5)/count;
    float a=rank*TAU-PI;
    float sector=1.0-smoothstep(aperture,aperture+0.2,angularDistance(a,spin));
    float reach=mix(0.24,0.13+0.14*(0.5+0.5*sin(rank*TAU*2.0+t*1.9)),motion);
    float draw=assembly(form,fract(rank)*0.5);
    vec2 endpoint=vec2(cos(a),sin(a))*reach*draw;
    vec2 origin=vec2(cos(a),sin(a))*0.075;
    float d=segment(q,origin,endpoint);
    float drive=(0.05+sector*1.35)*fanLight*draw;
    light+=ink(mix(u_cyan,u_highlight,0.52),d,0.0022,drive);
    float wedge=(1.0-smoothstep(0.07,0.12,angularDistance(angle,a)))
      *smoothstep(0.08,0.11,radius)*(1.0-smoothstep(reach-0.025,reach,radius));
    light+=mix(u_cyan,u_highlight,0.6)*wedge*sector*cycle*motion*fanLight*0.16*draw;
    light+=contour(u_amber,radius-0.31,0.0018,form*0.62,motion*0.009);
    light+=jewel(q,0.039,form*(0.5+fanLight*1.4),t+float(h),u_detail);
    // Connecting diagonals survive the shutter's near-black phase.
    light+=ink(u_highlight,segment(p*0.88,hub,vec2(0)),0.0016,form*(0.12+dark*0.85));
  }
  float connection=form*u_detail*(0.25+cycle*0.6);
  light+=ink(u_amber,diamond(p,0.52+motion*0.025*sin(t*2.0)),0.002,connection);
  return light;
}
vec3 crossFamily(vec2 p,float t,float form,float motion) {
  vec3 light=borders(p,t,form,motion)*0.32;
  vec2 q=turn(PI*0.25)*p;
  float opening=mix(0.25,1.0,form);
  float expansion=0.5+0.5*sin(t*2.3);
  float reach=(0.18+motion*0.33*expansion+(1.0-motion)*0.22)*opening;
  // Broad luminous ribbon arms with narrow cores and moving spectral shoulders.
  for(int arm=0;arm<2;arm++) {
    vec2 v=arm==0 ? q:q.yx;
    float d=segment(v,vec2(0,-reach),vec2(0,reach));
    float packet=0.4+0.6*pulse(abs(v.y),fract(t*0.8)*0.6,0.13);
    light+=ink(arm==0 ? u_cyan:u_blue,d,0.008,form*packet*2.4);
    for(int i=0;i<10;i++) {
      if(float(i)>=u_density*0.5) break;
      float rank=float(i)/10.0,r=0.04+rank*0.42;
      float gate=assembly(form,rank)*(0.3+0.7*pow(0.5+0.5*cos(rank*7.0-t*3.0),3.0));
      float path=segment(v,vec2(-r,-r*0.65),vec2(0,-r));
      path=min(path,segment(v,vec2(0,-r),vec2(r,-r*0.65)));
      path=min(path,segment(-v,vec2(-r,-r*0.65),vec2(0,-r)));
      path=min(path,segment(-v,vec2(0,-r),vec2(r,-r*0.65)));
      light+=contour(spectral(rank*3.0+float(arm)),path,0.0018,gate,motion*0.015);
    }
  }
  for(int i=0;i<2;i++) light+=jewel(p-vec2(i==0 ? -0.50:0.50,0),0.027,form*u_detail,t+float(i),1.0);
  return light;
}
vec3 weaveFamily(vec2 p,float t,float form,float motion) {
  vec3 light=borders(p,t,form,motion)*0.48;
  float shift=motion*0.65*sin(t*1.5);
  float lengthLimit=mix(0.16,0.64,form);
  // Two mirrored curve families meet at the same center and pinch toward four lobes.
  for(int i=0;i<21;i++) {
    if(float(i)>=u_density) break;
    float k=(float(i)-floor(u_density*0.5))/max(u_density*0.5,1.0);
    float a=0.14+0.09*motion*sin(t*1.6);
    float envelope=exp(-p.x*p.x*6.0);
    float y=k*a*envelope*sin(p.x*7.0+shift)+k*0.035;
    float dy=k*a*envelope*(7.0*cos(p.x*7.0+shift)-12.0*p.x*sin(p.x*7.0+shift));
    float mask=1.0-smoothstep(lengthLimit-0.035,lengthLimit,abs(p.x));
    float gate=assembly(form,abs(k)*0.5);
    light+=contour(spectral(float(i)*0.19+p.x*0.6),(p.y-y)/sqrt(1.0+dy*dy),0.0017,gate*mask,motion*0.008);
    float ey=exp(-p.y*p.y*6.0);
    float x=k*a*ey*sin(p.y*7.0-shift)+k*0.035;
    float dx=k*a*ey*(7.0*cos(p.y*7.0-shift)-12.0*p.y*sin(p.y*7.0-shift));
    mask=1.0-smoothstep(lengthLimit-0.035,lengthLimit,abs(p.y));
    light+=contour(spectral(float(i)*0.19+1.8-p.y*0.6),(p.x-x)/sqrt(1.0+dx*dx),0.0017,gate*mask*0.82,-motion*0.008);
  }
  for(int i=0;i<4;i++) {
    float a=PI*0.25+float(i)*PI*0.5;
    vec2 center=vec2(cos(a),sin(a))*(0.40+motion*0.04*sin(t*2.0));
    light+=jewel(p-center,0.034,form*(0.75+u_detail),t+float(i)*0.5,u_detail);
  }
  return light;
}
vec3 variationFamily(vec2 p,float pattern,float t,float form,float motion) {
  // Supplemental looks share the reference's lighting, anchors and occupancy choreography.
  vec3 light=vec3(0);
  if(pattern<5.5) {
    for(int i=0;i<21;i++) {
      if(float(i)>=u_density) break;
      float rank=float(i)/u_density;
      vec2 q=turn(rank*PI+t*0.22)*p;
      vec2 axes=vec2(0.68,0.15+0.06*sin(t*1.4+rank*TAU));
      float d=(length(q/axes)-1.0)*min(axes.x,axes.y);
      float gate=assembly(form,rank)*(0.15+0.85*pow(0.5+0.5*cos(rank*TAU-t*2.0),2.0));
      light+=contour(spectral(rank*4.0),d,0.0018,gate,motion*0.012);
    }
  } else if(pattern<6.5) {
    for(int i=0;i<21;i++) {
      if(float(i)>=u_density) break;
      float rank=float(i)/u_density;
      float r=0.12+rank*0.66+motion*0.045*sin(t*2.8-rank*5.0);
      float gate=assembly(form,rank)*(0.12+0.88*pow(0.5+0.5*cos(rank*8.0-t*3.0),2.0));
      light+=contour(spectral(rank*3.2),diamond(p,r),0.0022,gate,motion*0.018);
    }
  } else {
    float a=atan(p.y,p.x);
    for(int i=0;i<21;i++) {
      if(float(i)>=u_density) break;
      float rank=float(i)/u_density;
      float r=0.15+rank*0.41;
      float d=length(p)-r-(0.04+motion*0.06)*cos(a*4.0+t*1.4+rank);
      float gate=assembly(form,rank)*(0.18+0.82*pow(0.5+0.5*cos(a*2.0+t*1.4-rank*3.0),2.0));
      light+=contour(spectral(rank*3.6),d,0.0020,gate,motion*0.012);
    }
  }
  return light;
}
vec3 scene(vec2 p,float pattern,float t,float form,float motion) {
  // Outgoing components retract to the center; incoming banks unfold at staggered ranks.
  p/=mix(0.70,1.0,form);
  p/=1.0+u_amount*(u_bass*0.05-u_build*0.05+u_drop*0.05);
  if(pattern<0.5) return latticeFamily(p,t,form,motion);
  if(pattern<1.5) return foldedFamily(p,t,form,motion);
  if(pattern<2.5) return fansFamily(p,t,form,motion);
  if(pattern<3.5) return crossFamily(p,t,form,motion);
  if(pattern<4.5) return weaveFamily(p,t,form,motion);
  return variationFamily(p,pattern,t,form,motion);
}
void main() {
  float span=max(max(u_resolution.x,u_resolution.y),1.0)*1.65*u_scale;
  vec2 p=(2.0*gl_FragCoord.xy-u_resolution)/span;
  aa=1.1/span;
  float motion=min(u_amount/0.45,1.7);
  float t=u_phase*motion;
  float pattern=u_pattern,form=1.0;
  if(u_transition<1.0) {
    // Never dissolve two complete drawings. One family withdraws, an anchor remains, the next unfolds.
    if(u_transition<0.43) { pattern=u_previous; form=1.0-smoothstep(0.0,0.43,u_transition); }
    else { form=smoothstep(0.43,1.0,u_transition); }
  }
  vec3 light=scene(p,pattern,t,form,motion);
  float anchorSize=pattern<0.5 ? 0.095:0.052;
  anchorSize=mix(0.035,anchorSize,form);
  light+=jewel(p,anchorSize,0.8+u_kick*0.8+u_drop*0.5,t,u_detail);
  // Musical accents illuminate paths of the current family, never a disconnected particle blanket.
  float accents=form*(u_kick*0.8+u_snare*0.65);
  light+=ink(u_cyan,diamond(p,0.20+u_kick*0.32),0.0025,accents);
  float detail=u_detail*(1.0-u_vocal*0.25)*form;
  if(detail>0.0001) {
    float a=t*0.8;
    for(int i=0;i<4;i++) {
      float angle=a+float(i)*PI*0.5;
      float r=pattern<0.5 ? 0.685:0.47;
      vec2 node=vec2(cos(angle),sin(angle))*r;
      light+=jewel(p-node,0.013,detail*(0.8+u_highs),t+float(i),1.0);
    }
  }
  // Tone-map accumulated emission once, retaining hue separation and black gaps.
  vec3 emission=vec3(1.0)-exp(-light*(0.95+u_energy*0.10));
  outColor=vec4(clamp(u_background+emission*u_intensity,0.0,1.0),1.0);
}
`
