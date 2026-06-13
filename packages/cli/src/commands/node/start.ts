import { Command } from 'commander';
import { loadConfig } from '../../config/schema';
import { loadKeypair } from '../../solana/keypair';
import { isOllamaOnline, mapWattzModelToOllama, ollamaHasModel } from '../../runtime/ollama';
import { createNodeProxy } from '../../runtime/proxy';
import { saveNodeState } from '../../runtime/loader';
import { generateAttestation } from '../../attestation/generate';
import { logger } from '../../utils/logger';

interface RegisterPayload {
  operator: string;
  model: string;
  bind: string;
  region: string;
  attestation_kind: string;
  attestation_hash: string;
  supported_models: string[];
  gpu_detected: string | null;
  total_memory_gb: number;
}

interface HeartbeatPayload {
  operator: string;
  model: string;
  region: string;
  requests: number;
  tokens: number;
  uptime_seconds: number;
}

export function registerStart(node: Command): void {
  node
    .command('start')
    .description('Start the local Wattz inference node (Ollama-backed by default).')
    .option('--model <model>', 'Override the model id to serve')
    .option('--bind <bind>', 'Override the HTTP listen address')
    .option('--ollama <url>', 'Override the Ollama endpoint')
    .option('--no-register', 'Do not register with the Wattz gateway (offline mode)')
    .action(async (opts: { model?: string; bind?: string; ollama?: string; register?: boolean }) => {
      const config = await loadConfig();
      if (!config.node) {
        logger.error('Node is not initialized. Run `wattz node init` first.');
        process.exitCode = 1;
        return;
      }

      const model = opts.model ?? config.node.model;
      const bind = opts.bind ?? config.node.bind;
      const ollamaEndpoint = opts.ollama ?? config.node.ollamaEndpoint;

      const keypair = await loadKeypair();
      const operator = keypair.publicKey.toBase58();

      logger.header('Wattz node start');
      logger.info(`Operator:   ${operator}`);
      logger.info(`Model:      ${model}`);
      logger.info(`Bind:       ${bind}`);
      logger.info(`Region:     ${config.region}`);
      logger.info(`Ollama:     ${ollamaEndpoint}`);
      logger.info(`API base:   ${config.apiBase}`);

      logger.info('Checking Ollama backend...');
      if (!(await isOllamaOnline(ollamaEndpoint))) {
        logger.error(`Ollama is not reachable at ${ollamaEndpoint}.`);
        logger.info('Install from https://ollama.com and run `ollama serve`, then retry.');
        process.exitCode = 1;
        return;
      }
      logger.success('Ollama backend reachable.');

      const ollamaModel = mapWattzModelToOllama(model);
      const hasModel = await ollamaHasModel(ollamaModel, ollamaEndpoint);
      if (!hasModel) {
        logger.warn(
          `Ollama does not have model "${ollamaModel}". Pull it with: ollama pull ${ollamaModel}`,
        );
      } else {
        logger.success(`Model "${ollamaModel}" is available locally.`);
      }

      const attestation = generateAttestation(operator);
      logger.info(
        `Attestation: kind=${attestation.kind} quote=${attestation.quote_hash.slice(0, 16)}... gpu=${
          attestation.gpu_detected ?? 'none'
        }`,
      );

      let requestCount = 0;
      let tokenCount = 0;
      const proxy = createNodeProxy({
        bind,
        ollamaEndpoint,
        model,
        operator,
        region: config.region,
        attestationHash: attestation.quote_hash,
        attestationKind: attestation.kind,
        onRequest: (info) => {
          requestCount += 1;
          tokenCount += info.tokens;
          logger.debug(
            `served request: model=${info.model} tokens=${info.tokens} latency=${info.latencyMs}ms`,
          );
        },
      });

      const listening = await proxy.listen();
      logger.success(`Local inference proxy listening on http://${listening.host}:${listening.port}`);

      const startedAt = Math.floor(Date.now() / 1000);
      await saveNodeState({
        pid: process.pid,
        startedAt,
        model,
        bind,
        ollamaEndpoint,
        operator,
      });

      let registered = false;
      let heartbeat: NodeJS.Timeout | undefined;

      const wantRegister = opts.register !== false && config.node.autoRegister;
      if (wantRegister) {
        try {
          const payload: RegisterPayload = {
            operator,
            model,
            bind,
            region: config.region,
            attestation_kind: attestation.kind,
            attestation_hash: attestation.quote_hash,
            supported_models: [model],
            gpu_detected: attestation.gpu_detected,
            total_memory_gb: attestation.total_memory_gb,
          };
          await postGateway(config.apiBase, '/nodes/register', payload);
          registered = true;
          logger.success(`Registered with the Wattz gateway at ${config.apiBase}.`);
        } catch (err) {
          logger.warn(
            `Could not register with the gateway (${(err as Error).message}). Running in offline mode.`,
          );
        }
      } else {
        logger.info('Skipping gateway registration (--no-register or autoRegister=false).');
      }

      if (registered) {
        heartbeat = setInterval(async () => {
          const payload: HeartbeatPayload = {
            operator,
            model,
            region: config.region,
            requests: requestCount,
            tokens: tokenCount,
            uptime_seconds: Math.floor(Date.now() / 1000) - startedAt,
          };
          try {
            await postGateway(config.apiBase, '/nodes/heartbeat', payload);
          } catch (err) {
            logger.debug(`Heartbeat failed: ${(err as Error).message}`);
          }
        }, 30_000);
      }

      const shutdown = async (signal: string) => {
        logger.info(`Received ${signal}, shutting down...`);
        if (heartbeat) clearInterval(heartbeat);
        await proxy.close();
        if (registered) {
          try {
            await postGateway(config.apiBase, '/nodes/unregister', { operator });
          } catch (err) {
            logger.debug(`Unregister failed: ${(err as Error).message}`);
          }
        }
        process.exit(0);
      };

      process.on('SIGINT', () => {
        void shutdown('SIGINT');
      });
      process.on('SIGTERM', () => {
        void shutdown('SIGTERM');
      });

      logger.info('Node is now serving. Press Ctrl+C to stop.');
    });
}

async function postGateway(apiBase: string, path: string, body: unknown): Promise<void> {
  const url = `${apiBase.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'wattz-cli/0.1.0',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`gateway ${path} returned HTTP ${res.status}`);
  }
}
