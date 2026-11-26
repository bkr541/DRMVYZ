import test from 'node:test'
import assert from 'node:assert/strict'
import {decodedMediaEvidence,projectedMediaEvidence,videoFrameEvidence} from './media-fidelity-evidence.mjs'
const colors=[[255,34,34,255],[24,237,112,255],[34,85,255,255],[255,255,255,255]]
const observed=(variant='alpha',time=0)=>{
  const alpha=['alpha','svg'].includes(variant),width=variant==='tall'?180:320,height=variant==='tall'?320:180
  const order=variant==='video'&&time>=1?[2,0,1,3]:[0,1,2,3]
  const samples=order.map((j,i)=>({x:.25+i%2*.5,y:.25+Math.floor(i/2)*.5,actual:alpha&&i===3?[255,255,255,128]:[...colors[j]]}))
  samples.push({x:18/width,y:18/height,actual:[0,0,0,255]},{x:(width-20)/width,y:(height-20)/height,actual:[0,0,0,255]})
  if(alpha)samples.push({x:.5,y:.5,actual:[0,0,0,0]})
  return {variant,width,height,samples,playback:{currentTimeSec:time,paused:true}}
}
test('decode reference accepts all formats and rejects corrupted chroma, orientation, dimensions and alpha',()=>{
  for(const v of ['chart','alpha','tall','svg','video'])assert.equal(decodedMediaEvidence(observed(v),v).status,'pass')
  const broken=[o=>o.samples[0].actual=[0,0,255,255],o=>{[o.samples[0].actual,o.samples[2].actual]=[o.samples[2].actual,o.samples[0].actual]},o=>o.width=180,o=>o.samples[6].actual=[0,0,0,255],o=>o.samples[3].actual[3]=255]
  for(const mutate of broken){const o=observed();mutate(o);assert.equal(decodedMediaEvidence(o,'alpha').status,'fail')}
  assert.equal(decodedMediaEvidence(null,'alpha').status,'incomplete')
  assert.equal(decodedMediaEvidence(observed('video',1.2),'video',1.2).status,'pass')
  const stale=observed('video',.2);stale.playback.currentTimeSec=1.2
  assert.equal(decodedMediaEvidence(stale,'video',1.2).status,'fail')
})
const width=30,height=30,conditions={stage:'breakdown',fixture:'none',quality:'high',frame:150,stageFrame:30,musicTime:1,visualTime:1,settings:'{"values":{"pattern":"a"}}',pattern:'a',camera:{position:[0,0,4],target:[0,0,0],fovDegrees:50,rollDegrees:0}}
const frame=draw=>({width,height,conditions,data:Uint8Array.from(Array.from({length:width*height},(_,i)=>draw(i%width,Math.floor(i/width))).flat())})
const off=frame(()=>[8,8,8]),chart=(flip=false,stretch=false,opaque=false,wrong=false)=>frame((x,y)=>{
  if(x<5||x>=(stretch?27:25)||y<5||y>=25)return [8,8,8]
  if(x>=13&&x<17&&y>=13&&y<17)return opaque?[255,255,255]:[8,8,8]
  const i=(x<(stretch?16:15)?0:1)+(y<15?0:2)
  return wrong?[150,150,150]:colors[flip?i^2:i].slice(0,3)
})
const regions=[{id:'r',x:7,y:7,width:4,height:4,expected:colors[0].slice(0,3)},{id:'g',x:19,y:7,width:4,height:4,expected:colors[1].slice(0,3)},{id:'b',x:7,y:19,width:4,height:4,expected:colors[2].slice(0,3)},{id:'w',x:19,y:19,width:4,height:4,expected:colors[3].slice(0,3)},{id:'hole',x:13,y:13,width:4,height:4,background:true,tolerance:5},{id:'edge',x:25,y:7,width:2,height:15,background:true,tolerance:5}]
test('independent projected regions reject hidden, wrong hue, flipped, stretched and opaque-hole frames',()=>{
  assert.equal(projectedMediaEvidence(chart(),off,regions).status,'pass')
  for(const b of [off,chart(true),chart(false,true),chart(false,false,true),chart(false,false,false,true)])assert.equal(projectedMediaEvidence(b,off,regions).status,'fail')
  assert.equal(projectedMediaEvidence(chart(),off,[]).status,'incomplete')
})
test('video frames must visibly advance at the same scene checkpoint, not merely change timestamp',()=>{
  const opts={first:.2,repeat:.2,second:1.2,expectedZones:[0,1,2,3,4,5,6,7,8]}
  assert.equal(videoFrameEvidence(chart(),chart(),chart(true),opts).status,'pass')
  assert.equal(videoFrameEvidence(chart(),chart(),chart(),opts).status,'fail')
  assert.equal(videoFrameEvidence(chart(),chart(),chart(true),{...opts,repeat:.4}).status,'incomplete')
  assert.equal(videoFrameEvidence(chart(),chart(),{...chart(true),conditions:{...conditions,musicTime:2}},opts).status,'incomplete')
})
