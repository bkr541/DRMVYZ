/** Fallback artwork for presets without an authored vector illustration.
 * Representative frames generated from the same renderers used by the middle visualizer.
 * CANVAS and HEADLINER use neutral sample media, never a user's camera or files.
 * See scripts/generate-preset-artwork.mjs to refresh authored system previews.
 */
export function PresetBlueprintImage({ presetId }: { presetId: string }) {
  return (
    <img
      className="rv-preset-blueprint-image"
      src={`${import.meta.env.BASE_URL}preset-artwork/${encodeURIComponent(presetId)}.webp`}
      alt=""
      loading="lazy"
      decoding="async"
      data-thumbnail-kind="blueprint"
      onError={event => { event.currentTarget.hidden = true }}
      onLoad={event => { event.currentTarget.hidden = false }}
    />
  )
}
