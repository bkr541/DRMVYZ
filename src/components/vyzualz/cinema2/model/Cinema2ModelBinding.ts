import { uuid, versionNumber } from '../../../../features/models/domain/modelAssetTypes'
export type UserModelBinding = { kind: 'user-model'; modelAssetId: string; version: number } | { kind: 'default-model' }
export const DEFAULT_MODEL_BINDING = 'default-model'
export function parseUserModelBinding(value: unknown): UserModelBinding {
  if (value === DEFAULT_MODEL_BINDING) return { kind: 'default-model' }
  if (typeof value !== 'string') throw new Error('Model binding must be a pinned model reference.')
  const parts = value.split(':')
  if (parts.length !== 3 || parts[0] !== 'user-model' || !/^[1-9]\d*$/.test(parts[2])) throw new Error('Invalid pinned model reference.')
  return { kind: 'user-model', modelAssetId: uuid(parts[1]), version: versionNumber(Number(parts[2]), 1) }
}
export function serializeUserModelBinding(binding: UserModelBinding): string {
  const value = binding.kind === 'default-model' ? DEFAULT_MODEL_BINDING : `user-model:${binding.modelAssetId}:${binding.version}`
  parseUserModelBinding(value); return value
}
