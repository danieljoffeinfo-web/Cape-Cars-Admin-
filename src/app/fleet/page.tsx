import Nav from '@/components/nav'
import Footer from '@/components/footer'
import FleetGrid from '@/components/fleet-grid'
import { FLEET } from '@/lib/fleet'
import type { Vehicle } from '@/lib/fleet'
import { getFleetAvailability } from '@/lib/telegram-admin'

export const metadata = { title: 'Fleet — Car Demo' }
export const dynamic = 'force-dynamic'

export default async function FleetPage() {
  let vehicles: Vehicle[] = []
  try {
    const data = await getFleetAvailability()
    const visibleVehicles = data.filter((vehicle) => vehicle.status !== 'Service')
    if (visibleVehicles.length > 0) {
      vehicles = visibleVehicles as Vehicle[]
    } else {
      vehicles = FLEET.map((c, i) => ({
        ...c,
        id: String(c.id),
        description: null,
        image_url: null,
        sort_order: i,
      }))
    }
  } catch {
    vehicles = FLEET.map((c, i) => ({
      ...c,
      id: String(c.id),
      description: null,
      image_url: null,
      sort_order: i,
    }))
  }

  return (
    <div>
      <Nav active="fleet" theme="dark-on-white" />
      <FleetGrid cars={vehicles} />
      <Footer />
    </div>
  )
}
