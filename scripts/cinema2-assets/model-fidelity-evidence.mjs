// QA-04: local material evidence, never whole-frame image similarity. A/A
// repeats calibrate the noise floor independently in each rendering path.
const valid = f => f && Number.isInteger(f.width) && f.width > 2 && Number.isInteger(f.height) && f.height > 2 && f.data instanceof Uint8Array && f.data.length === f.width * f.height * 3
const comparable = (...frames) => frames.every(valid) && frames.every(f => f.width === frames[0].width && f.height === frames[0].height)
const delta = (a,b,i) => Math.max(...[0,1,2].map(c => Math.abs(a.data[i+c]-b.data[i+c])))
const hue = (f,i) => {
  const rgb = [f.data[i],f.data[i+1],f.data[i+2]], max = Math.max(...rgb), min = Math.min(...rgb), c = rgb.indexOf(max)
  return max >= 48 && max-min >= 35 && max-rgb[(c+1)%3] >= 18 && max-rgb[(c+2)%3] >= 18 ? c : -1
}
const decision = (status,issues,evidence={}) => ({status,issues,evidence})

/** Use matched positive/negative GLB variants to locate visible material
 * contributions, intersected with the model-vs-native mask in Cinema. A/A
 * drift is measured locally; absolute floors are conservative tripwires, not
 * calibrated artistic tolerances. An absent control is incomplete, never pass. */
export function materialRegions({primary,repeat,wrongColor,opaque,noTexture,noMask,native}={}) {
  if(!comparable(primary,repeat,wrongColor,opaque,noTexture,noMask,...(native?[native]:[])))return decision('incomplete',['Missing or unmatched material captures'])
  const {width:w,height:h}=primary, minimum=Math.max(8,Math.ceil(w*h*.000025)), counts=[0,0,0], wrongCounts=[0,0,0]
  const regions={color:0,blend:0,texture:0,mask:0}, bounds={color:[w,h,-1,-1],blend:[w,h,-1,-1],texture:[w,h,-1,-1],mask:[w,h,-1,-1]}
  let modelPixels=0,noisePixels=0,textureEdges=0
  const add=(name,x,y)=>{regions[name]++;const b=bounds[name];b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y)}
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const i=(y*w+x)*3, noise=delta(primary,repeat,i), threshold=Math.max(18,noise*3+8)
    if(noise>18)noisePixels++
    if(native&&delta(primary,native,i)<threshold){
      if(delta(noMask,native,i)>=threshold&&delta(primary,noMask,i)>=threshold)add('mask',x,y)
      continue
    }
    modelPixels++
    const h1=hue(primary,i),h2=hue(wrongColor,i)
    if(h1>=0)counts[h1]++
    if(h2>=0)wrongCounts[h2]++
    if(h1===0&&h2===1&&delta(primary,wrongColor,i)>=threshold)add('color',x,y)
    // The translucent blue foreground must expose the red substrate;
    // its opaque control is deliberately the same geometry and light.
    if(hue(opaque,i)===2&&primary.data[i]>opaque.data[i]+threshold&&delta(primary,opaque,i)>=threshold)add('blend',x,y)
    if(delta(primary,noMask,i)>=threshold)add('mask',x,y)
    if(delta(primary,noTexture,i)>=threshold){
      add('texture',x,y)
      const j=i+3, edge=deltaAcross(primary,i,j), flat=deltaAcross(noTexture,i,j), drift=deltaAcross(repeat,i,j)
      if(edge>=Math.max(24,flat+12)&&Math.abs(edge-drift)<=Math.max(12,edge*.3))textureEdges++
    }
  }
  const evidence={minimum,modelPixels,noisePixels,counts,wrongCounts,regions,bounds,textureEdges}
  const issues=[]
  if(counts.some(n=>n<minimum))issues.push('One or more authored RGB patches are not visibly recognizable')
  if(regions.color<minimum)issues.push('Wrong-color negative control was not distinguished in the red patch')
  if(regions.blend<minimum)issues.push('Opaque negative control was not distinguished from the blended substrate')
  if(regions.mask<minimum)issues.push('Alpha MASK cutout was not distinguished from its opaque control')
  if(regions.texture<minimum||textureEdges<Math.max(3,Math.ceil(minimum/4)))issues.push('Missing-texture negative control or checker edges were not distinguished')
  return decision(issues.length?'fail':'pass',issues,evidence)
}
function deltaAcross(frame,i,j){return Math.max(...[0,1,2].map(c=>Math.abs(frame.data[i+c]-frame.data[j+c])))}

export function compareMaterialRegions(editor,cinema) {
  if(!editor||!cinema||[editor,cinema].some(r=>r.status==='incomplete'))return decision('incomplete',['Missing editor or production material observations'])
  const issues=[...editor.issues.map(s=>`Editor: ${s}`),...cinema.issues.map(s=>`Cinema: ${s}`)]
  return decision(issues.length?'fail':'pass',issues,{editor:editor.evidence,cinema:cinema.evidence,policy:'Independent local RGB/BLEND/MASK/texture tripwires; no pixel parity or hardware approval'})
}

// Match decoded and bound named GLB materials. Lighting may differ; authored
// surface parameters may not in Original. This supplements, never replaces,
// final output evidence. Duplicate/missing names are not accepted.
const authoredKeys=['color','roughness','metalness','emissive','emissiveIntensity','opacity','transparent','alphaTest','depthWrite','side','map','normalMap','alphaMap']
export function authoredMaterialEvidence(reference, actual) {
  if(!Array.isArray(reference)||!reference.length||!Array.isArray(actual)||!actual.length)return decision('incomplete',['Missing decoded or instance material diagnostics'])
  const byName=new Map(actual.map(m=>[m.name,m])), names=new Set(reference.map(m=>m.name)), issues=[]
  if(names.size!==reference.length||byName.size!==actual.length||names.size!==byName.size)issues.push('Named fixture material inventory differs or is ambiguous')
  for(const original of reference){
    const bound=byName.get(original.name)
    if(!bound){issues.push(`Missing bound material ${original.name}`);continue}
    for(const key of authoredKeys){
      const a=original[key],b=bound[key]
      if(a===undefined||b===undefined||!(typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<1e-5:JSON.stringify(a)===JSON.stringify(b)))issues.push(`${original.name}: ${key} differs from decoded GLB`)
    }
  }
  return decision(issues.length?'fail':'pass',issues,{reference,actual})
}
