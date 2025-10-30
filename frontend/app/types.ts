export type CnftData = {
  id: string;
  name: string;
  symbol: string;
  uri: string;
  image?: string;
  merkleTree: string;
  owner: string;
  compression: {
    asset_hash: string;
    data_hash: string;
    creator_hash: string;
  };
  metadata?: {
    name?: string;
    symbol?: string;
    uri?: string;
  };
}

export interface FractionalizationParams {
  totalSupply: string;
  minLpAgeSeconds?: string;
  minReclaimPercent?: string;
  minLiquidityPercent?: string;
  minVolumePercent30d?: string;
}

export interface AssetWithProof {
  rpcAsset: any;
  merkleTree: string;
  root: Uint8Array;
  dataHash: Uint8Array;
  creatorHash: Uint8Array;
  nonce: number;
  index: number;
  proof: string[];
  metadata: {
    name: string;
    symbol: string;
    uri: string;
  };
  leafDelegate?: string | null;
}

