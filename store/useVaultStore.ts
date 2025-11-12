import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { PublicKey, Connection } from "@solana/web3.js";
import { Program, AnchorProvider, EventParser } from "@coral-xyz/anchor";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import type { WalletAdapter } from "@solana/wallet-adapter-base";
import FractionalizationIdl from "../fractionalization.json";
import type { Fractionalization } from "../fractionalization2";

// Types (shared with useVaults)
export type VaultStatus =
  | { active: {} }
  | { reclaimInitiated: {} }
  | { reclaimFinalized: {} }
  | { closed: {} };

export interface VaultData {
  publicKey: PublicKey;
  nftMint: PublicKey;
  nftAssetId: PublicKey;
  fractionMint: PublicKey;
  totalSupply: bigint;
  creator: PublicKey;
  creationTimestamp: bigint;
  status: VaultStatus;
  reclaimTimestamp: bigint;
  twapPriceAtReclaim: bigint;
  totalCompensation: bigint;
  remainingCompensation: bigint;
  bump: number;
  minLpAgeSeconds: bigint;
  minReclaimPercentage: number;
  minLiquidityPercent: number;
  minVolumePercent30d: number;
  reclaimInitiator: PublicKey;
  reclaimInitiationTimestamp: bigint;
  tokensInEscrow: bigint;
}

// Serialized version for persistence (PublicKey -> string, bigint -> string)
interface SerializedVaultData {
  publicKey: string;
  nftMint: string;
  nftAssetId: string;
  fractionMint: string;
  totalSupply: string;
  creator: string;
  creationTimestamp: string;
  status: VaultStatus;
  reclaimTimestamp: string;
  twapPriceAtReclaim: string;
  totalCompensation: string;
  remainingCompensation: string;
  bump: number;
  minLpAgeSeconds: string;
  minReclaimPercentage: number;
  minLiquidityPercent: number;
  minVolumePercent30d: number;
  reclaimInitiator: string;
  reclaimInitiationTimestamp: string;
  tokensInEscrow: string;
}

// Helper functions to serialize/deserialize vault data
function serializeVaultData(vault: VaultData): SerializedVaultData {
  return {
    publicKey: vault.publicKey.toBase58(),
    nftMint: vault.nftMint.toBase58(),
    nftAssetId: vault.nftAssetId.toBase58(),
    fractionMint: vault.fractionMint.toBase58(),
    totalSupply: vault.totalSupply.toString(),
    creator: vault.creator.toBase58(),
    creationTimestamp: vault.creationTimestamp.toString(),
    status: vault.status,
    reclaimTimestamp: vault.reclaimTimestamp.toString(),
    twapPriceAtReclaim: vault.twapPriceAtReclaim.toString(),
    totalCompensation: vault.totalCompensation.toString(),
    remainingCompensation: vault.remainingCompensation.toString(),
    bump: vault.bump,
    minLpAgeSeconds: vault.minLpAgeSeconds.toString(),
    minReclaimPercentage: vault.minReclaimPercentage,
    minLiquidityPercent: vault.minLiquidityPercent,
    minVolumePercent30d: vault.minVolumePercent30d,
    reclaimInitiator: vault.reclaimInitiator.toBase58(),
    reclaimInitiationTimestamp: vault.reclaimInitiationTimestamp.toString(),
    tokensInEscrow: vault.tokensInEscrow.toString(),
  };
}

function deserializeVaultData(serialized: SerializedVaultData): VaultData {
  return {
    publicKey: new PublicKey(serialized.publicKey),
    nftMint: new PublicKey(serialized.nftMint),
    nftAssetId: new PublicKey(serialized.nftAssetId),
    fractionMint: new PublicKey(serialized.fractionMint),
    totalSupply: BigInt(serialized.totalSupply),
    creator: new PublicKey(serialized.creator),
    creationTimestamp: BigInt(serialized.creationTimestamp),
    status: serialized.status,
    reclaimTimestamp: BigInt(serialized.reclaimTimestamp),
    twapPriceAtReclaim: BigInt(serialized.twapPriceAtReclaim),
    totalCompensation: BigInt(serialized.totalCompensation),
    remainingCompensation: BigInt(serialized.remainingCompensation),
    bump: serialized.bump,
    minLpAgeSeconds: BigInt(serialized.minLpAgeSeconds),
    minReclaimPercentage: serialized.minReclaimPercentage,
    minLiquidityPercent: serialized.minLiquidityPercent,
    minVolumePercent30d: serialized.minVolumePercent30d,
    reclaimInitiator: new PublicKey(serialized.reclaimInitiator),
    reclaimInitiationTimestamp: BigInt(serialized.reclaimInitiationTimestamp),
    tokensInEscrow: BigInt(serialized.tokensInEscrow),
  };
}

