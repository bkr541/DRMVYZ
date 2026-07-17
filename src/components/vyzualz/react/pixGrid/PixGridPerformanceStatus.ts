import { useSyncExternalStore } from "react";
import type { PixGridPerformanceRuntimeSnapshot } from "./PixGridPerformanceTypes";

const EMPTY: PixGridPerformanceRuntimeSnapshot = Object.freeze({
  active: false,
  programId: null,
  programName: null,
  sceneId: null,
  activeSectionPlanId: null,
  variationId: null,
  section: "unknown",
  sectionPhase: "none",
  sectionOccurrence: 0,
  dropOccurrence: 0,
  fourBarStage: 0,
  eightBarStage: 0,
  sixteenBarStage: 0,
  currentFourBarMotif: null,
  currentEightBarRecruitment: null,
  currentSixteenBarEvolution: null,
  activeVisualRoles: Object.freeze([]),
  resolvedBanks: Object.freeze([]),
  activeContinuousRoutes: Object.freeze([]),
  activeEventRoutes: Object.freeze([]),
  arcState: Object.freeze({
    density: 0,
    paletteIntensity: 0,
    motion: 0,
    contrast: 0,
    negativeSpace: 1,
    recruitment: 0,
    impactStrength: 0,
    sparkleDetail: 0,
    backgroundActivity: 0,
  }),
  recentActionReasons: Object.freeze([]),
  recentActionTypes: Object.freeze([]),
  manualOverrideRoutes: Object.freeze([]),
  manualOverridePrecedence:
    "Track Map cue/manual locks > user-authored assignments > program routes > program choreography.",
  missingBindings: Object.freeze([]),
  degradedBindings: Object.freeze([]),
  fallbackState: null,
  transition: null,
  activeEventEnvelopes: Object.freeze([]),
  activeGroupEffects: Object.freeze([]),
  deterministicIdentity: "inactive",
});

let snapshot = EMPTY;
const listeners = new Set<() => void>();

export function publishPixGridPerformanceRuntimeStatus(
  next: PixGridPerformanceRuntimeSnapshot,
): void {
  if (JSON.stringify(next) === JSON.stringify(snapshot)) return;
  snapshot = Object.freeze({
    ...next,
    recentActionReasons: Object.freeze([...next.recentActionReasons]),
    recentActionTypes: Object.freeze([...next.recentActionTypes]),
    manualOverrideRoutes: Object.freeze([...next.manualOverrideRoutes]),
    activeVisualRoles: Object.freeze([...next.activeVisualRoles]),
    resolvedBanks: Object.freeze([...next.resolvedBanks]),
    activeContinuousRoutes: Object.freeze([...next.activeContinuousRoutes]),
    activeEventRoutes: Object.freeze([...next.activeEventRoutes]),
    arcState: Object.freeze({ ...next.arcState }),
    missingBindings: Object.freeze([...next.missingBindings]),
    degradedBindings: Object.freeze([...next.degradedBindings]),
    activeEventEnvelopes: Object.freeze([...next.activeEventEnvelopes]),
    activeGroupEffects: Object.freeze([...next.activeGroupEffects]),
  });
  listeners.forEach((listener) => listener());
}

export function clearPixGridPerformanceRuntimeStatus(): void {
  if (snapshot === EMPTY) return;
  snapshot = EMPTY;
  listeners.forEach((listener) => listener());
}

export function getPixGridPerformanceRuntimeStatus(): PixGridPerformanceRuntimeSnapshot {
  return snapshot;
}

export function usePixGridPerformanceRuntimeStatus(): PixGridPerformanceRuntimeSnapshot {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getPixGridPerformanceRuntimeStatus,
    () => EMPTY,
  );
}
