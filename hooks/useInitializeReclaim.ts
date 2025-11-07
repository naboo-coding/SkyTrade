"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import {
  PublicKey,
  AccountMeta,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  Connection,
  SystemProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { useNetwork } from "@/contexts/NetworkContext";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import FractionalizationIdl from "../fractionalization.json";
import type { Fractionalization } from "../fractionalization2";
import * as anchor from "@coral-xyz/anchor";
import { PROGRAM_ID, TREASURY_ACCOUNT, MPL_BUBBLEGUM_ID, SPL_ACCOUNT_COMPRESSION_PROGRAM_ID_V1, SPL_NOOP_PROGRAM_ID_V1 } from "@/constants";
import { VaultData } from "./useVaults";
import umiWithCurrentWalletAdapter from "@/lib/umi/umiWithCurrentWalletAdapter";
import { getAssetWithProof } from "@metaplex-foundation/mpl-bubblegum";
import { publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import { parseUserFriendlyError } from "@/utils/errorParser";

/**
 * Parses reclaim-specific errors into human-friendly messages
 */
function parseReclaimError(err: any, vault: VaultData): string {
  const errorString = String(err?.message || err || "").toLowerCase();
  
  // Try to extract logs from various possible locations
  let errorLogs: string[] = [];
  if (err?.logs && Array.isArray(err.logs)) {
    errorLogs = err.logs;
  } else if (err?.simulationResponse?.value?.logs && Array.isArray(err.simulationResponse.value.logs)) {
    errorLogs = err.simulationResponse.value.logs;
  } else if (err?.response?.logs && Array.isArray(err.response.logs)) {
    errorLogs = err.response.logs;
  }
  
  const logsString = errorLogs.join(" ").toLowerCase();

  // Check for AccountDidNotDeserialize error (Error 3003)
  if (
    errorString.includes("accountdidnotdeserialize") ||
    errorString.includes("error number: 3003") ||
    errorString.includes("error code: accountdidnotdeserialize") ||
    logsString.includes("AccountDidNotDeserialize") ||
    logsString.includes("Error Number: 3003")
  ) {
    // Check if it's the vault account that failed
    if (
      errorString.includes("account: vault") ||
      logsString.includes("account: vault") ||
      logsString.includes("caused by account: vault")
    ) {
      return "The vault account could not be read. This vault may have been closed, or its status may have changed. Please refresh the page to see the current vault status.";
    }
    return "One of the required accounts could not be read. The vault may have been closed or its data may be invalid. Please refresh the page and try again.";
  }

  // Check for custom program error 0xbbb (which is 3003 in decimal - AccountDidNotDeserialize)
  if (errorString.includes("0xbbb") || errorString.includes("custom program error: 0xbbb")) {
    return "The vault account could not be read. This vault may have been closed or its status may have changed. Please refresh the page to see the current vault status.";
  }

  // Check if vault is not active
  if (!vault.status.active) {
    const status = vault.status.reclaimInitiated
      ? "reclaim has already been initiated"
      : vault.status.reclaimFinalized
      ? "reclaim has already been finalized"
      : vault.status.closed
      ? "vault is closed"
      : "vault is not active";
    return `Cannot initialize reclaim: ${status}. Only active vaults can have reclaim initialized.`;
  }

  // Check for insufficient balance
  if (
    errorString.includes("insufficient funds") ||
    errorString.includes("insufficient balance") ||
    errorString.includes("0x1") // InsufficientFunds error
  ) {
    return "Insufficient funds in your wallet. Please ensure you have enough SOL to pay for transaction fees.";
  }

  // Check for invalid proof/merkle tree errors
  if (
    errorString.includes("invalid root") ||
    errorString.includes("merkle proof") ||
    errorString.includes("proof") ||
    logsString.includes("Invalid root")
  ) {
    return "The merkle proof for this NFT is invalid. The NFT may have been burned or the proof may be outdated. Please refresh the page and try again.";
  }

  // Check for simulation errors
  if (errorString.includes("simulation failed") || errorString.includes("transaction simulation")) {
    // Try to extract more specific error from logs
    if (logsString.includes("AccountDidNotDeserialize")) {
      return "The vault account could not be read. This vault may have been closed or its status may have changed. Please refresh the page to see the current vault status.";
    }
    return "Transaction simulation failed. This usually means the vault status has changed or the account data is invalid. Please refresh the page and try again.";
  }

  // Use the general error parser for other errors
  const parsed = parseUserFriendlyError(err);
  
  // If the parsed error is still too technical, provide a reclaim-specific message
  if (
    parsed.includes("Program") ||
    parsed.includes("Instruction") ||
    parsed.includes("0x") ||
    parsed.length > 150
  ) {
    return "Failed to initialize reclaim. The vault may have been closed, or its status may have changed. Please refresh the page to see the current vault status and try again.";
  }

  return parsed;
}

export function useInitializeReclaim() {
  const { publicKey, wallet, signTransaction } = useWallet();
  const { endpoint, network } = useNetwork();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const initializeReclaim = useCallback(async (vault: VaultData): Promise<string | undefined> => {
    if (!publicKey || !wallet?.adapter) {
      throw new Error("Wallet not connected");
    }

    setLoading(true);
    setError(null);
    setSignature(null);

    try {
      const isDevnet = network === WalletAdapterNetwork.Devnet;
      const devnetEndpoint = isDevnet 
        ? (endpoint.includes("devnet") || endpoint.includes("dev") || endpoint.includes("api.devnet")
           ? endpoint 
           : "https://api.devnet.solana.com")
        : endpoint;
      
      const connectionForProvider = new Connection(devnetEndpoint, "confirmed");
      const provider = new AnchorProvider(
        connectionForProvider,
        wallet.adapter as any,
        { commitment: "confirmed" }
      );
      const program = new Program<Fractionalization>(
        FractionalizationIdl as any,
        provider
      );

      // Fetch asset with proof (with rate limit handling)
      const umi = umiWithCurrentWalletAdapter();
      let assetWithProof;
      try {
        assetWithProof = await getAssetWithProof(umi, umiPublicKey(vault.nftAssetId.toBase58()), {
          truncateCanopy: true,
        });
      } catch (proofError: any) {
        const errorMsg = proofError?.message || String(proofError);
        // Check for rate limit errors
        if (errorMsg.includes("429") || errorMsg.includes("rate limit") || errorMsg.includes("Too Many Requests")) {
          throw new Error("Rate limited. Please wait a moment and try again. The server is temporarily limiting requests.");
        }
        throw proofError;
      }

      if (!assetWithProof.proof || assetWithProof.proof.length === 0) {
        throw new Error("No merkle proof available for this asset");
      }

      // Convert to web3.js PublicKeys
      const merkleTreeIdWeb3 = new PublicKey(assetWithProof.merkleTree);
      const nftAssetIdWeb3 = new PublicKey(assetWithProof.rpcAsset.id);

      // Derive tree authority PDA
      const [treeAuthority] = PublicKey.findProgramAddressSync(
        [merkleTreeIdWeb3.toBuffer()],
        MPL_BUBBLEGUM_ID
      );

      // Leaf delegate (if exists)
      const leafDelegateWeb3 = assetWithProof.leafDelegate
        ? new PublicKey(assetWithProof.leafDelegate)
        : null;

      // Prepare proof accounts
      const proofAccounts: AccountMeta[] = assetWithProof.proof.map((node) => ({
        pubkey: new PublicKey(node),
        isWritable: false,
        isSigner: false,
      }));

      // Derive PDAs
      const [compensationEscrowAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from("compensation_escrow"), vault.publicKey.toBuffer()],
        PROGRAM_ID
      );

      // Token escrow is a PDA (not a standard ATA because compensation_escrow_authority is off-curve)
      // Seeds: [compensation_escrow_authority, ATA discriminator, fraction_mint]
      // The ATA discriminator is: [6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121, 172, 28, 180, 133, 237, 95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169]
      const ataDiscriminator = Buffer.from([
        6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121, 172,
        28, 180, 133, 237, 95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169
      ]);
      const [tokenEscrow] = PublicKey.findProgramAddressSync(
        [
          compensationEscrowAuthority.toBuffer(),
          ataDiscriminator,
          vault.fractionMint.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const userFractionedTokenAccount = getAssociatedTokenAddressSync(
        vault.fractionMint,
        publicKey
      );

      // Build initialize reclaim instruction
      const initializeReclaimIx = await program.methods
        .initializeReclaimV1(
          vault.nftAssetId,
          Array.from(assetWithProof.root),
          Array.from(assetWithProof.dataHash),
          Array.from(assetWithProof.creatorHash),
          new anchor.BN(assetWithProof.nonce),
          assetWithProof.index
        )
        .accounts({
          user: publicKey,
          vault: vault.publicKey,
          fractionMint: vault.fractionMint,
          userFractionedTokenAccount: userFractionedTokenAccount,
          compensationEscrowAuthority: compensationEscrowAuthority,
          tokenEscrow: tokenEscrow,
          bubblegumProgram: MPL_BUBBLEGUM_ID,
          compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID_V1,
          merkleTree: merkleTreeIdWeb3,
          treeAuthority: treeAuthority,
          leafDelegate: leafDelegateWeb3 ?? null,
          logWrapper: SPL_NOOP_PROGRAM_ID_V1,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(proofAccounts)
        .instruction();

      // Build and send transaction
      const { blockhash, lastValidBlockHeight } = await connectionForProvider.getLatestBlockhash();

      const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 300_000,
      });

      const computePriceIx = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1,
      });

      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [computeBudgetIx, computePriceIx, initializeReclaimIx],
      }).compileToV0Message();

      const versionedTx = new VersionedTransaction(messageV0);

      if (!signTransaction) {
        throw new Error("Wallet does not support signing transactions");
      }

      const signedTx = await signTransaction(versionedTx);
      const sig = await connectionForProvider.sendRawTransaction(signedTx.serialize());
      
      await connectionForProvider.confirmTransaction({
        signature: sig,
        blockhash,
        lastValidBlockHeight,
      });

      setSignature(sig);
      return sig;
    } catch (err: any) {
      console.error("Error initializing reclaim:", err);
      
      // Parse the error to provide a human-friendly message
      const errorMessage = parseReclaimError(err, vault);
      setError(errorMessage);
      
      // Create a new error with the friendly message
      const friendlyError = new Error(errorMessage);
      throw friendlyError;
    } finally {
      setLoading(false);
    }
  }, [publicKey, wallet, endpoint, network, signTransaction]);

  return { initializeReclaim, loading, error, signature };
}

