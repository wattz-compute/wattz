//! Succinct SP1 proof envelope verifier.
//!
//! An SP1 receipt bundles a verifying key hash (`vk_hash`), a byte string
//! of `public_values` that the guest program exposed, and a proof (Groth16
//! or Plonk). Wattz wraps SP1 proofs in the following on-wire format:
//!
//! ```text
//! magic          [u8; 8]   b"WATTZS01"
//! variant        u8        1 = Groth16, 2 = Plonk
//! _reserved      [u8; 3]
//! vk_hash        [u8; 32]
//! public_len     u32
//! public_values  [u8; N]
//! proof_len      u32
//! proof          [u8; M]
//! node_pubkey    [u8; 32]
//! signature      [u8; 64]
//! ```
//!
//! Verification here checks the envelope integrity, that the proof binds
//! to (`vk_hash`, `public_values`) via the standard SP1 commitment
//! `SHA-256(vk_hash || SHA-256(public_values))` written into the first 32
//! bytes of the proof, and that the ed25519 signature validates against
//! the caller-supplied node pubkey.
//!
//! The full Groth16 / Plonk pairing check is performed by `sp1-verifier`
//! in production; that library is target-specific (bn254 arithmetic) and
//! is called out-of-band by the Wattz inference gateway.

use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::{read_u32_le, take, VerifyError};

const MAGIC: &[u8; 8] = b"WATTZS01";
const VK_LEN: usize = 32;
const NODE_PK_LEN: usize = 32;
const SIG_LEN: usize = 64;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Sp1Variant {
    Groth16,
    Plonk,
}

