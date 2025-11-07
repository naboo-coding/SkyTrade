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
    <div className="group relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl rounded-3xl border border-gray-200/60 dark:border-gray-800/60 overflow-hidden hover:border-blue-400/60 dark:hover:border-blue-500/60 transition-all duration-700 hover:shadow-2xl hover:shadow-blue-500/20 dark:hover:shadow-blue-500/30 hover:-translate-y-1">
      {/* Animated gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-blue-500/8 group-hover:via-purple-500/8 group-hover:to-pink-500/8 transition-all duration-700 pointer-events-none" />
      
      {/* Shimmer effect overlay */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
        <div className="absolute inset-0 animate-shimmer" />
      </div>
      
      <div className="relative">
        {/* Enhanced Image Section with gradient overlay */}
        <div className="relative w-full h-44 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-gray-950 dark:via-gray-900 dark:to-gray-800 overflow-hidden">
          {/* Gradient overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          
          {assetLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="relative">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200/50 dark:border-gray-800/50 border-t-blue-500 dark:border-t-blue-400"></div>
                <div className="absolute inset-0 animate-pulse-glow rounded-full"></div>
              </div>
            </div>
          ) : nftImage && !imageError ? (
            <>
              <img
                src={nftImage}
                alt={nftName}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                onError={() => setImageError(true)}
              />
              {/* Subtle shine effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50/80 via-purple-50/80 to-pink-50/80 dark:from-blue-950/80 dark:via-purple-950/80 dark:to-pink-950/80">
              <div className="relative">
                <svg
                  className="w-14 h-14 text-gray-300 dark:text-gray-800 animate-float"
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
            </div>
          )}
          
          {/* Status Badge - Enhanced with glow */}
          <div className="absolute top-2.5 right-2.5 z-10">
            <span className={`px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full shadow-xl backdrop-blur-md border transition-all duration-300 group-hover:scale-105 ${
              vault.status.active 
                ? "bg-green-500/25 dark:bg-green-500/25 text-green-700 dark:text-green-300 border-green-500/40 shadow-green-500/20"
                : vault.status.reclaimInitiated
                ? "bg-yellow-500/25 dark:bg-yellow-500/25 text-yellow-700 dark:text-yellow-300 border-yellow-500/40 shadow-yellow-500/20"
                : vault.status.reclaimedFinalized
                ? "bg-blue-500/25 dark:bg-blue-500/25 text-blue-700 dark:text-blue-300 border-blue-500/40 shadow-blue-500/20"
                : "bg-gray-500/25 dark:bg-gray-500/25 text-gray-700 dark:text-gray-300 border-gray-500/40 shadow-gray-500/20"
            }`}>
              {getStatusDisplay()}
            </span>
          </div>
        </div>

        {/* Enhanced Content Section */}
        <div className="p-4 space-y-3.5">
          {/* Name - Enhanced with better typography */}
          <div className="relative">
            <h3 className="text-base font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300 tracking-tight">
              {nftName}
            </h3>
            {/* Subtle underline on hover */}
            <div className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-500 group-hover:w-full transition-all duration-500" />
          </div>

          {/* Enhanced Stats Grid with better visual hierarchy */}
          <div className="space-y-2.5">
            {/* Token Supply - Enhanced */}
            <div className="flex items-center justify-between py-1 px-1 rounded-lg group-hover:bg-gray-50/50 dark:group-hover:bg-gray-800/30 transition-colors duration-300">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-500 flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Supply
              </span>
              <span className="text-xs font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                {formatTokenAmount(vault.totalSupply)}
              </span>
            </div>

            {/* User Position - Enhanced with visual indicator */}
            <div className="flex items-center justify-between py-1 px-1 rounded-lg group-hover:bg-gray-50/50 dark:group-hover:bg-gray-800/30 transition-colors duration-300">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-500 flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Position
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold tabular-nums flex items-center gap-1 transition-all duration-200 ${userBalance > BigInt(0) ? "text-green-600 dark:text-green-400" : checkingBalance ? "text-gray-500 dark:text-gray-500" : balanceLoading ? "text-gray-500 dark:text-gray-500" : "text-gray-400 dark:text-gray-600"}`}>
                  {checkingBalance ? (
                    <span className="flex items-center gap-1 text-gray-500 dark:text-gray-500">
                      <div className="animate-spin rounded-full h-2.5 w-2.5 border-2 border-current border-t-transparent"></div>
                      Checking...
                    </span>
                  ) : balanceLoading && userBalance === BigInt(0) ? (
                    <span className="flex items-center gap-1 text-gray-500 dark:text-gray-500">
                      <div className="animate-spin rounded-full h-2.5 w-2.5 border-2 border-current border-t-transparent"></div>
                      <span className="text-[10px]">Loading...</span>
                    </span>
                  ) : userBalance > BigInt(0) ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                      {formatTokenAmount(userBalance)} <span className="text-[10px] opacity-70 font-medium">({userPercentage.toFixed(1)}%)</span>
                    </>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-600" title="No tokens found in your wallet for this vault">—</span>
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
                          // Fallback: reload if callback not provided
                          window.location.reload();
                        }
                      } catch (err) {
                        console.error(`[VaultCard] Error manually checking balance:`, err);
                      } finally {
                        setCheckingBalance(false);
                      }
                    }}
                    className="text-[10px] text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors opacity-70 hover:opacity-100"
                    title="Refresh balance for this vault"
                  >
                    ↻
                  </button>
                )}
              </div>
            </div>

            {/* Creator - Enhanced */}
            <div className="flex items-center justify-between py-1 px-1 rounded-lg group-hover:bg-gray-50/50 dark:group-hover:bg-gray-800/30 transition-colors duration-300">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-500 flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Creator
              </span>
              <span className="font-mono text-[10px] font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[100px] hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-help" title={vault.creator.toBase58()}>
                {vault.creator.toBase58().slice(0, 4)}...{vault.creator.toBase58().slice(-4)}
              </span>
            </div>

            {/* Asset ID - Enhanced */}
            <div className="flex items-center justify-between py-1 px-1 rounded-lg group-hover:bg-gray-50/50 dark:group-hover:bg-gray-800/30 transition-colors duration-300">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-500 flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Asset
              </span>
              <span className="font-mono text-[10px] font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[100px] hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-help" title={vault.nftAssetId.toBase58()}>
                {vault.nftAssetId.toBase58().slice(0, 4)}...{vault.nftAssetId.toBase58().slice(-4)}
              </span>
            </div>

            {/* Creation Date - Enhanced */}
            <div className="flex items-center justify-between py-1 px-1 rounded-lg group-hover:bg-gray-50/50 dark:group-hover:bg-gray-800/30 transition-colors duration-300">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-500 flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Created
              </span>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{formattedDate}</span>
            </div>
          </div>

          {/* Enhanced Initialize Reclaim Button */}
          {onInitializeReclaim && (
            <div className="pt-2">
              <button
                onClick={() => {
                  if (canInitializeReclaim && !isProcessing) {
                    onInitializeReclaim(vault);
                  }
                }}
                disabled={!canInitializeReclaim || isProcessing}
                title={getButtonTooltip()}
                className={`relative w-full px-3 py-2.5 rounded-xl font-semibold text-xs transition-all duration-300 overflow-hidden group ${
                  canInitializeReclaim && !isProcessing
                    ? "bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 hover:from-blue-700 hover:via-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl hover:shadow-blue-500/30 transform hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-gray-100/60 dark:bg-gray-800/60 text-gray-400 dark:text-gray-600 cursor-not-allowed border border-gray-200/60 dark:border-gray-700/60"
                }`}
              >
                {/* Button shine effect */}
                {canInitializeReclaim && !isProcessing && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                )}
                
                {isProcessing ? (
                  <span className="relative flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-current border-t-transparent"></div>
                    Processing...
                  </span>
                ) : canInitializeReclaim ? (
                  <span className="relative flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Initialize Reclaim
                  </span>
                ) : (
                  <span className="relative flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Initialize Reclaim
                  </span>
                )}
              </button>
              {!canInitializeReclaim && (
                <p className="mt-2 text-[10px] text-center text-gray-500 dark:text-gray-500 font-medium">
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

