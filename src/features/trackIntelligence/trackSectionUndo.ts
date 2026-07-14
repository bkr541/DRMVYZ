import type {
  ReactPresetAutomationCue,
  ReactTrackSection,
} from '../../components/vyzualz/react/ReactTypes'

export interface TrackSectionUndoState {
  manualTrackSectionsByTrackId: Record<string, ReactTrackSection[]>
  suppressedAutoSectionsByTrackId: Record<string, string[]>
  presetAutomationCuesByTrackId: Record<string, ReactPresetAutomationCue[]>
  selectedSectionByTrackId: Record<string, string | null>
  selectedSectionId: string | null
}

export interface TrackSectionUndoSnapshot {
  manualSections: ReactTrackSection[]
  suppressedAutoSectionIds: string[]
  presetAutomationCues: ReactPresetAutomationCue[]
  selectedSectionId: string | null
}

function cloneSection(section: ReactTrackSection): ReactTrackSection {
  return {
    ...section,
    provenance: section.provenance ? { ...section.provenance } : undefined,
    interpretation: section.interpretation
      ? {
          ...section.interpretation,
          relatedSectionIds: section.interpretation.relatedSectionIds
            ? [...section.interpretation.relatedSectionIds]
            : undefined,
          alternativeLabels: section.interpretation.alternativeLabels
            ? section.interpretation.alternativeLabels.map(label => ({ ...label }))
            : undefined,
          classificationDiagnostics: section.interpretation.classificationDiagnostics
            ? {
                ...section.interpretation.classificationDiagnostics,
                scores: { ...section.interpretation.classificationDiagnostics.scores },
                evidence: [...section.interpretation.classificationDiagnostics.evidence],
                sourceRegionIds: [...section.interpretation.classificationDiagnostics.sourceRegionIds],
                dropAnchor: section.interpretation.classificationDiagnostics.dropAnchor
                  ? { ...section.interpretation.classificationDiagnostics.dropAnchor }
                  : undefined,
              }
            : undefined,
        }
      : undefined,
  }
}

function cloneCue(cue: ReactPresetAutomationCue): ReactPresetAutomationCue {
  return { ...cue }
}

/** Captures one atomic Track Section editing state for a single track. */
export function captureTrackSectionUndoSnapshot(
  state: TrackSectionUndoState,
  trackId: string,
): TrackSectionUndoSnapshot {
  return {
    manualSections: (state.manualTrackSectionsByTrackId[trackId] ?? []).map(cloneSection),
    suppressedAutoSectionIds: [...(state.suppressedAutoSectionsByTrackId[trackId] ?? [])],
    presetAutomationCues: (state.presetAutomationCuesByTrackId[trackId] ?? []).map(cloneCue),
    selectedSectionId: state.selectedSectionByTrackId[trackId] ?? null,
  }
}

/** Builds the Zustand patch that restores a previously captured Track Section state. */
export function restoreTrackSectionUndoSnapshot(
  state: TrackSectionUndoState,
  trackId: string,
  snapshot: TrackSectionUndoSnapshot,
): Pick<
  TrackSectionUndoState,
  | 'manualTrackSectionsByTrackId'
  | 'suppressedAutoSectionsByTrackId'
  | 'presetAutomationCuesByTrackId'
  | 'selectedSectionByTrackId'
  | 'selectedSectionId'
> {
  return {
    manualTrackSectionsByTrackId: {
      ...state.manualTrackSectionsByTrackId,
      [trackId]: snapshot.manualSections.map(cloneSection),
    },
    suppressedAutoSectionsByTrackId: {
      ...state.suppressedAutoSectionsByTrackId,
      [trackId]: [...snapshot.suppressedAutoSectionIds],
    },
    presetAutomationCuesByTrackId: {
      ...state.presetAutomationCuesByTrackId,
      [trackId]: snapshot.presetAutomationCues.map(cloneCue),
    },
    selectedSectionByTrackId: {
      ...state.selectedSectionByTrackId,
      [trackId]: snapshot.selectedSectionId,
    },
    selectedSectionId: snapshot.selectedSectionId,
  }
}
