import type { MercadoLibreItem, MercadoLibreItemId } from "@/lib/ml/types";
import { createMeliHttpClient } from "@/lib/ml/client";
import { fetchItem } from "@/lib/ml/items";
import { loadFixtureItem, demoModeEnabled } from "@/lib/ml/fixture-client";
import { hasMeliCredentials } from "@/lib/config/env";
import { logger } from "@/lib/logging/logger";

export interface ResolvedItem {
  item: MercadoLibreItem;
  /** Nombre del canal de datos usado: "live" | "fixture" */
  channel: "live" | "fixture";
}

/**
 * Resuelve un ítem de MercadoLibre. Usa la API real cuando hay credenciales
 * (y no está forzado el modo demo); si la API falla o no hay credenciales,
 * cae a fixtures locales para mantener la app demostrable.
 */
export async function resolveItem(itemId: MercadoLibreItemId): Promise<ResolvedItem> {
  const useLive = hasMeliCredentials() && !demoModeEnabled();
  if (!useLive) {
    logger.info("meli.resolve.fixture", { id: itemId.rawId });
    return { item: await loadFixtureItem(itemId), channel: "fixture" };
  }
  try {
    const item = await fetchItem(itemId, createMeliHttpClient());
    return { item, channel: "live" };
  } catch (err) {
    logger.warn("meli.resolve.live_failed_fallback_fixture", {
      id: itemId.rawId,
      cause: String(err).slice(0, 200),
    });
    // Intentar con fixture antes de re-lanzar.
    try {
      return { item: await loadFixtureItem(itemId), channel: "fixture" };
    } catch {
      throw err;
    }
  }
}