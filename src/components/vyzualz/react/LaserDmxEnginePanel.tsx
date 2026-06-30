import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { LaserDmxWorkspaceModeSelector } from './LaserDmxWorkspaceModeSelector'
import { LaserDmxSpatialFixturesPanel } from './LaserDmxSpatialFixturesPanel'
import { LaserDmxBeamMatrixPanel } from './LaserDmxBeamMatrixPanel'
import { CtrlSection } from './ReactControlRows'
import { LaserDmxCueListPanel } from './LaserDmxCueListPanel'
import { ProductionOutputPanel } from './output/ProductionOutputPanel'

export function LaserDmxEnginePanel() {
  const { laserDmxWorkspaceMode, blackout, matrixBlackout, setBlackout } = useReactStore(
    useShallow(s => ({
      laserDmxWorkspaceMode: s.laserDmxWorkspaceMode,
      blackout: s.laserDmxSettings.blackout,
      matrixBlackout: s.laserDmxBeamMatrix.output.blackout,
      setBlackout: s.setLaserDmxBlackout,
    }))
  )
  const anyBlackout = blackout || matrixBlackout
  const allBlackedOut = blackout && matrixBlackout

  return (
    <>
      <LaserDmxWorkspaceModeSelector />
      <CtrlSection label="Global Output" />
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" onClick={() => setBlackout(true)} disabled={allBlackedOut}>Blackout</button>
        <button type="button" className="rv-glyph-upload-btn" onClick={() => setBlackout(false)} disabled={!anyBlackout}>Reveal</button>
      </div>
      <div className="rv-ctrl-info">
        Global blackout masks Spatial Fixtures and Beam Matrix output without overwriting authored fixture, movement, cue, or atmosphere state.
      </div>
      <ProductionOutputPanel />
      {laserDmxWorkspaceMode === 'beamMatrix'
        ? <LaserDmxBeamMatrixPanel />
        : <LaserDmxSpatialFixturesPanel />
      }
      <CtrlSection label="Show Director" />
      <LaserDmxCueListPanel />
    </>
  )
}