interface VaultStoreState {
  // All vaults stored in the store (fetched but not all exposed)
  allVaults: VaultData[];
  // Number of vaults currently loaded/exposed (for pagination)
  loadedCount: number;
  // Total number of vaults available (for knowing if there are more)
  totalCount: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  lastFetched: number | null;
  
  // Event listener subscription IDs and connection
  eventListenerId: number | null;
  connection: Connection | null;
  refetchTimeoutId: ReturnType<typeof setTimeout> | null;
  
  // Store connection/program for pagination
  currentEndpoint: string | null;
  currentNetwork: WalletAdapterNetwork | null;
  currentWallet: WalletAdapter | null;
  currentPublicKey: PublicKey | null;
  
  // Actions
  fetchInitialVaults: (endpoint: string, network: WalletAdapterNetwork, wallet: WalletAdapter | null, publicKey: PublicKey | null, limit?: number) => Promise<void>;
  loadMoreVaults: (limit?: number) => Promise<void>;
  setLoadingMore: (loading: boolean) => void;
  setVaults: (vaults: VaultData[]) => void;
  clearVaults: () => void;
  setupEventListeners: (endpoint: string, network: WalletAdapterNetwork, wallet: WalletAdapter | null) => Promise<void>;
  cleanupEventListeners: () => void;
  debouncedRefetch: (endpoint: string, network: WalletAdapterNetwork, wallet: WalletAdapter | null, publicKey: PublicKey | null) => void;
  fetchAndBringVaultToFront: (vaultPublicKey: PublicKey, endpoint: string, network: WalletAdapterNetwork, wallet: WalletAdapter | null) => Promise<void>;
  
  // Getters
  getActiveVaults: () => VaultData[];
  getLoadedActiveVaults: () => VaultData[];
  getVaultsByCreator: (creator: PublicKey) => VaultData[];
  getPaginatedVaults: (vaults: VaultData[], page: number, perPage: number) => VaultData[];
  hasMoreVaults: () => boolean;
}

// Persisted state interface (only serializable fields)
interface PersistedVaultStoreState {
  allVaults: SerializedVaultData[];
  loadedCount: number;
  totalCount: number;
  lastFetched: number | null;
}

