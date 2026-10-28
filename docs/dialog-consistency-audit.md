# Dialog consistency audit

The recovered-lyric-draft dialog is the reference: the production ConfirmDialog
component, with a centered icon badge, heading, supporting message and bottom
actions. The audit records 37 shared confirmation usages (including
Layout Lab samples), 27 information-popover usages and all explicit
dialog-role surfaces.

## Standardized prompt implementations

| Prompt | States / decisions preserved |
| --- | --- |
| Unsaved lyric changes | Closed/open, custom explanation, idle/saving; Cancel, Discard and Save. |
| Lyric activation | Missing/present target, optional current version, activating; Cancel and Make Active. |
| Raster SVG warning | Embedded-raster detection; Cancel and Continue Upload with file name and capability explanation. |
| Clear React project | Initial explicit request, confirm and cancel; no project data cleared before confirmation. |
| Beam Matrix reset | Initial request, confirm and cancel; reset handler preserved. |
| Beam Matrix preset replacement | Modified program selection, replace and cancel; pending preset preserved. |
| Layout Lab Beam Matrix reset | Same canonical prompt as production, local fixture actions preserved. |

Existing recovery/conflict, media/collection/pool/track/lyric deletion, save-as,
unsaved media, camera permissions and beam/fixture confirmations already use the
shared component. All production alertdialog elements now originate there.
Non-destructive prompts default to the neutral accent badge; destructive prompts
retain their warning tone. Supporting copy is connected with aria-describedby.
The shared prompt overlay sits at 1500, above Media Upload (1400), so warnings
launched from upload windows remain visible.

## Information popovers

The shared InfoPopover now always has a centered 42px icon badge, a centered
heading, supporting copy below and centered footer actions. Custom contextual icons,
anchoring/flipping, outside-click/Escape dismissal, focus restoration, section content
and scrolling are retained. The surface, border, corner radius and shadow match the
confirmation family. Dialog heading/copy roles live in src/styles/typography.css,
including portaled/theme variants.

## Other dialog surfaces reviewed

Settings windows, media/audio editors and previews, upload forms, Show browsing/
creation, asset pickers, color controls, fixture quick-action menus, PixGrid cue
editing, casting controls and the Notifications drawer are structured workspace
surfaces rather than information/confirmation prompts. Their navigation, forms,
media canvases and picker controls retain their dedicated layouts. Their child
confirmation/information prompts use the shared treatments above. Layout Lab radial
engine selectors are interaction studies.

## Source inventory

