/** Native screen-space artwork. Geometry remains legible with every effect OFF. */
export const CINEMA2_TRIPPY_BRO_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_pattern, u_previous, u_transition, u_phase;
uniform float u_scale, u_density, u_width, u_amount, u_detail, u_intensity;
uniform float u_bass, u_energy, u_kick, u_snare, u_build, u_drop, u_highs, u_vocal;
uniform float u_split, u_echo;
uniform vec3 u_background, u_cyan, u_blue, u_magenta, u_amber, u_highlight;
out vec4 outColor;
const float PI = 3.14159265359;
float aa;
float stroke(float d, float w) { return 1.0 - smoothstep(w - aa, w + aa, abs(d)); }
vec3 ink(vec3 c, float d, float w) {
  float width = w * 2.0 * u_width;
  float split = u_split * 0.003;
  return c * vec3(stroke(d - split, width), stroke(d, width), stroke(d + split, width));
}
float diamondDistance(vec2 p, float r) { return (abs(p.x) + abs(p.y) - r) * 0.70710678; }
mat2 turn(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
vec3 role(float i) {
  float k = mod(abs(i), 4.0);
  return k < 0.5 ? u_cyan : (k < 1.5 ? u_blue : (k < 2.5 ? u_magenta : u_amber));
}
vec3 jewel(vec2 p, float r) {
  float d = abs(p.x) + abs(p.y);
  return ink(u_magenta, (d-r)*0.70710678, 0.0028)
    + ink(u_amber, (d-r*0.63)*0.70710678, 0.0022)
    + u_highlight * (1.0-smoothstep(r*0.18-aa,r*0.18+aa,d));
}
vec3 lattice(vec2 p, float t, float radius) {
  vec3 light = vec3(0);
  float mask = 1.0-smoothstep(radius-aa,radius+aa,abs(p.x)+abs(p.y));
  float halfCount = floor(u_density*0.5);
  float stepSize = radius / max(halfCount+0.5,1.0);
  float slide = sin(t*0.8) * stepSize * u_amount * 0.8;
  for (int i=-10;i<=10;i++) {
    if (abs(float(i)) > halfCount) continue;
    float offset = float(i)*stepSize;
    float r = mod(float(abs(i)),3.0);
    vec3 a = r<0.5 ? u_cyan : (r<1.5 ? u_blue : u_magenta);
    vec3 b = r<0.5 ? u_blue : (r<1.5 ? u_amber : u_cyan);
    light += ink(a,(p.x+p.y-offset-slide)*0.70710678,0.00165)*mask*0.72;
    light += ink(b,(p.x-p.y-offset+slide)*0.70710678,0.00165)*mask*0.72;
  }
  return light;
}
vec3 scene(vec2 p, float pattern, float t) {
  vec3 light = vec3(0);
  float motion = u_amount*(1.0+u_energy*0.15);
  // Build and bass affect geometry, not simply brightness; authored motion zero is respected.
  p /= 1.0 + motion*(u_bass*0.05-u_build*0.05+u_drop*0.05);
  if (pattern < 0.5) {
    light += lattice(p,t,0.681);
    float tips = smoothstep(0.022,0.036,min(abs(p.x),abs(p.y)));
    vec3 warm = u_amber*vec3(0.95,0.286,1.5);
    light += ink(warm,diamondDistance(p,0.86),0.0025)*tips;
    light += ink(u_amber,diamondDistance(p,0.80),0.0018)*tips*0.72;
    light += ink(u_cyan,diamondDistance(p,0.74),0.0016)*tips*0.48;
    light += ink(u_amber,length(p)-0.685,0.0018)*0.62;
    for (int i=0;i<4;i++) {
      float angle=float(i)*PI*0.5;
      light += jewel(p-vec2(cos(angle),sin(angle))*0.59,0.039);
      vec2 satellite=vec2(cos(angle+PI*0.25),sin(angle+PI*0.25))*0.685;
      light += ink(u_amber,length(p-satellite)-0.016,0.002)*0.85;
    }
    light += jewel(p,0.095)+ink(u_blue,diamondDistance(p,0.14),0.0016)*0.7;
  } else if (pattern < 1.5) {
    // Four nested combs hinge inward, leaving a diamond aperture.
    vec2 q=abs(turn(PI*0.25)*p);
    for (int i=0;i<21;i++) {
      if(float(i)>=u_density) break;
      float r=0.16+float(i)*0.026;
      float hinge=motion*0.025*sin(t+float(i)*0.2);
      float d=max(q.x,q.y)-r-hinge;
      float window=1.0-smoothstep(r*0.67,r*0.83,min(q.x,q.y));
      light+=ink(i%3==0 ? u_cyan : u_amber,d,0.0022)*window;
    }
    light+=lattice(p,-t,0.28)*0.7+jewel(p,0.053);
  } else if (pattern < 2.5) {
    // Four optical fans: radial segments pivot around their own hubs.
    for(int h=0;h<4;h++) {
      vec2 hub=vec2(h%2==0 ? -0.27:0.27,h<2 ? -0.27:0.27);
      vec2 q=p*0.88-hub;
      float radius=length(q);
      float angle=atan(q.y,q.x)+(h%2==0 ? t:-t)*motion*0.48;
      float n=u_density+5.0;
      float spoke=sin(angle*n*0.5)*radius/(n*0.5);
      float fan=step(-0.72,sin(angle+t*motion*0.3));
      float radial=smoothstep(0.075,0.10,radius)*(1.0-smoothstep(0.26,0.29,radius));
      light+=ink(mix(u_cyan,u_highlight,0.45),spoke,0.0022)*radial*fan;
      light+=ink(u_amber,radius-0.31,0.0018)*0.75+jewel(q,0.039);
      light+=ink(u_blue,diamondDistance(q,0.11),0.0017)*0.45;
    }
  } else if(pattern < 3.5) {
    // Crossing arms with moving line packets; open sectors prevent a solid X.
    vec2 q=turn(PI*0.25)*p;
    for(int i=0;i<21;i++) {
      if(float(i)>=u_density) break;
      float offset=(float(i)-floor(u_density*0.5))*0.024;
      float window=1.0-smoothstep(0.42,0.50,max(abs(q.x),abs(q.y)));
      float packet=0.58+0.42*sin((abs(q.x)+abs(q.y))*18.0-t*motion*2.0);
      light+=ink(role(float(i)),q.x-offset,0.0022)*window*packet;
      light+=ink(role(float(i+1)),q.y-offset,0.0022)*window*packet;
    }
    light+=jewel(p,0.065);
    light+=ink(u_amber,diamondDistance(p,0.80),0.0020)*0.65;
  } else if(pattern < 4.5) {
    // Mirrored wave bundle; the curve normals keep stroke weight consistent.
    for(int i=0;i<21;i++) {
      if(float(i)>=u_density) break;
      float k=(float(i)-floor(u_density*0.5))*0.032;
      float a=0.11+motion*0.08;
      float y=k+sin(p.x*8.0+t*motion)*a*cos(p.x*2.0);
      float slope=8.0*a*cos(p.x*8.0+t*motion)*cos(p.x*2.0)-2.0*a*sin(p.x*8.0+t*motion)*sin(p.x*2.0);
      float window=1.0-smoothstep(0.65,0.72,abs(p.x));
      light+=ink(role(float(i)),(p.y-y)/sqrt(1.0+slope*slope),0.0020)*window;
    }
    light+=jewel(p,0.05);
    light+=ink(u_amber,diamondDistance(p,0.79),0.0020)*0.7;
    for(int i=0;i<4;i++) {
      float a=PI*0.25+float(i)*PI*0.5;
      light+=jewel(p-vec2(cos(a),sin(a))*0.46,0.038);
    }
  } else if(pattern < 5.5) {
    // Rotating elliptical lace, with separate crossing families.
    for(int i=0;i<21;i++) {
      if(float(i)>=u_density) break;
      float a=float(i)*PI/u_density+t*motion*0.08;
      vec2 q=turn(a)*p;
      vec2 e=vec2(0.68,0.18+0.025*sin(float(i)+t*motion));
      float d=(length(q/e)-1.0)*min(e.x,e.y);
      light+=ink(role(float(i)),d,0.0018)*0.65;
    }
    light+=jewel(p,0.065);
  } else if(pattern < 6.5) {
    // Diamond contours with an outward ripple and alternating corner windows.
    for(int i=0;i<21;i++) {
      if(float(i)>=u_density) break;
      float r=0.13+float(i)*0.043+motion*0.013*sin(t*1.4-float(i)*0.5);
      float window=0.38+0.62*smoothstep(-0.3,0.3,sin(atan(p.y,p.x)*4.0+float(i)*0.7+t*motion));
      light+=ink(role(float(i)),diamondDistance(p,r),0.0022)*window;
    }
    light+=jewel(p,0.057);
  } else {
    // Fourfold knot: nested lobed contours weave around a dark center.
    float angle=atan(p.y,p.x);
    for(int i=0;i<21;i++) {
      if(float(i)>=u_density) break;
      float r=0.19+float(i)*0.022;
      float wave=0.085*cos(angle*4.0+t*motion*0.7+float(i)*0.13);
      float d=length(p)-r-wave;
      light+=ink(role(float(i)),d,0.0020)*0.8;
    }
    light+=jewel(p,0.045);
  }
  float radius=length(p);
  // Traveling musical packet, opposing snare banks, and optional orbiting detail.
  light+=ink(u_cyan,radius-(0.12+fract(t*0.32)*0.58),0.003)*u_kick*0.7;
  light+=ink(u_magenta,diamondDistance(p,0.48),0.003)*u_snare*smoothstep(0.0,0.1,abs(p.x)-abs(p.y));
  float detail=u_detail*(1.0-u_vocal*0.25);
  if(detail>0.0001) {
    for(int i=0;i<4;i++) {
      float angle=float(i)*PI*0.5+t*motion*0.27;
      vec2 marker=vec2(cos(angle),sin(angle))*0.48;
      light+=ink(u_highlight,length(p-marker)-0.009,0.0020)*detail*(0.6+u_highs*0.4);
    }
    float ticks=stroke(sin(atan(p.y,p.x)*24.0)*radius,0.008);
    light+=ink(u_blue,radius-0.56,0.002)*ticks*detail;
  }
  return light;
}
void main() {
  float span=max(max(u_resolution.x,u_resolution.y),1.0)*1.65*u_scale;
  vec2 p=(2.0*gl_FragCoord.xy-u_resolution)/span;
  aa=1.1/span;
  vec3 light=scene(p,u_pattern,u_phase);
  if(u_transition<0.999) light=mix(scene(p,u_previous,u_phase),light,smoothstep(0.0,1.0,u_transition));
  if(u_echo>0.0001) {
    light+=scene(p*1.10,u_pattern,u_phase-0.3)*u_echo*0.16;
    light+=scene(p*1.20,u_pattern,u_phase-0.6)*u_echo*0.08;
  }
  float contrast=0.82+u_energy*0.12;
  outColor=vec4(clamp(u_background+clamp(light*contrast,0.0,1.0)*u_intensity,0.0,1.0),1.0);
}
`
