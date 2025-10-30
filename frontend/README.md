# SkyTrade Frontend - cNFT Fractionalization

A Next.js frontend application for fractionalizing compressed NFTs (cNFTs) on Solana Devnet.

## Features

- 🔗 Connect Solana wallet (Phantom, Solflare, etc.)
- 🎨 Display user's cNFT collection from their wallet
- ✨ Test minting feature for creating test cNFTs
- 💎 Fractionalize selected cNFTs with customizable parameters
- 📊 Real-time transaction status and explorer links

## Setup

### Prerequisites

- Node.js 18+ installed
- A Solana wallet (Phantom recommended)
- Helius API key (for RPC)
- Pinata JWT (optional, for testing cNFT minting)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env.local`:
```
NEXT_PUBLIC_RPC_URL=https://devnet.helius-rpc.com/?api-key=e9018fe9-da2e-4a39-95f0-377e1c036f52
NEXT_PUBLIC_PROGRAM_ID=DM26SsAwF5NSGVWSebfaUBkYAG3ioLkfFnqt1Vr7pq2P
NEXT_PUBLIC_PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI5Yjg2Y2M1YS01MTU3LTQyYzgtYjZjYy1lOWQ2NDZhMjUwMDkiLCJlbWFpbCI6ImFubmEuYmVhdHJpei5nYW1iYUBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiMjdjZGIxZWVlYjRlMWE2OWM4ZDYiLCJzY29wZWRLZXlTZWNyZXQiOiJhYTk3OTIzYTU3ODBjNzNjNmRjMGIzMDM2OGVlMjhiOWE5ZTlhNDJlYmIxYzc4MmNjZGU4ZTNjMjFkMWQ3YzgzIiwiZXhwIjoxNzkzMzE4NzQxfQ.EAQ8xZqtADsujZVsHCVHEDM0OX9iWHhbMMiIu6-aw2A
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Connect Wallet**: Click "Connect Wallet" in the navigation bar
2. **View cNFTs**: Your wallet's compressed NFTs will be displayed automatically
3. **Mint Test cNFT** (Optional): Click "Mint Test cNFT" to create a test cNFT for fractionalization
4. **Select cNFT**: Click on any cNFT in the gallery to select it
5. **Fill Form**: Enter fractionalization parameters:
   - **Total Supply**: Number of fractional tokens to mint (in millions)
   - **Min LP Age Seconds** (Optional): Minimum liquidity pool age
   - **Min Reclaim Percent** (Optional): Minimum percentage needed to reclaim
   - **Min Liquidity Percent** (Optional): Minimum liquidity percentage
   - **Min Volume Percent (30d)** (Optional): Minimum volume percentage
6. **Fractionalize**: Click "Fractionalize cNFT" to execute the transaction
7. **View Transaction**: After successful fractionalization, view the transaction on Solana Explorer

## Architecture

### Directory Structure

```
app/
├── components/          # React components
│   ├── Navbar.tsx      # Navigation with wallet connection
│   ├── CnftGallery.tsx # cNFT display grid
│   └── FractionalizationForm.tsx # Fractionalization UI
├── hooks/              # Custom React hooks
│   ├── useWallet.ts    # Wallet connection logic
│   ├── useCnft.ts      # Fetch user's cNFTs
│   ├── useFractionalization.ts # Fractionalization logic
│   └── useMintCnft.ts  # cNFT minting for testing
├── lib/                # Utility functions
│   └── utils/          # Helper functions (umi, program setup)
└── page.tsx            # Main page component
```

### Key Technologies

- **Next.js 16**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **@solana/wallet-adapter**: Solana wallet integration
- **@coral-xyz/anchor**: Solana program interaction
- **@metaplex-foundation**: cNFT operations
- **Helius DAS API**: Fetching on-chain cNFT data

## Technical Details

### Fractionalization Parameters

**User Input Parameters:**
- `totalSupply`: Total number of fractional tokens
- `minLpAgeSeconds`: Optional minimum liquidity pool age
- `minReclaimPercent`: Optional minimum percentage to reclaim NFT
- `minLiquidityPercent`: Optional minimum liquidity percentage
- `minVolumePercent30d`: Optional minimum 30-day volume percentage

**Automatic Parameters** (fetched from cNFT metadata):
- `root`, `data_hash`, `creator_hash`: Merkle tree proof data
- `nonce`, `index`: Leaf identification
- `cNftName`, `cNftSymbol`, `cNftUri`: cNFT metadata

**Hardcoded Parameters:**
- `protocol_percent_fee`: 5% (automatically deducted from total supply)

### Program Details

- **Program ID**: `DM26SsAwF5NSGVWSebfaUBkYAG3ioLkfFnqt1Vr7pq2P`
- **Network**: Solana Devnet
- **cNFT Standard**: Bubblegum V1

## Development

### Building for Production

```bash
npm run build
npm start
```

### Testing

The application includes test minting functionality. To test:

1. Connect your wallet (ensure it has some SOL for fees on Devnet)
2. Click "Mint Test cNFT"
3. Wait for the cNFT to appear (may take 30-60 seconds for indexing)
4. Select the cNFT and fractionalize it

## Troubleshooting

### Wallet Not Connecting
- Ensure you have a Solana wallet extension installed (Phantom, Solflare)
- Make sure you're on Devnet in your wallet settings

### No cNFTs Showing
- Wait 30-60 seconds after minting for indexers to catch up
- Refresh the page
- Check your wallet has cNFTs on Devnet

### Transaction Failures
- Ensure you have enough SOL for transaction fees
- Check the console for error messages
- Verify your Helius API key is correct

## License

ISC
