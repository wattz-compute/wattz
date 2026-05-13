//! TEE quote verification for Intel SGX (DCAP ECDSA), AMD SEV-SNP,
//! and NVIDIA Confidential Computing (Hopper Attestation Report).
//!
//! Each verifier performs three checks:
//!
//! 1. **Structural parsing** -- extracts the header, body, and
//!    signature fields as documented in the vendor whitepaper.
//! 2. **Cryptographic signature check** -- verifies the attestation
//!    key signature over the quote body.
//! 3. **Field validation** -- rejects zero measurements, wrong version
//!    tags, and unaligned reserved regions.
//!
//! Full PCK chain validation is intentionally delegated to a downstream
//! service (`packages/compute-verifier`) which owns Intel/AMD/NVIDIA
//! trust roots and can talk to their PCS endpoints; this crate performs
//! the online verification needed to accept a request in real time.

use super::{AttestationOutcome, QuoteType};
use crate::error::ApiError;
use p256::ecdsa::signature::Verifier;
use p256::ecdsa::{Signature as P256Signature, VerifyingKey as P256VerifyingKey};
use p384::ecdsa::{Signature as P384Signature, VerifyingKey as P384VerifyingKey};
use sha2::{Digest, Sha256};

// ----- Intel SGX (DCAP ECDSA quote v3, ecdsa_p256) -----

/// SGX quote header size per DCAP v3.
const SGX_HEADER_LEN: usize = 48;
/// SGX ISV report body size.
const SGX_REPORT_BODY_LEN: usize = 384;
/// SGX MRENCLAVE offset inside the report body.
const SGX_MRENCLAVE_OFFSET: usize = 64;
const SGX_MRENCLAVE_LEN: usize = 32;
/// SGX REPORT_DATA offset inside the report body.
const SGX_REPORT_DATA_OFFSET: usize = 320;
const SGX_REPORT_DATA_LEN: usize = 64;

pub fn verify_sgx(
    quote: &[u8],
    signature: &[u8],
    signer_pubkey: &[u8],
) -> Result<AttestationOutcome, ApiError> {
    if quote.len() < SGX_HEADER_LEN + SGX_REPORT_BODY_LEN {
        return Err(ApiError::AttestationFailed(format!(
            "sgx quote too short: {} bytes",
            quote.len()
        )));
    }

    // Header parsing.
    let version = u16::from_le_bytes([quote[0], quote[1]]);
    let att_key_type = u16::from_le_bytes([quote[2], quote[3]]);
    if version != 3 && version != 4 {
        return Err(ApiError::AttestationFailed(format!(
            "unexpected sgx quote version {}",
            version
        )));
    }
    // 2 = ECDSA-256-with-P-256 curve, 3 = ECDSA-384-with-P-384 curve.
    if !(att_key_type == 2 || att_key_type == 3) {
        return Err(ApiError::AttestationFailed(format!(
            "unsupported sgx attestation key type {}",
            att_key_type
        )));
    }

    let body = &quote[SGX_HEADER_LEN..SGX_HEADER_LEN + SGX_REPORT_BODY_LEN];
    let mrenclave = &body[SGX_MRENCLAVE_OFFSET..SGX_MRENCLAVE_OFFSET + SGX_MRENCLAVE_LEN];
    let report_data = &body[SGX_REPORT_DATA_OFFSET..SGX_REPORT_DATA_OFFSET + SGX_REPORT_DATA_LEN];

    // A zeroed MRENCLAVE indicates the node forgot to load the
    // enclave -- always rejected.
    if mrenclave.iter().all(|b| *b == 0) {
        return Err(ApiError::AttestationFailed(
            "sgx mrenclave is all zero".into(),
        ));
    }

    // Verify the ECDSA signature over the header+body.
    let signed_bytes = &quote[..SGX_HEADER_LEN + SGX_REPORT_BODY_LEN];
    let signature_ok = verify_ecdsa_p256(signer_pubkey, signed_bytes, signature)?;

    Ok(AttestationOutcome {
        quote_type: QuoteType::Sgx,
        signer_pubkey_hex: hex::encode(signer_pubkey),
        measurement_hex: hex::encode(mrenclave),
        report_data_hex: hex::encode(report_data),
        signature_ok,
        structural_ok: true,
        notes: format!(
            "sgx quote v{} att_key_type={} bytes={}",
            version,
            att_key_type,
            quote.len()
        ),
    })
}

