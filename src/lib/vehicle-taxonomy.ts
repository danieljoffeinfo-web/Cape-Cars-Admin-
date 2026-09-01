export const VEHICLE_CATEGORIES = [
  'Luxury Vehicles',
  'Mid Tier Vehicles',
  'Economy Vehicles',
  'Large Vehicles',
] as const

export type VehicleCategory = typeof VEHICLE_CATEGORIES[number]

// Body types the vehicles table accepts — must match the CHECK constraint in
// supabase/migrations/20240010_vehicle_telegram_body_type.sql. Admin validation and the
// fleet editor are driven off this list; if it drifts narrower than the constraint, any
// row already storing the missing value becomes unsavable from the dashboard.
export const VEHICLE_BODY_TYPES = [
  'SUV',
  'Sedan',
  'Convertible',
  'Coupe',
  'Van',
  'Hatchback',
  'Minibus',
  'People Mover',
] as const

export type VehicleBodyType = typeof VEHICLE_BODY_TYPES[number]

// The narrower set customers browse by in Telegram. normalizeTelegramBodyType() in
// telegram-bot.ts folds the storage types above into these (Hatchback -> Sedan,
// Minibus/People Mover -> Van), so widening the list above does not change bot menus.
export const TELEGRAM_BROWSE_BODY_TYPES = [
  'SUV',
  'Sedan',
  'Convertible',
  'Coupe',
  'Van',
] as const

export type TelegramBrowseBodyType = typeof TELEGRAM_BROWSE_BODY_TYPES[number]
