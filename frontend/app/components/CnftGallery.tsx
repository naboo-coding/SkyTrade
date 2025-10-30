'use client';

import { PublicKey } from '@solana/web3.js';
import type { CnftData } from '../types';

interface CnftGalleryProps {
  cnfts: CnftData[];
  onSelectCnft: (cnft: CnftData) => void;
  selectedCnft: CnftData | null;
  loading?: boolean;
}

export default function CnftGallery({ cnfts, onSelectCnft, selectedCnft, loading }: CnftGalleryProps) {
  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-white">Loading your cNFTs...</div>
      </div>
    );
  }

  if (cnfts.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-400">No cNFTs found in your wallet.</p>
        <p className="text-sm text-gray-500 mt-2">
          Use the "Mint Test cNFT" button to create one for testing.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {cnfts.map((cnft) => (
        <div
          key={cnft.id}
          onClick={() => onSelectCnft(cnft)}
          className={`relative cursor-pointer rounded-lg border-2 transition-all ${
            selectedCnft?.id === cnft.id
              ? 'border-purple-500 ring-2 ring-purple-300'
              : 'border-gray-700 hover:border-gray-600'
          } bg-gray-800 overflow-hidden`}
        >
          <div className="aspect-square bg-gray-700 flex items-center justify-center">
            {cnft.image ? (
              <img
                src={cnft.image}
                alt={cnft.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-gray-500 text-4xl">🎨</div>
            )}
          </div>
          <div className="p-4">
            <h3 className="text-white font-semibold truncate">{cnft.name}</h3>
            <p className="text-gray-400 text-sm truncate">{cnft.symbol}</p>
            <p className="text-gray-500 text-xs mt-2 truncate">
              {cnft.id.slice(0, 8)}...{cnft.id.slice(-8)}
            </p>
          </div>
          {selectedCnft?.id === cnft.id && (
            <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
              Selected
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

