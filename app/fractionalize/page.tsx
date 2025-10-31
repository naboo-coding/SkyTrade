"use client";

import { useState, useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import CnftGallery, { CnftGalleryRef } from "@/components/CnftGallery";
import FractionalizeForm from "@/components/FractionalizeForm";
import MintCnftButton from "@/components/MintCnftButton";
import { useWallet } from "@solana/wallet-adapter-react";
import { useNetwork } from "@/contexts/NetworkContext";

interface ActionHistory {
  type: 'fractionalized' | 'minted';
  assetId: string;
  signature: string;
  timestamp: Date;
}

export default function FractionalizePage() {
  const { connected } = useWallet();
  const { networkName } = useNetwork();
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>();
  const [mounted, setMounted] = useState(false);
  const [actionHistory, setActionHistory] = useState<ActionHistory[]>([]);
  const galleryRef = useRef<CnftGalleryRef>(null);

  useEffect(() => {
    setMounted(true);
    
    // Load action history from localStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("action-history");
      if (saved) {
        try {
          const parsed = JSON.parse(saved).map((item: any) => ({
            ...item,
            timestamp: new Date(item.timestamp)
          }));
          setActionHistory(parsed);
        } catch (err) {
          console.error("Failed to parse action history:", err);
        }
      }
    }
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
              Connect Your Wallet
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Please connect your wallet to start fractionalizing your compressed NFTs
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
                  ref={galleryRef}
                  onSelectAsset={(assetId) => setSelectedAssetId(assetId)}
                  selectedAssetId={selectedAssetId}
                />
              </div>

              {/* Right Column: Fractionalization Form or History */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
                  Fractionalize cNFT
                </h2>
                {selectedAssetId ? (
                  <FractionalizeForm
                    key={selectedAssetId}
                    assetId={selectedAssetId}
                    onSuccess={async (signature) => {
                      // Add to action history
                      const newAction: ActionHistory = {
                        type: 'fractionalized',
                        assetId: selectedAssetId,
                        signature,
                        timestamp: new Date()
                      };
                      const updatedHistory = [newAction, ...actionHistory];
                      setActionHistory(updatedHistory);
                      localStorage.setItem("action-history", JSON.stringify(updatedHistory));
                      
                      // Note: We DON'T clear selectedAssetId here so the success message stays visible
                      // Refresh gallery to remove the fractionalized NFT (it's now owned by vault)
                      setTimeout(async () => {
                        await galleryRef.current?.refetch();
                      }, 3000);
                    }}
                    onCancel={() => setSelectedAssetId(undefined)}
                  />
                ) : (
                  <div>
                    <p className="text-center mb-6 text-gray-500 dark:text-gray-400">
                      Select a cNFT from the gallery to fractionalize
                    </p>
                    
                    {/* Action History */}
                    {actionHistory.length > 0 && (
                      <div className="mt-8">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          Recent Activity
                        </h3>
                        <div className="space-y-3 max-h-[500px] overflow-y-auto">
                          {actionHistory.map((action, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {action.type === 'fractionalized' ? '✓ Fractionalized' : '✓ Minted'} cNFT
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {action.timestamp.toLocaleString()}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 font-mono truncate">
                                {action.assetId}
                              </p>
                              <a
                                href={`https://solscan.io/tx/${action.signature}?cluster=${networkName.toLowerCase() === 'mainnet' ? '' : 'devnet'}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                              >
                                View on Solscan →
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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

