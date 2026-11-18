/** One help topic the header search can find, and the detail shown when it is chosen. The detail fields use the same names and
 * meanings as `HelpEntry` in `src/help/HelpCenter.ts`, so entries from that registry can be searched and shown the same way. */
export interface HelpSearchEntry {
  id: string
  title: string
  /** The area of the app the topic belongs to; searched, and shown beside the title. */
  category: string
  /** One plain sentence; searched, and shown under the title in the list and in the detail popover. */
  summary: string
  /** Extra words people may type that the title and summary do not contain. */
  keywords: readonly string[]
  /** Detail popover: what the thing does, one point per item. */
  whatItDoes?: readonly string[]
  /** Detail popover: when it is worth reaching for. */
  whenToUse?: string
  /** Detail popover: what it changes. */
  affects?: readonly string[]
  /** Detail popover: how it starts out. */
  defaultValue?: string
  /** Detail popover: one practical hint. */
  tip?: string
}

/** PLACEHOLDER topics. They exist so the search and its detail popover have something to show until real help content is
 * written, and the real content will replace this list. The wording stays general and makes no claim about where a control lives. */
export const HELP_SEARCH_ENTRIES: readonly HelpSearchEntry[] = [
  { id: 'auto-performance', title: 'Auto Performance', category: 'Cinema 2.0', summary: 'Lets the music drive a preset’s patterns and controls automatically.', keywords: ['auto', 'automatic', 'music', 'reactive', 'hands-free'],
    whatItDoes: ['While it is on and music is playing, the music chooses Pattern Change and Trigger for the preset.', 'Your saved choices are kept, and come back when it is turned off.'],
    whenToUse: 'When you want a preset to follow the music without touching it.', affects: ['Pattern Change', 'Trigger', 'Mood Conductor'], defaultValue: 'Set app-wide in System Settings.', tip: 'Turn it off to take over a preset by hand.' },
  { id: 'mood-conductor', title: 'Mood Conductor', category: 'Cinema 2.0', summary: 'Moves a preset’s controls with the mood of the music.', keywords: ['mood', 'calm', 'peak', 'tense', 'shock', 'energy'],
    whatItDoes: ['Reads the music’s mood (activity, calm, peak, shock and tension) and nudges a preset’s controls to match.', 'Each preset has a strength control that scales how far the controls move.'],
    whenToUse: 'When you want a preset to feel different in a quiet passage than at a peak.', affects: ['The preset’s drivable controls'], tip: 'It only acts while Auto Performance is on.' },
  { id: 'pattern-change', title: 'Pattern Change', category: 'Cinema 2.0', summary: 'Switches a preset between its patterns as the music moves on.', keywords: ['pattern', 'switch', 'variation', 'sections'],
    whatItDoes: ['Decides how often a preset moves to a different pattern.', 'With Auto Performance on, the music decides this for you.'],
    whenToUse: 'When a preset starts to feel repetitive.', affects: ['The pattern a preset is showing'], tip: 'Set it by hand when you want one pattern to hold.' },
  { id: 'trigger', title: 'Trigger', category: 'Cinema 2.0', summary: 'Chooses what sets off a preset’s accents.', keywords: ['accent', 'beat', 'kick', 'hit', 'flash'],
    whatItDoes: ['Picks the musical event (such as a beat) that fires a preset’s accents.', 'With Auto Performance on, the music chooses it.'],
    whenToUse: 'When accents land on the wrong part of the music.', affects: ['When accents fire'], tip: 'Try a different trigger if accents feel too busy.' },
  { id: 'cinema-presets', title: 'Cinema 2.0 Presets', category: 'Cinema 2.0', summary: 'Ready-made 3D scenes that react to the music.', keywords: ['preset', 'scene', '3d', 'engine', 'look'],
    whatItDoes: ['Each preset is a finished scene with its own look, controls and way of reacting to sound.', 'Presets share the same Auto Performance and mood behaviour.'],
    whenToUse: 'When you want a complete visual rather than building one from parts.', tip: 'Start with a preset, then adjust its controls in the Inspector.' },
  { id: 'tap-tempo', title: 'Tap Tempo', category: 'Music', summary: 'Sets the beats per minute by tapping along.', keywords: ['bpm', 'tempo', 'tap', 'beat', 'speed'],
    whatItDoes: ['Works out the tempo from the rhythm you tap.', 'The tempo you set overrides the detected one.'],
    whenToUse: 'When the detected tempo is wrong or missing.', affects: ['Anything that moves in time with the beat'], tip: 'Tap at least four times for a steadier reading.' },
  { id: 'audio-input', title: 'Audio Input', category: 'Music', summary: 'The sound source the visuals listen to.', keywords: ['microphone', 'mic', 'line', 'source', 'track', 'sound'],
    whatItDoes: ['Chooses between a track, a live input and a demo signal.', 'With a live input you can also pick the device.'],
    whenToUse: 'When switching between playing a track and listening to a room or a mixer.', affects: ['Everything that reacts to sound'], tip: 'Use the demo signal to try a preset without any music.' },
  { id: 'sound-drawing', title: 'Sound Drawing', category: 'Music', summary: 'Draws the audio signal as an oscilloscope-style visual.', keywords: ['scope', 'oscilloscope', 'waveform', 'xy', 'stereo'],
    whatItDoes: ['Plots the left and right channels against each other, like an XY oscilloscope.', 'Shapes in the sound become shapes on screen.'],
    whenToUse: 'When you want the visual to look like the sound itself.', tip: 'Stereo material gives the most interesting shapes.' },
  { id: 'render-fps', title: 'Render / FPS', category: 'Status', summary: 'How many frames per second are drawn, and how long each takes.', keywords: ['fps', 'frame', 'frames', 'speed', 'performance', 'lag'],
    whatItDoes: ['The first number is frames per second; the second is how long one frame takes to draw.', 'Higher frames per second and a lower frame time mean smoother motion.'],
    whenToUse: 'When the visuals look choppy and you want to see why.', tip: 'Lowering Quality is the quickest way to raise frames per second.' },
  { id: 'quality-tier', title: 'Quality', category: 'Status', summary: 'How much detail the visuals are drawn with.', keywords: ['quality', 'detail', 'resolution', 'high', 'low'],
    whatItDoes: ['Shows the current quality level.', 'Higher levels draw more detail and cost more processing.'],
    whenToUse: 'When you need to trade detail for smoothness, or the other way round.', affects: ['Frames per second', 'CPU usage'] },
  { id: 'cpu-usage', title: 'CPU Usage', category: 'Status', summary: 'How much of the computer’s processing the app is using.', keywords: ['cpu', 'processor', 'load', 'performance', 'usage'],
    whatItDoes: ['Shows the share of the computer’s processing the app is using.', 'It is only measured in the desktop app.'],
    whenToUse: 'When the computer feels slow or the fans are loud.', tip: 'A reading that stays high is a sign to lower Quality.' },
  { id: 'load-save', title: 'Load / Save', category: 'Status', summary: 'Shows whether your work is saved.', keywords: ['save', 'saved', 'saving', 'unsaved', 'sync', 'conflict'],
    whatItDoes: ['Shows whether your latest changes are saved, saving, or waiting to be saved.', 'Shows a notice if a save fails or conflicts with another change.'],
    whenToUse: 'Before closing the app or switching devices.', tip: 'Wait for it to read Saved before leaving.' },
  { id: 'inspector', title: 'Inspector', category: 'Workspace', summary: 'The panel where the selected item’s controls are edited.', keywords: ['controls', 'parameters', 'settings', 'edit', 'panel'],
    whatItDoes: ['Lists the controls of whatever is selected, grouped by purpose.', 'Changes take effect as you make them.'],
    whenToUse: 'Whenever you want to adjust how something looks or behaves.', tip: 'Groups can be collapsed to keep the panel short.' },
  { id: 'preset-manager', title: 'Preset Manager', category: 'Workspace', summary: 'Browse and organise presets.', keywords: ['presets', 'library', 'browse', 'organise', 'organize'],
    whatItDoes: ['Lists your presets so you can find, preview and organise them.', 'Search narrows the list as you type.'],
    whenToUse: 'When your library has grown and you need to find or tidy things.' },
  { id: 'show-manager', title: 'Show Manager', category: 'Workspace', summary: 'Build and run a show from your presets.', keywords: ['show', 'setlist', 'timeline', 'cue', 'sequence'],
    whatItDoes: ['Arranges presets into a show you can run from start to finish.', 'Shows are saved so you can reuse them.'],
    whenToUse: 'When you are preparing a performance.' },
  { id: 'media-manager', title: 'Media Manager', category: 'Workspace', summary: 'Upload and organise images, video and fonts.', keywords: ['media', 'upload', 'image', 'video', 'font', 'files'],
    whatItDoes: ['Holds the images, videos, tracks and fonts you have uploaded.', 'Items can be grouped into collections.'],
    whenToUse: 'When you want to bring your own material into a visual.', tip: 'Use collections to keep a show’s material together.' },
  { id: 'lyric-manager', title: 'Lyric Manager', category: 'Workspace', summary: 'Prepare lyrics and cues for tracks.', keywords: ['lyrics', 'cues', 'karaoke', 'text', 'words'],
    whatItDoes: ['Lets you write lyrics for a track and time them as cues.', 'Cues can then be shown with the music.'],
    whenToUse: 'When a track needs words on screen.' },
  { id: 'system-settings', title: 'System Settings', category: 'App', summary: 'App-wide options that follow your account.', keywords: ['settings', 'preferences', 'options', 'account', 'default'],
    whatItDoes: ['Holds options that apply everywhere in the app, such as the Auto Performance default.', 'They follow your account, so another device you sign in on shows the same values.'],
    whenToUse: 'When you want something to behave the same way across every preset.' },
  { id: 'layout-lab', title: 'Layout Lab', category: 'App', summary: 'Try out interface layouts and styles.', keywords: ['layout', 'design', 'interface', 'ui', 'mockup'],
    whatItDoes: ['A place to look at alternative interface layouts side by side.', 'It is for trying ideas and does not change your work.'],
    whenToUse: 'When you want to compare how the interface could be arranged.' },
  { id: 'mobile-preview', title: 'Mobile Preview', category: 'App', summary: 'See how the app looks on a phone-sized screen.', keywords: ['mobile', 'phone', 'preview', 'cast', 'casting', 'device'],
    whatItDoes: ['Shows the app at a phone-sized screen so you can check how it will look there.', 'It is a preview and does not change your work.'],
    whenToUse: 'When you are working on something people will see on a phone.' },
]
