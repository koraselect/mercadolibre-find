import { NextResponse } from "next/server";
import { getEnv, hasAiKeys, hasMeliCredentials } from "@/lib/config/env";
import { demoModeEnabled } from "@/lib/ml/fixture-client";

export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  const env = getEnv();
  const appToken = hasMeliCredentials();
  const aiKeys = hasAiKeys();
  return NextResponse.json({
    ok: true,
    app: "mercadolibre-opportunity-finder",
    site: env.ML_SITE_ID,
    capabilities: {
      meliClient: appToken,
      aiProviders: aiKeys,
      demoMode: demoModeEnabled(),
      dataChannel: demoModeEnabled() || !appToken ? "fixture" : "live",
    },
    time: new Date().toISOString(),
  });
}