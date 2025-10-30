'use client';

import { useState } from 'react';
import { PublicKey, Keypair } from '@solana/web3.js';
import type { CnftData } from '../types';
import { useFractionalization } from '../hooks/useFractionalization';
import { useWallet } from '../hooks/useWallet.tsx';

interface FractionalizationFormProps {
  cnft: CnftData | null;
  onSuccess: () => void;
}

export default function FractionalizationForm({ cnft, onSuccess }: FractionalizationFormProps) {
  const { connection, wallet } = useWallet();
  const { fractionalize, loading, error, signature } = useFractionalization(connection, wallet);

  const [totalSupply, setTotalSupply] = useState('1000000');
  const [minLpAgeSeconds, setMinLpAgeSeconds] = useState('');
  const [minReclaimPercent, setMinReclaimPercent] = useState('');
  const [minLiquidityPercent, setMinLiquidityPercent] = useState('');
  const [minVolumePercent30d, setMinVolumePercent30d] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cnft || !wallet) return;

    // Generate a random treasury for testing
    const treasury = Keypair.generate();

    try {
      const sig = await fractionalize(
        cnft,
        {
          totalSupply,
          minLpAgeSeconds,
          minReclaimPercent,
          minLiquidityPercent,
          minVolumePercent30d,
        },
        treasury.publicKey
      );

      console.log('Fractionalization successful:', sig);
      onSuccess();
    } catch (err) {
      console.error('Fractionalization failed:', err);
    }
  };

  if (!cnft) {
    return (
      <div className="text-center p-8 text-gray-400">
        Please select a cNFT to fractionalize
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-800 rounded-lg border border-gray-700">
      <h2 className="text-2xl font-bold text-white mb-6">Fractionalize cNFT</h2>

      <div className="mb-4 p-4 bg-gray-900 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-2">Selected cNFT:</h3>
        <p className="text-gray-300">{cnft.name}</p>
        <p className="text-sm text-gray-400">{cnft.symbol}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Total Supply (in millions)
          </label>
          <input
            type="text"
            value={totalSupply}
            onChange={(e) => setTotalSupply(e.target.value)}
            required
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="e.g., 1000000"
          />
          <p className="text-xs text-gray-500 mt-1">
            Total number of fractional tokens to mint
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Min LP Age Seconds (Optional)
          </label>
          <input
            type="text"
            value={minLpAgeSeconds}
            onChange={(e) => setMinLpAgeSeconds(e.target.value)}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="e.g., 2592000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Min Reclaim Percent (Optional)
          </label>
          <input
            type="text"
            value={minReclaimPercent}
            onChange={(e) => setMinReclaimPercent(e.target.value)}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="e.g., 51"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Min Liquidity Percent (Optional)
          </label>
          <input
            type="text"
            value={minLiquidityPercent}
            onChange={(e) => setMinLiquidityPercent(e.target.value)}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="e.g., 10"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Min Volume Percent (30d) (Optional)
          </label>
          <input
            type="text"
            value={minVolumePercent30d}
            onChange={(e) => setMinVolumePercent30d(e.target.value)}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="e.g., 50"
          />
        </div>

        <div className="p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
          <p className="text-sm text-blue-300">
            <strong>Protocol Fee:</strong> 5% (automatically deducted from total supply)
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
            Error: {error}
          </div>
        )}

        {signature && (
          <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg text-green-300">
            <p className="font-semibold">Transaction successful!</p>
            <p className="text-sm mt-1">
              Signature: <span className="font-mono">{signature}</span>
            </p>
            <a
              href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 hover:text-green-300 underline text-sm"
            >
              View on Explorer
            </a>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 rounded-lg font-semibold transition-colors ${
            loading
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700'
          } text-white`}
        >
          {loading ? 'Fractionalizing...' : 'Fractionalize cNFT'}
        </button>
      </form>
    </div>
  );
}

