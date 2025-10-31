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
      // Preserve manually added assets when wallet not connected
      setAssets((prev) => prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id)));
      setLoading(false);
      setError(null);
      return;
    }

    // Capture publicKey value at the start to avoid stale closures
    const currentPublicKey = publicKey;
    if (!currentPublicKey) {
      // Preserve manually added assets
      setAssets((prev) => prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id)));
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
        // Preserve manually added assets
        setAssets((prev) => prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id)));
        setLoading(false);
        setError(null);
        return;
      }
      
      // Validate it looks like a valid Solana address (base58, ~44 chars)
      if (ownerAddress.length < 32 || ownerAddress.length > 44) {
        console.warn("Invalid address length:", ownerAddress.length);
        // Preserve manually added assets
        setAssets((prev) => prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id)));
        setLoading(false);
        setError(null);
        return;
      }
    } catch (err) {
      console.error("Error converting publicKey to string:", err);
      // Preserve manually added assets
      setAssets((prev) => prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id)));
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
        // Preserve manually added assets
        setAssets((prev) => prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id)));
        setLoading(false);
        setError(null);
        return;
      }

      // Log for debugging - CRITICAL: Check if endpoint matches expected network
      const isDevnetEndpoint = endpoint.includes("devnet") || endpoint.includes("dev") || endpoint.includes("api.devnet");
      const isMainnetEndpoint = endpoint.includes("mainnet") || endpoint.includes("mainnet-beta");
      console.log("🌐 Network Check:", {
        endpoint: endpoint.slice(0, 60) + "...",
        isDevnetEndpoint,
        isMainnetEndpoint,
        detectedNetwork: isDevnetEndpoint ? "DEVNET" : (isMainnetEndpoint ? "MAINNET" : "UNKNOWN")
      });
      console.log("Creating UMI instance with endpoint:", isDevnetEndpoint ? "devnet" : (isMainnetEndpoint ? "mainnet" : "unknown"));
      console.log("Owner address being used:", ownerAddress);
      
      // WARN if mainnet endpoint detected but user likely has devnet assets
      if (isMainnetEndpoint) {
        console.error("⚠️⚠️⚠️ WARNING: Using MAINNET endpoint! If your cNFTs are on devnet, they won't appear!");
        console.error("⚠️ Fix your .env.local to use: https://devnet.helius-rpc.com/?api-key=YOUR_KEY");
      }
      
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
        // Validate ownerAddress is a valid string before making the API call
        if (!ownerAddress || typeof ownerAddress !== 'string' || ownerAddress.length < 32) {
          throw new Error(`Invalid ownerAddress: ${ownerAddress} (type: ${typeof ownerAddress})`);
        }
        
        console.log("📡 Calling Helius DAS API getAssetsByOwner with:", {
          ownerAddress: ownerAddress.slice(0, 16) + "...",
          ownerAddressLength: ownerAddress.length,
          ownerAddressType: typeof ownerAddress,
          endpoint: endpoint.includes("helius") ? "Helius" : "Public RPC",
          endpointUrl: endpoint.slice(0, 50) + "..."
        });
        
        // Pass ownerAddress as string directly - the DAS API should accept base58 string
        // Double-check ownerAddress is still valid right before the call
        const finalOwnerAddress = ownerAddress;
        if (!finalOwnerAddress) {
          throw new Error("ownerAddress became undefined right before API call!");
        }
        
        console.log("🔍 About to call API with ownerAddress:", finalOwnerAddress.slice(0, 16) + "...");
        
        // CRITICAL FIX: The DAS API expects 'owner' (not 'ownerAddress') as a PublicKey type
        // Convert the string to UMI PublicKey before passing
        const ownerPublicKey = umiPublicKey(finalOwnerAddress);
        console.log("🔑 Converted to PublicKey:", ownerPublicKey.toString().slice(0, 16) + "...");
        
        response = await umi.rpc.getAssetsByOwner({
          owner: ownerPublicKey, // Use 'owner' parameter name with PublicKey type!
          page: 1,
          limit: 100,
        });
        
        console.log("✅ API call succeeded. Response structure:", {
          hasItems: !!response.items,
          itemsLength: response.items?.length || 0,
          hasTotal: !!response.total,
          total: response.total,
          responseKeys: Object.keys(response || {})
        });
      } catch (apiError: any) {
        // Log the FULL error for debugging
        console.error("❌ API Error Details:", {
          message: apiError?.message,
          name: apiError?.name,
          stack: apiError?.stack?.slice(0, 200),
          fullError: apiError,
          stringified: JSON.stringify(apiError, Object.getOwnPropertyNames(apiError))
        });
        
        // Check for 403/authentication errors
        const apiErrorMsg = apiError?.message || String(apiError);
        const errorString = apiErrorMsg.toLowerCase();
        const fullError = JSON.stringify(apiError, Object.getOwnPropertyNames(apiError)).toLowerCase();
        
        // Check if it's a 403 error (in message or in the error object)
        if (errorString.includes("403") || errorString.includes("access forbidden") || errorString.includes("forbidden") || fullError.includes('"code":403')) {
          const errorMsg = "Helius DAS API access forbidden. Please check your NEXT_PUBLIC_HELIUS_RPC_URL environment variable and ensure DAS API is enabled.";
          console.error("❌", errorMsg);
          console.error("Current endpoint:", endpoint);
          console.error("Environment variable check:", process.env.NEXT_PUBLIC_HELIUS_RPC_URL ? "Set" : "Not set");
          setError(errorMsg);
          // Preserve manually added assets even on auth errors
          setAssets((prev) => {
            const manualAssets = prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id));
            console.log(`Preserving ${manualAssets.length} manually added assets despite auth error`);
            return manualAssets;
          });
          setLoading(false);
          return;
        }
        
        // Only treat as "empty wallet" if it's explicitly a "no assets" type error
        // Don't catch other errors - let them bubble up so we can see what's really happening
        if (errorString.includes("no assets") && (errorString.includes("found") || errorString.includes("for owner"))) {
          console.warn("API returned 'no assets found' - treating as empty wallet");
          // Preserve manually added assets even when API returns no assets
          setAssets((prev) => {
            const manualAssets = prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id));
            console.log(`Preserving ${manualAssets.length} manually added assets despite empty API response`);
            return manualAssets;
          });
          setLoading(false);
          setError(null);
          return;
        }
        
        // For all other errors, log them but don't clear manually added assets
        console.error("❌ Unexpected API error - preserving manually added assets and showing error");
        setError(`API Error: ${apiErrorMsg}`);
        setAssets((prev) => {
          const manualAssets = prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id));
          console.log(`Preserving ${manualAssets.length} manually added assets despite API error`);
          return manualAssets;
        });
        setLoading(false);
        return;
      }
      
      // Check if response is valid (not null/undefined)
      if (!response) {
        console.warn("⚠️ API returned null/undefined response");
        setAssets((prev) => {
          const manualAssets = prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id));
          console.log(`Preserving ${manualAssets.length} manually added assets despite null response`);
          return manualAssets;
        });
        setLoading(false);
        return;
      }
      
      console.log("📦 API response received:", {
        itemsCount: response.items?.length || 0,
        total: response.total,
        hasItems: !!response.items,
        itemsType: Array.isArray(response.items) ? "array" : typeof response.items
      });
      
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
      console.log("🔄 Merging assets - Manual IDs to preserve:", {
        count: currentManualIds.size,
        ids: Array.from(currentManualIds)
      });
      
      setAssets((prevAssets) => {
        // Keep manually added assets that aren't in API results
        const manualAssets = prevAssets.filter(a => currentManualIds.has(a.id));
        console.log("🔍 Assets before merge:", {
          prevCount: prevAssets.length,
          prevIds: prevAssets.map(a => a.id.slice(0, 16) + "..."),
          manualFromPrev: manualAssets.length,
          manualIds: manualAssets.map(a => a.id.slice(0, 16) + "..."),
          apiCount: cnfts.length,
          apiIds: cnfts.map(a => a.id.slice(0, 16) + "...")
        });
        
        // Combine manual assets with API results (avoid duplicates)
        const merged = [...cnfts, ...manualAssets.filter(a => !cnfts.some(apiAsset => apiAsset.id === a.id))];
        console.log(`✅ Merged ${merged.length} assets: ${cnfts.length} from API + ${manualAssets.length} manually added`);
        console.log("✅ Final merged asset IDs:", merged.map(a => a.id.slice(0, 16) + "..."));
        console.log("✅ Manual asset IDs that should be preserved:", Array.from(currentManualIds));
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
        // Preserve manually added assets even when there's an error
        setAssets((prev) => {
          const manualAssets = prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id));
          console.log(`Preserving ${manualAssets.length} manually added assets despite error`);
          return manualAssets;
        });
        setError(null); // Clear error for expected empty state
      } else {
        console.error("Unexpected error fetching cNFT assets:", err);
        // Preserve manually added assets even on unexpected errors
        setAssets((prev) => {
          const manualAssets = prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id));
          console.log(`Preserving ${manualAssets.length} manually added assets despite unexpected error`);
          return manualAssets;
        });
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
  const addAssetById = useCallback(async (assetId: string): Promise<{ success: boolean; error?: string }> => {
    if (!wallet?.adapter || !endpoint) {
      const error = "Cannot add asset - wallet not connected";
      console.warn(error);
      return { success: false, error };
    }

    // Validate asset ID format
    if (!assetId || assetId.trim().length === 0) {
      const error = "Invalid asset ID";
      console.warn(error);
      return { success: false, error };
    }

    const trimmedAssetId = assetId.trim();

    try {
      const umi = createUmi(endpoint)
        .use(walletAdapterIdentity(wallet.adapter))
        .use(dasApi());

      console.log("🔍 Attempting to manually fetch asset by ID:", trimmedAssetId);
      console.log("Using endpoint:", endpoint);
      
      let assetData;
      try {
        // Validate the public key format before trying to fetch
        try {
          umiPublicKey(trimmedAssetId);
        } catch (pkError) {
          const error = `Invalid asset ID format: ${trimmedAssetId.slice(0, 16)}...`;
          console.error(error);
          return { success: false, error: "Invalid asset ID format. Please check the Asset ID and try again." };
        }

        assetData = await umi.rpc.getAsset(umiPublicKey(trimmedAssetId));
        console.log("📥 Asset data received:", {
          id: assetData?.id,
          hasCompression: !!assetData?.compression,
          compressed: assetData?.compression?.compressed,
          hasContent: !!assetData?.content,
          hasOwnership: !!assetData?.ownership
        });
      } catch (fetchErr: any) {
        const errMsg = fetchErr?.message || String(fetchErr);
        console.error("❌ Error fetching asset:", fetchErr);
        
        if (errMsg.includes("403") || errMsg.includes("forbidden")) {
          const error = "403 Error: Check your Helius API key in NEXT_PUBLIC_HELIUS_RPC_URL";
          console.error("❌", error);
          return { success: false, error: "API authentication failed. Check your Helius API key." };
        }
        if (errMsg.includes("not found") || errMsg.includes("404") || errMsg.includes("Asset not found")) {
          const error = "Asset not yet indexed by Helius. It exists on-chain but DAS API hasn't indexed it yet. Wait 30-60 seconds and try again.";
          console.log("ℹ️", error);
          return { success: false, error: "Asset not yet indexed. Please wait 30-60 seconds and try again." };
        }
        
        // Re-throw unexpected errors
        throw fetchErr;
      }
      
      if (!assetData) {
        const error = `Asset not found by ID: ${trimmedAssetId}`;
        console.warn(error);
        return { success: false, error: "Asset not found. Please verify the Asset ID." };
      }

      // Check if it's compressed
      const isCompressed = assetData.compression?.compressed === true;
      const assetOwner = assetData.ownership?.owner;
      
      if (!isCompressed) {
        const error = `Asset is not compressed: ${trimmedAssetId.slice(0, 16)}...`;
        console.warn(error);
        return { success: false, error: "This asset is not a compressed NFT (cNFT). Only cNFTs can be fractionalized." };
      }

      const walletAddress = publicKey?.toBase58();
      console.log("🔍 Ownership check:", {
        assetOwner,
        walletAddress,
        matches: walletAddress && assetOwner?.toLowerCase() === walletAddress.toLowerCase()
      });
      
      // Warn but still allow adding if ownership doesn't match (user requested it manually)
      if (walletAddress && assetOwner?.toLowerCase() !== walletAddress.toLowerCase()) {
        console.warn("⚠️ Asset not owned by connected wallet. Owner:", assetOwner, "Wallet:", walletAddress);
        console.log("Adding anyway since user manually requested it...");
      }

      // Extract asset data - handle different content structures
      const metadata = assetData.content?.metadata || assetData.content || {};
      const files = assetData.content?.files || [];
      
      // Try to get image from multiple sources
      let imageUrl: string | undefined;
      if (files && files.length > 0) {
        imageUrl = files[0]?.uri || files[0]?.cdn_uri;
      }
      if (!imageUrl && metadata.image) {
        imageUrl = metadata.image;
      }
      if (!imageUrl && metadata.uri) {
        imageUrl = metadata.uri;
      }
      
      const newAsset: CnftAsset = {
        id: assetData.id,
        name: metadata.name || assetData.id.slice(0, 8) || "Unnamed cNFT",
        symbol: metadata.symbol,
        uri: metadata.uri,
        image: imageUrl,
        owner: assetOwner || walletAddress || "",
      };

      console.log("📦 Prepared asset to add:", {
        id: newAsset.id,
        name: newAsset.name,
        hasImage: !!newAsset.image,
        owner: newAsset.owner?.slice(0, 8) + "..."
      });

      // Mark as manually added BEFORE updating state to ensure it's tracked
      manuallyAddedAssetIdsRef.current.add(newAsset.id);
      const newManualSet = new Set(manuallyAddedAssetIdsRef.current);
      setManuallyAddedAssetIds(newManualSet);
      console.log("📌 Marked asset as manually added BEFORE state update. Total manual assets:", manuallyAddedAssetIdsRef.current.size);
      console.log("📌 Manual asset IDs ref:", Array.from(manuallyAddedAssetIdsRef.current));
      
      // Use functional update to ensure we get the latest state
      setAssets((prev) => {
        console.log("🔍 Current assets BEFORE add:", {
          count: prev.length,
          ids: prev.map(a => a.id.slice(0, 16) + "..."),
          manualAssetIds: Array.from(manuallyAddedAssetIdsRef.current)
        });
        
        // Don't add if already exists
        if (prev.some(a => a.id === newAsset.id)) {
          console.log("⚠️ Asset already in list:", newAsset.id);
          return prev; // Return unchanged if already exists
        }
        
        console.log("✅ Adding asset to gallery! New count will be:", prev.length + 1);
        const updated = [...prev, newAsset];
        console.log("✅ Updated assets array AFTER add:", {
          count: updated.length,
          ids: updated.map(a => a.id.slice(0, 16) + "..."),
          names: updated.map(a => a.name),
          manualAssetIds: Array.from(manuallyAddedAssetIdsRef.current)
        });
        
        return updated;
      });
      
      // Verify the state update happened correctly by checking after a brief delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Double-check that the asset is marked as manual
      const isMarkedManual = manuallyAddedAssetIdsRef.current.has(newAsset.id);
      console.log("✅ Asset marked as manual?", isMarkedManual);
      console.log("✅ All manual asset IDs:", Array.from(manuallyAddedAssetIdsRef.current));
      
      console.log("✅ Asset should now be in gallery and will persist through refetches!");
      return { success: true };
    } catch (err) {
      console.error("❌ Error adding asset by ID:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      let userError = "Failed to add asset. Please check the console for details.";
      
      if (errorMsg.includes("not found") || errorMsg.includes("404")) {
        userError = "Asset not yet indexed. Wait 30-60 seconds and try again.";
      } else if (errorMsg.includes("403") || errorMsg.includes("forbidden")) {
        userError = "API authentication failed. Check your Helius API key.";
      }
      
      return { success: false, error: userError };
    }
  }, [wallet, endpoint, publicKey]);

  return { assets, loading, error, refetch: fetchAssets, addAssetById };
}
