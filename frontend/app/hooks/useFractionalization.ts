'use client';

import { useState } from 'react';
import { PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Wallet } from '@coral-xyz/anchor';
import { createUmiInstance, getAssetWithProof } from '../lib/utils/umi';
import { getProgram } from '../lib/utils/program';
import type { CnftData } from '../types';
import { WalletContextState } from '@solana/wallet-adapter-react';

const METAPLEX_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const MPL_BUBBLEGUM_ID = new PublicKey('BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY');
const SPL_ACCOUNT_COMPRESSION_PROGRAM_ID_V1 = new PublicKey('cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK');
const SPL_NOOP_PROGRAM_ID_V1 = new PublicKey('noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV');

import type { FractionalizationParams } from '../types';

export function useFractionalization(connection: any, wallet: WalletContextState | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const fractionalize = async (
    cnft: CnftData,
    params: FractionalizationParams,
    treasury: PublicKey
  ) => {
    if (!wallet || !wallet.publicKey || !connection) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Create UMI instance and fetch asset with proof
      const umi = createUmiInstance(wallet);
      const assetWithProof = await getAssetWithProof(umi, new PublicKey(cnft.id));

      if (!assetWithProof.proof || assetWithProof.proof.length === 0) {
        throw new Error('No merkle proof available');
      }

      // 2. Prepare accounts
      const nftAssetIdWeb3 = new PublicKey(assetWithProof.rpcAsset.id);
      const merkleTreeIdWeb3 = new PublicKey(assetWithProof.merkleTree);

      // Derive PDAs
      const { PROGRAM_ID } = await import('../lib/utils/program');
      
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), nftAssetIdWeb3.toBuffer()],
        PROGRAM_ID
      );

      const [mintAuthorityPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('mint_authority'), vaultPda.toBuffer()],
        PROGRAM_ID
      );

      const [fractionMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('fraction_mint'), vaultPda.toBuffer()],
        PROGRAM_ID
      );

      const [metadataPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata'),
          METAPLEX_PROGRAM_ID.toBuffer(),
          fractionMintPda.toBuffer()
        ],
        METAPLEX_PROGRAM_ID
      );

      const [treeAuthority] = PublicKey.findProgramAddressSync(
        [merkleTreeIdWeb3.toBuffer()],
        MPL_BUBBLEGUM_ID
      );

      // Leaf delegate
      const leafDelegateWeb3 = assetWithProof.leafDelegate
        ? new PublicKey(assetWithProof.leafDelegate)
        : null;

      // Proof accounts
      const proofAccounts = assetWithProof.proof.map((node: string) => ({
        pubkey: new PublicKey(node),
        isWritable: false,
        isSigner: false,
      }));

      // 3. Get program and prepare instruction
      const programWallet: Wallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction!,
        signAllTransactions: wallet.signAllTransactions!,
      };

      const program = getProgram(connection, programWallet);

      const totalSupply = BigInt(parseInt(params.totalSupply) * 1_000_000_000);
      const protocolPercentFee = 5;

      const fractionalizeIx = await program.methods
        .fractionalizeV1(
          totalSupply,
          params.minLpAgeSeconds ? BigInt(parseInt(params.minLpAgeSeconds)) : null,
          params.minReclaimPercent ? parseInt(params.minReclaimPercent) : null,
          params.minLiquidityPercent ? parseInt(params.minLiquidityPercent) : null,
          params.minVolumePercent30d ? parseInt(params.minVolumePercent30d) : null,
          protocolPercentFee,
          Array.from(assetWithProof.root),
          Array.from(assetWithProof.dataHash),
          Array.from(assetWithProof.creatorHash),
          BigInt(assetWithProof.nonce),
          assetWithProof.index,
          cnft.name,
          cnft.symbol,
          cnft.uri
        )
        .accounts({
          fractionalizer: wallet.publicKey,
          treasury: treasury,
          nftAsset: nftAssetIdWeb3,
          merkleTree: merkleTreeIdWeb3,
          treeAuthority: treeAuthority,
          leafDelegate: leafDelegateWeb3,
          compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID_V1,
          logWrapper: SPL_NOOP_PROGRAM_ID_V1,
          metadataAccount: metadataPda,
        })
        .remainingAccounts(proofAccounts)
        .instruction();

      // 4. Build transaction
      const latestBlockhash = await connection.getLatestBlockhash();
      
      const transaction = new Transaction({
        feePayer: wallet.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
      });

      transaction.add(fractionalizeIx);

      // 5. Send and confirm transaction
      const txSignature = await wallet.sendTransaction(transaction, connection);
      setSignature(txSignature);

      await connection.confirmTransaction({
        signature: txSignature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      });

      return txSignature;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fractionalize cNFT';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return { fractionalize, loading, error, signature };
}

