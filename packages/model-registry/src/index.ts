/**
 * @wattz/model-registry public surface.
 */

export {
  ModelEntry,
  LicenseFacts,
  LicenseId,
} from "./schema.js";
export type {
  ModelEntry as ModelEntryValue,
  LicenseFacts as LicenseFactsValue,
  LicenseId as LicenseIdValue,
} from "./schema.js";

export {
  lookupLicense,
  normaliseLicense,
  isKycRequired,
  type FetchFn,
  type LookupOptions,
} from "./licenses.js";

export {
  checkKyc,
  type KycAttestation,
  type KycDecision,
  type KycGateContext,
} from "./kyc.js";

export {
  MODEL_ENTRY_SEED,
  deriveModelEntryPda,
  publishModelEntry,
  type PublishParams,
} from "./publish.js";
