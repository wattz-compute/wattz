# wattz-compute-verifier

TEE attestation and zero-knowledge receipt verification for the Wattz
inference marketplace.

Two families of evidence are supported.

- TEE attestation
  - Intel SGX DCAP v3 / v4 quotes (`tee::sgx`).
  - AMD SEV-SNP guest attestation reports (`tee::sev`).
  - NVIDIA Confidential Computing GPU attestation quotes (`tee::nvidia_cc`).
- Zero-knowledge receipts
  - Risc0 zkVM segment receipts (`zk::risc0`).
  - Succinct SP1 Groth16 / Plonk proofs (`zk::sp1`).

Each entry point parses the wire format prescribed by the vendor
specification, extracts the measurement / journal / public inputs, and
verifies the embedded ECDSA / EdDSA signature against a caller-supplied
trusted attestation key.

Full trust-chain verification (Intel PCS collateral fetch, AMD ARK/ASK
root pinning, NVIDIA verifier certificates) is left to a higher layer.
The Wattz inference gateway performs pinning during node bootstrap and
supplies the trust root to this crate at attestation time. This split
mirrors the design used by cloud confidential computing SDKs.

## API

```rust
use wattz_compute_verifier::{
    verify_sgx_quote,
    verify_sev_snp_report,
    verify_nvidia_cc_quote,
    verify_risc0_receipt,
    verify_sp1_proof,
};
```

## Build

```
cargo check -p wattz-compute-verifier
cargo test  -p wattz-compute-verifier
```
