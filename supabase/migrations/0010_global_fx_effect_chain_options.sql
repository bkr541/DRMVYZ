-- Migration: 0010_global_fx_effect_chain_options.sql
-- Description: Add the three global-modulation Effect Chain entries that gate
--   Bass Reactivity, Reactive Scale (logoScale), and Master Intensity in the
--   renderer.  These previously appeared only as untoggable sliders in the
--   "Global" section of Effect Controls; adding them here gives users an
--   explicit ON/OFF toggle in the Effect Chain panel.
--
-- Backward compatibility:
--   The application's store merge function (visualStore.ts) auto-adds these
--   chain names to the enabledFxArr of any existing session that does not
--   already contain them, preserving the pre-migration "always on" behaviour.
--
-- Idempotent: ON CONFLICT DO UPDATE — safe to run more than once.

INSERT INTO public.effect_chain_options
  (id, chain_name, effect_key, description, category, control_group, sort_order, is_available)
VALUES
  (
    'masterIntensity',
    'Master Intensity',
    'masterIntensity',
    'Global multiplier that scales the strength of all audio-reactive modulation. Setting to 0 neutralises every reactive path without removing individual effect values.',
    'utility',
    'Global',
    29,
    true
  ),
  (
    'bassReactivity',
    'Bass Reactivity',
    'bassReactivity',
    'Controls how strongly low-frequency audio energy drives scale pulsing and punch impact on eligible media elements. Requires Audio Reactivity to be enabled.',
    'audioReactive',
    'Global',
    30,
    true
  ),
  (
    'logoScale',
    'Reactive Scale',
    'logoScale',
    'Scales the bass-reactive size multiplier for media elements that have Enable Global FX active. Higher values produce more dramatic growth on each beat.',
    'audioReactive',
    'Global',
    31,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  chain_name    = EXCLUDED.chain_name,
  effect_key    = EXCLUDED.effect_key,
  description   = EXCLUDED.description,
  category      = EXCLUDED.category,
  control_group = EXCLUDED.control_group,
  sort_order    = EXCLUDED.sort_order,
  is_available  = EXCLUDED.is_available,
  updated_at    = now();
