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

      // 1. Fetch asset and proof
      const nftAssetId = params.assetId;
      const assetWithProof = await getAssetWithProof(umi, umiPublicKey(nftAssetId), {
        truncateCanopy: true,
      });

      if (!assetWithProof.proof || assetWithProof.proof.length === 0) {
        throw new Error("No merkle proof available");
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

      // Sign transaction
      const signedTx = await signTransaction!(versionedTx);
      
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
      console.error("Error fractionalizing cNFT:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fractionalize cNFT";
      setError(errorMessage);
      
      // Log additional error details if it's a SendTransactionError
      if (err && typeof err === 'object' && 'logs' in err) {
        console.error("Transaction logs:", (err as any).logs);
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [publicKey, wallet, endpoint, network]);

  return { fractionalize, loading, error, signature };
}
