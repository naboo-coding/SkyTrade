"use client";

import { useState, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import umiWithCurrentWalletAdapter from "@/lib/umi/umiWithCurrentWalletAdapter";
import { createTree, mintToCollectionV1, findLeafAssetIdPda, TokenStandard } from "@metaplex-foundation/mpl-bubblegum";
import { createNft } from "@metaplex-foundation/mpl-token-metadata";
import { generateSigner, publicKey, percentAmount } from "@metaplex-foundation/umi";
import { useNetwork } from "@/contexts/NetworkContext";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { uploadImageToPinata as uploadImageUtil, uploadMetadataToPinata as uploadMetadataUtil } from "@/utils/uploadToPinata";

interface MintCnftParams {
  imageFile?: File;
  imageUrl?: string;
  name?: string;
  symbol?: string;
  pinataJwt?: string;
}

export function useMintCnft() {
  const { publicKey, wallet, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { endpoint, network } = useNetwork();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);

  const uploadImageToPinataHook = useCallback(async (file: File, pinataJwt: string): Promise<string> => {
    return uploadImageUtil(file, pinataJwt);
  }, []);

  const uploadMetadataToPinataHook = useCallback(async (
    name: string,
    symbol: string,
    imageUrl: string,
    pinataJwt: string
  ): Promise<string> => {
    return uploadMetadataUtil(name, symbol, imageUrl, pinataJwt);
  }, []);

  const mintCnft = useCallback(async (params: MintCnftParams) => {
    if (!publicKey || !wallet?.adapter) {
      throw new Error("Wallet not connected");
    }

    setLoading(true);
    setError(null);
    setAssetId(null);

    try {
      // Verify we're using the correct endpoint and network
      console.log("Minting cNFT on network:", network, "Endpoint:", endpoint);
      
      // Ensure endpoint is explicitly devnet if we're on devnet
      // WalletAdapterNetwork.Devnet is the constant value "devnet"
      const isDevnet = network === WalletAdapterNetwork.Devnet;
      const devnetEndpoint = isDevnet 
        ? (endpoint.includes("devnet") || endpoint.includes("dev") || endpoint.includes("api.devnet")
           ? endpoint 
           : "https://api.devnet.solana.com")
        : endpoint;
      
      const umi = umiWithCurrentWalletAdapter();

      // 1. Upload image if provided
      let imageUrl = params.imageUrl;
      if (params.imageFile && params.pinataJwt) {
        imageUrl = await uploadImageToPinataHook(params.imageFile, params.pinataJwt);
      }
      if (!imageUrl) {
        throw new Error("Image URL or file with Pinata JWT required");
      }

      // 2. Upload metadata
      const name = params.name || "Daft-Punk cNFT";
      const symbol = params.symbol || "DP";
      let metadataUrl: string;
      
      if (params.pinataJwt) {
        metadataUrl = await uploadMetadataToPinataHook(name, symbol, imageUrl, params.pinataJwt);
      } else {
        // Use a default metadata URL if Pinata is not available
        metadataUrl = `https://example.com/metadata.json?name=${encodeURIComponent(name)}&symbol=${encodeURIComponent(symbol)}&image=${encodeURIComponent(imageUrl)}`;
      }

      // 3. Create collection
      const collectionMint = generateSigner(umi);
      await createNft(umi, {
        mint: collectionMint,
        name: "My Collection V1",
        symbol: "COL_V1",
        uri: "https://example.com/collection.json",
        isCollection: true,
        sellerFeeBasisPoints: percentAmount(5.5),
      }).sendAndConfirm(umi);

      // 4. Create Merkle tree
      const merkleTree = generateSigner(umi);
      const builder = await createTree(umi, {
        merkleTree,
        maxDepth: 14,
        maxBufferSize: 64,
        canopyDepth: 8,
      });

      await builder.sendAndConfirm(umi, {
        confirm: {
          commitment: "finalized",
        },
      });

      // 5. Mint cNFT
      // Ensure we're using the connected wallet's public key as the owner
      const ownerPublicKey = umi.payer.publicKey;
      console.log("Minting cNFT to owner:", ownerPublicKey);
      console.log("Merkle Tree:", merkleTree.publicKey.toString());
      
      await mintToCollectionV1(umi, {
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
      }).sendAndConfirm(umi, {
        confirm: {
          commitment: "finalized",
        },
      });

      // 6. Compute Asset ID - wait a moment for the mint transaction to fully settle
      console.log("Waiting for transaction to finalize...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Note: leafIndex = 0 because we create a NEW tree each time (for testing)
      // In production, you'd reuse trees and track the leaf index
      const leafIndex = 0;
      const [assetIdPda] = findLeafAssetIdPda(umi, {
        merkleTree: merkleTree.publicKey,
        leafIndex,
      });

      console.log("✅ Mint transaction completed!");
      console.log("📦 Merkle Tree:", merkleTree.publicKey.toString());
      console.log("🆔 Computed Asset ID:", assetIdPda.toString());
      console.log("👤 Owner:", ownerPublicKey.toString());
      console.log("\n⚠️ IMPORTANT: Helius DAS API indexing takes 30-60 seconds.");
      console.log("   The asset exists on-chain but won't appear in API queries until indexed.");
      console.log("   View it on explorer:", `https://explorer.solana.com/address/${assetIdPda.toString()}?cluster=devnet`);
      console.log("");
      
      setAssetId(assetIdPda.toString());
      
      return assetIdPda.toString();
    } catch (err) {
      console.error("Error minting cNFT:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to mint cNFT";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [publicKey, wallet, endpoint, network, uploadImageToPinataHook, uploadMetadataToPinataHook]);

  return { mintCnft, loading, error, assetId };
}
