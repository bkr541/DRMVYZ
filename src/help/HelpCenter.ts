/**
 * Bundled contextual-help content for DRMVYZ.
 *
 * This registry intentionally documents controls and workflows, not the
 * descriptions owned by selectable presets, scenes, worlds, media, or shows.
 * It is UI-neutral so a later HelpTrigger can adapt entries to InfoPopover.
 */

export const HELP_PRIORITIES = [1, 2, 3, 4] as const

export type HelpPriority = (typeof HELP_PRIORITIES)[number]

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

export const HELP_COMPONENT_TYPES = [
  'group',
  'select',
  'dropdown',
  'toggle',
  'slider',
  'field',
  'button',
  'timeline',
  'trackSection',
  'visualization',
  'inspector',
  'editor',
  'upload',
  'color',
  'numeric',
  'diagnostic',
  'selection',
] as const

export type HelpComponentType = (typeof HELP_COMPONENT_TYPES)[number]

export interface HelpEntry {
  id: string
  priority: HelpPriority
  view: HelpView
  engine?: HelpEngine
  group: string
  title: string
  componentType: HelpComponentType
  summary: string
  whatItDoes?: readonly string[]
  whenToUse?: string
  affects?: readonly string[]
  doesNotAffect?: readonly string[]
  defaultValue?: string
  range?: string
  recommendedRange?: string
  tip?: string
  relatedHelpIds?: readonly string[]
  tags?: readonly string[]
  auditMismatch?: string
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
    "summary": "Selects which React visual engine is active in the workspace.",
    "whatItDoes": [
      "Changes the active engine and the controls shown for that engine.",
      "Keeps engine-owned presets, scenes, and worlds in their own registries."
    ],
    "whenToUse": "Switch engines when moving to a different visual workflow, such as Sound Drawing, CANVAS, LaserDMX, or PixGrid.",
    "affects": [
      "active React engine",
      "visible engine controls and source browser"
    ],
    "doesNotAffect": [
      "descriptions owned by engine presets, scenes, or worlds"
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
    "summary": "Selects the active preset, scene, world, media source, or workspace item for the current engine.",
    "whatItDoes": [
      "Activates one engine-owned object in the current workspace.",
      "Uses the selected object’s own registry for its short description and identity."
    ],
    "whenToUse": "Use the selection area to audition or activate the source that the current engine should render.",
    "affects": [
      "active engine source or authored object"
    ],
    "relatedHelpIds": [
      "react.shared.engine.engineSelection"
    ]
  },
  {
    "id": "react.shared.header.audioInput",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Main app header",
    "title": "Audio Input",
    "componentType": "select",
    "summary": "Chooses the audio source that drives playback, analysis, and audio-reactive visual behavior in React.",
    "whatItDoes": [
      "Track Input uses the loaded audio track and its available analysis data.",
      "Microphone listens to live input, while Demo Signal provides a generated source for testing without a track."
    ],
    "whenToUse": "Choose the source that matches the current performance or setup workflow before configuring audio-reactive visuals.",
    "affects": [
      "shared audio-engine source",
      "audio analysis and modulation available to React engines"
    ],
    "doesNotAffect": [
      "the selected React engine or preset",
      "saved visual parameter values"
    ],
    "tip": "Use Demo Signal to confirm that a visual reacts before troubleshooting a track file or microphone connection.",
    "relatedHelpIds": [
      "visualizer.audioDeck.trackPlayer"
    ]
  },
  {
    "id": "react.shared.header.productionOutput",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Main app header",
    "title": "Production Output",
    "componentType": "group",
    "summary": "Provides always-visible safety controls for arming, revealing, or blacking out the active LaserDMX production output.",
    "whatItDoes": [
      "Power arms or disarms the selected production-output adapter when LaserDMX is active and the adapter is available.",
      "Reveal clears visual and emergency blackout state, and can restore an output that was armed before blackout.",
      "Blackout immediately darkens the LaserDMX output and engages the emergency-blackout path."
    ],
    "whenToUse": "Use these controls while preparing or running LaserDMX output when a fast, persistent safety action must remain available from any React workspace.",
    "affects": [
      "LaserDMX production-output armed state",
      "LaserDMX visual and emergency blackout state"
    ],
    "doesNotAffect": [
      "non-LaserDMX engine rendering",
      "the selected preset or authored show data"
    ],
    "tip": "Keep output disarmed while configuring the rig, then arm only after the destination and safety state have been verified."
  },
  {
    "id": "react.shared.trackMap.overview",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Track Map",
    "componentType": "group",
    "summary": "Maps beats, energy, sections, cues, and visual assignments against the loaded track.",
    "whatItDoes": [
      "Provides one timeline for reviewing and editing manual track sections.",
      "Supplies section context and section-linked preset assignments to compatible performance systems."
    ],
    "whenToUse": "Use Track Map when section timing or visual changes must follow the structure of the loaded track.",
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
      "Changes the editing overlay without changing beat analysis or section timing."
    ],
    "whenToUse": "Show it while placing boundaries on beats; hide it when the timeline becomes crowded.",
    "affects": [
      "Track Map beat-grid visibility"
    ],
    "doesNotAffect": [
      "beat analysis",
      "section timing"
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
    "summary": "Chooses which analyzed energy curve is visible behind the Track Map.",
    "whatItDoes": [
      "Changes the displayed analysis channel only; stored analysis and section data remain unchanged."
    ],
    "whenToUse": "Switch curves when a different energy view makes section boundaries easier to judge.",
    "affects": [
      "displayed Track Map energy curve"
    ],
    "doesNotAffect": [
      "audio analysis data",
      "manual sections"
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
    "summary": "Edits the selected track section’s type, label, timing, and intensity.",
    "whatItDoes": [
      "Writes changes to the selected manual section and updates section-aware context."
    ],
    "whenToUse": "Use it after selecting a section that needs corrected boundaries, identity, or authored energy.",
    "affects": [
      "selected manual track section"
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
    "summary": "Sets the musical role of the selected section.",
    "whatItDoes": [
      "Changes the section type consumed by section-aware engines and authored performance logic."
    ],
    "whenToUse": "Change it when the selected region is classified as the wrong song section.",
    "affects": [
      "selected section type",
      "section-aware behavior"
    ],
    "doesNotAffect": [
      "section start or end time"
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
    "summary": "Sets an optional display name for the selected section.",
    "whatItDoes": [
      "Changes the user-facing label without changing the section type or timing."
    ],
    "whenToUse": "Add a label when two sections share a type but need distinct names, such as Drop 1 and Drop 2.",
    "affects": [
      "selected section label"
    ],
    "doesNotAffect": [
      "section type",
      "section timing"
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
      "Moves the section start while preserving valid section ordering and duration constraints."
    ],
    "whenToUse": "Correct it when the section begins before or after the intended musical boundary.",
    "affects": [
      "selected section start boundary"
    ],
    "range": "0 seconds to track duration"
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
      "Moves the section end while preserving valid section ordering and duration constraints."
    ],
    "whenToUse": "Correct it when the following musical section starts earlier or later than mapped.",
    "affects": [
      "selected section end boundary"
    ],
    "range": "0 seconds to track duration"
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
      "Stores a normalized intensity that compatible performance systems can use as section context."
    ],
    "whenToUse": "Lower it for restrained passages and raise it for sections that should drive stronger authored behavior.",
    "affects": [
      "selected section intensity"
    ],
    "defaultValue": "70%",
    "range": "0–100%"
  },
  {
    "id": "react.shared.trackMap.boundaryTools.overview",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Boundary Tools",
    "componentType": "group",
    "summary": "Moves the selected section boundary with grid snapping or analyzed alternatives.",
    "whatItDoes": [
      "Applies the chosen snap resolution to boundary edits.",
      "The previous and next alternative buttons use analyzed suggestions and are documented by this group."
    ],
    "whenToUse": "Use Boundary Tools when a section edge is close to the right location but needs musical alignment.",
    "affects": [
      "selected section boundary"
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
    "summary": "Chooses the musical grid used when a section boundary is moved.",
    "whatItDoes": [
      "Quantizes boundary edits to the selected beat or bar resolution."
    ],
    "whenToUse": "Use a tighter grid for small corrections and a bar-based grid for structural section changes.",
    "affects": [
      "boundary-edit quantization"
    ],
    "tip": "Use Bar or Four Bar for phrase-aligned edits; use Free only when a deliberate off-grid boundary is required."
  },
  {
    "id": "react.shared.trackMap.visualAssignment.overview",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Visual Assignment",
    "componentType": "group",
    "summary": "Assigns a React preset to the selected track section and reports its owning engine.",
    "whatItDoes": [
      "Stores the section-to-preset link used by compatible section-following workflows."
    ],
    "whenToUse": "Use it when a specific section should recall a particular visual preset.",
    "affects": [
      "selected section preset assignment"
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
    "summary": "Selects the React preset assigned to the selected track section.",
    "whatItDoes": [
      "Changes the stored preset ID for that section; preset descriptions remain in the preset registry."
    ],
    "whenToUse": "Choose a preset when the selected section should recall a different authored visual state.",
    "affects": [
      "selected section preset assignment"
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
    "summary": "Reports which React engine owns the assigned preset.",
    "whatItDoes": [
      "Updates automatically from the selected preset and is not directly editable."
    ],
    "whenToUse": "Check it before assigning a preset when engine ownership is not obvious from the preset name.",
    "affects": [
      "displayed preset ownership"
    ],
    "doesNotAffect": [
      "active engine",
      "preset assignment"
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
    "summary": "Creates a new manual section from the entered type, label, boundaries, and intensity.",
    "whatItDoes": [
      "Adds a validated section to the loaded track’s manual section map."
    ],
    "whenToUse": "Use it when the track contains a meaningful region that is missing from the section map.",
    "affects": [
      "manual track sections"
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
    "whenToUse": "Choose Type when track map needs a different active option.",
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
    "whenToUse": "Edit Label when the track map item needs different text or metadata.",
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
    "whenToUse": "Enter an exact Start (s) value when track map needs precise timing or quantity.",
    "affects": [
      "Start (s) value in the loaded track's authored section map"
    ],
    "defaultValue": "0 seconds",
    "range": "0 seconds or later"
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
    "whenToUse": "Enter an exact End (s) value when track map needs precise timing or quantity.",
    "affects": [
      "End (s) value in the loaded track's authored section map"
    ],
    "defaultValue": "30 seconds"
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
    "whenToUse": "Adjust Intensity while previewing track map so the result remains readable in motion.",
    "affects": [
      "Intensity value in the loaded track's authored section map"
    ],
    "defaultValue": "70%",
    "range": "0–100%"
  },
  {
    "id": "react.soundDrawing.workspace.tabs",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Sound Drawing workspace",
    "title": "Source, Media, and Fonts",
    "componentType": "selection",
    "summary": "Switches the left Sound Drawing workspace between engine controls, compatible media, and uploaded fonts.",
    "whatItDoes": [
      "Source shows Sound Drawing performance, Engine Mode, and source controls.",
      "Media shows compatible SVG media, while Fonts opens the font library used by text-driven Sound Drawing visuals."
    ],
    "whenToUse": "Move between these tabs when configuring the visual source, choosing reusable media, or preparing typography for Text mode.",
    "affects": [
      "visible left-workspace panel"
    ],
    "doesNotAffect": [
      "the active Sound Drawing preset or rendered output by itself"
    ],
    "tip": "Changing tabs only changes the editor surface. Existing Sound Drawing settings remain loaded."
  },
  {
    "id": "react.soundDrawing.presetLibrary",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Sound Drawing presets",
    "title": "Sound Drawing Presets",
    "componentType": "selection",
    "summary": "Browses and loads saved Sound Drawing looks from the current, favorite, or all-engine preset library view.",
    "whatItDoes": [
      "Selecting a preset loads its Sound Drawing source type and stored visual settings.",
      "The star action adds or removes a preset from Favorites without loading it."
    ],
    "whenToUse": "Use the preset list to audition complete Sound Drawing looks before refining their source or design controls.",
    "affects": [
      "active React preset",
      "active engine when a preset is selected from All Engines"
    ],
    "doesNotAffect": [
      "the preset registry entry when merely browsing or favoriting"
    ],
    "tip": "Use Current Engine to stay inside Sound Drawing, or All Engines when intentionally switching visual engines."
  },
  {
    "id": "react.soundDrawing.authoredPerformance.overview",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Authored Performance",
    "title": "Authored Performance",
    "componentType": "group",
    "summary": "Selects a Sound Drawing Performance Show and controls whether its section choreography runs.",
    "whatItDoes": [
      "Performance Show loads the authored base design.",
      "Auto Performance enables the show’s track-aware choreography."
    ],
    "whenToUse": "Use this section to choose an authored show, compare its stable base state, and then enable choreography when needed.",
    "affects": [
      "Sound Drawing authored show selection",
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
    "summary": "Enables section-aware choreography for the selected Sound Drawing Performance Show.",
    "whatItDoes": [
      "Requires a selected Performance Show.",
      "When off, the selected show remains loaded in its stable base state."
    ],
    "whenToUse": "Turn it on for hands-free, track-structured performance; turn it off while manually evaluating the show’s base design.",
    "affects": [
      "selected show choreography"
    ],
    "doesNotAffect": [
      "selected Performance Show"
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
    "summary": "Selects the authored Sound Drawing show loaded into the engine.",
    "whatItDoes": [
      "Loads the show’s base design and program identity.",
      "Does not enable Auto Performance by itself."
    ],
    "whenToUse": "Choose a show before enabling Auto Performance or tuning its choreography controls.",
    "affects": [
      "selected Sound Drawing Performance Show"
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
    "summary": "Shapes the overall complexity, motion, reactivity, trails, and scale of the selected authored show.",
    "whatItDoes": [
      "Applies high-level trims to the show runtime without replacing the selected show definition."
    ],
    "whenToUse": "Use these macros to adapt an authored show to the track or performance space without editing its underlying program.",
    "affects": [
      "selected Sound Drawing show runtime"
    ],
    "doesNotAffect": [
      "Performance Show descriptions or registry data"
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
    "whenToUse": "Adjust Complexity while previewing show choreography so the result remains readable in motion.",
    "affects": [
      "Complexity value in the active Sound Drawing show choreography"
    ],
    "defaultValue": "70%",
    "range": "0–100%",
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
    "whenToUse": "Adjust Motion Intensity while previewing show choreography so the result remains readable in motion.",
    "affects": [
      "Motion Intensity value in the active Sound Drawing show choreography"
    ],
    "defaultValue": "65%",
    "range": "0–100%"
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
    "whenToUse": "Adjust Reaction Intensity while previewing show choreography so the result remains readable in motion.",
    "affects": [
      "Reaction Intensity value in the active Sound Drawing show choreography"
    ],
    "defaultValue": "80%",
    "range": "0–100%"
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
    "whenToUse": "Adjust Trail Intensity while previewing show choreography so the result remains readable in motion.",
    "affects": [
      "Trail Intensity value in the active Sound Drawing show choreography"
    ],
    "defaultValue": "55%",
    "range": "0–100%"
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
    "whenToUse": "Adjust Show Size while previewing show choreography so the result remains readable in motion.",
    "affects": [
      "Show Size value in the active Sound Drawing show choreography"
    ],
    "doesNotAffect": [
      "show generator or source identity"
    ],
    "defaultValue": "78%",
    "range": "0.10–2.50×",
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
    "whenToUse": "Adjust Audio Reaction Depth while previewing living ribbon controls so the result remains readable in motion.",
    "affects": [
      "Audio Reaction Depth value in the Living Ribbon simulation"
    ],
    "defaultValue": "80%",
    "range": "0–100%"
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
    "whenToUse": "Adjust Show Size while previewing base design and engine mode so the result remains readable in motion.",
    "affects": [
      "Show Size value in the manual or stable-base Sound Drawing design"
    ],
    "doesNotAffect": [
      "Auto Performance state"
    ],
    "defaultValue": "78%",
    "range": "0.10–2.50×"
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
    "whenToUse": "Adjust Visual Size while previewing base design and engine mode so the result remains readable in motion.",
    "affects": [
      "Visual Size value in the manual or stable-base Sound Drawing design"
    ],
    "doesNotAffect": [
      "signal calibration"
    ],
    "defaultValue": "78%",
    "range": "0.10–2.50×"
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
    "whenToUse": "Turn Follow Track Sections on when base design and engine mode should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Choose Classic Mode when base design and engine mode needs a different active option.",
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
    "whenToUse": "Choose Preset when pro scope needs a different active option.",
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
    "whenToUse": "Adjust Visual Size while previewing pro scope so the result remains readable in motion.",
    "affects": [
      "Visual Size value in the Sound Drawing professional oscilloscope"
    ],
    "doesNotAffect": [
      "Pro Scope signal calibration"
    ],
    "range": "0.10–2.50×",
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
    "whenToUse": "Adjust Beat Bloom while previewing pro scope music reactivity so the result remains readable in motion.",
    "affects": [
      "Beat Bloom value in the Pro Scope presentation response"
    ],
    "doesNotAffect": [
      "trace geometry"
    ],
    "range": "0–100%",
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
    "summary": "Sets the engine-level amount of Sound Drawing response driven by bass energy.",
    "whatItDoes": [
      "Scales bass-driven movement and intensity within the active Sound Drawing output path."
    ],
    "whenToUse": "Raise it when low-end hits should be more visible; reduce it when bass movement overwhelms the source shape.",
    "affects": [
      "Sound Drawing bass response"
    ],
    "range": "0–100%"
  },
  {
    "id": "react.soundDrawing.audioReactivity.overview",
    "priority": 1,
    "view": "react",
    "engine": "soundDrawing",
    "group": "Audio routing and reactivity",
    "title": "Audio Reactivity",
    "componentType": "group",
    "summary": "Controls how Sound Drawing converts analyzed audio into displacement and frequency-specific movement.",
    "whatItDoes": [
      "Groups the routing, displacement, and frequency-response controls used by the engine."
    ],
    "whenToUse": "Use it when the visual should react differently to bass, mids, highs, beats, or text-specific motion.",
    "affects": [
      "Sound Drawing audio-driven deformation and frequency response"
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
    "whenToUse": "Adjust Z-Index while previewing timeline clip so the result remains readable in motion.",
    "affects": [
      "Z-Index value in the selected Sound Drawing timeline clip"
    ],
    "defaultValue": "0",
    "range": "0–10",
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
    "whenToUse": "Adjust Fade In (ms) while previewing timeline clip so the result remains readable in motion.",
    "affects": [
      "Fade In (ms) value in the selected Sound Drawing timeline clip"
    ],
    "defaultValue": "0 ms",
    "range": "0–2000 ms",
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
    "whenToUse": "Adjust Fade Out (ms) while previewing timeline clip so the result remains readable in motion.",
    "affects": [
      "Fade Out (ms) value in the selected Sound Drawing timeline clip"
    ],
    "defaultValue": "0 ms",
    "range": "0–2000 ms",
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
    "whenToUse": "Turn Layer Enabled on when timeline layer should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Edit Name when the timeline layer item needs different text or metadata.",
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
    "whenToUse": "Choose Source when timeline layer needs a different active option.",
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
    "whenToUse": "Choose Text Source when timeline layer needs a different active option.",
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
    "whenToUse": "Choose When No Lyric Is Active when timeline layer needs a different active option.",
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
    "whenToUse": "Edit Fallback Text when the timeline layer item needs different text or metadata.",
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
    "whenToUse": "Choose Font when timeline layer needs a different active option.",
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
    "whenToUse": "Choose Alignment when timeline layer needs a different active option.",
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
    "whenToUse": "Adjust Line Height while previewing timeline layer so the result remains readable in motion.",
    "affects": [
      "Line Height value in the selected Sound Drawing timeline layer"
    ],
    "defaultValue": "1.2",
    "range": "0.80–3.00",
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
    "whenToUse": "Adjust Letter Spacing while previewing timeline layer so the result remains readable in motion.",
    "affects": [
      "Letter Spacing value in the selected Sound Drawing timeline layer"
    ],
    "defaultValue": "0",
    "range": "−20 to 80",
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
    "whenToUse": "Choose Shape when timeline layer needs a different active option.",
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
    "whenToUse": "Choose SVG File when timeline layer needs a different active option.",
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
    "whenToUse": "Adjust X while previewing timeline transform so the result remains readable in motion.",
    "affects": [
      "X value in the selected Sound Drawing timeline layer transform"
    ],
    "defaultValue": "0",
    "range": "−1.00 to 1.00"
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
    "whenToUse": "Adjust Y while previewing timeline transform so the result remains readable in motion.",
    "affects": [
      "Y value in the selected Sound Drawing timeline layer transform"
    ],
    "defaultValue": "0",
    "range": "−1.00 to 1.00"
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
    "whenToUse": "Adjust Scale while previewing timeline transform so the result remains readable in motion.",
    "affects": [
      "Scale value in the selected Sound Drawing timeline layer transform"
    ],
    "defaultValue": "1",
    "range": "0.10–5.00×"
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
    "whenToUse": "Adjust Rotation while previewing timeline transform so the result remains readable in motion.",
    "affects": [
      "Rotation value in the selected Sound Drawing timeline layer transform"
    ],
    "defaultValue": "0°",
    "range": "−180° to 180°"
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
    "whenToUse": "Choose World when selecting the active item for world selection and visual dna.",
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
    "whenToUse": "Choose Starting Profile when world selection and visual dna needs a different active option.",
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
    "whenToUse": "Adjust Structure while previewing performance macros so the result remains readable in motion.",
    "affects": [
      "Structure value in the Reactive Constellation performance character"
    ],
    "range": "0–100%"
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
    "whenToUse": "Adjust Motion while previewing performance macros so the result remains readable in motion.",
    "affects": [
      "Motion value in the Reactive Constellation performance character"
    ],
    "range": "0–100%"
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
    "whenToUse": "Adjust Impact while previewing performance macros so the result remains readable in motion.",
    "affects": [
      "Impact value in the Reactive Constellation performance character"
    ],
    "range": "0–100%"
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
    "whenToUse": "Adjust Trails while previewing performance macros so the result remains readable in motion.",
    "affects": [
      "Trails value in the Reactive Constellation performance character"
    ],
    "range": "0–100%"
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
    "whenToUse": "Adjust Material while previewing performance macros so the result remains readable in motion.",
    "affects": [
      "Material value in the Reactive Constellation performance character"
    ],
    "range": "0–100%"
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
    "whenToUse": "Adjust Camera while previewing performance macros so the result remains readable in motion.",
    "affects": [
      "Camera value in the Reactive Constellation performance character"
    ],
    "doesNotAffect": [
      "manual camera lock"
    ],
    "range": "0–100%"
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
    "whenToUse": "Adjust Strength while previewing variation and auto director so the result remains readable in motion.",
    "affects": [
      "Strength value in Cinematic Worlds variation and automatic direction"
    ],
    "range": "0–100%",
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
    "whenToUse": "Adjust Camera Activity while previewing variation and auto director so the result remains readable in motion.",
    "affects": [
      "Camera Activity value in Cinematic Worlds variation and automatic direction"
    ],
    "range": "0–100%"
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
    "whenToUse": "Adjust Transition Frequency while previewing variation and auto director so the result remains readable in motion.",
    "affects": [
      "Transition Frequency value in Cinematic Worlds variation and automatic direction"
    ],
    "range": "0–100%"
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
    "whenToUse": "Adjust Drop Impact while previewing variation and auto director so the result remains readable in motion.",
    "affects": [
      "Drop Impact value in Cinematic Worlds variation and automatic direction"
    ],
    "range": "0–100%"
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
    "whenToUse": "Adjust Audio Reaction while previewing live controls, quality, environment, material so the result remains readable in motion.",
    "affects": [
      "Audio Reaction value in the active Cinematic World output"
    ],
    "doesNotAffect": [
      "world route definitions"
    ],
    "range": "0–100%"
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
    "whenToUse": "Turn World Audio Mapping on when world audio mapping should include this behavior; leave it off otherwise.",
    "affects": [
      "World Audio Mapping state in the active world audio-routing configuration"
    ]
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
    "whenToUse": "Adjust Global Smoothing while previewing world audio mapping so the result remains readable in motion.",
    "affects": [
      "Global Smoothing value in the active world audio-routing configuration"
    ],
    "range": "0–2000 ms",
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
    "whenToUse": "Choose Active Scene when selecting the active item for scene library and renderer.",
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
    "whenToUse": "Choose Quality when scene library and renderer needs a different active option.",
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
    "title": "Filter by category",
    "componentType": "select",
    "summary": "Filters the Shader Scene library by scene category.",
    "whatItDoes": [
      "Changes which scene cards are visible.",
      "It does not unload the active scene."
    ],
    "whenToUse": "Choose Filter by category when scene library and renderer needs a different active option.",
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
    "whenToUse": "Adjust Intensity while previewing shader master so the result remains readable in motion.",
    "affects": [
      "Intensity value in the active Shader Pads scene"
    ],
    "doesNotAffect": [
      "scene-local parameters"
    ],
    "range": "0–100%"
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
    "whenToUse": "Adjust Motion while previewing shader master so the result remains readable in motion.",
    "affects": [
      "Motion value in the active Shader Pads scene"
    ],
    "doesNotAffect": [
      "scene-local motion values"
    ],
    "range": "0–100%"
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
    "whenToUse": "Adjust Glow while previewing shader master so the result remains readable in motion.",
    "affects": [
      "Glow value in the active Shader Pads scene"
    ],
    "doesNotAffect": [
      "scene-local glow values"
    ],
    "range": "0–100%"
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
    "whenToUse": "Adjust Bass React while previewing shader master so the result remains readable in motion.",
    "affects": [
      "Bass React value in the active Shader Pads scene"
    ],
    "doesNotAffect": [
      "scene-local audio parameters"
    ],
    "range": "0–100%"
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
    "whenToUse": "Turn Auto Select on when canvas source link and display should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Choose Fit Mode when canvas source link and display needs a different active option.",
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
    "whenToUse": "Adjust Scale while previewing canvas source link and display so the result remains readable in motion.",
    "affects": [
      "Scale value in the active CANVAS media output"
    ],
    "defaultValue": "1",
    "range": "0.10–4.00×"
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
    "whenToUse": "Adjust Position X while previewing canvas source link and display so the result remains readable in motion.",
    "affects": [
      "Position X value in the active CANVAS media output"
    ],
    "defaultValue": "0",
    "range": "−100 to 100"
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
    "whenToUse": "Adjust Position Y while previewing canvas source link and display so the result remains readable in motion.",
    "affects": [
      "Position Y value in the active CANVAS media output"
    ],
    "defaultValue": "0",
    "range": "−100 to 100"
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
    "whenToUse": "Adjust Rotation while previewing canvas source link and display so the result remains readable in motion.",
    "affects": [
      "Rotation value in the active CANVAS media output"
    ],
    "defaultValue": "0°",
    "range": "−180° to 180°"
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
    "whenToUse": "Adjust Canvas Output Opacity while previewing canvas source link and display so the result remains readable in motion.",
    "affects": [
      "Canvas Output Opacity value in the active CANVAS media output"
    ],
    "doesNotAffect": [
      "Dry Source Mix"
    ],
    "defaultValue": "100%",
    "range": "0–100%",
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
    "summary": "Defines the playable video range and the events that restart or retrigger the active CANVAS source.",
    "whatItDoes": [
      "Combines clip in/out timing, loop behavior, restart rules, and section-trigger mapping."
    ],
    "whenToUse": "Use it when a video must loop a specific range or restart at musical events.",
    "affects": [
      "active CANVAS video playback timing"
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
    "summary": "Chooses the primary event that restarts the active CANVAS video range.",
    "whatItDoes": [
      "Supports manual-only, track-start, section, drop, and recurring bar triggers."
    ],
    "whenToUse": "Choose a trigger when video playback should realign automatically with track structure.",
    "affects": [
      "CANVAS video restart trigger"
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
    "whenToUse": "Enter an exact Clip Start Time value when video timing needs precise timing or quantity.",
    "affects": [
      "Clip Start Time value in the active CANVAS video source"
    ],
    "defaultValue": "0 seconds",
    "range": "0–21,600 seconds"
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
    "whenToUse": "Enter an exact Clip End Time value when video timing needs precise timing or quantity.",
    "affects": [
      "Clip End Time value in the active CANVAS video source"
    ],
    "defaultValue": "0 seconds (video end)",
    "range": "0–21,600 seconds",
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
    "whenToUse": "Turn Loop Clip Range on when video timing should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Turn Loop Full Video on when video timing should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Turn Restart on Drop on when video timing should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Turn Restart on Section Change on when video timing should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Turn Restart on Manual Preset Change on when video timing should include this behavior; leave it off otherwise.",
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
    "summary": "Chooses which supported track-section types may trigger CANVAS video playback.",
    "whatItDoes": [
      "Maps Intro, Build, Drop, Breakdown, and Outro to the section-change trigger path."
    ],
    "whenToUse": "Enable only the section types where the video should restart or retrigger.",
    "affects": [
      "CANVAS section-trigger eligibility"
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
    "whenToUse": "Choose Intro when selecting the active item for video timing.",
    "affects": [
      "Intro selection in the active CANVAS video source"
    ],
    "defaultValue": "On"
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
    "whenToUse": "Choose Build when selecting the active item for video timing.",
    "affects": [
      "Build selection in the active CANVAS video source"
    ],
    "defaultValue": "On"
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
    "whenToUse": "Choose Drop when selecting the active item for video timing.",
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
    "whenToUse": "Choose Breakdown when selecting the active item for video timing.",
    "affects": [
      "Breakdown selection in the active CANVAS video source"
    ],
    "defaultValue": "On"
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
    "whenToUse": "Choose Outro when selecting the active item for video timing.",
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
    "summary": "Controls the authored CANVAS performance program that arranges media, roles, transitions, effects, motion, and cuts.",
    "whatItDoes": [
      "Combines the selected Performance Show with high-level orchestration macros.",
      "Uses the current media pool as source material."
    ],
    "whenToUse": "Use it when CANVAS should arrange available media automatically around the track.",
    "affects": [
      "CANVAS authored performance runtime"
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
    "summary": "Enables track-aware CANVAS orchestration for the selected performance program.",
    "whatItDoes": [
      "Uses Shared Performance Core context and the current CANVAS media pool.",
      "When off, manual playback and preset behavior remain available."
    ],
    "whenToUse": "Turn it on for automatic, music-structured media arrangement after the media pool is prepared.",
    "affects": [
      "CANVAS automatic orchestration"
    ],
    "doesNotAffect": [
      "selected Performance Show",
      "stored media"
    ],
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
    "summary": "Selects the authored program used by CANVAS performance orchestration.",
    "whatItDoes": [
      "Changes the active program definition without duplicating its domain-owned description."
    ],
    "whenToUse": "Choose a program when CANVAS should use a different authored arrangement strategy.",
    "affects": [
      "selected CANVAS Performance Show"
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
    "whenToUse": "Turn Auto Role on when performance orchestration should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Choose Composition when performance orchestration needs a different active option.",
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
    "whenToUse": "Adjust Layer Complexity while previewing performance orchestration so the result remains readable in motion.",
    "affects": [
      "Layer Complexity value in the CANVAS performance program"
    ],
    "range": "0–100%"
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
    "whenToUse": "Adjust Transition Density while previewing performance orchestration so the result remains readable in motion.",
    "affects": [
      "Transition Density value in the CANVAS performance program"
    ],
    "range": "0–100%"
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
    "whenToUse": "Adjust Effect Intensity while previewing performance orchestration so the result remains readable in motion.",
    "affects": [
      "Effect Intensity value in the CANVAS performance program"
    ],
    "range": "0–100%"
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
    "whenToUse": "Adjust Motion Intensity while previewing performance orchestration so the result remains readable in motion.",
    "affects": [
      "Motion Intensity value in the CANVAS performance program"
    ],
    "range": "0–100%"
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
    "whenToUse": "Adjust Cut Density while previewing performance orchestration so the result remains readable in motion.",
    "affects": [
      "Cut Density value in the CANVAS performance program"
    ],
    "range": "0–100%"
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
    "summary": "Balances the original CANVAS source against generated treatment and audio-driven response.",
    "whatItDoes": [
      "Controls dry-source visibility, overall visual intensity, bass response, and beat pulses."
    ],
    "whenToUse": "Use it to keep the source recognizable while adding the desired amount of reactive treatment.",
    "affects": [
      "CANVAS source mix and audio reactivity"
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
    "summary": "Sets how much of the original CANVAS media remains visible in the reactive output.",
    "whatItDoes": [
      "Blends the dry source into the selected CANVAS recipe output."
    ],
    "whenToUse": "Keep it high for recognizable media; lower it when generated treatment should dominate.",
    "affects": [
      "CANVAS dry-source contribution"
    ],
    "doesNotAffect": [
      "processed effects",
      "CANVAS Output Opacity"
    ],
    "defaultValue": "100%",
    "range": "0–100%",
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
    "summary": "Sets the overall strength of the selected CANVAS reactive recipe.",
    "whatItDoes": [
      "Scales the recipe’s visual treatment before the individual bass and beat controls are applied."
    ],
    "whenToUse": "Raise it when the treatment is too subtle or lower it when the source loses clarity.",
    "affects": [
      "CANVAS reactive treatment intensity"
    ],
    "doesNotAffect": [
      "individual recipe parameter values"
    ],
    "defaultValue": "8%",
    "range": "0–100%"
  },
  {
    "id": "react.canvas.reactControls.sourceAndReactivity.bassReactivity",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS React Controls — Source + Reactivity",
    "title": "Bass Reactivity",
    "componentType": "slider",
    "summary": "Sets how strongly bass energy expands and brightens the CANVAS treatment.",
    "whatItDoes": [
      "Scales bass-driven size, glow, and particle response in the selected recipe."
    ],
    "whenToUse": "Raise it for stronger low-end movement; reduce it when sustained bass makes the image pulse constantly.",
    "affects": [
      "CANVAS bass-driven response"
    ],
    "defaultValue": "0%",
    "range": "0–100%",
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
    "summary": "Sets the strength of discrete beat-driven pulses in the CANVAS treatment.",
    "whatItDoes": [
      "Scales beat-triggered bursts separately from continuous bass response."
    ],
    "whenToUse": "Use it to emphasize individual hits without increasing all low-frequency movement.",
    "affects": [
      "CANVAS beat-driven response"
    ],
    "defaultValue": "0%",
    "range": "0–100%"
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
    "whenToUse": "Choose Matrix when selecting the active item for workspace mode.",
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
    "whenToUse": "Choose Show Director when selecting the active item for workspace mode.",
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
    "whenToUse": "Adjust Bass React while previewing fx and fog so the result remains readable in motion.",
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
    "whenToUse": "Turn Show Beam Editor on when program and canvas should include this behavior; leave it off otherwise.",
    "affects": [
      "Show Beam Editor state in the LaserDMX Beam Matrix workspace"
    ],
    "doesNotAffect": [
      "live laser output"
    ]
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
    "whenToUse": "Turn Snap to Grid on when program and canvas should include this behavior; leave it off otherwise.",
    "affects": [
      "Snap to Grid state in the LaserDMX Beam Matrix workspace"
    ]
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
    "whenToUse": "Turn Show Grid on when program and canvas should include this behavior; leave it off otherwise.",
    "affects": [
      "Show Grid state in the LaserDMX Beam Matrix workspace"
    ],
    "doesNotAffect": [
      "beam output"
    ]
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
    "whenToUse": "Turn Show Beam Paths on when program and canvas should include this behavior; leave it off otherwise.",
    "affects": [
      "Show Beam Paths state in the LaserDMX Beam Matrix workspace"
    ],
    "doesNotAffect": [
      "beam output"
    ]
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
    "whenToUse": "Adjust Overscan while previewing program and canvas so the result remains readable in motion.",
    "affects": [
      "Overscan value in the LaserDMX Beam Matrix workspace"
    ],
    "defaultValue": "0",
    "range": "0–0.50",
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
    "whenToUse": "Turn Performance Program on when performance program should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Adjust Program Intensity while previewing performance program so the result remains readable in motion.",
    "affects": [
      "Program Intensity value in the active authored performance program"
    ],
    "defaultValue": "100%",
    "range": "0–2.00×",
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
    "whenToUse": "Adjust Variation Amount while previewing performance program so the result remains readable in motion.",
    "affects": [
      "Variation Amount value in the active authored performance program"
    ],
    "defaultValue": "100%",
    "range": "0–2.00×",
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
    "whenToUse": "Turn Audio Intelligence Response on when performance program should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Turn Auto Performance on when performance and led matrix should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Adjust Performance Intensity while previewing performance and led matrix so the result remains readable in motion.",
    "affects": [
      "Performance Intensity value in the PixGrid live performance and LED presentation"
    ],
    "defaultValue": "85%",
    "range": "0–100%",
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
    "whenToUse": "Choose Load Program Preset when performance and led matrix needs a different active option.",
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
    ]
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
    "whenToUse": "Adjust Glow while previewing performance and led matrix so the result remains readable in motion.",
    "affects": [
      "Glow value in the PixGrid live performance and LED presentation"
    ],
    "doesNotAffect": [
      "diffusion"
    ],
    "defaultValue": "34%",
    "range": "0–100%",
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
    "whenToUse": "Adjust Diffusion while previewing performance and led matrix so the result remains readable in motion.",
    "affects": [
      "Diffusion value in the PixGrid live performance and LED presentation"
    ],
    "doesNotAffect": [
      "glow radius"
    ],
    "defaultValue": "12%",
    "range": "0–100%",
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
    "whenToUse": "Turn RGB Subpixel Mode on when performance and led matrix should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Choose Fit when user artwork needs a different active option.",
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
    "whenToUse": "Adjust Position X while previewing user artwork so the result remains readable in motion.",
    "affects": [
      "Position X value in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "50%",
    "range": "0–100%",
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
    "whenToUse": "Adjust Position Y while previewing user artwork so the result remains readable in motion.",
    "affects": [
      "Position Y value in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "50%",
    "range": "0–100%",
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
    "whenToUse": "Adjust Scale while previewing user artwork so the result remains readable in motion.",
    "affects": [
      "Scale value in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "1",
    "range": "0.10–4.00×",
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
    "whenToUse": "Choose Pixel Preparation when user artwork needs a different active option.",
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
    "whenToUse": "Choose Color Mode when user artwork needs a different active option.",
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
    "whenToUse": "Adjust Alpha Threshold while previewing user artwork so the result remains readable in motion.",
    "affects": [
      "Alpha Threshold value in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "4%",
    "range": "0–100%",
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
    "whenToUse": "Turn Preserve Alpha on when user artwork should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Adjust Contrast while previewing user artwork so the result remains readable in motion.",
    "affects": [
      "Contrast value in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "1",
    "range": "0.25–2.00×",
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
    "whenToUse": "Adjust Brightness while previewing user artwork so the result remains readable in motion.",
    "affects": [
      "Brightness value in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "1",
    "range": "0.25–2.00×"
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
    "whenToUse": "Adjust Saturation while previewing user artwork so the result remains readable in motion.",
    "affects": [
      "Saturation value in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "1",
    "range": "0–2.00×"
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
    "whenToUse": "Adjust Edge Enhancement while previewing user artwork so the result remains readable in motion.",
    "affects": [
      "Edge Enhancement value in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "0%",
    "range": "0–100%",
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
    "whenToUse": "Choose Artwork Background when user artwork needs a different active option.",
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
    "whenToUse": "Edit Artwork Background Color when the user artwork item needs different text or metadata.",
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
    "whenToUse": "Adjust Brand Strength while previewing user artwork so the result remains readable in motion.",
    "affects": [
      "Brand Strength value in the selected PixGrid artwork conversion"
    ],
    "defaultValue": "80%",
    "range": "0–100%",
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
    "whenToUse": "Turn Preserve Black on when user artwork should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Turn Preserve White on when user artwork should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Choose Active Scene when design editing context and grid presentation needs a different active option.",
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
    "whenToUse": "Choose Change Performance Program Only when performance program and banks needs a different active option.",
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
    "whenToUse": "Turn Auto Performance on when performance program and banks should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Adjust Performance Intensity while previewing performance program and banks so the result remains readable in motion.",
    "affects": [
      "Performance Intensity value in the PixGrid authored performance program"
    ],
    "defaultValue": "85%",
    "range": "0–100%"
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
    "whenToUse": "Choose Section Plan when performance program and banks needs a different active option.",
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
    "whenToUse": "Adjust Master Intensity while previewing effect controls global so the result remains readable in motion.",
    "affects": [
      "Master Intensity value in the Visualizer global effect layer"
    ],
    "range": "0–100%"
  },
  {
    "id": "visualizer.effects.global.bassReactivity",
    "priority": 1,
    "view": "visualizer",
    "group": "Effect Controls — Global",
    "title": "Bass Reactivity",
    "componentType": "slider",
    "summary": "Sets how strongly the Visualizer’s global effects respond to bass energy.",
    "whatItDoes": [
      "Scales bass-driven modulation applied through the global effect controls."
    ],
    "whenToUse": "Raise it when bass should drive the effect stack more visibly; lower it when global motion becomes unstable.",
    "affects": [
      "global effect bass response"
    ],
    "range": "0–100%"
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
    "whenToUse": "Adjust Reactive Scale while previewing effect controls global so the result remains readable in motion.",
    "affects": [
      "Reactive Scale value in the Visualizer global effect layer"
    ],
    "doesNotAffect": [
      "clip timing"
    ],
    "range": "0–2.00×",
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
    "whenToUse": "Adjust Color Shift while previewing effect controls global so the result remains readable in motion.",
    "affects": [
      "Color Shift value in the Visualizer global effect layer"
    ],
    "range": "0–100%"
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
    "whenToUse": "Adjust Spectrum Bars while previewing effect controls audio reactive so the result remains readable in motion.",
    "affects": [
      "Spectrum Bars value in the Visualizer audio-reactive effect group"
    ],
    "range": "0–100%"
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
    "whenToUse": "Enter an exact Bar Count value when effect controls audio reactive needs precise timing or quantity.",
    "affects": [
      "Bar Count value in the Visualizer audio-reactive effect group"
    ],
    "range": "8–120 bars"
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
    "whenToUse": "Enter an exact Smoothing value when effect controls audio reactive needs precise timing or quantity.",
    "affects": [
      "Smoothing value in the Visualizer audio-reactive effect group"
    ],
    "range": "0–0.95",
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
    "whenToUse": "Turn Mirror on when effect controls audio reactive should include this behavior; leave it off otherwise.",
    "affects": [
      "Mirror state in the Visualizer audio-reactive effect group"
    ],
    "doesNotAffect": [
      "other audio-reactive effects"
    ]
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
    "whenToUse": "Adjust Circular Spectrum while previewing effect controls audio reactive so the result remains readable in motion.",
    "affects": [
      "Circular Spectrum value in the Visualizer audio-reactive effect group"
    ],
    "range": "0–100%"
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
    "whenToUse": "Adjust Oscilloscope while previewing effect controls audio reactive so the result remains readable in motion.",
    "affects": [
      "Oscilloscope value in the Visualizer audio-reactive effect group"
    ],
    "range": "0–100%"
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
    "whenToUse": "Adjust Beat Ring while previewing effect controls audio reactive so the result remains readable in motion.",
    "affects": [
      "Beat Ring value in the Visualizer audio-reactive effect group"
    ],
    "range": "0–100%"
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
    "whenToUse": "Adjust Particle Burst while previewing effect controls audio reactive so the result remains readable in motion.",
    "affects": [
      "Particle Burst value in the Visualizer audio-reactive effect group"
    ],
    "range": "0–100%"
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
    "whenToUse": "Enter an exact Max Particles value when effect controls audio reactive needs precise timing or quantity.",
    "affects": [
      "Max Particles value in the Visualizer audio-reactive effect group"
    ],
    "range": "10–200 particles",
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
    "whenToUse": "Adjust Reactive Grid while previewing effect controls audio reactive so the result remains readable in motion.",
    "affects": [
      "Reactive Grid value in the Visualizer audio-reactive effect group"
    ],
    "range": "0–100%"
  },
  {
    "id": "visualizer.layers.rendering.overview",
    "priority": 1,
    "view": "visualizer",
    "group": "Layers — Rendering stack",
    "title": "Rendering",
    "componentType": "group",
    "summary": "Defines how the texture, character, logo, and overlay layers are composited above the primary media path.",
    "whatItDoes": [
      "Renders the four overlay layers in Texture, Character, Logo, then Overlay order.",
      "Each layer has independent visibility, opacity, blend mode, and assigned media items."
    ],
    "whenToUse": "Use this stack to organize role-based artwork that should render above the primary background media.",
    "affects": [
      "overlay-layer render order",
      "layer visibility",
      "layer blend modes and opacity",
      "assigned layer items"
    ]
  },
  {
    "id": "visualizer.layers.rendering.textureLayer",
    "priority": 1,
    "view": "visualizer",
    "group": "Layers — Rendering stack",
    "title": "Texture Layer",
    "componentType": "group",
    "summary": "Holds texture-role media at the bottom of the overlay layer stack.",
    "whatItDoes": [
      "Renders texture media before the Character, Logo, and Overlay layers.",
      "Uses the layer’s visibility, opacity, blend mode, and assigned items."
    ],
    "whenToUse": "Use this layer for surface detail or full-frame texture artwork that should sit beneath the other overlay layers.",
    "affects": [
      "texture-role media in the overlay compositor"
    ]
  },
  {
    "id": "visualizer.layers.rendering.characterLayer",
    "priority": 1,
    "view": "visualizer",
    "group": "Layers — Rendering stack",
    "title": "Character Layer",
    "componentType": "group",
    "summary": "Holds character art and transparent-element media above the Texture layer.",
    "whatItDoes": [
      "Renders character-role and transparent-element media after Texture and before Logo.",
      "Uses the layer’s visibility, opacity, blend mode, and assigned items."
    ],
    "whenToUse": "Use this layer for people, mascots, cutouts, or other transparent focal artwork.",
    "affects": [
      "character-art and transparent-element media in the overlay compositor"
    ]
  },
  {
    "id": "visualizer.layers.rendering.logoLayer",
    "priority": 1,
    "view": "visualizer",
    "group": "Layers — Rendering stack",
    "title": "Logo Layer",
    "componentType": "group",
    "summary": "Holds logo-role media above the Texture and Character layers.",
    "whatItDoes": [
      "Renders logo media after Character and before the final Overlay layer.",
      "Uses the layer’s visibility, opacity, blend mode, and assigned items."
    ],
    "whenToUse": "Use this layer for branding that should remain above character artwork but below final overlays.",
    "affects": [
      "logo-role media in the overlay compositor"
    ]
  },
  {
    "id": "visualizer.layers.rendering.overlayLayer",
    "priority": 1,
    "view": "visualizer",
    "group": "Layers — Rendering stack",
    "title": "Overlay Layer",
    "componentType": "group",
    "summary": "Holds overlay-role media at the top of the overlay layer stack.",
    "whatItDoes": [
      "Renders overlay media after Texture, Character, and Logo.",
      "Uses the layer’s visibility, opacity, blend mode, and assigned items."
    ],
    "whenToUse": "Use this layer for frames, accents, or finishing artwork that should render above every other overlay layer.",
    "affects": [
      "overlay-role media at the top of the overlay compositor"
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
    "whenToUse": "Turn Layer Visibility on when layers rendering stack should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Choose Layer Blend Mode when layers rendering stack needs a different active option.",
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
    "whenToUse": "Adjust Layer Opacity while previewing layers rendering stack so the result remains readable in motion.",
    "affects": [
      "Layer Opacity value in the Visualizer rendering stack"
    ],
    "defaultValue": "100%",
    "range": "0–100%",
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
    "whenToUse": "Turn Global FX / Audio Reactivity on when layers layer item should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Turn Audio Reactivity on when modulation should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Turn Enable on when timeline color grade should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Adjust Brightness while previewing timeline color grade so the result remains readable in motion.",
    "affects": [
      "Brightness value in the selected timeline source color grade"
    ],
    "defaultValue": "0",
    "range": "−100 to 100"
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
    "whenToUse": "Adjust Contrast while previewing timeline color grade so the result remains readable in motion.",
    "affects": [
      "Contrast value in the selected timeline source color grade"
    ],
    "defaultValue": "0",
    "range": "−100 to 100"
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
    "whenToUse": "Adjust Saturation while previewing timeline color grade so the result remains readable in motion.",
    "affects": [
      "Saturation value in the selected timeline source color grade"
    ],
    "defaultValue": "0",
    "range": "−100 to 100"
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
    "whenToUse": "Adjust Hue while previewing timeline color grade so the result remains readable in motion.",
    "affects": [
      "Hue value in the selected timeline source color grade"
    ],
    "defaultValue": "0°",
    "range": "−180° to 180°"
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
    "whenToUse": "Adjust Temperature while previewing timeline color grade so the result remains readable in motion.",
    "affects": [
      "Temperature value in the selected timeline source color grade"
    ],
    "defaultValue": "0",
    "range": "−100 to 100",
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
    "whenToUse": "Adjust Tint while previewing timeline color grade so the result remains readable in motion.",
    "affects": [
      "Tint value in the selected timeline source color grade"
    ],
    "defaultValue": "0",
    "range": "−100 to 100",
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
    "whenToUse": "Choose Role when timeline background clip inspector needs a different active option.",
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
    "whenToUse": "Enter an exact Start (s) value when timeline background clip inspector needs precise timing or quantity.",
    "affects": [
      "Start (s) value in the selected background timeline clip"
    ],
    "defaultValue": "0 seconds",
    "range": "0 seconds or later"
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
    "whenToUse": "Enter an exact Dur (s) value when timeline background clip inspector needs precise timing or quantity.",
    "affects": [
      "Dur (s) value in the selected background timeline clip"
    ],
    "range": "Minimum clip duration to 3600 seconds"
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
    "whenToUse": "Enter an exact In value when timeline background clip inspector needs precise timing or quantity.",
    "affects": [
      "In value in the selected background timeline clip"
    ],
    "defaultValue": "0 seconds",
    "range": "0 seconds or later"
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
    "whenToUse": "Enter an exact Out value when timeline background clip inspector needs precise timing or quantity.",
    "affects": [
      "Out value in the selected background timeline clip"
    ],
    "defaultValue": "Media end",
    "range": "0 seconds or later"
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
    "whenToUse": "Choose Mode when timeline background clip inspector needs a different active option.",
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
    "whenToUse": "Choose Fit when timeline background clip inspector needs a different active option.",
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
    "whenToUse": "Adjust Size while previewing timeline background clip inspector so the result remains readable in motion.",
    "affects": [
      "Size value in the selected background timeline clip"
    ],
    "defaultValue": "100%",
    "range": "10–300%"
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
    "whenToUse": "Turn Snap to BPM on when timeline background clip inspector should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Turn Enable Global FX on when timeline background clip inspector should include this behavior; leave it off otherwise.",
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
    "title": "Tx In",
    "componentType": "select",
    "summary": "Chooses the transition used when the background clip begins.",
    "whatItDoes": [
      "Stores the selected Transition In option in the selected background timeline clip.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Choose Tx In when timeline background clip inspector needs a different active option.",
    "affects": [
      "Transition In selection in the selected background timeline clip"
    ]
  },
  {
    "id": "visualizer.timeline.backgroundClip.info.transitionOut",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Background Clip Inspector",
    "title": "Tx Out",
    "componentType": "select",
    "summary": "Chooses the transition used when the background clip ends.",
    "whatItDoes": [
      "Stores the selected Transition Out option in the selected background timeline clip.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Choose Tx Out when timeline background clip inspector needs a different active option.",
    "affects": [
      "Transition Out selection in the selected background timeline clip"
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
    "whenToUse": "Choose Role when timeline overlay clip inspector needs a different active option.",
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
    "whenToUse": "Enter an exact Start (s) value when timeline overlay clip inspector needs precise timing or quantity.",
    "affects": [
      "Start (s) value in the selected overlay timeline clip"
    ],
    "defaultValue": "0 seconds",
    "range": "0 seconds or later"
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
    "whenToUse": "Enter an exact Dur (s) value when timeline overlay clip inspector needs precise timing or quantity.",
    "affects": [
      "Dur (s) value in the selected overlay timeline clip"
    ],
    "range": "Minimum clip duration to 3600 seconds"
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
    "whenToUse": "Choose Mode when timeline overlay clip inspector needs a different active option.",
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
    "whenToUse": "Choose Fit when timeline overlay clip inspector needs a different active option.",
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
    "whenToUse": "Turn Snap to BPM on when timeline overlay clip inspector should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Turn Enable Global FX on when timeline overlay clip inspector should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Enter an exact X value when timeline overlay clip inspector needs precise timing or quantity.",
    "affects": [
      "X value in the selected overlay timeline clip"
    ],
    "defaultValue": "0.5",
    "range": "0–1"
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
    "whenToUse": "Enter an exact Y value when timeline overlay clip inspector needs precise timing or quantity.",
    "affects": [
      "Y value in the selected overlay timeline clip"
    ],
    "defaultValue": "0.5",
    "range": "0–1"
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
    "whenToUse": "Enter an exact Scale value when timeline overlay clip inspector needs precise timing or quantity.",
    "affects": [
      "Scale value in the selected overlay timeline clip"
    ],
    "defaultValue": "1",
    "range": "0.01–8×"
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
    "whenToUse": "Enter an exact Rotation value when timeline overlay clip inspector needs precise timing or quantity.",
    "affects": [
      "Rotation value in the selected overlay timeline clip"
    ],
    "defaultValue": "0°",
    "range": "−360° to 360°"
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
    "whenToUse": "Adjust Opacity while previewing timeline overlay clip inspector so the result remains readable in motion.",
    "affects": [
      "Opacity value in the selected overlay timeline clip"
    ],
    "defaultValue": "100%",
    "range": "0–100%",
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
    "whenToUse": "Choose Blend Mode when timeline overlay clip inspector needs a different active option.",
    "affects": [
      "Blend Mode selection in the selected overlay timeline clip"
    ]
  },
  {
    "id": "visualizer.timeline.overlayClip.compositing.transitionIn",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Tx In",
    "componentType": "select",
    "summary": "Chooses the transition used when the overlay begins.",
    "whatItDoes": [
      "Stores the selected Transition In option in the selected overlay timeline clip.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Choose Tx In when timeline overlay clip inspector needs a different active option.",
    "affects": [
      "Transition In selection in the selected overlay timeline clip"
    ]
  },
  {
    "id": "visualizer.timeline.overlayClip.compositing.transitionOut",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Overlay Clip Inspector",
    "title": "Tx Out",
    "componentType": "select",
    "summary": "Chooses the transition used when the overlay ends.",
    "whatItDoes": [
      "Stores the selected Transition Out option in the selected overlay timeline clip.",
      "The owning renderer, editor, or runtime reads the selection on its next update."
    ],
    "whenToUse": "Choose Tx Out when timeline overlay clip inspector needs a different active option.",
    "affects": [
      "Transition Out selection in the selected overlay timeline clip"
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
    "whenToUse": "Choose Effect when timeline effect region inspector needs a different active option.",
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
    "whenToUse": "Turn Enabled on when timeline effect region inspector should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Enter an exact Start value when timeline effect region inspector needs precise timing or quantity.",
    "affects": [
      "Start value in the selected timeline effect region"
    ],
    "defaultValue": "0 seconds",
    "range": "0 seconds or later"
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
    "whenToUse": "Enter an exact Dur (s) value when timeline effect region inspector needs precise timing or quantity.",
    "affects": [
      "Dur (s) value in the selected timeline effect region"
    ],
    "range": "0.25 seconds or longer"
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
    "whenToUse": "Enter an exact Intensity value when timeline effect region inspector needs precise timing or quantity.",
    "affects": [
      "Intensity value in the selected timeline effect region"
    ],
    "defaultValue": "1",
    "range": "0–1"
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
    "whenToUse": "Choose Target when timeline effect region inspector needs a different active option.",
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
    "whenToUse": "Choose Layer when timeline effect region inspector needs a different active option.",
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
    "whenToUse": "Choose Item when timeline effect region inspector needs a different active option.",
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
    "whenToUse": "Choose Clip when timeline effect region inspector needs a different active option.",
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
    "summary": "Aligns audio, background media, overlays, lyrics, effects, and master output controls to one playhead.",
    "whatItDoes": [
      "Uses the audio lane as the timing reference.",
      "Provides shared loop and zoom controls for editing the arrangement."
    ],
    "whenToUse": "Use the timeline to schedule and align visual content against the loaded track.",
    "affects": [
      "timeline transport and editing scale",
      "audio, media, lyric, and effect lanes"
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
    "summary": "Repeats timeline playback within the active loop behavior.",
    "whatItDoes": [
      "Changes transport repetition without altering clip placement or duration."
    ],
    "whenToUse": "Enable it while rehearsing or refining a section that needs repeated playback.",
    "affects": [
      "timeline transport looping"
    ],
    "doesNotAffect": [
      "timeline content or clip timing"
    ]
  },
  {
    "id": "visualizer.timeline.zoom",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Master and transport concepts",
    "title": "Timeline Zoom",
    "componentType": "selection",
    "summary": "Changes the timeline’s horizontal editing scale with the minus and plus controls.",
    "whatItDoes": [
      "Zooms between 25% and 800% while leaving all clip times and durations unchanged."
    ],
    "whenToUse": "Zoom in for precise trims and cue alignment; zoom out to review more of the arrangement.",
    "affects": [
      "timeline horizontal scale"
    ],
    "doesNotAffect": [
      "clip timing",
      "clip duration"
    ],
    "defaultValue": "100%",
    "range": "25–800%",
    "tip": "Zoom in for precise trims and cue alignment; zoom out to review the full arrangement."
  },
  {
    "id": "visualizer.timeline.audioLane",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Master and transport concepts",
    "title": "Audio Lane",
    "componentType": "group",
    "summary": "Displays the loaded track that anchors the Visualizer timeline.",
    "whatItDoes": [
      "Provides the shared time reference for media, lyric, cue, and effect lanes."
    ],
    "whenToUse": "Use it to align visual events with the track waveform and playhead.",
    "affects": [
      "timeline time reference"
    ]
  },
  {
    "id": "visualizer.timeline.backgroundLane",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Master and transport concepts",
    "title": "Video / BG Lane",
    "componentType": "group",
    "summary": "Holds full-frame video and background media clips on the timeline.",
    "whatItDoes": [
      "Schedules background clips beneath overlay, lyric, and effect content."
    ],
    "whenToUse": "Place clips here when they should serve as the visual base layer.",
    "affects": [
      "background media schedule"
    ]
  },
  {
    "id": "visualizer.timeline.overlaysLane",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Master and transport concepts",
    "title": "Overlays Lane",
    "componentType": "group",
    "summary": "Holds composited overlay media clips above the background lane.",
    "whatItDoes": [
      "Schedules positioned, scaled, blended, and opacity-controlled overlay clips."
    ],
    "whenToUse": "Use it for logos, textures, foreground videos, and other layered media.",
    "affects": [
      "overlay media schedule"
    ]
  },
  {
    "id": "visualizer.timeline.lyricsLane",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Master and transport concepts",
    "title": "Lyrics Lane",
    "componentType": "group",
    "summary": "Displays timed lyric cues against the shared timeline.",
    "whatItDoes": [
      "Keeps lyric cue timing aligned with the audio playhead."
    ],
    "whenToUse": "Use it to review lyric timing alongside media and effects.",
    "affects": [
      "timed lyric cue display"
    ]
  },
  {
    "id": "visualizer.timeline.effectsLane",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Master and transport concepts",
    "title": "Effects Lane",
    "componentType": "group",
    "summary": "Schedules effect regions that activate over defined timeline ranges.",
    "whatItDoes": [
      "Shows when targeted or global effect regions begin, end, and overlap."
    ],
    "whenToUse": "Use it to place effects at specific musical moments instead of leaving them active continuously.",
    "affects": [
      "timeline effect-region schedule"
    ]
  },
  {
    "id": "visualizer.timeline.masterColor",
    "priority": 1,
    "view": "visualizer",
    "group": "Timeline — Master and transport concepts",
    "title": "Color (Master Output)",
    "componentType": "group",
    "summary": "Groups color grading and dimmer controls applied to the final Visualizer output.",
    "whatItDoes": [
      "Adjusts master-output color treatment after the timeline layers are composed."
    ],
    "whenToUse": "Use it for final output balancing rather than correcting one individual clip.",
    "affects": [
      "final Visualizer output color and brightness"
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
    "whenToUse": "Adjust Master Dimmer while previewing timeline master and transport concepts so the result remains readable in motion.",
    "affects": [
      "Master Dimmer value in the Visualizer master timeline"
    ],
    "defaultValue": "100%",
    "range": "0–100%"
  },
  {
    "id": "visualizer.recording.record.overview",
    "priority": 1,
    "view": "visualizer",
    "group": "Recording",
    "title": "Record",
    "componentType": "group",
    "summary": "Records the clean visual canvas at the selected frame rate.",
    "whatItDoes": [
      "Captures the canvas without editor panels.",
      "Includes audio only when an active program-audio stream is available."
    ],
    "whenToUse": "Use it to capture a performance-ready video file from the current visual output.",
    "affects": [
      "recording frame rate",
      "recording mode",
      "clean canvas capture"
    ]
  },
  {
    "id": "visualizer.recording.record.targetFps",
    "priority": 1,
    "view": "visualizer",
    "group": "Recording",
    "title": "Target FPS",
    "componentType": "selection",
    "summary": "Chooses whether the recording targets 30 or 60 frames per second.",
    "whatItDoes": [
      "Sets the requested capture frame rate before recording starts."
    ],
    "whenToUse": "Use 30 FPS for lighter capture load or 60 FPS when smoother motion is worth the additional performance cost.",
    "affects": [
      "recording target frame rate"
    ],
    "defaultValue": "30 or 60 FPS",
    "range": "30 or 60 FPS",
    "tip": "Choose 30 FPS for lighter capture load and 60 FPS for fast motion when the live frame rate can sustain it."
  },
  {
    "id": "visualizer.recording.record.audioAvailability",
    "priority": 1,
    "view": "visualizer",
    "group": "Recording",
    "title": "Audio",
    "componentType": "diagnostic",
    "summary": "Reports whether program audio is currently available to the recorder.",
    "whatItDoes": [
      "Shows Available when an active program-audio source is connected; otherwise prompts playback first.",
      "This is a read-only status, not a toggle."
    ],
    "whenToUse": "Check it before recording when the exported video should include audio.",
    "affects": [
      "recording audio-availability status"
    ],
    "doesNotAffect": [
      "audio routing or playback"
    ],
    "tip": "Start playback before recording when audio should be included."
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
    "whenToUse": "Edit Preset Name when the save preset item needs different text or metadata.",
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
    "whenToUse": "Choose Look / Scene Scope when selecting the active item for save preset.",
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
    "whenToUse": "Turn Effects on when save preset should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Turn FX Chain on when save preset should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Turn Modulation on when save preset should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Turn Active Media on when save preset should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Turn Media Order on when save preset should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Turn Audio Source on when save preset should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Turn BPM on when save preset should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Turn BPM Sync on when save preset should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Turn Quality on when save preset should include this behavior; leave it off otherwise.",
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
    "summary": "Sets the playback level of the loaded track.",
    "whatItDoes": [
      "Changes the shared audio deck output level used during playback and capture."
    ],
    "whenToUse": "Adjust it to balance the track against monitoring or recording headroom.",
    "affects": [
      "track playback level"
    ],
    "range": "0–100%",
    "tip": "Leave headroom when effects or recording can add gain later in the output chain."
  },
  {
    "id": "visualizer.audioDeck.bpm",
    "priority": 1,
    "view": "visualizer",
    "group": "Audio Deck",
    "title": "BPM",
    "componentType": "numeric",
    "summary": "Shows or manually overrides the effective tempo used by synchronized timing systems.",
    "whatItDoes": [
      "Keeps the manual override separate from analyzed BPM.",
      "Uses the effective BPM for beat-synced timeline and visual behavior."
    ],
    "whenToUse": "Enter a manual value when analysis is wrong or when a known tempo must drive synchronization.",
    "affects": [
      "effective BPM used by timing systems"
    ],
    "doesNotAffect": [
      "stored analyzed BPM"
    ],
    "range": "40–300 BPM",
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
    "title": "Rekordbox",
    "componentType": "select",
    "summary": "Chooses a Rekordbox import or USB-library action for the Audio Deck.",
    "whatItDoes": [
      "Starts the selected Rekordbox library, XML, or USB workflow.",
      "Imported metadata and cues are handled by the Rekordbox integration."
    ],
    "whenToUse": "Use it when preparing a track from an existing Rekordbox library or USB export.",
    "affects": [
      "Rekordbox import workflow"
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
    "summary": "Enables beat-synchronized timing for compatible Visualizer behavior.",
    "whatItDoes": [
      "Uses the effective BPM as the shared synchronization reference when enabled."
    ],
    "whenToUse": "Turn it on when effects or media timing should follow the track tempo.",
    "affects": [
      "BPM-synchronized Visualizer behavior"
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
    "whenToUse": "Choose Source Mode when ai extraction source needs a different active option.",
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
    "whenToUse": "Choose Saved Vocal Track when ai extraction source needs a different active option.",
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
    "whenToUse": "Enter an exact Vocal Reference Offset (Seconds) value when ai extraction source needs precise timing or quantity.",
    "affects": [
      "Vocal Reference Offset (Seconds) value in the lyric extraction source"
    ],
    "doesNotAffect": [
      "source audio"
    ],
    "defaultValue": "0 seconds",
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
    "whenToUse": "Choose Add Vocal Track when selecting the active item for ai extraction source.",
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
    "whenToUse": "Turn I reviewed the arrangement and confirm this vocal reference belongs to the selected full mix on when ai extraction source should include this behavior; leave it off otherwise.",
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
    "whenToUse": "Choose Language when ai extraction settings needs a different active option.",
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
    "whenToUse": "Choose Timing Detail when ai extraction settings needs a different active option.",
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
    "whenToUse": "Choose Cue Style when ai extraction settings needs a different active option.",
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
    "whenToUse": "Enter an exact Global Offset ms value when ai extraction settings needs precise timing or quantity.",
    "affects": [
      "Global Offset ms value in the lyric extraction request"
    ],
    "doesNotAffect": [
      "source audio"
    ],
    "defaultValue": "0 ms",
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
    "whenToUse": "Edit Title when the manual editor document info item needs different text or metadata.",
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
    "whenToUse": "Edit Artist when the manual editor document info item needs different text or metadata.",
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
    "summary": "Chooses the timing grid used when moving or resizing lyric cues.",
    "whatItDoes": [
      "Quantizes cue edits to the selected timing resolution."
    ],
    "whenToUse": "Use snapping for beat-aligned lyrics; choose None for free timing adjustments.",
    "affects": [
      "lyric cue edit quantization"
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
    "summary": "Sets the shared waveform scale used by the lyric cue editor.",
    "whatItDoes": [
      "Changes editing magnification without changing cue timestamps."
    ],
    "whenToUse": "Zoom in for word-level timing and out for phrase or section-level review.",
    "affects": [
      "lyric editor waveform scale"
    ],
    "doesNotAffect": [
      "cue timing"
    ],
    "defaultValue": "1×",
    "range": "1×–16×",
    "tip": "Zoom in before editing short words or tightly packed cues."
  },
  {
    "id": "lyricManager.cueEditor.overlays.overview",
    "priority": 1,
    "view": "lyricManager",
    "group": "Cue Editor Toolbar and Filters",
    "title": "Overlays",
    "componentType": "group",
    "summary": "Controls which structural timing markers and ranges are visible in the lyric cue editor.",
    "whatItDoes": [
      "Groups the Beats, Downbeats, Bars, Landmarks, Phrases, and Sections visibility toggles.",
      "Changes only the editing overlay, not the underlying track analysis."
    ],
    "whenToUse": "Show the marker types needed for the current timing task and hide the rest when the waveform becomes crowded.",
    "affects": [
      "lyric editor timeline overlay visibility"
    ],
    "doesNotAffect": [
      "stored music-intelligence analysis",
      "lyric cue timestamps"
    ]
  },
  {
    "id": "lyricManager.cueEditor.overlays.beats",
    "priority": 1,
    "view": "lyricManager",
    "group": "Cue Editor Toolbar and Filters",
    "title": "Beats",
    "componentType": "toggle",
    "summary": "Shows or hides individual beat markers over the lyric timeline.",
    "whatItDoes": [
      "Filters beat markers from the timeline overlay without changing the detected beat grid."
    ],
    "whenToUse": "Show beats while aligning cue starts or word timing to the pulse.",
    "affects": [
      "beat-marker visibility in the lyric cue editor"
    ],
    "doesNotAffect": [
      "detected beat timing"
    ],
    "defaultValue": "On"
  },
  {
    "id": "lyricManager.cueEditor.overlays.downbeats",
    "priority": 1,
    "view": "lyricManager",
    "group": "Cue Editor Toolbar and Filters",
    "title": "Downbeats",
    "componentType": "toggle",
    "summary": "Shows or hides downbeat markers over the lyric timeline.",
    "whatItDoes": [
      "Filters detected downbeats from the timeline overlay without changing their analysis."
    ],
    "whenToUse": "Show downbeats when aligning lyrics to bar starts or phrase entrances.",
    "affects": [
      "downbeat-marker visibility in the lyric cue editor"
    ],
    "doesNotAffect": [
      "detected downbeat timing"
    ],
    "defaultValue": "On"
  },
  {
    "id": "lyricManager.cueEditor.overlays.bars",
    "priority": 1,
    "view": "lyricManager",
    "group": "Cue Editor Toolbar and Filters",
    "title": "Bars",
    "componentType": "toggle",
    "summary": "Shows or hides bar markers over the lyric timeline.",
    "whatItDoes": [
      "Filters bar markers from the timeline overlay without changing the analyzed bar grid."
    ],
    "whenToUse": "Show bars when checking phrase lengths or placing cues on measure boundaries.",
    "affects": [
      "bar-marker visibility in the lyric cue editor"
    ],
    "doesNotAffect": [
      "analyzed bar timing"
    ],
    "defaultValue": "On"
  },
  {
    "id": "lyricManager.cueEditor.overlays.landmarks",
    "priority": 1,
    "view": "lyricManager",
    "group": "Cue Editor Toolbar and Filters",
    "title": "Landmarks",
    "componentType": "toggle",
    "summary": "Shows or hides four-, eight-, and sixteen-bar structural landmarks.",
    "whatItDoes": [
      "Filters multi-bar landmark markers from the timeline overlay."
    ],
    "whenToUse": "Show landmarks when reviewing larger musical blocks or planning phrase-level cue timing.",
    "affects": [
      "multi-bar landmark visibility in the lyric cue editor"
    ],
    "doesNotAffect": [
      "landmark analysis"
    ],
    "defaultValue": "On"
  },
  {
    "id": "lyricManager.cueEditor.overlays.phrases",
    "priority": 1,
    "view": "lyricManager",
    "group": "Cue Editor Toolbar and Filters",
    "title": "Phrases",
    "componentType": "toggle",
    "summary": "Shows or hides analyzed phrase markers over the lyric timeline.",
    "whatItDoes": [
      "Filters phrase markers from the timeline overlay without changing phrase analysis."
    ],
    "whenToUse": "Show phrases when aligning lyric sections and cues to musical phrase boundaries.",
    "affects": [
      "phrase-marker visibility in the lyric cue editor"
    ],
    "doesNotAffect": [
      "analyzed phrase timing"
    ],
    "defaultValue": "On"
  },
  {
    "id": "lyricManager.cueEditor.overlays.sections",
    "priority": 1,
    "view": "lyricManager",
    "group": "Cue Editor Toolbar and Filters",
    "title": "Sections",
    "componentType": "toggle",
    "summary": "Shows or hides analyzed track-section ranges over the lyric timeline.",
    "whatItDoes": [
      "Filters section ranges from the timeline overlay without changing section analysis."
    ],
    "whenToUse": "Show sections when reviewing cue placement across intros, builds, drops, breakdowns, and outros.",
    "affects": [
      "track-section range visibility in the lyric cue editor"
    ],
    "doesNotAffect": [
      "section boundaries or labels"
    ],
    "defaultValue": "On"
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
    "whenToUse": "Choose Filter when cue editor toolbar and filters needs a different active option.",
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
    "summary": "Edits the selected lyric cue’s text, timing, confidence, source, review state, and section association.",
    "whatItDoes": [
      "Writes validated changes to the selected cue and surfaces any timing warnings."
    ],
    "whenToUse": "Use it when one cue needs correction after extraction or manual timing.",
    "affects": [
      "selected lyric cue"
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
    "whenToUse": "Edit Text when the selected cue item needs different text or metadata.",
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
    "whenToUse": "Enter an exact Start (ms) value when selected cue needs precise timing or quantity.",
    "affects": [
      "Start (ms) value in the selected lyric cue"
    ],
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
    "whenToUse": "Enter an exact End (ms) value when selected cue needs precise timing or quantity.",
    "affects": [
      "End (ms) value in the selected lyric cue"
    ],
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
    "whenToUse": "Enter an exact Duration (ms) value when selected cue needs precise timing or quantity.",
    "affects": [
      "Duration (ms) value in the selected lyric cue"
    ],
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
    "whenToUse": "Enter an exact Confidence (0–1) value when selected cue needs precise timing or quantity.",
    "affects": [
      "Confidence (0–1) value in the selected lyric cue"
    ],
    "defaultValue": "Unset when unavailable",
    "range": "0–1",
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
    "whenToUse": "Choose Source when selected cue needs a different active option.",
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
    "whenToUse": "Choose Review Status when selected cue needs a different active option.",
    "affects": [
      "Review Status selection in the selected lyric cue"
    ]
  },
  {
    "id": "lyricManager.cueInspector.selectedCue.section",
    "priority": 1,
    "view": "lyricManager",
    "group": "Selected Cue",
    "title": "Section association",
    "componentType": "select",
    "summary": "Associates the selected lyric cue with a track section.",
    "whatItDoes": [
      "Stores the cue-to-section relationship used for organization and section-aware workflows."
    ],
    "whenToUse": "Choose a section when the cue should be grouped with a specific part of the song.",
    "affects": [
      "selected cue section association"
    ]
  },
  {
    "id": "lyricManager.cueInspector.selectedCue.warningFlags",
    "priority": 1,
    "view": "lyricManager",
    "group": "Selected Cue",
    "title": "Warnings",
    "componentType": "group",
    "summary": "Summarizes validation warnings for the selected lyric cue.",
    "whatItDoes": [
      "Reports timing or data conditions that may require review.",
      "The heading is read-only; corrections are made in the cue fields."
    ],
    "whenToUse": "Review it before approving a cue that was imported or automatically extracted.",
    "affects": [
      "displayed cue validation status"
    ],
    "doesNotAffect": [
      "cue timing or text"
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
    "summary": "Edits the repeated word-level text and timing rows for the selected cue.",
    "whatItDoes": [
      "Provides one shared explanation for each word’s text, start, and end fields."
    ],
    "whenToUse": "Use it when phrase timing is correct but individual words need tighter alignment.",
    "affects": [
      "selected cue word timings"
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
    "whenToUse": "Edit Track Title when the upload / edit media core metadata item needs different text or metadata.",
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
    "whenToUse": "Edit Title when the upload / edit media core metadata item needs different text or metadata.",
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
    "whenToUse": "Edit Artist when the upload / edit media core metadata item needs different text or metadata.",
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
    "whenToUse": "Edit Genre when the upload / edit media core metadata item needs different text or metadata.",
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
    "whenToUse": "Enter an exact BPM value when upload / edit media core metadata needs precise timing or quantity.",
    "affects": [
      "BPM value in the media item being uploaded or edited"
    ],
    "defaultValue": "Unset",
    "recommendedRange": "Match the verified track BPM.",
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
    "whenToUse": "Enter an exact BPM value when upload / edit media additional info needs precise timing or quantity.",
    "affects": [
      "BPM value in the media item’s additional metadata"
    ],
    "defaultValue": "Unset",
    "recommendedRange": "Match the verified track BPM."
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
    "whenToUse": "Edit Title when the edit audio track item needs different text or metadata.",
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
    "whenToUse": "Edit Artist when the edit audio track item needs different text or metadata.",
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
    "whenToUse": "Edit Genre when the edit audio track item needs different text or metadata.",
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
    "whenToUse": "Enter an exact BPM value when edit audio track needs precise timing or quantity.",
    "affects": [
      "BPM value in the saved audio track metadata"
    ],
    "defaultValue": "Unset",
    "recommendedRange": "Match the verified track BPM.",
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
    "whenToUse": "Choose Musical Key when edit audio track needs a different active option.",
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
    "summary": "Browses saved media by type and collection context.",
    "whatItDoes": [
      "Uses media-type tabs to filter the browser.",
      "Opening a collection changes the visible browsing context."
    ],
    "whenToUse": "Use it to locate media for editing, selection, or assignment elsewhere in DRMVYZ.",
    "affects": [
      "visible Media Library results and collection context"
    ],
    "doesNotAffect": [
      "stored media metadata or collection membership"
    ],
    "relatedHelpIds": [
      "mediaManager.library.mediaTypeFilter",
      "mediaManager.library.collectionFilter"
    ]
  },
  {
    "id": "mediaManager.library.mediaTypeFilter",
    "priority": 1,
    "view": "mediaManager",
    "group": "Library Browser",
    "title": "Media Type Tabs",
    "componentType": "selection",
    "summary": "Filters the Media Library using the displayed media-type tabs.",
    "whatItDoes": [
      "Changes which broad category of library items is visible.",
      "Selecting a tab does not edit the matching media."
    ],
    "whenToUse": "Choose a tab to narrow the browser before searching or opening a collection.",
    "affects": [
      "visible Media Library category"
    ],
    "doesNotAffect": [
      "media metadata"
    ],
    "tip": "Clear filters before concluding that a media item is missing."
  },
  {
    "id": "mediaManager.library.collectionFilter",
    "priority": 1,
    "view": "mediaManager",
    "group": "Library Browser",
    "title": "Collection Browser Context",
    "componentType": "selection",
    "summary": "Shows the collection list or the contents of the collection currently opened in the browser.",
    "whatItDoes": [
      "Changes browser scope through collection navigation rather than a standalone dropdown."
    ],
    "whenToUse": "Open a collection when you need to browse only the media grouped inside it.",
    "affects": [
      "active Media Library collection context"
    ],
    "doesNotAffect": [
      "collection membership"
    ],
    "tip": "Open the collection itself to review its contents; changing the view does not change membership."
  },
  {
    "id": "react.shared.performancePads.overview",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Lower workspace",
    "title": "Performance Pads",
    "componentType": "group",
    "summary": "Provides immediate performance actions for the active visual engine.",
    "whatItDoes": [
      "Presents the momentary actions and latchable performance controls supported by the current engine.",
      "Routes each pad through the active engine's existing performance-action system rather than creating a separate automation path."
    ],
    "whenToUse": "Open Performance Pads during rehearsal or live playback when you want to trigger accents, transitions, or temporary visual states by hand.",
    "affects": [
      "active engine performance actions",
      "latched performance-pad states"
    ],
    "doesNotAffect": [
      "Track Map section boundaries",
      "audio playback position"
    ],
    "relatedHelpIds": [
      "react.shared.trackMap.overview"
    ]
  },
  {
    "id": "react.shared.lowerWorkspace.outputActions",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Lower workspace",
    "title": "Output and Stage Focus",
    "componentType": "group",
    "summary": "Controls where the live visual output is shown and how much workspace chrome remains visible.",
    "whatItDoes": [
      "The output control opens the app's display-sharing or casting workflow for the live visual canvas.",
      "Stage Focus enlarges the live output area by temporarily hiding workspace rails and timeline surfaces."
    ],
    "whenToUse": "Use these controls when sending the visualizer to another display or when you need an uncluttered performance view.",
    "affects": [
      "live-output presentation",
      "React workspace visibility"
    ],
    "doesNotAffect": [
      "the selected engine or preset",
      "saved visual parameters"
    ]
  },
  {
    "id": "react.shared.trackMap.beatGridLane",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Beat Grid Lane",
    "componentType": "timeline",
    "summary": "Displays the analyzed beat positions across the current Track Map viewport.",
    "whatItDoes": [
      "Provides a musical timing reference for section boundaries, cues, and other timeline edits.",
      "The On or Off control changes only whether the beat markers are visible in this lane."
    ],
    "whenToUse": "Use the beat lane while aligning edits to beats, bars, and rhythmic changes in the loaded track.",
    "affects": [
      "visible Track Map timing reference"
    ],
    "doesNotAffect": [
      "the analyzed beat data",
      "audio playback timing"
    ],
    "relatedHelpIds": [
      "react.shared.trackMap.beatGrid",
      "react.shared.trackMap.overview"
    ]
  },
  {
    "id": "react.shared.trackMap.sectionsLane",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Track Sections Lane",
    "componentType": "trackSection",
    "summary": "Shows the analyzed and manually authored song sections across the current timeline range.",
    "whatItDoes": [
      "Selecting a section opens its editing controls and exposes its type, label, boundaries, intensity, and visual assignment.",
      "The lane tools undo the latest section edit, clear sections, or create a new manual section."
    ],
    "whenToUse": "Use this lane to correct song structure, define performance regions, or inspect which section is active at a given time.",
    "affects": [
      "manual Track Map sections",
      "section-aware engine context"
    ],
    "doesNotAffect": [
      "the source audio file",
      "beat-analysis results"
    ],
    "relatedHelpIds": [
      "react.shared.trackMap.sectionEditor.overview",
      "react.shared.trackMap.newSection.overview",
      "react.shared.trackMap.overview"
    ]
  },
  {
    "id": "react.shared.trackMap.cuesLane",
    "priority": 1,
    "view": "react",
    "engine": "shared",
    "group": "Track Map",
    "title": "Cues and Presets Lane",
    "componentType": "timeline",
    "summary": "Collects cue points, section-linked preset assignments, musical landmarks, and PixGrid action cues on one lane.",
    "whatItDoes": [
      "Shows when authored or imported cue events occur relative to the track.",
      "Cue interactions can seek playback, open an editable cue, or create a PixGrid action cue when that workflow is available."
    ],
    "whenToUse": "Use this lane to review performance triggers and visual handoffs without changing the section timeline above it.",
    "affects": [
      "cue markers and cue-driven visual actions"
    ],
    "doesNotAffect": [
      "Track Map section boundaries",
      "the underlying audio analysis"
    ],
    "relatedHelpIds": [
      "react.shared.trackMap.visualAssignment.overview",
      "react.shared.trackMap.overview"
    ]
  },
  {
    "id": "visualizer.audioDeck.trackPlayer",
    "priority": 1,
    "view": "visualizer",
    "group": "Audio Deck",
    "title": "Track Player",
    "componentType": "group",
    "summary": "Loads the active audio track and provides its primary transport and volume controls.",
    "whatItDoes": [
      "Shows the current track identity and lets you load or replace the track from the artwork area.",
      "Provides previous, play or pause, next, and track-volume controls for the shared audio engine."
    ],
    "whenToUse": "Use the player whenever you need to load a track, control playback, or balance the track level feeding DRMVYZ.",
    "affects": [
      "active audio track",
      "shared playback state",
      "track volume"
    ],
    "doesNotAffect": [
      "master visual intensity",
      "saved preset parameters"
    ],
    "relatedHelpIds": [
      "visualizer.audioDeck.trackVolume"
    ]
  },
  {
    "id": "visualizer.audioDeck.waveform",
    "priority": 1,
    "view": "visualizer",
    "group": "Audio Deck",
    "title": "Track Waveform",
    "componentType": "visualization",
    "summary": "Displays the current track, playhead, and cue markers in a navigable waveform view.",
    "whatItDoes": [
      "Provides a visual reference for playback position and the track's changing amplitude or frequency content.",
      "Supports seeking and cue-point authoring, and follows the same centered viewport as Track Map when unified-timeline mode is active.",
      "The plus and minus controls change waveform zoom without changing the audio itself."
    ],
    "whenToUse": "Use the waveform to navigate the track precisely, inspect cue placement, or zoom into a smaller musical region.",
    "affects": [
      "playback position when seeking",
      "waveform zoom",
      "manual cue markers when edited"
    ],
    "doesNotAffect": [
      "audio-file content",
      "Track Map section definitions"
    ]
  },
  {
    "id": "visualizer.audioDeck.tempoAndSync",
    "priority": 1,
    "view": "visualizer",
    "group": "Audio Deck",
    "title": "Tempo, Rekordbox, Cue, and Sync",
    "componentType": "group",
    "summary": "Groups the timing and DJ-integration controls used to align the active track with DRMVYZ.",
    "whatItDoes": [
      "Shows the effective BPM and provides BPM stepping, direct editing, tap tempo, and reset or reanalysis actions when available.",
      "Rekordbox tools import or scan compatible metadata without replacing the app's shared audio engine.",
      "Cue stores or recalls the deck cue point, while Sync enables the app's BPM-synchronized visual timing."
    ],
    "whenToUse": "Use this area when the detected tempo needs correction, when importing Rekordbox metadata, or when enabling beat-synchronized visuals.",
    "affects": [
      "effective track BPM",
      "deck cue point",
      "BPM Sync state",
      "matched Rekordbox metadata"
    ],
    "doesNotAffect": [
      "the original audio file",
      "unrelated visual parameters"
    ],
    "relatedHelpIds": [
      "visualizer.audioDeck.bpm",
      "visualizer.audioDeck.rekordboxAction",
      "visualizer.audioDeck.bpmSync"
    ]
  }
] as const satisfies readonly HelpEntry[]

export type HelpId = (typeof PRIORITY_ONE_HELP_ENTRIES)[number]['id']

export type HelpRegistryValidationCode =
  | 'duplicate-id'
  | 'registry-key-mismatch'
  | 'registry-entry-missing'
  | 'invalid-priority'
  | 'invalid-component-type'
  | 'empty-required-string'
  | 'empty-optional-string'
  | 'empty-optional-array'
  | 'empty-array-item'
  | 'invalid-related-help-id'
  | 'self-related-help-id'
  | 'duplicate-related-help-id'
  | 'unresolved-audit-mismatch'

export interface HelpRegistryValidationIssue {
  code: HelpRegistryValidationCode
  message: string
  helpId?: string
}

const warnedMissingHelpIds = new Set<string>()

function buildHelpRegistry(entries: readonly HelpEntry[]): Readonly<Record<HelpId, HelpEntry>> {
  const registry = {} as Record<HelpId, HelpEntry>

  for (const entry of entries) {
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

function buildLooseRegistry(entries: readonly HelpEntry[]): Readonly<Record<string, HelpEntry>> {
  const registry: Record<string, HelpEntry> = {}
  for (const entry of entries) registry[entry.id] = entry
  return registry
}

export function validateHelpRegistry(
  entries: readonly HelpEntry[] = PRIORITY_ONE_HELP_ENTRIES,
  registry: Readonly<Record<string, HelpEntry>> = buildLooseRegistry(entries),
): readonly HelpRegistryValidationIssue[] {
  const issues: HelpRegistryValidationIssue[] = []
  const validPriorities = new Set<number>(HELP_PRIORITIES)
  const validComponentTypes = new Set<string>(HELP_COMPONENT_TYPES)
  const ids = new Set<string>()
  const duplicateIds = new Set<string>()
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

  const addIssue = (
    code: HelpRegistryValidationCode,
    message: string,
    helpId?: string,
  ) => issues.push({ code, message, helpId })

  for (const entry of entries) {
    if (ids.has(entry.id)) duplicateIds.add(entry.id)
    ids.add(entry.id)
  }

  for (const duplicateId of duplicateIds) {
    addIssue('duplicate-id', `Duplicate help id: ${duplicateId}`, duplicateId)
  }

  for (const [registryKey, entry] of Object.entries(registry)) {
    if (registryKey !== entry.id) {
      addIssue(
        'registry-key-mismatch',
        `Registry key "${registryKey}" does not match entry id "${entry.id}".`,
        entry.id,
      )
    }
  }

  for (const entry of entries) {
    if (!Object.prototype.hasOwnProperty.call(registry, entry.id)) {
      addIssue(
        'registry-entry-missing',
        `Registry does not contain entry "${entry.id}".`,
        entry.id,
      )
    }

    if (!validPriorities.has(entry.priority)) {
      addIssue(
        'invalid-priority',
        `Invalid priority for ${entry.id}: ${String(entry.priority)}`,
        entry.id,
      )
    }

    if (!validComponentTypes.has(entry.componentType)) {
      addIssue(
        'invalid-component-type',
        `Invalid component type for ${entry.id}: ${String(entry.componentType)}`,
        entry.id,
      )
    }

    for (const [field, value] of [
      ['id', entry.id],
      ['group', entry.group],
      ['title', entry.title],
      ['summary', entry.summary],
    ] as const) {
      if (!value.trim()) {
        addIssue(
          'empty-required-string',
          `Empty required field "${field}" for ${entry.id || '(missing id)'}.`,
          entry.id || undefined,
        )
      }
    }

    for (const field of optionalStringFields) {
      const value = entry[field]
      if (value !== undefined && !value.trim()) {
        addIssue(
          'empty-optional-string',
          `Optional field "${field}" is empty for ${entry.id}.`,
          entry.id,
        )
      }
    }

    for (const field of optionalArrayFields) {
      const values = entry[field]
      if (values === undefined) continue
      if (values.length === 0) {
        addIssue(
          'empty-optional-array',
          `Optional field "${field}" is an empty array for ${entry.id}.`,
          entry.id,
        )
      }
      if (values.some((value) => !value.trim())) {
        addIssue(
          'empty-array-item',
          `Optional field "${field}" contains an empty item for ${entry.id}.`,
          entry.id,
        )
      }
    }

    const relatedHelpIds = entry.relatedHelpIds ?? []
    const seenRelatedHelpIds = new Set<string>()
    for (const relatedHelpId of relatedHelpIds) {
      if (relatedHelpId === entry.id) {
        addIssue(
          'self-related-help-id',
          `Entry "${entry.id}" references itself in relatedHelpIds.`,
          entry.id,
        )
      }
      if (seenRelatedHelpIds.has(relatedHelpId)) {
        addIssue(
          'duplicate-related-help-id',
          `Entry "${entry.id}" repeats relatedHelpId "${relatedHelpId}".`,
          entry.id,
        )
      }
      seenRelatedHelpIds.add(relatedHelpId)
      if (!ids.has(relatedHelpId)) {
        addIssue(
          'invalid-related-help-id',
          `Invalid relatedHelpId "${relatedHelpId}" referenced by "${entry.id}".`,
          entry.id,
        )
      }
    }

    const unresolvedAuditTag = entry.tags?.some(
      (tag) => tag === 'auditMismatch' || tag.startsWith('auditMismatch:'),
    )
    if (entry.auditMismatch !== undefined || unresolvedAuditTag) {
      addIssue(
        'unresolved-audit-mismatch',
        `Entry "${entry.id}" carries an unresolved auditMismatch marker.`,
        entry.id,
      )
    }
  }

  return issues
}

if (import.meta.env.DEV) {
  for (const issue of validateHelpRegistry(PRIORITY_ONE_HELP_ENTRIES, HELP_CENTER)) {
    console.warn(`[HelpCenter] ${issue.message}`)
  }
}
