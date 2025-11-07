"use client";

import { useState, useCallback } from "react";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
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

export function useAssetByIdNoWallet() {
  const { endpoint } = useNetwork();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssetById = useCallback(async (assetId: string) => {
    if (!endpoint || !assetId) {
      setAsset(null);
      setLoading(false);
      setError("Invalid parameters");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const umi = createUmi(endpoint).use(dasApi());

      try {
        const assetData = await umi.rpc.getAsset(publicKey(assetId));

        if (!assetData) {
          throw new Error("Asset not found");
        }

        const metadata = assetData.content?.metadata || {};
        const files = assetData.content?.files || [];
        
        // Also check json_uri which might contain the metadata URI
        const jsonUri = assetData.content?.json_uri as string | undefined;
        const metadataUri = metadata.uri as string | undefined || jsonUri;

        // Try to get image and name from multiple sources
        let imageUrl: string | undefined;
        let assetName: string | undefined;
        let assetSymbol: string | undefined;
        
        // First, try direct metadata
        assetName = metadata.name as string | undefined;
        assetSymbol = metadata.symbol as string | undefined;
        
        // First, try files array for image
        if (files && files.length > 0) {
          imageUrl = (files[0]?.uri || files[0]?.cdn_uri) as string | undefined;
        }
        
        // If no image from files or name is missing, try to fetch from metadata URI
        if (metadataUri && (!imageUrl || !assetName)) {
          const isValidUrl = (url: string): boolean => {
            try {
              const urlObj = new URL(url);
              const invalidDomains = ['example.com', 'example.org', 'localhost', '127.0.0.1'];
              const hostname = urlObj.hostname.toLowerCase();
              if (invalidDomains.some(domain => hostname.includes(domain))) {
                return false;
              }
              return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
            } catch {
              return false;
            }
          };

          if (isValidUrl(metadataUri)) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            try {
              const metadataResponse = await fetch(metadataUri, {
                mode: 'cors',
                signal: controller.signal,
              });
              clearTimeout(timeoutId);
              
              if (metadataResponse.ok) {
                const metadataJson = await metadataResponse.json();
                // Get image from metadata JSON
                if (!imageUrl) {
                  imageUrl = metadataJson.image || metadataJson.image_url || metadataJson.imageUrl;
                }
                // Get name from metadata JSON (prioritize this over direct metadata)
                if (metadataJson.name) {
                  assetName = metadataJson.name;
                }
                // Get symbol from metadata JSON
                if (metadataJson.symbol && !assetSymbol) {
                  assetSymbol = metadataJson.symbol;
                }
              }
            } catch (err: any) {
              clearTimeout(timeoutId);
              // Silently fail
            }
          }
        }
        
        // Fallback to metadata.image if available
        if (!imageUrl && metadata.image) {
          imageUrl = metadata.image as string;
        }

        const fetchedAsset: Asset = {
          id: assetData.id,
          name: assetName || metadata.name || "Unnamed Asset",
          symbol: assetSymbol || metadata.symbol,
          uri: metadataUri,
          image: imageUrl,
          owner: assetData.ownership?.owner || "",
          compressed: assetData.compression?.compressed === true,
        };

        setAsset(fetchedAsset);
      } catch (fetchError: any) {
        const errorMsg = fetchError?.message || String(fetchError);
        const errorString = errorMsg.toLowerCase();
        
        if (errorString.includes("403") || errorString.includes("access forbidden") || errorString.includes("forbidden")) {
          const authError = "Helius DAS API access forbidden. Check your HELIUS_RPC_URL environment variable.";
          setError(authError);
          setAsset(null);
          return;
        }
        
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
  }, [endpoint]);

  return { asset, loading, error, fetchAssetById };
}

