use core::fmt;
use anchor_lang::prelude::*;

/// One vault per fractionalised cNFT.
/// Pool address is NOT stored; user supplies it at reclaim time.
#[account]
pub struct Vault {
    pub nft_mint: Pubkey,                 // 32  – cNFT identifier
    pub nft_asset_id: Pubkey,             // 32  – Bubblegum asset id
    pub fraction_mint: Pubkey,            // 32  – SPL mint of fractions
    pub total_supply: u64,                // 8   – user-chosen supply
    pub creator: Pubkey,                  // 32  – fractionaliser
    pub creation_timestamp: i64,          // 8   – unix seconds
    pub status: VaultStatus,              // 1   – Active / Reclaimed / Closed
    pub reclaim_timestamp: i64,           // 8   – when reclaim happened
    pub twap_price_at_reclaim: u64,       // 8   – price used for compensation
    pub total_compensation: u64,          // 8   – total USDC locked
    pub remaining_compensation: u64,      // 8   – USDC still in escrow
    pub bump: u8,                         // 1   – PDA bump

    // Per-vault thresholds (set by fractionaliser in the UI)
    pub min_lp_age_seconds: i64,          // 8   – pool age floor (seconds)
    pub min_reclaim_percentage: u8,       // 1   – 80 % default
    pub min_liquidity_percent: u8,        // 1   – 5 % default
    pub min_volume_percent_30d: u8,       // 1   – 10 % default

    // Escrow period tracking
    pub reclaim_initiator: Pubkey,            // 32 - who initiated the reclaim
    pub reclaim_initiation_timestamp: i64,    // 8  - when escrow period started
    pub tokens_in_escrow: u64,                // 8  - amount of tokens locked in escrow
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug, Copy)]
pub enum VaultStatus {
    Active,               // Fractionalized and tradeable
    ReclaimInitiated,     // Reclaim initialized. Escrow period active, waiting for finalization and frac tokens in escrow
    ReclaimedFinalized,   // Reclaim finalized. cNFT transferred out. Frac tokens burned. USDC escrow with compensation
    Closed,
}

impl Vault {
    pub const INIT_SPACE: usize = 32 + 32 + 32 + 8 + 32 + 8 + 1 + 8 + 8 + 8 + 8 + 1 + 8 + 1 + 1 + 1 + 32 + 8 + 8;
}

impl fmt::Display for VaultStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            VaultStatus::Active => write!(f, "Active"),
            VaultStatus::ReclaimInitiated => write!(f, "ReclaimInitiated"),
            VaultStatus::ReclaimedFinalized => write!(f, "ReclaimedFinalized"),
            VaultStatus::Closed => write!(f, "Closed"),
        }
    }
}