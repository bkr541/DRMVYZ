# Desktop development launcher

Run `launch.command` from Finder or the repository. It selects Node 22 and runs
`scripts/run-electron-dev.mjs` to start Vite and the isolated DRMVYZ Electron shell.

The default server address is `http://127.0.0.1:5173`. If that port belongs to
another process, the launcher leaves the listener running and selects an
available port among the next 19 ports. It prints the selected address and uses
the same host/port for Vite, readiness checks and Electron. A configured
`DRMVYZ_VITE_DEV_SERVER_URL` supplies the preferred address instead.

Every launch checks for running DRMVYZ before starting its replacement. On
macOS this includes packaged `DRMVYZ.app`, isolated `DRMVYZ Dev.app` instances,
and their helper processes, even outside this checkout. A stock Electron shell
is closed only when its executable and working directory identify this repo.
The launcher sends SIGTERM, waits, force-stops any remaining identified processes,
and confirms they exited before continuing. Failure to inspect or close them
stops startup rather than launching a second instance.

Stale DRMVYZ Vite processes are stopped only when their working directory and
Vite command identify this repository. Vanished listeners are skipped; missing
process metadata no longer causes a fatal port-conflict error. The DRMVYZ app check runs independently of which port is occupied. If no port is available in
the bounded search, startup reports an actionable error.

Validation: `node --test scripts/electron-dev-port.test.mjs` covers requested
and fallback ports, host/path preservation, exhaustion, TCP port limits,
unexpected socket errors, and a real occupied listener that remains running.

Process-selection checks: `node --test scripts/electron-dev-processes.test.mjs`.
They cover installed/development apps, helper processes, stock Electron ownership,
and exclusion of unrelated apps and similarly named paths.
