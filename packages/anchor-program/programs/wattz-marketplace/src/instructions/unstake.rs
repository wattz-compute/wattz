//! `unstake` -- move staked tokens from the program vault back to the
//! staker's wallet, once the lock period has elapsed.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::WattzError;
use crate::events::StakeReleased;
use crate::state::{Config, StakeAccount};

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = mint,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [STAKE_SEED, staker.key().as_ref()],
        bump = stake.bump,
        has_one = staker,
    )]
    pub stake: Account<'info, StakeAccount>,

    #[account(mut)]
    pub staker: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = staker_token.owner == staker.key(),
        constraint = staker_token.mint == mint.key(),
    )]
    pub staker_token: Account<'info, TokenAccount>,

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

pub fn handler(ctx: Context<Unstake>, amount: u64) -> Result<()> {
    require!(amount > 0, WattzError::InsufficientStake);

    let now = Clock::get()?.unix_timestamp;
    require!(now >= ctx.accounts.stake.lock_until, WattzError::StakeLocked);
    require!(
        ctx.accounts.stake.amount >= amount,
        WattzError::InsufficientStakedAmount
    );

    let bump = ctx.accounts.config.vault_authority_bump;
    let signer_seeds: &[&[&[u8]]] = &[&[VAULT_AUTHORITY_SEED, &[bump]]];

    let cpi = Transfer {
        from: ctx.accounts.vault.to_account_info(),
        to: ctx.accounts.staker_token.to_account_info(),
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

    let stake = &mut ctx.accounts.stake;
    stake.amount = stake
        .amount
        .checked_sub(amount)
        .ok_or(WattzError::ArithmeticOverflow)?;

    emit!(StakeReleased {
        stake: stake.key(),
        staker: stake.staker,
        amount,
        remaining: stake.amount,
        timestamp: now,
    });

    Ok(())
}
