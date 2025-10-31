import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("DM26SsAwF5NSGVWSebfaUBkYAG3ioLkfFnqt1Vr7pq2P");
export const MPL_BUBBLEGUM_ID = new PublicKey("BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY");
export const SPL_ACCOUNT_COMPRESSION_PROGRAM_ID_V1 = new PublicKey("cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK");
export const SPL_NOOP_PROGRAM_ID_V1 = new PublicKey("noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV");
export const METAPLEX_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

// Protocol fee percentage (hardcoded to 5%)
export const PROTOCOL_PERCENT_FEE = 5;

// Devnet RPC - should be set in environment variables
export const HELIUS_RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || "";