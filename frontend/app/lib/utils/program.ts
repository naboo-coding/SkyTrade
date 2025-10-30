import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import { PublicKey, Connection, Keypair } from '@solana/web3.js';
import idl from '../../../fractionalization.json';
import { Fractionalization } from './program-types';

const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || 'DM26SsAwF5NSGVWSebfaUBkYAG3ioLkfFnqt1Vr7pq2P');

export function getProgram(connection: Connection, wallet: Wallet) {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });

  const program = new Program(idl as any, PROGRAM_ID, provider);
  
  return program;
}

export function getWalletFromKeypair(keypair: Keypair): Wallet {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async (tx) => {
      tx.sign(keypair);
      return tx;
    },
    signAllTransactions: async (txs) => {
      txs.forEach((tx) => tx.sign(keypair));
      return txs;
    },
  };
}

export { PROGRAM_ID };



