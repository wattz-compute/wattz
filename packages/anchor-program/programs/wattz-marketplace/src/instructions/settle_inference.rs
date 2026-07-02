//! `settle_inference` -- once the dispute window elapses without a dispute,
//! distribute the price across node / publisher / treasury and burn half of
//! the project fee via a direct SPL Token burn CPI.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::WattzError;
use crate::events::InferenceSettled;
use crate::state::{Config, InferenceReceipt, ModelAccount, NodeAccount};

#[derive(Accounts)]
pub struct SettleInference<'info> {
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = mint,
        has_one = treasury,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [RECEIPT_SEED, receipt.request_id.as_ref()],
        bump = receipt.bump,
        constraint = !receipt.settled @ WattzError::ReceiptAlreadySettled,
        constraint = !receipt.disputed @ WattzError::ReceiptDisputed,
    )]
    pub receipt: Account<'info, InferenceReceipt>,

    #[account(
        mut,
        seeds = [NODE_SEED, node.authority.as_ref()],
        bump = node.bump,
        constraint = receipt.node == node.key() @ WattzError::NodeMismatch,
    )]
    pub node: Account<'info, NodeAccount>,

    #[account(
        constraint = receipt.model == model.key() @ WattzError::ModelMismatch,
    )]
    pub model: Account<'info, ModelAccount>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = vault.mint == mint.key(),
    )]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: PDA authority owning the vault ATA. Verified by seeds+bump.
    #[account(
        seeds = [VAULT_AUTHORITY_SEED],
        bump = config.vault_authority_bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = node_token.mint == mint.key(),
        constraint = node_token.owner == node.authority,
    )]
    pub node_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = publisher_token.mint == mint.key(),
        constraint = publisher_token.owner == model.publisher,
    )]
    pub publisher_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        address = config.treasury,
        constraint = treasury.mint == mint.key(),
    )]
    pub treasury: Account<'info, TokenAccount>,

    /// Anyone may crank the settle once the dispute window has elapsed.
    pub settler: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<SettleInference>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let receipt_ts = ctx.accounts.receipt.timestamp;
    let window = ctx.accounts.config.dispute_window_secs;

    let settle_ready_at = receipt_ts
        .checked_add(window)
        .ok_or(WattzError::ArithmeticOverflow)?;
    require!(now >= settle_ready_at, WattzError::DisputeWindowActive);

    let price = ctx.accounts.receipt.price;
    require!(price > 0, WattzError::InvalidPrice);

    let node_immediate = mul_bps(price, NODE_IMMEDIATE_BPS)?;
    let node_pending = mul_bps(price, NODE_PENDING_BPS)?;
    let publisher_reward = mul_bps(price, PUBLISHER_SHARE_BPS)?;
    let project_fee = price
        .checked_sub(node_immediate)
        .and_then(|v| v.checked_sub(node_pending))
        .and_then(|v| v.checked_sub(publisher_reward))
        .ok_or(WattzError::ArithmeticOverflow)?;
    let burn_amount = mul_bps(project_fee, BURN_RATE_BPS)?;
    let treasury_amount = project_fee
        .checked_sub(burn_amount)
        .ok_or(WattzError::ArithmeticOverflow)?;

    // Vault PDA signer seeds.
    let bump = ctx.accounts.config.vault_authority_bump;
    let signer_seeds: &[&[&[u8]]] = &[&[VAULT_AUTHORITY_SEED, &[bump]]];

    // 1. Immediate node payout.
    if node_immediate > 0 {
        let cpi = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.node_token.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi,
                signer_seeds,
            ),
            node_immediate,
        )?;
    }

    // 2. Publisher royalty.
    if publisher_reward > 0 {
        let cpi = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.publisher_token.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi,
                signer_seeds,
            ),
            publisher_reward,
        )?;
    }

    // 3. Treasury share.
    if treasury_amount > 0 {
        let cpi = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi,
                signer_seeds,
            ),
            treasury_amount,
        )?;
    }

    // 4. Burn half of the project fee (direct SPL Token burn CPI).
    if burn_amount > 0 {
        let cpi = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };
        token::burn(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi,
                signer_seeds,
            ),
            burn_amount,
        )?;
    }

    // 5. Update receipt + node state.
    let node = &mut ctx.accounts.node;
    node.pending_rewards = node
        .pending_rewards
        .checked_add(node_pending)
        .ok_or(WattzError::ArithmeticOverflow)?;
    node.reputation = node
        .reputation
        .saturating_add(REPUTATION_ON_SETTLE)
        .min(MAX_REPUTATION);
    node.uptime_last_ping = now;

    let receipt = &mut ctx.accounts.receipt;
    receipt.settled = true;

    let model_publisher = ctx.accounts.model.publisher;

    emit!(InferenceSettled {
        receipt: receipt.key(),
        node: node.key(),
        publisher: model_publisher,
        node_immediate,
        node_pending,
        publisher_reward,
        treasury_amount,
        burned: burn_amount,
        timestamp: now,
    });

    Ok(())
}

fn mul_bps(amount: u64, bps: u64) -> Result<u64> {
    amount
        .checked_mul(bps)
        .and_then(|v| v.checked_div(BPS_DENOMINATOR))
        .ok_or_else(|| error!(WattzError::ArithmeticOverflow))
}
