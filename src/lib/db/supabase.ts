import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/config/env";
import { AppError } from "@/lib/errors/app-error";

let client: SupabaseClient | null = null;

/**
 * Supabase client singleton (TODO §35-§36).
 * Se crea una vez y se reutiliza en todo el server-side.
 */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const env = getEnv();
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new AppError(
      "DB_NOT_CONFIGURED",
      "Faltan SUPABASE_URL o SUPABASE_ANON_KEY en el entorno.",
      { status: 500 }
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false },
  });

  return client;
}
