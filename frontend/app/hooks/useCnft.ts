'use client';

import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { mplBubblegum } from '@metaplex-foundation/mpl-bubblegum';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import type { CnftData } from '../types';

const HELIUS_RPC = process.env.NEXT_PUBLIC_RPC_URL || 'https://devnet.helius-rpc.com/?api-key=demo';

export function useCnfts(publicKey: PublicKey | null, wallet: any) {
  const [cnfts, setCnfts] = useState<CnftData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey || !wallet) {
      setCnfts([]);
      return;
    }

    async function fetchCnfts() {
      setLoading(true);
      setError(null);
      
      try {
        const umi = createUmi(HELIUS_RPC)
          .use(walletAdapterIdentity(wallet))
          .use(mplTokenMetadata())
          .use(mplBubblegum())
          .use(dasApi());

        // Fetch all assets owned by the user
        const response = await umi.rpc.getAssetsByOwner({
          ownerAddress: publicKey.toBase58(),
          page: 1,
          limit: 100,
        });

        // Filter for compressed NFTs only
        const compressedNfts = response.items
          .filter((asset: any) => asset.compression?.compressed)
          .map((asset: any) => {
            const data: CnftData = {
              id: asset.id,
              name: asset.content?.metadata?.name || asset.id.slice(0, 8),
              symbol: asset.content?.metadata?.symbol || '',
              uri: asset.content?.json_uri || '',
              image: asset.content?.files?.[0]?.uri || '',
              merkleTree: asset.compression?.tree || '',
              owner: asset.ownership?.owner || '',
              compression: {
                asset_hash: asset.compression?.asset_hash || '',
                data_hash: asset.compression?.data_hash || '',
                creator_hash: asset.compression?.creator_hash || '',
              },
              metadata: {
                name: asset.content?.metadata?.name,
                symbol: asset.content?.metadata?.symbol,
                uri: asset.content?.json_uri,
              },
            };
            return data;
          });

        setCnfts(compressedNfts);
      } catch (err) {
        console.error('Error fetching cNFTs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch cNFTs');
      } finally {
        setLoading(false);
      }
    }

    fetchCnfts();
  }, [publicKey, wallet]);

  return { cnfts, loading, error };
}

