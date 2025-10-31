import useUmiStore from '@/store/useUmiStore';
import { setComputeUnitPrice } from '@metaplex-foundation/mpl-toolbox';
import { TransactionBuilder } from '@metaplex-foundation/umi';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { base58 } from '@metaplex-foundation/umi/serializers';

const sendAndConfirmWalletAdapter = async (
  tx: TransactionBuilder,
  settings?: {
    commitment?: 'processed' | 'confirmed' | 'finalized';
    skipPreflight?: boolean;
  }
) => {
  const umi = useUmiStore.getState().umi;
  const currentSigner = useUmiStore.getState().signer;
  
  if (!currentSigner) {
    throw new Error('No wallet connected');
  }
  
  console.log('currentSigner', currentSigner);
  // Use walletAdapterIdentity for proper wallet adapter integration
  umi.use(walletAdapterIdentity(currentSigner as any));

  const blockhash = await umi.rpc.getLatestBlockhash({
    commitment: settings?.commitment || 'confirmed',
  });

  const transactions = tx
    // Set the priority fee for your transaction. Can be removed if unneeded.
    .add(setComputeUnitPrice(umi, { microLamports: BigInt(100000) }))
    .setBlockhash(blockhash);

  const signedTx = await transactions.buildAndSign(umi);

  const signature = await umi.rpc
    .sendTransaction(signedTx, {
      preflightCommitment: settings?.commitment || 'confirmed',
      commitment: settings?.commitment || 'confirmed',
      skipPreflight: settings?.skipPreflight || false,
    })
    .catch((err) => {
      throw new Error(`Transaction failed: ${err}`);
    });

  const confirmation = await umi.rpc.confirmTransaction(signature, {
    strategy: { type: 'blockhash', ...blockhash },
    commitment: settings?.commitment || 'confirmed',
  });
  
  return {
    signature: base58.deserialize(signature),
    confirmation,
  };
};

export default sendAndConfirmWalletAdapter;

