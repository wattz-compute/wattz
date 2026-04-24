//! `slash_node` -- admin burns a portion of a badly-behaving node's stake
//! after reputation crosses the slashing threshold.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::WattzError;
use crate::events::NodeSlashed;
use crate::state::{Config, NodeAccount, StakeAccount};

#[derive(Accounts)]
pub struct SlashNode<'info> {
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = mint,
        constraint = admin.key() == config.admin @ WattzError::Unauthorized,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [NODE_SEED, node.authority.as_ref()],
        bump = node.bump,
    )]
    pub node: Account<'info, NodeAccount>,

    #[account(
        mut,
        seeds = [STAKE_SEED, node.authority.as_ref()],
        bump = stake.bump,
        constraint = stake.staker == node.authority @ WattzError::InvalidNodeAuthority,
    )]
    pub stake: Account<'info, StakeAccount>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = vault.mint == mint.key(),
    )]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: vault authority PDA. Signs the burn CPI.
    #[account(
        seeds = [VAULT_AUTHORITY_SEED],
        bump = config.vault_authority_bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<SlashNode>, slash_amount: u64) -> Result<()> {
    require!(slash_amount > 0, WattzError::InvalidPrice);
    require!(
        ctx.accounts.node.reputation <= MIN_REPUTATION_BEFORE_SLASH,
        WattzError::ReputationAboveSlashingThreshold
    );
    require!(
        ctx.accounts.stake.amount >= slash_amount,
        WattzError::InsufficientStakedAmount
    );

    let bump = ctx.accounts.config.vault_authority_bump;
    let signer_seeds: &[&[&[u8]]] = &[&[VAULT_AUTHORITY_SEED, &[bump]]];

    // Burn the slashed tokens from the vault (removes supply -- protocol
    // treasury never gains from slashing; encourages honest behaviour).
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
        slash_amount,
    )?;

    let stake = &mut ctx.accounts.stake;
    stake.amount = stake
        .amount
        .checked_sub(slash_amount)
        .ok_or(WattzError::ArithmeticOverflow)?;

    let node = &mut ctx.accounts.node;
    node.stake_amount = node
        .stake_amount
        .checked_sub(slash_amount)
        .ok_or(WattzError::ArithmeticOverflow)?;
    node.slashed = true;

    let now = Clock::get()?.unix_timestamp;

    emit!(NodeSlashed {
        node: node.key(),
        authority: node.authority,
        slash_amount,
        remaining_stake: stake.amount,
        reputation: node.reputation,
        timestamp: now,
    });

    Ok(())
}
