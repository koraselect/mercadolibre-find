import type { MercadoLibreItem } from "@/lib/ml/types";

/** Factory de un ítem mínimo para tests de IA/análisis. */
export function makeItem(overrides: Partial<MercadoLibreItem> = {}): MercadoLibreItem {
  const base: MercadoLibreItem = {
    id: { siteId: "MLV", numericId: "1024764940", rawId: "MLV1024764940", kind: "item" },
    title: "Mini Aspiradora Portátil USB Recargable 120W",
    price: 35,
    currency: "USD",
    status: "active",
    subStatus: null,
    availableQuantity: 5,
    stockBucket: { range: null, minEstimate: null },
    seller: { id: "123", nickname: "vendedor_test" },
    pictures: ["http://img.example/pic1.jpg"],
    description: "Aspiradora de mano inalámbrica de 120W con puerto USB-C.",
    domainId: "MLV-HOME_APPLIANCES",
    categoryId: "MLV1234",
    catalogProductId: "MLV100500",
    attributes: {
      BRAND: "VCUTE",
      MODEL: "VC-120",
      MPN: "VC120-USB",
      COLOR: "Azul",
      POWER: "120W",
    },
    variations: [],
    permalink: "https://articulo.mercadolibre.com.ve/MLV1024764940-_JM",
    dataSources: ["fixture"],
    fetchedAt: "2026-09-20T12:00:00.000Z",
  };
  return { ...base, ...overrides, id: overrides.id ?? base.id };
}