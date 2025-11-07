"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { useNetwork } from "@/contexts/NetworkContext";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import FractionalizationIdl from "../fractionalization.json";
import type { Fractionalization } from "../fractionalization2";
import * as anchor from "@coral-xyz/anchor";
import { PROGRAM_ID } from "@/constants";

export type VaultStatus =
  | { active: {} }
  | { reclaimInitiated: {} }
  | { reclaimFinalized: {} }
  | { closed: {} };

export interface VaultData {
  publicKey: PublicKey;
  nftMint: PublicKey;
  nftAssetId: PublicKey;
  fractionMint: PublicKey;
  totalSupply: bigint;
  creator: PublicKey;
  creationTimestamp: bigint;
  status: VaultStatus;
  reclaimTimestamp: bigint;
  twapPriceAtReclaim: bigint;
  totalCompensation: bigint;
  remainingCompensation: bigint;
  bump: number;
  minLpAgeSeconds: bigint;
  minReclaimPercentage: number;
  minLiquidityPercent: number;
  minVolumePercent30d: number;
  reclaimInitiator: PublicKey;
  reclaimInitiationTimestamp: bigint;
  tokensInEscrow: bigint;
}

export function useVaults() {
  const { wallet, publicKey } = useWallet();
  const { endpoint, network } = useNetwork();
  const [vaults, setVaults] = useState<VaultData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVaults = useCallback(async () => {
    if (!endpoint) {
      setError("No RPC endpoint configured");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use a dummy wallet adapter for read-only operations if wallet is not connected
      const dummyWallet = {
        publicKey: publicKey || PublicKey.default,
        signTransaction: async (tx: any) => tx,
        signAllTransactions: async (txs: any[]) => txs,
      };

      const isDevnet = network === WalletAdapterNetwork.Devnet;
      const devnetEndpoint = isDevnet
        ? (endpoint.includes("devnet") || endpoint.includes("dev") || endpoint.includes("api.devnet")
           ? endpoint
           : "https://api.devnet.solana.com")
        : endpoint;

      const connection = new Connection(devnetEndpoint, "confirmed");
      const provider = new AnchorProvider(
        connection,
        (wallet?.adapter || dummyWallet) as any,
        { commitment: "confirmed" }
      );

      const program = new Program<Fractionalization>(
        FractionalizationIdl as any,
        provider
      );

      // Fetch all vault accounts
      const allVaults = await program.account.vault.all();

      // Convert to VaultData format and filter for active vaults
      const sortedVaults: VaultData[] = allVaults
        .map((vault) => {
          const account = vault.account;
          return {
            publicKey: vault.publicKey,
            nftMint: account.nftMint,
            nftAssetId: account.nftAssetId,
            fractionMint: account.fractionMint,
            totalSupply: BigInt(account.totalSupply.toString()),
            creator: account.creator,
            creationTimestamp: BigInt(account.creationTimestamp.toString()),
            status: account.status as VaultStatus,
            reclaimTimestamp: BigInt(account.reclaimTimestamp.toString()),
            twapPriceAtReclaim: BigInt(account.twapPriceAtReclaim.toString()),
            totalCompensation: BigInt(account.totalCompensation.toString()),
            remainingCompensation: BigInt(account.remainingCompensation.toString()),
            bump: account.bump,
            minLpAgeSeconds: BigInt(account.minLpAgeSeconds.toString()),
            minReclaimPercentage: account.minReclaimPercentage,
            minLiquidityPercent: account.minLiquidityPercent,
            minVolumePercent30d: account.minVolumePercent30d,
            reclaimInitiator: account.reclaimInitiator,
            reclaimInitiationTimestamp: BigInt(account.reclaimInitiationTimestamp.toString()),
            tokensInEscrow: BigInt(account.tokensInEscrow.toString()),
          };
        })
        .filter((vault) => {
          // Only show Active vaults
          return vault.status.active !== undefined;
        })
        .sort((a, b) => {
          const aTime = Number(a.creationTimestamp);
          const bTime = Number(b.creationTimestamp);
          return bTime - aTime; // Descending order (newest first)
        });

      setVaults(sortedVaults);
    } catch (err: any) {
      console.error("Error fetching vaults:", err);
      const errorMessage = err?.message || "Failed to fetch vaults";
      setError(errorMessage);
      setVaults([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint, network, wallet, publicKey]);

  useEffect(() => {
    fetchVaults();
  }, [fetchVaults]);

  return {
    vaults,
    loading,
    error,
    refetch: fetchVaults,
  };
}

