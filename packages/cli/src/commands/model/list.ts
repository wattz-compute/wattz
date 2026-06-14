import { Command } from 'commander';
import { WattzClient, type ModelFamily, type ModelModality } from '@wattz/sdk';
import { loadConfig } from '../../config/schema';
import { logger } from '../../utils/logger';
import { padRight } from '../../utils/format';

export function registerList(model: Command): void {
  model
    .command('list')
    .description('List models registered in the Wattz PDA registry.')
    .option('--family <family>', 'Filter by family (llama, mistral, stable-diffusion, whisper, ...)')
    .option('--modality <modality>', 'Filter by modality (text, image, audio, embedding)')
    .option('--commercial', 'Only show commercial-licensed models', false)
    .option('--json', 'Emit JSON instead of the table view', false)
    .action(async (opts: { family?: string; modality?: string; commercial: boolean; json: boolean }) => {
      const config = await loadConfig();
      const client = new WattzClient({
        baseURL: config.apiBase,
        apiKey: config.apiKey,
      });
      const res = await client.models.list({
        family: opts.family as ModelFamily | undefined,
        modality: opts.modality as ModelModality | undefined,
        commercial: opts.commercial || undefined,
      });
      if (opts.json) {
        console.log(JSON.stringify(res, null, 2));
        return;
      }
      if (res.data.length === 0) {
        logger.info('No models match the filters.');
        return;
      }
      const header = `${padRight('MODEL', 34)}  ${padRight('FAMILY', 16)}  ${padRight('LICENSE', 22)}  ${padRight('CTX', 8)}  PRICE/1k (p/c)`;
      console.log(header);
      console.log('-'.repeat(header.length));
      for (const m of res.data) {
        const price = `${m.price_per_1k_prompt}/${m.price_per_1k_completion}`;
        console.log(
          `${padRight(m.id, 34)}  ${padRight(m.family, 16)}  ${padRight(m.license.name, 22)}  ${padRight(
            m.context_window.toString(),
            8,
          )}  ${price}`,
        );
      }
    });
}
