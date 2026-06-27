# Source packaging

Do not zip the working directory. A normal checkout contains generated output,
coverage, browser artifacts, logs, and `node_modules` that are not source code.

From a clean Git checkout:

```bash
npm run repo:hygiene
npm run package:source
```

The archive is written to `artifacts/drmvyz-source-<commit>.zip` and contains
tracked source files only. The command refuses to package generated or
machine-specific files if they were accidentally committed.

To clear local output before sharing a diagnostic working tree:

```bash
npm run clean:generated
```

To also remove installed dependencies:

```bash
npm run clean:all
```
