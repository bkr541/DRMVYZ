// Shared by both shader stages so the wall receiver and physical cassette use
// exactly the same stagger, dimensions and world-bay identity.
export const GOONZ_LIGHTING_GLSL = `
vec3 gBankPoint(float bank,float across,float depth,float width) {
  vec2 p=vec2(across,width-depth);
  if(bank<.5) p=vec2(-p.y,p.x);
  else if(bank<1.5) p=vec2(p.x,p.y);
  else if(bank<2.5) p=vec2(p.y,-p.x);
  else p=vec2(-p.x,-p.y);
  return vec3(p,0.0);
}
// A bounded rectangular perimeter-area approximation. Only nearby bay slots
// and the two neighboring walls are visited; there are no global point lights.
vec3 gSpill(vec3 receiver,float bank,float slot,float reach,bool casing) {
  vec3 result=vec3(0.0);
  for(int offset=-1;offset<=1;offset++) {
    float bay=slot+float(offset);
    if(bay<0.0||bay>=12.0) continue;
    float row=mod(bay+uLook.x,4096.0);
    for(int side=-1;side<=1;side++) {
      if(side!=0&&offset!=0) continue;
      float b=mod(bank+float(side),4.0);
      for(int l=0;l<2;l++) {
        float lane=float(l);
        if(lane>=goonzLaneCount(row,b)) continue;
        vec3 shape=goonzShape(row,b,lane,uCorridorWidth);
        float size=shape.z;
        vec3 center=gBankPoint(b,shape.x*uCorridorWidth,.10*uCorridorWidth,uCorridorWidth);
        center.z=(bay+.5)*2.8+shape.y;
        vec3 d=receiver-center;
        float across=b<.5?d.y:b<1.5?d.x:b<2.5?-d.y:-d.x;
        float normal=b<.5?d.x:b<1.5?d.y:b<2.5?-d.x:-d.y;
        vec2 edge=abs(vec2(across,d.z))-size*.42;
        float perimeter=length(max(edge,0.0))+abs(min(max(edge.x,edge.y),0.0));
        float distanceToEdge=length(vec2(perimeter,normal*.8));
        if(distanceToEdge>max(.32,reach*3.2)) continue;
        float falloff=exp(-distanceToEdge/max(.08,reach*.75))/(1.0+distanceToEdge*distanceToEdge*2.0);
        vec2 id=vec2(row,b*13.5+lane);
        float z=(bay+.5)-uTravel/2.8;
        float power=gLevel(z,b,lane,hash(id+1.3),false);
        vec3 tint=panelColor(hash(id+31.5),0.0);
        result+=tint*falloff*power*uLook.w*(.48+.62*uGoonzDesign.x)*(casing?1.35:1.1);
      }
      // Light from the corner rail wraps onto both adjacent backing planes.
      vec3 corner=gBankPoint(b,uCorridorWidth*.967,.025*uCorridorWidth,uCorridorWidth);
      float railDistance=length(receiver.xy-corner.xy);
      if(side==0||offset==0) {
        float rail=gLevel((bay+.5)-uTravel/2.8,b,0.0,.72,true);
        float axial=abs(receiver.z-(bay+.5)*2.8);
        result+=uAmber*rail*uGoonzDesign.y*uLook.w*.65*exp(-railDistance/max(.08,reach*.52))*exp(-max(0.0,axial-1.4)*3.0);
      }
    }
  }
  return min(result,vec3(5.0));
}
`
