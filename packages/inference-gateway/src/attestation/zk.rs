//! Risc0 / SP1 ZK-proof envelope verification.
//!
//! Full STARK verification is delegated to the `packages/compute-verifier`
//! service. The inference gateway performs the online part of the
//! verification: it opens the receipt envelope, checks that the
//! commitment (image_id, journal digest) is well formed, and verifies
//! the ed25519 signature the prover attaches so a node cannot forge a
//! receipt in-flight.
//!
//! Envelope layout (little endian):
//!
//! ```text
//! 0..32   image_id       (SHA-256 of the guest program)
//! 32..36  journal_len    (u32)
//! 36..N   journal        (public outputs)
//! N..M    seal / stark   (Risc0 or SP1 opaque)
//! ```
//!
//! The commitment we sign is `SHA-256(image_id || journal || seal)`.

use super::{AttestationOutcome, QuoteType};
use crate::error::ApiError;
use ed25519_dalek::{Signature as EdSignature, Verifier as EdVerifier, VerifyingKey as EdVerifyingKey};
use sha2::{Digest, Sha256};

const IMAGE_ID_LEN: usize = 32;
const JOURNAL_LEN_FIELD: usize = 4;

pub fn verify_risc0(
    quote: &[u8],
    signature: &[u8],
    signer_pubkey: &[u8],
) -> Result<AttestationOutcome, ApiError> {
    verify_zk_envelope(QuoteType::Risc0, quote, signature, signer_pubkey, "risc0")
}

pub fn verify_sp1(
    quote: &[u8],
    signature: &[u8],
    signer_pubkey: &[u8],
) -> Result<AttestationOutcome, ApiError> {
    verify_zk_envelope(QuoteType::Sp1, quote, signature, signer_pubkey, "sp1")
}

fn verify_zk_envelope(
    quote_type: QuoteType,
    quote: &[u8],
    signature: &[u8],
    signer_pubkey: &[u8],
    label: &str,
) -> Result<AttestationOutcome, ApiError> {
    if quote.len() < IMAGE_ID_LEN + JOURNAL_LEN_FIELD {
        return Err(ApiError::AttestationFailed(format!(
            "{} receipt too short: {} bytes",
            label,
            quote.len()
        )));
    }
    let image_id = &quote[..IMAGE_ID_LEN];
    let journal_len = u32::from_le_bytes([
        quote[IMAGE_ID_LEN],
        quote[IMAGE_ID_LEN + 1],
        quote[IMAGE_ID_LEN + 2],
        quote[IMAGE_ID_LEN + 3],
    ]) as usize;
    let journal_start = IMAGE_ID_LEN + JOURNAL_LEN_FIELD;
    let journal_end = journal_start
        .checked_add(journal_len)
        .ok_or_else(|| ApiError::AttestationFailed(format!("{} journal len overflow", label)))?;
    if quote.len() < journal_end {
        return Err(ApiError::AttestationFailed(format!(
            "{} journal truncated (declared {}, got {})",
            label,
            journal_len,
            quote.len() - journal_start
        )));
    }
    let journal = &quote[journal_start..journal_end];
    let seal = &quote[journal_end..];

    // The prover commitment: SHA-256(image_id || journal || seal).
    let mut hasher = Sha256::new();
    hasher.update(image_id);
    hasher.update(journal);
    hasher.update(seal);
    let commitment = hasher.finalize();

    let structural_ok = image_id.iter().any(|b| *b != 0) && !journal.is_empty();

    // ed25519 verification over the commitment (32 bytes).
    if signer_pubkey.len() != 32 {
        return Err(ApiError::AttestationFailed(format!(
            "{} signer key must be 32 bytes (got {})",
            label,
            signer_pubkey.len()
        )));
    }
    if signature.len() != 64 {
        return Err(ApiError::AttestationFailed(format!(
            "{} signature must be 64 bytes (got {})",
            label,
            signature.len()
        )));
    }
    let key = EdVerifyingKey::from_bytes(<&[u8; 32]>::try_from(signer_pubkey).unwrap())
        .map_err(|e| ApiError::AttestationFailed(format!("{} bad ed25519 key: {}", label, e)))?;
    let sig = EdSignature::from_bytes(<&[u8; 64]>::try_from(signature).unwrap());
    let signature_ok = key.verify(&commitment, &sig).is_ok();

    Ok(AttestationOutcome {
        quote_type,
        signer_pubkey_hex: hex::encode(signer_pubkey),
        measurement_hex: hex::encode(image_id),
        report_data_hex: hex::encode(&commitment),
        signature_ok,
        structural_ok,
        notes: format!(
            "{} receipt journal={}B seal={}B",
            label,
            journal.len(),
            seal.len()
        ),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};
    use rand::rngs::OsRng;

    fn make_receipt(journal: &[u8], seal: &[u8]) -> Vec<u8> {
        let image_id = [0x11u8; 32];
        let mut out = Vec::new();
        out.extend_from_slice(&image_id);
        out.extend_from_slice(&(journal.len() as u32).to_le_bytes());
        out.extend_from_slice(journal);
        out.extend_from_slice(seal);
        out
    }

    #[test]
    fn risc0_verifies_signed_receipt() {
        let sk = SigningKey::generate(&mut OsRng);
        let journal = b"tokens=42 model=llama-3-8b";
        let seal = vec![0xaa; 128];
        let receipt = make_receipt(journal, &seal);
        // commitment = sha256(image_id || journal || seal)
        let mut hasher = Sha256::new();
        hasher.update(&receipt[..32]);
        hasher.update(journal);
        hasher.update(&seal);
        let commitment = hasher.finalize();
        let sig = sk.sign(&commitment);

        let outcome = verify_risc0(&receipt, &sig.to_bytes(), sk.verifying_key().as_bytes()).unwrap();
        assert!(outcome.signature_ok);
        assert!(outcome.structural_ok);
    }

    #[test]
    fn risc0_rejects_bad_signature() {
        let sk = SigningKey::generate(&mut OsRng);
        let journal = b"x";
        let seal = vec![0u8; 32];
        let receipt = make_receipt(journal, &seal);
        let bad_sig = [0u8; 64];
        let outcome = verify_risc0(&receipt, &bad_sig, sk.verifying_key().as_bytes()).unwrap();
        assert!(!outcome.signature_ok);
    }
}
