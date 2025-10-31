"use client";

import { useWallet } from "@solana/wallet-adapter-react";

export default function WalletInfo() {
  try {
    const { publicKey } = useWallet();
    
    if (!publicKey) return null;
    
    return (
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
      </span>
    );
  } catch (error) {
    // Wallet context not available yet
    return null;
  }
}




