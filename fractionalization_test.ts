/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/fractionalization.json`.
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
          "name": "protocolPercentFee",
          "type": "u8"
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
      "name": "reclaimed",
      "discriminator": [
        230,
        25,
        32,
        135,
        40,
        167,
        137,
        130
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
      "name": "invalidPool",
      "msg": "Invalid Raydium pool (wrong program or mints)"
    },
    {
      "code": 6004,
      "name": "wrongMint",
      "msg": "Pool mint mismatch"
    },
    {
      "code": 6005,
      "name": "vaultNotReclaimed",
      "msg": "Vault is not reclaimed"
    },
    {
      "code": 6006,
      "name": "noTokensToRedeem",
      "msg": "No tokens to redeem"
    },
    {
      "code": 6007,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6008,
      "name": "supplyMismatch",
      "msg": "Supply Mismatch"
    },
    {
      "code": 6009,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6010,
      "name": "invalidSupply",
      "msg": "Invalid supply"
    },
    {
      "code": 6011,
      "name": "escrowNotEmpty",
      "msg": "Escrow still holds USDC"
    },
    {
      "code": 6012,
      "name": "invalidFractionTokenAccount",
      "msg": "Token-account mint does not match expected fraction mint"
    },
    {
      "code": 6013,
      "name": "invalidUsdcTokenAccount",
      "msg": "USDC token-account mint does not match expected USDC mint"
    },
    {
      "code": 6014,
      "name": "invalidOwner",
      "msg": "Token-account owner does not match signer"
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
      "name": "reclaimed",
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
            "name": "reclaimed"
          },
          {
            "name": "closed"
          }
        ]
      }
    }
  ]
};
