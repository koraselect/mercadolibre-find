/**
 * Utilidades de seguridad (TODO §54-§55).
 * Validación de inputs y protección contra prompt injection.
 */

/** Límites de seguridad para inputs. */
export const SECURITY_LIMITS = {
  MAX_URL_LENGTH: 400,
  MAX_INPUT_LENGTH: 10_000,
  MAX_PROMPT_LENGTH: 50_000,
} as const;

/** Patrones sospechosos de prompt injection. */
const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above)\s+(instructions?|prompts?|rules?)/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /system\s*:\s*/i,
  /\[INST\]/i,
  /<<SYS>>/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /Human:\s*/i,
  /Assistant:\s*/i,
];

/**
 * Detecta posible prompt injection en un texto.
 * Retorna true si el texto contiene patrones sospechosos.
 */
export function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Limpia un texto de entrada para usar en prompts.
 * Remueve caracteres de control y limita longitud.
 */
export function sanitizeInput(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .slice(0, SECURITY_LIMITS.MAX_INPUT_LENGTH)
    .trim();
}

/**
 * Valida que una URL sea de MercadoLibre Venezuela.
 */
export function isValidMeliUrl(url: string): boolean {
  const patterns = [
    /mercadolibre\.com\.ve/i,
    /mercadolibre\.com\/MLV/i,
    /articulo\.mercadolibre\.com\.ve/i,
  ];
  return patterns.some((p) => p.test(url));
}

/**
 * Rate limit simple en memoria (por IP o key).
 */
export class SimpleRateLimit {
  private attempts = new Map<string, number[]>();

  constructor(
    private readonly maxAttempts: number = 10,
    private readonly windowMs: number = 60_000
  ) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const timestamps = this.attempts.get(key) ?? [];
    const valid = timestamps.filter((t) => now - t < this.windowMs);
    this.attempts.set(key, valid);
    return valid.length < this.maxAttempts;
  }

  record(key: string): void {
    const timestamps = this.attempts.get(key) ?? [];
    timestamps.push(Date.now());
    this.attempts.set(key, timestamps);
  }
}