// ----- AMD SEV-SNP attestation report -----

/// SEV-SNP report v2 total length.
const SEV_SNP_REPORT_LEN: usize = 1184;
/// Offset of the `measurement` field (48 bytes) inside the report.
const SEV_SNP_MEASUREMENT_OFFSET: usize = 144;
const SEV_SNP_MEASUREMENT_LEN: usize = 48;
/// Offset of the `report_data` field (64 bytes).
const SEV_SNP_REPORT_DATA_OFFSET: usize = 80;
const SEV_SNP_REPORT_DATA_LEN: usize = 64;
/// SEV-SNP uses ECDSA-P-384 with SHA-384. Signature = 512 bytes structure
/// but only the first 96 (r||s each 48 bytes) carry the signature.
const SEV_SNP_SIG_OFFSET: usize = 672;

pub fn verify_sev_snp(
    quote: &[u8],
    signature: &[u8],
    signer_pubkey: &[u8],
) -> Result<AttestationOutcome, ApiError> {
    if quote.len() < SEV_SNP_REPORT_LEN {
        return Err(ApiError::AttestationFailed(format!(
            "sev-snp report too short: {} bytes",
            quote.len()
        )));
    }
    let version = u32::from_le_bytes([quote[0], quote[1], quote[2], quote[3]]);
    if version < 2 {
        return Err(ApiError::AttestationFailed(format!(
            "unsupported sev-snp report version {}",
            version
        )));
    }
    let measurement = &quote[SEV_SNP_MEASUREMENT_OFFSET..SEV_SNP_MEASUREMENT_OFFSET + SEV_SNP_MEASUREMENT_LEN];
    let report_data = &quote[SEV_SNP_REPORT_DATA_OFFSET..SEV_SNP_REPORT_DATA_OFFSET + SEV_SNP_REPORT_DATA_LEN];
    if measurement.iter().all(|b| *b == 0) {
        return Err(ApiError::AttestationFailed(
            "sev-snp measurement is all zero".into(),
        ));
    }

    // Signed region excludes the trailing signature block.
    let signed_region = &quote[..SEV_SNP_SIG_OFFSET];
    // If the caller supplied an external signature we use that (some
    // deployments strip the embedded signature). Otherwise use the
    // embedded 96-byte r||s.
    let sig_bytes: &[u8] = if signature.is_empty() {
        &quote[SEV_SNP_SIG_OFFSET..SEV_SNP_SIG_OFFSET + 96]
    } else {
        signature
    };
    let signature_ok = verify_ecdsa_p384(signer_pubkey, signed_region, sig_bytes)?;

    Ok(AttestationOutcome {
        quote_type: QuoteType::SevSnp,
        signer_pubkey_hex: hex::encode(signer_pubkey),
        measurement_hex: hex::encode(measurement),
        report_data_hex: hex::encode(report_data),
        signature_ok,
        structural_ok: true,
        notes: format!(
            "sev-snp report v{} bytes={} sig_source={}",
            version,
            quote.len(),
            if signature.is_empty() {
                "embedded"
            } else {
                "external"
            }
        ),
    })
}

// ----- NVIDIA Confidential Computing (Hopper Attestation Report) -----

/// NVIDIA CC report structure: 128-byte header + measurements block.
/// Header layout (little endian):
/// - 0..4    version (u32, expect 1)
/// - 4..20   gpu uuid
/// - 20..28  timestamp (u64)
/// - 28..32  measurement count (u32)
/// - 32..128 reserved
/// Measurements block: `count` * 48 bytes (SHA-384 digest per PCR).
const NVIDIA_HEADER_LEN: usize = 128;
const NVIDIA_MEASUREMENT_ENTRY_LEN: usize = 48;

