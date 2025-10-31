"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NetworkSwitcher from "./NetworkSwitcher";
import WalletInfo from "./WalletInfo";

// Dynamically import WalletMultiButton to prevent SSR hydration issues
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export default function Navbar() {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // Prevent hydration mismatch by only rendering wallet info after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className="w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                SkyTrade
              </h1>
            </Link>
            <div className="hidden md:flex items-center space-x-4">
              <Link
                href="/"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === "/"
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                Home
              </Link>
              <Link
                href="/fractionalize"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === "/fractionalize"
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                Fractionalize
              </Link>
            </div>
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