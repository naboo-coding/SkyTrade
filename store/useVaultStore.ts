import { create } from 'zustand';
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
  
  // Getters
  getActiveVaults: () => VaultData[];
  getLoadedActiveVaults: () => VaultData[];
  getVaultsByCreator: (creator: PublicKey) => VaultData[];
  getPaginatedVaults: (vaults: VaultData[], page: number, perPage: number) => VaultData[];
  hasMoreVaults: () => boolean;
}

const useVaultStore = create<VaultStoreState>()((set, get) => ({
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
              console.log("[VaultStore] Fractionalized event detected, scheduling refetch...");
              // Use debounced refetch to avoid 429 errors
              const state = get();
              if (state.currentEndpoint && state.currentNetwork && state.currentPublicKey) {
                get().debouncedRefetch(state.currentEndpoint, state.currentNetwork, state.currentWallet, state.currentPublicKey);
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
}));

export default useVaultStore;

