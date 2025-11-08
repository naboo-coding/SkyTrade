"use client";

import { PublicKey } from "@solana/web3.js";
import { VaultData } from "@/hooks/useVaults";
import { useState, useEffect } from "react";
import { useAssetByIdNoWallet } from "@/hooks/useAssetByIdNoWallet";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useWallet } from "@solana/wallet-adapter-react";

interface VaultCardProps {
  vault: VaultData;
  userBalance: bigint;
  onInitializeReclaim?: (vault: VaultData) => void;
  isProcessing?: boolean;
  balanceLoading?: boolean;
  onBalanceUpdate?: (mint: string, balance: bigint) => void;
}

export default function VaultCard({ vault, userBalance, onInitializeReclaim, isProcessing = false, balanceLoading = false, onBalanceUpdate }: VaultCardProps) {
  const { fetchAssetById, asset, loading: assetLoading } = useAssetByIdNoWallet();
  const [imageError, setImageError] = useState(false);
  const { fetchBalance } = useTokenBalance();
  const { publicKey } = useWallet();
  const [checkingBalance, setCheckingBalance] = useState(false);

  useEffect(() => {
    if (vault.nftAssetId) {
      // Add a small delay to stagger requests and prevent rate limiting
      // Each card will wait a bit longer based on a hash of the asset ID
      const delay = (parseInt(vault.nftAssetId.toBase58().slice(0, 8), 16) % 1000) * 2; // 0-2000ms delay
      const timeoutId = setTimeout(() => {
        fetchAssetById(vault.nftAssetId.toBase58());
      }, delay);
      
      return () => clearTimeout(timeoutId);
    }
  }, [vault.nftAssetId, fetchAssetById]);

  const getStatusDisplay = () => {
    if (vault.status.active) return "Active";
    if (vault.status.reclaimInitiated) return "Reclaim Initiated";
    if (vault.status.reclaimedFinalized) return "Reclaimed Finalized";
    if (vault.status.closed) return "Closed";
    return "Unknown";
  };

  const getStatusColor = () => {
    if (vault.status.active) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (vault.status.reclaimInitiated) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    if (vault.status.reclaimedFinalized) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    if (vault.status.closed) return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  };

  const formatTokenAmount = (amount: bigint, decimals: number = 9): string => {
    const divisor = BigInt(10 ** decimals);
    const whole = amount / divisor;
    const remainder = amount % divisor;
    if (remainder === BigInt(0)) {
      return whole.toString();
    }
    const decimalsStr = remainder.toString().padStart(decimals, "0");
    const trimmed = decimalsStr.replace(/0+$/, "");
    return trimmed ? `${whole}.${trimmed}` : whole.toString();
  };

  const calculateUserPercentage = (): number => {
    if (vault.totalSupply === BigInt(0)) return 0;
    const percentage = (Number(userBalance) / Number(vault.totalSupply)) * 100;
    return percentage;
  };

  const userPercentage = calculateUserPercentage();
  const minReclaimPercentage = vault.minReclaimPercentage;
  const canInitializeReclaim = vault.status.active && userPercentage >= minReclaimPercentage;

  const formatDate = (timestamp: bigint): string => {
    const date = new Date(Number(timestamp) * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return `${diffSecs} seconds ago`;
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 30) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const formattedDate = formatDate(vault.creationTimestamp);

  const nftName = asset?.name || "Loading...";
  const nftImage = asset?.image;

  const getButtonTooltip = () => {
    if (!vault.status.active) {
      return `Vault is ${getStatusDisplay()}. Only Active vaults can be reclaimed.`;
    }
    if (userPercentage < minReclaimPercentage) {
      return `You need at least ${minReclaimPercentage}% ownership to initialize reclaim. You currently have ${userPercentage.toFixed(2)}%.`;
    }
    return "Click to initialize reclaim process";
  };

  return (
    <div className="group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-800/80 overflow-hidden hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-300 hover:shadow-md">
      <div className="relative">
        {/* Slim Image Section */}
        <div className="relative w-full h-36 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
          {assetLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 dark:border-gray-700 border-t-gray-600 dark:border-t-gray-400"></div>
            </div>
          ) : nftImage && !imageError ? (
            <img
              src={nftImage}
              alt={nftName}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800/50">
              <svg
                className="w-10 h-10 text-gray-300 dark:text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
          
          {/* Status Badge - Minimal */}
          <div className="absolute top-2 right-2 z-10">
            <span className={`px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase rounded-md backdrop-blur-sm border transition-colors ${
              vault.status.active 
                ? "bg-green-50/90 dark:bg-green-950/50 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                : vault.status.reclaimInitiated
                ? "bg-amber-50/90 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                : vault.status.reclaimedFinalized
                ? "bg-blue-50/90 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                : "bg-gray-50/90 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700"
            }`}>
              {getStatusDisplay()}
            </span>
          </div>
        </div>

        {/* Content Section - Slim */}
        <div className="p-3 space-y-2.5">
          {/* Name */}
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">
            {nftName}
          </h3>

          {/* Stats Grid - Compact */}
          <div className="space-y-1.5">
            {/* Token Supply */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Supply
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                {formatTokenAmount(vault.totalSupply)}
              </span>
            </div>

            {/* User Position */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Position
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`font-medium tabular-nums flex items-center gap-1 ${userBalance > BigInt(0) ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-gray-600"}`}>
                  {checkingBalance ? (
                    <span className="flex items-center gap-1 text-gray-500 dark:text-gray-500">
                      <div className="animate-spin rounded-full h-2 w-2 border border-current border-t-transparent"></div>
                    </span>
                  ) : balanceLoading && userBalance === BigInt(0) ? (
                    <span className="flex items-center gap-1 text-gray-500 dark:text-gray-500">
                      <div className="animate-spin rounded-full h-2 w-2 border border-current border-t-transparent"></div>
                    </span>
                  ) : userBalance > BigInt(0) ? (
                    <>
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      {formatTokenAmount(userBalance)} <span className="text-[10px] opacity-70">({userPercentage.toFixed(1)}%)</span>
                    </>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-600">—</span>
                  )}
                </span>
                {publicKey && !checkingBalance && (
                  <button
                    onClick={async () => {
                      setCheckingBalance(true);
                      try {
                        console.log(`[VaultCard] Manually checking balance for vault ${vault.publicKey.toBase58().slice(0, 8)}..., mint: ${vault.fractionMint.toBase58().slice(0, 8)}...`);
                        const balance = await fetchBalance(vault.fractionMint);
                        console.log(`[VaultCard] Manual balance check result: ${balance.toString()}`);
                        if (onBalanceUpdate) {
                          onBalanceUpdate(vault.fractionMint.toBase58(), balance);
                        } else {
                          window.location.reload();
                        }
                      } catch (err) {
                        console.error(`[VaultCard] Error manually checking balance:`, err);
                      } finally {
                        setCheckingBalance(false);
                      }
                    }}
                    className="text-[10px] text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                    title="Refresh balance"
                  >
                    ↻
                  </button>
                )}
              </div>
            </div>

            {/* Creator */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Creator
              </span>
              <span className="font-mono text-[10px] font-medium text-gray-600 dark:text-gray-400 truncate max-w-[90px] cursor-help" title={vault.creator.toBase58()}>
                {vault.creator.toBase58().slice(0, 4)}...{vault.creator.toBase58().slice(-4)}
              </span>
            </div>

            {/* Creation Date */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Created
              </span>
              <span className="font-medium text-gray-600 dark:text-gray-400 text-[10px]">{formattedDate}</span>
            </div>
          </div>

          {/* Initialize Reclaim Button - Clean */}
          {onInitializeReclaim && (
            <div className="pt-1.5">
              <button
                onClick={() => {
                  if (canInitializeReclaim && !isProcessing) {
                    onInitializeReclaim(vault);
                  }
                }}
                disabled={!canInitializeReclaim || isProcessing}
                title={getButtonTooltip()}
                className={`relative w-full px-3 py-2 rounded-lg font-medium text-xs transition-all duration-200 ${
                  canInitializeReclaim && !isProcessing
                    ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 shadow-sm"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent"></div>
                    Processing...
                  </span>
                ) : canInitializeReclaim ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Initialize Reclaim
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Initialize Reclaim
                  </span>
                )}
              </button>
              {!canInitializeReclaim && (
                <p className="mt-1.5 text-[10px] text-center text-gray-400 dark:text-gray-500">
                  {vault.status.active 
                    ? `Requires ${minReclaimPercentage}% ownership`
                    : "Vault must be Active"
                  }
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

