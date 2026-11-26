/** Pool support corresponds to the native modules that consume Cinema2MediaPoolSource.
 * All other slots use their manifest's accepts/required flags. */
const POOL_SLOTS = new Set(['corridor-panel-media', 'everywhere-screen-media', 'overdrive-core-media', 'mosaic-wall-media', 'fracture-shard-media', 'refraction-prism-media', 'spectrum-arena-media'])
export const cinema2SlotSupportsPool = (slotId: string) => POOL_SLOTS.has(slotId)
