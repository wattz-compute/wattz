/**
 * Wattz model registry schema.
 *
 * Every model registered on-chain has a matching zod schema here. The
 * schema is the shared contract between the licensing scraper, the
 * publish pipeline, and the KYC gate.
 */

import { z } from "zod";

/**
 * Supported license identifiers. Any license we do not recognise is
 * captured as `custom` and requires manual review before the model can
 * be published.
 */
export const LicenseId = z.enum([
  "apache-2.0",
  "mit",
  "bsd-3-clause",
  "creativeml-openrail-m",
  "llama-3-community",
  "llama-2-community",
  "gemma-terms-of-use",
  "mistral-ai-research",
  "mistral-ai-non-production",
  "cc-by-4.0",
  "cc-by-nc-4.0",
  "cc-by-sa-4.0",
  "cc0-1.0",
  "openrail",
  "openrail-plus-plus",
  "custom",
]);
export type LicenseId = z.infer<typeof LicenseId>;

/**
 * A model registry entry. Mirrors the account structure the Wattz
 * Anchor program uses for its `ModelEntry` PDA.
 */
export const ModelEntry = z.object({
  /** Stable identifier used by the routing engine and OpenAI SDK. */
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/i, "id must be url-safe"),
  displayName: z.string().min(1).max(120),
  family: z.enum(["llama", "mistral", "gemma", "phi", "qwen", "stable-diffusion", "whisper", "custom"]),
  /** Semantic version of the weights. */
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  license: LicenseId,
  /** URL to the canonical license text. */
  licenseUrl: z.string().url(),
  /** Where the weights can be fetched. Typically `huggingface.co/...`. */
  weightsUrl: z.string().url(),
  weightsSha256: z.string().regex(/^[0-9a-f]{64}$/i, "sha256 hex digest expected"),
  contextWindow: z.number().int().positive(),
  vramMib: z.number().int().nonnegative(),
  price: z.object({
    inputPer1kMicros: z.number().int().nonnegative(),
    outputPer1kMicros: z.number().int().nonnegative(),
    sessionMicros: z.number().int().nonnegative(),
  }),
  /** True if the license requires commercial-use KYC. */
  kycRequired: z.boolean(),
  /** Metadata (arbitrary key/value string map). Bound to 32 entries. */
  metadata: z.record(z.string(), z.string()).refine(
    (m) => Object.keys(m).length <= 32,
    "metadata cannot exceed 32 entries",
  ),
  publishedBy: z.string().min(32).max(44),
  publishedAtUnix: z.number().int().nonnegative(),
});
export type ModelEntry = z.infer<typeof ModelEntry>;

/** Result of a license lookup on HuggingFace / Meta / Mistral. */
export const LicenseFacts = z.object({
  license: LicenseId,
  licenseUrl: z.string().url(),
  weightsUrl: z.string().url(),
  weightsSha256: z.string().regex(/^[0-9a-f]{64}$/i).optional(),
  displayName: z.string(),
  contextWindow: z.number().int().positive().optional(),
  vramMib: z.number().int().nonnegative().optional(),
  kycRequired: z.boolean(),
});
export type LicenseFacts = z.infer<typeof LicenseFacts>;
