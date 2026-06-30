import { describe, expect, it } from 'vitest'
import { createDefaultLaserDmxSettings } from '../ReactTypes'
import {
  buildProductionRig,
  createProductionOutputFrame,
  normalizeLaserDmxSettings,
  type ProductionOutputFrame,
  type ProductionRig,
} from '../LaserDmxProductionRig'
import {
  ARTNET_PRODUCTION_OUTPUT_ADAPTER_DESCRIPTOR,
  DEFAULT_PRODUCTION_OUTPUT_SESSION_SETTINGS,
  ProductionOutputController,
  type PreparedProductionOutputFrame,
  type ProductionOutputAdapter,
  type ProductionOutputAdapterDescriptor,
  type ProductionOutputAdapterStatus,
  type ProductionOutputNetworkBinding,
  PRODUCTION_OUTPUT_PROTOCOLS,
  SACN_PRODUCTION_OUTPUT_ADAPTER_DESCRIPTOR,
  VIRTUAL_PRODUCTION_OUTPUT_ADAPTER_DESCRIPTOR,
  createProductionOutputSafetyRuntime,
  prepareProductionOutputFrame,
  validateProductionFixturePatch,
} from './ProductionOutput'

const MOCK_OUTPUT_ADAPTER_DESCRIPTOR: ProductionOutputAdapterDescriptor = {
  ...VIRTUAL_PRODUCTION_OUTPUT_ADAPTER_DESCRIPTOR,
  id: 'laserDmxMockOutput',
  label: 'Mock Output',
}

class MockProductionOutputAdapter implements ProductionOutputAdapter {
  readonly descriptor = MOCK_OUTPUT_ADAPTER_DESCRIPTOR
  readonly frames: PreparedProductionOutputFrame[] = []
  private status: ProductionOutputAdapterStatus = {
    adapterId: this.descriptor.id,
    state: 'disconnected',
    connected: false,
    armed: false,
    blackout: true,
    lastFrameAtMs: null,
    lastHeartbeatAtMs: null,
    framesSent: 0,
    lastError: null,
  }

  connect(_binding: ProductionOutputNetworkBinding | null): void {
    this.status = { ...this.status, state: 'connected', connected: true, lastError: null }
  }

  disconnect(): void {
    this.status = { ...this.status, state: 'disconnected', connected: false, armed: false, blackout: true }
  }

  arm(): void {
    if (!this.status.connected) this.connect(null)
    this.status = { ...this.status, state: 'armed', armed: true, blackout: false }
  }

  disarm(reason?: string): void {
    this.status = { ...this.status, state: this.status.connected ? 'connected' : 'disconnected', armed: false, blackout: true, lastError: reason ?? null }
  }

  sendFrame(frame: PreparedProductionOutputFrame): void {
    const nowMs = Date.now()
    this.frames.push(frame)
    this.status = {
      ...this.status,
      state: frame.blackout ? 'blackout' : (this.status.armed ? 'armed' : 'connected'),
      blackout: frame.blackout,
      lastFrameAtMs: nowMs,
      lastHeartbeatAtMs: nowMs,
      framesSent: this.status.framesSent + 1,
      lastError: null,
    }
  }

  blackout(reason?: string): void {
    this.status = { ...this.status, state: 'blackout', blackout: true, armed: false, lastError: reason ?? null }
  }

  heartbeat(nowMs: number): void {
    this.status = { ...this.status, lastHeartbeatAtMs: nowMs }
  }

  getStatus(): ProductionOutputAdapterStatus {
    return { ...this.status }
  }
}

class ThrowingArmMockProductionOutputAdapter extends MockProductionOutputAdapter {
  arm(): void {
    throw new Error('mock arm failure')
  }
}

function createMockController(): { controller: ProductionOutputController; adapter: MockProductionOutputAdapter } {
  const adapter = new MockProductionOutputAdapter()
  return { controller: new ProductionOutputController({ defaultAdapter: adapter }), adapter }
}

function createRig(): ProductionRig {
  return buildProductionRig(normalizeLaserDmxSettings(createDefaultLaserDmxSettings()))
}

