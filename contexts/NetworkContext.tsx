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
  // Default to devnet for testing, mainnet is for production
  const [network, setNetworkState] = useState<Network>(WalletAdapterNetwork.Devnet);

      // Get RPC endpoint - prefer Helius if available, fallback to public RPC
      const getEndpoint = useCallback((net: Network): string => {
        const heliusUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || "";
        
        if (net === WalletAdapterNetwork.Devnet) {
          if (heliusUrl) {
            // Verify the Helius URL includes the API key (should have ?api-key=)
            if (!heliusUrl.includes("api-key=") && !heliusUrl.includes("apikey=")) {
              console.warn("⚠️ Helius RPC URL may be missing API key. DAS API requires authentication.");
            }
            
            // If it's a devnet URL or doesn't specify network, use it
            if (heliusUrl.includes("devnet.helius-rpc.com") || heliusUrl.includes("devnet.helius") || !heliusUrl.includes("mainnet")) {
              return heliusUrl;
            }
            // If mainnet Helius URL is provided but we're on devnet, still allow it (user might be switching networks)
            return heliusUrl;
          }
          return clusterApiUrl("devnet");
        } else {
          // For mainnet, prefer Helius if available, otherwise use public RPC
          if (heliusUrl && (heliusUrl.includes("mainnet.helius-rpc.com") || heliusUrl.includes("mainnet.helius"))) {
            return heliusUrl;
          }
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

  // Load network preference from localStorage on mount, and auto-detect from Helius URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("solana-network") as Network | null;
      
      if (saved && (saved === WalletAdapterNetwork.Devnet || saved === WalletAdapterNetwork.Mainnet)) {
        setNetworkState(saved);
        setEndpoint(getEndpoint(saved));
      } else {
        // No saved network, auto-detect from Helius URL if available
        const heliusUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || "";
        if (heliusUrl) {
          const urlLower = heliusUrl.toLowerCase();
          if (urlLower.includes("mainnet.helius-rpc.com") || urlLower.includes("mainnet.helius")) {
            // Helius URL is for mainnet
            console.log("🔄 Auto-detecting Mainnet from Helius URL");
            setNetworkState(WalletAdapterNetwork.Mainnet);
            setEndpoint(getEndpoint(WalletAdapterNetwork.Mainnet));
          } else if (urlLower.includes("devnet.helius-rpc.com") || urlLower.includes("devnet.helius")) {
            // Helius URL is for devnet
            console.log("🔄 Auto-detecting Devnet from Helius URL");
            setNetworkState(WalletAdapterNetwork.Devnet);
            setEndpoint(getEndpoint(WalletAdapterNetwork.Devnet));
          }
        }
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
