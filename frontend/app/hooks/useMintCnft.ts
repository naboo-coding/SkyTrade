'use client';

import { useState } from 'react';
import { Keypair, PublicKey } from '@solana/web3.js';
import { Wallet } from '@coral-xyz/anchor';
import { createUmiInstance } from '../lib/utils/umi';
import { WalletContextState } from '@solana/wallet-adapter-react';
import axios from 'axios';
import FormData from 'form-data';

const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT || '';

async function uploadImageToPinata(imageFile: File): Promise<string> {
  const url = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
  const data = new FormData();
  data.append('file', imageFile);

  const response = await axios.post(url, data, {
    headers: {
      ...data.getHeaders(),
      'Authorization': `Bearer ${PINATA_JWT}`
    }
  });

  const ipfsHash = response.data.IpfsHash;
  return `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
}

async function uploadMetadataToPinata(name: string, symbol: string, imageUrl: string): Promise<string> {
  const url = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

  const metadata = {
    name: name,
    symbol: symbol,
    description: 'Daft Punk cNFT for fractionalization',
    image: imageUrl
  };

  const response = await axios.post(url, metadata, {
    headers: {
      'Authorization': `Bearer ${PINATA_JWT}`,
      'Content-Type': 'application/json'
    }
  });

  const ipfsHash = response.data.IpfsHash;
  return `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
}

export function useMintCnft(wallet: WalletContextState | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);

  const mintCnft = async () => {
    if (!wallet || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    setError(null);

    try {
      const umi = createUmiInstance(wallet);
      
      // Import Metaplex functions
      const { createTree, mintToCollectionV1, findLeafAssetIdPda, TokenStandard } = await import('@metaplex-foundation/mpl-bubblegum');
      const { createNft } = await import('@metaplex-foundation/mpl-token-metadata');
      const { generateSigner, percentAmount } = await import('@metaplex-foundation/umi');

      // 1. Create collection (using helper.ts approach)
      const collectionMint = generateSigner(umi);
      await createNft(umi, {
        mint: collectionMint,
        name: 'My Collection V1',
        symbol: 'COL_V1',
        uri: 'https://example.com/collection.json',
        isCollection: true,
        sellerFeeBasisPoints: percentAmount(5.5)
      }).sendAndConfirm(umi);

      console.log('Collection created:', collectionMint.publicKey);

      // 2. Create merkle tree
      const merkleTree = generateSigner(umi);
      await createTree(umi, {
        merkleTree,
        maxDepth: 14,
        maxBufferSize: 64,
        canopyDepth: 8,
      }).sendAndConfirm(umi, { confirm: { commitment: 'finalized' } });

      console.log('Merkle tree created:', merkleTree.publicKey);

      // 3. Upload image and metadata (using helper.ts approach)
      // Using a publicly accessible Daft Punk image
      // In production, you could upload your own image file
      const imageUrl = 'https://assets.website-files.com/6159e9b3cd81b453c1e86e9c/63e6f8a43083f48e3f8e0b95_daft-punk-helmet.jpg';
      const metadataUrl = await uploadMetadataToPinata(
        'Daft-Punk cNFT',
        'DP',
        imageUrl
      );

      // 4. Mint cNFT
      await mintToCollectionV1(umi, {
        leafOwner: umi.payer.publicKey,
        merkleTree: merkleTree.publicKey,
        collectionMint: collectionMint.publicKey,
        metadata: {
          name: 'Daft Punk cNFT',
          symbol: 'DP',
          uri: metadataUrl,
          sellerFeeBasisPoints: 500,
          creators: [
            {
              address: umi.payer.publicKey,
              verified: true,
              share: 100
            }
          ],
          collection: {
            key: collectionMint.publicKey,
            verified: false
          },
          tokenStandard: TokenStandard.NonFungible
        }
      }).sendAndConfirm(umi, { confirm: { commitment: 'finalized' } });

      // 5. Get asset ID
      const [assetIdPda] = findLeafAssetIdPda(umi, { 
        merkleTree: merkleTree.publicKey, 
        leafIndex: 0 
      });

      setAssetId(assetIdPda.toString());
      return assetIdPda.toString();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to mint cNFT';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return { mintCnft, loading, error, assetId };
}

