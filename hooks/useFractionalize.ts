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
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { mplBubblegum, getAssetWithProof } from "@metaplex-foundation/mpl-bubblegum";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import { publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import { PROGRAM_ID, MPL_BUBBLEGUM_ID, SPL_ACCOUNT_COMPRESSION_PROGRAM_ID_V1, SPL_NOOP_PROGRAM_ID_V1, METAPLEX_PROGRAM_ID, PROTOCOL_PERCENT_FEE } from "@/constants";
import { useNetwork } from "@/contexts/NetworkContext";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import FractionalizationIdl from "../fractionalization.json";
import * as anchor from "@coral-xyz/anchor";

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
      // Verify we're using the correct endpoint
      console.log("Fractionalizing on network:", network, "Endpoint:", endpoint);
      
      // Ensure endpoint is explicitly devnet if we're on devnet
      // WalletAdapterNetwork.Devnet is the constant value "devnet"
      const isDevnet = network === WalletAdapterNetwork.Devnet;
      const devnetEndpoint = isDevnet 
        ? (endpoint.includes("devnet") || endpoint.includes("dev") || endpoint.includes("api.devnet")
           ? endpoint 
           : "https://api.devnet.solana.com")
        : endpoint;
      
      // Initialize UMI for fetching asset and proof
      const umi = createUmi(devnetEndpoint)
        .use(walletAdapterIdentity(wallet.adapter))
        .use(mplTokenMetadata())
        .use(mplBubblegum())
        .use(dasApi());

      // 1. First, validate that the NFT exists and is not burned
      const nftAssetId = params.assetId;
      let assetData;
      try {
        assetData = await umi.rpc.getAsset(umiPublicKey(nftAssetId));
      } catch (fetchErr: any) {
        const errMsg = fetchErr?.message || String(fetchErr);
        if (errMsg.includes("not found") || errMsg.includes("404")) {
          throw new Error("This NFT was not found. It may have been burned or deleted.");
        }
        throw new Error(`Failed to fetch NFT: ${errMsg}`);
      }

      // Check if asset exists and has valid ownership
      if (!assetData) {
        throw new Error("This NFT was not found. It may have been burned or deleted.");
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

      // 2. Fetch asset and proof (this will fail if NFT is burned)
      let assetWithProof;
      try {
        assetWithProof = await getAssetWithProof(umi, umiPublicKey(nftAssetId), {
          truncateCanopy: true,
        });
      } catch (proofErr: any) {
        const errMsg = proofErr?.message || String(proofErr);
        // Check for burned NFT indicators
        if (
          errMsg.includes("Invalid root recomputed from proof") ||
          errMsg.includes("Invalid root") ||
          errMsg.includes("root recomputed")
        ) {
          throw new Error("This NFT appears to have been burned. The merkle proof is invalid because the NFT no longer exists in the tree.");
        }
        throw new Error(`Failed to get merkle proof: ${errMsg}`);
      }

      if (!assetWithProof.proof || assetWithProof.proof.length === 0) {
        throw new Error("No merkle proof available. The NFT may have been burned or the merkle tree state may be invalid.");
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

      // 13. Create Address Lookup Table to reduce transaction size
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

      // Create lookup table first
      const createLookupTableTx = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [createLookupTableIx],
      }).compileToV0Message();

      const createLookupTableVersionedTx = new VersionedTransaction(createLookupTableTx);
      const signedCreateLookupTableTx = await signTransaction!(createLookupTableVersionedTx);
      
      const createLookupTableTxSignature = await connectionForProvider.sendRawTransaction(signedCreateLookupTableTx.serialize());
      await connectionForProvider.confirmTransaction({
        signature: createLookupTableTxSignature,
        blockhash,
        lastValidBlockHeight,
      });

      // Get fresh blockhash for extend transaction
      const { blockhash: extendBlockhash, lastValidBlockHeight: extendLastValidBlockHeight } = 
        await connectionForProvider.getLatestBlockhash();

      // Then extend lookup table with all accounts
      const extendLookupTableTx = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: extendBlockhash,
        instructions: [extendLookupTableIx],
      }).compileToV0Message();

      const extendLookupTableVersionedTx = new VersionedTransaction(extendLookupTableTx);
      const signedExtendLookupTableTx = await signTransaction!(extendLookupTableVersionedTx);
      
      const extendLookupTableTxSignature = await connectionForProvider.sendRawTransaction(signedExtendLookupTableTx.serialize());
      await connectionForProvider.confirmTransaction({
        signature: extendLookupTableTxSignature,
        blockhash: extendBlockhash,
        lastValidBlockHeight: extendLastValidBlockHeight,
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
      
      if (!lookupTableAccount) {
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
          console.log("Simulation logs:", simulationResult.value.logs);
          
          // Check for burned NFT indicators in logs
          if (
            logsString.includes("Invalid root recomputed from proof") ||
            logsString.includes("Error using concurrent merkle tree") ||
            logsString.includes("cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK")
          ) {
            throw new Error("This NFT appears to have been burned. The merkle proof is invalid because the NFT no longer exists in the tree. Please refresh the page to see updated NFT listings.");
          }
        }

        // If there's an error, check it after checking logs
        if (simulationResult.value.err) {
          // Check if the error is related to burned NFT
          const errorString = JSON.stringify(simulationResult.value.err);
          console.log("Simulation error:", errorString);
          
          // Even with generic errors, if logs indicate burned NFT, we already threw above
          // For other errors, check if instruction 2 (fractionalization instruction) failed
          // which combined with the logs check above should catch most burned NFT cases
          if (
            errorString.includes("Invalid root recomputed from proof") ||
            errorString.includes("cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK") ||
            errorString.includes("Error using concurrent merkle tree")
          ) {
            throw new Error("This NFT appears to have been burned. The merkle proof is invalid because the NFT no longer exists in the tree. Please refresh the page to see updated NFT listings.");
          }
          
          // If instruction 2 failed and we have logs with merkle tree errors, it's likely a burned NFT
          if (errorString.includes('"InstructionError":[2,') || errorString.includes('InstructionError') && errorString.includes('[2,')) {
            // Check if we have logs (already checked above, but ensure we have them)
            if (simulationResult.value.logs) {
              const logsString = simulationResult.value.logs.join(' ');
              // Double-check logs for burned NFT indicators even with generic instruction error
              if (
                logsString.includes("Invalid root recomputed") ||
                logsString.includes("concurrent merkle tree") ||
                logsString.includes("ReplaceLeaf")
              ) {
                throw new Error("This NFT appears to have been burned. The merkle proof is invalid because the NFT no longer exists in the tree. Please refresh the page to see updated NFT listings.");
              }
            }
          }
          
          throw new Error(`Transaction simulation failed: ${errorString}`);
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
            if (
              logsString.includes("Invalid root recomputed from proof") ||
              logsString.includes("Error using concurrent merkle tree") ||
              logsString.includes("Invalid root recomputed") ||
              logsString.includes("ReplaceLeaf")
            ) {
              throw new Error("This NFT appears to have been burned. The merkle proof is invalid because the NFT no longer exists in the tree. Please refresh the page to see updated NFT listings.");
            }
          }
        }
        
        // For other simulation errors, check the error message
        const errMsg = simErr?.message || String(simErr);
        const errString = JSON.stringify(simErr);
        
        // Check error message and stringified error
        if (
          errMsg.includes("Invalid root recomputed from proof") ||
          errMsg.includes("Error using concurrent merkle tree") ||
          errString.includes("Invalid root recomputed from proof") ||
          errString.includes("Error using concurrent merkle tree") ||
          errString.includes("cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK")
        ) {
          throw new Error("This NFT appears to have been burned. The merkle proof is invalid because the NFT no longer exists in the tree. Please refresh the page to see updated NFT listings.");
        }
        
        // If it's a generic ProgramFailedToComplete at instruction 2, it might be a burned NFT
        // Instruction 2 is the fractionalization instruction which uses the merkle tree
        if (errMsg.includes("ProgramFailedToComplete") || errString.includes("ProgramFailedToComplete")) {
          // Check if instruction 2 failed (the fractionalization instruction that uses merkle proof)
          const hasInstruction2Error = errString.includes('[2,') || 
                                       errString.includes('"InstructionError":[2,') ||
                                       (errString.includes('InstructionError') && errString.includes('[2,'));
          
          if (hasInstruction2Error) {
            // Instruction 2 is the fractionalization instruction which uses merkle tree
            // If it fails with ProgramFailedToComplete, it's very likely due to invalid merkle proof (burned NFT)
            // We'll provide a helpful error message
            throw new Error("Transaction simulation failed at the fractionalization step. This NFT may have been burned or the merkle proof is invalid. When an NFT is burned, the merkle tree root changes, making proofs invalid. Please refresh the page and ensure the NFT still exists before trying again.");
          }
        }
        
        // Re-throw other simulation errors with original message
        throw new Error(`Transaction simulation failed: ${errMsg}`);
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
      const txSignature = await connectionForProvider.sendRawTransaction(signedTx.serialize());
      
      await connectionForProvider.confirmTransaction({
        signature: txSignature,
        blockhash: freshBlockhash,
        lastValidBlockHeight: freshLastValidBlockHeight,
      });

      setSignature(txSignature);
      return txSignature;
    } catch (err) {
      // Parse error to detect burned NFTs first
      let errorMessage = err instanceof Error ? err.message : "Failed to fractionalize cNFT";
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
          errorMessage = "This NFT appears to have been burned. When an NFT is burned, the merkle tree root changes, making the proof invalid. Please refresh the page to see updated NFT listings.";
          isBurnedNftError = true;
        }
      }
      
      // Also check the error message itself
      if (
        errorMessage.includes("Invalid root recomputed from proof") ||
        errorMessage.includes("burned") ||
        errorMessage.includes("no longer exists") ||
        errorMessage.includes("may have been burned") ||
        errorMessage.includes("merkle proof is invalid")
      ) {
        isBurnedNftError = true;
      } else if (
        errorMessage.includes("Program failed to complete") ||
        errorMessage.includes("Simulation failed")
      ) {
        // Generic simulation failure - might be due to burned NFT
        errorMessage = "Transaction simulation failed. This NFT may have been burned or is no longer valid. Please refresh the page and try again.";
      }
      
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
