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

      try {
        const assetData = await umi.rpc.getAsset(publicKey(assetId));

        if (!assetData) {
          throw new Error("Asset not found");
        }

        const metadata = assetData.content?.metadata || {};
        const files = assetData.content?.files || [];

        // Try to get image from multiple sources
        let imageUrl: string | undefined;
        
        // First, try files array
        if (files && files.length > 0) {
          imageUrl = (files[0]?.uri || files[0]?.cdn_uri) as string | undefined;
        }
        
        // If no image from files, try to fetch from metadata URI
        // Skip placeholder/invalid URLs to avoid CORS errors
        if (!imageUrl && metadata.uri) {
          const isValidUrl = (url: string): boolean => {
            try {
              const urlObj = new URL(url);
              // Skip placeholder domains
              const invalidDomains = ['example.com', 'example.org', 'localhost', '127.0.0.1'];
              const hostname = urlObj.hostname.toLowerCase();
              if (invalidDomains.some(domain => hostname.includes(domain))) {
                return false;
              }
              // Must be http or https
              return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
            } catch {
              return false;
            }
          };

          if (isValidUrl(metadata.uri as string)) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            try {
              const metadataResponse = await fetch(metadata.uri as string, {
                mode: 'cors',
                signal: controller.signal,
              });
              clearTimeout(timeoutId);
              
              if (metadataResponse.ok) {
                const metadataJson = await metadataResponse.json();
                imageUrl = metadataJson.image || metadataJson.image_url || metadataJson.imageUrl;
              }
            } catch (err: any) {
              clearTimeout(timeoutId);
              // Silently fail - skip CORS, network, and abort errors
              if (err?.name === 'AbortError' || err?.name === 'TypeError' || err?.message?.includes('CORS')) {
                // Expected errors, don't log
              }
            }
          }
        }
        
        // Fallback to metadata.image if available
        if (!imageUrl && metadata.image) {
          imageUrl = metadata.image as string;
        }

        const fetchedAsset: Asset = {
          id: assetData.id,
          name: metadata.name || "Unnamed Asset",
          symbol: metadata.symbol,
          uri: metadata.uri as string | undefined,
          image: imageUrl,
          owner: assetData.ownership?.owner || "",
          compressed: assetData.compression?.compressed === true,
        };

        setAsset(fetchedAsset);
      } catch (fetchError: any) {
        const errorMsg = fetchError?.message || String(fetchError);
        const errorString = errorMsg.toLowerCase();
        
        // Check for 403/authentication errors
        if (errorString.includes("403") || errorString.includes("access forbidden") || errorString.includes("forbidden")) {
          const authError = "Helius DAS API access forbidden. Check your HELIUS_RPC_URL environment variable.";
          setError(authError);
          setAsset(null);
          return;
        }
        
        // Don't log "not found" as an error - it's expected if asset isn't indexed yet
        if (errorMsg.includes("not found") || errorMsg.includes("404") || errorMsg.includes("Asset not found")) {
          setError(null);
          setAsset(null);
          return;
        }
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

