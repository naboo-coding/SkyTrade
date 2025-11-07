"use client";

import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useEffect, useState } from "react";
import VaultExplorer from "@/components/VaultExplorer";
import { useWallet } from "@solana/wallet-adapter-react";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { publicKey } = useWallet();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />
      <main className="relative overflow-hidden">
        {/* Hero Section */}
        <section className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden">
          {/* Subtle background gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-gray-50 via-white to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 -z-10" />
          
          {/* Smooth background lighting with enhanced blur to remove artifacts */}
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-blue-200 dark:bg-blue-950 rounded-full mix-blend-multiply dark:mix-blend-soft-light blur-[120px] opacity-25 ambient-light" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-200 dark:bg-purple-950 rounded-full mix-blend-multiply dark:mix-blend-soft-light blur-[120px] opacity-15 ambient-light" style={{ animationDelay: "2s" }} />
          <div className="absolute top-1/2 left-1/3 w-[400px] h-[400px] bg-indigo-200 dark:bg-indigo-950 rounded-full mix-blend-multiply dark:mix-blend-soft-light blur-[120px] opacity-10 ambient-light" style={{ animationDelay: "4s" }} />

          <div className="max-w-3xl mx-auto text-center space-y-12 relative z-10">
            {/* Main Title with Apple-like shimmer */}
            <div className={`space-y-6 ${mounted ? "animate-fadeInUp" : "opacity-0"}`}>
              <h1 className="text-6xl sm:text-7xl md:text-8xl font-light tracking-tight leading-none">
                <span className="shimmer-text dark:shimmer-text-dark inline-block">
                  SkyTrade
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-xl mx-auto font-light leading-relaxed">
                Fractionalize compressed NFTs into tradeable tokens on Solana
              </p>
            </div>

            {/* CTA Button */}
            <div className={`pt-2 ${mounted ? "animate-fadeIn" : "opacity-0"}`} style={{ animationDelay: "0.3s" }}>
              <Link
                href="/fractionalize"
                className="inline-flex items-center px-6 py-3 text-base font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
              >
                Get Started
                <svg
                  className="ml-2 w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Link>
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                {publicKey
                  ? "Scroll down to check out your vaults"
                  : "Connect your wallet to check your vaults"}
              </p>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-2xl sm:text-3xl font-light text-gray-900 dark:text-white mb-3 tracking-tight">
                Features
              </h2>
              <div className="w-12 h-px bg-gray-300 dark:bg-gray-700 mx-auto"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {/* Feature 1 */}
              <div className="group text-center">
                <div className="w-10 h-10 mx-auto mb-4 flex items-center justify-center text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors duration-200">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Fast
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  Streamlined fractionalization process
                </p>
              </div>

              {/* Feature 2 */}
              <div className="group text-center">
                <div className="w-10 h-10 mx-auto mb-4 flex items-center justify-center text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors duration-200">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Secure
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  Built on Solana blockchain
                </p>
              </div>

              {/* Feature 3 */}
              <div className="group text-center">
                <div className="w-10 h-10 mx-auto mb-4 flex items-center justify-center text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors duration-200">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Liquid
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  Convert NFTs to tradeable tokens
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Vault Explorer Section */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800">
          <div className="max-w-7xl mx-auto">
            <VaultExplorer />
          </div>
        </section>
      </main>
    </div>
  );
}
