"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useVaults, VaultData } from "@/hooks/useVaults";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useInitializeReclaim } from "@/hooks/useInitializeReclaim";
import { useAssetValidation } from "@/hooks/useAssetValidation";
import { useNetwork } from "@/contexts/NetworkContext";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import { publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import VaultCard from "./VaultCard";
import ReclaimSuccessModal from "./ReclaimSuccessModal";
import ErrorModal from "./ErrorModal";
import { PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import FractionalizationIdl from "../fractionalization.json";
import type { Fractionalization } from "../fractionalization2";
import { withRateLimit } from "@/utils/rateLimiter";

const VAULTS_PER_PAGE = 10;
const ESCROW_PERIOD_SECONDS = 7 * 24 * 60 * 60; // 7 days

interface EscrowData {
  vault: VaultData;
  tokensInEscrow: bigint;
  remainingCompensation: bigint;
  escrowEndsAt: bigint | null;
  isEscrowActive: boolean;
  nftName?: string;
  nftImage?: string;
}

function formatTokenAmount(amount: bigint, decimals: number = 6): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fractional = amount % divisor;
  if (fractional === BigInt(0)) {
    return whole.toString();
  }
  const fractionalStr = fractional.toString().padStart(decimals, "0");
  const trimmed = fractionalStr.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

function formatDate(timestamp: bigint): string {
  const date = new Date(Number(timestamp) * 1000);
  // Use toLocaleString to ensure local timezone is used
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

interface VaultExplorerProps {
  onEscrowPanelChange?: (isOpen: boolean) => void;
}

export default function VaultExplorer({ onEscrowPanelChange }: VaultExplorerProps) {
  const { vaults, loading, error, refetch } = useVaults();
  const { balances, loading: balancesLoading, fetchBalances, updateBalance } = useTokenBalance();
  const { validateAssets, validatedAssets } = useAssetValidation();
  const [displayedCount, setDisplayedCount] = useState(VAULTS_PER_PAGE);
  const [initialized, setInitialized] = useState(false);
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [showEscrowPanel, setShowEscrowPanel] = useState(false);
  const [escrowData, setEscrowData] = useState<EscrowData[]>([]);
  const [loadingEscrow, setLoadingEscrow] = useState(false);

  const { publicKey, wallet } = useWallet();
  const { endpoint, network } = useNetwork();

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
  // Initialize with empty balances immediately so UI can render
  useEffect(() => {
    if (filteredVaults.length > 0 && publicKey) {
      const fractionMints = filteredVaults.map((v) => v.fractionMint);
      console.log(`[VaultExplorer] Fetching balances for ${fractionMints.length} vaults, wallet: ${publicKey.toBase58().slice(0, 8)}...`);
      
      // Initialize all balances to 0 immediately so UI renders
      const initialBalances = new Map<string, bigint>();
      fractionMints.forEach(mint => {
        initialBalances.set(mint.toBase58(), BigInt(0));
      });
      // Don't set initial balances here - let them load incrementally
      
      // Start fetching balances (will update incrementally)
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

  // Fetch all vaults (including reclaimed) for escrow display
  const fetchEscrowVaults = useCallback(async () => {
    if (!endpoint) return;

    setLoadingEscrow(true);
    try {
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

      // Fetch all vault accounts (including reclaimed)
      const allVaults = await program.account.vault.all();
      console.log(`[Escrow] Fetched ${allVaults.length} total vaults`);

      // Filter for vaults with escrow data
      const vaultsWithEscrow = allVaults
        .map((v) => {
          const account = v.account;
          return {
            publicKey: v.publicKey,
            nftMint: account.nftMint,
            nftAssetId: account.nftAssetId,
            fractionMint: account.fractionMint,
            totalSupply: BigInt(account.totalSupply.toString()),
            creator: account.creator,
            creationTimestamp: BigInt(account.creationTimestamp.toString()),
            status: account.status as any,
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
          } as VaultData;
        })
        .filter((vault) => {
          const isReclaimInitiated = "reclaimInitiated" in vault.status;
          const isReclaimFinalized = "reclaimFinalized" in vault.status;
          const hasTokens = vault.tokensInEscrow > BigInt(0);
          const hasCompensation = vault.remainingCompensation > BigInt(0);
          
          // Log vault status for debugging
          if (isReclaimInitiated || isReclaimFinalized) {
            console.log(`[Escrow] Found vault ${vault.publicKey.toBase58().slice(0, 8)}...`, {
              status: vault.status,
              isReclaimInitiated,
              isReclaimFinalized,
              tokensInEscrow: vault.tokensInEscrow.toString(),
              remainingCompensation: vault.remainingCompensation.toString(),
              hasTokens,
              hasCompensation,
            });
          }
          
          // Show all vaults in reclaimInitiated or reclaimFinalized status
          // Even if tokens/compensation are 0, they might be in the process
          return isReclaimInitiated || isReclaimFinalized;
        });
      
      console.log(`[Escrow] Filtered to ${vaultsWithEscrow.length} vaults with escrow status`);

      // Fetch NFT metadata and build escrow data
      const escrowDataList: EscrowData[] = [];
      for (let i = 0; i < vaultsWithEscrow.length; i++) {
        const vault = vaultsWithEscrow[i];
        try {
          // Add delay between iterations to prevent rate limiting
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between vault metadata fetches
          }
          
          const now = BigInt(Math.floor(Date.now() / 1000));
          const escrowEndsAt =
            vault.reclaimInitiationTimestamp > BigInt(0)
              ? vault.reclaimInitiationTimestamp + BigInt(ESCROW_PERIOD_SECONDS)
              : null;
          const isEscrowActive = escrowEndsAt
            ? now < escrowEndsAt
            : false;
          
          // Debug logging for timestamp issues
          if (escrowEndsAt) {
            console.log(`[Escrow] Vault ${vault.publicKey.toBase58().slice(0, 8)}... timestamps:`, {
              reclaimInitiationTimestamp: vault.reclaimInitiationTimestamp.toString(),
              escrowEndsAt: escrowEndsAt.toString(),
              now: now.toString(),
              reclaimInitiationDate: new Date(Number(vault.reclaimInitiationTimestamp) * 1000).toLocaleString(),
              escrowEndsAtDate: new Date(Number(escrowEndsAt) * 1000).toLocaleString(),
              nowDate: new Date(Number(now) * 1000).toLocaleString(),
            });
          }

          let nftName: string | undefined;
          let nftImage: string | undefined;

          try {
            const umi = createUmi(endpoint).use(dasApi());
            const assetData = await withRateLimit(() => umi.rpc.getAsset(umiPublicKey(vault.nftAssetId.toBase58())));
            const metadata = assetData.content?.metadata || {};
            const jsonUri = assetData.content?.json_uri as string | undefined;
            const metadataUri = metadata.uri as string | undefined || jsonUri;

            nftName = metadata.name as string | undefined;

            if (assetData.content?.files && assetData.content.files.length > 0) {
              nftImage = assetData.content.files[0].uri as string | undefined;
            }

            if (!nftImage && metadataUri) {
              try {
                const response = await fetch(metadataUri, { mode: "cors" });
                if (response.ok && response.status !== 429) {
                  const json = await response.json();
                  nftName = nftName || json.name;
                  nftImage = nftImage || json.image;
                }
              } catch (err) {
                // Silently fail
              }
            }
          } catch (err) {
            // Silently fail metadata fetch
          }

          escrowDataList.push({
            vault,
            tokensInEscrow: vault.tokensInEscrow,
            remainingCompensation: vault.remainingCompensation,
            escrowEndsAt,
            isEscrowActive,
            nftName,
            nftImage,
          });
        } catch (err) {
          console.error(`Error processing vault ${vault.publicKey.toBase58()}:`, err);
        }
      }

      // Sort by most recent first (active first, then by most recent reclaim initiation time)
      escrowDataList.sort((a, b) => {
        if (a.isEscrowActive !== b.isEscrowActive) {
          return a.isEscrowActive ? -1 : 1;
        }
        // Sort by reclaim initiation timestamp (most recent first)
        const aTime = Number(a.vault.reclaimInitiationTimestamp);
        const bTime = Number(b.vault.reclaimInitiationTimestamp);
        return bTime - aTime; // Descending order (newest first)
      });

      setEscrowData(escrowDataList);
    } catch (err: any) {
      console.error("Error fetching escrow vaults:", err);
      setEscrowData([]);
    } finally {
      setLoadingEscrow(false);
    }
  }, [endpoint, network, wallet, publicKey]);

  // Fetch escrow data when panel is opened
  useEffect(() => {
    if (showEscrowPanel) {
      fetchEscrowVaults();
    }
  }, [showEscrowPanel, fetchEscrowVaults]);

  // Notify parent when escrow panel state changes
  useEffect(() => {
    onEscrowPanelChange?.(showEscrowPanel);
  }, [showEscrowPanel, onEscrowPanelChange]);

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
        // Fetch the NFT name from the asset (with rate limit handling)
        let vaultName: string | undefined;
        try {
          const umi = createUmi(endpoint).use(dasApi());
          const assetData = await withRateLimit(() => umi.rpc.getAsset(umiPublicKey(vault.nftAssetId.toBase58())));
          const metadata = assetData.content?.metadata || {};
          const jsonUri = assetData.content?.json_uri as string | undefined;
          const metadataUri = metadata.uri as string | undefined || jsonUri;
          
          // Try to get name from direct metadata first
          vaultName = metadata.name as string | undefined;
          
          // If not found, try fetching from metadata URI (with rate limit protection)
          if (!vaultName && metadataUri) {
            try {
              const response = await fetch(metadataUri, { 
                mode: 'cors',
              });
              
              // Check for rate limit errors
              if (response.status === 429) {
                console.warn(`Rate limited (429) when fetching metadata for vault ${vault.publicKey.toBase58().slice(0, 8)}...`);
                // Skip metadata fetch, use fallback name
              } else if (response.ok) {
                const json = await response.json();
                vaultName = json.name;
              }
            } catch (err: any) {
              const errorMsg = err?.message || String(err);
              // Only log non-rate-limit errors
              if (!errorMsg.includes('429') && !errorMsg.includes('Rate limited')) {
                console.debug(`Failed to fetch metadata for vault:`, errorMsg);
              }
              // Silently fail for rate limits
            }
          }
        } catch (err: any) {
          const errorMsg = err?.message || String(err);
          // Check for rate limit errors
          if (errorMsg.includes("429") || errorMsg.includes("rate limit") || errorMsg.includes("Too Many Requests")) {
            console.warn(`Rate limited (429) when fetching asset for vault ${vault.publicKey.toBase58().slice(0, 8)}...`);
          }
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

  // Show message when wallet is not connected
  if (!publicKey && !loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Connect your wallet to view your vaults
          </p>
        </div>
      </div>
    );
  }

  if (vaults.length === 0 && !loading && publicKey) {
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
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-2xl font-medium text-gray-900 dark:text-white mb-1 tracking-tight">
                Vault Explorer
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {showOnlyMine ? "Your fractionalized cNFTs" : "Explore all fractionalized cNFTs"}
              </p>
            </div>
            <button
              onClick={() => setShowEscrowPanel(true)}
              className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              title="View Escrow"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2.5">
            {publicKey && (
              <>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyMine}
                    onChange={(e) => {
                      setShowOnlyMine(e.target.checked);
                      setDisplayedCount(VAULTS_PER_PAGE);
                    }}
                    className="w-3.5 h-3.5 text-gray-900 dark:text-gray-100 rounded focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600"
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400">Show only mine</span>
                </label>
                <button
                  onClick={() => {
                    const fractionMints = filteredVaults.map((v) => v.fractionMint);
                    console.log("Manual refresh: Fetching balances for", fractionMints.length, "vaults");
                    fetchBalances(fractionMints);
                  }}
                  className="px-3 py-1.5 bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 rounded-lg font-medium transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  disabled={loading || balancesLoading}
                >
                  {loading || balancesLoading ? (
                    <span className="flex items-center gap-1.5">
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent"></div>
                      Refreshing...
                    </span>
                  ) : (
                    "Refresh"
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {displayedVaults.map((vault) => {
          const balance = balances.get(vault.fractionMint.toBase58()) ?? BigInt(0);
          const isThisVaultProcessing = processingVault === vault.publicKey.toBase58();
          const hasBalance = balance > BigInt(0);
          
          // Debug logging
          if (publicKey && hasBalance) {
            console.log(`[VaultExplorer] Vault ${vault.publicKey.toBase58().slice(0, 8)}... has balance: ${balance.toString()}`);
          }
          
          return (
            <VaultCard
              key={vault.publicKey.toBase58()}
              vault={vault}
              userBalance={balance}
              onInitializeReclaim={handleInitializeReclaim}
              isProcessing={isThisVaultProcessing && reclaimLoading}
              balanceLoading={balancesLoading}
              onBalanceUpdate={updateBalance}
            />
          );
        })}
      </div>

      {displayedCount < filteredVaults.length && (
        <div className="flex justify-center mt-6">
          <button
            onClick={handleLoadMore}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium shadow-sm"
          >
            Load More
          </button>
        </div>
      )}

      {filteredVaults.length > 0 && (
        <div className="text-center mt-4 text-xs text-gray-500 dark:text-gray-400">
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

      {/* Escrow Slide-over Panel */}
      <div
        className={`fixed inset-0 z-50 overflow-hidden transition-opacity duration-300 ${
          showEscrowPanel ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black bg-opacity-50"
          onClick={() => setShowEscrowPanel(false)}
        />

        {/* Panel */}
        <div
          className={`absolute right-0 top-0 h-full w-full max-w-2xl bg-white dark:bg-gray-900 shadow-xl transform transition-transform duration-300 ease-in-out ${
            showEscrowPanel ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-xl font-medium text-gray-900 dark:text-white">Escrow</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  View tokens and compensation held in escrow
                </p>
              </div>
              <button
                onClick={() => setShowEscrowPanel(false)}
                className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingEscrow ? (
                <div className="flex justify-center items-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 dark:border-gray-700 border-t-gray-600 dark:border-t-gray-400 mx-auto mb-3"></div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading escrow data...</p>
                  </div>
                </div>
              ) : escrowData.length === 0 ? (
                <div className="flex justify-center items-center py-12">
                  <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">No active escrows</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      There are currently no vaults with tokens or compensation in escrow.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                    Showing {escrowData.length} vault{escrowData.length !== 1 ? "s" : ""} with escrow data
                  </div>
                  <div className="space-y-3">
                    {escrowData.map((data) => (
                      <div
                        key={data.vault.publicKey.toBase58()}
                        className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
                              {data.nftName || `Vault ${data.vault.publicKey.toBase58().slice(0, 8)}...`}
                            </h3>
                            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                              <p>Vault: {data.vault.publicKey.toBase58().slice(0, 8)}...{data.vault.publicKey.toBase58().slice(-8)}</p>
                              <p>Fraction Mint: {data.vault.fractionMint.toBase58().slice(0, 8)}...{data.vault.fractionMint.toBase58().slice(-8)}</p>
                            </div>
                          </div>
                          {data.nftImage && (
                            <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 flex-shrink-0 ml-3">
                              <img
                                src={data.nftImage}
                                alt={data.nftName || "NFT"}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 mt-3">
                          <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded-md text-xs">
                            <span className="font-medium text-gray-600 dark:text-gray-400">Tokens in Escrow</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {formatTokenAmount(data.tokensInEscrow, 9)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded-md text-xs">
                            <span className="font-medium text-gray-600 dark:text-gray-400">Remaining Compensation (USDC)</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {formatTokenAmount(data.remainingCompensation, 6)}
                            </span>
                          </div>

                          {data.escrowEndsAt && (
                            <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-950/30 rounded-md text-xs">
                              <span className="font-medium text-blue-700 dark:text-blue-400">
                                {data.isEscrowActive ? "Escrow Ends At" : "Escrow Ended At"}
                              </span>
                              <span className={`font-semibold ${data.isEscrowActive ? "text-blue-900 dark:text-blue-300" : "text-gray-600 dark:text-gray-400"}`}>
                                {formatDate(data.escrowEndsAt)}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded-md text-xs">
                            <span className="font-medium text-gray-600 dark:text-gray-400">Status</span>
                            <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                              data.isEscrowActive
                                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                            }`}>
                              {data.isEscrowActive ? "Active" : "Ended"}
                            </span>
                          </div>

                          <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <p>Reclaim Initiator: {data.vault.reclaimInitiator.toBase58().slice(0, 8)}...{data.vault.reclaimInitiator.toBase58().slice(-8)}</p>
                            {data.vault.reclaimInitiationTimestamp > BigInt(0) && (
                              <p>Initiated: {formatDate(data.vault.reclaimInitiationTimestamp)}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

