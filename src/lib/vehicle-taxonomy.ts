export const VEHICLE_CATEGORIES = [
  'Luxury Vehicles',
  'Mid Tier Vehicles',
  'Economy Vehicles',
  'Large Vehicles',
] as const

export type VehicleCategory = typeof VEHICLE_CATEGORIES[number]

export const VEHICLE_BODY_TYPES = [
  'SUV',
  'Sedan',
  'Convertible',
  'Coupe',
  'Hatchback',
  'Van',
  'Minibus',
  'People Mover',
] as const

export type VehicleBodyType = typeof VEHICLE_BODY_TYPES[number]