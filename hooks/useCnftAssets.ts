"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PublicKey, Connection, ConfirmedSignatureInfo } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import umiWithCurrentWalletAdapter from "@/lib/umi/umiWithCurrentWalletAdapter";
import { useNetwork } from "@/contexts/NetworkContext";
import { publicKey as umiPublicKey } from "@metaplex-foundation/umi";
import { withRateLimit } from "@/utils/rateLimiter";

interface CnftAsset {
  id: string;
  name: string;
  symbol?: string;
  uri?: string;
  image?: string;
  owner: string;
  createdAt?: number; // Timestamp in milliseconds
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
  // Store full manually added asset data so we can restore them during refetch
  const manuallyAddedAssetsRef = useRef<Map<string, CnftAsset>>(new Map());
  // Track deleted asset IDs to prevent them from reappearing after refresh
  const deletedAssetIdsRef = useRef<Set<string>>(new Set());
  const [deletedAssetIds, setDeletedAssetIds] = useState<Set<string>>(new Set());

  // Load deleted asset IDs from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("deleted-nft-ids");
        if (saved) {
          const parsed = JSON.parse(saved) as string[];
          const deletedSet = new Set(parsed);
          deletedAssetIdsRef.current = deletedSet;
          setDeletedAssetIds(deletedSet);
        }
      } catch (err) {
        // Silently fail - will just not filter deleted assets
      }
    }
  }, []);

  // Helper function to format time ago
  const getTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
  };

  // Helper function to get creation time using Solana RPC getSignaturesForAddress
  // getSignaturesForAddress returns signatures in reverse chronological order (newest first)
  // So we need to paginate backwards to find the OLDEST transaction (creation time)
  const getCreationTimeFromRPC = async (assetId: string, endpoint: string): Promise<number | null> => {
    try {
      if (!endpoint) {
        return null;
      }
      
      // Create a Solana Connection to use native RPC methods
      const connection = new Connection(endpoint, 'confirmed');
      const publicKey = new PublicKey(assetId);
      
      // Get transaction signatures - they're returned in reverse chronological order (newest first)
      // We need to paginate backwards to find the oldest transaction
      let before: string | undefined = undefined;
      let oldestSignature: ConfirmedSignatureInfo | null = null;
      const maxPages = 1; // Reduced to 1 to minimize API calls and prevent 429 errors
      let pageCount = 0;
      
      while (pageCount < maxPages) {
        try {
          const signatures = await withRateLimit(() => 
            connection.getSignaturesForAddress(publicKey, {
              limit: 50, // Reduced to 50 to minimize API calls
              before: before,
            })
          );

          if (!signatures || signatures.length === 0) {
            break; // No more signatures
          }

          // The last signature in the array is the oldest in this batch
          const lastInBatch = signatures[signatures.length - 1];
          if (lastInBatch && lastInBatch.blockTime) {
            oldestSignature = lastInBatch;
          }

          // If we got fewer than the limit, we've reached the end
          if (signatures.length < 50) {
            break;
          }

          // Continue paginating backwards
          before = signatures[signatures.length - 1].signature;
          pageCount++;
        } catch (rpcErr: any) {
          // Check for 429 rate limit errors - stop immediately to prevent more errors
          const errorMsg = rpcErr?.message || String(rpcErr);
          if (errorMsg.includes("429") || errorMsg.includes("rate limit") || errorMsg.includes("Too Many Requests")) {
            console.debug("Rate limit detected in getCreationTimeFromRPC, stopping to prevent more 429 errors");
            break; // Stop pagination to avoid more rate limit errors
          }
          throw rpcErr; // Re-throw other errors
        }
      }

      if (!oldestSignature || !oldestSignature.blockTime) {
        return null;
      }

      // blockTime is in seconds, convert to milliseconds
      const timestamp = oldestSignature.blockTime * 1000;
      return timestamp;
    } catch (err: any) {
      // Check for 429 errors and log them (but don't retry)
      const errorMsg = err?.message || String(err);
      if (errorMsg.includes("429") || errorMsg.includes("rate limit") || errorMsg.includes("Too Many Requests")) {
        console.debug("429 rate limit error in getCreationTimeFromRPC, skipping timestamp extraction");
      }
      // Silently fail - will use fallback timestamp
      return null;
    }
  };


  // Helper function to extract blockchain creation time from asset
  // For compressed NFTs, try multiple methods in order of reliability
  const extractBlockchainCreationTime = async (asset: any, umi: any, endpoint: string): Promise<number | null> => {
    try {
      // Method 1: Try to get block time from slot if available (most reliable for compressed NFTs)
      // This is the most accurate method for cNFTs since the slot is when the NFT was minted
      const compression = asset.compression;
      if (compression) {
        const slot = compression.slot || asset.slot;
        if (slot && umi) {
          try {
            // Try to get block time - this might fail for very old slots
            const blockTime = await withRateLimit(() => umi.rpc.getBlockTime(slot));
            if (blockTime !== null && blockTime !== undefined && blockTime > 0) {
              const timestamp = blockTime * 1000;
              // Validate timestamp is reasonable (not in the future, not too old)
              const now = Date.now();
              const minTimestamp = Date.now() - (365 * 24 * 60 * 60 * 1000 * 10); // 10 years ago max
              if (timestamp <= now && timestamp >= minTimestamp) {
                return timestamp;
              }
            }
          } catch (slotErr: any) {
            // Check for 429 rate limit errors - stop immediately
            const errorMsg = slotErr?.message || String(slotErr);
            if (errorMsg.includes("429") || errorMsg.includes("rate limit") || errorMsg.includes("Too Many Requests")) {
              console.debug("429 rate limit detected in getBlockTime, skipping to prevent more errors");
              return null; // Return early to prevent more API calls
            }
            // Slot lookup failed (might be too old or slot doesn't exist), continue to next method
            console.debug(`Slot lookup failed for asset ${asset.id?.slice(0, 8)}:`, slotErr.message);
          }
        }
      }
      
      // Method 2: Try to get timestamp from the asset's own address
      // For compressed NFTs, this gets the oldest transaction for this specific NFT
      // This is more accurate than tree timestamp since it's NFT-specific
      try {
        const assetTimestamp = await getCreationTimeFromRPC(asset.id, endpoint);
        if (assetTimestamp) {
          // Validate timestamp is reasonable
          const now = Date.now();
          const minTimestamp = Date.now() - (365 * 24 * 60 * 60 * 1000 * 10); // 10 years ago max
          if (assetTimestamp <= now && assetTimestamp >= minTimestamp) {
            return assetTimestamp;
          }
        }
      } catch (assetErr: any) {
        // Asset lookup failed, continue to fallback methods
        console.debug(`Asset signature lookup failed for ${asset.id?.slice(0, 8)}:`, assetErr.message);
      }
      
      // Method 3: For compressed NFTs, try getting timestamp from the merkle tree as last resort
      // Note: Tree timestamp might not be accurate for individual NFTs since tree is shared
      // This should only be used if other methods fail
      if (asset.compression?.tree) {
        try {
          const treeTimestamp = await getCreationTimeFromRPC(asset.compression.tree, endpoint);
          if (treeTimestamp) {
            // Validate timestamp is reasonable
            const now = Date.now();
            const minTimestamp = Date.now() - (365 * 24 * 60 * 60 * 1000 * 10); // 10 years ago max
            if (treeTimestamp <= now && treeTimestamp >= minTimestamp) {
              return treeTimestamp;
            }
          }
        } catch (treeErr: any) {
          // Tree lookup failed, continue to fallback methods
          console.debug(`Tree signature lookup failed:`, treeErr.message);
        }
      }
      
      // Method 4: Check for direct timestamp fields (unlikely for compressed NFTs)
      if (asset.created_at !== undefined) {
        if (typeof asset.created_at === 'number') {
          const timestamp = asset.created_at;
          const now = Date.now();
          const minTimestamp = Date.now() - (365 * 24 * 60 * 60 * 1000 * 10);
          if (timestamp <= now && timestamp >= minTimestamp) {
            return timestamp;
          }
        }
        if (typeof asset.created_at === 'string') {
          const parsed = Date.parse(asset.created_at);
          if (!isNaN(parsed)) {
            const now = Date.now();
            const minTimestamp = Date.now() - (365 * 24 * 60 * 60 * 1000 * 10);
            if (parsed <= now && parsed >= minTimestamp) {
              return parsed;
            }
          }
        }
      }
      
      if (asset.compression?.created_at !== undefined) {
        if (typeof asset.compression.created_at === 'number') {
          const timestamp = asset.compression.created_at;
          const now = Date.now();
          const minTimestamp = Date.now() - (365 * 24 * 60 * 60 * 1000 * 10);
          if (timestamp <= now && timestamp >= minTimestamp) {
            return timestamp;
          }
        }
        if (typeof asset.compression.created_at === 'string') {
          const parsed = Date.parse(asset.compression.created_at);
          if (!isNaN(parsed)) {
            const now = Date.now();
            const minTimestamp = Date.now() - (365 * 24 * 60 * 60 * 1000 * 10);
            if (parsed <= now && parsed >= minTimestamp) {
              return parsed;
            }
          }
        }
      }
      
      return null;
    } catch (err) {
      // Silently fail - will use fallback timestamp
      console.debug(`Error extracting blockchain creation time:`, err);
      return null;
    }
  };

  // Helper function to save creation timestamp for an asset
  // Updates timestamp if current one is invalid (0, future date, or missing)
  const saveAssetCreationTime = useCallback((assetId: string, timestamp: number) => {
    if (typeof window === "undefined") {
      return;
    }
    
    try {
      const saved = localStorage.getItem("nft-creation-times");
      const times = saved ? (JSON.parse(saved) as Record<string, number>) : {};
      const currentTimestamp = times[assetId];
      
      // Always update if:
      // 1. No timestamp exists yet
      // 2. Current timestamp is 0 (invalid placeholder)
      // 3. Current timestamp is in the future (clearly wrong - likely Date.now() from before fix)
      // 4. New timestamp is valid and different (allows fixing incorrect timestamps)
      //    We update if different to ensure accuracy, even for small differences
      const now = Date.now();
      const isCurrentInvalid = !currentTimestamp || 
                               currentTimestamp === 0 || 
                               currentTimestamp > now;
      // Update if invalid OR if new timestamp is different (to fix any incorrect cached timestamps)
      const shouldUpdate = isCurrentInvalid || (timestamp > 0 && timestamp !== currentTimestamp);
      
      if (shouldUpdate && timestamp > 0) {
        times[assetId] = timestamp;
        localStorage.setItem("nft-creation-times", JSON.stringify(times));
      }
    } catch (err) {
      // Silently fail
    }
  }, []);

  // Helper function to get creation timestamp for an asset
  // Returns null if no stored timestamp exists (don't create new ones with Date.now())
  const getAssetCreationTime = useCallback((assetId: string): number | null => {
    if (typeof window === "undefined") {
      return null; // Don't create timestamps on server
    }
    
    try {
      const saved = localStorage.getItem("nft-creation-times");
      if (saved) {
        const times = JSON.parse(saved) as Record<string, number>;
        if (times[assetId]) {
          return times[assetId];
        }
      }
    } catch (err) {
      console.error("Failed to load creation time from localStorage:", err);
    }
    
    // Don't create new timestamps - return null and let blockchain extraction handle it
    return null;
  }, []);

  // Save deleted asset IDs to localStorage whenever they change
  const saveDeletedIdsToStorage = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        const idsArray = Array.from(deletedAssetIdsRef.current);
        localStorage.setItem("deleted-nft-ids", JSON.stringify(idsArray));
      } catch (err) {
        // Silently fail
      }
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    
    // Early return if wallet is not ready - check all conditions
    if (!publicKey || !wallet?.adapter || !endpoint) {
      // Preserve manually added assets when wallet not connected (but filter deleted ones)
      const deletedIds = deletedAssetIdsRef.current;
      setAssets((prev) => prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id) && !deletedIds.has(a.id)));
      setLoading(false);
      setError(null);
      return;
    }

    // Capture publicKey value at the start to avoid stale closures
    const currentPublicKey = publicKey;
    if (!currentPublicKey) {
      // Preserve manually added assets (but filter deleted ones)
      const deletedIds = deletedAssetIdsRef.current;
      setAssets((prev) => prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id) && !deletedIds.has(a.id)));
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
        // Preserve manually added assets (but filter deleted ones)
        const deletedIds = deletedAssetIdsRef.current;
        setAssets((prev) => prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id) && !deletedIds.has(a.id)));
        setLoading(false);
        setError(null);
        return;
      }
      
      // Validate it looks like a valid Solana address (base58, ~44 chars)
      if (ownerAddress.length < 32 || ownerAddress.length > 44) {
        console.warn("Invalid address length:", ownerAddress.length);
        // Preserve manually added assets (but filter deleted ones)
        const deletedIds = deletedAssetIdsRef.current;
        setAssets((prev) => prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id) && !deletedIds.has(a.id)));
        setLoading(false);
        setError(null);
        return;
      }
    } catch (err) {
      console.error("Error converting publicKey to string:", err);
      // Preserve manually added assets (but filter deleted ones)
      const deletedIds = deletedAssetIdsRef.current;
      setAssets((prev) => prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id) && !deletedIds.has(a.id)));
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Double-check ownerAddress one more time before API call
      if (!ownerAddress || ownerAddress === "undefined" || ownerAddress.length === 0) {
        // Preserve manually added assets (but filter deleted ones)
        const deletedIds = deletedAssetIdsRef.current;
        setAssets((prev) => prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id) && !deletedIds.has(a.id)));
        setLoading(false);
        setError(null);
        return;
      }

      // Final validation - throw error before API call if invalid
      if (!ownerAddress || ownerAddress === "undefined" || typeof ownerAddress !== "string" || ownerAddress.length < 32) {
        setAssets([]);
        setLoading(false);
        setError(null);
        return;
      }
      
      const umi = umiWithCurrentWalletAdapter();
      
      // Fetch assets owned by the wallet - wrap in try-catch to handle API errors gracefully
      let response;
      try {
        // Validate ownerAddress is a valid string before making the API call
        if (!ownerAddress || typeof ownerAddress !== 'string' || ownerAddress.length < 32) {
          throw new Error(`Invalid ownerAddress: ${ownerAddress} (type: ${typeof ownerAddress})`);
        }
        
        // CRITICAL FIX: The DAS API expects 'owner' (not 'ownerAddress') as a PublicKey type
        // Convert the string to UMI PublicKey before passing
        const ownerPublicKey = umiPublicKey(ownerAddress);
        
        response = await withRateLimit(() => 
          umi.rpc.getAssetsByOwner({
            owner: ownerPublicKey, // Use 'owner' parameter name with PublicKey type!
            page: 1,
            limit: 100,
          })
        );
      } catch (apiError: any) {
        // Check for 403/authentication errors
        const apiErrorMsg = apiError?.message || String(apiError);
        const errorString = apiErrorMsg.toLowerCase();
        const fullError = JSON.stringify(apiError, Object.getOwnPropertyNames(apiError)).toLowerCase();
        
        // Check if it's a 403 error (in message or in the error object)
        if (errorString.includes("403") || errorString.includes("access forbidden") || errorString.includes("forbidden") || fullError.includes('"code":403')) {
          const errorMsg = "Helius DAS API access forbidden. Please check your NEXT_PUBLIC_HELIUS_RPC_URL environment variable and ensure DAS API is enabled.";
          setError(errorMsg);
          // Preserve manually added assets even on auth errors (but filter deleted ones)
          const deletedIds = deletedAssetIdsRef.current;
          setAssets((prev) => {
            const manualAssets = prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id) && !deletedIds.has(a.id));
            return manualAssets;
          });
          setLoading(false);
          return;
        }
        
        // Only treat as "empty wallet" if it's explicitly a "no assets" type error
        if (errorString.includes("no assets") && (errorString.includes("found") || errorString.includes("for owner"))) {
          // Preserve manually added assets even when API returns no assets (but filter deleted ones)
          const deletedIds = deletedAssetIdsRef.current;
          setAssets((prev) => {
            const manualAssets = prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id) && !deletedIds.has(a.id));
            return manualAssets;
          });
          setLoading(false);
          setError(null);
          return;
        }
        
        // For all other errors, don't clear manually added assets (but filter deleted ones)
        const deletedIds = deletedAssetIdsRef.current;
        setError(`API Error: ${apiErrorMsg}`);
        setAssets((prev) => {
          const manualAssets = prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id) && !deletedIds.has(a.id));
          return manualAssets;
        });
        setLoading(false);
        return;
      }
      
      // Check if response is valid (not null/undefined)
      if (!response) {
        const deletedIds = deletedAssetIdsRef.current;
        setAssets((prev) => {
          const manualAssets = prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id) && !deletedIds.has(a.id));
          return manualAssets;
        });
        setLoading(false);
        return;
      }

      // Filter for compressed NFTs (cNFTs) only
      const cnfts: CnftAsset[] = [];
      const metadataFetchPromises: Promise<void>[] = [];
      const timestampPromises: Array<{ assetId: string; promise: Promise<number> }> = [];
      
      // First pass: collect all assets and prepare metadata fetches
      for (const asset of response.items || []) {
        const isCompressed = asset.compression?.compressed === true;
        const assetOwner = asset.ownership?.owner;
        const hasOwner = !!assetOwner;
        const ownerMatches = assetOwner?.toLowerCase() === ownerAddress.toLowerCase();
        
        // Check if it's a compressed NFT AND owner matches
        if (isCompressed && hasOwner) {
          const metadata = asset.content?.metadata || {};
          const files = asset.content?.files || [];
          
          // Also check json_uri which might contain the metadata URI
          const jsonUri = asset.content?.json_uri as string | undefined;
          const metadataUri = metadata.uri as string | undefined || jsonUri;
          
          // Try to get image from multiple sources
          let imageUrl: string | undefined;
          
          // First, try files array
          if (files && files.length > 0) {
            imageUrl = (files[0]?.uri || files[0]?.cdn_uri) as string | undefined;
          }
          
          // Fallback to metadata.image if available
          if (!imageUrl && metadata.image) {
            imageUrl = metadata.image as string;
          }
          
          // Use stored timestamp immediately, or 0 as fallback (will sort to end until real timestamp is fetched)
          // Timestamps will be updated in background without blocking
          const storedTimestamp = getAssetCreationTime(asset.id);
          // Don't use Date.now() - that gives wrong dates! Use 0 so they sort to end until real timestamp is fetched
          const createdAt = storedTimestamp ?? 0;
          
          const assetData: CnftAsset = {
            id: asset.id,
            name: metadata.name || "Unnamed cNFT",
            symbol: metadata.symbol,
            uri: metadataUri,
            image: imageUrl,
            owner: asset.ownership.owner,
            createdAt,
          };
          
          // Store index for updating after fetch
          const assetIndex = cnfts.length;
          cnfts.push(assetData);
          
          // If we need to fetch metadata, add to promises (non-blocking)
          // Skip placeholder/invalid URLs to avoid CORS errors
          if (!imageUrl && metadataUri) {
            // Validate URL - skip placeholder URLs like example.com
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

            if (isValidUrl(metadataUri)) {
              const fetchPromise = (async () => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
                
                try {
                  const metadataResponse = await fetch(metadataUri, {
                    mode: 'cors',
                    signal: controller.signal,
                  });
                  clearTimeout(timeoutId);
                  
                  if (metadataResponse.ok) {
                    const metadataJson = await metadataResponse.json();
                    const fetchedImageUrl = metadataJson.image || metadataJson.image_url || metadataJson.imageUrl;
                    if (fetchedImageUrl && cnfts[assetIndex]) {
                      cnfts[assetIndex].image = fetchedImageUrl;
                      // Update state to trigger re-render with new image
                      setAssets((prev) => {
                        const updated = prev.map(a => 
                          a.id === assetData.id ? { ...a, image: fetchedImageUrl } : a
                        );
                        return updated;
                      });
                    }
                  }
                } catch (err: any) {
                  clearTimeout(timeoutId);
                  // Silently fail - skip CORS, network, and abort errors
                  if (err?.name === 'AbortError' || err?.name === 'TypeError' || err?.message?.includes('CORS')) {
                    return; // Expected errors, don't log
                  }
                }
              })();
              metadataFetchPromises.push(fetchPromise);
            }
          }
          
          // Only extract timestamp if we don't have a valid cached one to avoid rate limiting
          // Skip timestamp extraction if we already have a valid timestamp (not 0, not in future)
          const now = Date.now();
          const hasValidCachedTimestamp = storedTimestamp && storedTimestamp > 0 && storedTimestamp <= now;
          
          if (!hasValidCachedTimestamp) {
            // Create timestamp extraction promise (non-blocking, will update in background)
            // Add delay based on index to throttle API calls and prevent 429 errors
            const delay = timestampPromises.length * 1000; // Increased to 1000ms (1 second) delay between each extraction
            const timestampPromise = new Promise<number>((resolve) => {
              setTimeout(async () => {
                try {
                  const blockchainCreatedAt = await extractBlockchainCreationTime(asset, umi, endpoint);
                  if (blockchainCreatedAt) {
                    // Save the timestamp (will update if current one is invalid or significantly different)
                    saveAssetCreationTime(asset.id, blockchainCreatedAt);
                    // Update state with correct timestamp
                    setAssets((prev) => {
                      const updated = prev.map(a => 
                        a.id === asset.id ? { ...a, createdAt: blockchainCreatedAt } : a
                      );
                      // Re-sort by creation time
                      return updated.sort((a, b) => {
                        const timeA = a.createdAt || 0;
                        const timeB = b.createdAt || 0;
                        return timeB - timeA;
                      });
                    });
                    resolve(blockchainCreatedAt);
                  } else {
                    resolve(storedTimestamp || 0);
                  }
                } catch (err) {
                  // On error, keep existing timestamp or 0
                  resolve(storedTimestamp || 0);
                }
              }, delay);
            });
            
            timestampPromises.push({ assetId: asset.id, promise: timestampPromise });
          }
        }
      }
      
      // Show NFTs immediately without waiting for metadata/timestamps
      let finalCnfts = cnfts;
      
      // Start metadata fetches in background (don't wait)
      if (metadataFetchPromises.length > 0) {
        Promise.allSettled(metadataFetchPromises).catch(() => {
          // Silently handle errors
        });
      }
      
      // Start timestamp extractions in background (don't wait)
      if (timestampPromises.length > 0) {
        Promise.allSettled(timestampPromises.map(({ promise }) => promise)).catch(() => {
          // Silently handle errors
        });
      }

      // Merge manually added assets with API results
      // Use ref to access current manual asset IDs synchronously
      const currentManualIds = manuallyAddedAssetIdsRef.current;
      
      setAssets((prevAssets) => {
        const currentDeletedIds = deletedAssetIdsRef.current;
        
        // CRITICAL: Always get manually added assets from the ref first (source of truth)
        // This ensures we have the latest data even if state hasn't updated yet
        const allManualAssetsFromRef: CnftAsset[] = [];
        currentManualIds.forEach(assetId => {
          // Skip if deleted
          if (currentDeletedIds.has(assetId)) {
            return;
          }
          
          const storedAsset = manuallyAddedAssetsRef.current.get(assetId);
          if (storedAsset) {
            // Ensure creation timestamp is set
            if (!storedAsset.createdAt) {
              storedAsset.createdAt = getAssetCreationTime(assetId) ?? undefined;
            }
            allManualAssetsFromRef.push(storedAsset);
          } else {
            // If not in ref but in prevAssets, use that (fallback)
            const fromState = prevAssets.find(a => a.id === assetId);
            if (fromState) {
              // Ensure creation timestamp is set
              if (!fromState.createdAt) {
                fromState.createdAt = getAssetCreationTime(assetId) ?? undefined;
              }
              // Store it in ref for next time
              manuallyAddedAssetsRef.current.set(assetId, fromState);
              allManualAssetsFromRef.push(fromState);
            }
          }
        });
        
        // Use assets from ref as the source of truth for manually added assets
        const allManualAssets = allManualAssetsFromRef;
        
        // Combine manual assets with API results (avoid duplicates)
        const mergedBeforeFilter = [...finalCnfts, ...allManualAssets.filter(a => !finalCnfts.some(apiAsset => apiAsset.id === a.id))];
        
        // IMPORTANT: Filter out deleted assets, BUT preserve manually added ones that were re-added
        const merged = mergedBeforeFilter.filter(a => {
          const isDeleted = currentDeletedIds.has(a.id);
          const isManuallyAdded = currentManualIds.has(a.id);
          
          // If it's manually added, it should NOT be filtered out (user explicitly added it)
          if (isManuallyAdded && isDeleted) {
            // Defensive: remove from deleted list if it's manually added
            deletedAssetIdsRef.current.delete(a.id);
            const newDeletedSet = new Set(deletedAssetIdsRef.current);
            setDeletedAssetIds(newDeletedSet);
            saveDeletedIdsToStorage();
            return true; // Include it
          }
          
          // Otherwise, filter out deleted assets
          return !isDeleted;
        });
        
        // Sort by creation time (newest first) - assets without createdAt will be sorted last
        const sorted = merged.sort((a, b) => {
          const timeA = a.createdAt || 0;
          const timeB = b.createdAt || 0;
          return timeB - timeA; // Descending order (newest first)
        });
        
        return sorted;
      });
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
        // Preserve manually added assets even when there's an error (but filter deleted ones)
        const deletedIds = deletedAssetIdsRef.current;
        setAssets((prev) => {
          const manualAssets = prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id) && !deletedIds.has(a.id));
          return manualAssets;
        });
        setError(null); // Clear error for expected empty state
      } else {
        // Preserve manually added assets even on unexpected errors (but filter deleted ones)
        const deletedIds = deletedAssetIdsRef.current;
        setAssets((prev) => {
          const manualAssets = prev.filter(a => manuallyAddedAssetIdsRef.current.has(a.id) && !deletedIds.has(a.id));
          return manualAssets;
        });
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [publicKey, wallet, endpoint, saveDeletedIdsToStorage, getAssetCreationTime]);

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
            fetchAssets();
          }
        } catch (err) {
          // Silently fail - wallet not ready
        }
      }
    }, 500); // Wait 500ms for wallet to be fully ready
    
    return () => clearTimeout(timer);
  }, [publicKey?.toBase58(), wallet, endpoint, fetchAssets]); // Use toBase58() in deps to avoid infinite loops

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
      const umi = umiWithCurrentWalletAdapter();

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

        assetData = await withRateLimit(() => umi.rpc.getAsset(umiPublicKey(trimmedAssetId)));
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
      
      // First, try files array
      if (files && files.length > 0) {
        imageUrl = (files[0]?.uri || files[0]?.cdn_uri) as string | undefined;
      }
      
      // If no image from files, try to fetch from metadata URI
      if (!imageUrl && metadata.uri) {
        try {
          const metadataResponse = await fetch(metadata.uri as string);
          if (metadataResponse.ok) {
            const metadataJson = await metadataResponse.json();
            imageUrl = metadataJson.image || metadataJson.image_url || metadataJson.imageUrl;
          }
        } catch (err) {
          console.warn(`Failed to fetch metadata from ${metadata.uri}:`, err);
        }
      }
      
      // Fallback to metadata.image if available
      if (!imageUrl && metadata.image) {
        imageUrl = metadata.image as string;
      }
      
      // Get or create creation timestamp for manually added asset
      // Try to extract blockchain timestamp first, fallback to Date.now() only for manual adds
      let createdAt = getAssetCreationTime(assetData.id);
      if (!createdAt) {
        // For manually added assets, try to get blockchain timestamp immediately
        try {
          const blockchainTimestamp = await extractBlockchainCreationTime(assetData, umi, endpoint);
          if (blockchainTimestamp) {
            createdAt = blockchainTimestamp;
            saveAssetCreationTime(assetData.id, blockchainTimestamp);
          } else {
            // Only use Date.now() for manually added assets if we can't get blockchain timestamp
            createdAt = Date.now();
          }
        } catch (err) {
          // If extraction fails, use Date.now() for manually added assets
          createdAt = Date.now();
        }
      }
      const createdAtDate = new Date(createdAt);
      
      const newAsset: CnftAsset = {
        id: assetData.id,
        name: metadata.name || assetData.id.slice(0, 8) || "Unnamed cNFT",
        symbol: metadata.symbol,
        uri: metadata.uri as string | undefined,
        image: imageUrl,
        owner: assetOwner || walletAddress || "",
        createdAt,
      };
      
      // Debug output for manually added asset
      console.log(`🕐 Manually Added NFT Creation Time - ${newAsset.name} (${newAsset.id.slice(0, 8)}...):`, {
        timestamp: createdAt,
        date: createdAtDate.toISOString(),
        readable: createdAtDate.toLocaleString(),
        timeAgo: getTimeAgo(createdAt)
      });

      console.log("📦 Prepared asset to add:", {
        id: newAsset.id,
        name: newAsset.name,
        hasImage: !!newAsset.image,
        owner: newAsset.owner?.slice(0, 8) + "..."
      });

      // CRITICAL: ALWAYS remove from deleted list FIRST when user manually adds it back
      // This ensures it won't be filtered out by fetchAssets or any other operation
      const wasDeleted = deletedAssetIdsRef.current.has(newAsset.id);
      console.log(`🔍 Checking if asset ${newAsset.id.slice(0, 16)}... was deleted:`, wasDeleted);
      
      if (wasDeleted) {
        deletedAssetIdsRef.current.delete(newAsset.id);
        const newDeletedSet = new Set(deletedAssetIdsRef.current);
        setDeletedAssetIds(newDeletedSet);
        saveDeletedIdsToStorage();
        console.log(`✅ Removed ${newAsset.id.slice(0, 16)}... from deleted list - allowing re-addition`);
        console.log(`✅ Deleted list now contains ${deletedAssetIdsRef.current.size} items`);
        console.log(`✅ Verification: Asset still in deleted list? ${deletedAssetIdsRef.current.has(newAsset.id)}`);
      }

      // Mark as manually added BEFORE updating state to ensure it's tracked
      manuallyAddedAssetIdsRef.current.add(newAsset.id);
      // Store the full asset data so we can restore it during refetch
      manuallyAddedAssetsRef.current.set(newAsset.id, newAsset);
      const newManualSet = new Set(manuallyAddedAssetIdsRef.current);
      setManuallyAddedAssetIds(newManualSet);
      console.log("📌 Marked asset as manually added BEFORE state update. Total manual assets:", manuallyAddedAssetIdsRef.current.size);
      console.log("📌 Stored full asset data for manual asset:", newAsset.id.slice(0, 16) + "...");
      console.log("📌 Manual asset IDs ref:", Array.from(manuallyAddedAssetIdsRef.current));
      
      // Use functional update to ensure we get the latest state
      // IMPORTANT: This update happens AFTER we've already removed from deleted list
      setAssets((prev) => {
        // First, filter out any assets that are currently in the deleted list (shouldn't include newAsset now)
        const currentDeletedIds = deletedAssetIdsRef.current;
        const prevFiltered = prev.filter(a => !currentDeletedIds.has(a.id));
        
        console.log("🔍 Current assets BEFORE add:", {
          prevCount: prev.length,
          prevIds: prev.map(a => a.id.slice(0, 16) + "..."),
          filteredCount: prevFiltered.length,
          filteredIds: prevFiltered.map(a => a.id.slice(0, 16) + "..."),
          manualAssetIds: Array.from(manuallyAddedAssetIdsRef.current),
          wasDeleted,
          newAssetId: newAsset.id.slice(0, 16) + "...",
          isNewAssetInDeletedList: currentDeletedIds.has(newAsset.id)
        });
        
        // Verify the new asset is NOT in the deleted list
        if (currentDeletedIds.has(newAsset.id)) {
          console.error(`❌ ERROR: New asset ${newAsset.id.slice(0, 16)}... is still in deleted list! This should not happen.`);
          // Force remove it again
          console.log("🔧 Force removing from deleted list...");
          deletedAssetIdsRef.current.delete(newAsset.id);
          const forceDeletedSet = new Set(deletedAssetIdsRef.current);
          setDeletedAssetIds(forceDeletedSet);
          saveDeletedIdsToStorage();
        }
        
        // Check if asset already exists in the filtered state
        const existingIndex = prevFiltered.findIndex(a => a.id === newAsset.id);
        let updated: CnftAsset[];
        
        if (existingIndex !== -1) {
          // If it exists, replace it with fresh data
          console.log(`✅ Asset exists, replacing with fresh data: ${newAsset.id.slice(0, 16)}...`);
          updated = [...prevFiltered];
          updated[existingIndex] = newAsset; // Replace with fresh data
          console.log("✅ Replaced existing asset:", {
            count: updated.length,
            ids: updated.map(a => a.id.slice(0, 16) + "...")
          });
        } else {
          // Asset doesn't exist yet, add it
          console.log("✅ Adding new asset to gallery! New count will be:", prevFiltered.length + 1);
          updated = [...prevFiltered, newAsset];
          console.log("✅ Updated assets array AFTER add:", {
            count: updated.length,
            ids: updated.map(a => a.id.slice(0, 16) + "..."),
            names: updated.map(a => a.name),
            manualAssetIds: Array.from(manuallyAddedAssetIdsRef.current),
            newAssetId: newAsset.id.slice(0, 16) + "...",
            newAssetName: newAsset.name
          });
        }
        
        // Sort by creation time (newest first)
        const sorted = updated.sort((a, b) => {
          const timeA = a.createdAt || 0;
          const timeB = b.createdAt || 0;
          return timeB - timeA; // Descending order (newest first)
        });
        
        // Debug output: Show sorted order after manual add
        console.log("\n📊 === NFT GALLERY AFTER MANUAL ADD (Newest First) ===");
        sorted.forEach((asset, index) => {
          const createdAt = asset.createdAt || 0;
          const date = new Date(createdAt);
          console.log(`  [${index + 1}] ${asset.name} (${asset.id.slice(0, 8)}...)`);
          console.log(`      Created: ${date.toLocaleString()} (${getTimeAgo(createdAt)})`);
          console.log(`      Timestamp: ${createdAt}`);
        });
        console.log("📊 === END SORTED ORDER ===\n");
        
        // Final verification: ensure newAsset is in the result
        const containsNewAsset = sorted.some(a => a.id === newAsset.id);
        console.log(`✅ Final verification - newAsset is in result: ${containsNewAsset}`);
        
        return sorted;
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
  }, [wallet, endpoint, publicKey, saveDeletedIdsToStorage, getAssetCreationTime]);

  // Function to manually remove an asset from the gallery
  const removeAsset = useCallback((assetId: string) => {
    // Add to deleted set to prevent it from reappearing after refresh
    deletedAssetIdsRef.current.add(assetId);
    const newDeletedSet = new Set(deletedAssetIdsRef.current);
    setDeletedAssetIds(newDeletedSet);
    
    // Save to localStorage
    saveDeletedIdsToStorage();
    
    setAssets((prev) => {
      const updated = prev.filter(a => a.id !== assetId);
      console.log(`Removed asset ${assetId.slice(0, 16)}... from gallery. Remaining: ${updated.length}`);
      console.log(`Asset ${assetId.slice(0, 16)}... marked as deleted and will not reappear after refresh`);
      
      // Also remove from manually added assets if it was manually added
      if (manuallyAddedAssetIdsRef.current.has(assetId)) {
        manuallyAddedAssetIdsRef.current.delete(assetId);
        manuallyAddedAssetsRef.current.delete(assetId); // Also remove from stored data
        const newManualSet = new Set(manuallyAddedAssetIdsRef.current);
        setManuallyAddedAssetIds(newManualSet);
        console.log(`Removed ${assetId.slice(0, 16)}... from manually added assets and stored data`);
      }
      
      return updated;
    });
  }, [saveDeletedIdsToStorage]);

  // Function to force recalculate all timestamps (useful for fixing incorrect cached timestamps)
  const recalculateAllTimestamps = useCallback(async () => {
    if (!publicKey || !wallet?.adapter || !endpoint) {
      return;
    }

    try {
      const umi = umiWithCurrentWalletAdapter();
      const ownerPublicKey = umiPublicKey(publicKey.toBase58());
      
      // Re-fetch assets to get full asset data with compression info
      const response = await umi.rpc.getAssetsByOwner({
        owner: ownerPublicKey,
        page: 1,
        limit: 100,
      });

      if (!response || !response.items) {
        return;
      }

      // Recalculate timestamps for all compressed NFTs
      const timestampPromises = response.items
        .filter(asset => asset.compression?.compressed === true)
        .map(async (asset) => {
          try {
            const blockchainTimestamp = await extractBlockchainCreationTime(asset, umi, endpoint);
            
            if (blockchainTimestamp) {
              saveAssetCreationTime(asset.id, blockchainTimestamp);
              return { assetId: asset.id, timestamp: blockchainTimestamp };
            }
          } catch (err) {
            // Silently fail for individual assets
          }
          return null;
        });

      const results = await Promise.allSettled(timestampPromises);
      
      // Update assets with new timestamps
      setAssets((prev) => {
        const updated = prev.map((asset) => {
          const result = results.find((r) => 
            r.status === 'fulfilled' && 
            r.value && 
            r.value.assetId === asset.id
          );
          
          if (result && result.status === 'fulfilled' && result.value) {
            return { ...asset, createdAt: result.value.timestamp };
          }
          return asset;
        });
        
        // Re-sort by creation time
        return updated.sort((a, b) => {
          const timeA = a.createdAt || 0;
          const timeB = b.createdAt || 0;
          return timeB - timeA;
        });
      });
    } catch (err) {
      console.error("Error recalculating timestamps:", err);
    }
  }, [publicKey, wallet, endpoint, saveAssetCreationTime]);

  return { assets, loading, error, refetch: fetchAssets, addAssetById, removeAsset, recalculateAllTimestamps };
}

