"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useNetwork } from "@/contexts/NetworkContext";
import { withRateLimit } from "@/utils/rateLimiter";

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

  const fetchBalance = useCallback(async (fractionMint: PublicKey, retryCount = 0): Promise<bigint> => {
    if (!publicKey || !endpoint) {
      return BigInt(0);
    }

    const maxRetries = 3;
    const baseDelay = 500;

    try {
      const connection = new Connection(endpoint, "confirmed");
      
      // Check both the PDA token account (where fractionalization sends tokens) and regular ATA
      const pdaTokenAccount = getFractionalizerTokenAccount(fractionMint, publicKey);
      const regularATA = getAssociatedTokenAddressSync(fractionMint, publicKey);

      let totalBalance = BigInt(0);

      // Check PDA token account (primary source for fractionalized tokens)
      try {
        const pdaBalance = await withRateLimit(() => connection.getTokenAccountBalance(pdaTokenAccount));
        const pdaAmount = BigInt(pdaBalance.value.amount);
        totalBalance += pdaAmount;
        if (pdaAmount > BigInt(0)) {
          console.log(`Found ${pdaAmount} tokens in PDA account for ${fractionMint.toBase58()}: ${pdaTokenAccount.toBase58()}`);
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        // Check for rate limit errors
        if (errMsg.includes("429") || errMsg.includes("rate limit") || errMsg.includes("Too Many Requests")) {
          if (retryCount < maxRetries) {
            const delay = baseDelay * Math.pow(2, retryCount);
            console.warn(`Rate limited (429) fetching balance for ${fractionMint.toBase58()}, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchBalance(fractionMint, retryCount + 1);
          }
          console.warn(`Rate limited (429) fetching balance for ${fractionMint.toBase58()}, max retries reached`);
          return BigInt(0);
        }
        // PDA account doesn't exist, that's okay
        if (!errMsg.includes("Invalid param") && !errMsg.includes("not found") && !errMsg.includes("could not find account")) {
          console.warn(`Error checking PDA token account ${pdaTokenAccount.toBase58()} for ${fractionMint.toBase58()}:`, err);
        }
      }

      // Also check regular ATA (in case tokens were transferred there)
      try {
        const ataBalance = await withRateLimit(() => connection.getTokenAccountBalance(regularATA));
        totalBalance += BigInt(ataBalance.value.amount);
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        // Check for rate limit errors
        if (errMsg.includes("429") || errMsg.includes("rate limit") || errMsg.includes("Too Many Requests")) {
          if (retryCount < maxRetries) {
            const delay = baseDelay * Math.pow(2, retryCount);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchBalance(fractionMint, retryCount + 1);
          }
          return totalBalance; // Return what we have so far
        }
        // ATA doesn't exist, that's okay
        if (!errMsg.includes("Invalid param") && !errMsg.includes("not found")) {
          console.warn(`Error checking ATA for ${fractionMint.toBase58()}:`, err);
        }
      }

      return totalBalance;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if ((errMsg.includes("429") || errMsg.includes("rate limit") || errMsg.includes("Too Many Requests")) && retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount);
        console.warn(`Rate limited (429) fetching balance for ${fractionMint.toBase58()}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchBalance(fractionMint, retryCount + 1);
      }
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

      // Helper function to fetch balance for a single mint with retry logic
      const fetchSingleBalance = async (mint: PublicKey, retryCount = 0): Promise<bigint> => {
        const maxRetries = 3;
        const baseDelay = 500; // Start with 500ms delay
        
        try {
          // Check both PDA token account and regular ATA
          const pdaTokenAccount = getFractionalizerTokenAccount(mint, publicKey);
          const regularATA = getAssociatedTokenAddressSync(mint, publicKey);

          let totalBalance = BigInt(0);

          // Check PDA token account (where fractionalization sends tokens)
          try {
            const pdaBalance = await withRateLimit(() => connection.getTokenAccountBalance(pdaTokenAccount));
            const pdaAmount = BigInt(pdaBalance.value.amount);
            totalBalance += pdaAmount;
            if (pdaAmount > BigInt(0)) {
              console.log(`[Balance] Found ${pdaAmount} tokens in PDA account for ${mint.toBase58().slice(0, 8)}...: ${pdaTokenAccount.toBase58().slice(0, 8)}...`);
            } else {
              console.debug(`[Balance] PDA account exists but has 0 balance for ${mint.toBase58().slice(0, 8)}...`);
            }
          } catch (err: any) {
            // Check for rate limit errors
            const errMsg = err?.message || String(err);
            if (errMsg.includes("429") || errMsg.includes("rate limit") || errMsg.includes("Too Many Requests")) {
              if (retryCount < maxRetries) {
                const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
                console.warn(`Rate limited (429) fetching balance for ${mint.toBase58()}, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return fetchSingleBalance(mint, retryCount + 1);
              }
              console.warn(`Rate limited (429) fetching balance for ${mint.toBase58()}, max retries reached`);
              return BigInt(0);
            }
            // PDA doesn't exist, that's okay
            if (!errMsg.includes("Invalid param") && !errMsg.includes("not found") && !errMsg.includes("could not find account")) {
              console.warn(`Error checking PDA ${pdaTokenAccount.toBase58()} for ${mint.toBase58()}:`, err);
            }
          }

          // Check regular ATA (in case tokens were transferred)
          try {
            const ataBalance = await withRateLimit(() => connection.getTokenAccountBalance(regularATA));
            const ataAmount = BigInt(ataBalance.value.amount);
            totalBalance += ataAmount;
            if (ataAmount > BigInt(0)) {
              console.log(`[Balance] Found ${ataAmount} tokens in ATA for ${mint.toBase58().slice(0, 8)}...`);
            }
          } catch (err: any) {
            // Check for rate limit errors
            const errMsg = err?.message || String(err);
            if (errMsg.includes("429") || errMsg.includes("rate limit") || errMsg.includes("Too Many Requests")) {
              if (retryCount < maxRetries) {
                const delay = baseDelay * Math.pow(2, retryCount);
                await new Promise(resolve => setTimeout(resolve, delay));
                return fetchSingleBalance(mint, retryCount + 1);
              }
              return totalBalance; // Return what we have so far
            }
            // ATA doesn't exist, that's okay
            if (!errMsg.includes("Invalid param") && !errMsg.includes("not found")) {
              console.warn(`Error checking ATA for ${mint.toBase58()}:`, err);
            }
          }

          if (totalBalance > BigInt(0)) {
            console.log(`[Balance] Total balance for ${mint.toBase58().slice(0, 8)}...: ${totalBalance.toString()}`);
          }
          return totalBalance;
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          if ((errMsg.includes("429") || errMsg.includes("rate limit") || errMsg.includes("Too Many Requests")) && retryCount < maxRetries) {
            const delay = baseDelay * Math.pow(2, retryCount);
            console.warn(`[Balance] Rate limited (429) fetching balance for ${mint.toBase58().slice(0, 8)}..., retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchSingleBalance(mint, retryCount + 1);
          }
          console.error(`[Balance] Error fetching balance for ${mint.toBase58().slice(0, 8)}...:`, err);
          return BigInt(0);
        }
      };

      // Fetch balances incrementally - update state as each balance is fetched
      // Rate limited: stagger requests to prevent 429 errors
      const allPromises = fractionMints.map(async (mint, index) => {
        // Add progressive delay to all requests to prevent rate limiting
        // Use 300ms delay between each request to stay well below rate limits
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 300 * index));
        }
        
        const balance = await fetchSingleBalance(mint);
        
        // Update state immediately as each balance is fetched
        setBalances(prev => {
          const newMap = new Map(prev);
          newMap.set(mint.toBase58(), balance);
          return newMap;
        });
      });
      
      // Wait for all to complete
      await Promise.all(allPromises);

      console.log(`[Balance] Finished fetching all balances`);
    } catch (err) {
      console.error("[Balance] Error fetching token balances:", err);
      // Don't clear balances on error - keep existing ones
    } finally {
      setLoading(false);
    }
  }, [publicKey, endpoint]);

  const updateBalance = useCallback((mint: string, balance: bigint) => {
    setBalances(prev => {
      const newMap = new Map(prev);
      newMap.set(mint, balance);
      console.log(`[Balance] Updated balance for ${mint.slice(0, 8)}... to ${balance.toString()}`);
      return newMap;
    });
  }, []);

  return { balances, loading, fetchBalance, fetchBalances, updateBalance };
}

