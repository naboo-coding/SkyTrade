"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import { useNetwork } from "@/contexts/NetworkContext";
import { publicKey } from "@metaplex-foundation/umi";

interface Asset {
  id: string;
  name: string;
  symbol?: string;
  uri?: string;
  image?: string;
  owner: string;
  compressed: boolean;
}

export function useAssetById() {
  const { wallet } = useWallet();
  const { endpoint } = useNetwork();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssetById = useCallback(async (assetId: string) => {
    if (!wallet?.adapter || !endpoint || !assetId) {
      setAsset(null);
      setLoading(false);
      setError("Invalid parameters");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const umi = createUmi(endpoint)
        .use(walletAdapterIdentity(wallet.adapter))
        .use(dasApi());

      console.log("Attempting to fetch asset by ID:", assetId);
      
      try {
        const assetData = await umi.rpc.getAsset(publicKey(assetId));
        
        console.log("Asset data received:", {
          id: assetData?.id,
          compressed: assetData?.compression?.compressed,
          hasOwner: !!assetData?.ownership?.owner,
          owner: assetData?.ownership?.owner
        });

        if (!assetData) {
          throw new Error("Asset not found");
        }

        const metadata = assetData.content?.metadata || {};
        const files = assetData.content?.files || [];

        const fetchedAsset: Asset = {
          id: assetData.id,
          name: metadata.name || "Unnamed Asset",
          symbol: metadata.symbol,
          uri: metadata.uri,
          image: files[0]?.uri || metadata.uri,
          owner: assetData.ownership?.owner || "",
          compressed: assetData.compression?.compressed === true,
        };

        console.log("✅ Asset fetched successfully:", fetchedAsset);
        console.log("Asset owner matches wallet:", fetchedAsset.owner === wallet?.adapter?.publicKey?.toBase58());
        setAsset(fetchedAsset);
      } catch (fetchError: any) {
        const errorMsg = fetchError?.message || String(fetchError);
        const errorString = errorMsg.toLowerCase();
        
        // Check for 403/authentication errors
        if (errorString.includes("403") || errorString.includes("access forbidden") || errorString.includes("forbidden")) {
          const authError = "Helius DAS API access forbidden. Check your HELIUS_RPC_URL environment variable.";
          console.error("❌", authError);
          setError(authError);
          setAsset(null);
          return;
        }
        
        // Don't log "not found" as an error - it's expected if asset isn't indexed yet
        if (errorMsg.includes("not found") || errorMsg.includes("404") || errorMsg.includes("Asset not found")) {
          console.log("ℹ️ Asset not yet indexed by Helius DAS API. This is normal - wait 30-60 seconds.");
          setError(null); // Don't show error to user - it's expected during indexing
          setAsset(null);
          return; // Early return instead of throwing
        }
        // Only log/throw for unexpected errors
        console.error("❌ Unexpected error fetching asset by ID:", fetchError);
        throw fetchError;
      }
    } catch (err) {
      console.error("Error fetching asset by ID:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch asset";
      setError(errorMessage);
      setAsset(null);
    } finally {
      setLoading(false);
    }
  }, [wallet, endpoint]);

  return { asset, loading, error, fetchAssetById };
}

