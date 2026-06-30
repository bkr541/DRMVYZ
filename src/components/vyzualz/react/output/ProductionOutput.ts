import {
  getLaserDmxFixtureProfile,
  type ProductionFixtureKind,
  type ProductionFixtureOutputFrame,
  type ProductionOutputFrame,
  type ProductionRig,
  type ProductionSpatialZone,
  type ProductionStageVector3,
} from '../LaserDmxProductionRig'

export const PRODUCTION_DMX_CHANNELS_PER_UNIVERSE = 512
export const PRODUCTION_OUTPUT_HEARTBEAT_TIMEOUT_MS = 1_500
export const PRODUCTION_OUTPUT_STALE_FRAME_MS = 500

export type ProductionOutputProtocol = 'virtual' | 'artNet' | 'sacn'
export type ProductionOutputConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'armed'
  | 'blackout'
  | 'error'
  | 'unavailable'

export type ProductionOutputDiagnosticCode =
  | 'missingProfile'
  | 'invalidUniverse'
  | 'invalidStartAddress'
  | 'invalidFootprint'
  | 'addressOutOfRange'
  | 'addressOverlap'
  | 'excludedZoneTarget'
  | 'staleFrame'
  | 'heartbeatTimeout'
  | 'adapterUnavailable'
  | 'adapterFailure'
  | 'physicalOutputDisabled'
  | 'sessionNotArmed'
  | 'fixtureTestRestricted'

export interface ProductionOutputDiagnostic {
  code: ProductionOutputDiagnosticCode
  severity: 'error' | 'warning' | 'info'
  message: string
  fixtureId?: string
  universe?: number
  address?: number
}

export interface ProductionOutputNetworkBinding {
  interfaceAddress: string
  targetAddress: string
  port: number
  universeOffset: number
  broadcast: boolean
}

export interface ProductionOutputProtocolMetadata {
  id: ProductionOutputProtocol
  label: string
  transport: 'none' | 'udp'
  defaultPort: number | null
  supportedUniverseRange: readonly [number, number]
  executableInCurrentRuntime: boolean
  requiresTrustedHost: boolean
  notes: string
}

export interface ProductionOutputAdapterDescriptor {
  id: string
  label: string
  protocol: ProductionOutputProtocol
  virtual: boolean
  canTransmit: boolean
  enabledByDefault: boolean
  protocolMetadata: ProductionOutputProtocolMetadata
  supportedFixtureKinds: readonly ProductionFixtureKind[]
}

export interface ProductionOutputSafetySettings {
  heartbeatTimeoutMs: number
  staleFrameMs: number
  hardwareMasterIntensity: number
  maxStrobeHz: number
  failDark: boolean
  enforceExclusionZones: boolean
  enforceAtmosphericCooldowns: boolean
}

export interface ProductionOutputSessionSettings {
  selectedAdapterId: string
  physicalOutputEnabled: boolean
  networkBinding: ProductionOutputNetworkBinding | null
  safety: ProductionOutputSafetySettings
}

export interface ProductionUniverseFrame {
  universe: number
  channels: readonly number[]
}

export interface PreparedProductionOutputFrame {
  source: ProductionOutputFrame
  universes: ProductionUniverseFrame[]
  diagnostics: ProductionOutputDiagnostic[]
  blackout: boolean
  hardwareMasterIntensity: number
}

export interface ProductionOutputAdapterStatus {
  adapterId: string
  state: ProductionOutputConnectionState
  connected: boolean
  armed: boolean
  blackout: boolean
  lastFrameAtMs: number | null
  lastHeartbeatAtMs: number | null
  framesSent: number
  lastError: string | null
}

export interface ProductionOutputAdapter {
  readonly descriptor: ProductionOutputAdapterDescriptor
  connect(binding: ProductionOutputNetworkBinding | null): void
  disconnect(): void
  arm(): void
  disarm(reason?: string): void
  sendFrame(frame: PreparedProductionOutputFrame): void
  blackout(reason?: string): void
  heartbeat(nowMs: number): void
  getStatus(): ProductionOutputAdapterStatus
}