const useVaultStore = create<VaultStoreState>()(
  persist(
    (set, get) => ({
      allVaults: [],
      loadedCount: 0,
      totalCount: 0,
      loading: false,
      loadingMore: false,
      error: null,
      lastFetched: null,
      eventListenerId: null,
      connection: null,
      refetchTimeoutId: null,
      currentEndpoint: null,
      currentNetwork: null,
      currentWallet: null,
      currentPublicKey: null,

  fetchInitialVaults: async (endpoint: string, network: WalletAdapterNetwork, wallet: WalletAdapter | null, publicKey: PublicKey | null, limit: number = 10) => {
    // Don't fetch if wallet is not connected
    if (!publicKey) {
      set({ allVaults: [], loadedCount: 0, totalCount: 0, loading: false, error: null });
      return;
    }

    set({ loading: true, error: null, loadedCount: 0 });

    try {
      const isDevnet = network === WalletAdapterNetwork.Devnet;
      const devnetEndpoint = isDevnet
        ? (endpoint.includes("devnet") || endpoint.includes("dev") || endpoint.includes("api.devnet")
           ? endpoint
           : "https://api.devnet.solana.com")
        : endpoint;

      const connection = new Connection(devnetEndpoint, "confirmed");
      const provider = new AnchorProvider(
        connection,
        wallet as any,
        { commitment: "confirmed" }
      );

      const program = new Program<Fractionalization>(
        FractionalizationIdl as any,
        provider
      );

      // Fetch all vault accounts (we need all to sort, but only expose first N)
      console.log("[VaultStore] Fetching vaults from RPC...");
      const allVaults = await program.account.vault.all();

      // Convert to VaultData format and sort
      const sortedVaults: VaultData[] = allVaults
        .map((vault) => {
          const account = vault.account;
          return {
            publicKey: vault.publicKey,
            nftMint: account.nftMint,
            nftAssetId: account.nftAssetId,
            fractionMint: account.fractionMint,
            totalSupply: BigInt(account.totalSupply.toString()),
            creator: account.creator,
            creationTimestamp: BigInt(account.creationTimestamp.toString()),
            status: account.status as VaultStatus,
            reclaimTimestamp: BigInt(account.reclaimTimestamp.toString()),
            twapPriceAtReclaim: BigInt(account.twapPriceAtReclaim.toString()),
            totalCompensation: BigInt(account.totalCompensation.toString()),
            remainingCompensation: BigInt(account.remainingCompensation.toString()),
            bump: account.bump,
            minLpAgeSeconds: BigInt(account.minLpAgeSeconds.toString()),
            minReclaimPercentage: account.minReclaimPercentage,
            minLiquidityPercent: account.minLiquidityPercent,
            minVolumePercent30d: account.minVolumePercent30d,
            reclaimInitiator: account.reclaimInitiator,
            reclaimInitiationTimestamp: BigInt(account.reclaimInitiationTimestamp.toString()),
            tokensInEscrow: BigInt(account.tokensInEscrow.toString()),
          };
        })
        .sort((a, b) => {
          const aTime = Number(a.creationTimestamp);
          const bTime = Number(b.creationTimestamp);
          return bTime - aTime; // Descending order (newest first)
        });

      // Filter for active vaults
      const activeVaults = sortedVaults.filter((vault) => "active" in vault.status);
      
      // Only expose the first 'limit' vaults initially
      const initialLoad = Math.min(limit, activeVaults.length);

      console.log(`[VaultStore] Fetched ${sortedVaults.length} total vaults, ${activeVaults.length} active, loading first ${initialLoad}`);
      
      set({ 
        allVaults: activeVaults, 
        loadedCount: initialLoad,
        totalCount: activeVaults.length,
        loading: false, 
        error: null,
        lastFetched: Date.now(),
        currentEndpoint: endpoint,
        currentNetwork: network,
        currentWallet: wallet,
        currentPublicKey: publicKey
      });
    } catch (err: any) {
      console.error("[VaultStore] Error fetching vaults:", err);
      const errorMessage = err?.message || "Failed to fetch vaults";
      set({ 
        error: errorMessage, 
        loading: false,
        allVaults: [],
        loadedCount: 0,
        totalCount: 0
      });
    }
  },

  loadMoreVaults: async (limit: number = 10) => {
    const state = get();
    
    if (state.loadingMore || state.loadedCount >= state.totalCount) {
      return;
    }

    set({ loadingMore: true });

    try {
      // Calculate how many more to load
      const remaining = state.totalCount - state.loadedCount;
      const toLoad = Math.min(limit, remaining);
      const newLoadedCount = state.loadedCount + toLoad;

      console.log(`[VaultStore] Loading ${toLoad} more vaults (${state.loadedCount} -> ${newLoadedCount})`);
      
      // Update the loaded count immediately so vaults appear
      set({ loadedCount: newLoadedCount });
      
      // Wait for React to render the new vaults (use requestAnimationFrame to ensure DOM update)
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      });
      
      // Note: loadingMore will be set to false by the component after balances are fetched
      // We keep it true here so the spinner stays visible
    } catch (err: any) {
      console.error("[VaultStore] Error loading more vaults:", err);
      set({ 
        loadingMore: false
      });
    }
  },

  setLoadingMore: (loading: boolean) => {
    set({ loadingMore: loading });
  },

  setVaults: (vaults: VaultData[]) => {
    set({ allVaults: vaults });
  },

  clearVaults: () => {
    set({ 
      allVaults: [], 
      loadedCount: 0,
      totalCount: 0,
      loading: false, 
      loadingMore: false,
      error: null, 
      lastFetched: null,
      currentEndpoint: null,
      currentNetwork: null,
      currentWallet: null,
      currentPublicKey: null
    });
  },

  setupEventListeners: async (endpoint: string, network: WalletAdapterNetwork, wallet: WalletAdapter | null) => {
    const state = get();
    
    // Clean up existing listeners first
    if (state.eventListenerId !== null) {
      get().cleanupEventListeners();
    }

    try {
      const isDevnet = network === WalletAdapterNetwork.Devnet;
      const devnetEndpoint = isDevnet
        ? (endpoint.includes("devnet") || endpoint.includes("dev") || endpoint.includes("api.devnet")
           ? endpoint
           : "https://api.devnet.solana.com")
        : endpoint;

      const connection = new Connection(devnetEndpoint, "confirmed");
      const provider = new AnchorProvider(
        connection,
        wallet as any,
        { commitment: "confirmed" }
      );

      const program = new Program<Fractionalization>(
        FractionalizationIdl as any,
        provider
      );

      // Listen for Fractionalized event only (to avoid 429 errors from too many account change events)
      const eventParser = new EventParser(program.programId, program.coder);
      const listenerId = await connection.onLogs(
        program.programId,
        (logs, context) => {
          try {
            const parsed = eventParser.parseLogs(logs.logs);
            const fractionalizedEvent = parsed.find((e: any) => e.name === 'fractionalized');
            
            if (fractionalizedEvent) {
              console.log("[VaultStore] Fractionalized event detected:", fractionalizedEvent);
              // Extract vault public key from event
              // Anchor events have data in fractionalizedEvent.data, and pubkeys might be PublicKey objects or strings
              const eventData = fractionalizedEvent.data || fractionalizedEvent;
              const vaultPublicKey = eventData.vault;
              
              if (vaultPublicKey) {
                try {
                  // Handle both PublicKey objects and string/base58 representations
                  const vaultPubkey = vaultPublicKey instanceof PublicKey 
                    ? vaultPublicKey 
                    : new PublicKey(vaultPublicKey);
                  console.log("[VaultStore] Fetching new vault and bringing to front:", vaultPubkey.toBase58());
                  const state = get();
                  if (state.currentEndpoint && state.currentNetwork) {
                    // Fetch just this vault and bring it to the front
                    get().fetchAndBringVaultToFront(vaultPubkey, state.currentEndpoint, state.currentNetwork, state.currentWallet);
                  }
                } catch (err) {
                  console.error("[VaultStore] Error parsing vault public key from event:", err);
                  // Fallback to debounced refetch
                  const state = get();
                  if (state.currentEndpoint && state.currentNetwork && state.currentPublicKey) {
                    get().debouncedRefetch(state.currentEndpoint, state.currentNetwork, state.currentWallet, state.currentPublicKey);
                  }
                }
              } else {
                // Fallback to debounced refetch if we can't get vault public key
                console.log("[VaultStore] No vault public key in event, scheduling refetch...");
                const state = get();
                if (state.currentEndpoint && state.currentNetwork && state.currentPublicKey) {
                  get().debouncedRefetch(state.currentEndpoint, state.currentNetwork, state.currentWallet, state.currentPublicKey);
                }
              }
            }
          } catch (err) {
            console.error("[VaultStore] Error parsing event logs:", err);
          }
        },
        "confirmed"
      );

      // Note: We removed onProgramAccountChange listener because it triggers too frequently
      // and causes 429 errors. Users can manually refresh if needed, or we can add
      // a polling mechanism with longer intervals if needed.

      set({ 
        eventListenerId: listenerId,
        connection: connection
      });
      
      console.log("[VaultStore] Event listeners set up successfully (Fractionalized event only)");
    } catch (err: any) {
      console.error("[VaultStore] Error setting up event listeners:", err);
    }
  },

  cleanupEventListeners: () => {
    const state = get();
    const { connection, eventListenerId, refetchTimeoutId } = state;
    
    // Clear any pending refetch
    if (refetchTimeoutId !== null) {
      clearTimeout(refetchTimeoutId);
    }
    
    // Note: Solana web3.js doesn't provide a direct way to remove onLogs listeners
    // The connection will be garbage collected when it goes out of scope
    // We just clear the reference so it can be cleaned up
    if (connection && eventListenerId !== null) {
      // Try to remove if the method exists (it might not in some versions)
      try {
        if (typeof (connection as any).removeOnLogsListener === 'function') {
          (connection as any).removeOnLogsListener(eventListenerId);
        }
      } catch (err) {
        // Ignore errors - the listener will be cleaned up when connection is garbage collected
        console.debug("[VaultStore] Could not remove logs listener (this is OK)");
      }
    }
    
    set({ 
      eventListenerId: null, 
      connection: null,
      refetchTimeoutId: null
    });
  },

  debouncedRefetch: (endpoint: string, network: WalletAdapterNetwork, wallet: WalletAdapter | null, publicKey: PublicKey | null) => {
    const state = get();
    
    // Clear existing timeout
    if (state.refetchTimeoutId !== null) {
      clearTimeout(state.refetchTimeoutId);
    }
    
    // Don't refetch if we just fetched recently (within last 5 seconds)
    const now = Date.now();
    if (state.lastFetched && (now - state.lastFetched) < 5000) {
      console.log("[VaultStore] Skipping refetch - too soon since last fetch");
      return;
    }
    
    // Set a new timeout to debounce refetches (wait 2 seconds)
    const timeoutId = setTimeout(() => {
      console.log("[VaultStore] Executing debounced refetch...");
      // Refetch and maintain current loaded count
      const currentLoaded = state.loadedCount;
      get().fetchInitialVaults(endpoint, network, wallet, publicKey, currentLoaded || 10);
      set({ refetchTimeoutId: null });
    }, 2000);
    
    set({ refetchTimeoutId: timeoutId });
  },

  fetchAndBringVaultToFront: async (vaultPublicKey: PublicKey, endpoint: string, network: WalletAdapterNetwork, wallet: WalletAdapter | null) => {
    const state = get();
    
    try {
      const isDevnet = network === WalletAdapterNetwork.Devnet;
      const devnetEndpoint = isDevnet
        ? (endpoint.includes("devnet") || endpoint.includes("dev") || endpoint.includes("api.devnet")
           ? endpoint
           : "https://api.devnet.solana.com")
        : endpoint;

      const connection = new Connection(devnetEndpoint, "confirmed");
      const provider = new AnchorProvider(
        connection,
        wallet as any,
        { commitment: "confirmed" }
      );

      const program = new Program<Fractionalization>(
        FractionalizationIdl as any,
        provider
      );

      // Fetch just this vault account
      console.log("[VaultStore] Fetching vault account:", vaultPublicKey.toBase58());
      const vaultAccount = await program.account.vault.fetch(vaultPublicKey);
      
      // Convert to VaultData format
      const vaultData: VaultData = {
        publicKey: vaultPublicKey,
        nftMint: vaultAccount.nftMint,
        nftAssetId: vaultAccount.nftAssetId,
        fractionMint: vaultAccount.fractionMint,
        totalSupply: BigInt(vaultAccount.totalSupply.toString()),
        creator: vaultAccount.creator,
        creationTimestamp: BigInt(vaultAccount.creationTimestamp.toString()),
        status: vaultAccount.status as VaultStatus,
        reclaimTimestamp: BigInt(vaultAccount.reclaimTimestamp.toString()),
        twapPriceAtReclaim: BigInt(vaultAccount.twapPriceAtReclaim.toString()),
        totalCompensation: BigInt(vaultAccount.totalCompensation.toString()),
        remainingCompensation: BigInt(vaultAccount.remainingCompensation.toString()),
        bump: vaultAccount.bump,
        minLpAgeSeconds: BigInt(vaultAccount.minLpAgeSeconds.toString()),
        minReclaimPercentage: vaultAccount.minReclaimPercentage,
        minLiquidityPercent: vaultAccount.minLiquidityPercent,
        minVolumePercent30d: vaultAccount.minVolumePercent30d,
        reclaimInitiator: vaultAccount.reclaimInitiator,
        reclaimInitiationTimestamp: BigInt(vaultAccount.reclaimInitiationTimestamp.toString()),
        tokensInEscrow: BigInt(vaultAccount.tokensInEscrow.toString()),
      };

      // Only process if vault is active
      if (!("active" in vaultData.status)) {
        console.log("[VaultStore] Vault is not active, skipping");
        return;
      }

      // Update the store: remove existing vault if it exists, then add to front
      const existingVaults = state.allVaults;
      const filteredVaults = existingVaults.filter(v => v.publicKey.toBase58() !== vaultPublicKey.toBase58());
      
      // Add new vault to the front
      const updatedVaults = [vaultData, ...filteredVaults];
      
      // Update loadedCount if needed (if we're showing vaults and this is a new one)
      let newLoadedCount = state.loadedCount;
      if (state.loadedCount > 0) {
        // If we had vaults loaded, increment the count to include this new one
        newLoadedCount = Math.min(state.loadedCount + 1, updatedVaults.length);
      } else {
        // If no vaults were loaded, set to 1
        newLoadedCount = 1;
      }

      console.log(`[VaultStore] Added vault to front. Total vaults: ${updatedVaults.length}, Loaded: ${newLoadedCount}`);
      
      set({
        allVaults: updatedVaults,
        totalCount: updatedVaults.length,
        loadedCount: newLoadedCount,
        lastFetched: Date.now(),
      });
    } catch (err: any) {
      console.error("[VaultStore] Error fetching vault:", err);
      // If fetching single vault fails, fall back to debounced refetch
      if (state.currentPublicKey) {
        get().debouncedRefetch(endpoint, network, wallet, state.currentPublicKey);
      }
    }
  },

  getActiveVaults: () => {
    const state = get();
    // All vaults in store are already filtered to active, so just return all of them
    return state.allVaults;
  },

  getLoadedActiveVaults: () => {
    const state = get();
    // Return only the loaded/exposed vaults
    return state.allVaults.slice(0, state.loadedCount);
  },

  hasMoreVaults: () => {
    const state = get();
    return state.loadedCount < state.totalCount;
  },

  getVaultsByCreator: (creator: PublicKey) => {
    const state = get();
    return state.allVaults.filter(
      (vault) => vault.creator.toBase58() === creator.toBase58()
    );
  },

  getPaginatedVaults: (vaults: VaultData[], page: number, perPage: number) => {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return vaults.slice(start, end);
  },
    }),
    {
      name: 'vault-store',
      storage: createJSONStorage(() => localStorage),
      // Only persist specific fields, serialize vaults
      partialize: (state) => ({
        allVaults: state.allVaults.map(serializeVaultData),
        loadedCount: state.loadedCount,
        totalCount: state.totalCount,
        lastFetched: state.lastFetched,
      }),
      // Deserialize on rehydration
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('[VaultStore] Error rehydrating store:', error);
          return;
        }
        if (state) {
          try {
            // State has been restored from storage with serialized data
            // Deserialize vaults from SerializedVaultData[] to VaultData[]
            if (state.allVaults && Array.isArray(state.allVaults) && state.allVaults.length > 0) {
              // Check if first item is already deserialized (has PublicKey)
              const first = state.allVaults[0];
              if (first && !(first.publicKey instanceof PublicKey)) {
                // Need to deserialize
                state.allVaults = state.allVaults.map((v: any) => deserializeVaultData(v as SerializedVaultData));
                console.log('[VaultStore] Rehydrated', state.allVaults.length, 'vaults from storage');
              } else {
                console.log('[VaultStore] Vaults already deserialized');
              }
            }
          } catch (err) {
            console.error('[VaultStore] Error deserializing vaults:', err);
            // Reset to empty if deserialization fails
            state.allVaults = [];
            state.loadedCount = 0;
            state.totalCount = 0;
          }
        }
      },
    }
  )
);

export default useVaultStore;

