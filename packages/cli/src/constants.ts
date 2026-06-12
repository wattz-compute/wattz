export const CLI_NAME = 'wattz';
export const CLI_VERSION = '0.1.0';

export const DEFAULT_API_BASE = 'https://api.wattz.fi/v1';
export const DEFAULT_SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
export const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434';
export const DEFAULT_NODE_BIND = '0.0.0.0:8081';
export const DEFAULT_MODEL = 'llama-3-8b-instruct';
export const DEFAULT_STAKE_LAMPORTS = 10_000_000_000; // 10 SOL

export const DOCS_URL = 'https://wattz.fi/docs';

export const PALETTE = {
  cyan: '#5BC0EB',
  amber: '#FFD93D',
  gold: '#D4AF37',
  navy: '#0A0E27',
  white: '#F0EAD6',
  gray: '#8B8680',
  red: '#E86B6B',
  green: '#7FCFA1',
} as const;
