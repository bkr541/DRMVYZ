import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { LaserDmxLookEditor } from './LaserDmxLookEditor'
import {
  SliderRow, SelectRow, ToggleRow, TextInputRow, NumberInputRow,
  CtrlSection, Collapsible,
} from './ReactControlRows'
import type { LaserDmxFixture, LaserDmxProfileId } from './ReactTypes'
import {
  ALL_PRODUCTION_FIXTURE_KINDS,
  DEFAULT_PRODUCTION_CHASE,
  DEFAULT_PRODUCTION_FIXTURE_COLOR_POLICY,
  DEFAULT_PRODUCTION_FLASH_PATTERN,
  DEFAULT_PRODUCTION_GROUP_MOVEMENT,
  DEFAULT_PRODUCTION_LED_BAR_SETTINGS,
  DEFAULT_PRODUCTION_ATMOSPHERIC_FIXTURE_SETTINGS,
  DEFAULT_PRODUCTION_WASH_SETTINGS,
  diagnoseProductionRig,
  getLaserDmxFixtureProfile,
  isMovingHeadFixtureKind,
  LASER_DMX_FIXTURE_PROFILES,
  normalizeProductionChase,
  normalizeProductionChoreographySettings,
  normalizeProductionFixtureColorPolicy,
  normalizeProductionFlashPattern,
  normalizeProductionGroupMovement,
  normalizeProductionLedBarSettings,
  normalizeProductionAtmosphereSettings,
  normalizeProductionAtmosphericFixtureSettings,
  normalizeProductionMovingHeadSettings,
  normalizeProductionStageModel,
  normalizeProductionVisualComfort,
  normalizeProductionWashSettings,
  type ProductionChaseOrder,
  type ProductionChoreographyProfileId,
  type ProductionFlashPatternId,
  type ProductionFlashQuantize,
  type ProductionFlashRepeatMode,
  type ProductionFlashRetriggerPolicy,
  type ProductionLedBarMode,
  type ProductionLedBarPattern,
  PRODUCTION_STAGE_COORDINATE_CONVENTION,
  PRODUCTION_VENUE_TEMPLATES,
  resolveLaserDmxFixtureCapabilities,
  resolveLaserDmxFixtureStageTransform,
  setActiveProductionCameraView,
  stageVectorToLegacyNormalized,
  type ProductionStageModel,
  type ProductionStageTransform,
  type ProductionGroupMovementGenerator,
  type ProductionMovementDirection,
  type ProductionMovementQuantize,
  type ProductionMovementSymmetry,
  type ProductionMovingHeadEasing,
  type ProductionWhiteAccentPolicy,
} from './LaserDmxProductionRig'
import { PRODUCTION_CHOREOGRAPHY_PROFILES } from './renderers/LaserDmxChoreographyEngine'

const PROFILE_OPTIONS = Object.values(LASER_DMX_FIXTURE_PROFILES).map(profile => ({
  value: profile.id,
  label: profile.label,
}))

const CHOREOGRAPHY_PROFILE_OPTIONS = [
  ...Object.values(PRODUCTION_CHOREOGRAPHY_PROFILES).map(profile => ({ value: profile.id, label: profile.label })),
  { value: 'custom', label: 'Custom' },
]

const CHOREOGRAPHY_FAMILY_LABELS: Record<(typeof ALL_PRODUCTION_FIXTURE_KINDS)[number], string> = {
  laserProjector: 'Lasers',
  movingHeadBeam: 'Moving-Head Beams',
  movingHeadSpot: 'Moving-Head Spots',
  movingHeadWash: 'Moving-Head Washes',
  staticWash: 'Static Washes',
  strobe: 'Strobes',
  blinder: 'Blinders',
  ledBar: 'LED Bars',
  hazer: 'Hazers',
  fogger: 'Foggers',
  cryoJet: 'Cryogenic Jets',
}

const PATH_KIND_OPTIONS = [
  { value: 'staticBeam', label: 'Static Beam' },
  { value: 'lineSweep', label: 'Line Sweep' },
  { value: 'fan', label: 'Fan' },
  { value: 'cone', label: 'Cone' },
  { value: 'circle', label: 'Circle' },
  { value: 'spiral', label: 'Spiral' },
  { value: 'lissajous', label: 'Lissajous' },
  { value: 'grid', label: 'Grid' },
  { value: 'tunnel', label: 'Tunnel' },
  { value: 'constellation', label: 'Constellation' },
  { value: 'svgPath', label: 'SVG Path' },
  { value: 'textPath', label: 'Text Path' },
]

const COLOR_MODE_OPTIONS = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'palette', label: 'Palette' },
  { value: 'music', label: 'Music' },
]

const MOVEMENT_GENERATOR_OPTIONS: Array<{ value: ProductionGroupMovementGenerator; label: string }> = [
  { value: 'mirroredFan', label: 'Mirrored Fan' },
  { value: 'fanOpen', label: 'Fan Open' },
  { value: 'fanClose', label: 'Fan Close' },
  { value: 'centerOutSpread', label: 'Center-Out Spread' },
  { value: 'outsideInCollapse', label: 'Outside-In Collapse' },
  { value: 'crossfire', label: 'Crossfire' },
  { value: 'tunnel', label: 'Tunnel' },
  { value: 'ceilingCanopy', label: 'Ceiling Canopy' },
  { value: 'crowdScan', label: 'Crowd Scan' },
  { value: 'pendulum', label: 'Pendulum' },
  { value: 'figureEight', label: 'Figure Eight' },
  { value: 'panWave', label: 'Pan Wave' },
  { value: 'tiltWave', label: 'Tilt Wave' },
  { value: 'alternatingBanks', label: 'Alternating Banks' },
  { value: 'staticAerialHold', label: 'Static Aerial Hold' },
]

const MOVEMENT_DIRECTION_OPTIONS = [
  { value: 'forward', label: 'Forward' },
  { value: 'reverse', label: 'Reverse' },
  { value: 'alternate', label: 'Alternate Banks' },
]

const MOVEMENT_SYMMETRY_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'mirrorPairs', label: 'Mirror Pairs' },
  { value: 'centerMirror', label: 'Center Mirror' },
  { value: 'alternatingBanks', label: 'Alternating Banks' },
]

const MOVEMENT_QUANTIZE_OPTIONS = [
  { value: 'none', label: 'Custom Duration' },
  { value: 'beat', label: '1 Beat' },
  { value: 'bar', label: '1 Bar' },
  { value: 'phrase', label: '1 Phrase (16 beats)' },
]

const MOVEMENT_EASING_OPTIONS = [
  { value: 'linear', label: 'Linear' },
  { value: 'easeIn', label: 'Ease In' },
  { value: 'easeOut', label: 'Ease Out' },
  { value: 'easeInOut', label: 'Ease In / Out' },
]

const FLASH_PATTERN_OPTIONS: Array<{ value: ProductionFlashPatternId; label: string }> = [
  { value: 'singleHit', label: 'Single Hit' },
  { value: 'doubleHit', label: 'Double Hit' },
  { value: 'tripleHit', label: 'Triple Hit' },
  { value: 'sustainedStrobe', label: 'Sustained Strobe' },
  { value: 'quarterBeatBurst', label: 'Quarter-Beat Burst' },
  { value: 'eighthNoteBurst', label: 'Eighth-Note Burst' },
  { value: 'rampUpBuildStrobe', label: 'Ramp-Up Build Strobe' },
  { value: 'alternatingLeftRight', label: 'Alternating Left / Right' },
  { value: 'centerOutFlash', label: 'Center-Out Flash' },
  { value: 'randomizedFlicker', label: 'Deterministic Flicker' },
  { value: 'fullStageWhiteout', label: 'Full-Stage Whiteout' },
  { value: 'flashThenBlackout', label: 'Flash then Blackout' },
]

const FLASH_QUANTIZE_OPTIONS = [
  { value: 'none', label: 'Free' },
  { value: 'sixteenth', label: '1/16 Note' },
  { value: 'eighth', label: '1/8 Note' },
  { value: 'beat', label: 'Beat' },
  { value: 'bar', label: 'Bar' },
]

const FLASH_REPEAT_OPTIONS = [
  { value: 'once', label: 'Once' },
  { value: 'count', label: 'Count' },
  { value: 'loop', label: 'Loop' },
]

const FLASH_RETRIGGER_OPTIONS = [
  { value: 'restart', label: 'Restart' },
  { value: 'ignoreWhileActive', label: 'Ignore While Active' },
  { value: 'queueNextQuantized', label: 'Queue Next Quantized' },
]

const CHASE_ORDER_OPTIONS = [
  { value: 'forward', label: 'Forward' },
  { value: 'reverse', label: 'Reverse' },
  { value: 'alternate', label: 'Alternate' },
  { value: 'centerOut', label: 'Center Out' },
  { value: 'outsideIn', label: 'Outside In' },
  { value: 'randomized', label: 'Deterministic Random' },
]

