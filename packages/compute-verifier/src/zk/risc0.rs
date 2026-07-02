//! Risc0 zkVM receipt envelope verifier.
//!
//! Risc0 receipts consist of an inner cryptographic proof (STARK or
//! Groth16), a `journal` byte string committed to by the proof, and an
//! `image_id` (SHA-256 of the ELF that produced the receipt). In the
//! Wattz protocol, a node bundles a receipt into an on-wire envelope of
//! the form:
//!
//! ```text
//! magic          [u8; 8]   b"WATTZR01"
//! image_id       [u8; 32]
//! journal_len    u32
//! journal        [u8; N]
//! seal_len       u32
//! seal           [u8; M]   the raw Risc0 seal / STARK bytes
//! node_pubkey    [u8; 32]  ed25519 verifying key of the emitting node
//! signature      [u8; 64]  ed25519 signature over the envelope prefix
//! ```
//!
//! `verify_risc0_receipt` performs three checks:
//!
//! 1. The magic + version bytes match the current Wattz envelope.
//! 2. The `seal` binds to the declared `(image_id, journal)`. This is
//!    modelled here as `SHA-256(image_id || journal) == seal[0..32]`, which
//!    is the commitment that `risc0-zkvm::Receipt::verify_integrity_with_context`
//!    performs before delegating to the STARK verifier.
//! 3. The ed25519 signature over the envelope prefix (everything before the
//!    signature bytes) validates against `node_pubkey`, which must match
//!    the caller-supplied trust root.
//!
//! For a full end-to-end verification the Wattz inference gateway passes
//! the `seal` payload to the `risc0-zkvm` STARK verifier out of band; this
//! crate exposes only the envelope check because the STARK verifier is
//! target- and version-specific.

use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::{read_u32_le, take, VerifyError};

const MAGIC: &[u8; 8] = b"WATTZR01";
const IMAGE_ID_LEN: usize = 32;
const NODE_PK_LEN: usize = 32;
const SIG_LEN: usize = 64;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Risc0Claims {
    pub image_id: [u8; 32],
    pub journal: Vec<u8>,
    pub node_pubkey: [u8; 32],
    /// SHA-256 commitment computed from the envelope contents. Used by the
    /// gateway as a stable identifier for the receipt on-chain.
    pub commitment: [u8; 32],
}

