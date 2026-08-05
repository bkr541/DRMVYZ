import { SliderRow, SelectRow, ToggleRow, Collapsible } from '../ReactControlRows'
import { getUnifiedSvgPointCount, resolveSvgUiCapabilities } from '../svgSourceLifecycle'
import { getReactFxMasterControls } from '../reactFxMasterControls'
import { ReactResetActionsControls } from '../ReactResetActions'
import { resolveSoundDrawingOwnership, soundDrawingOwnershipTooltip } from '../soundDrawing/SoundDrawingOwnership'
import type { OscillatorRenderMode } from '../ReactTypes'
import type { SoundDrawingMockState } from './useSoundDrawingMockState'

// ── SoundDrawingFxMockup ───────────────────────────────────────────────────
//
// Disconnected copy of ReactFxPanel.tsx's Sound Drawing branch (right rail,
// DESIGN tab, ENGINE subtab in production). Same Master and appearance
// collapsibles, same reset-actions footer — driven by the shared mock state
// (see useSoundDrawingMockState) instead of useReactStore.

export function SoundDrawingFxMockup({ state }: { state: SoundDrawingMockState }) {
  const {
    osc, set,
    perf,
    reactIntensity, setReactIntensity,
    reactMotion, setReactMotion,
    reactGlow, setReactGlow,
    reactBassReactivity, setReactBassReactivity,
    reactTrailDecay, setReactTrailDecay,
    resetOscillatorSettings,
  } = state

  const soundDrawingOwnership = resolveSoundDrawingOwnership(perf)
  const masterControls = getReactFxMasterControls('oscilloscope')
  const showMasterIntensity = masterControls.includes('intensity')
  const showMasterMotion = masterControls.includes('motion')
  const showMasterGlow = masterControls.includes('glow')
  const showMasterBassReactivity = masterControls.includes('bassReactivity')

  const svgPointCount = getUnifiedSvgPointCount(osc, [], {})
  const svgCapabilities = resolveSvgUiCapabilities(osc, svgPointCount)
  const isSvgOriginalArtwork = svgCapabilities.isOriginalArtwork

  return (
    <>
      <div className="rv-ctrl-group">
        <Collapsible label="Master" defaultOpen>
          {showMasterIntensity && (
            <SliderRow
              label="Intensity"
              value={reactIntensity}
              onChange={setReactIntensity}
              color="#4ac7db"
              description={soundDrawingOwnershipTooltip(soundDrawingOwnership.domains.performanceIntensity)}
            />
          )}
          {showMasterMotion && (
            <SliderRow
              label="Motion"
              value={reactMotion}
              onChange={setReactMotion}
              color="#61d6aa"
              description={soundDrawingOwnershipTooltip(soundDrawingOwnership.domains.motion)}
            />
          )}
          {showMasterGlow && (
            <SliderRow
              label="Glow"
              value={reactGlow}
              onChange={setReactGlow}
              color="#b84fc9"
              description={soundDrawingOwnershipTooltip(soundDrawingOwnership.domains.glow)}
            />
          )}
          {showMasterBassReactivity && (
            <SliderRow
              label="Bass React"
              value={reactBassReactivity}
              onChange={setReactBassReactivity}
              color="#d8b95a"
              description={soundDrawingOwnershipTooltip(soundDrawingOwnership.domains.reaction)}
            />
          )}
        </Collapsible>

        {isSvgOriginalArtwork ? (
          <Collapsible label="SVG Original Artwork" defaultOpen>
            <Collapsible label="Transform" defaultOpen>
              <SliderRow
                label="Rotation Speed"
                value={osc.rotationSpeed}
                onChange={v => set({ rotationSpeed: v })}
                min={-1}
                max={1}
                step={0.01}
                color="#d8b95a"
                disabled={!soundDrawingOwnership.domains.presentation.editable}
                description={soundDrawingOwnershipTooltip(soundDrawingOwnership.domains.presentation)}
              />
            </Collapsible>
          </Collapsible>
        ) : (
          <Collapsible label="Sound Drawing" defaultOpen>
            <SliderRow
              label="Trail Decay"
              value={reactTrailDecay}
              onChange={setReactTrailDecay}
              color="#4ac7db"
              disabled={!soundDrawingOwnership.domains.trails.editable}
              description={`${soundDrawingOwnershipTooltip(soundDrawingOwnership.domains.trails)} Trail Decay sets fade speed; authored Trail Intensity sets performance persistence demand.`}
            />
            <SelectRow
              label="Render Mode"
              value={osc.renderMode}
              onChange={v => set({ renderMode: v as OscillatorRenderMode })}
              disabled={!soundDrawingOwnership.domains.topology.editable}
              description={soundDrawingOwnershipTooltip(soundDrawingOwnership.domains.topology)}
              options={[
                { value: 'outline', label: 'Outline' },
                { value: 'multiTrace', label: 'Multi Trace' },
                { value: 'dots', label: 'Dots' },
                { value: 'ribbon', label: 'Ribbon' },
              ]}
            />
            <SliderRow
              label="Duplicate Traces"
              value={osc.duplicateTraces}
              onChange={v => set({ duplicateTraces: Math.round(v) })}
              min={1}
              max={6}
              step={1}
              color="#61d6aa"
              disabled={!soundDrawingOwnership.domains.echo.editable}
              description={soundDrawingOwnershipTooltip(soundDrawingOwnership.domains.echo)}
            />
            <Collapsible label="Path">
              <SliderRow
                label="Rotation Speed"
                value={osc.rotationSpeed}
                onChange={v => set({ rotationSpeed: v })}
                min={-1}
                max={1}
                step={0.01}
                color="#d8b95a"
                disabled={!soundDrawingOwnership.domains.presentation.editable}
                description={soundDrawingOwnershipTooltip(soundDrawingOwnership.domains.presentation)}
              />
              <ToggleRow
                label="Mirror X"
                value={osc.mirrorX}
                onChange={v => set({ mirrorX: v })}
                disabled={!soundDrawingOwnership.domains.topology.editable}
                description={soundDrawingOwnershipTooltip(soundDrawingOwnership.domains.topology)}
              />
              <ToggleRow
                label="Mirror Y"
                value={osc.mirrorY}
                onChange={v => set({ mirrorY: v })}
                disabled={!soundDrawingOwnership.domains.topology.editable}
                description={soundDrawingOwnershipTooltip(soundDrawingOwnership.domains.topology)}
              />
            </Collapsible>
            <button
              type="button"
              className="rv-osc-reset-btn"
              onClick={resetOscillatorSettings}
              title="Reset all Sound Drawing source, rendering, modulation, text, and path settings"
            >
              Reset Sound Drawing Settings
            </button>
          </Collapsible>
        )}
      </div>

      <div className="rv-ctrl-footer">
        <ReactResetActionsControls
          onResetCurrentEngineSettings={resetOscillatorSettings}
          onResetReactViewPreferences={() => {}}
          onClearReactProjectContent={() => {}}
        />
      </div>
    </>
  )
}
