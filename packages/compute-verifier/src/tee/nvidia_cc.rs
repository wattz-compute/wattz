//! NVIDIA Confidential Computing GPU attestation parser and verifier.
//!
//! NVIDIA's `nvattest` tool emits a signed evidence bundle for Hopper (H100)
//! and Blackwell GPUs running in confidential mode. The format used here
//! mirrors the "RIM" (Reference Integrity Manifest) v1 layout that the
//! NVIDIA Verifier SDK consumes; the signature is ECDSA-P-256 with SHA-256
//! over the fixed header + measurement bundle, produced by the NVIDIA
//! Reference Endorsement Key (REK).
//!
//! Layout (little-endian throughout):
//!
//! ```text
//! magic                [u8; 8]   b"NVCCATT1"
//! version              u32       currently 1
//! gpu_arch             u32       0x9 = Hopper, 0xA = Blackwell
//! nonce                [u8; 32]  request nonce echoed back
//! measurement          [u8; 48]  SHA-384 of firmware + runtime state
//! driver_version       u32
//! vbios_version        u32
//! attestation_svn      u32
//! fw_id                [u8; 32]
//! device_id            [u8; 16]
//! signature            [u8; 64]  P-256 ECDSA r || s big-endian
//! ```

use p256::ecdsa::{signature::Verifier, Signature, VerifyingKey};
use p256::EncodedPoint;
use serde::{Deserialize, Serialize};
use serde_big_array::BigArray;

use crate::{read_u32_le, take, VerifyError};

const MAGIC: &[u8; 8] = b"NVCCATT1";
const HEADER_LEN: usize = 8 + 4 + 4 + 32 + 48 + 4 + 4 + 4 + 32 + 16;
const SIG_LEN: usize = 64;
const REPORT_LEN: usize = HEADER_LEN + SIG_LEN;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct NvidiaCcClaims {
    pub version: u32,
    pub gpu_arch: u32,
    pub nonce: [u8; 32],
    #[serde(with = "BigArray")]
    pub measurement: [u8; 48],
    pub driver_version: u32,
    pub vbios_version: u32,
    pub attestation_svn: u32,
    pub fw_id: [u8; 32],
    pub device_id: [u8; 16],
}

/// Verify an NVIDIA Confidential Computing GPU attestation quote against a
/// pinned Reference Endorsement Key.
pub fn verify_nvidia_cc_quote(
    quote: &[u8],
    rek_sec1: &[u8],
    expected_nonce: &[u8; 32],
) -> Result<NvidiaCcClaims, VerifyError> {
    if quote.len() < REPORT_LEN {
        return Err(VerifyError::Truncated {
            expected: REPORT_LEN,
            actual: quote.len(),
        });
    }
    let (header, sig_bytes) = take(quote, HEADER_LEN)?;
    let (magic, rest) = take(header, 8)?;
    if magic != MAGIC {
        return Err(VerifyError::Malformed("bad magic"));
    }
    let version = read_u32_le(&rest[0..4])?;
    if version != 1 {
        return Err(VerifyError::UnsupportedVersion(version));
    }
    let gpu_arch = read_u32_le(&rest[4..8])?;
    let mut nonce = [0u8; 32];
    nonce.copy_from_slice(&rest[8..40]);
    if &nonce != expected_nonce {
        return Err(VerifyError::Policy("nonce mismatch"));
    }
    let mut measurement = [0u8; 48];
    measurement.copy_from_slice(&rest[40..88]);
    let driver_version = read_u32_le(&rest[88..92])?;
    let vbios_version = read_u32_le(&rest[92..96])?;
    let attestation_svn = read_u32_le(&rest[96..100])?;
    let mut fw_id = [0u8; 32];
    fw_id.copy_from_slice(&rest[100..132]);
    let mut device_id = [0u8; 16];
    device_id.copy_from_slice(&rest[132..148]);

    let point = EncodedPoint::from_bytes(rek_sec1)
        .map_err(|_| VerifyError::Malformed("invalid REK encoding"))?;
    let verifying_key = VerifyingKey::from_encoded_point(&point)
        .map_err(|_| VerifyError::Malformed("REK not on curve"))?;
    let signature = Signature::from_slice(&sig_bytes[..SIG_LEN])
        .map_err(|_| VerifyError::InvalidSignatureEncoding)?;
    verifying_key
        .verify(header, &signature)
        .map_err(|_| VerifyError::SignatureMismatch)?;

    Ok(NvidiaCcClaims {
        version,
        gpu_arch,
        nonce,
        measurement,
        driver_version,
        vbios_version,
        attestation_svn,
        fw_id,
        device_id,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use p256::ecdsa::signature::Signer;
    use p256::ecdsa::SigningKey;
    use rand_core::OsRng;

    fn synthetic_quote(sig_key: &SigningKey, nonce: &[u8; 32]) -> (Vec<u8>, [u8; 65]) {
        let mut header = Vec::with_capacity(HEADER_LEN);
        header.extend_from_slice(MAGIC);
        header.extend_from_slice(&1u32.to_le_bytes());
        header.extend_from_slice(&0x9u32.to_le_bytes());
        header.extend_from_slice(nonce);
        header.extend_from_slice(&[0x66; 48]); // measurement
        header.extend_from_slice(&0x00_00_02_58u32.to_le_bytes()); // driver_version
        header.extend_from_slice(&0x00_00_00_2Au32.to_le_bytes()); // vbios_version
        header.extend_from_slice(&3u32.to_le_bytes()); // attestation_svn
        header.extend_from_slice(&[0xAB; 32]); // fw_id
        header.extend_from_slice(&[0xCD; 16]); // device_id
        assert_eq!(header.len(), HEADER_LEN);

        let signature: Signature = sig_key.sign(&header);
        let mut quote = header.clone();
        quote.extend_from_slice(&signature.to_bytes());

        let vk = VerifyingKey::from(sig_key);
        let pt = vk.to_encoded_point(false);
        let mut sec1 = [0u8; 65];
        sec1.copy_from_slice(pt.as_bytes());
        (quote, sec1)
    }

    #[test]
    fn round_trip_synthetic_quote() {
        let signing_key = SigningKey::random(&mut OsRng);
        let nonce = [0x77u8; 32];
        let (quote, sec1) = synthetic_quote(&signing_key, &nonce);
        let claims = verify_nvidia_cc_quote(&quote, &sec1, &nonce).expect("verify");
        assert_eq!(claims.gpu_arch, 0x9);
        assert_eq!(claims.attestation_svn, 3);
        assert_eq!(claims.measurement, [0x66; 48]);
    }

    #[test]
    fn wrong_nonce_rejected() {
        let signing_key = SigningKey::random(&mut OsRng);
        let (quote, sec1) = synthetic_quote(&signing_key, &[0x77; 32]);
        let other_nonce = [0x00u8; 32];
        assert!(matches!(
            verify_nvidia_cc_quote(&quote, &sec1, &other_nonce),
            Err(VerifyError::Policy(_))
        ));
    }
}
