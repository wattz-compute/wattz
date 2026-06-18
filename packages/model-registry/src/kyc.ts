/**
 * KYC gating for licensed model access.
 *
 * A model whose license mandates commercial-use KYC (Llama 3 community,
 * Mistral research, Gemma, custom) can only be routed to callers with a
 * valid `KycAttestation`. The gate is called by the inference gateway
 * before it forwards the request to the node runtime.
 */

import type { LicenseId } from "./schema.js";
import { isKycRequired } from "./licenses.js";

/** Result of a KYC check performed by an external provider. */
export interface KycAttestation {
  /** Wallet address the attestation covers. */
  wallet: string;
  /** Provider id (`sumsub`, `persona`, `synaps`). */
  provider: string;
  /** Level the attestation certifies (`individual`, `institution`). */
  level: "individual" | "institution";
  /** Signed at unix seconds. */
  signedAtUnix: number;
  /** Expires at unix seconds. Attestations older than 12 months are
   *  automatically rejected in `checkKyc`. */
  expiresAtUnix: number;
  /** Provider-supplied signature (base64 or hex). Used out-of-band for
   *  audit trails but not verified here -- verification is the
   *  responsibility of the inference gateway. */
  signature: string;
}

export interface KycGateContext {
  license: LicenseId;
  /** ISO 3166-1 alpha-2 country code of the caller. Used for
   *  jurisdiction-based blocks (e.g. Meta Llama 3 requires 700M MAU
   *  disclosure for very large operators; commonly not required per-user
   *  but required for the marketplace operator). */
  callerCountry?: string;
  /** Free-form purpose declared by the caller (`personal`, `commercial`,
   *  `research`). */
  purpose?: "personal" | "commercial" | "research";
}

export type KycDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Determine whether a caller can use a model given its license and the
 * attestation the caller supplied.
 */
export function checkKyc(
  ctx: KycGateContext,
  attestation: KycAttestation | null | undefined,
): KycDecision {
  if (!isKycRequired(ctx.license)) return { allowed: true };
  if (!attestation) {
    return {
      allowed: false,
      reason: `license "${ctx.license}" requires a KYC attestation`,
    };
  }
  const now = Math.floor(Date.now() / 1000);
  if (attestation.expiresAtUnix <= now) {
    return { allowed: false, reason: "attestation expired" };
  }
  if (now - attestation.signedAtUnix > 60 * 60 * 24 * 365) {
    return { allowed: false, reason: "attestation older than 12 months" };
  }
  // License-specific policy rules.
  switch (ctx.license) {
    case "mistral-ai-research":
      if (ctx.purpose === "commercial") {
        return {
          allowed: false,
          reason:
            "Mistral Research License forbids commercial use; upgrade to Mistral Commercial License",
        };
      }
      break;
    case "gemma-terms-of-use":
      // Gemma requires acceptance of Google's terms; the attestation
      // provider is expected to have recorded the acceptance.
      break;
    case "llama-3-community":
      // Meta requires the operator (not the individual caller) to have
      // fewer than 700M MAU. That's a per-marketplace concern; the
      // Wattz operator dashboard tracks it and exposes it via the CLI.
      break;
    default:
      break;
  }
  return { allowed: true };
}
