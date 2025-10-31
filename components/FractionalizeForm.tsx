"use client";

import { useState, useEffect } from "react";
import { useFractionalize } from "@/hooks/useFractionalize";
import { PublicKey } from "@solana/web3.js";

interface FractionalizeFormProps {
  assetId: string;
  onSuccess?: (signature: string) => void;
  onCancel?: () => void;
}

export default function FractionalizeForm({
  assetId,
  onSuccess,
  onCancel,
}: FractionalizeFormProps) {
  const { fractionalize, loading, error, signature } = useFractionalize();

  // Reset form state when assetId changes (when user selects a different NFT)
  // The component will remount with a new key, which resets all hook state including signature
  useEffect(() => {
    setFormData({
      totalSupply: "7000000",
      minLpAgeSeconds: "",
      minReclaimPercent: "",
      minLiquidityPercent: "",
      minVolumePercent30d: "",
      treasury: "",
    });
  }, [assetId]);

  const [formData, setFormData] = useState({
    totalSupply: "7000000", // Default: 7M tokens
    minLpAgeSeconds: "",
    minReclaimPercent: "",
    minLiquidityPercent: "",
    minVolumePercent30d: "",
    treasury: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const treasury = formData.treasury
        ? new PublicKey(formData.treasury)
        : undefined;

      const signature = await fractionalize({
        assetId,
        totalSupply: formData.totalSupply,
        minLpAgeSeconds: formData.minLpAgeSeconds
          ? parseInt(formData.minLpAgeSeconds)
          : null,
        minReclaimPercent: formData.minReclaimPercent
          ? parseInt(formData.minReclaimPercent)
          : null,
        minLiquidityPercent: formData.minLiquidityPercent
          ? parseInt(formData.minLiquidityPercent)
          : null,
        minVolumePercent30d: formData.minVolumePercent30d
          ? parseInt(formData.minVolumePercent30d)
          : null,
        treasury,
      });

      if (onSuccess && signature) {
        onSuccess(signature);
      }
    } catch (err) {
      // Error is handled by the hook
    }
  };

  if (signature) {
    return (
      <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <h3 className="text-base font-semibold text-green-800 dark:text-green-200 mb-1">
          Successfully Fractionalized! 🎉
        </h3>
        <p className="text-xs text-green-700 dark:text-green-300 mb-2 break-all">
          Transaction signature: {signature}
        </p>
        <div className="flex flex-col gap-2">
          <a
            href={`https://solscan.io/tx/${signature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            View on Solscan →
          </a>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-sm px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Fractionalize Another NFT
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="totalSupply"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Total Supply *
        </label>
        <input
          id="totalSupply"
          type="text"
          value={formData.totalSupply}
          onChange={(e) => setFormData({ ...formData, totalSupply: e.target.value })}
          required
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          placeholder="7000000"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Total number of fractional tokens (will be multiplied by 10^9 for decimals)
        </p>
      </div>

      <div>
        <label
          htmlFor="minLpAgeSeconds"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Min LP Age (seconds) - Optional
        </label>
        <input
          id="minLpAgeSeconds"
          type="number"
          value={formData.minLpAgeSeconds}
          onChange={(e) =>
            setFormData({ ...formData, minLpAgeSeconds: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          placeholder="Leave empty if not needed"
        />
      </div>

      <div>
        <label
          htmlFor="minReclaimPercent"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Min Reclaim Percent - Optional
        </label>
        <input
          id="minReclaimPercent"
          type="number"
          min="0"
          max="100"
          value={formData.minReclaimPercent}
          onChange={(e) =>
            setFormData({ ...formData, minReclaimPercent: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          placeholder="Leave empty if not needed"
        />
      </div>

      <div>
        <label
          htmlFor="minLiquidityPercent"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Min Liquidity Percent - Optional
        </label>
        <input
          id="minLiquidityPercent"
          type="number"
          min="0"
          max="100"
          value={formData.minLiquidityPercent}
          onChange={(e) =>
            setFormData({ ...formData, minLiquidityPercent: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          placeholder="Leave empty if not needed"
        />
      </div>

      <div>
        <label
          htmlFor="minVolumePercent30d"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Min Volume Percent (30d) - Optional
        </label>
        <input
          id="minVolumePercent30d"
          type="number"
          min="0"
          max="100"
          value={formData.minVolumePercent30d}
          onChange={(e) =>
            setFormData({ ...formData, minVolumePercent30d: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          placeholder="Leave empty if not needed"
        />
      </div>

      <div>
        <label
          htmlFor="treasury"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Treasury Address - Optional
        </label>
        <input
          id="treasury"
          type="text"
          value={formData.treasury}
          onChange={(e) => setFormData({ ...formData, treasury: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          placeholder="Leave empty to auto-generate"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="flex space-x-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Fractionalizing..." : "Fractionalize cNFT"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
