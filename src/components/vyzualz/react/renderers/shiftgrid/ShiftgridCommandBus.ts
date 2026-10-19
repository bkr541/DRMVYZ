export type ShiftgridCommand = 'showOriginal' | 'scramble' | 'slideSwap' | 'reconstruct' | 'phraseBoundary' | 'dropBoundary'
type Listener = (command: ShiftgridCommand) => void
const listeners = new Set<Listener>()

export function dispatchShiftgridCommand(command: ShiftgridCommand): void { listeners.forEach(listener => listener(command)) }
export function subscribeShiftgridCommand(listener: Listener): () => void { listeners.add(listener); return () => listeners.delete(listener) }
