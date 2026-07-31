/**
 * Bundled contextual-help content for DRMVYZ.
 *
 * This registry intentionally documents controls and workflows, not the
 * descriptions owned by selectable presets, scenes, worlds, media, or shows.
 * It is UI-neutral so a later HelpTrigger can adapt entries to InfoPopover.
 */

export type HelpPriority = 1 | 2 | 3 | 4

export type HelpView = 'react' | 'visualizer' | 'lyricManager' | 'mediaManager'

export type HelpEngine =
  | 'shared'
  | 'soundDrawing'
  | 'cinematicWorlds'
  | 'shaderPads'
  | 'canvas'
  | 'laserDmx'
  | 'laserDmx.beamMatrix'
  | 'laserDmx.showDirector'
  | 'pixGrid'

export type HelpComponentType =
  | 'group'
  | 'select'
  | 'dropdown'
  | 'toggle'
  | 'slider'
  | 'field'
  | 'button'
  | 'timeline'
  | 'trackSection'
  | 'visualization'
  | 'inspector'
  | 'editor'
  | 'upload'
  | 'color'
  | 'numeric'
  | 'diagnostic'
  | 'selection'

export interface HelpEntry {
  id: string
  priority: HelpPriority
  view: HelpView
  engine?: HelpEngine
  group: string
  title: string
  componentType: HelpComponentType
  summary: string
  whatItDoes: readonly string[]
  whenToUse: string
  affects: readonly string[]
  doesNotAffect?: readonly string[]
  defaultValue?: string
  recommendedRange?: string
  tip?: string
  relatedHelpIds?: readonly string[]
  tags?: readonly string[]
}