function createFrame(rig: ProductionRig, channels: Record<string, number>): ProductionOutputFrame {
  const fixture = rig.fixtures[0]
  return {
    schemaVersion: rig.schemaVersion,
    rigId: rig.id,
    timestampSec: 1,
    rendererId: rig.rendererCapabilities.id,
    adapterId: rig.outputAdapterCapabilities.id,
    intensityDomains: { preview: 'renderer', hardware: 'adapter' },
    safetyMetadata: {
      audienceRegionEnabled: rig.stage.audience.enabled,
      exclusionZoneIds: rig.stage.spatialZones.filter(zone => zone.kind === 'excluded').map(zone => zone.id),
      validationOnly: true,
    },
    fixtures: [{
      fixtureId: fixture.id,
      profileId: fixture.profileId,
      fixtureKind: fixture.kind,
      patch: { ...fixture.patch },
      channels,
    }],
  }
}

describe('production output security boundary', () => {
  it('ships virtual output as the only executable default adapter', () => {
    expect(DEFAULT_PRODUCTION_OUTPUT_SESSION_SETTINGS).toMatchObject({
      selectedAdapterId: VIRTUAL_PRODUCTION_OUTPUT_ADAPTER_DESCRIPTOR.id,
      physicalOutputEnabled: false,
      networkBinding: null,
    })
    expect(VIRTUAL_PRODUCTION_OUTPUT_ADAPTER_DESCRIPTOR.canTransmit).toBe(false)
    expect(PRODUCTION_OUTPUT_PROTOCOLS.virtual.executableInCurrentRuntime).toBe(true)
    expect(ARTNET_PRODUCTION_OUTPUT_ADAPTER_DESCRIPTOR.enabledByDefault).toBe(false)
    expect(SACN_PRODUCTION_OUTPUT_ADAPTER_DESCRIPTOR.enabledByDefault).toBe(false)
    expect(PRODUCTION_OUTPUT_PROTOCOLS.artNet).toMatchObject({ transport: 'udp', executableInCurrentRuntime: false, requiresTrustedHost: true })
    expect(PRODUCTION_OUTPUT_PROTOCOLS.sacn).toMatchObject({ transport: 'udp', executableInCurrentRuntime: false, requiresTrustedHost: true })
  })

  it('starts in rehearsal mode and keeps virtual preview separate from physical arming', () => {
    const { controller } = createMockController()
    expect(controller.getSnapshot().rehearsalMode).toBe(true)
    controller.arm()
    expect(controller.getSnapshot().status.armed).toBe(true)
    controller.setRehearsalMode(false)
    expect(controller.getSnapshot().rehearsalMode).toBe(false)
    controller.setRehearsalMode(true)
    expect(controller.getSnapshot()).toMatchObject({ rehearsalMode: true, status: { armed: false, blackout: true } })
    expect(controller.getSnapshot().diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'rehearsalMode' }),
    ]))
  })

  it('does not enable or arm unavailable network adapters', () => {
    const { controller } = createMockController()
    controller.selectAdapter(ARTNET_PRODUCTION_OUTPUT_ADAPTER_DESCRIPTOR.id)
    controller.setPhysicalOutputEnabled(true)
    controller.arm()
    const snapshot = controller.getSnapshot()
    expect(snapshot.session.physicalOutputEnabled).toBe(false)
    expect(snapshot.status.armed).toBe(false)
    expect(snapshot.emergencyBlackout).toBe(true)
    expect(snapshot.diagnostics.some(item => item.severity === 'error')).toBe(true)
  })

  it('disarms and fails dark on auth changes and renderer crashes', () => {
    const { controller } = createMockController()
    controller.arm()
    expect(controller.getSnapshot().status.armed).toBe(true)
    controller.handleAuthChange()
    expect(controller.getSnapshot()).toMatchObject({ emergencyBlackout: true, status: { armed: false, blackout: true } })

    controller.clearEmergencyBlackout()
    controller.arm()
    controller.handleRendererCrash('Canvas')
    expect(controller.getSnapshot()).toMatchObject({ emergencyBlackout: true, status: { armed: false, blackout: true } })
  })

  it('runs fixture-test frames through a mock virtual adapter without arming output', () => {
    const { controller, adapter } = createMockController()
    const rig = createRig()
    const frame = createFrame(rig, { ch1: 255 })
    controller.submitFixtureTest(frame, rig, frame.fixtures[0].fixtureId)
    expect(adapter.frames).toHaveLength(1)
    expect(adapter.frames[0].source.fixtures).toHaveLength(1)
    expect(controller.getSnapshot().status.armed).toBe(false)
  })

  it('reports stale-frame gaps while forcing the adapter dark before resuming', () => {
    const { controller, adapter } = createMockController()
    const rig = createRig()
    const frame = createFrame(rig, { ch1: 255 })
    controller.submitFrame(frame, rig, 1_000)
    controller.submitFrame(frame, rig, 2_000)
    expect(adapter.frames).toHaveLength(2)
    expect(controller.getSnapshot().diagnostics.some(item => item.code === 'staleFrame')).toBe(true)
  })

  it('fails dark with a heartbeat-timeout diagnostic', () => {
    const { controller } = createMockController()
    const rig = createRig()
    controller.submitFrame(createFrame(rig, { ch1: 255 }), rig)
    const lastFrameAtMs = controller.getSnapshot().status.lastFrameAtMs ?? 0
    controller.heartbeat(lastFrameAtMs + DEFAULT_PRODUCTION_OUTPUT_SESSION_SETTINGS.safety.heartbeatTimeoutMs + 1)
    expect(controller.getSnapshot()).toMatchObject({
      emergencyBlackout: true,
      status: { armed: false, blackout: true },
    })
    expect(controller.getSnapshot().diagnostics.some(item => item.code === 'heartbeatTimeout')).toBe(true)
  })

  it('fails dark when a mock adapter throws during arming', () => {
    const controller = new ProductionOutputController({ defaultAdapter: new ThrowingArmMockProductionOutputAdapter() })
    controller.arm()
    expect(controller.getSnapshot()).toMatchObject({
      emergencyBlackout: true,
      status: { armed: false, blackout: true },
    })
    expect(controller.getSnapshot().diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'adapterFailure', message: 'mock arm failure' }),
    ]))
  })
})

