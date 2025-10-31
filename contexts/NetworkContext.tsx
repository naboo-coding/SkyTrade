"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl } from "@solana/web3.js";

type Network = WalletAdapterNetwork.Devnet | WalletAdapterNetwork.Mainnet;

interface NetworkContextType {
  network: Network;
  setNetwork: (network: Network) => void;
  endpoint: string;
  networkName: string;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  // Default to devnet
  const [network, setNetworkState] = useState<Network>(WalletAdapterNetwork.Devnet);

      // Get RPC endpoint - prefer Helius for devnet, fallback to public RPC
      const getEndpoint = useCallback((net: Network): string => {
        const heliusUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || "";
        
        if (net === WalletAdapterNetwork.Devnet) {
          if (heliusUrl) {
            // Verify the Helius URL includes the API key (should have ?api-key=)
            if (!heliusUrl.includes("api-key=") && !heliusUrl.includes("apikey=")) {
              console.warn("⚠️ Helius RPC URL may be missing API key. DAS API requires authentication.");
            }
            return heliusUrl;
          }
          return clusterApiUrl("devnet");
        } else {
          // For mainnet, you might want a different Helius URL or use public
          return clusterApiUrl("mainnet-beta");
        }
      }, []);

  const [endpoint, setEndpoint] = useState(() => getEndpoint(network));

  const setNetwork = useCallback((newNetwork: Network) => {
    setNetworkState(newNetwork);
    setEndpoint(getEndpoint(newNetwork));
    // Store preference in localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("solana-network", newNetwork);
    }
  }, [getEndpoint]);

  // Load network preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("solana-network") as Network | null;
      if (saved && (saved === WalletAdapterNetwork.Devnet || saved === WalletAdapterNetwork.Mainnet)) {
        setNetworkState(saved);
        setEndpoint(getEndpoint(saved));
      }
    }
  }, [getEndpoint]);

  const networkName = network === WalletAdapterNetwork.Devnet ? "Devnet" : "Mainnet";

  return (
    <NetworkContext.Provider value={{ network, setNetwork, endpoint, networkName }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within NetworkProvider");
  }
  return context;
}
