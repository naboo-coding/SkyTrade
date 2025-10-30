require('dotenv').config();

// utils/helper.ts
import * as anchor from "@coral-xyz/anchor";
import Bundlr from "@bundlr-network/client";
import { readFileSync } from 'fs';
import { Keypair } from "@solana/web3.js"
import { Signer, Umi, generateSigner, percentAmount, PublicKey, publicKey } from "@metaplex-foundation/umi";
import { createTree, mintToCollectionV1, findLeafAssetIdPda, TokenStandard, createTreeV2, mintV2 } from "@metaplex-foundation/mpl-bubblegum";
import { createNft } from "@metaplex-foundation/mpl-token-metadata";
import { createCollectionV2, plugin, pluginAuthority } from "@metaplex-foundation/mpl-core"
import fs from 'fs';
import path from "path";
import axios from 'axios';
import FormData from 'form-data';

const IMG_PATH = path.resolve(__dirname, '../assets/daftpunk_cNFT.jpg');
if (!IMG_PATH) {
    throw new Error('Image path could not be resolved');
} else {
    console.log(`Image path resolved: ${IMG_PATH}`);
}

const PINATA_JWT = process.env.PINATA_JWT;
if (!PINATA_JWT) {
    throw new Error('.env variable PINATA_JWT is not set');
}

/**
 * - Uploads an image to Pinata and returns the IPFS URL
 * @param filePath - The path to the image file to be uploaded
 * @returns - The IPFS URL of the uploaded image
 */
async function uploadImageToPinata(filePath: string): Promise<string> {
    const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
    const stream = fs.createReadStream(filePath);
    const data = new FormData();
    data.append('file', stream), {filePath: path.basename(filePath)};

    try {
        console.log(`Uploading image to Pinata from ${filePath}...`);
        const response = await axios.post(url, data, {
            headers: {
                ...data.getHeaders(),
                'Authorization': `Bearer ${PINATA_JWT}`
            }
        });
        const ipfsHash = response.data.IpfsHash;
        const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
        console.log(`Image uploaded to Pinata: ${ipfsUrl}`);
        return ipfsUrl;
    } catch (error) {
        console.error('Error uploading image to Pinata:', error);
        throw error;
    }
}

/**
 * - Uploads metadata JSON to Pinata and returns the IPFS URL
 * @param name - The name of the cNFT
 * @param symbol - The symbol of the cNFT
 * @param imageUrl - The URL of the image
 * @returns 
 */
async function uploadMetadataToPinata(
    name: string,
    symbol: string,
    imageUrl: string
): Promise<string> {

    const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;

    const metadata = {
        name: name,
        symbol: symbol,
        description: 'Daft Punk cNFT for fractionalization',
        image: imageUrl
    };

    try {
        console.log(`Uploading metadata to Pinata...`);
        const response = await axios.post(url, metadata, {
            headers: {
                'Authorization': `Bearer ${PINATA_JWT}`,
                'Content-Type': 'application/json'
            }
        })
        const ipfsHash = response.data.IpfsHash;
        const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
        console.log(`Metadata uploaded to Pinata: ${ipfsUrl}`);
        return ipfsUrl;
    } catch (error) {
        console.error('Error uploading metadata to Pinata:', error);
        throw error;
    }
}



/**
 * Creates a new Merkle tree on-chain for storig cNFTs V1
 * This is a prerequisite for minting any compressed NFTs
 * @param {Umi} umi - Them Umi instance for interacting with the blockchain
 * @returns {Promise<Keypair>} - The keypair of the newly created Merkle tree
 */
export async function createMerkleTreeV1(umi: Umi): Promise<Signer> {

    const merkleTree = generateSigner(umi);

    const builder = await createTree(umi, {
        merkleTree,
        maxDepth: 14,
        maxBufferSize: 64,
        canopyDepth: 8,
    });

    // Ensure the tree is fully finalized on-chain before proceeding;
    // Helius DevNet may lag behind the chain head, so we wait until
    // every validator (and its RPC) has acknowledged the tree-authority
    // account to avoid “AccountNotInitialized” errors during cNFT mint.
    await builder.sendAndConfirm(umi,
        {
            confirm: {
                commitment: 'finalized'
            }
        }
    );

    console.log(`Merkle Tree V1 created: ${merkleTree.publicKey}`);
    return merkleTree;
}

/**
 * Mints a standard, uncompressed NFT that will act as the "Collection" for the compressed NFTs. 
 * Every cNFT must belong to a collection
 * @param {Umi} umi - The Umi instance for interacting with the blockchain
 * @returns {Promise<PublicKey>} - The mint address of the collection NFT
 */
export async function createCollectionV1(umi: Umi): Promise<PublicKey> {

    const collectionMint = generateSigner(umi);

    await createNft(umi, {
        mint: collectionMint,
        name: 'My Collection V1',
        symbol: 'COL_V1',
        uri: 'https://example.com/collection.json',
        isCollection: true,
        sellerFeeBasisPoints: percentAmount(5.5)     // fee for the creator every time that theNFT is resold
    }).sendAndConfirm(umi);

    console.log(`Collection NFT minted: ${collectionMint.publicKey}`);
    return collectionMint.publicKey;
}

/**
 * Mints a new compressed NFT (cNFT) to a specified Merkle tree and assigns it to a collection
 * 
 * @param {Umi} umi - The Umi instance for interacting with the blockchain
 * @param {PublicKey} merkleTree - The public key of the Merkle tree to mint into
 * @param {PublicKey} collection - The public key of the collection NFT
 * @param {Keypair} payer - The Keypair paying for the minting and upload fees
 * @returns {Promise<PublicKey>} - The asset ID (PDA) of the newly minted cNFT
 */
