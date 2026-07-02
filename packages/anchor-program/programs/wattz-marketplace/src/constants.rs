//! Program-wide constants.
//!
//! Numerical constants are expressed in base units of the settlement token
//! ($WATTZ, 9 decimals). Basis-point (BPS) constants use a denominator of
//! 10_000 -- 100_00 BPS = 100 %.

use anchor_lang::prelude::*;

// ---------------------------------------------------------------------------
// Economic parameters
// ---------------------------------------------------------------------------

/// Minimum stake required to register a GPU node. Denominated in base units
/// of $WATTZ (9 decimals) -- 100_000_000_000 base units = 100 $WATTZ.
pub const MIN_NODE_STAKE: u64 = 100_000_000_000;

/// Default dispute window in seconds. Callers may override at init time.
pub const DISPUTE_WINDOW_SECS: i64 = 3_600; // 1 hour default

/// Default lock period applied to stakes at register / top-up time.
pub const DEFAULT_STAKE_LOCK_SECS: i64 = 7 * 24 * 3_600; // 7 days

/// Upper bound on the reputation score kept per node.
pub const MAX_REPUTATION: i32 = 10_000;

/// A node whose reputation drops to or below this value may be slashed.
pub const MIN_REPUTATION_BEFORE_SLASH: i32 = -100;

/// Positive delta applied to a node's reputation on each successful settle.
pub const REPUTATION_ON_SETTLE: i32 = 1;

/// Negative delta applied when a dispute is resolved in favour of the opener.
pub const REPUTATION_ON_FAVOR_OPENER: i32 = -500;

/// Negative delta applied on a split resolution.
pub const REPUTATION_ON_SPLIT: i32 = -100;

/// Positive delta applied when a dispute is resolved in favour of the node.
pub const REPUTATION_ON_FAVOR_NODE: i32 = 10;

// ---------------------------------------------------------------------------
// Revenue split (basis points, denominator = BPS_DENOMINATOR)
// ---------------------------------------------------------------------------

/// Portion of each inference price paid to the node immediately on settle.
pub const NODE_IMMEDIATE_BPS: u64 = 8_000; // 80 %

/// Portion of each inference price credited to node's uptime pool
/// (claimable via `claim_reward`).
pub const NODE_PENDING_BPS: u64 = 1_000; // 10 %

/// Portion of each inference price paid to the model publisher on settle.
pub const PUBLISHER_SHARE_BPS: u64 = 500; // 5 %

/// Portion of each inference price captured as the project fee (5 %).
/// Split further into `BURN_RATE_BPS` (burn) and the remainder (treasury).
pub const PROJECT_FEE_BPS: u64 = 500; // 5 %

/// Portion of the project fee burned via a direct SPL Token burn CPI.
pub const BURN_RATE_BPS: u64 = 5_000; // 50 % of project fee = 2.5 % of price

/// Basis point denominator.
pub const BPS_DENOMINATOR: u64 = 10_000;

// ---------------------------------------------------------------------------
// String length caps (used for account sizing and validation)
// ---------------------------------------------------------------------------

pub const MAX_GPU_MODEL_LEN: usize = 32;
pub const MAX_REGION_LEN: usize = 8;
pub const MAX_ENDPOINT_LEN: usize = 128;
pub const MAX_MODEL_NAME_LEN: usize = 32;
pub const MAX_MODEL_VERSION_LEN: usize = 16;
pub const MAX_IPFS_HASH_LEN: usize = 64;
pub const MAX_MODELS_PER_NODE: usize = 16;

// ---------------------------------------------------------------------------
// PDA seeds
// ---------------------------------------------------------------------------

pub const CONFIG_SEED: &[u8] = b"config";
pub const NODE_SEED: &[u8] = b"node";
pub const MODEL_SEED: &[u8] = b"model";
pub const RECEIPT_SEED: &[u8] = b"receipt";
pub const DISPUTE_SEED: &[u8] = b"dispute";
pub const STAKE_SEED: &[u8] = b"stake";
pub const VAULT_AUTHORITY_SEED: &[u8] = b"vault_authority";

// ---------------------------------------------------------------------------
// Anchor sanity re-export
// ---------------------------------------------------------------------------

/// Number of bytes reserved at the head of every account for the Anchor
/// discriminator. Kept here for legibility -- Anchor already accounts for it
/// via `space = 8 + Struct::INIT_SPACE`.
pub const DISCRIMINATOR_LEN: usize = 8;

// Compile-time sanity: shares must sum to 100 %.
const _SHARES_SUM_CHECK: () = {
    assert!(
        NODE_IMMEDIATE_BPS + NODE_PENDING_BPS + PUBLISHER_SHARE_BPS + PROJECT_FEE_BPS
            == BPS_DENOMINATOR,
        "revenue split BPS must sum to 10_000"
    );
};

// Silence unused-import warnings when `anchor_lang::prelude::*` is not needed
// downstream (kept for future extension).
#[allow(dead_code)]
fn _keep_prelude_alive() -> Option<Pubkey> {
    None
}
