import useUmiStore from '@/store/useUmiStore';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';

const umiWithCurrentWalletAdapter = () => {
  // We use Zustand to store the UMI instance, so we can access it from the store
  // This is the non-hook version - useful when you're not in a React component
  // You can use this in regular TypeScript files

  const umi = useUmiStore.getState().umi;
  const currentWallet = useUmiStore.getState().signer;
  if (!currentWallet) throw new Error('No wallet selected');
  // The UMI instance from the store already has the wallet adapter set up
  // We just need to make sure it's using the current wallet
  return umi.use(walletAdapterIdentity(currentWallet as any));
};

export default umiWithCurrentWalletAdapter;