const LED_PATTERN_OPTIONS = [
  { value: 'solid', label: 'Solid' },
  { value: 'alternating', label: 'Alternating' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'chase', label: 'Segment Chase' },
  { value: 'sparkle', label: 'Deterministic Sparkle' },
]

const RATE_DRIVEN_FLASH_PATTERNS = new Set<ProductionFlashPatternId>([
  'sustainedStrobe',
  'rampUpBuildStrobe',
  'alternatingLeftRight',
  'randomizedFlicker',
])

type ColorKey = keyof LaserDmxFixture['color']
type BeamKey = keyof LaserDmxFixture['beam']
type PathKey = keyof LaserDmxFixture['path']

export function LaserDmxSpatialFixturesPanel() {
  const {
    laserDmxSettings,
    setLaserDmxSettings,
    selectLaserFixture,
    addLaserFixture,
    duplicateLaserFixture,
    removeLaserFixture,
    updateLaserFixture,
    applyLaserDmxVenueTemplate,
    triggerLaserAtmosphericFixture,
    clearLaserAtmosphericBursts,
    triggerLaserAtmosphericGroup,
  } = useReactStore(useShallow(state => ({
    laserDmxSettings: state.laserDmxSettings,
    setLaserDmxSettings: state.setLaserDmxSettings,
    selectLaserFixture: state.selectLaserFixture,
    addLaserFixture: state.addLaserFixture,
    duplicateLaserFixture: state.duplicateLaserFixture,
    removeLaserFixture: state.removeLaserFixture,
    updateLaserFixture: state.updateLaserFixture,
    applyLaserDmxVenueTemplate: state.applyLaserDmxVenueTemplate,
    triggerLaserAtmosphericFixture: state.triggerLaserAtmosphericFixture,
    clearLaserAtmosphericBursts: state.clearLaserAtmosphericBursts,
    triggerLaserAtmosphericGroup: state.triggerLaserAtmosphericGroup,
  })))

  const [newProfileId, setNewProfileId] = useState<LaserDmxProfileId>('genericRgbLaser')
  const [venueTemplateId, setVenueTemplateId] = useState<(typeof PRODUCTION_VENUE_TEMPLATES)[number]['id']>(PRODUCTION_VENUE_TEMPLATES[1].id)
  const [movementGroupId, setMovementGroupId] = useState('')
  const { fixtures, selectedFixtureId } = laserDmxSettings
  const fixture = fixtures.find(candidate => candidate.id === selectedFixtureId) ?? fixtures[0] ?? null
  const fixtureId = fixture?.id ?? ''
  const capabilities = fixture ? resolveLaserDmxFixtureCapabilities(fixture) : null
  const stage = normalizeProductionStageModel(laserDmxSettings.productionStage)
  const transform = fixture ? resolveLaserDmxFixtureStageTransform(fixture, stage) : null
  const diagnostics = diagnoseProductionRig(laserDmxSettings)
  const groups = laserDmxSettings.productionGroups ?? []
  const targets = laserDmxSettings.productionTargets ?? []
  const movingHead = fixture && isMovingHeadFixtureKind(fixture.fixtureKind)
    ? normalizeProductionMovingHeadSettings(fixture.movingHead)
    : null
  const movementGroup = groups.find(group => group.id === movementGroupId)
    ?? groups.find(group => fixture && group.fixtureIds.includes(fixture.id))
    ?? groups[0]
    ?? null
  const movement = normalizeProductionGroupMovement(movementGroup?.movement)
  const groupChase = normalizeProductionChase(movementGroup?.chase)
  const visualComfort = normalizeProductionVisualComfort(laserDmxSettings.visualComfort)
  const atmosphere = normalizeProductionAtmosphereSettings(laserDmxSettings.atmosphere)
  const choreography = normalizeProductionChoreographySettings(laserDmxSettings.choreography)
  const colorPolicy = normalizeProductionFixtureColorPolicy(fixture?.colorPolicy)
  const flashPattern = normalizeProductionFlashPattern(fixture?.flashPattern)
  const wash = normalizeProductionWashSettings(fixture?.wash)
  const atmosphericMedium = capabilities?.atmosphericOutput?.medium ?? 'fog'
  const atmospheric = normalizeProductionAtmosphericFixtureSettings(fixture?.atmospheric, atmosphericMedium)
  const ledBar = normalizeProductionLedBarSettings(
    fixture?.ledBar,
    capabilities?.pixels?.maxSegments ?? DEFAULT_PRODUCTION_LED_BAR_SETTINGS.segmentCount,
  )

  function updateStage(patch: Partial<ProductionStageModel>) {
    setLaserDmxSettings({ productionStage: normalizeProductionStageModel({ ...stage, ...patch }) })
  }

  function updateTransform(next: ProductionStageTransform) {
    if (!fixture) return
    const legacy = stageVectorToLegacyNormalized(next.position, stage)
    updateLaserFixture(fixture.id, {
      stageTransform: next,
      position: {
        ...fixture.position,
        originX: legacy.x,
        originY: legacy.y,
        originZ: legacy.z,
        pan: next.orientation.yawDeg,
        tilt: next.orientation.pitchDeg,
        rotation: next.orientation.rollDeg,
      },
    })
  }

  function updatePosition(axis: 'x' | 'y' | 'z', value: number) {
    if (!transform) return
    updateTransform({ ...transform, position: { ...transform.position, [axis]: value } })
  }

  function updateOrientation(axis: 'yawDeg' | 'pitchDeg' | 'rollDeg', value: number) {
    if (!transform) return
    const orientation = { ...transform.orientation, [axis]: value }
    if (axis === 'yawDeg') orientation.panDeg = value
    if (axis === 'pitchDeg') orientation.tiltDeg = value
    updateTransform({ ...transform, orientation })
  }

  function setColor<K extends ColorKey>(key: K, value: LaserDmxFixture['color'][K]) {
    if (!fixture) return
    updateLaserFixture(fixtureId, { color: { ...fixture.color, [key]: value } })
  }

  function setBeam<K extends BeamKey>(key: K, value: LaserDmxFixture['beam'][K]) {
    if (!fixture) return
    updateLaserFixture(fixtureId, { beam: { ...fixture.beam, [key]: value } })
  }

  function setPath<K extends PathKey>(key: K, value: LaserDmxFixture['path'][K]) {
    if (!fixture) return
    updateLaserFixture(fixtureId, { path: { ...fixture.path, [key]: value } })
  }

  function updateMovingHead(patch: Partial<NonNullable<LaserDmxFixture['movingHead']>>) {
    if (!fixture || !movingHead) return
    updateLaserFixture(fixture.id, { movingHead: { ...movingHead, ...patch } })
  }

  function updateColorPolicy(patch: Partial<typeof colorPolicy>) {
    if (!fixture) return
    updateLaserFixture(fixture.id, {
      colorPolicy: normalizeProductionFixtureColorPolicy({ ...colorPolicy, ...patch }),
    })
  }

  function updateFlashPattern(patch: Partial<typeof flashPattern>) {
    if (!fixture || !capabilities?.strobe) return
    updateLaserFixture(fixture.id, {
      flashPattern: normalizeProductionFlashPattern({ ...flashPattern, ...patch }),
    })
  }

  function updateWash(patch: Partial<typeof wash>) {
    if (!fixture || !capabilities?.wash) return
    updateLaserFixture(fixture.id, {
      wash: normalizeProductionWashSettings({ ...wash, ...patch }),
    })
  }

  function updateAtmospheric(patch: Partial<typeof atmospheric>) {
    if (!fixture || !capabilities?.atmosphericOutput) return
    updateLaserFixture(fixture.id, { atmospheric: normalizeProductionAtmosphericFixtureSettings({ ...atmospheric, ...patch }, capabilities.atmosphericOutput.medium) })
  }

  function updateLedBar(patch: Partial<typeof ledBar>) {
    if (!fixture || !capabilities?.pixels) return
    updateLaserFixture(fixture.id, {
      ledBar: normalizeProductionLedBarSettings({ ...ledBar, ...patch }, capabilities.pixels.maxSegments),
    })
  }

  function requestMovingHeadSnap() {
    if (!movingHead) return
    updateMovingHead({ snapRequestId: movingHead.snapRequestId + 1 })
  }

  function updateGroupMovement(patch: Partial<typeof movement>) {
    if (!movementGroup) return
    setLaserDmxSettings({
      productionGroups: groups.map(group => group.id === movementGroup.id
        ? { ...group, movement: normalizeProductionGroupMovement({ ...movement, ...patch }) }
        : group),
    })
  }

  function updateGroupChase(patch: Partial<typeof groupChase>) {
    if (!movementGroup) return
    setLaserDmxSettings({
      productionGroups: groups.map(group => group.id === movementGroup.id
        ? { ...group, chase: normalizeProductionChase({ ...groupChase, ...patch }) }
        : group),
    })
  }

  function toggleGroup(groupId: string) {
    if (!fixture) return
    setLaserDmxSettings({
      productionGroups: groups.map(group => ({
        ...group,
        fixtureIds: group.id === groupId
          ? (group.fixtureIds.includes(fixture.id)
              ? group.fixtureIds.filter(id => id !== fixture.id)
              : [...group.fixtureIds, fixture.id])
          : group.fixtureIds,
      })),
    })
  }

  function addGroup() {
    const id = crypto.randomUUID()
    setLaserDmxSettings({
      productionGroups: [...groups, {
        id,
        name: `Fixture Group ${groups.length + 1}`,
        fixtureIds: fixture ? [fixture.id] : [],
        movement: { ...DEFAULT_PRODUCTION_GROUP_MOVEMENT, centerPoint: { ...DEFAULT_PRODUCTION_GROUP_MOVEMENT.centerPoint } },
        chase: { ...DEFAULT_PRODUCTION_CHASE },
      }],
    })
    setMovementGroupId(id)
  }

  return (
    <>
      <CtrlSection label="Looks / Output" />
      <LaserDmxLookEditor />

      <CtrlSection label="Venue / Stage" />
      <SelectRow
        label="Starter Layout"
        value={venueTemplateId}
        onChange={value => setVenueTemplateId(value as (typeof PRODUCTION_VENUE_TEMPLATES)[number]['id'])}
        options={PRODUCTION_VENUE_TEMPLATES.map(template => ({ value: template.id, label: template.label }))}
        description="Applying is explicit and replaces the current stage layout and shared targets."
      />
      <button
        type="button"
        className="rv-glyph-upload-btn"
        onClick={() => applyLaserDmxVenueTemplate(venueTemplateId)}
        aria-label={`Apply ${PRODUCTION_VENUE_TEMPLATES.find(template => template.id === venueTemplateId)?.label ?? 'venue'} layout`}
      >
        Apply Layout
      </button>
      <div className="rv-ctrl-info">Axes: +X stage right, +Y up, +Z upstage. Origin is centre-downstage floor. Units are metres.</div>
      <span className="rv-ctrl-description" style={{ display: 'none' }}>{PRODUCTION_STAGE_COORDINATE_CONVENTION}</span>

      <Collapsible label="Stage Dimensions" defaultOpen={false}>
        <NumberInputRow label="Width" value={stage.dimensions.width} min={1} max={100} unit="m" onChange={width => updateStage({ dimensions: { ...stage.dimensions, width }, floor: { ...stage.floor, width } })} />
        <NumberInputRow label="Height" value={stage.dimensions.height} min={1} max={50} unit="m" onChange={height => updateStage({ dimensions: { ...stage.dimensions, height } })} />
        <NumberInputRow label="Depth" value={stage.dimensions.depth} min={1} max={100} unit="m" onChange={depth => updateStage({ dimensions: { ...stage.dimensions, depth }, floor: { ...stage.floor, depth } })} />
      </Collapsible>

      <Collapsible label="Camera / Guides" defaultOpen={false}>
        <SelectRow
          label="Saved View"
          value={stage.activeCameraViewId}
          onChange={viewId => setLaserDmxSettings({ productionStage: setActiveProductionCameraView(stage, viewId) })}
          options={stage.savedCameraViews.map(view => ({ value: view.id, label: view.name }))}
        />
        <SelectRow
          label="Render Quality"
          value={stage.editor.qualityTier}
          onChange={qualityTier => updateStage({ editor: { ...stage.editor, qualityTier: qualityTier as ProductionStageModel['editor']['qualityTier'] } })}
          options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]}
        />
        <ToggleRow label="Editor Guides" value={stage.editor.guidesVisible} onChange={guidesVisible => updateStage({ editor: { ...stage.editor, guidesVisible } })} />
        <ToggleRow label="Fixture Origins" value={laserDmxSettings.showFixtureOrigins ?? false} onChange={showFixtureOrigins => setLaserDmxSettings({ showFixtureOrigins })} />
        <ToggleRow label="Path Points" value={laserDmxSettings.showPathPoints ?? false} onChange={showPathPoints => setLaserDmxSettings({ showPathPoints })} />
      </Collapsible>

      <Collapsible label="Visual Comfort" defaultOpen={false}>
        <ToggleRow
          label="Disable Strobe Effects"
          value={visualComfort.disableStrobe}
          onChange={disableStrobe => setLaserDmxSettings({ visualComfort: { ...visualComfort, disableStrobe } })}
          description="Disables typed flash patterns in the virtual renderer. This is a comfort preference, not certified medical protection."
        />
        <NumberInputRow
          label="Maximum Flash Rate"
          value={visualComfort.maxFlashHz}
          min={1}
          max={30}
          step={0.5}
          unit="Hz"
          onChange={maxFlashHz => setLaserDmxSettings({ visualComfort: normalizeProductionVisualComfort({ ...visualComfort, maxFlashHz }) })}
        />
        <NumberInputRow
          label="Warning Threshold"
          value={visualComfort.warningThresholdHz}
          min={1}
          max={visualComfort.maxFlashHz}
          step={0.5}
          unit="Hz"
          onChange={warningThresholdHz => setLaserDmxSettings({ visualComfort: normalizeProductionVisualComfort({ ...visualComfort, warningThresholdHz }) })}
        />
        <NumberInputRow
          label="Continuous Flash Window"
          value={visualComfort.maxContinuousFlashSec}
          min={0.5}
          max={30}
          step={0.5}
          unit="sec"
          onChange={maxContinuousFlashSec => setLaserDmxSettings({ visualComfort: normalizeProductionVisualComfort({ ...visualComfort, maxContinuousFlashSec }) })}
        />
        <div className="rv-ctrl-info" role="status">
          High-frequency virtual flashes can be uncomfortable. DRMVYZ limits authored rates and inserts rest windows, but these safeguards are not a medical guarantee.
        </div>
      </Collapsible>

      <Collapsible label="Musical Choreography" defaultOpen={false}>
        <ToggleRow
          label="Automatic Choreography"
          value={choreography.enabled}
          onChange={enabled => setLaserDmxSettings({ choreography: { ...choreography, enabled } })}
          description="Uses the canonical Music Intelligence frame for sections, phrases, bars, beats, transients, and drop impacts. It never starts a separate BPM clock."
        />
        <SelectRow
          label="Genre Profile"
          value={choreography.profileId}
          onChange={profileId => setLaserDmxSettings({ choreography: { ...choreography, profileId: profileId as ProductionChoreographyProfileId } })}
          options={CHOREOGRAPHY_PROFILE_OPTIONS}
        />
        <SliderRow label="Choreography Intensity" value={choreography.intensity} onChange={intensity => setLaserDmxSettings({ choreography: { ...choreography, intensity } })} min={0} max={1} step={0.01} color="#61d6aa" />
        <ToggleRow label="Automatic Look Changes" value={choreography.automaticLookChanges} onChange={automaticLookChanges => setLaserDmxSettings({ choreography: { ...choreography, automaticLookChanges } })} />
        <ToggleRow label="Automatic Movement Changes" value={choreography.automaticMovementChanges} onChange={automaticMovementChanges => setLaserDmxSettings({ choreography: { ...choreography, automaticMovementChanges } })} />
        <SliderRow label="Impact Sensitivity" value={choreography.impactSensitivity} onChange={impactSensitivity => setLaserDmxSettings({ choreography: { ...choreography, impactSensitivity } })} min={0} max={1} step={0.01} color="#d8b95a" />
        <SliderRow label="Blackout Frequency" value={choreography.blackoutFrequency} onChange={blackoutFrequency => setLaserDmxSettings({ choreography: { ...choreography, blackoutFrequency } })} min={0} max={1} step={0.01} color="#7f8a91" />
        <SliderRow label="White Impact Intensity" value={choreography.whiteImpactIntensity} onChange={whiteImpactIntensity => setLaserDmxSettings({ choreography: { ...choreography, whiteImpactIntensity } })} min={0} max={1} step={0.01} color="#e8f4f8" />
        <ToggleRow label="Permit Automatic Strobes" value={choreography.allowStrobe} onChange={allowStrobe => setLaserDmxSettings({ choreography: { ...choreography, allowStrobe } })} description="Off by default. Visual Comfort limits still apply when enabled." />
        <ToggleRow label="Permit Automatic Fog / Cryo" value={choreography.allowAtmospherics} onChange={allowAtmospherics => setLaserDmxSettings({ choreography: { ...choreography, allowAtmospherics } })} description="Virtual effects only. Automatic atmosphere is off by default." />
        <SelectRow
          label="Manual Override Precedence"
          value={choreography.manualOverridePrecedence}
          onChange={manualOverridePrecedence => setLaserDmxSettings({ choreography: normalizeProductionChoreographySettings({ ...choreography, manualOverridePrecedence }) })}
          options={[
            { value: 'authoredFirst', label: 'Authored Cues Win' },
            { value: 'manualFirst', label: 'Manual Performance Wins' },
          ]}
        />
        <NumberInputRow label="Manual Hold" value={choreography.manualOverrideHoldMs} onChange={manualOverrideHoldMs => setLaserDmxSettings({ choreography: normalizeProductionChoreographySettings({ ...choreography, manualOverrideHoldMs }) })} min={0} max={30000} step={100} unit="ms" />
        <SelectRow
          label="Variation Mode"
          value={choreography.variationMode}
          onChange={variationMode => setLaserDmxSettings({ choreography: normalizeProductionChoreographySettings({ ...choreography, variationMode }) })}
          options={[
            { value: 'locked', label: 'Locked Seed · Repeatable' },
            { value: 'controlled', label: 'Controlled Per Playback' },
          ]}
        />
        <NumberInputRow label="Variation Seed" value={choreography.seed} onChange={seed => setLaserDmxSettings({ choreography: normalizeProductionChoreographySettings({ ...choreography, seed }) })} min={1} max={2147483647} step={1} />
        {choreography.variationMode === 'controlled' && (
          <SliderRow label="Variation Amount" value={choreography.variationAmount} onChange={variationAmount => setLaserDmxSettings({ choreography: { ...choreography, variationAmount } })} min={0} max={1} step={0.01} color="#b84fc9" />
        )}
        <CtrlSection label="Fixture-Family Participation" />
        {ALL_PRODUCTION_FIXTURE_KINDS.map(kind => (
          <ToggleRow
            key={kind}
            label={CHOREOGRAPHY_FAMILY_LABELS[kind]}
            value={choreography.fixtureFamilyParticipation[kind]}
            onChange={enabled => setLaserDmxSettings({
              choreography: {
                ...choreography,
                fixtureFamilyParticipation: { ...choreography.fixtureFamilyParticipation, [kind]: enabled },
              },
            })}
          />
        ))}
        <div className="rv-ctrl-info">
          Priority: automatic choreography is the underlay; authored Show Director cues override it. Manual performance actions follow the precedence choice above and temporarily suspend automatic reactions.
        </div>
      </Collapsible>

      <Collapsible label="Global Atmosphere" defaultOpen>
        <ToggleRow label="Persistent Haze" value={atmosphere.persistentHaze.enabled} onChange={enabled => setLaserDmxSettings({ atmosphere: { ...atmosphere, persistentHaze: { ...atmosphere.persistentHaze, enabled } } })} />
        <SliderRow label="Base Density" value={atmosphere.persistentHaze.baseDensity} onChange={baseDensity => setLaserDmxSettings({ atmosphere: { ...atmosphere, persistentHaze: { ...atmosphere.persistentHaze, baseDensity } } })} min={0} max={1} step={0.01} color="#9bb8c5" />
        <SliderRow label="Height Distribution" value={atmosphere.persistentHaze.heightDistribution} onChange={heightDistribution => setLaserDmxSettings({ atmosphere: { ...atmosphere, persistentHaze: { ...atmosphere.persistentHaze, heightDistribution } } })} min={0} max={1} step={0.01} color="#77a6b8" />
        <SliderRow label="Turbulence" value={atmosphere.persistentHaze.turbulence} onChange={turbulence => setLaserDmxSettings({ atmosphere: { ...atmosphere, persistentHaze: { ...atmosphere.persistentHaze, turbulence } } })} min={0} max={1} step={0.01} color="#b84fc9" />
        <SliderRow label="Diffusion" value={atmosphere.persistentHaze.diffusion} onChange={diffusion => setLaserDmxSettings({ atmosphere: { ...atmosphere, persistentHaze: { ...atmosphere.persistentHaze, diffusion } } })} min={0} max={1} step={0.01} color="#61d6aa" />
        <SliderRow label="Ventilation / Decay" value={atmosphere.persistentHaze.ventilation} onChange={ventilation => setLaserDmxSettings({ atmosphere: { ...atmosphere, persistentHaze: { ...atmosphere.persistentHaze, ventilation } } })} min={0} max={1} step={0.01} color="#d8b95a" />
        <SliderRow label="Beam Scatter" value={atmosphere.persistentHaze.beamScatter} onChange={beamScatter => setLaserDmxSettings({ atmosphere: { ...atmosphere, persistentHaze: { ...atmosphere.persistentHaze, beamScatter } } })} min={0} max={1} step={0.01} color="#4ac7db" />
        <NumberInputRow label="Drift Speed" value={atmosphere.persistentHaze.driftSpeed} onChange={driftSpeed => setLaserDmxSettings({ atmosphere: { ...atmosphere, persistentHaze: { ...atmosphere.persistentHaze, driftSpeed } } })} min={0} max={2} step={0.01} />
        <NumberInputRow label="Drift Direction" value={atmosphere.persistentHaze.driftDirectionDeg} onChange={driftDirectionDeg => setLaserDmxSettings({ atmosphere: { ...atmosphere, persistentHaze: { ...atmosphere.persistentHaze, driftDirectionDeg } } })} min={-360} max={360} step={1} unit="°" />
        <SelectRow label="Atmosphere Quality" value={atmosphere.qualityTier} onChange={qualityTier => setLaserDmxSettings({ atmosphere: normalizeProductionAtmosphereSettings({ ...atmosphere, qualityTier }) })} options={[{ value: 'low', label: 'Low · 80 particles' }, { value: 'medium', label: 'Medium · 180 particles' }, { value: 'high', label: 'High · 360 particles' }]} />
        <NumberInputRow label="Particle Budget" value={atmosphere.maxParticleBudget} onChange={maxParticleBudget => setLaserDmxSettings({ atmosphere: normalizeProductionAtmosphereSettings({ ...atmosphere, maxParticleBudget }) })} min={16} max={2000} step={1} />
        <ToggleRow label="Keep Base Haze on Clear" value={atmosphere.retainBaseHazeOnClear} onChange={retainBaseHazeOnClear => setLaserDmxSettings({ atmosphere: { ...atmosphere, retainBaseHazeOnClear } })} />
        <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" onClick={clearLaserAtmosphericBursts}>Clear Active Virtual Bursts</button>
        <div className="rv-ctrl-info">Virtual visualization only. This does not control or certify physical fog, cryogenic, pressurized, or pyrotechnic equipment.</div>
      </Collapsible>

      <CtrlSection label="Fixtures" />
      <div style={{ display: 'flex', gap: 4, alignItems: 'end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 150px' }}>
          <SelectRow label="Fixture Profile" value={newProfileId} onChange={value => setNewProfileId(value as LaserDmxProfileId)} options={PROFILE_OPTIONS} />
        </div>
        <button type="button" className="rv-glyph-upload-btn" onClick={() => addLaserFixture(newProfileId)}>+ Add Fixture</button>
      </div>

      {fixtures.length === 0 ? (
        <div className="rv-ctrl-info">No fixtures. Choose a profile and add one to begin.</div>
      ) : (
        <div className="rv-glyph-list">
          {fixtures.map(candidate => (
            <div
              key={candidate.id}
              className={`rv-glyph-item${candidate.id === selectedFixtureId ? ' rv-glyph-item--active' : ''}${!candidate.enabled ? ' rv-glyph-item--disabled' : ''}`}
              onClick={() => selectLaserFixture(candidate.id)}
              role="button"
              tabIndex={0}
              aria-label={`Select fixture ${candidate.name}`}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') selectLaserFixture(candidate.id) }}
            >
              <span className="rv-glyph-item-name" title={candidate.name}>{candidate.enabled ? '●' : '○'} {candidate.name}</span>
              <button type="button" className="rv-glyph-item-del" aria-label={`${candidate.enabled ? 'Disable' : 'Enable'} fixture ${candidate.name}`} onClick={event => { event.stopPropagation(); updateLaserFixture(candidate.id, { enabled: !candidate.enabled }) }}>{candidate.enabled ? '⏸' : '▶'}</button>
            </div>
          ))}
        </div>
      )}

      {fixture && (
        <>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button type="button" className="rv-glyph-upload-btn" onClick={() => duplicateLaserFixture(fixture.id)}>⧉ Duplicate</button>
            <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" onClick={() => removeLaserFixture(fixture.id)}>× Delete</button>
          </div>

          <CtrlSection label="Selected Fixture" />
          <TextInputRow label="Name" value={fixture.name} onChange={name => updateLaserFixture(fixture.id, { name })} maxLength={48} />
          <ToggleRow label="Enabled" value={fixture.enabled} onChange={enabled => updateLaserFixture(fixture.id, { enabled })} />

          <Collapsible label="Profile / DMX" defaultOpen={false}>
            <SelectRow
              label="Profile"
              value={fixture.dmx.profileId}
              onChange={value => {
                const profile = getLaserDmxFixtureProfile(value)
                if (!profile) return
                const nextIsMovingHead = isMovingHeadFixtureKind(profile.fixtureKind)
                const nextCapabilities = profile.capabilities
                updateLaserFixture(fixture.id, {
                  fixtureKind: profile.fixtureKind,
                  dmx: { ...fixture.dmx, profileId: value as LaserDmxProfileId },
                  movingHead: nextIsMovingHead
                    ? normalizeProductionMovingHeadSettings(fixture.movingHead)
                    : undefined,
                  colorPolicy: normalizeProductionFixtureColorPolicy(fixture.colorPolicy ?? DEFAULT_PRODUCTION_FIXTURE_COLOR_POLICY),
                  flashPattern: nextCapabilities.strobe
                    ? normalizeProductionFlashPattern(fixture.flashPattern ?? DEFAULT_PRODUCTION_FLASH_PATTERN)
                    : undefined,
                  wash: nextCapabilities.wash
                    ? normalizeProductionWashSettings(fixture.wash ?? DEFAULT_PRODUCTION_WASH_SETTINGS)
                    : undefined,
                  ledBar: nextCapabilities.pixels
                    ? normalizeProductionLedBarSettings(fixture.ledBar ?? DEFAULT_PRODUCTION_LED_BAR_SETTINGS, nextCapabilities.pixels.maxSegments)
                    : undefined,
                  atmospheric: nextCapabilities.atmosphericOutput
                    ? normalizeProductionAtmosphericFixtureSettings(fixture.atmospheric ?? DEFAULT_PRODUCTION_ATMOSPHERIC_FIXTURE_SETTINGS, nextCapabilities.atmosphericOutput.medium)
                    : undefined,
                  path: profile.fixtureKind === 'laserProjector'
                    ? fixture.path
                    : { ...fixture.path, kind: 'staticBeam', pointCount: 1, scanSpeed: 0 },
                })
              }}
              options={PROFILE_OPTIONS}
            />
            <NumberInputRow label="Universe" value={fixture.dmx.universe} min={1} max={16} step={1} onChange={universe => updateLaserFixture(fixture.id, { dmx: { ...fixture.dmx, universe: Math.round(universe) } })} />
            <NumberInputRow label="Start Address" value={fixture.dmx.startAddress} min={1} max={512} step={1} onChange={startAddress => updateLaserFixture(fixture.id, { dmx: { ...fixture.dmx, startAddress: Math.round(startAddress) } })} />
          </Collapsible>

          <Collapsible label="3D Position / Rotation" defaultOpen>
            {transform && (
              <>
                <NumberInputRow label="X" value={transform.position.x} min={-stage.dimensions.width} max={stage.dimensions.width} unit="m" onChange={value => updatePosition('x', value)} />
                <NumberInputRow label="Y" value={transform.position.y} min={-stage.dimensions.height} max={stage.dimensions.height * 2} unit="m" onChange={value => updatePosition('y', value)} />
                <NumberInputRow label="Z" value={transform.position.z} min={-stage.dimensions.depth} max={stage.dimensions.depth * 2} unit="m" onChange={value => updatePosition('z', value)} />
                <NumberInputRow label="Yaw" value={transform.orientation.yawDeg} min={-360} max={360} unit="°" onChange={value => updateOrientation('yawDeg', value)} />
                <NumberInputRow label="Pitch" value={transform.orientation.pitchDeg} min={-180} max={180} unit="°" onChange={value => updateOrientation('pitchDeg', value)} />
                <NumberInputRow label="Roll" value={transform.orientation.rollDeg} min={-180} max={180} unit="°" onChange={value => updateOrientation('rollDeg', value)} />
              </>
            )}
            <SelectRow
              label="Target Point / Zone"
              value={fixture.targetId ?? ''}
              onChange={targetId => updateLaserFixture(fixture.id, { targetId: targetId || null })}
              options={[{ value: '', label: 'Fixture manual aim' }, ...targets.map(target => ({ value: target.id, label: `${target.kind === 'zone' ? 'Zone' : 'Point'} · ${target.name}` }))]}
            />
          </Collapsible>

          <Collapsible label="Fixture Groups" defaultOpen={false}>
            {groups.length === 0 && <div className="rv-ctrl-info">No fixture groups yet.</div>}
            {groups.map(group => (
              <ToggleRow key={group.id} label={group.name} value={group.fixtureIds.includes(fixture.id)} onChange={() => toggleGroup(group.id)} />
            ))}
            <button type="button" className="rv-glyph-upload-btn" onClick={addGroup}>+ Create Group</button>
          </Collapsible>

          <Collapsible label="Group Chase" defaultOpen={false}>
            {groups.length === 0 || !movementGroup ? (
              <div className="rv-ctrl-info">Create a fixture group to author a shared fixture-order chase.</div>
            ) : (
              <>
                <SelectRow label="Chase Group" value={movementGroup.id} onChange={setMovementGroupId} options={groups.map(group => ({ value: group.id, label: group.name }))} />
                <ToggleRow label="Chase Enabled" value={groupChase.enabled} onChange={enabled => updateGroupChase({ enabled })} />
                <SelectRow label="Order" value={groupChase.order} onChange={order => updateGroupChase({ order: order as ProductionChaseOrder })} options={CHASE_ORDER_OPTIONS} />
                <NumberInputRow label="Step" value={groupChase.stepBeats} onChange={stepBeats => updateGroupChase({ stepBeats })} min={0.0625} max={64} step={0.0625} unit="beats" />
                <NumberInputRow label="Active Width" value={groupChase.width} onChange={width => updateGroupChase({ width: Math.round(width) })} min={1} max={Math.max(1, movementGroup.fixtureIds.length)} step={1} unit="fixtures" />
                <NumberInputRow label="Random Seed" value={groupChase.seed} onChange={seed => updateGroupChase({ seed: Math.round(seed) })} min={0} max={999999} step={1} />
              </>
            )}
          </Collapsible>

          {movingHead && capabilities?.panTilt && (
            <Collapsible label="Moving Head Motion" defaultOpen>
              <ToggleRow
                label="Track Target"
                value={movingHead.targetTracking}
                onChange={targetTracking => updateMovingHead({ targetTracking })}
                description="Tracks the selected stage point or zone. Manual pan and tilt are the fallback when a target is unavailable."
              />
              <NumberInputRow
                label="Manual Pan"
                value={movingHead.panDeg}
                min={-capabilities.panTilt.panRangeDeg / 2}
                max={capabilities.panTilt.panRangeDeg / 2}
                step={1}
                unit="°"
                onChange={panDeg => updateMovingHead({ panDeg })}
              />
              <NumberInputRow
                label="Manual Tilt"
                value={movingHead.tiltDeg}
                min={-capabilities.panTilt.tiltRangeDeg / 2}
                max={capabilities.panTilt.tiltRangeDeg / 2}
                step={1}
                unit="°"
                onChange={tiltDeg => updateMovingHead({ tiltDeg })}
              />
              <SliderRow label="Pan Speed" value={movingHead.panSpeedDegPerSec} onChange={panSpeedDegPerSec => updateMovingHead({ panSpeedDegPerSec })} min={1} max={720} step={1} color="#4ac7db" />
              <SliderRow label="Tilt Speed" value={movingHead.tiltSpeedDegPerSec} onChange={tiltSpeedDegPerSec => updateMovingHead({ tiltSpeedDegPerSec })} min={1} max={540} step={1} color="#61d6aa" />
              <SelectRow label="Motion Easing" value={movingHead.easing} onChange={easing => updateMovingHead({ easing: easing as ProductionMovingHeadEasing })} options={MOVEMENT_EASING_OPTIONS} />
              <ToggleRow label="Pre-position While Shuttered" value={movingHead.prePositionWhileShuttered} onChange={prePositionWhileShuttered => updateMovingHead({ prePositionWhileShuttered })} />
              <button type="button" className="rv-glyph-upload-btn" onClick={requestMovingHeadSnap} aria-label={`Snap ${fixture.name} to its requested position`}>Snap to Position</button>
            </Collapsible>
          )}

          {movingHead && (
            <Collapsible label="Group Movement" defaultOpen={false}>
              {groups.length === 0 || !movementGroup ? (
                <div className="rv-ctrl-info">Create a fixture group to apply reusable movement effects.</div>
              ) : (
                <>
                  <SelectRow label="Movement Group" value={movementGroup.id} onChange={setMovementGroupId} options={groups.map(group => ({ value: group.id, label: group.name }))} />
                  <ToggleRow label="Movement Enabled" value={movement.enabled} onChange={enabled => updateGroupMovement({ enabled })} />
                  <SelectRow label="Movement" value={movement.generator} onChange={generator => updateGroupMovement({ generator: generator as ProductionGroupMovementGenerator })} options={MOVEMENT_GENERATOR_OPTIONS} />
                  <SliderRow label="Speed" value={movement.speed} onChange={speed => updateGroupMovement({ speed })} min={0} max={8} step={0.05} color="#4ac7db" />
                  <SliderRow label="Amplitude" value={movement.amplitude} onChange={amplitude => updateGroupMovement({ amplitude })} min={0} max={2} step={0.01} color="#61d6aa" />
                  <SliderRow label="Spread" value={movement.spreadDeg} onChange={spreadDeg => updateGroupMovement({ spreadDeg })} min={0} max={270} step={1} color="#d8b95a" />
                  <SelectRow label="Direction" value={movement.direction} onChange={direction => updateGroupMovement({ direction: direction as ProductionMovementDirection })} options={MOVEMENT_DIRECTION_OPTIONS} />
                  <Collapsible label="Advanced Movement" defaultOpen={false}>
                    <SliderRow label="Pan Amplitude" value={movement.panAmplitudeDeg} onChange={panAmplitudeDeg => updateGroupMovement({ panAmplitudeDeg })} min={0} max={270} step={1} color="#4ac7db" />
                    <SliderRow label="Tilt Amplitude" value={movement.tiltAmplitudeDeg} onChange={tiltAmplitudeDeg => updateGroupMovement({ tiltAmplitudeDeg })} min={0} max={180} step={1} color="#61d6aa" />
                    <NumberInputRow label="Center X" value={movement.centerPoint.x} onChange={x => updateGroupMovement({ centerPoint: { ...movement.centerPoint, x } })} min={-stage.dimensions.width} max={stage.dimensions.width} unit="m" />
                    <NumberInputRow label="Center Y" value={movement.centerPoint.y} onChange={y => updateGroupMovement({ centerPoint: { ...movement.centerPoint, y } })} min={-stage.dimensions.height} max={stage.dimensions.height * 2} unit="m" />
                    <NumberInputRow label="Center Z" value={movement.centerPoint.z} onChange={z => updateGroupMovement({ centerPoint: { ...movement.centerPoint, z } })} min={-stage.dimensions.depth * 2} max={stage.dimensions.depth * 2} unit="m" />
                    <SliderRow label="Phase Offset" value={movement.phaseOffset} onChange={phaseOffset => updateGroupMovement({ phaseOffset })} min={-2} max={2} step={0.01} color="#b84fc9" />
                    <SliderRow label="Fixture Phase Spread" value={movement.phaseSpread} onChange={phaseSpread => updateGroupMovement({ phaseSpread })} min={-1} max={1} step={0.01} color="#b84fc9" />
                    <SelectRow label="Symmetry" value={movement.symmetry} onChange={symmetry => updateGroupMovement({ symmetry: symmetry as ProductionMovementSymmetry })} options={MOVEMENT_SYMMETRY_OPTIONS} />
                    <SelectRow label="Quantize" value={movement.quantize} onChange={quantize => updateGroupMovement({ quantize: quantize as ProductionMovementQuantize })} options={MOVEMENT_QUANTIZE_OPTIONS} />
                    <NumberInputRow label="Duration" value={movement.durationBeats} onChange={durationBeats => updateGroupMovement({ durationBeats })} min={0.25} max={128} step={0.25} unit="beats" />
                    <SelectRow label="Generator Easing" value={movement.easing} onChange={easing => updateGroupMovement({ easing: easing as ProductionMovingHeadEasing })} options={MOVEMENT_EASING_OPTIONS} />
                    <ToggleRow label="Snap Generator" value={movement.snap} onChange={snap => updateGroupMovement({ snap })} description="Use only for intentional hard cuts. Normal movement remains interpolated." />
                    <ToggleRow label="Pre-position Group" value={movement.prePositionWhileShuttered} onChange={prePositionWhileShuttered => updateGroupMovement({ prePositionWhileShuttered })} />
                  </Collapsible>
                </>
              )}
            </Collapsible>
          )}

          <Collapsible label="Fixture Color" defaultOpen={false}>
            {(capabilities?.color?.mode === 'rgb' || capabilities?.color?.mode === 'rgbw') && (
              <>
                <SelectRow label="Color Mode" value={fixture.color.mode} onChange={value => setColor('mode', value as LaserDmxFixture['color']['mode'])} options={COLOR_MODE_OPTIONS} />
                <SliderRow label="Red" value={fixture.color.red} onChange={value => setColor('red', Math.round(value))} min={0} max={255} step={1} color="#c0314a" />
                <SliderRow label="Green" value={fixture.color.green} onChange={value => setColor('green', Math.round(value))} min={0} max={255} step={1} color="#61d6aa" />
                <SliderRow label="Blue" value={fixture.color.blue} onChange={value => setColor('blue', Math.round(value))} min={0} max={255} step={1} color="#4ac7db" />
              </>
            )}
            {capabilities?.color?.mode === 'rgbw' && <SliderRow label="White" value={fixture.color.white} onChange={value => setColor('white', Math.round(value))} min={0} max={255} step={1} color="#e8f4f8" />}
            {capabilities?.color?.mode === 'colorWheel' && movingHead && (
              <SelectRow
                label="Color Wheel"
                value={String(movingHead.colorWheelSlot)}
                onChange={value => updateMovingHead({ colorWheelSlot: Number(value) })}
                options={capabilities.color.slots.map((slot, index) => ({ value: String(index), label: slot }))}
              />
            )}
            {capabilities?.color?.mode === 'fixedWhite' && (
              <div className="rv-ctrl-info">This fixture uses a profile-defined white emitter. Brand Kit colors do not replace its fixed white output.</div>
            )}
            {capabilities?.color?.mode === 'fixedColor' && (
              <div className="rv-ctrl-info">Fixed emitter: {capabilities.color.label ?? capabilities.color.color}. It remains profile-accurate unless Preserve Fixed Emitters is disabled.</div>
            )}
            <SliderRow label="Alpha" value={fixture.color.alpha} onChange={value => setColor('alpha', value)} min={0} max={1} step={0.01} color="#b84fc9" />
            <SelectRow
              label="White Accent Policy"
              value={colorPolicy.whiteAccentPolicy}
              onChange={whiteAccentPolicy => updateColorPolicy({ whiteAccentPolicy: whiteAccentPolicy as ProductionWhiteAccentPolicy })}
              options={[
                { value: 'off', label: 'Never Add White' },
                { value: 'impactOnly', label: 'Impact Patterns Only' },
                { value: 'continuous', label: 'Continuous White Channel' },
              ]}
              description="Reserves bright white as production punctuation instead of mixing it into every color cycle."
            />
            <SliderRow label="White Accent Intensity" value={colorPolicy.whiteAccentIntensity} onChange={whiteAccentIntensity => updateColorPolicy({ whiteAccentIntensity })} min={0} max={1} step={0.01} color="#e8f4f8" />
            <ToggleRow label="Preserve Fixed Emitters" value={colorPolicy.preserveFixedColor} onChange={preserveFixedColor => updateColorPolicy({ preserveFixedColor })} />
          </Collapsible>

          <Collapsible label="Beam Shape" defaultOpen={false}>
            {capabilities?.dimmer && <SliderRow label="Dimmer" value={fixture.beam.dimmer} onChange={value => setBeam('dimmer', value)} min={0} max={1} step={0.01} color="#4ac7db" />}
            {capabilities?.shutter && <ToggleRow label="Shutter" value={fixture.beam.shutterOpen} onChange={value => setBeam('shutterOpen', value)} />}
            {capabilities?.beamPattern && <SliderRow label="Beam Width" value={fixture.beam.width} onChange={value => setBeam('width', value)} min={0.2} max={6} step={0.05} color="#61d6aa" />}
            {capabilities?.zoom && <SliderRow label="Zoom" value={fixture.beam.zoom} onChange={value => setBeam('zoom', value)} min={capabilities.zoom.min} max={capabilities.zoom.max} step={0.01} color="#d8b95a" />}
            {capabilities?.focus && <SliderRow label="Focus" value={fixture.beam.focus} onChange={value => setBeam('focus', value)} min={capabilities.focus.min} max={capabilities.focus.max} step={0.01} color="#d8b95a" />}
            {capabilities?.iris && movingHead && <SliderRow label="Iris" value={movingHead.iris} onChange={iris => updateMovingHead({ iris })} min={capabilities.iris.min} max={capabilities.iris.max} step={0.01} color="#d8b95a" />}
            {capabilities?.frost && movingHead && <SliderRow label="Frost" value={movingHead.frost} onChange={frost => updateMovingHead({ frost })} min={capabilities.frost.min} max={capabilities.frost.max} step={0.01} color="#e8f4f8" />}
            {capabilities?.gobo && movingHead && (
              <SelectRow label="Gobo" value={String(movingHead.goboIndex)} onChange={value => updateMovingHead({ goboIndex: Number(value) })} options={capabilities.gobo.slots.map((slot, index) => ({ value: String(index), label: slot }))} />
            )}
            {capabilities?.gobo?.rotation && movingHead && <SliderRow label="Gobo Rotation" value={movingHead.goboRotation} onChange={goboRotation => updateMovingHead({ goboRotation })} min={-1} max={1} step={0.01} color="#b84fc9" />}
            {capabilities?.prism && movingHead && (
              <SelectRow label="Prism" value={String(movingHead.prismFacets)} onChange={value => updateMovingHead({ prismFacets: Number(value) })} options={[{ value: '0', label: 'Open' }, ...capabilities.prism.facets.map(facets => ({ value: String(facets), label: `${facets}-facet` }))]} />
            )}
            {capabilities?.prism?.rotation && movingHead && <SliderRow label="Prism Rotation" value={movingHead.prismRotation} onChange={prismRotation => updateMovingHead({ prismRotation })} min={-1} max={1} step={0.01} color="#b84fc9" />}
            {capabilities?.strobe && (fixture.fixtureKind === 'laserProjector' || isMovingHeadFixtureKind(fixture.fixtureKind)) && (
              <SliderRow
                label="Legacy Shutter Pulse"
                value={fixture.beam.strobeRate}
                onChange={value => setBeam('strobeRate', value)}
                min={capabilities.strobe.min}
                max={capabilities.strobe.max}
                step={0.01}
                color="#c0314a"
                description="Compatibility pulse for laser and moving-head shutters. Dedicated strobes use the typed flash-pattern engine below."
              />
            )}
          </Collapsible>

          {capabilities?.strobe && (
            <Collapsible label="Flash Pattern" defaultOpen={fixture.fixtureKind === 'strobe' || fixture.fixtureKind === 'blinder'}>
              <ToggleRow label="Pattern Enabled" value={flashPattern.enabled} onChange={enabled => updateFlashPattern({ enabled })} />
              <SelectRow label="Pattern" value={flashPattern.pattern} onChange={pattern => updateFlashPattern({ pattern: pattern as ProductionFlashPatternId })} options={FLASH_PATTERN_OPTIONS} />
              <NumberInputRow label="Trigger Time" value={flashPattern.triggerTimeSec} onChange={triggerTimeSec => updateFlashPattern({ triggerTimeSec })} min={0} max={86400} step={0.01} unit="sec" />
              <NumberInputRow label="Duration" value={flashPattern.durationBeats} onChange={durationBeats => updateFlashPattern({ durationBeats })} min={0.0625} max={128} step={0.0625} unit="beats" />
              <NumberInputRow label="Requested Rate" value={flashPattern.rateHz} onChange={rateHz => updateFlashPattern({ rateHz })} min={0.1} max={60} step={0.1} unit="Hz" />
              <SliderRow label="Duty Cycle" value={flashPattern.dutyCycle} onChange={dutyCycle => updateFlashPattern({ dutyCycle })} min={0.02} max={0.98} step={0.01} color="#c0314a" />
              <SliderRow label="Pattern Intensity" value={flashPattern.intensity} onChange={intensity => updateFlashPattern({ intensity })} min={0} max={1} step={0.01} color="#e8f4f8" />
              <ToggleRow label="Use White Accent" value={flashPattern.whiteAccent} onChange={whiteAccent => updateFlashPattern({ whiteAccent })} />
              <SelectRow label="Quantize" value={flashPattern.quantize} onChange={quantize => updateFlashPattern({ quantize: quantize as ProductionFlashQuantize })} options={FLASH_QUANTIZE_OPTIONS} />
              <SelectRow label="Retrigger" value={flashPattern.retriggerPolicy} onChange={retriggerPolicy => updateFlashPattern({ retriggerPolicy: retriggerPolicy as ProductionFlashRetriggerPolicy })} options={FLASH_RETRIGGER_OPTIONS} />
              <SelectRow label="Repeat" value={flashPattern.repeat.mode} onChange={mode => updateFlashPattern({ repeat: { ...flashPattern.repeat, mode: mode as ProductionFlashRepeatMode } })} options={FLASH_REPEAT_OPTIONS} />
              {flashPattern.repeat.mode === 'count' && <NumberInputRow label="Repeat Count" value={flashPattern.repeat.count} onChange={count => updateFlashPattern({ repeat: { ...flashPattern.repeat, count: Math.round(count) } })} min={1} max={256} step={1} />}
              {flashPattern.repeat.mode !== 'once' && <NumberInputRow label="Repeat Interval" value={flashPattern.repeat.intervalBeats} onChange={intervalBeats => updateFlashPattern({ repeat: { ...flashPattern.repeat, intervalBeats } })} min={0.0625} max={256} step={0.0625} unit="beats" />}
              <Collapsible label="Flash Envelope" defaultOpen={false}>
                <SliderRow label="Attack" value={flashPattern.envelope.attack} onChange={attack => updateFlashPattern({ envelope: { ...flashPattern.envelope, attack } })} min={0} max={1} step={0.01} color="#4ac7db" />
                <SliderRow label="Hold" value={flashPattern.envelope.hold} onChange={hold => updateFlashPattern({ envelope: { ...flashPattern.envelope, hold } })} min={0} max={1} step={0.01} color="#61d6aa" />
                <SliderRow label="Release" value={flashPattern.envelope.release} onChange={release => updateFlashPattern({ envelope: { ...flashPattern.envelope, release } })} min={0} max={1} step={0.01} color="#b84fc9" />
                <SelectRow label="Envelope Curve" value={flashPattern.envelope.curve} onChange={curve => updateFlashPattern({ envelope: { ...flashPattern.envelope, curve: curve as typeof flashPattern.envelope.curve } })} options={MOVEMENT_EASING_OPTIONS} />
              </Collapsible>
              {flashPattern.enabled && RATE_DRIVEN_FLASH_PATTERNS.has(flashPattern.pattern) && flashPattern.rateHz >= visualComfort.warningThresholdHz && (
                <div className="rv-ctrl-info" role="alert">
                  High-frequency effect requested at {flashPattern.rateHz.toFixed(1)} Hz. The virtual renderer clamps it to {visualComfort.maxFlashHz.toFixed(1)} Hz and applies continuous-use rest windows. This is not certified medical protection.
                </div>
              )}
            </Collapsible>
          )}

          {capabilities?.wash && (
            <Collapsible label="Wash Illumination" defaultOpen={fixture.fixtureKind === 'movingHeadWash' || fixture.fixtureKind === 'staticWash'}>
              <SliderRow label="Spread" value={wash.spread} onChange={spread => updateWash({ spread })} min={capabilities.wash.spread.min} max={capabilities.wash.spread.max} step={0.01} color="#4ac7db" />
              <SliderRow label="Softness" value={wash.softness} onChange={softness => updateWash({ softness })} min={capabilities.wash.softness.min} max={capabilities.wash.softness.max} step={0.01} color="#61d6aa" />
              {capabilities.wash.atmosphericVolume && <SliderRow label="Atmospheric Volume" value={wash.atmosphericIntensity} onChange={atmosphericIntensity => updateWash({ atmosphericIntensity })} min={0} max={1} step={0.01} color="#b84fc9" />}
            </Collapsible>
          )}

          {capabilities?.pixels && (
            <Collapsible label="LED Bar / Pixels" defaultOpen>
              <SelectRow label="Mode" value={ledBar.mode} onChange={mode => updateLedBar({ mode: mode as ProductionLedBarMode })} options={[{ value: 'wholeBar', label: 'Whole Bar' }, { value: 'segments', label: 'Segments / Pixels' }]} />
              <NumberInputRow label="Segments" value={ledBar.segmentCount} onChange={segmentCount => updateLedBar({ segmentCount: Math.round(segmentCount) })} min={1} max={capabilities.pixels.maxSegments} step={1} />
              <SelectRow label="Pattern" value={ledBar.pattern} onChange={pattern => updateLedBar({ pattern: pattern as ProductionLedBarPattern })} options={LED_PATTERN_OPTIONS} />
              {ledBar.mode === 'segments' && ledBar.pattern !== 'solid' && (
                <Collapsible label="Secondary Pixel Color" defaultOpen={false}>
                  <SliderRow label="Secondary Red" value={ledBar.secondaryColor.red} onChange={red => updateLedBar({ secondaryColor: { ...ledBar.secondaryColor, red: Math.round(red) } })} min={0} max={255} step={1} color="#c0314a" />
                  <SliderRow label="Secondary Green" value={ledBar.secondaryColor.green} onChange={green => updateLedBar({ secondaryColor: { ...ledBar.secondaryColor, green: Math.round(green) } })} min={0} max={255} step={1} color="#61d6aa" />
                  <SliderRow label="Secondary Blue" value={ledBar.secondaryColor.blue} onChange={blue => updateLedBar({ secondaryColor: { ...ledBar.secondaryColor, blue: Math.round(blue) } })} min={0} max={255} step={1} color="#4ac7db" />
                </Collapsible>
              )}
              <ToggleRow label="Segment Chase" value={ledBar.chase.enabled} onChange={enabled => updateLedBar({ chase: { ...ledBar.chase, enabled } })} />
              {ledBar.chase.enabled && (
                <>
                  <SelectRow label="Segment Order" value={ledBar.chase.order} onChange={order => updateLedBar({ chase: { ...ledBar.chase, order: order as ProductionChaseOrder } })} options={CHASE_ORDER_OPTIONS} />
                  <NumberInputRow label="Segment Step" value={ledBar.chase.stepBeats} onChange={stepBeats => updateLedBar({ chase: { ...ledBar.chase, stepBeats } })} min={0.0625} max={64} step={0.0625} unit="beats" />
                  <NumberInputRow label="Lit Segments" value={ledBar.chase.width} onChange={width => updateLedBar({ chase: { ...ledBar.chase, width: Math.round(width) } })} min={1} max={ledBar.segmentCount} step={1} />
                  <NumberInputRow label="Segment Seed" value={ledBar.chase.seed} onChange={seed => updateLedBar({ chase: { ...ledBar.chase, seed: Math.round(seed) } })} min={0} max={999999} step={1} />
                </>
              )}
            </Collapsible>
          )}

          {capabilities?.atmosphericOutput && (
            <Collapsible label={capabilities.atmosphericOutput.medium === 'haze' ? 'Hazer Output' : capabilities.atmosphericOutput.medium === 'cryo' ? 'Virtual CO₂-Style Jet' : 'Fog Emitter'} defaultOpen>
              <ToggleRow label="Armed" value={atmospheric.armed} onChange={armed => updateAtmospheric({ armed })} description="Looks may arm or disarm this virtual effect. Trigger buttons do nothing while disarmed." />
              <SliderRow label="Output Level" value={atmospheric.outputLevel} onChange={outputLevel => updateAtmospheric({ outputLevel })} min={0} max={1} step={0.01} color="#9bb8c5" />
              {capabilities.atmosphericOutput.medium !== 'haze' && <NumberInputRow label="Burst Duration" value={atmospheric.outputDurationSec} onChange={outputDurationSec => updateAtmospheric({ outputDurationSec })} min={0.05} max={60} step={0.05} unit="sec" />}
              <SelectRow label="Plume Orientation" value={atmospheric.orientationMode} onChange={orientationMode => updateAtmospheric({ orientationMode: orientationMode as typeof atmospheric.orientationMode })} options={[{ value: 'vertical', label: 'Vertical' }, { value: 'fixtureOrientation', label: 'Fixture Orientation' }]} />
              <NumberInputRow label="Plume Velocity" value={atmospheric.plumeVelocity} onChange={plumeVelocity => updateAtmospheric({ plumeVelocity })} min={0} max={30} step={0.1} unit="m/s" />
              <NumberInputRow label="Plume Height" value={atmospheric.height} onChange={height => updateAtmospheric({ height })} min={0.1} max={30} step={0.1} unit="m" />
              <SliderRow label="Spread" value={Math.min(1, atmospheric.spread)} onChange={spread => updateAtmospheric({ spread })} min={0.02} max={1} step={0.01} color="#77a6b8" />
              <SliderRow label="Density" value={atmospheric.density} onChange={density => updateAtmospheric({ density })} min={0} max={1} step={0.01} color="#d8f6ff" />
              <SliderRow label="Turbulence" value={atmospheric.turbulence} onChange={turbulence => updateAtmospheric({ turbulence })} min={0} max={1} step={0.01} color="#b84fc9" />
              <SliderRow label="Dissipation" value={atmospheric.dissipation} onChange={dissipation => updateAtmospheric({ dissipation })} min={0} max={1} step={0.01} color="#61d6aa" />
              <NumberInputRow label="Drift Speed" value={atmospheric.driftSpeed} onChange={driftSpeed => updateAtmospheric({ driftSpeed })} min={0} max={5} step={0.05} unit="m/s" />
              <NumberInputRow label="Drift Direction" value={atmospheric.driftDirectionDeg} onChange={driftDirectionDeg => updateAtmospheric({ driftDirectionDeg })} min={-360} max={360} step={1} unit="°" />
              {capabilities.atmosphericOutput.medium !== 'haze' && (<>
                <SelectRow label="Retrigger" value={atmospheric.retriggerPolicy} onChange={retriggerPolicy => updateAtmospheric({ retriggerPolicy: retriggerPolicy as typeof atmospheric.retriggerPolicy })} options={[{ value: 'restart', label: 'Restart' }, { value: 'ignoreWhileActive', label: 'Ignore While Active' }, { value: 'extend', label: 'Extend Active Burst' }]} />
                <NumberInputRow label="Warm-Up Metadata" value={atmospheric.warmupSec} onChange={warmupSec => updateAtmospheric({ warmupSec })} min={0} max={30} step={0.1} unit="sec" />
                <NumberInputRow label="Cooldown" value={atmospheric.cooldownSec} onChange={cooldownSec => updateAtmospheric({ cooldownSec })} min={0} max={120} step={0.1} unit="sec" />
                <NumberInputRow label="Deterministic Seed" value={atmospheric.seed} onChange={seed => updateAtmospheric({ seed: Math.round(seed) })} min={0} max={999999} step={1} />
                <button type="button" className="rv-glyph-upload-btn" onClick={() => triggerLaserAtmosphericFixture(fixture.id)} disabled={!atmospheric.armed}>Trigger Virtual Burst</button>
                {movementGroup && movementGroup.fixtureIds.some(id => {
                  const candidate = fixtures.find(item => item.id === id)
                  return candidate?.fixtureKind === 'fogger' || candidate?.fixtureKind === 'cryoJet'
                }) && <button type="button" className="rv-glyph-upload-btn" onClick={() => triggerLaserAtmosphericGroup(movementGroup.id)}>Trigger Group Bursts</button>}
              </>)}
            </Collapsible>
          )}

          {capabilities?.beamPattern && (
            <Collapsible label="Path / Program" defaultOpen={false}>
              <SelectRow label="Path Kind" value={fixture.path.kind} onChange={value => setPath('kind', value as LaserDmxFixture['path']['kind'])} options={PATH_KIND_OPTIONS} />
              <SliderRow label="Scale" value={fixture.path.scale} onChange={value => setPath('scale', value)} min={0} max={2} step={0.01} color="#61d6aa" />
              <SliderRow label="Path Rotation" value={fixture.path.rotation} onChange={value => setPath('rotation', value)} min={-180} max={180} step={1} color="#d8b95a" />
              <SliderRow label="Scan Speed" value={fixture.path.scanSpeed} onChange={value => setPath('scanSpeed', value)} min={0} max={2} step={0.01} color="#61d6aa" />
              <SliderRow label="Points" value={fixture.path.pointCount} onChange={value => setPath('pointCount', Math.round(value))} min={1} max={160} step={1} color="#4ac7db" />
              <SliderRow label="Spread" value={fixture.path.spread} onChange={value => setPath('spread', value)} min={0} max={1} step={0.01} color="#61d6aa" />
              <SliderRow label="Complexity" value={fixture.path.complexity} onChange={value => setPath('complexity', value)} min={0} max={1} step={0.01} color="#b84fc9" />
            </Collapsible>
          )}
        </>
      )}

      <Collapsible label={`Rig Diagnostics (${diagnostics.length})`} defaultOpen={diagnostics.some(item => item.severity === 'error')}>
        {diagnostics.length === 0 ? (
          <div className="rv-ctrl-info">Rig positions, profiles, IDs, and targets are valid.</div>
        ) : diagnostics.map((diagnostic, index) => (
          <div key={`${diagnostic.code}:${diagnostic.fixtureId ?? index}`} className="rv-ctrl-info" role={diagnostic.severity === 'error' ? 'alert' : 'status'}>
            {diagnostic.severity === 'error' ? 'Error' : 'Warning'} · {diagnostic.message}
          </div>
        ))}
      </Collapsible>
    </>
  )
}
