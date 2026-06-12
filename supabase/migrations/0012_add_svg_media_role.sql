-- Migration: 0012_add_svg_media_role
-- Adds 'svg' to the media_items media_role check constraint.
-- SVG files are stored as media type 'image' with role 'svg'.

alter table public.media_items
  drop constraint if exists media_items_media_role_check;

alter table public.media_items
  add constraint media_items_media_role_check check (
    media_role in (
      'background_image', 'background_video', 'logo', 'transparent_element',
      'overlay', 'character_art', 'texture', 'loop', 'transition',
      'reference', 'other', 'svg'
    )
  );
