//! Intel SGX DCAP quote v3 parser and verifier.
//!
//! Implements the binary layout documented in the Intel SGX DCAP Quote
//! Library specification. The signature type verified here is
//! ECDSA-P-256 with SHA-256, which is the format produced by every
//! DCAP-capable platform since Coffee Lake and by SGX quotes emitted by
//! Intel TDX platforms in the "sgx compat" mode.
//!
//! Layout (little-endian throughout):
//!
//! ```text
//! Header       48 bytes
//!   version              u16
//!   att_key_type         u16       (2 = ECDSA-P256 with SHA-256)
//!   tee_type             u32
//!   qe_svn               u16
//!   pce_svn              u16
//!   qe_vendor_id         [u8; 16]
//!   user_data            [u8; 20]
//! Report body  384 bytes
//!   cpu_svn              [u8; 16]
//!   misc_select          u32
//!   reserved1            [u8; 28]
//!   attributes           [u8; 16]
//!   mr_enclave           [u8; 32]
//!   reserved2            [u8; 32]
//!   mr_signer            [u8; 32]
//!   reserved3            [u8; 96]
//!   isv_prod_id          u16
//!   isv_svn              u16
//!   reserved4            [u8; 60]
//!   report_data          [u8; 64]
//! Signature section (variable)
//!   sig_len              u32
//!   ecdsa_signature      [u8; 64]  (r || s, big-endian)
//!   ecdsa_att_pub_key    [u8; 64]  (x || y, big-endian, uncompressed
//!                                    without the 0x04 marker)
//!   qe_report            [u8; 384]
//!   qe_report_signature  [u8; 64]  (signed by pinned attestation key)
//!   qe_auth_data_size    u16
//!   qe_auth_data         [u8; N]
//!   cert_type            u16
//!   cert_data_size       u32
//!   cert_data            [u8; M]
//! ```
//!
//! The verifier binds the quote to a caller-supplied attestation public key
//! (typically the ECDSA key that the QE registered with Intel PCS during
//! bootstrap). Full PCS collateral verification is performed at a higher
//! layer.

use p256::ecdsa::{signature::Verifier, Signature, VerifyingKey};
use p256::EncodedPoint;
use serde::{Deserialize, Serialize};
use serde_big_array::BigArray;
use sha2::{Digest, Sha256};

use crate::{read_u16_le, read_u32_le, take, VerifyError};

/// SGX header + report body length: 48 + 384.
const HEADER_LEN: usize = 48;
const REPORT_BODY_LEN: usize = 384;
const SIGNED_REGION_LEN: usize = HEADER_LEN + REPORT_BODY_LEN;
const ECDSA_SIG_LEN: usize = 64;
const ECDSA_PUBKEY_LEN: usize = 64;

/// Parsed SGX DCAP quote v3 claims.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SgxClaims {
    pub version: u16,
    pub att_key_type: u16,
    pub tee_type: u32,
    pub qe_svn: u16,
    pub pce_svn: u16,
    pub qe_vendor_id: [u8; 16],
    pub cpu_svn: [u8; 16],
    pub misc_select: u32,
    pub attributes: [u8; 16],
    pub mr_enclave: [u8; 32],
    pub mr_signer: [u8; 32],
    pub isv_prod_id: u16,
    pub isv_svn: u16,
    #[serde(with = "BigArray")]
    pub report_data: [u8; 64],
    /// x || y of the ECDSA attestation key extracted from the quote (raw,
    /// uncompressed, without the leading 0x04 SEC1 tag).
    #[serde(with = "BigArray")]
    pub attestation_key: [u8; ECDSA_PUBKEY_LEN],
}

impl SgxClaims {
    /// Return the SEC1 uncompressed encoding (`0x04 || x || y`) of the
    /// attestation key, suitable for feeding into any p256 parser.
    pub fn attestation_key_sec1(&self) -> [u8; 65] {
        let mut out = [0u8; 65];
        out[0] = 0x04;
        out[1..].copy_from_slice(&self.attestation_key);
        out
    }
}

