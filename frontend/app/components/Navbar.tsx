'use client';

import { useEffect, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function Navbar() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className="w-full border-b border-gray-800 bg-gray-900">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">SkyTrade</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-purple-600 rounded-lg">
            <span className="text-sm text-white font-semibold">DEVNET</span>
          </div>
          {mounted && <WalletMultiButton />}
        </div>
      </div>
    </nav>
  );
}

