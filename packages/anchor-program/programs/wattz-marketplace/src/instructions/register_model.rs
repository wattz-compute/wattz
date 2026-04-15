//! `register_model` -- creates a `ModelAccount` PDA carrying licence metadata.

use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::WattzError;
use crate::events::ModelPublished;
use crate::state::{Config, License, ModelAccount};

#[derive(Accounts)]
#[instruction(name: String, version: String)]
pub struct RegisterModel<'info> {
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = publisher,
        space = 8 + ModelAccount::INIT_SPACE,
        seeds = [
            MODEL_SEED,
            publisher.key().as_ref(),
            name.as_bytes(),
            version.as_bytes(),
        ],
        bump
    )]
    pub model: Account<'info, ModelAccount>,

    #[account(mut)]
    pub publisher: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterModel>,
    name: String,
    version: String,
    license: License,
    ipfs_hash: String,
    price_per_1k_tokens: u64,
    kyc_gated: bool,
) -> Result<()> {
    require!(name.len() <= MAX_MODEL_NAME_LEN, WattzError::StringTooLong);
    require!(!name.is_empty(), WattzError::StringTooLong);
    require!(
        version.len() <= MAX_MODEL_VERSION_LEN,
        WattzError::StringTooLong
    );
    require!(!version.is_empty(), WattzError::StringTooLong);
    require!(
        ipfs_hash.len() <= MAX_IPFS_HASH_LEN,
        WattzError::StringTooLong
    );
    require!(price_per_1k_tokens > 0, WattzError::InvalidPrice);

    let now = Clock::get()?.unix_timestamp;

    let effective_kyc = kyc_gated || license.requires_kyc();

    let model = &mut ctx.accounts.model;
    model.publisher = ctx.accounts.publisher.key();
    model.name = name.clone();
    model.version = version.clone();
    model.license = license;
    model.ipfs_hash = ipfs_hash;
    model.price_per_1k_tokens = price_per_1k_tokens;
    model.kyc_gated = effective_kyc;
    model.bump = ctx.bumps.model;

    emit!(ModelPublished {
        model: model.key(),
        publisher: model.publisher,
        name,
        version,
        license: license.as_u8(),
        price_per_1k_tokens,
        kyc_gated: effective_kyc,
        timestamp: now,
    });

    Ok(())
}
