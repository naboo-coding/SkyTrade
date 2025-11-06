"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMintCnft } from "@/hooks/useMintCnft";
import { useToast } from "@/components/ToastContainer";
import MintSuccessModal from "@/components/MintSuccessModal";
import { CnftGalleryRef } from "@/components/CnftGallery";

interface MintCnftButtonProps {
  galleryRef?: React.RefObject<CnftGalleryRef | null>;
}

export default function MintCnftButton({ galleryRef }: MintCnftButtonProps = {} as MintCnftButtonProps) {
  const { publicKey } = useWallet();
  const { mintCnft, loading, error, assetId } = useMintCnft();
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "Anna",
    symbol: "ANNA",
    imageUrl: "",
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
      });
      
      // Close the mint modal and show success modal
      setShowModal(false);
      setShowSuccessModal(true);
      
      console.log("Mint successful! Asset ID:", mintedAssetId);
      
      // Refresh gallery when mint is confirmed (after delay to allow API indexing)
      setTimeout(async () => {
        if (galleryRef?.current) {
          console.log("Refreshing gallery after successful mint confirmation...");
          await galleryRef.current.refetch();
        } else {
          // Fallback: reload page if galleryRef is not available
          console.log("Gallery ref not available, reloading page as fallback...");
          window.location.reload();
        }
      }, 1500); // 1.5 second delay to give Helius DAS API time to index
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showToast(`Mint failed: ${errorMsg}`, "error");
      console.error("Mint error:", err);
    }
  };

  // Note: Gallery refresh is now handled automatically when mint is confirmed

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
                  Symbol * (max 10 characters)
                </label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                  required
                  maxLength={10}
                  className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                    formData.symbol.length > 10
                      ? "border-red-500 dark:border-red-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                />
                <div className="mt-1 flex justify-between items-center">
                  <span className={`text-xs ${
                    formData.symbol.length > 10
                      ? "text-red-600 dark:text-red-400"
                      : formData.symbol.length > 8
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-gray-500 dark:text-gray-400"
                  }`}>
                    {formData.symbol.length} / 10 characters
                  </span>
                  {formData.symbol.length > 10 && (
                    <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                      Symbol too long! Must be 10 characters or fewer.
                    </span>
                  )}
                </div>
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
              </div>

              {!assetId && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    <strong>ℹ️ Note:</strong> Minting requires <strong>1 wallet approval</strong> to create the collection, merkle tree, and mint the cNFT in a single transaction.
                  </p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={loading || formData.symbol.length > 10}
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

      {showSuccessModal && assetId && (
        <MintSuccessModal
          assetId={assetId}
          onClose={() => {
            setShowSuccessModal(false);
          }}
        />
      )}
    </>
  );
}
