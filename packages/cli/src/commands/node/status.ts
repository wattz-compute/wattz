import { Command } from 'commander';
import { isProcessAlive, readNodeState } from '../../runtime/loader';
import { loadConfig } from '../../config/schema';
import { isOllamaOnline } from '../../runtime/ollama';
import { logger } from '../../utils/logger';
import { formatUptime, shortPubkey } from '../../utils/format';

export function registerStatus(node: Command): void {
  node
    .command('status')
    .description('Print the local node runtime status.')
    .action(async () => {
      const state = await readNodeState();
      const config = await loadConfig();
      logger.header('Wattz node status');
      if (!state) {
        logger.info('No node state on disk. Run `wattz node init` and `wattz node start`.');
        return;
      }
      const alive = isProcessAlive(state.pid);
      const ollamaOn = await isOllamaOnline(state.ollamaEndpoint);
      const uptime = Math.floor(Date.now() / 1000) - state.startedAt;
      logger.info(`Operator:   ${state.operator} (${shortPubkey(state.operator)})`);
      logger.info(`Model:      ${state.model}`);
      logger.info(`Bind:       ${state.bind}`);
      logger.info(`Ollama:     ${ollamaOn ? 'online' : 'offline'} at ${state.ollamaEndpoint}`);
      logger.info(
        `Process:    pid=${state.pid} ${alive ? 'running' : 'not running'} uptime=${
          alive ? formatUptime(uptime) : 'n/a'
        }`,
      );
      logger.info(`Gateway:    ${config.apiBase}`);
      logger.info(`Region:     ${config.region}`);
    });
}
