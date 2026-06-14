import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { loadConfig } from '../../config/schema';
import { loadKeypair } from '../../solana/keypair';
import { logger } from '../../utils/logger';

interface ModelManifest {
  id: string;
  family: string;
  parameters_b: number;
  context_window: number;
  modality: 'text' | 'image' | 'audio' | 'embedding';
  license: {
    spdx?: string;
    name: string;
    commercial: boolean;
    kyc_required: boolean;
    upstream_url?: string;
  };
  price_per_1k_prompt: number;
  price_per_1k_completion: number;
  supported_regions?: string[];
  min_gpu_vram_gb?: number;
  quantizations?: string[];
  description?: string;
}

export function registerPublish(model: Command): void {
  model
    .command('publish')
    .description('Publish a model manifest to the Wattz PDA registry.')
    .requiredOption('--file <file>', 'Path to model manifest (YAML or JSON)')
    .option('--dry-run', 'Validate the manifest without submitting a transaction', false)
    .action(async (opts: { file: string; dryRun: boolean }) => {
      const raw = await readFile(opts.file, 'utf8');
      const manifest = (opts.file.endsWith('.yaml') || opts.file.endsWith('.yml')
        ? (parseYaml(raw) as ModelManifest)
        : (JSON.parse(raw) as ModelManifest));
      validateManifest(manifest);
      const config = await loadConfig();
      const keypair = await loadKeypair();

      logger.header(`Publish model: ${manifest.id}`);
      logger.info(`Publisher:  ${keypair.publicKey.toBase58()}`);
      logger.info(`Family:     ${manifest.family}`);
      logger.info(`Modality:   ${manifest.modality}`);
      logger.info(`Params:     ${manifest.parameters_b}B`);
      logger.info(`Context:    ${manifest.context_window}`);
      logger.info(
        `License:    ${manifest.license.name} (commercial=${manifest.license.commercial}, kyc=${manifest.license.kyc_required})`,
      );
      logger.info(
        `Price/1k:   prompt=${manifest.price_per_1k_prompt} completion=${manifest.price_per_1k_completion}`,
      );

      if (opts.dryRun) {
        logger.success('Dry run passed. Manifest is valid.');
        return;
      }

      const url = `${config.apiBase.replace(/\/+$/, '')}/models/publish`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Wattz-Publisher': keypair.publicKey.toBase58(),
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify(manifest),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        const errText = await res.text();
        logger.error(`Publish failed: HTTP ${res.status} ${res.statusText} ${errText}`);
        process.exitCode = 1;
        return;
      }
      const body = (await res.json()) as { registry_pda?: string; signature?: string };
      logger.success(`Model published to registry.`);
      if (body.registry_pda) logger.info(`Registry PDA: ${body.registry_pda}`);
      if (body.signature) logger.info(`Solana tx:    ${body.signature}`);
      if (body.signature) logger.info(`Explorer:     https://solscan.io/tx/${body.signature}`);
    });
}

function validateManifest(m: ModelManifest): void {
  if (!m.id || typeof m.id !== 'string') {
    throw new Error('manifest.id is required');
  }
  if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(m.id)) {
    throw new Error(
      `manifest.id "${m.id}" must be lowercase [a-z0-9._-] between 2 and 64 characters`,
    );
  }
  if (!m.family || typeof m.family !== 'string') {
    throw new Error('manifest.family is required');
  }
  if (!['text', 'image', 'audio', 'embedding'].includes(m.modality)) {
    throw new Error(`manifest.modality "${m.modality}" is not supported`);
  }
  if (!m.license || !m.license.name) {
    throw new Error('manifest.license.name is required');
  }
  if (typeof m.parameters_b !== 'number' || m.parameters_b <= 0) {
    throw new Error('manifest.parameters_b must be > 0');
  }
  if (typeof m.context_window !== 'number' || m.context_window <= 0) {
    throw new Error('manifest.context_window must be > 0');
  }
  if (typeof m.price_per_1k_prompt !== 'number' || m.price_per_1k_prompt < 0) {
    throw new Error('manifest.price_per_1k_prompt must be >= 0');
  }
  if (typeof m.price_per_1k_completion !== 'number' || m.price_per_1k_completion < 0) {
    throw new Error('manifest.price_per_1k_completion must be >= 0');
  }
}
