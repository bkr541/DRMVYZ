/** Compatibility exports; the shared direct-source contract owns no MUTAGEN state. */
export {
  resolveCanvasDirectImageAlpha as resolveMutagenSourceAlpha,
  isCanvasDirectImageOwnerPending as isMutagenOwnerPending,
  resolveCanvasDirectImageCapability as resolveMutagenCaptureCapability,
} from '../../canvasDirectImageOutputContract'
