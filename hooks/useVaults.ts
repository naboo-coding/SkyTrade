"use client";

import { useEffect, useCallback, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useNetwork } from "@/contexts/NetworkContext";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PublicKey } from "@solana/web3.js";
import useVaultStore from "@/store/useVaultStore";

// Re-export types from the store so old code doesn't break
export type { VaultStatus, VaultData } from "@/store/useVaultStore";

export function useVaults() {
  const { wallet, publicKey } = useWallet();
  const { endpoint, network } = useNetwork();
  
  // Get everything we need from the store
  const loading = useVaultStore((state) => state.loading);
  const loadingMore = useVaultStore((state) => state.loadingMore);
  const error = useVaultStore((state) => state.error);
  const fetchInitialVaults = useVaultStore((state) => state.fetchInitialVaults);
  const loadMoreVaults = useVaultStore((state) => state.loadMoreVaults);
  const setLoadingMore = useVaultStore((state) => state.setLoadingMore);
  const setupEventListeners = useVaultStore((state) => state.setupEventListeners);
  const cleanupEventListeners = useVaultStore((state) => state.cleanupEventListeners);
  const hasMoreVaults = useVaultStore((state) => state.hasMoreVaults);
  
  // Get the actual values from the store (not the functions)
  const allVaults = useVaultStore((state) => state.allVaults);
  const loadedCount = useVaultStore((state) => state.loadedCount);

  // Get only the vaults we've loaded so far
  const vaults = useMemo(() => {
    // Just return the ones we've loaded
    return allVaults.slice(0, loadedCount);
  }, [allVaults, loadedCount]);

  // Fetch the first 10 vaults when the component mounts
  useEffect(() => {
    if (!endpoint) {
      return;
    }

    // Get the first 10 vaults
    fetchInitialVaults(endpoint, network, wallet?.adapter || null, publicKey || null, 10);

    // Set up event listeners (this is async)
    if (publicKey && wallet?.adapter) {
      setupEventListeners(endpoint, network, wallet.adapter).catch((err) => {
        console.error("[useVaults] Error setting up event listeners:", err);
      });
    }

    // Clean up when the component unmounts
    return () => {
      cleanupEventListeners();
    };
  }, [endpoint, network, wallet?.adapter, publicKey, fetchInitialVaults, setupEventListeners, cleanupEventListeners]);

  // Refetch function - keeps the current loaded count
  const refetch = useCallback(() => {
    if (endpoint && publicKey) {
      const currentLoaded = useVaultStore.getState().loadedCount;
      fetchInitialVaults(endpoint, network, wallet?.adapter || null, publicKey, currentLoaded || 10);
    }
  }, [endpoint, network, wallet?.adapter, publicKey, fetchInitialVaults]);

  // Load more vaults
  const loadMore = useCallback(() => {
    loadMoreVaults(10);
  }, [loadMoreVaults]);

  // Check if there are more vaults to load
  const hasMore = useMemo(() => {
    return loadedCount < allVaults.length;
  }, [loadedCount, allVaults.length]);

  return {
    vaults,
    loading,
    loadingMore,
    error,
    refetch,
    loadMore,
    hasMore,
  };
}

