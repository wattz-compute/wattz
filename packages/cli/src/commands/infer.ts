import { Command } from 'commander';
import { WattzClient, type ChatMessage } from '@wattz/sdk';
import { loadConfig } from '../config/schema';
import { logger } from '../utils/logger';
import { formatDuration } from '../utils/format';
import { readStdin } from '../utils/stdin';

export function registerInferCommand(program: Command): void {
  program
    .command('infer')
    .description('Run a single inference against the Wattz gateway.')
    .requiredOption('--model <model>', 'Model id (e.g. llama-3-8b-instruct)')
    .option('--prompt <prompt>', 'User prompt (or read from stdin)')
    .option('--system <system>', 'Optional system prompt')
    .option('--temperature <temperature>', 'Sampling temperature 0..2', '0.7')
    .option('--max-tokens <n>', 'Maximum completion tokens', '512')
    .option('--stream', 'Stream the response as SSE', false)
    .option('--region <region>', 'Preferred region (auto by default)')
    .option('--tee', 'Require TEE-attested nodes only', false)
    .option('--json', 'Emit the raw completion JSON instead of just the content', false)
    .action(
      async (opts: {
        model: string;
        prompt?: string;
        system?: string;
        temperature: string;
        maxTokens: string;
        stream: boolean;
        region?: string;
        tee: boolean;
        json: boolean;
      }) => {
        const config = await loadConfig();
        const client = new WattzClient({
          baseURL: config.apiBase,
          apiKey: config.apiKey,
        });

        let prompt = opts.prompt;
        if (!prompt) prompt = await readStdin();
        if (!prompt || prompt.trim().length === 0) {
          logger.error('Prompt is empty. Pass --prompt or pipe text to stdin.');
          process.exitCode = 1;
          return;
        }

        const messages: ChatMessage[] = [];
        if (opts.system) messages.push({ role: 'system', content: opts.system });
        messages.push({ role: 'user', content: prompt });

        const temperature = Number(opts.temperature);
        const maxTokens = Number(opts.maxTokens);
        const startedAt = Date.now();

        if (opts.stream) {
          const stream = client.chat.completions.create({
            model: opts.model,
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: true,
            region: opts.region,
            require_tee: opts.tee || undefined,
          });
          let full = '';
          let servingNode: string | undefined;
          let servingAttestation: string | undefined;
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta.content ?? '';
            if (delta) {
              full += delta;
              logger.raw(delta);
            }
            if (chunk.wattz?.node_pubkey) servingNode = chunk.wattz.node_pubkey;
            if (chunk.wattz?.attestation_kind) servingAttestation = chunk.wattz.attestation_kind;
          }
          logger.raw('\n');
          logger.info(
            `latency=${formatDuration(Date.now() - startedAt)} chars=${full.length}${
              servingNode ? ` node=${servingNode}` : ''
            }${servingAttestation ? ` attestation=${servingAttestation}` : ''}`,
          );
          return;
        }

        const res = await client.chat.completions.create({
          model: opts.model,
          messages,
          temperature,
          max_tokens: maxTokens,
          region: opts.region,
          require_tee: opts.tee || undefined,
        });
        if (opts.json) {
          console.log(JSON.stringify(res, null, 2));
        } else {
          const content = res.choices[0]?.message.content ?? '';
          logger.raw(`${content}\n`);
        }
        logger.info(
          `latency=${formatDuration(Date.now() - startedAt)} tokens=${res.usage.total_tokens}${
            res.wattz?.node_pubkey ? ` node=${res.wattz.node_pubkey}` : ''
          }${res.wattz?.attestation_kind ? ` attestation=${res.wattz.attestation_kind}` : ''}`,
        );
      },
    );
}
