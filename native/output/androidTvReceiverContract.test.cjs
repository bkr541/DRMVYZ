'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const {
  DRMVYZ_RECEIVER_PROTOCOL_NAME,
  DRMVYZ_RECEIVER_PROTOCOL_VERSION,
  DRMVYZ_RECEIVER_PROTOCOL_MIN_VERSION,
  DRMVYZ_RECEIVER_QUALITY_POLICY,
} = require('./drmvyzReceiverProtocol.cjs')
const {
  DISCOVERY_MAGIC,
  DISCOVERY_PORT,
  DISCOVERY_VERSION,
  MDNS_SERVICE_TYPE,
} = require('./providers/drmvyzReceiverProvider.cjs')

const receiverRoot = path.resolve(__dirname, '../../android-tv-receiver/app/src/main')
const contract = JSON.parse(fs.readFileSync(path.join(receiverRoot, 'assets/drmvyz_receiver_v2_contract.json'), 'utf8'))
const manifest = fs.readFileSync(path.join(receiverRoot, 'AndroidManifest.xml'), 'utf8')
const runtime = fs.readFileSync(path.join(receiverRoot, 'java/com/drmvyz/receiver/ReceiverRuntime.kt'), 'utf8')

test('Android TV receiver contract stays wire-compatible with the production Stage 5 sender', () => {
  assert.deepEqual(contract.protocol, {
    name: DRMVYZ_RECEIVER_PROTOCOL_NAME,
    version: DRMVYZ_RECEIVER_PROTOCOL_VERSION,
    minVersion: DRMVYZ_RECEIVER_PROTOCOL_MIN_VERSION,
  })
  assert.equal(contract.discovery.magic, DISCOVERY_MAGIC)
  assert.equal(contract.discovery.version, DISCOVERY_VERSION)
  assert.equal(contract.discovery.legacyUdpPort, DISCOVERY_PORT)
  assert.equal(`${contract.discovery.mdnsServiceType}local`, MDNS_SERVICE_TYPE)
  assert.equal(contract.video.transport, 'webrtc')
  assert.equal(contract.video.codecNegotiation, 'webrtc-sdp')
  assert.deepEqual(contract.video.codecs, ['video/VP8'])
  assert.equal(contract.video.maxLongEdge, DRMVYZ_RECEIVER_QUALITY_POLICY.maxLongEdge)
  assert.equal(contract.video.maxShortEdge, DRMVYZ_RECEIVER_QUALITY_POLICY.maxShortEdge)
  assert.equal(contract.video.maxFps, DRMVYZ_RECEIVER_QUALITY_POLICY.maxFps)
  assert.equal(contract.video.maxVideoBitrateKbps, DRMVYZ_RECEIVER_QUALITY_POLICY.maxVideoBitrateKbps)
  assert.deepEqual(contract.windowModes, ['windowed', 'borderless', 'fullscreen'])
  assert.deepEqual(contract.aspectRatios, ['16:9', '16:10', '4:3', '3:2', '1:1', '9:16'])
})

test('Android TV receiver is a leanback appliance and implements the V2 control surface, not Google Cast', () => {
  assert.match(manifest, /android\.intent\.category\.LEANBACK_LAUNCHER/)
  assert.match(manifest, /android\.hardware\.touchscreen" android:required="false"/)
  assert.match(manifest, /android:hardwareAccelerated="true"/)
  assert.match(runtime, /"\/api\/v2\/capabilities"/)
  assert.match(runtime, /"\/api\/v2\/pair"/)
  assert.match(runtime, /"\/api\/v2\/sessions"/)
  assert.match(runtime, /\/api\/v2\/sessions\//)
  assert.doesNotMatch(runtime, /Google Cast|Chromecast|Cast SDK/)
})
