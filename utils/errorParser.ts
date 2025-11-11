// Takes those nasty technical errors and turns them into something humans can actually understand

export function parseUserFriendlyError(error: any): string {
  const errorMessage = error?.message || String(error);
  const errorString = JSON.stringify(error).toLowerCase();
  
  // Only log in dev mode, and just the message - don't want stack traces cluttering things up
  if (process.env.NODE_ENV === 'development') {
    console.warn("Error message:", errorMessage);
  }
  
  // Check if the symbol is too long
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

  // Check if the URI is too long
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
  
  // User forgot to connect their wallet
  if (
    errorMessage.includes("Wallet not connected") ||
    errorMessage.includes("No wallet connected") ||
    errorMessage.includes("wallet not connected")
  ) {
    return "Please connect your wallet to continue.";
  }
  
  // Missing image URL
  if (
    errorMessage.includes("Image URL") && 
    errorMessage.includes("required")
  ) {
    return "Please provide an image URL or upload a file with a Pinata JWT.";
  }
  
  // Not enough SOL in the wallet
  if (
    errorMessage.includes("insufficient lamports") ||
    errorMessage.includes("insufficient funds") ||
    errorString.includes("insufficient lamports") ||
    errorString.includes("insufficient funds") ||
    errorString.includes("transfer: insufficient")
  ) {
    // See if we can pull out the actual numbers from the error message
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

  // Transaction is too big to send (happens with deep merkle trees)
  if (
    errorMessage.includes("too large") ||
    errorMessage.includes("VersionedTransaction too large") ||
    errorString.includes("too large") ||
    errorString.includes("versionedtransaction too large") ||
    errorString.includes("max: encoded/raw")
  ) {
    return "The transaction is too large to process. This can happen with very deep merkle trees. Please try again later or contact support if the issue persists.";
  }

  // Transaction simulation failed for some reason
  if (
    errorMessage.includes("Transaction simulation failed") ||
    errorMessage.includes("Simulation failed") ||
    errorString.includes("simulation failed") ||
    errorString.includes("failed to simulate transaction")
  ) {
    // First check if it's a size issue
    if (errorString.includes("too large") || errorString.includes("max: encoded/raw")) {
      return "The transaction is too large to process. This can happen with very deep merkle trees. Please try again later or contact support if the issue persists.";
    }
    
    // Look for other specific error types
    if (errorString.includes("metadatauritoolong") || errorString.includes("0x177e")) {
      return "The image URL is too long. Please provide a Pinata JWT to upload to IPFS, or use a shorter image URL.";
    }
    
    // Maybe it's actually a funds issue
    if (errorString.includes("insufficient lamports") || errorString.includes("insufficient funds")) {
      return "Insufficient SOL balance. Minting a cNFT requires approximately 0.3-0.4 SOL for rent exemption. Please add more SOL to your wallet.";
    }
    
    return "Transaction failed. Please check your wallet has sufficient funds and try again. If the problem persists, ensure your image URL is not too long.";
  }
  
  // Network issues or RPC problems
  if (
    errorMessage.includes("fetch") ||
    errorMessage.includes("network") ||
    errorMessage.includes("Failed to fetch") ||
    errorString.includes("networkerror")
  ) {
    return "Network error. Please check your internet connection and try again.";
  }
  
  // Generic transaction failures
  if (
    errorMessage.includes("Transaction failed") ||
    errorMessage.includes("Transaction rejected") ||
    errorMessage.includes("User rejected")
  ) {
    return "Transaction was rejected. Please try again.";
  }
  
  // If we don't recognize the error, clean it up and return something readable
  // Strip out all the technical jargon
  let sanitized = errorMessage
    .replace(/Error:\s*/gi, "")
    .replace(/Transaction\s+simulation\s+failed:\s*/gi, "")
    .replace(/failed\s+to\s+simulate\s+transaction:\s*/gi, "")
    .replace(/base64\s+encoded\s+solana_transaction[^\n]*/gi, "")
    .replace(/VersionedTransaction[^\n]*/gi, "")
    .replace(/bytes\s*\(max:[^)]*\)/gi, "")
    .replace(/Source:\s*Program[^\n]*/gi, "")
    .replace(/Caused\s+By:[^\n]*/gi, "")
    .replace(/Program\s+log:[^\n]*/gi, "")
    .replace(/custom\s+program\s+error:[^\n]*/gi, "")
    .replace(/0x[0-9a-f]+/gi, "")
    .replace(/\[^\n]*InstructionError[^\n]*/gi, "")
    .trim();
  
  // If it's still a mess after cleaning, just give a generic error
  if (
    sanitized.length > 200 || 
    sanitized.includes("Program") || 
    sanitized.includes("Instruction") ||
    sanitized.includes("VersionedTransaction") ||
    sanitized.includes("base64") ||
    sanitized.includes("bytes (max:")
  ) {
    return "An error occurred during fractionalization. Please ensure your wallet is connected, has sufficient funds, and try again. If the problem persists, the NFT may need more time to be indexed.";
  }
  
  return sanitized || "An unexpected error occurred. Please try again.";
}


