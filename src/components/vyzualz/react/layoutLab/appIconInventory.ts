import type { AppIconKind } from './AppIconGlyph'

export interface AppIconEntry {
  id: string
  label: string
  kind: AppIconKind
  screen: string
  /** Repository-relative production files used to identify the icon and its current label. */
  sources: readonly string[]
}

type IconSpec = readonly [label: string, kind: AppIconKind]
function inventory(screen: string, sources: readonly string[], entries: readonly IconSpec[]): AppIconEntry[] {
  return entries.map(([label, kind], index) => ({ id: `${screen}-${index}`, label, kind, screen, sources }))
}

/**
 * Review inventory, not a replacement of production controls. Identical artwork with different
 * action labels gets separate entries; repeated instances of the same labeled action are deduplicated.
 * Dynamic item names are represented by [name]; the action's wording and capitalization are retained.
 */
export const APP_ICON_INVENTORY: readonly AppIconEntry[] = [
  ...inventory('Navigation', ['src/components/vyzualz/VyzualzSidebar.tsx'], [
    ['DRMVYZ', 'brand'], ['React', 'navReact'], ['Preset Manager', 'navPreset'], ['Show Manager', 'navShow'],
    ['Lyric Manager', 'navLyrics'], ['Media Manager', 'navMedia'],
    ['Expand sidebar', 'right'], ['Collapse sidebar', 'left'],
  ]),
  ...inventory('Workspace', [
    'src/components/vyzualz/react/ReactView.tsx', 'src/components/vyzualz/layout/WorkspaceRail.tsx',
    'src/components/vyzualz/shared/VyzualzHeaderActions.tsx', 'src/components/vyzualz/shared/HeaderSystemStatus.tsx',
    'src/components/vyzualz/shared/HeaderNotificationsButton.tsx', 'src/components/vyzualz/react/trackTimeline/TrackTimelineVisualizer.tsx', 'src/components/vyzualz/shared/NotificationDrawer.tsx',
  ], [
    ['React Workspace', 'grid'], ['Inspector', 'settings'], ['Settings', 'settings'], ['Layout Lab', 'sliders'],
    ['Notifications', 'bell'], ['Open notifications', 'bell'], ['Close notifications', 'close'],
    ['App CPU usage [percent] percent', 'cpu'], ['Nothing loading', 'loading'], ['Loading: [activity]', 'loading'],
    ['Expand left inspector', 'right'], ['Collapse left inspector', 'left'],
    ['Expand right inspector', 'left'], ['Collapse right inspector', 'right'],
    ['Expand Track Map row icons', 'expand'], ['Collapse Track Map row icons', 'collapse'],
    ['Maximize the live output stage', 'cameraFocus'], ['Restore workspace rails and timeline', 'collapse'],
  ]),
  ...inventory('Audio dock', ['src/components/vyzualz/shared/VyzualzAudioDock.tsx'], [
    ['Previous track', 'previous'], ['Play', 'play'], ['Pause', 'pause'], ['Next track', 'next'],
    ['Rekordbox', 'rekordbox'], ['Track/File', 'file'], ['Track volume', 'volume'], ['Add Track', 'plus'], ['Append audio to playlist', 'plus'],
    ['Replace: [track]', 'fileImport'], ['Zoom in', 'plus'], ['Zoom out', 'minus'],
    ['Audio source & Rekordbox', 'sliders'], ['Audio Source', 'mic'], ['Tap tempo', 'tap'],
    ['Set cue point here', 'cue'], ['Jump to cue ([time])', 'cue'], ['BPM Sync: ON', 'sync'], ['BPM Sync: OFF', 'off'],
    ['Playlist', 'playlist'], ['Automatic advance', 'check'], ['Remove from playlist', 'delete'],
    ['Reset to analyzed BPM', 'rotateLeft'],
  ]),
  ...inventory('Media Manager', [
    'src/features/media/MediaManagerView.tsx', 'src/components/vyzualz/media/MediaLibraryBrowser.tsx',
    'src/components/vyzualz/media/MediaManagerInspector.tsx', 'src/components/vyzualz/media/MediaManagerStage.tsx',
    'src/components/vyzualz/media/AudioTrackCard.tsx', 'src/components/vyzualz/media/PoolTextEntries.tsx',
    'src/components/vyzualz/media/MediaEditPanel.tsx',
  ], [
    ['Media Library', 'layers'], ['New Collection', 'folderAdd'], ['New Media', 'imageAdd'],
    ['Media Details', 'info'], ['Save Changes', 'save'], ['Delete Media', 'delete'],
    ['Edit collection', 'edit'], ['Delete collection', 'delete'], ['Delete pool', 'delete'],
    ['[collection name]', 'folder'], ['[pool name]', 'folder'], ['Preview media', 'eye'],
    ['Favourite', 'star'], ['Unfavourite', 'starOff'], ['Remove', 'delete'],
    ['Search media…', 'search'], ['Clear search', 'close'], ['Grid view', 'grid'], ['List view', 'list'],
    ['Load [track]', 'download'], ['Reload [track]', 'download'],
    ['AI extract lyrics from this track', 'wand'], ['Lyrics', 'lyrics'], ['More actions', 'more'],
    ['Delete track and linked lyric data', 'delete'], ['Edit text', 'edit'], ['Delete text', 'delete'],
    ['Crop', 'crop'], ['Rotate left 90°', 'rotateLeft'], ['Rotate right 90°', 'rotateRight'],
    ['LOCAL', 'warning'], ['DERIVATIVE', 'warning'],
  ]),
  ...inventory('Media dialogs', [
    'src/components/vyzualz/MediaUploadModal.tsx', 'src/components/vyzualz/media/CollectionEditorModal.tsx',
    'src/components/vyzualz/media/AudioTrackEditModal.tsx', 'src/components/vyzualz/media/AudioTrackPreviewModal.tsx',
    'src/components/vyzualz/media/MediaPreviewModal.tsx', 'src/features/personalization/components/BrandKitAssetsEditor.tsx',
  ], [
    ['Media Upload', 'upload'], ['Close', 'close'], ['New Collection', 'folderAdd'], ['Edit Collection', 'folder'],
    ['Edit Audio Metadata', 'edit'], ['[track title]', 'play'], ['Choose [asset]', 'image'],
    ['Close collection editor', 'close'], ['Close audio editor', 'close'], ['Close preview', 'close'],
    ['Close audio preview', 'close'], ['Close asset picker', 'close'], ['[asset name]', 'shape'], ['Remove [file name]', 'delete'],
  ]),
  ...inventory('Preset Manager', [
    'src/components/vyzualz/presetManager/PresetManagerView.tsx', 'src/components/vyzualz/react/ReactPresetCard.tsx',
    'src/components/vyzualz/react/controls/PresetSearchRow.tsx',
  ], [
    ['Preset Library', 'layers'], ['Create preset', 'plus'], ['Add to favorites', 'star'],
    ['Remove from favorites', 'starOff'], ['Search presets', 'search'], ['Clear search', 'close'],
  ]),
  ...inventory('Show Manager', [
    'src/components/vyzualz/showManager/ShowManagerView.tsx', 'src/components/vyzualz/showManager/PixGridDeckBuilder.tsx',
    'src/components/vyzualz/layout/HeaderGlyphs.tsx',
  ], [
    ['New Show', 'fileAdd'], ['Open Show', 'folder'], ['Save + Make Active', 'saveActive'],
    ['Close Open Show window', 'close'], ['All Shows', 'folder'], ['Search Shows', 'search'],
    ['Show Library', 'file'], ['Component Library', 'layers'], ['[fixture] actions', 'moreVertical'],
    ['New Show', 'plus'], ['Copy Show', 'copy'], ['Deck Images', 'image'], ['Deck Builder', 'settings'],
    ['Remove image', 'close'], ['Pixel Grid', 'pixGrid'], ['Bars', 'bars'], ['Lights', 'movingHead'],
    ['Particles', 'particles'], ['Strobe', 'strobe'], ['Text', 'text'], ['Textures', 'texture'],
    ['Materials', 'shape'], ['Media', 'image'], ['Shaders', 'shader'], ['Fonts', 'font'],
    ['↖', 'pointer'], ['✥', 'move'], ['↻', 'rotateRight'], ['⌗', 'gridSnap'], ['▦', 'grid'], ['◫', 'split'],
  ]),
  ...inventory('Lyric Manager', [
    'src/features/lyrics/LyricManagerView.tsx', 'src/features/lyrics/components/LyricManagerHeader.tsx',
    'src/features/lyrics/components/LyricDocumentSidebar.tsx', 'src/features/lyrics/components/LyricPreviewPanel.tsx',
    'src/features/lyrics/components/LyricReviewSummary.tsx', 'src/features/lyrics/components/JsonLyricImporter.tsx',
    'src/features/lyrics/components/LyricSearchFilterRow.tsx', 'src/features/lyrics/components/LyricTrackBrowser.tsx', 'src/features/lyrics/components/LyricCuesWindow.tsx',
  ], [
    ['Tracks', 'waveform'], ['Add tracks', 'plus'], ['Versions', 'lyrics'],
    ['New version', 'fileAdd'], ['Import version', 'fileImport'], ['Document Workspace', 'file'],
    ['Show Lyrics', 'lyrics'], ['Save', 'save'], ['Save + Make Active', 'saveActive'],
    ['Rename', 'edit'], ['Duplicate', 'copy'], ['Make Active', 'check'], ['Delete', 'delete'],
    ['Save lyric document name', 'check'], ['Cancel lyric document rename', 'close'],
    ['Preview Lyrics', 'eye'], ['Review & Validation', 'checklist'], ['Drop .json file here', 'upload'],
    ['[file name]', 'file'], ['Included', 'check'], ['Search title or artist…', 'search'], ['Search versions…', 'search'],
    ['Close tracks and versions', 'close'], ['Close inspector', 'close'], ['Cue has warnings', 'warning'],
  ]),
  ...inventory('Lyric timeline', [
    'src/features/lyrics/components/LyricTimelineToolbar.tsx', 'src/features/lyrics/editor/LyricCueInspector.tsx',
    'src/features/lyrics/editor/LyricCueTimeline.tsx', 'src/features/lyrics/components/LyricCuesWindow.tsx',
  ], [
    ['Add cue', 'plus'], ['Undo lyric edit', 'undo'], ['Redo lyric edit', 'redo'],
    ['Set start to playhead', 'alignStart'], ['Set end to playhead', 'alignEnd'],
    ['Move to playhead', 'move'], ['Duplicate cue', 'copy'], ['Split at playhead', 'scissors'],
    ['Merge previous cue', 'left'], ['Merge next cue', 'right'], ['Delete cue', 'delete'],
    ['Play lyric preview', 'play'], ['Pause lyric preview', 'pause'], ['Preview volume', 'volume'],
  ]),
  ...inventory('Engines', ['src/components/vyzualz/react/reactEngineCatalog.ts', 'src/components/vyzualz/react/reactEngineIcons.tsx'], [
    ['Shader Pads', 'shader'], ['Cinematic Worlds', 'orbit'], ['Cinema 2.0', 'cinema'],
    ['Sound Drawing', 'waveform'], ['CANVAS', 'canvas'], ['LaserDMX', 'laser'], ['PixGrid', 'pixGrid'], ['HEADLINER', 'headliner'],
  ]),
  ...inventory('Sound Drawing', ['src/components/vyzualz/react/ReactEnginePanel.tsx', 'src/components/vyzualz/react/FontLibraryPanel.tsx', 'src/components/vyzualz/react/SoundDrawingTimelineLane.tsx'], [
    ['Classic Scope', 'scope'], ['Built-in Shape', 'shape'], ['Text', 'text'], ['SVG', 'svg'],
    ['Font Library', 'font'], ['Import', 'plus'], ['Search fonts…', 'search'], ['Clear font search', 'close'], ['Remove font', 'delete'],
    ['Cancel', 'close'], ['Add', 'plus'],
  ]),
  ...inventory('Cinematic Worlds', ['src/components/vyzualz/react/ReactEnginePanel.tsx', 'src/components/vyzualz/react/CinematicWorldControlSchema.ts'], [
    ['Event Horizon', 'orbit'], ['Mirror Dimension', 'mirror'], ['Reactive Constellation', 'constellation'],
    ['Infinite Corridor', 'corridor'], ['Fracture Rift', 'energy'], ['Ancient Machine', 'settings'],
    ['Storm Gateway', 'storm'], ['Electric Storm', 'energy'], ['Monolith Gate', 'shape'],
    ['Liquid Membrane', 'shape'], ['Celestial Cathedral', 'shape'], ['Afterhours', 'shape'],
    ['Orbital Prism Array', 'shape'], ['Legacy Portal', 'shape'],
  ]),
  ...inventory('Lighting fixtures', ['src/components/vyzualz/react/ReactTypes.ts', 'src/components/vyzualz/react/LaserDmxShowDirectorPalette.tsx', 'src/components/vyzualz/react/LaserDmxShowDirectorFixtureIcon.tsx'], [
    ['Laser', 'laser'], ['Moving Head', 'movingHead'], ['LED Bar', 'ledBar'], ['LED Tube', 'ledTube'],
    ['Strobe', 'strobe'], ['Blinder', 'blinder'], ['PAR Wash', 'wash'], ['Video Wall', 'videoWall'], ['Haze', 'haze'], ['CO₂ Jet', 'co2'],
  ]),
  ...inventory('Headliner', ['src/components/vyzualz/react/headliner/HeadlinerWorkspace.tsx'], [
    ['Fullscreen', 'borderless'],
  ]),
  ...inventory('Beam Matrix presets', ['src/components/vyzualz/react/LaserDmxBeamMatrixPresetBrowser.tsx'], [
    ['Search Beam Matrix presets', 'search'], ['Clear preset search', 'close'], ['Remove filter: [tag]', 'close'],
  ]),
  ...inventory('LaserDMX diagnostics', ['src/components/vyzualz/react/LaserDmxRendererDiagnosticsPanel.tsx'], [
    ['Awaiting Audio', 'waveform'],
  ]),
  ...inventory('Track Map', ['src/components/vyzualz/react/ReactTrackMapStrip.tsx', 'src/components/vyzualz/react/trackTimeline/TrackTimelineVisualizer.tsx'], [
    ['Beats', 'rhythm'], ['Sections', 'layers'], ['Energy', 'bars'], ['Time', 'timeline'], ['Track Timeline', 'timeline'],
    ['Cues', 'cue'], ['Phrases', 'tree'], ['Moments', 'star'], ['Actions', 'route'],
    ['Back to full Track Map', 'left'], ['Expand all groups', 'expand'], ['Collapse all groups', 'collapse'],
    ['Center on playhead', 'center'], ['Audio Intelligence details', 'waveform'],
    ['Retry', 'rotateLeft'], ['Reanalyze', 'rotateLeft'], ['Failed', 'close'], ['Grid stale', 'warning'],
  ]),
  ...inventory('Audio Intelligence', ['src/components/vyzualz/modulation/MusicIntelligenceDiagnosticsPanel.tsx'], [
    ['Track', 'music'], ['Live Input', 'mic'], ['Audio Bands', 'bars'], ['Rhythm', 'rhythm'],
    ['Beat Grid', 'gridSnap'], ['Musical Phrases', 'tree'], ['Energy', 'energy'], ['Measurements', 'sliders'],
    ['Section', 'layers'], ['Section & Structure', 'tree'], ['Event Markers', 'timeline'],
    ['Harmonic', 'waveform'], ['Stems', 'split'], ['Lyrics', 'lyrics'], ['Semantic', 'tag'],
  ]),
  ...inventory('Canvas & PixGrid', [
    'src/components/vyzualz/react/ReactCanvasEngineShell.tsx', 'src/components/vyzualz/react/pixGrid/PixGridAuthoringPanel.tsx',
    'src/components/vyzualz/react/ReactModulationPanel.tsx', 'src/components/vyzualz/react/pixGrid/PixGridTrackMapCueEditor.tsx', 'src/components/vyzualz/react/shaders/ui/ShaderModulationRouteEditor.tsx',
  ], [
    ['Reset all layer Engine overrides', 'rotateLeft'], ['Reset layer Engine overrides', 'rotateLeft'], ['Delete layer', 'delete'],
    ['Auto Role', 'check'], ['Trigger', 'wand'], ['Add another Trigger', 'plus'],
    ['Add an effect for [media]', 'layers'], ['Hide an effect for [media]', 'layers'], ['FX', 'fx'], ['Close PixGrid cue editor', 'close'],
    ['Remove [effect] from [layer]', 'close'], ['Remove the trigger for [parameter]', 'close'],
    ['Hide [layer]', 'eyeOff'], ['Show [layer]', 'eye'], ['Lock [layer]', 'lock'], ['Unlock [layer]', 'unlock'],
    ['Move [layer] down', 'down'], ['Move [layer] up', 'up'], ['Duplicate [layer]', 'copy'], ['Delete [layer]', 'delete'],
    ['Delete modulation route', 'close'],
  ]),
  ...inventory('Shader scenes', ['src/components/vyzualz/react/shaders/ui/ShaderLibraryPanel.tsx'], [
    ['Toggle favorite', 'star'], ['Duplicate scene', 'copy'], ['Export scene as JSON', 'download'],
    ['Rename scene', 'edit'], ['Delete scene', 'delete'], ['Search shader scenes', 'search'],
  ]),
  ...inventory('Output', ['src/components/vyzualz/react/output/OutputCastControl.tsx', 'src/components/vyzualz/react/ReactGlobalOutputControls.tsx'], [
    ['Cast visual output', 'cast'], ['Close cast panel', 'close'], ['Window', 'window'], ['Borderless', 'borderless'], ['Full Screen', 'expand'],
    ['16:9', 'ratio16x9'], ['16:10', 'ratio16x10'], ['4:3', 'ratio4x3'], ['3:2', 'ratio3x2'], ['1:1', 'ratio1x1'], ['9:16', 'ratio9x16'], ['Current Devices', 'waveform'], ['Available Devices', 'people'], ['Refresh output devices', 'sync'],
    ['Local displays', 'monitor'], ['DRMVYZ receivers', 'cast'], ['Open macOS Displays', 'apple'], ['Open Windows Displays', 'windows'], ['Choose Google Cast Device', 'google'],
    ['OUTPUT SAFE', 'power'], ['OUTPUT ARMED', 'power'], ['OUTPUT DARK', 'blackout'], ['OUTPUT PREVIEW', 'power'], ['OUTPUT OFFLINE', 'off'], ['Reveal output', 'eye'], ['Blackout output', 'blackout'],
  ]),
  ...inventory('Performance pads', ['src/components/vyzualz/react/ReactPerformancePads.tsx'], [
    ['Performance Pads', 'grid'],
  ]),
  ...inventory('Recording', ['src/components/vyzualz/recording/RecordingPanel.tsx'], [
    ['Start Recording', 'record'], ['Stop & Save', 'stop'], ['PNG Frame', 'camera'],
  ]),
  ...inventory('Settings & account', [
    'src/components/vyzualz/settings/SettingsModal.tsx', 'src/components/vyzualz/settings/developer/DeveloperLoggingPanel.tsx',
    'src/components/auth/AuthPage.tsx', 'src/features/personalization/components/BrandKitPaletteEditor.tsx',
  ], [
    ['Upload profile photo', 'upload'], ['Close settings', 'close'], ['Copy this log entry', 'copy'], ['Reset [color role]', 'rotateLeft'],
    ['EMAIL', 'mail'], ['EMAIL', 'user'], ['FULL NAME', 'user'], ['ARTIST NAME', 'mic'], ['PASSWORD', 'lock'],
    ['CONFIRM PASSWORD', 'lock'], ['NEW PASSWORD', 'lock'], ['CODE', 'lock'],
    ['PASSWORD', 'eye'], ['PASSWORD', 'eyeOff'], ['Check your inbox', 'check'],
    ['Cloud sync is not configured.', 'warning'], ['Auto Quality', 'check'], ['BPM Sync', 'check'],
  ]),
  ...inventory('Shared controls', [
    'src/components/vyzualz/react/controls/NoticeCard.tsx', 'src/components/vyzualz/react/controls/ConfirmDialog.tsx',
    'src/components/vyzualz/react/controls/IconMorphToggle.tsx', 'src/components/vyzualz/react/ReactControlRows.tsx',
    'src/components/vyzualz/react/DualRailCollapsible.tsx', 'src/components/shared/Dropdown/Dropdown.tsx',
    'src/components/shared/InfoPopover/InfoPopover.tsx', 'src/components/vyzualz/context-menu/ContextActionMenu.tsx',
  ], [
    ['[notice title]', 'info'], ['[confirmation title]', 'info'],
    ['Dismiss', 'close'], ['BPM Sync', 'check'], ['BPM Sync', 'off'],
    ['[section label]', 'chevronDown'], ['[section label]', 'chevronUp'], ['Close information', 'close'], ['[submenu]', 'chevronRight'],
  ]),
]
