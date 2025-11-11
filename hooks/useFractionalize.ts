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
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import umiWithCurrentWalletAdapter from "@/lib/umi/umiWithCurrentWalletAdapter";
import { getAssetWithProof } from "@metaplex-foundation/mpl-bubblegum";
import { publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import { PROGRAM_ID, MPL_BUBBLEGUM_ID, SPL_ACCOUNT_COMPRESSION_PROGRAM_ID_V1, SPL_NOOP_PROGRAM_ID_V1, METAPLEX_PROGRAM_ID, TREASURY_ACCOUNT } from "@/constants";
import { useNetwork } from "@/contexts/NetworkContext";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import FractionalizationIdl from "../fractionalization.json";
import type { Fractionalization } from "../fractionalization2";
import * as anchor from "@coral-xyz/anchor";
import { parseUserFriendlyError } from "@/utils/errorParser";

interface FractionalizeParams {
  assetId: string; // cNFT Asset ID
  totalSupply: string; // Total supply as string (will be converted to BN with 9 decimals)
  minLpAgeSeconds?: number | null;
  minReclaimPercent?: number | null;
  minLiquidityPercent?: number | null;
  minVolumePercent30d?: number | null;
}

export function useFractionalize() {
  const { publicKey, wallet, signTransaction } = useWallet();
  const { endpoint, network } = useNetwork();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const fractionalize = useCallback(async (params: FractionalizeParams): Promise<string | undefined> => {
    if (!publicKey || !wallet?.adapter) {
      throw new Error("Wallet not connected");
    }

    setLoading(true);
    setError(null);
    setSignature(null);

    try {
      // Make sure we're using the right endpoint for devnet
      // WalletAdapterNetwork.Devnet is just the string "devnet"
      const isDevnet = network === WalletAdapterNetwork.Devnet;
      const devnetEndpoint = isDevnet 
        ? (endpoint.includes("devnet") || endpoint.includes("dev") || endpoint.includes("api.devnet")
           ? endpoint 
           : "https://api.devnet.solana.com")
        : endpoint;
      
      // Set up UMI so we can fetch the asset and its proof
      const umi = umiWithCurrentWalletAdapter();

      // First, make sure the NFT actually exists
      const nftAssetId = params.assetId;
      let assetData;
      try {
        assetData = await umi.rpc.getAsset(umiPublicKey(nftAssetId));
      } catch (fetchErr: any) {
        const errMsg = fetchErr?.message || String(fetchErr);
        
        if (errMsg.includes("not found") || errMsg.includes("404")) {
          throw new Error("NFT not found. If you just minted this NFT, please wait 30-60 seconds for Helius DAS API to index it before trying to fractionalize.");
        }
        throw new Error(parseUserFriendlyError(fetchErr));
      }

      // Verify the asset exists and someone actually owns it
      if (!assetData) {
        throw new Error("NFT not found. If you just minted this NFT, please wait 30-60 seconds for indexing to complete.");
      }

      // Make sure it's actually a compressed NFT
      if (!assetData.compression?.compressed) {
        throw new Error("This asset is not a compressed NFT (cNFT). Only cNFTs can be fractionalized.");
      }

      // Check who owns it - if there's no owner, it might be burned
      const assetOwner = assetData.ownership?.owner;
      if (!assetOwner) {
        throw new Error("This NFT has no owner. It may have been burned.");
      }

      // Make sure the connected wallet actually owns this NFT
      const walletAddress = publicKey.toBase58();
      if (assetOwner.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error(`This NFT is owned by a different wallet. Owner: ${assetOwner.slice(0, 8)}...`);
      }

      // Now fetch the asset and its merkle proof
      // This can fail if the NFT was burned or if it's brand new and not indexed yet
      let assetWithProof;
      try {
        assetWithProof = await getAssetWithProof(umi, umiPublicKey(nftAssetId), {
          truncateCanopy: true,
        });
      } catch (proofErr: any) {
        const errMsg = proofErr?.message || String(proofErr);
        
        // Only flag it as burned if we get this specific error
        // "Invalid root recomputed from proof" means the NFT was definitely burned
        // Other errors could just be indexing delays or network hiccups
        if (
          errMsg.includes("Invalid root recomputed from proof") &&
          !errMsg.includes("404") &&
          !errMsg.includes("not found")
        ) {
          throw new Error("This NFT appears to have been burned. The merkle proof is invalid because the NFT no longer exists in the tree.");
        }
        
        // For other errors, give a more helpful message
        // Probably just a new NFT that hasn't been indexed yet
        if (errMsg.includes("not found") || errMsg.includes("404")) {
          throw new Error("Unable to fetch merkle proof. If you just minted this NFT, please wait 30-60 seconds for it to be fully indexed before trying to fractionalize.");
        }
        
        // Use the error parser to make it readable
        throw new Error(parseUserFriendlyError(proofErr));
      }

      if (!assetWithProof.proof || assetWithProof.proof.length === 0) {
        throw new Error("No merkle proof available. If you just minted this NFT, please wait 30-60 seconds for indexing to complete.");
      }

      // Log proof size for debugging
      console.log(`Proof size: ${assetWithProof.proof.length} nodes`);
      console.log(`Proof accounts would add: ${assetWithProof.proof.length * 32} bytes to transaction`);

      // Extract the NFT metadata
      const cNftName = assetWithProof.metadata.name;
      const cNftSymbol = assetWithProof.metadata.symbol || "";
      const cNftUri = assetWithProof.metadata.uri || "";

      // Convert UMI public keys to web3.js format
      const merkleTreeIdWeb3 = new PublicKey(assetWithProof.merkleTree);
      const nftAssetIdWeb3 = new PublicKey(assetWithProof.rpcAsset.id);

      // Derive the tree authority PDA
      const [treeAuthority] = PublicKey.findProgramAddressSync(
        [merkleTreeIdWeb3.toBuffer()],
        MPL_BUBBLEGUM_ID
      );

      // Get the leaf delegate if there is one
      const leafDelegateWeb3 = assetWithProof.leafDelegate
        ? new PublicKey(assetWithProof.leafDelegate)
        : null;

      // Set up the proof accounts for the transaction
      const proofAccounts: AccountMeta[] = assetWithProof.proof.map((node) => ({
        pubkey: new PublicKey(node),
        isWritable: false,
        isSigner: false,
      }));

      // Set up the Anchor program with the right network connection
      const connectionForProvider = new Connection(devnetEndpoint, "confirmed");
      const provider = new AnchorProvider(
        connectionForProvider,
        wallet.adapter as any,
        { commitment: "confirmed" }
      );
      const program = new Program<Fractionalization>(
        FractionalizationIdl,
        provider
      );

      // Derive all the PDAs we need
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), nftAssetIdWeb3.toBuffer()],
        PROGRAM_ID
      );

      const [mintAuthorityPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("mint_authority"), vaultPda.toBuffer()],
        PROGRAM_ID
      );

      const [fractionMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("fraction_mint"), vaultPda.toBuffer()],
        PROGRAM_ID
      );

      const [metadataPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          METAPLEX_PROGRAM_ID.toBuffer(),
          fractionMintPda.toBuffer(),
        ],
        METAPLEX_PROGRAM_ID
      );

      // Convert the total supply to a big number with 9 decimals
      const totalSupply = new anchor.BN(params.totalSupply)
        .mul(new anchor.BN(10).pow(new anchor.BN(9)));

      // Build the actual fractionalization instruction
      const fractionalizeIx = await program.methods
        .fractionalizeV1(
          totalSupply,
          params.minLpAgeSeconds !== null && params.minLpAgeSeconds !== undefined
            ? new anchor.BN(params.minLpAgeSeconds)
            : null,
          params.minReclaimPercent !== null && params.minReclaimPercent !== undefined
            ? params.minReclaimPercent
            : null,
          params.minLiquidityPercent !== null && params.minLiquidityPercent !== undefined
            ? params.minLiquidityPercent
            : null,
          params.minVolumePercent30d !== null && params.minVolumePercent30d !== undefined
            ? params.minVolumePercent30d
            : null,
          Array.from(assetWithProof.root),
          Array.from(assetWithProof.dataHash),
          Array.from(assetWithProof.creatorHash),
          new anchor.BN(assetWithProof.nonce),
          assetWithProof.index,
          cNftName,
          cNftSymbol,
          cNftUri
        )
        .accounts({
          fractionalizer: publicKey,
          treasury: TREASURY_ACCOUNT,
          nftAsset: nftAssetIdWeb3,
          merkleTree: merkleTreeIdWeb3,
          treeAuthority: treeAuthority,
          leafDelegate: leafDelegateWeb3 ?? null,
          compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID_V1,
          logWrapper: SPL_NOOP_PROGRAM_ID_V1,
          metadataAccount: metadataPda,
        })
        .remainingAccounts(proofAccounts)
        .instruction();

      // Build and send the transaction
      const { blockhash, lastValidBlockHeight } = await connectionForProvider.getLatestBlockhash();

      const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 300_000,
      });

      const computePriceIx = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1,
      });

      // Build a versioned transaction with the proof accounts
      // With tree depth 14 and canopy 8, we get max 6 proofs which fits in remaining_accounts
      // So we don't need a lookup table
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [computeBudgetIx, computePriceIx, fractionalizeIx],
      }).compileToV0Message();

      const versionedTx = new VersionedTransaction(messageV0);

      // Simulate the transaction first to catch errors before asking the user to sign
      // This is especially important for burned NFTs
      try {
        const simulationResult = await connectionForProvider.simulateTransaction(versionedTx, {
          replaceRecentBlockhash: true,
          sigVerify: false,
        });

        // Check the logs first - they usually tell us what actually went wrong
        if (simulationResult.value.logs && simulationResult.value.logs.length > 0) {
          const logsString = simulationResult.value.logs.join(' ');
          
          // Only flag it as burned if we see this exact error
          // "Invalid root recomputed from proof" means the NFT was definitely burned
          // Other errors might be something else entirely
          if (logsString.includes("Invalid root recomputed from proof")) {
            throw new Error("This NFT appears to have been burned. The merkle proof is invalid because the NFT no longer exists in the tree. Please refresh the page to see updated NFT listings.");
          }
        }

        // If there's an error, check it after we've looked at the logs
        if (simulationResult.value.err) {
          // Check if the error is related to burned NFT
          const errorString = JSON.stringify(simulationResult.value.err);
          
          // First check if the transaction is too big
          if (
            errorString.includes("too large") ||
            errorString.includes("VersionedTransaction too large") ||
            errorString.includes("max: encoded/raw")
          ) {
            throw new Error("The transaction is too large to process. This can happen with very deep merkle trees. Please try again later or contact support if the issue persists.");
          }
          
          // Only flag as burned if we see this exact error
          // "Invalid root recomputed from proof" is the definitive sign of a burned NFT
          if (errorString.includes("Invalid root recomputed from proof")) {
            throw new Error("This NFT appears to have been burned. The merkle proof is invalid because the NFT no longer exists in the tree. Please refresh the page to see updated NFT listings.");
          }
          
          // For other errors, only log the technical stuff in dev mode
          if (process.env.NODE_ENV === 'development') {
            console.error("Transaction simulation failed. Error details:", errorString);
            console.error("Full simulation result:", simulationResult);
          }
          
          // Check if it's the fractionalization instruction that failed
          if (errorString.includes('"InstructionError":[2,') || (errorString.includes('InstructionError') && errorString.includes('[2,'))) {
            // If the logs say it's burned, then it's definitely burned
            if (simulationResult.value.logs) {
              const logsString = simulationResult.value.logs.join(' ');
              if (logsString.includes("Invalid root recomputed from proof")) {
                throw new Error("This NFT appears to have been burned. The merkle proof is invalid because the NFT no longer exists in the tree. Please refresh the page to see updated NFT listings.");
              }
            }
            // Otherwise, use the error parser to make it readable
            throw new Error(parseUserFriendlyError(simulationResult.value.err));
          }
          
          // Use the error parser to make it readable
          throw new Error(parseUserFriendlyError(simulationResult.value.err));
        }
      } catch (simErr: any) {
        // If it's already one of our custom errors, just throw it again
        if (simErr.message && simErr.message.includes("burned")) {
          throw simErr;
        }
        
        // First check if the transaction is too big
        const errMsg = simErr?.message || String(simErr);
        const errString = JSON.stringify(simErr);
        
        if (
          errMsg.includes("too large") ||
          errMsg.includes("VersionedTransaction too large") ||
          errString.includes("too large") ||
          errString.includes("max: encoded/raw")
        ) {
          throw new Error("The transaction is too large to process. This can happen with very deep merkle trees. Please try again later or contact support if the issue persists.");
        }
        
        // Some error formats include logs, so check for those
        if (simErr && typeof simErr === 'object') {
          // Look for logs in different places the error might have them
          const errorLogs = simErr.logs || simErr.simulationResponse?.logs || simErr.value?.logs || [];
          if (Array.isArray(errorLogs) && errorLogs.length > 0) {
            const logsString = errorLogs.join(' ');
            // Only flag it as burned if we see this exact error
            if (logsString.includes("Invalid root recomputed from proof")) {
              throw new Error("This NFT appears to have been burned. The merkle proof is invalid because the NFT no longer exists in the tree. Please refresh the page to see updated NFT listings.");
            }
          }
        }
        
        // Only flag as burned if we see this exact error
        if (
          errMsg.includes("Invalid root recomputed from proof") ||
          errString.includes("Invalid root recomputed from proof")
        ) {
          throw new Error("This NFT appears to have been burned. The merkle proof is invalid because the NFT no longer exists in the tree. Please refresh the page to see updated NFT listings.");
        }
        
        // For other errors, use the error parser to make it readable
        // Only log technical stuff in dev mode
        if (process.env.NODE_ENV === 'development') {
          console.error("Transaction simulation error:", errMsg);
        }
        
        // Throw it again with a readable message
        throw new Error(parseUserFriendlyError(simErr));
      }

      // Ask the wallet to sign the transaction
      // The wallet might reject it if its own simulation fails
      let signedTx;
      try {
        signedTx = await signTransaction!(versionedTx);
      } catch (signErr: any) {
        // Wallet might reject it if its own simulation fails
        const signErrMsg = signErr?.message || String(signErr);
        if (
          signErrMsg.includes("Invalid root recomputed from proof") ||
          signErrMsg.includes("Error using concurrent merkle tree") ||
          signErrMsg.includes("simulation") ||
          signErrMsg.includes("Simulation failed")
        ) {
          throw new Error("This NFT appears to have been burned. The wallet rejected the transaction because the merkle proof is invalid. Please refresh the page to see updated NFT listings.");
        }
        throw signErr;
      }
      
      // Send the transaction
      // Different wallets return different types from signTransaction
      // Some give us a VersionedTransaction, others give us a Uint8Array
      let serializedTx: Uint8Array;
      const signedTxAny2 = signedTx as any;
      if (signedTxAny2 instanceof VersionedTransaction) {
        serializedTx = signedTxAny2.serialize();
      } else if (signedTxAny2 instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(signedTxAny2))) {
        serializedTx = signedTxAny2;
      } else if (typeof signedTxAny2?.serialize === 'function') {
        // If it has a serialize method, use that
        serializedTx = signedTxAny2.serialize();
      } else {
        // Last resort - we don't know what this is
        console.error("Unknown signedTx type:", typeof signedTx, signedTx);
        throw new Error(`Unable to serialize transaction. Received type: ${typeof signedTx}. Expected VersionedTransaction or Uint8Array.`);
      }
      
      const txSignature = await connectionForProvider.sendRawTransaction(serializedTx);
      
      await connectionForProvider.confirmTransaction({
        signature: txSignature,
        blockhash,
        lastValidBlockHeight,
      });

      setSignature(txSignature);
      return txSignature;
    } catch (err) {
      // Check if this is a burned NFT error first - these need special handling
      let isBurnedNftError = false;
      
      // Look through the transaction logs for signs of a burned NFT
      if (err && typeof err === 'object' && 'logs' in err) {
        const logs = (err as any).logs || [];
        const logString = Array.isArray(logs) ? logs.join(' ') : String(logs);
        
        // Look for specific errors that mean the NFT was burned
        if (
          logString.includes("Invalid root recomputed from proof") ||
          logString.includes("Error using concurrent merkle tree") ||
          logString.includes("Invalid root recomputed")
        ) {
          isBurnedNftError = true;
        }
      }
      
      // Also check the error message itself
      if (!isBurnedNftError) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (
          errorMsg.includes("Invalid root recomputed from proof") &&
          !errorMsg.includes("wait") &&
          !errorMsg.includes("indexed")
        ) {
          isBurnedNftError = true;
        }
      }
      
      // Figure out what error message to show
      const errorMessage = isBurnedNftError
        ? "This NFT appears to have been burned. When an NFT is burned, the merkle tree root changes, making the proof invalid. Please refresh the page to see updated NFT listings."
        : parseUserFriendlyError(err);
      
      // Only log technical stuff in dev mode, and don't log the full stack trace
      if (process.env.NODE_ENV === 'development' && !isBurnedNftError) {
        console.warn("Fractionalization error:", errorMessage);
        if (err && typeof err === 'object' && 'logs' in err) {
          const logs = (err as any).logs || [];
          if (logs.length > 0) {
            console.warn("Transaction logs:", logs);
          }
        }
      }
      
      setError(errorMessage);
      // Don't re-throw - we've already handled it and set the error state
      // The component will show the error to the user
      // Return undefined to indicate failure
      return undefined as any;
    } finally {
      setLoading(false);
    }
  }, [publicKey, wallet, endpoint, network]);

  return { fractionalize, loading, error, signature };
}