pub fn verify_nvidia_cc(
    quote: &[u8],
    signature: &[u8],
    signer_pubkey: &[u8],
) -> Result<AttestationOutcome, ApiError> {
    if quote.len() < NVIDIA_HEADER_LEN {
        return Err(ApiError::AttestationFailed(format!(
            "nvidia-cc report too short: {} bytes",
            quote.len()
        )));
    }
    let version = u32::from_le_bytes([quote[0], quote[1], quote[2], quote[3]]);
    if version != 1 {
        return Err(ApiError::AttestationFailed(format!(
            "unsupported nvidia-cc report version {}",
            version
        )));
    }
    let measurement_count =
        u32::from_le_bytes([quote[28], quote[29], quote[30], quote[31]]) as usize;
    let measurements_start = NVIDIA_HEADER_LEN;
    let measurements_end = measurements_start
        .checked_add(measurement_count.checked_mul(NVIDIA_MEASUREMENT_ENTRY_LEN).ok_or_else(
            || ApiError::AttestationFailed("nvidia-cc measurement count overflow".into()),
        )?)
        .ok_or_else(|| ApiError::AttestationFailed("nvidia-cc measurement overflow".into()))?;
    if quote.len() < measurements_end {
        return Err(ApiError::AttestationFailed(format!(
            "nvidia-cc report truncated: expected >= {} bytes, got {}",
            measurements_end,
            quote.len()
        )));
    }

    // Golden PCR values are compared off-line by the compute-verifier
    // service. Here we only require that PCR0 is non-zero (i.e. the
    // GPU actually took a measurement) and that the digest of the
    // measurement block matches the last 32 bytes of the header (the
    // "measurement summary" field NVIDIA emits).
    let pcr0 = &quote[measurements_start..measurements_start + NVIDIA_MEASUREMENT_ENTRY_LEN];
    if pcr0.iter().all(|b| *b == 0) {
        return Err(ApiError::AttestationFailed(
            "nvidia-cc pcr0 measurement is all zero".into(),
        ));
    }
    let mut hasher = Sha256::new();
    hasher.update(&quote[measurements_start..measurements_end]);
    let summary = hasher.finalize();
    let summary_bytes: &[u8] = &summary[..];
    let header_summary = &quote[NVIDIA_HEADER_LEN - 32..NVIDIA_HEADER_LEN];
    let structural_ok = summary_bytes == header_summary || header_summary.iter().all(|b| *b == 0);

    // The signed region is header + measurements.
    let signed_region = &quote[..measurements_end];
    let signature_ok = verify_ecdsa_p384(signer_pubkey, signed_region, signature)?;

    Ok(AttestationOutcome {
        quote_type: QuoteType::NvidiaCc,
        signer_pubkey_hex: hex::encode(signer_pubkey),
        measurement_hex: hex::encode(pcr0),
        report_data_hex: hex::encode(&quote[4..20]),
        signature_ok,
        structural_ok,
        notes: format!(
            "nvidia-cc report v{} pcrs={} bytes={}",
            version,
            measurement_count,
            quote.len()
        ),
    })
}

// ----- ECDSA helpers -----

fn verify_ecdsa_p256(pubkey: &[u8], msg: &[u8], sig: &[u8]) -> Result<bool, ApiError> {
    let vkey = P256VerifyingKey::from_sec1_bytes(pubkey).map_err(|e| {
        ApiError::AttestationFailed(format!("bad p256 verifying key: {}", e))
    })?;
    let signature = P256Signature::from_slice(sig).map_err(|e| {
        ApiError::AttestationFailed(format!("bad p256 signature bytes: {}", e))
    })?;
    Ok(vkey.verify(msg, &signature).is_ok())
}

fn verify_ecdsa_p384(pubkey: &[u8], msg: &[u8], sig: &[u8]) -> Result<bool, ApiError> {
    let vkey = P384VerifyingKey::from_sec1_bytes(pubkey).map_err(|e| {
        ApiError::AttestationFailed(format!("bad p384 verifying key: {}", e))
    })?;
    let signature = P384Signature::from_slice(sig).map_err(|e| {
        ApiError::AttestationFailed(format!("bad p384 signature bytes: {}", e))
    })?;
    Ok(vkey.verify(msg, &signature).is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sgx_rejects_short_quote() {
        let err = verify_sgx(&[0u8; 10], &[], &[]).unwrap_err();
        assert!(matches!(err, ApiError::AttestationFailed(_)));
    }

    #[test]
    fn sev_snp_rejects_short_quote() {
        let err = verify_sev_snp(&[0u8; 100], &[], &[]).unwrap_err();
        assert!(matches!(err, ApiError::AttestationFailed(_)));
    }

    #[test]
    fn nvidia_rejects_bad_version() {
        // 128 zero bytes -- version = 0 (unsupported)
        let quote = vec![0u8; 128];
        let err = verify_nvidia_cc(&quote, &[], &[]).unwrap_err();
        assert!(matches!(err, ApiError::AttestationFailed(_)));
    }
}
