import { useMemo, useState } from 'react'
import { CINEMA2_CONCEPT_PRESETS, type Cinema2ConceptPreset, type Cinema2ConceptStill } from './cinema2ConceptSamples'

export interface Cinema2MockState {
  presets: Cinema2ConceptPreset[]
  selectedPreset: Cinema2ConceptPreset | null
  selectedStill: Cinema2ConceptStill | null
  selectPreset: (id: string) => void
  selectStill: (id: string) => void
}

export function useCinema2MockState(): Cinema2MockState {
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [selectedStillId, setSelectedStillId] = useState<string | null>(null)

  const selectedPreset = useMemo(
    () => CINEMA2_CONCEPT_PRESETS.find(preset => preset.id === selectedPresetId) ?? null,
    [selectedPresetId],
  )
  const selectedStill = useMemo(
    () => selectedPreset?.stills.find(still => still.id === selectedStillId) ?? null,
    [selectedPreset, selectedStillId],
  )

  return {
    presets: CINEMA2_CONCEPT_PRESETS,
    selectedPreset,
    selectedStill,
    selectPreset: id => {
      setSelectedPresetId(id)
      const preset = CINEMA2_CONCEPT_PRESETS.find(candidate => candidate.id === id)
      setSelectedStillId(preset?.stills[0]?.id ?? null)
    },
    selectStill: id => setSelectedStillId(id),
  }
}
