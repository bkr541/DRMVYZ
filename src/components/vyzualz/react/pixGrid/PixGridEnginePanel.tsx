import { PixGridAuthoringPanel } from './PixGridAuthoringPanel'

export function PixGridEnginePanel({ onCreateDeck }: { onCreateDeck?: () => void }) {
  return <PixGridAuthoringPanel onCreateDeck={onCreateDeck} />
}
