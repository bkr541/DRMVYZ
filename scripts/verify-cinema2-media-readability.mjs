#!/usr/bin/env node
/* global document, Image, window */
// Pixel regression of the actual native fragment shaders on isolated display faces.
// No Three or production transport mock: only the vertex inputs are held fixed.
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'

const modules = new URL('../src/components/vyzualz/cinema2/modules/', import.meta.url)
const corridorSource = await readFile(new URL('corridor/Cinema2CorridorRenderer.ts', modules), 'utf8')
const overdriveSource = await readFile(new URL('overdrive/OverdriveScene.ts', modules), 'utf8')
function shader(source, name) {
  const result = source.match(new RegExp(`const ${name}\\s*=\\s*\x60([\\s\\S]*?)\x60`))?.[1]
  assert(result, `Missing shader ${name}`)
  return result.replace(/\$\{([^}]+)\}/g, (_, expression) => {
    const [name, subtract] = expression.split('-')
    const constant = source.match(new RegExp(`const ${name} = ([\\d.]+)\\b`))?.[1]
    assert(constant, `Unknown shader interpolation ${expression}`)
    return subtract ? String(Number(constant)-Number(subtract)) : constant
  })
}
const effects = new URL('../src/components/vyzualz/cinema2/effects/', import.meta.url)
const shaders = { corridor: shader(corridorSource, 'FRAGMENT'), overdrive: shader(overdriveSource, 'fragment') }
const postShaders = { bloom: shader(await readFile(new URL('Cinema2HdrBloomEffect.ts', effects), 'utf8'), 'COMPOSITE_SOURCE'),
  finish: shader(await readFile(new URL('Cinema2CinematicFinishEffect.ts', effects), 'utf8'), 'FRAGMENT_SOURCE') }

