"use client";

import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import useUmiStore from "@/store/useUmiStore";
import { useNetwork } from "@/contexts/NetworkContext";
import type { WalletAdapter } from "@solana/wallet-adapter-base";

export function UmiProvider({ children }: { children: React.ReactNode }) {
  // Always call hooks unconditionally - they must be in same order every render
  const { endpoint } = useNetwork();
  const { updateSigner, updateRpcUrl } = useUmiStore();
  
  // useWallet must be called unconditionally - WalletProvider should always be available
  // since UmiProvider is inside WalletProvider in the layout
  const walletContext = useWallet();
  const wallet = walletContext?.wallet || null;

  // Update RPC URL when endpoint changes
  useEffect(() => {
    updateRpcUrl(endpoint);
  }, [endpoint, updateRpcUrl]);

  // Update signer when wallet changes
  useEffect(() => {
    if (!wallet?.adapter) {
      updateSigner(null);
      return;
    }
    // When wallet.adapter changes, update the signer in umiStore with the new wallet adapter.
    updateSigner(wallet.adapter as unknown as WalletAdapter);
  }, [wallet, updateSigner]);

  return <>{children}</>;
}

