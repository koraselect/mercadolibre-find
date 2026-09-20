import { getEnv } from "@/lib/config/env";
import { appTokenSchema } from "@/lib/ml/types";
import { MercadoLibreApiError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging/logger";

/**
 * OAuth de MercadoLibre (Fase 9). Construye URLs de autorización e
 * intercambia authorization_code / refresh_token por access_token.
 * Los tokens de usuario se persisten en la DB (ml_credentials).
 */

export function buildOAuthUrl(state: string, redirectUri?: string): string {
  const env = getEnv();
  const clientId = env.MELI_CLIENT_ID;
  if (!clientId) {
    throw new MercadoLibreApiError(
      "La conexión con MercadoLibre no está configurada (falta MELI_CLIENT_ID)."
    );
  }
  const uri = redirectUri ?? env.MELI_REDIRECT_URI ?? "";
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: uri,
    state,
  });
  return `https://auth.mercadolibre.com.ve/authorization?${params.toString()}`;
}

export interface TokenExchangeResult {
  accessToken: string;
  refreshToken: string | null;
  userId: string | null;
  expiresAt: number;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenExchangeResult> {
  const env = getEnv();
  const payload = {
    client_id: env.MELI_CLIENT_ID ?? "",
    client_secret: env.MELI_CLIENT_SECRET ?? "",
    ...body,
  };
  const res = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new MercadoLibreApiError(`MercadoLibre rechazó el intercambio (HTTP ${res.status}).`);
  }
  const raw = await res.json();
  const parsed = appTokenSchema.safeParse(raw);
  if (!parsed.success) {
    throw new MercadoLibreApiError("La respuesta de OAuth fue inválida.");
  }
  const d = parsed.data;
  const expiresAt = Date.now() + (d.expires_in ?? 21600) * 1000;
  logger.info("meli.oauth.ok", { userId: d.user_id != null ? String(d.user_id) : null });
  return {
    accessToken: d.access_token,
    refreshToken: d.refresh_token ?? null,
    userId: d.user_id != null ? String(d.user_id) : null,
    expiresAt,
  };
}

export async function exchangeCodeForToken(code: string, redirectUri?: string): Promise<TokenExchangeResult> {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri ?? getEnv().MELI_REDIRECT_URI ?? "",
  });
}

export async function refreshUserToken(refreshToken: string): Promise<TokenExchangeResult> {
  return tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

export function generateState(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function verifyState(state: string): boolean {
  return /^\d+-\w{8}$/.test(state);
}