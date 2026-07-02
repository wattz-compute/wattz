//! AMD SEV-SNP attestation report parser and verifier.
//!
//! Implements the layout defined in the "AMD SEV-SNP Guest Attestation ABI"
//! (AMD publication 56860). A SEV-SNP guest asks the PSP to sign a 1184-byte
//! attestation report and returns it to the caller. The report is signed
//! with ECDSA-P-384 with SHA-384 by the Versioned Chip Endorsement Key
//! (VCEK). The signature covers bytes `[0, 0x2A0)` of the report.
//!
//! Layout (little-endian throughout):
//!
//! ```text
//! version              u32     off 0x000
//! guest_svn            u32     off 0x004
//! policy               u64     off 0x008
//! family_id            [u8;16] off 0x010
//! image_id             [u8;16] off 0x020
//! vmpl                 u32     off 0x030
//! signature_algo       u32     off 0x034
//! current_tcb          u64     off 0x038
//! platform_info        u64     off 0x040
//! author_key_en        u32     off 0x048
//! _reserved0           u32     off 0x04C
//! report_data          [u8;64] off 0x050
//! measurement          [u8;48] off 0x090
//! host_data            [u8;32] off 0x0C0
//! id_key_digest        [u8;48] off 0x0E0
//! author_key_digest    [u8;48] off 0x110
//! report_id            [u8;32] off 0x140
//! report_id_ma         [u8;32] off 0x160
//! reported_tcb         u64     off 0x180
//! _reserved1           [u8;24] off 0x188
//! chip_id              [u8;64] off 0x1A0
//! committed_tcb        u64     off 0x1E0
//! current_build        u8      off 0x1E8
//! current_minor        u8      off 0x1E9
//! current_major        u8      off 0x1EA
//! _reserved2           u8      off 0x1EB
//! committed_build      u8      off 0x1EC
//! committed_minor      u8      off 0x1ED
//! committed_major      u8      off 0x1EE
//! _reserved3           u8      off 0x1EF
//! launch_tcb           u64     off 0x1F0
//! _reserved4           [u8;168] off 0x1F8
//! signature            [u8;512] off 0x2A0   (r || s, both P-384 big-endian
//!                                            padded to 72 bytes with zeros)
//! ```

use p384::ecdsa::{signature::Verifier, Signature, VerifyingKey};
use p384::EncodedPoint;
use serde::{Deserialize, Serialize};
use serde_big_array::BigArray;

use crate::{read_u32_le, read_u64_le, take, VerifyError};

const SIGNED_REGION_LEN: usize = 0x2A0;
const REPORT_LEN: usize = 0x4A0;
const SIG_ALGO_ECDSA_P384_SHA384: u32 = 1;

/// Parsed SEV-SNP attestation report claims.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SevSnpClaims {
    pub version: u32,
    pub guest_svn: u32,
    pub policy: u64,
    pub family_id: [u8; 16],
    pub image_id: [u8; 16],
    pub vmpl: u32,
    pub signature_algo: u32,
    pub current_tcb: u64,
    pub platform_info: u64,
    #[serde(with = "BigArray")]
    pub report_data: [u8; 64],
    #[serde(with = "BigArray")]
    pub measurement: [u8; 48],
    pub host_data: [u8; 32],
    #[serde(with = "BigArray")]
    pub id_key_digest: [u8; 48],
    #[serde(with = "BigArray")]
    pub author_key_digest: [u8; 48],
    pub report_id: [u8; 32],
    pub reported_tcb: u64,
    #[serde(with = "BigArray")]
    pub chip_id: [u8; 64],
    pub committed_tcb: u64,
    pub launch_tcb: u64,
}

