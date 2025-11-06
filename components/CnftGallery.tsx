"use client";

import { useCnftAssets } from "@/hooks/useCnftAssets";
import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import ManualAssetInput from "./ManualAssetInput";
import { isIpfsUrl, getAllGatewayUrls } from "@/utils/ipfsGateway";

interface CnftGalleryProps {
  onSelectAsset: (assetId: string) => void;
  selectedAssetId?: string;
}

export interface CnftGalleryRef {
  refetch: () => Promise<void>;
}

const CnftGallery = forwardRef<CnftGalleryRef, CnftGalleryProps>(function CnftGallery({ onSelectAsset, selectedAssetId }, ref) {
  const { assets, loading, error, refetch, removeAsset } = useCnftAssets();
  
  useImperativeHandle(ref, () => ({
    refetch: async () => {
      await refetch();
    },
  }));

  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [imageFallbacks, setImageFallbacks] = useState<Map<string, string[]>>(new Map());
  const [currentImageIndex, setCurrentImageIndex] = useState<Map<string, number>>(new Map());
  const [deleteMode, setDeleteMode] = useState(false);
  const [assetsToDelete, setAssetsToDelete] = useState<Set<string>>(new Set());
  const [displayCount, setDisplayCount] = useState(10);

  const handleImageError = (assetId: string, imageUrl: string) => {
    // Don't log as error - just as warning
    console.warn(`⚠️ Image failed to load for ${assetId.slice(0, 8)}...: ${imageUrl}`);
    
    // If it's an IPFS URL, try fallback gateways
    if (isIpfsUrl(imageUrl)) {
      const fallbackUrls = getAllGatewayUrls(imageUrl);
      const currentIndex = currentImageIndex.get(assetId) || 0;
      
      if (currentIndex < fallbackUrls.length - 1) {
        // Try next gateway
        const nextIndex = currentIndex + 1;
        setCurrentImageIndex(prev => new Map(prev).set(assetId, nextIndex));
        setImageFallbacks(prev => new Map(prev).set(assetId, fallbackUrls));
        console.log(`🔄 Trying fallback gateway ${nextIndex + 1}/${fallbackUrls.length} for ${assetId.slice(0, 8)}...`);
        return; // Don't mark as error yet, try next gateway
      }
    }
    
    // All gateways failed or not IPFS - mark as error
    setImageErrors((prev) => new Set(prev).add(assetId));
  };
  
  const getImageUrl = (asset: { id: string; image?: string }): string | undefined => {
    if (!asset.image) return undefined;
    
    // If we have fallback URLs for this asset, use the current one
    const fallbacks = imageFallbacks.get(asset.id);
    const currentIdx = currentImageIndex.get(asset.id);
    
    if (fallbacks && currentIdx !== undefined && currentIdx > 0) {
      return fallbacks[currentIdx];
    }
    
    return asset.image;
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

  const handleDeleteClick = () => {
    if (deleteMode && assetsToDelete.size > 0) {
      // Execute deletion
      assetsToDelete.forEach(assetId => {
        removeAsset(assetId);
      });
      setAssetsToDelete(new Set());
      setDeleteMode(false);
    } else if (deleteMode) {
      // Cancel delete mode
      setDeleteMode(false);
      setAssetsToDelete(new Set());
    } else {
      // Enter delete mode
      setDeleteMode(true);
    }
  };

  const toggleAssetSelection = (assetId: string) => {
    setAssetsToDelete(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assetId)) {
        newSet.delete(assetId);
      } else {
        newSet.add(assetId);
      }
      return newSet;
    });
  };

  return (
    <div className="w-full">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Your cNFTs ({assets.length})
          {deleteMode && (
            <span className="text-sm text-orange-600 dark:text-orange-400 ml-2">
              ({assetsToDelete.size} selected)
            </span>
          )}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={refetch}
            className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            Refresh
          </button>
          <button
            onClick={handleDeleteClick}
            className={`px-4 py-2 text-sm rounded transition-colors ${
              deleteMode
                ? assetsToDelete.size > 0
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800"
                : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800"
            }`}
          >
            {deleteMode ? (
              assetsToDelete.size > 0 ? (
                `Delete ${assetsToDelete.size} NFT${assetsToDelete.size > 1 ? 's' : ''}`
              ) : (
                "Cancel"
              )
            ) : (
              "Delete NFTs"
            )}
          </button>
        </div>
      </div>
      {/* Only show ManualAssetInput when there are assets (as a fallback option) */}
      <div className="mb-4">
        <ManualAssetInput />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {assets.slice(0, displayCount).map((asset) => (
          <div
            key={asset.id}
            onClick={() => {
              if (deleteMode) {
                toggleAssetSelection(asset.id);
              } else {
                onSelectAsset(asset.id);
              }
            }}
            className={`relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
              deleteMode
                ? assetsToDelete.has(asset.id)
                  ? "border-red-500 ring-2 ring-red-200 dark:ring-red-800"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                : selectedAssetId === asset.id
                  ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            {/* Selection indicator in delete mode */}
            {deleteMode && assetsToDelete.has(asset.id) && (
              <div className="absolute top-2 right-2 z-10 bg-red-500 text-white rounded-full p-1.5 shadow-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {/* Delete mode overlay */}
            {deleteMode && !assetsToDelete.has(asset.id) && (
              <div className="absolute top-2 right-2 z-10 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-full w-7 h-7 flex items-center justify-center shadow-lg">
              </div>
            )}
            <div>
              <div className="aspect-square bg-gray-100 dark:bg-gray-800 flex items-center justify-center relative">
                {!imageErrors.has(asset.id) && getImageUrl(asset) ? (
                  <>
                    <img
                      key={`${asset.id}-${currentImageIndex.get(asset.id) || 0}`}
                      src={getImageUrl(asset)}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const imgUrl = getImageUrl(asset) || asset.image || '';
                        handleImageError(asset.id, imgUrl);
                      }}
                      onLoad={() => {
                        const imgUrl = getImageUrl(asset) || asset.image || '';
                        console.log(`✅ Image loaded successfully for ${asset.id.slice(0, 8)}...: ${imgUrl.slice(0, 50)}...`);
                        // Reset fallback state on success
                        setImageFallbacks(prev => {
                          const newMap = new Map(prev);
                          newMap.delete(asset.id);
                          return newMap;
                        });
                        setCurrentImageIndex(prev => {
                          const newMap = new Map(prev);
                          newMap.delete(asset.id);
                          return newMap;
                        });
                      }}
                      loading="lazy"
                    />
                    {/* Debug overlay - remove in production */}
                    {process.env.NODE_ENV === 'development' && (
                      <div className="absolute top-0 left-0 bg-black bg-opacity-50 text-white text-xs p-1 opacity-0 hover:opacity-100 transition-opacity">
                        {getImageUrl(asset)?.slice(0, 30)}...
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-gray-400 dark:text-gray-600 text-4xl flex flex-col items-center gap-1">
                    <span>🖼️</span>
                    {process.env.NODE_ENV === 'development' && (
                      <span className="text-xs text-gray-500">
                        {asset.image ? 'Failed to load' : 'No image'}
                      </span>
                    )}
                  </div>
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
          </div>
        ))}
      </div>
      {assets.length > displayCount && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setDisplayCount(prev => prev + 10)}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Load More ({assets.length - displayCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
});

export default CnftGallery;
