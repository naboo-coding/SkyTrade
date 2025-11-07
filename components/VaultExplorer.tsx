"use client";

import { useState, useEffect, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useVaults, VaultData } from "@/hooks/useVaults";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useInitializeReclaim } from "@/hooks/useInitializeReclaim";
import { useAssetValidation } from "@/hooks/useAssetValidation";
import { useNetwork } from "@/contexts/NetworkContext";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import { publicKey } from "@metaplex-foundation/umi";
import VaultCard from "./VaultCard";
import ReclaimSuccessModal from "./ReclaimSuccessModal";
import ErrorModal from "./ErrorModal";
import { PublicKey } from "@solana/web3.js";

const VAULTS_PER_PAGE = 10;

export default function VaultExplorer() {
  const { vaults, loading, error, refetch } = useVaults();
  const { balances, fetchBalances } = useTokenBalance();
  const { validateAssets, validatedAssets } = useAssetValidation();
  const [displayedCount, setDisplayedCount] = useState(VAULTS_PER_PAGE);
  const [initialized, setInitialized] = useState(false);
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  const { publicKey } = useWallet();
  const { endpoint } = useNetwork();

  // Validate assets when vaults change
  useEffect(() => {
    if (vaults.length > 0) {
      const assetIds = vaults.map((v) => v.nftAssetId.toBase58());
      // Only validate assets that aren't already in cache
      const toValidate = assetIds.filter((id) => !validatedAssets.has(id));
      if (toValidate.length > 0) {
        validateAssets(toValidate);
      }
    }
  }, [vaults, validateAssets, validatedAssets]);

  const filteredVaults = useMemo(() => {
    let filtered = vaults;

    // Filter by creator if "Show only mine" is checked
    if (showOnlyMine && publicKey) {
      filtered = filtered.filter((vault) => vault.creator.toBase58() === publicKey.toBase58());
    }

    // Filter out placeholder/test NFTs that don't have block hash/tree data
    // Temporarily disabled - show all vaults until we debug validation
    // TODO: Re-enable after fixing validation
    /*
    filtered = filtered.filter((vault) => {
      const assetId = vault.nftAssetId.toBase58();
      const isValid = validatedAssets.get(assetId);
      // If validation result is false, filter it out
      // If validation hasn't completed yet (undefined), keep it for now (will be filtered on next render)
      if (isValid === false) {
        console.log(`[VaultExplorer] Filtering out vault ${assetId.slice(0, 8)}... (validation failed)`);
      }
      return isValid !== false;
    });
    */

    console.log(`[VaultExplorer] Filtered vaults: ${filtered.length} of ${vaults.length} (validated: ${validatedAssets.size})`);
    return filtered;
  }, [vaults, showOnlyMine, publicKey, validatedAssets]);

  // Fetch balances when vaults change (only if wallet is connected)
  useEffect(() => {
    if (filteredVaults.length > 0 && publicKey) {
      const fractionMints = filteredVaults.map((v) => v.fractionMint);
      console.log(`Fetching balances for ${fractionMints.length} vaults, wallet: ${publicKey.toBase58()}`);
      fetchBalances(fractionMints);
      setInitialized(true);
    } else if (!publicKey) {
      setInitialized(false);
    }
  }, [filteredVaults, fetchBalances, publicKey]);

  const displayedVaults = useMemo(() => {
    return filteredVaults.slice(0, displayedCount);
  }, [filteredVaults, displayedCount]);

  const handleLoadMore = () => {
    setDisplayedCount((prev) => prev + VAULTS_PER_PAGE);
    // Fetch balances for newly displayed vaults if needed
    if (displayedCount < filteredVaults.length) {
      const newVaults = filteredVaults.slice(displayedCount, displayedCount + VAULTS_PER_PAGE);
      const newMints = newVaults.map((v) => v.fractionMint);
      if (newMints.length > 0 && publicKey) {
        fetchBalances(newMints);
      }
    }
  };

  const { initializeReclaim, loading: reclaimLoading, error: reclaimError } = useInitializeReclaim();
  const [processingVault, setProcessingVault] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    signature: string;
    vaultName?: string;
  }>({ isOpen: false, signature: "" });
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    message: string;
  }>({ isOpen: false, message: "" });

  const handleInitializeReclaim = async (vault: VaultData) => {
    if (!publicKey) {
      setErrorModal({
        isOpen: true,
        message: "Please connect your wallet to initialize reclaim.",
      });
      return;
    }

    if (reclaimLoading || processingVault) {
      return;
    }

    setProcessingVault(vault.publicKey.toBase58());
    try {
      const signature = await initializeReclaim(vault);
      if (signature) {
        // Fetch the NFT name from the asset
        let vaultName: string | undefined;
        try {
          const umi = createUmi(endpoint).use(dasApi());
          const assetData = await umi.rpc.getAsset(publicKey(vault.nftAssetId.toBase58()));
          const metadata = assetData.content?.metadata || {};
          const jsonUri = assetData.content?.json_uri as string | undefined;
          const metadataUri = metadata.uri as string | undefined || jsonUri;
          
          // Try to get name from direct metadata first
          vaultName = metadata.name as string | undefined;
          
          // If not found, try fetching from metadata URI
          if (!vaultName && metadataUri) {
            try {
              const response = await fetch(metadataUri, { mode: 'cors' });
              if (response.ok) {
                const json = await response.json();
                vaultName = json.name;
              }
            } catch {
              // Silently fail
            }
          }
        } catch {
          // If we can't fetch the name, use a fallback
          vaultName = vault.nftAssetId ? `Vault ${vault.nftAssetId.toBase58().slice(0, 8)}...` : undefined;
        }
        
        setSuccessModal({
          isOpen: true,
          signature,
          vaultName: vaultName || `Vault ${vault.nftAssetId.toBase58().slice(0, 8)}...`,
        });

        // Refetch vaults to update status
        setTimeout(() => {
          refetch();
          // Refetch balances
          if (publicKey) {
            const fractionMints = filteredVaults.map((v) => v.fractionMint);
            fetchBalances(fractionMints);
          }
        }, 2000);
      }
    } catch (err: any) {
      const errorMsg = err?.message || "Failed to initialize reclaim";
      setErrorModal({
        isOpen: true,
        message: errorMsg,
      });
      console.error("Failed to initialize reclaim:", err);
    } finally {
      setProcessingVault(null);
    }
  };

  if (loading && vaults.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading vaults...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">Error loading vaults: {error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (vaults.length === 0 && !loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-2">No vaults found</p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            {error ? `Error: ${error}` : "No active vaults in the protocol"}
          </p>
        </div>
      </div>
    );
  }

  if (filteredVaults.length === 0 && vaults.length > 0 && !loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-2">No vaults match the current filters</p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            {showOnlyMine 
              ? "You haven't created any vaults, or all vaults are being validated..."
              : "All vaults are being validated or filtered out..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-light text-gray-900 dark:text-white mb-2 tracking-tight">
              Vault Explorer
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {showOnlyMine ? "Your fractionalized cNFTs" : "Explore all fractionalized cNFTs"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {publicKey && (
              <>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyMine}
                    onChange={(e) => {
                      setShowOnlyMine(e.target.checked);
                      setDisplayedCount(VAULTS_PER_PAGE); // Reset pagination when filtering
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Show only mine</span>
                </label>
                <button
                  onClick={() => {
                    const fractionMints = filteredVaults.map((v) => v.fractionMint);
                    console.log("Manual refresh: Fetching balances for", fractionMints.length, "vaults");
                    fetchBalances(fractionMints);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
                  disabled={loading}
                >
                  {loading ? "Refreshing..." : "Refresh Balances"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {displayedVaults.map((vault) => {
          const balance = balances.get(vault.fractionMint.toBase58()) || BigInt(0);
          return (
            <VaultCard
              key={vault.publicKey.toBase58()}
              vault={vault}
              userBalance={balance}
              onInitializeReclaim={handleInitializeReclaim}
              isProcessing={processingVault === vault.publicKey.toBase58() || reclaimLoading}
            />
          );
        })}
      </div>

      {displayedCount < filteredVaults.length && (
        <div className="flex justify-center mt-8">
          <button
            onClick={handleLoadMore}
            className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Load More
          </button>
        </div>
      )}

      {filteredVaults.length > 0 && (
        <div className="text-center mt-6 text-sm text-gray-500 dark:text-gray-400">
          Showing {displayedVaults.length} of {filteredVaults.length} vaults
          {showOnlyMine && publicKey && ` (created by you)`}
        </div>
      )}

      {showOnlyMine && filteredVaults.length === 0 && publicKey && (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">
            You haven't created any vaults yet. Fractionalize your cNFTs to see them here.
          </p>
        </div>
      )}

      {/* Success Modal */}
      <ReclaimSuccessModal
        isOpen={successModal.isOpen}
        transactionSignature={successModal.signature}
        vaultName={successModal.vaultName}
        onClose={() => setSuccessModal({ isOpen: false, signature: "" })}
      />

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        message={errorModal.message}
        title="Reclaim Initialization Failed"
        onClose={() => setErrorModal({ isOpen: false, message: "" })}
      />
    </div>
  );
}

