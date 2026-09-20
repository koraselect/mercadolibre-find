const CURRENCY_SYMBOLS: Record<string, string> = {
  VES: "Bs.",
  USD: "$",
  ARS: "$",
  MXN: "$",
  CLP: "$",
  BRL: "R$",
  COP: "$",
  PEN: "S/",
  EUR: "€",
};

/**
 * Formatea un monto en la moneda indicada.
 * No hace conversión de moneda: solo formatea la moneda que llega de MercadoLibre.
 */
export function formatCurrency(amount: number, currency = "VES"): string {
  if (!Number.isFinite(amount)) return "—";
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const isUsdLike = ["USD", "ARS", "MXN", "CLP", "COP", "BRL", "PEN"].includes(currency);
  const decimals = isUsdLike ? 2 : 2;
  const formatted = new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
  return `${symbol}${formatted}`;
}

/** Formatea un monto sin símbolo (para tablas/compacto). */
export function formatAmount(amount: number, currency = "VES"): string {
  if (!Number.isFinite(amount)) return "—";
  const decimals = ["USD", "ARS", "MXN", "CLP", "COP", "BRL", "PEN"].includes(currency) ? 2 : 2;
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}