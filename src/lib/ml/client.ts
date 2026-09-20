import { getEnv } from "@/lib/config/env";
import { MercadoLibreApiError, ProductNotFoundError, RateLimitError, AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logging/logger";

/**
 * Cliente HTTP contra la API de MercadoLibre.
 * Credential-aware: usa token de usuario (OAuth) si está disponible y,
 * si no, token de app (client_credentials) con degradación de capacidades.
 */

export type MeliAuthMode = "user" | "app";

export interface MeliTokenProvider {
  readonly mode: MeliAuthMode;
  /** Token de app (client_credentials), refrescado y cacheado. */
  getAppToken(): Promise<string>;
  /** Token de usuario (OAuth), o null si no se tiene. */
  getUserToken(): Promise<string | null>;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  /** True si en 403 se debe intentar leer sin bearer (algunos recursos públicos). */
  retryPublic?: boolean;
}

export class HttpMeliTokenProvider implements MeliTokenProvider {
  private appTokenCache: { token: string; expiresAt: number } | null = null;

  async getAppToken(): Promise<string> {
    const env = getEnv();
    if (!env.MELI_CLIENT_ID || !env.MELI_CLIENT_SECRET) {
      throw new AppError(
        "MELI_NO_CREDENTIALS",
        "No hay credenciales de MercadoLibre configuradas (MELI_CLIENT_ID / MELI_CLIENT_SECRET)."
      );
    }
    const now = Date.now();
    if (this.appTokenCache && this.appTokenCache.expiresAt > now + 60_000) {
      return this.appTokenCache.token;
    }
    const res = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: env.MELI_CLIENT_ID,
        client_secret: env.MELI_CLIENT_SECRET,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new MercadoLibreApiError(
        `No se pudo obtener el token de app (HTTP ${res.status}).`,
        new Error(`token status ${res.status}`)
      );
    }
    const data = (await res.json()) as { access_token: string; expires_in?: number };
    const ttl = (data.expires_in ?? 21600) * 1000;
    this.appTokenCache = { token: data.access_token, expiresAt: now + ttl };
    return data.access_token;
  }

  async getUserToken(): Promise<string | null> {
    return null;
  }

  get mode(): MeliAuthMode {
    return "app";
  }
}

export class MeliHttpClient {
  constructor(
    private readonly tokens: MeliTokenProvider,
    private readonly baseUrl = "https://api.mercadolibre.com"
  ) {}

  async get<T>(
    path: string,
    opts: RequestOptions = {}
  ): Promise<{ status: number; data: T; source: "api" }> {
    const { status, data } = await this.requestRaw(path, opts);
    return { status, data: data as T, source: "api" };
  }

  private async requestRaw(path: string, opts: RequestOptions): Promise<{ status: number; data: unknown }> {
    const method = opts.method ?? "GET";
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };

    // Con token de usuario si está disponible; si no, app token.
    const userToken = await this.tokens.getUserToken().catch(() => null);
    if (userToken) {
      headers.Authorization = `Bearer ${userToken}`;
    } else {
      const appToken = await this.tokens.getAppToken().catch(() => null);
      if (appToken) headers.Authorization = `Bearer ${appToken}`;
    }

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(20_000),
      });
    } catch (cause) {
      throw new MercadoLibreApiError("No pudimos contactar a MercadoLibre (timeout/red).", cause);
    }

    if (res.status === 403 && opts.retryPublic && headers.Authorization) {
      // Reintentar como recurso público (sin bearer) para endpoints como description.
      delete headers.Authorization;
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(20_000),
      });
    }

    const contentType = res.headers.get("content-type") ?? "";
    let body: unknown = null;
    if (contentType.includes("application/json") || res.headers.get("content-length")) {
      try {
        body = await res.json();
      } catch {
        body = await res.text().catch(() => null);
      }
    } else {
      body = await res.text().catch(() => null);
    }

    if (res.ok) return { status: res.status, data: body };
    this.throwFromError(res.status, body, path);
    throw new MercadoLibreApiError(`MercadoLibre respondió ${res.status}.`);
  }

  private throwFromError(status: number, body: unknown, path: string): void {
    const msg = extractErrorMessage(body);
    logger.warn("meli.http_error", { status, path, error: msg });
    if (status === 429) throw new RateLimitError();
    if (status === 404) {
      if (path.startsWith("/items/") && !path.includes("/description")) {
        throw new ProductNotFoundError(
          "No encontramos la publicación. Verifica que exista o sea pública."
        );
      }
      throw new AppError("MELI_NOT_FOUND", msg ?? "Recurso no encontrado en MercadoLibre.", {
        status: 404,
      });
    }
    if (status === 403 || status === 401) {
      throw new MercadoLibreApiError(
        "MercadoLibre denegó el acceso. Conecta tu cuenta o usa datos de demostración.",
        new Error(`access ${status}: ${msg ?? ""}`)
      );
    }
    throw new MercadoLibreApiError(
      msg ?? `MercadoLibre respondió ${status}.`,
      new Error(msg ?? `HTTP ${status}`)
    );
  }
}

export function extractErrorMessage(body: unknown): string | null {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.message === "string") return b.message;
    if (typeof b.error === "string") return b.error;
  }
  return null;
}

/** Construye un cliente HTTP con tokens por defecto. */
export function createMeliHttpClient(): MeliHttpClient {
  return new MeliHttpClient(new HttpMeliTokenProvider());
}