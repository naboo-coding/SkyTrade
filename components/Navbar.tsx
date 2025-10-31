"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import NetworkSwitcher from "./NetworkSwitcher";
import WalletInfo from "./WalletInfo";

// Dynamically import WalletMultiButton to prevent SSR hydration issues
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export default function Navbar() {
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering wallet info after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className="w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              SkyTrade
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            {mounted && <NetworkSwitcher />}
            {mounted && <WalletInfo />}
            {mounted && <WalletMultiButton />}
            {!mounted && (
              <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}