| Source | Kind | Title / accessible name |
| --- | --- | --- |
| src/components/shared/InfoPopover/InfoPopover.tsx:328 | Workspace/editor/picker surface | {titleId} |
| src/components/vyzualz/MediaUploadModal.tsx:986 | Shared confirmation | "SVG Contains Only a Raster Image" |
| src/components/vyzualz/MediaUploadModal.tsx:1003 | Workspace/editor/picker surface | "Media Upload" |
| src/components/vyzualz/SettingsModal.tsx:119 | Workspace/editor/picker surface | div |
| src/components/vyzualz/media/AudioTrackCard.tsx:229 | Shared confirmation | "Delete Track" |
| src/components/vyzualz/media/AudioTrackEditModal.tsx:77 | Workspace/editor/picker surface | "audio-editor-title" |
| src/components/vyzualz/media/AudioTrackPreviewModal.tsx:54 | Workspace/editor/picker surface | "audio-preview-title" |
| src/components/vyzualz/media/CollectionEditorModal.tsx:78 | Workspace/editor/picker surface | "collection-editor-title" |
| src/components/vyzualz/media/MediaDeleteConfirmDialog.tsx:20 | Shared confirmation | {count > 1 ? 'Delete Media Items' : 'Delete Media Item'} |
| src/components/vyzualz/media/MediaLibraryBrowser.tsx:1717 | Shared confirmation | "Delete Collection" |
| src/components/vyzualz/media/MediaLibraryBrowser.tsx:1726 | Shared confirmation | "Delete Pool" |
| src/components/vyzualz/media/MediaPreviewModal.tsx:112 | Workspace/editor/picker surface | {′Preview: ${media.title ?? media.name}′} |
| src/components/vyzualz/media/SaveAsMediaDialog.tsx:32 | Shared confirmation | "Save As" |
| src/components/vyzualz/media/UnsavedMediaChangesDialog.tsx:51 | Shared confirmation | "Unsaved changes" |
| src/components/vyzualz/react/LaserDmxBeamInspector.tsx:159 | Shared confirmation | "Delete Beam" |
| src/components/vyzualz/react/LaserDmxBeamInspector.tsx:267 | Shared confirmation | "Delete Beams" |
| src/components/vyzualz/react/LaserDmxBeamMatrixPanel.tsx:101 | Shared confirmation | "Reset Beam Matrix?" |
| src/components/vyzualz/react/LaserDmxBeamMatrixPanel.tsx:170 | Shared confirmation | "Delete Beams" |
| src/components/vyzualz/react/LaserDmxBeamMatrixPresetBrowser.tsx:193 | Shared confirmation | "Replace modified program?" |
| src/components/vyzualz/react/LaserDmxReactionGroupInspector.tsx:169 | Shared confirmation | "Delete Group" |
| src/components/vyzualz/react/LaserDmxShowDirectorCanvas.tsx:1790 | Workspace/editor/picker surface | {′${quickActionFixture.label} quick actions′} |
| src/components/vyzualz/react/ReactControlRows.tsx:557 | Workspace/editor/picker surface | {′${label} color′} |
| src/components/vyzualz/react/ReactResetActions.tsx:42 | Shared confirmation | "Clear authored React project content?" |
| src/components/vyzualz/react/controls/ConfirmDialog.tsx:90 | Canonical alertdialog root | {headingId} |
| src/components/vyzualz/react/headliner/HeadlinerWorkspace.tsx:265 | Shared confirmation | "Camera Access Needed" |
| src/components/vyzualz/react/layoutLab/LaserDmxMockup.tsx:49 | Shared confirmation | "Reset Beam Matrix?" |
| src/components/vyzualz/react/layoutLab/LayoutLabMidnightChrome.tsx:90 | Shared information | "Audio source" |
| src/components/vyzualz/react/layoutLab/LayoutLabMidnightChrome.tsx:93 | Shared information | "Playlist" |
| src/components/vyzualz/react/layoutLab/LayoutLabPopupsWindow.tsx:98 | Shared confirmation | "Delete Track" |
| src/components/vyzualz/react/layoutLab/LayoutLabPopupsWindow.tsx:107 | Shared confirmation | "Delete Collection" |
| src/components/vyzualz/react/layoutLab/LayoutLabPopupsWindow.tsx:110 | Shared confirmation | "Delete Pool" |
| src/components/vyzualz/react/layoutLab/LayoutLabPopupsWindow.tsx:113 | Shared confirmation | "Delete Show" |
| src/components/vyzualz/react/layoutLab/LayoutLabPopupsWindow.tsx:121 | Shared confirmation | "Delete Show" |
| src/components/vyzualz/react/layoutLab/LayoutLabPopupsWindow.tsx:130 | Shared confirmation | "Change Section Engine?" |
| src/components/vyzualz/react/layoutLab/LayoutLabPopupsWindow.tsx:139 | Shared confirmation | "Delete Deck" |
| src/components/vyzualz/react/layoutLab/LayoutLabPopupsWindow.tsx:142 | Shared confirmation | "Delete Beam" |
| src/components/vyzualz/react/layoutLab/LayoutLabPopupsWindow.tsx:145 | Shared confirmation | "Delete Beams" |
| src/components/vyzualz/react/layoutLab/LayoutLabPopupsWindow.tsx:148 | Shared confirmation | "Delete Group" |
| src/components/vyzualz/react/layoutLab/LayoutLabPopupsWindow.tsx:151 | Shared confirmation | "Camera Access Needed" |
| src/components/vyzualz/react/layoutLab/LayoutLabPopupsWindow.tsx:335 | Shared information | "Audio Source" |
| src/components/vyzualz/react/layoutLab/LayoutLabReactAudioDock.tsx:236 | Shared information | "Audio Source" |
| src/components/vyzualz/react/layoutLab/LayoutLabReactAudioDock.tsx:329 | Shared information | "Playlist" |
| src/components/vyzualz/react/layoutLab/optionA/OptionADock.tsx:215 | Shared information | "Audio Source" |
| src/components/vyzualz/react/layoutLab/optionA/OptionADock.tsx:252 | Shared information | "Playlist" |
| src/components/vyzualz/react/layoutLab/optionB/OptionBChrome.tsx:34 | Shared information | "Notifications" |
| src/components/vyzualz/react/layoutLab/optionB/OptionBChrome.tsx:35 | Shared information | "DRMVYZ Professional" |
| src/components/vyzualz/react/layoutLab/optionB/OptionBDock.tsx:47 | Shared information | "Audio source" |
| src/components/vyzualz/react/layoutLab/optionB/OptionBDock.tsx:48 | Shared information | "Playlist" |
| src/components/vyzualz/react/layoutLab/optionC/OptionCChrome.tsx:27 | Shared information | "Notifications" |
| src/components/vyzualz/react/layoutLab/optionC/OptionCChrome.tsx:28 | Shared information | "DRMVYZ · Professional" |
| src/components/vyzualz/react/layoutLab/optionC/OptionCDock.tsx:45 | Shared information | "Audio source" |
| src/components/vyzualz/react/layoutLab/optionC/OptionCDock.tsx:46 | Shared information | "Playlist" |
| src/components/vyzualz/react/layoutLab/optionD/OptionDChrome.tsx:57 | Shared information | "Notifications" |
| src/components/vyzualz/react/layoutLab/optionD/OptionDChrome.tsx:58 | Shared information | "DRMVYZ · Professional" |
| src/components/vyzualz/react/layoutLab/optionD/OptionDDock.tsx:68 | Shared information | "Audio source" |
| src/components/vyzualz/react/layoutLab/optionD/OptionDDock.tsx:72 | Shared information | "Playlist" |
| src/components/vyzualz/react/layoutLab/optionE/OptionEChrome.tsx:48 | Shared information | "Notifications" |
| src/components/vyzualz/react/layoutLab/optionE/OptionEChrome.tsx:49 | Shared information | "Profile" |
| src/components/vyzualz/react/layoutLab/optionF/OptionFChrome.tsx:57 | Shared information | "Notifications" |
| src/components/vyzualz/react/layoutLab/optionF/OptionFChrome.tsx:58 | Shared information | "DRMVYZ · Professional" |
| src/components/vyzualz/react/layoutLab/optionF/OptionFDock.tsx:68 | Shared information | "Audio source" |
| src/components/vyzualz/react/layoutLab/optionF/OptionFDock.tsx:72 | Shared information | "Playlist" |
| src/components/vyzualz/react/layoutLab/radialEngine/DialFanOverlay.tsx:45 | Workspace/editor/picker surface | "Choose React engine" |
| src/components/vyzualz/react/layoutLab/radialEngine/OrbitOverlay.tsx:35 | Workspace/editor/picker surface | "Choose React engine" |
| src/components/vyzualz/react/layoutLab/radialEngine/RotaryOverlay.tsx:46 | Workspace/editor/picker surface | "Choose React engine" |
| src/components/vyzualz/react/output/OutputCastControl.tsx:777 | Workspace/editor/picker surface | {titleId} |
| src/components/vyzualz/react/pixGrid/PixGridTrackMapCueEditor.tsx:165 | Workspace/editor/picker surface | {′${isNew ? 'Create' : 'Edit'} PixGrid action cue′} |
| src/components/vyzualz/settings/SettingsModal.tsx:579 | Workspace/editor/picker surface | {′${idPrefix}-title′} |
| src/components/vyzualz/shared/NotificationDrawer.tsx:97 | Workspace/editor/picker surface | "Notifications" |
| src/components/vyzualz/shared/VyzualzAudioDock.tsx:1281 | Shared information | "Audio Source" |
| src/components/vyzualz/shared/VyzualzAudioDock.tsx:1370 | Shared information | "Playlist" |
| src/components/vyzualz/showManager/ShowManagerView.tsx:315 | Workspace/editor/picker surface | "show-browser-heading" |
| src/components/vyzualz/showManager/ShowManagerView.tsx:450 | Shared confirmation | "Delete Show" |
| src/components/vyzualz/showManager/ShowManagerView.tsx:667 | Workspace/editor/picker surface | {headingId} |
| src/components/vyzualz/showManager/ShowManagerView.tsx:3039 | Shared confirmation | "Change Section Engine?" |
| src/components/vyzualz/showManager/ShowManagerView.tsx:3048 | Shared confirmation | "Delete Show" |
| src/components/vyzualz/showManager/ShowManagerView.tsx:3057 | Shared confirmation | "Delete Deck" |
| src/features/lyrics/components/ConfirmLyricActivationDialog.tsx:13 | Shared confirmation | "Replace active lyric version?" |
| src/features/lyrics/components/ConfirmLyricDeleteDialog.tsx:13 | Shared confirmation | "Delete Lyric Version" |
| src/features/lyrics/components/ConfirmTrackDeleteDialog.tsx:13 | Shared confirmation | "Delete Track" |
| src/features/lyrics/components/LyricConflictDialog.tsx:34 | Shared confirmation | "This lyric version was changed elsewhere" |
| src/features/lyrics/components/LyricRecoveryDialog.tsx:39 | Shared confirmation | {title} |
| src/features/lyrics/components/UnsavedLyricChangesDialog.tsx:14 | Shared confirmation | "Unsaved lyric changes" |
| src/features/personalization/components/BrandKitAssetsEditor.tsx:117 | Workspace/editor/picker surface | "bk-picker-title" |

## Validation and handoff

22 focused tests passed: unsaved lyric decisions and busy handling, activation,
conflict and unsaved-media behavior, information-popover close/Escape/focus behavior,
explicit project clearing, actual lyric navigation guards and the Layout Lab popup
catalog. Eleven browser cases passed for icon/title/copy/action order, centering,
shared typography and overflow, including 480px windows and themed/custom-icon
information popovers. Screenshots were reviewed. TypeScript, focused ESLint and
whitespace checks passed. Existing unrelated notice/toggle changes were preserved.
Changes are uncommitted; no commit was requested.
