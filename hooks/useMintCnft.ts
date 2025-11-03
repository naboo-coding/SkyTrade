"use client";

import { useState, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import umiWithCurrentWalletAdapter from "@/lib/umi/umiWithCurrentWalletAdapter";
import { createTree, mintToCollectionV1, findLeafAssetIdPda, TokenStandard } from "@metaplex-foundation/mpl-bubblegum";
import { createNft } from "@metaplex-foundation/mpl-token-metadata";
import { generateSigner, publicKey, percentAmount, TransactionBuilder } from "@metaplex-foundation/umi";
import { useNetwork } from "@/contexts/NetworkContext";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { uploadImageToPinata as uploadImageUtil, uploadMetadataToPinata as uploadMetadataUtil } from "@/utils/uploadToPinata";
import { parseUserFriendlyError } from "@/utils/errorParser";
import useUmiStore from "@/store/useUmiStore";

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
  const { updateRpcUrl } = useUmiStore();
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
      // Ensure endpoint is explicitly devnet if we're on devnet
      // WalletAdapterNetwork.Devnet is the constant value "devnet"
      const isDevnet = network === WalletAdapterNetwork.Devnet;
      const correctEndpoint = isDevnet 
        ? (endpoint.includes("devnet") || endpoint.includes("dev") || endpoint.includes("api.devnet")
           ? endpoint 
           : "https://api.devnet.solana.com")
        : endpoint;
      
      // Update UMI store with the correct endpoint before using it
      // This ensures the UMI instance uses the correct network
      // Check if we need to update (Zustand updates are synchronous)
      const currentRpcUrl = useUmiStore.getState().rpcUrl;
      if (currentRpcUrl !== correctEndpoint) {
        updateRpcUrl(correctEndpoint);
      }
      
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
      
      // Metaplex Bubblegum has a URI length limit of ~200 characters
      // Check if the image URL would create a URI that's too long
      const testMetadataUrl = `https://example.com/metadata.json?name=${encodeURIComponent(name)}&symbol=${encodeURIComponent(symbol)}&image=${encodeURIComponent(imageUrl)}`;
      const MAX_URI_LENGTH = 200;
      
      if (params.pinataJwt) {
        metadataUrl = await uploadMetadataToPinataHook(name, symbol, imageUrl, params.pinataJwt);
        
        // Validate the Pinata URL is also not too long
        if (metadataUrl.length > MAX_URI_LENGTH) {
          throw new Error(`Metadata URI is too long (${metadataUrl.length} characters). The maximum allowed length is ${MAX_URI_LENGTH} characters. Please use a shorter image URL or contact support.`);
        }
      } else {
        // Check if the constructed URL would exceed the limit
        if (testMetadataUrl.length > MAX_URI_LENGTH) {
          throw new Error(
            `Image URL is too long to create a valid metadata URI (would be ${testMetadataUrl.length} characters, max is ${MAX_URI_LENGTH}). ` +
            `Please provide a Pinata JWT to upload to IPFS, or use a shorter image URL (under ${Math.max(0, MAX_URI_LENGTH - 100)} characters).`
          );
        }
        // Use a default metadata URL if Pinata is not available and URL is short enough
        metadataUrl = testMetadataUrl;
      }

      // 3. Create collection and merkle tree in a single transaction to reduce wallet approvals
      const collectionMint = generateSigner(umi);
      const merkleTree = generateSigner(umi);
      
      // Build both transactions
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

      // Combine both builders into a single transaction
      const combinedBuilder = new TransactionBuilder()
        .add(collectionBuilder)
        .add(treeBuilder);

      // Send and confirm the combined transaction
      await combinedBuilder.sendAndConfirm(umi, {
        confirm: {
          commitment: "finalized",
        },
      });

      // 4. Mint cNFT (separate transaction as it depends on collection and tree)
      // Ensure we're using the connected wallet's public key as the owner
      const ownerPublicKey = umi.payer.publicKey;
      
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
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Note: leafIndex = 0 because we create a NEW tree each time (for testing)
      // In production, you'd reuse trees and track the leaf index
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
  }, [publicKey, wallet, endpoint, network, updateRpcUrl, uploadImageToPinataHook, uploadMetadataToPinataHook]);

  return { mintCnft, loading, error, assetId };
}
