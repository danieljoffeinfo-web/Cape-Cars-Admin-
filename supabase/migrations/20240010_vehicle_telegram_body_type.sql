alter table if exists public.vehicles
  add column if not exists telegram_body_type text;

alter table if exists public.vehicles
  drop constraint if exists vehicles_telegram_body_type_check;

alter table if exists public.vehicles
  add constraint vehicles_telegram_body_type_check
  check (
    telegram_body_type is null
    or telegram_body_type in ('SUV', 'Sedan', 'Convertible', 'Coupe', 'Hatchback', 'Van', 'Minibus', 'People Mover')
  );
