/**
 * Utility functions for IPFS gateway handling
 * Provides fallback gateways if primary gateway fails
 */

const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
];

/**
 * Extracts IPFS hash from a URL
 */
export function extractIpfsHash(url: string): string | null {
  // Match IPFS hash (Qm... or bafy...)
  const ipfsHashPattern = /(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z0-9]{56,})/i;
  const match = url.match(ipfsHashPattern);
  return match ? match[1] : null;
}

/**
 * Converts an IPFS URL to use a specific gateway
 */
export function convertToGateway(url: string, gateway: string): string {
  const hash = extractIpfsHash(url);
  if (!hash) return url;
  return `${gateway}${hash}`;
}

/**
 * Gets all gateway URLs for an IPFS hash
 */
export function getAllGatewayUrls(url: string): string[] {
  const hash = extractIpfsHash(url);
  if (!hash) return [url];
  return IPFS_GATEWAYS.map(gateway => `${gateway}${hash}`);
}

/**
 * Checks if a URL is an IPFS URL
 */
export function isIpfsUrl(url: string): boolean {
  return /ipfs\/(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z0-9]{56,})/i.test(url) || 
         /^https?:\/\/(gateway\.pinata\.cloud|ipfs\.io|cloudflare-ipfs\.com|dweb\.link)\/ipfs\//i.test(url);
}

