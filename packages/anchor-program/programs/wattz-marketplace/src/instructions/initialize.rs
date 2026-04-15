//! `initialize` -- creates the singleton `Config` PDA and the program vault ATA.

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::constants::*;
use crate::events::ProgramInitialized;
use crate::state::Config;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,

    /// $WATTZ SPL mint.
    pub mint: Account<'info, Mint>,

    /// CHECK: PDA vault authority. Owns the vault ATA; validated by seeds only.
    #[account(
        seeds = [VAULT_AUTHORITY_SEED],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// Vault associated-token account, created here.
    #[account(
        init,
        payer = admin,
        associated_token::mint = mint,
        associated_token::authority = vault_authority,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// Treasury token account -- must already exist and hold `mint`.
    #[account(
        constraint = treasury.mint == mint.key(),
    )]
    pub treasury: Account<'info, TokenAccount>,

    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: gateway pubkey persisted into `config.gateway`. Only its key is used.
    pub gateway: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<Initialize>,
    min_node_stake: u64,
    dispute_window_secs: i64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let cfg = &mut ctx.accounts.config;
    cfg.admin = ctx.accounts.admin.key();
    cfg.gateway = ctx.accounts.gateway.key();
    cfg.mint = ctx.accounts.mint.key();
    cfg.treasury = ctx.accounts.treasury.key();
    cfg.min_node_stake = if min_node_stake > 0 {
        min_node_stake
    } else {
        MIN_NODE_STAKE
    };
    // Dispute window may legitimately be 0 (used by mocha tests to fast-settle)
    // -- treat negative as "use default", any non-negative as valid.
    cfg.dispute_window_secs = if dispute_window_secs >= 0 {
        dispute_window_secs
    } else {
        DISPUTE_WINDOW_SECS
    };
    cfg.vault_authority_bump = ctx.bumps.vault_authority;
    cfg.bump = ctx.bumps.config;

    emit!(ProgramInitialized {
        config: cfg.key(),
        admin: cfg.admin,
        gateway: cfg.gateway,
        mint: cfg.mint,
        treasury: cfg.treasury,
        min_node_stake: cfg.min_node_stake,
        dispute_window_secs: cfg.dispute_window_secs,
        timestamp: now,
    });

    Ok(())
}
