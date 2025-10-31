# SkyTrade Frontend

A Next.js frontend application for fractionalizing compressed NFTs (cNFTs) on Solana.

## Features

- **Wallet Connection**: Connect your Solana wallet using Phantom, Solflare, or other supported wallets
- **cNFT Gallery**: View all compressed NFTs owned by your connected wallet
- **Mint cNFT** (Testing): Mint a new compressed NFT directly from the interface
- **Fractionalization**: Fractionalize your cNFTs into tradeable tokens

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root directory with:
```
NEXT_PUBLIC_HELIUS_RPC_URL=your_helius_rpc_url_here
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Connect Wallet**: Click the "Select Wallet" button in the navbar to connect your Solana wallet
2. **View cNFTs**: Once connected, your compressed NFTs will automatically load and display in the gallery
3. **Mint cNFT** (Optional): Use the "Mint cNFT (Testing)" button to create a new compressed NFT for testing
4. **Fractionalize**: Select a cNFT from the gallery, fill in the fractionalization parameters, and click "Fractional confirmation"

## Project Structure

- `/app` - Next.js app directory with pages and layout
- `/components` - React components (Navbar, Gallery, Forms)
- `/hooks` - Custom React hooks for blockchain interactions
- `/constants` - Constants and program IDs
- `/utils` - Utility functions (Pinata upload helpers)

## Notes

- The app uses Helius DAS API for fetching compressed NFT data
- Pinata integration is optional for IPFS uploads (requires JWT)
- All fractionalization operations happen on Solana Devnet
- Protocol fee is hardcoded to 5%