pub fn verify_risc0_receipt(
    envelope: &[u8],
    trusted_node_pubkey: &[u8; 32],
) -> Result<Risc0Claims, VerifyError> {
    let (magic, rest) = take(envelope, 8)?;
    if magic != MAGIC {
        return Err(VerifyError::Malformed("bad magic"));
    }
    let (image_id_bytes, rest) = take(rest, IMAGE_ID_LEN)?;
    let mut image_id = [0u8; IMAGE_ID_LEN];
    image_id.copy_from_slice(image_id_bytes);

    let (journal_len_bytes, rest) = take(rest, 4)?;
    let journal_len = read_u32_le(journal_len_bytes)? as usize;
    let (journal_bytes, rest) = take(rest, journal_len)?;
    let journal = journal_bytes.to_vec();

    let (seal_len_bytes, rest) = take(rest, 4)?;
    let seal_len = read_u32_le(seal_len_bytes)? as usize;
    if seal_len < 32 {
        return Err(VerifyError::Malformed("seal too short"));
    }
    let (seal_bytes, rest) = take(rest, seal_len)?;

    let (node_pk_bytes, rest) = take(rest, NODE_PK_LEN)?;
    let mut node_pubkey = [0u8; NODE_PK_LEN];
    node_pubkey.copy_from_slice(node_pk_bytes);

    let (sig_bytes, _tail) = take(rest, SIG_LEN)?;

    // Check integrity commitment. The Wattz protocol requires that the
    // Risc0 seal opens with SHA-256(image_id || journal). This is the
    // same commitment that risc0-zkvm computes as part of its integrity
    // check before invoking the STARK verifier.
    let mut hasher = Sha256::new();
    hasher.update(image_id);
    hasher.update(&journal);
    let expected_commitment: [u8; 32] = hasher.finalize().into();
    if &seal_bytes[..32] != expected_commitment {
        return Err(VerifyError::Policy(
            "seal does not commit to (image_id, journal)",
        ));
    }

    if trusted_node_pubkey != &node_pubkey {
        return Err(VerifyError::Policy(
            "receipt node pubkey does not match trusted root",
        ));
    }

    // Verify ed25519 signature over everything up to (but not including)
    // the signature bytes.
    let signed_len = envelope.len() - SIG_LEN;
    let signed_prefix = &envelope[..signed_len];
    let vk = VerifyingKey::from_bytes(&node_pubkey)
        .map_err(|_| VerifyError::Malformed("invalid node pubkey"))?;
    let mut sig_buf = [0u8; SIG_LEN];
    sig_buf.copy_from_slice(sig_bytes);
    let signature = Signature::from_bytes(&sig_buf);
    vk.verify(signed_prefix, &signature)
        .map_err(|_| VerifyError::SignatureMismatch)?;

    Ok(Risc0Claims {
        image_id,
        journal,
        node_pubkey,
        commitment: expected_commitment,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};
    use rand_core::OsRng;

    fn build_envelope(
        signing_key: &SigningKey,
        image_id: &[u8; 32],
        journal: &[u8],
        extra_seal_body: &[u8],
    ) -> Vec<u8> {
        let mut hasher = Sha256::new();
        hasher.update(image_id);
        hasher.update(journal);
        let commitment: [u8; 32] = hasher.finalize().into();

        let mut seal = Vec::new();
        seal.extend_from_slice(&commitment);
        seal.extend_from_slice(extra_seal_body);

        let mut env = Vec::new();
        env.extend_from_slice(MAGIC);
        env.extend_from_slice(image_id);
        env.extend_from_slice(&(journal.len() as u32).to_le_bytes());
        env.extend_from_slice(journal);
        env.extend_from_slice(&(seal.len() as u32).to_le_bytes());
        env.extend_from_slice(&seal);
        let vk = signing_key.verifying_key();
        env.extend_from_slice(vk.as_bytes());
        let sig = signing_key.sign(&env);
        env.extend_from_slice(&sig.to_bytes());
        env
    }

    #[test]
    fn round_trip_receipt() {
        let signing_key = SigningKey::generate(&mut OsRng);
        let image_id = [0xAAu8; 32];
        let journal = b"Llama-3-8b output tokens: hello world".to_vec();
        let envelope = build_envelope(&signing_key, &image_id, &journal, &[0x00; 128]);
        let vk = signing_key.verifying_key();
        let claims = verify_risc0_receipt(&envelope, vk.as_bytes()).expect("verify");
        assert_eq!(claims.image_id, image_id);
        assert_eq!(claims.journal, journal);
    }

    #[test]
    fn tampered_journal_rejected() {
        let signing_key = SigningKey::generate(&mut OsRng);
        let image_id = [0xAAu8; 32];
        let mut envelope = build_envelope(&signing_key, &image_id, b"journal", &[0; 64]);
        // Flip a bit in the journal region.
        let idx = 8 + 32 + 4;
        envelope[idx] ^= 0x01;
        let vk = signing_key.verifying_key();
        assert!(verify_risc0_receipt(&envelope, vk.as_bytes()).is_err());
    }

    #[test]
    fn wrong_trust_root_rejected() {
        let signing_key = SigningKey::generate(&mut OsRng);
        let image_id = [0xAAu8; 32];
        let envelope = build_envelope(&signing_key, &image_id, b"journal", &[0; 64]);
        let other = SigningKey::generate(&mut OsRng);
        let vk = other.verifying_key();
        assert!(verify_risc0_receipt(&envelope, vk.as_bytes()).is_err());
    }
}
