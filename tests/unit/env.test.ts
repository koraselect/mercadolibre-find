import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getEnv, hasAiKeys, hasMeliCredentials, resetEnvCache } from "@/lib/config/env";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  resetEnvCache();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  resetEnvCache();
});

describe("env", () => {
  it("aplica valores por defecto sin claves", () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.MELI_CLIENT_ID;
    const env = getEnv();
    expect(env.GEMINI_MODEL).toBe("gemini-3.6-flash");
    expect(env.GROQ_MODEL).toBe("openai/gpt-oss-120b");
    expect(env.ML_SITE_ID).toBe("MLV");
    expect(env.ANALYSIS_MAX_CANDIDATES).toBe(30);
    expect(env.MIN_MATCH_SCORE).toBe(0.75);
  });

  it("falla con errores descriptivos si la config es inválida", () => {
    process.env = { ...ORIGINAL_ENV, LOG_LEVEL: "nope" };
    expect(() => getEnv()).toThrowError(/LOG_LEVEL/i);
  });

  it("expone helpers de credenciales", () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.MELI_CLIENT_ID;
    expect(hasAiKeys()).toBe(false);
    expect(hasMeliCredentials()).toBe(false);
    process.env.GEMINI_API_KEY = "test-key";
    resetEnvCache();
    expect(hasAiKeys()).toBe(true);
  });
});