'use strict'

const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const test = require('node:test')
const { LocalDisplayProvider } = require('./providers/localDisplayProvider.cjs')

class FakeScreen extends EventEmitter {
  constructor() {
    super()
    this.displays = [
      { id: 1, label: '', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 } },
    ]
  }
  getAllDisplays() { return this.displays }
  getPrimaryDisplay() { return this.displays[0] }
}

test('local display provider always exposes Electron primary display and follows topology changes', () => {
  const screen = new FakeScreen()
  let changes = 0
  const provider = new LocalDisplayProvider({ screen, createOutputWindow: () => null })
  const cleanup = provider.start({ onTargetsChanged: () => { changes += 1 } })

  assert.deepEqual(provider.listTargets().map(target => target.id), ['display:1'])
  assert.equal(provider.listTargets()[0].name, 'This display')

  screen.displays.push({ id: 2, label: 'Stage Screen', bounds: { x: 1920, y: 0, width: 3840, height: 2160 } })
  screen.emit('display-added', {}, screen.displays[1])
  assert.equal(changes, 1)
  assert.deepEqual(provider.listTargets().map(target => target.id), ['display:1', 'display:2'])

  screen.displays = [screen.displays[0]]
  screen.emit('display-removed', {}, { id: 2 })
  assert.equal(changes, 2)
  assert.deepEqual(provider.listTargets().map(target => target.id), ['display:1'])

  cleanup()
  assert.equal(screen.listenerCount('display-added'), 0)
  assert.equal(screen.listenerCount('display-removed'), 0)
  assert.equal(screen.listenerCount('display-metrics-changed'), 0)
})

test('local display provider does not duplicate topology listeners across repeated start/refresh', () => {
  const screen = new FakeScreen()
  const provider = new LocalDisplayProvider({ screen, createOutputWindow: () => null })
  provider.start({ onTargetsChanged: () => {} })
  provider.start({ onTargetsChanged: () => {} })
  provider.listTargets()
  provider.listTargets()
  assert.equal(screen.listenerCount('display-added'), 1)
  assert.equal(screen.listenerCount('display-removed'), 1)
  assert.equal(screen.listenerCount('display-metrics-changed'), 1)
  provider.shutdown()
  provider.start({ onTargetsChanged: () => {} })
  assert.equal(screen.listenerCount('display-added'), 1)
  assert.equal(screen.listenerCount('display-removed'), 1)
  assert.equal(screen.listenerCount('display-metrics-changed'), 1)
  provider.shutdown()
})
