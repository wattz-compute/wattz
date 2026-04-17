//! `submit_inference` -- gateway records an `InferenceReceipt` PDA and moves
//! the price payment from its own token account into the program vault so
//! that `settle_inference` has funds to distribute.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::WattzError;
use crate::events::InferenceSubmitted;
use crate::state::{Config, InferenceReceipt, ModelAccount, NodeAccount};

#[derive(Accounts)]
#[instruction(request_id: [u8; 32])]
pub struct SubmitInference<'info> {
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = mint,
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = gateway,
        space = 8 + InferenceReceipt::INIT_SPACE,
        seeds = [RECEIPT_SEED, request_id.as_ref()],
        bump
    )]
    pub receipt: Account<'info, InferenceReceipt>,

    #[account(
        seeds = [NODE_SEED, node.authority.as_ref()],
        bump = node.bump,
        constraint = !node.slashed @ WattzError::NodeSlashed,
    )]
    pub node: Account<'info, NodeAccount>,

    pub model: Account<'info, ModelAccount>,

    /// CHECK: end-user requester. Only its key is stored on the receipt.
    pub requester: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = gateway.key() == config.gateway @ WattzError::Unauthorized,
    )]
    pub gateway: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = gateway_token.owner == gateway.key(),
        constraint = gateway_token.mint == mint.key(),
    )]
    pub gateway_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault.mint == mint.key(),
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<SubmitInference>,
    request_id: [u8; 32],
    prompt_hash: [u8; 32],
    response_hash: [u8; 32],
    tokens: u32,
    price: u64,
    tee_attestation_hash: [u8; 32],
) -> Result<()> {
    require!(price > 0, WattzError::InvalidPrice);
    require!(
        tee_attestation_hash != [0u8; 32],
        WattzError::InvalidAttestation
    );
    require!(request_id != [0u8; 32], WattzError::InvalidAttestation);

    // KYC gate is a soft on-chain check: the gateway signer bears legal
    // responsibility for having verified the requester off-chain (KYC oracle
    // enrollment). We surface the requirement explicitly so it appears in
    // the IDL / logs.
    if ctx.accounts.model.kyc_gated {
        require!(
            !ctx.accounts.requester.key().eq(&Pubkey::default()),
            WattzError::KycRequired
        );
    }

    // Fund the vault with the price so settle_inference has the balance to
    // distribute (node / publisher / treasury / burn).
    let cpi_accounts = Transfer {
        from: ctx.accounts.gateway_token.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.gateway.to_account_info(),
    };
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
        price,
    )?;

    let now = Clock::get()?.unix_timestamp;

    let receipt = &mut ctx.accounts.receipt;
    receipt.request_id = request_id;
    receipt.node = ctx.accounts.node.key();
    receipt.model = ctx.accounts.model.key();
    receipt.requester = ctx.accounts.requester.key();
    receipt.prompt_hash = prompt_hash;
    receipt.response_hash = response_hash;
    receipt.tokens = tokens;
    receipt.price = price;
    receipt.tee_attestation_hash = tee_attestation_hash;
    receipt.timestamp = now;
    receipt.settled = false;
    receipt.disputed = false;
    receipt.bump = ctx.bumps.receipt;

    emit!(InferenceSubmitted {
        receipt: receipt.key(),
        node: receipt.node,
        model: receipt.model,
        requester: receipt.requester,
        tokens,
        price,
        tee_attestation_hash,
        timestamp: now,
    });

    Ok(())
}
