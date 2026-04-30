/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/wattz_marketplace.json`.
 */
export type WattzMarketplace = {
  "address": "GUDVbE4Jgmtu8jgxUVtq2wUmjdLxJzPqT3zET2EdTLiU",
  "metadata": {
    "name": "wattzMarketplace",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Wattz Solana AI Inference Marketplace -- settlement, dispute, staking, slashing, node/model registry",
    "repository": "https://github.com/wattz-compute/wattz"
  },
  "instructions": [
    {
      "name": "claimReward",
      "docs": [
        "Claim the accumulated uptime reward pool for a node."
      ],
      "discriminator": [
        149,
        95,
        181,
        242,
        94,
        90,
        158,
        162
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "node",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  111,
                  100,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "node"
          ]
        },
        {
          "name": "mint",
          "relations": [
            "config"
          ]
        },
        {
          "name": "nodeToken",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
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
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "increaseStake",
      "docs": [
        "Top up an existing stake (or create it) and extend the lock."
      ],
      "discriminator": [
        239,
        74,
        179,
        156,
        119,
        147,
        39,
        212
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "stake",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "staker"
              }
            ]
          }
        },
        {
          "name": "staker",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "relations": [
            "config"
          ]
        },
        {
          "name": "stakerToken",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "lockDurationSecs",
          "type": "i64"
        }
      ]
    },
    {
      "name": "initialize",
      "docs": [
        "One-shot initializer: creates the `Config` PDA and the program vault ATA."
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "mint",
          "docs": [
            "$WATTZ SPL mint."
          ]
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
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
              }
            ]
          }
        },
        {
          "name": "vault",
          "docs": [
            "Vault associated-token account, created here."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vaultAuthority"
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
                "path": "mint"
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
            "Treasury token account -- must already exist and hold `mint`."
          ]
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "gateway"
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
          "name": "minNodeStake",
          "type": "u64"
        },
        {
          "name": "disputeWindowSecs",
          "type": "i64"
        }
      ]
    },
    {
      "name": "openDispute",
      "docs": [
        "Open a dispute against a receipt during the dispute window."
      ],
      "discriminator": [
        137,
        25,
        99,
        119,
        23,
        223,
        161,
        42
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "receipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  99,
                  101,
                  105,
                  112,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "receipt.request_id",
                "account": "inferenceReceipt"
              }
            ]
          }
        },
        {
          "name": "dispute",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "receipt"
              }
            ]
          }
        },
        {
          "name": "opener",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "reasonCode",
          "type": "u8"
        },
        {
          "name": "evidenceHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "registerModel",
      "docs": [
        "Publish a model + licence + price in the on-chain registry."
      ],
      "discriminator": [
        111,
        236,
        93,
        31,
        195,
        210,
        142,
        125
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "model",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  111,
                  100,
                  101,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "publisher"
              },
              {
                "kind": "arg",
                "path": "name"
              },
              {
                "kind": "arg",
                "path": "version"
              }
            ]
          }
        },
        {
          "name": "publisher",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "version",
          "type": "string"
        },
        {
          "name": "license",
          "type": {
            "defined": {
              "name": "license"
            }
          }
        },
        {
          "name": "ipfsHash",
          "type": "string"
        },
        {
          "name": "pricePer1kTokens",
          "type": "u64"
        },
        {
          "name": "kycGated",
          "type": "bool"
        }
      ]
    },
    {
      "name": "registerNode",
      "docs": [
        "Register a GPU node and lock the initial stake (>= `config.min_node_stake`)."
      ],
      "discriminator": [
        102,
        85,
        117,
        114,
        194,
        188,
        211,
        168
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "node",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  111,
                  100,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "stake",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "relations": [
            "config"
          ]
        },
        {
          "name": "stakerToken",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "gpuModel",
          "type": "string"
        },
        {
          "name": "region",
          "type": "string"
        },
        {
          "name": "endpoint",
          "type": "string"
        },
        {
          "name": "initialStake",
          "type": "u64"
        }
      ]
    },
    {
      "name": "resolveDispute",
      "docs": [
        "Admin records dispute outcome, applying reputation + flag effects."
      ],
      "discriminator": [
        231,
        6,
        202,
        6,
        96,
        103,
        12,
        230
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "dispute",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "receipt"
              }
            ]
          }
        },
        {
          "name": "receipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  99,
                  101,
                  105,
                  112,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "receipt.request_id",
                "account": "inferenceReceipt"
              }
            ]
          }
        },
        {
          "name": "node",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  111,
                  100,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "node.authority",
                "account": "nodeAccount"
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "resolution",
          "type": {
            "defined": {
              "name": "resolution"
            }
          }
        }
      ]
    },
    {
      "name": "settleInference",
      "docs": [
        "After dispute window, distribute price and burn the project fee share."
      ],
      "discriminator": [
        76,
        241,
        67,
        243,
        69,
        225,
        57,
        129
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "receipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  99,
                  101,
                  105,
                  112,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "receipt.request_id",
                "account": "inferenceReceipt"
              }
            ]
          }
        },
        {
          "name": "node",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  111,
                  100,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "node.authority",
                "account": "nodeAccount"
              }
            ]
          }
        },
        {
          "name": "model"
        },
        {
          "name": "mint",
          "writable": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
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
              }
            ]
          }
        },
        {
          "name": "nodeToken",
          "writable": true
        },
        {
          "name": "publisherToken",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "settler",
          "docs": [
            "Anyone may crank the settle once the dispute window has elapsed."
          ],
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "slashNode",
      "docs": [
        "Admin slashes the stake of a node whose reputation dropped below the",
        "slashing threshold."
      ],
      "discriminator": [
        165,
        178,
        153,
        22,
        241,
        166,
        114,
        236
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "node",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  111,
                  100,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "node.authority",
                "account": "nodeAccount"
              }
            ]
          }
        },
        {
          "name": "stake",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "node.authority",
                "account": "nodeAccount"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
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
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "slashAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "submitInference",
      "docs": [
        "Gateway records a completed inference receipt and funds the vault."
      ],
      "discriminator": [
        87,
        87,
        131,
        104,
        124,
        1,
        88,
        159
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "receipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  99,
                  101,
                  105,
                  112,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "requestId"
              }
            ]
          }
        },
        {
          "name": "node",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  111,
                  100,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "node.authority",
                "account": "nodeAccount"
              }
            ]
          }
        },
        {
          "name": "model"
        },
        {
          "name": "requester"
        },
        {
          "name": "gateway",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "relations": [
            "config"
          ]
        },
        {
          "name": "gatewayToken",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "requestId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "promptHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "responseHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "tokens",
          "type": "u32"
        },
        {
          "name": "price",
          "type": "u64"
        },
        {
          "name": "teeAttestationHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "unstake",
      "docs": [
        "Withdraw staked tokens once the lock has expired."
      ],
      "discriminator": [
        90,
        95,
        107,
        42,
        205,
        124,
        50,
        225
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "stake",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "staker"
              }
            ]
          }
        },
        {
          "name": "staker",
          "writable": true,
          "signer": true,
          "relations": [
            "stake"
          ]
        },
        {
          "name": "mint",
          "relations": [
            "config"
          ]
        },
        {
          "name": "stakerToken",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
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
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "disputeAccount",
      "discriminator": [
        237,
        70,
        91,
        63,
        81,
        74,
        45,
        43
      ]
    },
    {
      "name": "inferenceReceipt",
      "discriminator": [
        130,
        15,
        65,
        181,
        54,
        151,
        147,
        204
      ]
    },
    {
      "name": "modelAccount",
      "discriminator": [
        96,
        158,
        53,
        206,
        177,
        115,
        161,
        132
      ]
    },
    {
      "name": "nodeAccount",
      "discriminator": [
        125,
        166,
        18,
        146,
        195,
        127,
        86,
        220
      ]
    },
    {
      "name": "stakeAccount",
      "discriminator": [
        80,
        158,
        67,
        124,
        50,
        189,
        192,
        255
      ]
    }
  ],
  "events": [
    {
      "name": "disputeOpened",
      "discriminator": [
        239,
        222,
        102,
        235,
        193,
        85,
        1,
        214
      ]
    },
    {
      "name": "disputeResolved",
      "discriminator": [
        121,
        64,
        249,
        153,
        139,
        128,
        236,
        187
      ]
    },
    {
      "name": "inferenceSettled",
      "discriminator": [
        183,
        245,
        201,
        43,
        173,
        209,
        7,
        197
      ]
    },
    {
      "name": "inferenceSubmitted",
      "discriminator": [
        147,
        174,
        157,
        141,
        205,
        14,
        118,
        222
      ]
    },
    {
      "name": "modelPublished",
      "discriminator": [
        55,
        100,
        14,
        140,
        117,
        242,
        43,
        186
      ]
    },
    {
      "name": "nodeRegistered",
      "discriminator": [
        15,
        57,
        183,
        59,
        93,
        55,
        157,
        195
      ]
    },
    {
      "name": "nodeSlashed",
      "discriminator": [
        195,
        114,
        214,
        16,
        173,
        73,
        177,
        87
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
      "name": "rewardClaimed",
      "discriminator": [
        49,
        28,
        87,
        84,
        158,
        48,
        229,
        175
      ]
    },
    {
      "name": "stakeIncreased",
      "discriminator": [
        14,
        167,
        27,
        172,
        201,
        127,
        181,
        214
      ]
    },
    {
      "name": "stakeReleased",
      "discriminator": [
        7,
        221,
        192,
        32,
        123,
        29,
        96,
        45
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "insufficientStake",
      "msg": "Provided stake is below the configured minimum"
    },
    {
      "code": 6001,
      "name": "modelNotRegistered",
      "msg": "The referenced model account is not registered"
    },
    {
      "code": 6002,
      "name": "invalidAttestation",
      "msg": "TEE attestation hash is empty or malformed"
    },
    {
      "code": 6003,
      "name": "nodeSlashed",
      "msg": "Node has been slashed and cannot serve inferences"
    },
    {
      "code": 6004,
      "name": "disputeAlreadyOpen",
      "msg": "A dispute is already open on this receipt"
    },
    {
      "code": 6005,
      "name": "disputeWindowElapsed",
      "msg": "Dispute window has elapsed; disputes are no longer accepted"
    },
    {
      "code": 6006,
      "name": "disputeWindowActive",
      "msg": "Dispute window is still active; settlement is blocked"
    },
    {
      "code": 6007,
      "name": "receiptAlreadySettled",
      "msg": "Receipt has already been settled"
    },
    {
      "code": 6008,
      "name": "receiptDisputed",
      "msg": "Receipt is disputed; wait for resolution before settling"
    },
    {
      "code": 6009,
      "name": "licenseViolation",
      "msg": "Model license requires additional off-chain verification"
    },
    {
      "code": 6010,
      "name": "kycRequired",
      "msg": "KYC gating enabled; requester attestation missing"
    },
    {
      "code": 6011,
      "name": "stringTooLong",
      "msg": "String field exceeds its maximum length"
    },
    {
      "code": 6012,
      "name": "stakeLocked",
      "msg": "Stake is still within its lock period"
    },
    {
      "code": 6013,
      "name": "insufficientStakedAmount",
      "msg": "Requested amount exceeds staked balance"
    },
    {
      "code": 6014,
      "name": "reputationAboveSlashingThreshold",
      "msg": "Node reputation is above the slashing threshold"
    },
    {
      "code": 6015,
      "name": "unauthorized",
      "msg": "Caller is not authorized for this instruction"
    },
    {
      "code": 6016,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6017,
      "name": "disputeNotResolved",
      "msg": "Dispute is not in a resolvable state"
    },
    {
      "code": 6018,
      "name": "invalidResolution",
      "msg": "Invalid dispute resolution passed"
    },
    {
      "code": 6019,
      "name": "noPendingRewards",
      "msg": "Node has no pending rewards to claim"
    },
    {
      "code": 6020,
      "name": "invalidNodeAuthority",
      "msg": "Node account does not belong to the provided authority"
    },
    {
      "code": 6021,
      "name": "modelListFull",
      "msg": "Model support list is full"
    },
    {
      "code": 6022,
      "name": "modelMismatch",
      "msg": "Provided model account does not match receipt"
    },
    {
      "code": 6023,
      "name": "nodeMismatch",
      "msg": "Provided node account does not match receipt"
    },
    {
      "code": 6024,
      "name": "invalidPrice",
      "msg": "Provided price cannot be zero"
    }
  ],
  "types": [
    {
      "name": "config",
      "docs": [
        "Singleton configuration PDA.",
        "",
        "Seeds: `[b\"config\"]`",
        "",
        "Stores the admin (governance) key, the trusted inference gateway key that",
        "is allowed to submit receipts, the settlement mint, the treasury token",
        "account, and economic parameters that can be tuned at deploy time."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "docs": [
              "Governance authority. May resolve disputes and slash nodes."
            ],
            "type": "pubkey"
          },
          {
            "name": "gateway",
            "docs": [
              "Trusted inference gateway. Only this key may submit receipts."
            ],
            "type": "pubkey"
          },
          {
            "name": "mint",
            "docs": [
              "$WATTZ SPL mint used for settlement, staking and rewards."
            ],
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "docs": [
              "SPL token account that receives the non-burned share of the project fee."
            ],
            "type": "pubkey"
          },
          {
            "name": "minNodeStake",
            "docs": [
              "Minimum stake required to register a GPU node."
            ],
            "type": "u64"
          },
          {
            "name": "disputeWindowSecs",
            "docs": [
              "Grace period during which requesters may open a dispute."
            ],
            "type": "i64"
          },
          {
            "name": "vaultAuthorityBump",
            "docs": [
              "PDA bump for the vault authority (owner of the program vault ATA)."
            ],
            "type": "u8"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump for this Config account."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "disputeAccount",
      "docs": [
        "Dispute PDA.",
        "",
        "Seeds: `[b\"dispute\", receipt.key().as_ref()]`",
        "",
        "One dispute per receipt. `evidence_hash` points to an off-chain packet",
        "(mismatched TEE quote, tampered response transcript, ...)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "receipt",
            "docs": [
              "The receipt being disputed."
            ],
            "type": "pubkey"
          },
          {
            "name": "opener",
            "docs": [
              "Wallet that opened the dispute."
            ],
            "type": "pubkey"
          },
          {
            "name": "reasonCode",
            "docs": [
              "Free-form reason bucket (0 = attestation-mismatch, 1 = quality, ...)."
            ],
            "type": "u8"
          },
          {
            "name": "evidenceHash",
            "docs": [
              "Hash of the off-chain evidence bundle."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "resolved",
            "docs": [
              "Set true once the admin has recorded a resolution."
            ],
            "type": "bool"
          },
          {
            "name": "resolution",
            "docs": [
              "Final resolution."
            ],
            "type": {
              "defined": {
                "name": "resolution"
              }
            }
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "disputeOpened",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "dispute",
            "type": "pubkey"
          },
          {
            "name": "receipt",
            "type": "pubkey"
          },
          {
            "name": "opener",
            "type": "pubkey"
          },
          {
            "name": "reasonCode",
            "type": "u8"
          },
          {
            "name": "evidenceHash",
            "type": {
              "array": [
                "u8",
                32
              ]
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
      "name": "disputeResolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "dispute",
            "type": "pubkey"
          },
          {
            "name": "receipt",
            "type": "pubkey"
          },
          {
            "name": "resolution",
            "type": "u8"
          },
          {
            "name": "reputationDelta",
            "type": "i32"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "inferenceReceipt",
      "docs": [
        "Inference receipt PDA.",
        "",
        "Seeds: `[b\"receipt\", request_id.as_ref()]`",
        "",
        "`request_id` is a 32-byte identifier produced by the gateway (typically the",
        "blake3 hash of `{prompt, model, timestamp, requester}`). Storing prompt and",
        "response as opaque hashes keeps the on-chain footprint small while allowing",
        "any observer to reconstruct proofs off-chain against a signed transcript."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "requestId",
            "docs": [
              "Unique 32-byte request identifier."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "node",
            "docs": [
              "PDA of the serving node."
            ],
            "type": "pubkey"
          },
          {
            "name": "model",
            "docs": [
              "PDA of the model that produced the output."
            ],
            "type": "pubkey"
          },
          {
            "name": "requester",
            "docs": [
              "End-user requester wallet."
            ],
            "type": "pubkey"
          },
          {
            "name": "promptHash",
            "docs": [
              "Blake3 / sha256 hash of the input prompt."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "responseHash",
            "docs": [
              "Blake3 / sha256 hash of the streamed response."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "tokens",
            "docs": [
              "Number of output tokens billed."
            ],
            "type": "u32"
          },
          {
            "name": "price",
            "docs": [
              "Total price paid, denominated in $WATTZ base units."
            ],
            "type": "u64"
          },
          {
            "name": "teeAttestationHash",
            "docs": [
              "Hash of the TEE attestation (Intel SGX / AMD SEV-SNP / NVIDIA CC)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "timestamp",
            "docs": [
              "Unix timestamp at which the receipt was created."
            ],
            "type": "i64"
          },
          {
            "name": "settled",
            "docs": [
              "Set true after `settle_inference` executes."
            ],
            "type": "bool"
          },
          {
            "name": "disputed",
            "docs": [
              "Set true when a dispute is open against this receipt."
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "inferenceSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "receipt",
            "type": "pubkey"
          },
          {
            "name": "node",
            "type": "pubkey"
          },
          {
            "name": "publisher",
            "type": "pubkey"
          },
          {
            "name": "nodeImmediate",
            "type": "u64"
          },
          {
            "name": "nodePending",
            "type": "u64"
          },
          {
            "name": "publisherReward",
            "type": "u64"
          },
          {
            "name": "treasuryAmount",
            "type": "u64"
          },
          {
            "name": "burned",
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
      "name": "inferenceSubmitted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "receipt",
            "type": "pubkey"
          },
          {
            "name": "node",
            "type": "pubkey"
          },
          {
            "name": "model",
            "type": "pubkey"
          },
          {
            "name": "requester",
            "type": "pubkey"
          },
          {
            "name": "tokens",
            "type": "u32"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "teeAttestationHash",
            "type": {
              "array": [
                "u8",
                32
              ]
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
      "name": "license",
      "docs": [
        "Software licence classification.",
        "",
        "Kept as unit variants -- serialised as a single byte discriminator.",
        "Additional licences can be introduced without breaking existing accounts by",
        "remapping the `Custom` variant."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "metaCommunity"
          },
          {
            "name": "apache2"
          },
          {
            "name": "mit"
          },
          {
            "name": "creativeMlRailM"
          },
          {
            "name": "custom"
          }
        ]
      }
    },
    {
      "name": "modelAccount",
      "docs": [
        "Model registry PDA.",
        "",
        "Seeds: `[b\"model\", publisher.key().as_ref(), name.as_bytes(), version.as_bytes()]`",
        "",
        "One PDA per (publisher, name, version) triple. `ipfs_hash` is a CID pointer",
        "to weights / manifest hosted off-chain (IPFS / Arweave / R2)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "publisher",
            "docs": [
              "Wallet that published (and can update pricing for) this model."
            ],
            "type": "pubkey"
          },
          {
            "name": "name",
            "docs": [
              "Canonical model name, e.g. `llama-3-8b-instruct`."
            ],
            "type": "string"
          },
          {
            "name": "version",
            "docs": [
              "Semver-ish version tag, e.g. `1.0.0`, `q4_k_m`."
            ],
            "type": "string"
          },
          {
            "name": "license",
            "docs": [
              "Licence bucket."
            ],
            "type": {
              "defined": {
                "name": "license"
              }
            }
          },
          {
            "name": "ipfsHash",
            "docs": [
              "Content-addressed pointer to weights / manifest."
            ],
            "type": "string"
          },
          {
            "name": "pricePer1kTokens",
            "docs": [
              "Price charged per 1k output tokens, denominated in $WATTZ base units."
            ],
            "type": "u64"
          },
          {
            "name": "kycGated",
            "docs": [
              "True when the model requires KYC-verified requesters."
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "modelPublished",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "model",
            "type": "pubkey"
          },
          {
            "name": "publisher",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "version",
            "type": "string"
          },
          {
            "name": "license",
            "type": "u8"
          },
          {
            "name": "pricePer1kTokens",
            "type": "u64"
          },
          {
            "name": "kycGated",
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
      "name": "nodeAccount",
      "docs": [
        "GPU node account.",
        "",
        "Seeds: `[b\"node\", authority.key().as_ref()]`",
        "",
        "One `NodeAccount` per unique operator authority. Reputation is a signed",
        "running score updated on settle / dispute resolution / uptime heartbeats."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "Wallet that owns and operates the node."
            ],
            "type": "pubkey"
          },
          {
            "name": "gpuModel",
            "docs": [
              "Free-form GPU model tag, e.g. `RTX 4090`, `H100 80GB`."
            ],
            "type": "string"
          },
          {
            "name": "region",
            "docs": [
              "ISO-3166 alpha-2 region code, e.g. `US`, `KR`, `EU-DE`."
            ],
            "type": "string"
          },
          {
            "name": "endpoint",
            "docs": [
              "HTTPS endpoint the routing engine hits for inference requests."
            ],
            "type": "string"
          },
          {
            "name": "stakeAmount",
            "docs": [
              "Total tokens currently locked as stake by this node."
            ],
            "type": "u64"
          },
          {
            "name": "reputation",
            "docs": [
              "Running reputation score. Bounded on both sides."
            ],
            "type": "i32"
          },
          {
            "name": "uptimeLastPing",
            "docs": [
              "Unix timestamp of the last successful settle or heartbeat."
            ],
            "type": "i64"
          },
          {
            "name": "modelsSupported",
            "docs": [
              "Models this node has advertised support for."
            ],
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "pendingRewards",
            "docs": [
              "Accumulated uptime reward pool, claimable via `claim_reward`."
            ],
            "type": "u64"
          },
          {
            "name": "slashed",
            "docs": [
              "Set true once the node has been slashed. Prevents further receipts."
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "nodeRegistered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "node",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "gpuModel",
            "type": "string"
          },
          {
            "name": "region",
            "type": "string"
          },
          {
            "name": "endpoint",
            "type": "string"
          },
          {
            "name": "initialStake",
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
      "name": "nodeSlashed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "node",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "slashAmount",
            "type": "u64"
          },
          {
            "name": "remainingStake",
            "type": "u64"
          },
          {
            "name": "reputation",
            "type": "i32"
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
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "gateway",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "minNodeStake",
            "type": "u64"
          },
          {
            "name": "disputeWindowSecs",
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
      "name": "resolution",
      "docs": [
        "Dispute resolution outcome."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "favorOpener"
          },
          {
            "name": "favorNode"
          },
          {
            "name": "split"
          }
        ]
      }
    },
    {
      "name": "rewardClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "node",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "amount",
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
      "name": "stakeAccount",
      "docs": [
        "Stake PDA.",
        "",
        "Seeds: `[b\"stake\", staker.key().as_ref()]`",
        "",
        "Tracks staked amount and lock expiry per unique staker. The tokens",
        "themselves live in the program vault ATA; this account is metadata only."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "staker",
            "docs": [
              "Wallet that owns this stake."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Currently staked amount in $WATTZ base units."
            ],
            "type": "u64"
          },
          {
            "name": "lockUntil",
            "docs": [
              "Unix timestamp after which `unstake` is permitted."
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "stakeIncreased",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stake",
            "type": "pubkey"
          },
          {
            "name": "staker",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "total",
            "type": "u64"
          },
          {
            "name": "lockUntil",
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
      "name": "stakeReleased",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stake",
            "type": "pubkey"
          },
          {
            "name": "staker",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "remaining",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
