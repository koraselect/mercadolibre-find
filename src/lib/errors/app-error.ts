import { logger } from "@/lib/logging/logger";

/**
 * Errores tipados de la aplicación (TODO §36).
 * Nunca exponen internals al usuario: `toUserMessage()` produce texto legible.
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(
    code: string,
    message: string,
    options: { status?: number; retryable?: boolean; cause?: unknown } = {}
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.code = code;
    this.status = options.status ?? 500;
    this.retryable = options.retryable ?? false;
  }

  toUserMessage(): string {
    return this.message;
  }

  log(fields?: Record<string, unknown>): void {
    logger.error(`${this.name} [${this.code}]`, {
      ...fields,
      message: this.message,
    });
  }
}

export class InvalidUrlError extends AppError {
  constructor(message = "La URL no corresponde a una publicación de MercadoLibre Venezuela.") {
    super("INVALID_URL", message, { status: 400 });
  }
}

export class MercadoLibreApiError extends AppError {
  constructor(message = "No pudimos contactar a MercadoLibre.", cause?: unknown) {
    super("MELI_API", message, { status: 502, retryable: true, cause });
  }
}

export class ProductNotFoundError extends AppError {
  constructor(message = "No pudimos encontrar la publicación. Verifica que la URL sea correcta.") {
    super("PRODUCT_NOT_FOUND", message, { status: 404 });
  }
}

export class SearchError extends AppError {
  constructor(message = "La búsqueda en MercadoLibre falló.", cause?: unknown) {
    super("SEARCH_ERROR", message, { status: 502, retryable: true, cause });
  }
}

export class AIProviderError extends AppError {
  constructor(message = "El proveedor de IA no respondió correctamente.", cause?: unknown) {
    super("AI_PROVIDER", message, { status: 502, retryable: true, cause });
  }
}

export class AIValidationError extends AppError {
  constructor(message = "El proveedor de IA devolvió una respuesta inválida.") {
    super("AI_SCHEMA", message, { status: 502 });
  }
}

export class RateLimitError extends AppError {
  constructor(message = "MercadoLibre limitó la cantidad de solicitudes. Intenta de nuevo en unos minutos.") {
    super("RATE_LIMIT", message, { status: 429, retryable: true });
  }
}

export class DatabaseError extends AppError {
  constructor(message = "Hubo un problema guardando los datos.", cause?: unknown) {
    super("DB", message, { status: 500, retryable: true, cause });
  }
}