describe('fixture patch validation and universe compilation', () => {
  it('detects overlap, address overflow, invalid universes, and missing profiles', () => {
    const rig = createRig()
    const [first, second, third] = rig.fixtures
    second.patch = { ...first.patch, startAddress: first.patch.startAddress + 1 }
    third.patch = { universe: 70_000, startAddress: 510, channelFootprint: third.patch.channelFootprint }
    third.profileId = 'missing-profile'
    const diagnostics = validateProductionFixturePatch(rig)
    expect(diagnostics.some(item => item.code === 'addressOverlap')).toBe(true)
    expect(diagnostics.some(item => item.code === 'invalidUniverse')).toBe(true)
    expect(diagnostics.some(item => item.code === 'missingProfile')).toBe(true)
  })

  it('fails dark when an address patch contains blocking errors', () => {
    const rig = createRig()
    rig.fixtures[0].patch.startAddress = 512
    const frame = createFrame(rig, { ch1: 255, ch2: 255, ch3: 255, ch4: 255 })
    const prepared = prepareProductionOutputFrame(frame, rig, DEFAULT_PRODUCTION_OUTPUT_SESSION_SETTINGS.safety)
    expect(prepared.blackout).toBe(true)
    expect(prepared.diagnostics.some(item => item.code === 'addressOutOfRange')).toBe(true)
    expect(prepared.universes[0].channels.every(value => value === 0)).toBe(true)
  })

  it('maps profile-relative channels into a 512-channel universe buffer', () => {
    const rig = createRig()
    const fixture = rig.fixtures[0]
    fixture.patch = { ...fixture.patch, universe: 4, startAddress: 101 }
    const frame = createFrame(rig, { ch1: 210, ch2: 255, ch3: 0, ch4: 40, ch5: 50, ch6: 60 })
    frame.fixtures[0].patch = { ...fixture.patch }
    const prepared = prepareProductionOutputFrame(frame, rig, DEFAULT_PRODUCTION_OUTPUT_SESSION_SETTINGS.safety)
    expect(prepared.blackout).toBe(false)
    expect(prepared.universes).toHaveLength(1)
    expect(prepared.universes[0].universe).toBe(4)
    expect(prepared.universes[0].channels).toHaveLength(512)
    expect(prepared.universes[0].channels[100]).toBe(210)
    expect(prepared.universes[0].channels[103]).toBe(40)
  })

  it('carries patch and validation metadata on the canonical compiled output frame', () => {
    const settings = normalizeLaserDmxSettings(createDefaultLaserDmxSettings())
    const rig = buildProductionRig(settings)
    const output = createProductionOutputFrame(rig, 2.5, [])
    expect(output.intensityDomains).toEqual({ preview: 'renderer', hardware: 'adapter' })
    expect(output.safetyMetadata.validationOnly).toBe(true)
    expect(Array.isArray(output.safetyMetadata.exclusionZoneIds)).toBe(true)
  })
})

