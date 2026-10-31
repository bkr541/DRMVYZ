# Notice card content audit

Shared notice titles use the 12px notice-title size in `src/styles/typography.css`
across inline cards, notification drawers and Layout Lab variants. Supporting copy
retains its existing typography.

Audited 118 JSX notice-card entry points, plus the ErrorNoticeCards adapter,
NotificationDrawer fixed cards/events and page-notification producers.
System/debug log forwarding to notice cards has since been removed; those entries
are viewed in Settings → Developer → Logging.

## Contract and corrections

Every rendered card must contain a nonblank heading and a supporting text line.
NoticeCard now checks strings, arrays, fragments and nested DOM text; missing,
whitespace-only, empty-collection and action-only content receives tone-specific
supporting copy. Existing content and actions remain visible. Empty headings also
receive a nonblank title. NotificationDrawer and DrawerNotice use the same guard.

The reported No cues in document state now explains how to add/import/extract cues.
All 12 lyric validation codes have explicit recovery guidance (cue text/time/bounds/
confidence, overlaps, word timing/confidence/containment, group references and empty
documents). JSON import errors explain correction/reparse. All four Layout Lab tone
samples and Option B's compact variants now include authored supporting text.
Optional media-save failures, HEADLINER camera detail and unavailable Cinematic
Worlds mapping reasons have context-specific copy when their message is absent.

## State review

- Media preview/stage: loading-link recovery, unavailable files, failed video/image/
  transparent previews and live-preview faults have supporting copy in each branch.
- Media library/editing: guarded load/font/parse/edit/action errors, refresh, local-only
  storage, mutation conflicts/failures, collection reorder, upload cleanup, deletion
  progress/failure, cloud sign-in and audio failures were checked. Retry/Reapply states
  retain explanation independently of the action label.
- Show/React: PixGrid upload/name/compiler errors and valid configuration, audio-lock/
  microphone/playback states, authoring and section ownership, recording FPS/errors,
  render fallback, source/media pools, shader errors, timing/scanner diagnostics,
  conversion states and Music Intelligence availability were checked. Message-gated
  cards and nonempty diagnostic arrays already provide bodies; the shared guard also
  handles blank external strings or unexpectedly empty arrays.
- Output/runtime: Cinema 2.0 availability/recovery, engine startup/render errors,
  HEADLINER tracker/camera errors, provider status, casting/session errors and output
  preparation were checked. Error strings are gated; optional details are guarded.
- Lyrics: import success/review/failure, validation errors/warnings, cue warnings,
  track load, extraction compatibility/offset/warnings/errors/stalled polling, provider
  review and manager status/error states were checked.
- Shared consumers: confirm-dialog notices, error adapters, registered drawer cards,
  fixed Track Timeline analysis cards and warning lists, and notification events
  all converge on the guarded NoticeCard. Notification producers
  provide explicit messages; malformed/empty event payloads still get supporting copy.
- Layout Lab: title-only variants are now compact-copy examples. Preview popup,
  cast, delete-confirm and fixed notification samples retain their supporting text.

## Entry-point inventory

Conditions below include surrounding JSX gates and conditional selectors in each
card. Component-level early returns and data producers are covered by the state
review above. All rows are protected by the shared rendering contract; dynamic
message/array states do not depend on their upstream condition to supply text.