async function test(shaders, postShaders) {
  const results = {}
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  document.body.append(canvas)
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true })
  if (!gl) throw Error('WebGL2 unavailable')
  const compile = (type, source) => {
    const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s))
    return s
  }
  const vertex = `#version 300 es
  precision highp float;
  uniform vec3 uTestCell;out vec2 v_uv;out vec2 vUV;out vec3 vPosition;out float vDepth;flat out vec3 vCell;flat out vec2 vPart;out vec3 vLocal;
  void main(){vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);gl_Position=vec4(p,0.,1.);vUV=p*.5+.5;v_uv=vUV;vPosition=vec3(0.,0.,-4.);vDepth=.1;vCell=uTestCell;vPart=vec2(4.,0.);vLocal=vec3(p*1.36,1.);}`
  // Bank 1 / row 1 / lane 0 is Night Transit's media lane. The selected
  // near face is deliberately held at the same depth in all music states.
  const programs = Object.fromEntries(Object.entries({...shaders,...postShaders}).map(([name, source]) => {
    if (name === 'overdrive') source = '#version 300 es\nprecision highp float;\nout vec4 fragColor;\n'+source.replace(/varying /g,'in ').replace(/texture2D/g,'texture').replace(/gl_FragColor/g,'fragColor')
    const p = gl.createProgram(), vs=compile(gl.VERTEX_SHADER,vertex), fs=compile(gl.FRAGMENT_SHADER,source)
    gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs)
    if (!gl.getProgramParameter(p,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p))
    return [name,p]
  }))
  const texture = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture)
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false)
  const upload = (rgba) => gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(rgba))
  const uploadImage = image => gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image)
  const pixel = (x=.5,y=.5,rgba=false) => {const out=new Uint8Array(4);gl.readPixels(Math.floor(x*size),Math.floor(y*size),1,1,gl.RGBA,gl.UNSIGNED_BYTE,out);return Array.from(rgba?out:out.slice(0,3))}
  const draw = (name, options={}) => {
    const p=programs[name];gl.useProgram(p)
    const f=(key,v)=>gl.uniform1f(gl.getUniformLocation(p,key),v), i=(key,v)=>gl.uniform1i(gl.getUniformLocation(p,key),v)
    const v=(key,values)=>gl[`uniform${values.length}fv`](gl.getUniformLocation(p,key),values)
    if(name==='corridor'){
      v('uTestCell',options.cell??[1,1,0]);v('uLook',[options.worldBay??0,options.phase??0,options.density??.85,options.gain??.86]);v('uAccents',options.accents??[0,0,0,0]);i('uPattern',options.pattern??0);f('uHaze',.23);f('uTravel',0);f('uCorridorWidth',2.35)
      v('uVoid',[.01,.01,.01]);v('uWall',[.05,.05,.05]);v('uAmber',options.pink?[1,.05,.65]:[1,.55,.12]);v('uHot',options.pink?[1,1,1]:[1,.7,.2]);v('uMarkings',[1,1,1]);v('uFeedAspect',options.pool?[1,1,1]:options.missing?[0,0,0]:[options.aspect??1,0,0]);i('uFeedCount',options.native?0:options.pool?3:1);f('uPoolStep',options.poolStep??0);i('uFeed0',0);i('uFeed1',options.pool?1:0);i('uFeed2',options.pool?2:0)
    } else {
      i('uMedia',0);i('uText',0);v('uColor',[.9,.12,.95]);f('uMode',options.native?0:3);f('uStyle',options.style??2);f('uGain',options.gain??1.5);f('uMediaGain',options.mediaGain??1);f('uPhase',0);f('uAspect',options.aspect??1);f('uScale',1);f('uAngle',0);f('uBass',0)
    }
    gl.drawArrays(gl.TRIANGLES,0,3)
    if(gl.getError()!==gl.NO_ERROR)throw Error(`WebGL error in ${name}`)
    return pixel()
  }
  for (const name of Object.keys(shaders)) {
    upload([128,80,40,255])
    const idle=draw(name,{gain:.35}),build=draw(name,{gain:.86,accents:[.3,.2,.7,0]}),drop=draw(name,{gain:1.45,accents:[1,1,1,1]})
    // Keep the native fixture below the 8-bit readback ceiling for the
    // straight-alpha assertion (the actual Corridor scene can be HDR).
    const alphaOptions={gain:.15}
    upload([0,0,0,255]);const black=draw(name,alphaOptions)
    upload([255,0,0,0]);const transparent=draw(name,alphaOptions)
    const missing=draw(name,{...alphaOptions,...(name==='corridor'?{missing:true}:{native:true})}),native=draw(name,{...alphaOptions,native:true})
    upload([255,0,0,128]);const half=draw(name,alphaOptions)
    upload([255,0,0,255]);const red=draw(name,alphaOptions)
    upload([0,255,0,255]);const green=draw(name,alphaOptions)
    upload([0,0,255,255]);const blue=draw(name,alphaOptions)
    upload([255,255,255,255]);draw(name,{aspect:4,gain:.15});const contained= pixel(.5,.60),padding=pixel(.5,.76)
    results[name]={idle,build,drop,black,transparent,missing,native,half,red,green,blue,contained,padding}
    if(name==='corridor'){
      upload([128,80,40,255]);draw(name,{density:.05,pink:true,gain:0});results[name].unlit=pixel(.5,.5,true)
      draw(name,{pink:true,accents:[1,1,1,1],gain:1.45});results[name].pinkDrop=pixel(.5,.5,true)
      upload([0,0,0,255]);draw(name,{pink:true,gain:1.45,accents:[1,1,1,1]});results[name].blackMask=pixel(.5,.5,true)
      upload([255,0,0,0]);draw(name);results[name].transparentMask=pixel(.5,.5,true)
      upload([255,0,0,128]);draw(name,alphaOptions);results[name].halfMask=pixel(.5,.5,true)
      draw(name,{missing:true});results[name].missingMask=pixel(.5,.5,true)
      upload([255,255,255,255]);draw(name,{aspect:4});results[name].wideCenter=pixel(.5,.5,true);results[name].widePadding=pixel(.5,.7,true)
      // Shaft does not select lane 0 on bank 1. A selected source must not
      // accidentally cover the other three lanes.
      draw(name,{pattern:3});results[name].otherLane=pixel(.5,.5,true)
      draw(name,{pattern:3,native:true});results[name].otherLaneNative=pixel(.5,.5,true)
      const poolTextures=[]
      for(const [unit,rgba] of [[1,[0,255,0,255]],[2,[0,0,255,255]]]){
        const feed=gl.createTexture();poolTextures.push(feed);gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,feed)
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST)
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(rgba))
      }
      gl.activeTexture(gl.TEXTURE0);upload([255,0,0,255]);results[name].pool=[]
      for(const poolStep of [0,1,2]){draw(name,{pool:true,poolStep});results[name].pool.push(pixel(.5,.5,true))}
      poolTextures.forEach(feed=>gl.deleteTexture(feed))
      // Exercise the actual fragment role selection at every cassette center.
      // A protected center identifies a picture independent of its RGB/brightness.
      upload([128,80,40,255]);results[name].layouts=[]
      for(let pattern=0;pattern<6;pattern++){
        const selected=[],later=[],recycled=[]
        for(let bank=0;bank<4;bank++)for(let row=0;row<12;row++)for(let lane=0;lane<4;lane++){
          const cell=[bank,row,lane],key=`${bank}:${row}:${lane}`
          draw(name,{pattern,cell});if(pixel(.5,.5,true)[3]<5)selected.push(key)
          draw(name,{pattern,cell,phase:7.3,accents:[1,1,1,1]});if(pixel(.5,.5,true)[3]<5)later.push(key)
          // An identical world cell after one recycled bay has the same role.
          if(row>0){draw(name,{pattern,cell:[bank,row-1,lane],worldBay:1});if(pixel(.5,.5,true)[3]<5)recycled.push(key)}
        }
        results[name].layouts.push({selected,later,recycled})
      }
      draw(name,{pattern:1,cell:[0,1,1],phase:0});results[name].relayOpen=pixel(.81,.5,true)
      draw(name,{pattern:1,cell:[0,1,1],phase:2.25});results[name].relayClosed=pixel(.81,.5,true)
      draw(name,{pattern:5,cell:[1,1,2]});results[name].heroIdle=pixel(.82,.5,true)
      draw(name,{pattern:5,cell:[1,1,2],accents:[0,0,0,1]});results[name].heroDrop=pixel(.82,.5,true)
      draw(name,{pattern:5,cell:[1,1,2],accents:[0,0,0,1]});results[name].heroCenter=pixel(.5,.5,true)
      draw(name,{pattern:5,cell:[1,1,2],missing:true});results[name].heroMissing=pixel(.5,.5,true)
      draw(name,{pattern:5,cell:[1,1,2],native:true});results[name].heroNative=pixel(.5,.5,true)

    }
    if(name==='overdrive'){
      upload([255,255,255,255]);results[name].dimRaster=draw(name,{style:1,gain:.15});results[name].brightRaster=draw(name,{style:1,gain:1.45});
      results[name].halfExposure=draw(name,{mediaGain:.5});
    }
  }
  // A real SVG with asymmetric colour bars and sharp lettering, uploaded in
  // the same top-down, straight-alpha form as the canonical media runtime.
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><path fill="#f00" d="M0 0h128v32H0z"/><path fill="#00f" d="M0 96h128v32H0z"/><text x="64" y="75" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="32" fill="white">DJ</text></svg>'
  const image = new Image(); image.src='data:image/svg+xml,'+encodeURIComponent(svg);await image.decode();uploadImage(image)
  for(const name of Object.keys(shaders)){
    draw(name);results[name].svgTop=pixel(.5,.85);results[name].svgBottom=pixel(.5,.15)
  }
  // Video uploads must retain source color on successive decoded frames.
  const frame=document.createElement('canvas');frame.width=frame.height=32;const ctx=frame.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,32,32)
  const stream=frame.captureStream(0),track=stream.getVideoTracks()[0],video=document.createElement('video');video.muted=true;video.srcObject=stream
  try {
    const playing=video.play();track.requestFrame();await playing
    for(const [key,color] of [['videoRed','#ff0000'],['videoGreen','#00ff00']]){
      const next=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Video frame timeout')),5000);video.requestVideoFrameCallback(()=>{clearTimeout(timeout);resolve()})});ctx.fillStyle=color;ctx.fillRect(0,0,32,32);track.requestFrame();await next;uploadImage(video)
      for(const name of Object.keys(shaders))results[name][key]=draw(name)
    }
  } finally {video.pause();video.srcObject=null;track.stop()}
  // Feed the actual production composite and finish shaders a representative
  // neighbouring HDR halo. Read each pass separately; alpha is internal metadata.
  const postDraw = (name, protect) => {
    const p=programs[name];gl.useProgram(p)
    const f=(key,v)=>gl.uniform1f(gl.getUniformLocation(p,key),v), i=(key,v)=>gl.uniform1i(gl.getUniformLocation(p,key),v)
    const v=(key,values)=>gl[`uniform${values.length}fv`](gl.getUniformLocation(p,key),values)
    i('u_source',0);f('u_protectMedia',protect);f('u_mix',name==='bloom'?1:.72)
    if(name==='bloom'){i('u_bloom',1);v('u_texel',[0,0]);v('u_tint',[1,.83,.63]);f('u_intensity',1.2)}
    else {v('u_resolution',[size,size]);f('u_exposure',.86);i('u_toneMap',1);f('u_contrast',1.06);f('u_saturation',1.05);f('u_vignette',.33);f('u_vignetteSoftness',.6);f('u_grainSize',1.5)}
    gl.drawArrays(gl.TRIANGLES,0,3)
    if(gl.getError()!==gl.NO_ERROR)throw Error(`WebGL error in ${name}`)
    return pixel(.5,.5,true)
  }
  const halo=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,halo)
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST)
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));gl.activeTexture(gl.TEXTURE0)
  upload([128,80,40,0]);const protectedBloom=postDraw('bloom',1),legacyBloom=postDraw('bloom',0)
  upload(protectedBloom);const protectedFinish=postDraw('finish',1),legacyFinish=postDraw('finish',0)
  upload([128,80,40,255]);const nativeBloom=postDraw('bloom',1),nativeLegacyBloom=postDraw('bloom',0)
  const nativeFinish=postDraw('finish',1),nativeLegacyFinish=postDraw('finish',0)
  upload([0,0,0,0]);const protectedBlack=postDraw('bloom',1);upload(protectedBlack);const finishedBlack=postDraw('finish',1)
  Object.assign(results.corridor,{protectedBloom,legacyBloom,protectedFinish,legacyFinish,nativeBloom,nativeLegacyBloom,nativeFinish,nativeLegacyFinish,finishedBlack})
  gl.deleteTexture(halo);gl.deleteTexture(texture);Object.values(programs).forEach(p=>gl.deleteProgram(p));return results
}

