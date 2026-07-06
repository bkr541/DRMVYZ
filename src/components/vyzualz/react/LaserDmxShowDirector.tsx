import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { LaserDmxShowDirectorInspector } from './LaserDmxShowDirectorInspector'
import { LaserDmxShowDirectorPalette } from './LaserDmxShowDirectorPalette'
import { LASER_DMX_SHOW_DIRECTOR_TEMPLATES } from './laserDmxShowDirectorTemplates'

export function LaserDmxShowDirector() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(LASER_DMX_SHOW_DIRECTOR_TEMPLATES[0]?.id ?? '')
  const {
    fixtures,
    selectedFixtureId,
    settings,
    clearFixtures,
    resetLayout,
    applyTemplate,
    duplicateLayout,
    mirrorLayout,
    authoringMode,
    setAuthoringMode,
  } = useReactStore(useShallow(s => ({
    fixtures:          s.laserDmxShowDirector.fixtures,
    selectedFixtureId: s.laserDmxShowDirector.selectedFixtureId,
    settings:          s.laserDmxShowDirector.settings,
    clearFixtures:     s.clearLaserDmxShowDirectorFixtures,
    resetLayout:       s.resetLaserDmxShowDirectorLayout,
    applyTemplate:     s.applyLaserDmxShowDirectorTemplate,
    duplicateLayout:   s.duplicateLaserDmxShowDirectorLayout,
    mirrorLayout:      s.mirrorLaserDmxShowDirectorLayout,
    authoringMode:     s.laserDmxBeamMatrixAuthoringMode,
    setAuthoringMode:  s.setLaserDmxBeamMatrixAuthoringMode,
  })))

  const selectedFixture = useMemo(
    () => fixtures.find(fixture => fixture.id === selectedFixtureId) ?? null,
    [fixtures, selectedFixtureId],
  )
  const selectedTemplate = useMemo(
    () => LASER_DMX_SHOW_DIRECTOR_TEMPLATES.find(template => template.id === selectedTemplateId) ?? LASER_DMX_SHOW_DIRECTOR_TEMPLATES[0] ?? null,
    [selectedTemplateId],
  )
  const hasFixtures = fixtures.length > 0
  const showDirectorPreviewActive = authoringMode === 'showDirector'

  useEffect(() => {
    setAuthoringMode('showDirector')
  }, [setAuthoringMode])

  const activateShowDirectorPreview = () => setAuthoringMode('showDirector')
  const activateManualMatrixPreview = () => setAuthoringMode('manual')

  const handleApplyTemplate = (templateId = selectedTemplate?.id) => {
    if (!templateId) return
    applyTemplate(templateId)
    setSelectedTemplateId(templateId)
    activateShowDirectorPreview()
  }

  return (
    <div className="rv-show-director-builder">
      <header className="rv-show-director-builder__header">
        <div>
          <span className="rv-show-director-kicker">LaserDMX</span>
          <h3>Show Director</h3>
          <p>Choose lighting components here, then drag them onto the center visualizer stage. Starter rigs and fixture controls stay in this panel so the live canvas has room to breathe.</p>
        </div>
        <div className="rv-show-director-builder__stats" aria-label="Show Director summary">
          <span><strong>{fixtures.length}</strong> fixtures</span>
          <span><strong>{settings.gridSize.columns}×{settings.gridSize.rows}</strong> grid</span>
          <span><strong>{selectedFixture ? '1' : '0'}</strong> selected</span>
          <span><strong>{showDirectorPreviewActive ? 'ON' : 'OFF'}</strong> preview</span>
        </div>
        <div className={`rv-show-director-preview-card${showDirectorPreviewActive ? ' rv-show-director-preview-card--active' : ''}`} aria-label="Show Director preview source status">
          <span className="rv-show-director-kicker">Preview Source</span>
          <strong>{showDirectorPreviewActive ? 'Show Director is live' : 'Manual Matrix is live'}</strong>
          <small>{showDirectorPreviewActive ? 'This layout is compiling into Beam Matrix preview output.' : 'Switch on Show Director preview to see this rig in the LaserDMX renderer.'}</small>
          <div>
            <button type="button" className="rv-glyph-upload-btn" onClick={activateShowDirectorPreview}>Use Show Director</button>
            <button type="button" className="rv-glyph-upload-btn" onClick={activateManualMatrixPreview}>Manual Matrix</button>
          </div>
        </div>
        <div className="rv-show-director-builder__actions" aria-label="Show Director layout actions">
          <button type="button" className="rv-glyph-upload-btn" onClick={duplicateLayout} disabled={!hasFixtures}>Duplicate Rig</button>
          <button type="button" className="rv-glyph-upload-btn" onClick={() => mirrorLayout('horizontal')} disabled={!hasFixtures}>Mirror H</button>
          <button type="button" className="rv-glyph-upload-btn" onClick={() => mirrorLayout('vertical')} disabled={!hasFixtures}>Mirror V</button>
          <button type="button" className="rv-glyph-upload-btn" onClick={resetLayout}>Reset Layout</button>
          <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger" onClick={clearFixtures} disabled={!hasFixtures}>Clear Rig</button>
        </div>
      </header>

      <section className="rv-show-director-templates" aria-label="Show Director starter templates">
        <div className="rv-show-director-templates__header">
          <div>
            <span className="rv-show-director-kicker">Starter Templates</span>
            <h4>Load a rig layout</h4>
          </div>
          <label className="rv-show-director-template-select">
            <span>Template</span>
            <select value={selectedTemplate?.id ?? ''} onChange={event => setSelectedTemplateId(event.target.value)}>
              {LASER_DMX_SHOW_DIRECTOR_TEMPLATES.map(template => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </label>
          <button type="button" className="rv-glyph-upload-btn" onClick={() => handleApplyTemplate()} disabled={!selectedTemplate}>Apply Template</button>
        </div>
        <div className="rv-show-director-template-strip" role="list">
          {LASER_DMX_SHOW_DIRECTOR_TEMPLATES.map(template => (
            <button
              key={template.id}
              type="button"
              role="listitem"
              className={`rv-show-director-template-card${selectedTemplate?.id === template.id ? ' rv-show-director-template-card--active' : ''}`}
              onClick={() => handleApplyTemplate(template.id)}
            >
              <span>{template.name}</span>
              <small>{template.fixtures.length} fixtures · {template.tags.slice(0, 2).join(' / ')}</small>
              <em>{template.description}</em>
            </button>
          ))}
        </div>
      </section>

      <div className="rv-show-director-workflow-hints" aria-label="Show Director workflow hints">
        <span>Drag from the palette into the center visualizer grid</span>
        <span>Select fixtures on the stage to edit beam, color, and timing</span>
        <span>Show Director preview compiles into Beam Matrix output</span>
      </div>

      <div className="rv-show-director-builder__layout">
        <LaserDmxShowDirectorPalette />
        <LaserDmxShowDirectorInspector fixture={selectedFixture} />
      </div>
    </div>
  )
}
