//! `open_dispute` -- any wallet may open a dispute on a non-settled receipt
//! while the dispute window is still open.

use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::WattzError;
use crate::events::DisputeOpened;
use crate::state::{Config, DisputeAccount, InferenceReceipt, Resolution};

#[derive(Accounts)]
pub struct OpenDispute<'info> {
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [RECEIPT_SEED, receipt.request_id.as_ref()],
        bump = receipt.bump,
        constraint = !receipt.settled @ WattzError::ReceiptAlreadySettled,
        constraint = !receipt.disputed @ WattzError::DisputeAlreadyOpen,
    )]
    pub receipt: Account<'info, InferenceReceipt>,

    #[account(
        init,
        payer = opener,
        space = 8 + DisputeAccount::INIT_SPACE,
        seeds = [DISPUTE_SEED, receipt.key().as_ref()],
        bump
    )]
    pub dispute: Account<'info, DisputeAccount>,

    #[account(mut)]
    pub opener: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<OpenDispute>,
    reason_code: u8,
    evidence_hash: [u8; 32],
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let window = ctx.accounts.config.dispute_window_secs;
    let expires_at = ctx
        .accounts
        .receipt
        .timestamp
        .checked_add(window)
        .ok_or(WattzError::ArithmeticOverflow)?;
    require!(now < expires_at, WattzError::DisputeWindowElapsed);
    require!(evidence_hash != [0u8; 32], WattzError::InvalidAttestation);

    let dispute = &mut ctx.accounts.dispute;
    dispute.receipt = ctx.accounts.receipt.key();
    dispute.opener = ctx.accounts.opener.key();
    dispute.reason_code = reason_code;
    dispute.evidence_hash = evidence_hash;
    dispute.resolved = false;
    dispute.resolution = Resolution::Pending;
    dispute.bump = ctx.bumps.dispute;

    let receipt = &mut ctx.accounts.receipt;
    receipt.disputed = true;

    emit!(DisputeOpened {
        dispute: dispute.key(),
        receipt: receipt.key(),
        opener: dispute.opener,
        reason_code,
        evidence_hash,
        timestamp: now,
    });

    Ok(())
}
