"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import CnftGallery from "@/components/CnftGallery";
import FractionalizeForm from "@/components/FractionalizeForm";
import MintCnftButton from "@/components/MintCnftButton";
import { useWallet } from "@solana/wallet-adapter-react";
import { useNetwork } from "@/contexts/NetworkContext";

export default function Home() {
  const { connected } = useWallet();
  const { networkName } = useNetwork();
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!mounted ? (
          <div className="text-center py-12">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mx-auto mb-4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-96 mx-auto"></div>
            </div>
          </div>
        ) : !connected ? (
          <div className="text-center py-12">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Welcome to SkyTrade
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Connect your wallet to start fractionalizing your compressed NFTs
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Fractionalize Your cNFTs
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Network: {networkName}
                </p>
              </div>
              <MintCnftButton />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column: cNFT Gallery */}
              <div>
                <CnftGallery
                  onSelectAsset={(assetId) => setSelectedAssetId(assetId)}
                  selectedAssetId={selectedAssetId}
                />
              </div>

              {/* Right Column: Fractionalization Form */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
                  Fractionalize cNFT
                </h2>
                {selectedAssetId ? (
                  <FractionalizeForm
                    assetId={selectedAssetId}
                    onSuccess={(signature) => {
                      console.log("Fractionalization successful:", signature);
                      // Optionally reset selection or show success message
                    }}
                    onCancel={() => setSelectedAssetId(undefined)}
                  />
                ) : (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <p>Select a cNFT from the gallery to fractionalize</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
