import { describe, expect, it } from 'vitest'
import {
  HELP_CENTER,
  HELP_COMPONENT_TYPES,
  HELP_PRIORITIES,
  PRIORITY_ONE_HELP_ENTRIES,
  getHelpEntriesByEngine,
  getHelpEntriesByPriority,
  getHelpEntriesByView,
  getHelpEntry,
  hasHelpEntry,
  validateHelpRegistry,
  type HelpComponentType,
  type HelpEntry,
  type HelpPriority,
} from './HelpCenter'

const entries: readonly HelpEntry[] = PRIORITY_ONE_HELP_ENTRIES

describe('Help Center registry', () => {
  it('contains unique IDs and matching registry keys', () => {
    const ids = entries.map((entry) => entry.id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(Object.keys(HELP_CENTER)).toHaveLength(entries.length)
    expect(Object.entries(HELP_CENTER).every(([key, entry]) => key === entry.id)).toBe(true)
  })

  it('uses valid priorities, component types, and nonempty required fields', () => {
    const priorities = new Set<number>(HELP_PRIORITIES)
    const componentTypes = new Set<string>(HELP_COMPONENT_TYPES)

    for (const entry of entries) {
      expect(priorities.has(entry.priority)).toBe(true)
      expect(componentTypes.has(entry.componentType)).toBe(true)
      expect(entry.id.trim()).not.toBe('')
      expect(entry.group.trim()).not.toBe('')
      expect(entry.title.trim()).not.toBe('')
      expect(entry.summary.trim()).not.toBe('')
    }
  })

  it('omits optional strings and arrays instead of storing empty values', () => {
    const optionalStringFields = [
      'whenToUse',
      'defaultValue',
      'range',
      'recommendedRange',
      'tip',
      'auditMismatch',
    ] as const
    const optionalArrayFields = [
      'whatItDoes',
      'affects',
      'doesNotAffect',
      'relatedHelpIds',
      'tags',
    ] as const

    for (const entry of entries) {
      for (const field of optionalStringFields) {
        const value = entry[field]
        expect(value === undefined || value.trim().length > 0).toBe(true)
      }

      for (const field of optionalArrayFields) {
        const values = entry[field]
        expect(values === undefined || values.length > 0).toBe(true)
        expect(values?.every((value) => value.trim().length > 0) ?? true).toBe(true)
      }
    }
  })

  it('resolves every related help ID without self or duplicate references', () => {
    const ids = new Set(entries.map((entry) => entry.id))

    for (const entry of entries) {
      const related = entry.relatedHelpIds ?? []
      expect(new Set(related).size).toBe(related.length)
      expect(related).not.toContain(entry.id)
      expect(related.every((helpId) => ids.has(helpId))).toBe(true)
    }
  })

  it('contains no unresolved audit mismatch markers', () => {
    for (const entry of entries) {
      expect(entry.auditMismatch).toBeUndefined()
      expect(
        entry.tags?.some(
          (tag) => tag === 'auditMismatch' || tag.startsWith('auditMismatch:'),
        ) ?? false,
      ).toBe(false)
    }
  })

  it('keeps lookup utilities aligned with the reconciled registry', () => {
    const first = entries[0]

    expect(first).toBeDefined()
    expect(hasHelpEntry(first.id)).toBe(true)
    expect(getHelpEntry(first.id)).toBe(first)
    expect(getHelpEntry('missing.help.id')).toBeUndefined()
    expect(getHelpEntriesByPriority(1)).toHaveLength(entries.length)
    expect(getHelpEntriesByPriority(2)).toHaveLength(0)
    expect(getHelpEntriesByView(first.view)).toContain(first)
    if (first.engine) expect(getHelpEntriesByEngine(first.engine)).toContain(first)
  })

  it('passes the production registry validator', () => {
    expect(validateHelpRegistry(entries, HELP_CENTER)).toEqual([])
  })

  it('documents both contextual-help regions in the React main header', () => {
    expect(getHelpEntry('react.shared.header.audioInput')).toMatchObject({
      title: 'Audio Input',
      componentType: 'select',
    })
    expect(getHelpEntry('react.shared.header.productionOutput')).toMatchObject({
      title: 'Production Output',
      componentType: 'group',
    })
  })

  it('documents the explicit Sound Drawing workspace and preset-library regions', () => {
    expect(getHelpEntry('react.soundDrawing.workspace.tabs')).toMatchObject({
      title: 'Source, Media, and Fonts',
      componentType: 'selection',
    })
    expect(getHelpEntry('react.soundDrawing.presetLibrary')).toMatchObject({
      title: 'Sound Drawing Presets',
      componentType: 'selection',
    })
    expect(getHelpEntry('react.soundDrawing.engineMode.visualSize')).toMatchObject({
      title: 'Visual Size',
      componentType: 'slider',
    })
  })

  it('documents the Sound Drawing React-tab audio controls', () => {
    expect(getHelpEntry('react.soundDrawing.audioReactivity.displaceMode')).toMatchObject({
      title: 'Displace Mode',
      componentType: 'select',
    })
    expect(getHelpEntry('react.soundDrawing.audioReactivity.displacement')).toMatchObject({
      title: 'Displacement',
      componentType: 'slider',
    })
    expect(getHelpEntry('react.soundDrawing.audioReactivity.bassScale')).toMatchObject({
      title: 'Bass → Scale',
      componentType: 'slider',
    })
    expect(getHelpEntry('react.soundDrawing.audioReactivity.midTwist')).toMatchObject({
      title: 'Mid → Twist',
      componentType: 'slider',
    })
    expect(getHelpEntry('react.soundDrawing.audioReactivity.alternate')).toMatchObject({
      title: 'Alternate',
      componentType: 'toggle',
    })
    expect(getHelpEntry('react.soundDrawing.audioReactivity.highJitter')).toMatchObject({
      title: 'High → Jitter',
      componentType: 'slider',
    })
    expect(getHelpEntry('react.soundDrawing.audioReactivity.beatBloom')).toMatchObject({
      title: 'Beat → Bloom',
      componentType: 'slider',
    })
  })

  it('documents the explicit CANVAS source, preset, display, performance, timing, and React controls', () => {
    expect(getHelpEntry('react.canvas.workspace.tabs')).toMatchObject({
      title: 'CANVAS Source',
      componentType: 'selection',
    })
    expect(getHelpEntry('react.canvas.source.mediaLibrary')).toMatchObject({
      title: 'CANVAS Media Library',
      componentType: 'selection',
    })
    expect(getHelpEntry('react.canvas.presetLibrary')).toMatchObject({
      title: 'CANVAS Presets',
      componentType: 'selection',
    })
    expect(getHelpEntry('react.canvas.sourceAndDisplay.display.fitMode')).toMatchObject({
      title: 'Fit Mode',
      componentType: 'select',
    })
    expect(getHelpEntry('react.canvas.performanceOrchestration.autoPerformance')).toMatchObject({
      title: 'Auto Performance',
      componentType: 'toggle',
    })
    expect(getHelpEntry('react.canvas.videoTiming.sectionTriggerMapping.overview')).toMatchObject({
      title: 'Section Trigger Mapping',
      componentType: 'group',
    })
    expect(getHelpEntry('react.canvas.reactControls.fx.glowAmount')).toMatchObject({
      title: 'Glow Amount',
      componentType: 'slider',
    })
    expect(getHelpEntry('react.canvas.reactControls.motionAndParticles.particleQuality')).toMatchObject({
      title: 'Particle Quality',
      componentType: 'select',
    })
  })

  it('documents every Fractures structure, motion, effects, and audio control', () => {
    const expectedIds = [
      'react.canvas.fractures.structure.intensity',
      'react.canvas.fractures.structure.mode',
      'react.canvas.fractures.structure.anchorMode',
      'react.canvas.fractures.structure.focusProtection',
      'react.canvas.fractures.structure.focusX',
      'react.canvas.fractures.structure.focusY',
      'react.canvas.fractures.structure.composition',
      'react.canvas.fractures.structure.placementMode',
      'react.canvas.fractures.structure.topologyInterval',
      'react.canvas.fractures.structure.layoutInterval',
      'react.canvas.fractures.structure.variationSeed',
      'react.canvas.fractures.structure.quality',
      'react.canvas.fractures.motion.amount',
      'react.canvas.fractures.motion.transition',
      'react.canvas.fractures.motion.transitionSpeed',
      'react.canvas.fractures.motion.stagger',
      'react.canvas.fractures.motion.zoom',
      'react.canvas.fractures.motion.refracture',
      'react.canvas.fractures.motion.shuffleLayout',
      'react.canvas.fractures.motion.freezeLayout',
      'react.canvas.fractures.motion.returnToAnchor',
      'react.canvas.fractures.effects.intensity',
      'react.canvas.fractures.effects.glow',
      'react.canvas.fractures.effects.glitch',
      'react.canvas.fractures.effects.texture',
      'react.canvas.fractures.effects.trails',
      'react.canvas.fractures.effects.depth',
      'react.canvas.fractures.effects.duplication',
      'react.canvas.fractures.effects.colorTreatment',
      'react.canvas.fractures.effects.colorSource',
      'react.canvas.fractures.effects.manualPrimaryColor',
      'react.canvas.fractures.effects.manualSupportingColor',
      'react.canvas.fractures.effects.roleWeight.clean',
      'react.canvas.fractures.effects.roleWeight.glow',
      'react.canvas.fractures.effects.roleWeight.outline',
      'react.canvas.fractures.effects.roleWeight.glitch',
      'react.canvas.fractures.effects.roleWeight.luma',
      'react.canvas.fractures.effects.roleWeight.displacement',
      'react.canvas.fractures.effects.roleWeight.texture',
      'react.canvas.fractures.audio.response',
      'react.canvas.fractures.audio.bassMotion',
      'react.canvas.fractures.audio.transientGlitch',
      'react.canvas.fractures.audio.structuralResponse',
    ] as const

    expect(expectedIds).toHaveLength(43)
    for (const helpId of expectedIds) {
      expect(getHelpEntry(helpId)).toMatchObject({ engine: 'canvas' })
    }
  })

  it('documents the explicit LaserDMX workspace, preset, design, and performance controls', () => {
    expect(getHelpEntry('react.laserDmx.workspace.overview')).toMatchObject({
      title: 'LaserDMX Workspace',
      componentType: 'group',
    })
    expect(getHelpEntry('react.laserDmx.presetLibrary')).toMatchObject({
      title: 'LaserDMX Presets',
      componentType: 'selection',
    })
    expect(getHelpEntry('react.laserDmx.design.previewOutputTrim')).toMatchObject({
      title: 'Preview Output Trim',
      componentType: 'slider',
    })
    expect(getHelpEntry('react.laserDmx.design.previewGlowTrim')).toMatchObject({
      title: 'Preview Glow Trim',
      componentType: 'slider',
    })
    expect(getHelpEntry('react.laserDmx.beamMatrix.programAndCanvas.canvas.overscan')).toMatchObject({
      title: 'Overscan',
      componentType: 'slider',
    })
    expect(getHelpEntry('react.laserDmx.showDirector.performanceProgram.audioIntelligenceResponse')).toMatchObject({
      title: 'Audio Intelligence Response',
      componentType: 'toggle',
    })
  })

  it('documents the explicit PixGrid authoring, design, preset, and reactivity controls', () => {
    expect(getHelpEntry('react.pixGrid.workspace.tabs')).toMatchObject({
      title: 'Setup and Media',
      componentType: 'selection',
    })
    expect(getHelpEntry('react.pixGrid.authoring.editOverlay')).toMatchObject({
      title: 'Edit PixGrid',
      componentType: 'toggle',
    })
    expect(getHelpEntry('react.pixGrid.presetLibrary')).toMatchObject({
      title: 'PixGrid Presets',
      componentType: 'selection',
    })
    expect(getHelpEntry('react.pixGrid.design.editingContext.editTarget')).toMatchObject({
      title: 'Edit Target',
      componentType: 'select',
    })
    expect(getHelpEntry('react.pixGrid.design.grid.cellGap')).toMatchObject({
      title: 'Cell Gap',
      componentType: 'slider',
    })
    expect(getHelpEntry('react.pixGrid.reactivity.workspace.tabs')).toMatchObject({
      title: 'Routing, Events, Choreography, and Analysis',
      componentType: 'selection',
    })
    expect(getHelpEntry('react.pixGrid.reactivity.continuousRoutes')).toMatchObject({
      title: 'Continuous Routes',
      componentType: 'group',
    })
    expect(getHelpEntry('react.pixGrid.reactivity.smartGroupIntegration')).toMatchObject({
      title: 'Smart Group Integration',
      componentType: 'group',
    })
    expect(getHelpEntry('react.pixGrid.performanceProgram.sectionPlan')).toMatchObject({
      title: 'Section Plan',
      componentType: 'select',
    })
  })

  it('reports malformed synthetic entries without a new validation dependency', () => {
    const base: HelpEntry = {
      id: 'test.entry',
      priority: 1,
      view: 'react',
      group: 'Test',
      title: 'Test entry',
      componentType: 'group',
      summary: 'Valid test summary.',
    }
    const malformed: HelpEntry = {
      ...base,
      priority: 9 as HelpPriority,
      componentType: 'invalid' as HelpComponentType,
      title: ' ',
      whenToUse: ' ',
      whatItDoes: [],
      relatedHelpIds: ['test.entry', 'missing.entry', 'missing.entry'],
      tags: ['auditMismatch'],
    }
    const registry = {
      'wrong.registry.key': malformed,
    }

    const codes = validateHelpRegistry([base, malformed], registry).map((issue) => issue.code)

    expect(codes).toEqual(expect.arrayContaining([
      'duplicate-id',
      'registry-key-mismatch',
      'registry-entry-missing',
      'invalid-priority',
      'invalid-component-type',
      'empty-required-string',
      'empty-optional-string',
      'empty-optional-array',
      'invalid-related-help-id',
      'self-related-help-id',
      'duplicate-related-help-id',
      'unresolved-audit-mismatch',
    ]))
  })
})
