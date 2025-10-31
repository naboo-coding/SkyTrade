"use client";

import { useNetwork } from "@/contexts/NetworkContext";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";

export default function NetworkSwitcher() {
  const { network, setNetwork, networkName } = useNetwork();
  const { disconnect } = useWallet();

  const handleNetworkChange = async (newNetwork: WalletAdapterNetwork.Devnet | WalletAdapterNetwork.Mainnet) => {
    if (newNetwork === network) return;

    // Disconnect wallet when switching networks to avoid issues
    await disconnect();
    
    setNetwork(newNetwork);
    
    // Show user-friendly message with instructions
    const networkName = newNetwork === WalletAdapterNetwork.Devnet ? "Devnet" : "Mainnet";
    alert(
      `Switched to ${networkName}.\n\n` +
      `IMPORTANT: Please make sure your wallet extension (Phantom/Solflare) is also set to ${networkName}.\n\n` +
      `After reconnecting, verify the network matches in both the app and your wallet extension.`
    );
  };

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">
        Network:
      </span>
      <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => handleNetworkChange(WalletAdapterNetwork.Devnet)}
          className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
            network === WalletAdapterNetwork.Devnet
              ? "bg-blue-600 text-white"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
          title="Switch to Devnet (for testing)"
        >
          Devnet
        </button>
        <button
          onClick={() => handleNetworkChange(WalletAdapterNetwork.Mainnet)}
          className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
            network === WalletAdapterNetwork.Mainnet
              ? "bg-green-600 text-white"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
          title="Switch to Mainnet"
        >
          Mainnet
        </button>
      </div>
      {network === WalletAdapterNetwork.Devnet && (
        <span className="text-xs text-gray-500 dark:text-gray-500 hidden md:inline">
          (Testing)
        </span>
      )}
    </div>
  );
}
