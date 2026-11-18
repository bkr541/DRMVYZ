/** Existing shipped artifacts available for inspection in Media Manager. */
export const BUILTIN_MODELS = [{
  id: 'builtin-conduit-dvydrm-wordmark',
  name: 'DVYDRM Wordmark',
  description: 'The original 3D DVYDRM wordmark used in Conduit, with pearl letters, chrome ring and amber edge materials.',
  url: '/cinema2/models/conduit-wordmark.glb',
}] as const
export type BuiltinModel = typeof BUILTIN_MODELS[number]
