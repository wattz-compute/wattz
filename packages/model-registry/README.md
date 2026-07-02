# @wattz/model-registry

Model + license catalogue used by the Wattz inference gateway and the CLI.
It resolves the upstream license for a model, decides whether a caller must
clear KYC before the model can be routed, and derives / publishes the
on-chain `ModelEntry` PDA on Solana devnet.

License enforcement is data, not marketing: the gateway checks
`isKycRequired` before it forwards a request, and the Anchor program refuses
to settle a receipt for a gated model unless the caller presents a KYC
attestation.

## Install

```bash
pnpm add @wattz/model-registry
```

## License lookup

`lookupLicense` maps a Hugging Face repo id (or a raw SPDX / vendor tag) to a
normalised `LicenseFacts` record.

```ts
import { lookupLicense, isKycRequired } from '@wattz/model-registry';

const facts = await lookupLicense('meta-llama/Meta-Llama-3.1-8B-Instruct');
// facts.id            -> 'meta-llama-3'
// facts.commercial    -> true
// facts.kycThreshold  -> monthly-active-user cap that flips KYC on

if (isKycRequired(facts)) {
  // route only to callers that carry a KYC attestation
}
```

## KYC gating

```ts
import { checkKyc } from '@wattz/model-registry';

const decision = checkKyc({
  license: facts,
  attestation: callerAttestation, // signed "cleared for license class N"
});

if (!decision.allowed) {
  throw new Error(decision.reason);
}
```

## On-chain model entry (devnet)

```ts
import { deriveModelEntryPda, publishModelEntry } from '@wattz/model-registry';

const [pda] = deriveModelEntryPda(programId, 'llama-3.1-8b-instant');

await publishModelEntry({
  connection,
  payer,
  modelId: 'llama-3.1-8b-instant',
  license: facts,
  pricePer1kTokens: 0,
});
```

The program id is the devnet marketplace program
[`GUDVbE4Jgmtu8jgxUVtq2wUmjdLxJzPqT3zET2EdTLiU`](https://explorer.solana.com/address/GUDVbE4Jgmtu8jgxUVtq2wUmjdLxJzPqT3zET2EdTLiU?cluster=devnet).

## Public surface

| Export | Purpose |
|--------|---------|
| `lookupLicense`, `normaliseLicense` | Resolve / canonicalise a model license. |
| `isKycRequired`, `checkKyc` | Decide whether a caller may use a licensed model. |
| `deriveModelEntryPda`, `publishModelEntry`, `MODEL_ENTRY_SEED` | Read / write the on-chain model entry. |
| `ModelEntry`, `LicenseFacts`, `LicenseId` | Zod-backed types. |

## License

Apache-2.0.
