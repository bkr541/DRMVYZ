// Professional scope signal core — public surface.
//
// Signal only. Nothing in this module knows about canvases, WebGL, or React.

export * from './scopeTypes'
export * from './scopeStateNormalization'
export { StereoScopeRingBuffer } from './StereoScopeRingBuffer'
export { StereoScopeAudioTap } from './StereoScopeAudioTap'
export { ScopeSignalConditioner, dcBlockerCoefficient } from './ScopeSignalConditioner'
export {
  applyScopeChannelMatrix,
  computeChannelCorrelation,
  extractTriggerSource,
  midFromStereo,
  sideFromStereo,
  type ScopeMatrixInput,
  type ScopeMatrixOutput,
  type ScopeMatrixResult,
} from './ScopeChannelMatrix'
export { ScopePeriodEstimator, type ScopePeriodEstimate } from './ScopePeriodEstimator'
export { ScopeTrigger, interpolateCrossing } from './ScopeTrigger'
export { ScopeTimebase, resolveWindowStartOffset, type ScopeTimebaseResult } from './ScopeTimebase'
export {
  ScopeSignalCore,
  resampleLinear,
  resolveScopeCaptureFrames,
  type ScopeSignalCoreInput,
} from './ScopeSignalCore'