export const PRIORITY_ONE_HELP_ENTRIES = [
  {
    "id": "react.shared.engine.engineSelection",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Engine and workspace selection",
    "title": "Engine",
    "componentType": "select",
    "summary": "Switches the React workspace to a different visual engine.",
    "whatItDoes": [
      "Updates the active React engine ID.",
      "The available source and control panels change with the selected engine."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Engine selection in the active React engine workspace"
    ],
    "relatedHelpIds": [
      "react.shared.engine.sourceSelection"
    ]
  },
  {
    "id": "react.shared.engine.sourceSelection",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Engine and workspace selection",
    "title": "Engine source / scene / world selection",
    "componentType": "selection",
    "summary": "Selects the active preset, world, shader scene, media source, or workspace item for the current engine.",
    "whatItDoes": [
      "Selects one domain object owned by the current engine.",
      "Descriptions remain in the preset, scene, world, or media definition rather than the help registry."
    ],
    "whenToUse": "Use it when choosing the active option for this part of the workflow.",
    "affects": [
      "Engine source / scene / world selection selection in the active React engine workspace"
    ],
    "relatedHelpIds": [
      "react.shared.engine.engineSelection"
    ]
  },
  {
    "id": "react.shared.trackMap.overview",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Track Map",
    "componentType": "group",
    "summary": "Shows the track-aligned map used by section-aware engines, cues, and authored performance.",
    "whatItDoes": [
      "Displays waveform, beat grid, sections, cues, and section preset assignments on one playhead.",
      "Manual edits feed the resolved section context used by compatible engines."
    ],
    "whenToUse": "Use this section when configuring the loaded track's authored section map.",
    "affects": [
      "manual track sections",
      "section-aware performance context",
      "track-linked preset assignments"
    ],
    "relatedHelpIds": [
      "react.shared.trackMap.sectionEditor.overview",
      "react.shared.trackMap.boundaryTools.overview",
      "react.shared.trackMap.visualAssignment.overview",
      "react.shared.trackMap.newSection.overview"
    ]
  },
  {
    "id": "react.shared.trackMap.beatGrid",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Beat Grid",
    "componentType": "toggle",
    "summary": "Shows or hides beat-grid lines on the Track Map.",
    "whatItDoes": [
      "Changes Track Map presentation only.",
      "Section timing and beat analysis are not modified."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Beat Grid state in the loaded track's authored section map"
    ],
    "doesNotAffect": [
      "section timing",
      "beat-grid analysis"
    ],
    "tip": "Use the beat grid while placing or reviewing boundaries, then hide it when the map becomes visually crowded."
  },
  {
    "id": "react.shared.trackMap.energyCurve",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Energy Curve",
    "componentType": "select",
    "summary": "Chooses which analyzed energy curve is displayed behind the Track Map.",
    "whatItDoes": [
      "Changes only the displayed energy visualization.",
      "The underlying analysis remains unchanged."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Energy Curve selection in the loaded track's authored section map"
    ],
    "doesNotAffect": [
      "audio analysis",
      "section data"
    ]
  },
  {
    "id": "react.shared.trackMap.sectionEditor.overview",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Section Editor",
    "componentType": "group",
    "summary": "Edits the selected section’s identity, timing, and intensity.",
    "whatItDoes": [
      "Groups the controls that configure the loaded track's authored section map.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the loaded track's authored section map.",
    "affects": [
      "manual track sections",
      "section-aware performance context",
      "track-linked preset assignments"
    ],
    "relatedHelpIds": [
      "react.shared.trackMap.overview",
      "react.shared.trackMap.boundaryTools.overview"
    ]
  },
  {
    "id": "react.shared.trackMap.sectionEditor.type",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Type",
    "componentType": "select",
    "summary": "Sets the musical section type used by section-aware behavior.",
    "whatItDoes": [
      "Stores the selected Type option in the loaded track's authored section map.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Type selection in the loaded track's authored section map"
    ]
  },
  {
    "id": "react.shared.trackMap.sectionEditor.label",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Label",
    "componentType": "field",
    "summary": "Sets the section’s user-facing name without changing its type.",
    "whatItDoes": [
      "Writes the edited Label data to the loaded track's authored section map.",
      "The value remains owned by the current item or document."
    ],
    "whenToUse": "Edit it when the current label, text, or metadata no longer describes the item accurately.",
    "affects": [
      "Label data in the loaded track's authored section map"
    ]
  },
  {
    "id": "react.shared.trackMap.sectionEditor.startSeconds",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Start (s)",
    "componentType": "numeric",
    "summary": "Sets where the selected section begins on the track.",
    "whatItDoes": [
      "Writes a precise Start (s) value to the loaded track's authored section map.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Start (s) value in the loaded track's authored section map"
    ],
    "recommendedRange": "0 seconds to track duration"
  },
  {
    "id": "react.shared.trackMap.sectionEditor.endSeconds",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "End (s)",
    "componentType": "numeric",
    "summary": "Sets where the selected section ends on the track.",
    "whatItDoes": [
      "Writes a precise End (s) value to the loaded track's authored section map.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "End (s) value in the loaded track's authored section map"
    ],
    "recommendedRange": "0 seconds to track duration"
  },
  {
    "id": "react.shared.trackMap.sectionEditor.intensity",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Intensity",
    "componentType": "slider",
    "summary": "Sets the selected section’s authored energy level.",
    "whatItDoes": [
      "Writes the Intensity value to the loaded track's authored section map as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Intensity value in the loaded track's authored section map"
    ],
    "defaultValue": "70%",
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.shared.trackMap.boundaryTools.overview",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Boundary Tools",
    "componentType": "group",
    "summary": "Moves section boundaries using the beat grid or analyzed boundary suggestions.",
    "whatItDoes": [
      "Groups the controls that configure the loaded track's authored section map.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the loaded track's authored section map.",
    "affects": [
      "manual track sections",
      "section-aware performance context",
      "track-linked preset assignments"
    ],
    "relatedHelpIds": [
      "react.shared.trackMap.sectionEditor.overview",
      "react.shared.trackMap.visualAssignment.overview"
    ]
  },
  {
    "id": "react.shared.trackMap.boundaryTools.snap",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Snap",
    "componentType": "select",
    "summary": "Chooses the timing grid used when moving section boundaries.",
    "whatItDoes": [
      "Stores the selected Snap option in the loaded track's authored section map.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Snap selection in the loaded track's authored section map"
    ],
    "tip": "Use Bar or Four Bar for phrase-aligned edits; use Free only when a deliberate off-grid boundary is required."
  },
  {
    "id": "react.shared.trackMap.boundaryTools.startAlternative",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Start Boundary Alternative",
    "componentType": "selection",
    "summary": "Moves the section start to another analyzed boundary candidate.",
    "whatItDoes": [
      "Chooses the active Start Boundary Alternative option for the loaded track's authored section map.",
      "The selected item becomes the current value for this context."
    ],
    "whenToUse": "Use it when choosing the active option for this part of the workflow.",
    "affects": [
      "Start Boundary Alternative selection in the loaded track's authored section map"
    ],
    "tip": "Cycle alternatives before manually typing a time when the analyzer found several plausible starts."
  },
  {
    "id": "react.shared.trackMap.boundaryTools.endAlternative",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "End Boundary Alternative",
    "componentType": "selection",
    "summary": "Moves the section end to another analyzed boundary candidate.",
    "whatItDoes": [
      "Chooses the active End Boundary Alternative option for the loaded track's authored section map.",
      "The selected item becomes the current value for this context."
    ],
    "whenToUse": "Use it when choosing the active option for this part of the workflow.",
    "affects": [
      "End Boundary Alternative selection in the loaded track's authored section map"
    ],
    "tip": "Keep End after Start and avoid collapsing the section below its minimum duration."
  },
  {
    "id": "react.shared.trackMap.visualAssignment.overview",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Visual Assignment",
    "componentType": "group",
    "summary": "Links the selected track section to a React preset and shows the preset’s owning engine.",
    "whatItDoes": [
      "Groups the controls that configure the loaded track's authored section map.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the loaded track's authored section map.",
    "affects": [
      "manual track sections",
      "section-aware performance context",
      "track-linked preset assignments"
    ],
    "relatedHelpIds": [
      "react.shared.trackMap.overview",
      "react.shared.engine.engineSelection"
    ]
  },
  {
    "id": "react.shared.trackMap.visualAssignment.preset",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Preset",
    "componentType": "select",
    "summary": "Assigns a React preset to the selected track section.",
    "whatItDoes": [
      "Stores the selected Preset option in the loaded track's authored section map.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Preset selection in the loaded track's authored section map"
    ],
    "tip": "Assign presets only where a deliberate section-specific visual override is needed."
  },
  {
    "id": "react.shared.trackMap.visualAssignment.assignedEngine",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Engine",
    "componentType": "diagnostic",
    "summary": "Shows which React engine owns the assigned preset.",
    "whatItDoes": [
      "Reports the current Engine state for the loaded track's authored section map.",
      "It is informational and is not itself a runtime parameter."
    ],
    "whenToUse": "Use it to understand the current state before changing related controls.",
    "affects": [
      "Engine status in the loaded track's authored section map"
    ],
    "doesNotAffect": [
      "the assigned preset"
    ]
  },
  {
    "id": "react.shared.trackMap.newSection.overview",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "New Section",
    "componentType": "group",
    "summary": "Creates a new manual section on the loaded track.",
    "whatItDoes": [
      "Groups the controls that configure the loaded track's authored section map.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the loaded track's authored section map.",
    "affects": [
      "manual track sections",
      "section-aware performance context",
      "track-linked preset assignments"
    ]
  },
  {
    "id": "react.shared.trackMap.newSection.type",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Type",
    "componentType": "select",
    "summary": "Sets the type of the new manual section.",
    "whatItDoes": [
      "Stores the selected Type option in the loaded track's authored section map.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Type selection in the loaded track's authored section map"
    ],
    "defaultValue": "Intro"
  },
  {
    "id": "react.shared.trackMap.newSection.label",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Label",
    "componentType": "field",
    "summary": "Sets the optional label of the new section.",
    "whatItDoes": [
      "Writes the edited Label data to the loaded track's authored section map.",
      "The value remains owned by the current item or document."
    ],
    "whenToUse": "Edit it when the current label, text, or metadata no longer describes the item accurately.",
    "affects": [
      "Label data in the loaded track's authored section map"
    ],
    "defaultValue": "Empty"
  },
  {
    "id": "react.shared.trackMap.newSection.startSeconds",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Start (s)",
    "componentType": "numeric",
    "summary": "Sets the new section’s start time.",
    "whatItDoes": [
      "Writes a precise Start (s) value to the loaded track's authored section map.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Start (s) value in the loaded track's authored section map"
    ],
    "defaultValue": "0 seconds",
    "recommendedRange": "0 seconds or later"
  },
  {
    "id": "react.shared.trackMap.newSection.endSeconds",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "End (s)",
    "componentType": "numeric",
    "summary": "Sets the new section’s end time.",
    "whatItDoes": [
      "Writes a precise End (s) value to the loaded track's authored section map.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "End (s) value in the loaded track's authored section map"
    ],
    "defaultValue": "30 seconds",
    "recommendedRange": "Greater than Start"
  },
  {
    "id": "react.shared.trackMap.newSection.intensity",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Intensity",
    "componentType": "slider",
    "summary": "Sets the new section’s authored intensity.",
    "whatItDoes": [
      "Writes the Intensity value to the loaded track's authored section map as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Intensity value in the loaded track's authored section map"
    ],
    "defaultValue": "70%",
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.soundDrawing.authoredPerformance.overview",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Authored Performance",
    "title": "Authored Performance",
    "componentType": "group",
    "summary": "Loads a Sound Drawing Performance Show and optionally runs its section-aware choreography.",
    "whatItDoes": [
      "Selecting a show loads its stable base design.",
      "Auto Performance separately enables section choreography."
    ],
    "whenToUse": "Use this section when configuring the selected Sound Drawing Performance Show.",
    "affects": [
      "Sound Drawing authored show state",
      "section-aware choreography"
    ]
  },
  {
    "id": "react.soundDrawing.authoredPerformance.autoPerformance",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Authored Performance",
    "title": "Auto Performance",
    "componentType": "toggle",
    "summary": "Runs section-aware choreography for the selected Sound Drawing Performance Show.",
    "whatItDoes": [
      "Requires a Performance Show to be selected.",
      "Turning it off keeps the show loaded in its stable base-design state."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Auto Performance state in the selected Sound Drawing Performance Show"
    ],
    "defaultValue": "Off",
    "tip": "Select a show first, then enable Auto Performance only when section choreography is desired.",
    "relatedHelpIds": [
      "react.soundDrawing.authoredPerformance.performanceShow",
      "react.soundDrawing.showChoreography.overview"
    ]
  },
  {
    "id": "react.soundDrawing.authoredPerformance.performanceShow",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Authored Performance",
    "title": "Performance Show",
    "componentType": "select",
    "summary": "Loads an authored Sound Drawing show’s stable base design.",
    "whatItDoes": [
      "Loads the show’s base design and authored program identity.",
      "Selection does not turn Auto Performance on."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Performance Show selection in the selected Sound Drawing Performance Show"
    ],
    "doesNotAffect": [
      "Auto Performance state"
    ],
    "defaultValue": "No show selected",
    "tip": "Audition the base design with Auto Performance off before evaluating choreography.",
    "relatedHelpIds": [
      "react.soundDrawing.authoredPerformance.autoPerformance",
      "react.soundDrawing.showChoreography.overview"
    ]
  },
  {
    "id": "react.soundDrawing.showChoreography.overview",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Show Choreography",
    "title": "Show Choreography",
    "componentType": "group",
    "summary": "Shapes the density, motion, response, trails, and scale of an active authored Sound Drawing show.",
    "whatItDoes": [
      "Groups the controls that configure the active Sound Drawing show choreography.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the active Sound Drawing show choreography.",
    "affects": [
      "authored show density",
      "motion",
      "audio response",
      "trails",
      "composition scale"
    ],
    "relatedHelpIds": [
      "react.soundDrawing.authoredPerformance.performanceShow",
      "react.soundDrawing.authoredPerformance.autoPerformance"
    ]
  },
  {
    "id": "react.soundDrawing.showChoreography.complexity",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Show Choreography",
    "title": "Complexity",
    "componentType": "slider",
    "summary": "Controls how much authored detail and variation the show may recruit.",
    "whatItDoes": [
      "Writes the Complexity value to the active Sound Drawing show choreography as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Complexity value in the active Sound Drawing show choreography"
    ],
    "defaultValue": "70%",
    "recommendedRange": "0–100%",
    "tip": "Raise Complexity after the base motion and reaction levels are already readable."
  },
  {
    "id": "react.soundDrawing.showChoreography.motionIntensity",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Show Choreography",
    "title": "Motion Intensity",
    "componentType": "slider",
    "summary": "Scales movement in the authored show.",
    "whatItDoes": [
      "Writes the Motion Intensity value to the active Sound Drawing show choreography as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Motion Intensity value in the active Sound Drawing show choreography"
    ],
    "defaultValue": "65%",
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.soundDrawing.showChoreography.reactionIntensity",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Show Choreography",
    "title": "Reaction Intensity",
    "componentType": "slider",
    "summary": "Scales the show’s response to audio analysis and musical events.",
    "whatItDoes": [
      "Writes the Reaction Intensity value to the active Sound Drawing show choreography as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Reaction Intensity value in the active Sound Drawing show choreography"
    ],
    "defaultValue": "80%",
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.soundDrawing.showChoreography.trailIntensity",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Show Choreography",
    "title": "Trail Intensity",
    "componentType": "slider",
    "summary": "Scales authored trail and persistence behavior.",
    "whatItDoes": [
      "Writes the Trail Intensity value to the active Sound Drawing show choreography as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Trail Intensity value in the active Sound Drawing show choreography"
    ],
    "defaultValue": "55%",
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.soundDrawing.showChoreography.showSize",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Show Choreography",
    "title": "Show Size",
    "componentType": "slider",
    "summary": "Scales the complete authored composition without changing its visual family.",
    "whatItDoes": [
      "Multiplies the composition scale.",
      "Generator, layers, and source identity stay unchanged."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Show Size value in the active Sound Drawing show choreography"
    ],
    "doesNotAffect": [
      "show generator or source identity"
    ],
    "defaultValue": "78%",
    "recommendedRange": "0.10–2.50×",
    "tip": "Use Show Size for framing; use choreography sliders for behavior."
  },
  {
    "id": "react.soundDrawing.livingRibbon.audioReactionDepth",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Living Ribbon Controls",
    "title": "Audio Reaction Depth",
    "componentType": "slider",
    "summary": "Scales how strongly audio deforms the Living Ribbon simulation.",
    "whatItDoes": [
      "Writes the Audio Reaction Depth value to the Living Ribbon simulation as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Audio Reaction Depth value in the Living Ribbon simulation"
    ],
    "defaultValue": "80%",
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.soundDrawing.engineMode.showSize",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Base Design and Engine Mode",
    "title": "Show Size",
    "componentType": "slider",
    "summary": "Scales the selected show’s stable base design while Auto Performance is off.",
    "whatItDoes": [
      "Writes the Show Size value to the manual or stable-base Sound Drawing design as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Show Size value in the manual or stable-base Sound Drawing design"
    ],
    "doesNotAffect": [
      "Auto Performance state"
    ],
    "defaultValue": "78%",
    "recommendedRange": "0.10–2.50×"
  },
  {
    "id": "react.soundDrawing.engineMode.overview",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Base Design and Engine Mode",
    "title": "Engine Mode",
    "componentType": "group",
    "summary": "Controls the manual Sound Drawing source when no Performance Show owns the output.",
    "whatItDoes": [
      "Groups the controls that configure the manual or stable-base Sound Drawing design.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the manual or stable-base Sound Drawing design.",
    "affects": [
      "Sound Drawing source topology",
      "manual visual scale",
      "section-following mode"
    ]
  },
  {
    "id": "react.soundDrawing.engineMode.visualSize",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Base Design and Engine Mode",
    "title": "Visual Size",
    "componentType": "slider",
    "summary": "Sets the base size of the selected manual Sound Drawing source.",
    "whatItDoes": [
      "Writes the Visual Size value to the manual or stable-base Sound Drawing design as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Visual Size value in the manual or stable-base Sound Drawing design"
    ],
    "doesNotAffect": [
      "signal calibration"
    ],
    "defaultValue": "78%",
    "recommendedRange": "0.10–2.50×"
  },
  {
    "id": "react.soundDrawing.engineMode.followTrackSections",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Base Design and Engine Mode",
    "title": "Follow Track Sections",
    "componentType": "toggle",
    "summary": "Lets manual Classic Scope topology follow the analyzed section at the playhead.",
    "whatItDoes": [
      "Resolves manual Classic Scope topology from the analyzed section under the playhead.",
      "The control is available only while manual Sound Drawing owns the output."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Follow Track Sections state in the manual or stable-base Sound Drawing design"
    ],
    "defaultValue": "Off"
  },
  {
    "id": "react.soundDrawing.engineMode.classicMode",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Base Design and Engine Mode",
    "title": "Classic Mode",
    "componentType": "select",
    "summary": "Chooses the manual Classic Scope topology.",
    "whatItDoes": [
      "Stores the selected Classic Mode option in the manual or stable-base Sound Drawing design.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Classic Mode selection in the manual or stable-base Sound Drawing design"
    ],
    "defaultValue": "Waveform"
  },
  {
    "id": "react.soundDrawing.proScope.preset",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Pro Scope",
    "title": "Preset",
    "componentType": "select",
    "summary": "Applies a complete Pro Scope recipe covering signal, trigger, beam, phosphor, and tube settings.",
    "whatItDoes": [
      "Copies preset values into the editable Pro Scope state.",
      "All child controls remain adjustable afterward."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Preset selection in the Sound Drawing professional oscilloscope"
    ],
    "doesNotAffect": [
      "preset or show descriptions"
    ],
    "tip": "Treat presets as starting points, then refine only the controls needed for the track.",
    "relatedHelpIds": [
      "react.soundDrawing.proScope.visualSize"
    ]
  },
  {
    "id": "react.soundDrawing.proScope.visualSize",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Pro Scope",
    "title": "Visual Size",
    "componentType": "slider",
    "summary": "Scales the Pro Scope presentation without recalibrating its signal path.",
    "whatItDoes": [
      "Changes presentation scale immediately.",
      "Advanced signal conditioning keeps its calibration."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Visual Size value in the Sound Drawing professional oscilloscope"
    ],
    "doesNotAffect": [
      "Pro Scope signal calibration"
    ],
    "recommendedRange": "0.10–2.50×",
    "relatedHelpIds": [
      "react.soundDrawing.proScope.preset"
    ]
  },
  {
    "id": "react.soundDrawing.proScope.musicReactivity.beatBloom",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Pro Scope — Music Reactivity",
    "title": "Beat Bloom",
    "componentType": "slider",
    "summary": "Adds beat-driven bloom to the Pro Scope presentation.",
    "whatItDoes": [
      "Uses detected beats to modulate presentation bloom.",
      "It does not change the ordered X/Y trace geometry."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Beat Bloom value in the Pro Scope presentation response"
    ],
    "doesNotAffect": [
      "trace geometry"
    ],
    "recommendedRange": "0–100%",
    "tip": "Keep Beat Bloom moderate when phosphor persistence is already high."
  },
  {
    "id": "react.soundDrawing.fx.bassReact",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "FX",
    "title": "Bass React",
    "componentType": "slider",
    "summary": "Sets the engine-level bass-response trim for Sound Drawing.",
    "whatItDoes": [
      "Scales bass-driven response within the active Sound Drawing ownership rules."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Bass React value in the active engine output"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.soundDrawing.audioReactivity.overview",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Audio routing and reactivity",
    "title": "Audio Reactivity",
    "componentType": "group",
    "summary": "Groups the Sound Drawing controls that translate audio analysis into visual deformation.",
    "whatItDoes": [
      "Collects displacement and frequency-response controls.",
      "The group does not itself change a parameter until a child control is edited."
    ],
    "whenToUse": "Use this section when configuring Sound Drawing audio routing.",
    "affects": [
      "audio-driven displacement and frequency response"
    ]
  },
  {
    "id": "react.soundDrawing.timeline.clip.overview",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Clip",
    "title": "Clip",
    "componentType": "group",
    "summary": "Controls how the selected Sound Drawing clip is stacked and faded on the timeline.",
    "whatItDoes": [
      "Groups the controls that configure the selected Sound Drawing timeline clip.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the selected Sound Drawing timeline clip.",
    "affects": [
      "clip stacking order",
      "clip fades"
    ]
  },
  {
    "id": "react.soundDrawing.timeline.clip.zIndex",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Clip",
    "title": "Z-Index",
    "componentType": "slider",
    "summary": "Sets the selected clip’s stacking order inside Sound Drawing.",
    "whatItDoes": [
      "Writes the Z-Index value to the selected Sound Drawing timeline clip as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Z-Index value in the selected Sound Drawing timeline clip"
    ],
    "defaultValue": "0",
    "recommendedRange": "0–10",
    "tip": "Use higher Z-Index values only for clips that must render above others."
  },
  {
    "id": "react.soundDrawing.timeline.clip.fadeInMs",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Clip",
    "title": "Fade In (ms)",
    "componentType": "slider",
    "summary": "Sets how long the selected clip takes to appear.",
    "whatItDoes": [
      "Writes the Fade In (ms) value to the selected Sound Drawing timeline clip as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Fade In (ms) value in the selected Sound Drawing timeline clip"
    ],
    "defaultValue": "0 ms",
    "recommendedRange": "0–2000 ms",
    "tip": "Keep the fade shorter than the clip duration."
  },
  {
    "id": "react.soundDrawing.timeline.clip.fadeOutMs",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Clip",
    "title": "Fade Out (ms)",
    "componentType": "slider",
    "summary": "Sets how long the selected clip takes to disappear.",
    "whatItDoes": [
      "Writes the Fade Out (ms) value to the selected Sound Drawing timeline clip as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Fade Out (ms) value in the selected Sound Drawing timeline clip"
    ],
    "defaultValue": "0 ms",
    "recommendedRange": "0–2000 ms",
    "tip": "Keep the fade shorter than the clip duration."
  },
  {
    "id": "react.soundDrawing.timeline.layer.overview",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Layer",
    "title": "Layer",
    "componentType": "group",
    "summary": "Defines the selected Sound Drawing layer’s content source and typography.",
    "whatItDoes": [
      "Groups the controls that configure the selected Sound Drawing timeline layer.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the selected Sound Drawing timeline layer.",
    "affects": [
      "layer source",
      "text or shape content",
      "typography"
    ]
  },
  {
    "id": "react.soundDrawing.timeline.layer.enabled",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Layer",
    "title": "Layer Enabled",
    "componentType": "toggle",
    "summary": "Includes or excludes the selected layer from rendering.",
    "whatItDoes": [
      "Sets whether Layer Enabled participates in the selected Sound Drawing timeline layer.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Layer Enabled state in the selected Sound Drawing timeline layer"
    ],
    "defaultValue": "On"
  },
  {
    "id": "react.soundDrawing.timeline.layer.name",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Layer",
    "title": "Name",
    "componentType": "field",
    "summary": "Sets the editable name of the selected timeline layer.",
    "whatItDoes": [
      "Writes the edited Name data to the selected Sound Drawing timeline layer.",
      "The value remains owned by the current item or document."
    ],
    "whenToUse": "Edit it when the current label, text, or metadata no longer describes the item accurately.",
    "affects": [
      "Name data in the selected Sound Drawing timeline layer"
    ]
  },
  {
    "id": "react.soundDrawing.timeline.layer.source",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Layer",
    "title": "Source",
    "componentType": "select",
    "summary": "Chooses whether the layer renders text, a built-in shape, or imported SVG content.",
    "whatItDoes": [
      "Stores the selected Source option in the selected Sound Drawing timeline layer.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Source selection in the selected Sound Drawing timeline layer"
    ],
    "defaultValue": "Text"
  },
  {
    "id": "react.soundDrawing.timeline.layer.textSource",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Layer",
    "title": "Text Source",
    "componentType": "select",
    "summary": "Chooses static text, the active lyric line, or the active timed lyric word.",
    "whatItDoes": [
      "Stores the selected Text Source option in the selected Sound Drawing timeline layer.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Text Source selection in the selected Sound Drawing timeline layer"
    ],
    "defaultValue": "Static Text"
  },
  {
    "id": "react.soundDrawing.timeline.layer.lyricGapBehavior",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Layer",
    "title": "When No Lyric Is Active",
    "componentType": "select",
    "summary": "Chooses what a lyric-driven text layer displays during lyric gaps.",
    "whatItDoes": [
      "Stores the selected When No Lyric Is Active option in the selected Sound Drawing timeline layer.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "When No Lyric Is Active selection in the selected Sound Drawing timeline layer"
    ],
    "defaultValue": "Hide Text",
    "tip": "Use Hide Text for instrumental gaps; use Keep Previous only when holding a lyric is intentional."
  },
  {
    "id": "react.soundDrawing.timeline.layer.fallbackText",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Layer",
    "title": "Fallback Text",
    "componentType": "field",
    "summary": "Sets the text shown when lyric-gap behavior is set to fallback.",
    "whatItDoes": [
      "Writes the edited Fallback Text data to the selected Sound Drawing timeline layer.",
      "The value remains owned by the current item or document."
    ],
    "whenToUse": "Edit it when the current label, text, or metadata no longer describes the item accurately.",
    "affects": [
      "Fallback Text data in the selected Sound Drawing timeline layer"
    ],
    "defaultValue": "Empty"
  },
  {
    "id": "react.soundDrawing.timeline.layer.font",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Layer",
    "title": "Font",
    "componentType": "select",
    "summary": "Chooses an imported font for the text layer.",
    "whatItDoes": [
      "Stores the selected Font option in the selected Sound Drawing timeline layer.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Font selection in the selected Sound Drawing timeline layer"
    ],
    "doesNotAffect": [
      "the source font file"
    ]
  },
  {
    "id": "react.soundDrawing.timeline.layer.alignment",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Layer",
    "title": "Alignment",
    "componentType": "select",
    "summary": "Aligns multi-line text inside the layer.",
    "whatItDoes": [
      "Stores the selected Alignment option in the selected Sound Drawing timeline layer.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Alignment selection in the selected Sound Drawing timeline layer"
    ],
    "defaultValue": "Center"
  },
  {
    "id": "react.soundDrawing.timeline.layer.lineHeight",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Layer",
    "title": "Line Height",
    "componentType": "slider",
    "summary": "Sets vertical spacing between text lines.",
    "whatItDoes": [
      "Writes the Line Height value to the selected Sound Drawing timeline layer as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Line Height value in the selected Sound Drawing timeline layer"
    ],
    "defaultValue": "1.2",
    "recommendedRange": "0.80–3.00",
    "tip": "Adjust Line Height after selecting the final font."
  },
  {
    "id": "react.soundDrawing.timeline.layer.letterSpacing",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Layer",
    "title": "Letter Spacing",
    "componentType": "slider",
    "summary": "Sets horizontal spacing between characters.",
    "whatItDoes": [
      "Writes the Letter Spacing value to the selected Sound Drawing timeline layer as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Letter Spacing value in the selected Sound Drawing timeline layer"
    ],
    "defaultValue": "0",
    "recommendedRange": "−20 to 80",
    "tip": "Large positive spacing can break long lyric lines; check the widest expected text."
  },
  {
    "id": "react.soundDrawing.timeline.layer.shape",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Layer",
    "title": "Shape",
    "componentType": "select",
    "summary": "Chooses the built-in geometry rendered by a shape layer.",
    "whatItDoes": [
      "Stores the selected Shape option in the selected Sound Drawing timeline layer.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Shape selection in the selected Sound Drawing timeline layer"
    ],
    "defaultValue": "Circle"
  },
  {
    "id": "react.soundDrawing.timeline.layer.svgFile",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Layer",
    "title": "SVG File",
    "componentType": "select",
    "summary": "Chooses the imported SVG used by an SVG layer.",
    "whatItDoes": [
      "Stores the selected SVG File option in the selected Sound Drawing timeline layer.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "SVG File selection in the selected Sound Drawing timeline layer"
    ]
  },
  {
    "id": "react.soundDrawing.timeline.transform.overview",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Transform",
    "title": "Transform",
    "componentType": "group",
    "summary": "Positions, scales, and rotates the selected Sound Drawing timeline layer.",
    "whatItDoes": [
      "Groups the controls that configure the selected Sound Drawing timeline layer transform.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the selected Sound Drawing timeline layer transform.",
    "affects": [
      "layer position",
      "scale",
      "rotation"
    ]
  },
  {
    "id": "react.soundDrawing.timeline.transform.positionX",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Transform",
    "title": "X",
    "componentType": "slider",
    "summary": "Moves the layer horizontally in normalized output space.",
    "whatItDoes": [
      "Writes the X value to the selected Sound Drawing timeline layer transform as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "X value in the selected Sound Drawing timeline layer transform"
    ],
    "defaultValue": "0",
    "recommendedRange": "−1.00 to 1.00"
  },
  {
    "id": "react.soundDrawing.timeline.transform.positionY",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Transform",
    "title": "Y",
    "componentType": "slider",
    "summary": "Moves the layer vertically in normalized output space.",
    "whatItDoes": [
      "Writes the Y value to the selected Sound Drawing timeline layer transform as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Y value in the selected Sound Drawing timeline layer transform"
    ],
    "defaultValue": "0",
    "recommendedRange": "−1.00 to 1.00"
  },
  {
    "id": "react.soundDrawing.timeline.transform.scale",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Transform",
    "title": "Scale",
    "componentType": "slider",
    "summary": "Scales the layer around its anchor.",
    "whatItDoes": [
      "Writes the Scale value to the selected Sound Drawing timeline layer transform as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Scale value in the selected Sound Drawing timeline layer transform"
    ],
    "defaultValue": "1",
    "recommendedRange": "0.10–5.00×"
  },
  {
    "id": "react.soundDrawing.timeline.transform.rotation",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Timeline — Transform",
    "title": "Rotation",
    "componentType": "slider",
    "summary": "Rotates the layer in degrees.",
    "whatItDoes": [
      "Writes the Rotation value to the selected Sound Drawing timeline layer transform as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Rotation value in the selected Sound Drawing timeline layer transform"
    ],
    "defaultValue": "0°",
    "recommendedRange": "−180° to 180°"
  },
  {
    "id": "react.cinematicWorlds.worlds.overview",
    "priority": 1,
    "view": "react",
    "engine": "cinematicWorlds",
    "group": "World selection and Visual DNA",
    "title": "Worlds",
    "componentType": "group",
    "summary": "Selects which Cinematic World definition is active.",
    "whatItDoes": [
      "Groups the controls that configure the active Cinematic World.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the active Cinematic World.",
    "affects": [
      "world selection",
      "Reactive Constellation starting character"
    ]
  },
  {
    "id": "react.cinematicWorlds.worlds.worldSelection",
    "priority": 1,
    "view": "react",
    "engine": "cinematicWorlds",
    "group": "World selection and Visual DNA",
    "title": "World",
    "componentType": "selection",
    "summary": "Selects the active Cinematic World definition.",
    "whatItDoes": [
      "Chooses the active World option for the active Cinematic World.",
      "The selected item becomes the current value for this context."
    ],
    "whenToUse": "Use it when choosing the active option for this part of the workflow.",
    "affects": [
      "World selection in the active Cinematic World"
    ],
    "doesNotAffect": [
      "the world definition’s own description"
    ],
    "relatedHelpIds": [
      "react.cinematicWorlds.worlds.visualDna.startingProfile",
      "react.cinematicWorlds.performanceMacros.overview"
    ]
  },
  {
    "id": "react.cinematicWorlds.worlds.visualDna.overview",
    "priority": 1,
    "view": "react",
    "engine": "cinematicWorlds",
    "group": "World selection and Visual DNA",
    "title": "Visual DNA",
    "componentType": "group",
    "summary": "Applies a reusable starting character to Reactive Constellation without locking later edits.",
    "whatItDoes": [
      "Groups the controls that configure the active Cinematic World.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the active Cinematic World.",
    "affects": [
      "world selection",
      "Reactive Constellation starting character"
    ]
  },
  {
    "id": "react.cinematicWorlds.worlds.visualDna.startingProfile",
    "priority": 1,
    "view": "react",
    "engine": "cinematicWorlds",
    "group": "World selection and Visual DNA",
    "title": "Starting Profile",
    "componentType": "select",
    "summary": "Applies a cloned, normalized starting profile to Reactive Constellation.",
    "whatItDoes": [
      "Clones and normalizes the profile.",
      "Macros and advanced controls remain editable."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Starting Profile selection in the active Cinematic World"
    ],
    "doesNotAffect": [
      "later macro or advanced edits"
    ],
    "tip": "Apply a profile before fine-tuning macros so later edits remain deliberate.",
    "relatedHelpIds": [
      "react.cinematicWorlds.worlds.worldSelection",
      "react.cinematicWorlds.performanceMacros.overview"
    ]
  },
  {
    "id": "react.cinematicWorlds.performanceMacros.overview",
    "priority": 1,
    "view": "react",
    "engine": "cinematicWorlds",
    "group": "Performance Macros",
    "title": "Performance Macros",
    "componentType": "group",
    "summary": "Scales coordinated aspects of Reactive Constellation while preserving the detailed world settings underneath.",
    "whatItDoes": [
      "Each macro scales a coordinated family of world parameters.",
      "Advanced controls remain editable after macro changes."
    ],
    "whenToUse": "Use this section when configuring the Reactive Constellation performance character.",
    "affects": [
      "world structure",
      "motion",
      "impact",
      "trails",
      "material",
      "camera response"
    ]
  },
  {
    "id": "react.cinematicWorlds.performanceMacros.structure",
    "priority": 1,
    "view": "react",
    "engine": "cinematicWorlds",
    "group": "Performance Macros",
    "title": "Structure",
    "componentType": "slider",
    "summary": "Scales the world’s structural density and organization.",
    "whatItDoes": [
      "Writes the Structure value to the Reactive Constellation performance character as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Structure value in the Reactive Constellation performance character"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.cinematicWorlds.performanceMacros.motion",
    "priority": 1,
    "view": "react",
    "engine": "cinematicWorlds",
    "group": "Performance Macros",
    "title": "Motion",
    "componentType": "slider",
    "summary": "Scales elastic travel, spin, and recovery energy.",
    "whatItDoes": [
      "Writes the Motion value to the Reactive Constellation performance character as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Motion value in the Reactive Constellation performance character"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.cinematicWorlds.performanceMacros.impact",
    "priority": 1,
    "view": "react",
    "engine": "cinematicWorlds",
    "group": "Performance Macros",
    "title": "Impact",
    "componentType": "slider",
    "summary": "Scales authored hits, ruptures, and section impacts.",
    "whatItDoes": [
      "Writes the Impact value to the Reactive Constellation performance character as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Impact value in the Reactive Constellation performance character"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.cinematicWorlds.performanceMacros.trails",
    "priority": 1,
    "view": "react",
    "engine": "cinematicWorlds",
    "group": "Performance Macros",
    "title": "Trails",
    "componentType": "slider",
    "summary": "Scales trail density and persistence.",
    "whatItDoes": [
      "Writes the Trails value to the Reactive Constellation performance character as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Trails value in the Reactive Constellation performance character"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.cinematicWorlds.performanceMacros.material",
    "priority": 1,
    "view": "react",
    "engine": "cinematicWorlds",
    "group": "Performance Macros",
    "title": "Material",
    "componentType": "slider",
    "summary": "Scales material response without replacing detailed material settings.",
    "whatItDoes": [
      "Writes the Material value to the Reactive Constellation performance character as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Material value in the Reactive Constellation performance character"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.cinematicWorlds.performanceMacros.camera",
    "priority": 1,
    "view": "react",
    "engine": "cinematicWorlds",
    "group": "Performance Macros",
    "title": "Camera",
    "componentType": "slider",
    "summary": "Scales camera energy within the active world.",
    "whatItDoes": [
      "Writes the Camera value to the Reactive Constellation performance character as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Camera value in the Reactive Constellation performance character"
    ],
    "doesNotAffect": [
      "manual camera lock"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.cinematicWorlds.autoDirector.variation.overview",
    "priority": 1,
    "view": "react",
    "engine": "cinematicWorlds",
    "group": "Variation and Auto Director",
    "title": "Variation",
    "componentType": "group",
    "summary": "Controls deterministic world variation independently from camera automation.",
    "whatItDoes": [
      "Groups the controls that configure Cinematic Worlds variation and automatic direction.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring Cinematic Worlds variation and automatic direction.",
    "affects": [
      "variation state",
      "camera decisions",
      "world transitions",
      "drop emphasis"
    ]
  },
  {
    "id": "react.cinematicWorlds.autoDirector.autoDirector.overview",
    "priority": 1,
    "view": "react",
    "engine": "cinematicWorlds",
    "group": "Variation and Auto Director",
    "title": "Auto Director",
    "componentType": "group",
    "summary": "Lets Cinematic Worlds choose camera activity and transitions from the current musical context.",
    "whatItDoes": [
      "Uses the current world configuration and musical context to choose camera and transition behavior.",
      "Manual Camera Lock can stop automated camera changes."
    ],
    "whenToUse": "Use this section when configuring Cinematic Worlds variation and automatic direction.",
    "affects": [
      "variation state",
      "camera decisions",
      "world transitions",
      "drop emphasis"
    ]
  },
  {
    "id": "react.cinematicWorlds.autoDirector.autoDirector.strength",
    "priority": 1,
    "view": "react",
    "engine": "cinematicWorlds",
    "group": "Variation and Auto Director",
    "title": "Strength",
    "componentType": "slider",
    "summary": "Sets the overall influence of Auto Director.",
    "whatItDoes": [
      "Writes the Strength value to Cinematic Worlds variation and automatic direction as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Strength value in Cinematic Worlds variation and automatic direction"
    ],
    "recommendedRange": "0–100%",
    "tip": "Start low and increase until automatic choices remain musically legible."
  },
  {
    "id": "react.cinematicWorlds.autoDirector.autoDirector.cameraActivity",
    "priority": 1,
    "view": "react",
    "engine": "cinematicWorlds",
    "group": "Variation and Auto Director",
    "title": "Camera Activity",
    "componentType": "slider",
    "summary": "Sets how actively Auto Director changes or moves the camera.",
    "whatItDoes": [
      "Writes the Camera Activity value to Cinematic Worlds variation and automatic direction as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Camera Activity value in Cinematic Worlds variation and automatic direction"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.cinematicWorlds.autoDirector.autoDirector.transitionFrequency",
    "priority": 1,
    "view": "react",
    "engine": "cinematicWorlds",
    "group": "Variation and Auto Director",
    "title": "Transition Frequency",
    "componentType": "slider",
    "summary": "Sets how frequently Auto Director may transition between shots.",
    "whatItDoes": [
      "Writes the Transition Frequency value to Cinematic Worlds variation and automatic direction as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Transition Frequency value in Cinematic Worlds variation and automatic direction"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.cinematicWorlds.autoDirector.autoDirector.dropImpact",
    "priority": 1,
    "view": "react",
    "engine": "cinematicWorlds",
    "group": "Variation and Auto Director",
    "title": "Drop Impact",
    "componentType": "slider",
    "summary": "Sets how strongly drops influence automatic direction.",
    "whatItDoes": [
      "Writes the Drop Impact value to Cinematic Worlds variation and automatic direction as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Drop Impact value in Cinematic Worlds variation and automatic direction"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.cinematicWorlds.liveControls.audioReaction",
    "priority": 1,
    "view": "react",
    "engine": "cinematicWorlds",
    "group": "Live controls, quality, environment, material",
    "title": "Audio Reaction",
    "componentType": "slider",
    "summary": "Sets the engine-level audio-response amount for the active Cinematic World.",
    "whatItDoes": [
      "Writes the Audio Reaction value to the active Cinematic World output as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Audio Reaction value in the active Cinematic World output"
    ],
    "doesNotAffect": [
      "world route definitions"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.cinematicWorlds.audioMapping.audioReaction.overview",
    "priority": 1,
    "view": "react",
    "engine": "cinematicWorlds",
    "group": "World Audio Mapping",
    "title": "Audio Reaction",
    "componentType": "group",
    "summary": "Controls whether and how audio routes modulate Cinematic World parameters.",
    "whatItDoes": [
      "Enables route-based modulation from audio sources to world parameters.",
      "Global smoothing is applied across the world’s audio mappings."
    ],
    "whenToUse": "Use this section when configuring the active world audio-routing configuration.",
    "affects": [
      "world parameter modulation",
      "audio envelope smoothing"
    ]
  },
  {
    "id": "react.cinematicWorlds.audioMapping.audioReaction.enabled",
    "priority": 1,
    "view": "react",
    "engine": "cinematicWorlds",
    "group": "World Audio Mapping",
    "title": "World Audio Mapping",
    "componentType": "toggle",
    "summary": "Enables or bypasses the world’s route-based audio mappings.",
    "whatItDoes": [
      "When off, configured audio routes stop modulating world parameters.",
      "The base world still renders."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "World Audio Mapping state in the active world audio-routing configuration"
    ],
    "defaultValue": "Defined by the active world"
  },
  {
    "id": "react.cinematicWorlds.audioMapping.audioReaction.globalSmoothingMs",
    "priority": 1,
    "view": "react",
    "engine": "cinematicWorlds",
    "group": "World Audio Mapping",
    "title": "Global Smoothing",
    "componentType": "slider",
    "summary": "Smooths the world’s audio-mapped parameter response in milliseconds.",
    "whatItDoes": [
      "Writes the Global Smoothing value to the active world audio-routing configuration as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Global Smoothing value in the active world audio-routing configuration"
    ],
    "recommendedRange": "0–2000 ms",
    "tip": "Use more smoothing for stable ambience and less for sharp rhythmic response."
  },
  {
    "id": "react.shaderPads.sceneLibrary.scenes.overview",
    "priority": 1,
    "view": "react",
    "engine": "shaderPads",
    "group": "Scene library and renderer",
    "title": "Shader Scenes",
    "componentType": "group",
    "summary": "Selects and filters shader scenes and sets the requested rendering quality.",
    "whatItDoes": [
      "Groups the controls that configure the Shader Pads scene library and renderer.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the Shader Pads scene library and renderer.",
    "affects": [
      "active shader scene",
      "render quality",
      "scene filtering"
    ]
  },
  {
    "id": "react.shaderPads.sceneLibrary.scenes.activeScene",
    "priority": 1,
    "view": "react",
    "engine": "shaderPads",
    "group": "Scene library and renderer",
    "title": "Active Scene",
    "componentType": "selection",
    "summary": "Selects the shader scene rendered by Shader Pads.",
    "whatItDoes": [
      "Chooses the active Active Scene option for the Shader Pads scene library and renderer.",
      "The selected item becomes the current value for this context."
    ],
    "whenToUse": "Use it when choosing the active option for this part of the workflow.",
    "affects": [
      "Active Scene selection in the Shader Pads scene library and renderer"
    ]
  },
  {
    "id": "react.shaderPads.sceneLibrary.scenes.quality",
    "priority": 1,
    "view": "react",
    "engine": "shaderPads",
    "group": "Scene library and renderer",
    "title": "Quality",
    "componentType": "select",
    "summary": "Sets the requested shader rendering quality.",
    "whatItDoes": [
      "Changes renderer quality preference.",
      "It does not change the active scene definition."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Quality selection in the Shader Pads scene library and renderer"
    ],
    "doesNotAffect": [
      "active shader scene"
    ]
  },
  {
    "id": "react.shaderPads.sceneLibrary.scenes.categoryFilter",
    "priority": 1,
    "view": "react",
    "engine": "shaderPads",
    "group": "Scene library and renderer",
    "title": "Category Filter",
    "componentType": "select",
    "summary": "Filters the Shader Scene library by scene category.",
    "whatItDoes": [
      "Changes which scene cards are visible.",
      "It does not unload the active scene."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Category Filter selection in the Shader Pads scene library and renderer"
    ],
    "doesNotAffect": [
      "active shader state"
    ],
    "tip": "Clear the category filter when the active scene seems to have disappeared from the browser."
  },
  {
    "id": "react.shaderPads.shaderMaster.overview",
    "priority": 1,
    "view": "react",
    "engine": "shaderPads",
    "group": "Shader Master",
    "title": "Shader Master",
    "componentType": "group",
    "summary": "Provides scene-wide trims for Shader Pads without replacing scene-local parameters.",
    "whatItDoes": [
      "Applies global trims only when the active scene supports them.",
      "Scene-local authored sensitivity remains intact."
    ],
    "whenToUse": "Use this section when configuring the active Shader Pads scene.",
    "affects": [
      "master shader intensity",
      "motion rate",
      "glow",
      "bass response"
    ]
  },
  {
    "id": "react.shaderPads.shaderMaster.intensity",
    "priority": 1,
    "view": "react",
    "engine": "shaderPads",
    "group": "Shader Master",
    "title": "Intensity",
    "componentType": "slider",
    "summary": "Sets the global output strength of the active shader scene.",
    "whatItDoes": [
      "Applies a scene-wide trim when supported.",
      "Scene-local authored parameters remain intact."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Intensity value in the active Shader Pads scene"
    ],
    "doesNotAffect": [
      "scene-local parameters"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.shaderPads.shaderMaster.motion",
    "priority": 1,
    "view": "react",
    "engine": "shaderPads",
    "group": "Shader Master",
    "title": "Motion",
    "componentType": "slider",
    "summary": "Sets a global animation-rate trim for the active shader scene.",
    "whatItDoes": [
      "Applies a scene-wide animation-rate trim when supported.",
      "Scene-local motion controls retain their relative behavior."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Motion value in the active Shader Pads scene"
    ],
    "doesNotAffect": [
      "scene-local motion values"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.shaderPads.shaderMaster.glow",
    "priority": 1,
    "view": "react",
    "engine": "shaderPads",
    "group": "Shader Master",
    "title": "Glow",
    "componentType": "slider",
    "summary": "Sets a global glow trim for the active shader scene.",
    "whatItDoes": [
      "Writes the Glow value to the active Shader Pads scene as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Glow value in the active Shader Pads scene"
    ],
    "doesNotAffect": [
      "scene-local glow values"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.shaderPads.shaderMaster.bassReact",
    "priority": 1,
    "view": "react",
    "engine": "shaderPads",
    "group": "Shader Master",
    "title": "Bass React",
    "componentType": "slider",
    "summary": "Sets the global bass-response trim for the active shader scene.",
    "whatItDoes": [
      "Applies a scene-wide bass trim when supported.",
      "Scene-local audio sensitivity remains authored."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Bass React value in the active Shader Pads scene"
    ],
    "doesNotAffect": [
      "scene-local audio parameters"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.canvas.sourceAndDisplay.overview",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Source Link and Display",
    "title": "CANVAS",
    "componentType": "group",
    "summary": "Contains CANVAS source selection, display, orchestration, recipe, and video-timing controls.",
    "whatItDoes": [
      "Groups the controls that configure the active CANVAS media output.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the active CANVAS media output.",
    "affects": [
      "media selection behavior",
      "source fit",
      "transform",
      "output opacity"
    ]
  },
  {
    "id": "react.canvas.sourceAndDisplay.sourceLink.overview",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Source Link and Display",
    "title": "CANVAS Source Link",
    "componentType": "group",
    "summary": "Explains how the left SOURCE panel and CANVAS automatic selection share ownership of the active media.",
    "whatItDoes": [
      "Groups the controls that configure the active CANVAS media output.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the active CANVAS media output.",
    "affects": [
      "media selection behavior",
      "source fit",
      "transform",
      "output opacity"
    ]
  },
  {
    "id": "react.canvas.sourceAndDisplay.sourceLink.autoSelect",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Source Link and Display",
    "title": "Auto Select",
    "componentType": "toggle",
    "summary": "Lets CANVAS choose a preset from track analysis while respecting manual source ownership.",
    "whatItDoes": [
      "Track analysis may choose a preset.",
      "A manual media override can keep the selected source locked."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Auto Select state in the active CANVAS media output"
    ],
    "doesNotAffect": [
      "manual source locks"
    ],
    "defaultValue": "Off",
    "tip": "Clear a manual override when Auto Select appears not to change the active source."
  },
  {
    "id": "react.canvas.sourceAndDisplay.display.overview",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Source Link and Display",
    "title": "Display",
    "componentType": "group",
    "summary": "Controls how the active CANVAS source is fitted, transformed, and composited.",
    "whatItDoes": [
      "Groups the controls that configure the active CANVAS media output.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the active CANVAS media output.",
    "affects": [
      "media selection behavior",
      "source fit",
      "transform",
      "output opacity"
    ]
  },
  {
    "id": "react.canvas.sourceAndDisplay.display.fitMode",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Source Link and Display",
    "title": "Fit Mode",
    "componentType": "select",
    "summary": "Chooses how the CANVAS source fits inside the output frame.",
    "whatItDoes": [
      "Stores the selected Fit Mode option in the active CANVAS media output.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Fit Mode selection in the active CANVAS media output"
    ],
    "doesNotAffect": [
      "source media metadata"
    ],
    "defaultValue": "Contain",
    "tip": "Contain preserves the entire source; Cover fills the frame and may crop; Stretch can distort aspect ratio."
  },
  {
    "id": "react.canvas.sourceAndDisplay.display.scale",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Source Link and Display",
    "title": "Scale",
    "componentType": "slider",
    "summary": "Scales the CANVAS source after fit mode is applied.",
    "whatItDoes": [
      "Writes the Scale value to the active CANVAS media output as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Scale value in the active CANVAS media output"
    ],
    "defaultValue": "1",
    "recommendedRange": "0.10–4.00×"
  },
  {
    "id": "react.canvas.sourceAndDisplay.display.positionX",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Source Link and Display",
    "title": "Position X",
    "componentType": "slider",
    "summary": "Moves the CANVAS source horizontally.",
    "whatItDoes": [
      "Writes the Position X value to the active CANVAS media output as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Position X value in the active CANVAS media output"
    ],
    "defaultValue": "0",
    "recommendedRange": "−100 to 100"
  },
  {
    "id": "react.canvas.sourceAndDisplay.display.positionY",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Source Link and Display",
    "title": "Position Y",
    "componentType": "slider",
    "summary": "Moves the CANVAS source vertically.",
    "whatItDoes": [
      "Writes the Position Y value to the active CANVAS media output as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Position Y value in the active CANVAS media output"
    ],
    "defaultValue": "0",
    "recommendedRange": "−100 to 100"
  },
  {
    "id": "react.canvas.sourceAndDisplay.display.rotation",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Source Link and Display",
    "title": "Rotation",
    "componentType": "slider",
    "summary": "Rotates the CANVAS source.",
    "whatItDoes": [
      "Writes the Rotation value to the active CANVAS media output as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Rotation value in the active CANVAS media output"
    ],
    "defaultValue": "0°",
    "recommendedRange": "−180° to 180°"
  },
  {
    "id": "react.canvas.sourceAndDisplay.display.outputOpacity",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Source Link and Display",
    "title": "Canvas Output Opacity",
    "componentType": "slider",
    "summary": "Sets the final opacity of the CANVAS engine output.",
    "whatItDoes": [
      "Applies after the CANVAS source and recipe are rendered.",
      "It is separate from Dry Source Mix."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Canvas Output Opacity value in the active CANVAS media output"
    ],
    "doesNotAffect": [
      "Dry Source Mix"
    ],
    "defaultValue": "100%",
    "recommendedRange": "0–100%",
    "tip": "Use Output Opacity for final compositing, not to rebalance dry versus processed content."
  },
  {
    "id": "react.canvas.videoTiming.overview",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Video Timing",
    "title": "Video Timing",
    "componentType": "group",
    "summary": "Controls saved video playback ranges, looping, and music-driven restarts inside CANVAS.",
    "whatItDoes": [
      "Groups the controls that configure the active CANVAS video source.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the active CANVAS video source.",
    "affects": [
      "clip range",
      "looping",
      "musical restarts",
      "section-trigger mapping"
    ]
  },
  {
    "id": "react.canvas.videoTiming.triggerOn",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Video Timing",
    "title": "Trigger On",
    "componentType": "select",
    "summary": "Chooses the musical event that restarts the active CANVAS video clip.",
    "whatItDoes": [
      "Available only for a saved video source.",
      "Manual Only prevents automatic musical restarts."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Trigger On selection in the active CANVAS video source"
    ],
    "defaultValue": "Manual Only",
    "tip": "Use Manual Only while testing clip ranges before enabling musical restarts.",
    "relatedHelpIds": [
      "react.canvas.videoTiming.sectionTriggerMapping.overview"
    ]
  },
  {
    "id": "react.canvas.videoTiming.clipStartSeconds",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Video Timing",
    "title": "Clip Start Time",
    "componentType": "numeric",
    "summary": "Sets the first source-time position used by CANVAS video playback.",
    "whatItDoes": [
      "Writes a precise Clip Start Time value to the active CANVAS video source.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Clip Start Time value in the active CANVAS video source"
    ],
    "defaultValue": "0 seconds",
    "recommendedRange": "0–21,600 seconds"
  },
  {
    "id": "react.canvas.videoTiming.clipEndSeconds",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Video Timing",
    "title": "Clip End Time",
    "componentType": "numeric",
    "summary": "Sets the last source-time position used by CANVAS video playback.",
    "whatItDoes": [
      "A value of 0 means video end.",
      "The end must remain after the start for a useful range."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Clip End Time value in the active CANVAS video source"
    ],
    "defaultValue": "0 seconds (video end)",
    "recommendedRange": "0–21,600 seconds",
    "tip": "Leave End at 0 when the clip should continue to the natural video end."
  },
  {
    "id": "react.canvas.videoTiming.loopClipRange",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Video Timing",
    "title": "Loop Clip Range",
    "componentType": "toggle",
    "summary": "Loops the configured clip range instead of continuing past it.",
    "whatItDoes": [
      "Uses Clip Start Time and Clip End Time.",
      "If end is 0, the range continues to video end."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Loop Clip Range state in the active CANVAS video source"
    ],
    "defaultValue": "Off"
  },
  {
    "id": "react.canvas.videoTiming.loopFullVideo",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Video Timing",
    "title": "Loop Full Video",
    "componentType": "toggle",
    "summary": "Loops the complete video when no clip end range owns playback.",
    "whatItDoes": [
      "Sets whether Loop Full Video participates in the active CANVAS video source.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Loop Full Video state in the active CANVAS video source"
    ],
    "defaultValue": "On"
  },
  {
    "id": "react.canvas.videoTiming.restartOnDrop",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Video Timing",
    "title": "Restart on Drop",
    "componentType": "toggle",
    "summary": "Restarts the active video when a drop is detected.",
    "whatItDoes": [
      "Sets whether Restart on Drop participates in the active CANVAS video source.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Restart on Drop state in the active CANVAS video source"
    ],
    "defaultValue": "Off"
  },
  {
    "id": "react.canvas.videoTiming.restartOnSectionChange",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Video Timing",
    "title": "Restart on Section Change",
    "componentType": "toggle",
    "summary": "Restarts the active video when the analyzed section changes into an enabled mapped type.",
    "whatItDoes": [
      "Sets whether Restart on Section Change participates in the active CANVAS video source.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Restart on Section Change state in the active CANVAS video source"
    ],
    "defaultValue": "Off"
  },
  {
    "id": "react.canvas.videoTiming.restartOnManualPresetChange",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Video Timing",
    "title": "Restart on Manual Preset Change",
    "componentType": "toggle",
    "summary": "Restarts the active video after a user manually changes the CANVAS preset.",
    "whatItDoes": [
      "Sets whether Restart on Manual Preset Change participates in the active CANVAS video source.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Restart on Manual Preset Change state in the active CANVAS video source"
    ],
    "defaultValue": "Off"
  },
  {
    "id": "react.canvas.videoTiming.sectionTriggerMapping.overview",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Video Timing",
    "title": "Section Trigger Mapping",
    "componentType": "group",
    "summary": "Chooses which analyzed section categories are allowed to restart the active CANVAS video.",
    "whatItDoes": [
      "Maps analyzed section types to restart eligibility.",
      "It does not edit the Track Map itself."
    ],
    "whenToUse": "Use this section when configuring the active CANVAS video source.",
    "affects": [
      "clip range",
      "looping",
      "musical restarts",
      "section-trigger mapping"
    ],
    "doesNotAffect": [
      "Track Map section definitions"
    ],
    "tip": "Map only sections where a visual restart supports the performance.",
    "relatedHelpIds": [
      "react.canvas.videoTiming.triggerOn",
      "react.canvas.videoTiming.restartOnSectionChange"
    ]
  },
  {
    "id": "react.canvas.videoTiming.sectionTriggerMapping.intro",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Video Timing",
    "title": "Intro",
    "componentType": "selection",
    "summary": "Allows Intro sections to restart the active CANVAS video.",
    "whatItDoes": [
      "Chooses the active Intro option for the active CANVAS video source.",
      "The selected item becomes the current value for this context."
    ],
    "whenToUse": "Use it when choosing the active option for this part of the workflow.",
    "affects": [
      "Intro selection in the active CANVAS video source"
    ],
    "defaultValue": "On"
  },
  {
    "id": "react.canvas.videoTiming.sectionTriggerMapping.verse",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Video Timing",
    "title": "Verse",
    "componentType": "selection",
    "summary": "Represents the audit’s Verse section-trigger target.",
    "whatItDoes": [
      "The current CANVAS section-trigger mapping does not expose or normalize Verse.",
      "This registry entry preserves audit coverage but does not correspond to a current selectable chip."
    ],
    "whenToUse": "Do not configure this separately; the current code has no Verse section-trigger category.",
    "affects": [],
    "tags": [
      "auditMismatch"
    ]
  },
  {
    "id": "react.canvas.videoTiming.sectionTriggerMapping.build",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Video Timing",
    "title": "Build",
    "componentType": "selection",
    "summary": "Allows Build sections to restart the active CANVAS video.",
    "whatItDoes": [
      "Chooses the active Build option for the active CANVAS video source.",
      "The selected item becomes the current value for this context."
    ],
    "whenToUse": "Use it when choosing the active option for this part of the workflow.",
    "affects": [
      "Build selection in the active CANVAS video source"
    ],
    "defaultValue": "On"
  },
  {
    "id": "react.canvas.videoTiming.sectionTriggerMapping.preDrop",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Video Timing",
    "title": "Pre-Drop",
    "componentType": "selection",
    "summary": "Represents pre-drop timing, which the current CANVAS implementation normalizes to Build.",
    "whatItDoes": [
      "Pre-drop analysis is normalized to the Build trigger category in current code.",
      "This registry entry preserves the audit’s contextual target without implying a separate runtime control."
    ],
    "whenToUse": "Use the Build trigger category when pre-drop playback should restart the clip.",
    "affects": [
      "Build section-trigger mapping"
    ],
    "tags": [
      "auditMismatch"
    ]
  },
  {
    "id": "react.canvas.videoTiming.sectionTriggerMapping.drop",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Video Timing",
    "title": "Drop",
    "componentType": "selection",
    "summary": "Allows Drop sections to restart the active CANVAS video.",
    "whatItDoes": [
      "Chooses the active Drop option for the active CANVAS video source.",
      "The selected item becomes the current value for this context."
    ],
    "whenToUse": "Use it when choosing the active option for this part of the workflow.",
    "affects": [
      "Drop selection in the active CANVAS video source"
    ],
    "defaultValue": "On"
  },
  {
    "id": "react.canvas.videoTiming.sectionTriggerMapping.breakdown",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Video Timing",
    "title": "Breakdown",
    "componentType": "selection",
    "summary": "Allows Breakdown sections to restart the active CANVAS video.",
    "whatItDoes": [
      "Chooses the active Breakdown option for the active CANVAS video source.",
      "The selected item becomes the current value for this context."
    ],
    "whenToUse": "Use it when choosing the active option for this part of the workflow.",
    "affects": [
      "Breakdown selection in the active CANVAS video source"
    ],
    "defaultValue": "On"
  },
  {
    "id": "react.canvas.videoTiming.sectionTriggerMapping.bridge",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Video Timing",
    "title": "Bridge",
    "componentType": "selection",
    "summary": "Represents bridge timing, which the current CANVAS implementation normalizes to Breakdown.",
    "whatItDoes": [
      "Bridge analysis is normalized to the Breakdown trigger category in current code.",
      "This registry entry preserves the audit’s contextual target without implying a separate runtime control."
    ],
    "whenToUse": "Use the Breakdown trigger category when bridge playback should restart the clip.",
    "affects": [
      "Breakdown section-trigger mapping"
    ],
    "tags": [
      "auditMismatch"
    ]
  },
  {
    "id": "react.canvas.videoTiming.sectionTriggerMapping.outro",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Video Timing",
    "title": "Outro",
    "componentType": "selection",
    "summary": "Allows Outro sections to restart the active CANVAS video.",
    "whatItDoes": [
      "Chooses the active Outro option for the active CANVAS video source.",
      "The selected item becomes the current value for this context."
    ],
    "whenToUse": "Use it when choosing the active option for this part of the workflow.",
    "affects": [
      "Outro selection in the active CANVAS video source"
    ],
    "defaultValue": "On"
  },
  {
    "id": "react.canvas.performanceOrchestration.overview",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Performance Orchestration",
    "title": "Performance Orchestration",
    "componentType": "group",
    "summary": "Uses the Shared Performance Core to arrange a CANVAS media pool across musical sections.",
    "whatItDoes": [
      "Arranges media from the CANVAS performance pool.",
      "Uses roles, composition templates, and section-aware density controls."
    ],
    "whenToUse": "Use this section when configuring the CANVAS performance program.",
    "affects": [
      "media-pool arrangement",
      "layer roles",
      "composition",
      "transitions",
      "effects",
      "motion",
      "cuts"
    ]
  },
  {
    "id": "react.canvas.performanceOrchestration.autoPerformance",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Performance Orchestration",
    "title": "Auto Performance",
    "componentType": "toggle",
    "summary": "Enables Shared Performance Core arrangement for the CANVAS media pool.",
    "whatItDoes": [
      "Uses the Shared Performance Core and the selected media pool.",
      "Manual playback and presets remain fallback behavior when disabled."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Auto Performance state in the CANVAS performance program"
    ],
    "defaultValue": "Defined by saved orchestration state",
    "tip": "Build the media pool first; orchestration has nothing to arrange when the pool is empty.",
    "relatedHelpIds": [
      "react.canvas.performanceOrchestration.performanceShow",
      "react.canvas.performanceOrchestration.composition",
      "react.canvas.performanceOrchestration.autoRole"
    ]
  },
  {
    "id": "react.canvas.performanceOrchestration.performanceShow",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Performance Orchestration",
    "title": "Performance Show",
    "componentType": "select",
    "summary": "Selects the authored CANVAS performance program.",
    "whatItDoes": [
      "Changes the program definition used by orchestration.",
      "The program’s own description stays in its domain definition."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Performance Show selection in the CANVAS performance program"
    ],
    "doesNotAffect": [
      "Performance Show descriptions"
    ],
    "relatedHelpIds": [
      "react.canvas.performanceOrchestration.autoPerformance",
      "react.canvas.performanceOrchestration.composition"
    ]
  },
  {
    "id": "react.canvas.performanceOrchestration.autoRole",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Performance Orchestration",
    "title": "Auto Role",
    "componentType": "toggle",
    "summary": "Derives conservative layer roles when media does not already have an explicit role.",
    "whatItDoes": [
      "Uses media type, alpha, duration, aspect, tags, and library organization.",
      "Explicit roles continue to take precedence."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Auto Role state in the CANVAS performance program"
    ],
    "tip": "Add explicit media roles when automatic inference is not producing the intended composition."
  },
  {
    "id": "react.canvas.performanceOrchestration.composition",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Performance Orchestration",
    "title": "Composition",
    "componentType": "select",
    "summary": "Chooses automatic section-aware composition or a specific composition template.",
    "whatItDoes": [
      "Stores the selected Composition option in the CANVAS performance program.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Composition selection in the CANVAS performance program"
    ]
  },
  {
    "id": "react.canvas.performanceOrchestration.layerComplexity",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Performance Orchestration",
    "title": "Layer Complexity",
    "componentType": "slider",
    "summary": "Sets how many media roles and layers the program may recruit.",
    "whatItDoes": [
      "Writes the Layer Complexity value to the CANVAS performance program as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Layer Complexity value in the CANVAS performance program"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.canvas.performanceOrchestration.transitionDensity",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Performance Orchestration",
    "title": "Transition Density",
    "componentType": "slider",
    "summary": "Sets how often the program uses transitions.",
    "whatItDoes": [
      "Writes the Transition Density value to the CANVAS performance program as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Transition Density value in the CANVAS performance program"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.canvas.performanceOrchestration.effectIntensity",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Performance Orchestration",
    "title": "Effect Intensity",
    "componentType": "slider",
    "summary": "Scales effects applied by the CANVAS performance program.",
    "whatItDoes": [
      "Writes the Effect Intensity value to the CANVAS performance program as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Effect Intensity value in the CANVAS performance program"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.canvas.performanceOrchestration.motionIntensity",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Performance Orchestration",
    "title": "Motion Intensity",
    "componentType": "slider",
    "summary": "Scales motion applied by the CANVAS performance program.",
    "whatItDoes": [
      "Writes the Motion Intensity value to the CANVAS performance program as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Motion Intensity value in the CANVAS performance program"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.canvas.performanceOrchestration.cutDensity",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "Performance Orchestration",
    "title": "Cut Density",
    "componentType": "slider",
    "summary": "Sets how densely the program may cut between sources.",
    "whatItDoes": [
      "Writes the Cut Density value to the CANVAS performance program as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Cut Density value in the CANVAS performance program"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.canvas.reactControls.overview",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS React Controls — Source + Reactivity",
    "title": "CANVAS React Controls",
    "componentType": "group",
    "summary": "Contains the editable parameters of the selected CANVAS visual recipe.",
    "whatItDoes": [
      "Groups the controls that configure the selected CANVAS recipe.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the selected CANVAS recipe.",
    "affects": [
      "untreated source mix",
      "coordinated effect strength",
      "bass response",
      "beat response"
    ]
  },
  {
    "id": "react.canvas.reactControls.sourceAndReactivity.overview",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS React Controls — Source + Reactivity",
    "title": "Source + Reactivity",
    "componentType": "group",
    "summary": "Balances the untreated source against coordinated effect and audio-reactive behavior.",
    "whatItDoes": [
      "Groups the controls that configure the selected CANVAS recipe.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the selected CANVAS recipe.",
    "affects": [
      "untreated source mix",
      "coordinated effect strength",
      "bass response",
      "beat response"
    ]
  },
  {
    "id": "react.canvas.reactControls.sourceAndReactivity.drySourceMix",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS React Controls — Source + Reactivity",
    "title": "Dry Source Mix",
    "componentType": "slider",
    "summary": "Sets only the untreated source contribution in the selected CANVAS recipe.",
    "whatItDoes": [
      "Controls the untreated pass only.",
      "Processed layers and effects remain independent."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Dry Source Mix value in the selected CANVAS recipe"
    ],
    "doesNotAffect": [
      "processed effects",
      "CANVAS Output Opacity"
    ],
    "defaultValue": "100%",
    "recommendedRange": "0–100%",
    "tip": "Lower Dry Source Mix to reveal processed layers without dimming the entire CANVAS engine."
  },
  {
    "id": "react.canvas.reactControls.sourceAndReactivity.visualIntensity",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS React Controls — Source + Reactivity",
    "title": "Visual Intensity",
    "componentType": "slider",
    "summary": "Scales coordinated recipe effects without replacing their individual settings.",
    "whatItDoes": [
      "Scales a coordinated recipe macro.",
      "Individual Glow, Trail, Glitch, Particle Density, Motion, Dry Source Mix, and Output Opacity values are not replaced."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Visual Intensity value in the selected CANVAS recipe"
    ],
    "doesNotAffect": [
      "individual recipe parameter values"
    ],
    "defaultValue": "8%",
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.canvas.reactControls.sourceAndReactivity.bassReactivity",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS React Controls — Source + Reactivity",
    "title": "Bass Reactivity",
    "componentType": "slider",
    "summary": "Scales how bass pushes CANVAS scale, glow, and particle spread.",
    "whatItDoes": [
      "Writes the Bass Reactivity value to the selected CANVAS recipe as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Bass Reactivity value in the selected CANVAS recipe"
    ],
    "defaultValue": "0%",
    "recommendedRange": "0–100%",
    "tip": "Balance Bass Reactivity against Beat Pulse so both low-end movement and discrete hits remain readable."
  },
  {
    "id": "react.canvas.reactControls.sourceAndReactivity.beatPulse",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS React Controls — Source + Reactivity",
    "title": "Beat Pulse",
    "componentType": "slider",
    "summary": "Scales beat-driven pulse, scale, and frame energy.",
    "whatItDoes": [
      "Writes the Beat Pulse value to the selected CANVAS recipe as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Beat Pulse value in the selected CANVAS recipe"
    ],
    "defaultValue": "0%",
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.laserDmx.workspace.overview",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx",
    "group": "Workspace mode",
    "title": "LaserDMX Workspace",
    "componentType": "group",
    "summary": "Switches LaserDMX between direct Beam Matrix authoring and authored Show Director programming.",
    "whatItDoes": [
      "Groups the controls that configure the LaserDMX authoring surface.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the LaserDMX authoring surface.",
    "affects": [
      "Beam Matrix workspace",
      "Show Director workspace"
    ],
    "relatedHelpIds": [
      "react.laserDmx.workspace.matrix",
      "react.laserDmx.workspace.showDirector"
    ]
  },
  {
    "id": "react.laserDmx.workspace.matrix",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx",
    "group": "Workspace mode",
    "title": "Matrix",
    "componentType": "selection",
    "summary": "Opens direct Beam Matrix authoring and manual program tools.",
    "whatItDoes": [
      "Sets LaserDMX authoring mode to manual.",
      "Show Director content remains available when switching back."
    ],
    "whenToUse": "Use it when choosing the active option for this part of the workflow.",
    "affects": [
      "Matrix selection in the LaserDMX authoring surface"
    ]
  },
  {
    "id": "react.laserDmx.workspace.showDirector",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx",
    "group": "Workspace mode",
    "title": "Show Director",
    "componentType": "selection",
    "summary": "Opens the authored Show Director workspace.",
    "whatItDoes": [
      "Sets LaserDMX authoring mode to Show Director.",
      "Beam Matrix content is not deleted."
    ],
    "whenToUse": "Use it when choosing the active option for this part of the workflow.",
    "affects": [
      "Show Director selection in the LaserDMX authoring surface"
    ]
  },
  {
    "id": "react.laserDmx.fx.bassReact",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx",
    "group": "FX and fog",
    "title": "Bass React",
    "componentType": "slider",
    "summary": "Sets LaserDMX’s global bass-response trim.",
    "whatItDoes": [
      "Writes the Bass React value to the LaserDMX preview output as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Bass React value in the LaserDMX preview output"
    ]
  },
  {
    "id": "react.laserDmx.beamMatrix.programAndCanvas.program.overview",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx.beamMatrix",
    "group": "Program and Canvas",
    "title": "Program",
    "componentType": "group",
    "summary": "Summarizes the Beam Matrix program currently loaded in the workspace.",
    "whatItDoes": [
      "Groups the controls that configure the LaserDMX Beam Matrix workspace.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the LaserDMX Beam Matrix workspace.",
    "affects": [
      "program summary",
      "beam-editor guides",
      "reaction groups",
      "cue list"
    ]
  },
  {
    "id": "react.laserDmx.beamMatrix.programAndCanvas.design.overview",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx.beamMatrix",
    "group": "Program and Canvas",
    "title": "Beam Matrix Design",
    "componentType": "group",
    "summary": "Contains the Beam Matrix authoring canvas and its supporting program tools.",
    "whatItDoes": [
      "Groups the controls that configure the LaserDMX Beam Matrix workspace.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the LaserDMX Beam Matrix workspace.",
    "affects": [
      "program summary",
      "beam-editor guides",
      "reaction groups",
      "cue list"
    ]
  },
  {
    "id": "react.laserDmx.beamMatrix.programAndCanvas.canvas.overview",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx.beamMatrix",
    "group": "Program and Canvas",
    "title": "Canvas",
    "componentType": "group",
    "summary": "Controls editor-only guides and the visible working area for Beam Matrix design.",
    "whatItDoes": [
      "Show Grid and Show Beam Paths are editor guides.",
      "Overscan expands the working area used to place beams."
    ],
    "whenToUse": "Use this section when configuring the LaserDMX Beam Matrix workspace.",
    "affects": [
      "program summary",
      "beam-editor guides",
      "reaction groups",
      "cue list"
    ]
  },
  {
    "id": "react.laserDmx.beamMatrix.programAndCanvas.canvas.showBeamEditor",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx.beamMatrix",
    "group": "Program and Canvas",
    "title": "Show Beam Editor",
    "componentType": "toggle",
    "summary": "Shows or hides the Beam Matrix editor overlay.",
    "whatItDoes": [
      "Controls editor visibility only.",
      "Live laser output is not changed."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Show Beam Editor state in the LaserDMX Beam Matrix workspace"
    ],
    "doesNotAffect": [
      "live laser output"
    ],
    "defaultValue": "Defined by workspace state"
  },
  {
    "id": "react.laserDmx.beamMatrix.programAndCanvas.canvas.snapToGrid",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx.beamMatrix",
    "group": "Program and Canvas",
    "title": "Snap to Grid",
    "componentType": "toggle",
    "summary": "Snaps beam placement and movement to the editor grid.",
    "whatItDoes": [
      "Sets whether Snap to Grid participates in the LaserDMX Beam Matrix workspace.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Snap to Grid state in the LaserDMX Beam Matrix workspace"
    ],
    "defaultValue": "Defined by workspace state"
  },
  {
    "id": "react.laserDmx.beamMatrix.programAndCanvas.canvas.showGrid",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx.beamMatrix",
    "group": "Program and Canvas",
    "title": "Show Grid",
    "componentType": "toggle",
    "summary": "Shows or hides the Beam Matrix grid guide.",
    "whatItDoes": [
      "Controls an editor guide only.",
      "Beam geometry and output are unchanged."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Show Grid state in the LaserDMX Beam Matrix workspace"
    ],
    "doesNotAffect": [
      "beam output"
    ],
    "defaultValue": "Defined by workspace state"
  },
  {
    "id": "react.laserDmx.beamMatrix.programAndCanvas.canvas.showBeamPaths",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx.beamMatrix",
    "group": "Program and Canvas",
    "title": "Show Beam Paths",
    "componentType": "toggle",
    "summary": "Shows or hides beam path guides in the editor.",
    "whatItDoes": [
      "Controls editor path guides only.",
      "Beam execution is unchanged."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Show Beam Paths state in the LaserDMX Beam Matrix workspace"
    ],
    "doesNotAffect": [
      "beam output"
    ],
    "defaultValue": "Defined by workspace state"
  },
  {
    "id": "react.laserDmx.beamMatrix.programAndCanvas.canvas.overscan",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx.beamMatrix",
    "group": "Program and Canvas",
    "title": "Overscan",
    "componentType": "slider",
    "summary": "Expands the Beam Matrix working area beyond the nominal stage bounds.",
    "whatItDoes": [
      "Writes the Overscan value to the LaserDMX Beam Matrix workspace as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Overscan value in the LaserDMX Beam Matrix workspace"
    ],
    "defaultValue": "0",
    "recommendedRange": "0–0.50",
    "tip": "Use the smallest overscan that accommodates the intended off-stage beam origins."
  },
  {
    "id": "react.laserDmx.beamMatrix.programAndCanvas.reactionGroups.overview",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx.beamMatrix",
    "group": "Program and Canvas",
    "title": "Reaction Groups",
    "componentType": "group",
    "summary": "Organizes beam groups that can share audio launch and sequencing behavior.",
    "whatItDoes": [
      "Groups the controls that configure the LaserDMX Beam Matrix workspace.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the LaserDMX Beam Matrix workspace.",
    "affects": [
      "program summary",
      "beam-editor guides",
      "reaction groups",
      "cue list"
    ]
  },
  {
    "id": "react.laserDmx.beamMatrix.programAndCanvas.cueList.overview",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx.beamMatrix",
    "group": "Program and Canvas",
    "title": "Cue List",
    "componentType": "group",
    "summary": "Lists authored Beam Matrix cues and their order.",
    "whatItDoes": [
      "Groups the controls that configure the LaserDMX Beam Matrix workspace.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the LaserDMX Beam Matrix workspace.",
    "affects": [
      "program summary",
      "beam-editor guides",
      "reaction groups",
      "cue list"
    ]
  },
  {
    "id": "react.laserDmx.showDirector.performanceProgram.overview",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx.showDirector",
    "group": "Performance Program",
    "title": "Performance Program",
    "componentType": "group",
    "summary": "Runs the selected Show Director program and controls its live response.",
    "whatItDoes": [
      "Keeps the authored rig available when the program is disabled.",
      "Audio Intelligence response can be disabled independently from program playback."
    ],
    "whenToUse": "Use this section when configuring the active authored performance program.",
    "affects": [
      "program playback",
      "program intensity",
      "variation",
      "Audio Intelligence response"
    ]
  },
  {
    "id": "react.laserDmx.showDirector.performanceProgram.enabled",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx.showDirector",
    "group": "Performance Program",
    "title": "Performance Program",
    "componentType": "toggle",
    "summary": "Enables or bypasses execution of the active Show Director program.",
    "whatItDoes": [
      "When disabled, the immutable authored rig remains visible.",
      "The program definition is not deleted."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Performance Program state in the active authored performance program"
    ],
    "relatedHelpIds": [
      "react.laserDmx.showDirector.performanceProgram.programIntensity",
      "react.laserDmx.showDirector.performanceProgram.variationAmount",
      "react.laserDmx.showDirector.performanceProgram.audioIntelligenceResponse"
    ]
  },
  {
    "id": "react.laserDmx.showDirector.performanceProgram.programIntensity",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx.showDirector",
    "group": "Performance Program",
    "title": "Program Intensity",
    "componentType": "slider",
    "summary": "Scales the active Show Director program’s authored output.",
    "whatItDoes": [
      "Writes the Program Intensity value to the active authored performance program as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Program Intensity value in the active authored performance program"
    ],
    "defaultValue": "100%",
    "recommendedRange": "0–2.00×",
    "tip": "Values above 1 amplify the authored program; verify output safety and readability."
  },
  {
    "id": "react.laserDmx.showDirector.performanceProgram.variationAmount",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx.showDirector",
    "group": "Performance Program",
    "title": "Variation Amount",
    "componentType": "slider",
    "summary": "Scales deterministic authored variations when the program provides them.",
    "whatItDoes": [
      "Writes the Variation Amount value to the active authored performance program as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Variation Amount value in the active authored performance program"
    ],
    "defaultValue": "100%",
    "recommendedRange": "0–2.00×",
    "tip": "Set Variation Amount to 0 when deterministic repeatability is more important than authored alternates."
  },
  {
    "id": "react.laserDmx.showDirector.performanceProgram.audioIntelligenceResponse",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx.showDirector",
    "group": "Performance Program",
    "title": "Audio Intelligence Response",
    "componentType": "toggle",
    "summary": "Allows the Show Director program to respond to Audio Intelligence.",
    "whatItDoes": [
      "When off, program execution uses non-Audio-Intelligence fallback behavior.",
      "The performance program can remain enabled."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Audio Intelligence Response state in the active authored performance program"
    ]
  },
  {
    "id": "react.pixGrid.performanceAndMatrix.performance.overview",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "Performance and LED Matrix",
    "title": "Performance",
    "componentType": "group",
    "summary": "Controls whether PixGrid executes its authored performance program and at what strength.",
    "whatItDoes": [
      "Groups the controls that configure the PixGrid live performance and LED presentation.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the PixGrid live performance and LED presentation.",
    "affects": [
      "performance program playback",
      "LED glow",
      "diffusion",
      "subpixel preview"
    ]
  },
  {
    "id": "react.pixGrid.performanceAndMatrix.performance.autoPerformance",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "Performance and LED Matrix",
    "title": "Auto Performance",
    "componentType": "toggle",
    "summary": "Runs the selected PixGrid program through the Shared Performance Core.",
    "whatItDoes": [
      "Sets whether Auto Performance participates in the PixGrid live performance and LED presentation.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Auto Performance state in the PixGrid live performance and LED presentation"
    ],
    "defaultValue": "On",
    "relatedHelpIds": [
      "react.pixGrid.performanceAndMatrix.performance.loadProgramPreset",
      "react.pixGrid.performanceAndMatrix.performance.performanceIntensity"
    ]
  },
  {
    "id": "react.pixGrid.performanceAndMatrix.performance.performanceIntensity",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "Performance and LED Matrix",
    "title": "Performance Intensity",
    "componentType": "slider",
    "summary": "Scales the output of PixGrid’s authored performance program.",
    "whatItDoes": [
      "Writes the Performance Intensity value to the PixGrid live performance and LED presentation as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Performance Intensity value in the PixGrid live performance and LED presentation"
    ],
    "defaultValue": "85%",
    "recommendedRange": "0–100%",
    "tip": "Use Performance Intensity as a final program trim after routes and section plans are correct."
  },
  {
    "id": "react.pixGrid.performanceAndMatrix.performance.loadProgramPreset",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "Performance and LED Matrix",
    "title": "Load Program Preset",
    "componentType": "select",
    "summary": "Loads a complete PixGrid preset, including artwork, presentation, and performance configuration.",
    "whatItDoes": [
      "Applies the preset’s artwork, presentation, and performance configuration together.",
      "Use Change Performance Program Only when those other settings must stay unchanged."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Load Program Preset selection in the PixGrid live performance and LED presentation"
    ],
    "doesNotAffect": [
      "domain descriptions"
    ],
    "tip": "Use this only when the complete preset is wanted; program-only changes have a separate control.",
    "relatedHelpIds": [
      "react.pixGrid.performanceAndMatrix.performance.autoPerformance"
    ]
  },
  {
    "id": "react.pixGrid.performanceAndMatrix.ledMatrix.overview",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "Performance and LED Matrix",
    "title": "LED Matrix",
    "componentType": "group",
    "summary": "Shapes the LED-cell presentation without changing the logical artwork.",
    "whatItDoes": [
      "Glow controls emitter halo; Diffusion softens emitter edges.",
      "RGB Subpixel Mode changes preview presentation, not logical pixel data."
    ],
    "whenToUse": "Use this section when configuring the PixGrid live performance and LED presentation.",
    "affects": [
      "performance program playback",
      "LED glow",
      "diffusion",
      "subpixel preview"
    ],
    "defaultValue": ""
  },
  {
    "id": "react.pixGrid.performanceAndMatrix.ledMatrix.glow",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "Performance and LED Matrix",
    "title": "Glow",
    "componentType": "slider",
    "summary": "Sets the strength of the LED emitter halo.",
    "whatItDoes": [
      "Changes halo strength around emitters.",
      "It does not soften the emitter core."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Glow value in the PixGrid live performance and LED presentation"
    ],
    "doesNotAffect": [
      "diffusion"
    ],
    "defaultValue": "34%",
    "recommendedRange": "0–100%",
    "tip": "Pair Glow with lower Diffusion for a defined emitter core."
  },
  {
    "id": "react.pixGrid.performanceAndMatrix.ledMatrix.diffusion",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "Performance and LED Matrix",
    "title": "Diffusion",
    "componentType": "slider",
    "summary": "Softens LED emitter edges without changing halo radius.",
    "whatItDoes": [
      "Softens emitter edges.",
      "It does not change Glow’s halo radius."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Diffusion value in the PixGrid live performance and LED presentation"
    ],
    "doesNotAffect": [
      "glow radius"
    ],
    "defaultValue": "12%",
    "recommendedRange": "0–100%",
    "tip": "Increase Diffusion when cells look too hard-edged, not when the halo is too weak."
  },
  {
    "id": "react.pixGrid.performanceAndMatrix.ledMatrix.rgbSubpixelMode",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "Performance and LED Matrix",
    "title": "RGB Subpixel Mode",
    "componentType": "toggle",
    "summary": "Previews separate red, green, and blue emitter stripes inside each logical LED cell.",
    "whatItDoes": [
      "Changes LED preview presentation.",
      "Logical artwork pixels and matrix resolution are unchanged."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "RGB Subpixel Mode state in the PixGrid live performance and LED presentation"
    ],
    "doesNotAffect": [
      "logical pixel values"
    ],
    "defaultValue": "Off"
  },
  {
    "id": "react.pixGrid.userArtwork.overview",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "User Artwork",
    "title": "User Artwork",
    "componentType": "group",
    "summary": "Converts a selected still image or SVG into PixGrid-ready pixel content.",
    "whatItDoes": [
      "Samples and positions source artwork on the logical matrix.",
      "Applies color, alpha, edge, and background preparation before rendering."
    ],
    "whenToUse": "Use this section when configuring the selected PixGrid artwork conversion.",
    "affects": [
      "artwork placement",
      "pixel preparation",
      "color conversion",
      "alpha handling"
    ]
  },
  {
    "id": "react.pixGrid.userArtwork.fit",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "User Artwork",
    "title": "Fit",
    "componentType": "select",
    "summary": "Chooses how source artwork is fitted to the logical PixGrid matrix.",
    "whatItDoes": [
      "Fit is applied before position and scale.",
      "The selected source file is unchanged."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Fit selection in the selected PixGrid artwork conversion"
    ],
    "doesNotAffect": [
      "source file"
    ],
    "defaultValue": "Contain"
  },
  {
    "id": "react.pixGrid.userArtwork.positionX",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "User Artwork",
    "title": "Position X",
    "componentType": "slider",
    "summary": "Moves converted artwork horizontally across the matrix.",
    "whatItDoes": [
      "Writes the Position X value to the selected PixGrid artwork conversion as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Position X value in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "50%",
    "recommendedRange": "0–100%",
    "tip": "Center the source before judging Scale."
  },
  {
    "id": "react.pixGrid.userArtwork.positionY",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "User Artwork",
    "title": "Position Y",
    "componentType": "slider",
    "summary": "Moves converted artwork vertically across the matrix.",
    "whatItDoes": [
      "Writes the Position Y value to the selected PixGrid artwork conversion as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Position Y value in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "50%",
    "recommendedRange": "0–100%",
    "tip": "Center the source before judging Scale."
  },
  {
    "id": "react.pixGrid.userArtwork.scale",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "User Artwork",
    "title": "Scale",
    "componentType": "slider",
    "summary": "Scales converted artwork before pixel sampling.",
    "whatItDoes": [
      "Writes the Scale value to the selected PixGrid artwork conversion as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Scale value in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "1",
    "recommendedRange": "0.10–4.00×",
    "tip": "Use Fit first, then refine Scale and position."
  },
  {
    "id": "react.pixGrid.userArtwork.pixelPreparation",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "User Artwork",
    "title": "Pixel Preparation",
    "componentType": "select",
    "summary": "Chooses crisp or smooth source sampling before pixel conversion.",
    "whatItDoes": [
      "Stores the selected Pixel Preparation option in the selected PixGrid artwork conversion.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Pixel Preparation selection in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "Crisp"
  },
  {
    "id": "react.pixGrid.userArtwork.colorMode",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "User Artwork",
    "title": "Color Mode",
    "componentType": "select",
    "summary": "Chooses how source colors are preserved, quantized, or mapped to brand colors.",
    "whatItDoes": [
      "Original preserves source colors; other modes may quantize or apply the brand palette."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Color Mode selection in the selected PixGrid artwork conversion"
    ],
    "doesNotAffect": [
      "source file"
    ],
    "defaultValue": "Original"
  },
  {
    "id": "react.pixGrid.userArtwork.alphaThreshold",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "User Artwork",
    "title": "Alpha Threshold",
    "componentType": "slider",
    "summary": "Sets the alpha cutoff below which source pixels are treated as transparent.",
    "whatItDoes": [
      "Writes the Alpha Threshold value to the selected PixGrid artwork conversion as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Alpha Threshold value in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "4%",
    "recommendedRange": "0–100%",
    "tip": "Raise the threshold to remove faint background pixels; lower it to preserve soft edges."
  },
  {
    "id": "react.pixGrid.userArtwork.preserveAlpha",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "User Artwork",
    "title": "Preserve Alpha",
    "componentType": "toggle",
    "summary": "Preserves source alpha through PixGrid conversion.",
    "whatItDoes": [
      "Retains source transparency during conversion.",
      "Artwork Background can still determine how remaining empty areas are prepared."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Preserve Alpha state in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "On"
  },
  {
    "id": "react.pixGrid.userArtwork.contrast",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "User Artwork",
    "title": "Contrast",
    "componentType": "slider",
    "summary": "Adjusts source contrast before pixel conversion.",
    "whatItDoes": [
      "Writes the Contrast value to the selected PixGrid artwork conversion as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Contrast value in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "1",
    "recommendedRange": "0.25–2.00×",
    "tip": "Use moderate contrast before Edge Enhancement to avoid brittle silhouettes."
  },
  {
    "id": "react.pixGrid.userArtwork.brightness",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "User Artwork",
    "title": "Brightness",
    "componentType": "slider",
    "summary": "Adjusts source brightness before pixel conversion.",
    "whatItDoes": [
      "Writes the Brightness value to the selected PixGrid artwork conversion as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Brightness value in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "1",
    "recommendedRange": "0.25–2.00×"
  },
  {
    "id": "react.pixGrid.userArtwork.saturation",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "User Artwork",
    "title": "Saturation",
    "componentType": "slider",
    "summary": "Adjusts source saturation before pixel conversion.",
    "whatItDoes": [
      "Writes the Saturation value to the selected PixGrid artwork conversion as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Saturation value in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "1",
    "recommendedRange": "0–2.00×"
  },
  {
    "id": "react.pixGrid.userArtwork.edgeEnhancement",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "User Artwork",
    "title": "Edge Enhancement",
    "componentType": "slider",
    "summary": "Strengthens source edges before conversion to LED cells.",
    "whatItDoes": [
      "Writes the Edge Enhancement value to the selected PixGrid artwork conversion as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Edge Enhancement value in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "0%",
    "recommendedRange": "0–100%",
    "tip": "Check thin details at the actual matrix resolution before increasing further."
  },
  {
    "id": "react.pixGrid.userArtwork.artworkBackground",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "User Artwork",
    "title": "Artwork Background",
    "componentType": "select",
    "summary": "Chooses how transparent artwork background areas are prepared.",
    "whatItDoes": [
      "Controls conversion-time background handling.",
      "The PixGrid output background is a separate setting."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Artwork Background selection in the selected PixGrid artwork conversion"
    ],
    "doesNotAffect": [
      "PixGrid output background"
    ],
    "defaultValue": "Transparent"
  },
  {
    "id": "react.pixGrid.userArtwork.backgroundColor",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "User Artwork",
    "title": "Artwork Background Color",
    "componentType": "field",
    "summary": "Sets the solid preparation color used when Artwork Background is Solid.",
    "whatItDoes": [
      "Writes the edited Artwork Background Color data to the selected PixGrid artwork conversion.",
      "The value remains owned by the current item or document."
    ],
    "whenToUse": "Edit it when the current label, text, or metadata no longer describes the item accurately.",
    "affects": [
      "Artwork Background Color data in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "#000000"
  },
  {
    "id": "react.pixGrid.userArtwork.brandStrength",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "User Artwork",
    "title": "Brand Strength",
    "componentType": "slider",
    "summary": "Sets how strongly brand colors influence non-original color modes.",
    "whatItDoes": [
      "Writes the Brand Strength value to the selected PixGrid artwork conversion as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Brand Strength value in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "80%",
    "recommendedRange": "0–100%",
    "tip": "Preserve Black and Preserve White can protect neutral areas while Brand Strength recolors the rest."
  },
  {
    "id": "react.pixGrid.userArtwork.preserveBlack",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "User Artwork",
    "title": "Preserve Black",
    "componentType": "toggle",
    "summary": "Protects near-black source pixels from recoloring.",
    "whatItDoes": [
      "Sets whether Preserve Black participates in the selected PixGrid artwork conversion.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Preserve Black state in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "On"
  },
  {
    "id": "react.pixGrid.userArtwork.preserveWhite",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "User Artwork",
    "title": "Preserve White",
    "componentType": "toggle",
    "summary": "Protects near-white source pixels from recoloring.",
    "whatItDoes": [
      "Sets whether Preserve White participates in the selected PixGrid artwork conversion.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Preserve White state in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "On"
  },
  {
    "id": "react.pixGrid.design.editingContext.activeScene",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "Design — Editing Context and Grid Presentation",
    "title": "Active Scene",
    "componentType": "select",
    "summary": "Selects the PixGrid scene currently shown in the design workspace.",
    "whatItDoes": [
      "Stores the selected Active Scene option in the PixGrid authoring scene context.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Active Scene selection in the PixGrid authoring scene context"
    ]
  },
  {
    "id": "react.pixGrid.design.scene.overview",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "Design — Scene, Layer, Selection, Tool Settings",
    "title": "Scene",
    "componentType": "group",
    "summary": "Identifies the PixGrid scene currently being edited.",
    "whatItDoes": [
      "Groups the controls that configure the selected PixGrid scene.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the selected PixGrid scene.",
    "affects": [
      "scene-level authoring context"
    ]
  },
  {
    "id": "react.pixGrid.performanceProgram.overview",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "Performance Program and Banks",
    "title": "Performance Program",
    "componentType": "group",
    "summary": "Changes PixGrid’s authored program and section plan without requiring artwork edits.",
    "whatItDoes": [
      "Program-only changes preserve current artwork and presentation.",
      "Section Plan chooses the active authored plan within the program."
    ],
    "whenToUse": "Use this section when configuring the PixGrid authored performance program.",
    "affects": [
      "program selection",
      "section plan",
      "performance enablement",
      "performance intensity"
    ]
  },
  {
    "id": "react.pixGrid.performanceProgram.programSelection",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "Performance Program and Banks",
    "title": "Change Performance Program Only",
    "componentType": "select",
    "summary": "Changes only the authored PixGrid performance program and its overrides.",
    "whatItDoes": [
      "Preserves artwork and presentation settings.",
      "Only the performance program and its overrides change."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Change Performance Program Only selection in the PixGrid authored performance program"
    ],
    "doesNotAffect": [
      "artwork",
      "LED presentation"
    ],
    "tip": "Use this control while auditioning choreography against the same artwork."
  },
  {
    "id": "react.pixGrid.performanceProgram.autoPerformance",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "Performance Program and Banks",
    "title": "Auto Performance",
    "componentType": "toggle",
    "summary": "Enables or bypasses PixGrid program execution from the reactivity workspace.",
    "whatItDoes": [
      "Sets whether Auto Performance participates in the PixGrid authored performance program.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Auto Performance state in the PixGrid authored performance program"
    ],
    "defaultValue": "On"
  },
  {
    "id": "react.pixGrid.performanceProgram.performanceIntensity",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "Performance Program and Banks",
    "title": "Performance Intensity",
    "componentType": "slider",
    "summary": "Scales PixGrid program output from the reactivity workspace.",
    "whatItDoes": [
      "Writes the Performance Intensity value to the PixGrid authored performance program as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Performance Intensity value in the PixGrid authored performance program"
    ],
    "defaultValue": "85%",
    "recommendedRange": "0–100%"
  },
  {
    "id": "react.pixGrid.performanceProgram.sectionPlan",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "Performance Program and Banks",
    "title": "Section Plan",
    "componentType": "select",
    "summary": "Selects the authored section plan used by the active PixGrid program.",
    "whatItDoes": [
      "Chooses one plan from the active program.",
      "It does not change the Track Map sections."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Section Plan selection in the PixGrid authored performance program"
    ],
    "tip": "Choose the section plan that matches the current authored program, not the displayed Track Map label alone."
  },
  {
    "id": "visualizer.effects.global.overview",
    "priority": 1,
    "view": "visualizer",
    "group": "Effect Controls — Global",
    "title": "Global",
    "componentType": "group",
    "summary": "Applies broad trims across the Visualizer effect system.",
    "whatItDoes": [
      "Groups the controls that configure the Visualizer global effect layer.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the Visualizer global effect layer.",
    "affects": [
      "master effect strength",
      "bass response",
      "audio-reactive scale",
      "color shift"
    ]
  },
  {
    "id": "visualizer.effects.global.masterIntensity",
    "priority": 1,
    "view": "visualizer",
    "group": "Effect Controls — Global",
    "title": "Master Intensity",
    "componentType": "slider",
    "summary": "Scales the combined Visualizer effect output.",
    "whatItDoes": [
      "Writes the Master Intensity value to the Visualizer global effect layer as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Master Intensity value in the Visualizer global effect layer"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "visualizer.effects.global.bassReactivity",
    "priority": 1,
    "view": "visualizer",
    "group": "Effect Controls — Global",
    "title": "Bass Reactivity",
    "componentType": "slider",
    "summary": "Scales global bass-driven effect response.",
    "whatItDoes": [
      "Writes the Bass Reactivity value to the Visualizer global effect layer as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Bass Reactivity value in the Visualizer global effect layer"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "visualizer.effects.global.reactiveScale",
    "priority": 1,
    "view": "visualizer",
    "group": "Effect Controls — Global",
    "title": "Reactive Scale",
    "componentType": "slider",
    "summary": "Sets scale pulsing for media that participates in Audio Reactivity.",
    "whatItDoes": [
      "Works only for media with Audio Reactivity enabled.",
      "The control is dimmed when global Audio Reactivity is off."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Reactive Scale value in the Visualizer global effect layer"
    ],
    "doesNotAffect": [
      "clip timing"
    ],
    "defaultValue": "Defined by Visualizer state",
    "recommendedRange": "0–2.00×",
    "tip": "Enable Audio Reactivity on the target media or layer item before troubleshooting Reactive Scale."
  },
  {
    "id": "visualizer.effects.global.colorShift",
    "priority": 1,
    "view": "visualizer",
    "group": "Effect Controls — Global",
    "title": "Color Shift",
    "componentType": "slider",
    "summary": "Shifts effect color output across the available hue range.",
    "whatItDoes": [
      "Writes the Color Shift value to the Visualizer global effect layer as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Color Shift value in the Visualizer global effect layer"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "visualizer.effects.audioReactive.overview",
    "priority": 1,
    "view": "visualizer",
    "group": "Effect Controls — Audio Reactive",
    "title": "Audio Reactive",
    "componentType": "group",
    "summary": "Controls the Visualizer effects that are driven directly by live audio analysis.",
    "whatItDoes": [
      "Groups the controls that configure the Visualizer audio-reactive effect group.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the Visualizer audio-reactive effect group.",
    "affects": [
      "spectrum, scope, beat, particle, and grid effects"
    ]
  },
  {
    "id": "visualizer.effects.audioReactive.spectrumBars",
    "priority": 1,
    "view": "visualizer",
    "group": "Effect Controls — Audio Reactive",
    "title": "Spectrum Bars",
    "componentType": "slider",
    "summary": "Sets the strength of the spectrum-bar effect.",
    "whatItDoes": [
      "Writes the Spectrum Bars value to the Visualizer audio-reactive effect group as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Spectrum Bars value in the Visualizer audio-reactive effect group"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "visualizer.effects.audioReactive.barCount",
    "priority": 1,
    "view": "visualizer",
    "group": "Effect Controls — Audio Reactive",
    "title": "Bar Count",
    "componentType": "numeric",
    "summary": "Sets how many spectrum bars are rendered.",
    "whatItDoes": [
      "Writes a precise Bar Count value to the Visualizer audio-reactive effect group.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Bar Count value in the Visualizer audio-reactive effect group"
    ],
    "defaultValue": "Defined by effect parameters",
    "recommendedRange": "8–120 bars"
  },
  {
    "id": "visualizer.effects.audioReactive.smoothing",
    "priority": 1,
    "view": "visualizer",
    "group": "Effect Controls — Audio Reactive",
    "title": "Smoothing",
    "componentType": "numeric",
    "summary": "Sets temporal smoothing for spectrum bars.",
    "whatItDoes": [
      "Writes a precise Smoothing value to the Visualizer audio-reactive effect group.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Smoothing value in the Visualizer audio-reactive effect group"
    ],
    "defaultValue": "Defined by effect parameters",
    "recommendedRange": "0–0.95",
    "tip": "Higher smoothing is steadier; lower smoothing follows transients more closely."
  },
  {
    "id": "visualizer.effects.audioReactive.mirror",
    "priority": 1,
    "view": "visualizer",
    "group": "Effect Controls — Audio Reactive",
    "title": "Mirror",
    "componentType": "toggle",
    "summary": "Mirrors spectrum bars across the effect axis.",
    "whatItDoes": [
      "Applies to Spectrum Bars only.",
      "It does not mirror other audio-reactive effects."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Mirror state in the Visualizer audio-reactive effect group"
    ],
    "doesNotAffect": [
      "other audio-reactive effects"
    ],
    "defaultValue": "Defined by effect parameters"
  },
  {
    "id": "visualizer.effects.audioReactive.circularSpectrum",
    "priority": 1,
    "view": "visualizer",
    "group": "Effect Controls — Audio Reactive",
    "title": "Circular Spectrum",
    "componentType": "slider",
    "summary": "Sets the strength of the circular spectrum effect.",
    "whatItDoes": [
      "Writes the Circular Spectrum value to the Visualizer audio-reactive effect group as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Circular Spectrum value in the Visualizer audio-reactive effect group"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "visualizer.effects.audioReactive.oscilloscope",
    "priority": 1,
    "view": "visualizer",
    "group": "Effect Controls — Audio Reactive",
    "title": "Oscilloscope",
    "componentType": "slider",
    "summary": "Sets the strength of the Visualizer oscilloscope effect.",
    "whatItDoes": [
      "Writes the Oscilloscope value to the Visualizer audio-reactive effect group as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Oscilloscope value in the Visualizer audio-reactive effect group"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "visualizer.effects.audioReactive.beatRing",
    "priority": 1,
    "view": "visualizer",
    "group": "Effect Controls — Audio Reactive",
    "title": "Beat Ring",
    "componentType": "slider",
    "summary": "Sets the strength of the beat-ring effect.",
    "whatItDoes": [
      "Writes the Beat Ring value to the Visualizer audio-reactive effect group as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Beat Ring value in the Visualizer audio-reactive effect group"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "visualizer.effects.audioReactive.particleBurst",
    "priority": 1,
    "view": "visualizer",
    "group": "Effect Controls — Audio Reactive",
    "title": "Particle Burst",
    "componentType": "slider",
    "summary": "Sets the strength of audio-triggered particle bursts.",
    "whatItDoes": [
      "Writes the Particle Burst value to the Visualizer audio-reactive effect group as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Particle Burst value in the Visualizer audio-reactive effect group"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "visualizer.effects.audioReactive.maxParticles",
    "priority": 1,
    "view": "visualizer",
    "group": "Effect Controls — Audio Reactive",
    "title": "Max Particles",
    "componentType": "numeric",
    "summary": "Caps the number of live particles used by Particle Burst.",
    "whatItDoes": [
      "Writes a precise Max Particles value to the Visualizer audio-reactive effect group.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Max Particles value in the Visualizer audio-reactive effect group"
    ],
    "defaultValue": "Defined by effect parameters",
    "recommendedRange": "10–200 particles",
    "tip": "Lower Max Particles before reducing effect strength when performance drops."
  },
  {
    "id": "visualizer.effects.audioReactive.reactiveGrid",
    "priority": 1,
    "view": "visualizer",
    "group": "Effect Controls — Audio Reactive",
    "title": "Reactive Grid",
    "componentType": "slider",
    "summary": "Sets the strength of the audio-reactive grid effect.",
    "whatItDoes": [
      "Writes the Reactive Grid value to the Visualizer audio-reactive effect group as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Reactive Grid value in the Visualizer audio-reactive effect group"
    ],
    "recommendedRange": "0–100%"
  },
  {
    "id": "visualizer.layers.rendering.overview",
    "priority": 1,
    "view": "visualizer",
    "group": "Layers — Rendering stack",
    "title": "Rendering",
    "componentType": "group",
    "summary": "Defines how the background, main, and overlay layers are combined.",
    "whatItDoes": [
      "Layers render in background, main, then overlay order.",
      "Each layer has independent visibility, blend mode, and opacity."
    ],
    "whenToUse": "Use this section when configuring the Visualizer rendering stack.",
    "affects": [
      "background, main, and overlay layer order",
      "layer visibility",
      "blend mode",
      "opacity"
    ]
  },
  {
    "id": "visualizer.layers.rendering.backgroundLayer",
    "priority": 1,
    "view": "visualizer",
    "group": "Layers — Rendering stack",
    "title": "Background Layer",
    "componentType": "group",
    "summary": "Holds media rendered behind the main visual layer.",
    "whatItDoes": [
      "Groups the controls that configure the Visualizer rendering stack.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the Visualizer rendering stack.",
    "affects": [
      "background, main, and overlay layer order",
      "layer visibility",
      "blend mode",
      "opacity"
    ]
  },
  {
    "id": "visualizer.layers.rendering.mainLayer",
    "priority": 1,
    "view": "visualizer",
    "group": "Layers — Rendering stack",
    "title": "Main Layer",
    "componentType": "group",
    "summary": "Holds the primary visual content in the layer stack.",
    "whatItDoes": [
      "Groups the controls that configure the Visualizer rendering stack.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the Visualizer rendering stack.",
    "affects": [
      "background, main, and overlay layer order",
      "layer visibility",
      "blend mode",
      "opacity"
    ]
  },
  {
    "id": "visualizer.layers.rendering.overlayLayer",
    "priority": 1,
    "view": "visualizer",
    "group": "Layers — Rendering stack",
    "title": "Overlay Layer",
    "componentType": "group",
    "summary": "Holds logos, textures, and other content rendered above the main layer.",
    "whatItDoes": [
      "Groups the controls that configure the Visualizer rendering stack.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the Visualizer rendering stack.",
    "affects": [
      "background, main, and overlay layer order",
      "layer visibility",
      "blend mode",
      "opacity"
    ]
  },
  {
    "id": "visualizer.layers.rendering.visibility",
    "priority": 1,
    "view": "visualizer",
    "group": "Layers — Rendering stack",
    "title": "Layer Visibility",
    "componentType": "toggle",
    "summary": "Shows or hides the entire layer.",
    "whatItDoes": [
      "Sets whether Layer Visibility participates in the Visualizer rendering stack.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Layer Visibility state in the Visualizer rendering stack"
    ],
    "doesNotAffect": [
      "the layer’s media assignments"
    ]
  },
  {
    "id": "visualizer.layers.rendering.blendMode",
    "priority": 1,
    "view": "visualizer",
    "group": "Layers — Rendering stack",
    "title": "Layer Blend Mode",
    "componentType": "select",
    "summary": "Chooses how the layer’s pixels combine with layers below it.",
    "whatItDoes": [
      "Stores the selected Layer Blend Mode option in the Visualizer rendering stack.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Layer Blend Mode selection in the Visualizer rendering stack"
    ],
    "doesNotAffect": [
      "layer order"
    ],
    "tip": "Use Normal for predictable stacking; use additive modes for light-like overlays."
  },
  {
    "id": "visualizer.layers.rendering.opacity",
    "priority": 1,
    "view": "visualizer",
    "group": "Layers — Rendering stack",
    "title": "Layer Opacity",
    "componentType": "slider",
    "summary": "Sets the layer’s overall opacity.",
    "whatItDoes": [
      "Writes the Layer Opacity value to the Visualizer rendering stack as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Layer Opacity value in the Visualizer rendering stack"
    ],
    "defaultValue": "100%",
    "recommendedRange": "0–100%",
    "tip": "Set blend mode before fine-tuning opacity."
  },
  {
    "id": "visualizer.layers.item.globalFxAndAudioReactivity",
    "priority": 1,
    "view": "visualizer",
    "group": "Layers — Layer Item",
    "title": "Global FX / Audio Reactivity",
    "componentType": "toggle",
    "summary": "Lets this layer item participate in global effects and audio-driven modulation.",
    "whatItDoes": [
      "Writes the item’s global-FX/audio-reactive participation state.",
      "The global Audio Reactivity master can still disable the response."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Global FX / Audio Reactivity state in the selected Visualizer layer item"
    ],
    "doesNotAffect": [
      "global Audio Reactivity master state"
    ]
  },
  {
    "id": "visualizer.modulation.audioReactivity",
    "priority": 1,
    "view": "visualizer",
    "group": "Modulation",
    "title": "Audio Reactivity",
    "componentType": "toggle",
    "summary": "Enables or bypasses the Visualizer’s global audio modulation system.",
    "whatItDoes": [
      "When off, beat-driven movement and modulation are bypassed globally.",
      "Per-item enable flags are retained."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Audio Reactivity state in the Visualizer modulation system"
    ],
    "doesNotAffect": [
      "stored per-item participation flags"
    ]
  },
  {
    "id": "visualizer.timeline.colorGrade.color.overview",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Color Grade",
    "title": "Color",
    "componentType": "group",
    "summary": "Enables and edits the selected source’s color grade.",
    "whatItDoes": [
      "Color grading is attached to the selected source.",
      "The grade is applied before later RGB split, bloom, and displacement passes."
    ],
    "whenToUse": "Use this section when configuring the selected timeline source color grade.",
    "affects": [
      "source color grade",
      "look preset",
      "basic color and tone"
    ]
  },
  {
    "id": "visualizer.timeline.colorGrade.color.enabled",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Color Grade",
    "title": "Enable",
    "componentType": "toggle",
    "summary": "Enables or bypasses the selected source’s color grade.",
    "whatItDoes": [
      "Bypasses or applies the complete source grade.",
      "The grade values remain stored while bypassed."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Enable state in the selected timeline source color grade"
    ],
    "doesNotAffect": [
      "stored grade values"
    ],
    "defaultValue": "On"
  },
  {
    "id": "visualizer.timeline.colorGrade.looks.overview",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Color Grade",
    "title": "Looks",
    "componentType": "group",
    "summary": "Applies a predefined color-grade recipe to the selected source.",
    "whatItDoes": [
      "Groups the controls that configure the selected timeline source color grade.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the selected timeline source color grade.",
    "affects": [
      "source color grade",
      "look preset",
      "basic color and tone"
    ]
  },
  {
    "id": "visualizer.timeline.colorGrade.looks.lookPreset",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Color Grade",
    "title": "Look Preset",
    "componentType": "select",
    "summary": "Applies a predefined look to the selected source’s color-grade values.",
    "whatItDoes": [
      "Stores the selected Look Preset option in the selected timeline source color grade.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Look Preset selection in the selected timeline source color grade"
    ],
    "doesNotAffect": [
      "source media"
    ],
    "tip": "Apply a look first, then make small Basic and Tone adjustments."
  },
  {
    "id": "visualizer.timeline.colorGrade.basic.overview",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Color Grade",
    "title": "Basic",
    "componentType": "group",
    "summary": "Adjusts brightness, contrast, saturation, and hue for the selected source.",
    "whatItDoes": [
      "Groups the controls that configure the selected timeline source color grade.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the selected timeline source color grade.",
    "affects": [
      "source color grade",
      "look preset",
      "basic color and tone"
    ]
  },
  {
    "id": "visualizer.timeline.colorGrade.basic.brightness",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Color Grade",
    "title": "Brightness",
    "componentType": "slider",
    "summary": "Raises or lowers the selected source’s luminance.",
    "whatItDoes": [
      "Writes the Brightness value to the selected timeline source color grade as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Brightness value in the selected timeline source color grade"
    ],
    "defaultValue": "0",
    "recommendedRange": "−100 to 100"
  },
  {
    "id": "visualizer.timeline.colorGrade.basic.contrast",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Color Grade",
    "title": "Contrast",
    "componentType": "slider",
    "summary": "Expands or compresses tonal separation.",
    "whatItDoes": [
      "Writes the Contrast value to the selected timeline source color grade as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Contrast value in the selected timeline source color grade"
    ],
    "defaultValue": "0",
    "recommendedRange": "−100 to 100"
  },
  {
    "id": "visualizer.timeline.colorGrade.basic.saturation",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Color Grade",
    "title": "Saturation",
    "componentType": "slider",
    "summary": "Raises or lowers color saturation.",
    "whatItDoes": [
      "Writes the Saturation value to the selected timeline source color grade as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Saturation value in the selected timeline source color grade"
    ],
    "defaultValue": "0",
    "recommendedRange": "−100 to 100"
  },
  {
    "id": "visualizer.timeline.colorGrade.basic.hue",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Color Grade",
    "title": "Hue",
    "componentType": "slider",
    "summary": "Rotates source hues in degrees.",
    "whatItDoes": [
      "Writes the Hue value to the selected timeline source color grade as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Hue value in the selected timeline source color grade"
    ],
    "defaultValue": "0°",
    "recommendedRange": "−180° to 180°"
  },
  {
    "id": "visualizer.timeline.colorGrade.tone.overview",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Color Grade",
    "title": "Tone",
    "componentType": "group",
    "summary": "Adjusts temperature and tint; these two controls require the GPU renderer.",
    "whatItDoes": [
      "Groups the controls that configure the selected timeline source color grade.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the selected timeline source color grade.",
    "affects": [
      "source color grade",
      "look preset",
      "basic color and tone"
    ]
  },
  {
    "id": "visualizer.timeline.colorGrade.tone.temperature",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Color Grade",
    "title": "Temperature",
    "componentType": "slider",
    "summary": "Moves the selected source toward warmer or cooler color balance.",
    "whatItDoes": [
      "Requires WebGL2 for rendered output.",
      "Canvas 2D does not apply temperature."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Temperature value in the selected timeline source color grade"
    ],
    "defaultValue": "0",
    "recommendedRange": "−100 to 100",
    "tip": "Confirm the GPU renderer is active before judging Temperature."
  },
  {
    "id": "visualizer.timeline.colorGrade.tone.tint",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Color Grade",
    "title": "Tint",
    "componentType": "slider",
    "summary": "Moves the selected source along the green–magenta tint axis.",
    "whatItDoes": [
      "Requires WebGL2 for rendered output.",
      "Canvas 2D does not apply tint."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Tint value in the selected timeline source color grade"
    ],
    "defaultValue": "0",
    "recommendedRange": "−100 to 100",
    "tip": "Confirm the GPU renderer is active before judging Tint."
  },
  {
    "id": "visualizer.timeline.backgroundClip.info.overview",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Background Clip Inspector",
    "title": "Info",
    "componentType": "group",
    "summary": "Edits the selected background clip’s role, timing, trim, playback, fit, and global-FX participation.",
    "whatItDoes": [
      "Groups the controls that configure the selected background timeline clip.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the selected background timeline clip.",
    "affects": [
      "clip timing",
      "media trim",
      "playback mode",
      "fit",
      "transitions",
      "color grade"
    ]
  },
  {
    "id": "visualizer.timeline.backgroundClip.info.role",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Background Clip Inspector",
    "title": "Role",
    "componentType": "select",
    "summary": "Sets the Media Library role of the background clip’s source item.",
    "whatItDoes": [
      "Stores the selected Role option in the selected background timeline clip.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Role selection in the selected background timeline clip"
    ]
  },
  {
    "id": "visualizer.timeline.backgroundClip.info.startSeconds",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Background Clip Inspector",
    "title": "Start (s)",
    "componentType": "numeric",
    "summary": "Sets where the background clip begins on the master timeline.",
    "whatItDoes": [
      "Writes a precise Start (s) value to the selected background timeline clip.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Start (s) value in the selected background timeline clip"
    ],
    "defaultValue": "0 seconds",
    "recommendedRange": "0 seconds or later"
  },
  {
    "id": "visualizer.timeline.backgroundClip.info.durationSeconds",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Background Clip Inspector",
    "title": "Dur (s)",
    "componentType": "numeric",
    "summary": "Sets how long the background clip occupies the timeline.",
    "whatItDoes": [
      "Writes a precise Dur (s) value to the selected background timeline clip.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Dur (s) value in the selected background timeline clip"
    ],
    "defaultValue": "At least the minimum clip duration",
    "recommendedRange": "Minimum clip duration to 3600 seconds"
  },
  {
    "id": "visualizer.timeline.backgroundClip.info.mediaInSeconds",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Background Clip Inspector",
    "title": "In",
    "componentType": "numeric",
    "summary": "Sets the source-media in point.",
    "whatItDoes": [
      "Writes a precise In value to the selected background timeline clip.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "In value in the selected background timeline clip"
    ],
    "defaultValue": "0 seconds",
    "recommendedRange": "0 seconds or later"
  },
  {
    "id": "visualizer.timeline.backgroundClip.info.mediaOutSeconds",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Background Clip Inspector",
    "title": "Out",
    "componentType": "numeric",
    "summary": "Sets the source-media out point; blank uses the media end.",
    "whatItDoes": [
      "Writes a precise Out value to the selected background timeline clip.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Out value in the selected background timeline clip"
    ],
    "defaultValue": "Media end",
    "recommendedRange": "0 seconds or later"
  },
  {
    "id": "visualizer.timeline.backgroundClip.info.mode",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Background Clip Inspector",
    "title": "Mode",
    "componentType": "select",
    "summary": "Chooses trim, loop, or freeze playback for the clip.",
    "whatItDoes": [
      "Stores the selected Mode option in the selected background timeline clip.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Mode selection in the selected background timeline clip"
    ],
    "defaultValue": "Trim"
  },
  {
    "id": "visualizer.timeline.backgroundClip.info.fit",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Background Clip Inspector",
    "title": "Fit",
    "componentType": "select",
    "summary": "Chooses whether the clip covers or fits inside the output frame.",
    "whatItDoes": [
      "Stores the selected Fit option in the selected background timeline clip.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Fit selection in the selected background timeline clip"
    ],
    "defaultValue": "Cover"
  },
  {
    "id": "visualizer.timeline.backgroundClip.info.size",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Background Clip Inspector",
    "title": "Size",
    "componentType": "slider",
    "summary": "Scales the background media inside its clip.",
    "whatItDoes": [
      "Writes the Size value to the selected background timeline clip as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Size value in the selected background timeline clip"
    ],
    "defaultValue": "100%",
    "recommendedRange": "10–300%"
  },
  {
    "id": "visualizer.timeline.backgroundClip.info.snapToBpm",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Background Clip Inspector",
    "title": "Snap to BPM",
    "componentType": "toggle",
    "summary": "Locks video playback timing to the timeline BPM.",
    "whatItDoes": [
      "Changes video playback timing relative to BPM.",
      "It does not move the clip’s timeline start."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Snap to BPM state in the selected background timeline clip"
    ],
    "doesNotAffect": [
      "clip position"
    ],
    "defaultValue": "Off for newly added background video clips",
    "tip": "Use Snap to BPM for rhythmic loops; leave it off for footage that should play at native speed."
  },
  {
    "id": "visualizer.timeline.backgroundClip.info.enableGlobalFx",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Background Clip Inspector",
    "title": "Enable Global FX",
    "componentType": "toggle",
    "summary": "Lets the background clip participate in global effects and audio reactivity.",
    "whatItDoes": [
      "Controls global effects and audio modulation participation.",
      "The clip still renders when this is off."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Enable Global FX state in the selected background timeline clip"
    ],
    "doesNotAffect": [
      "clip visibility"
    ],
    "defaultValue": "Off for background clips",
    "tip": "Leave background clips out of global FX when they should remain a stable visual bed."
  },
  {
    "id": "visualizer.timeline.backgroundClip.info.transitionIn",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Background Clip Inspector",
    "title": "Transition In",
    "componentType": "select",
    "summary": "Chooses the transition used when the background clip begins.",
    "whatItDoes": [
      "Stores the selected Transition In option in the selected background timeline clip.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Transition In selection in the selected background timeline clip"
    ]
  },
  {
    "id": "visualizer.timeline.backgroundClip.info.transitionInDuration",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Background Clip Inspector",
    "title": "Transition In Duration",
    "componentType": "numeric",
    "summary": "Sets the duration of the background clip’s entrance transition.",
    "whatItDoes": [
      "Writes a precise Transition In Duration value to the selected background timeline clip.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Transition In Duration value in the selected background timeline clip"
    ],
    "recommendedRange": "0 seconds or later"
  },
  {
    "id": "visualizer.timeline.backgroundClip.info.transitionInEasing",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Background Clip Inspector",
    "title": "Transition In Easing",
    "componentType": "select",
    "summary": "Chooses the timing curve of the entrance transition.",
    "whatItDoes": [
      "Stores the selected Transition In Easing option in the selected background timeline clip.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Transition In Easing selection in the selected background timeline clip"
    ]
  },
  {
    "id": "visualizer.timeline.backgroundClip.info.transitionOut",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Background Clip Inspector",
    "title": "Transition Out",
    "componentType": "select",
    "summary": "Chooses the transition used when the background clip ends.",
    "whatItDoes": [
      "Stores the selected Transition Out option in the selected background timeline clip.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Transition Out selection in the selected background timeline clip"
    ]
  },
  {
    "id": "visualizer.timeline.backgroundClip.info.transitionOutDuration",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Background Clip Inspector",
    "title": "Transition Out Duration",
    "componentType": "numeric",
    "summary": "Sets the duration of the background clip’s exit transition.",
    "whatItDoes": [
      "Writes a precise Transition Out Duration value to the selected background timeline clip.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Transition Out Duration value in the selected background timeline clip"
    ],
    "recommendedRange": "0 seconds or later"
  },
  {
    "id": "visualizer.timeline.backgroundClip.info.transitionOutEasing",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Background Clip Inspector",
    "title": "Transition Out Easing",
    "componentType": "select",
    "summary": "Chooses the timing curve of the exit transition.",
    "whatItDoes": [
      "Stores the selected Transition Out Easing option in the selected background timeline clip.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Transition Out Easing selection in the selected background timeline clip"
    ]
  },
  {
    "id": "visualizer.timeline.backgroundClip.color.overview",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Background Clip Inspector",
    "title": "Color",
    "componentType": "group",
    "summary": "Edits the selected background clip’s per-source color grade.",
    "whatItDoes": [
      "Groups the controls that configure the selected background timeline clip.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the selected background timeline clip.",
    "affects": [
      "clip timing",
      "media trim",
      "playback mode",
      "fit",
      "transitions",
      "color grade"
    ]
  },
  {
    "id": "visualizer.timeline.overlayClip.info.overview",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Info",
    "componentType": "group",
    "summary": "Edits the selected overlay clip’s role, timing, playback, fit, and global-FX participation.",
    "whatItDoes": [
      "Groups the controls that configure the selected overlay timeline clip.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the selected overlay timeline clip.",
    "affects": [
      "clip timing",
      "compositing transform",
      "opacity",
      "blend mode",
      "transitions",
      "color grade"
    ]
  },
  {
    "id": "visualizer.timeline.overlayClip.info.role",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Role",
    "componentType": "select",
    "summary": "Sets the Media Library role of the overlay clip’s source item.",
    "whatItDoes": [
      "Stores the selected Role option in the selected overlay timeline clip.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Role selection in the selected overlay timeline clip"
    ]
  },
  {
    "id": "visualizer.timeline.overlayClip.info.startSeconds",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Start (s)",
    "componentType": "numeric",
    "summary": "Sets where the overlay clip begins on the master timeline.",
    "whatItDoes": [
      "Writes a precise Start (s) value to the selected overlay timeline clip.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Start (s) value in the selected overlay timeline clip"
    ],
    "defaultValue": "0 seconds",
    "recommendedRange": "0 seconds or later"
  },
  {
    "id": "visualizer.timeline.overlayClip.info.durationSeconds",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Dur (s)",
    "componentType": "numeric",
    "summary": "Sets how long the overlay clip occupies the timeline.",
    "whatItDoes": [
      "Writes a precise Dur (s) value to the selected overlay timeline clip.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Dur (s) value in the selected overlay timeline clip"
    ],
    "defaultValue": "At least the minimum clip duration",
    "recommendedRange": "Minimum clip duration to 3600 seconds"
  },
  {
    "id": "visualizer.timeline.overlayClip.info.mode",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Mode",
    "componentType": "select",
    "summary": "Chooses trim, loop, or freeze playback for the overlay.",
    "whatItDoes": [
      "Stores the selected Mode option in the selected overlay timeline clip.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Mode selection in the selected overlay timeline clip"
    ],
    "defaultValue": "Trim"
  },
  {
    "id": "visualizer.timeline.overlayClip.info.fit",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Fit",
    "componentType": "select",
    "summary": "Chooses whether the overlay covers or fits inside its output bounds.",
    "whatItDoes": [
      "Stores the selected Fit option in the selected overlay timeline clip.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Fit selection in the selected overlay timeline clip"
    ],
    "defaultValue": "Contain"
  },
  {
    "id": "visualizer.timeline.overlayClip.info.snapToBpm",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Snap to BPM",
    "componentType": "toggle",
    "summary": "Locks overlay video playback timing to the timeline BPM.",
    "whatItDoes": [
      "Sets whether Snap to BPM participates in the selected overlay timeline clip.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Snap to BPM state in the selected overlay timeline clip"
    ],
    "defaultValue": "Off"
  },
  {
    "id": "visualizer.timeline.overlayClip.info.enableGlobalFx",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Enable Global FX",
    "componentType": "toggle",
    "summary": "Lets the overlay participate in global effects and audio reactivity.",
    "whatItDoes": [
      "Controls global effects and audio modulation participation.",
      "The overlay still renders when this is off."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Enable Global FX state in the selected overlay timeline clip"
    ],
    "doesNotAffect": [
      "overlay visibility"
    ],
    "defaultValue": "On for overlay clips",
    "tip": "Enable this for overlays that should pulse with the music; disable it for fixed logos or framing graphics."
  },
  {
    "id": "visualizer.timeline.overlayClip.compositing.overview",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Compositing",
    "componentType": "group",
    "summary": "Positions and blends the selected overlay clip over lower timeline lanes.",
    "whatItDoes": [
      "Groups the controls that configure the selected overlay timeline clip.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the selected overlay timeline clip.",
    "affects": [
      "clip timing",
      "compositing transform",
      "opacity",
      "blend mode",
      "transitions",
      "color grade"
    ]
  },
  {
    "id": "visualizer.timeline.overlayClip.compositing.x",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "X",
    "componentType": "numeric",
    "summary": "Sets the overlay’s horizontal position.",
    "whatItDoes": [
      "Writes a precise X value to the selected overlay timeline clip.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "X value in the selected overlay timeline clip"
    ],
    "defaultValue": "0.5",
    "recommendedRange": "Normalized canvas position"
  },
  {
    "id": "visualizer.timeline.overlayClip.compositing.y",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Y",
    "componentType": "numeric",
    "summary": "Sets the overlay’s vertical position.",
    "whatItDoes": [
      "Writes a precise Y value to the selected overlay timeline clip.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Y value in the selected overlay timeline clip"
    ],
    "defaultValue": "0.5",
    "recommendedRange": "Normalized canvas position"
  },
  {
    "id": "visualizer.timeline.overlayClip.compositing.scale",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Scale",
    "componentType": "numeric",
    "summary": "Sets the overlay’s scale.",
    "whatItDoes": [
      "Writes a precise Scale value to the selected overlay timeline clip.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Scale value in the selected overlay timeline clip"
    ],
    "defaultValue": "1",
    "recommendedRange": "Positive scale"
  },
  {
    "id": "visualizer.timeline.overlayClip.compositing.rotation",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Rotation",
    "componentType": "numeric",
    "summary": "Sets the overlay’s rotation.",
    "whatItDoes": [
      "Writes a precise Rotation value to the selected overlay timeline clip.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Rotation value in the selected overlay timeline clip"
    ],
    "defaultValue": "0°",
    "recommendedRange": "Degrees"
  },
  {
    "id": "visualizer.timeline.overlayClip.compositing.opacity",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Opacity",
    "componentType": "slider",
    "summary": "Sets the overlay’s opacity.",
    "whatItDoes": [
      "Writes the Opacity value to the selected overlay timeline clip as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Opacity value in the selected overlay timeline clip"
    ],
    "defaultValue": "100%",
    "recommendedRange": "0–100%",
    "tip": "Set Blend Mode before finalizing opacity."
  },
  {
    "id": "visualizer.timeline.overlayClip.compositing.blendMode",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Blend Mode",
    "componentType": "select",
    "summary": "Chooses how the overlay combines with the layers below it.",
    "whatItDoes": [
      "Stores the selected Blend Mode option in the selected overlay timeline clip.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Blend Mode selection in the selected overlay timeline clip"
    ]
  },
  {
    "id": "visualizer.timeline.overlayClip.compositing.transitionIn",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Transition In",
    "componentType": "select",
    "summary": "Chooses the transition used when the overlay begins.",
    "whatItDoes": [
      "Stores the selected Transition In option in the selected overlay timeline clip.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Transition In selection in the selected overlay timeline clip"
    ]
  },
  {
    "id": "visualizer.timeline.overlayClip.compositing.transitionInDuration",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Transition In Duration",
    "componentType": "numeric",
    "summary": "Sets the duration of the overlay’s entrance transition.",
    "whatItDoes": [
      "Writes a precise Transition In Duration value to the selected overlay timeline clip.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Transition In Duration value in the selected overlay timeline clip"
    ],
    "recommendedRange": "0 seconds or later"
  },
  {
    "id": "visualizer.timeline.overlayClip.compositing.transitionInEasing",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Transition In Easing",
    "componentType": "select",
    "summary": "Chooses the timing curve of the overlay’s entrance transition.",
    "whatItDoes": [
      "Stores the selected Transition In Easing option in the selected overlay timeline clip.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Transition In Easing selection in the selected overlay timeline clip"
    ]
  },
  {
    "id": "visualizer.timeline.overlayClip.compositing.transitionOut",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Transition Out",
    "componentType": "select",
    "summary": "Chooses the transition used when the overlay ends.",
    "whatItDoes": [
      "Stores the selected Transition Out option in the selected overlay timeline clip.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Transition Out selection in the selected overlay timeline clip"
    ]
  },
  {
    "id": "visualizer.timeline.overlayClip.compositing.transitionOutDuration",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Transition Out Duration",
    "componentType": "numeric",
    "summary": "Sets the duration of the overlay’s exit transition.",
    "whatItDoes": [
      "Writes a precise Transition Out Duration value to the selected overlay timeline clip.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Transition Out Duration value in the selected overlay timeline clip"
    ],
    "recommendedRange": "0 seconds or later"
  },
  {
    "id": "visualizer.timeline.overlayClip.compositing.transitionOutEasing",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Transition Out Easing",
    "componentType": "select",
    "summary": "Chooses the timing curve of the overlay’s exit transition.",
    "whatItDoes": [
      "Stores the selected Transition Out Easing option in the selected overlay timeline clip.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Transition Out Easing selection in the selected overlay timeline clip"
    ]
  },
  {
    "id": "visualizer.timeline.overlayClip.color.overview",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Color",
    "componentType": "group",
    "summary": "Edits the selected overlay clip’s per-source color grade.",
    "whatItDoes": [
      "Groups the controls that configure the selected overlay timeline clip.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the selected overlay timeline clip.",
    "affects": [
      "clip timing",
      "compositing transform",
      "opacity",
      "blend mode",
      "transitions",
      "color grade"
    ]
  },
  {
    "id": "visualizer.timeline.effectRegion.info.overview",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Effect Region Inspector",
    "title": "Info",
    "componentType": "group",
    "summary": "Edits the selected effect region’s effect, timing, intensity, and routing target.",
    "whatItDoes": [
      "Groups the controls that configure the selected timeline effect region.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the selected timeline effect region.",
    "affects": [
      "effect choice",
      "region timing",
      "intensity",
      "target routing",
      "color"
    ]
  },
  {
    "id": "visualizer.timeline.effectRegion.info.effect",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Effect Region Inspector",
    "title": "Effect",
    "componentType": "select",
    "summary": "Chooses the effect applied by the selected timeline region.",
    "whatItDoes": [
      "Stores the selected Effect option in the selected timeline effect region.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Effect selection in the selected timeline effect region"
    ]
  },
  {
    "id": "visualizer.timeline.effectRegion.info.enabled",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Effect Region Inspector",
    "title": "Enabled",
    "componentType": "toggle",
    "summary": "Enables or bypasses the selected effect region.",
    "whatItDoes": [
      "Sets whether Enabled participates in the selected timeline effect region.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Enabled state in the selected timeline effect region"
    ],
    "defaultValue": "On"
  },
  {
    "id": "visualizer.timeline.effectRegion.info.startSeconds",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Effect Region Inspector",
    "title": "Start",
    "componentType": "numeric",
    "summary": "Sets where the effect region begins.",
    "whatItDoes": [
      "Writes a precise Start value to the selected timeline effect region.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Start value in the selected timeline effect region"
    ],
    "defaultValue": "0 seconds",
    "recommendedRange": "0 seconds or later"
  },
  {
    "id": "visualizer.timeline.effectRegion.info.durationSeconds",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Effect Region Inspector",
    "title": "Dur (s)",
    "componentType": "numeric",
    "summary": "Sets how long the effect region remains active.",
    "whatItDoes": [
      "Writes a precise Dur (s) value to the selected timeline effect region.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Dur (s) value in the selected timeline effect region"
    ],
    "recommendedRange": "Positive duration"
  },
  {
    "id": "visualizer.timeline.effectRegion.info.intensity",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Effect Region Inspector",
    "title": "Intensity",
    "componentType": "numeric",
    "summary": "Sets the effect region’s authored strength.",
    "whatItDoes": [
      "Writes a precise Intensity value to the selected timeline effect region.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Intensity value in the selected timeline effect region"
    ],
    "defaultValue": "1",
    "recommendedRange": "Numeric effect strength"
  },
  {
    "id": "visualizer.timeline.effectRegion.info.target",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Effect Region Inspector",
    "title": "Target",
    "componentType": "select",
    "summary": "Chooses the routing scope affected by the effect region.",
    "whatItDoes": [
      "Determines whether routing is global, layer, item, or clip scoped.",
      "Narrow target selectors apply only to matching scopes."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Target selection in the selected timeline effect region"
    ],
    "tip": "Choose Target first; the Layer, Item, and Clip selectors become meaningful only for matching scopes."
  },
  {
    "id": "visualizer.timeline.effectRegion.info.layer",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Effect Region Inspector",
    "title": "Layer",
    "componentType": "select",
    "summary": "Chooses the target layer when the region is layer-scoped.",
    "whatItDoes": [
      "Stores the selected Layer option in the selected timeline effect region.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Layer selection in the selected timeline effect region"
    ]
  },
  {
    "id": "visualizer.timeline.effectRegion.info.item",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Effect Region Inspector",
    "title": "Item",
    "componentType": "select",
    "summary": "Chooses the target layer item when the region is item-scoped.",
    "whatItDoes": [
      "Stores the selected Item option in the selected timeline effect region.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Item selection in the selected timeline effect region"
    ]
  },
  {
    "id": "visualizer.timeline.effectRegion.info.clip",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Effect Region Inspector",
    "title": "Clip",
    "componentType": "select",
    "summary": "Chooses the target timeline clip when the region is clip-scoped.",
    "whatItDoes": [
      "Stores the selected Clip option in the selected timeline effect region.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Clip selection in the selected timeline effect region"
    ]
  },
  {
    "id": "visualizer.timeline.effectRegion.color.overview",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Effect Region Inspector",
    "title": "Color",
    "componentType": "group",
    "summary": "Contains color-related settings for the selected effect region when supported.",
    "whatItDoes": [
      "Groups the controls that configure the selected timeline effect region.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the selected timeline effect region.",
    "affects": [
      "effect choice",
      "region timing",
      "intensity",
      "target routing",
      "color"
    ]
  },
  {
    "id": "visualizer.timeline.overview",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Master and transport concepts",
    "title": "Timeline",
    "componentType": "group",
    "summary": "Coordinates synchronized audio, media, lyric, and effect lanes around one playhead.",
    "whatItDoes": [
      "The audio lane anchors time while other lanes schedule visual content.",
      "Loop and zoom change transport behavior and editing scale."
    ],
    "whenToUse": "Use this section when configuring the Visualizer master timeline.",
    "affects": [
      "timeline looping",
      "zoom",
      "audio, media, lyric, and effect lanes",
      "master dimmer"
    ],
    "relatedHelpIds": [
      "visualizer.timeline.audioLane",
      "visualizer.timeline.backgroundLane",
      "visualizer.timeline.overlaysLane",
      "visualizer.timeline.lyricsLane",
      "visualizer.timeline.effectsLane"
    ]
  },
  {
    "id": "visualizer.timeline.loop",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Master and transport concepts",
    "title": "Loop",
    "componentType": "toggle",
    "summary": "Repeats timeline playback inside the active timeline duration.",
    "whatItDoes": [
      "Loops transport playback.",
      "It does not duplicate timeline content."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Loop state in the Visualizer master timeline"
    ],
    "doesNotAffect": [
      "timeline content"
    ],
    "defaultValue": "Defined by timeline state"
  },
  {
    "id": "visualizer.timeline.zoom",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Master and transport concepts",
    "title": "Timeline Zoom",
    "componentType": "slider",
    "summary": "Changes the horizontal editing scale of the timeline.",
    "whatItDoes": [
      "Current code uses zoom-in and zoom-out buttons with a percentage readout.",
      "Timeline timing and clip durations are unchanged."
    ],
    "whenToUse": "Use the zoom buttons to change timeline scale while trimming or aligning clips.",
    "affects": [
      "timeline horizontal scale"
    ],
    "doesNotAffect": [
      "clip timing or duration"
    ],
    "defaultValue": "100%",
    "recommendedRange": "25–800%",
    "tip": "Zoom in for precise trims and cue alignment; zoom out to review the full arrangement.",
    "tags": [
      "auditMismatch"
    ]
  },
  {
    "id": "visualizer.timeline.audioLane",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Master and transport concepts",
    "title": "Audio Lane",
    "componentType": "group",
    "summary": "Displays the loaded audio track and waveform that anchor timeline timing.",
    "whatItDoes": [
      "Groups the controls that configure the Visualizer master timeline.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the Visualizer master timeline.",
    "affects": [
      "timeline looping",
      "zoom",
      "audio, media, lyric, and effect lanes",
      "master dimmer"
    ]
  },
  {
    "id": "visualizer.timeline.backgroundLane",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Master and transport concepts",
    "title": "Background Lane",
    "componentType": "group",
    "summary": "Holds full-frame video and background clips.",
    "whatItDoes": [
      "Groups the controls that configure the Visualizer master timeline.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the Visualizer master timeline.",
    "affects": [
      "timeline looping",
      "zoom",
      "audio, media, lyric, and effect lanes",
      "master dimmer"
    ]
  },
  {
    "id": "visualizer.timeline.overlaysLane",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Master and transport concepts",
    "title": "Overlays Lane",
    "componentType": "group",
    "summary": "Holds composited media rendered above the background lane.",
    "whatItDoes": [
      "Groups the controls that configure the Visualizer master timeline.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the Visualizer master timeline.",
    "affects": [
      "timeline looping",
      "zoom",
      "audio, media, lyric, and effect lanes",
      "master dimmer"
    ]
  },
  {
    "id": "visualizer.timeline.lyricsLane",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Master and transport concepts",
    "title": "Lyrics Lane",
    "componentType": "group",
    "summary": "Displays lyric cues on the shared timeline.",
    "whatItDoes": [
      "Groups the controls that configure the Visualizer master timeline.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the Visualizer master timeline.",
    "affects": [
      "timeline looping",
      "zoom",
      "audio, media, lyric, and effect lanes",
      "master dimmer"
    ]
  },
  {
    "id": "visualizer.timeline.effectsLane",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Master and transport concepts",
    "title": "Effects Lane",
    "componentType": "group",
    "summary": "Holds time-bounded effect regions.",
    "whatItDoes": [
      "Groups the controls that configure the Visualizer master timeline.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the Visualizer master timeline.",
    "affects": [
      "timeline looping",
      "zoom",
      "audio, media, lyric, and effect lanes",
      "master dimmer"
    ]
  },
  {
    "id": "visualizer.timeline.masterColor",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Master and transport concepts",
    "title": "Master Color",
    "componentType": "group",
    "summary": "Contains the timeline’s overall color output control.",
    "whatItDoes": [
      "Groups the controls that configure the Visualizer master timeline.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the Visualizer master timeline.",
    "affects": [
      "timeline looping",
      "zoom",
      "audio, media, lyric, and effect lanes",
      "master dimmer"
    ]
  },
  {
    "id": "visualizer.timeline.masterDimmer",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Master and transport concepts",
    "title": "Master Dimmer",
    "componentType": "slider",
    "summary": "Scales the final timeline output brightness.",
    "whatItDoes": [
      "Writes the Master Dimmer value to the Visualizer master timeline as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Master Dimmer value in the Visualizer master timeline"
    ],
    "defaultValue": "100%",
    "recommendedRange": "0–100%"
  },
  {
    "id": "visualizer.recording.record.overview",
    "priority": 1,
    "view": "visualizer",
    "group": "Recording",
    "title": "Record",
    "componentType": "group",
    "summary": "Records clean canvas output at the selected frame rate.",
    "whatItDoes": [
      "Captures the clean visual canvas, not application panels.",
      "Audio is included only when an active program-audio stream is available."
    ],
    "whenToUse": "Use this section when configuring the Visualizer recording and frame-export workflow.",
    "affects": [
      "recording frame rate",
      "program-audio availability",
      "clean canvas export"
    ]
  },
  {
    "id": "visualizer.recording.record.targetFps",
    "priority": 1,
    "view": "visualizer",
    "group": "Recording",
    "title": "Target FPS",
    "componentType": "selection",
    "summary": "Chooses 30 or 60 frames per second for recording.",
    "whatItDoes": [
      "Chooses the active Target FPS option for the Visualizer recording and frame-export workflow.",
      "The selected item becomes the current value for this context."
    ],
    "whenToUse": "Use it when choosing the active option for this part of the workflow.",
    "affects": [
      "Target FPS selection in the Visualizer recording and frame-export workflow"
    ],
    "defaultValue": "30 or 60 FPS",
    "tip": "Choose 30 FPS for lighter capture load and 60 FPS for fast motion when the live frame rate can sustain it."
  },
  {
    "id": "visualizer.recording.record.audioAvailability",
    "priority": 1,
    "view": "visualizer",
    "group": "Recording",
    "title": "Audio",
    "componentType": "toggle",
    "summary": "Reports whether program audio is available to the recorder.",
    "whatItDoes": [
      "The panel derives this status from the connected audio graph.",
      "It is not a user-settable toggle in the current code."
    ],
    "whenToUse": "Use this status to confirm audio is available before starting a recording.",
    "affects": [
      "recording audio availability status"
    ],
    "doesNotAffect": [
      "audio routing"
    ],
    "tip": "Start playback before recording when audio should be included.",
    "tags": [
      "auditMismatch"
    ]
  },
  {
    "id": "visualizer.recording.export.overview",
    "priority": 1,
    "view": "visualizer",
    "group": "Recording",
    "title": "Export",
    "componentType": "group",
    "summary": "Exports the current clean visual frame without editor chrome.",
    "whatItDoes": [
      "Groups the controls that configure the Visualizer recording and frame-export workflow.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the Visualizer recording and frame-export workflow.",
    "affects": [
      "recording frame rate",
      "program-audio availability",
      "clean canvas export"
    ]
  },
  {
    "id": "visualizer.savePreset.presetName",
    "priority": 1,
    "view": "visualizer",
    "group": "Save Preset",
    "title": "Preset Name",
    "componentType": "field",
    "summary": "Sets the name used for the saved preset.",
    "whatItDoes": [
      "Writes the edited Preset Name data to the preset snapshot being saved.",
      "The value remains owned by the current item or document."
    ],
    "whenToUse": "Edit it when the current label, text, or metadata no longer describes the item accurately.",
    "affects": [
      "Preset Name data in the preset snapshot being saved"
    ],
    "defaultValue": "Empty"
  },
  {
    "id": "visualizer.savePreset.scope",
    "priority": 1,
    "view": "visualizer",
    "group": "Save Preset",
    "title": "Look / Scene Scope",
    "componentType": "selection",
    "summary": "Chooses a Look-oriented or Scene-oriented preset scope.",
    "whatItDoes": [
      "Look selects effect-oriented fields; Scene adds media and playback state.",
      "Individual checkboxes can refine either scope."
    ],
    "whenToUse": "Use it when choosing the active option for this part of the workflow.",
    "affects": [
      "Look / Scene Scope selection in the preset snapshot being saved"
    ],
    "doesNotAffect": [
      "saved preset name"
    ],
    "defaultValue": "Look",
    "tip": "Start with Look or Scene, then remove fields the preset should not own.",
    "relatedHelpIds": [
      "visualizer.savePreset.visual.overview",
      "visualizer.savePreset.scene.overview"
    ]
  },
  {
    "id": "visualizer.savePreset.visual.overview",
    "priority": 1,
    "view": "visualizer",
    "group": "Save Preset",
    "title": "Visual",
    "componentType": "group",
    "summary": "Chooses which effect and modulation settings are included in a saved preset.",
    "whatItDoes": [
      "Groups the controls that configure the preset snapshot being saved.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the preset snapshot being saved.",
    "affects": [
      "saved visual look",
      "scene media and playback settings"
    ]
  },
  {
    "id": "visualizer.savePreset.visual.effects",
    "priority": 1,
    "view": "visualizer",
    "group": "Save Preset",
    "title": "Effects",
    "componentType": "toggle",
    "summary": "Includes Visualizer effect values in the saved preset.",
    "whatItDoes": [
      "Sets whether Effects participates in the preset snapshot being saved.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Effects state in the preset snapshot being saved"
    ],
    "defaultValue": "On in Look scope"
  },
  {
    "id": "visualizer.savePreset.visual.fxChain",
    "priority": 1,
    "view": "visualizer",
    "group": "Save Preset",
    "title": "FX Chain",
    "componentType": "toggle",
    "summary": "Includes the enabled effect-chain membership in the saved preset.",
    "whatItDoes": [
      "Sets whether FX Chain participates in the preset snapshot being saved.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "FX Chain state in the preset snapshot being saved"
    ],
    "defaultValue": "On in Look scope"
  },
  {
    "id": "visualizer.savePreset.visual.modulation",
    "priority": 1,
    "view": "visualizer",
    "group": "Save Preset",
    "title": "Modulation",
    "componentType": "toggle",
    "summary": "Includes modulation routes and settings in the saved preset.",
    "whatItDoes": [
      "Sets whether Modulation participates in the preset snapshot being saved.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Modulation state in the preset snapshot being saved"
    ],
    "defaultValue": "On in Look scope"
  },
  {
    "id": "visualizer.savePreset.scene.overview",
    "priority": 1,
    "view": "visualizer",
    "group": "Save Preset",
    "title": "Scene",
    "componentType": "group",
    "summary": "Chooses which media, audio, BPM, sync, and quality settings are included in a scene preset.",
    "whatItDoes": [
      "Groups the controls that configure the preset snapshot being saved.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the preset snapshot being saved.",
    "affects": [
      "saved visual look",
      "scene media and playback settings"
    ]
  },
  {
    "id": "visualizer.savePreset.scene.activeMedia",
    "priority": 1,
    "view": "visualizer",
    "group": "Save Preset",
    "title": "Active Media",
    "componentType": "toggle",
    "summary": "Includes the active media selection in the saved scene.",
    "whatItDoes": [
      "Sets whether Active Media participates in the preset snapshot being saved.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Active Media state in the preset snapshot being saved"
    ],
    "defaultValue": "On in Scene scope"
  },
  {
    "id": "visualizer.savePreset.scene.mediaOrder",
    "priority": 1,
    "view": "visualizer",
    "group": "Save Preset",
    "title": "Media Order",
    "componentType": "toggle",
    "summary": "Includes media ordering in the saved scene.",
    "whatItDoes": [
      "Sets whether Media Order participates in the preset snapshot being saved.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Media Order state in the preset snapshot being saved"
    ],
    "defaultValue": "On in Scene scope"
  },
  {
    "id": "visualizer.savePreset.scene.audioSource",
    "priority": 1,
    "view": "visualizer",
    "group": "Save Preset",
    "title": "Audio Source",
    "componentType": "toggle",
    "summary": "Includes the current audio source in the saved scene.",
    "whatItDoes": [
      "Sets whether Audio Source participates in the preset snapshot being saved.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Audio Source state in the preset snapshot being saved"
    ],
    "defaultValue": "On in Scene scope"
  },
  {
    "id": "visualizer.savePreset.scene.bpm",
    "priority": 1,
    "view": "visualizer",
    "group": "Save Preset",
    "title": "BPM",
    "componentType": "toggle",
    "summary": "Includes the effective BPM in the saved scene.",
    "whatItDoes": [
      "Sets whether BPM participates in the preset snapshot being saved.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "BPM state in the preset snapshot being saved"
    ],
    "defaultValue": "On in Scene scope"
  },
  {
    "id": "visualizer.savePreset.scene.bpmSync",
    "priority": 1,
    "view": "visualizer",
    "group": "Save Preset",
    "title": "BPM Sync",
    "componentType": "toggle",
    "summary": "Includes BPM Sync state in the saved scene.",
    "whatItDoes": [
      "Sets whether BPM Sync participates in the preset snapshot being saved.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "BPM Sync state in the preset snapshot being saved"
    ],
    "defaultValue": "On in Scene scope"
  },
  {
    "id": "visualizer.savePreset.scene.quality",
    "priority": 1,
    "view": "visualizer",
    "group": "Save Preset",
    "title": "Quality",
    "componentType": "toggle",
    "summary": "Includes rendering quality in the saved scene.",
    "whatItDoes": [
      "Sets whether Quality participates in the preset snapshot being saved.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Quality state in the preset snapshot being saved"
    ],
    "defaultValue": "On in Scene scope"
  },
  {
    "id": "visualizer.audioDeck.trackVolume",
    "priority": 1,
    "view": "visualizer",
    "group": "Audio Deck",
    "title": "Track Volume",
    "componentType": "slider",
    "summary": "Sets the loaded track’s playback level.",
    "whatItDoes": [
      "Writes the Track Volume value to the shared audio deck as the control moves.",
      "The implemented minimum, maximum, and step constrain the value."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Track Volume value in the shared audio deck"
    ],
    "recommendedRange": "0–100%",
    "tip": "Leave headroom when effects or recording can add gain later in the output chain."
  },
  {
    "id": "visualizer.audioDeck.bpm",
    "priority": 1,
    "view": "visualizer",
    "group": "Audio Deck",
    "title": "BPM",
    "componentType": "numeric",
    "summary": "Shows or overrides the effective track tempo used by timing systems.",
    "whatItDoes": [
      "A manual override remains separate from the analyzed BPM and can be reset.",
      "Timing systems use the effective BPM."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "BPM value in the shared audio deck"
    ],
    "doesNotAffect": [
      "analyzed BPM"
    ],
    "defaultValue": "Analyzed BPM when available",
    "recommendedRange": "40–300 BPM",
    "tip": "Reset the override after correcting analysis if the manual tempo is no longer needed.",
    "relatedHelpIds": [
      "visualizer.audioDeck.bpmSync"
    ]
  },
  {
    "id": "visualizer.audioDeck.rekordboxAction",
    "priority": 1,
    "view": "visualizer",
    "group": "Audio Deck",
    "title": "Rekordbox Action",
    "componentType": "select",
    "summary": "Imports Rekordbox XML, scans a Rekordbox USB source, or arms USB Mode.",
    "whatItDoes": [
      "XML/native matches can import cue metadata.",
      "USB Mode alone does not import cues without a metadata match."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Rekordbox Action selection in the shared audio deck"
    ],
    "doesNotAffect": [
      "audio files"
    ],
    "tip": "Use XML or a native USB match when Rekordbox cues are required."
  },
  {
    "id": "visualizer.audioDeck.bpmSync",
    "priority": 1,
    "view": "visualizer",
    "group": "Audio Deck",
    "title": "Sync / BPM Sync",
    "componentType": "toggle",
    "summary": "Enables or disables BPM-synchronized playback behavior.",
    "whatItDoes": [
      "Sets whether Sync / BPM Sync participates in the shared audio deck.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Sync / BPM Sync state in the shared audio deck"
    ],
    "defaultValue": "Off unless enabled",
    "relatedHelpIds": [
      "visualizer.audioDeck.bpm"
    ]
  },
  {
    "id": "lyricManager.aiExtraction.source.storedTrack.overview",
    "priority": 1,
    "view": "lyricManager",
    "group": "AI Extraction — Source",
    "title": "Stored Track",
    "componentType": "group",
    "summary": "Identifies the saved full-mix track that will own the resulting lyric document.",
    "whatItDoes": [
      "Groups the controls that configure the lyric extraction source.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the lyric extraction source.",
    "affects": [
      "stored-track ownership",
      "full-mix or vocal-reference input",
      "reference alignment"
    ]
  },
  {
    "id": "lyricManager.aiExtraction.source.extractionSource.overview",
    "priority": 1,
    "view": "lyricManager",
    "group": "AI Extraction — Source",
    "title": "Extraction Source",
    "componentType": "group",
    "summary": "Chooses whether transcription uses the full mix or a separately saved vocal reference.",
    "whatItDoes": [
      "Full Mix transcribes the stored track itself.",
      "Vocal Reference transcribes another saved audio track and shifts timestamps onto the full-mix timeline."
    ],
    "whenToUse": "Use this section when configuring the lyric extraction source.",
    "affects": [
      "stored-track ownership",
      "full-mix or vocal-reference input",
      "reference alignment"
    ]
  },
  {
    "id": "lyricManager.aiExtraction.source.extractionSource.sourceMode",
    "priority": 1,
    "view": "lyricManager",
    "group": "AI Extraction — Source",
    "title": "Source Mode",
    "componentType": "select",
    "summary": "Chooses whether lyric extraction uses the stored full mix or a saved vocal reference.",
    "whatItDoes": [
      "The resulting lyric document always belongs to the stored full mix.",
      "Only the transcription source changes."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Source Mode selection in the lyric extraction source"
    ],
    "doesNotAffect": [
      "lyric document ownership"
    ],
    "defaultValue": "Full Mix",
    "relatedHelpIds": [
      "lyricManager.aiExtraction.source.extractionSource.savedVocalTrack",
      "lyricManager.aiExtraction.source.extractionSource.vocalReferenceOffsetSeconds",
      "lyricManager.aiExtraction.source.extractionSource.arrangementConfirmation"
    ]
  },
  {
    "id": "lyricManager.aiExtraction.source.extractionSource.savedVocalTrack",
    "priority": 1,
    "view": "lyricManager",
    "group": "AI Extraction — Source",
    "title": "Saved Vocal Track",
    "componentType": "select",
    "summary": "Selects the saved audio track used as the vocal-reference transcription source.",
    "whatItDoes": [
      "Stores the selected Saved Vocal Track option in the lyric extraction source.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Saved Vocal Track selection in the lyric extraction source"
    ],
    "relatedHelpIds": [
      "lyricManager.aiExtraction.source.extractionSource.sourceMode",
      "lyricManager.aiExtraction.source.extractionSource.vocalReferenceOffsetSeconds"
    ]
  },
  {
    "id": "lyricManager.aiExtraction.source.extractionSource.vocalReferenceOffsetSeconds",
    "priority": 1,
    "view": "lyricManager",
    "group": "AI Extraction — Source",
    "title": "Vocal Reference Offset (Seconds)",
    "componentType": "numeric",
    "summary": "Aligns vocal-reference timestamps to the stored full-mix timeline.",
    "whatItDoes": [
      "Positive values mean the vocal starts later on the full-mix timeline.",
      "The offset is applied once to provider timestamps."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Vocal Reference Offset (Seconds) value in the lyric extraction source"
    ],
    "doesNotAffect": [
      "source audio"
    ],
    "defaultValue": "0 seconds",
    "recommendedRange": "Any finite offset; 0.05-second steps",
    "tip": "Use waveform landmarks to verify the offset before starting extraction."
  },
  {
    "id": "lyricManager.aiExtraction.source.extractionSource.addVocalTrack",
    "priority": 1,
    "view": "lyricManager",
    "group": "AI Extraction — Source",
    "title": "Add Vocal Track",
    "componentType": "selection",
    "summary": "Opens User Media so a vocal-reference track can be saved and selected.",
    "whatItDoes": [
      "Chooses the active Add Vocal Track option for the lyric extraction source.",
      "The selected item becomes the current value for this context."
    ],
    "whenToUse": "Use it when choosing the active option for this part of the workflow.",
    "affects": [
      "Add Vocal Track selection in the lyric extraction source"
    ]
  },
  {
    "id": "lyricManager.aiExtraction.source.extractionSource.arrangementConfirmation",
    "priority": 1,
    "view": "lyricManager",
    "group": "AI Extraction — Source",
    "title": "I reviewed the arrangement and confirm this vocal reference belongs to the selected full mix",
    "componentType": "toggle",
    "summary": "Confirms that a significantly different vocal reference belongs to the selected full mix.",
    "whatItDoes": [
      "Required only when compatibility checks report a significant mismatch.",
      "It does not bypass a blocked or invalid source."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "I reviewed the arrangement and confirm this vocal reference belongs to the selected full mix state in the lyric extraction source"
    ]
  },
  {
    "id": "lyricManager.aiExtraction.settings.extractionSettings.overview",
    "priority": 1,
    "view": "lyricManager",
    "group": "AI Extraction — Settings",
    "title": "Extraction Settings",
    "componentType": "group",
    "summary": "Configures transcription language, timing detail, cue style, and timing offset.",
    "whatItDoes": [
      "Groups the controls that configure the lyric extraction request.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the lyric extraction request.",
    "affects": [
      "language",
      "timing granularity",
      "cue formatting",
      "global timing offset",
      "review summaries"
    ]
  },
  {
    "id": "lyricManager.aiExtraction.settings.extractionSettings.language",
    "priority": 1,
    "view": "lyricManager",
    "group": "AI Extraction — Settings",
    "title": "Language",
    "componentType": "select",
    "summary": "Chooses the transcription language or automatic language detection.",
    "whatItDoes": [
      "Stores the selected Language option in the lyric extraction request.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Language selection in the lyric extraction request"
    ],
    "defaultValue": "Auto-detect"
  },
  {
    "id": "lyricManager.aiExtraction.settings.extractionSettings.timingDetail",
    "priority": 1,
    "view": "lyricManager",
    "group": "AI Extraction — Settings",
    "title": "Timing Detail",
    "componentType": "select",
    "summary": "Chooses the timing granularity requested from lyric extraction.",
    "whatItDoes": [
      "Stores the selected Timing Detail option in the lyric extraction request.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Timing Detail selection in the lyric extraction request"
    ],
    "tip": "Request word-level timing only when the workflow needs word-synchronized animation or editing."
  },
  {
    "id": "lyricManager.aiExtraction.settings.extractionSettings.cueStyle",
    "priority": 1,
    "view": "lyricManager",
    "group": "AI Extraction — Settings",
    "title": "Cue Style",
    "componentType": "select",
    "summary": "Chooses how extracted text is grouped into lyric cues.",
    "whatItDoes": [
      "Stores the selected Cue Style option in the lyric extraction request.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Cue Style selection in the lyric extraction request"
    ],
    "defaultValue": "Balanced",
    "tip": "Choose cue style for delivery and phrase grouping, not as a substitute for timing review."
  },
  {
    "id": "lyricManager.aiExtraction.settings.extractionSettings.globalOffsetMs",
    "priority": 1,
    "view": "lyricManager",
    "group": "AI Extraction — Settings",
    "title": "Global Offset ms",
    "componentType": "numeric",
    "summary": "Applies a global millisecond shift to the extracted cue timing.",
    "whatItDoes": [
      "Shifts extraction timing.",
      "Canonical manual cue and word timestamps remain integer milliseconds after editing."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Global Offset ms value in the lyric extraction request"
    ],
    "doesNotAffect": [
      "source audio"
    ],
    "defaultValue": "0 ms",
    "recommendedRange": "Integer milliseconds",
    "tip": "Use Global Offset for a consistent timing shift; edit individual cues for local errors."
  },
  {
    "id": "lyricManager.aiExtraction.settings.alignmentSummary.overview",
    "priority": 1,
    "view": "lyricManager",
    "group": "AI Extraction — Settings",
    "title": "Alignment Summary",
    "componentType": "group",
    "summary": "Summarizes how a vocal reference will be aligned to the full-mix timeline.",
    "whatItDoes": [
      "Groups the controls that configure the lyric extraction request.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the lyric extraction request.",
    "affects": [
      "language",
      "timing granularity",
      "cue formatting",
      "global timing offset",
      "review summaries"
    ]
  },
  {
    "id": "lyricManager.aiExtraction.settings.reviewSummary.overview",
    "priority": 1,
    "view": "lyricManager",
    "group": "AI Extraction — Settings",
    "title": "Review Summary",
    "componentType": "group",
    "summary": "Summarizes the extraction result and the cues that need review.",
    "whatItDoes": [
      "Groups the controls that configure the lyric extraction request.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the lyric extraction request.",
    "affects": [
      "language",
      "timing granularity",
      "cue formatting",
      "global timing offset",
      "review summaries"
    ]
  },
  {
    "id": "lyricManager.manualEditor.title",
    "priority": 1,
    "view": "lyricManager",
    "group": "Manual Editor — Document Info",
    "title": "Title",
    "componentType": "field",
    "summary": "Sets the lyric document’s song title.",
    "whatItDoes": [
      "Writes the edited Title data to the lyric document.",
      "The value remains owned by the current item or document."
    ],
    "whenToUse": "Edit it when the current label, text, or metadata no longer describes the item accurately.",
    "affects": [
      "Title data in the lyric document"
    ]
  },
  {
    "id": "lyricManager.manualEditor.artist",
    "priority": 1,
    "view": "lyricManager",
    "group": "Manual Editor — Document Info",
    "title": "Artist",
    "componentType": "field",
    "summary": "Sets the lyric document’s artist name.",
    "whatItDoes": [
      "Writes the edited Artist data to the lyric document.",
      "The value remains owned by the current item or document."
    ],
    "whenToUse": "Edit it when the current label, text, or metadata no longer describes the item accurately.",
    "affects": [
      "Artist data in the lyric document"
    ]
  },
  {
    "id": "lyricManager.manualEditor.cueTimeline",
    "priority": 1,
    "view": "lyricManager",
    "group": "Manual Editor — Document Info",
    "title": "Cue Timeline",
    "componentType": "group",
    "summary": "Provides the shared waveform and cue-editing surface for the lyric document.",
    "whatItDoes": [
      "Groups the controls that configure the lyric document.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the lyric document.",
    "affects": [
      "document identity",
      "cue timeline"
    ]
  },
  {
    "id": "lyricManager.presentation.effects",
    "priority": 1,
    "view": "lyricManager",
    "group": "Presentation — Animation and Effects",
    "title": "Effects",
    "componentType": "group",
    "summary": "Chooses a lyric effect recipe at the document or cue level.",
    "whatItDoes": [
      "Groups the controls that configure lyric presentation effects.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring lyric presentation effects.",
    "affects": [
      "document or cue effect preset"
    ]
  },
  {
    "id": "lyricManager.cueEditor.toolbar.snap",
    "priority": 1,
    "view": "lyricManager",
    "group": "Cue Editor Toolbar and Filters",
    "title": "Snap",
    "componentType": "select",
    "summary": "Chooses how cue edits snap to timing references.",
    "whatItDoes": [
      "Stores the selected Snap option in the lyric cue editor timeline.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Snap selection in the lyric cue editor timeline"
    ],
    "defaultValue": "None",
    "tip": "Use beat or grid snapping for musical alignment and None for exact spoken timing."
  },
  {
    "id": "lyricManager.cueEditor.toolbar.waveformZoom",
    "priority": 1,
    "view": "lyricManager",
    "group": "Cue Editor Toolbar and Filters",
    "title": "Shared Waveform Zoom",
    "componentType": "slider",
    "summary": "Changes the horizontal scale of the shared lyric waveform.",
    "whatItDoes": [
      "The same zoom value is shared by waveform-based cue editing.",
      "Cue timestamps do not change."
    ],
    "whenToUse": "Adjust it while previewing the result, then stop when the response remains readable at performance scale.",
    "affects": [
      "Shared Waveform Zoom value in the lyric cue editor timeline"
    ],
    "doesNotAffect": [
      "cue timestamps"
    ],
    "defaultValue": "1×",
    "recommendedRange": "1×–16×",
    "tip": "Zoom in before editing short words or tightly packed cues."
  },
  {
    "id": "lyricManager.cueEditor.overlays.overview",
    "priority": 1,
    "view": "lyricManager",
    "group": "Cue Editor Toolbar and Filters",
    "title": "Overlays",
    "componentType": "group",
    "summary": "Shows or hides analysis layers over the lyric waveform without changing cue data.",
    "whatItDoes": [
      "Overlay visibility is editor-only.",
      "Analysis and cue data remain stored."
    ],
    "whenToUse": "Use this section when configuring the lyric cue editor timeline.",
    "affects": [
      "snap behavior",
      "waveform zoom",
      "analysis overlays",
      "cue-list filtering"
    ]
  },
  {
    "id": "lyricManager.cueEditor.overlays.beatGrid",
    "priority": 1,
    "view": "lyricManager",
    "group": "Cue Editor Toolbar and Filters",
    "title": "Beat Grid Overlay",
    "componentType": "toggle",
    "summary": "Shows or hides beat-grid lines over the lyric waveform.",
    "whatItDoes": [
      "Sets whether Beat Grid Overlay participates in the lyric cue editor timeline.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Beat Grid Overlay state in the lyric cue editor timeline"
    ],
    "doesNotAffect": [
      "beat analysis"
    ],
    "defaultValue": "Defined by overlay defaults"
  },
  {
    "id": "lyricManager.cueEditor.overlays.sections",
    "priority": 1,
    "view": "lyricManager",
    "group": "Cue Editor Toolbar and Filters",
    "title": "Sections Overlay",
    "componentType": "toggle",
    "summary": "Shows or hides track-section regions over the lyric waveform.",
    "whatItDoes": [
      "Sets whether Sections Overlay participates in the lyric cue editor timeline.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Sections Overlay state in the lyric cue editor timeline"
    ],
    "doesNotAffect": [
      "section analysis"
    ],
    "defaultValue": "Defined by overlay defaults"
  },
  {
    "id": "lyricManager.cueEditor.overlays.words",
    "priority": 1,
    "view": "lyricManager",
    "group": "Cue Editor Toolbar and Filters",
    "title": "Words Overlay",
    "componentType": "toggle",
    "summary": "Shows or hides word-timing regions over the lyric waveform.",
    "whatItDoes": [
      "Sets whether Words Overlay participates in the lyric cue editor timeline.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Words Overlay state in the lyric cue editor timeline"
    ],
    "doesNotAffect": [
      "word timing data"
    ],
    "defaultValue": "Defined by overlay defaults"
  },
  {
    "id": "lyricManager.cueEditor.overlays.energy",
    "priority": 1,
    "view": "lyricManager",
    "group": "Cue Editor Toolbar and Filters",
    "title": "Energy Overlay",
    "componentType": "toggle",
    "summary": "Shows or hides the analyzed energy curve over the lyric waveform.",
    "whatItDoes": [
      "Sets whether Energy Overlay participates in the lyric cue editor timeline.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Energy Overlay state in the lyric cue editor timeline"
    ],
    "doesNotAffect": [
      "energy analysis"
    ],
    "defaultValue": "Defined by overlay defaults"
  },
  {
    "id": "lyricManager.cueEditor.overlays.cuePoints",
    "priority": 1,
    "view": "lyricManager",
    "group": "Cue Editor Toolbar and Filters",
    "title": "Cue Points Overlay",
    "componentType": "toggle",
    "summary": "Shows or hides cue-point markers over the lyric waveform.",
    "whatItDoes": [
      "Sets whether Cue Points Overlay participates in the lyric cue editor timeline.",
      "The owning renderer, editor, or runtime reads the enabled state on its next update."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Cue Points Overlay state in the lyric cue editor timeline"
    ],
    "doesNotAffect": [
      "cue-point data"
    ],
    "defaultValue": "Defined by overlay defaults"
  },
  {
    "id": "lyricManager.cueEditor.filters.filter",
    "priority": 1,
    "view": "lyricManager",
    "group": "Cue Editor Toolbar and Filters",
    "title": "Filter",
    "componentType": "select",
    "summary": "Filters the cue list by review, confidence, warning, or text status.",
    "whatItDoes": [
      "Stores the selected Filter option in the lyric cue editor timeline.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Filter selection in the lyric cue editor timeline"
    ],
    "doesNotAffect": [
      "cue data"
    ],
    "defaultValue": "All",
    "tip": "Use Warnings or Low Confidence to focus the review pass."
  },
  {
    "id": "lyricManager.cueInspector.selectedCue.overview",
    "priority": 1,
    "view": "lyricManager",
    "group": "Selected Cue",
    "title": "Selected Cue",
    "componentType": "group",
    "summary": "Edits the selected lyric cue’s text, timing, provenance, review state, and warnings.",
    "whatItDoes": [
      "Groups the controls that configure the selected lyric cue.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the selected lyric cue.",
    "affects": [
      "cue text",
      "cue timing",
      "confidence",
      "provenance",
      "review state",
      "section link",
      "warnings"
    ]
  },
  {
    "id": "lyricManager.cueInspector.selectedCue.text",
    "priority": 1,
    "view": "lyricManager",
    "group": "Selected Cue",
    "title": "Text",
    "componentType": "field",
    "summary": "Sets the selected cue’s displayed lyric text.",
    "whatItDoes": [
      "Writes the edited Text data to the selected lyric cue.",
      "The value remains owned by the current item or document."
    ],
    "whenToUse": "Edit it when the current label, text, or metadata no longer describes the item accurately.",
    "affects": [
      "Text data in the selected lyric cue"
    ]
  },
  {
    "id": "lyricManager.cueInspector.selectedCue.startMs",
    "priority": 1,
    "view": "lyricManager",
    "group": "Selected Cue",
    "title": "Start (ms)",
    "componentType": "numeric",
    "summary": "Sets the selected cue’s start time in integer milliseconds.",
    "whatItDoes": [
      "Writes a precise Start (ms) value to the selected lyric cue.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Start (ms) value in the selected lyric cue"
    ],
    "recommendedRange": "Integer milliseconds",
    "relatedHelpIds": [
      "lyricManager.cueInspector.selectedCue.endMs",
      "lyricManager.cueInspector.selectedCue.durationMs"
    ]
  },
  {
    "id": "lyricManager.cueInspector.selectedCue.endMs",
    "priority": 1,
    "view": "lyricManager",
    "group": "Selected Cue",
    "title": "End (ms)",
    "componentType": "numeric",
    "summary": "Sets the selected cue’s end time in integer milliseconds.",
    "whatItDoes": [
      "Writes a precise End (ms) value to the selected lyric cue.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "End (ms) value in the selected lyric cue"
    ],
    "recommendedRange": "Integer milliseconds",
    "relatedHelpIds": [
      "lyricManager.cueInspector.selectedCue.startMs",
      "lyricManager.cueInspector.selectedCue.durationMs"
    ]
  },
  {
    "id": "lyricManager.cueInspector.selectedCue.durationMs",
    "priority": 1,
    "view": "lyricManager",
    "group": "Selected Cue",
    "title": "Duration (ms)",
    "componentType": "numeric",
    "summary": "Shows or edits the cue duration derived from its timing bounds.",
    "whatItDoes": [
      "Duration is constrained by cue start and end.",
      "Invalid negative or inverted bounds are rejected by cue editing logic."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Duration (ms) value in the selected lyric cue"
    ],
    "recommendedRange": "Derived from End minus Start",
    "relatedHelpIds": [
      "lyricManager.cueInspector.selectedCue.startMs",
      "lyricManager.cueInspector.selectedCue.endMs"
    ]
  },
  {
    "id": "lyricManager.cueInspector.selectedCue.confidence",
    "priority": 1,
    "view": "lyricManager",
    "group": "Selected Cue",
    "title": "Confidence (0–1)",
    "componentType": "numeric",
    "summary": "Stores the selected cue’s extraction confidence from 0 to 1.",
    "whatItDoes": [
      "Writes a precise Confidence (0–1) value to the selected lyric cue.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Confidence (0–1) value in the selected lyric cue"
    ],
    "defaultValue": "Unset when unavailable",
    "recommendedRange": "0–1",
    "tip": "Treat confidence as review metadata, not proof that timing is correct."
  },
  {
    "id": "lyricManager.cueInspector.selectedCue.source",
    "priority": 1,
    "view": "lyricManager",
    "group": "Selected Cue",
    "title": "Source",
    "componentType": "select",
    "summary": "Records how the cue was created or imported.",
    "whatItDoes": [
      "Stores the selected Source option in the selected lyric cue.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Source selection in the selected lyric cue"
    ]
  },
  {
    "id": "lyricManager.cueInspector.selectedCue.reviewStatus",
    "priority": 1,
    "view": "lyricManager",
    "group": "Selected Cue",
    "title": "Review Status",
    "componentType": "select",
    "summary": "Sets the cue’s review workflow state.",
    "whatItDoes": [
      "Stores the selected Review Status option in the selected lyric cue.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Review Status selection in the selected lyric cue"
    ]
  },
  {
    "id": "lyricManager.cueInspector.selectedCue.section",
    "priority": 1,
    "view": "lyricManager",
    "group": "Selected Cue",
    "title": "Section",
    "componentType": "select",
    "summary": "Links the cue to a track section.",
    "whatItDoes": [
      "Stores the selected Section option in the selected lyric cue.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Section selection in the selected lyric cue"
    ]
  },
  {
    "id": "lyricManager.cueInspector.selectedCue.warningFlags",
    "priority": 1,
    "view": "lyricManager",
    "group": "Selected Cue",
    "title": "Warning Flags",
    "componentType": "toggle",
    "summary": "Adds or removes warning flags used during lyric review.",
    "whatItDoes": [
      "Warnings support review and filtering.",
      "They do not change rendered cue text by themselves."
    ],
    "whenToUse": "Use it when this behavior should be explicitly included or excluded from the current performance or edit.",
    "affects": [
      "Warning Flags state in the selected lyric cue"
    ],
    "doesNotAffect": [
      "rendered text"
    ],
    "tip": "Use warning flags to preserve review context instead of placing notes inside lyric text."
  },
  {
    "id": "lyricManager.cueInspector.wordTiming.overview",
    "priority": 1,
    "view": "lyricManager",
    "group": "Word Timing",
    "title": "Word Timing",
    "componentType": "group",
    "summary": "Edits word text and integer-millisecond timing inside the selected cue.",
    "whatItDoes": [
      "Groups the controls that configure the selected cue’s word-level timing.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the selected cue’s word-level timing.",
    "affects": [
      "word text and millisecond bounds"
    ]
  },
  {
    "id": "lyricManager.cueInspector.wordTiming.text",
    "priority": 1,
    "view": "lyricManager",
    "group": "Word Timing",
    "title": "Word Text",
    "componentType": "field",
    "summary": "Edits the text of one timed word inside the cue.",
    "whatItDoes": [
      "Writes the edited Word Text data to the selected cue’s word-level timing.",
      "The value remains owned by the current item or document."
    ],
    "whenToUse": "Edit it when the current label, text, or metadata no longer describes the item accurately.",
    "affects": [
      "Word Text data in the selected cue’s word-level timing"
    ]
  },
  {
    "id": "lyricManager.cueInspector.wordTiming.startMs",
    "priority": 1,
    "view": "lyricManager",
    "group": "Word Timing",
    "title": "Word Start Milliseconds",
    "componentType": "numeric",
    "summary": "Sets the word’s start time in integer milliseconds.",
    "whatItDoes": [
      "Word bounds remain inside the cue and use integer milliseconds."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Word Start Milliseconds value in the selected cue’s word-level timing"
    ],
    "recommendedRange": "Integer milliseconds",
    "tip": "Keep word timing ordered and inside the parent cue.",
    "relatedHelpIds": [
      "lyricManager.cueInspector.wordTiming.endMs",
      "lyricManager.cueInspector.wordTiming.text"
    ]
  },
  {
    "id": "lyricManager.cueInspector.wordTiming.endMs",
    "priority": 1,
    "view": "lyricManager",
    "group": "Word Timing",
    "title": "Word End Milliseconds",
    "componentType": "numeric",
    "summary": "Sets the word’s end time in integer milliseconds.",
    "whatItDoes": [
      "Word bounds remain inside the cue and use integer milliseconds."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "Word End Milliseconds value in the selected cue’s word-level timing"
    ],
    "recommendedRange": "Integer milliseconds",
    "tip": "Keep word timing ordered and inside the parent cue.",
    "relatedHelpIds": [
      "lyricManager.cueInspector.wordTiming.startMs",
      "lyricManager.cueInspector.wordTiming.text"
    ]
  },
  {
    "id": "mediaManager.upload.coreMetadata.trackTitle",
    "priority": 1,
    "view": "mediaManager",
    "group": "Upload / Edit Media — Core Metadata",
    "title": "Track Title",
    "componentType": "field",
    "summary": "Sets the audio track title used during media upload.",
    "whatItDoes": [
      "Writes the edited Track Title data to the media item being uploaded or edited.",
      "The value remains owned by the current item or document."
    ],
    "whenToUse": "Edit it when the current label, text, or metadata no longer describes the item accurately.",
    "affects": [
      "Track Title data in the media item being uploaded or edited"
    ]
  },
  {
    "id": "mediaManager.upload.coreMetadata.title",
    "priority": 1,
    "view": "mediaManager",
    "group": "Upload / Edit Media — Core Metadata",
    "title": "Title",
    "componentType": "field",
    "summary": "Sets the visual media item’s title.",
    "whatItDoes": [
      "Writes the edited Title data to the media item being uploaded or edited.",
      "The value remains owned by the current item or document."
    ],
    "whenToUse": "Edit it when the current label, text, or metadata no longer describes the item accurately.",
    "affects": [
      "Title data in the media item being uploaded or edited"
    ]
  },
  {
    "id": "mediaManager.upload.coreMetadata.artist",
    "priority": 1,
    "view": "mediaManager",
    "group": "Upload / Edit Media — Core Metadata",
    "title": "Artist",
    "componentType": "field",
    "summary": "Sets the media item’s artist metadata.",
    "whatItDoes": [
      "Writes the edited Artist data to the media item being uploaded or edited.",
      "The value remains owned by the current item or document."
    ],
    "whenToUse": "Edit it when the current label, text, or metadata no longer describes the item accurately.",
    "affects": [
      "Artist data in the media item being uploaded or edited"
    ]
  },
  {
    "id": "mediaManager.upload.coreMetadata.genre",
    "priority": 1,
    "view": "mediaManager",
    "group": "Upload / Edit Media — Core Metadata",
    "title": "Genre",
    "componentType": "field",
    "summary": "Sets the media item’s genre metadata.",
    "whatItDoes": [
      "Writes the edited Genre data to the media item being uploaded or edited.",
      "The value remains owned by the current item or document."
    ],
    "whenToUse": "Edit it when the current label, text, or metadata no longer describes the item accurately.",
    "affects": [
      "Genre data in the media item being uploaded or edited"
    ]
  },
  {
    "id": "mediaManager.upload.coreMetadata.bpm",
    "priority": 1,
    "view": "mediaManager",
    "group": "Upload / Edit Media — Core Metadata",
    "title": "BPM",
    "componentType": "numeric",
    "summary": "Sets BPM metadata for the uploaded audio item.",
    "whatItDoes": [
      "Writes a precise BPM value to the media item being uploaded or edited.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "BPM value in the media item being uploaded or edited"
    ],
    "defaultValue": "Unset",
    "recommendedRange": "Use the track’s known BPM",
    "tip": "Use the analyzed or verified track BPM rather than estimating from genre."
  },
  {
    "id": "mediaManager.upload.additionalInfo.bpm",
    "priority": 1,
    "view": "mediaManager",
    "group": "Upload / Edit Media — Additional Info",
    "title": "BPM",
    "componentType": "numeric",
    "summary": "Sets optional BPM metadata in the additional media information.",
    "whatItDoes": [
      "Writes a precise BPM value to the media item’s additional metadata.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "BPM value in the media item’s additional metadata"
    ],
    "defaultValue": "Unset",
    "recommendedRange": "Use the track’s known BPM"
  },
  {
    "id": "mediaManager.editAudioTrack.title",
    "priority": 1,
    "view": "mediaManager",
    "group": "Edit Audio Track",
    "title": "Title",
    "componentType": "field",
    "summary": "Sets the saved audio track title.",
    "whatItDoes": [
      "Writes the edited Title data to the saved audio track metadata.",
      "The value remains owned by the current item or document."
    ],
    "whenToUse": "Edit it when the current label, text, or metadata no longer describes the item accurately.",
    "affects": [
      "Title data in the saved audio track metadata"
    ]
  },
  {
    "id": "mediaManager.editAudioTrack.artist",
    "priority": 1,
    "view": "mediaManager",
    "group": "Edit Audio Track",
    "title": "Artist",
    "componentType": "field",
    "summary": "Sets the saved audio track artist.",
    "whatItDoes": [
      "Writes the edited Artist data to the saved audio track metadata.",
      "The value remains owned by the current item or document."
    ],
    "whenToUse": "Edit it when the current label, text, or metadata no longer describes the item accurately.",
    "affects": [
      "Artist data in the saved audio track metadata"
    ]
  },
  {
    "id": "mediaManager.editAudioTrack.genre",
    "priority": 1,
    "view": "mediaManager",
    "group": "Edit Audio Track",
    "title": "Genre",
    "componentType": "field",
    "summary": "Sets the saved audio track genre.",
    "whatItDoes": [
      "Writes the edited Genre data to the saved audio track metadata.",
      "The value remains owned by the current item or document."
    ],
    "whenToUse": "Edit it when the current label, text, or metadata no longer describes the item accurately.",
    "affects": [
      "Genre data in the saved audio track metadata"
    ]
  },
  {
    "id": "mediaManager.editAudioTrack.bpm",
    "priority": 1,
    "view": "mediaManager",
    "group": "Edit Audio Track",
    "title": "BPM",
    "componentType": "numeric",
    "summary": "Sets the saved audio track BPM.",
    "whatItDoes": [
      "Writes a precise BPM value to the saved audio track metadata.",
      "The field’s implemented bounds and step constrain accepted values when defined."
    ],
    "whenToUse": "Use it when an exact timing, quantity, or metadata value is more useful than approximate adjustment.",
    "affects": [
      "BPM value in the saved audio track metadata"
    ],
    "defaultValue": "Unset",
    "recommendedRange": "Use the track’s known BPM",
    "tip": "Use the analyzed or verified track BPM rather than estimating from genre."
  },
  {
    "id": "mediaManager.editAudioTrack.musicalKey",
    "priority": 1,
    "view": "mediaManager",
    "group": "Edit Audio Track",
    "title": "Musical Key",
    "componentType": "select",
    "summary": "Sets the saved audio track’s musical key.",
    "whatItDoes": [
      "Stores the selected Musical Key option in the saved audio track metadata.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Use it when the current mode, source, role, or preset does not match the workflow you need.",
    "affects": [
      "Musical Key selection in the saved audio track metadata"
    ],
    "defaultValue": "Unset",
    "tip": "Use a consistent key notation across the library."
  },
  {
    "id": "mediaManager.library.overview",
    "priority": 1,
    "view": "mediaManager",
    "group": "Library Browser",
    "title": "Media Library",
    "componentType": "group",
    "summary": "Browses saved visual media, audio tracks, and collections.",
    "whatItDoes": [
      "Groups the controls that configure the Media Library browser.",
      "Each child control remains independently documented and editable."
    ],
    "whenToUse": "Use this section when configuring the Media Library browser.",
    "affects": [
      "visible media category",
      "role-filtered results",
      "collection-filtered results"
    ],
    "relatedHelpIds": [
      "mediaManager.library.mediaTypeFilter",
      "mediaManager.library.mediaRoleFilter",
      "mediaManager.library.collectionFilter"
    ]
  },
  {
    "id": "mediaManager.library.mediaTypeFilter",
    "priority": 1,
    "view": "mediaManager",
    "group": "Library Browser",
    "title": "Media Type Filter",
    "componentType": "select",
    "summary": "Chooses the broad Media Library view or media type.",
    "whatItDoes": [
      "Current code renders media-type filters as tabs rather than a select control.",
      "Changing the active tab only filters visible library items."
    ],
    "whenToUse": "Use the Media Library tabs to narrow the browser to a media type.",
    "affects": [
      "visible Media Library type tab"
    ],
    "doesNotAffect": [
      "library metadata"
    ],
    "tip": "Clear filters before concluding that a media item is missing.",
    "tags": [
      "auditMismatch"
    ]
  },
  {
    "id": "mediaManager.library.mediaRoleFilter",
    "priority": 1,
    "view": "mediaManager",
    "group": "Library Browser",
    "title": "Media Role Filter",
    "componentType": "select",
    "summary": "Limits the library to media assigned a compatible role or role-aware view.",
    "whatItDoes": [
      "Current code does not expose a dedicated media-role dropdown in this browser.",
      "Role filtering is handled by the available views and contexts."
    ],
    "whenToUse": "Use role-aware library views where available; this component has no standalone role dropdown.",
    "affects": [
      "role-aware Media Library view"
    ],
    "doesNotAffect": [
      "stored media roles"
    ],
    "tip": "Assign roles in media metadata when role-based browsing is important.",
    "tags": [
      "auditMismatch"
    ]
  },
  {
    "id": "mediaManager.library.collectionFilter",
    "priority": 1,
    "view": "mediaManager",
    "group": "Library Browser",
    "title": "Collection Filter",
    "componentType": "select",
    "summary": "Shows collections or the contents of the active collection.",
    "whatItDoes": [
      "Current code opens collection contexts rather than exposing a dedicated collection dropdown.",
      "Choosing a collection changes the visible browser scope, not the stored media item."
    ],
    "whenToUse": "Open a collection context to browse one collection; this component has no standalone collection dropdown.",
    "affects": [
      "active Media Library collection context"
    ],
    "doesNotAffect": [
      "collection membership"
    ],
    "tip": "Open the collection itself to review its contents; changing the view does not change membership.",
    "tags": [
      "auditMismatch"
    ]
  }
] as const satisfies readonly HelpEntry[]

export type HelpId = (typeof PRIORITY_ONE_HELP_ENTRIES)[number]['id']

const warnedMissingHelpIds = new Set<string>()

function buildHelpRegistry(entries: readonly HelpEntry[]): Readonly<Record<HelpId, HelpEntry>> {
  const registry = {} as Record<HelpId, HelpEntry>

  for (const entry of entries) {
    if (import.meta.env.DEV && Object.prototype.hasOwnProperty.call(registry, entry.id)) {
      console.warn(`[HelpCenter] Duplicate help id: ${entry.id}`)
    }

    registry[entry.id as HelpId] = entry
  }

  return Object.freeze(registry)
}

export const HELP_CENTER = buildHelpRegistry(PRIORITY_ONE_HELP_ENTRIES)

export function hasHelpEntry(helpId: string): helpId is HelpId {
  return Object.prototype.hasOwnProperty.call(HELP_CENTER, helpId)
}

export function getHelpEntry(helpId: string): HelpEntry | undefined {
  if (hasHelpEntry(helpId)) return HELP_CENTER[helpId]

  if (import.meta.env.DEV && !warnedMissingHelpIds.has(helpId)) {
    warnedMissingHelpIds.add(helpId)
    console.warn(`[HelpCenter] Missing help entry: ${helpId}`)
  }

  return undefined
}

export function getHelpEntriesByPriority(priority: HelpPriority): readonly HelpEntry[] {
  return PRIORITY_ONE_HELP_ENTRIES.filter((entry) => entry.priority === priority)
}

export function getHelpEntriesByView(view: HelpView): readonly HelpEntry[] {
  return PRIORITY_ONE_HELP_ENTRIES.filter((entry) => entry.view === view)
}

export function getHelpEntriesByEngine(engine: HelpEngine): readonly HelpEntry[] {
  return PRIORITY_ONE_HELP_ENTRIES.filter(
    (entry) => 'engine' in entry && entry.engine === engine,
  )
}

function validateHelpRegistry(): void {
  const validPriorities = new Set<HelpPriority>([1, 2, 3, 4])

  for (const [registryKey, entry] of Object.entries(HELP_CENTER)) {
    if (registryKey !== entry.id) {
      console.warn(
        `[HelpCenter] Registry key "${registryKey}" does not match entry id "${entry.id}".`,
      )
    }

    if (!validPriorities.has(entry.priority)) {
      console.warn(`[HelpCenter] Invalid priority for ${entry.id}: ${entry.priority}`)
    }

    if (!entry.title.trim()) {
      console.warn(`[HelpCenter] Empty title for ${entry.id}`)
    }

    if (!entry.summary.trim()) {
      console.warn(`[HelpCenter] Empty summary for ${entry.id}`)
    }

    for (const relatedHelpId of entry.relatedHelpIds ?? []) {
      if (!hasHelpEntry(relatedHelpId)) {
        console.warn(
          `[HelpCenter] Invalid relatedHelpId "${relatedHelpId}" referenced by "${entry.id}".`,
        )
      }
    }
  }
}

if (import.meta.env.DEV) {
  validateHelpRegistry()
}
