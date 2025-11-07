"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useNetwork } from "@/contexts/NetworkContext";

// Derive the PDA token account used by the fractionalization program
// This is the account where tokens are sent when you fractionalize (not a regular ATA)
function getFractionalizerTokenAccount(fractionMint: PublicKey, owner: PublicKey): PublicKey {
  // PDA seeds: [owner, ATA discriminator, fraction_mint]
  // ATA discriminator: [6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121, 172, 28, 180, 133, 237, 95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169]
  const ataDiscriminator = Buffer.from([
    6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121, 172,
    28, 180, 133, 237, 95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169
  ]);
  const [pda] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), ataDiscriminator, fractionMint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return pda;
}

export function useTokenBalance() {
  const { publicKey, wallet } = useWallet();
  const { endpoint } = useNetwork();
  const [balances, setBalances] = useState<Map<string, bigint>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchBalance = useCallback(async (fractionMint: PublicKey): Promise<bigint> => {
    if (!publicKey || !endpoint) {
      return BigInt(0);
    }

    try {
      const connection = new Connection(endpoint, "confirmed");
      
      // Check both the PDA token account (where fractionalization sends tokens) and regular ATA
      const pdaTokenAccount = getFractionalizerTokenAccount(fractionMint, publicKey);
      const regularATA = getAssociatedTokenAddressSync(fractionMint, publicKey);

      let totalBalance = BigInt(0);

      // Check PDA token account (primary source for fractionalized tokens)
      try {
        const pdaBalance = await connection.getTokenAccountBalance(pdaTokenAccount);
        const pdaAmount = BigInt(pdaBalance.value.amount);
        totalBalance += pdaAmount;
        if (pdaAmount > BigInt(0)) {
          console.log(`Found ${pdaAmount} tokens in PDA account for ${fractionMint.toBase58()}: ${pdaTokenAccount.toBase58()}`);
        }
      } catch (err: any) {
        // PDA account doesn't exist, that's okay
        const errMsg = err?.message || String(err);
        if (!errMsg.includes("Invalid param") && !errMsg.includes("not found") && !errMsg.includes("could not find account")) {
          console.warn(`Error checking PDA token account ${pdaTokenAccount.toBase58()} for ${fractionMint.toBase58()}:`, err);
        }
      }

      // Also check regular ATA (in case tokens were transferred there)
      try {
        const ataBalance = await connection.getTokenAccountBalance(regularATA);
        totalBalance += BigInt(ataBalance.value.amount);
      } catch (err: any) {
        // ATA doesn't exist, that's okay
        if (!err?.message?.includes("Invalid param") && !err?.message?.includes("not found")) {
          console.warn(`Error checking ATA for ${fractionMint.toBase58()}:`, err);
        }
      }

      return totalBalance;
    } catch (err) {
      console.error("Error fetching token balance:", err);
      return BigInt(0);
    }
  }, [publicKey, endpoint]);

  const fetchBalances = useCallback(async (fractionMints: PublicKey[]) => {
    if (!publicKey || !endpoint || fractionMints.length === 0) {
      setBalances(new Map());
      return;
    }

    setLoading(true);
    try {
      const connection = new Connection(endpoint, "confirmed");
      const balanceMap = new Map<string, bigint>();

      // Fetch all balances in parallel
      const balancePromises = fractionMints.map(async (mint) => {
        try {
          // Check both PDA token account and regular ATA
          const pdaTokenAccount = getFractionalizerTokenAccount(mint, publicKey);
          const regularATA = getAssociatedTokenAddressSync(mint, publicKey);

          let totalBalance = BigInt(0);

          // Check PDA token account (where fractionalization sends tokens)
          try {
            const pdaBalance = await connection.getTokenAccountBalance(pdaTokenAccount);
            const pdaAmount = BigInt(pdaBalance.value.amount);
            totalBalance += pdaAmount;
            if (pdaAmount > BigInt(0)) {
              console.log(`Found ${pdaAmount} tokens in PDA account for ${mint.toBase58()}: ${pdaTokenAccount.toBase58()}`);
            }
          } catch (err: any) {
            // PDA doesn't exist, that's okay
            const errMsg = err?.message || String(err);
            if (!errMsg.includes("Invalid param") && !errMsg.includes("not found") && !errMsg.includes("could not find account")) {
              console.warn(`Error checking PDA ${pdaTokenAccount.toBase58()} for ${mint.toBase58()}:`, err);
            }
          }

          // Check regular ATA (in case tokens were transferred)
          try {
            const ataBalance = await connection.getTokenAccountBalance(regularATA);
            totalBalance += BigInt(ataBalance.value.amount);
          } catch (err: any) {
            // ATA doesn't exist, that's okay
            if (!err?.message?.includes("Invalid param") && !err?.message?.includes("not found")) {
              console.warn(`Error checking ATA for ${mint.toBase58()}:`, err);
            }
          }

          balanceMap.set(mint.toBase58(), totalBalance);
        } catch (err: any) {
          console.error(`Error fetching balance for ${mint.toBase58()}:`, err);
          balanceMap.set(mint.toBase58(), BigInt(0));
        }
      });

      await Promise.all(balancePromises);
      setBalances(balanceMap);
    } catch (err) {
      console.error("Error fetching token balances:", err);
      setBalances(new Map());
    } finally {
      setLoading(false);
    }
  }, [publicKey, endpoint]);

  return { balances, loading, fetchBalance, fetchBalances };
}

