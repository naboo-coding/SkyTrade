import { create } from 'zustand';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { signerIdentity, createNoopSigner } from '@metaplex-foundation/umi';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { publicKey } from '@metaplex-foundation/umi';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { mplBubblegum } from '@metaplex-foundation/mpl-bubblegum';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import type { WalletAdapter } from '@solana/wallet-adapter-base';
import type { Umi } from '@metaplex-foundation/umi';

interface UmiState {
  umi: Umi;
  signer: WalletAdapter | null;
  rpcUrl: string;
  updateSigner: (signer: WalletAdapter | null) => void;
  updateRpcUrl: (url: string) => void;
}

// Default RPC URL - will be updated by NetworkContext
const defaultRpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';

const createUmiInstance = (rpcUrl: string, signer: WalletAdapter | null): Umi => {
  const umi = createUmi(rpcUrl)
    .use(mplTokenMetadata())
    .use(mplBubblegum())
    .use(dasApi());
  
  // Use walletAdapterIdentity for wallet adapters, signerIdentity for other signers
  if (signer) {
    return umi.use(walletAdapterIdentity(signer as any));
  } else {
    return umi.use(
      signerIdentity(
        createNoopSigner(publicKey('11111111111111111111111111111111')) as any
      )
    );
  }
};

const useUmiStore = create<UmiState>()((set) => ({
  // Initialize Umi with a default noop signer
  umi: createUmiInstance(defaultRpcUrl, null),
  signer: null,
  rpcUrl: defaultRpcUrl,
  updateSigner: (signer: WalletAdapter | null) =>
    set((state) => ({
      signer,
      // Recreate Umi instance with current RPC URL and new signer
      umi: createUmiInstance(state.rpcUrl, signer),
    })),
  updateRpcUrl: (url: string) =>
    set((state) => ({
      rpcUrl: url,
      // Recreate Umi instance with new RPC URL and current signer
      umi: createUmiInstance(url, state.signer),
    })),
}));

export default useUmiStore;

