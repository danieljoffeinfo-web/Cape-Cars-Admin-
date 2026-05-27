export type VehicleCategory = 'Luxury Vehicles' | 'Mid Tier Vehicles' | 'Large Vehicles'
export type TelegramSegment = 'luxury' | 'mid' | 'economy'
export type TelegramBodyType = 'SUV' | 'Sedan' | 'Convertible' | 'Coupe' | 'Hatchback' | 'Van' | 'Minibus' | 'People Mover'

export type TelegramCatalogVehicle = {
  id: string
  model: string
  category: VehicleCategory
  rate: number
  status: 'Available' | 'Booked' | 'Service'
  imageUrl: string
}

export const CATEGORY_ORDER: VehicleCategory[] = [
  'Luxury Vehicles',
  'Mid Tier Vehicles',
  'Large Vehicles',
]

export const CATEGORY_PRICING: Record<VehicleCategory, number> = {
  'Luxury Vehicles': 7000,
  'Mid Tier Vehicles': 2000,
  'Large Vehicles': 4000,
}

export const TELEGRAM_CATALOG: TelegramCatalogVehicle[] = [
  {
    id: 'bmw-3-series-sedan',
    model: "BMW 3 Series Sedan",
    category: "Luxury Vehicles",
    rate: 7000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875503/cape-cars/telegram-fine-pass/Luxury%20Vehicles/BMW%203%20Series%20Sedan.jpg",
  },
  {
    id: 'bmw-4-series-convertible',
    model: "BMW 4 Series Convertible",
    category: "Luxury Vehicles",
    rate: 7000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875500/cape-cars/telegram-fine-pass/Luxury%20Vehicles/BMW%204%20Series%20Convertible.jpg",
  },
  {
    id: 'bmw-m2-competition',
    model: "BMW M2 Competition",
    category: "Luxury Vehicles",
    rate: 7000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875483/cape-cars/telegram-fine-pass/Luxury%20Vehicles/BMW%20M2%20Competition.jpg",
  },
  {
    id: 'bmw-x3-m-sport',
    model: "BMW X3 M Sport",
    category: "Luxury Vehicles",
    rate: 7000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875492/cape-cars/telegram-fine-pass/Luxury%20Vehicles/BMW%20X3%20M%20Sport.jpg",
  },
  {
    id: 'bmw-x5',
    model: "BMW X5",
    category: "Luxury Vehicles",
    rate: 7000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875497/cape-cars/telegram-fine-pass/Luxury%20Vehicles/BMW%20X5.jpg",
  },
  {
    id: 'jaguar-f-type-convertible',
    model: "Jaguar F-Type Convertible",
    category: "Luxury Vehicles",
    rate: 7000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875487/cape-cars/telegram-fine-pass/Luxury%20Vehicles/Jaguar%20F-Type%20Convertible.jpg",
  },
  {
    id: 'jaguar-f-type-convertible-2',
    model: "Jaguar F-Type Convertible 2",
    category: "Luxury Vehicles",
    rate: 7000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875511/cape-cars/telegram-fine-pass/Luxury%20Vehicles/Jaguar%20F-Type%20Convertible%202.jpg",
  },
  {
    id: 'jaguar-f-type-convertible-3',
    model: "Jaguar F-Type Convertible 3",
    category: "Luxury Vehicles",
    rate: 7000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875514/cape-cars/telegram-fine-pass/Luxury%20Vehicles/Jaguar%20F-Type%20Convertible%203.jpg",
  },
  {
    id: 'jeep-wrangler-unlimited-rubicon',
    model: "Jeep Wrangler Unlimited Rubicon",
    category: "Luxury Vehicles",
    rate: 7000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875474/cape-cars/telegram-fine-pass/Luxury%20Vehicles/Jeep%20Wrangler%20Unlimited%20Rubicon.jpg",
  },
  {
    id: 'mercedes-benz-s-class',
    model: "Mercedes-Benz S-Class",
    category: "Luxury Vehicles",
    rate: 7000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875477/cape-cars/telegram-fine-pass/Luxury%20Vehicles/Mercedes-Benz%20S-Class.jpg",
  },
  {
    id: 'mercedes-benz-v-class',
    model: "Mercedes-Benz V-Class",
    category: "Luxury Vehicles",
    rate: 7000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875508/cape-cars/telegram-fine-pass/Luxury%20Vehicles/Mercedes-Benz%20V-Class.jpg",
  },
  {
    id: 'porsche-718-boxster',
    model: "Porsche 718 Boxster",
    category: "Luxury Vehicles",
    rate: 7000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875489/cape-cars/telegram-fine-pass/Luxury%20Vehicles/Porsche%20718%20Boxster.jpg",
  },
  {
    id: 'porsche-cayman',
    model: "Porsche Cayman",
    category: "Luxury Vehicles",
    rate: 7000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875494/cape-cars/telegram-fine-pass/Luxury%20Vehicles/Porsche%20Cayman.jpg",
  },
  {
    id: 'range-rover-sport',
    model: "Range Rover Sport",
    category: "Luxury Vehicles",
    rate: 7000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875480/cape-cars/telegram-fine-pass/Luxury%20Vehicles/Range%20Rover%20Sport.jpg",
  },
  {
    id: 'range-rover-sport-2',
    model: "Range Rover Sport 2",
    category: "Luxury Vehicles",
    rate: 7000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875506/cape-cars/telegram-fine-pass/Luxury%20Vehicles/Range%20Rover%20Sport%202.jpg",
  },
  {
    id: 'bmw-x3',
    model: "BMW X3",
    category: "Mid Tier Vehicles",
    rate: 2000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875444/cape-cars/telegram-fine-pass/Mid%20Tier%20Vehicles/BMW%20X3.jpg",
  },
  {
    id: 'honda-jazz',
    model: "Honda Jazz",
    category: "Mid Tier Vehicles",
    rate: 2000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875438/cape-cars/telegram-fine-pass/Mid%20Tier%20Vehicles/Honda%20Jazz.jpg",
  },
  {
    id: 'hyundai-h1-grand-starex',
    model: "Hyundai H1 Grand Starex",
    category: "Mid Tier Vehicles",
    rate: 2000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875428/cape-cars/telegram-fine-pass/Mid%20Tier%20Vehicles/Hyundai%20H1%20Grand%20Starex.jpg",
  },
  {
    id: 'hyundai-h1-grand-starex-2',
    model: "Hyundai H1 Grand Starex 2",
    category: "Mid Tier Vehicles",
    rate: 2000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875447/cape-cars/telegram-fine-pass/Mid%20Tier%20Vehicles/Hyundai%20H1%20Grand%20Starex%202.jpg",
  },
  {
    id: 'hyundai-i20',
    model: "Hyundai i20",
    category: "Mid Tier Vehicles",
    rate: 2000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875434/cape-cars/telegram-fine-pass/Mid%20Tier%20Vehicles/Hyundai%20i20.jpg",
  },
  {
    id: 'jeep-wrangler-unlimited',
    model: "Jeep Wrangler Unlimited",
    category: "Mid Tier Vehicles",
    rate: 2000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875452/cape-cars/telegram-fine-pass/Mid%20Tier%20Vehicles/Jeep%20Wrangler%20Unlimited.jpg",
  },
  {
    id: 'kia-picanto',
    model: "Kia Picanto",
    category: "Mid Tier Vehicles",
    rate: 2000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875456/cape-cars/telegram-fine-pass/Mid%20Tier%20Vehicles/Kia%20Picanto.jpg",
  },
  {
    id: 'mini-countryman',
    model: "MINI Countryman",
    category: "Mid Tier Vehicles",
    rate: 2000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875441/cape-cars/telegram-fine-pass/Mid%20Tier%20Vehicles/MINI%20Countryman.jpg",
  },
  {
    id: 'mini-countryman-2',
    model: "MINI Countryman 2",
    category: "Mid Tier Vehicles",
    rate: 2000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875458/cape-cars/telegram-fine-pass/Mid%20Tier%20Vehicles/MINI%20Countryman%202.jpg",
  },
  {
    id: 'range-rover-evoque-convertible',
    model: "Range Rover Evoque Convertible",
    category: "Mid Tier Vehicles",
    rate: 2000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875449/cape-cars/telegram-fine-pass/Mid%20Tier%20Vehicles/Range%20Rover%20Evoque%20Convertible.jpg",
  },
  {
    id: 'toyota-rav4',
    model: "Toyota RAV4",
    category: "Mid Tier Vehicles",
    rate: 2000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875432/cape-cars/telegram-fine-pass/Mid%20Tier%20Vehicles/Toyota%20RAV4.jpg",
  },
  {
    id: 'hyundai-h1-grand-starex-large',
    model: "Hyundai H1 Grand Starex",
    category: "Large Vehicles",
    rate: 4000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875461/cape-cars/telegram-fine-pass/Large%20Vehicles/Hyundai%20H1%20Grand%20Starex.jpg",
  },
  {
    id: 'hyundai-staria',
    model: "Hyundai Staria",
    category: "Large Vehicles",
    rate: 4000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875464/cape-cars/telegram-fine-pass/Large%20Vehicles/Hyundai%20Staria.jpg",
  },
  {
    id: 'hyundai-staria-2',
    model: "Hyundai Staria 2",
    category: "Large Vehicles",
    rate: 4000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875466/cape-cars/telegram-fine-pass/Large%20Vehicles/Hyundai%20Staria%202.jpg",
  },
  {
    id: 'mercedes-benz-sprinter-minibus',
    model: "Mercedes-Benz Sprinter Minibus",
    category: "Large Vehicles",
    rate: 4000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875471/cape-cars/telegram-fine-pass/Large%20Vehicles/Mercedes-Benz%20Sprinter%20Minibus.jpg",
  },
  {
    id: 'mercedes-benz-v-class-large',
    model: "Mercedes-Benz V-Class",
    category: "Large Vehicles",
    rate: 4000,
    status: 'Available',
    imageUrl: "https://res.cloudinary.com/dmanxetyl/image/upload/v1778875469/cape-cars/telegram-fine-pass/Large%20Vehicles/Mercedes-Benz%20V-Class.jpg",
  },
]

