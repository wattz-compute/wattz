//! `resolve_dispute` -- admin records the outcome and applies reputation +
//! receipt-flag effects. Actual token movement lives in downstream instructions
//! (`slash_node` for opener wins, `settle_inference` after clearing the flag
//! for node wins / split).

use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::WattzError;
use crate::events::DisputeResolved;
use crate::state::{Config, DisputeAccount, InferenceReceipt, NodeAccount, Resolution};

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = admin.key() == config.admin @ WattzError::Unauthorized,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [DISPUTE_SEED, receipt.key().as_ref()],
        bump = dispute.bump,
        constraint = !dispute.resolved @ WattzError::DisputeNotResolved,
        constraint = dispute.receipt == receipt.key() @ WattzError::DisputeNotResolved,
    )]
    pub dispute: Account<'info, DisputeAccount>,

    #[account(
        mut,
        seeds = [RECEIPT_SEED, receipt.request_id.as_ref()],
        bump = receipt.bump,
    )]
    pub receipt: Account<'info, InferenceReceipt>,

    #[account(
        mut,
        seeds = [NODE_SEED, node.authority.as_ref()],
        bump = node.bump,
        constraint = receipt.node == node.key() @ WattzError::NodeMismatch,
    )]
    pub node: Account<'info, NodeAccount>,

    pub admin: Signer<'info>,
}

pub fn handler(ctx: Context<ResolveDispute>, resolution: Resolution) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(
        resolution != Resolution::Pending,
        WattzError::InvalidResolution
    );

    let dispute = &mut ctx.accounts.dispute;
    dispute.resolved = true;
    dispute.resolution = resolution;

    let receipt = &mut ctx.accounts.receipt;
    let node = &mut ctx.accounts.node;

    let reputation_delta = match resolution {
        Resolution::FavorOpener => {
            // Node loses heavy reputation, receipt is forever settled without
            // paying out. Follow-up: admin may call `slash_node`.
            node.reputation = node.reputation.saturating_add(REPUTATION_ON_FAVOR_OPENER);
            receipt.settled = true;
            REPUTATION_ON_FAVOR_OPENER
        }
        Resolution::FavorNode => {
            // Node vindicated; clear the flag so settlement can proceed.
            receipt.disputed = false;
            node.reputation = node
                .reputation
                .saturating_add(REPUTATION_ON_FAVOR_NODE)
                .min(MAX_REPUTATION);
            REPUTATION_ON_FAVOR_NODE
        }
        Resolution::Split => {
            node.reputation = node.reputation.saturating_add(REPUTATION_ON_SPLIT);
            receipt.disputed = false;
            REPUTATION_ON_SPLIT
        }
        Resolution::Pending => unreachable!("checked above"),
    };

    emit!(DisputeResolved {
        dispute: dispute.key(),
        receipt: receipt.key(),
        resolution: resolution.as_u8(),
        reputation_delta,
        timestamp: now,
    });

    Ok(())
}
