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
    
    setAdding(true);
    try {
      if (addAssetById) {
        const result = await addAssetById(assetId.trim());
        
        if (result.success) {
          alert("✅ Asset added successfully! It should appear in the gallery above.");
          setAssetId("");
          setShowInput(false);
        } else {
          const errorMsg = result.error || "Failed to add asset.";
          alert(`❌ ${errorMsg}`);
        }
      } else {
        await refetch();
        alert("⚠️ Manual add not available. Refreshing assets instead...");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      alert(`❌ Error adding asset: ${errorMsg}`);
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

