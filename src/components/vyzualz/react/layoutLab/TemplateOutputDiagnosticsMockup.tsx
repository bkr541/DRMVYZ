import { useState } from 'react'

// ── TemplateOutputDiagnosticsMockup ────────────────────────────────────────
//
// Layout Lab / Template engine, OUTPUT tab. A static, disconnected copy of
// Shader Pads' "Renderer Diagnostics" panel (ShaderInspectorPanel →
// ShaderCompilePanel + ShaderPassInspector) — same fields, same sample
// values, same nested pass card — but restyled as an Accent Card collapsible
// (llcg-accent — the left-border style from the group gallery above) instead
// of the real rv-ctrl-collapsible/rv-shader-diagnostics treatment. Every
// value here is hardcoded; nothing reads a shader, a compile status, or a
// render pass.

export function TemplateOutputDiagnosticsMockup() {
  const [open, setOpen] = useState(true)

  return (
    <div className={`llcg-accent llcg-accent--right${open ? ' is-open' : ''}`}>
      <button type="button" className="llcg-accent-header" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span className="llcg-accent-dot" aria-hidden="true" />
        <span>Renderer Diagnostics</span>
        <span className={`llcg-caret${open ? ' is-open' : ''}`} aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="llcg-accent-body">
          <div className="lltd-effect-card">
            <div className="lltd-effect-header">
              <span>Brand Echo Signal</span>
              <span>Effect</span>
            </div>
            <p className="lltd-effect-desc">
              Waveform ribbons refract through Brand Kit artwork while lyrics and harmonic changes steer the echo field.
            </p>

            <dl className="lltd-grid">
              <div><dt>Compile</dt><dd className="lltd-value--ok">Compiled OK</dd></div>
              <div><dt>Last OK</dt><dd>4:15:28 AM</dd></div>
              <div><dt>Errors</dt><dd>0</dd></div>
              <div><dt>Warnings</dt><dd>0</dd></div>
            </dl>
            <p className="lltd-note">No errors or warnings.</p>

            <dl className="lltd-grid">
              <div><dt>Scene</dt><dd>Brand Echo Signal</dd></div>
              <div><dt>Passes</dt><dd>1</dd></div>
              <div><dt>Frame</dt><dd>0.7 ms</dd></div>
              <div><dt>FPS</dt><dd>1428.6</dd></div>
              <div><dt>GPU</dt><dd>1.19 ms</dd></div>
              <div><dt>CPU</dt><dd>0.60 ms</dd></div>
              <div><dt>Texture Memory</dt><dd>8.57 MiB</dd></div>
              <div><dt>Resolution</dt><dd>1596 × 1408</dd></div>
              <div><dt>Quality</dt><dd>ultra</dd></div>
              <div><dt>Float Target</dt><dd>Optional</dd></div>
            </dl>

            <div className="lltd-passes-header">
              <span>Render Passes</span>
              <span>1</span>
            </div>
            <div className="lltd-pass-card">
              <div className="lltd-pass-card-header">
                <span className="lltd-pass-order">1</span>
                <strong>main</strong>
                <span className="lltd-pass-state">— Unknown</span>
              </div>
              <dl className="lltd-grid">
                <div><dt>Input</dt><dd>uUserMedia, uAlbumArtwork, uMediaOutput</dd></div>
                <div><dt>Output</dt><dd>screen</dd></div>
                <div><dt>Scale</dt><dd>×1</dd></div>
                <div><dt>Blend</dt><dd>none</dd></div>
                <div><dt>Mode</dt><dd>standard</dd></div>
                <div><dt>Dimensions</dt><dd>Runtime pending</dd></div>
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
