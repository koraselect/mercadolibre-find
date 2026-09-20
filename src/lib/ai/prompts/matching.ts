import type { ProductFingerprint } from "@/lib/ai/schemas/fingerprint";
import { FINGERPRINT_SCHEMA_DOC } from "@/lib/ai/schemas/fingerprint";
import { MATCH_SCHEMA_DOC } from "@/lib/ai/schemas/matching";
import type { MercadoLibreItem } from "@/lib/ml/types";
import { buildProductDigest, digestToText } from "@/lib/analysis/normalize";

/**
 * Prompt para matching de candidatos (TODO §42).
 * Le da a Gemini el fingerprint del producto fuente y un candidato;
 * pide que evalúe si son el mismo producto.
 */

export function buildMatchingPrompt(
  source: MercadoLibreItem,
  candidate: MercadoLibreItem,
  fingerprint: ProductFingerprint
): { system: string; user: string } {
  const srcDigest = buildProductDigest(source);
  const candDigest = buildProductDigest(candidate);

  const system = `Eres un experto en productos de MercadoLibre Venezuela. Tu tarea es determinar si un CANDIDATO es el mismo producto que el PRODUCTO FUENTE.

El PRODUCTO FUENTE ya fue analizado y tiene este fingerprint:
${JSON.stringify(fingerprint, null, 2)}

El PRODUCTO FUENTE tiene estos datos:
${digestToText(srcDigest)}

El CANDIDATO tiene estos datos:
${digestToText(candDigest)}

Responde ÚNICAMENTE con un JSON válido que cumpla este esquema:
${MATCH_SCHEMA_DOC}

Criterios:
- "exact": mismo producto, mismas especificaciones
- "same_model": mismo modelo pero puede diferir en variante (color,容量)
- "equivalent": producto equivalente que cumple la misma función
- "similar": relacionado pero no es el mismo producto
- "not_match": completamente diferente

Si hay información faltante, indícalo en missingInformation.
Si hay riesgos (ej: estado Used vs New), indícalo en risks.`;

  const user = `Evalúa si este candidato es el mismo producto que el producto fuente.

CANDIDATO_ID: ${candidate.id?.rawId ?? "desconocido"}
CANDIDATO_TÍTULO: ${candidate.title ?? "sin título"}

Responde con el JSON del esquema de matching.`;

  return { system, user };
}
