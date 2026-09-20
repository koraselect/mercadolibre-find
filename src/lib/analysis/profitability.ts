/**
 * Motor de rentabilidad (TODO §19, §29-§32).
 * Cálculo determinístico de profit, margin y ROI.
 * Las comisiones de ML son configurables, no hardcodeadas.
 */

export interface FeeProfile {
  /** Comisión del marketplace (% del precio de venta). */
  marketplaceFeePct: number;
  /** Costo fijo de envío estimado. */
  shippingCost: number;
  /** Impuestos (% del precio de venta). */
  taxesPct: number;
  /** Comisión de pasarela de pago (% del precio de venta). */
  paymentFeePct: number;
  /** Otros costos fijos. */
  otherCosts: number;
}

export interface ProfitabilityInput {
  /** Precio de venta del candidato (donde comprarías). */
  salePrice: number;
  /** Precio de adquisición (tu costo real para obtener el producto). */
  acquisitionPrice: number;
  /** Perfil de comisiones aplicable. */
  fees?: Partial<FeeProfile>;
}

export interface ProfitabilityResult {
  grossDifference: number;
  totalCosts: number;
  estimatedProfit: number;
  marginPercent: number;
  roiPercent: number;
}

/** Perfil por defecto para MercadoLibre Venezuela (configurable). */
export const DEFAULT_FEE_PROFILE: FeeProfile = {
  marketplaceFeePct: 0.13,
  shippingCost: 0,
  taxesPct: 0,
  paymentFeePct: 0,
  otherCosts: 0,
};

/**
 * Calcula rentabilidad de una oportunidad.
 * salePrice = precio del candidato más barato.
 * acquisitionPrice = tu costo real (puede ser el precio del source si vas a revender).
 */
export function calculateProfitability(
  input: ProfitabilityInput
): ProfitabilityResult {
  const fees: FeeProfile = { ...DEFAULT_FEE_PROFILE, ...input.fees };
  const salePrice = input.salePrice;
  const acquisitionPrice = input.acquisitionPrice;

  const marketplaceFee = salePrice * fees.marketplaceFeePct;
  const taxes = salePrice * fees.taxesPct;
  const paymentFee = salePrice * fees.paymentFeePct;

  const totalCosts =
    acquisitionPrice +
    marketplaceFee +
    fees.shippingCost +
    taxes +
    paymentFee +
    fees.otherCosts;

  const grossDifference = salePrice - acquisitionPrice;
  const estimatedProfit = salePrice - totalCosts;
  const marginPercent = salePrice > 0 ? (estimatedProfit / salePrice) * 100 : 0;
  const roiPercent = acquisitionPrice > 0 ? (estimatedProfit / acquisitionPrice) * 100 : 0;

  return {
    grossDifference: Math.round(grossDifference * 100) / 100,
    totalCosts: Math.round(totalCosts * 100) / 100,
    estimatedProfit: Math.round(estimatedProfit * 100) / 100,
    marginPercent: Math.round(marginPercent * 100) / 100,
    roiPercent: Math.round(roiPercent * 100) / 100,
  };
}