export interface ProductionOutputControllerOptions {
  defaultAdapter?: ProductionOutputAdapter
  registerProtocolDescriptors?: boolean
}

export interface ProductionOutputControllerSnapshot {
  status: ProductionOutputAdapterStatus
  session: ProductionOutputSessionSettings
  emergencyBlackout: boolean
  diagnostics: ProductionOutputDiagnostic[]
  registeredAdapters: ProductionOutputAdapterDescriptor[]
  lastUniverseCount: number
  lastFixtureCount: number
  securityModel: 'renderer-only-virtual-output'
}

const ALL_FIXTURE_KINDS: readonly ProductionFixtureKind[] = [
  'laserProjector', 'movingHeadBeam', 'movingHeadSpot', 'movingHeadWash',
  'staticWash', 'strobe', 'blinder', 'ledBar', 'hazer', 'fogger', 'cryoJet',
]

export const PRODUCTION_OUTPUT_PROTOCOLS: Readonly<Record<ProductionOutputProtocol, ProductionOutputProtocolMetadata>> = {
  virtual: {
    id: 'virtual',
    label: 'Virtual production output',
    transport: 'none',
    defaultPort: null,
    supportedUniverseRange: [1, 63_999],
    executableInCurrentRuntime: true,
    requiresTrustedHost: false,
    notes: 'Consumes compiled frames in-process and never opens a network socket.',
  },
  artNet: {
    id: 'artNet',
    label: 'Art-Net 4',
    transport: 'udp',
    defaultPort: 6454,
    supportedUniverseRange: [0, 32_767],
    executableInCurrentRuntime: false,
    requiresTrustedHost: true,
    notes: 'Protocol-ready metadata only. A trusted Electron main-process or equivalent host bridge is required.',
  },
  sacn: {
    id: 'sacn',
    label: 'sACN / E1.31',
    transport: 'udp',
    defaultPort: 5568,
    supportedUniverseRange: [1, 63_999],
    executableInCurrentRuntime: false,
    requiresTrustedHost: true,
    notes: 'Protocol-ready metadata only. A trusted Electron main-process or equivalent host bridge is required.',
  },
}

export const VIRTUAL_PRODUCTION_OUTPUT_ADAPTER_DESCRIPTOR: ProductionOutputAdapterDescriptor = {
  id: 'laserDmxVirtualOutput',
  label: 'Virtual Output',
  protocol: 'virtual',
  virtual: true,
  canTransmit: false,
  enabledByDefault: true,
  protocolMetadata: PRODUCTION_OUTPUT_PROTOCOLS.virtual,
  supportedFixtureKinds: ALL_FIXTURE_KINDS,
}

export const ARTNET_PRODUCTION_OUTPUT_ADAPTER_DESCRIPTOR: ProductionOutputAdapterDescriptor = {
  id: 'laserDmxArtNetOutput',
  label: 'Art-Net Output',
  protocol: 'artNet',
  virtual: false,
  canTransmit: true,
  enabledByDefault: false,
  protocolMetadata: PRODUCTION_OUTPUT_PROTOCOLS.artNet,
  supportedFixtureKinds: ALL_FIXTURE_KINDS,
}

export const SACN_PRODUCTION_OUTPUT_ADAPTER_DESCRIPTOR: ProductionOutputAdapterDescriptor = {
  id: 'laserDmxSacnOutput',
  label: 'sACN / E1.31 Output',
  protocol: 'sacn',
  virtual: false,
  canTransmit: true,
  enabledByDefault: false,
  protocolMetadata: PRODUCTION_OUTPUT_PROTOCOLS.sacn,
  supportedFixtureKinds: ALL_FIXTURE_KINDS,
}