const html = `<!doctype html><meta charset="utf-8"><body><script>window.result=(${test.toString()})(${JSON.stringify(shaders)},${JSON.stringify(postShaders)}).then(result=>({result}),error=>({error:String(error.stack||error)}))</script>`
if (process.argv[2] === '--html') {
  // Allows the same fixture to be exercised with system Chromium when the
  // project's npm dependencies cannot be installed (e.g. offline CI).
  await writeFile(process.argv[3],html)
} else if (process.argv[2] === '--report') {
  verify(JSON.parse(await readFile(process.argv[3], 'utf8')))
} else {
  const { chromium } = await import('@playwright/test')
  const browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--use-angle=swiftshader']})
  try {
    const page=await browser.newPage();await page.setContent(html)
    const report=await page.evaluate(()=>window.result);assert(!report.error,report.error)
    verify(report.result);console.log(JSON.stringify(report.result,null,2))
  } finally {await browser.close()}
}

function verify(results) {
  const delta=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])))
  const dominant=(rgb,index)=>assert(rgb[index]>Math.max(...rgb.filter((_,i)=>i!==index))+20,`Color channel ${index}: ${rgb}`)
  for(const [name,r] of Object.entries(results)){
    assert(delta(r.idle,r.build)<=2 && delta(r.idle,r.drop)<=2,`${name}: source exposure varied with fixture gain: ${JSON.stringify(r)}`)
    assert(delta(r.missing,r.native)<=1,`${name}: missing feed did not reset to native`)
    assert(Math.max(...r.black)<12,`${name}: opaque black leaked fixture color`)
    assert(delta(r.half,r.red.map((v,i)=>Math.round((v+r.transparent[i])/2)))<=3,`${name}: alpha blend failed`)
    dominant(r.red,0);dominant(r.green,1);dominant(r.blue,2);dominant(r.videoRed,0);dominant(r.videoGreen,1)
  }
  const c=results.corridor
  assert(delta(c.transparent,c.native)<=1,'Corridor transparent media must reveal native fixture')
  assert(delta(c.idle,[128,80,40])<=1,'Corridor must retain display-encoded source colors')
  for(const name of ['unlit','pinkDrop','protectedBloom']) assert(delta(c[name],[128,80,40,0])<=1,`Corridor ${name}: media must retain color and protection`)
  assert(delta(c.protectedFinish,[128,80,40,255])<=1,'Finish must restore opaque output without grading artwork')
  assert(delta(c.blackMask,[0,0,0,0])<=1 && delta(c.finishedBlack,[0,0,0,255])<=1,'Black art must not receive bloom or grading')
  assert(c.transparentMask[3]===255 && c.missingMask[3]===255 && Math.abs(c.halfMask[3]-127)<=1,'Mask must follow source alpha')
  assert(delta(c.legacyBloom,c.protectedBloom)>30 && delta(c.legacyFinish.slice(0,3),c.protectedFinish.slice(0,3))>2,'Protection must be opt-in')
  assert(delta(c.nativeBloom,c.nativeLegacyBloom)<=1 && delta(c.nativeFinish,c.nativeLegacyFinish)<=1,'Native pixels must retain the old post treatment')
  assert(delta(c.wideCenter,[255,255,255,0])<=1 && delta(c.widePadding,[0,0,0,0])<=1,'Wide media must be contained with protected black padding')
  assert(delta(c.otherLane,c.otherLaneNative)<=1 && c.otherLane[3]===255,'Nonselected lanes must remain native')
  assert(c.pool.every((rgba,index)=>delta(rgba,[[255,0,0,0],[0,255,0,0],[0,0,255,0]][index])<=1),'Pool steps must sample the expected channel')
  for(const {selected,later,recycled} of c.layouts){
    assert.equal(selected.length,48,'Every pattern must reserve 75% of fixtures for native light')
    assert.deepEqual(later,selected,'Phase and drop must not move artwork identities')
    assert.deepEqual(recycled,selected.filter(key=>Number(key.split(':')[1])>0),'Recycled bays must preserve world-space identities')
  }
  assert.equal(new Set(c.layouts.map(layout=>JSON.stringify(layout.selected))).size,6,'All six media arrangements must differ')
  const counter=c.layouts[2].selected
  assert(counter.every(key=>{const [bank,row]=key.split(':').map(Number);return bank%2===1||bank===2*(row%2)}),'Counterflow must alternate side banks')
  assert(c.layouts[3].selected.every(key=>Number(key.split(':')[0])%2===1),'Shaft must reserve the side walls for light')
  assert(c.layouts[5].selected.every(key=>Number(key.split(':')[1])%2===1),'Gate must leave alternate bays fully native')
  assert(c.relayOpen[3]<5 && c.relayClosed[3]>250,'Relay must open the hybrid surround in a directional wave')
  assert(c.heroIdle[3]>250 && c.heroDrop[3]<5,'Drop must expand the near-field hybrid aperture')
  assert(delta(c.heroCenter,[128,80,40,0])<=1,'Hero picture must retain source RGB during the drop')
  assert(delta(c.heroMissing,c.heroNative)<=1,'Missing hybrid feed must return to native fixture')


  assert(Math.max(...results.overdrive.padding)<10 && Math.min(...results.overdrive.contained)>240,'Overdrive must contain a wide source without stretching')
  assert(delta(results.overdrive.halfExposure,[128,128,128])<=1,'Existing exposure must remain effective')
  assert(delta(results.overdrive.dimRaster,results.overdrive.brightRaster)>30,'Raster must retain reactive fixture gain')
  dominant(results.overdrive.svgTop,0);dominant(results.overdrive.svgBottom,2)
  assert(delta(results.overdrive.idle,[128,80,40])<=1,'Full Color must preserve opaque RGB at unity exposure')
}