export async function mintCnftV1(
    umi: Umi,
    merkleTree: PublicKey,
    collection: PublicKey,
    payer: Keypair
): Promise<PublicKey> {

    console.log(`Uploading image to Pinata...`);
    const imageUrl = await uploadImageToPinata(IMG_PATH);
    console.log(`Uploading metadata to Pinata...`);
    const metadataUrl = await uploadMetadataToPinata(
        'Daft-Punk cNFT',
        'DP',
        imageUrl
    );
    console.log(`Image URL: ${imageUrl}`);
    console.log(`Metadata URL: ${metadataUrl}`);

    // 1. Mint the cNFT
    await mintToCollectionV1(umi, {
        leafOwner: umi.payer.publicKey,
        merkleTree: merkleTree,
        collectionMint: collection,
        metadata: {
            name: 'Daft Punk cNFT',
            symbol: 'DP',
            uri: metadataUrl,
            sellerFeeBasisPoints: 500,
            creators: [
                {
                    address: umi.payer.publicKey,
                    verified: true,
                    share: 100
                }
            ],
            collection: {
                key: collection,
                verified: false
            },
            tokenStandard: TokenStandard.NonFungible
        }
    }).sendAndConfirm(umi, {
        confirm: {
            commitment: 'finalized'
        }
    });

    // 2. Compute its Asset ID.
    // NOTE: leafIndex = 0 because this is the first cNFT minted into the tree.
    // If you mint additional cNFTs later, increment this value fetch the current number of leaves 
    // from the on-chain tree account and use that as the next index.
    const leafIndex = 0;
    const [assetId] = findLeafAssetIdPda(umi, { merkleTree, leafIndex });
    console.log(`cNFT V1 minted with Asset ID: ${assetId}`);
    return assetId;
}



/**
 * Creates a new Merkle tree on-chain for storig cNFTs V2
 * This is a prerequisite for minting any compressed NFTs
 * @param {Umi} umi - Them Umi instance for interacting with the blockchain
 * @returns {Promise<Keypair>} - The keypair of the newly created Merkle tree
 */
export async function createMerkleTreeV2(umi: Umi): Promise<Signer> {

    const merkleTree = generateSigner(umi);

    const builder = await createTreeV2(umi, {
        merkleTree,
        maxDepth: 14,
        maxBufferSize: 64,
        canopyDepth: 6,
    });

    // Ensure the tree is fully finalized on-chain before proceeding;
    // Helius DevNet may lag behind the chain head, so we wait until
    // every validator (and its RPC) has acknowledged the tree-authority
    // account to avoid “AccountNotInitialized” errors during cNFT mint.
    await builder.sendAndConfirm(umi,
        {
            confirm: {
                commitment: 'finalized'
            }
        }
    );

    console.log(`Merkle Tree V2 created: ${merkleTree.publicKey}`);
    return merkleTree;
}


/**
 * Mints a collection using mpl-core V2 that will act as the "Collection" for the compressed NFTs. 
 * Every cNFT must belong to a collection
 * @param {Umi} umi - The Umi instance for interacting with the blockchain
 * @returns {Promise<PublicKey>} - The mint address of the collection NFT
 */
export async function createCollection_V2(umi: Umi): Promise<PublicKey> {

    const coreCollection = generateSigner(umi);

    await createCollectionV2(umi, {
        collection: coreCollection,
        name: 'Test Core Collection V2',
        uri: 'https://example.com/core-collection.json',
        plugins: [
            {
                plugin: {
                    __kind: 'BubblegumV2',
                    fields: [{}] // BubblegumV2Args 
                },

                authority: null
            }
        ]
    }).sendAndConfirm(umi, {
        confirm: {
            commitment: 'finalized'
        }
    });

    console.log(`Core Collection NFT V2 minted: ${coreCollection.publicKey}`);
    return coreCollection.publicKey;
}

/**
 * Mints a new compressed NFT (cNFT) V2 to a specified Merkle tree and assigns it to a collection
 * 
 * @param {Umi} umi - The Umi instance for interacting with the blockchain
 * @param {PublicKey} merkleTree - The public key of the Merkle tree to mint into
 * @param {PublicKey} collection - The public key of the collection NFT
 * @returns {Promise<PublicKey>} - The asset ID (PDA) of the newly minted cNFT
 */
export async function mintCnftV2(
    umi: Umi,
    merkleTree: PublicKey,
    collection: PublicKey
): Promise<PublicKey> {

    // 1. Mint the cNFT
    await mintV2(umi, {
        leafOwner: umi.payer.publicKey,
        merkleTree: merkleTree,
        coreCollection: collection,
        metadata: {
            name: 'Test cNFT V2',
            symbol: 'TCNFT_V2',
            uri: 'https://example.com/cnft.json',
            sellerFeeBasisPoints: 500,
            creators: [
                {
                    address: umi.payer.publicKey,
                    verified: true,
                    share: 100
                }
            ],
            collection: collection,
            tokenStandard: TokenStandard.NonFungible
        }
    }).sendAndConfirm(umi, {
        confirm: {
            commitment: 'finalized'
        }
    });

    // 2. Compute its Asset ID.
    // NOTE: leafIndex = 0 because this is the first cNFT minted into the tree.
    // If you mint additional cNFTs later, increment this value fetch the current number of leaves 
    // from the on-chain tree account and use that as the next index.
    const leafIndex = 0;
    const [assetId] = findLeafAssetIdPda(umi, { merkleTree, leafIndex });
    console.log(`cNFT V2 minted with Asset ID: ${assetId}`);
    return assetId;
}
