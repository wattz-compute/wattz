import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { configPath, ensureHome } from './path';
import {
  DEFAULT_API_BASE,
  DEFAULT_MODEL,
  DEFAULT_NODE_BIND,
  DEFAULT_OLLAMA_ENDPOINT,
  DEFAULT_SOLANA_RPC,
  DEFAULT_STAKE_LAMPORTS,
} from '../constants';

export type SolanaCluster = 'mainnet-beta' | 'devnet' | 'testnet';
export type AttestationKind = 'sgx' | 'sev' | 'nvidia_cc' | 'none';

export interface NodeConfig {
  operator: string;
  model: string;
  bind: string;
  ollamaEndpoint: string;
  autoRegister: boolean;
  stakeLamports: number;
  attestation: AttestationKind;
}

export interface WattzConfig {
  apiBase: string;
  solanaRpc: string;
  cluster: SolanaCluster;
  region: string;
  apiKey?: string;
  telemetry: boolean;
  programId?: string;
  node?: NodeConfig;
}

export const DEFAULT_CONFIG: WattzConfig = {
  apiBase: DEFAULT_API_BASE,
  solanaRpc: DEFAULT_SOLANA_RPC,
  cluster: 'mainnet-beta',
  region: 'auto',
  telemetry: true,
};

export function defaultNodeConfig(operator: string): NodeConfig {
  return {
    operator,
    model: DEFAULT_MODEL,
    bind: DEFAULT_NODE_BIND,
    ollamaEndpoint: DEFAULT_OLLAMA_ENDPOINT,
    autoRegister: true,
    stakeLamports: DEFAULT_STAKE_LAMPORTS,
    attestation: 'none',
  };
}

export async function loadConfig(): Promise<WattzConfig> {
  const path = configPath();
  if (!existsSync(path)) {
    return { ...DEFAULT_CONFIG };
  }
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw) as Partial<WattzConfig>;
  return { ...DEFAULT_CONFIG, ...parsed };
}

export async function saveConfig(config: WattzConfig): Promise<void> {
  await ensureHome();
  await writeFile(configPath(), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}
