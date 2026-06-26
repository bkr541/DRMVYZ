import type { ShaderDefinition, TextureInputDef } from '../registry/shaderRegistryTypes'
import type {
  ShaderTexSourceSelection,
  ShaderTexSourceType,
  TextureInputValidation,
} from '../textures/shaderTextureInputTypes'

// ── ShaderTextureInputControl ─────────────────────────────────────────────────
//
// Renders a list of texture-input selectors for the active shader scene.
// Each input declared in ShaderDefinition.textureInputs gets one row with:
//   - A label and required/warning badges
//   - A source-type dropdown (groups: Generated, Audio, Media)
//   - A clear button for optional inputs
//
// Returns null when the active definition declares no texture inputs.

export interface ShaderTextureInputControlProps {
  definition: ShaderDefinition | null
  /** Current source selection per input name.  null = unset. */
  selections: Readonly<Record<string, ShaderTexSourceSelection | null>>
  /** Validation state per input, produced by ShaderTextureInputManager.validate(). */
  validation: TextureInputValidation[]
  onSelectionChange: (inputName: string, sel: ShaderTexSourceSelection | null) => void
}

export function ShaderTextureInputControl({
  definition, selections, validation, onSelectionChange,
}: ShaderTextureInputControlProps): JSX.Element | null {
  const inputs = definition?.textureInputs
  if (!inputs || inputs.length === 0) return null

  const validMap = new Map(validation.map(v => [v.inputName, v]))

  return (
    <div className="rv-ctrl-section">
      <div className="rv-ctrl-section-label">Texture Inputs</div>
      {inputs.map(input => (
        <TextureInputRow
          key={input.name}
          input={input}
          selection={selections[input.name] ?? null}
          valid={validMap.get(input.name) ?? null}
          onSelectionChange={onSelectionChange}
        />
      ))}
    </div>
  )
}

// ── TextureInputRow ───────────────────────────────────────────────────────────

interface RowProps {
  input:      TextureInputDef
  selection:  ShaderTexSourceSelection | null
  valid:      TextureInputValidation | null
  onSelectionChange: (name: string, sel: ShaderTexSourceSelection | null) => void
}

function TextureInputRow({ input, selection, valid, onSelectionChange }: RowProps) {
  const currentType = selection?.sourceType ?? 'unset'
  const warning     = valid?.warningMessage ?? null
  const isRequired  = input.required ?? false

  function handleTypeChange(type: ShaderTexSourceType) {
    if (type === 'unset') {
      onSelectionChange(input.name, null)
    } else {
      onSelectionChange(input.name, { sourceType: type })
    }
  }

  return (
    <div className="rv-ctrl-row rv-ctrl-row--texture">
      <div className="rv-ctrl-texture-hdr">
        <span className="rv-ctrl-label">
          {input.label}
          {isRequired && (
            <span className="rv-ctrl-badge rv-ctrl-badge--required" title="Required">req</span>
          )}
          {warning && (
            <span className="rv-ctrl-badge rv-ctrl-badge--warn" title={warning}>!</span>
          )}
        </span>
        {!isRequired && selection && (
          <button
            type="button"
            className="rv-ctrl-clear"
            onClick={() => onSelectionChange(input.name, null)}
            title="Clear"
          >
            ×
          </button>
        )}
      </div>

      <select
        className="rv-ctrl-select"
        value={currentType}
        onChange={e => handleTypeChange(e.target.value as ShaderTexSourceType)}
      >
        <option value="unset">— Not set —</option>
        <optgroup label="Generated">
          <option value="noise-white">White Noise</option>
          <option value="noise-value">Value Noise</option>
          <option value="noise-blue">Blue Noise</option>
          <option value="mask">Radial Mask</option>
          <option value="solid-color">Solid Color</option>
        </optgroup>
        <optgroup label="Audio">
          <option value="fft">FFT Spectrum</option>
          <option value="waveform">Waveform</option>
        </optgroup>
        <optgroup label="Media">
          <option value="uploaded-image">Uploaded Image</option>
          <option value="uploaded-video">Uploaded Video</option>
          <option value="media-output">Media Output</option>
          <option value="album-artwork">Album Artwork</option>
          <option value="logo">Logo</option>
          <option value="svg">SVG</option>
        </optgroup>
      </select>

      {warning && (
        <div className="rv-ctrl-warning" role="alert">{warning}</div>
      )}
    </div>
  )
}
