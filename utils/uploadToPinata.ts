/**
 * Client-side utility functions for uploading to Pinata
 * These work in the browser environment
 */

export async function uploadImageToPinata(file: File, pinataJwt: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pinataJwt}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload image: ${response.statusText}`);
  }

  const data = await response.json();
  return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
}

export async function uploadMetadataToPinata(
  name: string,
  symbol: string,
  imageUrl: string,
  pinataJwt: string
): Promise<string> {
  const metadata = {
    name,
    symbol,
    description: "Daft Punk cNFT for fractionalization",
    image: imageUrl,
  };

  const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pinataJwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    throw new Error(`Failed to upload metadata: ${response.statusText}`);
  }

  const data = await response.json();
  return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
}
