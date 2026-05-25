-- Migration 0009: Add Pixel Distortion and Frame Quantization effect chain options
-- for the Distortion Pixels built-in preset.
-- Idempotent: ON CONFLICT DO UPDATE ensures safe re-runs.

INSERT INTO public.effect_chain_options
  (id, chain_name, effect_key, description, category, control_group, sort_order, is_available)
VALUES
  (
    'pixelDistortion',
    'Pixel Distortion',
    'pixelDistortion',
    'GPU pixel-grid snap, posterization, Bayer dither, digital corruption breakup, energy overexposure, and cyan-white tint — reactive to beat and bass',
    'distortion',
    'Distortion',
    27,
    true
  ),
  (
    'frameQuantization',
    'Frame Quantization',
    'frameQuantization',
    'Visual frame-hold stutter effect that samples the output at a reduced frame rate — audio timing is never modified',
    'distortion',
    'Motion',
    28,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  chain_name    = EXCLUDED.chain_name,
  effect_key    = EXCLUDED.effect_key,
  description   = EXCLUDED.description,
  category      = EXCLUDED.category,
  control_group = EXCLUDED.control_group,
  sort_order    = EXCLUDED.sort_order,
  is_available  = EXCLUDED.is_available;
