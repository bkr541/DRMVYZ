'use strict'

// electron-log's main-process IPC transport mirrors every log line into each open renderer. Electron reports a failed
// `WebFrameMain.send` (a frame that is disposed while its window closes) by calling `console.error`, and electron/logging.cjs routes `console`
// into electron-log, so the report is logged, mirrored, fails again and is reported again: ~675 identical errors on every window close in dev
// (the transport only exists when the app is not packaged). Nothing in the app reads the mirrored stream — renderer logs travel the other way,
// through the diagnostics bridge, and the file is the record — so the mirroring is switched off rather than guarded.

function disableRendererMirroring(log) {
  const ipc = log?.transports?.ipc
  if (ipc) ipc.level = false
  return Boolean(ipc)
}

module.exports = { disableRendererMirroring }
