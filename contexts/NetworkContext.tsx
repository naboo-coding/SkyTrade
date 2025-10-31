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
            // CRITICAL: Check if the Helius URL is for mainnet and warn/reject it
            if (heliusUrl.includes("mainnet.helius-rpc.com") || heliusUrl.includes("mainnet.helius")) {
              console.error("❌ ERROR: Helius RPC URL is for MAINNET but you're on DEVNET!");
              console.error("❌ Your assets are on devnet but you're querying mainnet!");
              console.error("❌ Fix: Update NEXT_PUBLIC_HELIUS_RPC_URL to use devnet.helius-rpc.com");
              // Still use it but log the error - user needs to fix their env var
              return heliusUrl;
            }
            
            // Verify the Helius URL includes the API key (should have ?api-key=)
            if (!heliusUrl.includes("api-key=") && !heliusUrl.includes("apikey=")) {
              console.warn("⚠️ Helius RPC URL may be missing API key. DAS API requires authentication.");
            }
            
            // If it's a devnet URL or doesn't specify network, use it
            if (heliusUrl.includes("devnet.helius-rpc.com") || heliusUrl.includes("devnet.helius") || !heliusUrl.includes("mainnet")) {
              return heliusUrl;
            }
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
      const heliusUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || "";
      const saved = localStorage.getItem("solana-network") as Network | null;
      
      // CRITICAL: If Helius URL is for mainnet but user has devnet assets, force devnet
      if (heliusUrl.includes("mainnet.helius-rpc.com") || heliusUrl.includes("mainnet.helius")) {
        console.error("⚠️ WARNING: Your Helius URL is for MAINNET!");
        console.error("⚠️ If your cNFTs are on devnet, you MUST use a devnet Helius URL!");
        console.error("⚠️ Fix your .env.local: NEXT_PUBLIC_HELIUS_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY");
      }
      
      if (saved && (saved === WalletAdapterNetwork.Devnet || saved === WalletAdapterNetwork.Mainnet)) {
        // If saved network doesn't match the Helius URL, prefer the URL
        if (saved === WalletAdapterNetwork.Mainnet && heliusUrl.includes("devnet.helius")) {
          console.warn("⚠️ Network mismatch: localStorage says mainnet but Helius URL is devnet. Forcing devnet.");
          setNetworkState(WalletAdapterNetwork.Devnet);
          setEndpoint(getEndpoint(WalletAdapterNetwork.Devnet));
          localStorage.setItem("solana-network", WalletAdapterNetwork.Devnet);
        } else {
          setNetworkState(saved);
          setEndpoint(getEndpoint(saved));
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