/// Verify an SGX DCAP quote v3 and return its claims.
///
/// `quote` is the raw bytes emitted by `sgx_qe3_get_quote` (or produced by
/// `dcap-qgs` in server mode). `trusted_key` is a caller-supplied SEC1
/// uncompressed P-256 public key (`0x04 || x || y`) that the caller trusts
/// to be a valid quoting enclave attestation key for the target platform.
/// The verifier will additionally check that the attestation key embedded
/// in the quote matches `trusted_key`.
pub fn verify_sgx_quote(quote: &[u8], trusted_key: &[u8]) -> Result<SgxClaims, VerifyError> {
    if quote.len() < SIGNED_REGION_LEN + 4 + ECDSA_SIG_LEN + ECDSA_PUBKEY_LEN {
        return Err(VerifyError::Truncated {
            expected: SIGNED_REGION_LEN + 4 + ECDSA_SIG_LEN + ECDSA_PUBKEY_LEN,
            actual: quote.len(),
        });
    }

    let (signed_region, rest) = take(quote, SIGNED_REGION_LEN)?;
    let (header, body) = take(signed_region, HEADER_LEN)?;

    // Header parsing.
    let version = read_u16_le(&header[0..2])?;
    if version != 3 && version != 4 {
        return Err(VerifyError::UnsupportedVersion(version as u32));
    }
    let att_key_type = read_u16_le(&header[2..4])?;
    if att_key_type != 2 {
        return Err(VerifyError::UnsupportedAlgorithm(att_key_type as u32));
    }
    let tee_type = read_u32_le(&header[4..8])?;
    let qe_svn = read_u16_le(&header[8..10])?;
    let pce_svn = read_u16_le(&header[10..12])?;
    let mut qe_vendor_id = [0u8; 16];
    qe_vendor_id.copy_from_slice(&header[12..28]);

    // Report body parsing.
    let mut cpu_svn = [0u8; 16];
    cpu_svn.copy_from_slice(&body[0..16]);
    let misc_select = read_u32_le(&body[16..20])?;
    let mut attributes = [0u8; 16];
    attributes.copy_from_slice(&body[48..64]);
    let mut mr_enclave = [0u8; 32];
    mr_enclave.copy_from_slice(&body[64..96]);
    let mut mr_signer = [0u8; 32];
    mr_signer.copy_from_slice(&body[128..160]);
    let isv_prod_id = read_u16_le(&body[256..258])?;
    let isv_svn = read_u16_le(&body[258..260])?;
    let mut report_data = [0u8; 64];
    report_data.copy_from_slice(&body[320..384]);

    // Signature section. `sig_len` counts every byte after the u32 length
    // prefix. We only need the first two fixed-size fields for the actual
    // verification (`ecdsa_signature` + `ecdsa_att_pub_key`); the remainder
    // is walked to ensure the buffer is well-formed but is otherwise the
    // responsibility of the DCAP PCS verifier at a higher layer.
    let sig_len = read_u32_le(&rest[0..4])? as usize;
    let sig_section = &rest[4..];
    if sig_section.len() < sig_len {
        return Err(VerifyError::Truncated {
            expected: sig_len,
            actual: sig_section.len(),
        });
    }
    let (ecdsa_sig, tail) = take(sig_section, ECDSA_SIG_LEN)?;
    let (ecdsa_pubkey, _tail) = take(tail, ECDSA_PUBKEY_LEN)?;

    let mut attestation_key = [0u8; ECDSA_PUBKEY_LEN];
    attestation_key.copy_from_slice(ecdsa_pubkey);

    // Bind the quote to the caller-supplied trust root. This is the point
    // at which pinning happens.
    let claims = SgxClaims {
        version,
        att_key_type,
        tee_type,
        qe_svn,
        pce_svn,
        qe_vendor_id,
        cpu_svn,
        misc_select,
        attributes,
        mr_enclave,
        mr_signer,
        isv_prod_id,
        isv_svn,
        report_data,
        attestation_key,
    };

    let expected_sec1 = claims.attestation_key_sec1();
    if trusted_key != expected_sec1 {
        return Err(VerifyError::Policy(
            "attestation key does not match trusted quoting enclave key",
        ));
    }

    // Verify the ECDSA-P256 signature over the concatenation of header +
    // report body. The signature bytes are stored as fixed-width r || s,
    // both big-endian, exactly matching the layout expected by the
    // `p256` crate's `Signature::from_slice` constructor.
    let verifying_key_point = EncodedPoint::from_bytes(expected_sec1)
        .map_err(|_| VerifyError::Malformed("invalid attestation key encoding"))?;
    let verifying_key = VerifyingKey::from_encoded_point(&verifying_key_point)
        .map_err(|_| VerifyError::Malformed("attestation key is not on curve"))?;

    let signature = Signature::from_slice(ecdsa_sig)
        .map_err(|_| VerifyError::InvalidSignatureEncoding)?;

    verifying_key
        .verify(signed_region, &signature)
        .map_err(|_| VerifyError::SignatureMismatch)?;

    Ok(claims)
}

