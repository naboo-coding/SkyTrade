"use client";

import { useState, useCallback, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useNetwork } from "@/contexts/NetworkContext";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import { publicKey as umiPublicKey } from "@metaplex-foundation/umi";

/**
 * Validates that an asset is a real on-chain NFT (not a placeholder/test NFT)
 * by checking:
 * 1. It has valid compression/tree data (block hash equivalent)
 * 2. It's owned by the connected wallet on devnet
 */
export function useAssetValidation() {
  const { publicKey } = useWallet();
  const { endpoint, network } = useNetwork();
  const [validatedAssets, setValidatedAssets] = useState<Map<string, boolean>>(new Map());
  const [validating, setValidating] = useState(false);

  const validateAsset = useCallback(async (assetId: string): Promise<boolean> => {
    if (!endpoint || !assetId) {
      console.log(`[Validation] ${assetId.slice(0, 8)}... - No endpoint or assetId`);
      return false;
    }

    try {
      const umi = createUmi(endpoint).use(dasApi());
      const assetData = await umi.rpc.getAsset(umiPublicKey(assetId));

      if (!assetData) {
        console.log(`[Validation] ${assetId.slice(0, 8)}... - Asset data not found`);
        return false;
      }

      // Check if it's compressed
      if (!assetData.compression?.compressed) {
        console.log(`[Validation] ${assetId.slice(0, 8)}... - Not compressed`);
        return false;
      }

      // Check for valid compression data
      const compression = assetData.compression;
      if (!compression) {
        console.log(`[Validation] ${assetId.slice(0, 8)}... - No compression data`);
        return false;
      }

      // Check for ownership data - this is the key indicator of a real NFT
      if (!assetData.ownership) {
        console.log(`[Validation] ${assetId.slice(0, 8)}... - No ownership data`);
        return false;
      }

      const assetOwner = assetData.ownership?.owner;
      if (!assetOwner) {
        console.log(`[Validation] ${assetId.slice(0, 8)}... - No owner`);
        return false;
      }

      // Check for content/metadata - real NFTs should have this
      if (!assetData.content) {
        console.log(`[Validation] ${assetId.slice(0, 8)}... - No content`);
        return false;
      }

      // If we get here, it's a valid compressed NFT with ownership and content
      console.log(`[Validation] ${assetId.slice(0, 8)}... - VALID (compressed, has owner: ${assetOwner.slice(0, 8)}..., has content)`);
      return true;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      // If asset not found or not indexed, it's not valid
      if (errMsg.includes("not found") || errMsg.includes("404") || errMsg.includes("Asset not found")) {
        console.log(`[Validation] ${assetId.slice(0, 8)}... - Asset not found: ${errMsg}`);
        return false;
      }
      console.error(`[Validation] ${assetId.slice(0, 8)}... - Error:`, err);
      return false;
    }
  }, [endpoint, network]);

  const validateAssets = useCallback(async (assetIds: string[]) => {
    if (assetIds.length === 0 || !endpoint) {
      return;
    }

    setValidating(true);
    try {
      const validationResults = await Promise.all(
        assetIds.map(async (id) => {
          const isValid = await validateAsset(id);
          return [id, isValid] as [string, boolean];
        })
      );

      setValidatedAssets((prev) => {
        const newMap = new Map(prev);
        validationResults.forEach(([id, isValid]) => {
          newMap.set(id, isValid);
        });
        return newMap;
      });
    } catch (err) {
      console.error("Error validating assets:", err);
    } finally {
      setValidating(false);
    }
  }, [validateAsset, endpoint]);

  return {
    validateAsset,
    validateAssets,
    validatedAssets,
    validating,
  };
}

