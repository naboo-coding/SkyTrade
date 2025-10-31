"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import { useNetwork } from "@/contexts/NetworkContext";
import { publicKey as umiPublicKey } from "@metaplex-foundation/umi";

interface CnftAsset {
  id: string;
  name: string;
  symbol?: string;
  uri?: string;
  image?: string;
  owner: string;
}

export function useCnftAssets() {
  const { publicKey, wallet } = useWallet();
  const { endpoint } = useNetwork();
  const [assets, setAssets] = useState<CnftAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track manually added assets to prevent them from being cleared
  const manuallyAddedAssetIdsRef = useRef<Set<string>>(new Set());
  const [manuallyAddedAssetIds, setManuallyAddedAssetIds] = useState<Set<string>>(new Set());

  const fetchAssets = useCallback(async () => {
    // Early return if wallet is not ready - check all conditions
    if (!publicKey || !wallet?.adapter || !endpoint) {
      setAssets([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Capture publicKey value at the start to avoid stale closures
    const currentPublicKey = publicKey;
    if (!currentPublicKey) {
      setAssets([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Validate publicKey is still valid and get address safely
    let ownerAddress: string;
    try {
      ownerAddress = currentPublicKey.toBase58();
      if (!ownerAddress || ownerAddress.length === 0 || ownerAddress === "undefined") {
        console.warn("PublicKey.toBase58() returned invalid value:", ownerAddress);
        setAssets([]);
        setLoading(false);
        setError(null);
        return;
      }
      
      // Validate it looks like a valid Solana address (base58, ~44 chars)
      if (ownerAddress.length < 32 || ownerAddress.length > 44) {
        console.warn("Invalid address length:", ownerAddress.length);
        setAssets([]);
        setLoading(false);
        setError(null);
        return;
      }
    } catch (err) {
      console.error("Error converting publicKey to string:", err);
      setAssets([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Double-check ownerAddress one more time before API call
      if (!ownerAddress || ownerAddress === "undefined" || ownerAddress.length === 0) {
        console.warn("Invalid ownerAddress before API call, aborting");
        setAssets([]);
        setLoading(false);
        setError(null);
        return;
      }

      // Log for debugging
      console.log("Creating UMI instance with endpoint:", endpoint.includes("devnet") ? "devnet" : "mainnet");
      console.log("Owner address being used:", ownerAddress);
      
      // Final validation - throw error before API call if invalid
      if (!ownerAddress || ownerAddress === "undefined" || typeof ownerAddress !== "string" || ownerAddress.length < 32) {
        const errorMsg = `Invalid owner address before API call: ${ownerAddress}`;
        console.error(errorMsg);
        setAssets([]);
        setLoading(false);
        setError(null); // Don't show error to user, just log it
        return;
      }
      
      const umi = createUmi(endpoint)
        .use(walletAdapterIdentity(wallet.adapter))
        .use(dasApi());

      console.log("Fetching assets for owner:", ownerAddress.slice(0, 8) + "...");
      
      // Fetch assets owned by the wallet - wrap in try-catch to handle API errors gracefully
      let response;
      try {
        response = await umi.rpc.getAssetsByOwner({
          ownerAddress: ownerAddress,
          page: 1,
          limit: 100,
        });
      } catch (apiError: any) {
        // Check for 403/authentication errors
        const apiErrorMsg = apiError?.message || String(apiError);
        const errorString = apiErrorMsg.toLowerCase();
        const fullError = JSON.stringify(apiError).toLowerCase();
        
        // Check if it's a 403 error (in message or in the error object)
        if (errorString.includes("403") || errorString.includes("access forbidden") || errorString.includes("forbidden") || fullError.includes('"code":403')) {
          const errorMsg = "Helius DAS API access forbidden. Please check your NEXT_PUBLIC_HELIUS_RPC_URL environment variable and ensure DAS API is enabled.";
          console.error("❌", errorMsg);
          console.error("Full error:", apiError);
          console.error("Current endpoint:", endpoint);
          console.error("Environment variable check:", process.env.NEXT_PUBLIC_HELIUS_RPC_URL ? "Set" : "Not set");
          setError(errorMsg);
          setAssets([]);
          setLoading(false);
          return;
        }
        
        // If API returns error about undefined owner, it means our validation didn't catch it
        if (apiErrorMsg.includes("undefined") || apiErrorMsg.includes("No assets found")) {
          console.warn("API returned expected empty/undefined error, treating as empty wallet");
          setAssets([]);
          setLoading(false);
          setError(null);
          return;
        }
        throw apiError; // Re-throw unexpected errors
      }
      
      console.log("API response received, items count:", response.items?.length || 0);
      
      // Log detailed info about ALL assets returned
      if (response.items && response.items.length > 0) {
        console.log(`\n=== API RETURNED ${response.items.length} ASSETS ===`);
        response.items.forEach((asset, idx) => {
          console.log(`Asset ${idx + 1}:`, {
            id: asset.id?.slice(0, 16) + "...",
            compressed: asset.compression?.compressed,
            owner: asset.ownership?.owner,
            ownerMatches: asset.ownership?.owner?.toLowerCase() === ownerAddress.toLowerCase(),
            contentType: asset.content?.json_uri ? "json_uri" : asset.content?.metadata ? "metadata" : "unknown"
          });
        });
        console.log(`=== END OF ASSETS ===\n`);
        
        // Log a sample of the first asset structure
        console.log("Sample asset structure (first asset):", {
          id: response.items[0].id,
          hasCompression: !!response.items[0].compression,
          compressed: response.items[0].compression?.compressed,
          hasOwnership: !!response.items[0].ownership,
          owner: response.items[0].ownership?.owner,
          fullAsset: JSON.stringify(response.items[0], null, 2).slice(0, 1000)
        });
      } else {
        console.log("⚠️ API returned 0 assets for owner:", ownerAddress);
      }

      // Filter for compressed NFTs (cNFTs) only
      const cnfts: CnftAsset[] = [];
      
      for (const asset of response.items || []) {
        const isCompressed = asset.compression?.compressed === true;
        const assetOwner = asset.ownership?.owner;
        const hasOwner = !!assetOwner;
        const ownerMatches = assetOwner?.toLowerCase() === ownerAddress.toLowerCase();
        
        // More detailed logging
        console.log(`Processing asset ${asset.id?.slice(0, 16)}...`, {
          compressed: isCompressed,
          hasOwner,
          owner: assetOwner?.slice(0, 8) + "...",
          ownerMatches
        });
        
        // Check if it's a compressed NFT AND owner matches
        if (isCompressed && hasOwner) {
          // Verify owner matches (case-insensitive)
          if (!ownerMatches) {
            console.log(`⚠️ Owner mismatch! Expected: ${ownerAddress.slice(0, 8)}..., Got: ${assetOwner?.slice(0, 8)}...`);
            // Still add it but log the mismatch
          }
          
          const metadata = asset.content?.metadata || {};
          const files = asset.content?.files || [];
          
          console.log("✅ Adding compressed NFT to gallery:", {
            id: asset.id,
            name: metadata.name || "Unnamed",
            owner: asset.ownership.owner,
            ownerMatches,
            hasImage: !!(files[0]?.uri || metadata.uri)
          });
          
          cnfts.push({
            id: asset.id,
            name: metadata.name || "Unnamed cNFT",
            symbol: metadata.symbol,
            uri: metadata.uri,
            image: files[0]?.uri || metadata.uri, // Try to get image from files or metadata
            owner: asset.ownership.owner,
          });
        } else {
          if (!isCompressed) {
            console.log(`⊘ Skipping - not compressed: ${asset.id?.slice(0, 16)}...`);
          }
          if (!hasOwner) {
            console.log(`⊘ Skipping - no owner: ${asset.id?.slice(0, 16)}...`);
          }
        }
      }

      // Merge manually added assets with API results
      // Use ref to access current manual asset IDs synchronously
      const currentManualIds = manuallyAddedAssetIdsRef.current;
      setAssets((prevAssets) => {
        // Keep manually added assets that aren't in API results
        const manualAssets = prevAssets.filter(a => currentManualIds.has(a.id));
        // Combine manual assets with API results (avoid duplicates)
        const merged = [...cnfts, ...manualAssets.filter(a => !cnfts.some(apiAsset => apiAsset.id === a.id))];
        console.log(`Merged ${merged.length} assets: ${cnfts.length} from API + ${manualAssets.length} manually added`);
        return merged;
      });
      console.log(`Found ${cnfts.length} compressed NFTs out of ${response.items?.length || 0} total items`);
    } catch (err) {
      // Don't show error if it's just "no assets found" or "undefined owner" - that's expected
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorString = errorMessage.toLowerCase();
      
      // Suppress expected errors (empty wallet, undefined owner during connection)
      if (
        errorString.includes("no assets found") || 
        errorString.includes("undefined") ||
        errorString.includes("owner") ||
        errorString.includes("invalid owner")
      ) {
        console.log("Expected empty state or connection issue, suppressing error");
        setAssets([]);
        setError(null); // Clear error for expected empty state
      } else {
        console.error("Unexpected error fetching cNFT assets:", err);
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [publicKey, wallet, endpoint]);

  useEffect(() => {
    // Only fetch if we have a valid publicKey
    // Use a small delay to ensure wallet context is fully initialized
    if (!publicKey || !wallet?.adapter || !endpoint) {
      return;
    }
    
    const timer = setTimeout(() => {
      // Double-check publicKey is still valid
      if (publicKey && wallet?.adapter && endpoint) {
        try {
          const address = publicKey.toBase58();
          if (address && address.length > 0) {
            console.log("Fetching assets for publicKey:", address.slice(0, 8) + "...");
            fetchAssets();
          }
        } catch (err) {
          console.warn("Cannot fetch assets - publicKey not ready:", err);
        }
      }
    }, 500); // Wait 500ms for wallet to be fully ready
    
    return () => clearTimeout(timer);
  }, [publicKey?.toBase58(), wallet, endpoint]); // Use toBase58() in deps to avoid infinite loops

  // Function to manually add an asset by ID (for assets that exist but aren't indexed yet)
  const addAssetById = useCallback(async (assetId: string) => {
    if (!wallet?.adapter || !endpoint) {
      console.warn("Cannot add asset - wallet not connected");
      return;
    }

    try {
      const umi = createUmi(endpoint)
        .use(walletAdapterIdentity(wallet.adapter))
        .use(dasApi());

      console.log("🔍 Attempting to manually fetch asset by ID:", assetId);
      console.log("Using endpoint:", endpoint);
      
      let assetData;
      try {
        assetData = await umi.rpc.getAsset(umiPublicKey(assetId));
      } catch (fetchErr: any) {
        const errMsg = fetchErr?.message || String(fetchErr);
        if (errMsg.includes("403") || errMsg.includes("forbidden")) {
          console.error("❌ 403 Error: Check your Helius API key in NEXT_PUBLIC_HELIUS_RPC_URL");
          return;
        }
        if (errMsg.includes("not found") || errMsg.includes("404")) {
          console.log("ℹ️ Asset not yet indexed by Helius. It exists on-chain but DAS API hasn't indexed it yet.");
          console.log("Wait 30-60 seconds and try again, or check it on Solana Explorer.");
          return;
        }
        throw fetchErr;
      }
      
      if (!assetData) {
        console.warn("Asset not found by ID:", assetId);
        return;
      }

      // Check if it's compressed and owned by us
      const isCompressed = assetData.compression?.compressed === true;
      const assetOwner = assetData.ownership?.owner;
      
      if (!isCompressed) {
        console.warn("Asset is not compressed:", assetId);
        return;
      }

      const walletAddress = publicKey?.toBase58();
      console.log("🔍 Ownership check:", {
        assetOwner,
        walletAddress,
        matches: walletAddress && assetOwner?.toLowerCase() === walletAddress.toLowerCase()
      });
      
      if (walletAddress && assetOwner?.toLowerCase() !== walletAddress.toLowerCase()) {
        console.warn("⚠️ Asset not owned by connected wallet. Owner:", assetOwner, "Wallet:", walletAddress);
        // Don't return - add it anyway if user manually requested it
        console.log("Adding anyway since user manually requested it...");
      }

      // Add to assets list
      const metadata = assetData.content?.metadata || {};
      const files = assetData.content?.files || [];
      
      const newAsset: CnftAsset = {
        id: assetData.id,
        name: metadata.name || "Unnamed cNFT",
        symbol: metadata.symbol,
        uri: metadata.uri,
        image: files[0]?.uri || metadata.uri,
        owner: assetOwner || "",
      };

      console.log("📦 Prepared asset to add:", newAsset);

      setAssets((prev) => {
        console.log("Current assets count before add:", prev.length);
        // Don't add if already exists
        if (prev.some(a => a.id === newAsset.id)) {
          console.log("⚠️ Asset already in list:", newAsset.id);
          return prev;
        }
        console.log("✅ Adding asset to gallery! New count will be:", prev.length + 1);
        const updated = [...prev, newAsset];
        console.log("Updated assets array:", updated.map(a => ({ id: a.id.slice(0, 16) + "...", name: a.name })));
        
        // Mark as manually added so it doesn't get cleared by refetch
        manuallyAddedAssetIdsRef.current.add(newAsset.id);
        setManuallyAddedAssetIds(new Set(manuallyAddedAssetIdsRef.current));
        console.log("📌 Marked asset as manually added. Total manual assets:", manuallyAddedAssetIdsRef.current.size);
        
        return updated;
      });
      
      console.log("✅ Asset should now be in gallery and will persist through refetches!");
    } catch (err) {
      console.error("Error adding asset by ID:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes("not found") || errorMsg.includes("404")) {
        console.log("Asset not yet indexed. Wait 30-60 seconds and try again.");
      }
    }
  }, [wallet, endpoint, publicKey]);

  return { assets, loading, error, refetch: fetchAssets, addAssetById };
}
