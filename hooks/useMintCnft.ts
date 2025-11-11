"use client";

import { useState, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import umiWithCurrentWalletAdapter from "@/lib/umi/umiWithCurrentWalletAdapter";
import { createTree, mintToCollectionV1, findLeafAssetIdPda, TokenStandard } from "@metaplex-foundation/mpl-bubblegum";
import { createNft } from "@metaplex-foundation/mpl-token-metadata";
import { generateSigner, publicKey, percentAmount, TransactionBuilder } from "@metaplex-foundation/umi";
import { useNetwork } from "@/contexts/NetworkContext";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { parseUserFriendlyError } from "@/utils/errorParser";
import useUmiStore from "@/store/useUmiStore";

interface MintCnftParams {
  imageFile?: File;
  imageUrl?: string;
  name?: string;
  symbol?: string;
}

export function useMintCnft() {
  const { publicKey, wallet, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { endpoint, network } = useNetwork();
  const { updateRpcUrl } = useUmiStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);

  const uploadImageToPinata = useCallback(async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "image");

    try {
      const response = await fetch("/api/pinata/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = "Failed to upload image";
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (parseError) {
          // If response is not JSON, try to get text
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          } catch (textError) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.url;
    } catch (err) {
      // Handle network errors, CORS errors, etc.
      if (err instanceof TypeError && err.message.includes("fetch")) {
        throw new Error("Network error: Failed to connect to upload service. Please check your internet connection and try again.");
      }
      // Re-throw if it's already an Error with a message
      if (err instanceof Error) {
        throw err;
      }
      // Fallback for unknown errors
      throw new Error(`Failed to upload image: ${String(err)}`);
    }
  }, []);

  const uploadMetadataToPinata = useCallback(async (
    name: string,
    symbol: string,
    imageUrl?: string
  ): Promise<string> => {
    const metadata: {
      name: string;
      symbol: string;
      description: string;
      image?: string;
    } = {
      name,
      symbol,
      description: `${name} cNFT for fractionalization`,
    };
    
    if (imageUrl) {
      metadata.image = imageUrl;
    }

    const formData = new FormData();
    formData.append("type", "metadata");
    formData.append("metadata", JSON.stringify(metadata));

    try {
      console.log("📤 Uploading metadata to Pinata via API route...");
      const response = await fetch("/api/pinata/upload", {
        method: "POST",
        body: formData,
      });

      console.log("📥 Received response:", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        let errorMessage = "Failed to upload metadata";
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
          console.error("❌ API error response:", error);
        } catch (parseError) {
          // If response is not JSON, try to get text
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
            console.error("❌ API error text:", errorText);
          } catch (textError) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            console.error("❌ Could not parse error response:", textError);
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("✅ Metadata uploaded successfully:", data.url);
      return data.url;
    } catch (err) {
      console.error("❌ Upload metadata error:", err);
      
      // Handle network errors, CORS errors, etc.
      if (err instanceof TypeError) {
        if (err.message.includes("fetch") || err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
          throw new Error("Network error: Failed to connect to upload service. Please check your internet connection and ensure the API route is accessible.");
        }
      }
      
      // Handle DOMException (network errors)
      if (err instanceof DOMException || (err as any)?.name === "NetworkError") {
        throw new Error("Network error: Unable to reach the upload service. Please check your connection and try again.");
      }
      
      // Re-throw if it's already an Error with a message
      if (err instanceof Error) {
        throw err;
      }
      
      // Fallback for unknown errors
      throw new Error(`Failed to upload metadata: ${String(err)}`);
    }
  }, []);

  const mintCnft = useCallback(async (params: MintCnftParams) => {
    if (!publicKey || !wallet?.adapter) {
      throw new Error("Wallet not connected");
    }

    setLoading(true);
    setError(null);
    setAssetId(null);

    try {
      // Make sure we're using the right endpoint for devnet
      // WalletAdapterNetwork.Devnet is just the string "devnet"
      const isDevnet = network === WalletAdapterNetwork.Devnet;
      const correctEndpoint = isDevnet 
        ? (endpoint.includes("devnet") || endpoint.includes("dev") || endpoint.includes("api.devnet")
           ? endpoint 
           : "https://api.devnet.solana.com")
        : endpoint;
      
      // Update the UMI store with the correct endpoint before we use it
      // This makes sure UMI is using the right network
      // Check if we actually need to update (Zustand updates are synchronous)
      const currentRpcUrl = useUmiStore.getState().rpcUrl;
      if (currentRpcUrl !== correctEndpoint) {
        updateRpcUrl(correctEndpoint);
      }
      
      // Check if the wallet has enough SOL before we try anything
      // Minting needs a collection NFT and merkle tree, which require rent exemption
      // Costs about 0.3-0.4 SOL for tree creation (depth 14, canopy 8) + collection + fees
      const MIN_REQUIRED_SOL = 0.4; // Being conservative here
      const balance = await connection.getBalance(publicKey);
      const balanceSol = balance / 1e9;
      
      if (balanceSol < MIN_REQUIRED_SOL) {
        const shortfall = (MIN_REQUIRED_SOL - balanceSol).toFixed(4);
        throw new Error(`Insufficient SOL balance. You have ${balanceSol.toFixed(4)} SOL but need at least ${MIN_REQUIRED_SOL} SOL to mint a cNFT (for rent exemption when creating the merkle tree and collection). Please add at least ${shortfall} SOL to your wallet.`);
      }
      
      const umi = umiWithCurrentWalletAdapter();

      // Upload the image if one was provided
      let imageUrl = params.imageUrl;
      if (params.imageFile) {
        imageUrl = await uploadImageToPinata(params.imageFile);
      }

      // Upload metadata to Pinata (always use Pinata for proper storage)
      const name = params.name || "Daft-Punk cNFT";
      const symbol = params.symbol || "DP";
      
      // Check symbol length - Metaplex requires max 10 characters
      const MAX_SYMBOL_LENGTH = 10;
      if (symbol.length > MAX_SYMBOL_LENGTH) {
        throw new Error(`Symbol is too long. NFT symbols must be ${MAX_SYMBOL_LENGTH} characters or fewer. Your symbol "${symbol}" is ${symbol.length} characters. Please use a shorter symbol.`);
      }
      
      // Always upload metadata to Pinata to make sure it's structured correctly
      // Image is optional but we include it if we have one
      const metadataUrl = await uploadMetadataToPinata(name, symbol, imageUrl);
      
      // Make sure the Pinata URL isn't too long
      const MAX_URI_LENGTH = 200;
      if (metadataUrl.length > MAX_URI_LENGTH) {
        throw new Error(`Metadata URI is too long (${metadataUrl.length} characters). The maximum allowed length is ${MAX_URI_LENGTH} characters.`);
      }

      // Create the collection, merkle tree, and mint the cNFT all in one transaction
      const collectionMint = generateSigner(umi);
      const merkleTree = generateSigner(umi);
      
      // Build all three operations we need
      const collectionBuilder = createNft(umi, {
        mint: collectionMint,
        name: "My Collection V1",
        symbol: "COL_V1",
        uri: "https://example.com/collection.json",
        isCollection: true,
        sellerFeeBasisPoints: percentAmount(5.5),
      });

      const treeBuilder = await createTree(umi, {
        merkleTree,
        maxDepth: 14,
        maxBufferSize: 64,
        canopyDepth: 8,
      });

      // Make sure we use the connected wallet's public key as the owner
      const ownerPublicKey = umi.payer.publicKey;
      
      const mintBuilder = mintToCollectionV1(umi, {
        leafOwner: ownerPublicKey,
        merkleTree: merkleTree.publicKey,
        collectionMint: collectionMint.publicKey,
        metadata: {
          name,
          symbol,
          uri: metadataUrl,
          sellerFeeBasisPoints: 500,
          creators: [
            {
              address: umi.payer.publicKey,
              verified: true,
              share: 100,
            },
          ],
          collection: {
            key: collectionMint.publicKey,
            verified: false,
          },
          tokenStandard: TokenStandard.NonFungible,
        },
      });

      // Combine all three into one transaction
      const combinedBuilder = new TransactionBuilder()
        .add(collectionBuilder)
        .add(treeBuilder)
        .add(mintBuilder);

      // Send and confirm the transaction (only one wallet approval needed)
      await combinedBuilder.sendAndConfirm(umi, {
        confirm: {
          commitment: "finalized",
        },
      });

      // Wait a bit for the mint transaction to fully settle before computing the asset ID
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Note: leafIndex = 0 because we create a new tree each time (for testing)
      // In production you'd reuse trees and track the leaf index
      const leafIndex = 0;
      const [assetIdPda] = findLeafAssetIdPda(umi, {
        merkleTree: merkleTree.publicKey,
        leafIndex,
      });
      
      setAssetId(assetIdPda.toString());
      
      return assetIdPda.toString();
    } catch (err) {
      console.error("Error minting cNFT:", err);
      const errorMessage = parseUserFriendlyError(err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [publicKey, wallet, endpoint, network, updateRpcUrl, uploadImageToPinata, uploadMetadataToPinata]);

  return { mintCnft, loading, error, assetId };
}
