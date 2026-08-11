'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const {
  DRMVYZ_RECEIVER_PROTOCOL_VERSION,
  DRMVYZ_RECEIVER_QUALITY_POLICY,
  buildCapabilityDocument,
  buildReceiverDisplayTargetId,
  normalizeCapabilityDocument,
  normalizeV2StartRequest,
  parseReceiverDisplayTargetId,
} = require('./drmvyzReceiverProtocol.cjs')

const WINDOW_MODES = new Set(['windowed', 'borderless', 'fullscreen'])
const ASPECT_RATIOS = new Set(['16:9', '16:10', '4:3', '3:2', '1:1', '9:16'])

test('Receiver V2 capability schema is versioned and carries display, resolution, fps, codec, and pairing state', () => {
  const document = buildCapabilityDocument({
    deviceId: 'receiver-device-1',
    name: 'Booth Receiver',
    paired: false,
    displays: [
      { id: '7', name: 'LED Wall', width: 3840, height: 2160, scaleFactor: 2, refreshRate: 60, primary: true },
      { id: '9', name: 'Projector', width: 1920, height: 1080, scaleFactor: 1, refreshRate: 59.94, primary: false },
    ],
  })

  assert.equal(document.protocol.version, DRMVYZ_RECEIVER_PROTOCOL_VERSION)
  assert.equal(document.pairing.required, true)
  assert.equal(document.pairing.paired, false)
  assert.equal(document.displays.length, 2)
  assert.equal(document.video.transport, 'webrtc')
  assert.equal(document.video.codecNegotiation, 'webrtc-sdp')
  assert.deepEqual(document.video.codecs, ['video/VP8'])
  assert.equal(document.video.maxLongEdge, DRMVYZ_RECEIVER_QUALITY_POLICY.maxLongEdge)
  assert.equal(document.video.maxFps, 60)

  assert.deepEqual(normalizeCapabilityDocument(document), document)
})

test('Receiver V2 display target ids round-trip without conflating the receiver and destination display', () => {
  const id = buildReceiverDisplayTargetId('receiver-device-1', 'display:aux/2')
  assert.equal(id, 'receiver:receiver-device-1:display:display%3Aaux%2F2')
  assert.deepEqual(parseReceiverDisplayTargetId(id), {
    receiverDeviceId: 'receiver-device-1',
    displayId: 'display:aux/2',
  })
  assert.equal(parseReceiverDisplayTargetId('receiver:receiver-device-1'), null)
})

test('Receiver V2 session schema rejects unsupported versions and missing trust while preserving selected display', () => {
  const valid = normalizeV2StartRequest({
    protocolVersion: DRMVYZ_RECEIVER_PROTOCOL_VERSION,
    senderDeviceId: 'sender-device-1',
    pairingToken: 'pairing-token-abcdefghijklmnopqrstuvwxyz',
    receiverToken: 'receiver-token',
    displayId: 'display-9',
    sourceUrl: 'http://192.168.1.10:45000/receiver?session=1&token=2',
    windowMode: 'fullscreen',
    aspectRatio: '16:9',
    qualityPolicy: { maxLongEdge: 1920, maxShortEdge: 1080, maxFps: 60, maxVideoBitrateKbps: 12000 },
  }, WINDOW_MODES, ASPECT_RATIOS)
  assert.equal(valid.displayId, 'display-9')
  assert.equal(valid.qualityPolicy.maxFps, 60)

  assert.equal(normalizeV2StartRequest({ ...valid, protocolVersion: 1 }, WINDOW_MODES, ASPECT_RATIOS), null)
  assert.equal(normalizeV2StartRequest({ ...valid, pairingToken: '' }, WINDOW_MODES, ASPECT_RATIOS), null)
})
