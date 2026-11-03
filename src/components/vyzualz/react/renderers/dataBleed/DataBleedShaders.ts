export const DATA_BLEED_VERTEX = `#version 300 es
precision highp float;
out vec2 vUV;
void main() {
  vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2);
  vUV=p; gl_Position=vec4(p*2.0-1.0,0.0,1.0);
}`
const HEADER = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uSource;
vec4 original(vec2 uv) {
  if(any(lessThan(uv,vec2(0)))||any(greaterThan(uv,vec2(1)))) return vec4(0);
  vec4 c=texture(uSource,uv); return vec4(c.rgb*c.a,c.a);
}
`
export const DATA_BLEED_COPY = HEADER + `void main(){fragColor=original(vUV);}`
export const DATA_BLEED_FEEDBACK = HEADER + `
uniform sampler2D uCurrent, uPrevious, uHistory;
uniform vec2 uSourceSize, uMotionTexel;
uniform float uTime, uDelta, uMotionRatio, uAmount, uBlockSize, uSensitivity;
uniform float uSpeed, uRetention, uRefresh, uDirection, uSeed;
uniform int uMode;
uniform bool uMotionReady;
uniform vec4 uAudio; // kick, tear, density, edge
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+uSeed*0.031)*43758.5453);}
float luminance(vec4 c){return dot(c.rgb,vec3(0.2126,0.7152,0.0722));}
vec2 motion(vec2 uv) {
  if(!uMotionReady||uMode==1) return vec2(0);
  // Local Lucas-Kanade estimate: nine original-frame samples, no history pixels.
  float xx=0.0, yy=0.0, xy=0.0, xt=0.0, yt=0.0;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++) {
    vec2 p=clamp(uv+vec2(x,y)*uMotionTexel*2.0,uMotionTexel,1.0-uMotionTexel);
    vec2 dx=vec2(uMotionTexel.x,0), dy=vec2(0,uMotionTexel.y);
    float gx=(luminance(texture(uCurrent,p+dx))-luminance(texture(uCurrent,p-dx)))*0.5;
    float gy=(luminance(texture(uCurrent,p+dy))-luminance(texture(uCurrent,p-dy)))*0.5;
    float dt=luminance(texture(uCurrent,p))-luminance(texture(uPrevious,p));
    xx+=gx*gx; yy+=gy*gy; xy+=gx*gy; xt+=gx*dt; yt+=gy*dt;
  }
  float reg=0.0004; xx+=reg; yy+=reg;
  float determinant=max(xx*yy-xy*xy,0.0000001);
  vec2 flow=vec2(xy*yt-yy*xt,xy*xt-xx*yt)/determinant;
  return clamp(flow,vec2(-8),vec2(8))*uMotionTexel*uMotionRatio*(0.3+uSensitivity*3.7);
}
vec4 history(vec2 uv){
  if(any(lessThan(uv,vec2(0)))||any(greaterThan(uv,vec2(1)))) return vec4(0);
  return texture(uHistory,uv);
}
void main() {
  float block=max(2.0,uBlockSize*(1.0-uAudio.z*0.3));
  vec2 id=floor(vUV*uSourceSize/block);
  vec2 center=(id+0.5)*block/uSourceSize;
  float row=hash(vec2(id.y,11.0));
  float gate=step(0.28,hash(id+floor(uTime*1.7)));
  vec2 proc=vec2((0.7+hash(id)*2.6)*(sin(uTime*0.6+row*6.28)>-0.45?1.0:-1.0),(hash(id+7.0)-0.5)*0.8);
  proc*=0.85+0.3*sin(uTime*1.3+hash(id)*6.28);
  float cs=cos(uDirection), sn=sin(uDirection);
  proc=mat2(cs,sn,-sn,cs)*proc*block/uSourceSize*min(uSpeed,2.0)*uDelta*gate;
  vec2 observed=motion(center);
  vec2 field=uMode==0?observed:uMode==1?proc:observed+proc*0.65;
  field*=uAmount*(1.0+uAudio.x*1.6);
  field+=vec2(hash(id+3.0)-0.5,hash(id+19.0)-0.5)*block/uSourceSize*uAudio.x*uAmount*2.0*uDelta;
  field.x+=sin(id.y*0.7+uSeed)*uAudio.y*0.035*uAmount*uDelta;
  vec4 fresh=original(vUV-field*0.65);
  float refresh=max(0.025,uRefresh);
  bool inject=hash(id+floor(uTime*2.0)+27.0)<refresh*0.35;
  float retained=inject?0.0:pow(clamp(uRetention*(1.0-refresh*0.25),0.0,0.95),max(0.05,uDelta));
  vec4 result=mix(fresh,history(vUV-field),retained);
  if(uAudio.w>0.0) {
    vec4 red=original(vUV-field-vec2(uAudio.w*0.002,0));
    vec4 blue=original(vUV-field+vec2(uAudio.w*0.002,0));
    result.r=mix(result.r,min(red.r,result.a),uAudio.w*0.4);
    result.b=mix(result.b,min(blue.b,result.a),uAudio.w*0.4);
  }
  fragColor=clamp(result,0.0,1.0);
}`
export const DATA_BLEED_PRESENT = HEADER + `
uniform sampler2D uProcessed;
uniform vec2 uResolution, uFitSize, uPosition;
uniform float uScale, uRotation, uAmount;
void main(){
  vec2 p=(vUV-0.5)*uResolution-uPosition;
  float c=cos(uRotation),s=sin(uRotation);
  p=vec2(c*p.x-s*p.y,s*p.x+c*p.y)/max(0.01,uScale);
  vec2 uv=p/uFitSize+0.5;
  if(any(lessThan(uv,vec2(0)))||any(greaterThan(uv,vec2(1)))) {fragColor=vec4(0);return;}
  vec4 dry=original(uv);
  fragColor=uAmount<=0.0?dry:mix(dry,texture(uProcessed,uv),uAmount);
}`
