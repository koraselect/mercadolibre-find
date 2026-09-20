import { z } from "zod";

/**
 * Schema Zod del fingerprint de producto (TODO §10, §41).
 * Es la salida normalizada de Gemini que describe qué producto es,
 * qué lo define y qué busca. Todo JSON de IA se valida aquí.
 */

export const FINGERPRINT_IMPORTANCE = ["critical", "important", "optional"] as const;
export type FingerprintImportance = (typeof FINGERPRINT_IMPORTANCE)[number];

export const keySpec = z.object({
  name: z.string().min(1).max(100),
  value: z.string().min(1).max(200),
  importance: z.enum(FINGERPRINT_IMPORTANCE),
});
export type KeySpec = z.infer<typeof keySpec>;

export const fingerprintSchema = z
  .object({
    canonicalName: z.string().min(1).max(200),
    productType: z.string().min(1).max(100),
    brand: z.string().max(100).nullish(),
    model: z.string().max(100).nullish(),
    identifiers: z.array(z.string().min(1).max(100)).default([]),
    category: z.string().max(120).nullish(),
    keySpecifications: z.array(keySpec).max(40).default([]),
    variants: z
      .array(
        z.object({
          name: z.string().min(1).max(60),
          value: z.string().min(1).max(120),
        })
      )
      .max(30)
      .default([]),
    searchQueries: z.array(z.string().min(2).max(160)).min(1).max(10),
    mustMatch: z.array(z.string().min(1).max(120)).max(20).default([]),
    acceptableDifferences: z.array(z.string().min(1).max(120)).max(20).default([]),
    disqualifiers: z.array(z.string().min(1).max(120)).max(20).default([]),
  })
  .strict();

export type ProductFingerprint = z.infer<typeof fingerprintSchema>;

/** Descripción del esquema para los prompts (fuente única de verdad). */
export const FINGERPRINT_SCHEMA_DOC = `{
  "canonicalName": string,        // nombre canonico del producto
  "productType": string,          // tipo de producto generico
  "brand": string | null,
  "model": string | null,
  "identifiers": string[],        // modelo/MPN/GTIN/EAN si existen
  "category": string | null,
  "keySpecifications": [ { "name": string, "value": string, "importance": "critical" | "important" | "optional" } ],
  "variants": [ { "name": string, "value": string } ],   // variantes del mismo producto (color, talle, etc.)
  "searchQueries": string[],      // 3 a 8 consultas de busqueda en espanol
  "mustMatch": string[],          // caracteristicas que DEBEN coincidir
  "acceptableDifferences": string[], // diferencias tolerables (misma funcion)
  "disqualifiers": string[]       // indicadores de que NO es este producto
}`;
