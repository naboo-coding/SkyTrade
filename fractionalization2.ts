/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `fractionalization.json`.
 */
export type Fractionalization = {
  "address": "DM26SsAwF5NSGVWSebfaUBkYAG3ioLkfFnqt1Vr7pq2P",
  "metadata": {
    "name": "fractionalization",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "cancelReclaimV1",
      "discriminator": [
        222,
        82,
        90,
        102,
        159,
        37,
        25,
        198
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "nftAssetId"
              }
            ]
          }
        },
        {
          "name": "fractionMint"
        },
        {
          "name": "userFractionedTokenAccount",
          "writable": true
        },
        {
          "name": "usdcMint",
          "address": "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"
        },
        {
          "name": "userUsdcAccount",
          "writable": true
        },
        {
          "name": "treasury",
          "docs": [
            "Treasury wallet - receives cancellation fee"
          ]
        },
        {
          "name": "treasuryUsdcAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasury"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "compensationEscrowAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  109,
                  112,
                  101,
                  110,
                  115,
                  97,
                  116,
                  105,
                  111,
                  110,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "tokenEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "compensationEscrowAuthority"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "fractionMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nftAssetId",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "finalizeReclaimV1",
      "discriminator": [
        150,
        78,
        171,
        122,
        90,
        81,
        155,
        113
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "nftAssetId"
              }
            ]
          }
        },
        {
          "name": "fractionMint",
          "writable": true
        },
        {
          "name": "userFractionedTokenAccount",
          "writable": true
        },
        {
          "name": "usdcMint",
          "address": "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"
        },
        {
          "name": "userUsdcAccount",
          "writable": true
        },
        {
          "name": "treasury",
          "docs": [
            "Treasury wallet - receives Reclaim fee"
          ]
        },
        {
          "name": "treasuryUsdcAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasury"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "compensationEscrowAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  109,
                  112,
                  101,
                  110,
                  115,
                  97,
                  116,
                  105,
                  111,
                  110,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "compensationEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "compensationEscrowAuthority"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenEscrow",
          "docs": [
            "Token escrow ATA holding the locked fractions (authority = compensation_escrow_authority PDA)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "compensationEscrowAuthority"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "fractionMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "raydiumPool"
        },
        {
          "name": "observationState"
        },
        {
          "name": "bubblegumProgram",
          "address": "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"
        },
        {
          "name": "compressionProgram"
        },
        {
          "name": "merkleTree",
          "writable": true
        },
        {
          "name": "treeAuthority",
          "writable": true
        },
        {
          "name": "leafDelegate",
          "optional": true
        },
        {
          "name": "logWrapper"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nftAssetId",
          "type": "pubkey"
        },
        {
          "name": "root",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "dataHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "creatorHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "nonce",
          "type": "u64"
        },
        {
          "name": "index",
          "type": "u32"
        }
      ]
    },
    {
      "name": "fractionalizeV1",
      "discriminator": [
        182,
        190,
        181,
        8,
        5,
        244,
        64,
        234
      ],
      "accounts": [
        {
          "name": "fractionalizer",
          "docs": [
            "Fractionalizer – pays rent, receives net tokens, signs the tx"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "docs": [
            "Vault PDA – init, becomes NFT custodian + stores thresholds."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "nftAsset"
              }
            ]
          }
        },
        {
          "name": "mintAuthority",
          "docs": [
            "Mint authority PDA - Can mint/burn fractions"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "fractionMint",
          "docs": [
            "Fraction mint PDA with SPL token metadata. Its mint authority is held by the program."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  114,
                  97,
                  99,
                  116,
                  105,
                  111,
                  110,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "metadataAccount",
          "docs": [
            "Metadata account for the fraction mint",
            "Validated in the instruction and only used for CPI to mpl_token_metadata"
          ],
          "writable": true
        },
        {
          "name": "fractionalizerTokenAccount",
          "docs": [
            "Fractionalizer's token account - receives net supply (total_supply - protocol fee)",
            "init_if_needed, same decimals as fraction mint (9)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "fractionalizer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "fractionMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "treasury",
          "docs": [
            "Treasury wallet (protocol owner) – authority of treasury ATA."
          ]
        },
        {
          "name": "treasuryTokenAccount",
          "docs": [
            "Treasure token account - receives protocol fee in the form of the fraction tokens of the total supply minted",
            "init_if_needed, same decimals as fraction mint (9)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasury"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "fractionMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "docs": [
            "Token programs & system program."
          ],
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "bubblegumProgram",
          "address": "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"
        },
        {
          "name": "compressionProgram"
        },
        {
          "name": "nftAsset",
          "writable": true
        },
        {
          "name": "merkleTree",
          "writable": true
        },
        {
          "name": "treeAuthority",
          "writable": true
        },
        {
          "name": "leafDelegate",
          "optional": true
        },
        {
          "name": "logWrapper"
        },
        {
          "name": "tokenMetadataProgram",
          "address": "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
        }
      ],
      "args": [
        {
          "name": "totalSupply",
          "type": "u64"
        },
        {
          "name": "minLpAgeSeconds",
          "type": {
            "option": "i64"
          }
        },
        {
          "name": "minReclaimPercent",
          "type": {
            "option": "u8"
          }
        },
        {
          "name": "minLiquidityPercent",
          "type": {
            "option": "u8"
          }
        },
        {
          "name": "minVolumePercent30d",
          "type": {
            "option": "u8"
          }
        },
        {
          "name": "root",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "dataHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "creatorHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "nonce",
          "type": "u64"
        },
        {
          "name": "index",
          "type": "u32"
        },
        {
          "name": "cnftName",
          "type": "string"
        },
        {
          "name": "cnftSymbol",
          "type": "string"
        },
        {
          "name": "cnftUri",
          "type": "string"
        }
      ]
    },
    {
      "name": "initializeReclaimV1",
      "discriminator": [
        28,
        52,
        96,
        248,
        184,
        88,
        184,
        66
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "nftAssetId"
              }
            ]
          }
        },
        {
          "name": "fractionMint",
          "writable": true
        },
        {
          "name": "userFractionedTokenAccount",
          "writable": true
        },
        {
          "name": "compensationEscrowAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  109,
                  112,
                  101,
                  110,
                  115,
                  97,
                  116,
                  105,
                  111,
                  110,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "tokenEscrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "compensationEscrowAuthority"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "fractionMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "bubblegumProgram",
          "address": "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"
        },
        {
          "name": "compressionProgram"
        },
        {
          "name": "merkleTree",
          "writable": true
        },
        {
          "name": "treeAuthority",
          "writable": true
        },
        {
          "name": "leafDelegate",
          "optional": true
        },
        {
          "name": "logWrapper"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nftAssetId",
          "type": "pubkey"
        },
        {
          "name": "root",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "dataHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "creatorHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "nonce",
          "type": "u64"
        },
        {
          "name": "index",
          "type": "u32"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "vault",
      "discriminator": [
        211,
        8,
        232,
        43,
        2,
        152,
        117,
        119
      ]
    }
  ],
  "events": [
    {
      "name": "fractionalized",
      "discriminator": [
        56,
        18,
        248,
        156,
        13,
        210,
        188,
        152
      ]
    },
    {
      "name": "programInitialized",
      "discriminator": [
        43,
        70,
        110,
        241,
        199,
        218,
        221,
        245
      ]
    },
    {
      "name": "reclaimCancelled",
      "discriminator": [
        45,
        203,
        73,
        253,
        128,
        134,
        73,
        127
      ]
    },
    {
      "name": "reclaimFinalized",
      "discriminator": [
        17,
        84,
        50,
        82,
        75,
        38,
        173,
        48
      ]
    },
    {
      "name": "reclaimInitiated",
      "discriminator": [
        209,
        100,
        81,
        69,
        121,
        12,
        154,
        251
      ]
    },
    {
      "name": "redeemed",
      "discriminator": [
        14,
        29,
        183,
        71,
        31,
        165,
        107,
        38
      ]
    },
    {
      "name": "vaultClosed",
      "discriminator": [
        238,
        129,
        38,
        228,
        227,
        118,
        249,
        215
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "vaultNotActive",
      "msg": "Vault is not active (already reclaimed or closed)"
    },
    {
      "code": 6001,
      "name": "poolTooYoung",
      "msg": "Pool is too young"
    },
    {
      "code": 6002,
      "name": "insufficientTokens",
      "msg": "Insufficient tokens for reclaim"
    },
    {
      "code": 6003,
      "name": "insufficientUsdcForCompensation",
      "msg": "The user has NOT enough USDC for compensation"
    },
    {
      "code": 6004,
      "name": "invalidPool",
      "msg": "Invalid Raydium pool (wrong program or mints)"
    },
    {
      "code": 6005,
      "name": "wrongMint",
      "msg": "Pool mint mismatch"
    },
    {
      "code": 6006,
      "name": "invalidPoolOwner",
      "msg": "Pool account is not owned by Raydium CP-Swap program"
    },
    {
      "code": 6007,
      "name": "vaultNotReclaimed",
      "msg": "Vault is not reclaimed"
    },
    {
      "code": 6008,
      "name": "noTokensToRedeem",
      "msg": "No tokens to redeem"
    },
    {
      "code": 6009,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6010,
      "name": "supplyMismatch",
      "msg": "Supply Mismatch"
    },
    {
      "code": 6011,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6012,
      "name": "invalidSupply",
      "msg": "Invalid supply"
    },
    {
      "code": 6013,
      "name": "escrowNotEmpty",
      "msg": "Escrow still holds USDC"
    },
    {
      "code": 6014,
      "name": "invalidFractionTokenAccount",
      "msg": "Token-account mint does not match expected fraction mint"
    },
    {
      "code": 6015,
      "name": "invalidUsdcTokenAccount",
      "msg": "USDC token-account mint does not match expected USDC mint"
    },
    {
      "code": 6016,
      "name": "invalidOwner",
      "msg": "Token-account owner does not match signer"
    },
    {
      "code": 6017,
      "name": "invalidPoolAccountSize",
      "msg": "Pool account size too small"
    },
    {
      "code": 6018,
      "name": "invalidObservationAccountSize",
      "msg": "Observation account size too small"
    },
    {
      "code": 6019,
      "name": "invalidPoolData",
      "msg": "Failed to deserialize pool data"
    },
    {
      "code": 6020,
      "name": "invalidObservationData",
      "msg": "Failed to deserialize observation data"
    },
    {
      "code": 6021,
      "name": "twapWindowTooShort",
      "msg": "On-chain TWAP window shorter than required minimum"
    },
    {
      "code": 6022,
      "name": "invalidPoolTokens",
      "msg": "Invalid tokens in the Pool"
    },
    {
      "code": 6023,
      "name": "invalidNftAssetId",
      "msg": "The provided nft_asset_id does not match the vault's stored asset ID"
    },
    {
      "code": 6024,
      "name": "insufficientTwapData",
      "msg": "Not enough observation for twap calculations"
    },
    {
      "code": 6025,
      "name": "vaultNotInReclaimInitiated",
      "msg": "Vault is not in ReclaimInitiated status"
    },
    {
      "code": 6026,
      "name": "escrowPeriodNotEnded",
      "msg": "Escrow period has not ended yet"
    },
    {
      "code": 6027,
      "name": "unauthorizedFinalizer",
      "msg": "Only the original reclaim initiator can finalize"
    },
    {
      "code": 6028,
      "name": "unauthorizedCancellation",
      "msg": "Only the original reclaim initiator can cancel"
    },
    {
      "code": 6029,
      "name": "insufficientUsdcForCancellationFee",
      "msg": "Insufficient USDC balance to pay cancellation fee (100 USDC required)"
    },
    {
      "code": 6030,
      "name": "invalidTreasuryAccount",
      "msg": "Invalid Treasury Account"
    },
    {
      "code": 6031,
      "name": "percentageFeeTooHigh",
      "msg": "Percentage Fee can NOT be above 100%"
    },
    {
      "code": 6032,
      "name": "insufficientUsdcForReclaimFeeAndCompensation",
      "msg": "Insuficient USDC balance to pay both Reclaim Fee and Compensation"
    }
  ],
  "types": [
    {
      "name": "fractionalized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "nftAssetId",
            "type": "pubkey"
          },
          {
            "name": "fractionMint",
            "type": "pubkey"
          },
          {
            "name": "totalSupply",
            "type": "u64"
          },
          {
            "name": "netSupply",
            "type": "u64"
          },
          {
            "name": "feeAmount",
            "type": "u64"
          },
          {
            "name": "minLpAgeSeconds",
            "type": "i64"
          },
          {
            "name": "minReclaimPercentage",
            "type": "u8"
          },
          {
            "name": "minLiquidityPercent",
            "type": "u8"
          },
          {
            "name": "minVolumePercent30d",
            "type": "u8"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "vaultStatus"
              }
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "programInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "minLpAgeSeconds",
            "type": "i64"
          },
          {
            "name": "minReclaimPercentage",
            "type": "u8"
          },
          {
            "name": "minLiquidityPercent",
            "type": "u8"
          },
          {
            "name": "minVolumePercent30d",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "reclaimCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "initiator",
            "type": "pubkey"
          },
          {
            "name": "tokensReturned",
            "type": "u64"
          },
          {
            "name": "cancellationFeePaid",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "reclaimFinalized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "reclaimer",
            "type": "pubkey"
          },
          {
            "name": "tokensBurned",
            "type": "u64"
          },
          {
            "name": "twapPrice",
            "type": "u64"
          },
          {
            "name": "totalCompensation",
            "type": "u64"
          },
          {
            "name": "minorityTokens",
            "type": "u64"
          },
          {
            "name": "isDirectReclaim",
            "type": "bool"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "reclaimInitiated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "initiator",
            "type": "pubkey"
          },
          {
            "name": "tokensLocked",
            "type": "u64"
          },
          {
            "name": "minorityTokens",
            "type": "u64"
          },
          {
            "name": "escrowEndsAt",
            "type": "i64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "redeemed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "redeemer",
            "type": "pubkey"
          },
          {
            "name": "tokensBurned",
            "type": "u64"
          },
          {
            "name": "usdcReceived",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "vault",
      "docs": [
        "One vault per fractionalised cNFT.",
        "Pool address is NOT stored; user supplies it at reclaim time."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nftMint",
            "type": "pubkey"
          },
          {
            "name": "nftAssetId",
            "type": "pubkey"
          },
          {
            "name": "fractionMint",
            "type": "pubkey"
          },
          {
            "name": "totalSupply",
            "type": "u64"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "creationTimestamp",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "vaultStatus"
              }
            }
          },
          {
            "name": "reclaimTimestamp",
            "type": "i64"
          },
          {
            "name": "twapPriceAtReclaim",
            "type": "u64"
          },
          {
            "name": "totalCompensation",
            "type": "u64"
          },
          {
            "name": "remainingCompensation",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "minLpAgeSeconds",
            "type": "i64"
          },
          {
            "name": "minReclaimPercentage",
            "type": "u8"
          },
          {
            "name": "minLiquidityPercent",
            "type": "u8"
          },
          {
            "name": "minVolumePercent30d",
            "type": "u8"
          },
          {
            "name": "reclaimInitiator",
            "type": "pubkey"
          },
          {
            "name": "reclaimInitiationTimestamp",
            "type": "i64"
          },
          {
            "name": "tokensInEscrow",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "vaultClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "vaultStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "reclaimInitiated"
          },
          {
            "name": "reclaimedFinalized"
          },
          {
            "name": "closed"
          }
        ]
      }
    }
  ]
};

