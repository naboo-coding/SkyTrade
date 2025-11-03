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
  Keypair,
  Connection,
  AddressLookupTableProgram,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import umiWithCurrentWalletAdapter from "@/lib/umi/umiWithCurrentWalletAdapter";
import { getAssetWithProof } from "@metaplex-foundation/mpl-bubblegum";
import { publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import { PROGRAM_ID, MPL_BUBBLEGUM_ID, SPL_ACCOUNT_COMPRESSION_PROGRAM_ID_V1, SPL_NOOP_PROGRAM_ID_V1, METAPLEX_PROGRAM_ID, PROTOCOL_PERCENT_FEE } from "@/constants";
import { useNetwork } from "@/contexts/NetworkContext";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import FractionalizationIdl from "../fractionalization.json";
import * as anchor from "@coral-xyz/anchor";
import { parseUserFriendlyError } from "@/utils/errorParser";

interface FractionalizeParams {
  assetId: string; // cNFT Asset ID
  totalSupply: string; // Total supply as string (will be converted to BN with 9 decimals)
  minLpAgeSeconds?: number | null;
  minReclaimPercent?: number | null;
  minLiquidityPercent?: number | null;
  minVolumePercent30d?: number | null;
  treasury?: PublicKey; // Optional treasury address
}

export function useFractionalize() {
  const { publicKey, wallet, signTransaction } = useWallet();
  const { endpoint, network } = useNetwork();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const fractionalize = useCallback(async (params: FractionalizeParams) => {
    if (!publicKey || !wallet?.adapter) {
      throw new Error("Wallet not connected");
    }

    setLoading(true);
    setError(null);
    setSignature(null);

    try {
      // Ensure endpoint is explicitly devnet if we're on devnet
      // WalletAdapterNetwork.Devnet is the constant value "devnet"
      const isDevnet = network === WalletAdapterNetwork.Devnet;
      const devnetEndpoint = isDevnet 
        ? (endpoint.includes("devnet") || endpoint.includes("dev") || endpoint.includes("api.devnet")
           ? endpoint 
           : "https://api.devnet.solana.com")
        : endpoint;
      
      // Initialize UMI for fetching asset and proof
      const umi = umiWithCurrentWalletAdapter();

      // 1. First, validate that the NFT exists
      const nftAssetId = params.assetId;
      let assetData;
      try {
        assetData = await umi.rpc.getAsset(umiPublicKey(nftAssetId));
      } catch (fetchErr: any) {
        const errMsg = fetchErr?.message || String(fetchErr);
        console.error("Error fetching asset:", errMsg);
        
        if (errMsg.includes("not found") || errMsg.includes("404")) {
          throw new Error("NFT not found. If you just minted this NFT, please wait 30-60 seconds for Helius DAS API to index it before trying to fractionalize.");
        }
        throw new Error(`Failed to fetch NFT: ${errMsg}`);
      }

      // Check if asset exists and has valid ownership
      if (!assetData) {
        throw new Error("NFT not found. If you just minted this NFT, please wait 30-60 seconds for indexing to complete.");
      }

      // Check if the NFT is compressed
      if (!assetData.compression?.compressed) {
        throw new Error("This asset is not a compressed NFT (cNFT). Only cNFTs can be fractionalized.");
      }

      // Check ownership - if there's no owner, the NFT may be burned
      const assetOwner = assetData.ownership?.owner;
      if (!assetOwner) {
        throw new Error("This NFT has no owner. It may have been burned.");
      }

      // Verify ownership matches the connected wallet
      const walletAddress = publicKey.toBase58();
      if (assetOwner.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error(`This NFT is owned by a different wallet. Owner: ${assetOwner.slice(0, 8)}...`);
      }

      // 2. Fetch asset and proof (this may fail if NFT is burned OR if it's newly minted and not fully indexed)
      let assetWithProof;
      try {
        assetWithProof = await getAssetWithProof(umi, umiPublicKey(nftAssetId), {
          truncateCanopy: true,
        });
      } catch (proofErr: any) {
        const errMsg = proofErr?.message || String(proofErr);
        console.error("Error fetching merkle proof:", errMsg);
        console.error("Full proof error:", proofErr);
        
        // Only check for burned NFT if we have a very specific error message
        // "Invalid root recomputed from proof" specifically indicates the NFT was burned
        // Other errors might be due to indexing delays or network issues
        if (
          errMsg.includes("Invalid root recomputed from proof") &&
          !errMsg.includes("404") &&
          !errMsg.includes("not found")
        ) {
          throw new Error("This NFT appears to have been burned. The merkle proof is invalid because the NFT no longer exists in the tree.");
        }
        
        // For other errors, provide a more helpful message
        // This could be a newly minted NFT that hasn't been indexed yet
        if (errMsg.includes("not found") || errMsg.includes("404")) {
          throw new Error("Unable to fetch merkle proof. If you just minted this NFT, please wait 30-60 seconds for it to be fully indexed before trying to fractionalize.");
        }
        
        // Generic error with more context
        throw new Error(`Failed to get merkle proof: ${errMsg}. If you just minted this NFT, it may need more time to be indexed. Please wait 30-60 seconds and try again.`);
      }

      if (!assetWithProof.proof || assetWithProof.proof.length === 0) {
        throw new Error("No merkle proof available. If you just minted this NFT, please wait 30-60 seconds for indexing to complete.");
      }

      // Debug: Log proof size
      console.log(`Proof size: ${assetWithProof.proof.length} nodes`);
      console.log(`Proof accounts would add: ${assetWithProof.proof.length * 32} bytes to transaction`);

      // 2. Extract metadata
      const cNftName = assetWithProof.metadata.name;
      const cNftSymbol = assetWithProof.metadata.symbol || "";
      const cNftUri = assetWithProof.metadata.uri || "";

      // 3. Convert to web3.js PublicKeys
      const merkleTreeIdWeb3 = new PublicKey(assetWithProof.merkleTree);
      const nftAssetIdWeb3 = new PublicKey(assetWithProof.rpcAsset.id);

      // 4. Derive tree authority PDA
      const [treeAuthority] = PublicKey.findProgramAddressSync(
        [merkleTreeIdWeb3.toBuffer()],
        MPL_BUBBLEGUM_ID
      );

      // 5. Leaf delegate (if exists)
      const leafDelegateWeb3 = assetWithProof.leafDelegate
        ? new PublicKey(assetWithProof.leafDelegate)
        : null;

      // 6. Prepare proof accounts
      const proofAccounts: AccountMeta[] = assetWithProof.proof.map((node) => ({
        pubkey: new PublicKey(node),
        isWritable: false,
        isSigner: false,
      }));

      // 7. Initialize Anchor program with correct network connection
      const connectionForProvider = new Connection(devnetEndpoint, "confirmed");
      const provider = new AnchorProvider(
        connectionForProvider,
        wallet.adapter as any,
        { commitment: "confirmed" }
      );
      const program = new Program(
        FractionalizationIdl as any,
        provider
      );

      // 8. Derive PDAs
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

      // 9. Treasury (use provided or generate a dummy one for testing)
      const treasury = params.treasury || Keypair.generate().publicKey;

      // 10. Convert total supply to BN (with 9 decimals)
      const totalSupply = new anchor.BN(params.totalSupply)
        .mul(new anchor.BN(10).pow(new anchor.BN(9)));

      // 11. Build fractionalization instruction
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
          PROTOCOL_PERCENT_FEE,
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
          treasury: treasury,
          nftAsset: nftAssetIdWeb3,
          merkleTree: merkleTreeIdWeb3,
          treeAuthority: treeAuthority,
          ...(leafDelegateWeb3 && { leafDelegate: leafDelegateWeb3 }),
          compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID_V1,
          logWrapper: SPL_NOOP_PROGRAM_ID_V1,
          metadataAccount: metadataPda,
        })
        .remainingAccounts(proofAccounts)
        .instruction();

      // 12. Build and send transaction
      const { blockhash, lastValidBlockHeight } = await connectionForProvider.getLatestBlockhash();

      const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 300_000,
      });

      const computePriceIx = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1,
      });

      // 13. Create and extend Address Lookup Table in a single transaction to reduce wallet approvals
      // This combines create + extend into one transaction (reduces from 3 approvals to 2)
      const slot = await connectionForProvider.getSlot();
      const [createLookupTableIx, lookupTableAddress] =
        AddressLookupTableProgram.createLookupTable({
          authority: publicKey,
          payer: publicKey,
          recentSlot: slot - 1,
        });

      // Add all accounts to lookup table
      const lookupTableAddresses = [
        publicKey,
        vaultPda,
        mintAuthorityPda,
        fractionMintPda,
        metadataPda,
        treasury,
        nftAssetIdWeb3,
        merkleTreeIdWeb3,
        treeAuthority,
        ...(leafDelegateWeb3 ? [leafDelegateWeb3] : []),
        SPL_ACCOUNT_COMPRESSION_PROGRAM_ID_V1,
        SPL_NOOP_PROGRAM_ID_V1,
        ...proofAccounts.map(acc => acc.pubkey),
      ];

      const extendLookupTableIx = AddressLookupTableProgram.extendLookupTable({
        payer: publicKey,
        authority: publicKey,
        lookupTable: lookupTableAddress,
        addresses: lookupTableAddresses,
      });

      // Combine create + extend into a single transaction
      const createAndExtendLookupTableTx = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [createLookupTableIx, extendLookupTableIx],
      }).compileToV0Message();

      const createAndExtendVersionedTx = new VersionedTransaction(createAndExtendLookupTableTx);
      const signedCreateAndExtendTx = await signTransaction!(createAndExtendVersionedTx);
      
      // Handle different return types from signTransaction
      let serializedCreateAndExtendTx: Uint8Array;
      const signedTxAny = signedCreateAndExtendTx as any;
      if (signedTxAny instanceof VersionedTransaction) {
        serializedCreateAndExtendTx = signedTxAny.serialize();
      } else if (signedTxAny instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(signedTxAny))) {
        serializedCreateAndExtendTx = signedTxAny;
      } else if (typeof signedTxAny?.serialize === 'function') {
        serializedCreateAndExtendTx = signedTxAny.serialize();
      } else {
        console.error("Unknown signedCreateAndExtendTx type:", typeof signedCreateAndExtendTx);
        throw new Error(`Unable to serialize create and extend lookup table transaction. Received type: ${typeof signedCreateAndExtendTx}`);
      }
      
      const createAndExtendTxSignature = await connectionForProvider.sendRawTransaction(serializedCreateAndExtendTx);
      await connectionForProvider.confirmTransaction({
        signature: createAndExtendTxSignature,
        blockhash,
        lastValidBlockHeight,
      });

      // Wait for lookup table to be activated and get fresh blockhash
      // Wait a bit for the lookup table to be activated
      let lookupTableAccount = await connectionForProvider.getAddressLookupTable(lookupTableAddress);
      let retries = 0;
      while (!lookupTableAccount && retries < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        lookupTableAccount = await connectionForProvider.getAddressLookupTable(lookupTableAddress);
        retries++;
      }
      
      if (!lookupTableAccount || !lookupTableAccount.value) {
        throw new Error("Failed to fetch lookup table");
      }

      // Get fresh blockhash for fractionalization transaction
      const { blockhash: freshBlockhash, lastValidBlockHeight: freshLastValidBlockHeight } = 
        await connectionForProvider.getLatestBlockhash();

      // 14. Build fractionalization transaction using lookup table
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: freshBlockhash,
        instructions: [computeBudgetIx, computePriceIx, fractionalizeIx],
      }).compileToV0Message([lookupTableAccount.value]);

      const versionedTx = new VersionedTransaction(messageV0);

      // Simulate transaction before signing to catch errors early (especially for burned NFTs)
      try {
        const simulationResult = await connectionForProvider.simulateTransaction(versionedTx, {
          replaceRecentBlockhash: true,
          sigVerify: false,
        });

        // Always check logs first, even if there's an error - logs contain the actual failure reason
        if (simulationResult.value.logs && simulationResult.value.logs.length > 0) {
          const logsString = simulationResult.value.logs.join(' ');
          
          // Only check for the EXACT burned NFT indicator - "Invalid root recomputed from proof"
          // This is the specific error that means the NFT was burned
          // Other errors (program IDs, generic merkle tree errors) could be due to other issues
          if (logsString.includes("Invalid root recomputed from proof")) {
            throw new Error("This NFT appears to have been burned. The merkle proof is invalid because the NFT no longer exists in the tree. Please refresh the page to see updated NFT listings.");
          }
        }

        // If there's an error, check it after checking logs
        if (simulationResult.value.err) {
          // Check if the error is related to burned NFT
          const errorString = JSON.stringify(simulationResult.value.err);
          
          // Only check for the EXACT burned NFT error - be very specific
          // "Invalid root recomputed from proof" is the definitive indicator of a burned NFT
          if (errorString.includes("Invalid root recomputed from proof")) {
            throw new Error("This NFT appears to have been burned. The merkle proof is invalid because the NFT no longer exists in the tree. Please refresh the page to see updated NFT listings.");
          }
          
          // For other errors, provide helpful context but don't assume it's burned
          console.error("Transaction simulation failed. Error details:", errorString);
          console.error("Full simulation result:", simulationResult);
          
          // Check if it's instruction 2 (fractionalization) that failed
          if (errorString.includes('"InstructionError":[2,') || (errorString.includes('InstructionError') && errorString.includes('[2,'))) {
            // Instruction 2 is the fractionalization instruction
            // If logs contain the specific burned NFT message, then it's burned
            if (simulationResult.value.logs) {
              const logsString = simulationResult.value.logs.join(' ');
              if (logsString.includes("Invalid root recomputed from proof")) {
                throw new Error("This NFT appears to have been burned. The merkle proof is invalid because the NFT no longer exists in the tree. Please refresh the page to see updated NFT listings.");
              }
            }
            // Otherwise, it's likely a different issue (compute budget, account issues, etc.)
            throw new Error(`Fractionalization instruction failed. Please check the console for details. Error: ${errorString.substring(0, 200)}`);
          }
          
          throw new Error(`Transaction simulation failed: ${errorString.substring(0, 200)}. Please check the console for full error details.`);
        }
      } catch (simErr: any) {
        // If it's already our custom error, re-throw it
        if (simErr.message && simErr.message.includes("burned")) {
          throw simErr;
        }
        
        // Check if the error has logs property (some error formats include logs)
        if (simErr && typeof simErr === 'object') {
          // Check for logs in various possible locations
          const errorLogs = simErr.logs || simErr.simulationResponse?.logs || simErr.value?.logs || [];
          if (Array.isArray(errorLogs) && errorLogs.length > 0) {
            const logsString = errorLogs.join(' ');
            // Only check for the EXACT burned NFT indicator
            if (logsString.includes("Invalid root recomputed from proof")) {
              throw new Error("This NFT appears to have been burned. The merkle proof is invalid because the NFT no longer exists in the tree. Please refresh the page to see updated NFT listings.");
            }
          }
        }
        
        // For other simulation errors, check the error message
        const errMsg = simErr?.message || String(simErr);
        const errString = JSON.stringify(simErr);
        
        // Only check for the EXACT burned NFT error - be very specific
        if (
          errMsg.includes("Invalid root recomputed from proof") ||
          errString.includes("Invalid root recomputed from proof")
        ) {
          throw new Error("This NFT appears to have been burned. The merkle proof is invalid because the NFT no longer exists in the tree. Please refresh the page to see updated NFT listings.");
        }
        
        // For other errors, log them and provide helpful context
        console.error("Transaction simulation error (not a burned NFT):", errMsg);
        console.error("Full error:", simErr);
        
        // Re-throw with helpful context but don't assume it's a burned NFT
        throw new Error(`Transaction simulation failed: ${errMsg.substring(0, 300)}. Please check the console for full details.`);
      }

      // Sign transaction - wallet might reject if simulation fails
      let signedTx;
      try {
        signedTx = await signTransaction!(versionedTx);
      } catch (signErr: any) {
        // Wallet might reject transaction if its own simulation fails
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
      
      // Send transaction
      // Handle different return types from signTransaction
      // Some wallets return VersionedTransaction, others return Uint8Array
      let serializedTx: Uint8Array;
      const signedTxAny2 = signedTx as any;
      if (signedTxAny2 instanceof VersionedTransaction) {
        serializedTx = signedTxAny2.serialize();
      } else if (signedTxAny2 instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(signedTxAny2))) {
        serializedTx = signedTxAny2;
      } else if (typeof signedTxAny2?.serialize === 'function') {
        // Try to call serialize method if it exists
        serializedTx = signedTxAny2.serialize();
      } else {
        // Last resort: try to convert to Uint8Array
        console.error("Unknown signedTx type:", typeof signedTx, signedTx);
        throw new Error(`Unable to serialize transaction. Received type: ${typeof signedTx}. Expected VersionedTransaction or Uint8Array.`);
      }
      
      const txSignature = await connectionForProvider.sendRawTransaction(serializedTx);
      
      await connectionForProvider.confirmTransaction({
        signature: txSignature,
        blockhash: freshBlockhash,
        lastValidBlockHeight: freshLastValidBlockHeight,
      });

      setSignature(txSignature);
      return txSignature;
    } catch (err) {
      // Check for burned NFT errors first (these need special handling)
      let isBurnedNftError = false;
      
      // Check transaction logs for burned NFT indicators
      if (err && typeof err === 'object' && 'logs' in err) {
        const logs = (err as any).logs || [];
        const logString = Array.isArray(logs) ? logs.join(' ') : String(logs);
        
        // Check for specific burned NFT errors in logs
        if (
          logString.includes("Invalid root recomputed from proof") ||
          logString.includes("Error using concurrent merkle tree") ||
          logString.includes("Invalid root recomputed")
        ) {
          isBurnedNftError = true;
        }
      }
      
      // Also check the error message itself for burned NFT errors
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
      
      // Determine error message - always assign a value
      const errorMessage = isBurnedNftError
        ? "This NFT appears to have been burned. When an NFT is burned, the merkle tree root changes, making the proof invalid. Please refresh the page to see updated NFT listings."
        : parseUserFriendlyError(err);
      
      // Only log as error if it's not a burned NFT (user-facing error, not a system error)
      if (!isBurnedNftError) {
        console.error("Error fractionalizing cNFT:", err);
        if (err && typeof err === 'object' && 'logs' in err) {
          const logs = (err as any).logs || [];
          console.error("Transaction logs:", logs);
        }
      }
      
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [publicKey, wallet, endpoint, network]);

  return { fractionalize, loading, error, signature };
}
