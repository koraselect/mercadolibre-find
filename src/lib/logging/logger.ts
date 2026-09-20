import { getEnv } from "@/lib/config/env";

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99,
};

function resolveLevel(): LogLevel {
  try {
    return getEnv().LOG_LEVEL;
  } catch {
    return "info";
  }
}

type LogField = Record<string, unknown>;

function fmt(ctx?: string, fields?: LogField): string {
  const parts: string[] = [];
  if (ctx) parts.push(`[${ctx}]`);
  if (fields && Object.keys(fields).length > 0) {
    parts.push(JSON.stringify(fields));
  }
  return parts.join(" ");
}

/**
 * Logger estructurado de eventos (ver TODO §38).
 * Nunca registra secretos: los valores con keys conocidas se censuran.
 */
export const logger = {
  debug(msg: string, fields?: LogField): void {
    if (LEVEL_ORDER[resolveLevel()] > LEVEL_ORDER.debug) return;
    console.debug(msg, fmt(undefined, sanitizeFields(fields)));
  },
  info(msg: string, fields?: LogField): void {
    if (LEVEL_ORDER[resolveLevel()] > LEVEL_ORDER.info) return;
    console.info(msg, fmt(undefined, sanitizeFields(fields)));
  },
  warn(msg: string, fields?: LogField): void {
    if (LEVEL_ORDER[resolveLevel()] > LEVEL_ORDER.warn) return;
    console.warn(msg, fmt(undefined, sanitizeFields(fields)));
  },
  error(msg: string, fields?: LogField): void {
    if (LEVEL_ORDER[resolveLevel()] > LEVEL_ORDER.error) return;
    console.error(msg, fmt(undefined, sanitizeFields(fields)));
  },
};

const SENSITIVE_KEY = /(secret|token|password|api_key|apikey|authorization|key)/i;

export function sanitizeFields(fields?: LogField): LogField | undefined {
  if (!fields) return undefined;
  const out: LogField = {};
  for (const [k, v] of Object.entries(fields)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = v;
    }
  }
  return out;
}