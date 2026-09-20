import { z } from "zod";

/**
 * Configuración tipada de entorno, validada con Zod.
 * Todas las claves secretas se leen aquí (server-side), nunca en el cliente.
 * Las variables opcionales permiten modo demo/fixtures y tests sin claves.
 */

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error", "silent"])
    .default("info"),

  // MercadoLibre
  MELI_CLIENT_ID: z.string().optional(),
  MELI_CLIENT_SECRET: z.string().optional(),
  MELI_REDIRECT_URI: z.string().url().optional(),
  ML_SITE_ID: z.string().default("MLV"),

  // Gemini
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.6-flash"),

  // Groq
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),

  // Database
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),

  // Cron
  CRON_SECRET: z.string().optional(),

  // Análisis
  ANALYSIS_MAX_CANDIDATES: z.coerce.number().int().positive().default(30),
  AI_MAX_MATCH_CANDIDATES: z.coerce.number().int().positive().default(10),
  MIN_MATCH_SCORE: z.coerce.number().min(0).max(1).default(0.75),
  MIN_PROFIT_MARGIN: z.coerce.number().min(0).max(1).default(0.1),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | undefined;

/** Invalida la caché del entorno. Útil para tests. */
export function resetEnvCache(): void {
  cachedEnv = undefined;
}

/**
 * Devuelve el entorno validado. Se parsea una sola vez por proceso.
 * Lanza un error descriptivo si la configuración es inválida.
 */
export function getEnv(): AppEnv {
  if (cachedEnv) return cachedEnv;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `- ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Variables de entorno inválidas:\n${issues}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

/** Si la app tiene clave de MercadoLibre configurada (acceso a API real). */
export function hasMeliCredentials(env: AppEnv = getEnv()): boolean {
  return Boolean(env.MELI_CLIENT_ID || env.MELI_CLIENT_SECRET);
}

/** Si hay claves de IA configuradas (modo live). */
export function hasAiKeys(env: AppEnv = getEnv()): boolean {
  return Boolean(env.GEMINI_API_KEY || env.GROQ_API_KEY);
}