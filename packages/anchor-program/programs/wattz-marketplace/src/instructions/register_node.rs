//! `register_node` -- creates a `NodeAccount`, locks the initial stake into
//! the program vault, and initialises (or tops up) the operator's `StakeAccount`.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::WattzError;
use crate::events::NodeRegistered;
use crate::state::{Config, NodeAccount, StakeAccount};

#[derive(Accounts)]
pub struct RegisterNode<'info> {
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = mint,
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = authority,
        space = 8 + NodeAccount::INIT_SPACE,
        seeds = [NODE_SEED, authority.key().as_ref()],
        bump
    )]
    pub node: Account<'info, NodeAccount>,

    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + StakeAccount::INIT_SPACE,
        seeds = [STAKE_SEED, authority.key().as_ref()],
        bump
    )]
    pub stake: Account<'info, StakeAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = staker_token.owner == authority.key(),
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
    ctx: Context<RegisterNode>,
    gpu_model: String,
    region: String,
    endpoint: String,
    initial_stake: u64,
) -> Result<()> {
    require!(
        gpu_model.len() <= MAX_GPU_MODEL_LEN,
        WattzError::StringTooLong
    );
    require!(region.len() <= MAX_REGION_LEN, WattzError::StringTooLong);
    require!(
        endpoint.len() <= MAX_ENDPOINT_LEN,
        WattzError::StringTooLong
    );
    require!(
        initial_stake >= ctx.accounts.config.min_node_stake,
        WattzError::InsufficientStake
    );

    let now = Clock::get()?.unix_timestamp;

    // Move initial stake to program vault.
    let cpi_accounts = Transfer {
        from: ctx.accounts.staker_token.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
        initial_stake,
    )?;

    // Populate node record.
    let node = &mut ctx.accounts.node;
    node.authority = ctx.accounts.authority.key();
    node.gpu_model = gpu_model.clone();
    node.region = region.clone();
    node.endpoint = endpoint.clone();
    node.stake_amount = initial_stake;
    node.reputation = 0;
    node.uptime_last_ping = now;
    node.models_supported = Vec::new();
    node.pending_rewards = 0;
    node.slashed = false;
    node.bump = ctx.bumps.node;

    // Init or top up stake bookkeeping.
    let stake = &mut ctx.accounts.stake;
    if stake.staker == Pubkey::default() {
        stake.staker = ctx.accounts.authority.key();
        stake.bump = ctx.bumps.stake;
        stake.amount = 0;
        stake.lock_until = 0;
    }
    stake.amount = stake
        .amount
        .checked_add(initial_stake)
        .ok_or(WattzError::ArithmeticOverflow)?;
    let new_lock = now
        .checked_add(DEFAULT_STAKE_LOCK_SECS)
        .ok_or(WattzError::ArithmeticOverflow)?;
    if new_lock > stake.lock_until {
        stake.lock_until = new_lock;
    }

    emit!(NodeRegistered {
        node: node.key(),
        authority: node.authority,
        gpu_model,
        region,
        endpoint,
        initial_stake,
        timestamp: now,
    });

    Ok(())
}
