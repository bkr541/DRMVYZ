-- DRMVYZ System Settings sync
-- Stores the signed-in user's System Settings (Settings > System Settings) once per account, so the desktop app,
-- a mobile browser and every other device use the same values: Canvas Quality, Auto Quality (on, min, max),
-- Auto Performance default and BPM Sync.
--
-- One jsonb object instead of one column per setting, so a new setting does not need a new migration. Null means the account has never saved
-- System Settings; a key that is missing means that one setting was never saved. The app validates each value on read and ignores any it does not
-- recognise, and a device that has no account value for a setting uploads its own.

alter table public.user_settings
  add column if not exists system_settings jsonb;

alter table public.user_settings
  drop constraint if exists user_settings_system_settings_check;

alter table public.user_settings
  add constraint user_settings_system_settings_check
  check (system_settings is null or jsonb_typeof(system_settings) = 'object');

comment on column public.user_settings.system_settings is
  'System Settings synced across devices: {quality, autoQualityEnabled, autoQualityMin, autoQualityMax, autoPerformanceDefault, bpmSync}. Null or a missing key means never saved.';
