import { HONEY_GRID_RADIUS,HONEY_PITCH } from './Cinema2HoneyDomain'
import { HONEY_MATERIAL_GLSL } from './Cinema2HoneyMaterials'
import { HONEY_CHANNEL_POWER,HONEY_LIGHT_OFFSET_GLSL,HONEY_SPILL_LIMIT,HONEY_SPILL_RADIUS } from './Cinema2HoneyLighting'

const HONEY_POSE_GLSL=`
mat3 honeyRotation(vec3 a){
  float sx=sin(a.y),cx=cos(a.y),sy=sin(a.z),cy=cos(a.z),sz=sin(a.x),cz=cos(a.x);
  return mat3(cz,sz,0.0,-sz,cz,0.0,0.0,0.0,1.0)*mat3(cy,0.0,-sy,0.0,1.0,0.0,sy,0.0,cy)*mat3(1.0,0.0,0.0,0.0,cx,sx,0.0,-sx,cx);
}
`
export const HONEY_VERTEX=`#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec2 a_part;
layout(location=3) in vec4 i_cell;
layout(location=4) in vec2 i_finish;
layout(location=5) in vec4 i_light0;
layout(location=6) in vec4 i_light1;
layout(location=7) in vec4 i_light2;
layout(location=8) in vec4 i_light3;
layout(location=9) in vec4 i_light4;
layout(location=10) in vec4 i_light5;
layout(location=11) in vec4 i_light6;
layout(location=12) in vec3 i_angles;
layout(location=13) in vec2 i_offset;
uniform mat4 u_viewProjection;
${HONEY_POSE_GLSL}
out vec3 v_local;
out vec3 v_world;
out vec3 v_normal;
flat out int v_role;
flat out float v_moving;
flat out vec4 v_cell;
flat out vec2 v_finish;
flat out vec4 v_lights[7];
void main(){
  v_local=a_position;
  mat3 rotation=honeyRotation(i_angles);
  v_world=mix(a_position,rotation*a_position+vec3(i_offset,i_cell.z),a_part.y)+vec3(i_cell.xy,0.0);
  gl_Position=u_viewProjection*vec4(v_world,1.0);
  v_normal=mix(a_normal,rotation*a_normal,a_part.y);v_role=int(a_part.x+0.5);v_moving=a_part.y;
  v_cell=i_cell;v_finish=i_finish;
  v_lights[0]=i_light0;
  v_lights[1]=i_light1;
  v_lights[2]=i_light2;
  v_lights[3]=i_light3;
  v_lights[4]=i_light4;
  v_lights[5]=i_light5;
  v_lights[6]=i_light6;
}`
export const HONEY_SHADOW_VERTEX=`#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=2) in vec2 a_part;
layout(location=3) in vec4 i_cell;
layout(location=12) in vec3 i_angles;
layout(location=13) in vec2 i_offset;
uniform mat4 u_viewProjection;
${HONEY_POSE_GLSL}
void main(){gl_Position=u_viewProjection*vec4(mix(a_position,honeyRotation(i_angles)*a_position+vec3(i_offset,i_cell.z),a_part.y)+vec3(i_cell.xy,0.0),1.0);}`
export const HONEY_SHADOW_FRAGMENT=`#version 300 es
precision highp float;
void main(){}`