impl Sp1Variant {
    fn from_byte(b: u8) -> Result<Self, VerifyError> {
        match b {
            1 => Ok(Self::Groth16),
            2 => Ok(Self::Plonk),
            _ => Err(VerifyError::UnsupportedAlgorithm(b as u32)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Sp1Claims {
    pub variant: Sp1Variant,
    pub vk_hash: [u8; 32],
    pub public_values: Vec<u8>,
    pub node_pubkey: [u8; 32],
    pub commitment: [u8; 32],
}

pub fn verify_sp1_proof(
    envelope: &[u8],
    trusted_node_pubkey: &[u8; 32],
) -> Result<Sp1Claims, VerifyError> {
    let (magic, rest) = take(envelope, 8)?;
    if magic != MAGIC {
        return Err(VerifyError::Malformed("bad magic"));
    }
    let (variant_byte, rest) = take(rest, 1)?;
    let variant = Sp1Variant::from_byte(variant_byte[0])?;
    // skip reserved bytes
    let (_reserved, rest) = take(rest, 3)?;
    let (vk_bytes, rest) = take(rest, VK_LEN)?;
    let mut vk_hash = [0u8; VK_LEN];
    vk_hash.copy_from_slice(vk_bytes);

    let (pub_len_bytes, rest) = take(rest, 4)?;
    let pub_len = read_u32_le(pub_len_bytes)? as usize;
    let (pub_bytes, rest) = take(rest, pub_len)?;
    let public_values = pub_bytes.to_vec();

    let (proof_len_bytes, rest) = take(rest, 4)?;
    let proof_len = read_u32_le(proof_len_bytes)? as usize;
    if proof_len < 32 {
        return Err(VerifyError::Malformed("proof too short"));
    }
    let (proof_bytes, rest) = take(rest, proof_len)?;

    let (node_pk_bytes, rest) = take(rest, NODE_PK_LEN)?;
    let mut node_pubkey = [0u8; NODE_PK_LEN];
    node_pubkey.copy_from_slice(node_pk_bytes);

    let (sig_bytes, _tail) = take(rest, SIG_LEN)?;

    // Compute the standard SP1 commitment:
    //     SHA-256(vk_hash || SHA-256(public_values))
    let mut inner = Sha256::new();
    inner.update(&public_values);
    let public_digest: [u8; 32] = inner.finalize().into();
    let mut outer = Sha256::new();
    outer.update(vk_hash);
    outer.update(public_digest);
    let expected_commitment: [u8; 32] = outer.finalize().into();
    if &proof_bytes[..32] != expected_commitment {
        return Err(VerifyError::Policy(
            "proof does not commit to (vk_hash, public_values)",
        ));
    }

    if trusted_node_pubkey != &node_pubkey {
        return Err(VerifyError::Policy(
            "receipt node pubkey does not match trusted root",
        ));
    }

    let signed_len = envelope.len() - SIG_LEN;
    let signed_prefix = &envelope[..signed_len];
    let vk = VerifyingKey::from_bytes(&node_pubkey)
        .map_err(|_| VerifyError::Malformed("invalid node pubkey"))?;
    let mut sig_buf = [0u8; SIG_LEN];
    sig_buf.copy_from_slice(sig_bytes);
    let signature = Signature::from_bytes(&sig_buf);
    vk.verify(signed_prefix, &signature)
        .map_err(|_| VerifyError::SignatureMismatch)?;

    Ok(Sp1Claims {
        variant,
        vk_hash,
        public_values,
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
        variant: Sp1Variant,
        vk_hash: &[u8; 32],
        public_values: &[u8],
        extra_proof_body: &[u8],
    ) -> Vec<u8> {
        let mut inner = Sha256::new();
        inner.update(public_values);
        let public_digest: [u8; 32] = inner.finalize().into();
        let mut outer = Sha256::new();
        outer.update(vk_hash);
        outer.update(public_digest);
        let commitment: [u8; 32] = outer.finalize().into();

        let mut proof = Vec::new();
        proof.extend_from_slice(&commitment);
        proof.extend_from_slice(extra_proof_body);

        let mut env = Vec::new();
        env.extend_from_slice(MAGIC);
        env.push(match variant {
            Sp1Variant::Groth16 => 1,
            Sp1Variant::Plonk => 2,
        });
        env.extend_from_slice(&[0; 3]);
        env.extend_from_slice(vk_hash);
        env.extend_from_slice(&(public_values.len() as u32).to_le_bytes());
        env.extend_from_slice(public_values);
        env.extend_from_slice(&(proof.len() as u32).to_le_bytes());
        env.extend_from_slice(&proof);
        let vk = signing_key.verifying_key();
        env.extend_from_slice(vk.as_bytes());
        let sig = signing_key.sign(&env);
        env.extend_from_slice(&sig.to_bytes());
        env
    }

    #[test]
    fn round_trip_groth16() {
        let signing_key = SigningKey::generate(&mut OsRng);
        let vk_hash = [0xEEu8; 32];
        let public_values = b"tokens_generated=256, model=llama-3-8b".to_vec();
        let envelope = build_envelope(
            &signing_key,
            Sp1Variant::Groth16,
            &vk_hash,
            &public_values,
            &[0x00; 256],
        );
        let vk = signing_key.verifying_key();
        let claims = verify_sp1_proof(&envelope, vk.as_bytes()).expect("verify");
        assert_eq!(claims.variant, Sp1Variant::Groth16);
        assert_eq!(claims.vk_hash, vk_hash);
        assert_eq!(claims.public_values, public_values);
    }

    #[test]
    fn round_trip_plonk() {
        let signing_key = SigningKey::generate(&mut OsRng);
        let vk_hash = [0xEE; 32];
        let public_values = b"public".to_vec();
        let envelope = build_envelope(
            &signing_key,
            Sp1Variant::Plonk,
            &vk_hash,
            &public_values,
            &[0; 64],
        );
        let vk = signing_key.verifying_key();
        let claims = verify_sp1_proof(&envelope, vk.as_bytes()).expect("verify");
        assert_eq!(claims.variant, Sp1Variant::Plonk);
    }

    #[test]
    fn variant_unsupported() {
        let signing_key = SigningKey::generate(&mut OsRng);
        let vk_hash = [0; 32];
        let mut envelope = build_envelope(
            &signing_key,
            Sp1Variant::Groth16,
            &vk_hash,
            b"",
            &[0; 64],
        );
        envelope[8] = 99; // variant byte
        let vk = signing_key.verifying_key();
        assert!(matches!(
            verify_sp1_proof(&envelope, vk.as_bytes()),
            Err(VerifyError::UnsupportedAlgorithm(_))
        ));
    }
}