export const TELEGRAM_CATALOG_IMAGE_BY_MODEL = Object.fromEntries(
  TELEGRAM_CATALOG.map((vehicle) => [vehicle.model, vehicle.imageUrl]),
) as Record<string, string>

export const LEGACY_TELEGRAM_MODEL_DISPLAY: Record<string, { model: string, category: VehicleCategory, imageUrl: string }> = {
  'Mini Countryman S': { model: 'Hyundai H1 Grand Starex', category: 'Mid Tier Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['Hyundai H1 Grand Starex'] },
  'Hyundai Accent Sedan': { model: 'Toyota RAV4', category: 'Mid Tier Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['Toyota RAV4'] },
  'Hyundai i20 Hatchback': { model: 'Hyundai i20', category: 'Mid Tier Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['Hyundai i20'] },
  'Porsche 718 Cayman': { model: 'Jeep Wrangler Unlimited Rubicon', category: 'Luxury Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['Jeep Wrangler Unlimited Rubicon'] },
  'Kia Picanto': { model: 'Honda Jazz', category: 'Mid Tier Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['Honda Jazz'] },
  'Audi Q5 SQ5': { model: 'Mercedes-Benz S-Class', category: 'Luxury Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['Mercedes-Benz S-Class'] },
  'Mercedes A-Class Hatchback': { model: 'Range Rover Sport', category: 'Luxury Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['Range Rover Sport'] },
  'Mercedes G-Class G63': { model: 'BMW M2 Competition', category: 'Luxury Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['BMW M2 Competition'] },
  'BMW 4 Series Gran Coupe': { model: 'Jaguar F-Type Convertible', category: 'Luxury Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['Jaguar F-Type Convertible'] },
  'Audi Q3 RS Q3 Sportback': { model: 'Porsche 718 Boxster', category: 'Luxury Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['Porsche 718 Boxster'] },
  'Mercedes GLE Coupe': { model: 'BMW X3 M Sport', category: 'Luxury Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['BMW X3 M Sport'] },
  'Jeep Wrangler Rubicon': { model: 'Hyundai H1 Grand Starex', category: 'Large Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['Hyundai H1 Grand Starex'] },
  'Audi A5 Cabriolet': { model: 'Porsche Cayman', category: 'Luxury Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['Porsche Cayman'] },
  'Volkswagen Tiguan Allspace': { model: 'MINI Countryman', category: 'Mid Tier Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['MINI Countryman'] },
  'BMW X5': { model: 'BMW X5', category: 'Luxury Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['BMW X5'] },
  'Jaguar F-Type Coupe': { model: 'BMW 4 Series Convertible', category: 'Luxury Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['BMW 4 Series Convertible'] },
  'BMW X5 M': { model: 'BMW 3 Series Sedan', category: 'Luxury Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['BMW 3 Series Sedan'] },
  'Hyundai Staria': { model: 'Hyundai Staria 2', category: 'Large Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['Hyundai Staria 2'] },
  'Range Rover Sport': { model: 'Range Rover Sport 2', category: 'Luxury Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['Range Rover Sport 2'] },
  'Mercedes C-Class Sedan': { model: 'Mercedes-Benz V-Class', category: 'Luxury Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['Mercedes-Benz V-Class'] },
  'Hyundai Staria 2': { model: 'Hyundai Staria', category: 'Large Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['Hyundai Staria'] },
  'Hyundai H1 Grand Starex': { model: 'Mercedes-Benz V-Class', category: 'Large Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['Mercedes-Benz V-Class'] },
  'Mercedes Sprinter Van': { model: 'Mercedes-Benz Sprinter Minibus', category: 'Large Vehicles', imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL['Mercedes-Benz Sprinter Minibus'] },
}

export function getTelegramVehicleDisplay(model: string) {
  return LEGACY_TELEGRAM_MODEL_DISPLAY[model] ?? {
    model,
    imageUrl: TELEGRAM_CATALOG_IMAGE_BY_MODEL[model] ?? '',
  }
}

export function getTelegramSegment(model: string, category?: VehicleCategory | string | null): TelegramSegment {
  const normalized = model.toLowerCase()

  if (category === 'Luxury Vehicles') return 'luxury'
  if (/(picanto|jazz|i20)/.test(normalized)) return 'economy'
  return 'mid'
}

export function getTelegramBodyType(model: string): TelegramBodyType {
  const normalized = model.toLowerCase()

  if (/(sprinter|minibus)/.test(normalized)) return 'Minibus'
  if (/(staria|grand starex|v-class)/.test(normalized)) return 'People Mover'
  if (/(van)/.test(normalized)) return 'Van'
  if (/(convertible|boxster|cabriolet)/.test(normalized)) return 'Convertible'
  if (/(cayman|coupe|competition)/.test(normalized)) return 'Coupe'
  if (/(sedan|s-class|3 series)/.test(normalized)) return 'Sedan'
  if (/(x3|x5|wrangler|range rover|rav4|evoque|countryman|sportback|suv)/.test(normalized)) return 'SUV'
  if (/(picanto|jazz|i20)/.test(normalized)) return 'Hatchback'
  return 'Sedan'
}

export function getInternalTelegramVehicleModel(displayModel: string, category?: string | null) {
  const direct = LEGACY_TELEGRAM_MODEL_DISPLAY[displayModel]
  if (direct) return displayModel

  const matches = Object.entries(LEGACY_TELEGRAM_MODEL_DISPLAY).filter(([, value]) => value.model === displayModel)
  if (matches.length === 0) return displayModel
  const categoryMatch = category ? matches.find(([, value]) => value.category === category) : null
  return (categoryMatch ?? matches[0])?.[0] ?? displayModel
}