export const HONEY_FRAGMENT=`#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 v_local;
in vec3 v_world;
in vec3 v_normal;
flat in int v_role;
flat in float v_moving;
flat in vec4 v_cell;
flat in vec2 v_finish;
flat in vec4 v_lights[7];
uniform vec3 u_palette[7]; // linear RGB; output encoded for shared HDR bloom
uniform vec3 u_gain;
uniform float u_spill;
uniform float u_detailQuality;
uniform vec3 u_ambient;
uniform vec3 u_key;
uniform vec3 u_lightDir;
uniform vec3 u_eye;
uniform sampler2DShadow u_shadow;
uniform highp sampler2D u_poses;
${HONEY_POSE_GLSL}
uniform mat4 u_shadowMatrix;
uniform vec3 u_shadowSettings; // enabled, normalized bias, inverse resolution
out vec4 outColor;
const vec4 finishes[4]=vec4[4](${HONEY_MATERIAL_GLSL});
const vec2 offsets[7]=vec2[7](${HONEY_LIGHT_OFFSET_GLSL});
const vec3 power=vec3(${HONEY_CHANNEL_POWER.join(',')});
const float PI=3.14159265359;
float hexRadius(vec2 p){p=abs(p);return max(p.y,dot(p,vec2(.8660254,.5)));}
// Select the nearest hex side once per source, then project onto its finite segment.
vec2 ringNormal(vec2 p){
  vec2 a=vec2(0.0,1.0),b=vec2(.8660254,.5),c=vec2(-.8660254,.5);
  float da=dot(a,p),db=dot(b,p),dc=dot(c,p);
  vec2 n=abs(da)>abs(db)?a:b;
  if(abs(dc)>abs(dot(n,p)))n=c;
  return dot(n,p)<0.0?-n:n;
}
vec2 ringPoint(vec2 p,vec2 n,float radius){
  vec2 t=vec2(-n.y,n.x);
  return n*(radius*.8660254)+t*clamp(dot(p,t),-radius*.5,radius*.5);
}
float filteredWave(float x){return sin(x)*(1.0-smoothstep(.55,3.14,fwidth(x)));}
float grain(vec2 p,float seed,int finish){
  // Keep the four authored material identities at low tier, but omit secondary fine waves.
  if(u_detailQuality<.5){
    if(finish==2){vec2 uv=mat2(.707,-.707,.707,.707)*p;return .09*filteredWave(uv.x*47.0)*filteredWave(uv.y*47.0);}
    if(finish==1)return .06*filteredWave(p.y*155.0+seed*20.0);
    if(finish==3)return .004*filteredWave(p.x*173.0);
    return .02*filteredWave(p.y*155.0+seed*20.0);
  }
  float a=filteredWave(p.y*155.0+seed*20.0+2.0*filteredWave(p.x*11.0));
  float b=filteredWave(p.y*370.0+seed*47.0);
  if(finish==1)return .075*a+.035*b+.032*filteredWave(p.y*43.0+seed*5.0);
  if(finish==2){vec2 uv=mat2(.707,-.707,.707,.707)*p;return .14*filteredWave(uv.x*47.0)*filteredWave(uv.y*47.0)+.035*filteredWave((uv.x+uv.y)*94.0);}
  if(finish==3)return .009*filteredWave(p.x*173.0)*filteredWave(p.y*137.0);
  return .024*a+.017*filteredWave(p.x*191.0+p.y*53.0);
}
float shadowVisibility(vec3 N){
  if(u_shadowSettings.x<.5)return 1.0;
  vec4 clip=u_shadowMatrix*vec4(v_world,1.0);
  vec3 uv=clip.xyz/clip.w*.5+.5;
  if(any(lessThan(uv,vec3(0.0)))||any(greaterThan(uv,vec3(1.0))))return 1.0;
  float bias=u_shadowSettings.y*(1.0+1.5*(1.0-max(dot(N,u_lightDir),0.0)));
  float s=0.0;
  bool reduced=u_detailQuality<1.5;
  for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
    if(reduced&&x!=0&&y!=0)continue;
    s+=texture(u_shadow,vec3(uv.xy+vec2(x,y)*u_shadowSettings.z,uv.z-bias));
  }
  return s/(reduced?5.0:9.0);
}
vec3 spillSample(vec3 N,vec2 rel,vec2 ringN,float radius,float z,float level,vec3 color,float occlusion){
  if(level<=0.0)return vec3(0.0);
  vec3 delta=vec3(ringPoint(rel,ringN,radius)-rel,z-v_world.z);
  float d=length(delta);
  float f=max(0.0,1.0-d/${HONEY_SPILL_RADIUS});
  float facing=max(dot(N,delta/max(d,.025)),0.0);
  return color*level*f*f*facing*occlusion;
}
// The fixed axial grid is stored q-major, row=r+floor(q/2). Fetch exact source cap pose.
mat3 sourceRotation(vec2 center,out vec2 shift){
  int q=int(round(center.x/(${HONEY_PITCH}*.8660254038)));
  int r=int(round(center.y/${HONEY_PITCH}-float(q)*.5));
  int row=r+int(floor(float(q)*.5));
  int index=(q+${HONEY_GRID_RADIUS})*${HONEY_GRID_RADIUS*2+1}+row+${HONEY_GRID_RADIUS};
  vec4 a=texelFetch(u_poses,ivec2(index,0),0);
  shift=vec2(a.w,texelFetch(u_poses,ivec2(index,1),0).x);
  return honeyRotation(a.xyz);
}
vec3 movingSpill(vec3 N,vec2 center,float height,float radius,float z,float level,vec3 color,float occlusion,mat3 rot){
  if(level<=0.0)return vec3(0.0);
  vec3 origin=vec3(center,height),local=transpose(rot)*(v_world-origin);
  vec2 point=ringPoint(local.xy,ringNormal(local.xy),radius);
  vec3 delta=origin+rot*vec3(point,z)-v_world;
  float d=length(delta),f=max(0.0,1.0-d/${HONEY_SPILL_RADIUS});
  return color*level*f*f*max(dot(N,delta/max(d,.025)),0.0)*occlusion;
}
vec3 localSpill(vec3 N){
  if(u_spill<=0.0)return vec3(0.0);
  vec3 sum=vec3(0.0);
  for(int i=0;i<7;i++){
    vec2 center=v_cell.xy+offsets[i];vec4 source=v_lights[i];vec3 level=source.xyz*u_gain;
    if(max(level.x,max(level.y,level.z))<=0.0)continue;
    vec2 rel=v_world.xy-center;
    // Beyond ring radius + compact spill support + maximum cap displacement, the contribution is exactly zero.
    if(dot(rel,rel)>5.29)continue;
    vec2 ringN=ringNormal(rel);
    // Low cap channels are occluded by their own sleeve. Cross-cell illumination
    // below the lip is attenuated rather than leaking through solid walls.
    float crossOcclusion=i==0?1.0:smoothstep(.20,.55,v_world.z)*smoothstep(.35,.55,source.w);
    float recess=i==0?mix(.24,1.0,smoothstep(.22,.50,source.w)):crossOcclusion;
    if(max(level.x,level.y)>0.0){
      vec2 shift;mat3 rotation=sourceRotation(center,shift);
      sum+=movingSpill(N,center+shift,source.w,.949,-.046,level.x,u_palette[4],recess,rotation);
      sum+=movingSpill(N,center+shift,source.w,.799,-.004,level.y*.55,u_palette[5],recess,rotation);
    }
    float lower=i==0?1.0:smoothstep(.20,.55,v_world.z)*.35;
    sum+=spillSample(N,rel,ringN,1.006,.413,level.z,u_palette[6],lower);
  }
  return min(sum*u_spill,vec3(${HONEY_SPILL_LIMIT}));
}
void main(){
  vec3 N=normalize(v_normal),V=normalize(u_eye-v_world),L=normalize(u_lightDir),H=normalize(V+L);
  int finish=int(v_finish.x+.5);
  vec4 mat=finishes[finish];
  vec3 base=u_palette[v_role];
  float detail=grain(v_local.xy,v_finish.y,finish);
  if(v_role==0){
    float h=hexRadius(v_local.xy);
    float aa=max(fwidth(h),.001);
    float engraving=1.0-smoothstep(.003,.003+aa,abs(h-.56));
    float sector=abs(sin(atan(v_local.y,v_local.x)*3.0));
    base*=v_cell.w*mat.z*(1.0+detail-.09*engraving*smoothstep(.88,.98,sector));
  }else if(v_role==1){mat=vec4(.8,.32,1.0,.1);base*=1.0+detail*.5;}
  else if(v_role==2){mat=vec4(v_moving>.5?.6:.2,v_moving>.5?.65:.85,1.0,0.0);}
  else{mat=vec4(.2,.85,1.0,0.0);}
  vec3 emissive=vec3(0.0);
  if(v_role>=4){
    int channel=v_role-4;float level=v_lights[0][channel]*u_gain[channel];
    // The recessed side lips remain dark; only the seated strip emits.
    float strip=v_role==4?smoothstep(-.061,-.057,v_local.z)*(1.0-smoothstep(-.036,-.032,v_local.z)):smoothstep(.65,.95,N.z);
    float edgeDist=v_role==4?abs(v_local.z+.046):abs(hexRadius(v_local.xy)-(v_role==5?.799:1.007)*.8660254);
    float core=1.0-smoothstep(.001,.009+fwidth(edgeDist),edgeDist);
    emissive=mix(base,base*vec3(1.0,1.55,2.0),core*.38)*power[channel]*level*strip;
    base=u_palette[1]*.28;
  }
  float nl=max(dot(N,L),0.0),nv=max(dot(N,V),.001),nh=max(dot(N,H),0.0);
  float rough=clamp(mat.y+detail*.4,.22,.95),a2=pow(rough,4.0);
  float tangent=dot(H,vec3(1.0,0.0,0.0));
  float d=nh*nh*(a2-1.0)+1.0+mat.w*tangent*tangent*.25;
  float D=a2/max(PI*d*d,.001);
  float k=pow(rough+1.0,2.0)/8.0;
  float G=nl/(nl*(1.0-k)+k)*nv/(nv*(1.0-k)+k);
  vec3 F0=mix(vec3(.04),base,mat.x),F=F0+(1.0-F0)*pow(1.0-max(dot(H,V),0.0),5.0);
  vec3 spec=min(D*G*F/max(4.0*nl*nv,.01),vec3(.65));
  float contact=v_role==2?mix(.34,.75,smoothstep(-.1,.42,v_world.z)):1.0;
  vec3 ambient=base*u_ambient*contact*(1.0-mat.x*.3);
  // Restrained cool environment reflection, with finish-specific roughness and metallic response.
  ambient+=F0*u_ambient*(.06+.16*mat.x)*(1.0-rough)*contact;
  vec3 direct=(base*(1.0-mat.x*.55)+spec)*nl*u_key*shadowVisibility(N)*contact;
  vec3 lit=ambient+direct+localSpill(N)*(base*1.1+vec3(.20))+emissive;
  outColor=vec4(pow(max(lit,vec3(0.0)),vec3(1.0/2.2)),1.0);
}`