| Source | Heading expression | Render gates / state selectors |
| --- | --- | --- |
| src/components/vyzualz/MediaUploadModal.tsx:1351 | "Newer media changes are available." | isEdit && editMutation?.status === 'conflict'; saving |
| src/components/vyzualz/MediaUploadModal.tsx:1360 | "Media changes were not saved." | isEdit && editMutation?.status === 'failed'; saving |
| src/components/vyzualz/MediaUploadModal.tsx:1368 | "Media upload issue" | (selectionError &#124;&#124; batchError &#124;&#124; (isEdit && loadError)) |
| src/components/vyzualz/media/MediaEditPanel.tsx:63 | "Editing unavailable" | Mounted by parent / unconditional |
| src/components/vyzualz/media/MediaEditPanel.tsx:196 | "Edit failed" | error |
| src/components/vyzualz/media/MediaLibraryBrowser.tsx:1306 | "Font library unavailable" | Mounted by parent / unconditional |
| src/components/vyzualz/media/MediaLibraryBrowser.tsx:1617 | "Media library unavailable" | queryError && filtered.length === 0; libraryFilter === 'pools'; libraryFilter === 'collections'; libraryFilter === 'fonts'; libraryFilter === 'tracks' |
| src/components/vyzualz/media/MediaLibraryBrowser.tsx:1704 | "Media action failed" | bulkActionError |
| src/components/vyzualz/media/MediaManagerInspector.tsx:295 | "Save failed" | error |
| src/components/vyzualz/media/MediaManagerInspector.tsx:362 | "Save failed" | error |
| src/components/vyzualz/media/MediaManagerInspector.tsx:486 | "Save failed" | error |
| src/components/vyzualz/media/MediaManagerInspector.tsx:488 | "Font parsing warning" | font.parseError |
| src/components/vyzualz/media/MediaManagerStage.tsx:194 | "Media unavailable" | !src; recovering |
| src/components/vyzualz/media/MediaManagerStage.tsx:196 | "Video unavailable" | isVideo && videoError; !src; recovering |
| src/components/vyzualz/media/MediaManagerStage.tsx:215 | "Image unavailable" | imageError; isVideo; isVideo && videoError; !src; recovering; activeBackgroundRemoval |
| src/components/vyzualz/media/MediaManagerStage.tsx:267 | "Live preview unavailable" | previewFault && editing |
| src/components/vyzualz/media/MediaPreviewModal.tsx:126 | "Media unavailable" | !src; recovering |
| src/components/vyzualz/media/MediaPreviewModal.tsx:128 | "Video unavailable" | isVideo && videoError; !src; recovering |
| src/components/vyzualz/media/MediaPreviewModal.tsx:155 | "Image unavailable" | imageError; isVideo; isVideo && videoError; !src; recovering |
| src/components/vyzualz/media/MediaStatusBar.tsx:72 | "Media library refresh" | Mounted by parent / unconditional |
| src/components/vyzualz/media/MediaStatusBar.tsx:78 | "Cloud storage unavailable" | Mounted by parent / unconditional |
| src/components/vyzualz/media/MediaStatusBar.tsx:84 | {′${operationLabels[mutationFailure.operation]} needs attention′} | mutationFailure.status === 'conflict' |
| src/components/vyzualz/media/MediaStatusBar.tsx:103 | "Collection order needs attention" | reorderFailure.status === 'conflict' |
| src/components/vyzualz/media/MediaStatusBar.tsx:115 | "Upload cleanup needs attention" | uploadCleanupState.status === 'failed' |
| src/components/vyzualz/media/MediaStatusBar.tsx:122 | "Media deletion" | deletionState.status === 'failed' |
| src/components/vyzualz/media/MediaStatusBar.tsx:133 | "Delete failed" | Mounted by parent / unconditional |
| src/components/vyzualz/media/MediaStatusBar.tsx:139 | "Audio library error" | Mounted by parent / unconditional |
| src/components/vyzualz/media/MediaStatusBar.tsx:145 | "Media library error" | Mounted by parent / unconditional |
| src/components/vyzualz/media/MediaStatusBar.tsx:151 | "Cloud sync unavailable" | Mounted by parent / unconditional |
| src/components/vyzualz/react/Cinema2Stage.tsx:277 | {runtimeSnapshot?.phase === 'unavailable' ? 'Cinema 2.0 unavailable' : runtimeSnapshot?.phase === 'context-lost' ? 'Cinema 2.0 recovering' : 'Cinema 2.0'} | message; runtimeSnapshot?.phase === 'unavailable'; runtimeSnapshot?.phase === 'context-lost' |
| src/components/vyzualz/react/CinematicWorldsControls.tsx:507 | "Ultra quality unavailable" | !ultraSupported && config.qualityTier === 'ultra' |
| src/components/vyzualz/react/CinematicWorldsControls.tsx:570 | "Unavailable Music Intelligence inputs" | inputDiagnostics.unavailableRoutes.length > 0; inputDiagnostics.activeRouteCount === 1 |
| src/components/vyzualz/react/CinematicWorldsControls.tsx:594 | {′${CINEMATIC_SOURCE_LABELS[route.source]} unavailable′} | routeDiagnostic; uiMode === 'simple' |
| src/components/vyzualz/react/FontLibraryPanel.tsx:148 | {entry.title} | Mounted by parent / unconditional |
| src/components/vyzualz/react/LaserDmxRendererDiagnosticsPanel.tsx:35 | "LaserDMX is using a fallback renderer" | diagnostics.contextLossCount > 0; diagnostics.contextLossCount === 1 |
| src/components/vyzualz/react/LaserDmxShowDirectorInspector.tsx:770 | "Scanner conversion preview" | scannerMigrationPreview && !fixture.scanner && scannerWarningsVisible; fixture.kind === 'laser' && scanner; !showAdvanced |
| src/components/vyzualz/react/LaserDmxShowDirectorInspector.tsx:976 | "Scanner diagnostics" | scannerIssues.length > 0; scannerWarningsVisible && scannerDiagnostics; fixture.kind === 'laser' && scanner; !showAdvanced |
| src/components/vyzualz/react/LaserDmxShowDirectorInspector.tsx:996 | "Scanner conversion preview" | scannerMigrationPreview; !fixture.scanner && scannerWarningsVisible; fixture.kind === 'laser' && scanner; !showAdvanced |
| src/components/vyzualz/react/LaserDmxShowDirectorInspector.tsx:1057 | "Timing requirements" | triggerNotes.length > 0; !showAdvanced |
| src/components/vyzualz/react/ReactCanvasEngineShell.tsx:185 | {title} | Mounted by parent / unconditional |
| src/components/vyzualz/react/ReactCanvasEngineShell.tsx:471 | "CANVAS media action" | actionFeedback |
| src/components/vyzualz/react/ReactCanvasEngineShell.tsx:2533 | "CUTBANK" | cutbankRendererNotice |
| src/components/vyzualz/react/ReactCanvasEngineShell.tsx:2649 | "CANVAS media could not load" | activeMediaLoadError |
| src/components/vyzualz/react/ReactCanvasEngineShell.tsx:2726 | "Particle renderer" | particleRendererNotice && particleReconstructionActive |
| src/components/vyzualz/react/ReactCanvasEngineShell.tsx:2729 | "Laser Image FX renderer" | laserImageFxRendererNotice && laserImageFxActive |
| src/components/vyzualz/react/ReactCanvasEngineShell.tsx:2732 | "Fractures renderer" | fracturesRendererNotice && fragmentCollageActive |
| src/components/vyzualz/react/ReactCanvasEngineShell.tsx:3370 | "No active Media Pool" | settings.poolAutomationEnabled && !settings.activeMediaPoolId |
| src/components/vyzualz/react/ReactCanvasEngineShell.tsx:3373 | "Performance pool is empty" | autoPerformanceActive && poolItems.length === 0 |
| src/components/vyzualz/react/ReactCanvasEngineShell.tsx:3482 | "Layer action failed" | actionFeedback |
| src/components/vyzualz/react/ReactCanvasEngineShell.tsx:4572 | "Active media required" | title === 'Particles' && canvasPresetSettings.particleDensity > 0.02 && !activeItem |
| src/components/vyzualz/react/ReactEnginePanel.tsx:306 | "No SVG selected" | svgStatus && !svgStatus.mediaId |
| src/components/vyzualz/react/ReactEnginePanel.tsx:308 | "SVG could not be loaded" | svgStatus?.error |
| src/components/vyzualz/react/ReactEnginePanel.tsx:310 | "No SVG glyph selected" | osc.sourceType === 'svgGlyph' && !svgStatus && !selectedGlyph |
| src/components/vyzualz/react/ReactEnginePanel.tsx:313 | "Text is empty" | osc.sourceType === 'text' && !osc.text.trim() |
| src/components/vyzualz/react/ReactEnginePanel.tsx:316 | "Font could not be read" | osc.sourceType === 'text' && selectedFont?.parseError |
| src/components/vyzualz/react/ReactEnginePanel.tsx:731 | "Source media unavailable" | glyphLostNotice; soundDrawingPerformanceSettings.selectedShowId == null; activeReactEngineId === 'oscilloscope' |
| src/components/vyzualz/react/ReactPersistenceStatus.tsx:25 | "Changes not safely stored" | phase === 'error'; error; retryPending |
| src/components/vyzualz/react/canvasPerformance/CanvasOrchestrationStage.tsx:994 | "CANVAS show media could not load" | mediaErrors.length > 0; mediaErrors.length === 1; mediaErrors[0]?.message |
| src/components/vyzualz/react/controls/ConfirmDialog.tsx:103 | {noticeTitle} | notice |
| src/components/vyzualz/react/headliner/HeadlinerWorkspace.tsx:282 | {status.title} | showNotice |
| src/components/vyzualz/react/layoutLab/CastScreenModalMockup.tsx:282 | "Output failed" | errorExpanded |
| src/components/vyzualz/react/layoutLab/CastScreenModalMockup.tsx:359 | {selectedWirelessProvider.name} | selectedWirelessProvider?.needsSetup; deviceTab === 'wireless' |
| src/components/vyzualz/react/layoutLab/DeleteConfirmDialogStyleGallery.tsx:37 | "Heads up" | Mounted by parent / unconditional |
| src/components/vyzualz/react/layoutLab/LayoutLabNoticeTab.tsx:41 | {title} | show('body') |
| src/components/vyzualz/react/layoutLab/LayoutLabNoticeTab.tsx:42 | {titleOnly} | show('title') |
| src/components/vyzualz/react/layoutLab/LayoutLabNoticeTab.tsx:43 | {title} | show('dismiss') |
| src/components/vyzualz/react/layoutLab/LayoutLabNoticeTab.tsx:45 | {title} | show('open') |
| src/components/vyzualz/react/layoutLab/optionB/OptionBLeft.tsx:13 | {variant === 'title' ? sample.titleOnly : sample.title} | !dismissed.has(id); variant === 'title'; ['dismiss', 'open'].includes(variant); variant === 'open' |
| src/components/vyzualz/react/output/OutputCastControl.tsx:885 | "Desktop app required" | !bridge |
| src/components/vyzualz/react/output/OutputCastControl.tsx:888 | "Output canvas preparing" | bridge && !canvasReady |
| src/components/vyzualz/react/output/OutputCastControl.tsx:891 | {status.label} | Mounted by parent / unconditional |
| src/components/vyzualz/react/output/OutputCastControl.tsx:1169 | "Casting error" | error |
| src/components/vyzualz/react/output/OutputCastControl.tsx:1171 | {session.state === 'failed' ? 'Output failed' : 'Output problem'} | session?.error; session.state === 'failed' |
| src/components/vyzualz/react/panels/ReactWorkspacePanels.tsx:188 | "Fractures recording is unavailable" | fracturesOutputDeferred; surface === 'production' && isLaserDmx |
| src/components/vyzualz/react/pixGrid/PixGridReactivityWorkspace.tsx:828 | {validation.valid ? 'VALID' : 'ACTION REQUIRED'} | validation.valid |
| src/components/vyzualz/react/pixGrid/PixGridReactivityWorkspace.tsx:835 | "Configuration valid" | !validation.issues.length |
| src/components/vyzualz/react/pixGrid/PixGridSurface.tsx:1610 | {/^Preparing /.test(mediaPreparationMessage) ? 'PixGrid media' : 'PixGrid media unavailable'} | selectedMediaId && mediaPreparationMessage; /^Preparing /.test(mediaPreparationMessage) |
| src/components/vyzualz/react/pixGrid/PixGridSurface.tsx:1620 | "PixGrid is using the fallback renderer" | fallbackActive && diagnostics.fallbackReason |
| src/components/vyzualz/react/renderers/shiftgrid/CanvasShiftgridLayer.tsx:260 | "SHIFTGRID" | loadState.status === 'loading' |
| src/components/vyzualz/react/renderers/shiftgrid/CanvasShiftgridLayer.tsx:261 | "SHIFTGRID · Degraded Pool" | loadState.status === 'ready' && loadState.failedNames.length > 0 |
| src/components/vyzualz/react/renderers/shiftgrid/CanvasShiftgridLayer.tsx:262 | "SHIFTGRID · Media Pool" | emptyMessage |
| src/components/vyzualz/react/shaders/ui/ShaderParameterPanel.tsx:63 | "Shader compile error" | Mounted by parent / unconditional |
| src/components/vyzualz/react/shaders/ui/ShaderTextureInputControl.tsx:124 | "Texture input unavailable" | warning |
| src/components/vyzualz/recording/RecordingPanel.tsx:78 | "FPS drop" | fpsWarning |
| src/components/vyzualz/recording/RecordingPanel.tsx:84 | "Recording error" | recorderError |
| src/components/vyzualz/settings/DjSoftwareSettingsPanel.tsx:158 | "Integration coming soon" | !rekordboxSelected |
| src/components/vyzualz/settings/DjSoftwareSettingsPanel.tsx:199 | "Desktop app required" | !nativeIndexAvailable && busy !== 'loading'; rekordboxSelected |
| src/components/vyzualz/settings/DjSoftwareSettingsPanel.tsx:204 | "Rekordbox sync failed" | error; rekordboxSelected |
| src/components/vyzualz/shared/DrawerNotice.tsx:14 | {error.message} | Mounted by parent / unconditional |
| src/components/vyzualz/shared/DrawerNotice.tsx:40 | forwarded props | Mounted by parent / unconditional |
| src/components/vyzualz/shared/DrawerNotice.tsx:52 | forwarded props | Mounted by parent / unconditional |
| src/components/vyzualz/shared/NotificationDrawer.tsx:113 | {card.title} | Mounted by parent / unconditional |
| src/components/vyzualz/shared/NotificationDrawer.tsx:119 | {event.title} | event.tone === 'error' |
| src/components/vyzualz/shared/VyzualzAudioDock.tsx:1475 | "Show Manager audio locked" | showSourceLockMessage |
| src/components/vyzualz/shared/VyzualzAudioDock.tsx:1487 | "Live Input active" | liveInputSelected |
| src/components/vyzualz/shared/VyzualzAudioDock.tsx:1497 | "Track could not be played" | engine.trackLoadError && engine.trackLoadError !== dismissedTrackLoadError |
| src/components/vyzualz/shared/VyzualzAudioDock.tsx:1509 | "Live Input unavailable" | engine.micError |
| src/components/vyzualz/showManager/PixGridDeckBuilder.tsx:138 | "Deck upload failed" | upload.error |
| src/components/vyzualz/showManager/PixGridDeckBuilder.tsx:139 | "Deck upload warning" | Mounted by parent / unconditional |
| src/components/vyzualz/showManager/PixGridDeckBuilder.tsx:289 | "Deck name" | nameError |
| src/components/vyzualz/showManager/PixGridDeckBuilder.tsx:508 | "Deck compiler error" | deck && configuration |
| src/components/vyzualz/showManager/ShowManagerView.tsx:2624 | "Canvas authoring failed" | (activeSectionEngineId === 'canvas' &#124;&#124; selectedEngineId === 'canvas') && canvasAuthoringError; workspaceMode === 'default' && !hasOpenShow |
| src/components/vyzualz/showManager/ShowManagerView.tsx:2804 | "PixGrid document · OK" | activeSectionEngineId === 'pixGrid'; rightInspectorTab === 'inspector'; workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE; workspaceMode === 'default' && !hasOpenShow |
| src/components/vyzualz/showManager/ShowManagerView.tsx:2825 | "Show Track Map · linked audio" | activeLaserDmxShow && activeLaserDmxSection; activeSectionEngineId === 'laserDmx'; activeSectionEngineId === 'pixGrid'; rightInspectorTab === 'inspector'; workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE; workspaceMode === 'default' && !hasOpenShow |
| src/components/vyzualz/showManager/ShowManagerView.tsx:2874 | "Section fixture ownership · READY" | activeLaserDmxShow && activeLaserDmxSection; activeSectionEngineId === 'laserDmx'; activeSectionEngineId === 'pixGrid'; rightInspectorTab === 'inspector'; workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE; workspaceMode === 'default' && !hasOpenShow; activeLaserDmxSection.fixtures.length === 1 |
| src/components/vyzualz/showManager/ShowManagerView.tsx:3238 | "Show Track Map" | trackSection |
| src/features/lyrics/LyricManagerView.tsx:2063 | {error ? 'Lyric Manager error' : 'Lyric Manager status'} | (error &#124;&#124; statusMsg); error |
| src/features/lyrics/components/AiLyricExtractor.tsx:932 | "Vocal source offset" | vocalReferenceTrack && vocalReferenceOffsetMs !== 0; extractionSourceMode === 'vocal_reference' |
| src/features/lyrics/components/AiLyricExtractor.tsx:937 | {sourceCompatibility.blocked ? 'Source incompatible' : sourceCompatibility.status === 'significant_mismatch' ? 'Source compatibility warning' : 'Source compatibility'} | vocalReferenceTrack; extractionSourceMode === 'vocal_reference'; sourceCompatibility.blocked; sourceCompatibility.status === 'significant_mismatch' |
| src/features/lyrics/components/AiLyricExtractor.tsx:1034 | "Extraction paused" | active && jobStalled; job |
| src/features/lyrics/components/AiLyricExtractor.tsx:1055 | "Extraction warning" | notice |
| src/features/lyrics/components/AiLyricExtractor.tsx:1056 | "Extraction failed" | error |
| src/features/lyrics/components/AiLyricExtractor.tsx:1080 | "Provider review warnings" | (providerWarnings.length > 0); job?.status === 'completed' && document |
| src/features/lyrics/components/JsonLyricImporter.tsx:185 | {statusVariant === 'ok' ? 'Import ready' : statusVariant === 'warn' ? 'Import needs review' : 'Import failed'} | result; statusVariant === 'ok'; statusVariant === 'warn' |
| src/features/lyrics/components/JsonLyricImporter.tsx:256 | "Import warnings" | result.warnings.length > 0; result |
| src/features/lyrics/components/LyricPreviewPanel.tsx:144 | "Validation warning" | Mounted by parent / unconditional |
| src/features/lyrics/components/LyricTrackBrowser.tsx:116 | "Track browser error" | error |
| src/features/lyrics/editor/LyricCueInspector.tsx:141 | "Cue warnings" | issues.length > 0 |

## Validation and handoff

61 focused tests passed: all four tones with absent/null/false/blank/array/fragment/
empty-markup/action-only bodies, authored rich content/actions, the real empty lyric
preview and shared notification drawer behavior. Browser verification confirmed the
reported empty-document card in its drawer, four tones of blank event messages,
all 16 Layout Lab notice variants and 20 empty-content cases. The drawer entrance
animation was allowed to finish before screenshot review. Focused lint, TypeScript
and diff whitespace checks passed. Existing unrelated toggle edits were preserved;
no commit was requested or created.

The audit also corrected empty-error precedence in Lyric Manager status notices and
media upload notices, so a valid later message is used instead of an empty string.
