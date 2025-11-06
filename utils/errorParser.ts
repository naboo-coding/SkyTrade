/**
 * Converts technical errors into user-friendly messages
 */

export function parseUserFriendlyError(error: any): string {
  const errorMessage = error?.message || String(error);
  const errorString = JSON.stringify(error).toLowerCase();
  
  // Log full error for developers
  console.error("Full error details:", error);
  
  // Metadata Symbol too long
  if (
    errorMessage.includes("MetadataSymbolTooLong") ||
    errorMessage.includes("Symbol in metadata is too long") ||
    errorString.includes("metadatasymboltoolong") ||
    errorString.includes("symbol in metadata is too long") ||
    errorString.includes("0x177d") ||
    errorMessage.includes("6013")
  ) {
    return "The symbol is too long. NFT symbols must be 10 characters or fewer. Please use a shorter symbol.";
  }

  // Metadata URI too long
  if (
    errorMessage.includes("MetadataUriTooLong") ||
    errorMessage.includes("URI is too long") ||
    errorMessage.includes("Uri in metadata is too long") ||
    errorString.includes("metadatauritoolong") ||
    errorString.includes("0x177e") ||
    errorMessage.includes("6014")
  ) {
    return "The image URL is too long. Please provide a Pinata JWT to upload to IPFS, or use a shorter image URL (under 100 characters).";
  }
  
  // Wallet not connected
  if (
    errorMessage.includes("Wallet not connected") ||
    errorMessage.includes("No wallet connected") ||
    errorMessage.includes("wallet not connected")
  ) {
    return "Please connect your wallet to continue.";
  }
  
  // Image URL required
  if (
    errorMessage.includes("Image URL") && 
    errorMessage.includes("required")
  ) {
    return "Please provide an image URL or upload a file with a Pinata JWT.";
  }
  
  // Insufficient funds
  if (
    errorMessage.includes("insufficient lamports") ||
    errorMessage.includes("insufficient funds") ||
    errorString.includes("insufficient lamports") ||
    errorString.includes("insufficient funds") ||
    errorString.includes("transfer: insufficient")
  ) {
    // Try to extract the amounts from the error
    const lamportsMatch = errorMessage.match(/insufficient lamports (\d+), need (\d+)/i) || 
                         errorString.match(/insufficient lamports (\d+), need (\d+)/i);
    
    if (lamportsMatch) {
      const haveLamports = parseInt(lamportsMatch[1]);
      const needLamports = parseInt(lamportsMatch[2]);
      const haveSol = (haveLamports / 1e9).toFixed(4);
      const needSol = (needLamports / 1e9).toFixed(4);
      const shortfallSol = ((needLamports - haveLamports) / 1e9).toFixed(4);
      
      return `Insufficient SOL balance. You have ${haveSol} SOL but need ${needSol} SOL. Please add at least ${shortfallSol} SOL to your wallet to continue.`;
    }
    
    return "Insufficient SOL balance. Minting a cNFT requires approximately 0.3-0.4 SOL for rent exemption (creating the merkle tree and collection). Please add more SOL to your wallet.";
  }

  // Transaction simulation failed (general)
  if (
    errorMessage.includes("Transaction simulation failed") ||
    errorMessage.includes("Simulation failed") ||
    errorString.includes("simulation failed")
  ) {
    // Check for specific causes
    if (errorString.includes("metadatauritoolong") || errorString.includes("0x177e")) {
      return "The image URL is too long. Please provide a Pinata JWT to upload to IPFS, or use a shorter image URL.";
    }
    
    // Check if it's an insufficient funds error in the logs
    if (errorString.includes("insufficient lamports") || errorString.includes("insufficient funds")) {
      return "Insufficient SOL balance. Minting a cNFT requires approximately 0.3-0.4 SOL for rent exemption. Please add more SOL to your wallet.";
    }
    
    return "Transaction failed. Please check your wallet has sufficient funds and try again. If the problem persists, ensure your image URL is not too long.";
  }
  
  // Network/RPC errors
  if (
    errorMessage.includes("fetch") ||
    errorMessage.includes("network") ||
    errorMessage.includes("Failed to fetch") ||
    errorString.includes("networkerror")
  ) {
    return "Network error. Please check your internet connection and try again.";
  }
  
  // Generic transaction errors
  if (
    errorMessage.includes("Transaction failed") ||
    errorMessage.includes("Transaction rejected") ||
    errorMessage.includes("User rejected")
  ) {
    return "Transaction was rejected. Please try again.";
  }
  
  // Default: return a sanitized version without technical details
  // Remove common technical prefixes/suffixes
  let sanitized = errorMessage
    .replace(/Error:\s*/gi, "")
    .replace(/Transaction\s+simulation\s+failed:\s*/gi, "")
    .replace(/Source:\s*Program[^\n]*/gi, "")
    .replace(/Caused\s+By:[^\n]*/gi, "")
    .replace(/Program\s+log:[^\n]*/gi, "")
    .replace(/custom\s+program\s+error:[^\n]*/gi, "")
    .replace(/0x[0-9a-f]+/gi, "")
    .trim();
  
  // If it's still too long or technical, provide a generic message
  if (sanitized.length > 200 || sanitized.includes("Program") || sanitized.includes("Instruction")) {
    return "An error occurred. Please check that your image URL is valid and not too long, and ensure your wallet is connected.";
  }
  
  return sanitized || "An unexpected error occurred. Please try again.";
}


