"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";

export default function Home() {
  const { connected } = useWallet();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {!mounted ? (
          <div className="text-center py-12">
            <div className="animate-pulse">
              <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-96 mx-auto mb-4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64 mx-auto"></div>
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Welcome to SkyTrade
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
              Fractionalize your compressed NFTs on Solana into tradeable tokens
            </p>

            {connected ? (
              <div className="space-y-4">
                <Link
                  href="/fractionalize"
                  className="inline-block px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Go to Fractionalize
                </Link>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-6">
                  Your wallet is connected. Click above to start fractionalizing your cNFTs.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                  Connect your wallet to get started
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Use the wallet button in the navigation bar to connect
                </p>
              </div>
            )}

            <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <div className="text-4xl mb-4">🔐</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Secure
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Connect your Solana wallet safely
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <div className="text-4xl mb-4">⚡</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Fast
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Fractionalize cNFTs in seconds
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <div className="text-4xl mb-4">💰</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Tradeable
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Turn NFTs into liquid tokens
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
