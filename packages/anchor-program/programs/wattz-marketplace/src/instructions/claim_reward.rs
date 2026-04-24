//! `claim_reward` -- node operator withdraws the uptime reward pool that has
//! accumulated over multiple settled inferences.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::WattzError;
use crate::events::RewardClaimed;
use crate::state::{Config, NodeAccount};

#[derive(Accounts)]
pub struct ClaimReward<'info> {
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = mint,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [NODE_SEED, authority.key().as_ref()],
        bump = node.bump,
        has_one = authority,
    )]
    pub node: Account<'info, NodeAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = node_token.mint == mint.key(),
        constraint = node_token.owner == authority.key(),
    )]
    pub node_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault.mint == mint.key(),
    )]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: PDA vault authority. Signs the CPI.
    #[account(
        seeds = [VAULT_AUTHORITY_SEED],
        bump = config.vault_authority_bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ClaimReward>) -> Result<()> {
    let node = &mut ctx.accounts.node;
    require!(node.pending_rewards > 0, WattzError::NoPendingRewards);
    let amount = node.pending_rewards;

    let bump = ctx.accounts.config.vault_authority_bump;
    let signer_seeds: &[&[&[u8]]] = &[&[VAULT_AUTHORITY_SEED, &[bump]]];

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
        amount,
    )?;

    node.pending_rewards = 0;

    let now = Clock::get()?.unix_timestamp;

    emit!(RewardClaimed {
        node: node.key(),
        authority: ctx.accounts.authority.key(),
        amount,
        timestamp: now,
    });

    Ok(())
}
