import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MeliHttpClient, HttpMeliTokenProvider } from "@/lib/ml/client";
import { resetEnvCache } from "@/lib/config/env";
import { RateLimitError, MercadoLibreApiError, ProductNotFoundError } from "@/lib/errors/app-error";

function tokenProvider() {
  return { mode: "app" as const, getAppToken: async () => "app-token", getUserToken: async () => null };
}

function mockFetch(status: number, body: unknown, headers = { "content-type": "application/json" }) {
  const res = {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-length": "1", ...headers }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res));
}

describe("MeliHttpClient", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("mapea 429 a RateLimitError", async () => {
    mockFetch(429, { message: "rate limited" });
    const c = new MeliHttpClient(tokenProvider(), "https://api.mercadolibre.com");
    await expect(c.get("/x")).rejects.toBeInstanceOf(RateLimitError);
  });

  it("mapea 404 de ítem a ProductNotFoundError", async () => {
    mockFetch(404, { message: "not found" });
    const c = new MeliHttpClient(tokenProvider(), "https://api.mercadolibre.com");
    await expect(c.get("/items/MLV1024764940")).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it("mapea 403 a MercadoLibreApiError", async () => {
    mockFetch(403, { message: "access denied", error: "access_denied" });
    const c = new MeliHttpClient(tokenProvider(), "https://api.mercadolibre.com");
    const err = await c.get("/items/MLV1").then(() => null).catch((e) => e);
    expect(err).toBeInstanceOf(MercadoLibreApiError);
    expect(err.toUserMessage()).toContain("MercadoLibre");
  });

  it("hace request exitoso y devuelve data", async () => {
    mockFetch(200, { id: "MLV200", title: "Cosa" });
    const c = new MeliHttpClient(tokenProvider(), "https://api.mercadolibre.com");
    const { data, source } = await c.get<{ id: string }>("/items/MLV200");
    expect(data.id).toBe("MLV200");
    expect(source).toBe("api");
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toMatchObject({ Authorization: "Bearer app-token" });
  });

  it("reintenta como recurso público en 403 con retryPublic", async () => {
    mockFetch(403, { message: "forbidden" });
    const c = new MeliHttpClient(tokenProvider(), "https://api.mercadolibre.com");
    await expect(c.get("/items/MLV1", { retryPublic: true })).rejects.toBeInstanceOf(MercadoLibreApiError);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });
});

describe("HttpMeliTokenProvider", () => {
  beforeEach(() => {
    process.env.MELI_CLIENT_ID = "8888";
    process.env.MELI_CLIENT_SECRET = "secret-test";
    resetEnvCache();
  });
  afterEach(() => {
    delete process.env.MELI_CLIENT_ID;
    delete process.env.MELI_CLIENT_SECRET;
    resetEnvCache();
  });

  it("solicita token de app y cachea", async () => {
    const r = {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ access_token: "tok-abc", expires_in: 21600 }),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(r));
    const p = new HttpMeliTokenProvider();
    const t1 = await p.getAppToken();
    const t2 = await p.getAppToken();
    expect(t1).toBe("tok-abc");
    expect(t2).toBe("tok-abc");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});