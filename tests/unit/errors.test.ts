import { describe, expect, it } from "vitest";
import { InvalidUrlError, ProductNotFoundError, MercadoLibreApiError, AppError } from "@/lib/errors/app-error";

describe("app errors", () => {
  it("clasifica code y status", () => {
    expect(new InvalidUrlError().code).toBe("INVALID_URL");
    expect(new InvalidUrlError().status).toBe(400);
    expect(new ProductNotFoundError().status).toBe(404);
    expect(new MercadoLibreApiError().retryable).toBe(true);
  });

  it("no expone internals vía mensaje de usuario", () => {
    const err = new MercadoLibreApiError();
    expect(err.toUserMessage()).toContain("MercadoLibre");
    const err2 = new AppError("X", "m");
    expect(err2.toUserMessage()).toBe("m");
  });

  it("name refleja la clase", () => {
    expect(new MercadoLibreApiError().name).toBe("MercadoLibreApiError");
    expect(new AppError("X", "m").name).toBe("AppError");
  });
});