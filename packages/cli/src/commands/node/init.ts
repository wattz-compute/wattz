import { Command } from 'commander';
import { loadOrCreateKeypair } from '../../solana/keypair';
import { defaultNodeConfig, loadConfig, saveConfig } from '../../config/schema';
import { ensureHome, keypairPath, wattzHome } from '../../config/path';
import { logger } from '../../utils/logger';
import {
  DEFAULT_MODEL,
  DEFAULT_NODE_BIND,
  DEFAULT_OLLAMA_ENDPOINT,
} from '../../constants';

export function registerInit(node: Command): void {
  node
    .command('init')
    .description('Initialize the local Wattz node identity, keypair, and config.')
    .option('--region <region>', 'Region label (e.g. us-east-1, eu-west, self-hosted)', 'self-hosted')
    .option('--model <model>', 'Default model id to serve', DEFAULT_MODEL)
    .option('--bind <bind>', 'HTTP listen address for the local node proxy', DEFAULT_NODE_BIND)
    .option('--ollama <url>', 'Ollama endpoint to proxy inference through', DEFAULT_OLLAMA_ENDPOINT)
    .option('--force', 'Overwrite existing node config (keypair is preserved)', false)
    .action(async (opts: { region: string; model: string; bind: string; ollama: string; force: boolean }) => {
      await ensureHome();
      const keypair = await loadOrCreateKeypair();
      const existing = await loadConfig();

      if (existing.node && !opts.force) {
        logger.warn(
          `Node config already exists at ${wattzHome()}. Pass --force to overwrite the node section.`,
        );
        logger.info(`Operator pubkey: ${keypair.publicKey.toBase58()}`);
        return;
      }

      const nodeConfig = defaultNodeConfig(keypair.publicKey.toBase58());
      nodeConfig.model = opts.model;
      nodeConfig.bind = opts.bind;
      nodeConfig.ollamaEndpoint = opts.ollama;

      const next = { ...existing, region: opts.region, node: nodeConfig };
      await saveConfig(next);

      logger.header('Wattz node initialized');
      logger.info(`Home dir:        ${wattzHome()}`);
      logger.info(`Keypair path:    ${keypairPath()}`);
      logger.info(`Operator pubkey: ${keypair.publicKey.toBase58()}`);
      logger.info(`Region:          ${opts.region}`);
      logger.info(`Default model:   ${opts.model}`);
      logger.info(`Bind address:    ${opts.bind}`);
      logger.info(`Ollama endpoint: ${opts.ollama}`);
      logger.info('Next: install Ollama from https://ollama.com and run `wattz node start`.');
    });
}