/// Verify an AMD SEV-SNP attestation report against a pinned VCEK public
/// key. `vcek_sec1` is the SEC1 uncompressed encoding of the VCEK public
/// key: `0x04 || x || y`, each coordinate 48 bytes big-endian.
///
/// The caller is responsible for validating the VCEK certificate chain
/// against the AMD ARK/ASK roots before pinning it here.
pub fn verify_sev_snp_report(report: &[u8], vcek_sec1: &[u8]) -> Result<SevSnpClaims, VerifyError> {
    if report.len() < REPORT_LEN {
        return Err(VerifyError::Truncated {
            expected: REPORT_LEN,
            actual: report.len(),
        });
    }

    let version = read_u32_le(&report[0x000..0x004])?;
    if version < 2 || version > 3 {
        return Err(VerifyError::UnsupportedVersion(version));
    }
    let guest_svn = read_u32_le(&report[0x004..0x008])?;
    let policy = read_u64_le(&report[0x008..0x010])?;
    let mut family_id = [0u8; 16];
    family_id.copy_from_slice(&report[0x010..0x020]);
    let mut image_id = [0u8; 16];
    image_id.copy_from_slice(&report[0x020..0x030]);
    let vmpl = read_u32_le(&report[0x030..0x034])?;
    let signature_algo = read_u32_le(&report[0x034..0x038])?;
    if signature_algo != SIG_ALGO_ECDSA_P384_SHA384 {
        return Err(VerifyError::UnsupportedAlgorithm(signature_algo));
    }
    let current_tcb = read_u64_le(&report[0x038..0x040])?;
    let platform_info = read_u64_le(&report[0x040..0x048])?;

    let mut report_data = [0u8; 64];
    report_data.copy_from_slice(&report[0x050..0x090]);
    let mut measurement = [0u8; 48];
    measurement.copy_from_slice(&report[0x090..0x0C0]);
    let mut host_data = [0u8; 32];
    host_data.copy_from_slice(&report[0x0C0..0x0E0]);
    let mut id_key_digest = [0u8; 48];
    id_key_digest.copy_from_slice(&report[0x0E0..0x110]);
    let mut author_key_digest = [0u8; 48];
    author_key_digest.copy_from_slice(&report[0x110..0x140]);
    let mut report_id = [0u8; 32];
    report_id.copy_from_slice(&report[0x140..0x160]);
    let reported_tcb = read_u64_le(&report[0x180..0x188])?;
    let mut chip_id = [0u8; 64];
    chip_id.copy_from_slice(&report[0x1A0..0x1E0]);
    let committed_tcb = read_u64_le(&report[0x1E0..0x1E8])?;
    let launch_tcb = read_u64_le(&report[0x1F0..0x1F8])?;

    // The signature block at 0x2A0 stores r || s, each padded to 72 bytes.
    // AMD spec: only the first 48 bytes of each 72-byte block carry data.
    let (signed_region, sig_area) = take(report, SIGNED_REGION_LEN)?;
    let r = &sig_area[0..48];
    let s = &sig_area[72..72 + 48];
    let mut sig_raw = [0u8; 96];
    sig_raw[..48].copy_from_slice(r);
    sig_raw[48..].copy_from_slice(s);

    let verifying_point = EncodedPoint::from_bytes(vcek_sec1)
        .map_err(|_| VerifyError::Malformed("invalid VCEK encoding"))?;
    let verifying_key = VerifyingKey::from_encoded_point(&verifying_point)
        .map_err(|_| VerifyError::Malformed("VCEK not on curve"))?;
    let signature =
        Signature::from_slice(&sig_raw).map_err(|_| VerifyError::InvalidSignatureEncoding)?;

    verifying_key
        .verify(signed_region, &signature)
        .map_err(|_| VerifyError::SignatureMismatch)?;

    Ok(SevSnpClaims {
        version,
        guest_svn,
        policy,
        family_id,
        image_id,
        vmpl,
        signature_algo,
        current_tcb,
        platform_info,
        report_data,
        measurement,
        host_data,
        id_key_digest,
        author_key_digest,
        report_id,
        reported_tcb,
        chip_id,
        committed_tcb,
        launch_tcb,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use p384::ecdsa::signature::Signer;
    use p384::ecdsa::SigningKey;
    use rand_core::OsRng;

    fn synthetic_report(sig_key: &SigningKey) -> (Vec<u8>, [u8; 97]) {
        let mut report = vec![0u8; REPORT_LEN];
        report[0x000..0x004].copy_from_slice(&2u32.to_le_bytes()); // version
        report[0x004..0x008].copy_from_slice(&1u32.to_le_bytes()); // guest_svn
        report[0x008..0x010].copy_from_slice(&0xC0FFEEu64.to_le_bytes()); // policy
        report[0x010..0x020].copy_from_slice(&[0x22; 16]); // family_id
        report[0x020..0x030].copy_from_slice(&[0x33; 16]); // image_id
        report[0x030..0x034].copy_from_slice(&0u32.to_le_bytes()); // vmpl
        report[0x034..0x038].copy_from_slice(&SIG_ALGO_ECDSA_P384_SHA384.to_le_bytes()); // algo
        report[0x038..0x040].copy_from_slice(&0x12345u64.to_le_bytes()); // current_tcb
        report[0x040..0x048].copy_from_slice(&0xF00Du64.to_le_bytes()); // platform_info
        report[0x050..0x090].copy_from_slice(&[0x55; 64]); // report_data
        report[0x090..0x0C0].copy_from_slice(&[0x66; 48]); // measurement
        report[0x0C0..0x0E0].copy_from_slice(&[0x77; 32]); // host_data
        report[0x0E0..0x110].copy_from_slice(&[0x88; 48]); // id_key_digest
        report[0x110..0x140].copy_from_slice(&[0x99; 48]); // author_key_digest
        report[0x140..0x160].copy_from_slice(&[0xAA; 32]); // report_id
        report[0x180..0x188].copy_from_slice(&0xBEEFu64.to_le_bytes()); // reported_tcb
        report[0x1A0..0x1E0].copy_from_slice(&[0xBB; 64]); // chip_id
        report[0x1E0..0x1E8].copy_from_slice(&0xCAFEu64.to_le_bytes()); // committed_tcb
        report[0x1F0..0x1F8].copy_from_slice(&0xDEADu64.to_le_bytes()); // launch_tcb

        let signature: Signature = sig_key.sign(&report[..SIGNED_REGION_LEN]);
        let sig_bytes = signature.to_bytes();
        // r
        report[0x2A0..0x2A0 + 48].copy_from_slice(&sig_bytes[..48]);
        // s at offset 0x2A0 + 72
        report[0x2A0 + 72..0x2A0 + 72 + 48].copy_from_slice(&sig_bytes[48..]);

        let vk = VerifyingKey::from(sig_key);
        let pt = vk.to_encoded_point(false);
        let mut sec1 = [0u8; 97];
        sec1.copy_from_slice(pt.as_bytes());
        (report, sec1)
    }

    #[test]
    fn round_trip_synthetic_report() {
        let signing_key = SigningKey::random(&mut OsRng);
        let (report, sec1) = synthetic_report(&signing_key);
        let claims = verify_sev_snp_report(&report, &sec1).expect("verify");
        assert_eq!(claims.version, 2);
        assert_eq!(claims.policy, 0xC0FFEE);
        assert_eq!(claims.measurement, [0x66; 48]);
        assert_eq!(claims.report_data, [0x55; 64]);
    }

    #[test]
    fn tampered_report_rejected() {
        let signing_key = SigningKey::random(&mut OsRng);
        let (mut report, sec1) = synthetic_report(&signing_key);
        report[0x090] ^= 0x01; // tamper measurement
        assert!(matches!(
            verify_sev_snp_report(&report, &sec1),
            Err(VerifyError::SignatureMismatch)
        ));
    }
}
