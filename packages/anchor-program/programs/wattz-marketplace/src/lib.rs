//! # Wattz Marketplace
//!
//! Anchor 0.31 program for the on-chain marketplace side of the Wattz
//! inference network. Skeleton -- state accounts and instructions land in
//! follow-up commits.

use anchor_lang::prelude::*;

declare_id!("GUDVbE4Jgmtu8jgxUVtq2wUmjdLxJzPqT3zET2EdTLiU");

#[program]
pub mod wattz_marketplace {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
