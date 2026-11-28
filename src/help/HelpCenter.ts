/**
 * Bundled contextual-help content for DRMVYZ.
 *
 * This registry intentionally documents controls and workflows, not the
 * descriptions owned by selectable presets, scenes, worlds, media, or shows.
 * It is UI-neutral so a later HelpTrigger can adapt entries to InfoPopover.
 */

export const HELP_PRIORITIES = [1, 2, 3, 4] as const

export type HelpPriority = (typeof HELP_PRIORITIES)[number]

/** The part of the app an entry belongs to. 'react' is the performance workspace (its engine is in `HelpEngine`); the rest are
 * the manager workspaces and the Settings dialog. */
export type HelpView =
  | 'react'
  | 'performanceManager'
  | 'presetManager'
  | 'showManager'
  | 'lyricManager'
  | 'mediaManager'
  | 'settings'

export type HelpEngine =
  | 'shared'
  | 'cinema2'
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
      "Cinema is the public home for former Shader Pads scenes and Cinematic Worlds content."
    ],
    "whenToUse": "Switch engines when moving to a different visual workflow, such as Cinema, Sound Drawing, CANVAS, LaserDMX, or PixGrid. Use Cinema for former Shader Pads and Cinematic Worlds content.",
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
      "Live Input listens to the default computer microphone for analysis without monitoring it to program output, while Demo Signal provides a generated source for testing without a track."
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
    "tip": "Use Demo Signal to confirm that a visual reacts before troubleshooting a track file or Live Input connection."
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
    "id": "react.canvas.workspace.tabs",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS workspace",
    "title": "CANVAS Source",
    "componentType": "selection",
    "summary": "Opens the CANVAS source workspace where saved media, the performance pool, and media roles are managed.",
    "whatItDoes": [
      "Keeps CANVAS media ownership in the left rail while the center remains a render surface.",
      "Shows the media sources that presets, Auto Select, and Performance Orchestration may use."
    ],
    "whenToUse": "Use Source before adjusting CANVAS presets or reactive controls so the engine has media to render.",
    "affects": [
      "active CANVAS media",
      "performance media pool",
      "media role assignments"
    ],
    "doesNotAffect": [
      "the source files stored in the shared media library"
    ],
    "relatedHelpIds": [
      "react.canvas.source.mediaLibrary",
      "react.canvas.presetLibrary"
    ]
  },
  {
    "id": "react.canvas.source.mediaLibrary",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS workspace",
    "title": "CANVAS Media Library",
    "componentType": "selection",
    "summary": "Selects the saved video, image, or SVG that CANVAS renders and manages for authored performances.",
    "whatItDoes": [
      "Filters the shared media library to formats supported by CANVAS.",
      "Lets a source become active, join the deterministic performance pool, and receive explicit layer roles."
    ],
    "whenToUse": "Choose media here before loading a CANVAS preset, enabling particles, or starting Auto Performance.",
    "affects": [
      "active CANVAS source",
      "performance pool membership",
      "automatic and explicit media roles"
    ],
    "doesNotAffect": [
      "the original uploaded file",
      "media used by other engines"
    ],
    "tip": "Add several compatible sources to the Performance Pool when Performance Orchestration should cut or transition between media."
  },
  {
    "id": "react.canvas.presetLibrary",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS presets",
    "title": "CANVAS Presets",
    "componentType": "selection",
    "summary": "Loads a CANVAS visual recipe that transforms the active media without replacing the media itself.",
    "whatItDoes": [
      "Selects a built-in CANVAS recipe such as clean playback, particles, fractures, or laser image treatment.",
      "Updates the CANVAS React Controls to the selected recipe values."
    ],
    "whenToUse": "Choose a preset after selecting media, then refine the recipe in the React tab.",
    "affects": [
      "selected CANVAS recipe",
      "CANVAS reactive and effect parameters"
    ],
    "doesNotAffect": [
      "active media selection",
      "Display transform and output opacity"
    ],
    "relatedHelpIds": [
      "react.canvas.reactControls.overview",
      "react.canvas.source.mediaLibrary"
    ]
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
    "id": "react.canvas.reactControls.fx.glowAmount",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS React Controls — FX",
    "title": "Glow Amount",
    "componentType": "slider",
    "summary": "Sets the strength of the luminous aura and highlight bloom around the processed CANVAS source.",
    "whatItDoes": [
      "Raises the recipe glow and particle-aura brightness without changing the source file.",
      "Works with Visual Intensity and audio reactivity to determine the final visible glow."
    ],
    "whenToUse": "Increase Glow Amount when the source needs a brighter halo or reduce it when edges lose definition.",
    "affects": [
      "CANVAS glow and aura strength"
    ],
    "doesNotAffect": [
      "Canvas Output Opacity"
    ],
    "range": "0–100%",
    "tip": "Pair moderate glow with Trail Amount for motion that remains crisp instead of becoming a foggy smear."
  },
  {
    "id": "react.canvas.reactControls.fx.trailAmount",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS React Controls — FX",
    "title": "Trail Amount",
    "componentType": "slider",
    "summary": "Controls how strongly previous source positions remain visible as motion trails.",
    "whatItDoes": [
      "Adds offset echo layers behind the current CANVAS frame.",
      "Scales the persistence and distance of the recipe trail treatment."
    ],
    "whenToUse": "Raise it for flowing echoes and lower it when fast motion becomes difficult to read.",
    "affects": [
      "CANVAS frame trails and echo layers"
    ],
    "range": "0–100%"
  },
  {
    "id": "react.canvas.reactControls.fx.rgbSplit",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS React Controls — FX",
    "title": "RGB Split",
    "componentType": "slider",
    "summary": "Offsets color channels around the CANVAS source to create chromatic edge separation.",
    "whatItDoes": [
      "Separates cyan and magenta edge layers from the original frame.",
      "Leaves the selected source and its media metadata unchanged."
    ],
    "whenToUse": "Use small values for dimensional edges and larger values for an intentionally fractured digital look.",
    "affects": [
      "CANVAS chromatic channel offset"
    ],
    "range": "0–100%",
    "tip": "RGB Split reads most clearly on high-contrast edges and transparent media."
  },
  {
    "id": "react.canvas.reactControls.fx.glitchAmount",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS React Controls — FX",
    "title": "Glitch Amount",
    "componentType": "slider",
    "summary": "Sets the strength of digital displacement and glitch overlays in the selected CANVAS recipe.",
    "whatItDoes": [
      "Scales frame offsets, glitch layers, and related contrast treatment.",
      "Can combine with Beat Pulse and Stutter Rate for rhythm-driven interruption."
    ],
    "whenToUse": "Raise it for deliberate digital breakup and reduce it when the source identity is being lost.",
    "affects": [
      "CANVAS glitch displacement and overlays"
    ],
    "range": "0–100%"
  },
  {
    "id": "react.canvas.reactControls.fx.stutterRate",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS React Controls — FX",
    "title": "Stutter Rate",
    "componentType": "slider",
    "summary": "Sets how many stepped frame holds CANVAS may apply each second.",
    "whatItDoes": [
      "Quantizes visible source updates into repeated frame holds.",
      "A value of zero disables the stutter treatment."
    ],
    "whenToUse": "Use low rates for chunky freezes and higher rates for rapid rhythmic stepping.",
    "affects": [
      "CANVAS frame-hold cadence"
    ],
    "defaultValue": "Off",
    "range": "0–12 holds per second",
    "tip": "Combine Stutter Rate with Beat Pulse rather than maxing both controls when the rhythm should remain legible."
  },
  {
    "id": "react.canvas.reactControls.fx.lumaThreshold",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS React Controls — FX",
    "title": "Luma Threshold",
    "componentType": "slider",
    "summary": "Sets the brightness cutoff used by CANVAS luma smear and melt treatments.",
    "whatItDoes": [
      "Determines which bright or dark areas participate in luma-driven processing.",
      "Changes the mask threshold without editing the source media."
    ],
    "whenToUse": "Move the threshold until the desired highlights or silhouettes drive the effect.",
    "affects": [
      "CANVAS luma mask and smear response"
    ],
    "range": "0–100%"
  },
  {
    "id": "react.canvas.reactControls.motionAndParticles.motionAmount",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS React Controls — Motion + Particles",
    "title": "Motion Amount",
    "componentType": "slider",
    "summary": "Sets the overall strength of recipe-driven movement and motion treatment.",
    "whatItDoes": [
      "Scales source motion, luma movement, and related recipe animation.",
      "Works independently from the static Display position and rotation controls."
    ],
    "whenToUse": "Raise it when the media feels static or lower it when authored motion in the source should remain dominant.",
    "affects": [
      "CANVAS recipe motion strength"
    ],
    "doesNotAffect": [
      "Display Position X",
      "Display Position Y",
      "Display Rotation"
    ],
    "range": "0–100%"
  },
  {
    "id": "react.canvas.reactControls.motionAndParticles.turbulence",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS React Controls — Motion + Particles",
    "title": "Turbulence",
    "componentType": "slider",
    "summary": "Adds irregular flow and displacement to CANVAS motion and particle movement.",
    "whatItDoes": [
      "Introduces non-uniform motion so particles and processed layers do not move as a rigid block.",
      "Scales the amount of procedural variation in the selected recipe."
    ],
    "whenToUse": "Use moderate values for organic drift and higher values for chaotic motion.",
    "affects": [
      "CANVAS procedural motion variation"
    ],
    "range": "0–100%"
  },
  {
    "id": "react.canvas.reactControls.motionAndParticles.particleDensity",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS React Controls — Motion + Particles",
    "title": "Particle Density",
    "componentType": "slider",
    "summary": "Controls how densely Particle Aura reconstructs and emits points from the active CANVAS source.",
    "whatItDoes": [
      "Increases or decreases the sampled particle grid used to represent source pixels.",
      "A value near zero disables the Particle Aura layer."
    ],
    "whenToUse": "Raise density for a fuller holographic reconstruction and lower it to improve clarity or performance.",
    "affects": [
      "CANVAS particle count and reconstruction density"
    ],
    "range": "0–100%",
    "tip": "Particle Density requires an active compatible CANVAS media source."
  },
  {
    "id": "react.canvas.reactControls.motionAndParticles.particleSize",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS React Controls — Motion + Particles",
    "title": "Particle Size",
    "componentType": "slider",
    "summary": "Sets the rendered size of individual CANVAS particles.",
    "whatItDoes": [
      "Scales each sampled particle without changing the number of particles.",
      "Works with density and glow to define the final particle texture."
    ],
    "whenToUse": "Use smaller particles for detailed reconstruction and larger particles for a bold LED or hologram texture.",
    "affects": [
      "individual CANVAS particle size"
    ],
    "doesNotAffect": [
      "Particle Density"
    ],
    "range": "0.35–8.00×"
  },
  {
    "id": "react.canvas.reactControls.motionAndParticles.particleColorMode",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS React Controls — Motion + Particles",
    "title": "Particle Color Mode",
    "componentType": "select",
    "summary": "Chooses whether CANVAS particles use source colors, the STAGELESS palette, or audio-reactive recoloring.",
    "whatItDoes": [
      "Original samples colors from the active media.",
      "Palette uses the cyan and emerald visual palette, while Audio Reactive lets audio features influence particle color."
    ],
    "whenToUse": "Choose Original for faithful reconstruction, Palette for brand consistency, or Audio Reactive for music-driven color movement.",
    "affects": [
      "CANVAS particle color source"
    ],
    "defaultValue": "Original"
  },
  {
    "id": "react.canvas.reactControls.motionAndParticles.particleQuality",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS React Controls — Motion + Particles",
    "title": "Particle Quality",
    "componentType": "select",
    "summary": "Chooses the Particle Aura resolution and rendering budget.",
    "whatItDoes": [
      "Adjusts particle-grid resolution, render scale, and compatibility sampling.",
      "The adaptive renderer may temporarily reduce load and recover after slow frames."
    ],
    "whenToUse": "Use High for powerful hardware and detailed output, Balanced for normal use, or Low when performance headroom is limited.",
    "affects": [
      "CANVAS particle rendering quality and cost"
    ],
    "doesNotAffect": [
      "the source file resolution"
    ],
    "defaultValue": "Balanced",
    "tip": "Lower quality before reducing the creative Particle Density value when the goal is only to recover frame rate."
  },
  {
    "id": "react.canvas.fractures.structure.intensity",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Structure",
    "title": "Fracture Intensity",
    "componentType": "slider",
    "summary": "Controls how much of the source is divided into visible fragments rather than exposing a raw fragment count.",
    "whatItDoes": [
      "Controls how much of the source is divided into visible fragments rather than exposing a raw fragment count.",
      "Writes to the canonical Fractures structure state used by the specialized fragment-collage renderer.",
      "The setting changes immediately; topology regeneration still waits for the selected topology boundary.",
      "The normalized intensity is part of deterministic plan reconstruction."
    ],
    "whenToUse": "Adjust Fracture Intensity while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures structure planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "34%",
    "range": "0\u2013100%"
  },
  {
    "id": "react.canvas.fractures.structure.mode",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Structure",
    "title": "Fracture Mode",
    "componentType": "select",
    "summary": "Chooses mixed fragments, rectangles, horizontal slices, vertical slices, or limited angled quadrilaterals.",
    "whatItDoes": [
      "Chooses mixed fragments, rectangles, horizontal slices, vertical slices, or limited angled quadrilaterals.",
      "Writes to the canonical Fractures structure state used by the specialized fragment-collage renderer.",
      "The selection is stored immediately and takes effect at the next topology boundary.",
      "The selected shape family is an explicit deterministic planner input."
    ],
    "whenToUse": "Adjust Fracture Mode while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures structure planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "Mixed"
  },
  {
    "id": "react.canvas.fractures.structure.anchorMode",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Structure",
    "title": "Anchor Mode",
    "componentType": "select",
    "summary": "Chooses whether the source anchor stays visible, reacts, fades with music, or becomes fully fragmented.",
    "whatItDoes": [
      "Chooses whether the source anchor stays visible, reacts, fades with music, or becomes fully fragmented.",
      "Writes to the canonical Fractures structure state used by the specialized fragment-collage renderer.",
      "The selection changes immediately for the active plan and future boundaries.",
      "The mode is persisted and reconstructed identically after backward seeking."
    ],
    "whenToUse": "Adjust Anchor Mode while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures structure planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "Always Visible"
  },
  {
    "id": "react.canvas.fractures.structure.focusProtection",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Structure",
    "title": "Focus Protection",
    "componentType": "slider",
    "summary": "Protects the focus area from aggressive fragmentation and displacement.",
    "whatItDoes": [
      "Protects the focus area from aggressive fragmentation and displacement.",
      "Writes to the canonical Fractures structure state used by the specialized fragment-collage renderer.",
      "The value changes immediately; geometry updates occur at the next applicable topology or layout boundary.",
      "The protection radius is a deterministic geometry input."
    ],
    "whenToUse": "Adjust Focus Protection while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures structure planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "70%",
    "range": "0\u2013100%"
  },
  {
    "id": "react.canvas.fractures.structure.focusX",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Structure",
    "title": "Focus X",
    "componentType": "slider",
    "summary": "Moves the protected focus point horizontally across the source.",
    "whatItDoes": [
      "Moves the protected focus point horizontally across the source.",
      "Writes to the canonical Fractures structure state used by the specialized fragment-collage renderer.",
      "The value changes immediately and is consumed by the next geometry plan.",
      "The normalized focus coordinate is persisted for exact reconstruction."
    ],
    "whenToUse": "Adjust Focus X while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures structure planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "50%",
    "range": "0\u2013100%"
  },
  {
    "id": "react.canvas.fractures.structure.focusY",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Structure",
    "title": "Focus Y",
    "componentType": "slider",
    "summary": "Moves the protected focus point vertically across the source.",
    "whatItDoes": [
      "Moves the protected focus point vertically across the source.",
      "Writes to the canonical Fractures structure state used by the specialized fragment-collage renderer.",
      "The value changes immediately and is consumed by the next geometry plan.",
      "The normalized focus coordinate is persisted for exact reconstruction."
    ],
    "whenToUse": "Adjust Focus Y while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures structure planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "50%",
    "range": "0\u2013100%"
  },
  {
    "id": "react.canvas.fractures.structure.composition",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Structure",
    "title": "Composition",
    "componentType": "slider",
    "summary": "Moves the composition from restrained editorial spacing toward chaotic overlap and displacement.",
    "whatItDoes": [
      "Moves the composition from restrained editorial spacing toward chaotic overlap and displacement.",
      "Writes to the canonical Fractures structure state used by the specialized fragment-collage renderer.",
      "The value changes immediately; layout changes resolve at the selected layout boundary.",
      "The composition value is a deterministic placement input."
    ],
    "whenToUse": "Adjust Composition while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures structure planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "25%",
    "range": "Editorial to Chaotic"
  },
  {
    "id": "react.canvas.fractures.structure.placementMode",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Structure",
    "title": "Placement Mode",
    "componentType": "select",
    "summary": "Chooses editorial grid, center burst, layered scatter, or a deterministic random mix.",
    "whatItDoes": [
      "Chooses editorial grid, center burst, layered scatter, or a deterministic random mix.",
      "Writes to the canonical Fractures structure state used by the specialized fragment-collage renderer.",
      "The selection is stored immediately and applies at the next layout boundary.",
      "Random Mix uses the saved seed and revisions rather than Math.random()."
    ],
    "whenToUse": "Adjust Placement Mode while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures structure planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "Editorial Grid"
  },
  {
    "id": "react.canvas.fractures.structure.topologyInterval",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Structure",
    "title": "Topology Change",
    "componentType": "select",
    "summary": "Chooses the beat, bar, phrase, or section boundary where fragment shapes may be regenerated.",
    "whatItDoes": [
      "Chooses the beat, bar, phrase, or section boundary where fragment shapes may be regenerated.",
      "Writes to the canonical Fractures structure state used by the specialized fragment-collage renderer.",
      "The dropdown changes immediately; topology itself changes only on the selected quantized boundary.",
      "Quantized identity is reconstructed from timeline position, seed, and topology revision."
    ],
    "whenToUse": "Adjust Topology Change while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures structure planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "Every 4 Bars"
  },
  {
    "id": "react.canvas.fractures.structure.layoutInterval",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Structure",
    "title": "Layout Change",
    "componentType": "select",
    "summary": "Chooses the beat, bar, phrase, or section boundary where fragment placement may change.",
    "whatItDoes": [
      "Chooses the beat, bar, phrase, or section boundary where fragment placement may change.",
      "Writes to the canonical Fractures structure state used by the specialized fragment-collage renderer.",
      "The dropdown changes immediately; placement changes only on the selected quantized boundary.",
      "Quantized layout identity is reconstructed from timeline position, seed, and layout revision."
    ],
    "whenToUse": "Adjust Layout Change while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures structure planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "Every Bar"
  },
  {
    "id": "react.canvas.fractures.structure.variationSeed",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Structure",
    "title": "Variation Seed",
    "componentType": "numeric",
    "summary": "Sets the stable integer seed used by future Fractures topology, layout, role, and transition planning.",
    "whatItDoes": [
      "Sets the stable integer seed used by future Fractures topology, layout, role, and transition planning.",
      "Writes to the canonical Fractures structure state used by the specialized fragment-collage renderer.",
      "The seed changes immediately and affects the next planned boundary.",
      "Using the same seed, revisions, settings, and timeline position must reproduce the same state."
    ],
    "whenToUse": "Adjust Variation Seed while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures structure planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "1337",
    "range": "0\u2013999999"
  },
  {
    "id": "react.canvas.fractures.structure.quality",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Structure",
    "title": "Quality",
    "componentType": "select",
    "summary": "Chooses the future fragment-planning and rendering budget.",
    "whatItDoes": [
      "Chooses the future fragment-planning and rendering budget.",
      "Writes to the canonical Fractures structure state used by the specialized fragment-collage renderer.",
      "The selection changes immediately; the placeholder remains source-safe in this foundation stage.",
      "Quality changes resource limits, not deterministic fragment identity."
    ],
    "whenToUse": "Adjust Quality while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures structure planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "Balanced"
  },
  {
    "id": "react.canvas.fractures.motion.amount",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Motion",
    "title": "Motion",
    "componentType": "slider",
    "summary": "Controls the overall amount of fragment movement.",
    "whatItDoes": [
      "Controls the overall amount of fragment movement.",
      "Writes to the canonical Fractures motion state used by the specialized fragment-collage renderer.",
      "The value changes immediately and future interpolation will read it every frame.",
      "Motion is derived from stable plan state and timeline time, preserving deterministic reconstruction after backward seeks."
    ],
    "whenToUse": "Adjust Motion while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures motion planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "24%",
    "range": "0\u2013100%"
  },
  {
    "id": "react.canvas.fractures.motion.transition",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Motion",
    "title": "Transition",
    "componentType": "select",
    "summary": "Chooses Hard Glitch Cut, Staggered Assembly, or Zoom In and Out.",
    "whatItDoes": [
      "Chooses Hard Glitch Cut, Staggered Assembly, or Zoom In and Out.",
      "Writes to the canonical Fractures motion state used by the specialized fragment-collage renderer.",
      "The selection changes immediately and is used at the next transition boundary.",
      "Transition identity and timing are reconstructed from the saved mode and quantized plan."
    ],
    "whenToUse": "Adjust Transition while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures motion planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "Staggered Assembly"
  },
  {
    "id": "react.canvas.fractures.motion.transitionSpeed",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Motion",
    "title": "Transition Speed",
    "componentType": "slider",
    "summary": "Controls how quickly fragments complete the selected transition.",
    "whatItDoes": [
      "Controls how quickly fragments complete the selected transition.",
      "Writes to the canonical Fractures motion state used by the specialized fragment-collage renderer.",
      "The value changes immediately for subsequent interpolation.",
      "Speed changes interpolation only and preserves deterministic reconstruction without introducing random state."
    ],
    "whenToUse": "Adjust Transition Speed while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures motion planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "45%",
    "range": "0\u2013100%"
  },
  {
    "id": "react.canvas.fractures.motion.stagger",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Motion",
    "title": "Stagger",
    "componentType": "slider",
    "summary": "Controls the spread between individual fragment transition start times.",
    "whatItDoes": [
      "Controls the spread between individual fragment transition start times.",
      "Writes to the canonical Fractures motion state used by the specialized fragment-collage renderer.",
      "The value changes immediately for subsequent transitions.",
      "Per-fragment stagger order is assigned deterministically."
    ],
    "whenToUse": "Adjust Stagger while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures motion planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "28%",
    "range": "0\u2013100%"
  },
  {
    "id": "react.canvas.fractures.motion.zoom",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Motion",
    "title": "Zoom",
    "componentType": "slider",
    "summary": "Controls fragment-scale travel used by the Zoom In and Out transition.",
    "whatItDoes": [
      "Controls fragment-scale travel used by the Zoom In and Out transition.",
      "Writes to the canonical Fractures motion state used by the specialized fragment-collage renderer.",
      "The value changes immediately for subsequent transitions.",
      "Zoom interpolation is timeline-derived and preserves deterministic reconstruction after seeking."
    ],
    "whenToUse": "Adjust Zoom while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures motion planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "18%",
    "range": "0\u2013100%"
  },
  {
    "id": "react.canvas.fractures.motion.refracture",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Motion",
    "title": "Refracture",
    "componentType": "button",
    "summary": "Increments the persisted topology revision to request a new deterministic fragment plan.",
    "whatItDoes": [
      "Increments the persisted topology revision to request a new deterministic fragment plan.",
      "Writes to the canonical Fractures motion state used by the specialized fragment-collage renderer.",
      "The revision changes immediately; topology is adopted at the next allowed topology boundary.",
      "Repeating the same revision, seed, and boundary reconstructs the same topology."
    ],
    "whenToUse": "Adjust Refracture while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures motion planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "Revision 0"
  },
  {
    "id": "react.canvas.fractures.motion.shuffleLayout",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Motion",
    "title": "Shuffle Layout",
    "componentType": "button",
    "summary": "Increments the persisted layout revision without changing the fragment topology.",
    "whatItDoes": [
      "Increments the persisted layout revision without changing the fragment topology.",
      "Writes to the canonical Fractures motion state used by the specialized fragment-collage renderer.",
      "The revision changes immediately; placement is adopted at the next allowed layout boundary.",
      "Repeating the same revision, seed, and boundary reconstructs the same layout."
    ],
    "whenToUse": "Adjust Shuffle Layout while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures motion planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "Revision 0"
  },
  {
    "id": "react.canvas.fractures.motion.freezeLayout",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Motion",
    "title": "Freeze Layout",
    "componentType": "toggle",
    "summary": "Prevents automatic layout-boundary changes while preserving the current deterministic plan identity.",
    "whatItDoes": [
      "Prevents automatic layout-boundary changes while preserving the current deterministic plan identity.",
      "Writes to the canonical Fractures motion state used by the specialized fragment-collage renderer.",
      "The preference changes immediately.",
      "Unfreezing resumes from timeline-derived deterministic boundaries rather than accumulated frame state."
    ],
    "whenToUse": "Adjust Freeze Layout while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures motion planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "Off"
  },
  {
    "id": "react.canvas.fractures.motion.returnToAnchor",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Motion",
    "title": "Return to Anchor",
    "componentType": "toggle",
    "summary": "Allows displaced fragments to return toward the protected source anchor between transitions.",
    "whatItDoes": [
      "Allows displaced fragments to return toward the protected source anchor between transitions.",
      "Writes to the canonical Fractures motion state used by the specialized fragment-collage renderer.",
      "The preference changes immediately for future interpolation.",
      "Anchor return uses deterministic interpolation and saved anchor settings."
    ],
    "whenToUse": "Adjust Return to Anchor while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures motion planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "On"
  },
  {
    "id": "react.canvas.fractures.effects.intensity",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Effects",
    "title": "Effects Intensity",
    "componentType": "slider",
    "summary": "Controls the master weighting applied across Fractures fragment effects.",
    "whatItDoes": [
      "Controls the master weighting applied across Fractures fragment effects.",
      "Writes to the canonical Fractures effects state used by the specialized fragment-collage renderer.",
      "The value changes immediately in the specialized fragment-collage renderer.",
      "Effect assignment is derived from deterministic fragment roles and the saved weights."
    ],
    "whenToUse": "Adjust Effects Intensity while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures effects planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "25%",
    "range": "0\u2013100%"
  },
  {
    "id": "react.canvas.fractures.effects.glow",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Effects",
    "title": "Glow",
    "componentType": "slider",
    "summary": "Weights glow assignment on automatically selected fragment roles.",
    "whatItDoes": [
      "Weights glow assignment on automatically selected fragment roles.",
      "Writes to the canonical Fractures effects state used by the specialized fragment-collage renderer.",
      "The value changes immediately in the specialized fragment-collage renderer.",
      "Effect assignment is derived from deterministic fragment roles and the saved weights."
    ],
    "whenToUse": "Adjust Glow while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures effects planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "18%",
    "range": "0\u2013100%"
  },
  {
    "id": "react.canvas.fractures.effects.glitch",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Effects",
    "title": "Glitch",
    "componentType": "slider",
    "summary": "Weights glitch treatment on automatically selected fragment roles.",
    "whatItDoes": [
      "Weights glitch treatment on automatically selected fragment roles.",
      "Writes to the canonical Fractures effects state used by the specialized fragment-collage renderer.",
      "The value changes immediately in the specialized fragment-collage renderer.",
      "Effect assignment is derived from deterministic fragment roles and the saved weights."
    ],
    "whenToUse": "Adjust Glitch while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures effects planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "12%",
    "range": "0\u2013100%"
  },
  {
    "id": "react.canvas.fractures.effects.texture",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Effects",
    "title": "Texture",
    "componentType": "slider",
    "summary": "Weights surface texture treatment on automatically selected fragment roles.",
    "whatItDoes": [
      "Weights surface texture treatment on automatically selected fragment roles.",
      "Writes to the canonical Fractures effects state used by the specialized fragment-collage renderer.",
      "The value changes immediately in the specialized fragment-collage renderer.",
      "Effect assignment is derived from deterministic fragment roles and the saved weights."
    ],
    "whenToUse": "Adjust Texture while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures effects planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "20%",
    "range": "0\u2013100%"
  },
  {
    "id": "react.canvas.fractures.effects.trails",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Effects",
    "title": "Trails",
    "componentType": "slider",
    "summary": "Weights fragment trail treatment on automatically selected fragment roles.",
    "whatItDoes": [
      "Weights fragment trail treatment on automatically selected fragment roles.",
      "Writes to the canonical Fractures effects state used by the specialized fragment-collage renderer.",
      "The value changes immediately in the specialized fragment-collage renderer.",
      "Effect assignment is derived from deterministic fragment roles and the saved weights."
    ],
    "whenToUse": "Adjust Trails while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures effects planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "8%",
    "range": "0\u2013100%"
  },
  {
    "id": "react.canvas.fractures.effects.depth",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Effects",
    "title": "Depth",
    "componentType": "slider",
    "summary": "Weights simulated fragment depth and parallax treatment.",
    "whatItDoes": [
      "Weights simulated fragment depth and parallax treatment.",
      "Writes to the canonical Fractures effects state used by the specialized fragment-collage renderer.",
      "The value changes immediately in the specialized fragment-collage renderer.",
      "Effect assignment is derived from deterministic fragment roles and the saved weights."
    ],
    "whenToUse": "Adjust Depth while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures effects planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "22%",
    "range": "0\u2013100%"
  },
  {
    "id": "react.canvas.fractures.effects.duplication",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Effects",
    "title": "Duplication",
    "componentType": "slider",
    "summary": "Weights duplicate or echo fragment treatment.",
    "whatItDoes": [
      "Weights duplicate or echo fragment treatment.",
      "Writes to the canonical Fractures effects state used by the specialized fragment-collage renderer.",
      "The value changes immediately in the specialized fragment-collage renderer.",
      "Effect assignment is derived from deterministic fragment roles and the saved weights."
    ],
    "whenToUse": "Adjust Duplication while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures effects planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "10%",
    "range": "0\u2013100%"
  },
  {
    "id": "react.canvas.fractures.effects.colorTreatment",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Effects",
    "title": "Color Treatment",
    "componentType": "slider",
    "summary": "Weights color remapping across automatically assigned fragment roles.",
    "whatItDoes": [
      "Weights color remapping across automatically assigned fragment roles.",
      "Writes to the canonical Fractures effects state used by the specialized fragment-collage renderer.",
      "The value changes immediately in the specialized fragment-collage renderer.",
      "Effect assignment is derived from deterministic fragment roles and the saved weights."
    ],
    "whenToUse": "Adjust Color Treatment while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures effects planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "18%",
    "range": "0\u2013100%"
  },
  {
    "id": "react.canvas.fractures.effects.colorSource",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Effects",
    "title": "Color Source",
    "componentType": "select",
    "summary": "Chooses source-sampled colors, Brand Kit colors, or manual override colors.",
    "whatItDoes": [
      "Chooses source-sampled colors, Brand Kit colors, or manual override colors.",
      "Writes to the canonical Fractures effects state used by the specialized fragment-collage renderer.",
      "The selection changes immediately in the specialized fragment-collage renderer.",
      "The selected color source is persisted, does not alter topology identity, and is replayed during deterministic reconstruction."
    ],
    "whenToUse": "Adjust Color Source while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures effects planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "Image Sampled"
  },
  {
    "id": "react.canvas.fractures.effects.manualPrimaryColor",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Effects",
    "title": "Manual Primary Color",
    "componentType": "color",
    "summary": "Sets the primary manual color used when Color Source is Manual Override.",
    "whatItDoes": [
      "Sets the primary manual color used when Color Source is Manual Override.",
      "Writes to the canonical Fractures effects state used by the specialized fragment-collage renderer.",
      "The color changes immediately in canonical state and the specialized renderer consumes it on the next frame.",
      "The normalized hex color is persisted for deterministic reload."
    ],
    "whenToUse": "Adjust Manual Primary Color while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures effects planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "#4AC7DB"
  },
  {
    "id": "react.canvas.fractures.effects.manualSupportingColor",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Effects",
    "title": "Manual Supporting Color",
    "componentType": "color",
    "summary": "Sets the supporting manual color used when Color Source is Manual Override.",
    "whatItDoes": [
      "Sets the supporting manual color used when Color Source is Manual Override.",
      "Writes to the canonical Fractures effects state used by the specialized fragment-collage renderer.",
      "The color changes immediately in canonical state and the specialized renderer consumes it on the next frame.",
      "The normalized hex color is persisted for deterministic reload."
    ],
    "whenToUse": "Adjust Manual Supporting Color while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures effects planning"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "#61D6AA"
  },
  {
    "id": "react.canvas.fractures.effects.roleWeight.clean",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures — Effects",
    "title": "Clean Role Weight",
    "componentType": "slider",
    "summary": "Controls the deterministic probability of the clean effect role.",
    "whatItDoes": [
      "Controls the deterministic probability of the clean effect role.",
      "Writes the canonical Fractures role-weight map consumed by topology planning.",
      "Changing the value deterministically reassigns roles without introducing frame-order state.",
      "All-zero role weights safely normalize to the canonical fallback distribution."
    ],
    "whenToUse": "Adjust Clean Role Weight while Fractures is the active CANVAS preset.",
    "affects": [
      "per-fragment effect-role assignment"
    ],
    "doesNotAffect": [
      "fragment crops",
      "other CANVAS presets"
    ],
    "defaultValue": "34%",
    "range": "0–100%"
  },
  {
    "id": "react.canvas.fractures.effects.roleWeight.glow",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures — Effects",
    "title": "Glow Role Weight",
    "componentType": "slider",
    "summary": "Controls the deterministic probability of the glow effect role.",
    "whatItDoes": [
      "Controls the deterministic probability of the glow effect role.",
      "Writes the canonical Fractures role-weight map consumed by topology planning.",
      "Changing the value deterministically reassigns roles without introducing frame-order state.",
      "All-zero role weights safely normalize to the canonical fallback distribution."
    ],
    "whenToUse": "Adjust Glow Role Weight while Fractures is the active CANVAS preset.",
    "affects": [
      "per-fragment effect-role assignment"
    ],
    "doesNotAffect": [
      "fragment crops",
      "other CANVAS presets"
    ],
    "defaultValue": "14%",
    "range": "0–100%"
  },
  {
    "id": "react.canvas.fractures.effects.roleWeight.outline",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures — Effects",
    "title": "Outline Role Weight",
    "componentType": "slider",
    "summary": "Controls the deterministic probability of the outline effect role.",
    "whatItDoes": [
      "Controls the deterministic probability of the outline effect role.",
      "Writes the canonical Fractures role-weight map consumed by topology planning.",
      "Changing the value deterministically reassigns roles without introducing frame-order state.",
      "All-zero role weights safely normalize to the canonical fallback distribution."
    ],
    "whenToUse": "Adjust Outline Role Weight while Fractures is the active CANVAS preset.",
    "affects": [
      "per-fragment effect-role assignment"
    ],
    "doesNotAffect": [
      "fragment crops",
      "other CANVAS presets"
    ],
    "defaultValue": "14%",
    "range": "0–100%"
  },
  {
    "id": "react.canvas.fractures.effects.roleWeight.glitch",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures — Effects",
    "title": "Glitch Role Weight",
    "componentType": "slider",
    "summary": "Controls the deterministic probability of the glitch effect role.",
    "whatItDoes": [
      "Controls the deterministic probability of the glitch effect role.",
      "Writes the canonical Fractures role-weight map consumed by topology planning.",
      "Changing the value deterministically reassigns roles without introducing frame-order state.",
      "All-zero role weights safely normalize to the canonical fallback distribution."
    ],
    "whenToUse": "Adjust Glitch Role Weight while Fractures is the active CANVAS preset.",
    "affects": [
      "per-fragment effect-role assignment"
    ],
    "doesNotAffect": [
      "fragment crops",
      "other CANVAS presets"
    ],
    "defaultValue": "10%",
    "range": "0–100%"
  },
  {
    "id": "react.canvas.fractures.effects.roleWeight.luma",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures — Effects",
    "title": "Luma Role Weight",
    "componentType": "slider",
    "summary": "Controls the deterministic probability of the luma isolation effect role.",
    "whatItDoes": [
      "Controls the deterministic probability of the luma isolation effect role.",
      "Writes the canonical Fractures role-weight map consumed by topology planning.",
      "Changing the value deterministically reassigns roles without introducing frame-order state.",
      "All-zero role weights safely normalize to the canonical fallback distribution."
    ],
    "whenToUse": "Adjust Luma Role Weight while Fractures is the active CANVAS preset.",
    "affects": [
      "per-fragment effect-role assignment"
    ],
    "doesNotAffect": [
      "fragment crops",
      "other CANVAS presets"
    ],
    "defaultValue": "8%",
    "range": "0–100%"
  },
  {
    "id": "react.canvas.fractures.effects.roleWeight.displacement",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures — Effects",
    "title": "Displacement Role Weight",
    "componentType": "slider",
    "summary": "Controls the deterministic probability of the slice displacement effect role.",
    "whatItDoes": [
      "Controls the deterministic probability of the slice displacement effect role.",
      "Writes the canonical Fractures role-weight map consumed by topology planning.",
      "Changing the value deterministically reassigns roles without introducing frame-order state.",
      "All-zero role weights safely normalize to the canonical fallback distribution."
    ],
    "whenToUse": "Adjust Displacement Role Weight while Fractures is the active CANVAS preset.",
    "affects": [
      "per-fragment effect-role assignment"
    ],
    "doesNotAffect": [
      "fragment crops",
      "other CANVAS presets"
    ],
    "defaultValue": "10%",
    "range": "0–100%"
  },
  {
    "id": "react.canvas.fractures.effects.roleWeight.texture",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures — Effects",
    "title": "Texture Role Weight",
    "componentType": "slider",
    "summary": "Controls the deterministic probability of the texture effect role.",
    "whatItDoes": [
      "Controls the deterministic probability of the texture effect role.",
      "Writes the canonical Fractures role-weight map consumed by topology planning.",
      "Changing the value deterministically reassigns roles without introducing frame-order state.",
      "All-zero role weights safely normalize to the canonical fallback distribution."
    ],
    "whenToUse": "Adjust Texture Role Weight while Fractures is the active CANVAS preset.",
    "affects": [
      "per-fragment effect-role assignment"
    ],
    "doesNotAffect": [
      "fragment crops",
      "other CANVAS presets"
    ],
    "defaultValue": "10%",
    "range": "0–100%"
  },
  {
    "id": "react.canvas.fractures.audio.response",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Audio",
    "title": "Audio Response",
    "componentType": "slider",
    "summary": "Controls the master amount of shared audio intelligence applied to Fractures.",
    "whatItDoes": [
      "Controls the master amount of shared audio intelligence applied to Fractures.",
      "Scales every Fractures-local continuous, transient, and structural audio route without changing shared analysis.",
      "At zero, audio modulation is disabled while user-selected non-audio timing and the base visual remain active.",
      "Audio features remain temporary inputs, while topology and layout identities stay timeline- and seed-derived."
    ],
    "whenToUse": "Adjust Audio Response while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures audio rendering"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "35%",
    "range": "0\u2013100%"
  },
  {
    "id": "react.canvas.fractures.audio.bassMotion",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Audio",
    "title": "Bass Motion",
    "componentType": "slider",
    "summary": "Controls how strongly bass energy drives fragment motion.",
    "whatItDoes": [
      "Controls how strongly bass energy drives fragment motion.",
      "Scales smoothed bass-driven spread, fragment scale, faux depth, and slow anchor breathing.",
      "Attack and release smoothing reduce frame-to-frame chatter without modifying shared audio values.",
      "Backward seeking reconstructs plan state before applying the current temporary bass modulation."
    ],
    "whenToUse": "Adjust Bass Motion while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures audio rendering"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "30%",
    "range": "0\u2013100%"
  },
  {
    "id": "react.canvas.fractures.audio.transientGlitch",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Audio",
    "title": "Transient Glitch",
    "componentType": "slider",
    "summary": "Controls how strongly transient events trigger fragment glitch treatment.",
    "whatItDoes": [
      "Controls how strongly transient events trigger fragment glitch treatment.",
      "Scales kick impulses and bloom, snare slice displacement and RGB separation, and high-frequency shimmer.",
      "Spectral flux adds temporary distortion while transient envelopes decay predictably.",
      "Transient responses use shared event timing and deterministic fragment-role selection without regenerating layouts."
    ],
    "whenToUse": "Adjust Transient Glitch while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures audio rendering"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "25%",
    "range": "0\u2013100%"
  },
  {
    "id": "react.canvas.fractures.audio.structuralResponse",
    "priority": 1,
    "view": "react",
    "engine": "canvas",
    "group": "CANVAS Fractures \u2014 Audio",
    "title": "Structural Response",
    "componentType": "slider",
    "summary": "Controls how strongly bars, phrases, and section boundaries influence structural changes.",
    "whatItDoes": [
      "Controls how strongly bars, phrases, and section boundaries influence structural changes.",
      "Scales section topology, phrase layout, build separation, drop impact, downbeat commitment, and vocal focus protection.",
      "Analyzed section changes commit on the musical downbeat while phrases retain deterministic timeline identities.",
      "Structural changes reconstruct from shared timeline boundaries, seed, and revisions without mutating user settings."
    ],
    "whenToUse": "Adjust Structural Response while Fractures is the active CANVAS preset.",
    "affects": [
      "Fractures audio rendering"
    ],
    "doesNotAffect": [
      "other CANVAS presets"
    ],
    "defaultValue": "35%",
    "range": "0\u2013100%"
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
    "id": "react.laserDmx.presetLibrary",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx",
    "group": "Preset library",
    "title": "LaserDMX Presets",
    "componentType": "selection",
    "summary": "Browses the preset collection for the active LaserDMX authoring surface.",
    "whatItDoes": [
      "Matrix mode shows Beam Matrix looks.",
      "Show Director mode shows Performance Shows and reusable rig layouts."
    ],
    "whenToUse": "Use the library to load a complete LaserDMX starting point before refining beams, fixtures, or performance behavior.",
    "affects": [
      "active Beam Matrix preset",
      "active Show Director Performance Show or rig layout"
    ],
    "doesNotAffect": [
      "presets belonging to other React engines"
    ],
    "tip": "Switch Matrix and Show Director from the left workspace to change which LaserDMX preset families appear."
  },
  {
    "id": "react.laserDmx.design.previewOutputTrim",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx",
    "group": "React Master",
    "title": "Preview Output Trim",
    "componentType": "slider",
    "summary": "Adjusts LaserDMX brightness in the visualizer preview without changing production hardware output.",
    "whatItDoes": [
      "Scales the rendered WebGL and Canvas2D preview after the authored show output is resolved.",
      "Keeps preview calibration separate from LaserDMX production dimmer and safety controls."
    ],
    "whenToUse": "Lower it when the on-screen preview is too bright for editing or recording while the authored production values should remain untouched.",
    "affects": [
      "LaserDMX visualizer preview brightness"
    ],
    "doesNotAffect": [
      "production hardware output",
      "Authored Show Dimmer",
      "Safety Clamp"
    ],
    "defaultValue": "100%",
    "range": "0–100%",
    "tip": "Treat this as monitor calibration, not as part of the authored lighting show."
  },
  {
    "id": "react.laserDmx.design.previewGlowTrim",
    "priority": 1,
    "view": "react",
    "engine": "laserDmx",
    "group": "React Master",
    "title": "Preview Glow Trim",
    "componentType": "slider",
    "summary": "Adjusts the amount of post-render glow visible in the LaserDMX preview.",
    "whatItDoes": [
      "Scales preview glow after Authored Show Glow has been applied.",
      "Applies consistently to the supported LaserDMX preview renderers."
    ],
    "whenToUse": "Reduce it when bloom obscures beam edges in the editor, or increase it when preview beams need more atmospheric presence.",
    "affects": [
      "LaserDMX visualizer preview glow"
    ],
    "doesNotAffect": [
      "production hardware output",
      "Authored Show Glow",
      "beam geometry"
    ],
    "defaultValue": "50%",
    "range": "0–100%",
    "tip": "Use Authored Show Glow for the saved look and Preview Glow Trim only for local display calibration."
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
    "id": "react.pixGrid.workspace.tabs",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "PixGrid workspace navigation",
    "title": "Setup and Media",
    "componentType": "selection",
    "summary": "Switches the PixGrid left rail between scene-and-layer setup and compatible Media Library artwork.",
    "whatItDoes": [
      "Setup manages PixGrid scenes, layers, built-in artwork, and the center-canvas editor.",
      "Media selects still images or SVG artwork that PixGrid can convert or add as layers."
    ],
    "whenToUse": "Use Setup to organize the authored grid, then use Media when the visual needs uploaded artwork.",
    "affects": [
      "visible PixGrid left-rail workspace"
    ],
    "doesNotAffect": [
      "the active PixGrid preset",
      "live output until a setup or media action is performed"
    ],
    "relatedHelpIds": [
      "react.pixGrid.authoring.editOverlay",
      "react.pixGrid.presetLibrary"
    ]
  },
  {
    "id": "react.pixGrid.authoring.editOverlay",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "PixGrid setup and authoring",
    "title": "Edit PixGrid",
    "componentType": "toggle",
    "summary": "Opens or closes the interactive PixGrid authoring overlay on the center canvas.",
    "whatItDoes": [
      "Shows PixGrid drawing, selection, view, and editing tools over the live matrix.",
      "Keeps the selected scene and layer context synchronized with the Design workspace."
    ],
    "whenToUse": "Open it when painting pixels, transforming layers, selecting cells, or editing smart-group masks directly on the matrix.",
    "affects": [
      "PixGrid authoring-overlay visibility"
    ],
    "doesNotAffect": [
      "stored artwork until an edit is made",
      "the selected performance program"
    ],
    "tip": "Close the overlay before judging the clean live-output presentation."
  },
  {
    "id": "react.pixGrid.authoring.scenes",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "PixGrid setup and authoring",
    "title": "Scenes",
    "componentType": "group",
    "summary": "Creates and selects the PixGrid scene containers used by presets, performance programs, and Track Map actions.",
    "whatItDoes": [
      "Selects the scene being edited in Setup.",
      "Supports renaming, adding, duplicating, and deleting scenes while preserving at least one scene."
    ],
    "whenToUse": "Use scenes when a PixGrid look needs multiple authored visual states or section-specific arrangements.",
    "affects": [
      "selected PixGrid scene",
      "scene collection and scene names"
    ],
    "doesNotAffect": [
      "layers owned by other scenes unless a scene is deleted"
    ],
    "relatedHelpIds": [
      "react.pixGrid.design.editingContext.activeScene",
      "react.pixGrid.authoring.layers"
    ]
  },
  {
    "id": "react.pixGrid.authoring.layers",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "PixGrid setup and authoring",
    "title": "Layers",
    "componentType": "group",
    "summary": "Organizes the artwork layers that compose the selected PixGrid scene.",
    "whatItDoes": [
      "Selects a layer for Design and canvas editing.",
      "Controls visibility, locking, order, duplication, and deletion for scene layers."
    ],
    "whenToUse": "Use layers to separate artwork elements that need independent transforms, visibility, animation, or performance targeting.",
    "affects": [
      "selected scene layer",
      "layer order and layer lifecycle"
    ],
    "tip": "Lock finished layers before painting or transforming another part of the composition.",
    "relatedHelpIds": [
      "react.pixGrid.design.editingContext.editTarget",
      "react.pixGrid.authoring.builtIns"
    ]
  },
  {
    "id": "react.pixGrid.authoring.builtIns",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "PixGrid setup and authoring",
    "title": "Built-in Artwork",
    "componentType": "selection",
    "summary": "Adds a bundled PixGrid artwork source as a new layer in the selected scene.",
    "whatItDoes": [
      "Creates a layer from the selected built-in asset.",
      "Leaves uploaded image and SVG selection in the separate Media workspace."
    ],
    "whenToUse": "Use built-ins for fast LED-native shapes, patterns, and starting points that do not require an uploaded file.",
    "affects": [
      "layers in the selected scene"
    ],
    "doesNotAffect": [
      "the shared Media Library"
    ],
    "relatedHelpIds": [
      "react.pixGrid.authoring.layers",
      "react.pixGrid.workspace.tabs"
    ]
  },
  {
    "id": "react.pixGrid.presetLibrary",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "PixGrid preset selection",
    "title": "PixGrid Presets",
    "componentType": "selection",
    "summary": "Browses and loads PixGrid looks, including their artwork, presentation, and authored performance configuration.",
    "whatItDoes": [
      "Current Engine filters the library to PixGrid presets.",
      "Favorites and All Engines retain the shared cross-engine library behavior.",
      "Deck-backed presets remain unavailable until their prepared media and transitions are ready."
    ],
    "whenToUse": "Use the preset library to load a complete PixGrid starting point before refining its Setup, Design, or React controls.",
    "affects": [
      "active React preset",
      "PixGrid state loaded by the selected preset"
    ],
    "doesNotAffect": [
      "the original preset definition when controls are edited afterward"
    ],
    "relatedHelpIds": [
      "react.pixGrid.performanceAndMatrix.performance.loadProgramPreset",
      "react.pixGrid.performanceProgram.programSelection"
    ]
  },
  {
    "id": "react.pixGrid.design.editingContext.editTarget",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "Design — Editing Context",
    "title": "Edit Target",
    "componentType": "select",
    "summary": "Chooses whether authoring edits apply to sparse scene pixels or to one selected layer.",
    "whatItDoes": [
      "Scene Pixels stores non-destructive sparse pixel overrides above inherited artwork.",
      "Choosing a layer exposes that layer’s visibility, lock, opacity, transform, and lifecycle controls."
    ],
    "whenToUse": "Choose Scene Pixels for direct cell painting, or choose a layer when transforming or managing one artwork source.",
    "affects": [
      "PixGrid editor target",
      "available Design surface controls"
    ],
    "doesNotAffect": [
      "the active preview scene"
    ],
    "relatedHelpIds": [
      "react.pixGrid.design.editingContext.activeScene",
      "react.pixGrid.authoring.layers"
    ]
  },
  {
    "id": "react.pixGrid.design.grid.quality",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "Design — Grid Presentation",
    "title": "Grid Quality",
    "componentType": "select",
    "summary": "Selects the requested logical LED-matrix resolution used by PixGrid rendering.",
    "whatItDoes": [
      "In Adaptive mode, the selection is the starting quality and the runtime may reduce secondary cost to protect frame rate.",
      "In Fixed mode, PixGrid keeps the selected logical matrix tier."
    ],
    "whenToUse": "Choose a lower tier for performance headroom or a higher tier when the source artwork and output size benefit from additional cells.",
    "affects": [
      "requested PixGrid logical resolution",
      "rendering cost and cell density"
    ],
    "doesNotAffect": [
      "the source artwork stored in scenes and layers"
    ],
    "tip": "Judge quality from the intended output distance, not only while zoomed into the editor."
  },
  {
    "id": "react.pixGrid.design.grid.cellGap",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "Design — Grid Presentation",
    "title": "Cell Gap",
    "componentType": "slider",
    "summary": "Controls the empty spacing between logical PixGrid LED cells.",
    "whatItDoes": [
      "Increases or decreases separation between cells without changing the underlying logical artwork."
    ],
    "whenToUse": "Increase the gap for a discrete LED-panel look, or reduce it for a denser pixel-display surface.",
    "affects": [
      "rendered spacing between PixGrid cells"
    ],
    "doesNotAffect": [
      "matrix resolution",
      "scene pixel values"
    ],
    "defaultValue": "Preset-defined",
    "range": "0–45% of each logical cell"
  },
  {
    "id": "react.pixGrid.design.grid.cellRoundness",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "Design — Grid Presentation",
    "title": "Cell Roundness",
    "componentType": "slider",
    "summary": "Rounds the corners of each rendered PixGrid LED cell.",
    "whatItDoes": [
      "Moves the emitter shape from a square cell toward a softer rounded cell while preserving the logical pixel data."
    ],
    "whenToUse": "Use lower values for rigid panel pixels and higher values for bulb-like or softened emitter styling.",
    "affects": [
      "rendered PixGrid cell shape"
    ],
    "doesNotAffect": [
      "cell positions",
      "scene artwork"
    ],
    "defaultValue": "Preset-defined",
    "range": "0–50% corner roundness"
  },
  {
    "id": "react.pixGrid.reactivity.workspace.tabs",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "PixGrid React workspace",
    "title": "Routing, Events, Choreography, and Analysis",
    "componentType": "selection",
    "summary": "Switches among PixGrid’s continuous routing, event routing, authored choreography, and live diagnostic surfaces.",
    "whatItDoes": [
      "Routing edits continuous audio-response paths.",
      "Events edits transient and boundary-triggered routes.",
      "Choreography selects the authored performance program and section plan.",
      "Analysis explains live source availability, route activity, perceptual change, and configuration health."
    ],
    "whenToUse": "Move between these surfaces when tracing a reaction from audio input through route execution to visible pixel output.",
    "affects": [
      "visible PixGrid React workspace"
    ],
    "doesNotAffect": [
      "route or program values until a control is edited"
    ],
    "relatedHelpIds": [
      "react.pixGrid.reactivity.continuousRoutes",
      "react.pixGrid.reactivity.eventRoutes",
      "react.pixGrid.performanceProgram.overview"
    ]
  },
  {
    "id": "react.pixGrid.reactivity.continuousRoutes",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "PixGrid continuous routing",
    "title": "Continuous Routes",
    "componentType": "group",
    "summary": "Maps continuously changing audio and musical-analysis values to PixGrid output, scene, layer, group, and presentation targets.",
    "whatItDoes": [
      "Combines authored preset routes with editable user routes.",
      "Exposes source shaping, ranges, thresholds, smoothing, eligibility, fallback, priority, and blend behavior for the selected route."
    ],
    "whenToUse": "Use continuous routes for behavior that should track energy, frequency bands, progress, stems, confidence, or other changing signals.",
    "affects": [
      "continuous PixGrid reaction assignments and program-route overrides"
    ],
    "doesNotAffect": [
      "event-triggered routes"
    ],
    "relatedHelpIds": [
      "react.pixGrid.reactivity.eventRoutes",
      "react.pixGrid.reactivity.smartGroupIntegration"
    ]
  },
  {
    "id": "react.pixGrid.reactivity.eventRoutes",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "PixGrid event routing",
    "title": "Event Routes",
    "componentType": "group",
    "summary": "Maps beats, transients, boundaries, section changes, semantic moments, and Track Map cues to triggered PixGrid actions.",
    "whatItDoes": [
      "Combines authored preset events with editable user event routes.",
      "Adds attack, hold, release, cooldown, quantization, and retrigger behavior to discrete reactions."
    ],
    "whenToUse": "Use event routes for flashes, reveals, palette changes, transitions, or other actions that should fire at a specific musical moment.",
    "affects": [
      "event-driven PixGrid reaction assignments and program-route overrides"
    ],
    "doesNotAffect": [
      "continuous routes"
    ],
    "relatedHelpIds": [
      "react.pixGrid.reactivity.continuousRoutes",
      "react.pixGrid.reactivity.smartGroupIntegration"
    ]
  },
  {
    "id": "react.pixGrid.reactivity.smartGroupIntegration",
    "priority": 1,
    "view": "react",
    "engine": "pixGrid",
    "group": "PixGrid smart-group routing",
    "title": "Smart Group Integration",
    "componentType": "group",
    "summary": "Connects a selected PixGrid smart-group mask to its live route coverage and authoring tools.",
    "whatItDoes": [
      "Shows the selected group’s materialized cells, mask type, targeting-route count, and live compilation state.",
      "Can reveal the mask overlay, open the group in the editor, or create a route targeted to that group."
    ],
    "whenToUse": "Use this section when a reaction should affect a meaningful region of the matrix instead of the entire output.",
    "affects": [
      "selected smart group",
      "group mask visibility",
      "new group-targeted reaction routes"
    ],
    "doesNotAffect": [
      "the group mask until edited in the authoring overlay"
    ],
    "relatedHelpIds": [
      "react.pixGrid.reactivity.continuousRoutes",
      "react.pixGrid.reactivity.eventRoutes"
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
    "whenToUse": "Use it to locate media for editing, selection, or assignment elsewhere in STAGELESS.",
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
