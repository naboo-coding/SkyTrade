"use client";

import { useCnftAssets } from "@/hooks/useCnftAssets";
import { useState, useEffect } from "react";
import ManualAssetInput from "./ManualAssetInput";

interface CnftGalleryProps {
  onSelectAsset: (assetId: string) => void;
  selectedAssetId?: string;
}

export default function CnftGallery({ onSelectAsset, selectedAssetId }: CnftGalleryProps) {
  const { assets, loading, error, refetch } = useCnftAssets();
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Debug: log when assets change
  useEffect(() => {
    console.log("📊 Gallery assets updated, count:", assets.length);
    if (assets.length > 0) {
      console.log("Assets in gallery:", assets.map(a => ({ id: a.id.slice(0, 16) + "...", name: a.name })));
    }
  }, [assets]);

  const handleImageError = (assetId: string) => {
    setImageErrors((prev) => new Set(prev).add(assetId));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-gray-600 dark:text-gray-400">Loading your cNFTs...</div>
      </div>
    );
  }

  // Only show error if it's a real error (not just "no assets found")
  if (error && !error.includes("No assets found") && !error.includes("undefined")) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-800 dark:text-red-200 font-semibold mb-2">Error: {error}</p>
        {error.includes("403") || error.includes("forbidden") || error.includes("Helius") ? (
          <div className="text-sm text-red-700 dark:text-red-300 mb-3">
            <p className="mb-2">⚠️ Helius DAS API authentication issue detected.</p>
            <p className="mb-2">To fix this:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Get a Helius API key from <a href="https://dev.helius.xyz/" target="_blank" rel="noopener noreferrer" className="underline">dev.helius.xyz</a></li>
              <li>Create a <code className="bg-red-100 dark:bg-red-900 px-1 rounded">.env.local</code> file in your project root</li>
              <li>Add: <code className="bg-red-100 dark:bg-red-900 px-1 rounded">NEXT_PUBLIC_HELIUS_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY</code></li>
              <li>Restart your dev server</li>
            </ol>
          </div>
        ) : null}
        <button
          onClick={refetch}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="p-8">
        <div className="text-center mb-6">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            No cNFTs found in your wallet. Mint one to get started!
          </p>
          <button
            onClick={refetch}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 mb-4"
          >
            Refresh Assets
          </button>
        </div>
        
        {/* Show Manual Asset Input prominently when no assets */}
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-4">
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            💡 Add Asset Manually
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            If you minted a cNFT and it appears on{" "}
            <a 
              href="https://explorer.solana.com/?cluster=devnet" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Solana Explorer
            </a>
            {" "}but not here, paste the Asset ID below to add it manually.
          </p>
          <ManualAssetInput />
        </div>
        
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
            Note: Newly minted cNFTs may take 30-60 seconds to appear due to Helius DAS API indexing.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-600">
            After minting, check the browser console (F12) for the Asset ID, or find it on Solana Explorer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Your cNFTs ({assets.length})
        </h2>
        <button
          onClick={refetch}
          className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Refresh
        </button>
      </div>
      {/* Only show ManualAssetInput when there are assets (as a fallback option) */}
      <div className="mb-4">
        <ManualAssetInput />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {assets.map((asset) => (
          <div
            key={asset.id}
            onClick={() => onSelectAsset(asset.id)}
            className={`cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
              selectedAssetId === asset.id
                ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            <div className="aspect-square bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              {!imageErrors.has(asset.id) && asset.image ? (
                <img
                  src={asset.image}
                  alt={asset.name}
                  className="w-full h-full object-cover"
                  onError={() => handleImageError(asset.id)}
                />
              ) : (
                <div className="text-gray-400 dark:text-gray-600 text-4xl">🖼️</div>
              )}
            </div>
            <div className="p-3 bg-white dark:bg-gray-900">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                {asset.name}
              </h3>
              {asset.symbol && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{asset.symbol}</p>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">
                {asset.id.slice(0, 8)}...
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
