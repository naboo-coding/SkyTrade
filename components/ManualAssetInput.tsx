"use client";

import { useState } from "react";
import { useCnftAssets } from "@/hooks/useCnftAssets";

export default function ManualAssetInput() {
  const [assetId, setAssetId] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [adding, setAdding] = useState(false);
  const { refetch, addAssetById } = useCnftAssets();

  const handleAddAsset = async () => {
    if (!assetId.trim()) return;
    
    console.log("🚀 Starting manual asset addition for ID:", assetId.trim());
    setAdding(true);
    try {
      // Try to add the asset by ID first (if it exists but isn't indexed in owner list)
      if (addAssetById) {
        console.log("Calling addAssetById...");
        await addAssetById(assetId.trim());
        console.log("addAssetById completed!");
        // Don't refetch immediately - it might clear the manually added asset
        // The asset should appear immediately due to state update
        // We can refetch later if needed, but it won't clear manually added assets now
      } else {
        console.warn("addAssetById function not available, just refetching...");
        // Fallback to just refetching
        await refetch();
      }
      // Wait a moment to see if asset was added
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Show success message
      const successMsg = "Asset added! Check if it appears in the gallery above.";
      console.log("✅", successMsg);
      
      setAssetId("");
    } catch (err) {
      console.error("❌ Error adding asset:", err);
      alert(`Error adding asset: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div>
      {!showInput ? (
        <button
          onClick={() => setShowInput(true)}
          className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          ➕ Add Asset by ID
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              placeholder="Paste Asset ID here (e.g. FBynKqCeSVCee6cPLxvf9FnFpotvLeewr1grQQxhxrD6)"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              onKeyDown={(e) => {
                if (e.key === "Enter" && assetId.trim()) {
                  handleAddAsset();
                }
              }}
            />
            <button
              onClick={handleAddAsset}
              disabled={adding || !assetId.trim()}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adding ? "Adding..." : "Add"}
            </button>
            <button
              onClick={() => {
                setShowInput(false);
                setAssetId("");
              }}
              className="px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            💡 Get the Asset ID from the browser console after minting, or from Solana Explorer
          </p>
        </div>
      )}
    </div>
  );
}

