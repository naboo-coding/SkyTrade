"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMintCnft } from "@/hooks/useMintCnft";
import { useCnftAssets } from "@/hooks/useCnftAssets";
import { useAssetById } from "@/hooks/useAssetById";

export default function MintCnftButton() {
  const { publicKey } = useWallet();
  const { mintCnft, loading, error, assetId } = useMintCnft();
  const { refetch } = useCnftAssets();
  const { fetchAssetById, asset: fetchedAsset } = useAssetById();
  const [showModal, setShowModal] = useState(false);
  const [pollingActive, setPollingActive] = useState(false);
  const [formData, setFormData] = useState({
    name: "Daft-Punk cNFT",
    symbol: "DP",
    imageUrl: "https://gateway.pinata.cloud/ipfs/QmYourImageHashHere", // You can use a default image URL
    pinataJwt: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;

    try {
      const mintedAssetId = await mintCnft({
        name: formData.name,
        symbol: formData.symbol,
        imageUrl: formData.imageUrl || undefined,
        imageFile: imageFile || undefined,
        pinataJwt: formData.pinataJwt || undefined,
      });
      
      // Wait for indexing, then refetch assets
      // Helius DAS API typically takes 10-30 seconds to index new cNFTs
      console.log("Mint successful! Asset ID:", mintedAssetId);
      console.log("Waiting for Helius DAS API indexing...");
      
      setPollingActive(true);
      
      // First, try to fetch the asset directly by ID to verify it exists
      // Then poll by owner
      const startPolling = () => {
        let attempts = 0;
        const maxAttempts = 30; // Poll for 90 seconds total (30 * 3s)
        const pollInterval = 3000; // 3 seconds
        
        const pollForAsset = setInterval(async () => {
          attempts++;
          console.log(`[Poll ${attempts}/${maxAttempts}] Refetching assets by owner...`);
          
          // Try direct fetch every 5 attempts (if asset exists but isn't indexed in owner's list)
          if (attempts % 5 === 0 && mintedAssetId) {
            console.log(`[Poll ${attempts}] Checking asset directly by ID...`);
            try {
              await fetchAssetById(mintedAssetId);
            } catch (err) {
              // Ignore "not found" errors - asset just needs more time to index
            }
          }
          
          // Always refetch owner's assets
          refetch();
          
          // If we successfully fetched the asset by ID, also try to add it manually
          if (fetchedAsset && mintedAssetId === fetchedAsset.id) {
            console.log(`[Poll ${attempts}] Asset found by ID! Adding to gallery...`);
            // The asset was found, so it should appear in the next refetch
          }
          
          if (attempts >= maxAttempts) {
            clearInterval(pollForAsset);
            setPollingActive(false);
            console.log("Stopped polling after 90 seconds. Asset may take longer to index.");
            console.log("Please check the explorer and use Refresh button manually.");
          }
        }, pollInterval);
        
        // Stop polling after 2 minutes total
        setTimeout(() => {
          clearInterval(pollForAsset);
          setPollingActive(false);
        }, 120000);
      };
      
      // Start polling after 5 seconds (give it a moment to settle)
      setTimeout(startPolling, 5000);
      
    } catch (err) {
      // Error is handled by the hook
      console.error("Mint error:", err);
    }
  };

  if (!publicKey) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
      >
        Mint cNFT (Testing)
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Mint New cNFT
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Symbol *
                </label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Image URL (or upload file)
                </label>
                <input
                  type="text"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white mb-2"
                  placeholder="https://..."
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full text-sm text-gray-500 dark:text-gray-400"
                />
                {formData.imageUrl && formData.imageUrl.length > 100 && !formData.pinataJwt && (
                  <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                    ⚠️ Long image URLs may require Pinata JWT. If you get a "URI too long" error, please provide a Pinata JWT.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Pinata JWT (Recommended for long URLs)
                </label>
                <input
                  type="password"
                  value={formData.pinataJwt}
                  onChange={(e) => setFormData({ ...formData, pinataJwt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Leave empty if using short image URL"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Required if image URL is longer than ~100 characters. Uploads metadata to IPFS for shorter URIs.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}

              {!error && !assetId && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    <strong>ℹ️ Note:</strong> Minting requires <strong>2 wallet approvals</strong>:
                    <br />1. Create collection and merkle tree
                    <br />2. Mint cNFT
                    <br />This is normal and required for the minting process.
                  </p>
                </div>
              )}

              {assetId && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                  <p className="text-sm text-green-800 dark:text-green-200 mb-2 font-semibold">
                    ✅ Mint Successful!
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300 mb-2 font-mono break-all">
                    Asset ID: {assetId}
                  </p>
                  {pollingActive && (
                    <p className="text-xs text-green-700 dark:text-green-300 mb-2">
                      🔄 Polling for asset (every 3s, up to 90s)... This may take 30-60 seconds for Helius to index.
                    </p>
                  )}
                  {fetchedAsset && (
                    <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                      ✓ Asset verified! It exists and is indexed. It should appear in your gallery now.
                    </p>
                  )}
                  {error && error.includes("not yet indexed") && (
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-2">
                      ⏳ Asset not yet indexed. This is normal - Helius DAS API takes 30-60 seconds to index new assets.
                    </p>
                  )}
                  <p className="text-xs text-green-700 dark:text-green-300 mb-2">
                    💡 You can close this modal and use the "Refresh Assets" button in the gallery.
                  </p>
                  <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-800 dark:text-yellow-300">
                    <p className="font-semibold mb-1">⚠️ Wallet Warning Notice:</p>
                    <p>Your wallet may show this NFT as "Unverified" - this is expected for test NFTs. The collection isn't verified, but the NFT is fully functional and safe to use.</p>
                  </div>
                  <div className="flex flex-col gap-2 mt-2">
                    <a
                      href={`https://explorer.solana.com/address/${assetId}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      🔍 View on Solana Explorer →
                    </a>
                    <button
                      onClick={() => fetchAssetById(assetId)}
                      className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Verify Asset Exists
                    </button>
                  </div>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Minting..." : "Mint cNFT"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
