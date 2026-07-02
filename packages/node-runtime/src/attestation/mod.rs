//! Signs outbound inference responses with an ed25519 attestation key and,
//! when running inside a real TEE, wraps the response in the vendor
//! attestation envelope so the gateway can call the corresponding verifier
//! in `wattz-compute-verifier`.
//!
//! On non-TEE hosts (developer laptops, CI runners) the signer degrades
//! gracefully to a plain ed25519 signature over the response digest. The
//! gateway records this in the routing engine as `attestation_type =
//! "software"` and downgrades the node's reputation weight accordingly.

use anyhow::{Context, Result};
use ed25519_dalek::{Signer, SigningKey, VerifyingKey};
use rand_core::OsRng;
use serde::{Deserialize, Serialize};
use serde_big_array::BigArray;
use sha2::{Digest, Sha256};
use std::path::Path;

const KEY_LEN: usize = 32;

pub struct AttestationSigner {
    signing_key: SigningKey,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttestationEnvelope {
    /// SHA-256 of the canonicalised response body.
    pub response_digest: [u8; 32],
    /// ed25519 verifying key of the node.
    pub node_pubkey: [u8; 32],
    /// ed25519 signature over `response_digest || nonce || model || tokens`.
    #[serde(with = "BigArray")]
    pub signature: [u8; 64],
    pub nonce: [u8; 32],
    pub model: String,
    pub tokens: u32,
    /// TEE quote when running inside a real TEE. Empty on software-only
    /// nodes.
    #[serde(default, with = "hex_option_bytes")]
    pub tee_quote: Option<Vec<u8>>,
}

impl AttestationSigner {
    pub fn load_or_generate(path: Option<&Path>) -> Result<Self> {
        if let Some(path) = path {
            if path.exists() {
                let bytes =
                    std::fs::read(path).with_context(|| format!("read {}", path.display()))?;
                if bytes.len() != KEY_LEN {
                    anyhow::bail!(
                        "attestation key at {} must be exactly {} bytes",
                        path.display(),
                        KEY_LEN
                    );
                }
                let mut buf = [0u8; KEY_LEN];
                buf.copy_from_slice(&bytes);
                let signing_key = SigningKey::from_bytes(&buf);
                return Ok(Self { signing_key });
            }
        }
        // Generate an ephemeral key. In production nodes must supply a
        // persisted keyfile via `WATTZ_NODE_ATT_KEY` so the gateway can
        // pin it during registration.
        let signing_key = SigningKey::generate(&mut OsRng);
        Ok(Self { signing_key })
    }

    pub fn verifying_key(&self) -> VerifyingKey {
        self.signing_key.verifying_key()
    }

    pub fn public_key_bytes(&self) -> [u8; KEY_LEN] {
        self.verifying_key().to_bytes()
    }

    pub fn sign_response(
        &self,
        response_body: &[u8],
        nonce: [u8; 32],
        model: &str,
        tokens: u32,
        tee_quote: Option<Vec<u8>>,
    ) -> AttestationEnvelope {
        let mut hasher = Sha256::new();
        hasher.update(response_body);
        let response_digest: [u8; 32] = hasher.finalize().into();

        let mut sign_buf = Vec::with_capacity(32 + 32 + model.len() + 4);
        sign_buf.extend_from_slice(&response_digest);
        sign_buf.extend_from_slice(&nonce);
        sign_buf.extend_from_slice(model.as_bytes());
        sign_buf.extend_from_slice(&tokens.to_le_bytes());

        let signature = self.signing_key.sign(&sign_buf);
        AttestationEnvelope {
            response_digest,
            node_pubkey: self.public_key_bytes(),
            signature: signature.to_bytes(),
            nonce,
            model: model.to_string(),
            tokens,
            tee_quote,
        }
    }

    /// Persist the ed25519 secret material to `path`. Only 32-byte raw
    /// seed is written; the file mode is set to 0o600 on Unix.
    pub fn persist(&self, path: &Path) -> Result<()> {
        use std::io::Write;
        let mut f = std::fs::OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .open(path)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perm = f.metadata()?.permissions();
            perm.set_mode(0o600);
            f.set_permissions(perm)?;
        }
        f.write_all(&self.signing_key.to_bytes())?;
        Ok(())
    }
}

mod hex_option_bytes {
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(v: &Option<Vec<u8>>, s: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match v {
            Some(bytes) => s.serialize_str(&hex::encode(bytes)),
            None => s.serialize_none(),
        }
    }

    pub fn deserialize<'de, D>(d: D) -> Result<Option<Vec<u8>>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let opt: Option<String> = Option::deserialize(d)?;
        match opt {
            None => Ok(None),
            Some(s) if s.is_empty() => Ok(None),
            Some(s) => hex::decode(s).map(Some).map_err(serde::de::Error::custom),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::Verifier;

    #[test]
    fn signs_and_reverifies_a_response() {
        let signer = AttestationSigner::load_or_generate(None).unwrap();
        let env = signer.sign_response(b"hello world", [0x11; 32], "llama-3-8b", 42, None);
        let vk = VerifyingKey::from_bytes(&env.node_pubkey).unwrap();
        let mut sign_buf = Vec::new();
        sign_buf.extend_from_slice(&env.response_digest);
        sign_buf.extend_from_slice(&env.nonce);
        sign_buf.extend_from_slice("llama-3-8b".as_bytes());
        sign_buf.extend_from_slice(&42u32.to_le_bytes());
        let sig = ed25519_dalek::Signature::from_bytes(&env.signature);
        vk.verify(&sign_buf, &sig).unwrap();
    }
}
