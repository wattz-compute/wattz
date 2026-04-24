//! `increase_stake` -- top up an existing `StakeAccount` (or create one) and
//! move the tokens into the program vault.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::WattzError;
use crate::events::StakeIncreased;
use crate::state::{Config, StakeAccount};

#[derive(Accounts)]
pub struct IncreaseStake<'info> {
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = mint,
    )]
    pub config: Account<'info, Config>,

    #[account(
        init_if_needed,
        payer = staker,
        space = 8 + StakeAccount::INIT_SPACE,
        seeds = [STAKE_SEED, staker.key().as_ref()],
        bump
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

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<IncreaseStake>,
    amount: u64,
    lock_duration_secs: i64,
) -> Result<()> {
    require!(amount > 0, WattzError::InsufficientStake);
    require!(lock_duration_secs >= 0, WattzError::InvalidPrice);

    let now = Clock::get()?.unix_timestamp;

    let cpi = Transfer {
        from: ctx.accounts.staker_token.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.staker.to_account_info(),
    };
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi),
        amount,
    )?;

    let stake = &mut ctx.accounts.stake;
    if stake.staker == Pubkey::default() {
        stake.staker = ctx.accounts.staker.key();
        stake.bump = ctx.bumps.stake;
        stake.amount = 0;
        stake.lock_until = 0;
    }
    stake.amount = stake
        .amount
        .checked_add(amount)
        .ok_or(WattzError::ArithmeticOverflow)?;
    let requested_lock = now
        .checked_add(lock_duration_secs)
        .ok_or(WattzError::ArithmeticOverflow)?;
    if requested_lock > stake.lock_until {
        stake.lock_until = requested_lock;
    }

    emit!(StakeIncreased {
        stake: stake.key(),
        staker: stake.staker,
        amount,
        total: stake.amount,
        lock_until: stake.lock_until,
        timestamp: now,
    });

    Ok(())
}
