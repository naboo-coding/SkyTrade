'use client';

import { useState } from 'react';
import { useWallet } from './hooks/useWallet.tsx';
import { useCnfts } from './hooks/useCnft';
import { useMintCnft } from './hooks/useMintCnft';
import Navbar from './components/Navbar';
import CnftGallery from './components/CnftGallery';
import FractionalizationForm from './components/FractionalizationForm';
import type { CnftData } from './types';

export default function Home() {
  const { publicKey, wallet } = useWallet();
  const { cnfts, loading: cnftsLoading } = useCnfts(publicKey, wallet);
  const { mintCnft, loading: mintLoading, error: mintError } = useMintCnft(wallet);
  
  const [selectedCnft, setSelectedCnft] = useState<CnftData | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleSelectCnft = (cnft: CnftData) => {
    setSelectedCnft(cnft);
    setShowForm(true);
  };

  const handleMint = async () => {
    try {
      await mintCnft();
      alert('cNFT minted successfully! Please refresh to see it in your gallery.');
    } catch (err) {
      console.error('Failed to mint cNFT:', err);
    }
  };

  const handleFractionalizationSuccess = () => {
    setShowForm(false);
    setSelectedCnft(null);
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-white">Fractionalize Your cNFTs</h1>
            <button
              onClick={handleMint}
              disabled={mintLoading || !publicKey}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                mintLoading || !publicKey
                  ? 'bg-gray-700 cursor-not-allowed'
                  : 'bg-yellow-600 hover:bg-yellow-700'
              } text-white`}
            >
              {mintLoading ? 'Minting...' : 'Mint Test cNFT'}
            </button>
          </div>

          {!publicKey ? (
            <div className="text-center py-16">
              <p className="text-xl text-gray-400 mb-4">
                Please connect your wallet to get started
              </p>
            </div>
          ) : showForm ? (
            <FractionalizationForm
              cnft={selectedCnft}
              onSuccess={handleFractionalizationSuccess}
            />
          ) : (
            <div>
              <h2 className="text-2xl font-semibold text-white mb-6">Your cNFTs</h2>
              <CnftGallery
                cnfts={cnfts}
                onSelectCnft={handleSelectCnft}
                selectedCnft={selectedCnft}
                loading={cnftsLoading}
              />
            </div>
          )}

          {mintError && (
            <div className="mt-4 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
              {mintError}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
