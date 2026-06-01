import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getFleetAvailability } from '@/lib/telegram-admin'
import { VEHICLE_BODY_TYPES, VEHICLE_CATEGORIES } from '@/lib/vehicle-taxonomy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CATEGORIES = new Set(VEHICLE_CATEGORIES)
const BODY_TYPES = new Set(VEHICLE_BODY_TYPES)
const FUELS = new Set(['Petrol', 'Hybrid', 'Electric', 'Diesel'])
const STATUSES = new Set(['Available', 'Booked', 'Service'])

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'vehicle'
}

function parseDataUrl(value: string) {
  const match = value.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  }
}

async function resolveImageUrl(imageUrl: unknown, model: string) {
  if (typeof imageUrl !== 'string' || !imageUrl.trim()) return null
  const trimmed = imageUrl.trim()
  const parsed = parseDataUrl(trimmed)
  if (!parsed) return trimmed

  const supabase = createAdminClient()
  await supabase.storage.createBucket('vehicles', { public: true }).catch(() => null)
  const ext = parsed.contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
  const path = `fleet/${slug(model)}-${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('vehicles')
    .upload(path, parsed.buffer, {
      contentType: parsed.contentType,
      upsert: false,
    })

  if (error) throw new Error(`Vehicle image upload failed: ${error.message}`)

  const { data } = supabase.storage.from('vehicles').getPublicUrl(path)
  return data.publicUrl
}

async function vehiclePayload(body: any) {
  const model = typeof body?.model === 'string' ? body.model.trim() : ''
  const cat = typeof body?.cat === 'string' ? body.cat : ''
  const fuel = typeof body?.fuel === 'string' ? body.fuel : ''
  const status = typeof body?.status === 'string' ? body.status : ''
  const telegramBodyType = typeof body?.telegram_body_type === 'string' && body.telegram_body_type.trim()
    ? body.telegram_body_type.trim()
    : null

  if (!model) throw new Error('Model name is required')
  if (!CATEGORIES.has(cat)) throw new Error('Choose a valid vehicle category')
  if (!FUELS.has(fuel)) throw new Error('Choose a valid fuel type')
  if (!STATUSES.has(status)) throw new Error('Choose a valid status')
  if (telegramBodyType && !BODY_TYPES.has(telegramBodyType)) throw new Error('Choose a valid body type')

  return {
    model,
    cat,
    power: typeof body?.power === 'string' ? body.power.trim() : '',
    seats: Number(body?.seats) || 2,
    fuel,
    rate: Number(body?.rate) || 0,
    status,
    color: typeof body?.color === 'string' ? body.color.trim() : '',
    description: typeof body?.description === 'string' ? body.description.trim() : '',
    image_url: await resolveImageUrl(body?.image_url, model),
    sort_order: Number(body?.sort_order) || 0,
    telegram_body_type: telegramBodyType,
  }
}

export async function GET() {
  try {
    const vehicles = await getFleetAvailability()
    return NextResponse.json({ vehicles })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load fleet availability' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient()
    const payload = await vehiclePayload(await request.json())
    const { data, error } = await supabase
      .from('vehicles')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ vehicle: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add vehicle' },
      { status: 400 },
    )
  }
}
