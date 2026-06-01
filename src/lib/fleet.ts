import { createClient } from './supabase/client'
import type { VehicleBodyType, VehicleCategory } from './vehicle-taxonomy'

export type { VehicleBodyType, VehicleCategory } from './vehicle-taxonomy'

export type Car = {
  id: number
  model: string
  cat: VehicleCategory
  power: string
  seats: number
  fuel: 'Petrol' | 'Hybrid' | 'Electric' | 'Diesel'
  rate: number
  status: 'Available' | 'Booked' | 'Service'
  color: string
}

export type Vehicle = {
  id: string
  model: string
  cat: VehicleCategory
  power: string
  seats: number
  fuel: 'Petrol' | 'Hybrid' | 'Electric' | 'Diesel'
  rate: number
  status: 'Available' | 'Booked' | 'Service'
  color: string
  description: string | null
  image_url: string | null
  sort_order: number
  telegram_body_type?: VehicleBodyType | null
  blockedRanges?: Array<{
    startDate: string
    endDate: string
    source: 'telegram' | 'rental'
    status: string
  }>
  isBlocked?: boolean
}

export const FLEET: Car[] = []

export const FLEET_MODELS = FLEET.map(c => c.model)

export async function fetchVehicles(): Promise<Vehicle[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return data as Vehicle[]
}