export const DEFAULT_PRODUCTION_OUTPUT_SESSION_SETTINGS: ProductionOutputSessionSettings = {
  selectedAdapterId: VIRTUAL_PRODUCTION_OUTPUT_ADAPTER_DESCRIPTOR.id,
  physicalOutputEnabled: false,
  networkBinding: null,
  safety: {
    heartbeatTimeoutMs: PRODUCTION_OUTPUT_HEARTBEAT_TIMEOUT_MS,
    staleFrameMs: PRODUCTION_OUTPUT_STALE_FRAME_MS,
    hardwareMasterIntensity: 1,
    maxStrobeHz: 8,
    failDark: true,
    enforceExclusionZones: true,
    enforceAtmosphericCooldowns: true,
  },
}

function clampByte(value: unknown): number {
  return Math.max(0, Math.min(255, Math.round(typeof value === 'number' && Number.isFinite(value) ? value : 0)))
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function outputErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function pointInsideZone(point: ProductionStageVector3, zone: ProductionSpatialZone): boolean {
  if (zone.shape === 'sphere') {
    const radius = Math.max(0, zone.size.x, zone.size.y, zone.size.z) / 2
    const dx = point.x - zone.center.x
    const dy = point.y - zone.center.y
    const dz = point.z - zone.center.z
    return dx * dx + dy * dy + dz * dz <= radius * radius
  }
  return Math.abs(point.x - zone.center.x) <= Math.max(0, zone.size.x) / 2
    && Math.abs(point.y - zone.center.y) <= Math.max(0, zone.size.y) / 2
    && Math.abs(point.z - zone.center.z) <= Math.max(0, zone.size.z) / 2
}

export function validateProductionFixturePatch(
  rig: ProductionRig,
  protocol: ProductionOutputProtocol = 'virtual',
): ProductionOutputDiagnostic[] {
  const diagnostics: ProductionOutputDiagnostic[] = []
  const [minUniverse, maxUniverse] = PRODUCTION_OUTPUT_PROTOCOLS[protocol].supportedUniverseRange
  const occupied = new Map<number, Array<{ start: number; end: number; fixtureId: string }>>()
  const targets = new Map(rig.targets.map(target => [target.id, target]))
  const excludedZones = rig.stage.spatialZones.filter(zone => zone.kind === 'excluded')

  for (const fixture of rig.fixtures) {
    const profile = getLaserDmxFixtureProfile(fixture.profileId)
    if (!profile) {
      diagnostics.push({
        code: 'missingProfile', severity: 'error', fixtureId: fixture.id,
        message: `${fixture.name} references missing profile “${fixture.profileId}”.`,
      })
    }
    const footprint = profile
      ? Math.max(0, ...profile.channels.map(channel => channel.channel))
      : fixture.patch.channelFootprint
    const { universe, startAddress } = fixture.patch
    if (!Number.isInteger(universe) || universe < minUniverse || universe > maxUniverse) {
      diagnostics.push({
        code: 'invalidUniverse', severity: 'error', fixtureId: fixture.id, universe,
        message: `${fixture.name} universe ${universe} is outside the ${protocol} range ${minUniverse}-${maxUniverse}.`,
      })
    }
    if (!Number.isInteger(startAddress) || startAddress < 1 || startAddress > PRODUCTION_DMX_CHANNELS_PER_UNIVERSE) {
      diagnostics.push({
        code: 'invalidStartAddress', severity: 'error', fixtureId: fixture.id, universe, address: startAddress,
        message: `${fixture.name} start address must be within 1-${PRODUCTION_DMX_CHANNELS_PER_UNIVERSE}.`,
      })
      continue
    }
    if (footprint < 1) {
      diagnostics.push({
        code: 'invalidFootprint', severity: 'error', fixtureId: fixture.id, universe, address: startAddress,
        message: `${fixture.name} profile has no usable channel footprint.`,
      })
      continue
    }
    const end = startAddress + footprint - 1
    if (end > PRODUCTION_DMX_CHANNELS_PER_UNIVERSE) {
      diagnostics.push({
        code: 'addressOutOfRange', severity: 'error', fixtureId: fixture.id, universe, address: startAddress,
        message: `${fixture.name} occupies ${startAddress}-${end}, beyond channel ${PRODUCTION_DMX_CHANNELS_PER_UNIVERSE}.`,
      })
    }
    const ranges = occupied.get(universe) ?? []
    for (const range of ranges) {
      if (startAddress <= range.end && end >= range.start) {
        diagnostics.push({
          code: 'addressOverlap', severity: 'error', fixtureId: fixture.id, universe, address: startAddress,
          message: `${fixture.name} overlaps fixture ${range.fixtureId} on universe ${universe} (${Math.max(startAddress, range.start)}-${Math.min(end, range.end)}).`,
        })
      }
    }
    ranges.push({ start: startAddress, end, fixtureId: fixture.id })
    occupied.set(universe, ranges)

    const target = fixture.targetId ? targets.get(fixture.targetId) : null
    const point = target?.kind === 'point' ? target.position : target?.center
    const zone = point ? excludedZones.find(candidate => pointInsideZone(point, candidate)) : null
    if (zone) {
      diagnostics.push({
        code: 'excludedZoneTarget', severity: 'warning', fixtureId: fixture.id,
        message: `${fixture.name} targets excluded zone “${zone.name}”. This is validation metadata, not a physical-safety certification.`,
      })
    }
  }
  return diagnostics
}

const BLACKOUT_SOURCES = new Set([
  'dimmer', 'shutter', 'strobe', 'red', 'green', 'blue', 'white',
  'atmosphericOutput', 'trigger',
])
const INTENSITY_SOURCES = new Set(['dimmer', 'red', 'green', 'blue', 'white'])

export interface ProductionOutputSafetyRuntime {
  lastTriggerHigh: Map<string, boolean>
  lastTriggerAtMs: Map<string, number>
}

export function createProductionOutputSafetyRuntime(): ProductionOutputSafetyRuntime {
  return { lastTriggerHigh: new Map(), lastTriggerAtMs: new Map() }
}

function safeFixtureChannels(
  fixture: ProductionFixtureOutputFrame,
  settings: ProductionOutputSafetySettings,
  blackout: boolean,
  nowMs: number,
  runtime: ProductionOutputSafetyRuntime,
): Record<string, number> {
  const profile = getLaserDmxFixtureProfile(fixture.profileId)
  if (!profile) return {}
  const result: Record<string, number> = {}
  const master = clamp01(settings.hardwareMasterIntensity)
  const maxStrobeByte = clampByte(clamp01(settings.maxStrobeHz / 30) * 255)

  for (const channel of profile.channels) {
    const name = `ch${channel.channel}`
    let value = clampByte(fixture.channels[name])
    if (blackout && BLACKOUT_SOURCES.has(channel.source)) value = 0
    if (!blackout && INTENSITY_SOURCES.has(channel.source)) value = clampByte(value * master)
    if (!blackout && channel.source === 'strobe') value = Math.min(value, maxStrobeByte)
    if (channel.source === 'trigger' && settings.enforceAtmosphericCooldowns) {
      const high = value > 0
      const wasHigh = runtime.lastTriggerHigh.get(fixture.fixtureId) ?? false
      const cooldownMs = profile.capabilities.trigger?.cooldownMs ?? 0
      const lastAt = runtime.lastTriggerAtMs.get(fixture.fixtureId) ?? Number.NEGATIVE_INFINITY
      const allowed = high && !wasHigh && nowMs - lastAt >= cooldownMs
      value = allowed && !blackout ? value : 0
      if (allowed) runtime.lastTriggerAtMs.set(fixture.fixtureId, nowMs)
      runtime.lastTriggerHigh.set(fixture.fixtureId, high)
    }
    result[name] = value
  }
  return result
}

export function prepareProductionOutputFrame(
  frame: ProductionOutputFrame,
  rig: ProductionRig,
  settings: ProductionOutputSafetySettings,
  options: { blackout?: boolean; protocol?: ProductionOutputProtocol; nowMs?: number; runtime?: ProductionOutputSafetyRuntime } = {},
): PreparedProductionOutputFrame {
  const nowMs = options.nowMs ?? Date.now()
  const runtime = options.runtime ?? createProductionOutputSafetyRuntime()
  const diagnostics = validateProductionFixturePatch(rig, options.protocol ?? 'virtual')
  const failDark = Boolean(options.blackout) || (settings.failDark && diagnostics.some(item => item.severity === 'error'))
  const universeMap = new Map<number, number[]>()

  for (const fixture of frame.fixtures) {
    const safeChannels = safeFixtureChannels(fixture, settings, failDark, nowMs, runtime)
    const universe = fixture.patch.universe
    const target = universeMap.get(universe) ?? Array.from({ length: PRODUCTION_DMX_CHANNELS_PER_UNIVERSE }, () => 0)
    for (const [name, value] of Object.entries(safeChannels)) {
      const relativeChannel = Number.parseInt(name.replace(/^ch/, ''), 10)
      if (!Number.isInteger(relativeChannel) || relativeChannel < 1) continue
      const absoluteChannel = fixture.patch.startAddress + relativeChannel - 1
      if (absoluteChannel < 1 || absoluteChannel > PRODUCTION_DMX_CHANNELS_PER_UNIVERSE) continue
      target[absoluteChannel - 1] = clampByte(value)
    }
    universeMap.set(universe, target)
  }

  return {
    source: frame,
    universes: [...universeMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([universe, channels]) => ({ universe, channels })),
    diagnostics,
    blackout: failDark,
    hardwareMasterIntensity: clamp01(settings.hardwareMasterIntensity),
  }
}

export class VirtualProductionOutputAdapter implements ProductionOutputAdapter {
  readonly descriptor = VIRTUAL_PRODUCTION_OUTPUT_ADAPTER_DESCRIPTOR
  private status: ProductionOutputAdapterStatus = {
    adapterId: this.descriptor.id,
    state: 'disconnected',
    connected: false,
    armed: false,
    blackout: false,
    lastFrameAtMs: null,
    lastHeartbeatAtMs: null,
    framesSent: 0,
    lastError: null,
  }
  private lastFrame: PreparedProductionOutputFrame | null = null

  connect(_binding: ProductionOutputNetworkBinding | null): void {
    this.status = { ...this.status, state: 'connected', connected: true, lastError: null }
  }

  disconnect(): void {
    this.status = { ...this.status, state: 'disconnected', connected: false, armed: false, blackout: true }
    this.lastFrame = null
  }

  arm(): void {
    if (!this.status.connected) this.connect(null)
    this.status = { ...this.status, state: 'armed', armed: true, blackout: false }
  }

  disarm(reason?: string): void {
    this.status = { ...this.status, state: this.status.connected ? 'connected' : 'disconnected', armed: false, blackout: true, lastError: reason ?? null }
  }

  sendFrame(frame: PreparedProductionOutputFrame): void {
    if (!this.status.connected) this.connect(null)
    const nowMs = Date.now()
    this.lastFrame = frame
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

  getLastFrame(): PreparedProductionOutputFrame | null {
    return this.lastFrame
  }
}

export class ProductionOutputController {
  private readonly adapters = new Map<string, ProductionOutputAdapter>()
  private readonly descriptors = new Map<string, ProductionOutputAdapterDescriptor>()
  private readonly listeners = new Set<() => void>()
  private readonly safetyRuntime = createProductionOutputSafetyRuntime()
  private session: ProductionOutputSessionSettings = structuredClone(DEFAULT_PRODUCTION_OUTPUT_SESSION_SETTINGS)
  private emergencyBlackout = false
  private diagnostics: ProductionOutputDiagnostic[] = []
  private lastUniverseCount = 0
  private lastFixtureCount = 0
  private lastSubmittedAtMs: number | null = null
  private snapshotCache: ProductionOutputControllerSnapshot | null = null

  constructor(options: ProductionOutputControllerOptions = {}) {
    const defaultAdapter = options.defaultAdapter ?? new VirtualProductionOutputAdapter()
    this.session = { ...this.session, selectedAdapterId: defaultAdapter.descriptor.id }
    this.registerAdapter(defaultAdapter)
    if (options.registerProtocolDescriptors !== false) {
      this.registerDescriptor(ARTNET_PRODUCTION_OUTPUT_ADAPTER_DESCRIPTOR)
      this.registerDescriptor(SACN_PRODUCTION_OUTPUT_ADAPTER_DESCRIPTOR)
    }
    this.adapters.get(this.session.selectedAdapterId)?.connect(null)
  }

  registerAdapter(adapter: ProductionOutputAdapter): void {
    this.adapters.set(adapter.descriptor.id, adapter)
    this.descriptors.set(adapter.descriptor.id, adapter.descriptor)
    this.emit()
  }

  registerDescriptor(descriptor: ProductionOutputAdapterDescriptor): void {
    this.descriptors.set(descriptor.id, descriptor)
    this.emit()
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): ProductionOutputControllerSnapshot => {
    if (this.snapshotCache) return this.snapshotCache
    const adapter = this.adapters.get(this.session.selectedAdapterId)
    const descriptor = this.descriptors.get(this.session.selectedAdapterId)
    const status = adapter?.getStatus() ?? {
      adapterId: descriptor?.id ?? this.session.selectedAdapterId,
      state: 'unavailable' as const,
      connected: false,
      armed: false,
      blackout: true,
      lastFrameAtMs: null,
      lastHeartbeatAtMs: null,
      framesSent: 0,
      lastError: descriptor?.protocolMetadata.notes ?? 'Adapter is unavailable.',
    }
    this.snapshotCache = {
      status,
      session: structuredClone(this.session),
      emergencyBlackout: this.emergencyBlackout,
      diagnostics: [...this.diagnostics],
      registeredAdapters: [...this.descriptors.values()],
      lastUniverseCount: this.lastUniverseCount,
      lastFixtureCount: this.lastFixtureCount,
      securityModel: 'renderer-only-virtual-output',
    }
    return this.snapshotCache
  }

  setHardwareMasterIntensity(value: number): void {
    this.session = {
      ...this.session,
      safety: { ...this.session.safety, hardwareMasterIntensity: clamp01(value) },
    }
    this.emit()
  }

  setMaxStrobeHz(value: number): void {
    this.session = {
      ...this.session,
      safety: { ...this.session.safety, maxStrobeHz: Math.max(0, Math.min(30, Number.isFinite(value) ? value : 0)) },
    }
    this.emit()
  }

  selectAdapter(adapterId: string): void {
    if (adapterId === this.session.selectedAdapterId) return
    this.disarm('Adapter selection changed')
    try {
      this.adapters.get(this.session.selectedAdapterId)?.disconnect()
    } catch (error) {
      this.failDark(outputErrorMessage(error, 'Adapter disconnect failed'))
      return
    }
    this.session = { ...this.session, selectedAdapterId: adapterId, physicalOutputEnabled: false, networkBinding: null }
    const adapter = this.adapters.get(adapterId)
    if (adapter) {
      try {
        adapter.connect(null)
      } catch (error) {
        this.failDark(outputErrorMessage(error, 'Adapter connection failed'))
        return
      }
    } else {
      this.diagnostics = [{ code: 'adapterUnavailable', severity: 'info', message: this.descriptors.get(adapterId)?.protocolMetadata.notes ?? 'Adapter unavailable.' }]
    }
    this.emit()
  }

  configurePhysicalOutput(binding: ProductionOutputNetworkBinding): void {
    this.disarm('Network settings changed')
    this.session = { ...this.session, networkBinding: { ...binding }, physicalOutputEnabled: false }
    this.emit()
  }

  setPhysicalOutputEnabled(enabled: boolean): void {
    const descriptor = this.descriptors.get(this.session.selectedAdapterId)
    const executable = descriptor?.canTransmit && descriptor.protocolMetadata.executableInCurrentRuntime
    this.session = { ...this.session, physicalOutputEnabled: Boolean(enabled && executable) }
    if (enabled && !executable) {
      this.diagnostics = [{
        code: 'adapterUnavailable', severity: 'error',
        message: 'Physical output cannot be enabled because this build has no trusted Electron main-process or host bridge.',
      }]
    }
    if (!this.session.physicalOutputEnabled) this.disarm('Physical output disabled')
    this.emit()
  }

  arm(): void {
    const descriptor = this.descriptors.get(this.session.selectedAdapterId)
    const adapter = this.adapters.get(this.session.selectedAdapterId)
    if (!adapter || !descriptor) {
      this.failDark('Adapter is unavailable', 'adapterUnavailable')
      return
    }
    if (descriptor.canTransmit && !this.session.physicalOutputEnabled) {
      this.diagnostics = [{ code: 'physicalOutputDisabled', severity: 'error', message: 'Physical output must be explicitly enabled before arming.' }]
      this.failDark('Physical output disabled', 'physicalOutputDisabled')
      return
    }
    if (descriptor.canTransmit && !this.session.networkBinding) {
      this.failDark('No user-selected network binding', 'adapterUnavailable')
      return
    }
    this.emergencyBlackout = false
    try {
      adapter.arm()
    } catch (error) {
      this.failDark(outputErrorMessage(error, 'Adapter arm failed'))
      return
    }
    this.emit()
  }

  disarm(reason = 'Output disarmed'): void {
    try {
      this.adapters.get(this.session.selectedAdapterId)?.disarm(reason)
    } catch (error) {
      this.failDark(outputErrorMessage(error, 'Adapter disarm failed'))
      return
    }
    this.emit()
  }

  emergencyBlackoutNow(reason = 'Emergency blackout'): void {
    this.emergencyBlackout = true
    try {
      this.adapters.get(this.session.selectedAdapterId)?.blackout(reason)
    } catch (error) {
      this.failDark(outputErrorMessage(error, 'Adapter blackout failed'))
      return
    }
    this.emit()
  }

  clearEmergencyBlackout(): void {
    this.emergencyBlackout = false
    this.emit()
  }

  transportStopped(reason = 'LaserDMX transport stopped'): void {
    const adapter = this.adapters.get(this.session.selectedAdapterId)
    const status = adapter?.getStatus()
    if (!adapter || (!status?.armed && status?.blackout)) return
    try {
      adapter.blackout(reason)
      adapter.disarm(reason)
    } catch (error) {
      this.failDark(outputErrorMessage(error, 'Adapter transport-stop handling failed'))
      return
    }
    this.emit()
  }

  submitFrame(frame: ProductionOutputFrame, rig: ProductionRig, nowMs = Date.now()): void {
    const descriptor = this.descriptors.get(this.session.selectedAdapterId)
    const adapter = this.adapters.get(this.session.selectedAdapterId)
    if (!descriptor || !adapter) {
      this.failDark('Selected adapter is unavailable', 'adapterUnavailable')
      return
    }
    const runtimeDiagnostics: ProductionOutputDiagnostic[] = []
    if (this.lastSubmittedAtMs !== null && nowMs - this.lastSubmittedAtMs > this.session.safety.staleFrameMs) {
      runtimeDiagnostics.push({ code: 'staleFrame', severity: 'warning', message: `Frame gap exceeded ${this.session.safety.staleFrameMs} ms; output was forced dark before resuming.` })
      try {
        adapter.blackout('Stale frame')
      } catch (error) {
        this.failDark(outputErrorMessage(error, 'Adapter stale-frame blackout failed'))
        return
      }
    }
    this.lastSubmittedAtMs = nowMs
    const prepared = prepareProductionOutputFrame(frame, rig, this.session.safety, {
      blackout: this.emergencyBlackout,
      protocol: descriptor.protocol,
      nowMs,
      runtime: this.safetyRuntime,
    })
    this.diagnostics = [...runtimeDiagnostics, ...prepared.diagnostics]
    this.lastUniverseCount = prepared.universes.length
    this.lastFixtureCount = frame.fixtures.length

    if (descriptor.canTransmit && (!this.session.physicalOutputEnabled || !adapter.getStatus().armed)) {
      adapter.blackout(!this.session.physicalOutputEnabled ? 'Physical output disabled' : 'Session not armed')
      this.diagnostics = [
        ...this.diagnostics,
        {
          code: !this.session.physicalOutputEnabled ? 'physicalOutputDisabled' : 'sessionNotArmed',
          severity: 'info',
          message: !this.session.physicalOutputEnabled ? 'Real output is disabled.' : 'Real output is not armed for this session.',
        },
      ]
      this.emit()
      return
    }

    try {
      adapter.sendFrame(prepared)
    } catch (error) {
      this.failDark(outputErrorMessage(error, 'Adapter failure'))
      return
    }
    this.emit()
  }

  submitFixtureTest(frame: ProductionOutputFrame, rig: ProductionRig, fixtureId: string): void {
    const descriptor = this.descriptors.get(this.session.selectedAdapterId)
    if (!descriptor?.virtual) {
      this.diagnostics = [{
        code: 'fixtureTestRestricted', severity: 'error', fixtureId,
        message: 'Fixture test output is restricted to the virtual adapter in this build.',
      }]
      this.disarm('Fixture test restricted')
      return
    }
    this.submitFrame({ ...frame, fixtures: frame.fixtures.filter(fixture => fixture.fixtureId === fixtureId) }, rig)
  }

  heartbeat(nowMs = Date.now()): void {
    const adapter = this.adapters.get(this.session.selectedAdapterId)
    if (!adapter) return
    const status = adapter.getStatus()
    if (!this.emergencyBlackout && status.lastFrameAtMs !== null && nowMs - status.lastFrameAtMs > this.session.safety.heartbeatTimeoutMs) {
      this.diagnostics = [{
        code: 'heartbeatTimeout', severity: 'error',
        message: `No production frame arrived within ${this.session.safety.heartbeatTimeoutMs} ms; output failed dark.`,
      }]
      this.failDark('Heartbeat timeout', 'heartbeatTimeout')
      return
    }
    try {
      adapter.heartbeat(nowMs)
    } catch (error) {
      this.failDark(outputErrorMessage(error, 'Adapter heartbeat failed'))
      return
    }
    this.emit()
  }

  handleAuthChange(): void {
    this.emergencyBlackoutNow('Authentication or account changed')
    this.disarm('Authentication or account changed')
  }

  handleRendererCrash(section?: string): void {
    this.emergencyBlackoutNow(`Renderer crash${section ? `: ${section}` : ''}`)
    this.disarm('Renderer crash')
  }

  shutdown(reason = 'Application closing'): void {
    this.emergencyBlackoutNow(reason)
    this.disarm(reason)
    try {
      this.adapters.get(this.session.selectedAdapterId)?.disconnect()
    } catch (error) {
      this.failDark(outputErrorMessage(error, 'Adapter disconnect failed during shutdown'))
      return
    }
    this.emit()
  }

  private failDark(message: string, code: ProductionOutputDiagnosticCode = 'adapterFailure'): void {
    this.emergencyBlackout = true
    const adapter = this.adapters.get(this.session.selectedAdapterId)
    try { adapter?.blackout(message) } catch { /* fail-dark state is retained locally */ }
    try { adapter?.disarm(message) } catch { /* fail-dark state is retained locally */ }
    this.diagnostics = [{ code, severity: 'error', message }]
    this.emit()
  }

  private emit(): void {
    this.snapshotCache = null
    for (const listener of this.listeners) listener()
  }
}

export const productionOutputController = new ProductionOutputController()
