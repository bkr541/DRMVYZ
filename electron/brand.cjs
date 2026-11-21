'use strict'

// Main-process mirror of src/brand.ts (electron/main.cjs cannot import TS).
// Keep the two files in sync; see docs/stageless-rename.md.
module.exports = Object.freeze({
  BRAND_NAME: 'STAGELESS',
  BRAND_RECEIVER: 'STAGELESS Receiver',
  BRAND_RECEIVERS: 'STAGELESS Receivers',
  BRAND_AUTHOR_STUDIO: 'STAGELESS Studio',
  BRAND_FILE_PREFIX: 'stageless',
})
