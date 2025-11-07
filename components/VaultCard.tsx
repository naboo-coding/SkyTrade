"use client";

import { PublicKey } from "@solana/web3.js";
import { VaultData } from "@/hooks/useVaults";
import { useState, useEffect } from "react";
import { useAssetByIdNoWallet } from "@/hooks/useAssetByIdNoWallet";

interface VaultCardProps {
  vault: VaultData;
  userBalance: bigint;
  onInitializeReclaim?: (vault: VaultData) => void;
  isProcessing?: boolean;
}

export default function VaultCard({ vault, userBalance, onInitializeReclaim, isProcessing = false }: VaultCardProps) {
  const { fetchAssetById, asset, loading: assetLoading } = useAssetByIdNoWallet();
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (vault.nftAssetId) {
      fetchAssetById(vault.nftAssetId.toBase58());
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
    <div className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 transform hover:-translate-y-1">
      {/* Image Section with Gradient Overlay */}
      <div className="relative w-full aspect-square bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
        {assetLoading ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400"></div>
          </div>
        ) : nftImage && !imageError ? (
          <img
            src={nftImage}
            alt={nftName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
            <svg
              className="w-20 h-20 text-gray-300 dark:text-gray-700"
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
        {/* Status Badge Overlay */}
        <div className="absolute top-3 right-3">
          <span className={`px-3 py-1 text-xs font-semibold rounded-full shadow-lg backdrop-blur-sm ${getStatusColor()}`}>
            {getStatusDisplay()}
          </span>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-5 space-y-4 bg-gradient-to-b from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
        {/* Name */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {nftName}
          </h3>
        </div>

        {/* Stats Grid */}
        <div className="space-y-3">
          {/* Token Supply */}
          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Supply</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {formatTokenAmount(vault.totalSupply)}
            </span>
          </div>

          {/* User Position */}
          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Your Position</span>
            <span className={`text-sm font-bold ${userBalance > BigInt(0) ? "text-green-600 dark:text-green-400" : "text-gray-400 dark:text-gray-500"}`}>
              {userBalance > BigInt(0) ? (
                <>
                  {formatTokenAmount(userBalance)} <span className="text-xs">({userPercentage.toFixed(2)}%)</span>
                </>
              ) : (
                "No position"
              )}
            </span>
          </div>

          {/* Creator */}
          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Creator</span>
            <span className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[120px]" title={vault.creator.toBase58()}>
              {vault.creator.toBase58().slice(0, 4)}...{vault.creator.toBase58().slice(-4)}
            </span>
          </div>

          {/* Asset ID */}
          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Asset ID</span>
            <span className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[120px]" title={vault.nftAssetId.toBase58()}>
              {vault.nftAssetId.toBase58().slice(0, 4)}...{vault.nftAssetId.toBase58().slice(-4)}
            </span>
          </div>

          {/* Creation Date */}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{formattedDate}</span>
          </div>
        </div>

        {/* Initialize Reclaim Button */}
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
              className={`w-full px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-200 ${
                canInitializeReclaim && !isProcessing
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-60"
              }`}
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                  Processing...
                </span>
              ) : canInitializeReclaim ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Initialize Reclaim
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Initialize Reclaim
                </span>
              )}
            </button>
            {!canInitializeReclaim && (
              <p className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400">
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
  );
}