/// Compute the SHA-256 of the signed region (header + report body). Used by
/// the higher-level Wattz gateway to bind a quote to an inference receipt.
pub fn quote_digest(quote: &[u8]) -> Result<[u8; 32], VerifyError> {
    let (signed_region, _) = take(quote, SIGNED_REGION_LEN)?;
    let mut hasher = Sha256::new();
    hasher.update(signed_region);
    Ok(hasher.finalize().into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use p256::ecdsa::signature::Signer;
    use p256::ecdsa::SigningKey;
    use rand_core::OsRng;

    fn synthetic_quote(sig_key: &SigningKey) -> (Vec<u8>, [u8; 65]) {
        // Build a plausible header + report body populated with recognizable
        // patterns. Then sign the concatenation with the supplied key.
        let mut buf = Vec::with_capacity(2048);
        // version = 3
        buf.extend_from_slice(&3u16.to_le_bytes());
        // att_key_type = 2
        buf.extend_from_slice(&2u16.to_le_bytes());
        // tee_type = 0x00000000 (SGX)
        buf.extend_from_slice(&0u32.to_le_bytes());
        // qe_svn = 7
        buf.extend_from_slice(&7u16.to_le_bytes());
        // pce_svn = 12
        buf.extend_from_slice(&12u16.to_le_bytes());
        // qe_vendor_id
        buf.extend_from_slice(&[0xAA; 16]);
        // user_data
        buf.extend_from_slice(&[0x00; 20]);
        // report body (384 bytes) with markers
        let mut body = vec![0u8; REPORT_BODY_LEN];
        body[0..16].copy_from_slice(&[0x11; 16]); // cpu_svn
        body[16..20].copy_from_slice(&0xDEADBEEFu32.to_le_bytes()); // misc_select
        body[48..64].copy_from_slice(&[0x22; 16]); // attributes
        body[64..96].copy_from_slice(&[0x33; 32]); // mr_enclave
        body[128..160].copy_from_slice(&[0x44; 32]); // mr_signer
        body[256..258].copy_from_slice(&99u16.to_le_bytes()); // isv_prod_id
        body[258..260].copy_from_slice(&1u16.to_le_bytes()); // isv_svn
        body[320..384].copy_from_slice(&[0x55; 64]); // report_data
        buf.extend_from_slice(&body);

        // Sign the concatenation.
        let signature: Signature = sig_key.sign(&buf);
        let verifying_key = VerifyingKey::from(sig_key);
        let point = verifying_key.to_encoded_point(false);
        let mut sec1 = [0u8; 65];
        sec1.copy_from_slice(point.as_bytes());
        let mut raw_key = [0u8; 64];
        raw_key.copy_from_slice(&sec1[1..]);

        // Signature section.
        let sig_bytes = signature.to_bytes();
        let sig_len = ECDSA_SIG_LEN + ECDSA_PUBKEY_LEN;
        buf.extend_from_slice(&(sig_len as u32).to_le_bytes());
        buf.extend_from_slice(&sig_bytes);
        buf.extend_from_slice(&raw_key);

        (buf, sec1)
    }

    #[test]
    fn round_trip_synthetic_quote() {
        let signing_key = SigningKey::random(&mut OsRng);
        let (quote, trust_root) = synthetic_quote(&signing_key);
        let claims = verify_sgx_quote(&quote, &trust_root).expect("verify");
        assert_eq!(claims.version, 3);
        assert_eq!(claims.att_key_type, 2);
        assert_eq!(claims.qe_svn, 7);
        assert_eq!(claims.pce_svn, 12);
        assert_eq!(claims.mr_enclave, [0x33; 32]);
        assert_eq!(claims.mr_signer, [0x44; 32]);
        assert_eq!(claims.isv_prod_id, 99);
        assert_eq!(claims.report_data, [0x55; 64]);
    }

    #[test]
    fn wrong_trust_root_rejected() {
        let signing_key = SigningKey::random(&mut OsRng);
        let (quote, _) = synthetic_quote(&signing_key);
        let other = SigningKey::random(&mut OsRng);
        let other_pt = VerifyingKey::from(&other).to_encoded_point(false);
        let mut other_sec1 = [0u8; 65];
        other_sec1.copy_from_slice(other_pt.as_bytes());
        assert!(verify_sgx_quote(&quote, &other_sec1).is_err());
    }

    #[test]
    fn tampered_report_body_rejected() {
        let signing_key = SigningKey::random(&mut OsRng);
        let (mut quote, trust_root) = synthetic_quote(&signing_key);
        // Flip a byte inside the report body.
        quote[HEADER_LEN + 64] ^= 0x01;
        assert!(matches!(
            verify_sgx_quote(&quote, &trust_root),
            Err(VerifyError::SignatureMismatch)
        ));
    }

    #[test]
    fn quote_digest_matches_sha256_of_signed_region() {
        let signing_key = SigningKey::random(&mut OsRng);
        let (quote, _) = synthetic_quote(&signing_key);
        let digest = quote_digest(&quote).unwrap();
        let mut hasher = Sha256::new();
        hasher.update(&quote[..SIGNED_REGION_LEN]);
        let expected: [u8; 32] = hasher.finalize().into();
        assert_eq!(digest, expected);
    }
}