describe('adapter-side safety preparation', () => {
  it('keeps hardware intensity separate and limits normalized strobe output', () => {
    const rig = createRig()
    const frame = createFrame(rig, { ch1: 200, ch2: 255, ch3: 255, ch4: 180, ch5: 100, ch6: 40 })
    const prepared = prepareProductionOutputFrame(frame, rig, {
      ...DEFAULT_PRODUCTION_OUTPUT_SESSION_SETTINGS.safety,
      hardwareMasterIntensity: 0.5,
      maxStrobeHz: 6,
    })
    const channels = prepared.universes[0].channels
    expect(channels[0]).toBe(100)
    expect(channels[2]).toBe(51)
    expect(channels[3]).toBe(90)
    expect(frame.fixtures[0].channels.ch1).toBe(200)
  })

  it('edge-gates atmospheric triggers and enforces profile cooldown metadata', () => {
    const rig = createRig()
    const fixture = rig.fixtures[0]
    fixture.profileId = 'genericCryoJet'
    fixture.kind = 'cryoJet'
    fixture.patch = { universe: 2, startAddress: 1, channelFootprint: 1 }
    const frame = createFrame(rig, { ch1: 255 })
    frame.fixtures[0] = {
      ...frame.fixtures[0],
      profileId: 'genericCryoJet',
      fixtureKind: 'cryoJet',
      patch: { ...fixture.patch },
      channels: { ch1: 255 },
    }
    const runtime = createProductionOutputSafetyRuntime()
    const safety = DEFAULT_PRODUCTION_OUTPUT_SESSION_SETTINGS.safety
    const first = prepareProductionOutputFrame(frame, rig, safety, { nowMs: 1_000, runtime })
    const held = prepareProductionOutputFrame(frame, rig, safety, { nowMs: 1_100, runtime })
    const low = prepareProductionOutputFrame({ ...frame, fixtures: [{ ...frame.fixtures[0], channels: { ch1: 0 } }] }, rig, safety, { nowMs: 1_200, runtime })
    const tooSoon = prepareProductionOutputFrame(frame, rig, safety, { nowMs: 2_000, runtime })
    prepareProductionOutputFrame({ ...frame, fixtures: [{ ...frame.fixtures[0], channels: { ch1: 0 } }] }, rig, safety, { nowMs: 4_100, runtime })
    const afterCooldown = prepareProductionOutputFrame(frame, rig, safety, { nowMs: 4_200, runtime })
    expect(first.universes[0].channels[0]).toBe(255)
    expect(held.universes[0].channels[0]).toBe(0)
    expect(low.universes[0].channels[0]).toBe(0)
    expect(tooSoon.universes[0].channels[0]).toBe(0)
    expect(afterCooldown.universes[0].channels[0]).toBe(255)
  })
})
