alter table if exists public.vehicles
  drop constraint if exists vehicles_cat_check;

alter table if exists public.vehicles
  add constraint vehicles_cat_check
  check (
    cat in (
      'Luxury Vehicles',
      'Mid Tier Vehicles',
      'Economy Vehicles',
      'Large Vehicles'
    )
  );

alter table if exists public.vehicles
  drop constraint if exists vehicles_fuel_check;

alter table if exists public.vehicles
  add constraint vehicles_fuel_check
  check (
    fuel in ('Petrol', 'Hybrid', 'Electric', 'Diesel')
  );
